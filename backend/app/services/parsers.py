import io
import re
import pandas as pd
import pdfplumber
from typing import Dict, Any, List


def normalize_number(val: Any) -> float:
    """
    Normalizador numérico inteligente que soporta formatos con coma o punto decimal:
    Ej: '1.250,50' -> 1250.50 | '1,250.50' -> 1250.50 | '- 450,00' -> -450.0
    """
    if val is None or pd.isna(val):
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)

    s = str(val).strip()
    if not s:
        return 0.0

    # Extraer signo negativo o indicador CR/DB si existe
    is_negative = "-" in s or "(" in s and ")" in s
    # Limpiar símbolos de moneda y letras dejando dígitos, comas y puntos
    cleaned = re.sub(r"[^\d.,]", "", s)
    if not cleaned:
        return 0.0

    if "," in cleaned and "." in cleaned:
        # El último separador define el decimal
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        # Si hay una sola coma y tiene 1 o 2 decimales al final, es coma decimal
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")

    try:
        result = float(cleaned)
        return -result if is_negative else result
    except ValueError:
        return 0.0


def parse_binance_csv(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Lee el CSV exportado de Binance P2P, detecta columnas en inglés o español,
    filtra órdenes completadas y devuelve resumen + vista previa.
    """
    from datetime import datetime

    df = pd.read_csv(io.BytesIO(file_bytes))
    df.columns = [str(c).strip() for c in df.columns]

    # Mapeo flexible de columnas estándar de Binance P2P (ES / EN)
    col_map = {
        "order_number": ["Order Number", "Número de orden", "Order ID", "ID de orden"],
        "adv_no": ["Advertisement Order Number", "Número de orden del anuncio", "Adv No"],
        "order_type": ["Order Type", "Tipo de orden", "Type", "Tipo"],
        "asset": ["Asset Type", "Tipo de activo", "Asset", "Activo", "Coin"],
        "fiat_currency": ["Fiat Type", "Moneda Fiat", "Fiat", "Moneda"],
        "fiat_amount": ["Total Price", "Precio total", "Fiat Amount", "Monto Fiat"],
        "unit_price": ["Price", "Precio", "Unit Price", "Precio unitario"],
        "crypto_amount": ["Quantity", "Cantidad", "Crypto Amount", "Cantidad Cripto"],
        "maker_fee": ["Maker Fee", "Comisión Maker", "Commission", "Comisión"],
        "taker_fee": ["Taker Fee", "Comisión Taker"],
        "pay_method": ["Payment Method", "Método de pago", "Pay Method"],
        "counterparty": ["Counterparty", "Contraparte", "Couterparty"],
        "status": ["Status", "Estado"],
        "order_date": ["Created Time", "Fecha de creación", "Time", "Fecha"],
    }

    resolved = {}
    for key, candidates in col_map.items():
        for cand in candidates:
            matching = [c for c in df.columns if c.lower() == cand.lower()]
            if matching:
                resolved[key] = matching[0]
                break

    records: List[Dict[str, Any]] = []
    for idx, row in df.iterrows():
        status_val = str(row.get(resolved.get("status", ""), "Completed")).strip().lower()
        if status_val in ["completed", "completado", "finalizado", "4"]:
            norm_status = "COMPLETED"
        elif any(tok in status_val for tok in ["cancel", "expired", "6", "7"]):
            norm_status = "CANCELLED"
        else:
            norm_status = "COMPLETED"

        raw_type = str(row.get(resolved.get("order_type", ""), "")).strip().upper()
        norm_type = "COMPRA" if raw_type in ["BUY", "COMPRA"] else ("VENTA" if raw_type in ["SELL", "VENTA"] else raw_type or "N/A")

        order_date_str = str(row.get(resolved.get("order_date", ""), "-")).strip()
        create_ts = 0
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
            try:
                create_ts = int(datetime.strptime(order_date_str[:19], fmt).timestamp() * 1000)
                break
            except ValueError:
                continue

        maker_fee = normalize_number(row.get(resolved.get("maker_fee", ""), 0)) if resolved.get("maker_fee") else 0.0
        taker_fee = normalize_number(row.get(resolved.get("taker_fee", ""), 0)) if resolved.get("taker_fee") else 0.0
        commission_usdt = abs(maker_fee) + abs(taker_fee)

        pay_method_val = str(row.get(resolved.get("pay_method", ""), "Transferencia Bancaria")).strip()
        if not pay_method_val or pay_method_val.lower() == "nan":
            pay_method_val = "Transferencia Bancaria"

        asset_val = str(row.get(resolved.get("asset", ""), "USDT")).strip()
        if not asset_val or asset_val.lower() == "nan":
            asset_val = "USDT"

        adv_val = str(row.get(resolved.get("adv_no", ""), "")).strip()
        if adv_val.lower() == "nan":
            adv_val = ""

        records.append({
            "order_number": str(row.get(resolved.get("order_number", ""), f"ROW-{idx+1}")).strip(),
            "adv_no": adv_val,
            "order_type": norm_type,
            "asset": asset_val,
            "fiat_currency": str(row.get(resolved.get("fiat_currency", ""), "VES")).strip(),
            "fiat_amount": normalize_number(row.get(resolved.get("fiat_amount", ""), 0)),
            "crypto_amount": normalize_number(row.get(resolved.get("crypto_amount", ""), 0)),
            "unit_price": normalize_number(row.get(resolved.get("unit_price", ""), 0)),
            "commission_usdt": commission_usdt,
            "pay_method": pay_method_val,
            "counterparty": str(row.get(resolved.get("counterparty", ""), "-")).strip(),
            "create_timestamp": create_ts,
            "order_date": order_date_str,
            "order_status": norm_status,
            "source": "CSV",
        })

    return {
        "filename": filename,
        "total_rows_raw": len(df),
        "valid_rows": len(records),
        "columns_detected": list(df.columns),
        "preview": records[:8],
        "records": records,
    }


def parse_bank_pdf(file_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Extrae movimientos bancarios desde PDF usando pdfplumber (tablas + líneas de texto con montos).
    """
    records: List[Dict[str, Any]] = []
    total_pages = 0

    date_pattern = re.compile(r"\b(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b")

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        total_pages = len(pdf.pages)
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        if not row:
                            continue
                        cleaned_row = [str(cell).strip().replace("\n", " ") if cell else "" for cell in row]
                        line_str = " ".join(cleaned_row)
                        date_match = date_pattern.search(line_str)
                        if not date_match:
                            continue

                        # Heurística inicial para vista previa tabular
                        non_empty = [c for c in cleaned_row if c]
                        if len(non_empty) >= 3:
                            tx_date = non_empty[0]
                            reference = non_empty[1] if len(non_empty) > 3 else "S/R"
                            description = non_empty[2] if len(non_empty) > 3 else non_empty[1]
                            nums = [normalize_number(c) for c in non_empty[2:] if re.search(r"\d+[.,]\d{2}", c)]
                            debit = 0.0
                            credit = 0.0
                            balance = nums[-1] if len(nums) >= 2 else 0.0
                            if nums:
                                main_amt = nums[0]
                                if main_amt < 0:
                                    debit = abs(main_amt)
                                else:
                                    credit = main_amt

                            records.append({
                                "tx_date": tx_date,
                                "reference": reference,
                                "description": description[:80],
                                "debit": debit,
                                "credit": credit,
                                "balance": balance,
                            })
            else:
                # Fallback: extracción por líneas de texto cuando el PDF no tiene bordes de tabla
                text = page.extract_text() or ""
                for line in text.splitlines():
                    date_match = date_pattern.search(line)
                    amounts = re.findall(r"-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}", line)
                    if date_match and amounts:
                        tx_date = date_match.group(1)
                        ref_match = re.search(r"\b(\d{6,15})\b", line)
                        reference = ref_match.group(1) if ref_match else "S/R"
                        first_amt = normalize_number(amounts[0])
                        bal_amt = normalize_number(amounts[-1]) if len(amounts) > 1 else 0.0
                        records.append({
                            "tx_date": tx_date,
                            "reference": reference,
                            "description": line.strip()[:80],
                            "debit": abs(first_amt) if first_amt < 0 else 0.0,
                            "credit": first_amt if first_amt >= 0 else 0.0,
                            "balance": bal_amt,
                        })

    return {
        "filename": filename,
        "total_pages": total_pages,
        "valid_rows": len(records),
        "preview": records[:8],
        "records": records,
    }
