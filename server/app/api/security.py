from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
# Ensure firebase is initialized before auth is called
import app.firebase

security = HTTPBearer()