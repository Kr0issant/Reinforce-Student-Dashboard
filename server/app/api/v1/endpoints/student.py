
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from google.cloud import firestore
from app.api.security import get_current_user
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse
from pydantic import BaseModel
from app.services.firebase import upload_file_to_storage

router = APIRouter(prefix="/students", tags=["Students"])
db = firestore.client()

# --- Custom Admin Dependency ---
def get_admin_user(user: dict = Depends(get_current_user)):
    """Fetches the user from Firestore and verifies they have admin privileges."""
    doc = db.collection("users").document(user["uid"]).get()
    if not doc.exists or not doc.to_dict().get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Admin privileges required."
        )
    return user

# --- Student-Facing Endpoints ---

@router.post("/create", response_model=StudentResponse)
async def create_student(student: StudentCreate, user: dict = Depends(get_current_user)):
    """Triggered after a student logs in for the very first time."""
    # Ensure they aren't creating a profile for someone else's UID
    if student.firebase_uid != user["uid"]:
        raise HTTPException(status_code=403, detail="UID mismatch")
        
    doc_ref = db.collection("users").document(user["uid"])
    if doc_ref.get().exists:
        raise HTTPException(status_code=400, detail="Student profile already exists")

    # Initialize stats to 0 and admin to False securely on the backend
    student_data = student.model_dump()
    student_data.update({
        "points": 0,
        "past_event_wins": 0,
        "verified_spgs": 0,
        "is_admin": False,
        "created_at": firestore.SERVER_TIMESTAMP
    })
    
    doc_ref.set(student_data)
    
    # Return the newly created data mapping to StudentResponse
    student_data["id"] = user["uid"]
    return student_data

@router.get("/me", response_model=StudentResponse)
async def get_current_student_profile(user: dict = Depends(get_current_user)):
    """Fetches the logged-in student's dashboard profile."""
    doc = db.collection("users").document(user["uid"]).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.patch("/me-edit", response_model=StudentResponse)
async def update_own_profile(updates: StudentUpdate, user: dict = Depends(get_current_user)):
    """Allows a student to update their social links, skills, and avatar."""
    doc_ref = db.collection("users").document(user["uid"])
    
    # drop_unset=True ensures we only update fields the frontend actually sent
    update_data = updates.model_dump(exclude_unset=True) 
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    doc_ref.update(update_data)
    
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = user["uid"]
    return updated_doc

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student_by_id(student_id: str, user: dict = Depends(get_current_user)):
    """Fetches a specific student's profile for the public Team or Leaderboard pages."""
    doc = db.collection("users").document(student_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Student not found")
        
    data = doc.to_dict()
    data["id"] = doc.id
    return data


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...), 
    user: dict = Depends(get_current_user)
):
    # 1. Validate file size and type (e.g., only images)
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")
        
    # 2. Define the secure storage path
    file_extension = file.filename.split(".")[-1]
    destination_path = f"users/{user['uid']}/avatar.{file_extension}"
    
    # 3. Upload and get URL
    avatar_url = upload_file_to_storage(file.file, destination_path, file.content_type)
    
    # 4. Update Firestore profile
    db.collection("users").document(user["uid"]).update({"avatar_url": avatar_url})
    
    return {"message": "Avatar updated successfully", "avatar_url": avatar_url}