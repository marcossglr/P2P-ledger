import os
import shutil
import sqlite3
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from .database import engine, Base, get_db, DB_PATH, BASE_DIR
from .models import UploadBatch, BinanceOrder, BankTransaction, BankAccount, BankBalanceAdjustment
from .services.parsers import parse_binance_csv, parse_bank_pdf
from .services.binance_api import (
    get_saved_credentials,
    save_credentials,
    clear_credentials,
    fetch_c2c_orders_range,
    fetch_funding_asset_balance,
    save_cached_funding_asset,
    get_cached_funding_asset,
    fetch_c2c_user_ads,
    get_cached_user_ads,
)
from .services.binance_p2p_public import (
    get_p2p_public_config,
    save_p2p_public_config,
    reset_p2p_public_config,
    fetch_p2p_market_snapshot,
    test_p2p_public_connection,
)
from .services.analytics import compute_operations_analytics
from .services.reconciler import run_reconciliation, export_operations_excel
from .services.venezuela_banks import VENEZUELA_BANKS_CATALOG, find_bank_in_catalog
from .services.bank_inventory import (
    ensure_bank_inventory_schema,
    ensure_bank_accounts_from_orders,
    sync_bank_accounts_from_binance,
    compute_bank_inventory_summary,
    parse_order_timestamp_ms,
    get_latest_ves_order_timestamp_ms,
    resolve_order_bank_account,
    is_pago_movil_method,
    resolve_order_payment_channel,
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


class CredentialsPayload(BaseModel):
    api_key: str
    api_secret: str


class SyncPayload(BaseModel):
    force_full_90d: bool = False
    force_full_180d: bool = False
    days: Optional[int] = None
    api_key: Optional[str] = None
    api_secret: Optional[str] = None


class ManualMatchPayload(BaseModel):
    order_id: int
    bank_id: int


class BankAccountPayload(BaseModel):
    name: str
    account_alias: Optional[str] = ""
    match_keywords: Optional[str] = ""
    is_default: bool = False
    apply_buy_fee: bool = True
    pago_movil_fee_pct: float = 0.3
    transfer_fee_pct: float = 0.0
    initial_balance: Optional[float] = None


class BankReconcilePayload(BaseModel):
    account_id: int
    mode: str = "CUADRE_CONSOLIDADO"  # "CUADRE_CONSOLIDADO", "SALDO_INICIAL_DIA", "SALDO_INICIAL_HISTORICO", "MOVIMIENTO_MANUAL"
    amount: float
    note: Optional[str] = ""


class BulkBankReconcileItem(BaseModel):
    account_id: int
    real_balance: float


class BulkBankReconcilePayload(BaseModel):
    items: List[BulkBankReconcileItem]
    mode: str = "CUADRE_CONSOLIDADO"
    note: Optional[str] = ""


class AssignOrderBankPayload(BaseModel):
    order_id: int
    bank_account_id: Optional[int] = None


class UpdatePaymentChannelPayload(BaseModel):
    order_id: int
    payment_channel: str  # "PAGO_MOVIL" | "TRANSFERENCIA"


class FundingManualPayload(BaseModel):
    free: float = 0.0
    locked: float = 0.0


class P2PPublicConfigPayload(BaseModel):
    enabled: Optional[bool] = None
    asset: Optional[str] = None
    fiat: Optional[str] = None
    pay_types: Optional[List[str]] = None
    trans_amount: Optional[float] = None
    rows: Optional[int] = None
    pages: Optional[int] = None
    publisher_type: Optional[str] = None
    top_n: Optional[int] = None
    refresh_interval_seconds: Optional[int] = None


def upsert_binance_orders(db: Session, records: list, batch_id: Optional[int] = None, default_source: str = "API") -> dict:
    """Inserta o actualiza órdenes de Binance P2P en bloque sin duplicar por order_number."""
    new_count = 0
    updated_count = 0
    existing_map = {
        o.order_number: o
        for o in db.query(BinanceOrder).all()
        if o.order_number
    }

    for rec in records:
        order_no = str(rec.get("order_number", "")).strip()
        if not order_no:
            continue
        existing = existing_map.get(order_no)
        rec_status = str(rec.get("order_status") or "COMPLETED").upper()
        pay_method_str = rec.get("pay_method", "Transferencia")
        if existing:
            existing.adv_no = rec.get("adv_no", existing.adv_no or "")
            existing.order_type = rec.get("order_type", existing.order_type)
            existing.fiat_currency = rec.get("fiat_currency", existing.fiat_currency)
            existing.fiat_amount = float(rec.get("fiat_amount", existing.fiat_amount))
            existing.crypto_amount = float(rec.get("crypto_amount", existing.crypto_amount))
            existing.unit_price = float(rec.get("unit_price", existing.unit_price))
            existing.commission_usdt = float(rec.get("commission_usdt", existing.commission_usdt or 0.0))
            existing.pay_method = rec.get("pay_method", existing.pay_method)
            existing.counterparty = rec.get("counterparty", existing.counterparty)
            existing.order_date = rec.get("order_date", existing.order_date)
            existing.order_status = rec_status
            existing.create_timestamp = int(rec.get("create_timestamp", existing.create_timestamp or 0))
            if rec.get("payment_channel") and not getattr(existing, "payment_channel_manual", 0):
                existing.payment_channel = rec.get("payment_channel")
            updated_count += 1
        else:
            new_obj = BinanceOrder(
                batch_id=batch_id,
                order_number=order_no,
                adv_no=rec.get("adv_no", ""),
                order_type=rec.get("order_type", "COMPRA"),
                asset=rec.get("asset", "USDT"),
                fiat_currency=rec.get("fiat_currency", "VES"),
                fiat_amount=float(rec.get("fiat_amount", 0.0)),
                crypto_amount=float(rec.get("crypto_amount", 0.0)),
                unit_price=float(rec.get("unit_price", 0.0)),
                commission_usdt=float(rec.get("commission_usdt", 0.0)),
                pay_method=pay_method_str,
                counterparty=rec.get("counterparty", "-"),
                create_timestamp=int(rec.get("create_timestamp", 0)),
                order_date=rec.get("order_date", "-"),
                order_status=rec_status,
                source=rec.get("source", default_source),
                payment_channel=rec.get("payment_channel"),
            )
            db.add(new_obj)
            existing_map[order_no] = new_obj
            new_count += 1
    db.commit()
    return {"new_count": new_count, "updated_count": updated_count, "total": new_count + updated_count}


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    creds = get_saved_credentials()
    has_creds = bool(creds["api_key"] and creds["api_secret"])
    orders_count = db.query(BinanceOrder).count()
    completed_count = (
        db.query(BinanceOrder)
        .filter((BinanceOrder.order_status == "COMPLETED") | (BinanceOrder.order_status.is_(None)))
        .count()
    )
    cancelled_count = (
        db.query(BinanceOrder)
        .filter(BinanceOrder.order_status == "CANCELLED")
        .count()
    )
    bank_count = db.query(BankTransaction).count()
    last_api_batch = (
        db.query(UploadBatch)
        .filter(UploadBatch.source_type == "BINANCE_API")
        .order_by(UploadBatch.id.desc())
        .first()
    )
    return {
        "status": "ok",
        "database": "sqlite_connected",
        "binance_api_configured": has_creds,
        "masked_api_key": f"{creds['api_key'][:6]}...{creds['api_key'][-4:]}" if len(creds["api_key"]) > 10 else "",
        "stored_binance_orders": orders_count,
        "stored_completed_orders": completed_count,
        "stored_cancelled_orders": cancelled_count,
        "stored_bank_transactions": bank_count,
        "last_synced_at": last_api_batch.created_at.strftime("%H:%M:%S") if (last_api_batch and last_api_batch.created_at) else None,
    }


@app.get("/api/binance/config")
def get_binance_config():
    creds = get_saved_credentials()
    has_creds = bool(creds["api_key"] and creds["api_secret"])
    return {
        "configured": has_creds,
        "masked_api_key": f"{creds['api_key'][:6]}••••{creds['api_key'][-4:]}" if len(creds["api_key"]) > 10 else "",
    }


@app.post("/api/binance/config")
def set_binance_config(payload: CredentialsPayload):
    if not payload.api_key.strip() or not payload.api_secret.strip():
        raise HTTPException(status_code=400, detail="Debes proporcionar tanto API Key como Secret Key.")
    save_credentials(payload.api_key, payload.api_secret)
    creds = get_saved_credentials()
    return {
        "status": "saved",
        "configured": True,
        "masked_api_key": f"{creds['api_key'][:6]}••••{creds['api_key'][-4:]}" if len(creds["api_key"]) > 10 else "Configurada",
    }


@app.delete("/api/binance/config")
def delete_binance_config():
    clear_credentials()
    return {"status": "deleted", "configured": False, "masked_api_key": ""}


@app.get("/api/binance/funding-wallet")
def get_binance_funding_wallet():
    return fetch_funding_asset_balance(asset="USDT")


@app.post("/api/binance/funding-wallet/manual")
def set_binance_funding_wallet_manual(payload: FundingManualPayload):
    free_v = max(0.0, float(payload.free or 0.0))
    locked_v = max(0.0, float(payload.locked or 0.0))
    data = {
        "asset": "USDT",
        "free": round(free_v, 2),
        "locked": round(locked_v, 2),
        "total": round(free_v + locked_v, 2),
        "source": "MANUAL",
        "updated_at": datetime.now().isoformat(),
    }
    save_cached_funding_asset(data)
    return data


@app.get("/api/binance/my-ads")
def get_my_binance_ads():
    """Retorna los anuncios publicados por el usuario en Binance P2P."""
    return fetch_c2c_user_ads()


# ---------------------------------------------------------------------------
# API pública P2P de Binance (sin credenciales) — Estadísticas del mercado
# ---------------------------------------------------------------------------

@app.get("/api/binance/p2p-public/config")
def get_p2p_public_market_config():
    return get_p2p_public_config()


@app.post("/api/binance/p2p-public/config")
def set_p2p_public_market_config(payload: P2PPublicConfigPayload):
    return save_p2p_public_config(payload.model_dump(exclude_unset=True))


@app.delete("/api/binance/p2p-public/config")
def delete_p2p_public_market_config():
    return reset_p2p_public_config()


@app.post("/api/binance/p2p-public/test")
def test_p2p_public_market_connection(payload: Optional[P2PPublicConfigPayload] = None):
    """Prueba la conexión con la configuración guardada (o con overrides temporales sin guardarlos)."""
    cfg = get_p2p_public_config()
    if payload:
        cfg.update(payload.model_dump(exclude_unset=True))
    return test_p2p_public_connection(cfg)


@app.get("/api/binance/p2p-public/market-stats")
def get_p2p_public_market_stats(
    asset: Optional[str] = Query(None),
    fiat: Optional[str] = Query(None),
    bank: Optional[str] = Query(None),
    amount: Optional[float] = Query(None),
    include_ads: bool = Query(True),
    force: bool = Query(False),
):
    cfg = get_p2p_public_config()
    if not cfg.get("enabled"):
        raise HTTPException(status_code=409, detail="La API pública P2P está deshabilitada en Ajustes.")

    # Overrides dinámicos provenientes de los filtros de la interfaz
    if asset and isinstance(asset, str):
        cfg["asset"] = asset.upper().strip()
    if fiat and isinstance(fiat, str):
        cfg["fiat"] = fiat.upper().strip()
    if bank is not None and isinstance(bank, str):
        bank_clean = bank.strip()
        if bank_clean and bank_clean.upper() != "ALL":
            cfg["pay_types"] = [bank_clean]
        else:
            cfg["pay_types"] = []
    if amount is not None and isinstance(amount, (int, float)) and amount > 0:
        cfg["trans_amount"] = float(amount)

    try:
        snap = fetch_p2p_market_snapshot(cfg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not include_ads:
        snap["buy"].pop("ads", None)
        snap["sell"].pop("ads", None)
    return snap


@app.post("/api/binance/sync")
def sync_binance_orders(payload: SyncPayload, db: Session = Depends(get_db)):
    is_new_key = bool(payload.api_key and payload.api_secret)
    if is_new_key:
        save_credentials(payload.api_key, payload.api_secret)

    now = datetime.now()
    end_dt = now
    end_ms = int(end_dt.timestamp() * 1000)

    days_back = max(1, min(int(payload.days or 180), 180))
    # Restamos 1 hora de margen al tope de 180 días para evitar rechazos por latencia en el borde de 6 meses de Binance
    full_range_dt = (now - timedelta(days=days_back)) + timedelta(hours=1)
    full_range_ms = int(full_range_dt.timestamp() * 1000)

    # Buscar el timestamp más reciente de una orden real sincronizada por API
    latest_ts = (
        db.query(func.max(BinanceOrder.create_timestamp))
        .filter(BinanceOrder.source == "API")
        .scalar()
    )
    has_full_180d_all = (
        db.query(UploadBatch)
        .filter(UploadBatch.source_type == "BINANCE_API", UploadBatch.filename.like("API FULL_180D_ALL%"))
        .first()
        is not None
    )

    if (
        payload.force_full_180d
        or payload.force_full_90d
        or payload.days
        or is_new_key
        or not latest_ts
        or latest_ts <= 0
        or not has_full_180d_all
    ):
        sync_mode = f"FULL_{days_back}D_ALL"
        start_ms = full_range_ms
        start_dt = full_range_dt
    else:
        sync_mode = "INCREMENTAL"
        # Solapamiento de 12 horas hacia atrás desde la última orden para capturar apelaciones liberadas
        overlap_ms = 12 * 3600 * 1000
        start_ms = max(full_range_ms, int(latest_ts) - overlap_ms)
        start_dt = datetime.fromtimestamp(start_ms / 1000.0)

    try:
        records = fetch_c2c_orders_range(start_ms, end_ms)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error inesperado al sincronizar con Binance: {str(e)}")

    batch = UploadBatch(
        source_type="BINANCE_API",
        filename=f"API {sync_mode} ({start_dt.strftime('%Y-%m-%d %H:%M')} a {end_dt.strftime('%Y-%m-%d %H:%M')})",
        total_rows=len(records),
        created_at=now,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    stats = upsert_binance_orders(db, records, batch_id=batch.id, default_source="API")

    # Sincronizar los bancos activos según los métodos de pago de la cuenta de Binance del usuario
    # sin alterar ni configurar automáticamente los saldos bancarios (por defecto en 0,00 Bs)
    try:
        sync_bank_accounts_from_binance(
            db, api_key=payload.api_key, api_secret=payload.api_secret
        )
    except Exception:
        pass

    return {
        "status": "synced",
        "sync_mode": sync_mode,
        "fetched_count": len(records),
        "new_orders": stats["new_count"],
        "updated_orders": stats["updated_count"],
        "last_synced_at": datetime.now().strftime("%H:%M:%S"),
        "period": f"{start_dt.strftime('%Y-%m-%d %H:%M')} → {end_dt.strftime('%Y-%m-%d %H:%M')}",
    }


@app.post("/api/binance/demo-seed")
def seed_demo_operations(db: Session = Depends(get_db)):
    """
    Genera un conjunto realista de operaciones de arbitraje P2P (Compras y Ventas de USDT)
    incluyendo operaciones del día de HOY y de los últimos 4 días para explorar el Dashboard de Hoy y el Histórico.
    """
    now = datetime.now()
    demo_rows = [
        # Día -4
        {"order_number": "2026101500112201", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 500.0, "unit_price": 42.10, "fiat_amount": 21050.0, "commission_usdt": 0.50, "pay_method": "Banesco Pago Móvil", "counterparty": "CryptoTraderVE", "days_ago": 4, "hour": 10, "minute": 15},
        {"order_number": "2026101500112202", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 300.0, "unit_price": 42.95, "fiat_amount": 12885.0, "commission_usdt": 0.30, "pay_method": "Banesco Transferencia", "counterparty": "InversionesCaracas", "days_ago": 4, "hour": 14, "minute": 20},
        {"order_number": "2026101500112203", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 200.0, "unit_price": 43.00, "fiat_amount": 8600.0,  "commission_usdt": 0.20, "pay_method": "Mercantil", "counterparty": "JuanP2P_Fast", "days_ago": 4, "hour": 17, "minute": 40},
        # Día -3
        {"order_number": "2026101600223301", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 800.0, "unit_price": 42.30, "fiat_amount": 33840.0, "commission_usdt": 0.80, "pay_method": "Banesco Transferencia", "counterparty": "CambiosOrinoco", "days_ago": 3, "hour": 9, "minute": 10},
        {"order_number": "2026101600223302", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 450.0, "unit_price": 43.20, "fiat_amount": 19440.0, "commission_usdt": 0.45, "pay_method": "Banesco Pago Móvil", "counterparty": "MariaExchanges", "days_ago": 3, "hour": 13, "minute": 30},
        {"order_number": "2026101600223303", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 350.0, "unit_price": 43.25, "fiat_amount": 15137.5, "commission_usdt": 0.35, "pay_method": "Banco Provincial", "counterparty": "AndesCapital", "days_ago": 3, "hour": 18, "minute": 5},
        # Día -2
        {"order_number": "2026101700334401", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 600.0, "unit_price": 42.50, "fiat_amount": 25500.0, "commission_usdt": 0.60, "pay_method": "Mercantil", "counterparty": "LiquidezTotal", "days_ago": 2, "hour": 11, "minute": 12},
        {"order_number": "2026101700334402", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 400.0, "unit_price": 42.45, "fiat_amount": 16980.0, "commission_usdt": 0.40, "pay_method": "Banesco Pago Móvil", "counterparty": "FastUsdtExpress", "days_ago": 2, "hour": 12, "minute": 45},
        {"order_number": "2026101700334403", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 950.0, "unit_price": 43.40, "fiat_amount": 41230.0, "commission_usdt": 0.95, "pay_method": "Banesco Transferencia", "counterparty": "ImportadoraGlobal", "days_ago": 2, "hour": 16, "minute": 50},
        # Día -1
        {"order_number": "2026101800445501", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 1200.0, "unit_price": 42.60, "fiat_amount": 51120.0, "commission_usdt": 1.20, "pay_method": "Banesco Transferencia", "counterparty": "TesoreriaDigital", "days_ago": 1, "hour": 10, "minute": 20},
        {"order_number": "2026101800445502", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 700.0, "unit_price": 43.55, "fiat_amount": 30485.0, "commission_usdt": 0.70, "pay_method": "Banesco Pago Móvil", "counterparty": "ComercializadoraSur", "days_ago": 1, "hour": 15, "minute": 10},
        {"order_number": "2026101800445503", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 500.0, "unit_price": 43.60, "fiat_amount": 21800.0, "commission_usdt": 0.50, "pay_method": "Banco Provincial", "counterparty": "GrupoFinanciero77", "days_ago": 1, "hour": 19, "minute": 35},
        # HOY (Día 0 - En tiempo real)
        {"order_number": "2026101900556601", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 750.0, "unit_price": 42.80, "fiat_amount": 32100.0, "commission_usdt": 0.75, "pay_method": "Banesco Pago Móvil", "counterparty": "DistribuidoraAvila", "days_ago": 0, "hour": 9, "minute": 18},
        {"order_number": "2026101900556602", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 450.0, "unit_price": 42.85, "fiat_amount": 19282.5, "commission_usdt": 0.45, "pay_method": "Mercantil", "counterparty": "FintechExpressVE", "days_ago": 0, "hour": 10, "minute": 42},
        {"order_number": "2026101900556603", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 600.0, "unit_price": 43.75, "fiat_amount": 26250.0, "commission_usdt": 0.60, "pay_method": "Banesco Transferencia", "counterparty": "AgroInsumosLara", "days_ago": 0, "hour": 12, "minute": 15},
        {"order_number": "2026101900556604", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 550.0, "unit_price": 43.80, "fiat_amount": 24090.0, "commission_usdt": 0.55, "pay_method": "Banesco Pago Móvil", "counterparty": "BodegonDelEste", "days_ago": 0, "hour": 14, "minute": 5},
    ]

    prepared = []
    for idx, item in enumerate(demo_rows, start=1):
        dt = (now - timedelta(days=item["days_ago"])).replace(
            hour=item["hour"], minute=item.get("minute", 25), second=0
        )
        adv_prefix = "114088" if item["order_type"] == "COMPRA" else "114099"
        prepared.append({
            **item,
            "adv_no": f"{adv_prefix}{idx:04d}",
            "asset": "USDT",
            "create_timestamp": int(dt.timestamp() * 1000),
            "order_date": dt.strftime("%Y-%m-%d %H:%M:%S"),
            "order_status": "COMPLETED",
            "source": "DEMO",
        })

    count = upsert_binance_orders(db, prepared, default_source="DEMO")

    # En modo demo, asegurar las cuentas bancarias de los métodos de pago de prueba con cuadre base en 0,00 Bs
    # fijando el corte al inicio del día de hoy (00:00) para que solo las órdenes de hoy sumen/resten sobre 0,00 Bs
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_today_ms = int(start_of_today.timestamp() * 1000) - 1
    demo_banks = [
        ("Banesco", "Cuenta Banesco (Transferencia / Pago Móvil)", "banesco", 1),
        ("Mercantil", "Cuenta Mercantil (Transferencia / Pago Móvil)", "mercantil", 0),
        ("Banco Provincial", "Cuenta BBVA Provincial", "provincial,bbva,bancoprovincial", 0),
    ]
    existing_accs = {a.name.lower(): a for a in db.query(BankAccount).all()}
    for b_name, b_alias, b_kw, b_def in demo_banks:
        if b_name.lower() not in existing_accs:
            db.add(
                BankAccount(
                    name=b_name,
                    account_alias=b_alias,
                    fiat_currency="VES",
                    match_keywords=b_kw,
                    is_default=b_def,
                    apply_buy_fee=1,
                    pago_movil_fee_pct=0.3,
                    transfer_fee_pct=0.0,
                    anchor_balance=0.0,
                    anchor_timestamp=start_today_ms,
                    anchor_date_label="Cuadre por Defecto (0,00 Bs)",
                    manual_delta_bs=0.0,
                )
            )
    db.commit()

    return {"status": "demo_seeded", "inserted_or_updated": count}


@app.delete("/api/operations/clear")
def clear_operations(only_demo: bool = Query(False), db: Session = Depends(get_db)):
    if only_demo:
        deleted = db.query(BinanceOrder).filter(BinanceOrder.source == "DEMO").delete()
        if db.query(BinanceOrder).count() == 0:
            db.query(BankBalanceAdjustment).delete()
            db.query(BankAccount).delete()
        db.commit()
        return {"status": "cleared_demo", "deleted_rows": deleted}

    deleted = db.query(BinanceOrder).delete()
    db.query(UploadBatch).delete()
    db.query(BankTransaction).delete()
    db.query(BankBalanceAdjustment).delete()
    db.query(BankAccount).delete()
    db.commit()
    return {"status": "cleared_all", "deleted_rows": deleted}


@app.get("/api/operations")
def get_operations_dashboard(
    order_type: Optional[str] = Query(None),
    order_status: Optional[str] = Query(None),
    asset: Optional[str] = Query(None),
    fiat_currency: Optional[str] = Query("VES"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    only_today: bool = Query(False),
    search: Optional[str] = Query(None),
    bank_fee_pct: float = Query(0.0),
    db: Session = Depends(get_db),
):
    today_str = datetime.now().strftime("%Y-%m-%d")
    total_stored_orders = db.query(BinanceOrder).count()
    has_demo_orders = db.query(BinanceOrder).filter(BinanceOrder.source == "DEMO").count() > 0

    target_fiat = (fiat_currency or "VES").upper().strip()

    # Consulta base para el período filtrada por la moneda Fiat objetivo
    base_period_q = db.query(BinanceOrder).filter(BinanceOrder.fiat_currency == target_fiat)

    if only_today:
        base_period_q = base_period_q.filter(BinanceOrder.order_date >= f"{today_str} 00:00:00")
        base_period_q = base_period_q.filter(BinanceOrder.order_date <= f"{today_str} 23:59:59")
    else:
        if start_date:
            base_period_q = base_period_q.filter(BinanceOrder.order_date >= f"{start_date} 00:00:00")
        if end_date:
            base_period_q = base_period_q.filter(BinanceOrder.order_date <= f"{end_date} 23:59:59")

    # Las tarjetas de analytics reflejan la totalidad de la jornada/período (compras + ventas) filtradas por criptoactivo objetivo
    period_orders_all = base_period_q.order_by(BinanceOrder.order_date.desc()).all()
    analytics = compute_operations_analytics(
        period_orders_all,
        bank_fee_rate_pct=bank_fee_pct,
        accounts=db.query(BankAccount).order_by(BankAccount.id.asc()).all(),
        target_asset=asset if asset and asset != "ALL" else None,
    )

    # Filtrar las órdenes para la tabla según los filtros de tabla específicos
    q = base_period_q
    if asset and asset != "ALL":
        q = q.filter(BinanceOrder.asset == asset)

    if order_type and order_type in ["COMPRA", "VENTA"]:
        q = q.filter(BinanceOrder.order_type == order_type)

    if search:
        like_str = f"%{search.strip()}%"
        q = q.filter(
            (BinanceOrder.order_number.ilike(like_str))
            | (BinanceOrder.counterparty.ilike(like_str))
            | (BinanceOrder.pay_method.ilike(like_str))
        )

    _accounts_for_channel = db.query(BankAccount).order_by(BankAccount.id.asc()).all()
    period_orders = q.order_by(BinanceOrder.order_date.desc()).all()

    # Filtrar la lista visual de la tabla según el estado seleccionado ("COMPLETED", "CANCELLED", "IN_PROGRESS" o "ALL")
    status_filter = (order_status or "ALL").upper()
    if status_filter == "COMPLETED":
        orders = [
            o for o in period_orders if (getattr(o, "order_status", None) or "COMPLETED") == "COMPLETED"
        ]
    elif status_filter == "CANCELLED":
        orders = [
            o for o in period_orders if getattr(o, "order_status", None) == "CANCELLED"
        ]
    elif status_filter == "IN_PROGRESS":
        orders = [
            o for o in period_orders if getattr(o, "order_status", None) == "IN_PROGRESS"
        ]
    else:
        orders = period_orders

    bank_inventory = compute_bank_inventory_summary(db)
    funding_wallet = fetch_funding_asset_balance(asset="USDT")
    if has_demo_orders and (funding_wallet.get("source") in ["NONE", "UNAVAILABLE"]):
        funding_wallet = {
            "asset": "USDT",
            "free": 1850.0,
            "locked": 250.0,
            "total": 2100.0,
            "source": "DEMO",
            "updated_at": datetime.now().isoformat(),
        }

    # Criptoactivos estándar oficiales de Binance P2P combinados con los que el usuario tenga en BD
    STANDARD_CRYPTO_ASSETS = ["USDT", "BTC", "USDC", "ETH", "BNB", "FDUSD"]
    db_crypto_assets = [r[0] for r in db.query(BinanceOrder.asset).distinct().all() if r[0]]
    combined_assets = list(dict.fromkeys(db_crypto_assets + STANDARD_CRYPTO_ASSETS))

    # Mercados Fiat estándar habituales combinados con los de las órdenes y cuentas del usuario
    STANDARD_FIATS = ["VES", "COP", "USD", "ARS", "BRL"]
    db_fiats = [r[0] for r in db.query(BinanceOrder.fiat_currency).distinct().all() if r[0]]
    combined_fiats = list(dict.fromkeys(db_fiats + STANDARD_FIATS))

    # Par principal detectado según el mayor volumen u órdenes del usuario
    detected_top_asset = db_crypto_assets[0] if db_crypto_assets else "USDT"
    detected_top_fiat = db_fiats[0] if db_fiats else "VES"

    my_ads = fetch_c2c_user_ads()

    return {
        "server_today": today_str,
        "total_stored_orders": total_stored_orders,
        "has_demo_orders": has_demo_orders,
        "analytics": analytics,
        "bank_inventory": bank_inventory,
        "funding_wallet": funding_wallet,
        "my_ads": my_ads,
        "default_asset": detected_top_asset,
        "default_fiat": detected_top_fiat,
        "available_fiats": combined_fiats,
        "available_assets": combined_assets,
        "orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "adv_no": o.adv_no or "",
                "order_type": o.order_type,
                "asset": o.asset,
                "fiat_currency": o.fiat_currency,
                "fiat_amount": o.fiat_amount,
                "crypto_amount": o.crypto_amount,
                "unit_price": o.unit_price,
                "commission_usdt": o.commission_usdt,
                "pay_method": o.pay_method,
                "counterparty": o.counterparty,
                "reference_note": o.reference_note or "",
                "create_timestamp": o.create_timestamp or 0,
                "order_date": o.order_date,
                "order_status": getattr(o, "order_status", None) or "COMPLETED",
                "source": o.source,
                "status": o.status,
                "bank_account_id": o.bank_account_id,
                "payment_channel": resolve_order_payment_channel(
                    o, resolve_order_bank_account(o, _accounts_for_channel)
                ),
            }
            for o in orders
        ],
    }


@app.post("/api/operations/payment-channel")
def update_order_payment_channel(
    payload: UpdatePaymentChannelPayload, db: Session = Depends(get_db)
):
    """Permite alternar si una orden de COMPRA fue por PAGO_MOVIL (con comisión) o TRANSFERENCIA al mismo banco (0% comisión)."""
    order = db.query(BinanceOrder).filter(BinanceOrder.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    ch = (payload.payment_channel or "").strip().upper()
    if ch not in ("PAGO_MOVIL", "TRANSFERENCIA"):
        raise HTTPException(
            status_code=400,
            detail="El canal de pago debe ser 'PAGO_MOVIL' o 'TRANSFERENCIA'.",
        )

    order.payment_channel = ch
    order.payment_channel_manual = 1
    db.commit()
    return {
        "status": "updated",
        "order_id": order.id,
        "payment_channel": order.payment_channel,
        "bank_inventory": compute_bank_inventory_summary(db),
    }


@app.get("/api/operations/export")
def export_operations(
    order_type: Optional[str] = Query(None),
    order_status: Optional[str] = Query(None),
    fiat_currency: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    only_today: bool = Query(False),
    bank_fee_pct: float = Query(0.0),
    db: Session = Depends(get_db),
):
    today_str = datetime.now().strftime("%Y-%m-%d")
    q = db.query(BinanceOrder)
    if order_type and order_type in ["COMPRA", "VENTA"]:
        q = q.filter(BinanceOrder.order_type == order_type)
    if fiat_currency and fiat_currency != "ALL":
        q = q.filter(BinanceOrder.fiat_currency == fiat_currency)
    if only_today:
        q = q.filter(BinanceOrder.order_date >= f"{today_str} 00:00:00")
        q = q.filter(BinanceOrder.order_date <= f"{today_str} 23:59:59")
    else:
        if start_date:
            q = q.filter(BinanceOrder.order_date >= f"{start_date} 00:00:00")
        if end_date:
            q = q.filter(BinanceOrder.order_date <= f"{end_date} 23:59:59")

    _accounts_for_channel = db.query(BankAccount).order_by(BankAccount.id.asc()).all()
    period_orders = q.order_by(BinanceOrder.order_date.desc()).all()
    analytics = compute_operations_analytics(
        period_orders,
        bank_fee_rate_pct=bank_fee_pct,
        accounts=db.query(BankAccount).order_by(BankAccount.id.asc()).all(),
    )

    status_filter = (order_status or "ALL").upper()
    if status_filter == "COMPLETED":
        orders = [
            o for o in period_orders if (getattr(o, "order_status", None) or "COMPLETED") == "COMPLETED"
        ]
    elif status_filter == "CANCELLED":
        orders = [
            o for o in period_orders if (getattr(o, "order_status", None) or "COMPLETED") != "COMPLETED"
        ]
    else:
        orders = period_orders

    xlsx_bytes = export_operations_excel(orders, analytics)

    prefix = f"Operaciones_Hoy_{today_str}" if only_today else f"Historico_P2P_{datetime.now().strftime('%Y%m%d_%H%M')}"
    filename = f"Reporte_{prefix}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# Límites de tamaño para subidas de archivos (protección contra DoS de memoria y disco)
MAX_CSV_SIZE_BYTES = 25 * 1024 * 1024       # 25 MB
MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024       # 50 MB
MAX_BACKUP_SIZE_BYTES = 250 * 1024 * 1024   # 250 MB


@app.post("/api/upload/binance-csv")
async def upload_binance_csv(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .csv")

    content = await file.read()
    if len(content) > MAX_CSV_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo excede el tamaño máximo permitido de {MAX_CSV_SIZE_BYTES // (1024 * 1024)} MB",
        )
    try:
        parsed = parse_binance_csv(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Error al procesar CSV: {str(exc)}")

    batch = UploadBatch(
        source_type="BINANCE_CSV",
        filename=file.filename,
        total_rows=parsed["valid_rows"],
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    upsert_binance_orders(db, parsed["records"], batch_id=batch.id, default_source="CSV")

    return {
        "batch_id": batch.id,
        "filename": parsed["filename"],
        "total_rows_raw": parsed["total_rows_raw"],
        "valid_rows": parsed["valid_rows"],
        "columns_detected": parsed["columns_detected"],
        "preview": parsed["preview"],
    }


@app.post("/api/upload/bank-pdf")
async def upload_bank_pdf(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .pdf")

    content = await file.read()
    if len(content) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"El archivo PDF excede el límite máximo de {MAX_PDF_SIZE_BYTES // (1024 * 1024)} MB",
        )
    try:
        parsed = parse_bank_pdf(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Error al procesar PDF: {str(exc)}")

    batch = UploadBatch(
        source_type="BANK_PDF",
        filename=file.filename,
        total_rows=parsed["valid_rows"],
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Guardar transacciones bancarias para el módulo secundario de conciliación
    db.query(BankTransaction).delete()
    for rec in parsed["records"]:
        db.add(
            BankTransaction(
                batch_id=batch.id,
                tx_date=rec["tx_date"],
                reference=rec["reference"],
                description=rec["description"],
                debit=rec["debit"],
                credit=rec["credit"],
                balance=rec["balance"],
            )
        )
    db.commit()

    return {
        "batch_id": batch.id,
        "filename": parsed["filename"],
        "total_pages": parsed["total_pages"],
        "valid_rows": parsed["valid_rows"],
        "preview": parsed["preview"],
    }


@app.post("/api/reconcile")
def reconcile_with_bank(tolerance_days: int = Query(2), db: Session = Depends(get_db)):
    orders = db.query(BinanceOrder).order_by(BinanceOrder.order_date.desc()).all()
    bank_txs = db.query(BankTransaction).all()
    result = run_reconciliation(orders, bank_txs, tolerance_days=tolerance_days)
    db.commit()
    return result


@app.post("/api/reconcile/manual")
def manual_match(payload: ManualMatchPayload, db: Session = Depends(get_db)):
    order = db.query(BinanceOrder).filter(BinanceOrder.id == payload.order_id).first()
    bank_tx = db.query(BankTransaction).filter(BankTransaction.id == payload.bank_id).first()
    if not order or not bank_tx:
        raise HTTPException(status_code=404, detail="Orden o movimiento bancario no encontrado")
    order.status = "MATCHED_MANUAL"
    bank_tx.status = "MATCHED_MANUAL"
    bank_tx.matched_order_number = order.order_number
    db.commit()
    return {"status": "matched_manual", "order_number": order.order_number, "bank_reference": bank_tx.reference}


# ==============================================================================
# ENDPOINTS DE INVENTARIO EN BS POR CUENTA BANCARIA Y CUADRE DE POSICIÓN
# ==============================================================================


@app.get("/api/banks/catalog")
def get_venezuela_banks_catalog():
    """Retorna el catálogo oficial de bancos nacionales venezolanos (SUDEBAN) con sus códigos y palabras clave P2P."""
    return {
        "total": len(VENEZUELA_BANKS_CATALOG),
        "banks": VENEZUELA_BANKS_CATALOG,
    }


@app.get("/api/bank-inventory")
def get_bank_inventory(db: Session = Depends(get_db)):
    """Retorna la Posición Consolidada en Bs, el desglose por banco y el historial de cuadres."""
    return compute_bank_inventory_summary(db)


@app.post("/api/bank-inventory/sync-binance-methods")
def sync_binance_payment_methods_endpoint(db: Session = Depends(get_db)):
    """Sincroniza las cuentas bancarias en VES según los métodos de pago de la cuenta de Binance del usuario."""
    sync_bank_accounts_from_binance(db)
    return compute_bank_inventory_summary(db)


@app.post("/api/bank-inventory/accounts")
def create_bank_account(payload: BankAccountPayload, db: Session = Depends(get_db)):
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="El nombre del banco o cuenta es obligatorio.")

    existing = (
        db.query(BankAccount)
        .filter(func.lower(BankAccount.name) == clean_name.lower())
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una cuenta con el nombre '{clean_name}'.")

    if payload.is_default:
        db.query(BankAccount).update({BankAccount.is_default: 0})

    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    now_ms = int(now.timestamp() * 1000)
    cut_ts = max(now_ms, get_latest_ves_order_timestamp_ms(db))
    init_bal = float(payload.initial_balance or 0.0)
    keywords = (payload.match_keywords or "").strip() or clean_name.lower()

    new_acc = BankAccount(
        name=clean_name,
        account_alias=(payload.account_alias or "").strip() or f"Cuenta {clean_name}",
        fiat_currency="VES",
        match_keywords=keywords,
        is_default=1 if payload.is_default else 0,
        apply_buy_fee=1 if payload.apply_buy_fee else 0,
        pago_movil_fee_pct=float(payload.pago_movil_fee_pct or 0.0),
        transfer_fee_pct=float(payload.transfer_fee_pct or 0.0),
        anchor_balance=init_bal,
        anchor_timestamp=cut_ts,
        anchor_date_label=f"Apertura ({now.strftime('%Y-%m-%d %H:%M')})",
        manual_delta_bs=0.0,
    )
    db.add(new_acc)
    db.flush()

    if init_bal != 0.0:
        db.add(
            BankBalanceAdjustment(
                account_id=new_acc.id,
                account_name=new_acc.name,
                adjustment_type="SALDO_INICIAL_HISTORICO",
                previous_balance=0.0,
                new_balance=init_bal,
                delta_amount=init_bal,
                note="Saldo inicial al crear la cuenta bancaria",
                created_at_str=now_str,
            )
        )

    db.commit()
    return compute_bank_inventory_summary(db)


@app.put("/api/bank-inventory/accounts/{account_id}")
def update_bank_account(
    account_id: int, payload: BankAccountPayload, db: Session = Depends(get_db)
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada.")

    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="El nombre del banco no puede estar vacío.")

    if payload.is_default:
        db.query(BankAccount).filter(BankAccount.id != account_id).update({BankAccount.is_default: 0})

    acc.name = clean_name
    acc.account_alias = (payload.account_alias or "").strip()
    acc.match_keywords = (payload.match_keywords or "").strip() or clean_name.lower()
    acc.is_default = 1 if payload.is_default else 0
    acc.apply_buy_fee = 1 if payload.apply_buy_fee else 0
    acc.pago_movil_fee_pct = float(payload.pago_movil_fee_pct or 0.0)
    acc.transfer_fee_pct = float(payload.transfer_fee_pct or 0.0)

    db.commit()
    return compute_bank_inventory_summary(db)


@app.delete("/api/bank-inventory/accounts/{account_id}")
def delete_bank_account(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada.")

    db.query(BinanceOrder).filter(BinanceOrder.bank_account_id == account_id).update(
        {BinanceOrder.bank_account_id: None}
    )
    db.query(BankBalanceAdjustment).filter(BankBalanceAdjustment.account_id == account_id).delete()
    db.delete(acc)
    db.commit()
    return compute_bank_inventory_summary(db)


def _apply_account_reconciliation(
    db: Session,
    acc: BankAccount,
    current_calc_balance: float,
    mode: str,
    amount: float,
    note: str,
) -> None:
    """Aplica el cuadre o ajuste sobre una cuenta bancaria y guarda auditoría."""
    now = datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")
    now_ms = int(now.timestamp() * 1000)

    all_accounts = db.query(BankAccount).order_by(BankAccount.id.asc()).all()
    ves_orders = (
        db.query(BinanceOrder)
        .filter(
            BinanceOrder.fiat_currency == "VES",
            (BinanceOrder.order_status == "COMPLETED") | (BinanceOrder.order_status.is_(None)),
        )
        .all()
    )
    acc_orders_ts = [
        parse_order_timestamp_ms(o)
        for o in ves_orders
        if (resolve_order_bank_account(o, all_accounts) and resolve_order_bank_account(o, all_accounts).id == acc.id)
    ]
    latest_order_ts = max(acc_orders_ts) if acc_orders_ts else 0

    if mode == "CUADRE_CONSOLIDADO":
        # El usuario ingresa la Posición Consolidada Real que observa en su banco en este momento.
        # Todas las órdenes actuales quedan absorbidas en este corte y las nuevas órdenes futuras suman/restan desde aquí.
        new_real_balance = float(amount)
        delta = new_real_balance - current_calc_balance
        cut_ts = max(now_ms, latest_order_ts)

        acc.anchor_balance = new_real_balance
        acc.anchor_timestamp = cut_ts
        acc.manual_delta_bs = 0.0
        acc.anchor_date_label = f"Cuadre Manual ({now.strftime('%Y-%m-%d %H:%M')})"

        db.add(
            BankBalanceAdjustment(
                account_id=acc.id,
                account_name=acc.name,
                adjustment_type="CUADRE_CONSOLIDADO",
                previous_balance=current_calc_balance,
                new_balance=new_real_balance,
                delta_amount=delta,
                note=note or "Cuadre manual con posición consolidada del banco",
                created_at_str=now_str,
            )
        )

    elif mode == "SALDO_INICIAL_DIA":
        # Fija el saldo de apertura de HOY a las 00:00:00 para que las órdenes de hoy sumen/resten sobre este valor
        start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_today_ms = int(start_of_today.timestamp() * 1000) - 1
        base_balance = float(amount)

        acc.anchor_balance = base_balance
        acc.anchor_timestamp = start_today_ms
        acc.manual_delta_bs = 0.0
        acc.anchor_date_label = f"Apertura Hoy ({now.strftime('%Y-%m-%d')} 00:00)"

        db.flush()
        updated_summary = compute_bank_inventory_summary(db)
        new_calc = next(
            (a["calculated_balance"] for a in updated_summary["accounts"] if a["id"] == acc.id),
            base_balance,
        )
        db.add(
            BankBalanceAdjustment(
                account_id=acc.id,
                account_name=acc.name,
                adjustment_type="SALDO_INICIAL_DIA",
                previous_balance=current_calc_balance,
                new_balance=new_calc,
                delta_amount=new_calc - current_calc_balance,
                note=note or f"Saldo inicial del día fijado en {base_balance:,.2f} Bs",
                created_at_str=now_str,
            )
        )

    elif mode == "SALDO_INICIAL_HISTORICO":
        # Fija el saldo antes de todas las órdenes registradas (anchor_timestamp = 0)
        base_balance = float(amount)
        acc.anchor_balance = base_balance
        acc.anchor_timestamp = 0
        acc.manual_delta_bs = 0.0
        acc.anchor_date_label = "Saldo Base Histórico"

        db.flush()
        updated_summary = compute_bank_inventory_summary(db)
        new_calc = next(
            (a["calculated_balance"] for a in updated_summary["accounts"] if a["id"] == acc.id),
            base_balance,
        )
        db.add(
            BankBalanceAdjustment(
                account_id=acc.id,
                account_name=acc.name,
                adjustment_type="SALDO_INICIAL_HISTORICO",
                previous_balance=current_calc_balance,
                new_balance=new_calc,
                delta_amount=new_calc - current_calc_balance,
                note=note or f"Saldo base histórico fijado en {base_balance:,.2f} Bs",
                created_at_str=now_str,
            )
        )

    elif mode == "MOVIMIENTO_MANUAL":
        # Suma (+) o resta (-) un monto puntual en Bs sin reiniciar el corte de órdenes
        delta = float(amount)
        new_calc = current_calc_balance + delta
        acc.manual_delta_bs = float(acc.manual_delta_bs or 0.0) + delta

        db.add(
            BankBalanceAdjustment(
                account_id=acc.id,
                account_name=acc.name,
                adjustment_type="MOVIMIENTO_MANUAL",
                previous_balance=current_calc_balance,
                new_balance=new_calc,
                delta_amount=delta,
                note=note or ("Ingreso manual en Bs" if delta >= 0 else "Egreso / Gasto manual en Bs"),
                created_at_str=now_str,
            )
        )
    else:
        raise HTTPException(status_code=400, detail=f"Modo de ajuste no válido: {mode}")


@app.post("/api/bank-inventory/reconcile")
def reconcile_bank_account_balance(
    payload: BankReconcilePayload, db: Session = Depends(get_db)
):
    """
    Permite cuadrar manualmente el saldo en Bs de una cuenta bancaria contra la posición consolidada real,
    fijar el saldo de apertura del día, o registrar un movimiento manual (+ / - Bs).
    """
    acc = db.query(BankAccount).filter(BankAccount.id == payload.account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada.")

    summary_before = compute_bank_inventory_summary(db)
    acc_info = next(
        (a for a in summary_before["accounts"] if a["id"] == acc.id), None
    )
    current_calc_balance = float(acc_info["calculated_balance"]) if acc_info else 0.0

    _apply_account_reconciliation(
        db=db,
        acc=acc,
        current_calc_balance=current_calc_balance,
        mode=payload.mode,
        amount=payload.amount,
        note=(payload.note or "").strip(),
    )
    db.commit()
    return compute_bank_inventory_summary(db)


@app.post("/api/bank-inventory/reconcile-bulk")
def reconcile_bulk_bank_accounts(
    payload: BulkBankReconcilePayload, db: Session = Depends(get_db)
):
    """Permite cuadrar la posición consolidada de múltiples cuentas bancarias simultáneamente."""
    summary_before = compute_bank_inventory_summary(db)
    calc_map = {
        a["id"]: float(a["calculated_balance"]) for a in summary_before["accounts"]
    }

    for item in payload.items:
        acc = db.query(BankAccount).filter(BankAccount.id == item.account_id).first()
        if not acc:
            continue
        cur_bal = calc_map.get(acc.id, 0.0)
        _apply_account_reconciliation(
            db=db,
            acc=acc,
            current_calc_balance=cur_bal,
            mode=payload.mode or "CUADRE_CONSOLIDADO",
            amount=item.real_balance,
            note=(payload.note or "").strip() or "Cuadre consolidado múltiple",
        )

    db.commit()
    return compute_bank_inventory_summary(db)


@app.post("/api/bank-inventory/assign-order")
def assign_order_to_bank_account(
    payload: AssignOrderBankPayload, db: Session = Depends(get_db)
):
    """Permite reasignar manualmente una orden de Binance P2P a una cuenta bancaria específica."""
    order = db.query(BinanceOrder).filter(BinanceOrder.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    if payload.bank_account_id is not None:
        acc = db.query(BankAccount).filter(BankAccount.id == payload.bank_account_id).first()
        if not acc:
            raise HTTPException(status_code=404, detail="Cuenta bancaria destino no encontrada.")
        order.bank_account_id = acc.id
    else:
        order.bank_account_id = None

    db.commit()
    return compute_bank_inventory_summary(db)


# ==========================================
# GESTIÓN DE RESPALDOS DE BASE DE DATOS (SQLITE)
# ==========================================

BACKUPS_DIR = BASE_DIR / "backups"
BACKUPS_DIR.mkdir(parents=True, exist_ok=True)


class RestoreBackupPayload(BaseModel):
    filename: str


@app.get("/api/backups")
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


@app.post("/api/backups/create")
def create_database_backup():
    """Genera un snapshot transaccionalmente seguro de la base de datos SQLite."""
    if not DB_PATH.exists():
        raise HTTPException(status_code=404, detail="La base de datos original no existe.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_{timestamp}.db"
    backup_file_path = BACKUPS_DIR / backup_filename

    try:
        # Usamos la API nativa de backup de sqlite3 para garantizar consistencia incluso con WAL activo
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


@app.get("/api/backups/download/{filename}")
def download_database_backup(filename: str):
    """Permite descargar un archivo de respaldo .db específico."""
    from pathlib import Path
    safe_filename = Path(filename).name
    backup_file_path = BACKUPS_DIR / safe_filename

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de respaldo no encontrado.")

    return FileResponse(
        path=str(backup_file_path),
        filename=safe_filename,
        media_type="application/x-sqlite3",
    )


@app.post("/api/backups/restore")
def restore_database_backup(payload: RestoreBackupPayload):
    """Restaura un respaldo existente sobre la base de datos actual."""
    from pathlib import Path
    safe_filename = Path(payload.filename).name
    backup_file_path = BACKUPS_DIR / safe_filename

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="El respaldo especificado no existe.")

    try:
        # 1. Crear un respaldo de emergencia de la BD actual antes de sobrescribirla
        emergency_name = f"backup_pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        emergency_path = BACKUPS_DIR / emergency_name
        if DB_PATH.exists():
            shutil.copy2(str(DB_PATH), str(emergency_path))

        # 2. Cerrar todas las conexiones en el pool de SQLAlchemy
        engine.dispose()

        # 3. Restaurar usando copia atómica segura
        shutil.copy2(str(backup_file_path), str(DB_PATH))

        # 4. Eliminar archivos temporales de WAL y SHM si existen para evitar desincronización
        from pathlib import Path
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


@app.post("/api/backups/upload")
async def upload_database_backup(file: UploadFile = File(...)):
    """Permite subir un archivo de respaldo SQLite externo para almacenarlo en la lista de backups."""
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="El archivo debe tener extensión .db")

    from pathlib import Path
    safe_name = f"backup_uploaded_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{Path(file.filename).name}"
    target_path = BACKUPS_DIR / safe_name

    try:
        content = await file.read()
        if len(content) > MAX_BACKUP_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"El archivo de respaldo excede el límite máximo de {MAX_BACKUP_SIZE_BYTES // (1024 * 1024)} MB",
            )
        # Verificar header SQLite
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


@app.delete("/api/backups/{filename}")
def delete_database_backup(filename: str):
    """Elimina un archivo de respaldo específico."""
    from pathlib import Path
    safe_filename = Path(filename).name
    backup_file_path = BACKUPS_DIR / safe_filename

    if not backup_file_path.exists() or not backup_file_path.is_file():
        raise HTTPException(status_code=404, detail="Archivo de respaldo no encontrado.")

    try:
        backup_file_path.unlink()
        return {"status": "deleted", "filename": safe_filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error eliminando respaldo: {str(e)}")


