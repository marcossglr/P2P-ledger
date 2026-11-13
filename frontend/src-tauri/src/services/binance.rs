use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BinanceConfigResponse {
    pub configured: bool,
    pub masked_api_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FundingWalletResponse {
    pub asset: String,
    pub free: f64,
    pub locked: f64,
    pub total: f64,
    pub source: String,
    pub updated_at: String,
}

pub fn get_saved_config(conn: &Connection) -> Result<BinanceConfigResponse, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT api_key, api_secret FROM binance_configs ORDER BY id DESC LIMIT 1")?;
    let mut rows = stmt.query([])?;

    if let Some(row) = rows.next()? {
        let api_key: String = row.get(0)?;
        let masked = if api_key.len() > 10 {
            format!("{}••••{}", &api_key[..6], &api_key[api_key.len() - 4..])
        } else {
            "Configurada".to_string()
        };
        Ok(BinanceConfigResponse {
            configured: true,
            masked_api_key: masked,
        })
    } else {
        Ok(BinanceConfigResponse {
            configured: false,
            masked_api_key: String::new(),
        })
    }
}

pub fn save_config(conn: &Connection, api_key: &str, api_secret: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM binance_configs", [])?;
    conn.execute(
        "INSERT INTO binance_configs (api_key, api_secret) VALUES (?1, ?2)",
        [api_key, api_secret],
    )?;
    Ok(())
}

pub fn clear_config(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM binance_configs", [])?;
    Ok(())
}
