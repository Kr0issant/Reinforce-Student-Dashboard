"""Response models for the read-only Discord mirror.

Shapes here mirror what the YUVI bot writes to Firestore. The authoritative
description of those documents is docs/DATA_CONTRACT.md — read it before
changing anything in this file, because the bot lives in another repository
and will not fail to build when this drifts.
"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class TicketCategory(str, Enum):
    SPG_REGISTRATION = "spg_registration"
    RESOURCE_REQUEST = "resource_request"
    SUPPORT = "support"
    IDEA_JAR = "idea_jar"
    REPORT = "report"
    MISC = "misc"


class TicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


# Confidential by design. The Discord modal promises members that misconduct
# reports are visible only to core admins, and this platform has no admin role
# yet, so these never leave the database through this API.
HIDDEN_CATEGORIES = frozenset({TicketCategory.REPORT.value})


# Firestore stores maps with keys sorted lexicographically, so the insertion
# order the bot used is lost in transit. Without this, an SPG registration
# reads back as "Duration -> Project Name -> Summary -> Team Members", which is
# not the order the member filled it in. Unknown keys fall back to alphabetical
# so a new bot category degrades instead of disappearing.
FIELD_ORDER: Dict[str, List[str]] = {
    TicketCategory.SPG_REGISTRATION.value: [
        "Project Name & Track", "Team Members", "Duration & Frequency", "Summary & Goals",
    ],
    TicketCategory.RESOURCE_REQUEST.value: [
        "SPG Name", "Resources Requested", "Progress Proof", "Justification",
    ],
    TicketCategory.IDEA_JAR.value: ["Idea Title", "Track", "Overview"],
    TicketCategory.SUPPORT.value: ["Subject", "Details"],
    TicketCategory.MISC.value: ["Subject", "Details"],
    TicketCategory.REPORT.value: ["Incident Summary", "Report Details"],
}


def order_fields(category: str, fields: Optional[Dict[str, Any]]) -> List["TicketField"]:
    """Return a ticket's free-form fields in the order the member saw them."""
    if not fields:
        return []
    preferred = FIELD_ORDER.get(category, [])
    seen = set()
    ordered: List[TicketField] = []
    for key in preferred:
        if key in fields:
            seen.add(key)
            ordered.append(TicketField(label=key, value=str(fields[key])))
    for key in sorted(k for k in fields if k not in seen):
        ordered.append(TicketField(label=key, value=str(fields[key])))
    return ordered


class TicketField(BaseModel):
    label: str
    value: str


class TicketAuthor(BaseModel):
    discord_id: Optional[str] = None
    username: str = "Unknown"
    avatar_url: Optional[str] = None


class TicketSummary(BaseModel):
    """A ticket as it appears in a list. Deliberately excludes `fields`."""
    id: str
    category: TicketCategory
    title: str
    status: TicketStatus
    created_by: Optional[TicketAuthor] = None
    assigned_to: Optional[TicketAuthor] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    thread_url: Optional[str] = Field(
        default=None,
        description="Deep link to the Discord thread, when guild and thread ids are both present.",
    )


class TicketDetail(TicketSummary):
    description: str = ""
    fields: List[TicketField] = Field(default_factory=list)
    close_reason: Optional[str] = None
    closed_at: Optional[str] = None


class TicketMessage(BaseModel):
    id: str
    sender_name: str = "Unknown"
    sender_avatar: Optional[str] = None
    sender_role: str = "user"
    source: str = "discord"
    content: str = ""
    attachments: List[str] = Field(default_factory=list)
    timestamp: Optional[str] = None


class TicketThread(BaseModel):
    ticket: TicketDetail
    messages: List[TicketMessage] = Field(default_factory=list)


class TicketListResponse(BaseModel):
    linked: bool = Field(
        description="False when the member has not linked a Discord account; the list is then empty by definition, not by accident.",
    )
    tickets: List[TicketSummary] = Field(default_factory=list)
