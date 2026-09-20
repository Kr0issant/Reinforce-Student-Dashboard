from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    firebase_credentials_path: str = "firebase_credentials.json"
    firebase_storage_bucket: str = ""
    frontend_url: str = "https://reinforce-student-dashboard-xi.vercel.app/"
    yuvi_bot_url: str = "https://yuvi-oxug.onrender.com/internal/verify-success"
    bot_internal_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()