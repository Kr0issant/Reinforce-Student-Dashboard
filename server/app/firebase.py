import firebase_admin
from firebase_admin import credentials, firestore, storage
from app.config import get_settings

settings = get_settings()

# Initialize Firebase Admin SDK once
cred = credentials.Certificate(settings.firebase_credentials_path)
firebase_admin.initialize_app(cred, {
    'storageBucket': settings.firebase_storage_bucket # No Access yet
})

# Export clients to use across your services
db = firestore.client()
bucket = storage.bucket()