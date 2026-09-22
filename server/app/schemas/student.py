from typing import Annotated, Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, EmailStr, StringConstraints, model_validator

from app.schemas.common import NonBlankStr

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


# --- /students API models ---
#
# Requests carry only what a student may set about themselves. Identity (UID,
# email, Discord link), points, admin rights and verification come from the
# verified token or server logic, never from a request body.

FullNameStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class SocialLinksInput(SocialLinks):
    """SocialLinks in a request: unknown link names are rejected, not dropped."""

    model_config = ConfigDict(extra="forbid")


class StudentCreate(BaseModel):
    """Body of POST /students/create."""

    model_config = ConfigDict(extra="forbid")

    full_name: FullNameStr
    skills: List[NonBlankStr] = Field(default_factory=list)
    social_links: SocialLinksInput = Field(default_factory=SocialLinksInput)


class StudentUpdate(BaseModel):
    """Body of PATCH /students/me-edit. Omitted fields are left unchanged.

    The avatar changes only through POST /students/me/avatar.
    """

    model_config = ConfigDict(extra="forbid")

    full_name: Optional[FullNameStr] = None
    skills: Optional[List[NonBlankStr]] = None
    social_links: Optional[SocialLinksInput] = None

    @model_validator(mode="after")
    def _sent_fields_are_not_null(self):
        # Optional means "may be omitted", not "may be cleared to null".
        for field in sorted(self.model_fields_set):
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit it to leave it unchanged")
        return self


class StudentResponse(BaseModel):
    """A student profile as returned by the /students endpoints.

    `points` is a read-only derived total — the sum of the student's approved
    contributions — never a stored or writable field. Email, Discord ID and
    admin state are left out because /students/{student_id} is visible to any
    signed-in member. Unknown stored fields are dropped, not rejected: this
    model filters what leaves the API.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    full_name: str
    avatar_url: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    social_links: SocialLinks = Field(default_factory=SocialLinks)
    points: int = Field(strict=True, ge=0)