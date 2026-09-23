"""SPG report submission, listing and verification.

A report is a PDF. It is stored once and never rewritten: filing a correction
means filing another report, so the history of what a group claimed, and when,
stays intact.

Verifying a report records who reviewed it and when. It awards nothing. No
contribution is created, no points move, and nothing here reads or writes the
contributions collection — awarding is a separate admin decision made through
the contribution workflow afterwards.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Callable, List, Optional, Tuple

from pydantic import ValidationError

from app.schemas.spg_reports import (
    SPGReportRecord,
    SPGReportStatus,
    SPGReportType,
)
from app.services import uploads

REPORTS_COLLECTION = "spg_reports"

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class SPGReportError(Exception):
    """A failure with the HTTP status the API should answer with."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def run_in_transaction(db: Any, work: Callable[[Any], Any]) -> Any:
    """Run `work(transaction)` inside a Firestore transaction."""
    from google.cloud import firestore as google_firestore

    transaction = db.transaction()
    return google_firestore.transactional(work)(transaction)


def _load(snapshot: Any) -> SPGReportRecord:
    data = dict(snapshot.to_dict() or {})
    data.setdefault("id", snapshot.id)
    return SPGReportRecord.model_validate(data)


def _reports_of(db: Any, spg_id: str):
    return db.collection(REPORTS_COLLECTION).where("spg_id", "==", spg_id)


def next_sequence_number(db: Any, spg_id: str) -> int:
    """One past the highest sequence this SPG has used.

    Numbers are never reused and never renumbered, so a rejected or superseded
    report keeps the position it was filed in.
    """
    highest = 0
    for snapshot in _reports_of(db, spg_id).stream():
        value = (snapshot.to_dict() or {}).get("sequence_number")
        if isinstance(value, int) and value > highest:
            highest = value
    return highest + 1


def submit_report(
    db: Any,
    *,
    spg_id: str,
    payload: bytes,
    submitted_by: str,
    report_type: SPGReportType = SPGReportType.PROGRESS,
    summary: Optional[str] = None,
    runner: Optional[Callable[[Any, Callable[[Any], Any]], Any]] = None,
    now: Optional[datetime] = None,
    store: Optional[Callable[[bytes, str], str]] = None,
) -> SPGReportRecord:
    """Store one report's PDF and record it.

    The PDF is uploaded first and the document written second, both inside a
    guard that removes the uploaded object if the write fails — otherwise a
    failed submission would leave a file nobody can reach through any record.

    Callers validate membership and SPG state before calling; this function
    owns storage, numbering and persistence.
    """
    runner = runner or run_in_transaction
    store = store or uploads.store_pdf
    moment = now or utcnow()

    report_id = f"rep_{uuid.uuid4().hex[:24]}"
    destination = uploads.report_path(spg_id, report_id)
    pdf_url = store(payload, destination)

    try:
        collection = db.collection(REPORTS_COLLECTION)

        def work(transaction: Any) -> SPGReportRecord:
            # Allocated inside the transaction so two submissions racing each
            # other cannot both take the same number.
            record = SPGReportRecord(
                id=report_id,
                spg_id=spg_id,
                report_type=report_type,
                pdf_url=pdf_url,
                sequence_number=next_sequence_number(db, spg_id),
                summary=summary,
                submitted_by=submitted_by,
                submitted_at=moment,
                status=SPGReportStatus.PENDING,
            )
            transaction.set(collection.document(record.id), record.model_dump())
            return record

        return runner(db, work)
    except Exception:
        _discard(destination)
        raise


def _discard(destination_path: str) -> None:
    """Best effort removal of an object whose record was never written."""
    try:
        from app.services.firebase import get_bucket

        get_bucket().blob(destination_path).delete()
    except Exception:
        # The upload is orphaned rather than the request failing twice; the
        # caller is already raising the real error.
        pass


def get_report(db: Any, report_id: str) -> Optional[SPGReportRecord]:
    snapshot = db.collection(REPORTS_COLLECTION).document(report_id).get()
    if not getattr(snapshot, "exists", False):
        return None
    try:
        return _load(snapshot)
    except ValidationError:
        raise SPGReportError(409, "The stored report does not match the report schema.") from None


def list_reports(
    db: Any,
    *,
    spg_id: str,
    report_type: Optional[SPGReportType] = None,
    limit: int = DEFAULT_PAGE_SIZE,
    cursor: Optional[str] = None,
) -> Tuple[List[SPGReportRecord], Optional[str]]:
    """A bounded page of one SPG's reports, oldest first."""
    size = max(1, min(limit, MAX_PAGE_SIZE))
    query = _reports_of(db, spg_id)
    if report_type is not None:
        query = query.where("report_type", "==", report_type.value)
    query = query.order_by("sequence_number")

    if cursor is not None:
        anchor = db.collection(REPORTS_COLLECTION).document(cursor).get()
        if not getattr(anchor, "exists", False):
            raise SPGReportError(400, "Unknown pagination cursor.")
        query = query.start_after(anchor)

    rows = list(query.limit(size + 1).stream())
    items = [_load(snapshot) for snapshot in rows[:size]]
    next_cursor = items[-1].id if len(rows) > size and items else None
    return items, next_cursor


def count_reports(db: Any, spg_id: str) -> int:
    return sum(1 for _ in _reports_of(db, spg_id).stream())


def verify_report(
    db: Any,
    *,
    report_id: str,
    admin_id: str,
    runner: Optional[Callable[[Any, Callable[[Any], Any]], Any]] = None,
    now: Optional[datetime] = None,
) -> SPGReportRecord:
    """Mark a report reviewed.

    This records who verified it and when, and nothing else. It creates no
    contribution and moves no points: whether the work earns points is a
    separate decision an admin makes in the contribution workflow.

    Verifying an already verified report returns it unchanged, so a retry is
    harmless.
    """
    runner = runner or run_in_transaction
    moment = now or utcnow()
    collection = db.collection(REPORTS_COLLECTION)

    def work(transaction: Any) -> SPGReportRecord:
        reference = collection.document(report_id)
        snapshot = reference.get(transaction=transaction)
        if not getattr(snapshot, "exists", False):
            raise SPGReportError(404, "Report not found.")
        existing = _load(snapshot)
        if existing.status is SPGReportStatus.VERIFIED:
            return existing
        verified = existing.model_copy(
            update={
                "status": SPGReportStatus.VERIFIED,
                "verified_by": admin_id,
                "verified_at": moment,
            }
        )
        transaction.set(reference, verified.model_dump())
        return verified

    return runner(db, work)
