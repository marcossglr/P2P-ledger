use log::info;
use rusqlite::params;
use serde::{Deserialize, Serialize};
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

#[derive(Debug, Serialize)]
pub struct SystemHealthResponse {
    pub status: String,
    pub mode: String,
    pub stored_orders: i64,
    pub stored_real_orders: i64,
    pub stored_demo_orders: i64,
    pub stored_in_progress_orders: i64,
    pub binance_api_configured: bool,
}

#[tauri::command]
pub fn get_system_health(state: State<'_, DbState>) -> Result<SystemHealthResponse, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let stored_real_orders: i64 = conn
        .query_row(
            "SELECT count(*) FROM binance_orders WHERE source != 'DEMO'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let stored_demo_orders: i64 = conn
        .query_row(
            "SELECT count(*) FROM binance_orders WHERE source = 'DEMO'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let stored_in_progress_orders: i64 = conn
        .query_row(
            "SELECT count(*) FROM binance_orders WHERE order_status = 'IN_PROGRESS'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    let binance_api_configured: bool = conn
        .query_row(
            "SELECT count(*) FROM binance_configs WHERE api_key != ''",
            [],
            |r| r.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    let stored_orders = stored_real_orders + stored_demo_orders;

    Ok(SystemHealthResponse {
        status: "healthy".to_string(),
        mode: "native_rust".to_string(),
        stored_orders,
        stored_real_orders,
        stored_demo_orders,
        stored_in_progress_orders,
        binance_api_configured,
    })
}

#[tauri::command]
pub fn get_operations(
    params: Option<GetOperationsParams>,
    state: State<'_, DbState>,
) -> Result<OperationsDashboard, String> {
    info!("[Operations] Obteniendo lista de operaciones y métricas financieras...");
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let p = params.unwrap_or(GetOperationsParams {
        order_type: None,
        fiat_currency: None,
        search: None,
    });

    let res = get_operations_data(&conn, p.order_type, p.fiat_currency, p.search).map_err(|e| e.to_string())?;
    info!("[Operations] Operaciones cargadas: {} órdenes encontradas", res.orders.len());
    Ok(res)
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
        "INSERT OR IGNORE INTO bank_accounts (name, fiat_currency, is_default, is_active, apply_buy_fee, pago_movil_fee_pct, transfer_fee_pct)
         VALUES ('Banesco', 'VES', 1, 1, 1, 0.3, 0.0)",
        [],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO bank_accounts (name, fiat_currency, is_default, is_active, apply_buy_fee, pago_movil_fee_pct, transfer_fee_pct)
         VALUES ('Mercantil', 'VES', 0, 1, 1, 0.3, 0.0)",
        [],
    ).map_err(|e| e.to_string())?;

    let banesco_id: i64 = conn.query_row(
        "SELECT id FROM bank_accounts WHERE name = 'Banesco' LIMIT 1",
        [],
        |r| r.get(0)
    ).unwrap_or(1);

    let mercantil_id: i64 = conn.query_row(
        "SELECT id FROM bank_accounts WHERE name = 'Mercantil' LIMIT 1",
        [],
        |r| r.get(0)
    ).unwrap_or(2);

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    // Dataset demo realista y completo para probar cálculos contables y visualizaciones
    // (ord_num, ord_type, crypto, price, fiat, pay_m, channel, cp, bank_id, status)
    let demo_orders = vec![
        ("DEMO-001", "COMPRA", 500.0, 42.10, 21050.0, "Banesco Pago Móvil", "PAGO_MOVIL", "CryptoTraderVE", banesco_id, "COMPLETED"),
        ("DEMO-002", "VENTA", 300.0, 42.95, 12885.0, "Banesco Transferencia", "TRANSFERENCIA", "InversionesCaracas", banesco_id, "COMPLETED"),
        ("DEMO-003", "COMPRA", 800.0, 42.30, 33840.0, "Mercantil Transferencia", "TRANSFERENCIA", "CambiosOrinoco", mercantil_id, "COMPLETED"),
        ("DEMO-004", "VENTA", 450.0, 43.20, 19440.0, "Banesco Pago Móvil", "PAGO_MOVIL", "MariaExchanges", banesco_id, "COMPLETED"),
        ("DEMO-005", "VENTA", 350.0, 43.25, 15137.5, "Mercantil Pago Móvil", "PAGO_MOVIL", "AndesCapital", mercantil_id, "COMPLETED"),
        ("DEMO-006", "COMPRA", 1200.0, 42.15, 50580.0, "Banesco Transferencia", "TRANSFERENCIA", "FintechSolutions", banesco_id, "COMPLETED"),
        ("DEMO-007", "VENTA", 600.0, 43.10, 25860.0, "Banesco Pago Móvil", "PAGO_MOVIL", "FastP2P_Vzla", banesco_id, "COMPLETED"),
        ("DEMO-008", "COMPRA", 400.0, 42.20, 16880.0, "Mercantil Pago Móvil", "PAGO_MOVIL", "BolivarDigital", mercantil_id, "COMPLETED"),
        ("DEMO-009", "VENTA", 550.0, 43.30, 23815.0, "Mercantil Transferencia", "TRANSFERENCIA", "SolucionesP2P", mercantil_id, "COMPLETED"),
        ("DEMO-010", "COMPRA", 250.0, 42.25, 10562.5, "Banesco Pago Móvil", "PAGO_MOVIL", "UserVIP_Trade", banesco_id, "COMPLETED"),
    ];

    let mut inserted = 0;
    for (i, (ord_num, ord_type, crypto, price, fiat, pay_m, channel, cp, bank_id, status)) in demo_orders.into_iter().enumerate() {
        // Distribuir temporalmente en las últimas 48 horas
        let ts = now_ms - (i as i64 * 3600 * 1000 * 4);
        let date_str = chrono::DateTime::from_timestamp_millis(ts)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_else(|| "2026-11-12 10:00:00".to_string());

        let res = conn.execute(
            "INSERT INTO binance_orders (
                order_number, order_type, asset, fiat_currency, fiat_amount, crypto_amount,
                unit_price, pay_method, counterparty, create_timestamp, order_date,
                order_status, source, bank_account_id, payment_channel
             ) VALUES (?1, ?2, 'USDT', 'VES', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'DEMO', ?11, ?12)",
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
                status,
                bank_id,
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
