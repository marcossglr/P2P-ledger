from pathlib import Path
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .config import settings, BASE_DIR
from .auth import verify_auth
from .database import engine, Base
from .services.bank_inventory import ensure_bank_inventory_schema
from .routers import (
    health,
    binance,
    operations,
    banks,
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
    allow_origin_regex=r"^(tauri|http|https)://(localhost|127\.0\.0\.1)(:\d+)?$",
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
app.include_router(backups.router, dependencies=auth_dependency)

# Soporte para servir frontend compilado (Single-Port Local App)
FRONTEND_DIST_DIR = BASE_DIR.parent / "frontend" / "dist"

if FRONTEND_DIST_DIR.exists() and (FRONTEND_DIST_DIR / "index.html").exists():
    # Montar archivos estáticos (assets de js, css, fuentes)
    assets_dir = FRONTEND_DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Rutas bajo /api nunca deben caer al fallback de SPA
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Endpoint no encontrado.")
        # Si el archivo exacto existe en dist (ej. favicon, manifest, etc.)
        target_file = FRONTEND_DIST_DIR / full_path
        if full_path and target_file.is_file():
            return FileResponse(target_file)
        # De lo contrario retornar index.html (SPA fallback)
        return FileResponse(FRONTEND_DIST_DIR / "index.html")

