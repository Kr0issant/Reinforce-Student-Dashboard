import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.security import get_current_user
from app.firebase import db
from app.config import get_settings
from app.schemas.student import (
    StudentProfile, 
    ProfileUpdateRequest, 
    DiscordVerifyRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


def _get_user_doc_ref(email: str, uid: Optional[str] = None):
    """
    Returns the Firestore DocumentReference for a user, prioritized by normalized email.
    """
    normalized_email = email.lower().strip()
    return db.collection("users").document(normalized_email)


def _format_user_doc(doc_data: Dict[str, Any], default_email: str = "", default_name: str = "") -> Dict[str, Any]:
    return {
        "email": doc_data.get("email", default_email),
        "full_name": doc_data.get("full_name", default_name),
        "avatar_url": doc_data.get("avatar_url") or doc_data.get("picture"),
        "firebase_uid": doc_data.get("firebase_uid"),
        "discord_id": doc_data.get("discord_id"),
        "is_verified": bool(doc_data.get("is_verified", False) or doc_data.get("discord_id")),
        "verified_at": doc_data.get("verified_at"),
        "created_at": doc_data.get("created_at"),
        "updated_at": doc_data.get("updated_at"),
        "skills": doc_data.get("skills", []),
        "social_links": doc_data.get("social_links", {})
    }


@router.post("/sync-user")
async def sync_user(current_user: dict = Depends(get_current_user)):
    """
    Called upon direct Google SSO login on the website.
    Registers or updates the student's record in Firestore without requiring a Discord ID.
    Returns the full student profile.
    """
    email = current_user.get("email", "").lower().strip()
    name = current_user.get("name") or current_user.get("displayName") or "SST Member"
    picture = current_user.get("picture") or current_user.get("avatar_url")
    uid = current_user.get("uid")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User email not present in token."
        )

    user_ref = _get_user_doc_ref(email, uid)
    now_iso = datetime.now(timezone.utc).isoformat()

    existing_doc = user_ref.get()
    
    if existing_doc.exists:
        doc_data = existing_doc.to_dict() or {}
        # Merge latest sign-in details while preserving profile fields
        update_payload = {
            "last_login": now_iso,
            "updated_at": now_iso,
            "firebase_uid": uid
        }
        if not doc_data.get("avatar_url") and picture:
            update_payload["avatar_url"] = picture
        if not doc_data.get("full_name") and name:
            update_payload["full_name"] = name

        user_ref.set(update_payload, merge=True)
        doc_data.update(update_payload)
        return {
            "success": True,
            "user": _format_user_doc(doc_data, default_email=email, default_name=name)
        }
    else:
        # Create brand new student document
        new_user_data = {
            "email": email,
            "full_name": name,
            "avatar_url": picture,
            "firebase_uid": uid,
            "discord_id": None,
            "is_verified": False,
            "created_at": now_iso,
            "updated_at": now_iso,
            "last_login": now_iso,
            "skills": [],
            "social_links": {
                "github": None,
                "linkedin": None,
                "kaggle": None,
                "discord": None
            }
        }
        user_ref.set(new_user_data)
        return {
            "success": True,
            "user": _format_user_doc(new_user_data, default_email=email, default_name=name)
        }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Returns the authenticated student's profile from Firestore.
    """
    email = current_user.get("email", "").lower().strip()
    name = current_user.get("name") or current_user.get("displayName") or "SST Member"
    picture = current_user.get("picture")
    uid = current_user.get("uid")

    user_ref = _get_user_doc_ref(email, uid)
    doc = user_ref.get()

    if not doc.exists:
        # If not found yet, auto-sync and return
        now_iso = datetime.now(timezone.utc).isoformat()
        new_user_data = {
            "email": email,
            "full_name": name,
            "avatar_url": picture,
            "firebase_uid": uid,
            "discord_id": None,
            "is_verified": False,
            "created_at": now_iso,
            "updated_at": now_iso,
            "last_login": now_iso,
            "skills": [],
            "social_links": {}
        }
        user_ref.set(new_user_data)
        return {"success": True, "user": _format_user_doc(new_user_data, default_email=email, default_name=name)}

    doc_data = doc.to_dict() or {}
    return {"success": True, "user": _format_user_doc(doc_data, default_email=email, default_name=name)}


@router.post("/verify-discord")
async def verify_discord(
    payload: DiscordVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    1. Authenticate user from Firebase Google ID Token (Bearer header).
    2. Save / update member record in Firestore with discord_id and verified status.
    3. Notify YUVI Discord Bot server to assign the Verified role & send confirmation DM.
    """
    discord_id = payload.discord_id.strip()
    if not discord_id.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid discord_id format. Must be a numeric snowflake string."
        )

    email = current_user.get("email", "").lower().strip()
    name = current_user.get("name") or current_user.get("displayName") or "SST Member"
    picture = current_user.get("picture")
    uid = current_user.get("uid")
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Update primary User document in Firestore (keyed by email)
    user_ref = _get_user_doc_ref(email, uid)
    update_data = {
        "email": email,
        "full_name": name,
        "avatar_url": picture,
        "firebase_uid": uid,
        "discord_id": discord_id,
        "is_verified": True,
        "verified_at": now_iso,
        "updated_at": now_iso
    }
    try:
        user_ref.set(update_data, merge=True)
        # Also store secondary lookup document keyed by discord_id for direct-key bot query compatibility
        db.collection("users").document(discord_id).set(update_data, merge=True)
    except Exception as e:
        print(f"[AuthRouter] Warning saving to Firestore: {e}")

    # 2. Call YUVI Bot Server to assign Discord role & send DM
    bot_payload = {
        "discord_id": discord_id,
        "email": email,
        "name": name,
        "secret": settings.bot_internal_secret or None
    }

    bot_url = settings.yuvi_bot_url
    bot_response_data = {}

    try:
        req = urllib.request.Request(
            bot_url,
            data=json.dumps(bot_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Internal-Secret": settings.bot_internal_secret or ""
            },
            method="POST"
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

        print(f"[AuthRouter] Discord Bot returned {e.code}: {detail}")
        # Even if bot role assignment encounters a temporary issue, user is recorded in Firestore
        bot_response_data = {"status": "bot_warning", "detail": str(detail)}

    except Exception as e:
        print(f"[AuthRouter] Could not connect to Discord Bot server at {bot_url}: {e}")
        bot_response_data = {"status": "bot_unreachable", "detail": str(e)}

    # Fetch updated user state
    refreshed_doc = user_ref.get()
    formatted_user = _format_user_doc(
        refreshed_doc.to_dict() if refreshed_doc.exists else update_data,
        default_email=email,
        default_name=name
    )

    return {
        "success": True,
        "message": "Discord account successfully linked & verified!",
        "discord_id": discord_id,
        "email": email,
        "role_granted": bot_response_data.get("role_granted", "Verified Member"),
        "bot_response": bot_response_data,
        "user": formatted_user
    }


@router.post("/unlink-discord")
async def unlink_discord(current_user: dict = Depends(get_current_user)):
    """
    Unlinks Discord ID from current student profile.
    """
    email = current_user.get("email", "").lower().strip()
    user_ref = _get_user_doc_ref(email)
    
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found.")
    
    old_data = doc.to_dict() or {}
    old_discord_id = old_data.get("discord_id")

    now_iso = datetime.now(timezone.utc).isoformat()
    update_data = {
        "discord_id": None,
        "is_verified": False,
        "updated_at": now_iso
    }
    user_ref.set(update_data, merge=True)

    # Clean up secondary discord_id doc if existing
    if old_discord_id and old_discord_id.isdigit():
        try:
            db.collection("users").document(old_discord_id).delete()
        except Exception as e:
            print(f"[AuthRouter] Warning cleaning secondary doc: {e}")

    refreshed = user_ref.get()
    return {
        "success": True,
        "message": "Discord account successfully unlinked.",
        "user": _format_user_doc(refreshed.to_dict() or update_data, default_email=email)
    }


@router.put("/profile")
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update student profile details such as skills, bio, or social links.
    """
    email = current_user.get("email", "").lower().strip()
    user_ref = _get_user_doc_ref(email)

    updates: Dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if payload.full_name is not None:
        updates["full_name"] = payload.full_name.strip()
    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url.strip()
    if payload.skills is not None:
        updates["skills"] = [s.strip() for s in payload.skills if s.strip()]
    if payload.social_links is not None:
        updates["social_links"] = payload.social_links.model_dump()

    user_ref.set(updates, merge=True)
    doc = user_ref.get()
    return {
        "success": True,
        "message": "Profile updated successfully.",
        "user": _format_user_doc(doc.to_dict() or updates, default_email=email)
    }
