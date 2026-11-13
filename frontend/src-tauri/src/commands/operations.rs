use rusqlite::params;
use serde::Deserialize;
use tauri::State;
use crate::db::DbState;
use crate::services::analytics::{get_operations_data, OperationsDashboard};

#[derive(Debug, Deserialize)]
pub struct GetOperationsParams {
    pub order_type: Option<String>,
    pub fiat_currency: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePaymentChannelPayload {
    pub order_id: i64,
    pub payment_channel: String, // "PAGO_MOVIL" | "TRANSFERENCIA"
}

#[derive(Debug, Deserialize)]
pub struct SystemResetPayload {
    pub delete_orders: Option<bool>,
    pub delete_bank_accounts: Option<bool>,
    pub delete_api_credentials: Option<bool>,
}

#[tauri::command]
pub fn get_operations(
    params: Option<GetOperationsParams>,
    state: State<'_, DbState>,
) -> Result<OperationsDashboard, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let p = params.unwrap_or(GetOperationsParams {
        order_type: None,
        fiat_currency: None,
        search: None,
    });

    get_operations_data(&conn, p.order_type, p.fiat_currency, p.search).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_payment_channel(
    payload: UpdatePaymentChannelPayload,
    state: State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE binance_orders SET payment_channel = ?1, payment_channel_manual = 1 WHERE id = ?2",
        params![payload.payment_channel, payload.order_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn seed_demo_operations(state: State<'_, DbState>) -> Result<usize, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Verificar si existen órdenes reales
    let real_count: i64 = conn.query_row(
        "SELECT count(*) FROM binance_orders WHERE source != 'DEMO'",
        [],
        |r| r.get(0)
    ).unwrap_or(0);

    if real_count > 0 {
        return Err("No se pueden sembrar operaciones demo mientras existan órdenes reales importadas.".to_string());
    }

    // Limpiar demos previos
    let _ = conn.execute("DELETE FROM binance_orders WHERE source = 'DEMO'", []);

    // Crear bancos de prueba si no existen
    conn.execute(
        "INSERT OR IGNORE INTO bank_accounts (name, fiat_currency, is_default, is_active)
         VALUES ('Banesco', 'VES', 1, 1)",
        [],
    ).map_err(|e| e.to_string())?;

    let banesco_id: i64 = conn.query_row(
        "SELECT id FROM bank_accounts WHERE name = 'Banesco' LIMIT 1",
        [],
        |r| r.get(0)
    ).unwrap_or(1);

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let demo_orders = vec![
        ("DEMO-001", "COMPRA", 500.0, 42.10, 21050.0, "Banesco Pago Móvil", "PAGO_MOVIL", "CryptoTraderVE"),
        ("DEMO-002", "VENTA", 300.0, 42.95, 12885.0, "Banesco Transferencia", "TRANSFERENCIA", "InversionesCaracas"),
        ("DEMO-003", "COMPRA", 800.0, 42.30, 33840.0, "Banesco Transferencia", "TRANSFERENCIA", "CambiosOrinoco"),
        ("DEMO-004", "VENTA", 450.0, 43.20, 19440.0, "Banesco Pago Móvil", "PAGO_MOVIL", "MariaExchanges"),
        ("DEMO-005", "VENTA", 350.0, 43.25, 15137.5, "Banesco Pago Móvil", "PAGO_MOVIL", "AndesCapital"),
    ];

    let mut inserted = 0;
    for (i, (ord_num, ord_type, crypto, price, fiat, pay_m, channel, cp)) in demo_orders.into_iter().enumerate() {
        let ts = now_ms - (i as i64 * 3600 * 1000 * 6);
        let date_str = chrono::DateTime::from_timestamp_millis(ts)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_else(|| "2026-11-12 10:00:00".to_string());

        let res = conn.execute(
            "INSERT INTO binance_orders (
                order_number, order_type, asset, fiat_currency, fiat_amount, crypto_amount,
                unit_price, pay_method, counterparty, create_timestamp, order_date,
                order_status, source, bank_account_id, payment_channel
             ) VALUES (?1, ?2, 'USDT', 'VES', ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'COMPLETED', 'DEMO', ?10, ?11)",
            params![
                ord_num,
                ord_type,
                fiat,
                crypto,
                price,
                pay_m,
                cp,
                ts,
                date_str,
                banesco_id,
                channel
            ],
        );

        if res.is_ok() {
            inserted += 1;
        }
    }

    Ok(inserted)
}

#[tauri::command]
pub fn clear_operations(only_demo: bool, state: State<'_, DbState>) -> Result<usize, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let deleted = if only_demo {
        conn.execute("DELETE FROM binance_orders WHERE source = 'DEMO'", []).map_err(|e| e.to_string())?
    } else {
        conn.execute("DELETE FROM binance_orders", []).map_err(|e| e.to_string())?
    };

    Ok(deleted)
}

#[tauri::command]
pub fn system_reset(payload: SystemResetPayload, state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    if payload.delete_orders.unwrap_or(false) {
        let _ = conn.execute("DELETE FROM binance_orders", []);
    }

    if payload.delete_bank_accounts.unwrap_or(false) {
        let _ = conn.execute("DELETE FROM bank_balance_adjustments", []);
        let _ = conn.execute("DELETE FROM bank_accounts", []);
    } else if payload.delete_orders.unwrap_or(false) {
        let _ = conn.execute(
            "UPDATE bank_accounts SET manual_delta_bs = 0.0, anchor_balance = 0.0, anchor_timestamp = 0, anchor_date_label = 'Inicio'",
            []
        );
    }

    if payload.delete_api_credentials.unwrap_or(false) {
        let _ = conn.execute("DELETE FROM binance_configs", []);
        let _ = conn.execute("DELETE FROM public_market_config", []);
    }

    Ok(())
}
