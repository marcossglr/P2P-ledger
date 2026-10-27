from typing import List, Dict, Any, Optional
from collections import defaultdict
from ..models import BinanceOrder, BankAccount
from .bank_inventory import resolve_order_payment_channel, resolve_order_bank_account


def compute_operations_analytics(
    orders: List[BinanceOrder],
    bank_fee_rate_pct: float = 0.0,
    accounts: Optional[List[BankAccount]] = None,
    target_asset: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calcula todas las métricas financieras de arbitraje P2P:
    - Volumen Fiat y Crypto (Compras vs Ventas)
    - Costo Promedio Ponderado de Compra (WAC) vs Precio Promedio Ponderado de Venta (WAP)
    - Spread Promedio Ponderado (absoluto y porcentual)
    - Comisiones de Binance P2P en Crypto y su impacto en Fiat
    - Comisiones bancarias en Bs aplicadas a compras por Pago Móvil
    - Ganancia Bruta y Ganancia Neta realizada sobre el volumen arbitrado (ciclo cerrado)
    - Serie temporal diaria, métodos de pago y top contrapartes
    """
    buy_fiat = 0.0
    buy_usdt = 0.0
    buy_comm_usdt = 0.0
    buy_count = 0
    buy_pago_movil_fiat = 0.0
    buy_pago_movil_count = 0
    buy_transfer_fiat = 0.0
    buy_transfer_count = 0

    sell_fiat = 0.0
    sell_usdt = 0.0
    sell_comm_usdt = 0.0
    sell_count = 0

    completed_orders_count = 0
    cancelled_orders_count = 0
    in_progress_orders_count = 0
    cancelled_buy_count = 0
    cancelled_sell_count = 0

    daily_map = defaultdict(lambda: {
        "date": "",
        "buy_fiat": 0.0,
        "buy_usdt": 0.0,
        "buy_pago_movil_fiat": 0.0,
        "sell_fiat": 0.0,
        "sell_usdt": 0.0,
        "comm_usdt": 0.0,
        "orders_count": 0,
        "cancelled_count": 0,
        "in_progress_count": 0,
    })

    pay_methods_map = defaultdict(lambda: {"name": "", "count": 0, "fiat_volume": 0.0, "usdt_volume": 0.0})
    counterparties_map = defaultdict(lambda: {"name": "", "count": 0, "fiat_volume": 0.0, "usdt_volume": 0.0})
    fiat_currencies = set()
    crypto_assets = set()

    for o in orders:
        fiat_currencies.add(o.fiat_currency or "VES")
        if o.asset:
            crypto_assets.add(o.asset)

    # Si no se especifica target_asset, usar "USDT" o el primero disponible
    active_asset = target_asset or ("USDT" if "USDT" in crypto_assets else (sorted(list(crypto_assets))[0] if crypto_assets else "USDT"))

    for o in orders:
        ord_asset = o.asset or "USDT"
        # Si la orden pertenece a otro criptoactivo diferente al seleccionado, no mezclar en WAC/WAP/P&L
        if ord_asset != active_asset:
            continue

        ord_status = (getattr(o, "order_status", None) or "COMPLETED").upper()
        day_key = (o.order_date or "")[:10] or "Sin Fecha"

        if ord_status == "CANCELLED":
            cancelled_orders_count += 1
            if o.order_type == "COMPRA":
                cancelled_buy_count += 1
            elif o.order_type == "VENTA":
                cancelled_sell_count += 1
            if day_key in daily_map:
                daily_map[day_key]["cancelled_count"] += 1
            continue

        if ord_status == "IN_PROGRESS":
            in_progress_orders_count += 1
            if day_key in daily_map:
                daily_map[day_key]["in_progress_count"] += 1
            continue

        completed_orders_count += 1
        d_entry = daily_map[day_key]
        d_entry["date"] = day_key
        d_entry["orders_count"] += 1

        pm_name = o.pay_method or "No especificado"
        pay_methods_map[pm_name]["name"] = pm_name
        pay_methods_map[pm_name]["count"] += 1
        pay_methods_map[pm_name]["fiat_volume"] += float(o.fiat_amount or 0.0)
        pay_methods_map[pm_name]["usdt_volume"] += float(o.crypto_amount or 0.0)

        cp_name = o.counterparty or "Anónimo"
        counterparties_map[cp_name]["name"] = cp_name
        counterparties_map[cp_name]["count"] += 1
        counterparties_map[cp_name]["fiat_volume"] += float(o.fiat_amount or 0.0)
        counterparties_map[cp_name]["usdt_volume"] += float(o.crypto_amount or 0.0)

        if o.order_type == "COMPRA":
            f_amt = float(o.fiat_amount or 0.0)
            c_gross = float(o.crypto_amount or 0.0)
            c_comm = float(o.commission_usdt or 0.0)
            buy_fiat += f_amt
            buy_usdt += c_gross
            buy_comm_usdt += c_comm
            buy_count += 1
            d_entry["buy_fiat"] += f_amt
            d_entry["buy_usdt"] += c_gross
            d_entry["comm_usdt"] += c_comm
            if resolve_order_payment_channel(o, resolve_order_bank_account(o, accounts or [])) == "PAGO_MOVIL":
                buy_pago_movil_fiat += f_amt
                buy_pago_movil_count += 1
                d_entry["buy_pago_movil_fiat"] += f_amt
            else:
                buy_transfer_fiat += f_amt
                buy_transfer_count += 1
        elif o.order_type == "VENTA":
            f_amt = float(o.fiat_amount or 0.0)
            c_gross = float(o.crypto_amount or 0.0)
            c_comm = float(o.commission_usdt or 0.0)
            sell_fiat += f_amt
            sell_usdt += c_gross
            sell_comm_usdt += c_comm
            sell_count += 1
            d_entry["sell_fiat"] += f_amt
            d_entry["sell_usdt"] += c_gross
            d_entry["comm_usdt"] += c_comm

    # 1. Costos y Precios Promedio Ponderados Puros de Mercado (WAC y WAP)
    # Reflejan exactamente las tasas unitarias negociadas en los anuncios y órdenes
    wac_buy = (buy_fiat / buy_usdt) if buy_usdt > 0 else 0.0
    wap_sell = (sell_fiat / sell_usdt) if sell_usdt > 0 else 0.0

    # 2. Spread Unitario y Margen Porcentual de Mercado
    spread_abs = (wap_sell - wac_buy) if (wac_buy > 0 and wap_sell > 0) else 0.0
    spread_pct = ((wap_sell - wac_buy) / wac_buy * 100.0) if (wac_buy > 0 and wap_sell > 0) else 0.0

    # 3. Volumen USDT Arbitrado / Ciclo Cerrado
    matched_usdt_volume = min(buy_usdt, sell_usdt)
    gross_profit_fiat = matched_usdt_volume * spread_abs if matched_usdt_volume > 0 else 0.0

    # 4. Total de Comisiones Operativas
    # Comisiones de Binance P2P (Maker + Taker de Compras y Ventas)
    total_comm_usdt = buy_comm_usdt + sell_comm_usdt
    ref_rate = wac_buy if wac_buy > 0 else wap_sell
    comm_fiat_cost = total_comm_usdt * ref_rate

    # Comisión bancaria en Bs: aplica únicamente a compras por Pago Móvil (Transferencias mismo banco = 0%)
    estimated_bank_fees_fiat = (
        buy_pago_movil_fiat * (bank_fee_rate_pct / 100.0)
        if bank_fee_rate_pct > 0
        else 0.0
    )

    # 5. Ganancia Neta Realizada (P&L Limpio)
    # P&L Neto (Fiat) = Ganancia Bruta - Costo Comisiones Binance (Fiat) - Comisiones Bancarias (Fiat)
    net_profit_fiat = gross_profit_fiat - comm_fiat_cost - estimated_bank_fees_fiat

    # P&L Neto (USDT): Expresado en la moneda base de capital al costo de reposición WAC
    net_profit_usdt = (net_profit_fiat / ref_rate) if ref_rate > 0 else 0.0

    # Construir serie diaria ordenada cronológicamente (solo días con órdenes completadas)
    daily_series = []
    for day_key in sorted(daily_map.keys()):
        d = daily_map[day_key]
        if d["orders_count"] == 0:
            continue
        d_wac = (d["buy_fiat"] / d["buy_usdt"]) if d["buy_usdt"] > 0 else wac_buy
        d_wap = (d["sell_fiat"] / d["sell_usdt"]) if d["sell_usdt"] > 0 else wap_sell
        d_matched = min(d["buy_usdt"], d["sell_usdt"])
        d_spread = (d_wap - d_wac) if (d_wac > 0 and d_wap > 0) else 0.0
        d_gross = d_matched * d_spread
        d_ref_rate = d_wac if d_wac > 0 else (d_wap if d_wap > 0 else ref_rate)
        d_comm_fiat = d["comm_usdt"] * d_ref_rate
        d_bank_fee_fiat = (
            d["buy_pago_movil_fiat"] * (bank_fee_rate_pct / 100.0)
            if bank_fee_rate_pct > 0
            else 0.0
        )
        d_net_fiat = d_gross - d_comm_fiat - d_bank_fee_fiat
        d_net_usdt = (d_net_fiat / d_ref_rate) if d_ref_rate > 0 else 0.0

        daily_series.append({
            "date": day_key,
            "buy_fiat": round(d["buy_fiat"], 2),
            "buy_usdt": round(d["buy_usdt"], 2),
            "sell_fiat": round(d["sell_fiat"], 2),
            "sell_usdt": round(d["sell_usdt"], 2),
            "matched_usdt": round(d_matched, 4),
            "avg_buy_price": round(d_wac, 4),
            "avg_sell_price": round(d_wap, 4),
            "spread_pct": round((d_spread / d_wac * 100.0) if d_wac > 0 else 0.0, 2),
            "comm_usdt": round(d["comm_usdt"], 4),
            "comm_fiat": round(d_comm_fiat, 2),
            "bank_fee_fiat": round(d_bank_fee_fiat, 2),
            "gross_profit_fiat": round(d_gross, 2),
            "net_profit_fiat": round(d_net_fiat, 2),
            "net_profit_usdt": round(d_net_usdt, 2),
            "orders_count": d["orders_count"],
            "cancelled_count": d["cancelled_count"],
        })

    primary_fiat = sorted(list(fiat_currencies))[0] if fiat_currencies else "VES"
    available_assets = sorted(list(crypto_assets)) if crypto_assets else ["USDT"]
    if "USDT" not in available_assets:
        available_assets.insert(0, "USDT")
    total_all = completed_orders_count + cancelled_orders_count + in_progress_orders_count
    completion_rate = (completed_orders_count / total_all * 100.0) if total_all > 0 else 100.0

    return {
        "target_asset": active_asset,
        "available_assets": available_assets,
        "primary_fiat": primary_fiat,
        "fiat_currencies": sorted(list(fiat_currencies)),
        "total_orders": completed_orders_count,
        "completed_orders": completed_orders_count,
        "cancelled_orders": cancelled_orders_count,
        "in_progress_orders": in_progress_orders_count,
        "cancelled_buy_count": cancelled_buy_count,
        "cancelled_sell_count": cancelled_sell_count,
        "all_orders_count": total_all,
        "completion_rate_pct": round(completion_rate, 1),
        "buy_count": buy_count,
        "sell_count": sell_count,
        "buy_pago_movil_count": buy_pago_movil_count,
        "buy_pago_movil_fiat": round(buy_pago_movil_fiat, 2),
        "buy_transfer_count": buy_transfer_count,
        "buy_transfer_fiat": round(buy_transfer_fiat, 2),
        "buy_fiat_total": round(buy_fiat, 2),
        "sell_fiat_total": round(sell_fiat, 2),
        "total_fiat_volume": round(buy_fiat + sell_fiat, 2),
        "buy_usdt_total": round(buy_usdt, 4),
        "sell_usdt_total": round(sell_usdt, 4),
        "total_usdt_volume": round(buy_usdt + sell_usdt, 4),
        "matched_usdt_volume": round(matched_usdt_volume, 4),
        "net_inventory_usdt": round((buy_usdt - buy_comm_usdt) - (sell_usdt + sell_comm_usdt), 4),
        "wac_buy_price": round(wac_buy, 4),
        "wap_sell_price": round(wap_sell, 4),
        "spread_abs": round(spread_abs, 4),
        "spread_pct": round(spread_pct, 3),
        "total_commission_usdt": round(total_comm_usdt, 4),
        "commission_fiat_cost": round(comm_fiat_cost, 2),
        "estimated_bank_fees_fiat": round(estimated_bank_fees_fiat, 2),
        "gross_profit_fiat": round(gross_profit_fiat, 2),
        "net_profit_fiat": round(net_profit_fiat, 2),
        "net_profit_usdt": round(net_profit_usdt, 2),
        "daily_series": daily_series,
        "payment_methods": sorted(pay_methods_map.values(), key=lambda x: x["fiat_volume"], reverse=True)[:6],
        "top_counterparties": sorted(counterparties_map.values(), key=lambda x: x["fiat_volume"], reverse=True)[:6],
    }
