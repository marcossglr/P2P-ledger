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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct P2PNormalizedAd {
    pub adv_no: String,
    pub trade_type: String,
    pub asset: String,
    pub fiat: String,
    pub price: f64,
    pub available_qty: f64,
    pub min_fiat: f64,
    pub max_fiat: f64,
    pub pay_methods: Vec<String>,
    pub pay_identifiers: Vec<String>,
    pub advertiser: String,
    pub user_type: String,
    pub month_orders: i64,
    pub month_finish_rate: f64,
    pub positive_rate: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct P2PSideStats {
    pub count: usize,
    pub best: Option<f64>,
    pub worst: Option<f64>,
    pub avg: Option<f64>,
    pub median: Option<f64>,
    pub top_avg: Option<f64>,
    pub weighted_avg: Option<f64>,
    pub total_available: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct P2PSideResult {
    pub stats: P2PSideStats,
    pub total_reported: usize,
    pub ads: Vec<P2PNormalizedAd>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct P2PSpreadInfo {
    pub absolute: Option<f64>,
    pub percent: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublicMarketSnapshot {
    pub asset: String,
    pub fiat: String,
    pub buy: P2PSideResult,
    pub sell: P2PSideResult,
    pub spread: P2PSpreadInfo,
    pub latency_ms: u128,
    pub fetched_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BinancePaymentMethod {
    pub identifier: String,
    pub name: String,
    pub short_name: Option<String>,
    pub bg_color: Option<String>,
    pub icon_url: Option<String>,
    pub is_hot: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BinanceCryptoAsset {
    pub id: String,
    pub label: String,
    pub name: String,
    pub icon_url: Option<String>,
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

fn parse_safe_f64(val: Option<&serde_json::Value>) -> f64 {
    match val {
        Some(serde_json::Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(serde_json::Value::String(s)) => s.parse::<f64>().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn parse_safe_i64(val: Option<&serde_json::Value>) -> i64 {
    match val {
        Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(0),
        Some(serde_json::Value::String(s)) => s.parse::<i64>().unwrap_or(0),
        _ => 0,
    }
}

fn normalize_p2p_ad(item: &serde_json::Value) -> Option<P2PNormalizedAd> {
    let adv = item.get("adv")?;
    let advertiser = item.get("advertiser");

    let price = parse_safe_f64(adv.get("price"));
    if price <= 0.0 {
        return None;
    }

    let surplus_amt = parse_safe_f64(adv.get("surplusAmount"));
    let tradable_qty = parse_safe_f64(adv.get("tradableQuantity"));
    let available_qty = if surplus_amt > 0.0 { surplus_amt } else { tradable_qty };

    let min_fiat = parse_safe_f64(adv.get("minSingleTransAmount"));
    let dyn_max = parse_safe_f64(adv.get("dynamicMaxSingleTransAmount"));
    let max_trans = parse_safe_f64(adv.get("maxSingleTransAmount"));
    let max_fiat = if dyn_max > 0.0 { dyn_max } else { max_trans };

    let mut pay_methods = Vec::new();
    let mut pay_identifiers = Vec::new();
    if let Some(tms) = adv.get("tradeMethods").and_then(|v| v.as_array()) {
        for tm in tms {
            let ident = tm.get("identifier").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            let name = tm.get("tradeMethodName").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            if !name.is_empty() {
                pay_methods.push(name.clone());
            } else if !ident.is_empty() {
                pay_methods.push(ident.clone());
            }

            if !ident.is_empty() {
                pay_identifiers.push(ident);
            } else if !name.is_empty() {
                pay_identifiers.push(name);
            }
        }
    }

    let nick_name = advertiser
        .and_then(|a| a.get("nickName"))
        .and_then(|v| v.as_str())
        .unwrap_or("-")
        .to_string();

    let user_type = advertiser
        .and_then(|a| a.get("userType"))
        .and_then(|v| v.as_str())
        .unwrap_or("user")
        .to_string();

    let month_orders = advertiser
        .and_then(|a| a.get("monthOrderCount"))
        .map(|v| parse_safe_i64(Some(v)))
        .unwrap_or(0);

    let month_finish_rate = advertiser
        .and_then(|a| a.get("monthFinishRate"))
        .map(|v| parse_safe_f64(Some(v)))
        .unwrap_or(0.0);

    let positive_rate = advertiser
        .and_then(|a| a.get("positiveRate"))
        .map(|v| parse_safe_f64(Some(v)))
        .unwrap_or(0.0);

    Some(P2PNormalizedAd {
        adv_no: adv.get("advNo").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        trade_type: adv.get("tradeType").and_then(|v| v.as_str()).unwrap_or("").to_uppercase(),
        asset: adv.get("asset").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        fiat: adv.get("fiatUnit").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        price,
        available_qty,
        min_fiat,
        max_fiat,
        pay_methods,
        pay_identifiers,
        advertiser: nick_name,
        user_type,
        month_orders,
        month_finish_rate,
        positive_rate,
    })
}

fn compute_side_stats_from_ads(ads: &[P2PNormalizedAd], trade_type: &str, top_n: usize) -> P2PSideStats {
    let mut prices: Vec<f64> = ads.iter().map(|a| a.price).filter(|&p| p > 0.0).collect();
    if prices.is_empty() {
        return P2PSideStats {
            count: 0,
            best: None,
            worst: None,
            avg: None,
            median: None,
            top_avg: None,
            weighted_avg: None,
            total_available: 0.0,
        };
    }

    if trade_type.eq_ignore_ascii_case("BUY") {
        prices.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    } else {
        prices.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
    }

    let count = prices.len();
    let best = prices.first().copied();
    let worst = prices.last().copied();
    let avg = Some(prices.iter().sum::<f64>() / count as f64);

    let median = if count % 2 == 1 {
        Some(prices[count / 2])
    } else {
        Some((prices[count / 2 - 1] + prices[count / 2]) / 2.0)
    };

    let take_n = top_n.max(1).min(count);
    let top_avg = Some(prices.iter().take(take_n).sum::<f64>() / take_n as f64);

    let total_available: f64 = ads.iter().map(|a| a.available_qty).sum();
    let weighted_avg = if total_available > 0.0 {
        let weighted_sum: f64 = ads.iter().map(|a| a.price * a.available_qty).sum();
        Some(weighted_sum / total_available)
    } else {
        top_avg
    };

    P2PSideStats {
        count,
        best: best.map(|v| (v * 10000.0).round() / 10000.0),
        worst: worst.map(|v| (v * 10000.0).round() / 10000.0),
        avg: avg.map(|v| (v * 10000.0).round() / 10000.0),
        median: median.map(|v| (v * 10000.0).round() / 10000.0),
        top_avg: top_avg.map(|v| (v * 10000.0).round() / 10000.0),
        weighted_avg: weighted_avg.map(|v| (v * 10000.0).round() / 10000.0),
        total_available: (total_available * 100.0).round() / 100.0,
    }
}

pub fn fetch_public_market_snapshot(
    fiat: &str,
    asset: &str,
    pay_types: &[String],
    amount: Option<f64>,
    only_merchants: bool,
) -> Result<PublicMarketSnapshot, String> {
    let start_time = std::time::Instant::now();
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let publisher_type = if only_merchants { Some("merchant") } else { None };

    let fetch_side = |trade_type: &str| -> Result<(usize, Vec<P2PNormalizedAd>), String> {
        let body = serde_json::json!({
            "asset": asset,
            "fiat": fiat,
            "merchantCheck": only_merchants,
            "page": 1,
            "payTypes": pay_types,
            "publisherType": publisher_type,
            "rows": 20,
            "tradeType": trade_type,
            "transAmount": amount,
            "countries": [],
            "proMerchantAds": false,
            "shieldMerchantAds": false
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
            return Ok((0, Vec::new()));
        }

        let data: serde_json::Value = resp.json().unwrap_or_default();
        let total = parse_safe_i64(data.get("total")) as usize;
        let mut ads = Vec::new();

        if let Some(items) = data.get("data").and_then(|v| v.as_array()) {
            for item in items {
                if let Some(norm) = normalize_p2p_ad(item) {
                    ads.push(norm);
                }
            }
        }

        Ok((total, ads))
    };

    let (buy_total, buy_ads) = fetch_side("BUY")?;
    let (sell_total, sell_ads) = fetch_side("SELL")?;

    let buy_stats = compute_side_stats_from_ads(&buy_ads, "BUY", 5);
    let sell_stats = compute_side_stats_from_ads(&sell_ads, "SELL", 5);

    let mut spread_abs = None;
    let mut spread_pct = None;
    if let (Some(b_best), Some(s_best)) = (buy_stats.best, sell_stats.best) {
        let abs = b_best - s_best;
        spread_abs = Some((abs * 10000.0).round() / 10000.0);
        if s_best > 0.0 {
            spread_pct = Some(((abs / s_best) * 10000.0).round() / 100.0);
        }
    }

    let latency_ms = start_time.elapsed().as_millis();
    let fetched_at = chrono::Utc::now().to_rfc3339();

    Ok(PublicMarketSnapshot {
        asset: asset.to_uppercase(),
        fiat: fiat.to_uppercase(),
        buy: P2PSideResult {
            stats: buy_stats,
            total_reported: buy_total,
            ads: buy_ads,
        },
        sell: P2PSideResult {
            stats: sell_stats,
            total_reported: sell_total,
            ads: sell_ads,
        },
        spread: P2PSpreadInfo {
            absolute: spread_abs,
            percent: spread_pct,
        },
        latency_ms,
        fetched_at,
    })
}

// ---------------------------------------------------------------------------
// 5. Binance Fiat Payment Methods & Supported Crypto Assets
// ---------------------------------------------------------------------------

pub fn fetch_binance_payment_methods(fiat: &str) -> Result<Vec<BinancePaymentMethod>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let fiat_clean = fiat.trim().to_uppercase();
    let url = format!("{}/bapi/c2c/v2/public/c2c/adv/filter-conditions", P2P_PUBLIC_BASE_URL);

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
        .header("Origin", P2P_PUBLIC_BASE_URL)
        .json(&serde_json::json!({ "fiat": fiat_clean }))
        .send()
        .map_err(|e| format!("Error consultando métodos de pago P2P: {}", e))?;

    if !resp.status().is_success() {
        return Ok(Vec::new());
    }

    let data: serde_json::Value = resp.json().unwrap_or_default();
    let raw_methods = data.get("data").and_then(|d| d.get("tradeMethods")).and_then(|v| v.as_array());

    let mut result = Vec::new();
    if let Some(methods) = raw_methods {
        for (idx, m) in methods.iter().enumerate() {
            let ident = m.get("identifier").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            let name = m.get("tradeMethodName").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
            let short_name = m.get("tradeMethodShortName").and_then(|v| v.as_str()).map(|s| s.trim().to_string());
            let bg_color = m.get("tradeMethodBgColor").and_then(|v| v.as_str()).map(|s| s.trim().to_string());
            let icon_url = m.get("iconUrlColor").and_then(|v| v.as_str()).map(|s| s.trim().to_string());

            let display_ident = if !ident.is_empty() { ident } else { name.clone() };
            let display_name = if !name.is_empty() { name } else { display_ident.clone() };

            if !display_ident.is_empty() || !display_name.is_empty() {
                result.push(BinancePaymentMethod {
                    identifier: display_ident,
                    name: display_name,
                    short_name,
                    bg_color,
                    icon_url,
                    is_hot: idx < 6,
                });
            }
        }
    }

    Ok(result)
}

pub fn fetch_binance_crypto_assets(fiat: &str) -> Result<Vec<BinanceCryptoAsset>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let fiat_clean = fiat.trim().to_uppercase();
    let url = format!("{}/bapi/c2c/v2/friendly/c2c/portal/config", P2P_PUBLIC_BASE_URL);

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
        .header("Origin", P2P_PUBLIC_BASE_URL)
        .json(&serde_json::json!({ "fiat": fiat_clean }))
        .send()
        .map_err(|e| format!("Error consultando criptoactivos P2P: {}", e))?;

    let fallback = vec![
        BinanceCryptoAsset { id: "USDT".to_string(), label: "USDT".to_string(), name: "Tether".to_string(), icon_url: None },
        BinanceCryptoAsset { id: "BTC".to_string(), label: "BTC".to_string(), name: "Bitcoin".to_string(), icon_url: None },
        BinanceCryptoAsset { id: "ETH".to_string(), label: "ETH".to_string(), name: "Ethereum".to_string(), icon_url: None },
        BinanceCryptoAsset { id: "USDC".to_string(), label: "USDC".to_string(), name: "USD Coin".to_string(), icon_url: None },
        BinanceCryptoAsset { id: "BNB".to_string(), label: "BNB".to_string(), name: "BNB".to_string(), icon_url: None },
    ];

    if !resp.status().is_success() {
        return Ok(fallback);
    }

    let data: serde_json::Value = resp.json().unwrap_or_default();
    let areas = data.get("data").and_then(|d| d.get("areas")).and_then(|v| v.as_array());

    if let Some(area_list) = areas {
        let p2p_area = area_list.iter().find(|a| {
            a.get("area").and_then(|v| v.as_str()) == Some("P2P")
        }).or_else(|| {
            area_list.iter().find(|a| a.get("area").and_then(|v| v.as_str()) == Some("EXPRESS"))
        });

        if let Some(area) = p2p_area {
            let trade_sides = area.get("tradeSides").and_then(|v| v.as_array());
            let side = trade_sides.and_then(|sides| {
                sides.iter().find(|s| s.get("side").and_then(|v| v.as_str()) == Some("BUY"))
                    .or_else(|| sides.first())
            });

            if let Some(side_obj) = side {
                if let Some(assets) = side_obj.get("assets").and_then(|v| v.as_array()) {
                    let mut seen = std::collections::HashSet::new();
                    let mut result = Vec::new();

                    for item in assets {
                        let sym = item.get("asset").and_then(|v| v.as_str()).unwrap_or("").trim().to_uppercase();
                        if sym.is_empty() || seen.contains(&sym) {
                            continue;
                        }
                        seen.insert(sym.clone());
                        let desc = item.get("description").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
                        let icon = item.get("iconUrl").and_then(|v| v.as_str()).map(|s| s.trim().to_string());

                        result.push(BinanceCryptoAsset {
                            id: sym.clone(),
                            label: sym.clone(),
                            name: if !desc.is_empty() { desc } else { sym },
                            icon_url: icon,
                        });
                    }

                    if !result.is_empty() {
                        return Ok(result);
                    }
                }
            }
        }
    }

    Ok(fallback)
}
