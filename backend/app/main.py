from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

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

# Asegurar que el esquema SQLite esté actualizado
Base.metadata.create_all(bind=engine)
ensure_bank_inventory_schema(engine)

app = FastAPI(
    title="P2P Ledger — Operaciones & Analítica Binance P2P",
    version="0.3.0",
    description="Dashboard de operaciones y arbitraje P2P conectado a Binance API + Inventario Bancario en Bs + Conciliador PDF",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


# Registrar routers modulares
app.include_router(health.router)
app.include_router(binance.router)
app.include_router(operations.router)
app.include_router(banks.router)
app.include_router(reconciliation.router)
app.include_router(backups.router)
