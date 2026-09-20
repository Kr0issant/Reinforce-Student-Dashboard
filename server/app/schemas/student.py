from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr

class SocialLinks(BaseModel):
    github: Optional[str] = None
    kaggle: Optional[str] = None
    discord: Optional[str] = None
    linkedin: Optional[str] = None

class StudentBase(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    avatar_url: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    social_links: SocialLinks = Field(default_factory=SocialLinks)

class StudentProfile(StudentBase):
    firebase_uid: Optional[str] = None
    discord_id: Optional[str] = None
    is_verified: bool = False
    verified_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    skills: Optional[List[str]] = None
    social_links: Optional[SocialLinks] = None

class DiscordVerifyRequest(BaseModel):
    discord_id: str = Field(..., description="Target Discord user snowflake ID (e.g. 1549547403819090011)")