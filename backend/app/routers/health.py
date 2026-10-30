from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UploadBatch, BinanceOrder, BankTransaction
from ..services.binance_api import get_saved_credentials

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health")
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
