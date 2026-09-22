from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud import firestore
from app.api.security import get_current_user
from app.api.v1.endpoints.student import get_admin_user
from app.schemas.blogs import BlogCreate, BlogUpdate # Ensure these now use `content: str`

router = APIRouter(prefix="/blogs", tags=["Blogs"])
db = firestore.client()

@router.post("/")
async def create_blog_post(blog: BlogCreate, user: dict = Depends(get_current_user)):
    """Saves the blog metadata and raw markdown content directly to Firestore."""
    blog_data = blog.model_dump()
    blog_data.update({
        "author_id": user["uid"],
        "created_at": firestore.SERVER_TIMESTAMP,
        "is_verified": False,
    })
    
    doc_ref = db.collection("blogs").document()
    doc_ref.set(blog_data)
    
    return {"message": "Blog published successfully", "id": doc_ref.id}

@router.get("/")
async def list_blogs():
    """Fetches all verified blogs for the public feed."""
    # Note: This fetches the full markdown content for every blog. 
    # If the feed gets slow in the future, you can use .select(["title", "summary", "tags"]) 
    # to only fetch metadata for the list view.
    docs = db.collection("blogs")\
        .where("is_verified", "==", True)\
        .order_by("created_at", direction=firestore.Query.DESCENDING)\
        .stream()
    
    blogs = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        blogs.append(data)
        
    return blogs

@router.get("/{blog_id}")
async def get_blog(blog_id: str):
    """Fetches a specific blog including its full markdown content."""
    doc = db.collection("blogs").document(blog_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Blog not found")
        
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.patch("/{blog_id}")
async def update_blog(blog_id: str, updates: BlogUpdate, user: dict = Depends(get_current_user)):
    """Allows the original author to update their blog and resets verification."""
    doc_ref = db.collection("blogs").document(blog_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Blog not found")
        
    if doc.to_dict().get("author_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="You can only edit your own blogs")

    update_data = updates.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    # Security: If they change the content, force an admin to re-verify it
    update_data["is_verified"] = False 

    doc_ref.update(update_data)
    return {"message": "Blog updated and sent back for review."}

@router.patch("/{blog_id}/verify")
async def verify_blog_post(blog_id: str, admin: dict = Depends(get_admin_user)):
    """Admins approve the blog, making it visible on the public feed."""
    doc_ref = db.collection("blogs").document(blog_id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Blog not found")
        
    doc_ref.update({"is_verified": True})
    return {"message": "Blog verified and published."}

@router.delete("/{blog_id}")
async def delete_blog(blog_id: str, user: dict = Depends(get_current_user)):
    """Deletes a blog post from the database."""
    doc_ref = db.collection("blogs").document(blog_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Blog not found")
        
    # Allow the author to delete their own post
    # (Optional: You can add an `or user.get("is_admin")` here if you want admins to have delete power)
    if doc.to_dict().get("author_id") != user["uid"]:
        raise HTTPException(status_code=403, detail="You can only delete your own blogs")
        
    doc_ref.delete()
    return {"message": "Blog deleted successfully."}