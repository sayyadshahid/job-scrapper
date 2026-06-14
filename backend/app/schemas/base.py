from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ScrapeRequest(BaseModel):
    location: str
    role: str
    skills: str
    target_site: str
    work_model: Optional[str] = "Any"
    date_posted: Optional[str] = "Any"
    experience_level: Optional[str] = "Any"
    job_type: Optional[str] = "Any"
    exclude_keywords: Optional[str] = ""
    min_salary: Optional[str] = ""
    visa_relocation: Optional[bool] = False
    company_size: Optional[str] = "Any"
    clearance: Optional[str] = "None"
    easy_apply: Optional[bool] = False
    strict_date_filter: Optional[bool] = False

class JobSchema(BaseModel):
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    application_link: Optional[str] = None
    source: Optional[str] = None
    contact_info: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_website: Optional[str] = None
    session_name: Optional[str] = None
    match_score: Optional[int] = None
    missing_keywords: Optional[str] = None
    posted_time: Optional[str] = None

class JobCreate(JobSchema):
    pass

class JobResponse(JobSchema):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class SaveJobsRequest(BaseModel):
    jobs: List[JobCreate]
    session_name: str

class ProfileSchema(BaseModel):
    resume_text: str = ""
    full_name: str = ""
    title: str = ""
    location: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""
    skills: str = ""
    bio: str = ""


class ResumeParseRequest(BaseModel):
    resume_text: str


class ResumeParseResponse(BaseModel):
    full_name: str = ""
    title: str = ""
    location: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""
    skills: str = ""
    bio: str = ""

class EmailDraftResponse(BaseModel):
    email_draft: str
