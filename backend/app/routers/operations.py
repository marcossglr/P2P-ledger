from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Response, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BinanceOrder, UploadBatch, BankBalanceAdjustment, BankAccount
from ..schemas import UpdatePaymentChannelPayload, UpdateOrderPaymentDetailsPayload
from ..services.analytics import compute_operations_analytics, export_operations_excel
from ..services.binance_api import fetch_funding_asset_balance, fetch_c2c_user_ads
from ..services.orders import upsert_binance_orders
from ..services.parsers import parse_binance_csv
from ..services.bank_inventory import (
    compute_bank_inventory_summary,
    resolve_order_payment_channel,
    resolve_order_bank_account,
)

router = APIRouter(prefix="/api/operations", tags=["Operations"])

MAX_CSV_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("/upload/binance-csv")
async def upload_binance_csv(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Importa órdenes de Binance P2P a partir de un archivo CSV exportado oficialmente."""
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

    # Al ingresar datos reales por CSV, purgar automáticamente cualquier orden demo previa
    if parsed.get("records"):
        db.query(BinanceOrder).filter(BinanceOrder.source == "DEMO").delete()

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


@router.post("/demo-seed")
def seed_demo_operations(db: Session = Depends(get_db)):
    """
    Genera un conjunto realista de operaciones de arbitraje P2P (Compras y Ventas de USDT)
    incluyendo operaciones del día de HOY y de los últimos 4 días.
    """
    now = datetime.now()
    demo_rows = [
        {"order_number": "2026101500112201", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 500.0, "unit_price": 42.10, "fiat_amount": 21050.0, "commission_usdt": 0.50, "pay_method": "Banesco Pago Móvil", "counterparty": "CryptoTraderVE", "days_ago": 4, "hour": 10, "minute": 15},
        {"order_number": "2026101500112202", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 300.0, "unit_price": 42.95, "fiat_amount": 12885.0, "commission_usdt": 0.30, "pay_method": "Banesco Transferencia", "counterparty": "InversionesCaracas", "days_ago": 4, "hour": 14, "minute": 20},
        {"order_number": "2026101500112203", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 200.0, "unit_price": 43.00, "fiat_amount": 8600.0,  "commission_usdt": 0.20, "pay_method": "Mercantil", "counterparty": "JuanP2P_Fast", "days_ago": 4, "hour": 17, "minute": 40},
        {"order_number": "2026101600223301", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 800.0, "unit_price": 42.30, "fiat_amount": 33840.0, "commission_usdt": 0.80, "pay_method": "Banesco Transferencia", "counterparty": "CambiosOrinoco", "days_ago": 3, "hour": 9, "minute": 10},
        {"order_number": "2026101600223302", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 450.0, "unit_price": 43.20, "fiat_amount": 19440.0, "commission_usdt": 0.45, "pay_method": "Banesco Pago Móvil", "counterparty": "MariaExchanges", "days_ago": 3, "hour": 13, "minute": 30},
        {"order_number": "2026101600223303", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 350.0, "unit_price": 43.25, "fiat_amount": 15137.5, "commission_usdt": 0.35, "pay_method": "Banco Provincial", "counterparty": "AndesCapital", "days_ago": 3, "hour": 18, "minute": 5},
        {"order_number": "2026101700334401", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 600.0, "unit_price": 42.50, "fiat_amount": 25500.0, "commission_usdt": 0.60, "pay_method": "Mercantil", "counterparty": "LiquidezTotal", "days_ago": 2, "hour": 11, "minute": 12},
        {"order_number": "2026101700334402", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 400.0, "unit_price": 42.45, "fiat_amount": 16980.0, "commission_usdt": 0.40, "pay_method": "Banesco Pago Móvil", "counterparty": "FastUsdtExpress", "days_ago": 2, "hour": 12, "minute": 45},
        {"order_number": "2026101700334403", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 950.0, "unit_price": 43.40, "fiat_amount": 41230.0, "commission_usdt": 0.95, "pay_method": "Banesco Transferencia", "counterparty": "ImportadoraGlobal", "days_ago": 2, "hour": 16, "minute": 50},
        {"order_number": "2026101800445501", "order_type": "COMPRA", "fiat_currency": "VES", "crypto_amount": 1200.0, "unit_price": 42.60, "fiat_amount": 51120.0, "commission_usdt": 1.20, "pay_method": "Banesco Transferencia", "counterparty": "TesoreriaDigital", "days_ago": 1, "hour": 10, "minute": 20},
        {"order_number": "2026101800445502", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 700.0, "unit_price": 43.55, "fiat_amount": 30485.0, "commission_usdt": 0.70, "pay_method": "Banesco Pago Móvil", "counterparty": "ComercializadoraSur", "days_ago": 1, "hour": 15, "minute": 10},
        {"order_number": "2026101800445503", "order_type": "VENTA",  "fiat_currency": "VES", "crypto_amount": 500.0, "unit_price": 43.60, "fiat_amount": 21800.0, "commission_usdt": 0.50, "pay_method": "Banco Provincial", "counterparty": "GrupoFinanciero77", "days_ago": 1, "hour": 19, "minute": 35},
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

    # Solo permitir cargar datos demo si no existen órdenes reales en la base de datos
    has_real_orders = db.query(BinanceOrder).filter(BinanceOrder.source.in_(["API", "CSV"])).count() > 0
    if has_real_orders:
        raise HTTPException(
            status_code=400,
            detail="No se pueden sembrar operaciones demo mientras existan órdenes reales importadas por API o CSV.",
        )

    count = upsert_binance_orders(db, prepared, default_source="DEMO")

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


@router.delete("/clear")
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
    db.query(BankBalanceAdjustment).delete()
    db.query(BankAccount).delete()
    db.commit()
    return {"status": "cleared_all", "deleted_rows": deleted}


@router.get("")
def get_operations_dashboard(
    order_type: Optional[str] = None,
    order_status: Optional[str] = None,
    asset: Optional[str] = None,
    fiat_currency: Optional[str] = "VES",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    only_today: bool = False,
    search: Optional[str] = None,
    bank_fee_pct: float = 0.0,
    db: Session = Depends(get_db),
):
    today_str = datetime.now().strftime("%Y-%m-%d")
    total_stored_orders = db.query(BinanceOrder).count()
    has_demo_orders = db.query(BinanceOrder).filter(BinanceOrder.source == "DEMO").count() > 0

    target_fiat = (fiat_currency or "VES").upper().strip()
    base_period_q = db.query(BinanceOrder).filter(BinanceOrder.fiat_currency == target_fiat)

    if only_today:
        base_period_q = base_period_q.filter(BinanceOrder.order_date >= f"{today_str} 00:00:00")
        base_period_q = base_period_q.filter(BinanceOrder.order_date <= f"{today_str} 23:59:59")
    else:
        if start_date:
            base_period_q = base_period_q.filter(BinanceOrder.order_date >= f"{start_date} 00:00:00")
        if end_date:
            base_period_q = base_period_q.filter(BinanceOrder.order_date <= f"{end_date} 23:59:59")

    all_bank_accounts = db.query(BankAccount).order_by(BankAccount.id.asc()).all()
    period_orders_all = base_period_q.order_by(BinanceOrder.order_date.desc()).all()
    analytics = compute_operations_analytics(
        period_orders_all,
        bank_fee_rate_pct=bank_fee_pct,
        accounts=all_bank_accounts,
        target_asset=asset if asset and asset != "ALL" else None,
    )

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

    period_orders = q.order_by(BinanceOrder.order_date.desc()).all()

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

    STANDARD_CRYPTO_ASSETS = ["USDT", "BTC", "USDC", "ETH", "BNB", "FDUSD"]
    db_crypto_assets = [r[0] for r in db.query(BinanceOrder.asset).distinct().all() if r[0]]
    combined_assets = list(dict.fromkeys(db_crypto_assets + STANDARD_CRYPTO_ASSETS))

    STANDARD_FIATS = ["VES", "COP", "USD", "ARS", "BRL"]
    db_fiats = [r[0] for r in db.query(BinanceOrder.fiat_currency).distinct().all() if r[0]]
    combined_fiats = list(dict.fromkeys(db_fiats + STANDARD_FIATS))

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
                "bank_account_id": o.bank_account_id,
                "payment_channel": resolve_order_payment_channel(
                    o, resolve_order_bank_account(o, all_bank_accounts)
                ),
            }
            for o in orders
        ],
    }


@router.post("/payment-channel")
def update_order_payment_channel(
    payload: UpdatePaymentChannelPayload, db: Session = Depends(get_db)
):
    order = db.query(BinanceOrder).filter(BinanceOrder.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    ch = (payload.payment_channel or "").strip().upper()
    valid_channels = ("PAGO_MOVIL", "TRANSFERENCIA", "TRANSFERENCIA_INTERBANCARIA")
    if ch not in valid_channels:
        raise HTTPException(
            status_code=400,
            detail=f"El canal de pago debe ser uno de: {', '.join(valid_channels)}.",
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


@router.post("/payment-details")
def update_order_payment_details(
    payload: UpdateOrderPaymentDetailsPayload, db: Session = Depends(get_db)
):
    """
    Permite al operador corregir cualquier incidencia en los datos de pago de la orden:
    - Cuenta bancaria asignada (bank_account_id)
    - Método de pago real reportado (pay_method)
    - Canal de pago (payment_channel: PAGO_MOVIL, TRANSFERENCIA_INTERBANCARIA, TRANSFERENCIA)
    """
    order = db.query(BinanceOrder).filter(BinanceOrder.id == payload.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    if payload.bank_account_id is not None:
        if payload.bank_account_id > 0:
            acc = db.query(BankAccount).filter(BankAccount.id == payload.bank_account_id).first()
            if not acc:
                raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada.")
            order.bank_account_id = acc.id
        else:
            order.bank_account_id = None

    if payload.pay_method is not None and payload.pay_method.strip():
        order.pay_method = payload.pay_method.strip()

    if payload.payment_channel is not None:
        ch = payload.payment_channel.strip().upper()
        valid_channels = ("PAGO_MOVIL", "TRANSFERENCIA", "TRANSFERENCIA_INTERBANCARIA")
        if ch not in valid_channels:
            raise HTTPException(
                status_code=400,
                detail=f"El canal de pago debe ser uno de: {', '.join(valid_channels)}.",
            )
        order.payment_channel = ch
        order.payment_channel_manual = 1

    db.commit()
    return {
        "status": "updated",
        "order_id": order.id,
        "bank_account_id": order.bank_account_id,
        "pay_method": order.pay_method,
        "payment_channel": order.payment_channel,
        "bank_inventory": compute_bank_inventory_summary(db),
    }


@router.get("/export")
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
