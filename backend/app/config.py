import os
import sys
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


def get_user_data_dir() -> Path:
    """
    Retorna el directorio de datos estándar del usuario según el sistema operativo:
    - Linux: ~/.local/share/p2p-ledger
    - Windows: %APPDATA%/p2p-ledger
    - macOS: ~/Library/Application Support/p2p-ledger
    """
    if sys.platform == "win32":
        app_data = os.environ.get("APPDATA")
        base = Path(app_data) if app_data else Path.home() / "AppData" / "Roaming"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        xdg_data_home = os.environ.get("XDG_DATA_HOME")
        base = Path(xdg_data_home) if xdg_data_home else Path.home() / ".local" / "share"

    data_dir = base / "p2p-ledger"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


# Si ENVIRONMENT es "production" o si se ejecuta como binario standalone congelado (PyInstaller)
IS_FROZEN = getattr(sys, "frozen", False)
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "development").lower() == "production" or IS_FROZEN

if IS_PRODUCTION:
    DATA_DIR = get_user_data_dir()
else:
    DATA_DIR = BASE_DIR

DEFAULT_SQLITE_PATH = DATA_DIR / "p2p_reconciliation.db"


class Settings(BaseSettings):
    ENVIRONMENT: str = "production" if IS_PRODUCTION else "development"
    PROJECT_NAME: str = "P2P Ledger — Terminal de Conciliación P2P"
    VERSION: str = "0.3.7"
    
    # Directorio activo de almacenamiento persistente
    DATA_DIR: Path = DATA_DIR
    
    # Base de datos: por defecto SQLite local en DATA_DIR
    DATABASE_URL: str = f"sqlite:///{DEFAULT_SQLITE_PATH}"
    
    # Orígenes permitidos de CORS (incluye esquemas de Tauri)
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ]
    
    # Seguridad / API Keys (opcional en desarrollo, requerible en producción si se habilita)
    API_SECRET_KEY: str = "insecure-dev-key-change-in-prod"
    REQUIRE_AUTH: bool = False

    model_config = SettingsConfigDict(
        env_file=str(DATA_DIR / ".env") if (DATA_DIR / ".env").exists() else str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

