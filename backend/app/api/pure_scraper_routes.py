import time
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.pure_scraper import PureScraper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pure-scraper", tags=["pure-scraper"])


class PureScraperRequest(BaseModel):
    keywords: list[str]
    location: str = ""
    remote_only: bool = False
    platforms: list[str] = []
    max_results: int = 50


class PureScraperResponse(BaseModel):
    jobs: list[dict]
    total: int
    platforms_scraped: list[str]
    duration_seconds: float
    errors: list[str]


@router.post("/scrape", response_model=PureScraperResponse)
async def scrape_pure(request: PureScraperRequest):
    start = time.time()
    scraper = PureScraper(
        keywords=request.keywords,
        location=request.location,
        remote_only=request.remote_only,
    )
    platform_list = request.platforms if request.platforms else None
    jobs, errors = await scraper.scrape_all(platforms=platform_list)

    jobs.sort(key=lambda j: j.get("posted_date", ""), reverse=True)
    jobs = jobs[: request.max_results]

    platforms_used = list(set(j.get("platform", "") for j in jobs))

    return PureScraperResponse(
        jobs=jobs,
        total=len(jobs),
        platforms_scraped=platforms_used,
        duration_seconds=round(time.time() - start, 2),
        errors=errors,
    )


@router.get("/platforms")
async def get_platforms():
    scraper = PureScraper(keywords=[""])
    return {"platforms": scraper.supported_platforms}
