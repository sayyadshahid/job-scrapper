import os
import re
import urllib.parse
from urllib.parse import quote
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import logging

import requests
from bs4 import BeautifulSoup
import feedparser
from ddgs import DDGS

from app.schemas import base as schemas
from scrapegraphai.graphs import SmartScraperGraph, SearchGraph
from scrapegraphai.docloaders import ChromiumLoader
from scrapegraphai.utils.cleanup_html import minify_html

logger = logging.getLogger(__name__)

def pre_filter_html(html_content: str, target_site: str) -> str:
    soup = BeautifulSoup(html_content, "html.parser")
    
    # 1. Decompose scripts, styles, head, headers, footers, navs
    for tag in soup(["script", "style", "noscript", "iframe", "head", "header", "footer", "nav"]):
        tag.decompose()
        
    # 2. Try to find listing container based on target site
    container = None
    target_site = target_site.lower()
    
    if "linkedin" in target_site:
        container = (soup.find("ul", class_=re.compile("jobs-search__results-list")) or 
                     soup.find("section", class_="two-column-layout") or
                     soup.find("div", class_="jobs-search-results-list"))
    elif "naukri" in target_site:
        container = (soup.find("div", class_=re.compile("srp-container")) or 
                     soup.find("div", class_=re.compile("list")) or
                     soup.find("div", id="listContainer"))
    elif "indeed" in target_site:
        container = (soup.find("div", id="mosaic-provider-jobcards") or 
                     soup.find("ul", class_=re.compile("css-")) or
                     soup.find("td", class_=re.compile("resultContent")))
    elif "glassdoor" in target_site:
        container = (soup.find("ul", class_=re.compile("JobsList_jobsList")) or
                     soup.find("div", id="MainCol") or
                     soup.find("ul", attrs={"data-test": "job-listings"}))
    elif "internshala" in target_site:
        container = (soup.find("div", id="internship_list_container") or
                     soup.find("div", class_="internship_list_container"))
    elif "shine" in target_site:
        container = (soup.find("div", class_="job-search-results") or
                     soup.find("div", class_=re.compile("search_results")))
    elif "timesjobs" in target_site:
        container = (soup.find("ul", class_="new-joblist") or
                     soup.find("div", class_="job-bx"))
    elif "foundit" in target_site:
        container = (soup.find("div", class_="srpResultCard") or
                     soup.find("div", class_="cardContainer"))
    elif "workindia" in target_site:
        container = soup.find("div", class_=re.compile("job-list"))
    elif "unstop" in target_site:
        container = soup.find("div", class_=re.compile("opportunity-list"))
    elif "wellfound" in target_site:
        container = soup.find("div", class_=re.compile("jobs-list"))

    if container:
        target_element = container
    else:
        target_element = soup.find("main") or soup.find("body") or soup
        
    # 3. Strip all attributes except href on <a> tags (optimized to operate on Element directly)
    for tag in target_element.find_all(True):
        attrs_to_keep = {}
        if tag.name == "a" and "href" in tag.attrs:
            attrs_to_keep["href"] = tag.attrs["href"]
        tag.attrs = attrs_to_keep
        
    return minify_html(str(target_element))

def truncate_words(text: str, limit: int = 15) -> str:
    if not text:
        return ""
    try:
        clean_text = BeautifulSoup(text, "html.parser").get_text()
    except Exception:
        clean_text = text
    words = clean_text.split()
    if len(words) > limit:
        return " ".join(words[:limit]) + "..."
    return " ".join(words)

def parse_posted_time_to_days(posted_time_str: str) -> float:
    if not posted_time_str:
        return 999.0  # Assumed old if missing and filtering is active
        
    s = str(posted_time_str).lower().strip()
    
    # Try ISO formats
    try:
        cleaned_iso = s.replace("z", "+00:00")
        dt = datetime.fromisoformat(cleaned_iso)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        delta = now - dt
        return max(0.0, delta.total_seconds() / 86400.0)
    except Exception:
        pass

    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            delta = now - dt
            return max(0.0, delta.total_seconds() / 86400.0)
        except Exception:
            continue
            
    # Try timestamp
    try:
        if s.isdigit() and len(s) >= 10:
            ts = float(s)
            dt = datetime.fromtimestamp(ts, timezone.utc)
            now = datetime.now(timezone.utc)
            delta = now - dt
            return max(0.0, delta.total_seconds() / 86400.0)
    except Exception:
        pass
        
    # Check for relative keywords
    if any(k in s for k in ["today", "hour", "minute", "second", "now", "just now"]):
        return 0.0
    if "yesterday" in s:
        return 1.0
        
    # Extract digits
    numbers = [int(n) for n in re.findall(r'\d+', s)]
    if not numbers:
        if "week" in s:
            return 7.0
        if "month" in s:
            return 30.0
        return 999.0
        
    num = numbers[0]
    if "day" in s or re.search(r'\b\d+\s*d\b', s):
        return float(num)
    if "week" in s or re.search(r'\b\d+\s*w\b', s):
        return float(num * 7)
    if "month" in s or re.search(r'\b\d+\s*mo\b', s) or re.search(r'\b\d+\s*month\b', s):
        return float(num * 30)
    if "year" in s or re.search(r'\b\d+\s*y\b', s):
        return float(num * 365)
        
    if "m" in s:
        return 0.0
        
    return 999.0

def filter_jobs_by_date(jobs: list, date_posted: str) -> list:
    if not date_posted or date_posted == "Any":
        return jobs
        
    filtered = []
    max_days = 999.0
    if "24 hours" in date_posted.lower():
        max_days = 1.0
    elif "week" in date_posted.lower():
        max_days = 7.0
    elif "month" in date_posted.lower():
        max_days = 30.0
        
    for job in jobs:
        posted_time = job.get("posted_time")
        if not posted_time:
            filtered.append(job)
            continue
            
        days = parse_posted_time_to_days(str(posted_time))
        if days <= max_days:
            filtered.append(job)
            
    return filtered

def fetch_api_jobs(platform: str, req: schemas.ScrapeRequest) -> list:
    role_q = quote(req.role, safe='')
    jobs = []
    
    try:
        if platform == "remotive":
            url = f"https://remotive.com/api/remote-jobs?search={role_q}&limit=20"
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            if len(response.content) > 5_000_000:
                raise ValueError("Response too large")
            data = response.json()
            raw_jobs = data.get("jobs", [])
            for r in raw_jobs:
                pub_date = r.get("publication_date")
                posted_time_str = str(pub_date) if pub_date is not None else None
                jobs.append({
                    "title": r.get("title"),
                    "company": r.get("company_name"),
                    "location": r.get("candidate_required_location") or "Remote",
                    "salary": r.get("salary"),
                    "description": truncate_words(r.get("description", "")),
                    "application_link": r.get("url"),
                    "posted_time": posted_time_str,
                })
                
        elif platform == "arbeitnow":
            url = f"https://www.arbeitnow.com/api/job-board-api?search={role_q}"
            headers = {"User-Agent": "Mozilla/5.0"}
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            if len(response.content) > 5_000_000:
                raise ValueError("Response too large")
            data = response.json()
            raw_jobs = data.get("data", [])
            for r in raw_jobs:
                created_at = r.get("created_at")
                posted_time_str = str(created_at) if created_at is not None else None
                jobs.append({
                    "title": r.get("title"),
                    "company": r.get("company_name"),
                    "location": r.get("location"),
                    "salary": None,
                    "description": truncate_words(r.get("description", "")),
                    "application_link": r.get("url"),
                    "posted_time": posted_time_str,
                })
                
        elif platform == "jobicy":
            url = "https://jobicy.com/?feed=job_feed&job_categories=dev&search_region=india"
            feed = feedparser.parse(url)
            for entry in feed.entries:
                title = entry.get("title", "")
                summary = entry.get("summary", "")
                role_lower = req.role.lower()
                if role_lower in title.lower() or role_lower in summary.lower():
                    published = entry.get("published")
                    posted_time_str = str(published) if published is not None else None
                    jobs.append({
                        "title": title,
                        "company": entry.get("author"),
                        "location": "India (Remote/Hybrid)",
                        "salary": None,
                        "description": truncate_words(summary),
                        "application_link": entry.get("link"),
                        "posted_time": posted_time_str,
                    })
    except Exception as e:
        logger.error(f"Error fetching API jobs for {platform}: {e}", exc_info=True)
        raise
        
    return jobs

def scrape_jobs(req: schemas.ScrapeRequest):
    target_site = req.target_site.lower()
    
    if target_site == "all":
        all_jobs = []
        platforms = [
            "linkedin", "naukri", "indeed", "glassdoor",
            "internshala", "shine", "timesjobs", "foundit", "workindia",
            "unstop", "wellfound", "remotive", "arbeitnow", "jobicy"
        ]
        
        def scrape_single_platform(platform):
            platform_req = req.model_copy(update={"target_site": platform})
            try:
                return scrape_jobs(platform_req)
            except Exception as e:
                logger.error(f"Error scraping platform {platform} in parallel: {e}", exc_info=True)
                return []
                
        with ThreadPoolExecutor(max_workers=len(platforms)) as executor:
            results = executor.map(scrape_single_platform, platforms)
            for res in results:
                all_jobs.extend(res)
        return all_jobs

    if target_site in ["remotive", "arbeitnow", "jobicy"]:
        try:
            jobs = fetch_api_jobs(target_site, req)
            for job in jobs:
                job['source'] = target_site
                if job.get('description'):
                    words = job['description'].split()
                    if len(words) > 15:
                        job['description'] = ' '.join(words[:15]) + '...'
            jobs = filter_jobs_by_date(jobs, req.date_posted)
            return jobs
        except Exception as e:
            logger.error(f"Failed to fetch API jobs for {target_site}: {e}", exc_info=True)
            raise

    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        raise ValueError("DEEPSEEK_API_KEY environment variable is not set. Please provide the DeepSeek API key.")

    # URL building parameters, URL-encoded safely to prevent parameter injection
    role_slug = quote(req.role.lower().replace(' ', '-'), safe='')
    loc_slug = quote(req.location.lower().replace(' ', '-'), safe='')
    role_q = quote(req.role, safe='')
    loc_q = quote(req.location, safe='')
    skills_q = quote(req.skills, safe='')

    url_mappings = {
        "linkedin": f"https://www.linkedin.com/jobs/search?keywords={role_q}%20{skills_q}&location={loc_q}",
        "naukri": f"https://www.naukri.com/{role_slug}-jobs-in-{loc_slug}?k={role_q}&l={loc_q}",
        "indeed": f"https://in.indeed.com/jobs?q={role_q}+{skills_q}&l={loc_q}",
        "glassdoor": f"https://www.glassdoor.com/Job/jobs.htm?sc.keyword={role_q}&locT=C&locId={loc_q}",
        "internshala": f"https://internshala.com/jobs/{role_slug}-jobs-in-{loc_slug}/",
        "shine": f"https://www.shine.com/job-search/{role_slug}-jobs-in-{loc_slug}/",
        "timesjobs": f"https://www.timesjobs.com/candidate/job-search.html?searchType=personalizedSearch&from=submit&txtKeywords={role_q}&txtLocation={loc_q}",
        "foundit": f"https://www.foundit.in/search/{role_slug}-jobs-in-{loc_slug}",
        "workindia": f"https://www.workindia.in/job-search?search={role_q}&city={loc_q}",
        "unstop": f"https://unstop.com/jobs?search={role_q}&location={loc_q}",
        "wellfound": f"https://wellfound.com/jobs?q={role_q}&l={loc_q}%2C+India",
    }

    url = url_mappings.get(target_site)
    if not url:
        raise ValueError(f"Unsupported target site: {target_site}")

    raw_html = ""
    is_search_fallback = target_site in ["indeed", "glassdoor", "naukri"]
    force_chromium = target_site in ["unstop", "wellfound"]

    # 1. Fetch raw HTML using hybrid method
    if is_search_fallback:
        logger.info(f"[{target_site}] Platform uses strong anti-bot shields. Initiating DuckDuckGo search fallback...")
        try:
            query = f"site:{target_site}.com {req.role} {req.location} jobs"
            with DDGS() as ddgs:
                search_results = list(ddgs.text(query, max_results=30))
            
            pseudo_html_parts = []
            for r in search_results:
                title = r.get("title", "")
                link = r.get("href", "")
                body = r.get("body", "")
                pseudo_html_parts.append(
                    f'<div class="job-card">'
                    f'  <a href="{link}">{title}</a>'
                    f'  <p class="description">{body}</p>'
                    f'</div>'
                )
            if pseudo_html_parts:
                raw_html = f"<html><body>{''.join(pseudo_html_parts)}</body></html>"
                logger.info(f"[{target_site}] DuckDuckGo search fallback succeeded. Generated {len(pseudo_html_parts)} job card snippets.")
            else:
                logger.warning(f"[{target_site}] DuckDuckGo returned 0 search results.")
        except Exception as e:
            logger.error(f"[{target_site}] DuckDuckGo search fallback failed: {e}", exc_info=True)

    # Fallback to direct requests if search fallback was not used or returned no results
    if not raw_html and not force_chromium:
        logger.info(f"[{target_site}] Fetching directly via requests with browser headers...")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive"
        }
        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            if len(response.content) > 5_000_000:
                raise ValueError("Response too large")
            raw_html = response.text
            logger.info(f"[{target_site}] Successfully fetched page content via requests. Size: {len(raw_html)} chars.")
        except Exception as e:
            logger.error(f"[{target_site}] Direct requests failed with error: {e}", exc_info=True)

    # Ultimate fallback to ChromiumLoader if requests and search fallbacks both failed/were skipped
    if not raw_html:
        logger.info(f"[{target_site}] Falling back to ChromiumLoader...")
        try:
            loader = ChromiumLoader(
                [url],
                headless=True
            )
            docs = loader.load()
            if docs and docs[0].page_content:
                raw_html = docs[0].page_content
                logger.info(f"[{target_site}] Successfully fetched page content via ChromiumLoader. Size: {len(raw_html)} chars.")
        except Exception as e:
            logger.error(f"[{target_site}] ChromiumLoader failed with error: {e}", exc_info=True)
            raise

    # 2. Filter HTML to minimize token usage
    filtered_html = pre_filter_html(raw_html, target_site)
    logger.info(f"[{target_site}] Raw HTML: {len(raw_html)} chars -> Filtered HTML: {len(filtered_html)} chars (Saved {((len(raw_html) - len(filtered_html)) / len(raw_html)) * 100:.2f}%)")

    graph_config = {
        "llm": {
            "model": "deepseek/deepseek-chat",
            "api_key": api_key,
        },
        "verbose": True,
        "headless": True,
    }

    if is_search_fallback:
        base_prompt = (
            "The input is a list of search result snippets, not a real job board page.\n"
            "Each <div class='job-card'> is one result. Extract only these fields:\n"
            "'title' (string), 'company' (string, best guess from snippet), \n"
            f"'location' (string, best guess or use '{req.location}' as default),\n"
            "'description' (string, under 15 words from the snippet body),\n"
            "'application_link' (string, the href value from the <a> tag),\n"
            "'salary' (null — not available in search snippets),\n"
            "'posted_time' (null — not available in search snippets).\n"
            "Return all results under key 'jobs'."
        )
    else:
        base_prompt = (
            "Extract a list of job postings from the page. "
            "For each job, extract these precise fields: "
            "'title' (string), 'company' (string), 'location' (string), "
            "'salary' (string, if not found use null), "
            "'description' (string, short summary under 15 words), "
            "'application_link' (string, the URL to the job), "
            "'posted_time' (string — copy the exact text shown on the page, "
            "e.g. '2 hours ago', '3 days ago', '1 week ago'. "
            "Do NOT convert to dates. Do NOT calculate. Use null if not shown on the page.) "
        )

        filters = []
        if req.role:
            filters.append(f"The job title/role must be relevant to the requested role: '{req.role}'. Reject completely unrelated fields (e.g., if user wants '{req.role}', reject jobs for 'Sales', 'SQL Developer', 'Risk Associate', 'Human Resources', etc.). Only keep jobs matching or directly related to '{req.role}'.")
        if req.location and req.location.lower() != "any":
            filters.append(f"The job location must match or be relevant to the requested location: '{req.location}' (or accept 'Remote' / 'Work from Home'). Reject jobs located in other physical cities if they are not remote/work-from-home.")
        if req.work_model and req.work_model != "Any":
            filters.append(f"If the work model is mentioned, it must align with {req.work_model}. Do not reject if it is not mentioned, only reject if it explicitly contradicts (e.g., On-site when user requests Remote).")
        if req.experience_level and req.experience_level != "Any":
            filters.append(f"If experience level is mentioned, it must align with {req.experience_level}. Do not reject if it is not mentioned.")
        if req.job_type and req.job_type != "Any":
            filters.append(f"If job type (e.g., Full-time, Part-time, Contract, Internship) is mentioned, it must align with {req.job_type}. Do not reject if it is not mentioned.")
        if req.min_salary:
            filters.append(f"If salary is shown as an exact number or range AND it is below {req.min_salary}, reject the job. If salary says 'competitive', 'negotiable', 'as per industry', or is not mentioned at all — keep the job.")
        if req.visa_relocation:
            filters.append("If mentioned, it must offer Visa Sponsorship or Relocation Assistance.")
        if req.company_size and req.company_size != "Any":
            filters.append(f"If company size is mentioned, it should align with {req.company_size}.")
        if req.clearance and req.clearance != "None":
            filters.append(f"If mentioned, it must require or mention {req.clearance} security clearance.")
        if req.easy_apply:
            filters.append("If mentioned, it should support 'Easy Apply' or a 1-click apply process.")
        if req.exclude_keywords:
            filters.append(f"MUST NOT contain any of these keywords or be from these companies: {req.exclude_keywords}")

        if filters:
            base_prompt += "\n\nCRITICAL FILTERING RULES:\n"
            for f in filters:
                base_prompt += f"- {f}\n"
            base_prompt += "- Do not reject a job posting simply because a filter criterion is missing or not mentioned in the text. Only reject if there is an explicit contradiction.\n"

        base_prompt += "\nReturn the result under a key 'jobs' containing a list of these objects."

    smart_scraper_graph = SmartScraperGraph(
        prompt=base_prompt,
        source=filtered_html,
        config=graph_config
    )

    try:
        result = smart_scraper_graph.run()
        jobs = result.get("jobs", [])
    except Exception as e:
        logger.error(f"[{target_site}] SmartScraperGraph run failed: {e}", exc_info=True)
        raise

    # Post-processing
    for job in jobs:
        job['source'] = target_site
        if job.get('description'):
            words = job['description'].split()
            if len(words) > 15:
                job['description'] = ' '.join(words[:15]) + '...'

    # Filter jobs Python-side by date
    jobs = filter_jobs_by_date(jobs, req.date_posted)
    return jobs

def scrape_contact_info(url: str, company: str = "") -> dict:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return {"email": None, "phone": None, "website": None}
    
    graph_config = {
        "llm": {
            "model": "deepseek/deepseek-chat",
            "api_key": api_key,
        },
        "verbose": True,
        "headless": True,
    }

    prompt = (
        "Extract the contact email, recruiter phone/contact number, and company website link from this page. "
        "Return the result with these keys: "
        "'email' (string or null if not found), "
        "'phone' (string or null if not found), "
        "'website' (string or null if not found)."
    )

    # Pre-fetch via requests to avoid starting up a heavy browser loader (which is slow/resource intensive)
    source_content = url
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers, timeout=5)
        res.raise_for_status()
        if len(res.content) < 5_000_000:
            source_content = res.text
    except Exception as e:
        logger.warning(f"Fast HTTP fetch failed for contact info URL {url}. Falling back to default loader: {e}")

    smart_scraper_graph = SmartScraperGraph(
        prompt=prompt,
        source=source_content,
        config=graph_config
    )

    try:
        result = smart_scraper_graph.run()
        email = result.get("email")
        phone = result.get("phone")
        website = result.get("website")
        
        # Check if we got any contact info
        has_info = any(v and str(v).strip() != "" and "not found" not in str(v).lower() and "n/a" not in str(v).lower() for v in [email, phone, website])
        
        if not has_info and company:
            logger.info(f"Contact info not found on {url}. Falling back to SearchGraph for {company} careers page...")
            search_prompt = (
                f"Search the web for the '{company}' careers page or contact page. "
                "Extract the HR/contact email, recruiter phone/contact number, and company website link. "
                "Return the result with these keys: "
                "'email' (string or null if not found), "
                "'phone' (string or null if not found), "
                "'website' (string or null if not found)."
            )
            search_graph = SearchGraph(
                prompt=search_prompt,
                config=graph_config
            )
            fallback_result = search_graph.run()
            email = fallback_result.get("email") or email
            phone = fallback_result.get("phone") or phone
            website = fallback_result.get("website") or website
            
        # Clean not found values
        not_found_keywords = ["not found", "no contact", "not available", "none", "unable to find", "n/a"]
        def clean_val(v):
            if not v:
                return None
            v_str = str(v).strip()
            if any(kw in v_str.lower() for kw in not_found_keywords):
                return None
            return v_str

        return {
            "email": clean_val(email),
            "phone": clean_val(phone),
            "website": clean_val(website)
        }
    except Exception as e:
        logger.error(f"Error scraping contact info: {e}", exc_info=True)
        return {"email": None, "phone": None, "website": None}
