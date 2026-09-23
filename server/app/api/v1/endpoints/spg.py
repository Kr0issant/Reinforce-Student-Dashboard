"""Student Project Group API.

Thin handlers over app/services/spgs.py and app/services/spg_reports.py.

Members do not create SPGs here. A registration is meant to raise an
`spg_registration` ticket that a reviewer approves, and the approval is what
creates the group. The ticket domain does not exist in this repository yet —
tickets are written by the Discord bot and mirrored read-only — so the member
facing registration route is deliberately absent and `POST /spgs/approvals`
stands in for the approval step. It calls the same `create_spg` service the
ticket handler will call, so there will be one creation path, not two. See
docs/SPG_WORKFLOW.md.

Handlers are sync `def` on purpose: the Firestore client blocks, so FastAPI
runs them in a threadpool instead of stalling the event loop.
"""

from typing import Any, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)

from app.api.security import get_current_user, require_admin
from app.schemas.spg_reports import (
    SPGReportPage,
    SPGReportRecord,
    SPGReportType,
)
from app.schemas.spgs import (
    SPGCreate,
    SPGLeadUpdate,
    SPGPage,
    SPGResponse,
    SPGStatus,
    SPGTrack,
    SPGType,
    SPGUpdate,
    SPGVisibility,
)
from app.services import spg_reports as reports_service
from app.services import spgs as service
from app.services import uploads
from app.services.firebase import get_db

router = APIRouter(prefix="/spgs", tags=["SPGs"])


def _uid(user: dict) -> str:
    return user["uid"]


def _is_admin(user: dict) -> bool:
    return user.get("admin") is True


def _handle(error) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.detail)


def _respond(db: Any, record) -> SPGResponse:
    return SPGResponse(
        **record.model_dump(),
        report_count=reports_service.count_reports(db, record.id),
    )


def _readable_or_404(db: Any, spg_id: str, user: dict):
    """Fetch an SPG the caller may see.

    A private SPG answers 404 rather than 403 to a non-member, so the endpoint
    cannot be used to discover which private groups exist.
    """
    try:
        spg = service.require_spg(db, spg_id)
    except service.SPGError as error:
        raise _handle(error) from None
    if not service.visible_to(spg, _uid(user), _is_admin(user)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SPG not found.")
    return spg


def _member_or_403(spg, user: dict) -> None:
    if _uid(user) not in spg.member_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a member of this SPG can do that.",
        )


# ---------------------------------------------------------------------------
# Registration approval. Declared before /{spg_id} so the path parameter
# cannot swallow these fixed segments.
# ---------------------------------------------------------------------------

@router.post(
    "/propositions",
    summary="Upload a proposition document for a registration (admin)",
)
def upload_proposition(
    request_id: str = Form(..., description="The registration or ticket this belongs to"),
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
):
    """Store a project SPG's proposition document and return its URL.

    The URL is what `POST /spgs/approvals` records on the group. The stored
    path is built from `request_id`, never from the uploaded filename.
    """
    try:
        payload = uploads.read_pdf(file.file, file.content_type)
    except uploads.UploadRejected as rejected:
        raise HTTPException(status_code=400, detail=rejected.detail) from None
    url = uploads.store_pdf(payload, uploads.proposition_path(request_id))
    return {"request_id": request_id, "proposition_document_url": url}


@router.post(
    "/approvals",
    response_model=SPGResponse,
    summary="Create an SPG from an approved registration (admin)",
)
def approve_registration(
    create: SPGCreate,
    admin: dict = Depends(require_admin),
    db: Any = Depends(get_db),
) -> SPGResponse:
    """The one creation path.

    Everything is revalidated here rather than trusted from registration time:
    a member may have left between submitting and approving. Approving the same
    `source_ticket_id` twice returns the group that already exists instead of
    creating a second one.
    """
    try:
        record, _created = service.create_spg(db, create=create, admin_id=_uid(admin))
    except service.SPGError as error:
        raise _handle(error) from None
    return _respond(db, record)


@router.post(
    "/reports/{report_id}/verify",
    response_model=SPGReportRecord,
    summary="Verify a submitted report (admin)",
)
def verify_report(
    report_id: str,
    admin: dict = Depends(require_admin),
    db: Any = Depends(get_db),
) -> SPGReportRecord:
    """Record that a reviewer has checked the report.

    This awards nothing. Whether the work earns points is a separate decision
    the admin makes through the contribution workflow.
    """
    try:
        return reports_service.verify_report(db, report_id=report_id, admin_id=_uid(admin))
    except reports_service.SPGReportError as error:
        raise _handle(error) from None


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------

@router.get("", response_model=SPGPage, summary="Browse SPGs")
def list_spgs(
    status_filter: Optional[SPGStatus] = Query(None, alias="status"),
    type_filter: Optional[SPGType] = Query(None, alias="type"),
    track: Optional[SPGTrack] = Query(None),
    member_id: Optional[str] = Query(None, description="Only SPGs this member UID belongs to"),
    limit: int = Query(service.DEFAULT_PAGE_SIZE, ge=1, le=service.MAX_PAGE_SIZE),
    cursor: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: Any = Depends(get_db),
) -> SPGPage:
    """Public SPGs, plus the caller's own private ones. An admin sees all."""
    try:
        records, next_cursor = service.list_spgs(
            db,
            status=status_filter,
            type=type_filter,
            track=track,
            member_id=member_id,
            limit=limit,
            cursor=cursor,
        )
    except service.SPGError as error:
        raise _handle(error) from None
    visible = [
        record
        for record in records
        if service.visible_to(record, _uid(user), _is_admin(user))
    ]
    return SPGPage(
        items=[_respond(db, record) for record in visible],
        next_cursor=next_cursor,
    )


@router.get("/{spg_id}", response_model=SPGResponse, summary="One SPG")
def get_spg(
    spg_id: str,
    user: dict = Depends(get_current_user),
    db: Any = Depends(get_db),
) -> SPGResponse:
    return _respond(db, _readable_or_404(db, spg_id, user))


# ---------------------------------------------------------------------------
# Admin management
# ---------------------------------------------------------------------------

@router.patch("/{spg_id}", response_model=SPGResponse, summary="Edit SPG metadata (admin)")
def update_spg(
    spg_id: str,
    update: SPGUpdate,
    admin: dict = Depends(require_admin),
    db: Any = Depends(get_db),
) -> SPGResponse:
    """Name, description, track and visibility. Membership, lead and status
    have their own operations, so this cannot quietly change the team."""
    try:
        return _respond(db, service.update_spg(db, spg_id=spg_id, update=update))
    except service.SPGError as error:
        raise _handle(error) from None


@router.post(
    "/{spg_id}/members/{user_id}",
    response_model=SPGResponse,
    summary="Add a member (admin)",
)
def add_member(
    spg_id: str,
    user_id: str,
    admin: dict = Depends(require_admin),
    db: Any = Depends(get_db),
) -> SPGResponse:
    """Adding somebody already in the group succeeds and changes nothing."""
    try:
        return _respond(db, service.add_member(db, spg_id=spg_id, user_id=user_id))
    except service.SPGError as error:
        raise _handle(error) from None


@router.delete(
    "/{spg_id}/members/{user_id}",
    response_model=SPGResponse,
    summary="Remove a member (admin)",
)
def remove_member(
    spg_id: str,
    user_id: str,
    admin: dict = Depends(require_admin),
    db: Any = Depends(get_db),
) -> SPGResponse:
    try:
        return _respond(db, service.remove_member(db, spg_id=spg_id, user_id=user_id))
    except service.SPGError as error:
        raise _handle(error) from None


@router.patch("/{spg_id}/lead", response_model=SPGResponse, summary="Change the lead (admin)")
def change_lead(
    spg_id: str,
    payload: SPGLeadUpdate,
    admin: dict = Depends(require_admin),
    db: Any = Depends(get_db),
) -> SPGResponse:
    try:
        return _respond(db, service.change_lead(db, spg_id=spg_id, new_lead_id=payload.new_lead_id))
    except service.SPGError as error:
        raise _handle(error) from None


def _transition(db: Any, spg_id: str, target: SPGStatus) -> SPGResponse:
    try:
        return _respond(db, service.set_status(db, spg_id=spg_id, target=target))
    except service.SPGError as error:
        raise _handle(error) from None


@router.post("/{spg_id}/pause", response_model=SPGResponse, summary="Pause an SPG (admin)")
def pause_spg(spg_id: str, admin: dict = Depends(require_admin), db: Any = Depends(get_db)) -> SPGResponse:
    return _transition(db, spg_id, SPGStatus.PAUSED)


@router.post("/{spg_id}/resume", response_model=SPGResponse, summary="Resume an SPG (admin)")
def resume_spg(spg_id: str, admin: dict = Depends(require_admin), db: Any = Depends(get_db)) -> SPGResponse:
    return _transition(db, spg_id, SPGStatus.ACTIVE)


@router.post("/{spg_id}/disband", response_model=SPGResponse, summary="Disband an SPG (admin)")
def disband_spg(spg_id: str, admin: dict = Depends(require_admin), db: Any = Depends(get_db)) -> SPGResponse:
    """The SPG is kept, not deleted: its members and report history stay
    readable. Disbanding is final."""
    return _transition(db, spg_id, SPGStatus.DISBANDED)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@router.post(
    "/{spg_id}/reports",
    response_model=SPGReportRecord,
    summary="Submit a PDF report",
)
def submit_report(
    spg_id: str,
    file: UploadFile = File(..., description="The report PDF"),
    summary: Optional[str] = Form(None, description="Optional one-line note for the listing"),
    report_type: SPGReportType = Form(SPGReportType.PROGRESS),
    user: dict = Depends(get_current_user),
    db: Any = Depends(get_db),
) -> SPGReportRecord:
    """File a report against an SPG the caller belongs to.

    The PDF is the report: the club's template carries the progress,
    milestones, blockers and next steps inside the document.

    Submitting awards no points and creates no contribution.
    """
    spg = _readable_or_404(db, spg_id, user)
    _member_or_403(spg, user)
    if spg.status not in service.MUTABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=f"A {spg.status.value} SPG does not accept new reports.",
        )
    try:
        payload = uploads.read_pdf(file.file, file.content_type)
    except uploads.UploadRejected as rejected:
        raise HTTPException(status_code=400, detail=rejected.detail) from None

    try:
        return reports_service.submit_report(
            db,
            spg_id=spg_id,
            payload=payload,
            submitted_by=_uid(user),
            report_type=report_type,
            summary=summary,
        )
    except reports_service.SPGReportError as error:
        raise _handle(error) from None


@router.get(
    "/{spg_id}/reports",
    response_model=SPGReportPage,
    summary="One SPG's report history",
)
def list_reports(
    spg_id: str,
    report_type: Optional[SPGReportType] = Query(None),
    limit: int = Query(reports_service.DEFAULT_PAGE_SIZE, ge=1, le=reports_service.MAX_PAGE_SIZE),
    cursor: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: Any = Depends(get_db),
) -> SPGReportPage:
    """Oldest first, so the history reads in the order it happened. Readable by
    a member of the SPG or by an admin."""
    spg = _readable_or_404(db, spg_id, user)
    if not _is_admin(user):
        _member_or_403(spg, user)
    try:
        items, next_cursor = reports_service.list_reports(
            db, spg_id=spg_id, report_type=report_type, limit=limit, cursor=cursor
        )
    except reports_service.SPGReportError as error:
        raise _handle(error) from None
    return SPGReportPage(items=items, next_cursor=next_cursor)
