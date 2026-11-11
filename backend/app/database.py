from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import settings, BASE_DIR, DEFAULT_SQLITE_PATH

DB_PATH = DEFAULT_SQLITE_PATH
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine_args = {}
if is_sqlite:
    engine_args["connect_args"] = {"check_same_thread": False, "timeout": 30}
else:
    # Optimización de pool para PostgreSQL / MySQL en producción
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20
    engine_args["pool_pre_ping"] = True

engine = create_engine(settings.DATABASE_URL, **engine_args)

# Si es SQLite, activar modo WAL y optimización de concurrencia y caché
if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=10000")  # Esperar hasta 10s si otra transacción está escribiendo
        cursor.execute("PRAGMA cache_size=-64000")   # ~64MB cache en RAM
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
