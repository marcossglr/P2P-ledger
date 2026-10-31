from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = BASE_DIR / "p2p_reconciliation.db"


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "P2P Ledger — Operaciones & Analítica Binance P2P"
    VERSION: str = "0.3.0"
    
    # Base de datos: por defecto SQLite local, parametrizable para PostgreSQL
    DATABASE_URL: str = f"sqlite:///{DEFAULT_SQLITE_PATH}"
    
    # Orígenes permitidos de CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    # Seguridad / API Keys (opcional en desarrollo, requerible en producción)
    API_SECRET_KEY: str = "insecure-dev-key-change-in-prod"
    REQUIRE_AUTH: bool = False

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
