use serde::{Deserialize, Serialize};
use tauri::State;
use crate::db::DbState;
use crate::services::binance::{
    get_saved_config, save_config, clear_config, BinanceConfigResponse, FundingWalletResponse,
};

#[derive(Debug, Deserialize)]
pub struct CredentialsPayload {
    pub api_key: String,
    pub api_secret: String,
}

#[derive(Debug, Deserialize)]
pub struct ManualFundingPayload {
    pub free: Option<f64>,
    pub locked: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublicMarketConfig {
    pub fiat: String,
    pub asset: String,
    pub trade_type: String,
    pub payment_methods: Vec<String>,
    pub rows: usize,
}

#[tauri::command]
pub fn get_binance_config(state: State<'_, DbState>) -> Result<BinanceConfigResponse, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    get_saved_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_binance_config(
    payload: CredentialsPayload,
    state: State<'_, DbState>,
) -> Result<BinanceConfigResponse, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    if payload.api_key.trim().is_empty() || payload.api_secret.trim().is_empty() {
        return Err("API Key y Secret Key son obligatorias".to_string());
    }
    save_config(&conn, payload.api_key.trim(), payload.api_secret.trim()).map_err(|e| e.to_string())?;
    get_saved_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_binance_config(state: State<'_, DbState>) -> Result<BinanceConfigResponse, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    clear_config(&conn).map_err(|e| e.to_string())?;
    Ok(BinanceConfigResponse {
        configured: false,
        masked_api_key: String::new(),
    })
}

#[tauri::command]
pub fn get_funding_wallet() -> Result<FundingWalletResponse, String> {
    Ok(FundingWalletResponse {
        asset: "USDT".to_string(),
        free: 0.0,
        locked: 0.0,
        total: 0.0,
        source: "LOCAL".to_string(),
        updated_at: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn set_funding_wallet_manual(payload: ManualFundingPayload) -> Result<FundingWalletResponse, String> {
    let free = payload.free.unwrap_or(0.0).max(0.0);
    let locked = payload.locked.unwrap_or(0.0).max(0.0);
    let total = free + locked;

    Ok(FundingWalletResponse {
        asset: "USDT".to_string(),
        free,
        locked,
        total,
        source: "MANUAL".to_string(),
        updated_at: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn get_my_ads() -> Result<Vec<serde_json::Value>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn get_public_market_config(state: State<'_, DbState>) -> Result<PublicMarketConfig, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT fiat, asset, trade_type, payment_methods, rows FROM public_market_config ORDER BY id DESC LIMIT 1"
    ).map_err(|e| e.to_string())?;

    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let pm_str: String = row.get(3).unwrap_or_else(|_| "[]".to_string());
        let payment_methods: Vec<String> = serde_json::from_str(&pm_str).unwrap_or_default();
        Ok(PublicMarketConfig {
            fiat: row.get(0).unwrap_or_else(|_| "VES".to_string()),
            asset: row.get(1).unwrap_or_else(|_| "USDT".to_string()),
            trade_type: row.get(2).unwrap_or_else(|_| "BUY".to_string()),
            payment_methods,
            rows: row.get::<_, i64>(4).unwrap_or(10) as usize,
        })
    } else {
        Ok(PublicMarketConfig {
            fiat: "VES".to_string(),
            asset: "USDT".to_string(),
            trade_type: "BUY".to_string(),
            payment_methods: vec![],
            rows: 10,
        })
    }
}

#[tauri::command]
pub fn save_public_market_config(
    payload: PublicMarketConfig,
    state: State<'_, DbState>,
) -> Result<PublicMarketConfig, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let pm_json = serde_json::to_string(&payload.payment_methods).unwrap_or_else(|_| "[]".to_string());

    conn.execute("DELETE FROM public_market_config", []).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO public_market_config (fiat, asset, trade_type, payment_methods, rows)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            payload.fiat,
            payload.asset,
            payload.trade_type,
            pm_json,
            payload.rows as i64
        ],
    ).map_err(|e| e.to_string())?;

    Ok(payload)
}
