import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy import text, func, or_
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from ..models import BankAccount, BankBalanceAdjustment, BinanceOrder
from .binance_api import fetch_c2c_user_pay_methods
from .payment_methods_registry import (
    VES_PROVIDERS,
    USD_PROVIDERS,
    COP_PROVIDERS,
    resolve_payment_method_metadata,
    get_providers_for_fiat,
)


KNOWN_BANKS_CATALOG = [
    {
        "code": b["code"],
        "name": b["name"],
        "alias": b.get("alias_template", f"Cuenta {b['name']}"),
        "keywords": ",".join(b.get("keywords", [])),
        "is_default": 1 if b["name"] == "Banesco" else 0,
        "pago_movil_fee_pct": b.get("default_pago_movil_fee", 0.0),
        "transfer_fee_pct": b.get("default_transfer_fee", 0.0),
        "is_popular": b.get("is_popular", False),
    }
    for b in (VES_PROVIDERS + USD_PROVIDERS + COP_PROVIDERS)
]

GENERIC_PAYMENT_METHODS = {
    "transferencia",
    "transferencia bancaria",
    "transferenciabancaria",
    "pago móvil",
    "pago movil",
    "pagomovil",
    "pago_movil",
    "bank transfer",
    "bank_transfer",
    "bank",
    "transfer",
    "efectivo",
    "cash",
    "no especificado",
    "-",
    "",
}


def ensure_bank_inventory_schema(engine: Engine) -> None:
    """Garantiza que las columnas bank_account_id y order_status existan en binance_orders en bases SQLite existentes."""
    with engine.connect() as conn:
        try:
            cols = [
                row[1]
                for row in conn.execute(text("PRAGMA table_info(binance_orders)")).fetchall()
            ]
            if "bank_account_id" not in cols:
                conn.execute(
                    text("ALTER TABLE binance_orders ADD COLUMN bank_account_id INTEGER")
                )
                conn.commit()
            if "order_status" not in cols:
                conn.execute(
                    text("ALTER TABLE binance_orders ADD COLUMN order_status VARCHAR DEFAULT 'COMPLETED'")
                )
                conn.execute(
                    text("UPDATE binance_orders SET order_status = 'COMPLETED' WHERE order_status IS NULL OR order_status = ''")
                )
                conn.commit()
            if "payment_channel" not in cols:
                conn.execute(
                    text("ALTER TABLE binance_orders ADD COLUMN payment_channel VARCHAR")
                )
                conn.commit()
            if "payment_channel_manual" not in cols:
                conn.execute(
                    text("ALTER TABLE binance_orders ADD COLUMN payment_channel_manual INTEGER DEFAULT 0")
                )
                # Los canales guardados antes eran inferidos al sincronizar: se recalculan en consulta.
                conn.execute(text("UPDATE binance_orders SET payment_channel = NULL"))
                conn.commit()
        except Exception:
            pass


def parse_order_timestamp_ms(order: BinanceOrder) -> int:
    """Obtiene el timestamp en milisegundos de una orden (desde create_timestamp o parseando order_date)."""
    if order.create_timestamp and int(order.create_timestamp) > 0:
        return int(order.create_timestamp)
    date_str = (order.order_date or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(date_str, fmt)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return 0


def get_latest_ves_order_timestamp_ms(db: Session) -> int:
    """Obtiene el timestamp máximo en ms entre todas las órdenes VES almacenadas de forma ultra-rápida vía SQL."""
    max_ts = (
        db.query(func.max(BinanceOrder.create_timestamp))
        .filter(BinanceOrder.fiat_currency == "VES")
        .scalar()
    )
    if max_ts and int(max_ts) > 0:
        return int(max_ts)
    # Fallback si las órdenes no tenían create_timestamp
    ves_orders = db.query(BinanceOrder).filter(BinanceOrder.fiat_currency == "VES").limit(20).all()
    if not ves_orders:
        return 0
    return max((parse_order_timestamp_ms(o) for o in ves_orders), default=0)


def is_pago_movil_method(pay_method: Optional[str]) -> bool:
    """Detecta si el método de pago de la orden corresponde a Pago Móvil."""
    pm = (pay_method or "").lower()
    return any(
        token in pm
        for token in ("pago movil", "pago móvil", "pagomovil", "pago_movil", "móvil", "movil")
    )


def resolve_order_payment_channel(
    order: BinanceOrder, matched_account: Optional[BankAccount] = None
) -> str:
    """
    Identifica si una orden fue ejecutada por un canal que cobra comisión bancaria:
    - 'PAGO_MOVIL' (cobra comisión interbancaria: 0.3% min 14 VES)
    - 'TRANSFERENCIA_INTERBANCARIA' (cuenta distinta / banco distinto: 0.3% min 14 VES)
    - 'TRANSFERENCIA' (mismo banco / transferencia interna directa: 0.0% comisión)

    Prioridades:
    1. Si la orden tiene payment_channel explícito, lo respeta estrictamente.
    2. Si el pay_method menciona Pago Móvil, retorna 'PAGO_MOVIL'.
    3. En órdenes de COMPRA: si el método de pago menciona un banco específico distinto
       a la cuenta bancaria desde la que salen los Bs, se asume 'TRANSFERENCIA_INTERBANCARIA' o 'PAGO_MOVIL'.
    4. Si es del mismo banco o transferencia regular, retorna 'TRANSFERENCIA' (0% comisión).
    """
    explicit = (getattr(order, "payment_channel", None) or "").strip().upper()
    if explicit in ("PAGO_MOVIL", "TRANSFERENCIA", "TRANSFERENCIA_INTERBANCARIA"):
        return explicit

    if is_pago_movil_method(order.pay_method):
        return "PAGO_MOVIL"

    if order.order_type == "COMPRA" and matched_account:
        inferred = infer_canonical_bank_from_pay_method(order.pay_method)
        if inferred:
            order_bank_name = inferred[0].strip().lower()
            acc_bank_name = (matched_account.name or "").strip().lower()
            if order_bank_name and acc_bank_name and order_bank_name != acc_bank_name:
                return "TRANSFERENCIA_INTERBANCARIA"

    return "TRANSFERENCIA"


def infer_canonical_bank_from_pay_method(pay_method: Optional[str]) -> Optional[Tuple[str, str, str]]:
    """
    Dado el string de pay_method de Binance (ej. 'Banesco Pago Móvil' o 'Bancamiga'),
    retorna (bank_name, alias, keywords) agrupando por entidad bancaria.
    Si es un método genérico sin nombre de banco (ej. 'PagoMovil' o 'BANK'), retorna None.
    """
    pm_raw = (pay_method or "").strip()
    pm_lower = pm_raw.lower()

    if pm_lower in GENERIC_PAYMENT_METHODS:
        return None

    for entry in KNOWN_BANKS_CATALOG:
        kws = [k.strip().lower() for k in entry["keywords"].split(",") if k.strip()]
        if any(k in pm_lower for k in kws):
            return entry["name"], entry["alias"], entry["keywords"]

    # Si no es uno de los bancos conocidos pero menciona un nombre específico
    cleaned = pm_raw
    for suffix in (
        "Pago Móvil",
        "Pago Movil",
        "PagoMovil",
        "Transferencia Bancaria",
        "Transferencia",
        "Bank Transfer",
    ):
        if cleaned.lower().endswith(suffix.lower()) and len(cleaned) > len(suffix) + 2:
            cleaned = cleaned[: -len(suffix)].strip(" -_/")

    if not cleaned or cleaned.lower() in GENERIC_PAYMENT_METHODS:
        return None

    return cleaned, f"Cuenta {cleaned}", cleaned.lower()


def sync_bank_accounts_from_binance(
    db: Session,
    pay_methods: Optional[List[Any]] = None,
    api_key: Optional[str] = None,
    api_secret: Optional[str] = None,
    fiat_unit: Optional[str] = None,
) -> Tuple[List[BankAccount], Dict[str, Any]]:
    """
    Sincroniza las cuentas bancarias basándose en los métodos de pago configurados
    en la información del usuario en Binance P2P.
    - Soporta múltiples cuentas del mismo banco diferenciadas por binance_pay_id o cuenta.
    - Respeta la divisa fiat de cada método.
    - El cuadre por defecto se inicializa siempre en 0,00 (anchor_balance = 0.0)
      y las sincronizaciones nunca alteran el saldo de las cuentas existentes.
    Retorna (cuentas, metadata_resumen).
    """
    if pay_methods is None:
        try:
            pay_methods = fetch_c2c_user_pay_methods(api_key=api_key, api_secret=api_secret, fiat_unit=fiat_unit)
        except Exception:
            pay_methods = []

    now_ms = int(datetime.now().timestamp() * 1000)
    cut_ts = max(now_ms, get_latest_ves_order_timestamp_ms(db))

    existing_accounts = db.query(BankAccount).order_by(BankAccount.id.asc()).all()
    changed = False
    newly_created: List[str] = []
    detected_count = 0
    detected_names: List[str] = []

    # Eliminar siempre cualquier cuenta espuria creada por el código genérico "BANK"
    for acc in list(existing_accounts):
        if (acc.name or "").strip().lower() in GENERIC_PAYMENT_METHODS:
            db.query(BinanceOrder).filter(BinanceOrder.bank_account_id == acc.id).update(
                {BinanceOrder.bank_account_id: None}
            )
            db.query(BankBalanceAdjustment).filter(BankBalanceAdjustment.account_id == acc.id).delete()
            db.delete(acc)
            existing_accounts.remove(acc)
            changed = True

    from .payment_methods_registry import VES_PROVIDERS as VENEZUELA_BANKS_CATALOG

    for item in pay_methods or []:
        detected_count += 1
        pm_name = ""
        pm_ident = ""
        pm_pay_id = ""
        pm_fiat = "VES"

        if isinstance(item, dict):
            pm_name = str(item.get("name") or "").strip()
            pm_ident = str(item.get("identifier") or "").strip()
            pm_pay_id = str(item.get("pay_id") or "").strip()
            pm_fiat = str(item.get("fiat_currency") or "VES").upper().strip() or "VES"
        else:
            pm_name = str(item).strip()

        # Determinar nombre comercial simétrico con Binance
        meta_provider = resolve_payment_method_metadata(pm_name or pm_ident, fiat_currency=pm_fiat)
        if meta_provider:
            b_name = meta_provider["name"]
            b_keywords = ",".join(meta_provider.get("keywords", []))
            def_pm_fee = float(meta_provider.get("default_pago_movil_fee", 0.0))
            def_trans_fee = float(meta_provider.get("default_transfer_fee", 0.0))
        else:
            b_name = pm_name or pm_ident or "Método de Pago"
            b_keywords = b_name.lower()
            def_pm_fee = 0.3 if pm_fiat == "VES" else 0.0
            def_trans_fee = 0.0

        detected_names.append(b_name)

        # Buscar si esta cuenta ya existe en base al payId de Binance o nombre
        already = None
        if pm_pay_id:
            already = next((acc for acc in existing_accounts if acc.binance_pay_id == pm_pay_id), None)
        if not already:
            matching_by_name = [acc for acc in existing_accounts if acc.name.lower() == b_name.lower()]
            if len(matching_by_name) == 1 and not matching_by_name[0].binance_pay_id:
                already = matching_by_name[0]

        if not already:
            has_default = any(acc.is_default == 1 for acc in existing_accounts)
            new_acc = BankAccount(
                name=b_name,
                binance_pay_id=pm_pay_id,
                pay_method_identifier=pm_ident,
                account_alias=b_name,
                fiat_currency=pm_fiat,
                match_keywords=b_keywords,
                is_default=0 if has_default else 1,
                is_active=1,
                apply_buy_fee=1 if pm_fiat == "VES" else 0,
                pago_movil_fee_pct=def_pm_fee,
                transfer_fee_pct=def_trans_fee,
                anchor_balance=0.0,
                anchor_timestamp=cut_ts,
                anchor_date_label=f"Cuadre por Defecto (0,00 {pm_fiat})",
                manual_delta_bs=0.0,
            )
            db.add(new_acc)
            db.flush()
            existing_accounts.append(new_acc)
            newly_created.append(f"{b_name} ({pm_fiat})")
            changed = True
        else:
            # Enriquecer metadata oficial si faltaba
            if pm_pay_id and not already.binance_pay_id:
                already.binance_pay_id = pm_pay_id
                changed = True
            if pm_ident and not already.pay_method_identifier:
                already.pay_method_identifier = pm_ident
                changed = True
            if getattr(already, "is_active", 1) == 0:
                already.is_active = 1
                changed = True

    # Garantizar que si existen cuentas, al menos una esté marcada como principal (is_default=1)
    if existing_accounts and not any(acc.is_default == 1 for acc in existing_accounts):
        existing_accounts[0].is_default = 1
        changed = True

    if changed:
        db.commit()

    all_accounts = db.query(BankAccount).order_by(BankAccount.id.asc()).all()
    meta = {
        "detected_count": detected_count,
        "detected_names": list(dict.fromkeys(detected_names)),
        "created_count": len(newly_created),
        "created_names": newly_created,
    }
    return all_accounts, meta


def ensure_bank_accounts_from_orders(db: Session) -> List[BankAccount]:
    """
    Obtiene las cuentas bancarias activas en VES.
    - No escanea el historial de 180 días de órdenes para evitar recrear bancos que el usuario no usa.
    - Si aún no hay cuentas creadas, consulta primero los métodos de pago de la cuenta de Binance del usuario.
    """
    existing_accounts = db.query(BankAccount).order_by(BankAccount.id.asc()).all()

    # Limpiar cualquier cuenta residual con nombre genérico ("BANK") o creada sin corte (anchor_timestamp == 0)
    stale_accounts = [
        a
        for a in existing_accounts
        if (a.name or "").strip().lower() in GENERIC_PAYMENT_METHODS
        or int(a.anchor_timestamp or 0) <= 0
    ]
    if stale_accounts:
        for st_acc in stale_accounts:
            db.query(BinanceOrder).filter(BinanceOrder.bank_account_id == st_acc.id).update(
                {BinanceOrder.bank_account_id: None}
            )
            db.query(BankBalanceAdjustment).filter(BankBalanceAdjustment.account_id == st_acc.id).delete()
            db.delete(st_acc)
            existing_accounts.remove(st_acc)
        db.commit()

    if existing_accounts:
        return existing_accounts

    synced, _ = sync_bank_accounts_from_binance(db)
    if synced:
        return synced

    # Fallback únicamente si no hay conexión a Binance y la tabla está vacía:
    # tomar el último método de pago específico de una orden de VENTA reciente
    now_ms = int(datetime.now().timestamp() * 1000)
    cut_ts = max(now_ms, get_latest_ves_order_timestamp_ms(db))
    recent_sell_orders = (
        db.query(BinanceOrder)
        .filter(
            BinanceOrder.fiat_currency == "VES",
            BinanceOrder.order_type == "VENTA",
            (BinanceOrder.order_status == "COMPLETED") | (BinanceOrder.order_status.is_(None)),
        )
        .order_by(BinanceOrder.order_date.desc())
        .limit(25)
        .all()
    )
    for o in recent_sell_orders:
        inferred = infer_canonical_bank_from_pay_method(o.pay_method)
        if inferred:
            b_name, b_alias, b_keywords = inferred
            new_acc = BankAccount(
                name=b_name,
                account_alias=b_alias,
                fiat_currency="VES",
                match_keywords=b_keywords,
                is_default=1,
                apply_buy_fee=1,
                pago_movil_fee_pct=0.3,
                transfer_fee_pct=0.0,
                anchor_balance=0.0,
                anchor_timestamp=cut_ts,
                anchor_date_label="Cuadre por Defecto (0,00 Bs)",
                manual_delta_bs=0.0,
            )
            db.add(new_acc)
            db.commit()
            return db.query(BankAccount).order_by(BankAccount.id.asc()).all()

    return db.query(BankAccount).order_by(BankAccount.id.asc()).all()


def resolve_order_bank_account(
    order: BinanceOrder,
    accounts: List[BankAccount],
    allow_default_fallback: bool = True,
) -> Optional[BankAccount]:
    """
    Vincula una orden de Binance P2P con su cuenta bancaria correspondiente:
    1. Si la orden tiene bank_account_id asignado manualmente, usa esa cuenta.
    2. Compara order.pay_method contra match_keywords o el nombre del banco.
    3. Si allow_default_fallback=True y el método de pago es genérico (ej. 'PagoMovil'),
       usa la cuenta marcada como is_default=1. Si el método menciona otro banco específico
       que el usuario no tiene entre sus cuentas activas, retorna None.
    """
    if not accounts:
        return None

    if order.bank_account_id:
        explicit = next((a for a in accounts if a.id == order.bank_account_id), None)
        if explicit:
            return explicit

    pm_lower = (order.pay_method or "").strip().lower()
    if pm_lower:
        # Paso 1: Coincidencia por nombre del banco o palabras clave específicas
        for acc in accounts:
            acc_name_lower = (acc.name or "").strip().lower()
            acc_name_nospace = acc_name_lower.replace(" ", "")
            if (acc_name_lower and acc_name_lower in pm_lower) or (
                acc_name_nospace and acc_name_nospace in pm_lower
            ):
                return acc
            kws = [
                k.strip().lower()
                for k in (acc.match_keywords or "").split(",")
                if k.strip()
            ]
            for kw in kws:
                if kw in GENERIC_PAYMENT_METHODS:
                    continue
                if kw in pm_lower or kw.replace(" ", "") in pm_lower:
                    return acc

    if not allow_default_fallback:
        return None

    # Si la orden especifica un banco distinto que el usuario no usa, no asignarla al banco principal
    if infer_canonical_bank_from_pay_method(order.pay_method) is not None:
        return None

    # Paso 2: Cuenta por defecto únicamente para métodos genéricos ("Pago Móvil", "Transferencia", etc.)
    default_acc = next((a for a in accounts if a.is_default == 1), None)
    return default_acc or accounts[0]


MIN_PAGO_MOVIL_FEE_VES = 14.0  # Comisión mínima fija en VES (normativa bancaria SUDEBAN/BCV)


def compute_order_bank_fee_bs(order: BinanceOrder, account: BankAccount) -> Tuple[float, float]:
    """
    Calcula la comisión bancaria en Bs para órdenes de COMPRA (salidas de Bs del banco).
    - Si el canal es TRANSFERENCIA (mismo banco), aplica transfer_fee_pct (0.0% por defecto -> sin comisión).
    - Si el canal es PAGO_MOVIL, aplica pago_movil_fee_pct (0.3% por defecto) con un piso mínimo de 14.00 VES.
    En órdenes de VENTA (entradas de Bs al banco) la comisión bancaria es 0.0.
    Retorna (fee_bs, applied_fee_pct).
    """
    if order.order_type != "COMPRA":
        return 0.0, 0.0
    if not account or not account.apply_buy_fee:
        return 0.0, 0.0

    fiat_amt = round(float(order.fiat_amount or 0.0), 2)
    if fiat_amt <= 0:
        return 0.0, 0.0

    channel = resolve_order_payment_channel(order, account)
    if channel in ("PAGO_MOVIL", "TRANSFERENCIA_INTERBANCARIA"):
        pct = float(account.pago_movil_fee_pct if account.pago_movil_fee_pct is not None else 0.3)
        calc_fee = round(fiat_amt * (pct / 100.0), 2) if pct > 0 else 0.0
        # Solo aplicar comisión mínima en divisa VES (normativa SUDEBAN para interbancario)
        fiat_curr = (getattr(order, "fiat_currency", None) or getattr(account, "fiat_currency", "VES") or "VES").upper()
        if fiat_curr == "VES" and pct > 0:
            fee_bs = max(MIN_PAGO_MOVIL_FEE_VES, calc_fee)
        else:
            fee_bs = calc_fee
    else:
        pct = float(account.transfer_fee_pct or 0.0)
        fee_bs = round(fiat_amt * (pct / 100.0), 2) if pct > 0 else 0.0

    return round(fee_bs, 2), round(pct, 3)


def compute_bank_inventory_summary(db: Session) -> Dict[str, Any]:
    """
    Calcula en tiempo real el inventario en Bs de cada cuenta bancaria y la Posición Consolidada Total de forma optimizada:
    - Utiliza consultas agregadas en SQL para totales históricos y WAC global en milisegundos.
    - Carga en memoria únicamente las órdenes relevantes: posteriores al corte más antiguo de las cuentas,
      órdenes del día de hoy, reasignadas manualmente o las más recientes para movimientos.
    - Las órdenes nuevas posteriores al corte (order_ts > anchor_timestamp) actualizan automáticamente el saldo en Bs.
    """
    accounts = ensure_bank_accounts_from_orders(db)

    # Si alguna cuenta quedó con anchor_timestamp == 0 (sin corte definido), fijar el corte actual en 0 Bs
    now_ms = int(datetime.now().timestamp() * 1000)
    latest_ts = get_latest_ves_order_timestamp_ms(db)
    default_cut_ts = max(now_ms, latest_ts)
    fixed_zero_anchor = False
    for acc in accounts:
        if int(acc.anchor_timestamp or 0) <= 0:
            acc.anchor_timestamp = default_cut_ts
            if not acc.anchor_date_label or acc.anchor_date_label.startswith("Saldo Inicial"):
                acc.anchor_date_label = "Cuadre por Defecto (0,00 Bs)"
            fixed_zero_anchor = True
    if fixed_zero_anchor:
        db.commit()

    today_str = datetime.now().strftime("%Y-%m-%d")

    # 1. Total histórico de órdenes asociadas por cuenta (conteo agrupado ultrarrápido en SQL)
    acc_counts: Dict[int, int] = {acc.id: 0 for acc in accounts}
    grouped_counts = (
        db.query(
            BinanceOrder.bank_account_id,
            BinanceOrder.pay_method,
            func.count(BinanceOrder.id),
        )
        .filter(
            or_(
                BinanceOrder.order_status == "COMPLETED",
                BinanceOrder.order_status.is_(None),
            ),
        )
        .group_by(BinanceOrder.bank_account_id, BinanceOrder.pay_method)
        .all()
    )

    class _MockOrder:
        __slots__ = ("pay_method", "bank_account_id")
        def __init__(self, pm, b_id):
            self.pay_method = pm
            self.bank_account_id = b_id

    for b_id, pm, cnt in grouped_counts:
        matched = resolve_order_bank_account(_MockOrder(pm, b_id), accounts)
        if matched:
            acc_counts[matched.id] += cnt

    # 2. Identificar tasa de referencia reciente (eliminando promedios históricos antiguos):
    # - Si no hay compras hoy, buscar la última orden de compra ejecutada (más reciente).
    # - Si no hay compras en el historial, buscar la última orden de venta ejecutada.
    last_buy_order = (
        db.query(BinanceOrder.unit_price)
        .filter(
            BinanceOrder.fiat_currency == "VES",
            BinanceOrder.order_type == "COMPRA",
            BinanceOrder.unit_price > 0,
            or_(
                BinanceOrder.order_status == "COMPLETED",
                BinanceOrder.order_status.is_(None),
            ),
        )
        .order_by(BinanceOrder.order_date.desc(), BinanceOrder.id.desc())
        .first()
    )
    last_buy_rate = float(last_buy_order[0] or 0.0) if last_buy_order else 0.0

    last_sell_order = None
    if last_buy_rate <= 0:
        last_sell_order = (
            db.query(BinanceOrder.unit_price)
            .filter(
                BinanceOrder.fiat_currency == "VES",
                BinanceOrder.order_type == "VENTA",
                BinanceOrder.unit_price > 0,
                or_(
                    BinanceOrder.order_status == "COMPLETED",
                    BinanceOrder.order_status.is_(None),
                ),
            )
            .order_by(BinanceOrder.order_date.desc(), BinanceOrder.id.desc())
            .first()
        )
    last_sell_rate = float(last_sell_order[0] or 0.0) if last_sell_order else 0.0

    # 3. Estructuras acumuladoras por cuenta
    acc_stats: Dict[int, Dict[str, Any]] = {}
    for acc in accounts:
        acc_stats[acc.id] = {
            "id": acc.id,
            "name": acc.name,
            "binance_pay_id": acc.binance_pay_id or "",
            "pay_method_identifier": acc.pay_method_identifier or "",
            "account_alias": acc.account_alias or "",
            "fiat_currency": acc.fiat_currency or "VES",
            "match_keywords": acc.match_keywords or "",
            "is_default": bool(acc.is_default),
            "is_active": bool(getattr(acc, "is_active", 1) if getattr(acc, "is_active", 1) is not None else 1),
            "apply_buy_fee": bool(acc.apply_buy_fee),
            "pago_movil_fee_pct": round(float(acc.pago_movil_fee_pct or 0.0), 3),
            "transfer_fee_pct": round(float(acc.transfer_fee_pct or 0.0), 3),
            "anchor_balance": round(float(acc.anchor_balance or 0.0), 2),
            "anchor_timestamp": int(acc.anchor_timestamp or 0),
            "anchor_date_label": acc.anchor_date_label or "Cuadre por Defecto (0,00 Bs)",
            "manual_delta_bs": round(float(acc.manual_delta_bs or 0.0), 2),
            # Acumuladores desde el último cuadre (anchor_timestamp)
            "inflow_sell_bs": 0.0,
            "outflow_buy_bs": 0.0,
            "outflow_buy_fees_bs": 0.0,
            "orders_since_anchor_count": 0,
            "buy_since_anchor_count": 0,
            "sell_since_anchor_count": 0,
            # Acumuladores exclusivos del día de HOY
            "today_inflow_sell_bs": 0.0,
            "today_outflow_buy_bs": 0.0,
            "today_outflow_fees_bs": 0.0,
            "today_orders_count": 0,
            "today_buy_count": 0,
            "today_sell_count": 0,
            # Total histórico de órdenes asociadas a este banco
            "total_historical_orders": acc_counts.get(acc.id, 0),
            "recent_movements": [],
        }

    # 4. Traer órdenes relevantes de forma eficiente:
    # - Posteriores al menor anchor_timestamp de las cuentas activas
    # - Órdenes de HOY
    # - Órdenes recientes para poblar el historial de movimientos de las cuentas
    min_anchor_ts = min((int(a.anchor_timestamp or 0) for a in accounts), default=0)

    # Identificar IDs recientes en una sola consulta consolidada (últimas 25 * len(accounts) órdenes)
    recent_sample_limit = max(100, len(accounts) * 25)
    recent_order_ids = [
        r[0]
        for r in (
            db.query(BinanceOrder.id)
            .filter(
                or_(
                    BinanceOrder.order_status == "COMPLETED",
                    BinanceOrder.order_status.is_(None),
                ),
            )
            .order_by(BinanceOrder.order_date.desc(), BinanceOrder.id.desc())
            .limit(recent_sample_limit)
            .all()
        )
    ]

    filter_conditions = [
        BinanceOrder.create_timestamp >= min_anchor_ts,
        BinanceOrder.order_date >= f"{today_str} 00:00:00",
    ]
    if recent_order_ids:
        filter_conditions.append(BinanceOrder.id.in_(recent_order_ids))

    orders_query = db.query(BinanceOrder).filter(
        or_(
            BinanceOrder.order_status == "COMPLETED",
            BinanceOrder.order_status.is_(None),
        ),
        or_(*filter_conditions),
    ).order_by(BinanceOrder.order_date.asc(), BinanceOrder.id.asc())

    orders = orders_query.all()

    today_buy_fiat = 0.0
    today_buy_usdt = 0.0

    for o in orders:
        fiat_amt = round(float(o.fiat_amount or 0.0), 2)
        crypto_amt = float(o.crypto_amount or 0.0)
        order_ts = parse_order_timestamp_ms(o)
        is_today = (o.order_date or "").startswith(today_str)

        if o.order_type == "COMPRA" and is_today:
            today_buy_fiat += fiat_amt
            today_buy_usdt += crypto_amt

        matched_acc = resolve_order_bank_account(o, accounts)
        if not matched_acc:
            continue

        st = acc_stats[matched_acc.id]
        fee_bs, fee_pct = compute_order_bank_fee_bs(o, matched_acc)
        anchor_ts = int(matched_acc.anchor_timestamp or 0)
        # El impacto en saldo depende estrictamente de si la orden es posterior al corte (order_ts > anchor_ts)
        is_after_anchor = (order_ts > anchor_ts)

        if o.order_type == "VENTA":
            signed_bs = fiat_amt
        else:
            signed_bs = -(fiat_amt + fee_bs)

        if is_after_anchor:
            st["orders_since_anchor_count"] += 1
            if o.order_type == "VENTA":
                st["inflow_sell_bs"] = round(st["inflow_sell_bs"] + fiat_amt, 2)
                st["sell_since_anchor_count"] += 1
            else:
                st["outflow_buy_bs"] = round(st["outflow_buy_bs"] + fiat_amt, 2)
                st["outflow_buy_fees_bs"] = round(st["outflow_buy_fees_bs"] + fee_bs, 2)
                st["buy_since_anchor_count"] += 1

        if is_today:
            st["today_orders_count"] += 1
            if o.order_type == "VENTA":
                st["today_inflow_sell_bs"] = round(st["today_inflow_sell_bs"] + fiat_amt, 2)
                st["today_sell_count"] += 1
            else:
                st["today_outflow_buy_bs"] = round(st["today_outflow_buy_bs"] + fiat_amt, 2)
                st["today_outflow_fees_bs"] = round(st["today_outflow_fees_bs"] + fee_bs, 2)
                st["today_buy_count"] += 1

        st["recent_movements"].append(
            {
                "order_id": o.id,
                "order_number": o.order_number,
                "order_date": o.order_date,
                "order_type": o.order_type,
                "pay_method": o.pay_method,
                "payment_channel": resolve_order_payment_channel(o, matched_acc),
                "counterparty": o.counterparty,
                "crypto_amount": round(crypto_amt, 2),
                "unit_price": round(float(o.unit_price or 0.0), 4),
                "fiat_amount": round(fiat_amt, 2),
                "bank_fee_bs": round(fee_bs, 2),
                "bank_fee_pct": round(fee_pct, 2),
                "net_bs_impact": round(signed_bs, 2),
                "included_after_anchor": is_after_anchor,
                "is_today": is_today,
            }
        )

    # Calcular saldos finales por cuenta y consolidado general:
    # Saldo Calculado = Saldo Base (Cuadre) + Ventas post-corte - Compras post-corte - Comisiones post-corte + Manual
    total_calculated_balance_bs = 0.0
    total_anchor_balance_bs = 0.0
    total_inflow_sell_bs = 0.0
    total_outflow_buy_bs = 0.0
    total_outflow_fees_bs = 0.0
    total_manual_delta_bs = 0.0

    total_today_inflow_bs = 0.0
    total_today_outflow_bs = 0.0
    total_today_fees_bs = 0.0
    total_today_orders = 0

    accounts_list = []
    for acc in accounts:
        st = acc_stats[acc.id]
        net_orders_flow = (
            st["inflow_sell_bs"] - st["outflow_buy_bs"] - st["outflow_buy_fees_bs"]
        )
        calculated_balance = (
            st["anchor_balance"] + net_orders_flow + st["manual_delta_bs"]
        )
        today_net_flow = (
            st["today_inflow_sell_bs"]
            - st["today_outflow_buy_bs"]
            - st["today_outflow_fees_bs"]
        )

        st["inflow_sell_bs"] = round(st["inflow_sell_bs"], 2)
        st["outflow_buy_bs"] = round(st["outflow_buy_bs"], 2)
        st["outflow_buy_fees_bs"] = round(st["outflow_buy_fees_bs"], 2)
        st["net_orders_flow_bs"] = round(net_orders_flow, 2)
        st["calculated_balance"] = round(calculated_balance, 2)

        st["today_inflow_sell_bs"] = round(st["today_inflow_sell_bs"], 2)
        st["today_outflow_buy_bs"] = round(st["today_outflow_buy_bs"], 2)
        st["today_outflow_fees_bs"] = round(st["today_outflow_fees_bs"], 2)
        st["today_net_flow_bs"] = round(today_net_flow, 2)

        # Invertir recent_movements para mostrar los más recientes primero (máx 25 por cuenta)
        st["recent_movements"] = list(reversed(st["recent_movements"]))[:25]

        total_calculated_balance_bs += calculated_balance
        total_anchor_balance_bs += st["anchor_balance"]
        total_inflow_sell_bs += st["inflow_sell_bs"]
        total_outflow_buy_bs += st["outflow_buy_bs"]
        total_outflow_fees_bs += st["outflow_buy_fees_bs"]
        total_manual_delta_bs += st["manual_delta_bs"]

        total_today_inflow_bs += st["today_inflow_sell_bs"]
        total_today_outflow_bs += st["today_outflow_buy_bs"]
        total_today_fees_bs += st["today_outflow_fees_bs"]
        total_today_orders += st["today_orders_count"]

        accounts_list.append(st)

    # Determinación escalonada de la tasa de referencia (sin promedios históricos antiguos):
    # 1) WAC de compras de hoy
    # 2) Último precio de compra ejecutado (más reciente)
    # 3) Último precio de venta ejecutado (si no hay compras)
    if today_buy_usdt > 0:
        ref_wac = today_buy_fiat / today_buy_usdt
        ref_rate_source = "WAC_HOY"
    elif last_buy_rate > 0:
        ref_wac = last_buy_rate
        ref_rate_source = "LAST_BUY"
    elif last_sell_rate > 0:
        ref_wac = last_sell_rate
        ref_rate_source = "LAST_SELL"
    else:
        ref_wac = 0.0
        ref_rate_source = "NONE"

    equivalent_usdt = (
        (total_calculated_balance_bs / ref_wac) if ref_wac > 0 else 0.0
    )

    # Últimos ajustes manuales / cuadres realizados
    recent_adjustments = (
        db.query(BankBalanceAdjustment)
        .order_by(BankBalanceAdjustment.id.desc())
        .limit(30)
        .all()
    )

    return {
        "server_today": today_str,
        "consolidated": {
            "total_calculated_balance_bs": round(total_calculated_balance_bs, 2),
            "total_anchor_balance_bs": round(total_anchor_balance_bs, 2),
            "total_inflow_sell_bs": round(total_inflow_sell_bs, 2),
            "total_outflow_buy_bs": round(total_outflow_buy_bs, 2),
            "total_outflow_fees_bs": round(total_outflow_fees_bs, 2),
            "total_manual_delta_bs": round(total_manual_delta_bs, 2),
            "total_net_orders_flow_bs": round(
                total_inflow_sell_bs - total_outflow_buy_bs - total_outflow_fees_bs, 2
            ),
            "today_inflow_sell_bs": round(total_today_inflow_bs, 2),
            "today_outflow_buy_bs": round(total_today_outflow_bs, 2),
            "today_outflow_fees_bs": round(total_today_fees_bs, 2),
            "today_net_flow_bs": round(
                total_today_inflow_bs - total_today_outflow_bs - total_today_fees_bs, 2
            ),
            "today_orders_count": total_today_orders,
            "ref_wac_rate": round(ref_wac, 4),
            "ref_rate_source": ref_rate_source,
            "equivalent_usdt": round(equivalent_usdt, 2),
            "accounts_count": len(accounts_list),
        },
        "accounts": accounts_list,
        "adjustments_history": [
            {
                "id": adj.id,
                "account_id": adj.account_id,
                "account_name": adj.account_name,
                "adjustment_type": adj.adjustment_type,
                "previous_balance": round(float(adj.previous_balance or 0.0), 2),
                "new_balance": round(float(adj.new_balance or 0.0), 2),
                "delta_amount": round(float(adj.delta_amount or 0.0), 2),
                "note": adj.note or "",
                "created_at": adj.created_at_str or "",
            }
            for adj in recent_adjustments
        ],
    }
