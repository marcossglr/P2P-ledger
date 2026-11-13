use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use hmac::{Hmac, Mac, KeyInit};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;

type HmacSha256 = Hmac<Sha256>;

const BINANCE_BASE_URL: &str = "https://api.binance.com";
const P2P_PUBLIC_BASE_URL: &str = "https://p2p.binance.com";

#[derive(Debug, Serialize, Deserialize)]
pub struct BinanceConfigResponse {
    pub configured: bool,
    pub masked_api_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FundingWalletResponse {
    pub asset: String,
    pub free: f64,
    pub locked: f64,
    pub total: f64,
    pub source: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NormalizedC2cOrder {
    pub order_number: String,
    pub adv_no: String,
    pub order_type: String, // COMPRA o VENTA
    pub asset: String,
    pub fiat_currency: String,
    pub fiat_amount: f64,
    pub crypto_amount: f64,
    pub unit_price: f64,
    pub commission_usdt: f64,
    pub pay_method: String,
    pub counterparty: String,
    pub create_timestamp: i64,
    pub order_date: String,
    pub order_status: String, // COMPLETED, CANCELLED, IN_PROGRESS
    pub source: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncResult {
    pub status: String,
    pub sync_mode: String,
    pub fetched_count: usize,
    pub new_orders: usize,
    pub updated_orders: usize,
    pub has_in_progress: bool,
    pub in_progress_count: usize,
    pub last_synced_at: String,
    pub period: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PublicMarketStats {
    pub best_buy: f64,
    pub best_sell: f64,
    pub spread: f64,
    pub spread_pct: f64,
    pub buy_ads_count: usize,
    pub sell_ads_count: usize,
    pub buy_avg_price: f64,
    pub sell_avg_price: f64,
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

pub fn get_raw_credentials(conn: &Connection) -> Result<Option<(String, String)>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT api_key, api_secret FROM binance_configs ORDER BY id DESC LIMIT 1")?;
    let mut rows = stmt.query([])?;

    if let Some(row) = rows.next()? {
        let api_key: String = row.get(0)?;
        let api_secret: String = row.get(1)?;
        Ok(Some((api_key.trim().to_string(), api_secret.trim().to_string())))
    } else {
        Ok(None)
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

fn current_timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn sign_query(query: &str, secret: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).expect("HMAC can take key of any size");
    mac.update(query.as_bytes());
    let result = mac.finalize();
    hex::encode(result.into_bytes())
}

// ---------------------------------------------------------------------------
// 1. Funding Wallet Balance
// ---------------------------------------------------------------------------
pub fn fetch_funding_asset_balance(
    conn: &Connection,
    asset: &str,
) -> Result<FundingWalletResponse, String> {
    let (api_key, api_secret) = match get_raw_credentials(conn).map_err(|e| e.to_string())? {
        Some(creds) => creds,
        None => {
            return Ok(FundingWalletResponse {
                asset: asset.to_string(),
                free: 0.0,
                locked: 0.0,
                total: 0.0,
                source: "LOCAL".to_string(),
                updated_at: chrono::Local::now().to_rfc3339(),
            });
        }
    };

    let ts = current_timestamp_ms();
    let query_str = format!("timestamp={}&recvWindow=10000", ts);
    let signature = sign_query(&query_str, &api_secret);
    let url = format!("{}/sapi/v1/asset/get-funding-asset?{}&signature={}", BINANCE_BASE_URL, query_str, signature);

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "asset": asset,
        "needBtcVal": "false"
    });

    let resp = client
        .post(&url)
        .header("X-MBX-APIKEY", api_key)
        .header("Content-Type", "application/json")
        .header("User-Agent", "P2PLedgerDesktop/1.0")
        .json(&body)
        .send()
        .map_err(|e| format!("Error de red al consultar Binance Funding Wallet: {}", e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().unwrap_or_default();
        return Err(format!("Binance API Error: {}", err_text));
    }

    let items: Vec<serde_json::Value> = resp.json().map_err(|e| format!("Error parseando JSON de Binance: {}", e))?;

    for item in items {
        let item_asset = item.get("asset").and_then(|v| v.as_str()).unwrap_or("");
        if item_asset.eq_ignore_ascii_case(asset) {
            let free: f64 = item.get("free").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
            let locked: f64 = item.get("locked").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
            let freeze: f64 = item.get("freeze").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
            let withdrawing: f64 = item.get("withdrawing").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
            let total_locked = locked + freeze + withdrawing;
            let total = free + total_locked;

            return Ok(FundingWalletResponse {
                asset: asset.to_string(),
                free: (free * 100.0).round() / 100.0,
                locked: (total_locked * 100.0).round() / 100.0,
                total: (total * 100.0).round() / 100.0,
                source: "API".to_string(),
                updated_at: chrono::Local::now().to_rfc3339(),
            });
        }
    }

    Ok(FundingWalletResponse {
        asset: asset.to_string(),
        free: 0.0,
        locked: 0.0,
        total: 0.0,
        source: "API".to_string(),
        updated_at: chrono::Local::now().to_rfc3339(),
    })
}

// ---------------------------------------------------------------------------
// 2. Fetch C2C Orders Range
// ---------------------------------------------------------------------------
pub fn fetch_c2c_orders_range(
    api_key: &str,
    api_secret: &str,
    start_ms: i64,
    end_ms: i64,
) -> Result<Vec<NormalizedC2cOrder>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let window_ms: i64 = 15 * 24 * 60 * 60 * 1000;
    let mut normalized_orders: HashMap<String, NormalizedC2cOrder> = HashMap::new();
    let mut cur_end = end_ms;

    while cur_end > start_ms {
        let cur_start = std::cmp::max(start_ms, cur_end - window_ms);

        for trade_type in &["BUY", "SELL"] {
            let mut page = 1;
            loop {
                let ts = current_timestamp_ms();
                let query_str = format!(
                    "tradeType={}&startTimestamp={}&endTimestamp={}&page={}&rows=100&timestamp={}&recvWindow=10000",
                    trade_type, cur_start, cur_end, page, ts
                );
                let signature = sign_query(&query_str, api_secret);
                let url = format!("{}/sapi/v1/c2c/orderMatch/listUserOrderHistory?{}&signature={}", BINANCE_BASE_URL, query_str, signature);

                let resp = client
                    .get(&url)
                    .header("X-MBX-APIKEY", api_key)
                    .header("User-Agent", "P2PLedgerDesktop/1.0")
                    .send()
                    .map_err(|e| format!("Error conectando a Binance C2C: {}", e))?;

                if !resp.status().is_success() {
                    let err_text = resp.text().unwrap_or_default();
                    return Err(format!("Binance API Error: {}", err_text));
                }

                let json_data: serde_json::Value = resp.json().map_err(|e| format!("Error parseando JSON: {}", e))?;
                let items = json_data.get("data").and_then(|v| v.as_array());

                if items.is_none() || items.unwrap().is_empty() {
                    break;
                }

                let items_array = items.unwrap();
                for item in items_array {
                    let order_no = item.get("orderNumber").and_then(|v| v.as_str()).unwrap_or("").trim();
                    if order_no.is_empty() {
                        continue;
                    }

                    let status_str = item.get("orderStatus").and_then(|v| v.as_str()).unwrap_or("").to_uppercase();
                    let norm_status = match status_str.as_str() {
                        "COMPLETED" | "4" => "COMPLETED",
                        "CANCELLED" | "CANCELED" | "6" | "CANCELLED_BY_SYSTEM" | "7" | "EXPIRED" => "CANCELLED",
                        _ => "IN_PROGRESS",
                    };

                    let create_ts = item.get("createTime").and_then(|v| v.as_i64()).unwrap_or(0);
                    let dt_str = if create_ts > 0 {
                        chrono::DateTime::from_timestamp_millis(create_ts)
                            .map(|dt| dt.naive_local().format("%Y-%m-%d %H:%M:%S").to_string())
                            .unwrap_or_else(|| "-".to_string())
                    } else {
                        "-".to_string()
                    };

                    let raw_type = item.get("tradeType").and_then(|v| v.as_str()).unwrap_or(*trade_type).to_uppercase();
                    let order_type = if raw_type == "BUY" { "COMPRA" } else { "VENTA" };

                    let fiat_amount = item.get("totalPrice").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
                    let crypto_amount = item.get("amount").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
                    let unit_price = item.get("unitPrice").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);
                    let commission = item.get("commission").and_then(|v| v.as_str()).and_then(|s| s.parse().ok()).unwrap_or(0.0);

                    normalized_orders.insert(
                        order_no.to_string(),
                        NormalizedC2cOrder {
                            order_number: order_no.to_string(),
                            adv_no: item.get("advNo").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            order_type: order_type.to_string(),
                            asset: item.get("asset").and_then(|v| v.as_str()).unwrap_or("USDT").to_string(),
                            fiat_currency: item.get("fiat").and_then(|v| v.as_str()).unwrap_or("VES").to_string(),
                            fiat_amount,
                            crypto_amount,
                            unit_price,
                            commission_usdt: commission,
                            pay_method: item.get("payMethodName").and_then(|v| v.as_str()).unwrap_or("Transferencia Bancaria").to_string(),
                            counterparty: item.get("counterPartNickName").and_then(|v| v.as_str()).unwrap_or("-").to_string(),
                            create_timestamp: create_ts,
                            order_date: dt_str,
                            order_status: norm_status.to_string(),
                            source: "API".to_string(),
                        },
                    );
                }

                if items_array.len() < 50 {
                    break;
                }

                page += 1;
                std::thread::sleep(std::time::Duration::from_millis(80));
            }
        }

        cur_end = cur_start - 1;
    }

    let mut result: Vec<NormalizedC2cOrder> = normalized_orders.into_values().collect();
    result.sort_by(|a, b| b.create_timestamp.cmp(&a.create_timestamp));
    Ok(result)
}

// ---------------------------------------------------------------------------
// 3. Sync Orders into SQLite
// ---------------------------------------------------------------------------
pub fn sync_orders_to_db(
    conn: &Connection,
    days: Option<i64>,
    force_full: bool,
    api_key_override: Option<String>,
    api_secret_override: Option<String>,
) -> Result<SyncResult, String> {
    let (api_key, api_secret) = if let (Some(k), Some(s)) = (api_key_override, api_secret_override) {
        if !k.trim().is_empty() && !s.trim().is_empty() {
            save_config(conn, k.trim(), s.trim()).map_err(|e| e.to_string())?;
            (k.trim().to_string(), s.trim().to_string())
        } else {
            return Err("Credenciales de API vacías".to_string());
        }
    } else {
        match get_raw_credentials(conn).map_err(|e| e.to_string())? {
            Some(creds) => creds,
            None => return Err("No se han configurado credenciales de API de Binance".to_string()),
        }
    };

    let now_ms = current_timestamp_ms() as i64;
    let days_back = days.unwrap_or(180).clamp(1, 180);
    let full_range_ms = now_ms - (days_back * 24 * 60 * 60 * 1000);

    let latest_ts: Option<i64> = conn
        .query_row(
            "SELECT MAX(create_timestamp) FROM binance_orders WHERE source = 'API'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let (start_ms, sync_mode) = if force_full || latest_ts.is_none() || latest_ts.unwrap_or(0) <= 0 {
        (full_range_ms, format!("FULL_{}D", days_back))
    } else {
        let overlap_ms = 12 * 3600 * 1000;
        let inc_start = std::cmp::max(full_range_ms, latest_ts.unwrap() - overlap_ms);
        (inc_start, "INCREMENTAL".to_string())
    };

    let orders = fetch_c2c_orders_range(&api_key, &api_secret, start_ms, now_ms)?;

    // Eliminar órdenes demo si ingresan datos reales de API
    if !orders.is_empty() {
        let _ = conn.execute("DELETE FROM binance_orders WHERE source = 'DEMO'", []);
    }

    let mut new_orders = 0;
    let mut updated_orders = 0;

    for ord in &orders {
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

    let in_progress_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM binance_orders WHERE order_status = 'IN_PROGRESS'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let start_dt = chrono::DateTime::from_timestamp_millis(start_ms)
        .map(|dt| dt.naive_local().format("%Y-%m-%d %H:%M").to_string())
        .unwrap_or_else(|| "-".to_string());
    let end_dt = chrono::DateTime::from_timestamp_millis(now_ms)
        .map(|dt| dt.naive_local().format("%Y-%m-%d %H:%M").to_string())
        .unwrap_or_else(|| "-".to_string());

    Ok(SyncResult {
        status: "synced".to_string(),
        sync_mode,
        fetched_count: orders.len(),
        new_orders,
        updated_orders,
        has_in_progress: in_progress_count > 0,
        in_progress_count: in_progress_count as usize,
        last_synced_at: chrono::Local::now().format("%H:%M:%S").to_string(),
        period: format!("{} → {}", start_dt, end_dt),
    })
}

// ---------------------------------------------------------------------------
// 4. Public Market Stats & Depth
// ---------------------------------------------------------------------------
pub fn fetch_public_market_stats(
    fiat: &str,
    asset: &str,
    pay_types: &[String],
    amount: Option<f64>,
    only_merchants: bool,
) -> Result<PublicMarketStats, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let publisher_type = if only_merchants { Some("merchant") } else { None };

    let fetch_side = |trade_type: &str| -> Result<Vec<f64>, String> {
        let body = serde_json::json!({
            "asset": asset,
            "fiat": fiat,
            "merchantCheck": only_merchants,
            "page": 1,
            "payTypes": pay_types,
            "publisherType": publisher_type,
            "rows": 20,
            "tradeType": trade_type,
            "transAmount": amount
        });

        let url = format!("{}/bapi/c2c/v2/friendly/c2c/adv/search", P2P_PUBLIC_BASE_URL);
        let resp = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
            .header("Origin", P2P_PUBLIC_BASE_URL)
            .header("Referer", format!("{}/es/trade/all-payments/{}?fiat={}", P2P_PUBLIC_BASE_URL, asset, fiat))
            .json(&body)
            .send()
            .map_err(|e| format!("Error consultando mercado público P2P: {}", e))?;

        if !resp.status().is_success() {
            return Ok(Vec::new());
        }

        let data: serde_json::Value = resp.json().unwrap_or_default();
        let ads = data.get("data").and_then(|v| v.as_array());

        let mut prices = Vec::new();
        if let Some(ads_list) = ads {
            for ad in ads_list {
                if let Some(adv) = ad.get("adv") {
                    if let Some(price_str) = adv.get("price").and_then(|v| v.as_str()) {
                        if let Ok(p) = price_str.parse::<f64>() {
                            if p > 0.0 {
                                prices.push(p);
                            }
                        }
                    }
                }
            }
        }
        Ok(prices)
    };

    let buy_prices = fetch_side("BUY")?;
    let sell_prices = fetch_side("SELL")?;

    let best_buy = buy_prices.first().copied().unwrap_or(0.0);
    let best_sell = sell_prices.first().copied().unwrap_or(0.0);
    let spread = if best_buy > 0.0 && best_sell > 0.0 {
        (best_sell - best_buy).abs()
    } else {
        0.0
    };
    let spread_pct = if best_buy > 0.0 {
        (spread / best_buy) * 100.0
    } else {
        0.0
    };

    let buy_avg = if !buy_prices.is_empty() {
        buy_prices.iter().take(5).sum::<f64>() / buy_prices.len().min(5) as f64
    } else {
        0.0
    };

    let sell_avg = if !sell_prices.is_empty() {
        sell_prices.iter().take(5).sum::<f64>() / sell_prices.len().min(5) as f64
    } else {
        0.0
    };

    Ok(PublicMarketStats {
        best_buy,
        best_sell,
        spread: (spread * 100.0).round() / 100.0,
        spread_pct: (spread_pct * 100.0).round() / 100.0,
        buy_ads_count: buy_prices.len(),
        sell_ads_count: sell_prices.len(),
        buy_avg_price: (buy_avg * 100.0).round() / 100.0,
        sell_avg_price: (sell_avg * 100.0).round() / 100.0,
    })
}
