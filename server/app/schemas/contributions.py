"""Pydantic models and schemas for Contributions.

A contribution is the auditable ledger record behind member points.
"""

from datetime import timezone
from enum import Enum
from typing import Annotated, List, Literal, Optional
from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    model_validator,
)

from app.schemas.common import DescriptionStr, NonBlankStr, TitleStr

UtcDatetime = Annotated[
    AwareDatetime,
    AfterValidator(lambda value: value.astimezone(timezone.utc)),
    PlainSerializer(lambda value: value.isoformat(), return_type=str, when_used="json"),
]


def _exact_int(value):
    if type(value) is not int:
        raise ValueError("must be an integer")
    return value


class ContributionTrack(str, Enum):
    KAGGLE = "kaggle"
    PRODUCT = "product"
    RESEARCH = "research"
    MISC = "misc"


class ContributionCategory(str, Enum):
    ACHIEVEMENT = "achievement"
    PROJECT_WORK = "project_work"
    TEACHING = "teaching"
    MENTORSHIP = "mentorship"
    CONTENT = "content"
    ORGANIZING = "organizing"
    SERVICE = "service"
    OTHER = "other"


class ContributionSourceType(str, Enum):
    PROJECT = "project"
    BLOG = "blog"
    TROPHY = "trophy_item"


class ContributionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVOKED = "revoked"


class ContributionSource(BaseModel):
    """The entity a contribution relates to."""
    model_config = ConfigDict(extra="forbid")

    type: ContributionSourceType
    id: NonBlankStr


class ContributionDetails(BaseModel):
    """Shared fields for awarding and recording contributions."""
    model_config = ConfigDict(extra="forbid")

    track: ContributionTrack = ContributionTrack.MISC
    category: ContributionCategory
    title: TitleStr
    description: Optional[DescriptionStr] = None
    points: int = Field(strict=True, ge=0)
    source: Optional[ContributionSource] = None
    event_id: Optional[NonBlankStr] = None
    spg_id: Optional[NonBlankStr] = None
    occurred_at: UtcDatetime

    @model_validator(mode="after")
    def _other_requires_description(self):
        if self.category is ContributionCategory.OTHER and self.description is None:
            raise ValueError("description is required when category is 'other'")
        return self


class AdminAwardUser(ContributionDetails):
    """Payload for POST /contributions/award/user/{user_id}."""
    deduplication_key: Optional[NonBlankStr] = None


class AdminAwardSPG(ContributionDetails):
    """Payload for POST /contributions/award/spg/{spg_id}."""


class AdminRevokeRecord(BaseModel):
    """Payload for PATCH /contributions/{record_id}/revoke."""
    model_config = ConfigDict(extra="forbid")

    status_reason: NonBlankStr


class ContributionBase(ContributionDetails):
    user_id: NonBlankStr


class ContributionCreate(ContributionBase):
    """Input from a trusted recorder (admin/bot)."""


_LIFECYCLE_FIELDS = ("reviewed_by", "reviewed_at", "revoked_by", "revoked_at", "status_reason")
_REQUIRED_LIFECYCLE_FIELDS = {
    ContributionStatus.PENDING: frozenset(),
    ContributionStatus.APPROVED: frozenset({"reviewed_by", "reviewed_at"}),
    ContributionStatus.REJECTED: frozenset({"reviewed_by", "reviewed_at", "status_reason"}),
    ContributionStatus.REVOKED: frozenset(_LIFECYCLE_FIELDS),
}


class ContributionRecord(ContributionBase):
    """A recorded contribution with its server-owned lifecycle metadata."""
    model_config = ConfigDict(extra="ignore")

    id: NonBlankStr
    schema_version: Annotated[Literal[1], BeforeValidator(_exact_int)] = 1
    status: ContributionStatus = ContributionStatus.APPROVED
    recorded_by: NonBlankStr
    created_at: UtcDatetime
    reviewed_by: Optional[NonBlankStr] = None
    reviewed_at: Optional[UtcDatetime] = None
    revoked_by: Optional[NonBlankStr] = None
    revoked_at: Optional[UtcDatetime] = None
    status_reason: Optional[NonBlankStr] = None
    deduplication_key: Optional[NonBlankStr] = None

    @model_validator(mode="after")
    def _lifecycle_matches_status(self):
        required = _REQUIRED_LIFECYCLE_FIELDS[self.status]
        for field in _LIFECYCLE_FIELDS:
            if (getattr(self, field) is not None) != (field in required):
                rule = "required" if field in required else "not allowed"
                raise ValueError(f"{field} is {rule} when status is '{self.status.value}'")
        if self.reviewed_at is not None and self.reviewed_at < self.created_at:
            raise ValueError("reviewed_at cannot be earlier than created_at")
        if self.revoked_at is not None and self.revoked_at < self.reviewed_at:
            raise ValueError("revoked_at cannot be earlier than reviewed_at")
        return self

    @property
    def counts_toward_leaderboard(self) -> bool:
        return self.status is ContributionStatus.APPROVED


class ContributionListResponse(BaseModel):
    items: List[ContributionRecord]
    total: int


# Backwards compatibility aliases
AdminAwardStudent = AdminAwardUser
