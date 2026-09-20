import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.security import get_current_user
from app.firebase import db

router = APIRouter(prefix="/auth", tags=["Authentication"])

YUVI_BOT_URL = os.getenv("YUVI_BOT_URL", "http://localhost:8000/internal/verify-success")
BOT_INTERNAL_SECRET = os.getenv("BOT_INTERNAL_SECRET", "")


class DiscordVerifyRequest(BaseModel):
    discord_id: str = Field(..., description="Target Discord user snowflake ID (e.g. 1549547403819090011)")


@router.post("/verify-discord")
async def verify_discord(
    payload: DiscordVerifyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    1. Authenticate user from Firebase Google ID Token (Bearer header).
    2. Save / update member record in Firestore 'users' collection.
    3. Notify YUVI Discord Bot server to assign the Verified role & send confirmation DM.
    """
    discord_id = payload.discord_id.strip()
    if not discord_id.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid discord_id format. Must be an integer string."
        )

    email = current_user.get("email", "").lower().strip()
    name = current_user.get("name") or current_user.get("displayName") or "SST Member"
    uid = current_user.get("uid")

    # 1. Save / Update User in Firestore
    user_doc_ref = db.collection("users").document(discord_id)
    user_doc_data = {
        "discord_id": discord_id,
        "email": email,
        "full_name": name,
        "firebase_uid": uid,
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "is_verified": True
    }
    try:
        user_doc_ref.set(user_doc_data, merge=True)
    except Exception as e:
        print(f"[AuthRouter] Warning saving to Firestore: {e}")

    # 2. Call YUVI Bot Server to assign Discord role & send DM
    bot_payload = {
        "discord_id": discord_id,
        "email": email,
        "name": name,
        "secret": BOT_INTERNAL_SECRET or None
    }

    try:
        req = urllib.request.Request(
            YUVI_BOT_URL,
            data=json.dumps(bot_payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Internal-Secret": BOT_INTERNAL_SECRET
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10.0) as response:
            bot_res_body = response.read().decode("utf-8")
            bot_data = json.loads(bot_res_body)

        return {
            "success": True,
            "message": "Discord account successfully verified!",
            "discord_id": discord_id,
            "email": email,
            "role_granted": bot_data.get("role_granted", "Verified Member"),
            "bot_response": bot_data
        }

    except urllib.error.HTTPError as e:
        error_detail = e.read().decode("utf-8")
        try:
            parsed = json.loads(error_detail)
            detail = parsed.get("detail", error_detail)
        except Exception:
            detail = error_detail

        raise HTTPException(
            status_code=e.code,
            detail=f"Discord Bot error ({e.code}): {detail}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Could not connect to Discord Bot server at {YUVI_BOT_URL}: {e}"
        )
