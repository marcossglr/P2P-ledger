import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from ..database import engine, DB_PATH, BASE_DIR

router = APIRouter(prefix="/api/backups", tags=["Backups"])

BACKUPS_DIR = BASE_DIR / "backups"
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
MAX_BACKUP_SIZE_BYTES = 250 * 1024 * 1024   # 250 MB


class RestoreBackupPayload(BaseModel):
    filename: str


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
    safe_filename = Path(filename).name
    backup_file_path = BACKUPS_DIR / safe_filename

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de respaldo no encontrado.")

    return FileResponse(
        path=str(backup_file_path),
        filename=safe_filename,
        media_type="application/x-sqlite3",
    )


@router.post("/restore")
def restore_database_backup(payload: RestoreBackupPayload):
    """Restaura un respaldo existente sobre la base de datos actual."""
    safe_filename = Path(payload.filename).name
    backup_file_path = BACKUPS_DIR / safe_filename

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
            "message": f"Base de datos restaurada exitosamente desde {safe_filename}. Respaldo previo de seguridad guardado como {emergency_name}.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al restaurar respaldo: {str(e)}")


@router.post("/upload")
async def upload_database_backup(file: UploadFile = File(...)):
    """Permite subir un archivo de respaldo SQLite externo para almacenarlo en la lista de backups."""
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .db")

    safe_name = f"backup_uploaded_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{Path(file.filename).name}"
    target_path = BACKUPS_DIR / safe_name

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
    safe_filename = Path(filename).name
    backup_file_path = BACKUPS_DIR / safe_filename

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de respaldo no encontrado.")

    try:
        backup_file_path.unlink()
        return {"status": "deleted", "filename": safe_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando respaldo: {str(e)}")
