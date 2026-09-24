"""Events System API endpoints.

Implements the specification in server/plan.md.
Connects event discovery, member RSVP (solo & team), eligibility checks,
event-specific SPGs, admin attendance roll-calls, competition awards,
and post-event feedback.
Strictly follows zero user denormalization (pure UID references).
"""

from datetime import datetime, timezone
import random
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud import firestore

from app.api.security import get_admin_user, get_current_user
from app.services.firebase import db
from app.utils import get_user_uid, is_admin_user, iso_str, now_iso, slugify
from app.schemas.events import (
    EventCreate,
    EventDocument,
    EventEligibility,
    EventFormat,
    EventListResponse,
    EventParticipationConfig,
    EventRegisterRequest,
    EventResources,
    EventSchedule,
    EventSPGStatus,
    EventStats,
    EventStatus,
    EventStatusUpdate,
    EventSummary,
    EventTrack,
    EventType,
    EventUpdate,
    FeedbackDocument,
    FeedbackSubmitRequest,
    FeedbackSummaryResponse,
    MyRegistrationResponse,
    PointsRewardConfig,
    RegistrationDocument,
    RegistrationStatus,
    RollCallRequest,
    RollCallResponse,
    SPGDecisionAction,
    SPGDecisionRequest,
    VenueInfo,
    WinnerAwardRequest,
    WinnerAwardResponse,
)

router = APIRouter(prefix="/events", tags=["events"])

EVENTS_COLLECTION = "events"
REGISTRATIONS_SUBCOLLECTION = "registrations"
FEEDBACK_SUBCOLLECTION = "feedback"
SPGS_COLLECTION = "spgs"
USERS_COLLECTION = "users"
CONTRIBUTIONS_COLLECTION = "contributions"


# --- Helpers ---

def _get_event_doc_or_404(id_or_slug: str) -> firestore.DocumentSnapshot:
    """Retrieve event doc by ID or slug."""
    doc_ref = db.collection(EVENTS_COLLECTION).document(id_or_slug)
    doc = doc_ref.get()
    if doc.exists:
        return doc

    # Try matching by slug
    slug_query = db.collection(EVENTS_COLLECTION).where("slug", "==", id_or_slug).limit(1).get()
    if slug_query:
        return slug_query[0]

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Event '{id_or_slug}' not found",
    )


def _doc_to_event_document(doc: firestore.DocumentSnapshot) -> EventDocument:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return EventDocument.model_validate(data)


def _doc_to_event_summary(doc: firestore.DocumentSnapshot) -> EventSummary:
    data = doc.to_dict() or {}
    data["id"] = doc.id
    return EventSummary.model_validate(data)


# --- Public & Member Discovery Endpoints ---

@router.get("", response_model=EventListResponse)
def list_events(
    status_filter: Optional[EventStatus] = Query(None, alias="status"),
    track: Optional[EventTrack] = None,
    event_type: Optional[EventType] = None,
    timeline: Optional[str] = Query(None, regex="^(upcoming|past)$"),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
):
    """List events with rich filtering for status, track, type, and timeline."""
    is_admin = is_admin_user(current_user)
    query = db.collection(EVENTS_COLLECTION)

    if status_filter:
        query = query.where("status", "==", status_filter.value)
    elif not is_admin:
        # Public visitors and non-admins only see published, registration_closed, ongoing, completed
        query = query.where("status", "in", [
            EventStatus.PUBLISHED.value,
            EventStatus.REGISTRATION_CLOSED.value,
            EventStatus.ONGOING.value,
            EventStatus.COMPLETED.value,
        ])

    if track:
        query = query.where("track", "==", track.value)
    if event_type:
        query = query.where("event_type", "==", event_type.value)

    docs = list(query.stream())
    events: List[EventSummary] = []
    now_str = now_iso()

    for d in docs:
        item = _doc_to_event_summary(d)

        # Timeline filter
        if timeline == "upcoming":
            if item.schedule.start_time < now_str and item.status == EventStatus.COMPLETED.value:
                continue
        elif timeline == "past":
            if item.status != EventStatus.COMPLETED.value and item.schedule.start_time >= now_str:
                continue

        # Search query filter (title or description)
        if search:
            q = search.lower()
            if q not in item.title.lower() and q not in item.description.lower():
                continue

        events.append(item)

    # Sort: upcoming first, then by schedule.start_time
    events.sort(key=lambda e: e.schedule.start_time, reverse=(timeline == "past"))

    total = len(events)
    start_idx = (page - 1) * limit
    paged = events[start_idx : start_idx + limit]

    return EventListResponse(events=paged, total=total)


@router.get("/{id_or_slug}", response_model=EventDocument)
def get_event_detail(id_or_slug: str):
    """Get full event details, schedule, eligibility, and resource links."""
    doc = _get_event_doc_or_404(id_or_slug)
    return _doc_to_event_document(doc)


@router.get("/{id}/my-registration", response_model=MyRegistrationResponse)
def get_my_registration(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get the current authenticated user's registration status for this event."""
    user_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    regs_ref = db.collection(EVENTS_COLLECTION).document(event_id).collection(REGISTRATIONS_SUBCOLLECTION)
    
    # Check if lead or solo
    lead_query = regs_ref.where("user_id", "==", user_uid).limit(1).get()
    if lead_query:
        reg_dict = lead_query[0].to_dict() or {}
        reg_dict["id"] = lead_query[0].id
        return MyRegistrationResponse(
            is_registered=True,
            registration=RegistrationDocument.model_validate(reg_dict),
        )

    # Check if member in a team
    member_query = regs_ref.where("member_uids", "array_contains", user_uid).limit(1).get()
    if member_query:
        reg_dict = member_query[0].to_dict() or {}
        reg_dict["id"] = member_query[0].id
        return MyRegistrationResponse(
            is_registered=True,
            registration=RegistrationDocument.model_validate(reg_dict),
        )

    return MyRegistrationResponse(is_registered=False, registration=None)


# --- RSVP / Registration Endpoints ---

@router.post("/{id}/register", response_model=RegistrationDocument, status_code=status.HTTP_201_CREATED)
def register_for_event(
    id: str,
    payload: EventRegisterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """RSVP solo or register a team for an event.
    
    Enforces eligibility checks, capacity/waitlist limits, and event SPG spawning.
    """
    user_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id
    event = _doc_to_event_document(event_doc)

    # 1. Check Event Status & Deadline
    if event.status != EventStatus.PUBLISHED.value and event.status != EventStatus.ONGOING.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration is not open for this event (status: {event.status})",
        )
    if event.schedule.registration_deadline and event.schedule.registration_deadline < now_iso():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration deadline for this event has passed",
        )

    # 2. Check User Eligibility
    user_doc = db.collection(USERS_COLLECTION).document(user_uid).get()
    user_data = user_doc.to_dict() if user_doc.exists else {}

    if event.eligibility.access_scope.value == "members_only":
        if not user_data.get("is_member", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This event is restricted to Reinforce Club members only",
            )

    # 3. Check Team vs Solo Participation Rules
    member_uids = list(set(payload.member_uids))
    if user_uid not in member_uids:
        member_uids.append(user_uid)

    if event.participation.mode.value == "solo":
        member_uids = [user_uid]
        team_name = None
    else:
        # Team mode
        team_name = payload.team_name
        if not team_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Team name is required for team events",
            )
        if len(member_uids) < event.participation.min_team_size:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Minimum team size is {event.participation.min_team_size}",
            )
        if len(member_uids) > event.participation.max_team_size:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Maximum team size is {event.participation.max_team_size}",
            )

    # 4. Check for Duplicate Registrations
    regs_ref = db.collection(EVENTS_COLLECTION).document(event_id).collection(REGISTRATIONS_SUBCOLLECTION)
    for m_uid in member_uids:
        existing_lead = regs_ref.where("user_id", "==", m_uid).limit(1).get()
        if existing_lead and existing_lead[0].to_dict().get("status") != RegistrationStatus.CANCELLED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User {m_uid} is already registered for this event",
            )
        existing_member = regs_ref.where("member_uids", "array_contains", m_uid).limit(1).get()
        if existing_member and existing_member[0].to_dict().get("status") != RegistrationStatus.CANCELLED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User {m_uid} is already part of a registered team for this event",
            )

    # 5. Capacity & Waitlist Check
    reg_status = RegistrationStatus.REGISTERED.value
    if event.participation.max_participants is not None:
        if event.stats.registered_count + len(member_uids) > event.participation.max_participants:
            reg_status = RegistrationStatus.WAITLISTED.value

    # 6. Event-Specific SPG Spawning
    spg_id = None
    spg_status = None
    if event.participation.requires_event_spg and reg_status == RegistrationStatus.REGISTERED.value:
        spg_id = f"spg_{event.slug}_{uuid.uuid4().hex[:6]}"
        spg_status = EventSPGStatus.ACTIVE_COMPETITION.value
        spg_doc_data = {
            "name": team_name or f"Event Team - {user_uid[:6]}",
            "description": f"Event-specific SPG for {event.title}",
            "type": "event",
            "track": event.track if event.track != "all" else "general",
            "visibility": "public",
            "status": "active",
            "lead_id": user_uid,
            "member_ids": member_uids,
            "created_by": user_uid,
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "source_ticket_id": None,
            "event_id": event_id,
        }
        db.collection(SPGS_COLLECTION).document(spg_id).set(spg_doc_data)

    # 7. Create Registration Document
    reg_id = f"reg_{uuid.uuid4().hex[:10]}"
    now_timestamp = now_iso()
    registration_data = {
        "id": reg_id,
        "event_id": event_id,
        "user_id": user_uid,
        "team_name": team_name,
        "member_uids": member_uids,
        "spg_id": spg_id,
        "spg_status": spg_status,
        "status": reg_status,
        "checked_in_at": None,
        "checked_in_by": None,
        "registered_at": now_timestamp,
    }

    regs_ref.document(reg_id).set(registration_data)

    # Update event registered_count if confirmed
    if reg_status == RegistrationStatus.REGISTERED.value:
        db.collection(EVENTS_COLLECTION).document(event_id).update({
            "stats.registered_count": firestore.Increment(len(member_uids)),
            "updated_at": now_timestamp,
        })

    return RegistrationDocument.model_validate(registration_data)


@router.delete("/{id}/register")
def cancel_registration(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Cancel current user's registration and promote next waitlisted team if any."""
    user_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    regs_ref = db.collection(EVENTS_COLLECTION).document(event_id).collection(REGISTRATIONS_SUBCOLLECTION)
    
    # Must be the lead or solo registrant to cancel
    lead_query = regs_ref.where("user_id", "==", user_uid).limit(1).get()
    if not lead_query:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registration found where you are the lead/registrant",
        )

    reg_doc = lead_query[0]
    reg_data = reg_doc.to_dict() or {}
    prev_status = reg_data.get("status")

    if prev_status == RegistrationStatus.CANCELLED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration is already cancelled",
        )

    # Disband linked SPG if any
    if reg_data.get("spg_id"):
        db.collection(SPGS_COLLECTION).document(reg_data["spg_id"]).update({
            "status": "disbanded",
            "updated_at": now_iso(),
        })

    # Update registration to cancelled
    now_timestamp = now_iso()
    reg_doc.reference.update({
        "status": RegistrationStatus.CANCELLED.value,
        "spg_status": EventSPGStatus.DISBANDED.value if reg_data.get("spg_id") else None,
        "updated_at": now_timestamp,
    })

    member_count = len(reg_data.get("member_uids", [user_uid]))
    if prev_status == RegistrationStatus.REGISTERED.value:
        db.collection(EVENTS_COLLECTION).document(event_id).update({
            "stats.registered_count": firestore.Increment(-member_count),
            "updated_at": now_timestamp,
        })

        # Check if we can promote a waitlisted registration
        waitlist_query = (
            regs_ref.where("status", "==", RegistrationStatus.WAITLISTED.value)
            .order_by("registered_at")
            .limit(1)
            .get()
        )
        if waitlist_query:
            next_reg = waitlist_query[0]
            next_data = next_reg.to_dict() or {}
            next_members = len(next_data.get("member_uids", [1]))
            next_reg.reference.update({"status": RegistrationStatus.REGISTERED.value})
            db.collection(EVENTS_COLLECTION).document(event_id).update({
                "stats.registered_count": firestore.Increment(next_members),
            })

    return {"message": "Registration cancelled successfully"}


# --- Feedback Endpoints ---

@router.post("/{id}/feedback", response_model=FeedbackDocument, status_code=status.HTTP_201_CREATED)
def submit_event_feedback(
    id: str,
    payload: FeedbackSubmitRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Submit rating and feedback for an event."""
    user_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    now_timestamp = now_iso()
    feedback_ref = (
        db.collection(EVENTS_COLLECTION)
        .document(event_id)
        .collection(FEEDBACK_SUBCOLLECTION)
        .document(user_uid)
    )

    feedback_data = {
        "user_uid": user_uid,
        "rating_content": payload.rating_content,
        "rating_organization": payload.rating_organization,
        "rating_overall": payload.rating_overall,
        "takeaways": payload.takeaways,
        "improvements": payload.improvements,
        "is_anonymous": payload.is_anonymous,
        "created_at": now_timestamp,
    }

    feedback_ref.set(feedback_data)

    # Recalculate average rating and feedback count
    all_feedbacks = (
        db.collection(EVENTS_COLLECTION)
        .document(event_id)
        .collection(FEEDBACK_SUBCOLLECTION)
        .get()
    )
    fb_list = [f.to_dict() for f in all_feedbacks if f.exists]
    count = len(fb_list)
    avg = sum(f.get("rating_overall", 0) for f in fb_list) / count if count > 0 else 0.0

    db.collection(EVENTS_COLLECTION).document(event_id).update({
        "stats.feedback_count": count,
        "stats.average_rating": round(avg, 2),
        "updated_at": now_timestamp,
    })

    return FeedbackDocument.model_validate(feedback_data)


# --- SPG Decision Endpoint ---

@router.post("/{id}/spg-decision")
def event_spg_decision(
    id: str,
    payload: SPGDecisionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Team leader decides whether to convert the event SPG to a permanent project or disband."""
    user_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    regs_ref = db.collection(EVENTS_COLLECTION).document(event_id).collection(REGISTRATIONS_SUBCOLLECTION)
    lead_query = regs_ref.where("user_id", "==", user_uid).limit(1).get()
    if not lead_query:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registration found where you are the leader",
        )

    reg_doc = lead_query[0]
    reg_data = reg_doc.to_dict() or {}
    spg_id = reg_data.get("spg_id")

    if not spg_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No event-specific SPG is linked to this registration",
        )

    now_timestamp = now_iso()
    if payload.action == SPGDecisionAction.CONVERT_PERMANENT:
        db.collection(SPGS_COLLECTION).document(spg_id).update({
            "type": "project",
            "visibility": "public",
            "updated_at": now_timestamp,
        })
        reg_doc.reference.update({
            "spg_status": EventSPGStatus.CONVERTED_PERMANENT.value,
        })
        return {"message": "Event SPG successfully converted to a permanent Project SPG"}
    else:
        db.collection(SPGS_COLLECTION).document(spg_id).update({
            "status": "disbanded",
            "updated_at": now_timestamp,
        })
        reg_doc.reference.update({
            "spg_status": EventSPGStatus.DISBANDED.value,
        })
        return {"message": "Event SPG successfully disbanded"}


# --- Admin Management Endpoints ---

@router.post("", response_model=EventDocument, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Create a new event (Admin only)."""
    admin_uid = get_user_uid(current_user)
    now_timestamp = now_iso()
    event_id = f"evt_{uuid.uuid4().hex[:10]}"
    slug = payload.slug or slugify(payload.title)

    # Ensure unique slug
    existing_slug = db.collection(EVENTS_COLLECTION).where("slug", "==", slug).limit(1).get()
    if existing_slug:
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    event_data = {
        "id": event_id,
        "slug": slug,
        "title": payload.title,
        "description": payload.description,
        "detailed_info": payload.detailed_info,
        "event_type": payload.event_type.value,
        "track": payload.track.value,
        "format": payload.format.value,
        "venue_info": (payload.venue_info or VenueInfo()).model_dump(),
        "schedule": payload.schedule.model_dump(),
        "eligibility": (payload.eligibility or EventEligibility()).model_dump(),
        "participation": (payload.participation or EventParticipationConfig()).model_dump(),
        "points_reward": (payload.points_reward or PointsRewardConfig()).model_dump(),
        "resources": (payload.resources or EventResources()).model_dump(),
        "stats": EventStats().model_dump(),
        "status": payload.status.value,
        "created_by": admin_uid,
        "created_at": now_timestamp,
        "updated_at": now_timestamp,
    }

    db.collection(EVENTS_COLLECTION).document(event_id).set(event_data)
    return EventDocument.model_validate(event_data)


@router.put("/{id}", response_model=EventDocument)
def update_event(
    id: str,
    payload: EventUpdate,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Update event configuration, schedule, or details (Admin only)."""
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    update_dict = payload.model_dump(exclude_unset=True)
    if not update_dict:
        return _doc_to_event_document(event_doc)

    # Convert Enums to string values
    for enum_key in ["event_type", "track", "format", "status"]:
        if enum_key in update_dict and update_dict[enum_key] is not None:
            val = update_dict[enum_key]
            update_dict[enum_key] = val.value if hasattr(val, "value") else str(val)

    update_dict["updated_at"] = now_iso()
    db.collection(EVENTS_COLLECTION).document(event_id).update(update_dict)

    updated_doc = db.collection(EVENTS_COLLECTION).document(event_id).get()
    return _doc_to_event_document(updated_doc)


@router.patch("/{id}/status", response_model=EventDocument)
def update_event_status(
    id: str,
    payload: EventStatusUpdate,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Update event lifecycle status (Admin only)."""
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    now_timestamp = now_iso()
    db.collection(EVENTS_COLLECTION).document(event_id).update({
        "status": payload.status.value,
        "updated_at": now_timestamp,
    })

    updated_doc = db.collection(EVENTS_COLLECTION).document(event_id).get()
    return _doc_to_event_document(updated_doc)


@router.get("/{id}/registrations", response_model=List[RegistrationDocument])
def list_event_registrations(
    id: str,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """View full list of registered attendees, teams, and waitlist (Admin only)."""
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    regs = (
        db.collection(EVENTS_COLLECTION)
        .document(event_id)
        .collection(REGISTRATIONS_SUBCOLLECTION)
        .stream()
    )

    results: List[RegistrationDocument] = []
    for r in regs:
        r_dict = r.to_dict() or {}
        r_dict["id"] = r.id
        results.append(RegistrationDocument.model_validate(r_dict))

    return results


@router.post("/{id}/attendance/roll-call", response_model=RollCallResponse)
def submit_attendance_roll_call(
    id: str,
    payload: RollCallRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Roll Call Check-in: marks attendance and awards attendance points via contributions ledger (Admin only)."""
    admin_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id
    event = _doc_to_event_document(event_doc)

    regs_ref = db.collection(EVENTS_COLLECTION).document(event_id).collection(REGISTRATIONS_SUBCOLLECTION)
    all_regs = list(regs_ref.stream())

    awarded_uids: List[str] = []
    failed_uids: List[str] = []
    now_timestamp = now_iso()
    pts = event.points_reward.attendance_points

    for attendee_uid in payload.attendee_uids:
        matched_reg = None
        for r in all_regs:
            r_data = r.to_dict() or {}
            if r_data.get("user_id") == attendee_uid or attendee_uid in r_data.get("member_uids", []):
                matched_reg = r
                break

        if not matched_reg:
            failed_uids.append(attendee_uid)
            continue

        # Mark registration as checked in
        matched_reg.reference.update({
            "status": RegistrationStatus.CHECKED_IN.value,
            "checked_in_at": now_timestamp,
            "checked_in_by": admin_uid,
        })
        awarded_uids.append(attendee_uid)

        # Award points via contributions ledger if enabled
        if payload.award_points and pts > 0:
            contrib_id = f"contrib_evt_att_{event_id[:8]}_{attendee_uid[:6]}"
            contrib_doc = {
                "id": contrib_id,
                "user_id": attendee_uid,
                "category": "event_attendance",
                "track": event.points_reward.track,
                "points": pts,
                "description": f"Attended event: {event.title}",
                "status": "approved",
                "reviewed_by": admin_uid,
                "reviewed_at": now_timestamp,
                "created_at": now_timestamp,
                "event_id": event_id,
            }
            db.collection(CONTRIBUTIONS_COLLECTION).document(contrib_id).set(contrib_doc)

    # Update event checked_in_count
    db.collection(EVENTS_COLLECTION).document(event_id).update({
        "stats.checked_in_count": len(awarded_uids),
        "updated_at": now_timestamp,
    })

    return RollCallResponse(
        event_id=event_id,
        checked_in_count=len(awarded_uids),
        points_awarded_per_user=pts if payload.award_points else 0,
        awarded_uids=awarded_uids,
        failed_uids=failed_uids,
    )


@router.post("/{id}/award-winners", response_model=WinnerAwardResponse)
def award_event_winners(
    id: str,
    payload: WinnerAwardRequest,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """Award competition winner points and recognition via contributions ledger (Admin only)."""
    admin_uid = get_user_uid(current_user)
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id
    event = _doc_to_event_document(event_doc)

    total_points = 0
    now_timestamp = now_iso()

    for winner in payload.winners:
        contrib_id = f"contrib_evt_win_{event_id[:8]}_{winner.user_uid[:6]}_r{winner.rank}"
        contrib_doc = {
            "id": contrib_id,
            "user_id": winner.user_uid,
            "category": "competition_win",
            "track": event.points_reward.track,
            "points": winner.points,
            "description": f"Rank #{winner.rank} in {event.title}" + (f": {winner.note}" if winner.note else ""),
            "status": "approved",
            "reviewed_by": admin_uid,
            "reviewed_at": now_timestamp,
            "created_at": now_timestamp,
            "event_id": event_id,
        }
        db.collection(CONTRIBUTIONS_COLLECTION).document(contrib_id).set(contrib_doc)
        total_points += winner.points

    return WinnerAwardResponse(
        event_id=event_id,
        awarded_count=len(payload.winners),
        total_points=total_points,
    )


@router.get("/{id}/feedback", response_model=FeedbackSummaryResponse)
def get_event_feedback_summary(
    id: str,
    current_user: Dict[str, Any] = Depends(get_admin_user),
):
    """View all feedback records and calculated ratings breakdown (Admin only)."""
    event_doc = _get_event_doc_or_404(id)
    event_id = event_doc.id

    feedbacks_stream = (
        db.collection(EVENTS_COLLECTION)
        .document(event_id)
        .collection(FEEDBACK_SUBCOLLECTION)
        .stream()
    )

    fb_list: List[FeedbackDocument] = []
    for f in feedbacks_stream:
        f_data = f.to_dict() or {}
        fb_list.append(FeedbackDocument.model_validate(f_data))

    total = len(fb_list)
    avg_overall = sum(f.rating_overall for f in fb_list) / total if total > 0 else 0.0
    avg_content = sum(f.rating_content for f in fb_list) / total if total > 0 else 0.0
    avg_org = sum(f.rating_organization for f in fb_list) / total if total > 0 else 0.0

    return FeedbackSummaryResponse(
        event_id=event_id,
        total_feedbacks=total,
        average_overall=round(avg_overall, 2),
        average_content=round(avg_content, 2),
        average_organization=round(avg_org, 2),
        feedbacks=fb_list,
    )
