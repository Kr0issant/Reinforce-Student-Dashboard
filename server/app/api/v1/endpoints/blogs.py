from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from google.cloud import firestore
from app.api.security import get_current_user
from pydantic import BaseModel
from app.services.firebase import upload_file_to_storage
import uuid


router = APIRouter(prefix="/blogs", tags=["Blogs"])
db = firestore.client()


@router.post("/blogs/upload")
async def upload_blog_markdown(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    # Validate it's a markdown file
    if not file.content_type in ["text/markdown", "text/x-markdown", "application/octet-stream"]:
        # Note: sometimes .md files default to octet-stream depending on the OS
        if not file.filename.endswith(".md"):
            raise HTTPException(status_code=400, detail="Only .md files are allowed.")

    safe_filename = f"{uuid.uuid4()}.md"
    destination_path = f"blogs/{user['uid']}/{safe_filename}"
    
    # Upload and get the public URL using your helper
    public_url = upload_file_to_storage(
        file_obj=file.file, 
        destination_path=destination_path, 
        content_type="text/markdown"
    )
    
    return {"message": "Blog uploaded", "url": public_url}

# Verification Needed 
@router.post("/")
async def create_blog_post(blog: BlogCreate, user: dict = Depends(get_current_user)):
    """Saves the blog metadata and storage URL to Firestore."""
    blog_data = blog.model_dump()
    blog_data.update({
        "author_id": user["uid"],
        "created_at": firestore.SERVER_TIMESTAMP
    })
    
    # Create a new document with an auto-generated ID
    doc_ref = db.collection("blogs").document()
    doc_ref.set(blog_data)
    
    return {"message": "Blog published successfully", "id": doc_ref.id}

@router.get("/")
async def list_blogs():
    """Fetches all blogs for the public feed, sorted by newest first."""
    docs = db.collection("blogs").order_by(
        "created_at", direction=firestore.Query.DESCENDING
    ).stream()
    
    blogs = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        blogs.append(data)
        
    return blogs

@router.get("/{blog_id}")
async def get_blog(blog_id: str):
    """Fetches a specific blog's metadata."""
    doc = db.collection("blogs").document(blog_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Blog not found")
        
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.patch("/{blog_id}")
async def update_blog(blog_id: str, updates: BlogUpdate, user: dict = Depends(get_current_user)):
    """Allows the original author to update their blog metadata."""
    doc_ref = db.collection("blogs").document(blog_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Blog not found")
        
    if doc.to_dict().get("author_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="You can only edit your own blogs")

    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    doc_ref.update(update_data)
    return {"message": "Blog updated successfully"}