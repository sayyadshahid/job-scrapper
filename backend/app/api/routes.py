from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.models import base as models
from app.schemas import base as schemas
from app.services import scraper
from app.services import llm
from app.core.database import engine, get_db

router = APIRouter()

@router.get("/")
def read_root():
    return {"message": "Welcome to Job Scraper API"}

@router.post("/api/jobs/scrape", response_model=List[schemas.JobSchema])
def scrape_jobs_endpoint(request: schemas.ScrapeRequest):
    try:
        jobs = scraper.scrape_jobs(request)
        return jobs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/profile", response_model=schemas.ProfileSchema)
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).first()
    if not profile:
        return {"resume_text": ""}
    return profile

@router.post("/api/profile")
def save_profile(request: schemas.ProfileSchema, db: Session = Depends(get_db)):
    profile = db.query(models.UserProfile).first()
    if profile:
        profile.resume_text = request.resume_text
    else:
        profile = models.UserProfile(resume_text=request.resume_text)
        db.add(profile)
    db.commit()
    return {"status": "success"}

@router.post("/api/jobs/save", response_model=List[schemas.JobResponse])
def save_jobs(request: schemas.SaveJobsRequest, db: Session = Depends(get_db)):
    saved_jobs = []
    
    # Check if we have a resume for scoring
    profile = db.query(models.UserProfile).first()
    resume_text = profile.resume_text if profile and profile.resume_text else ""

    for job_data in request.jobs:
        job_data.session_name = request.session_name
        
        # Scrape Contact Info
        if job_data.application_link and job_data.application_link.startswith("http"):
            try:
                contact_data = scraper.scrape_contact_info(job_data.application_link, job_data.company)
                job_data.contact_email = contact_data.get("email")
                job_data.contact_phone = contact_data.get("phone")
                job_data.contact_website = contact_data.get("website")
                # Construct fallback text for contact_info column for backwards compatibility
                info_parts = []
                if job_data.contact_email:
                    info_parts.append(f"Email: {job_data.contact_email}")
                if job_data.contact_phone:
                    info_parts.append(f"Phone: {job_data.contact_phone}")
                if job_data.contact_website:
                    info_parts.append(f"Website: {job_data.contact_website}")
                job_data.contact_info = "\n".join(info_parts) if info_parts else "No contact information available."
            except Exception as e:
                print(f"Failed to scrape contact info for {job_data.application_link}: {e}")
                
        # Analyze Match
        if resume_text and job_data.description:
            match_results = llm.analyze_resume_match(job_data.description, resume_text)
            job_data.match_score = match_results.get("score")
            job_data.missing_keywords = match_results.get("missing_keywords")

        db_job = models.Job(**job_data.model_dump())
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        saved_jobs.append(db_job)
    return saved_jobs

@router.post("/api/jobs/{job_id}/draft-email", response_model=schemas.EmailDraftResponse)
def draft_email(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.Job).filter(models.Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    profile = db.query(models.UserProfile).first()
    resume_text = profile.resume_text if profile and profile.resume_text else ""
    
    if not resume_text:
        raise HTTPException(status_code=400, detail="Please add your resume in the Profile tab first.")
        
    draft = llm.generate_cold_email(job.description or "", resume_text, job.contact_info or "")
    return {"email_draft": draft}

@router.get("/api/jobs", response_model=List[schemas.JobResponse])
def get_saved_jobs(db: Session = Depends(get_db)):
    return db.query(models.Job).order_by(models.Job.created_at.desc()).all()
