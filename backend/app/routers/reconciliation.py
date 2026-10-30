from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UploadBatch, BinanceOrder, BankTransaction
from ..schemas import ManualMatchPayload
from ..services.parsers import parse_binance_csv, parse_bank_pdf
from ..services.reconciler import run_reconciliation
from ..services.orders import upsert_binance_orders

router = APIRouter(prefix="/api", tags=["Reconciliation & Uploads"])

MAX_CSV_SIZE_BYTES = 25 * 1024 * 1024       # 25 MB
MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024       # 50 MB


@router.post("/upload/binance-csv")
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


@router.post("/upload/bank-pdf")
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


@router.post("/reconcile")
def reconcile_with_bank(tolerance_days: int = Query(2), db: Session = Depends(get_db)):
    orders = db.query(BinanceOrder).order_by(BinanceOrder.order_date.desc()).all()
    bank_txs = db.query(BankTransaction).all()
    result = run_reconciliation(orders, bank_txs, tolerance_days=tolerance_days)
    db.commit()
    return result


@router.post("/reconcile/manual")
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
