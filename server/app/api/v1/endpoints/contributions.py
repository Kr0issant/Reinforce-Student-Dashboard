from fastapi import APIRouter, Depends, HTTPException, Query
from google.cloud import firestore
from datetime import datetime, timezone
import uuid
from typing import Optional, List

from app.api.security import get_current_user
from app.api.v1.endpoints.student import get_admin_user
from app.schemas.contributions import ContributionRecord, ContributionStatus
from app.schemas.contributions import AdminAwardStudent, AdminRevokeRecord

router = APIRouter(prefix="/contributions", tags=["Contributions"])
db = firestore.client()

## --- Admin Write Endpoints ---

@router.post("/award/student/{student_id}", response_model=ContributionRecord)
async def award_student_points(
    student_id: str,
    award: AdminAwardStudent,
    admin: dict = Depends(get_admin_user)
):
    """Directly awards approved points to a specific student."""
    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    record = ContributionRecord(
        id=record_id,
        contributor_id=student_id,
        category=award.category,
        title=award.title,
        description=award.description,
        points=award.points,
        source=award.source,
        status=ContributionStatus.APPROVED,
        recorded_by=admin["uid"],
        created_at=now,
        reviewed_by=admin["uid"],
        reviewed_at=now,
        deduplication_key=award.deduplication_key
    )
    
    db.collection("contributions").document(record_id).set(record.model_dump(mode="json"))
    return record

@router.post("/award/spg/{spg_id}")
async def award_spg_points(
    spg_id: str,
    award: AdminAwardStudent,
    admin: dict = Depends(get_admin_user)
):
    """Bulk awards points to all verified members of an SPG."""
    # 1. Fetch all students belonging to this SPG
    # Assuming students have an array of SPG IDs or there's a subcollection
    spg_members_query = db.collection("users").where("spg_ids", "array_contains", spg_id).stream()
    
    now = datetime.now(timezone.utc)
    batch = db.batch()
    count = 0
    
    # 2. Iterate through members and build a batch write
    for student_doc in spg_members_query:
        record_id = str(uuid.uuid4())
        student_id = student_doc.id
        
        record = ContributionRecord(
            id=record_id,
            contributor_id=student_id,
            category=award.category,
            title=award.title,
            description=award.description,
            points=award.points,
            source=award.source,
            status=ContributionStatus.APPROVED,
            recorded_by=admin["uid"],
            created_at=now,
            reviewed_by=admin["uid"],
            reviewed_at=now,
            # Ensure idempotency so double-clicks don't double-award the SPG
            deduplication_key=f"bulk-spg-{spg_id}-{award.title}-{student_id}" 
        )
        
        doc_ref = db.collection("contributions").document(record_id)
        batch.set(doc_ref, record.model_dump(mode="json"))
        count += 1
        
    # 3. Commit all writes to Firestore simultaneously
    if count > 0:
        batch.commit()
        
    return {"message": f"Successfully awarded {award.points} points to {count} SPG members."}

@router.patch("/{record_id}/revoke")
async def revoke_contribution(
    record_id: str,
    revocation: AdminRevokeRecord,
    admin: dict = Depends(get_admin_user)
):
    """Revokes an approved contribution, removing it from the leaderboard."""
    doc_ref = db.collection("contributions").document(record_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Record not found")
        
    if doc.to_dict()["status"] != ContributionStatus.APPROVED.value:
        raise HTTPException(status_code=400, detail="Only approved records can be revoked")

    now = datetime.now(timezone.utc).isoformat()
    doc_ref.update({
        "status": ContributionStatus.REVOKED.value,
        "revoked_by": admin["uid"],
        "revoked_at": now,
        "status_reason": revocation.status_reason
    })
    
    return {"message": "Contribution revoked successfully."}

## --- Global Read Endpoints ---

@router.get("/")
async def list_contributions(
    student_id: Optional[str] = Query(None, description="Filter by a specific student"),
    source_type: Optional[str] = Query(None, description="event, spg, project, etc."),
    source_id: Optional[str] = Query(None, description="The specific ID of the event/spg"),
    status: Optional[ContributionStatus] = Query(None),
    user: dict = Depends(get_current_user)
):
    """Fetches contributions with optional filtering."""
    
    # Start with a base reference
    query = db.collection("contributions")
    
    # Apply filters dynamically based on query parameters
    if student_id:
        query = query.where("contributor_id", "==", student_id)
    if status:
        query = query.where("status", "==", status.value)
    if source_type:
        query = query.where("source.type", "==", source_type)
    if source_id:
        query = query.where("source.id", "==", source_id)
        
    # Order by newest first
    query = query.order_by("created_at", direction=firestore.Query.DESCENDING)
    
    docs = query.stream()
    return [doc.to_dict() for doc in docs]