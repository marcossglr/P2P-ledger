from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UploadBatch, BinanceOrder
from ..schemas import (
    CredentialsPayload,
    SyncPayload,
    FundingManualPayload,
    P2PPublicConfigPayload,
)
from ..services.binance_api import (
    get_saved_credentials,
    save_credentials,
    clear_credentials,
    fetch_c2c_orders_range,
    fetch_funding_asset_balance,
    save_cached_funding_asset,
    fetch_c2c_user_ads,
)
from ..services.binance_p2p_public import (
    get_p2p_public_config,
    save_p2p_public_config,
    reset_p2p_public_config,
    fetch_p2p_market_snapshot,
    test_p2p_public_connection,
    fetch_binance_fiat_payment_methods,
    fetch_binance_fiat_crypto_assets,
)
from ..services.bank_inventory import sync_bank_accounts_from_binance
from ..services.orders import upsert_binance_orders

router = APIRouter(prefix="/api/binance", tags=["Binance"])


@router.get("/config")
def get_binance_config():
    creds = get_saved_credentials()
    has_creds = bool(creds["api_key"] and creds["api_secret"])
    return {
        "configured": has_creds,
        "masked_api_key": f"{creds['api_key'][:6]}••••{creds['api_key'][-4:]}" if len(creds["api_key"]) > 10 else "",
    }


@router.post("/config")
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


@router.delete("/config")
def delete_binance_config():
    clear_credentials()
    return {"status": "deleted", "configured": False, "masked_api_key": ""}


@router.get("/funding-wallet")
def get_binance_funding_wallet():
    return fetch_funding_asset_balance(asset="USDT")


@router.post("/funding-wallet/manual")
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


@router.get("/my-ads")
def get_my_binance_ads():
    """Retorna los anuncios publicados por el usuario en Binance P2P."""
    return fetch_c2c_user_ads()


@router.get("/p2p-public/config")
def get_p2p_public_market_config():
    return get_p2p_public_config()


@router.post("/p2p-public/config")
def set_p2p_public_market_config(payload: P2PPublicConfigPayload):
    return save_p2p_public_config(payload.model_dump(exclude_unset=True))


@router.delete("/p2p-public/config")
def delete_p2p_public_market_config():
    return reset_p2p_public_config()


@router.post("/p2p-public/test")
def test_p2p_public_market_connection(payload: Optional[P2PPublicConfigPayload] = None):
    """Prueba la conexión con la configuración guardada (o con overrides temporales sin guardarlos)."""
    cfg = get_p2p_public_config()
    if payload:
        cfg.update(payload.model_dump(exclude_unset=True))
    return test_p2p_public_connection(cfg)


@router.get("/p2p-public/market-stats")
def get_p2p_public_market_stats(
    asset: Optional[str] = Query(None),
    fiat: Optional[str] = Query(None),
    bank: Optional[str] = Query(None),
    amount: Optional[float] = Query(None),
    only_merchants: bool = Query(False),
    include_ads: bool = Query(True),
    force: bool = Query(False),
):
    cfg = get_p2p_public_config()
    if not cfg.get("enabled"):
        raise HTTPException(status_code=409, detail="La API pública P2P está deshabilitada en Ajustes.")

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
    if only_merchants:
        cfg["publisher_type"] = "merchant"
    else:
        cfg["publisher_type"] = None

    try:
        snap = fetch_p2p_market_snapshot(cfg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if not include_ads:
        snap["buy"].pop("ads", None)
        snap["sell"].pop("ads", None)
    return snap


@router.get("/p2p-public/payment-methods")
def get_p2p_public_payment_methods(
    fiat: Optional[str] = Query("VES"),
    force: bool = Query(False),
):
    """Retorna los métodos de pago disponibles en Binance P2P para la divisa fiat indicada."""
    methods = fetch_binance_fiat_payment_methods(fiat=fiat or "VES", force=force)
    return {
        "fiat": (fiat or "VES").upper(),
        "total": len(methods),
        "methods": methods,
    }


@router.get("/p2p-public/crypto-assets")
def get_p2p_public_crypto_assets(
    fiat: Optional[str] = Query("VES"),
    force: bool = Query(False),
):
    """Retorna las criptomonedas soportadas oficialmente en Binance P2P para la divisa fiat indicada."""
    assets = fetch_binance_fiat_crypto_assets(fiat=fiat or "VES", force=force)
    return {
        "fiat": (fiat or "VES").upper(),
        "total": len(assets),
        "assets": assets,
    }


@router.post("/sync")
def sync_binance_orders(payload: SyncPayload, db: Session = Depends(get_db)):
    is_new_key = bool(payload.api_key and payload.api_secret)
    if is_new_key:
        save_credentials(payload.api_key, payload.api_secret)

    now = datetime.now()
    end_dt = now
    end_ms = int(end_dt.timestamp() * 1000)

    days_back = max(1, min(int(payload.days or 180), 180))
    full_range_dt = (now - timedelta(days=days_back)) + timedelta(hours=1)
    full_range_ms = int(full_range_dt.timestamp() * 1000)

    latest_ts = (
        db.query(func.max(BinanceOrder.create_timestamp))
        .filter(BinanceOrder.source == "API")
        .scalar()
    )

    # La sincronización completa (180 días) se ejecuta automáticamente al vincular/cambiar la API
    # o si nunca se han obtenido órdenes de la API de Binance en la base de datos local.
    is_first_api_link = is_new_key or not latest_ts or latest_ts <= 0

    if payload.force_full_180d or is_first_api_link:
        sync_mode = f"FULL_{days_back}D_ALL"
        start_ms = full_range_ms
        start_dt = full_range_dt
    else:
        # En cualquier otro caso (botón manual de usuario, polling en segundo plano, etc.)
        # se ejecuta de forma incremental estricta (últimas horas) para máxima velocidad.
        sync_mode = "INCREMENTAL"
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

    # Al ingresar datos reales de la API, purgar automáticamente cualquier orden demo previa
    if records:
        db.query(BinanceOrder).filter(BinanceOrder.source == "DEMO").delete()

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

    # Sincronizar cuentas bancarias desde Binance únicamente en la vinculación inicial de la API
    if is_first_api_link:
        try:
            sync_bank_accounts_from_binance(
                db, api_key=payload.api_key, api_secret=payload.api_secret
            )
        except Exception:
            pass

    # Contar órdenes activas en curso (IN_PROGRESS) para que el frontend maneje alertas y badges
    in_progress_count = (
        db.query(BinanceOrder)
        .filter(BinanceOrder.order_status == "IN_PROGRESS")
        .count()
    )

    return {
        "status": "synced",
        "sync_mode": sync_mode,
        "fetched_count": len(records),
        "new_orders": stats["new_count"],
        "updated_orders": stats["updated_count"],
        "has_in_progress": in_progress_count > 0,
        "in_progress_count": in_progress_count,
        "last_synced_at": datetime.now().strftime("%H:%M:%S"),
        "period": f"{start_dt.strftime('%Y-%m-%d %H:%M')} → {end_dt.strftime('%Y-%m-%d %H:%M')}",
    }
