from typing import Optional, List
from sqlalchemy.orm import Session
from ..models import BinanceOrder


def upsert_binance_orders(
    db: Session, records: list, batch_id: Optional[int] = None, default_source: str = "API"
) -> dict:
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
