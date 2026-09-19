import firebase_admin
from firebase_admin import credentials, firestore, storage
from app.config import settings

# Initialize Firebase Admin SDK once
cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
firebase_admin.initialize_app(cred, {
    'storageBucket': settings.FIREBASE_STORAGE_BUCKET
})

# Export clients to use across your services
db = firestore.client()
bucket = storage.bucket()