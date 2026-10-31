from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .auth import verify_auth
from .database import engine, Base
from .services.bank_inventory import ensure_bank_inventory_schema
from .routers import (
    health,
    binance,
    operations,
    banks,
    reconciliation,
    backups,
)

# Inicialización del esquema:
# En desarrollo mantiene compatibilidad garantizada. En producción se ejecutan migraciones con Alembic.
Base.metadata.create_all(bind=engine)
ensure_bank_inventory_schema(engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Dashboard de operaciones y arbitraje P2P conectado a Binance API + Inventario Bancario en Bs + Conciliador PDF",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Inyecta cabeceras HTTP de protección contra Clickjacking, MIME sniffing y filtrado de referrer."""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


# Dependencia global de autenticación (activa sólo si REQUIRE_AUTH=True en .env / entorno)
auth_dependency = [Depends(verify_auth)]

# Health check permanece público para monitor de uptime / probes
app.include_router(health.router)

# Routers protegidos según configuración
app.include_router(binance.router, dependencies=auth_dependency)
app.include_router(operations.router, dependencies=auth_dependency)
app.include_router(banks.router, dependencies=auth_dependency)
app.include_router(reconciliation.router, dependencies=auth_dependency)
app.include_router(backups.router, dependencies=auth_dependency)
