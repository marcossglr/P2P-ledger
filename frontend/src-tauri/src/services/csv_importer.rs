use chrono::NaiveDateTime;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BinanceCsvImportResult {
    pub filename: String,
    pub total_rows_raw: usize,
    pub valid_rows: usize,
    pub new_orders: usize,
    pub updated_orders: usize,
}

#[derive(Debug, Clone)]
struct ParsedCsvOrder {
    order_number: String,
    adv_no: String,
    order_type: String,
    asset: String,
    fiat_currency: String,
    fiat_amount: f64,
    crypto_amount: f64,
    unit_price: f64,
    commission_usdt: f64,
    pay_method: String,
    counterparty: String,
    create_timestamp: i64,
    order_date: String,
    order_status: String,
    source: String,
}

fn parse_number(val: &str) -> f64 {
    let s = val.trim();
    if s.is_empty() {
        return 0.0;
    }

    let is_negative = s.contains('-') || (s.contains('(') && s.contains(')'));
    let cleaned: String = s.chars().filter(|c| c.is_ascii_digit() || *c == '.' || *c == ',').collect();
    if cleaned.is_empty() {
        return 0.0;
    }

    let normalized = if cleaned.contains(',') && cleaned.contains('.') {
        if cleaned.rfind(',').unwrap() > cleaned.rfind('.').unwrap() {
            cleaned.replace('.', "").replace(',', ".")
        } else {
            cleaned.replace(',', "")
        }
    } else if cleaned.contains(',') {
        let parts: Vec<&str> = cleaned.split(',').collect();
        if parts.len() == 2 && parts[1].len() <= 2 {
            cleaned.replace(',', ".")
        } else {
            cleaned.replace(',', "")
        }
    } else {
        cleaned
    };

    let n: f64 = normalized.parse().unwrap_or(0.0);
    if is_negative { -n } else { n }
}

fn parse_date_to_timestamp(date_str: &str) -> i64 {
    let s = date_str.trim();
    if s.is_empty() || s == "-" {
        return 0;
    }

    let s19 = if s.len() >= 19 { &s[..19] } else { s };

    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    ];

    for fmt in &formats {
        if let Ok(ndt) = NaiveDateTime::parse_from_str(s19, fmt) {
            return ndt.and_utc().timestamp_millis();
        }
    }
    0
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    let mut chars = line.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '"' => {
                if in_quotes && chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' => {
                if in_quotes {
                    current.push(',');
                } else {
                    fields.push(current.trim().to_string());
                    current.clear();
                }
            }
            _ => {
                current.push(c);
            }
        }
    }
    fields.push(current.trim().to_string());
    fields
}

pub fn import_binance_csv_text(
    conn: &Connection,
    csv_text: &str,
    filename: &str,
) -> Result<BinanceCsvImportResult, String> {
    let lines: Vec<&str> = csv_text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
    if lines.is_empty() {
        return Err("El archivo CSV está vacío".to_string());
    }

    let headers = parse_csv_line(lines[0]);
    let header_lower: Vec<String> = headers.iter().map(|h| h.to_lowercase()).collect();

    let find_col = |candidates: &[&str]| -> Option<usize> {
        for cand in candidates {
            for (idx, h) in header_lower.iter().enumerate() {
                if h == *cand {
                    return Some(idx);
                }
            }
        }
        None
    };

    let col_order_no = find_col(&["order number", "número de orden", "order id", "id de orden"]);
    let col_adv_no = find_col(&["advertisement order number", "número de orden del anuncio", "adv no"]);
    let col_type = find_col(&["order type", "tipo de orden", "type", "tipo"]);
    let col_asset = find_col(&["asset type", "tipo de activo", "asset", "activo", "coin"]);
    let col_fiat = find_col(&["fiat type", "moneda fiat", "fiat", "moneda"]);
    let col_total_price = find_col(&["total price", "precio total", "fiat amount", "monto fiat"]);
    let col_unit_price = find_col(&["price", "precio", "unit price", "precio unitario"]);
    let col_quantity = find_col(&["quantity", "cantidad", "crypto amount", "cantidad cripto"]);
    let col_maker_fee = find_col(&["maker fee", "comisión maker", "commission", "comisión"]);
    let col_taker_fee = find_col(&["taker fee", "comisión taker"]);
    let col_pay_method = find_col(&["payment method", "método de pago", "pay method"]);
    let col_counterparty = find_col(&["counterparty", "contraparte", "couterparty"]);
    let col_status = find_col(&["status", "estado"]);
    let col_date = find_col(&["created time", "fecha de creación", "time", "fecha"]);

    let mut parsed_orders = Vec::new();
    let total_rows_raw = lines.len().saturating_sub(1);

    for (row_idx, line) in lines.iter().skip(1).enumerate() {
        let fields = parse_csv_line(line);
        if fields.is_empty() || (fields.len() == 1 && fields[0].is_empty()) {
            continue;
        }

        let get_val = |opt_idx: Option<usize>| -> String {
            opt_idx.and_then(|idx| fields.get(idx)).cloned().unwrap_or_default()
        };

        let raw_status = get_val(col_status).to_lowercase();
        let norm_status = if raw_status.contains("cancel") || raw_status.contains("expired") || raw_status == "6" || raw_status == "7" {
            "CANCELLED"
        } else {
            "COMPLETED"
        };

        let raw_type = get_val(col_type).to_uppercase();
        let norm_type = if raw_type.contains("BUY") || raw_type.contains("COMPRA") {
            "COMPRA"
        } else if raw_type.contains("SELL") || raw_type.contains("VENTA") {
            "VENTA"
        } else {
            "COMPRA"
        };

        let order_number = {
            let n = get_val(col_order_no);
            if n.is_empty() {
                format!("CSV-ROW-{}", row_idx + 1)
            } else {
                n
            }
        };

        let date_str = get_val(col_date);
        let create_ts = parse_date_to_timestamp(&date_str);

        let maker_fee = parse_number(&get_val(col_maker_fee));
        let taker_fee = parse_number(&get_val(col_taker_fee));
        let commission_usdt = maker_fee.abs() + taker_fee.abs();

        let asset = {
            let a = get_val(col_asset);
            if a.is_empty() { "USDT".to_string() } else { a }
        };

        let fiat = {
            let f = get_val(col_fiat);
            if f.is_empty() { "VES".to_string() } else { f }
        };

        let pay_method = {
            let p = get_val(col_pay_method);
            if p.is_empty() { "Transferencia Bancaria".to_string() } else { p }
        };

        parsed_orders.push(ParsedCsvOrder {
            order_number,
            adv_no: get_val(col_adv_no),
            order_type: norm_type.to_string(),
            asset,
            fiat_currency: fiat,
            fiat_amount: parse_number(&get_val(col_total_price)),
            crypto_amount: parse_number(&get_val(col_quantity)),
            unit_price: parse_number(&get_val(col_unit_price)),
            commission_usdt,
            pay_method,
            counterparty: get_val(col_counterparty),
            create_timestamp: create_ts,
            order_date: if date_str.is_empty() { "-".to_string() } else { date_str },
            order_status: norm_status.to_string(),
            source: "CSV".to_string(),
        });
    }

    let valid_rows = parsed_orders.len();
    let mut new_orders = 0;
    let mut updated_orders = 0;

    for ord in &parsed_orders {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM binance_orders WHERE order_number = ?1)",
                [&ord.order_number],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if exists {
            let res = conn.execute(
                "UPDATE binance_orders SET
                    order_status = ?1,
                    fiat_amount = ?2,
                    crypto_amount = ?3,
                    unit_price = ?4,
                    commission_usdt = ?5
                 WHERE order_number = ?6",
                rusqlite::params![
                    ord.order_status,
                    ord.fiat_amount,
                    ord.crypto_amount,
                    ord.unit_price,
                    ord.commission_usdt,
                    ord.order_number,
                ],
            );
            if res.is_ok() {
                updated_orders += 1;
            }
        } else {
            let res = conn.execute(
                "INSERT INTO binance_orders (
                    order_number, adv_no, order_type, asset, fiat_currency,
                    fiat_amount, crypto_amount, unit_price, commission_usdt,
                    pay_method, counterparty, create_timestamp, order_date,
                    order_status, source
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                rusqlite::params![
                    ord.order_number,
                    ord.adv_no,
                    ord.order_type,
                    ord.asset,
                    ord.fiat_currency,
                    ord.fiat_amount,
                    ord.crypto_amount,
                    ord.unit_price,
                    ord.commission_usdt,
                    ord.pay_method,
                    ord.counterparty,
                    ord.create_timestamp,
                    ord.order_date,
                    ord.order_status,
                    ord.source,
                ],
            );
            if res.is_ok() {
                new_orders += 1;
            }
        }
    }

    Ok(BinanceCsvImportResult {
        filename: filename.to_string(),
        total_rows_raw,
        valid_rows,
        new_orders,
        updated_orders,
    })
}
