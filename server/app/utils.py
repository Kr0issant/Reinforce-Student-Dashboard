"""Common utility functions for time formatting, string manipulation, and helpers."""

from datetime import datetime, timezone
import re
from typing import Any, Optional


def now_utc() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def now_iso() -> str:
    """Return current UTC timestamp in ISO-8601 string format."""
    return datetime.now(timezone.utc).isoformat()


def iso_str(value: Any) -> Optional[str]:
    """Normalise Firestore timestamp, datetime, or string to an ISO-8601 string."""
    if value is None:
        return None
    if isinstance(value, str):
        return value
    isoformat = getattr(value, "isoformat", None)
    return isoformat() if callable(isoformat) else str(value)


def slugify(text: str) -> str:
    """Generate a clean URL-friendly slug from text."""
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s or "untitled"


def is_admin_user(user: dict) -> bool:
    """Check if the given user dictionary or Firestore user profile has admin privileges."""
    if not user:
        return False
    if user.get("admin") is True or user.get("is_admin") is True:
        return True
    uid = user.get("uid")
    if not uid:
        return False
    try:
        from server.app.services.firebase import db
        doc = db.collection("users").document(uid).get()
        return bool(doc.exists and (doc.to_dict() or {}).get("is_admin", False))
    except Exception:
        return False


def get_user_uid(user: dict) -> str:
    """Safely extract the user UID from token payload."""
    return user.get("uid") or ""
