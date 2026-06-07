from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    company = Column(String, index=True)
    location = Column(String)
    salary = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    application_link = Column(String, nullable=True)
    source = Column(String, nullable=True) # e.g. LinkedIn, Naukri
    contact_info = Column(Text, nullable=True)
    contact_email = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_website = Column(String, nullable=True)
    session_name = Column(String, nullable=True)
    match_score = Column(Integer, nullable=True)
    missing_keywords = Column(Text, nullable=True)
    posted_time = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, index=True)
    resume_text = Column(Text, nullable=True)
