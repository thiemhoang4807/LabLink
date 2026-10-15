import os
from pathlib import Path

from dotenv import load_dotenv

API_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(API_ROOT / ".env")


class Settings:
    app_env = os.getenv("APP_ENV", "development")
    database_url = os.getenv("DATABASE_URL", f"sqlite:///{API_ROOT / 'data' / 'lablink.db'}")
    storage_dir = Path(os.getenv("STORAGE_DIR", str(API_ROOT / "data" / "uploads")))
    cookie_name = "lablink_session"
    cookie_secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    session_hours = int(os.getenv("SESSION_HOURS", "24"))
    seed_demo = os.getenv("SEED_DEMO", "true" if app_env == "development" else "false").lower() == "true"
    frontend_origins = [s.strip() for s in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if s.strip()]
    max_upload_bytes = 5 * 1024 * 1024


settings = Settings()
