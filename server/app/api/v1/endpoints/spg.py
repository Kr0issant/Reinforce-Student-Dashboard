from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from firebase_admin import storage
from app.api.security import get_current_user
from app.services.firebase import upload_file_to_storage
import uuid

router = APIRouter(prefix="/spgs", tags=["SPGs"])



@router.post("/{spg_id}/reports")
async def upload_spg_report(
    spg_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    # 1. Validate file type
    if not file.content_type == "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF reports are allowed.")

    try:
        # 2. Define the secure storage path
        safe_filename = f"{uuid.uuid4()}.pdf"
        destination_path = f"spgs/{spg_id}/reports/{safe_filename}"
        
        # 3. Upload the file using your central helper function
        public_url = upload_file_to_storage(
            file_obj=file.file, 
            destination_path=destination_path, 
            content_type=file.content_type
        )
        
        # 4. Save public_url to Firestore here...
        # Example: db.collection("spgs").document(spg_id).update({"latest_report_url": public_url})
        
        return {"message": "Report uploaded", "url": public_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



