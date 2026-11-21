use log::info;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use crate::db::DbState;
use crate::services::binance::{
    get_saved_config, save_config, clear_config, fetch_funding_asset_balance,
    get_raw_credentials, fetch_public_market_snapshot,
    fetch_binance_payment_methods, fetch_binance_crypto_assets, fetch_user_p2p_ads,
    BinanceConfigResponse, FundingWalletResponse, SyncResult, SyncProgressEvent,
    PublicMarketSnapshot, BinancePaymentMethod, BinanceCryptoAsset, P2PUserAd,
};

#[derive(Debug, Deserialize)]
pub struct CredentialsPayload {
    pub api_key: String,
    pub api_secret: String,
}

#[derive(Debug, Deserialize)]
pub struct SyncOrdersPayload {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub force_full_180d: Option<bool>,
    pub force_full_90d: Option<bool>,
    pub days: Option<i64>,
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

#[derive(Debug, Deserialize)]
pub struct PublicMarketStatsQuery {
    pub asset: Option<String>,
    pub fiat: Option<String>,
    pub bank: Option<String>,
    pub amount: Option<f64>,
    pub only_merchants: Option<bool>,
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
pub fn get_funding_wallet(state: State<'_, DbState>) -> Result<FundingWalletResponse, String> {
    info!("[Binance] Solicitando balance de la Funding Wallet (USDT)...");
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let res = fetch_funding_asset_balance(&conn, "USDT");
    if let Ok(ref w) = res {
        info!("[Binance] Balance obtenido ({}): Libre={:.2}, Bloqueado={:.2}, Total={:.2}", w.source, w.free, w.locked, w.total);
    }
    res
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
pub async fn sync_binance_orders(
    app: AppHandle,
    payload: Option<SyncOrdersPayload>,
    state: State<'_, DbState>,
) -> Result<SyncResult, String> {
    info!("[Binance] Iniciando sincronización de órdenes P2P con Binance...");
    let payload = payload.unwrap_or(SyncOrdersPayload {
        api_key: None,
        api_secret: None,
        force_full_180d: None,
        force_full_90d: None,
        days: None,
    });

    let force_full = payload.force_full_180d.unwrap_or(false) || payload.force_full_90d.unwrap_or(false);

    // 1. Obtener credenciales y rango sin retener el Mutex durante la llamada HTTP
    let (api_key, api_secret, start_ms, sync_mode) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;

        let (k, s) = if let (Some(k), Some(s)) = (&payload.api_key, &payload.api_secret) {
            if !k.trim().is_empty() && !s.trim().is_empty() {
                save_config(&conn, k.trim(), s.trim()).map_err(|e| e.to_string())?;
                (k.trim().to_string(), s.trim().to_string())
            } else {
                return Err("Credenciales de API vacías".to_string());
            }
        } else {
            match get_raw_credentials(&conn).map_err(|e| e.to_string())? {
                Some(creds) => creds,
                None => return Err("No se han configurado credenciales de API de Binance".to_string()),
            }
        };

        let now_ms = crate::services::binance::current_timestamp_ms() as i64;
        let days_back = payload.days.unwrap_or(180).clamp(1, 180);
        let full_range_ms = now_ms - (days_back * 24 * 60 * 60 * 1000);

        let latest_ts: Option<i64> = conn
            .query_row(
                "SELECT MAX(create_timestamp) FROM binance_orders WHERE source = 'API'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let (st_ms, mode) = if force_full || latest_ts.is_none() || latest_ts.unwrap_or(0) <= 0 {
            (full_range_ms, format!("FULL_{}D", days_back))
        } else {
            let overlap_ms = 12 * 3600 * 1000;
            let inc_start = std::cmp::max(full_range_ms, latest_ts.unwrap() - overlap_ms);
            (inc_start, "INCREMENTAL".to_string())
        };

        (k, s, st_ms, mode)
    }; // <- AQUÍ SE LIBERA EL MUTEX DE SQLITE! La app sigue respondiendo sin congelarse.

    let _ = app.emit(
        "binance-sync-progress",
        &SyncProgressEvent {
            stage: "VALIDATING".to_string(),
            current_window: 0,
            total_windows: 1,
            percent: 5,
            orders_found: 0,
            message: "Conectando con Binance P2P...".to_string(),
        },
    );

    // 2. Descargar órdenes en un hilo secundario sin retener el Mutex de la base de datos
    let end_ms = crate::services::binance::current_timestamp_ms() as i64;
    let app_for_thread = app.clone();
    let api_key_clone = api_key.clone();
    let api_secret_clone = api_secret.clone();

    let orders_res = tauri::async_runtime::spawn_blocking(move || {
        crate::services::binance::fetch_c2c_orders_range(
            &api_key_clone,
            &api_secret_clone,
            start_ms,
            end_ms,
            move |cur_w, tot_w, found, msg| {
                let calculated_pct = 10 + (((cur_w as f64) / (tot_w as f64)) * 75.0) as u8;
                let percent = calculated_pct.clamp(10, 85);
                let _ = app_for_thread.emit(
                    "binance-sync-progress",
                    &SyncProgressEvent {
                        stage: "FETCHING".to_string(),
                        current_window: cur_w,
                        total_windows: tot_w,
                        percent,
                        orders_found: found,
                        message: msg.to_string(),
                    },
                );
            },
        )
    })
    .await
    .map_err(|e| format!("Error en tarea de descarga: {}", e))?;

    let orders = match orders_res {
        Ok(ords) => ords,
        Err(e) => {
            let _ = app.emit(
                "binance-sync-progress",
                &SyncProgressEvent {
                    stage: "ERROR".to_string(),
                    current_window: 0,
                    total_windows: 1,
                    percent: 0,
                    orders_found: 0,
                    message: e.clone(),
                },
            );
            return Err(e);
        }
    };

    let _ = app.emit(
        "binance-sync-progress",
        &SyncProgressEvent {
            stage: "SAVING".to_string(),
            current_window: 1,
            total_windows: 1,
            percent: 90,
            orders_found: orders.len(),
            message: format!("Guardando {} órdenes en SQLite...", orders.len()),
        },
    );

    // 3. Volver a abrir SQLite brevemente para hacer el commit en bloque
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let sync_result = crate::services::binance::save_orders_batch(&conn, &orders, start_ms, end_ms, &sync_mode)?;

    let _ = app.emit(
        "binance-sync-progress",
        &SyncProgressEvent {
            stage: "DONE".to_string(),
            current_window: 1,
            total_windows: 1,
            percent: 100,
            orders_found: orders.len(),
            message: format!(
                "Sincronización completada: {} órdenes ({} nuevas).",
                orders.len(),
                sync_result.new_orders
            ),
        },
    );

    Ok(sync_result)
}

#[tauri::command]
pub fn get_my_ads(state: State<'_, DbState>) -> Result<Vec<P2PUserAd>, String> {
    info!("[Binance] Consultando anuncios P2P activos del usuario...");
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let ads = fetch_user_p2p_ads(&conn)?;
    info!("[Binance] Anuncios P2P obtenidos: {} anuncios", ads.len());
    Ok(ads)
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

#[tauri::command]
pub fn get_public_market_stats(
    query: Option<PublicMarketStatsQuery>,
) -> Result<PublicMarketSnapshot, String> {
    let q = query.unwrap_or(PublicMarketStatsQuery {
        asset: None,
        fiat: None,
        bank: None,
        amount: None,
        only_merchants: None,
    });

    let fiat = q.fiat.unwrap_or_else(|| "VES".to_string());
    let asset = q.asset.unwrap_or_else(|| "USDT".to_string());
    let mut pay_types = Vec::new();
    if let Some(b) = q.bank {
        let b_clean = b.trim();
        if !b_clean.is_empty() && !b_clean.eq_ignore_ascii_case("ALL") {
            pay_types.push(b_clean.to_string());
        }
    }

    let only_merchants = q.only_merchants.unwrap_or(false);
    info!("[Market] Consultando mercado P2P público: {}/{} ({})...", asset, fiat, if only_merchants { "solo merchants" } else { "todos" });
    fetch_public_market_snapshot(&fiat, &asset, &pay_types, q.amount, only_merchants)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BinancePaymentMethodsResponse {
    pub fiat: String,
    pub total: usize,
    pub methods: Vec<BinancePaymentMethod>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BinanceCryptoAssetsResponse {
    pub fiat: String,
    pub total: usize,
    pub assets: Vec<BinanceCryptoAsset>,
}

#[tauri::command]
pub fn get_payment_methods(
    fiat: Option<String>,
) -> Result<BinancePaymentMethodsResponse, String> {
    let f = fiat.unwrap_or_else(|| "VES".to_string());
    let methods = fetch_binance_payment_methods(&f)?;
    let total = methods.len();
    Ok(BinancePaymentMethodsResponse {
        fiat: f.to_uppercase(),
        total,
        methods,
    })
}

#[tauri::command]
pub fn get_crypto_assets(
    fiat: Option<String>,
) -> Result<BinanceCryptoAssetsResponse, String> {
    let f = fiat.unwrap_or_else(|| "VES".to_string());
    let assets = fetch_binance_crypto_assets(&f)?;
    let total = assets.len();
    Ok(BinanceCryptoAssetsResponse {
        fiat: f.to_uppercase(),
        total,
        assets,
    })
}
