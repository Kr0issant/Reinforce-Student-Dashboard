import firebase_admin
from firebase_admin import credentials, firestore, storage
from server.app.services.config import get_settings

settings = get_settings()

# Initialize Firebase Admin SDK once
cred = credentials.Certificate(settings.firebase_credentials_path)
firebase_admin.initialize_app(cred, {
    'storageBucket': settings.firebase_storage_bucket # No Access yet
})

# Export clients to use across your services
db = firestore.client()
bucket = storage.bucket()

import urllib.parse
import uuid

def upload_file_to_storage(file_obj, destination_path: str, content_type: str) -> str:
    """Uploads a file and returns the public download URL."""
    bucket = storage.bucket()
    blob = bucket.blob(destination_path)
    
    # Upload the file buffer
    blob.upload_from_file(file_obj, content_type=content_type)
    
    # Construct the public Firebase Storage URL manually
    encoded_path = urllib.parse.quote(destination_path, safe='')
    public_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{encoded_path}?alt=media"
    
    return public_url