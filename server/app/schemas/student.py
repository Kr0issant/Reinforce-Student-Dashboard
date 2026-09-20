from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, EmailStr, HttpUrl
from app.api.security import get_current_user
from typing import Optional, List


class SocialLinks(BaseModel):
    github: Optional[HttpUrl] = None
    kaggle: Optional[HttpUrl] = None
    discord: Optional[str] = None
    linkedin: Optional[HttpUrl] = None

class StudentBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    avatar_url: Optional[HttpUrl] = None
    skills: List[str] = Field(default_factory=list, description="e.g., Python, Java, JAX")
    social_links: SocialLinks = Field(default_factory=SocialLinks)