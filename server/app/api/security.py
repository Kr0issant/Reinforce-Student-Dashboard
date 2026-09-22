from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import server.app.services.firebase
from server.app.services.firebase import db

security = HTTPBearer()

ALLOWED_DOMAINS = ("@sst.scaler.com", "@scaler.com")


def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    if not cred:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    try:
        # Verifies the token and decodes the user payload
        decoded_token = auth.verify_id_token(cred.credentials)

        # Restrict login to SST / Scaler emails
        email = (decoded_token.get("email") or "").lower().strip()
        if not any(email.endswith(domain) for domain in ALLOWED_DOMAINS):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="An SST/Scaler email (@sst.scaler.com or @scaler.com) is required for club access."
            )

        return decoded_token

    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


def get_admin_user(user: dict = Depends(get_current_user)) -> dict:
    """Verifies that the authenticated user has core admin privileges."""
    uid = user.get("uid")
    if not uid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="UID missing from token.")

    doc = db.collection("users").document(uid).get()
    if not doc.exists or not doc.to_dict().get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required."
        )
    return user