"""Contributions API endpoints.

Acts as the immutable ledger for achievements and audits point awards.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud import firestore

from app.api.security import get_admin_user, get_current_user
from server.app.services.firebase import db
from app.schemas.contributions import (
    AdminAwardSPG,
    AdminAwardUser,
    AdminRevokeRecord,
    ContributionCategory,
    ContributionListResponse,
    ContributionRecord,
    ContributionStatus,
    ContributionTrack,
)

router = APIRouter(prefix="/contributions", tags=["Contributions"])

CONTRIBUTIONS_COLLECTION = "contributions"
USERS_COLLECTION = "users"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_record(doc_id: str, data: Dict[str, Any]) -> ContributionRecord:
    data["id"] = doc_id
    return ContributionRecord(**data)


# ---------------------------------------------------------------------------
# Admin Write Endpoints
# ---------------------------------------------------------------------------

@router.post("/award/user/{user_id}", response_model=ContributionRecord, summary="Award points to a specific member")
def award_user_points(
    user_id: str,
    award: AdminAwardUser,
    admin: dict = Depends(get_admin_user),
) -> ContributionRecord:
    """Award points/achievement to a specific member and atomically update cached points."""
    # Check user exists
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipient user not found")

    record_id = f"contrib_{uuid.uuid4().hex[:12]}"
    now = _now_utc()

    record = ContributionRecord(
        id=record_id,
        user_id=user_id,
        track=award.track,
        category=award.category,
        title=award.title,
        description=award.description,
        points=award.points,
        source=award.source,
        event_id=award.event_id,
        spg_id=award.spg_id,
        occurred_at=award.occurred_at,
        status=ContributionStatus.APPROVED,
        recorded_by=admin["uid"],
        created_at=now,
        reviewed_by=admin["uid"],
        reviewed_at=now,
        deduplication_key=award.deduplication_key,
    )

    # Atomically write record and increment user cached points
    batch = db.batch()
    contrib_ref = db.collection(CONTRIBUTIONS_COLLECTION).document(record_id)
    batch.set(contrib_ref, record.model_dump(mode="json"))

    track_field = f"points.{award.track.value}"
    batch.update(user_ref, {
        "points.total": firestore.Increment(award.points),
        track_field: firestore.Increment(award.points),
        "updated_at": now.isoformat(),
    })
    batch.commit()

    return record


@router.post("/award/spg/{spg_id}", summary="Bulk award points to all members of an SPG")
def award_spg_points(
    spg_id: str,
    award: AdminAwardSPG,
    admin: dict = Depends(get_admin_user),
):
    """Bulk awards points to all members of an SPG and updates their cached points."""
    members_query = db.collection(USERS_COLLECTION).where("spg_ids", "array_contains", spg_id).stream()

    now = _now_utc()
    batch = db.batch()
    count = 0
    records: List[ContributionRecord] = []

    for member_doc in members_query:
        member_id = member_doc.id
        record_id = f"contrib_{uuid.uuid4().hex[:12]}"
        dedup_key = f"bulk-spg-{spg_id}-{award.title}-{member_id}"

        record = ContributionRecord(
            id=record_id,
            user_id=member_id,
            track=award.track,
            category=award.category,
            title=award.title,
            description=award.description,
            points=award.points,
            source=award.source,
            event_id=award.event_id,
            spg_id=spg_id,
            occurred_at=award.occurred_at,
            status=ContributionStatus.APPROVED,
            recorded_by=admin["uid"],
            created_at=now,
            reviewed_by=admin["uid"],
            reviewed_at=now,
            deduplication_key=dedup_key,
        )

        contrib_ref = db.collection(CONTRIBUTIONS_COLLECTION).document(record_id)
        batch.set(contrib_ref, record.model_dump(mode="json"))

        user_ref = db.collection(USERS_COLLECTION).document(member_id)
        track_field = f"points.{award.track.value}"
        batch.update(user_ref, {
            "points.total": firestore.Increment(award.points),
            track_field: firestore.Increment(award.points),
            "updated_at": now.isoformat(),
        })

        records.append(record)
        count += 1

    if count > 0:
        batch.commit()

    return {
        "message": f"Successfully awarded {award.points} points to {count} SPG members.",
        "spg_id": spg_id,
        "count": count,
    }


@router.patch("/{record_id}/revoke", summary="Revoke an awarded contribution")
def revoke_contribution(
    record_id: str,
    revocation: AdminRevokeRecord,
    admin: dict = Depends(get_admin_user),
):
    """Revokes an approved contribution and deducts cached points from the user profile."""
    contrib_ref = db.collection(CONTRIBUTIONS_COLLECTION).document(record_id)
    contrib_doc = contrib_ref.get()

    if not contrib_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contribution record not found")

    data = contrib_doc.to_dict() or {}
    if data.get("status") != ContributionStatus.APPROVED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only approved records can be revoked. Current status is '{data.get('status')}'",
        )

    now = _now_utc()
    user_id = data.get("user_id") or data.get("contributor_id")
    points = int(data.get("points", 0))
    track = data.get("track") or "misc"

    # Transaction / batch to revoke record and decrement user points safely
    batch = db.batch()
    batch.update(contrib_ref, {
        "status": ContributionStatus.REVOKED.value,
        "revoked_by": admin["uid"],
        "revoked_at": now.isoformat(),
        "status_reason": revocation.status_reason,
    })

    if user_id:
        user_ref = db.collection(USERS_COLLECTION).document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists:
            user_data = user_doc.to_dict() or {}
            user_points = user_data.get("points") or {}
            new_total = max(0, int(user_points.get("total", 0)) - points)
            new_track = max(0, int(user_points.get(track, 0)) - points)
            batch.update(user_ref, {
                "points.total": new_total,
                f"points.{track}": new_track,
                "updated_at": now.isoformat(),
            })

    batch.commit()
    return {"message": "Contribution revoked successfully.", "record_id": record_id}


@router.post("/recalculate/{user_id}", summary="Recalculate cached points from raw contributions")
def recalculate_user_points(
    user_id: str,
    admin: dict = Depends(get_admin_user),
):
    """Maintenance: Recalculates and resyncs cached points from all approved contributions."""
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = user_ref.get()
    if not user_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    # Fetch all approved contributions for this user
    docs = (
        db.collection(CONTRIBUTIONS_COLLECTION)
        .where("user_id", "==", user_id)
        .where("status", "==", ContributionStatus.APPROVED.value)
        .stream()
    )

    totals = {"total": 0, "kaggle": 0, "product": 0, "research": 0, "misc": 0}
    for doc in docs:
        d = doc.to_dict() or {}
        pts = int(d.get("points", 0))
        trk = d.get("track") or "misc"
        totals["total"] += pts
        if trk in totals:
            totals[trk] += pts
        else:
            totals["misc"] += pts

    now = _now_utc().isoformat()
    user_ref.update({
        "points": totals,
        "updated_at": now,
    })

    return {
        "message": f"Successfully recalculated points for user {user_id}",
        "user_id": user_id,
        "points": totals,
    }


# ---------------------------------------------------------------------------
# Public / Feed Read Endpoints
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}", response_model=List[ContributionRecord], summary="List approved contributions for a user")
def list_user_contributions(user_id: str) -> List[ContributionRecord]:
    """Fetch approved contributions for a member's profile trophy case."""
    docs = (
        db.collection(CONTRIBUTIONS_COLLECTION)
        .where("user_id", "==", user_id)
        .where("status", "==", ContributionStatus.APPROVED.value)
        .stream()
    )

    results: List[ContributionRecord] = []
    for doc in docs:
        data = doc.to_dict() or {}
        try:
            results.append(_to_record(doc.id, data))
        except Exception:
            pass

    results.sort(key=lambda r: r.occurred_at, reverse=True)
    return results


@router.get("", response_model=List[ContributionRecord], summary="Filter and list contributions")
def list_contributions(
    user_id: Optional[str] = Query(None, description="Filter by user UID"),
    track: Optional[ContributionTrack] = Query(None, description="Filter by track"),
    category: Optional[ContributionCategory] = Query(None, description="Filter by category"),
    status_filter: Optional[ContributionStatus] = Query(ContributionStatus.APPROVED, alias="status"),
    spg_id: Optional[str] = Query(None, description="Filter by SPG ID"),
    event_id: Optional[str] = Query(None, description="Filter by Event ID"),
) -> List[ContributionRecord]:
    """List contributions with flexible filtering."""
    query = db.collection(CONTRIBUTIONS_COLLECTION)

    if user_id:
        query = query.where("user_id", "==", user_id)
    if status_filter:
        query = query.where("status", "==", status_filter.value)
    if track:
        query = query.where("track", "==", track.value)
    if category:
        query = query.where("category", "==", category.value)
    if spg_id:
        query = query.where("spg_id", "==", spg_id)
    if event_id:
        query = query.where("event_id", "==", event_id)

    docs = query.stream()
    results: List[ContributionRecord] = []
    for doc in docs:
        data = doc.to_dict() or {}
        try:
            results.append(_to_record(doc.id, data))
        except Exception:
            pass

    results.sort(key=lambda r: r.created_at, reverse=True)
    return results