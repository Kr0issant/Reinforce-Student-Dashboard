"""Legacy students router (aliases and delegates to unified /users)."""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from app.api.security import get_current_user, get_admin_user
from app.schemas.users import (
    UserMeResponse,
    UserPublicResponse,
    UserUpdateRequest,
)
from app.api.v1.endpoints.users import (
    get_me,
    update_me,
    get_user_profile,
    upload_avatar,
)

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("/me", response_model=UserMeResponse)
def get_current_student_profile(user: dict = Depends(get_current_user)):
    return get_me(current_user=user)

@router.patch("/me-edit", response_model=UserMeResponse)
def update_own_profile(updates: UserUpdateRequest, user: dict = Depends(get_current_user)):
    return update_me(payload=updates, current_user=user)

@router.get("/{student_id}", response_model=UserPublicResponse)
def get_student_by_id(student_id: str, user: dict = Depends(get_current_user)):
    return get_user_profile(id_or_email=student_id)

@router.post("/me/avatar")
def upload_student_avatar(
    file: UploadFile = File(...), 
    user: dict = Depends(get_current_user)
):
    return upload_avatar(file=file, current_user=user)