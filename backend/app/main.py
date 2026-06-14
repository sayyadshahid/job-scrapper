from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine
from app.models import base as models
from app.api.routes import router

# Create DB tables
models.Base.metadata.create_all(bind=engine)

from sqlalchemy import text
with engine.begin() as conn:
    conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS posted_time VARCHAR;"))
    conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_email VARCHAR;"))
    conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_phone VARCHAR;"))
    conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS contact_website VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS title VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS linkedin VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS github VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS portfolio VARCHAR;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS skills TEXT;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;"))
    conn.execute(text("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();"))

app = FastAPI(title="Job Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
