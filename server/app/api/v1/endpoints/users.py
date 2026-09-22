"""Unified Users & Students API endpoints.

Implements the specification in server/plan.md (Single Source of Truth: users/{uid}).
"""

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from google.cloud import firestore

from app.api.security import get_admin_user, get_current_user
from server.app.services.firebase import db, upload_file_to_storage
from server.app.services.config import get_settings
from app.schemas.users import (
    AdminUserUpdateRequest,
    DiscordVerifyRequest,
    LeaderboardEntry,
    LeaderboardResponse,
    MemberTier,
    SocialLinks,
    TrackPoints,
    UserDocument,
    UserListResponse,
    UserMeResponse,
    UserPublicResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/users", tags=["Users"])
settings = get_settings()

USERS_COLLECTION = "users"
VALID_TRACKS = {"total", "kaggle", "product", "research", "misc"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_user_me(uid: str, data: Dict[str, Any]) -> UserMeResponse:
    points_raw = data.get("points") or {}
    points = TrackPoints(
        total=int(points_raw.get("total", 0)),
        kaggle=int(points_raw.get("kaggle", 0)),
        product=int(points_raw.get("product", 0)),
        research=int(points_raw.get("research", 0)),
        misc=int(points_raw.get("misc", 0)),
    )
    social_raw = data.get("social_links") or {}
    social_links = SocialLinks(**social_raw) if isinstance(social_raw, dict) else SocialLinks()

    return UserMeResponse(
        id=uid,
        email=data.get("email") or "",
        full_name=data.get("full_name") or "Club Member",
        avatar_url=data.get("avatar_url"),
        discord_id=data.get("discord_id"),
        is_admin=bool(data.get("is_admin", False)),
        is_member=bool(data.get("is_member", False)),
        tier=data.get("tier") or MemberTier.BEGINNER,
        is_verified=bool(data.get("is_verified", False)),
        verified_at=data.get("verified_at"),
        points=points,
        bio=data.get("bio"),
        skills=data.get("skills") or [],
        social_links=social_links,
        created_at=data.get("created_at"),
        updated_at=data.get("updated_at"),
        last_login=data.get("last_login"),
    )


def _to_user_public(uid: str, data: Dict[str, Any]) -> UserPublicResponse:
    points_raw = data.get("points") or {}
    points = TrackPoints(
        total=int(points_raw.get("total", 0)),
        kaggle=int(points_raw.get("kaggle", 0)),
        product=int(points_raw.get("product", 0)),
        research=int(points_raw.get("research", 0)),
        misc=int(points_raw.get("misc", 0)),
    )
    social_raw = data.get("social_links") or {}
    social_links = SocialLinks(**social_raw) if isinstance(social_raw, dict) else SocialLinks()

    return UserPublicResponse(
        id=uid,
        full_name=data.get("full_name") or "Club Member",
        avatar_url=data.get("avatar_url"),
        bio=data.get("bio"),
        is_member=bool(data.get("is_member", False)),
        tier=data.get("tier") or MemberTier.BEGINNER,
        is_verified=bool(data.get("is_verified", False)),
        skills=data.get("skills") or [],
        social_links=social_links,
        points=points,
    )


def _get_or_create_user(user_token: dict) -> UserMeResponse:
    uid = user_token["uid"]
    email = (user_token.get("email") or "").lower().strip()
    name = user_token.get("name") or (email.split("@")[0] if email else "Club Member")
    picture = user_token.get("picture")

    doc_ref = db.collection(USERS_COLLECTION).document(uid)
    doc = doc_ref.get()

    now = _now_iso()
    if doc.exists:
        data = doc.to_dict() or {}
        # Keep last login fresh
        doc_ref.set({"last_login": now, "updated_at": now}, merge=True)
        data["last_login"] = now
        data["updated_at"] = now
        return _to_user_me(uid, data)
    else:
        new_user = {
            "id": uid,
            "email": email,
            "full_name": name,
            "avatar_url": picture,
            "discord_id": None,
            "is_admin": False,
            "is_member": False,
            "tier": MemberTier.BEGINNER.value,
            "is_verified": False,
            "verified_at": None,
            "points": {"total": 0, "kaggle": 0, "product": 0, "research": 0, "misc": 0},
            "bio": None,
            "skills": [],
            "social_links": {"github": None, "kaggle": None, "linkedin": None, "discord": None},
            "created_at": now,
            "updated_at": now,
            "last_login": now,
        }
        doc_ref.set(new_user)
        return _to_user_me(uid, new_user)


# ---------------------------------------------------------------------------
# Current Authenticated User Endpoints
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserMeResponse, summary="Get current authenticated user profile")
def get_me(current_user: dict = Depends(get_current_user)) -> UserMeResponse:
    """Returns the authenticated member's complete profile and cached points."""
    return _get_or_create_user(current_user)


@router.patch("/me", response_model=UserMeResponse, summary="Update own profile details")
def update_me(
    payload: UserUpdateRequest,
    current_user: dict = Depends(get_current_user),
) -> UserMeResponse:
    """Allows a member to update their bio, skills, full_name, avatar, and social links."""
    uid = current_user["uid"]
    doc_ref = db.collection(USERS_COLLECTION).document(uid)
    doc = doc_ref.get()

    if not doc.exists:
        _get_or_create_user(current_user)

    now = _now_iso()
    updates: Dict[str, Any] = {"updated_at": now}

    if payload.full_name is not None:
        updates["full_name"] = payload.full_name.strip()
    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url.strip()
    if payload.bio is not None:
        updates["bio"] = payload.bio.strip()
    if payload.skills is not None:
        updates["skills"] = [s.strip() for s in payload.skills if s.strip()]
    if payload.social_links is not None:
        updates["social_links"] = payload.social_links.model_dump()

    doc_ref.set(updates, merge=True)
    updated = doc_ref.get().to_dict() or {}
    return _to_user_me(uid, updated)


@router.post("/sync", response_model=UserMeResponse, summary="Synchronize OAuth token with Firestore")
def sync_user(current_user: dict = Depends(get_current_user)) -> UserMeResponse:
    """Triggered on login to ensure the student's record is initialized or refreshed."""
    return _get_or_create_user(current_user)


@router.post("/verify-discord", summary="Link Discord ID and notify YUVI bot")
def verify_discord(
    payload: DiscordVerifyRequest,
    current_user: dict = Depends(get_current_user),
):
    """Link numeric Discord snowflake, mark user verified, and trigger bot webhook."""
    uid = current_user["uid"]
    discord_id = payload.discord_id.strip()

    email = (current_user.get("email") or "").lower().strip()
    name = current_user.get("name") or (email.split("@")[0] if email else "Club Member")
    now = _now_iso()

    doc_ref = db.collection(USERS_COLLECTION).document(uid)
    update_data = {
        "discord_id": discord_id,
        "is_verified": True,
        "verified_at": now,
        "updated_at": now,
    }
    doc_ref.set(update_data, merge=True)

    # Secondary lookup doc for legacy bot compatibility if needed
    try:
        db.collection(USERS_COLLECTION).document(discord_id).set({
            "firebase_uid": uid,
            "email": email,
            "discord_id": discord_id,
            "is_verified": True,
            "verified_at": now,
            "updated_at": now,
        }, merge=True)
    except Exception:
        pass

    # Call YUVI Bot Server to assign Discord role & send DM
    bot_payload = {
        "discord_id": discord_id,
        "email": email,
        "name": name,
        "secret": settings.bot_internal_secret or None,
    }
    bot_url = settings.yuvi_bot_url
    bot_response_data = {}

    try:
        req = urllib.request.Request(
            bot_url,
            data=json.dumps(bot_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Internal-Secret": settings.bot_internal_secret or "",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10.0) as response:
            bot_res_body = response.read().decode("utf-8")
            bot_response_data = json.loads(bot_res_body)
    except urllib.error.HTTPError as e:
        error_detail = e.read().decode("utf-8")
        try:
            parsed = json.loads(error_detail)
            detail = parsed.get("detail", error_detail)
        except Exception:
            detail = error_detail
        bot_response_data = {"status": "bot_warning", "detail": str(detail)}
    except Exception as e:
        bot_response_data = {"status": "bot_unreachable", "detail": str(e)}

    updated_doc = doc_ref.get().to_dict() or {}
    user_me = _to_user_me(uid, updated_doc)

    return {
        "success": True,
        "message": "Discord account successfully linked & verified!",
        "discord_id": discord_id,
        "email": email,
        "role_granted": bot_response_data.get("role_granted", "Verified Member"),
        "bot_response": bot_response_data,
        "user": user_me,
    }


@router.post("/unlink-discord", summary="Unlink Discord account")
def unlink_discord(current_user: dict = Depends(get_current_user)):
    """Unlink Discord ID from the current member profile."""
    uid = current_user["uid"]
    doc_ref = db.collection(USERS_COLLECTION).document(uid)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")

    old_data = doc.to_dict() or {}
    old_discord_id = old_data.get("discord_id")

    now = _now_iso()
    doc_ref.set({
        "discord_id": None,
        "is_verified": False,
        "updated_at": now,
    }, merge=True)

    if old_discord_id and str(old_discord_id).isdigit():
        try:
            db.collection(USERS_COLLECTION).document(str(old_discord_id)).delete()
        except Exception:
            pass

    updated_doc = doc_ref.get().to_dict() or {}
    return {
        "success": True,
        "message": "Discord account successfully unlinked.",
        "user": _to_user_me(uid, updated_doc),
    }


@router.post("/me/avatar", summary="Upload avatar image")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload custom avatar image to storage and update profile."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    uid = current_user["uid"]
    file_extension = file.filename.split(".")[-1] if file.filename else "png"
    destination_path = f"users/{uid}/avatar.{file_extension}"

    avatar_url = upload_file_to_storage(file.file, destination_path, file.content_type)
    db.collection(USERS_COLLECTION).document(uid).set({
        "avatar_url": avatar_url,
        "updated_at": _now_iso(),
    }, merge=True)

    return {"message": "Avatar updated successfully", "avatar_url": avatar_url}


# ---------------------------------------------------------------------------
# Admin Management Endpoints
# ---------------------------------------------------------------------------

@router.patch("/{user_id}/status", response_model=UserMeResponse, summary="Update member status, admin role, or tier (Admin only)")
def update_user_status(
    user_id: str,
    payload: AdminUserUpdateRequest,
    admin: dict = Depends(get_admin_user),
) -> UserMeResponse:
    """Allows admins to update is_member, is_admin, and tier for any user."""
    doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    now = _now_iso()
    updates: Dict[str, Any] = {"updated_at": now}

    if payload.is_member is not None:
        updates["is_member"] = payload.is_member
    if payload.is_admin is not None:
        updates["is_admin"] = payload.is_admin
    if payload.tier is not None:
        updates["tier"] = payload.tier.value

    doc_ref.set(updates, merge=True)
    updated = doc_ref.get().to_dict() or {}
    return _to_user_me(user_id, updated)


# ---------------------------------------------------------------------------
# Public Member & Leaderboard Endpoints
# ---------------------------------------------------------------------------

@router.get("/leaderboard", response_model=LeaderboardResponse, summary="Get fast cached leaderboard")
def get_leaderboard(
    track: str = Query("total", description="total, kaggle, product, research, misc"),
    is_member: Optional[bool] = Query(None, description="Filter by club member status"),
    limit: int = Query(50, ge=1, le=100, description="Top N members"),
) -> LeaderboardResponse:
    """Fetch leaderboard sorted by cached points for the selected track."""
    track_clean = track.lower().strip()
    if track_clean not in VALID_TRACKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid track '{track}'. Must be one of: {', '.join(sorted(VALID_TRACKS))}",
        )

    docs = db.collection(USERS_COLLECTION).stream()
    candidates: List[LeaderboardEntry] = []

    for doc in docs:
        data = doc.to_dict() or {}
        if doc.id.isdigit() and not data.get("full_name"):
            continue

        doc_is_member = bool(data.get("is_member", False))
        if is_member is not None and doc_is_member != is_member:
            continue

        points_raw = data.get("points") or {}
        points = TrackPoints(
            total=int(points_raw.get("total", 0)),
            kaggle=int(points_raw.get("kaggle", 0)),
            product=int(points_raw.get("product", 0)),
            research=int(points_raw.get("research", 0)),
            misc=int(points_raw.get("misc", 0)),
        )

        track_score = getattr(points, track_clean, 0)
        if track_score > 0 or track_clean == "total":
            candidates.append(
                LeaderboardEntry(
                    id=doc.id,
                    full_name=data.get("full_name") or "Club Member",
                    avatar_url=data.get("avatar_url"),
                    is_member=doc_is_member,
                    tier=data.get("tier") or MemberTier.BEGINNER,
                    points=points,
                    rank=1,
                )
            )

    candidates.sort(key=lambda x: getattr(x.points, track_clean, 0), reverse=True)

    for idx, entry in enumerate(candidates[:limit], start=1):
        entry.rank = idx

    entries = candidates[:limit]
    return LeaderboardResponse(
        track=track_clean,
        total=len(entries),
        entries=entries,
    )


@router.get("/{id_or_email}", response_model=UserPublicResponse, summary="Get public member profile")
def get_user_profile(id_or_email: str) -> UserPublicResponse:
    """Fetch public member profile by UID or email."""
    # 1. Try UID direct lookup
    doc = db.collection(USERS_COLLECTION).document(id_or_email).get()
    if doc.exists:
        data = doc.to_dict() or {}
        return _to_user_public(doc.id, data)

    # 2. Try email query
    query = (
        db.collection(USERS_COLLECTION)
        .where("email", "==", id_or_email.lower().strip())
        .limit(1)
        .stream()
    )
    for match in query:
        return _to_user_public(match.id, match.to_dict() or {})

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member profile not found")


@router.get("", response_model=UserListResponse, summary="Browse member directory")
def list_users(
    search: Optional[str] = Query(None, description="Search by name, email, or skill"),
    track: Optional[str] = Query(None, description="Filter by active track points > 0"),
    tier: Optional[MemberTier] = Query(None, description="Filter by tier"),
    is_member: Optional[bool] = Query(None, description="Filter by club member status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=50, description="Items per page"),
) -> UserListResponse:
    """Search and browse member directory with filters."""
    docs = db.collection(USERS_COLLECTION).stream()
    all_users: List[UserPublicResponse] = []

    for doc in docs:
        data = doc.to_dict() or {}
        if doc.id.isdigit() and not data.get("full_name"):
            continue

        public_user = _to_user_public(doc.id, data)

        if is_member is not None and public_user.is_member != is_member:
            continue

        if tier and public_user.tier != tier:
            continue

        if track and track.lower().strip() in VALID_TRACKS:
            track_val = getattr(public_user.points, track.lower().strip(), 0)
            if track_val <= 0:
                continue

        if search:
            s = search.lower().strip()
            name_match = s in public_user.full_name.lower()
            skill_match = any(s in sk.lower() for sk in public_user.skills)
            bio_match = s in (public_user.bio or "").lower()
            if not (name_match or skill_match or bio_match):
                continue

        all_users.append(public_user)

    all_users.sort(key=lambda u: u.points.total, reverse=True)

    total = len(all_users)
    start = (page - 1) * page_size
    end = start + page_size
    items = all_users[start:end]

    return UserListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=end < total,
    )
