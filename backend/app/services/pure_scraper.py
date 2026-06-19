import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class PureScraper:
    def __init__(self, keywords: list[str], location: str = "", remote_only: bool = False):
        self.keywords = [k.strip().lower() for k in keywords if k.strip()]
        self.location = location
        self.remote_only = remote_only
        self._ua = UserAgent()
        self._search_semaphore = asyncio.Semaphore(3)

    @property
    def supported_platforms(self) -> list[dict]:
        return [
            {"name": "remoteok", "method": "api", "label": "RemoteOK"},
            {"name": "remotive", "method": "api", "label": "Remotive"},
            {"name": "arbeitnow", "method": "api", "label": "Arbeitnow"},
            {"name": "jobicy", "method": "api", "label": "Jobicy"},
            {"name": "weworkremotely", "method": "rss", "label": "We Work Remotely"},
            {"name": "himalayas", "method": "api", "label": "Himalayas"},
            {"name": "eurojobs", "method": "html", "label": "Eurojobs"},
            {"name": "stepstone", "method": "html", "label": "Stepstone"},
            {"name": "jobstreet", "method": "html", "label": "Jobstreet"},
            {"name": "wellfound", "method": "html", "label": "Wellfound"},
            {"name": "themuse", "method": "api", "label": "The Muse"},
            {"name": "duckduckgo", "method": "search", "label": "DuckDuckGo Web Search"},
        ]

    async def scrape_all(self, platforms: list[str] = None) -> tuple[list[dict], list[str]]:
        if platforms:
            selected = [p for p in self.supported_platforms if p["name"] in platforms]
        else:
            selected = self.supported_platforms

        async def _scrape_one(platform: dict) -> tuple[str, list[dict], str | None]:
            try:
                method = platform["method"]
                if method == "api":
                    jobs = await self._scrape_api(platform["name"])
                elif method == "rss":
                    jobs = await self._scrape_rss(platform["name"])
                elif method == "html":
                    jobs = await self._scrape_html(platform["name"])
                elif method == "search":
                    jobs = await self._scrape_search()
                else:
                    jobs = []
                return platform["name"], jobs, None
            except Exception as e:
                logger.warning(f"[{platform['name']}] Scrape failed: {e}")
                return platform["name"], [], str(e)

        results = await asyncio.gather(*[_scrape_one(p) for p in selected], return_exceptions=False)

        all_jobs: list[dict] = []
        errors: list[str] = []
        for name, jobs, error in results:
            if error:
                errors.append(f"{name}: {error}")
            all_jobs.extend(jobs)

        seen = set()
        deduped = []
        for job in all_jobs:
            key = (job.get("url", ""), job.get("title", ""), job.get("company", ""))
            if key not in seen:
                seen.add(key)
                deduped.append(job)

        return deduped, errors

    async def _scrape_api(self, platform: str) -> list[dict]:
        url = self._build_url(platform)
        if not url:
            return []

        try:
            data = await self._fetch_api(url)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                logger.info(f"[{platform}] Rate limited, retrying with delay...")
                await asyncio.sleep(5)
                data = await self._fetch_api(url)
            else:
                raise

        raw_jobs = self._parse_api_response(platform, data)
        return [self._normalize_job(j, platform) for j in raw_jobs if self._keyword_match(j)]

    async def _scrape_rss(self, platform: str) -> list[dict]:
        import feedparser

        url = self._build_url(platform)
        if not url:
            return []

        loop = asyncio.get_event_loop()
        feed = await loop.run_in_executor(None, feedparser.parse, url)

        if feed.bozo and not feed.entries:
            logger.warning(f"[{platform}] RSS parse error: {feed.bozo_exception}")

        raw_jobs = self._parse_rss_entries(platform, feed.entries)
        return [self._normalize_job(j, platform) for j in raw_jobs if self._keyword_match(j)]

    async def _scrape_html(self, platform: str) -> list[dict]:
        url = self._build_url(platform)
        if not url:
            return []

        html = None
        try:
            html = await self._fetch_html(url)
        except Exception as e:
            logger.info(f"[{platform}] httpx failed, trying Playwright: {e}")
            html = await self._fetch_html_playwright(url)

        if not html:
            return []

        raw_jobs = self._parse_html(platform, html)
        return [self._normalize_job(j, platform) for j in raw_jobs if self._keyword_match(j)]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _fetch_api(self, url: str) -> dict | list:
        async with httpx.AsyncClient(timeout=15) as client:
            headers = {"User-Agent": self._ua.random, "Accept": "application/json"}
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def _fetch_html(self, url: str) -> str:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            headers = {
                "User-Agent": self._ua.random,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            }
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.text

    async def _fetch_html_playwright(self, url: str) -> str | None:
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(user_agent=self._ua.random)
                await page.goto(url, wait_until="networkidle", timeout=30000)
                content = await page.content()
                await browser.close()
                return content
        except Exception as e:
            logger.error(f"Playwright failed for {url}: {e}")
            return None

    async def _scrape_search(self) -> list[dict]:
        from ddgs import DDGS

        queries = self._generate_search_queries()
        if not queries:
            return []

        async def _search_agent(query: str) -> list[dict]:
            async with self._search_semaphore:
                try:
                    loop = asyncio.get_event_loop()
                    results = await loop.run_in_executor(None, self._ddg_search, query)
                    parsed = []
                    for r in results:
                        job = self._parse_search_result(r)
                        if job and self._keyword_match(job):
                            parsed.append(
                                self._normalize_job(job, "duckduckgo")
                            )
                    logger.info(f"[search-agent] '{query[:60]}' -> {len(parsed)} jobs")
                    return parsed
                except Exception as e:
                    logger.warning(f"[search-agent] Query failed '{query[:60]}': {e}")
                    return []

        batches = await asyncio.gather(*[_search_agent(q) for q in queries])

        seen = set()
        jobs = []
        for batch in batches:
            for job in batch:
                key = (job.get("url", ""), job.get("title", ""), job.get("company", ""))
                if key not in seen:
                    seen.add(key)
                    jobs.append(job)
        return jobs

    def _generate_search_queries(self) -> list[str]:
        queries = set()
        for kw in self.keywords:
            kw_clean = kw.replace("developer", "").replace("engineer", "").strip()
            queries.add(f"remote {kw} jobs")
            queries.add(f"hiring remote {kw}")
            queries.add(f"{kw} remote job")
            if self.location:
                queries.add(f"remote {kw} jobs {self.location}")
                queries.add(f"{kw} remote {self.location}")
                queries.add(f"remote developer {self.location}")
            if kw_clean:
                queries.add(f"remote {kw_clean} developer jobs")
        if self.location:
            queries.add(f"remote software developer jobs {self.location}")
        queries.add("remote developer jobs work from home")
        queries.add("remote software engineer jobs international")
        return list(queries)

    def _ddg_search(self, query: str) -> list[dict]:
        from ddgs import DDGS
        try:
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=25))
        except Exception as e:
            logger.warning(f"DDG search failed for '{query[:60]}': {e}")
            return []

    def _parse_search_result(self, result: dict) -> dict | None:
        title = result.get("title", "")
        url = result.get("href", "") or result.get("link", "")
        snippet = result.get("body", "") or result.get("snippet", "")

        if not title or not url:
            return None

        combined = (title + " " + snippet).lower()
        if not any(kw in combined for kw in self.keywords):
            return None

        title_clean = title
        company = ""
        for sep in [" at ", " - ", " | ", " with ", " @ "]:
            if sep in title:
                parts = title.split(sep, 1)
                title_clean = parts[0].strip()
                company = parts[1].strip()
                break

        location = ""
        if self.location:
            loc_lower = self.location.lower()
            if loc_lower in snippet.lower() or loc_lower in title.lower():
                location = self.location
        if not location:
            loc_match = re.search(
                r'(remote|work from home|wfh|hybrid|canada|uk|london|europe|usa|germany|netherlands|australia|singapore|india)',
                snippet, re.IGNORECASE
            )
            if loc_match:
                location = loc_match.group(1).capitalize()

        job_type = "remote"
        if not self.remote_only:
            text_lower = combined
            if "onsite" in text_lower or "on-site" in text_lower or "in office" in text_lower:
                job_type = "onsite"
            elif "hybrid" in text_lower:
                job_type = "hybrid"

        posted_date = ""
        date_match = re.search(
            r'(\d+\s*(hour|day|week|month)\s*ago|today|yesterday|\d{4}-\d{2}-\d{2})',
            snippet, re.IGNORECASE
        )
        if date_match:
            posted_date = date_match.group(1)

        return {
            "title": title_clean,
            "company": company,
            "location": location,
            "url": url,
            "salary": None,
            "job_type": job_type,
            "tags": [],
            "posted_date": posted_date,
        }

    async def extract_contact_batch(self, jobs: list[dict], max_concurrent: int = 5) -> list[dict]:
        sem = asyncio.Semaphore(max_concurrent)
        contact_headers = {
            "User-Agent": self._ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

        async def _try_one(job: dict) -> dict | None:
            url = job.get("url", "")
            if not url:
                return None
            async with sem:
                try:
                    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                        resp = await client.get(url, headers=contact_headers)
                        resp.raise_for_status()
                        html = resp.text
                except Exception:
                    return None

            soup = BeautifulSoup(html, "html.parser")

            content_selectors = [
                "main", "article", '[class*="description"]', '[class*="job-desc"]',
                '[class*="detail"]', '[id*="description"]', '[id*="job-detail"]',
                '[class*="content"]', ".job-view", ".posting",
            ]
            content_el = None
            for sel in content_selectors:
                content_el = soup.select_one(sel)
                if content_el and len(content_el.get_text(strip=True)) > 100:
                    break
                content_el = None

            text = content_el.get_text() if content_el else soup.get_text()

            email = None
            mailto = soup.select_one('a[href^="mailto:"]')
            if mailto:
                e = mailto["href"].replace("mailto:", "").split("?")[0].strip()
                if e and not any(x in e.lower() for x in ["noreply", "no-reply", "example", "support", "hello@", "contact@"]):
                    email = e

            if not email:
                found = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
                valid = [e for e in found if not any(
                    x in e.lower() for x in ["noreply", "no-reply", "example", "support", "hello@", "contact@"]
                )]
                if valid:
                    email = valid[0]

            phone = None
            phone_match = re.search(
                r'(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}', text
            )
            if phone_match:
                phone = phone_match.group(0).strip()

            if email or phone:
                job["contact_email"] = email
                job["contact_phone"] = phone
                return job
            return None

        results = await asyncio.gather(*[_try_one(j) for j in jobs])
        return [r for r in results if r is not None]

    def _build_url(self, platform: str) -> str | None:
        kw = quote(self.keywords[0]) if self.keywords else ""

        urls = {
            "remoteok": "https://remoteok.com/api",
            "remotive": f"https://remotive.com/api/remote-jobs?search={kw}&limit=100",
            "arbeitnow": "https://www.arbeitnow.com/api/job-board-api",
            "jobicy": f"https://jobicy.com/api/v2/remote-jobs?tag={kw}",
            "weworkremotely": "https://weworkremotely.com/remote-jobs.rss",
            "himalayas": f"https://himalayas.app/jobs/api?q={kw}&limit=50",
            "eurojobs": f"https://www.eurojobs.com/search-results-jobs/?keywords={kw}",
            "stepstone": f"https://www.stepstone.de/jobs/{kw}",
            "jobstreet": f"https://www.jobstreet.com/jobs/{kw}-jobs",
            "wellfound": f"https://wellfound.com/jobs?q={kw}",
            "themuse": "https://www.themuse.com/api/public/jobs?page=1",
        }
        return urls.get(platform)

    def _parse_api_response(self, platform: str, data: dict | list) -> list[dict]:
        try:
            if platform == "remoteok":
                if isinstance(data, list) and len(data) > 1:
                    return data[1:]
                return []
            elif platform == "remotive":
                return data.get("jobs", [])
            elif platform == "arbeitnow":
                return data.get("data", [])
            elif platform == "jobicy":
                return data.get("jobs", [])
            elif platform == "himalayas":
                return data.get("jobs", [])
            elif platform == "themuse":
                return data.get("results", [])
            return []
        except Exception as e:
            logger.error(f"[{platform}] Error parsing API response: {e}")
            return []

    def _parse_rss_entries(self, platform: str, entries: list) -> list[dict]:
        results = []
        for entry in entries:
            summary = entry.get("summary", entry.get("description", ""))
            soup = BeautifulSoup(summary, "html.parser")
            summary_text = soup.get_text(strip=True)

            results.append({
                "title": entry.get("title", ""),
                "company": entry.get("author") or self._extract_company_from_rss(entry),
                "location": "",
                "salary": None,
                "description": summary_text,
                "url": entry.get("link", ""),
                "tags": [],
                "posted_date": entry.get("published", entry.get("updated")),
            })
        return results

    def _extract_company_from_rss(self, entry: dict) -> str:
        summary = entry.get("summary", "")
        match = re.search(r'at\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[-–]|\s*\|)', summary)
        if match:
            return match.group(1).strip()
        return ""

    def _parse_html(self, platform: str, html: str) -> list[dict]:
        soup = BeautifulSoup(html, "html.parser")
        jobs = []

        try:
            if platform == "eurojobs":
                for card in soup.select(".job-result, .job-listing, article"):
                    title_el = card.select_one("h2 a, h3 a, .job-title a")
                    if not title_el:
                        continue
                    jobs.append({
                        "title": title_el.get_text(strip=True),
                        "company": self._text_or(card, ".company-name, .job-company, .employer"),
                        "location": self._text_or(card, ".location, .job-location"),
                        "salary": self._text_or(card, ".salary, .job-salary"),
                        "description": self._text_or(card, ".description, .job-description, .summary"),
                        "url": title_el.get("href", ""),
                        "tags": [],
                        "posted_date": self._text_or(card, ".date, .posted-date, .job-date"),
                    })

            elif platform == "stepstone":
                for card in soup.select("article[data-genesis-element='BASE'], article, .job-card, .job-listing, [data-testid='job-card']"):
                    title_el = card.select_one("h2 a, h3 a, [data-testid='job-title'] a, a[data-testid='job-link']")
                    if not title_el:
                        title_el = card.select_one("a[data-testid='job-list-item-link']")
                    if not title_el:
                        continue
                    jobs.append({
                        "title": title_el.get_text(strip=True),
                        "company": self._text_or(card, "[data-testid='company-name'], .company-name, .job-company"),
                        "location": self._text_or(card, "[data-testid='location'], .location, .job-location"),
                        "salary": self._text_or(card, "[data-testid='salary'], .salary, .job-salary"),
                        "description": "",
                        "url": title_el.get("href", "") if title_el.get("href", "").startswith("http") else f"https://www.stepstone.de{title_el.get('href', '')}",
                        "tags": [],
                        "posted_date": self._text_or(card, "[data-testid='date'], .date, .posted-date"),
                    })

            elif platform == "jobstreet":
                for card in soup.select("[data-automation='job-card'], .job-card, article, [data-testid='job-card']"):
                    title_el = card.select_one("[data-automation='job-title'] a, h3 a, a[data-automation='job-link'], a")
                    if not title_el:
                        continue
                    jobs.append({
                        "title": title_el.get_text(strip=True),
                        "company": self._text_or(card, "[data-automation='company-name'], .company-name, .job-company"),
                        "location": self._text_or(card, "[data-automation='location'], .location, .job-location"),
                        "salary": self._text_or(card, "[data-automation='salary'], .salary, .job-salary"),
                        "description": "",
                        "url": title_el.get("href", "") if "http" in title_el.get("href", "") else f"https://www.jobstreet.com{title_el.get('href', '')}",
                        "tags": [],
                        "posted_date": self._text_or(card, "[data-automation='date'], .date, .posted-date"),
                    })

            elif platform == "wellfound":
                for card in soup.select("div[class*='styles_jobCard'], .job-card, article, .styles-module__jobCard"):
                    title_el = card.select_one("a[class*='styles_jobTitle'], h2 a, h3 a, a[href*='/jobs/']")
                    if not title_el:
                        continue
                    jobs.append({
                        "title": title_el.get_text(strip=True),
                        "company": self._text_or(card, "[class*='company'], .company-name, .job-company, .styles-module__company"),
                        "location": self._text_or(card, "[class*='location'], .location, .job-location, [class*='styles_location']"),
                        "salary": self._text_or(card, "[class*='salary'], .salary, [class*='styles_salary']"),
                        "description": self._text_or(card, "[class*='description'], .description, .job-description"),
                        "url": title_el.get("href", "") if "http" in title_el.get("href", "") else f"https://wellfound.com{title_el.get('href', '')}",
                        "tags": [],
                        "posted_date": self._text_or(card, "[class*='date'], .date, .posted-date, [class*='styles_date']"),
                    })
        except Exception as e:
            logger.error(f"[{platform}] HTML parse error: {e}")

        return jobs

    def _text_or(self, parent, selector: str) -> str:
        el = parent.select_one(selector)
        return el.get_text(strip=True) if el else ""

    def _normalize_job(self, raw: dict, platform: str) -> dict:
        method_map = {"remoteok": "api", "remotive": "api", "arbeitnow": "api",
                       "jobicy": "api", "weworkremotely": "rss", "himalayas": "api",
                       "eurojobs": "html", "stepstone": "html", "jobstreet": "html",
                       "wellfound": "html", "themuse": "api", "duckduckgo": "search"}

        if platform == "remoteok":
            return {
                "title": raw.get("position", raw.get("title", "")),
                "company": raw.get("company", ""),
                "location": raw.get("location") or "Remote",
                "url": raw.get("url", ""),
                "salary": str(raw.get("salary_max", "") or "") if raw.get("salary_max") else None,
                "job_type": "remote" if "remote" in (raw.get("location", "") or "").lower() else "onsite",
                "tags": raw.get("tags", []),
                "posted_date": str(raw.get("date", "")),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        elif platform == "remotive":
            loc = raw.get("candidate_required_location", "")
            return {
                "title": raw.get("title", ""),
                "company": raw.get("company_name", ""),
                "location": loc or "Remote",
                "url": raw.get("url", ""),
                "salary": raw.get("salary"),
                "job_type": "remote",
                "tags": raw.get("tags", []),
                "posted_date": raw.get("publication_date", ""),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        elif platform == "arbeitnow":
            loc = raw.get("location", "")
            return {
                "title": raw.get("title", ""),
                "company": raw.get("company_name", ""),
                "location": loc,
                "url": raw.get("url", ""),
                "salary": None,
                "job_type": self._infer_job_type(raw),
                "tags": raw.get("tags", []),
                "posted_date": raw.get("created_at", ""),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        elif platform == "jobicy":
            return {
                "title": raw.get("jobTitle", raw.get("title", "")),
                "company": raw.get("companyName", raw.get("company", "")),
                "location": raw.get("jobGeo", raw.get("location", "")),
                "url": raw.get("url", raw.get("link", "")),
                "salary": raw.get("salary", raw.get("annualSalaryMin", "")),
                "job_type": self._infer_job_type(raw),
                "tags": raw.get("jobIndustries", raw.get("tags", [])),
                "posted_date": raw.get("pubDate", raw.get("posted_date", "")),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        elif platform == "himalayas":
            return {
                "title": raw.get("title", ""),
                "company": raw.get("companyName", ""),
                "location": raw.get("location", ""),
                "url": raw.get("applicationLink", raw.get("url", "")),
                "salary": raw.get("salary", ""),
                "job_type": "remote",
                "tags": raw.get("tags", []),
                "posted_date": raw.get("publishedAt", ""),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        elif platform == "themuse":
            locs = raw.get("locations", [])
            location = locs[0].get("name", "") if locs else ""
            company = raw.get("company", {})
            refs = raw.get("refs", {})
            return {
                "title": raw.get("name", ""),
                "company": company.get("name", "") if isinstance(company, dict) else company,
                "location": location,
                "url": refs.get("landing_page", ""),
                "salary": raw.get("salary", ""),
                "job_type": self._infer_job_type(raw),
                "tags": [c.get("name", "") for c in raw.get("categories", []) if isinstance(c, dict)] if raw.get("categories") else [],
                "posted_date": raw.get("publication_date", ""),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        elif platform == "duckduckgo":
            return {
                "title": raw.get("title", ""),
                "company": raw.get("company", ""),
                "location": raw.get("location", ""),
                "url": raw.get("url", ""),
                "salary": None,
                "job_type": raw.get("job_type", "remote"),
                "tags": [],
                "posted_date": raw.get("posted_date", ""),
                "platform": platform,
                "source_type": "search",
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            return {
                "title": raw.get("title", ""),
                "company": raw.get("company", ""),
                "location": raw.get("location", ""),
                "url": raw.get("url", ""),
                "salary": raw.get("salary"),
                "job_type": self._infer_job_type(raw),
                "tags": raw.get("tags", []),
                "posted_date": raw.get("posted_date", ""),
                "platform": platform,
                "source_type": method_map.get(platform, "api"),
                "scraped_at": datetime.now(timezone.utc).isoformat(),
            }

    def _infer_job_type(self, raw: dict) -> str:
        text = str(raw.get("location", "")) + " " + str(raw.get("title", "")) + str(raw.get("job_type", ""))
        text = text.lower()
        if "remote" in text:
            return "remote"
        if "hybrid" in text:
            return "hybrid"
        if self.remote_only:
            return "remote"
        return "onsite"

    def _keyword_match(self, raw: dict) -> bool:
        if not self.keywords:
            return True

        title_raw = raw.get("title") or raw.get("position") or raw.get("name") or ""
        if isinstance(title_raw, dict):
            title_raw = title_raw.get("name", "")
        title = str(title_raw).lower()
        tags_list = raw.get("tags", raw.get("jobIndustries", []))
        if isinstance(tags_list, list):
            tags_text = " ".join(t.lower() for t in tags_list if isinstance(t, str))
        else:
            tags_text = str(tags_list).lower()
        company = raw.get("company") or raw.get("company_name") or raw.get("companyName") or ""
        if isinstance(company, dict):
            company = company.get("name", "")
        company = str(company).lower()

        search_text = f"{title} {tags_text} {company}"

        for kw in self.keywords:
            if kw in search_text:
                return True
        return False
