import shutil
import sqlite3
import re
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel, field_validator
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from ..database import engine, DB_PATH, BASE_DIR

router = APIRouter(prefix="/api/backups", tags=["Backups"])

BACKUPS_DIR = (BASE_DIR / "backups").resolve()
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
MAX_BACKUP_SIZE_BYTES = 250 * 1024 * 1024   # 250 MB

# Patrón estricto para nombres de archivo de backup (previene directory traversal)
SAFE_FILENAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.]+\.db$")


def validate_and_resolve_backup_path(filename: str) -> Path:
    """
    Valida contra Path Traversal garantizando que:
    1. El nombre cumpla una expresión regular segura sin barras o referencias relativas '../'.
    2. La ruta canónica resuelta pertenezca inequívocamente al directorio BACKUPS_DIR.
    """
    cleaned_name = Path(filename).name
    if not SAFE_FILENAME_PATTERN.match(cleaned_name) or ".." in filename:
        raise HTTPException(status_code=400, detail="Nombre de archivo de respaldo inválido o sospechoso.")
    
    target_path = (BACKUPS_DIR / cleaned_name).resolve()
    if not target_path.is_relative_to(BACKUPS_DIR):
        raise HTTPException(status_code=403, detail="Acceso denegado a la ruta especificada.")
    return target_path


class RestoreBackupPayload(BaseModel):
    filename: str

    @field_validator("filename")
    @classmethod
    def sanitize_filename(cls, v: str) -> str:
        name = Path(v).name
        if not SAFE_FILENAME_PATTERN.match(name) or ".." in v:
            raise ValueError("Nombre de archivo de respaldo no permitido.")
        return name


@router.get("")
def list_database_backups():
    """Retorna la lista de respaldos disponibles ordenados del más reciente al más antiguo."""
    backups = []
    if BACKUPS_DIR.exists():
        for entry in BACKUPS_DIR.glob("backup_*.db"):
            if entry.is_file():
                stat = entry.stat()
                backups.append({
                    "filename": entry.name,
                    "size_bytes": stat.st_size,
                    "size_kb": round(stat.st_size / 1024, 2),
                    "size_mb": round(stat.st_size / (1024 * 1024), 2),
                    "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                })
    backups.sort(key=lambda x: x["created_at"], reverse=True)

    db_size = 0
    if DB_PATH.exists():
        db_size = DB_PATH.stat().st_size

    return {
        "status": "success",
        "current_db_size_bytes": db_size,
        "current_db_size_kb": round(db_size / 1024, 2),
        "current_db_size_mb": round(db_size / (1024 * 1024), 2),
        "backups": backups,
    }


@router.post("/create")
def create_database_backup():
    """Genera un snapshot transaccionalmente seguro de la base de datos SQLite."""
    if not DB_PATH.exists():
        raise HTTPException(status_code=404, detail="La base de datos original no existe.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{timestamp}.db"
    backup_file_path = BACKUPS_DIR / backup_filename

    try:
        source_conn = sqlite3.connect(str(DB_PATH))
        dest_conn = sqlite3.connect(str(backup_file_path))
        with dest_conn:
            source_conn.backup(dest_conn)
        dest_conn.close()
        source_conn.close()

        stat = backup_file_path.stat()
        return {
            "status": "created",
            "filename": backup_filename,
            "size_bytes": stat.st_size,
            "size_kb": round(stat.st_size / 1024, 2),
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        }
    except Exception as e:
        if backup_file_path.exists():
            backup_file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Error creando respaldo: {str(e)}")


@router.get("/download/{filename}")
def download_database_backup(filename: str):
    """Permite descargar un archivo de respaldo .db específico."""
    backup_file_path = validate_and_resolve_backup_path(filename)

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de respaldo no encontrado.")

    return FileResponse(
        path=str(backup_file_path),
        filename=backup_file_path.name,
        media_type="application/x-sqlite3",
    )


@router.post("/restore")
def restore_database_backup(payload: RestoreBackupPayload):
    """Restaura un respaldo existente sobre la base de datos actual."""
    backup_file_path = validate_and_resolve_backup_path(payload.filename)

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="El respaldo especificado no existe.")

    try:
        emergency_name = f"backup_pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        emergency_path = BACKUPS_DIR / emergency_name
        if DB_PATH.exists():
            shutil.copy2(str(DB_PATH), str(emergency_path))

        engine.dispose()
        shutil.copy2(str(backup_file_path), str(DB_PATH))

        wal_file = Path(f"{DB_PATH}-wal")
        shm_file = Path(f"{DB_PATH}-shm")
        if wal_file.exists():
            try:
                wal_file.unlink()
            except Exception:
                pass
        if shm_file.exists():
            try:
                shm_file.unlink()
            except Exception:
                pass

        return {
            "status": "restored",
            "message": f"Base de datos restaurada exitosamente desde {backup_file_path.name}. Respaldo previo de seguridad guardado como {emergency_name}.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al restaurar respaldo: {str(e)}")


@router.post("/upload")
async def upload_database_backup(file: UploadFile = File(...)):
    """Permite subir un archivo de respaldo SQLite externo para almacenarlo en la lista de backups."""
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .db")

    raw_clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", Path(file.filename).name)
    safe_name = f"backup_uploaded_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{raw_clean_name}"
    target_path = validate_and_resolve_backup_path(safe_name)

    try:
        content = await file.read()
        if len(content) > MAX_BACKUP_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"El archivo de respaldo excede el límite máximo de {MAX_BACKUP_SIZE_BYTES // (1024 * 1024)} MB",
            )
        if not content.startswith(b"SQLite format 3"):
            raise HTTPException(status_code=400, detail="El archivo subido no es una base de datos SQLite válida.")

        with open(target_path, "wb") as f:
            f.write(content)

        stat = target_path.stat()
        return {
            "status": "uploaded",
            "filename": safe_name,
            "size_kb": round(stat.st_size / 1024, 2),
            "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando respaldo subido: {str(e)}")


@router.delete("/{filename}")
def delete_database_backup(filename: str):
    """Elimina un archivo de respaldo específico."""
    backup_file_path = validate_and_resolve_backup_path(filename)

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de respaldo no encontrado.")

    try:
        backup_file_path.unlink()
        return {"status": "deleted", "filename": backup_file_path.name}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando respaldo: {str(e)}")
