import io
from datetime import datetime
from typing import List, Dict, Any
import pandas as pd
from ..models import BinanceOrder, BankTransaction


def run_reconciliation(
    orders: List[BinanceOrder],
    bank_txs: List[BankTransaction],
    tolerance_days: int = 2,
) -> Dict[str, Any]:
    """
    Algoritmo de Conciliación de 2 Niveles (exclusivo sobre órdenes COMPLETADAS):
    - Nivel 1 (Exacto): Número de referencia bancaria coincide o está contenido en la orden/nota, o monto exacto el mismo día.
    - Nivel 2 (Fuzzy / Ventana de tiempo): Monto exacto (±0.5 unidad fiat) dentro de una ventana de ±tolerance_days días.
    """
    orders = [
        o
        for o in orders
        if (getattr(o, "order_status", None) or "COMPLETED") == "COMPLETED"
    ]
    matched_pairs = []
    used_bank_ids = set()
    used_order_ids = set()

    def parse_dt(s: str):
        if not s:
            return None
        s_clean = s.strip()[:10]
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(s_clean, fmt)
            except ValueError:
                continue
        return None

    # Nivel 1: Referencia exacta o Monto exacto en misma fecha
    for o in orders:
        if o.id in used_order_ids:
            continue
        o_dt = parse_dt(o.order_date)
        for b in bank_txs:
            if b.id in used_bank_ids:
                continue
            b_amt = b.debit if o.order_type == "COMPRA" else b.credit
            if b_amt <= 0:
                b_amt = max(b.debit, b.credit)

            ref_clean = (b.reference or "").strip()
            ref_match = (
                len(ref_clean) >= 5
                and ref_clean != "S/R"
                and (
                    ref_clean in (o.reference_note or "")
                    or ref_clean in (o.order_number or "")
                )
            )
            amt_exact = abs(float(o.fiat_amount) - float(b_amt)) <= 0.05
            b_dt = parse_dt(b.tx_date)
            same_day = (o_dt and b_dt and abs((o_dt - b_dt).days) == 0)

            if ref_match or (amt_exact and same_day):
                used_order_ids.add(o.id)
                used_bank_ids.add(b.id)
                o.status = "MATCHED_EXACT"
                b.status = "MATCHED_EXACT"
                b.matched_order_number = o.order_number
                matched_pairs.append({
                    "match_level": "NIVEL_1_EXACTO",
                    "order_id": o.id,
                    "order_number": o.order_number,
                    "order_type": o.order_type,
                    "order_date": o.order_date,
                    "fiat_amount": o.fiat_amount,
                    "crypto_amount": o.crypto_amount,
                    "counterparty": o.counterparty,
                    "bank_id": b.id,
                    "tx_date": b.tx_date,
                    "reference": b.reference,
                    "description": b.description,
                    "bank_amount": b_amt,
                })
                break

    # Nivel 2: Monto cercano en ventana de ±tolerance_days días
    for o in orders:
        if o.id in used_order_ids:
            continue
        o_dt = parse_dt(o.order_date)
        for b in bank_txs:
            if b.id in used_bank_ids:
                continue
            b_amt = b.debit if o.order_type == "COMPRA" else b.credit
            if b_amt <= 0:
                b_amt = max(b.debit, b.credit)

            amt_close = abs(float(o.fiat_amount) - float(b_amt)) <= 1.0
            if not amt_close:
                continue

            b_dt = parse_dt(b.tx_date)
            in_window = True
            if o_dt and b_dt:
                in_window = abs((o_dt - b_dt).days) <= tolerance_days

            if amt_close and in_window:
                used_order_ids.add(o.id)
                used_bank_ids.add(b.id)
                o.status = "MATCHED_FUZZY"
                b.status = "MATCHED_FUZZY"
                b.matched_order_number = o.order_number
                matched_pairs.append({
                    "match_level": "NIVEL_2_VENTANA",
                    "order_id": o.id,
                    "order_number": o.order_number,
                    "order_type": o.order_type,
                    "order_date": o.order_date,
                    "fiat_amount": o.fiat_amount,
                    "crypto_amount": o.crypto_amount,
                    "counterparty": o.counterparty,
                    "bank_id": b.id,
                    "tx_date": b.tx_date,
                    "reference": b.reference,
                    "description": b.description,
                    "bank_amount": b_amt,
                })
                break

    unmatched_orders = [
        {
            "id": o.id,
            "order_number": o.order_number,
            "order_type": o.order_type,
            "order_date": o.order_date,
            "fiat_currency": o.fiat_currency,
            "fiat_amount": o.fiat_amount,
            "crypto_amount": o.crypto_amount,
            "unit_price": o.unit_price,
            "counterparty": o.counterparty,
            "pay_method": o.pay_method,
        }
        for o in orders
        if o.id not in used_order_ids
    ]

    unmatched_bank = [
        {
            "id": b.id,
            "tx_date": b.tx_date,
            "reference": b.reference,
            "description": b.description,
            "debit": b.debit,
            "credit": b.credit,
            "balance": b.balance,
        }
        for b in bank_txs
        if b.id not in used_bank_ids
    ]

    return {
        "matched_count": len(matched_pairs),
        "unmatched_orders_count": len(unmatched_orders),
        "unmatched_bank_count": len(unmatched_bank),
        "matched_pairs": matched_pairs,
        "unmatched_orders": unmatched_orders,
        "unmatched_bank": unmatched_bank,
    }


def export_operations_excel(orders: List[BinanceOrder], analytics: Dict[str, Any]) -> bytes:
    """Genera un archivo Excel (.xlsx) con Resumen Financiero P&L y Libro de Operaciones P2P."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        # Hoja 1: Resumen Ejecutivo P&L
        summary_rows = [
            {"Métrica": "Moneda Fiat Principal", "Valor": analytics.get("primary_fiat", "VES")},
            {"Métrica": "Total Operaciones Completadas", "Valor": analytics.get("total_orders", 0)},
            {"Métrica": "Total Órdenes Canceladas", "Valor": analytics.get("cancelled_orders", 0)},
            {"Métrica": "Tasa de Finalización (%)", "Valor": f"{analytics.get('completion_rate_pct', 100.0)}%"},
            {"Métrica": "Órdenes Completadas Compra / Venta", "Valor": f"{analytics.get('buy_count', 0)} / {analytics.get('sell_count', 0)}"},
            {"Métrica": "Volumen Total Compras (Fiat)", "Valor": analytics.get("buy_fiat_total", 0.0)},
            {"Métrica": "Volumen Total Ventas (Fiat)", "Valor": analytics.get("sell_fiat_total", 0.0)},
            {"Métrica": "Total USDT Comprados", "Valor": analytics.get("buy_usdt_total", 0.0)},
            {"Métrica": "Total USDT Vendidos", "Valor": analytics.get("sell_usdt_total", 0.0)},
            {"Métrica": "Costo Promedio Ponderado Compra (WAC)", "Valor": analytics.get("wac_buy_price", 0.0)},
            {"Métrica": "Precio Promedio Ponderado Venta (WAP)", "Valor": analytics.get("wap_sell_price", 0.0)},
            {"Métrica": "Spread Promedio Obtenido (%)", "Valor": f"{analytics.get('spread_pct', 0.0)}%"},
            {"Métrica": "Comisiones Binance P2P (USDT)", "Valor": analytics.get("total_commission_usdt", 0.0)},
            {"Métrica": "Ganancia Bruta Realizada (Fiat)", "Valor": analytics.get("gross_profit_fiat", 0.0)},
            {"Métrica": "Ganancia Neta Estimada (Fiat)", "Valor": analytics.get("net_profit_fiat", 0.0)},
            {"Métrica": "Ganancia Neta Estimada (USDT)", "Valor": analytics.get("net_profit_usdt", 0.0)},
        ]
        pd.DataFrame(summary_rows).to_excel(writer, index=False, sheet_name="Resumen_PnL")

        # Hoja 2: Libro Mayor de Operaciones P2P
        ops_rows = [
            {
                "Fecha": o.order_date,
                "ID Orden": o.order_number,
                "Estado Orden": (getattr(o, "order_status", None) or "COMPLETED"),
                "Tipo": o.order_type,
                "Activo": o.asset,
                "Moneda Fiat": o.fiat_currency,
                "Monto Fiat": o.fiat_amount,
                "Precio Unitario (Tasa)": o.unit_price,
                "Cantidad USDT": o.crypto_amount,
                "Comisión USDT": o.commission_usdt,
                "Método de Pago": o.pay_method,
                "Contraparte": o.counterparty,
                "Estado Conciliación": o.status,
                "Origen": o.source,
            }
            for o in orders
        ]
        pd.DataFrame(ops_rows).to_excel(writer, index=False, sheet_name="Operaciones_P2P")

        # Hoja 3: Desglose Diario
        if analytics.get("daily_series"):
            pd.DataFrame(analytics["daily_series"]).to_excel(writer, index=False, sheet_name="Rendimiento_Diario")

    return output.getvalue()
