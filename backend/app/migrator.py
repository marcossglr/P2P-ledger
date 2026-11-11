import os
import sys
import shutil
import logging
from datetime import datetime
from pathlib import Path
from sqlalchemy import inspect
from alembic.config import Config
from alembic import command
from app.config import settings, BASE_DIR, DEFAULT_SQLITE_PATH
from app.database import engine

logger = logging.getLogger("p2p_ledger.migrations")


def run_auto_migrations() -> bool:
    """
    Ejecuta las migraciones pendientes de Alembic al arrancar el backend de escritorio.
    
    1. Si la base de datos ya tiene tablas previas (ej. creadas con Base.metadata.create_all)
       pero no tiene versión registrada en alembic_version, estampa la versión inicial (stamp).
    2. Si es SQLite y la base de datos existe, crea un snapshot de respaldo antes de migrar.
    3. Aplica 'alembic upgrade head'.
    4. Si la migración falla, restaura el respaldo para evitar corrupción de datos.
    """
    db_path = DEFAULT_SQLITE_PATH
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    backup_path = None

    # Localizar archivo alembic.ini
    ini_path = BASE_DIR / "alembic.ini"
    if not ini_path.exists():
        if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
            ini_path = Path(sys._MEIPASS) / "alembic.ini"

    if not ini_path.exists():
        logger.warning("alembic.ini no encontrado en %s. Omitiendo migración automática.", ini_path)
        return False

    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    
    alembic_dir = BASE_DIR / "alembic"
    if not alembic_dir.exists() and getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        alembic_dir = Path(sys._MEIPASS) / "alembic"
    if alembic_dir.exists():
        alembic_cfg.set_main_option("script_location", str(alembic_dir))

    # Detectar si la DB existente tiene tablas pero no versión registrada de Alembic
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        if "bank_accounts" in table_names:
            # Comprobar si alembic_version tiene algún registro
            has_version = False
            if "alembic_version" in table_names:
                with engine.connect() as conn:
                    result = conn.exec_driver_sql("SELECT version_num FROM alembic_version LIMIT 1").fetchall()
                    if result:
                        has_version = True
            if not has_version:
                logger.info("Base de datos existente sin versión Alembic detectada. Estampando versión inicial...")
                command.stamp(alembic_cfg, "993dc77b3d17")
    except Exception as inspect_err:
        logger.warning("Advertencia al inspeccionar esquema existente: %s", inspect_err)

    if is_sqlite and db_path.exists() and db_path.stat().st_size > 0:
        backups_dir = settings.DATA_DIR / "backups"
        backups_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backups_dir / f"p2p_pre_migration_{timestamp}.db"
        try:
            shutil.copy2(db_path, backup_path)
            logger.info("Respaldo preventivo de base de datos creado en: %s", backup_path)
        except Exception as err:
            logger.warning("No se pudo crear respaldo preventivo pre-migración: %s", err)

    try:
        logger.info("Verificando y aplicando migraciones de base de datos...")
        command.upgrade(alembic_cfg, "head")
        logger.info("Migraciones aplicadas exitosamente.")
        return True
    except Exception as err:
        logger.error("Error al aplicar migraciones automáticas: %s", err)
        if backup_path and backup_path.exists() and is_sqlite and db_path.exists():
            try:
                shutil.copy2(backup_path, db_path)
                logger.info("Base de datos restaurada exitosamente desde respaldo de seguridad.")
            except Exception as restore_err:
                logger.critical("Error al restaurar respaldo preventivo: %s", restore_err)
        return False
