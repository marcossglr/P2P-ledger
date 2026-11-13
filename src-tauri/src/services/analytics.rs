use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BinanceOrderRecord {
    pub id: i64,
    pub order_number: String,
    pub adv_no: Option<String>,
    pub order_type: String, // "COMPRA" | "VENTA"
    pub asset: String,
    pub fiat_currency: String,
    pub fiat_amount: f64,
    pub crypto_amount: f64,
    pub unit_price: f64,
    pub commission_usdt: f64,
    pub pay_method: Option<String>,
    pub counterparty: Option<String>,
    pub reference_note: Option<String>,
    pub create_timestamp: i64,
    pub order_date: Option<String>,
    pub order_status: String,
    pub source: String,
    pub bank_account_id: Option<i64>,
    pub payment_channel: Option<String>,
    pub bank_fee_fiat: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationsAnalytics {
    pub total_orders: usize,
    pub completed_orders: usize,
    pub buy_count: usize,
    pub sell_count: usize,
    pub buy_fiat: f64,
    pub buy_crypto: f64,
    pub sell_fiat: f64,
    pub sell_crypto: f64,
    pub wac_buy: f64,           // Costo Promedio Ponderado de Compra
    pub wap_sell: f64,          // Precio Promedio Ponderado de Venta
    pub spread_abs: f64,        // WAP - WAC
    pub spread_pct: f64,        // Margen porcentual
    pub matched_volume_crypto: f64,
    pub gross_profit_fiat: f64,
    pub total_bank_fees_fiat: f64,
    pub net_profit_fiat: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationsDashboard {
    pub orders: Vec<BinanceOrderRecord>,
    pub analytics: OperationsAnalytics,
    pub total_stored_orders: usize,
}

pub fn get_operations_data(
    conn: &Connection,
    order_type_filter: Option<String>,
    fiat_filter: Option<String>,
    search_filter: Option<String>,
) -> Result<OperationsDashboard, rusqlite::Error> {
    let target_fiat = fiat_filter.unwrap_or_else(|| "VES".to_string());

    // Cargar cuentas para mapeo de comisiones
    let mut acc_stmt = conn.prepare(
        "SELECT id, pago_movil_fee_pct, apply_buy_fee FROM bank_accounts"
    )?;
    let acc_fees: HashMap<i64, (f64, bool)> = acc_stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let fee: f64 = row.get(1)?;
            let apply: i64 = row.get(2)?;
            Ok((id, (fee, apply != 0)))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let mut query = String::from(
        "SELECT id, order_number, adv_no, order_type, asset, fiat_currency,
                fiat_amount, crypto_amount, unit_price, commission_usdt,
                pay_method, counterparty, reference_note, create_timestamp,
                order_date, order_status, source, bank_account_id, payment_channel
         FROM binance_orders
         WHERE fiat_currency = ?1"
    );

    if let Some(ref ot) = order_type_filter {
        if ot == "COMPRA" || ot == "VENTA" {
            query.push_str(&format!(" AND order_type = '{}'", ot));
        }
    }

    if let Some(ref s) = search_filter {
        if !s.trim().is_empty() {
            let clean = s.replace("'", "''");
            query.push_str(&format!(
                " AND (order_number LIKE '%{0}%' OR counterparty LIKE '%{0}%' OR pay_method LIKE '%{0}%')",
                clean
            ));
        }
    }

    query.push_str(" ORDER BY create_timestamp DESC, id DESC");

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map([&target_fiat], |row| {
        let bank_account_id: Option<i64> = row.get(17)?;
        let payment_channel: Option<String> = row.get(18)?;
        let fiat_amount: f64 = row.get(6)?;
        let order_type: String = row.get(3)?;

        // Calcular comisión bancaria en compras si aplica
        let mut bank_fee = 0.0;
        if order_type == "COMPRA" {
            if let Some(acc_id) = bank_account_id {
                if let Some((fee_pct, apply)) = acc_fees.get(&acc_id) {
                    if *apply {
                        let ch = payment_channel.as_deref().unwrap_or("TRANSFERENCIA");
                        if ch == "PAGO_MOVIL" || ch == "TRANSFERENCIA_INTERBANCARIA" {
                            let calc = (fiat_amount * (fee_pct / 100.0)).round();
                            bank_fee = calc.max(14.0);
                        }
                    }
                }
            }
        }

        Ok(BinanceOrderRecord {
            id: row.get(0)?,
            order_number: row.get(1)?,
            adv_no: row.get(2)?,
            order_type,
            asset: row.get(4)?,
            fiat_currency: row.get(5)?,
            fiat_amount,
            crypto_amount: row.get(7)?,
            unit_price: row.get(8)?,
            commission_usdt: row.get(9)?,
            pay_method: row.get(10)?,
            counterparty: row.get(11)?,
            reference_note: row.get(12)?,
            create_timestamp: row.get(13)?,
            order_date: row.get(14)?,
            order_status: row.get(15)?,
            source: row.get(16)?,
            bank_account_id,
            payment_channel,
            bank_fee_fiat: bank_fee,
        })
    })?;

    let mut orders = Vec::new();
    let mut buy_fiat = 0.0;
    let mut buy_crypto = 0.0;
    let mut buy_count = 0;
    let mut sell_fiat = 0.0;
    let mut sell_crypto = 0.0;
    let mut sell_count = 0;
    let mut total_bank_fees = 0.0;
    let mut completed_orders = 0;

    for r in rows {
        let o = r?;
        if o.order_status == "COMPLETED" {
            completed_orders += 1;
            if o.order_type == "COMPRA" {
                buy_fiat += o.fiat_amount;
                buy_crypto += o.crypto_amount;
                buy_count += 1;
                total_bank_fees += o.bank_fee_fiat;
            } else if o.order_type == "VENTA" {
                sell_fiat += o.fiat_amount;
                sell_crypto += o.crypto_amount;
                sell_count += 1;
            }
        }
        orders.push(o);
    }

    let wac_buy = if buy_crypto > 0.0 { buy_fiat / buy_crypto } else { 0.0 };
    let wap_sell = if sell_crypto > 0.0 { sell_fiat / sell_crypto } else { 0.0 };
    let spread_abs = if wac_buy > 0.0 && wap_sell > 0.0 { wap_sell - wac_buy } else { 0.0 };
    let spread_pct = if wac_buy > 0.0 && wap_sell > 0.0 { (spread_abs / wac_buy) * 100.0 } else { 0.0 };

    let matched_volume = buy_crypto.min(sell_crypto);
    let gross_profit = matched_volume * spread_abs;
    let net_profit = gross_profit - total_bank_fees;

    let total_stored: i64 = conn.query_row(
        "SELECT count(*) FROM binance_orders",
        [],
        |r| r.get(0)
    ).unwrap_or(0);

    Ok(OperationsDashboard {
        total_stored_orders: total_stored as usize,
        analytics: OperationsAnalytics {
            total_orders: orders.len(),
            completed_orders,
            buy_count,
            sell_count,
            buy_fiat: (buy_fiat * 100.0).round() / 100.0,
            buy_crypto: (buy_crypto * 100.0).round() / 100.0,
            sell_fiat: (sell_fiat * 100.0).round() / 100.0,
            sell_crypto: (sell_crypto * 100.0).round() / 100.0,
            wac_buy: (wac_buy * 10000.0).round() / 10000.0,
            wap_sell: (wap_sell * 10000.0).round() / 10000.0,
            spread_abs: (spread_abs * 10000.0).round() / 10000.0,
            spread_pct: (spread_pct * 100.0).round() / 100.0,
            matched_volume_crypto: (matched_volume * 100.0).round() / 100.0,
            gross_profit_fiat: (gross_profit * 100.0).round() / 100.0,
            total_bank_fees_fiat: (total_bank_fees * 100.0).round() / 100.0,
            net_profit_fiat: (net_profit * 100.0).round() / 100.0,
        },
        orders,
    })
}
