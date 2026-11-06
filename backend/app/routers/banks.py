from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import BankAccount, BankBalanceAdjustment, BinanceOrder
from ..schemas import (
    BankAccountPayload,
    BankReconcilePayload,
    BulkBankReconcilePayload,
    AssignOrderBankPayload,
)
from ..services.venezuela_banks import VENEZUELA_BANKS_CATALOG
from ..services.bank_inventory import (
    compute_bank_inventory_summary,
    sync_bank_accounts_from_binance,
    get_latest_ves_order_timestamp_ms,
    parse_order_timestamp_ms,
    resolve_order_bank_account,
)

router = APIRouter(prefix="/api", tags=["Bank Inventory"])


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


@router.get("/banks/catalog")
def get_venezuela_banks_catalog():
    return {
        "total": len(VENEZUELA_BANKS_CATALOG),
        "banks": VENEZUELA_BANKS_CATALOG,
    }


@router.get("/bank-inventory")
def get_bank_inventory(db: Session = Depends(get_db)):
    return compute_bank_inventory_summary(db)


@router.post("/bank-inventory/sync-binance-methods")
def sync_binance_payment_methods_endpoint(db: Session = Depends(get_db)):
    try:
        _, meta = sync_bank_accounts_from_binance(db)
        summary = compute_bank_inventory_summary(db)
        summary["sync_meta"] = meta
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error al sincronizar métodos de pago de Binance: {str(e)}"
        )


@router.post("/bank-inventory/accounts")
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
        bank_code=(payload.bank_code or "").strip(),
        account_number=(payload.account_number or "").strip(),
        holder_name=(payload.holder_name or "").strip(),
        holder_id=(payload.holder_id or "").strip(),
        phone_number=(payload.phone_number or "").strip(),
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


@router.put("/bank-inventory/accounts/{account_id}")
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
    if payload.bank_code is not None:
        acc.bank_code = payload.bank_code.strip()
    if payload.account_number is not None:
        acc.account_number = payload.account_number.strip()
    if payload.holder_name is not None:
        acc.holder_name = payload.holder_name.strip()
    if payload.holder_id is not None:
        acc.holder_id = payload.holder_id.strip()
    if payload.phone_number is not None:
        acc.phone_number = payload.phone_number.strip()
    acc.match_keywords = (payload.match_keywords or "").strip() or clean_name.lower()
    acc.is_default = 1 if payload.is_default else 0
    acc.apply_buy_fee = 1 if payload.apply_buy_fee else 0
    acc.pago_movil_fee_pct = float(payload.pago_movil_fee_pct or 0.0)
    acc.transfer_fee_pct = float(payload.transfer_fee_pct or 0.0)

    db.commit()
    return compute_bank_inventory_summary(db)


@router.delete("/bank-inventory/accounts/{account_id}")
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


@router.post("/bank-inventory/reconcile")
def reconcile_bank_account_balance(
    payload: BankReconcilePayload, db: Session = Depends(get_db)
):
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


@router.post("/bank-inventory/reconcile-bulk")
def reconcile_bulk_bank_accounts(
    payload: BulkBankReconcilePayload, db: Session = Depends(get_db)
):
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


@router.post("/bank-inventory/assign-order")
def assign_order_to_bank_account(
    payload: AssignOrderBankPayload, db: Session = Depends(get_db)
):
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
