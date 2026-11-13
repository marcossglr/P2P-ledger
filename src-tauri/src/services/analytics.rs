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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyPerformanceRecord {
    pub date: String,
    pub orders_count: usize,
    pub buy_fiat: f64,
    pub buy_usdt: f64,
    pub sell_fiat: f64,
    pub sell_usdt: f64,
    pub matched_usdt: f64,
    pub avg_buy_price: f64,
    pub avg_sell_price: f64,
    pub spread_pct: f64,
    pub comm_usdt: f64,
    pub comm_fiat: f64,
    pub bank_fee_fiat: f64,
    pub gross_profit_fiat: f64,
    pub net_profit_fiat: f64,
    pub net_profit_usdt: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopCounterpartyRecord {
    pub name: String,
    pub count: usize,
    pub fiat_volume: f64,
    pub usdt_volume: f64,
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
    pub total_commission_usdt: f64,
    pub gross_profit_usdt: f64,
    pub gross_profit_fiat: f64,
    pub total_bank_fees_fiat: f64,
    pub bank_fees_usdt: f64,
    pub net_profit_usdt: f64,
    pub net_profit_fiat: f64,

    // Aliases e integraciones contables consumidas por HistoryKpiCards y vistas históricas
    pub wac_buy_price: f64,
    pub wap_sell_price: f64,
    pub buy_fiat_total: f64,
    pub sell_fiat_total: f64,
    pub total_fiat_volume: f64,
    pub buy_usdt_total: f64,
    pub sell_usdt_total: f64,
    pub total_usdt_volume: f64,
    pub matched_usdt_volume: f64,
    pub net_inventory_usdt: f64,
    pub estimated_bank_fees_fiat: f64,
    pub commission_fiat_cost: f64,
    pub cancelled_orders: usize,
    pub completion_rate_pct: f64,
    pub daily_series: Vec<DailyPerformanceRecord>,
    pub top_counterparties: Vec<TopCounterpartyRecord>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationsDashboard {
    pub orders: Vec<BinanceOrderRecord>,
    pub analytics: OperationsAnalytics,
    pub total_stored_orders: usize,
    pub available_assets: Vec<String>,
    pub available_fiats: Vec<String>,
    pub server_today: String,
}

pub fn get_operations_data(
    conn: &Connection,
    order_type_filter: Option<String>,
    order_status_filter: Option<String>,
    asset_filter: Option<String>,
    fiat_filter: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    only_today: Option<bool>,
    search_filter: Option<String>,
) -> Result<OperationsDashboard, rusqlite::Error> {
    let target_fiat = fiat_filter.unwrap_or_else(|| "VES".to_string());
    let server_today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Cargar cuentas para mapeo de comisiones
    let mut acc_stmt = conn.prepare(
        "SELECT id, pago_movil_fee_pct, apply_buy_fee, COALESCE(pago_movil_min_fee, 14.0) FROM bank_accounts"
    )?;
    let acc_fees: HashMap<i64, (f64, bool, f64)> = acc_stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let fee: f64 = row.get(1)?;
            let apply: i64 = row.get(2)?;
            let min_fee: f64 = row.get(3)?;
            Ok((id, (fee, apply != 0, min_fee)))
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

    if let Some(ref os) = order_status_filter {
        if os != "ALL" && !os.trim().is_empty() {
            let clean_os = os.replace("'", "''");
            query.push_str(&format!(" AND order_status = '{}'", clean_os));
        }
    }

    if let Some(ref ast) = asset_filter {
        if ast != "ALL" && !ast.trim().is_empty() {
            let clean_ast = ast.replace("'", "''");
            query.push_str(&format!(" AND asset = '{}'", clean_ast));
        }
    }

    if only_today.unwrap_or(false) {
        query.push_str(&format!(
            " AND order_date >= '{} 00:00:00' AND order_date <= '{} 23:59:59'",
            server_today, server_today
        ));
    } else {
        if let Some(ref s_date) = start_date {
            if !s_date.trim().is_empty() {
                let clean_s = s_date.replace("'", "''");
                query.push_str(&format!(" AND order_date >= '{} 00:00:00'", clean_s));
            }
        }
        if let Some(ref e_date) = end_date {
            if !e_date.trim().is_empty() {
                let clean_e = e_date.replace("'", "''");
                query.push_str(&format!(" AND order_date <= '{} 23:59:59'", clean_e));
            }
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

        // Calcular comisión bancaria en compras si aplica (decimales estrictos, sin round)
        let mut bank_fee = 0.0;
        if order_type == "COMPRA" {
            if let Some(acc_id) = bank_account_id {
                if let Some((fee_pct, apply, min_fee)) = acc_fees.get(&acc_id) {
                    if *apply {
                        let ch = payment_channel.as_deref().unwrap_or("TRANSFERENCIA");
                        if ch == "PAGO_MOVIL" || ch == "TRANSFERENCIA_INTERBANCARIA" {
                            let calc = fiat_amount * (fee_pct / 100.0);
                            bank_fee = calc.max(*min_fee);
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
    for r in rows {
        orders.push(r?);
    }

    let total_stored: i64 = conn.query_row(
        "SELECT count(*) FROM binance_orders",
        [],
        |r| r.get(0)
    ).unwrap_or(0);

    // Detección dinámica de activos y fiats disponibles en base de datos
    let mut available_assets = Vec::new();
    if let Ok(mut asset_stmt) = conn.prepare("SELECT DISTINCT asset FROM binance_orders WHERE asset IS NOT NULL AND asset != '' ORDER BY asset ASC") {
        if let Ok(asset_rows) = asset_stmt.query_map([], |r| r.get::<_, String>(0)) {
            for a in asset_rows.flatten() {
                available_assets.push(a);
            }
        }
    }
    if !available_assets.contains(&"USDT".to_string()) {
        available_assets.insert(0, "USDT".to_string());
    }

    let mut available_fiats = Vec::new();
    if let Ok(mut fiat_stmt) = conn.prepare("SELECT DISTINCT fiat_currency FROM binance_orders WHERE fiat_currency IS NOT NULL AND fiat_currency != '' ORDER BY fiat_currency ASC") {
        if let Ok(fiat_rows) = fiat_stmt.query_map([], |r| r.get::<_, String>(0)) {
            for f in fiat_rows.flatten() {
                available_fiats.push(f);
            }
        }
    }
    if !available_fiats.contains(&"VES".to_string()) {
        available_fiats.insert(0, "VES".to_string());
    }

    let analytics = compute_analytics_from_orders(&orders);

    Ok(OperationsDashboard {
        total_stored_orders: total_stored as usize,
        analytics,
        orders,
        available_assets,
        available_fiats,
        server_today,
    })
}

pub fn compute_analytics_from_orders(orders: &[BinanceOrderRecord]) -> OperationsAnalytics {
    let mut buy_fiat = 0.0;
    let mut buy_crypto = 0.0;
    let mut buy_count = 0;
    let mut sell_fiat = 0.0;
    let mut sell_crypto = 0.0;
    let mut sell_count = 0;
    let mut total_bank_fees = 0.0;
    let mut total_commission_usdt = 0.0;
    let mut completed_orders = 0;
    let mut cancelled_orders = 0;

    #[derive(Default)]
    struct DayAccumulator {
        orders_count: usize,
        buy_fiat: f64,
        buy_usdt: f64,
        sell_fiat: f64,
        sell_usdt: f64,
        comm_usdt: f64,
        bank_fee_fiat: f64,
    }

    #[derive(Default)]
    struct CpAccumulator {
        count: usize,
        fiat_volume: f64,
        usdt_volume: f64,
    }

    let mut daily_map: HashMap<String, DayAccumulator> = HashMap::new();
    let mut cp_map: HashMap<String, CpAccumulator> = HashMap::new();

    for o in orders {
        if o.order_status == "CANCELLED" {
            cancelled_orders += 1;
            continue;
        }

        if o.order_status == "COMPLETED" {
            completed_orders += 1;
            total_commission_usdt += o.commission_usdt;

            let day_key = if let Some(ref d) = o.order_date {
                if d.len() >= 10 {
                    d[..10].to_string()
                } else if !d.is_empty() {
                    d.clone()
                } else {
                    "Sin Fecha".to_string()
                }
            } else {
                "Sin Fecha".to_string()
            };

            let day_entry = daily_map.entry(day_key).or_default();
            day_entry.orders_count += 1;
            day_entry.comm_usdt += o.commission_usdt;

            let cp_name = o.counterparty.clone().unwrap_or_else(|| "Anónimo".to_string());
            let cp_entry = cp_map.entry(cp_name).or_default();
            cp_entry.count += 1;
            cp_entry.fiat_volume += o.fiat_amount;
            cp_entry.usdt_volume += o.crypto_amount;

            if o.order_type == "COMPRA" {
                buy_fiat += o.fiat_amount;
                buy_crypto += o.crypto_amount;
                buy_count += 1;
                total_bank_fees += o.bank_fee_fiat;

                day_entry.buy_fiat += o.fiat_amount;
                day_entry.buy_usdt += o.crypto_amount;
                day_entry.bank_fee_fiat += o.bank_fee_fiat;
            } else if o.order_type == "VENTA" {
                sell_fiat += o.fiat_amount;
                sell_crypto += o.crypto_amount;
                sell_count += 1;

                day_entry.sell_fiat += o.fiat_amount;
                day_entry.sell_usdt += o.crypto_amount;
            }
        }
    }

    let wac_buy = if buy_crypto > 0.0 { buy_fiat / buy_crypto } else { 0.0 };
    let wap_sell = if sell_crypto > 0.0 { sell_fiat / sell_crypto } else { 0.0 };
    let spread_abs = if wac_buy > 0.0 && wap_sell > 0.0 { wap_sell - wac_buy } else { 0.0 };
    let spread_pct = if wac_buy > 0.0 && wap_sell > 0.0 { (spread_abs / wac_buy) * 100.0 } else { 0.0 };

    let matched_volume = buy_crypto.min(sell_crypto);

    // Spread comercial puro en USDT y en Fiat
    let pure_spread_usdt = if wap_sell > 0.0 && wac_buy > 0.0 {
        matched_volume * (1.0 - (wac_buy / wap_sell))
    } else {
        0.0
    };

    // Escuela A:
    // Ganancia Bruta (USDT) = Spread Puro en USDT MENOS Comisiones de Binance
    let gross_profit_usdt = pure_spread_usdt - total_commission_usdt;
    let gross_profit_fiat = if wap_sell > 0.0 {
        gross_profit_usdt * wap_sell
    } else {
        matched_volume * spread_abs - (total_commission_usdt * wac_buy)
    };

    // Comisiones bancarias convertidas a USDT al costo de reposición (WAC)
    let bank_fees_usdt = if wac_buy > 0.0 {
        total_bank_fees / wac_buy
    } else if wap_sell > 0.0 {
        total_bank_fees / wap_sell
    } else {
        0.0
    };

    // Ganancia Neta = Ganancia Bruta MENOS Comisiones Bancarias
    let net_profit_usdt = gross_profit_usdt - bank_fees_usdt;
    let net_profit_fiat = if wap_sell > 0.0 {
        net_profit_usdt * wap_sell
    } else {
        gross_profit_fiat - total_bank_fees
    };

    // Construir desglose diario cronológico
    let mut sorted_days: Vec<String> = daily_map.keys().cloned().collect();
    sorted_days.sort();

    let mut daily_series = Vec::new();
    for d_key in sorted_days {
        if let Some(d) = daily_map.get(&d_key) {
            if d.orders_count == 0 {
                continue;
            }
            let d_wac = if d.buy_usdt > 0.0 { d.buy_fiat / d.buy_usdt } else { wac_buy };
            let d_wap = if d.sell_usdt > 0.0 { d.sell_fiat / d.sell_usdt } else { wap_sell };
            let d_matched = d.buy_usdt.min(d.sell_usdt);
            let d_spread = if d_wac > 0.0 && d_wap > 0.0 { d_wap - d_wac } else { 0.0 };
            let d_gross = d_matched * d_spread;
            let d_ref_rate = if d_wac > 0.0 { d_wac } else if d_wap > 0.0 { d_wap } else { 1.0 };
            let d_comm_fiat = d.comm_usdt * d_ref_rate;
            let d_net_fiat = d_gross - d_comm_fiat - d.bank_fee_fiat;
            let d_net_usdt = if d_ref_rate > 0.0 { d_net_fiat / d_ref_rate } else { 0.0 };

            daily_series.push(DailyPerformanceRecord {
                date: d_key,
                orders_count: d.orders_count,
                buy_fiat: (d.buy_fiat * 100.0).round() / 100.0,
                buy_usdt: (d.buy_usdt * 10000.0).round() / 10000.0,
                sell_fiat: (d.sell_fiat * 100.0).round() / 100.0,
                sell_usdt: (d.sell_usdt * 10000.0).round() / 10000.0,
                matched_usdt: (d_matched * 10000.0).round() / 10000.0,
                avg_buy_price: (d_wac * 10000.0).round() / 10000.0,
                avg_sell_price: (d_wap * 10000.0).round() / 10000.0,
                spread_pct: ((if d_wac > 0.0 { (d_spread / d_wac) * 100.0 } else { 0.0 }) * 100.0).round() / 100.0,
                comm_usdt: (d.comm_usdt * 10000.0).round() / 10000.0,
                comm_fiat: (d_comm_fiat * 100.0).round() / 100.0,
                bank_fee_fiat: (d.bank_fee_fiat * 100.0).round() / 100.0,
                gross_profit_fiat: (d_gross * 100.0).round() / 100.0,
                net_profit_fiat: (d_net_fiat * 100.0).round() / 100.0,
                net_profit_usdt: (d_net_usdt * 100.0).round() / 100.0,
            });
        }
    }

    // Top contrapartes ordenadas por volumen fiat descendente
    let mut cp_list: Vec<TopCounterpartyRecord> = cp_map
        .into_iter()
        .map(|(name, acc)| TopCounterpartyRecord {
            name,
            count: acc.count,
            fiat_volume: (acc.fiat_volume * 100.0).round() / 100.0,
            usdt_volume: (acc.usdt_volume * 100.0).round() / 100.0,
        })
        .collect();
    cp_list.sort_by(|a, b| b.fiat_volume.partial_cmp(&a.fiat_volume).unwrap_or(std::cmp::Ordering::Equal));
    cp_list.truncate(6);

    let total_all = completed_orders + cancelled_orders;
    let completion_rate_pct = if total_all > 0 {
        ((completed_orders as f64 / total_all as f64) * 1000.0).round() / 10.0
    } else {
        100.0
    };

    let ref_rate = if wac_buy > 0.0 { wac_buy } else if wap_sell > 0.0 { wap_sell } else { 0.0 };
    let commission_fiat_cost = (total_commission_usdt * ref_rate * 100.0).round() / 100.0;

    OperationsAnalytics {
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
        total_commission_usdt: (total_commission_usdt * 10000.0).round() / 10000.0,
        gross_profit_usdt: (gross_profit_usdt * 100.0).round() / 100.0,
        gross_profit_fiat: (gross_profit_fiat * 100.0).round() / 100.0,
        total_bank_fees_fiat: (total_bank_fees * 100.0).round() / 100.0,
        bank_fees_usdt: (bank_fees_usdt * 100.0).round() / 100.0,
        net_profit_usdt: (net_profit_usdt * 100.0).round() / 100.0,
        net_profit_fiat: (net_profit_fiat * 100.0).round() / 100.0,

        // Campos auxiliares y compatibles para UI
        wac_buy_price: (wac_buy * 10000.0).round() / 10000.0,
        wap_sell_price: (wap_sell * 10000.0).round() / 10000.0,
        buy_fiat_total: (buy_fiat * 100.0).round() / 100.0,
        sell_fiat_total: (sell_fiat * 100.0).round() / 100.0,
        total_fiat_volume: ((buy_fiat + sell_fiat) * 100.0).round() / 100.0,
        buy_usdt_total: (buy_crypto * 100.0).round() / 100.0,
        sell_usdt_total: (sell_crypto * 100.0).round() / 100.0,
        total_usdt_volume: ((buy_crypto + sell_crypto) * 100.0).round() / 100.0,
        matched_usdt_volume: (matched_volume * 100.0).round() / 100.0,
        net_inventory_usdt: ((buy_crypto - sell_crypto) * 100.0).round() / 100.0,
        estimated_bank_fees_fiat: (total_bank_fees * 100.0).round() / 100.0,
        commission_fiat_cost,
        cancelled_orders,
        completion_rate_pct,
        daily_series,
        top_counterparties: cp_list,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_order(
        order_number: &str,
        order_type: &str,
        order_status: &str,
        crypto_amount: f64,
        fiat_amount: f64,
        bank_fee_fiat: f64,
    ) -> BinanceOrderRecord {
        BinanceOrderRecord {
            id: 1,
            order_number: order_number.to_string(),
            adv_no: None,
            order_type: order_type.to_string(),
            asset: "USDT".to_string(),
            fiat_currency: "VES".to_string(),
            fiat_amount,
            crypto_amount,
            unit_price: fiat_amount / crypto_amount,
            commission_usdt: 0.0,
            pay_method: Some("PAGO_MOVIL".to_string()),
            counterparty: Some("UserTest".to_string()),
            reference_note: None,
            create_timestamp: 1700000000,
            order_date: Some("2026-11-13 10:00:00".to_string()),
            order_status: order_status.to_string(),
            source: "API".to_string(),
            bank_account_id: None,
            payment_channel: None,
            bank_fee_fiat,
        }
    }

    #[test]
    fn test_compute_analytics_balanced_cycle() {
        // Compra de 100 USDT a 50 VES/USDT = 5000 VES
        // Venta de 100 USDT a 52 VES/USDT = 5200 VES
        // Pure Spread USDT = 100 * (1 - 50/52) = 3.84615 USDT
        // Comisiones Binance = 0.0 -> Gross Profit USDT = 3.85 USDT, Gross Profit Fiat = 3.84615 * 52 = 200 VES
        // Bank fee = 14 VES -> Bank fee USDT = 14 / 50 = 0.28 USDT
        // Net Profit USDT = 3.84615 - 0.28 = 3.566 USDT -> Net Profit Fiat = 3.566 * 52 = 185.44 VES (o 200 - 14.56)
        let orders = vec![
            mock_order("ORD-1", "COMPRA", "COMPLETED", 100.0, 5000.0, 14.0),
            mock_order("ORD-2", "VENTA", "COMPLETED", 100.0, 5200.0, 0.0),
        ];

        let analytics = compute_analytics_from_orders(&orders);

        assert_eq!(analytics.total_orders, 2);
        assert_eq!(analytics.completed_orders, 2);
        assert_eq!(analytics.buy_count, 1);
        assert_eq!(analytics.sell_count, 1);
        assert_eq!(analytics.wac_buy, 50.0);
        assert_eq!(analytics.wap_sell, 52.0);
        assert_eq!(analytics.spread_abs, 2.0);
        assert_eq!(analytics.spread_pct, 4.0);
        assert_eq!(analytics.matched_volume_crypto, 100.0);
        assert_eq!(analytics.gross_profit_usdt, 3.85);
        assert_eq!(analytics.gross_profit_fiat, 200.0);
        assert_eq!(analytics.bank_fees_usdt, 0.28);
        assert_eq!(analytics.total_bank_fees_fiat, 14.0);
        assert_eq!(analytics.net_profit_usdt, 3.57);
    }

    #[test]
    fn test_compute_analytics_ignores_cancelled_or_pending() {
        let orders = vec![
            mock_order("ORD-1", "COMPRA", "COMPLETED", 100.0, 5000.0, 0.0),
            mock_order("ORD-2", "VENTA", "CANCELLED", 100.0, 5200.0, 0.0),
        ];

        let analytics = compute_analytics_from_orders(&orders);

        assert_eq!(analytics.total_orders, 2);
        assert_eq!(analytics.completed_orders, 1);
        assert_eq!(analytics.sell_count, 0);
        assert_eq!(analytics.matched_volume_crypto, 0.0);
        assert_eq!(analytics.gross_profit_fiat, 0.0);
    }

    #[test]
    fn test_compute_analytics_weighted_average() {
        // Dos compras: 100 USDT a 50 VES (5000 VES) y 200 USDT a 53 VES (10600 VES)
        // Total crypto = 300, Total fiat = 15600 -> WAC = 52.0
        let orders = vec![
            mock_order("ORD-1", "COMPRA", "COMPLETED", 100.0, 5000.0, 0.0),
            mock_order("ORD-2", "COMPRA", "COMPLETED", 200.0, 10600.0, 0.0),
        ];

        let analytics = compute_analytics_from_orders(&orders);

        assert_eq!(analytics.buy_crypto, 300.0);
        assert_eq!(analytics.buy_fiat, 15600.0);
        assert_eq!(analytics.wac_buy, 52.0);
    }
}
