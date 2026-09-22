"""Minimal Student Project Group schema — enough for SPG award workflows.

An SPG is Reinforce's common team abstraction; its type says what the team
exists for. Not yet part of the Firestore data contract. Members are referenced
by ID, never embedded.
"""

from enum import Enum
from typing import List

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import NonBlankStr, TitleStr


class SPGType(str, Enum):
    """What the SPG exists for. Importance ("high value") is not a type; if it
    is ever needed it belongs in a separate field."""

    LEARNING = "learning"  # structured learning together
    PROJECT = "project"  # building a project or product
    EVENT = "event"  # an event hosted or managed by Reinforce
    EXTERNAL_EVENT = "external_event"  # an outside hackathon, competition or event
    MISCELLANEOUS = "miscellaneous"  # deliberate fallback; not free text


class SPGStatus(str, Enum):
    # Provisional values, from the backend data model proposal.
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    DISBANDED = "disbanded"


class SPGRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: NonBlankStr
    name: TitleStr
    type: SPGType
    member_ids: List[NonBlankStr] = Field(min_length=1)
    lead_id: NonBlankStr
    status: SPGStatus

    @model_validator(mode="after")
    def _members_are_unique_and_include_the_lead(self):
        # A member listed twice would be awarded twice in an SPG award.
        if len(set(self.member_ids)) != len(self.member_ids):
            raise ValueError("member_ids must not contain duplicates")
        if self.lead_id not in self.member_ids:
            raise ValueError("lead_id must be one of member_ids")
        return self
