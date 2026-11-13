use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{Connection, Result};
use tauri::AppHandle;
use tauri::Manager;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

pub fn get_database_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("p2p-ledger");

    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }

    app_dir.join("ledger.db")
}

pub fn init_database(db_path: &PathBuf) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;"
    )?;

    // Estructura completa y fidedigna del modelo de datos
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS bank_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            binance_pay_id TEXT DEFAULT '',
            pay_method_identifier TEXT DEFAULT '',
            name TEXT NOT NULL,
            fiat_currency TEXT DEFAULT 'VES',
            is_active INTEGER DEFAULT 1,
            account_alias TEXT DEFAULT '',
            match_keywords TEXT DEFAULT '',
            is_default INTEGER DEFAULT 0,
            apply_buy_fee INTEGER DEFAULT 1,
            pago_movil_fee_pct REAL DEFAULT 0.3,
            transfer_fee_pct REAL DEFAULT 0.0,
            anchor_balance REAL DEFAULT 0.0,
            anchor_timestamp INTEGER DEFAULT 0,
            anchor_date_label TEXT DEFAULT 'Inicio',
            manual_delta_bs REAL DEFAULT 0.0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS bank_balance_adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            account_name TEXT,
            adjustment_type TEXT NOT NULL,
            previous_balance REAL DEFAULT 0.0,
            new_balance REAL DEFAULT 0.0,
            delta_amount REAL DEFAULT 0.0,
            note TEXT DEFAULT '',
            created_at_str TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS binance_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER,
            order_number TEXT UNIQUE NOT NULL,
            adv_no TEXT,
            order_type TEXT NOT NULL,
            asset TEXT DEFAULT 'USDT',
            fiat_currency TEXT DEFAULT 'VES',
            fiat_amount REAL DEFAULT 0.0,
            crypto_amount REAL DEFAULT 0.0,
            unit_price REAL DEFAULT 0.0,
            commission_usdt REAL DEFAULT 0.0,
            pay_method TEXT,
            counterparty TEXT,
            reference_note TEXT,
            create_timestamp INTEGER DEFAULT 0,
            order_date TEXT,
            order_status TEXT DEFAULT 'COMPLETED',
            source TEXT DEFAULT 'API',
            bank_account_id INTEGER,
            payment_channel TEXT,
            payment_channel_manual INTEGER DEFAULT 0,
            FOREIGN KEY(bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_orders_fiat_status_ts ON binance_orders(fiat_currency, order_status, create_timestamp);
        CREATE INDEX IF NOT EXISTS idx_orders_fiat_bank_date ON binance_orders(fiat_currency, bank_account_id, order_date);

        CREATE TABLE IF NOT EXISTS binance_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key TEXT NOT NULL,
            api_secret TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS public_market_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fiat TEXT DEFAULT 'VES',
            asset TEXT DEFAULT 'USDT',
            trade_type TEXT DEFAULT 'BUY',
            payment_methods TEXT DEFAULT '[]',
            rows INTEGER DEFAULT 10,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );"
    )?;

    Ok(conn)
}
