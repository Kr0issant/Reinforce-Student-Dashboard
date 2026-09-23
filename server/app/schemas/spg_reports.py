"""SPG report schemas.

One report model covers every report an SPG files. A report *is* its PDF: the
club provides a template, and the progress, milestones, blockers and next steps
live inside that document rather than in separate form fields.

Reports are immutable history. Correcting a mistake means filing another
report, never overwriting one, so the sequence of submissions stays auditable.

Verification is review metadata and nothing else. Verifying a report awards no
points and creates no contribution — an admin decides separately whether to
award one through the contribution workflow. See docs/SPG_WORKFLOW.md.
"""

from datetime import timezone
from enum import Enum
from typing import Annotated, List, Optional

from pydantic import (
    AfterValidator,
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    model_validator,
)

from app.schemas.common import DescriptionStr, NonBlankStr

UtcDatetime = Annotated[
    AwareDatetime,
    AfterValidator(lambda value: value.astimezone(timezone.utc)),
    PlainSerializer(lambda value: value.isoformat(), return_type=str, when_used="json"),
]


class SPGReportType(str, Enum):
    """A periodic update, or the one that closes the group out.

    `final` exists so the completion workflow can reuse this model unchanged
    when it is specified. Nothing in this release treats a final report
    differently from a progress report.
    """

    PROGRESS = "progress"
    FINAL = "final"


class SPGReportStatus(str, Enum):
    """Review state.

    Two values only. Whether a reviewer can reject a report, and what a member
    does next if so, is not specified yet, so no `rejected` value is invented
    here.
    """

    PENDING = "pending"
    VERIFIED = "verified"


class SPGReportRecord(BaseModel):
    """A stored report document.

    `summary` is optional supporting text for the listing UI. It never replaces
    the PDF, which is the report itself.
    """

    model_config = ConfigDict(extra="forbid")

    id: NonBlankStr
    spg_id: NonBlankStr
    report_type: SPGReportType = SPGReportType.PROGRESS
    pdf_url: NonBlankStr
    sequence_number: int = Field(strict=True, ge=1)
    summary: Optional[DescriptionStr] = None
    submitted_by: NonBlankStr
    submitted_at: UtcDatetime
    status: SPGReportStatus = SPGReportStatus.PENDING
    verified_by: Optional[NonBlankStr] = None
    verified_at: Optional[UtcDatetime] = None

    @model_validator(mode="after")
    def _review_metadata_matches_status(self):
        verified = self.status is SPGReportStatus.VERIFIED
        for field in ("verified_by", "verified_at"):
            if (getattr(self, field) is not None) != verified:
                rule = "required" if verified else "not allowed"
                raise ValueError(f"{field} is {rule} when status is '{self.status.value}'")
        if self.verified_at is not None and self.verified_at < self.submitted_at:
            raise ValueError("verified_at cannot be earlier than submitted_at")
        return self

    @property
    def is_verified(self) -> bool:
        """Reviewed by the club. Says nothing about points: awarding one is a
        separate admin decision in the contribution workflow."""
        return self.status is SPGReportStatus.VERIFIED


class SPGReportPage(BaseModel):
    """A bounded page of reports, oldest first so history reads in order."""

    model_config = ConfigDict(extra="forbid")

    items: List[SPGReportRecord] = Field(default_factory=list)
    next_cursor: Optional[NonBlankStr] = None
