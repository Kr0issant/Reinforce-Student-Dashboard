from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
# Import firebase to ensure it initializes when the app starts
import app.firebase 

from app.api.v1.endpoints import auth, tickets  

settings = get_settings()
app = FastAPI()

origins = [
    "http://localhost:3000",
    "https://reinforce-student-dashboard-xi.vercel.app/",  # replace with your deployed Vercel domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")

@app.get("/")
@app.head("/")
async def root():
    return {"status": "ok", "service": "Reinforce Student Dashboard API"}

@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "healthy"}