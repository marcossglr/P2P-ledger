#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod services;
mod commands;

use std::fs;
use std::io;
use std::path::Path;
use std::sync::Mutex;

use tauri::{Manager, WebviewWindowBuilder};
use db::{init_database, get_database_path, DbState};
use commands::banks::{
    get_bank_inventory,
    create_bank_account,
    update_bank_account,
    delete_bank_account,
    reconcile_bank_account,
    assign_order_to_bank,
};
use commands::operations::{
    get_operations,
    update_payment_channel,
    seed_demo_operations,
    clear_operations,
    system_reset,
};
use commands::binance::{
    get_binance_config,
    save_binance_config,
    delete_binance_config,
    get_funding_wallet,
    set_funding_wallet_manual,
    sync_binance_orders,
    get_my_ads,
    get_public_market_config,
    save_public_market_config,
    get_public_market_stats,
    get_payment_methods,
    get_crypto_assets,
};

const LEGACY_IDENTIFIER: &str = "com.p2pledger.app";

fn copy_dir_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let target = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

fn migrate_legacy_webview_data(app: &tauri::App) {
    let Ok(new_dir) = app.path().app_local_data_dir() else {
        return;
    };
    let old_dir = new_dir.with_file_name(LEGACY_IDENTIFIER);
    if old_dir == new_dir || !old_dir.is_dir() || new_dir.exists() {
        return;
    }
    if let Err(err) = copy_dir_recursive(&old_dir, &new_dir) {
        eprintln!("[P2P Ledger] No se pudo migrar el almacenamiento local del WebView: {err}");
        let _ = fs::remove_dir_all(&new_dir);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Bank inventory
            get_bank_inventory,
            create_bank_account,
            update_bank_account,
            delete_bank_account,
            reconcile_bank_account,
            assign_order_to_bank,
            // Operations & analytics
            get_operations,
            update_payment_channel,
            seed_demo_operations,
            clear_operations,
            system_reset,
            // Binance
            get_binance_config,
            save_binance_config,
            delete_binance_config,
            get_funding_wallet,
            set_funding_wallet_manual,
            sync_binance_orders,
            get_my_ads,
            get_public_market_config,
            save_public_market_config,
            get_public_market_stats,
            get_payment_methods,
            get_crypto_assets
        ])
        .setup(|app| {
            // 1. Migrar datos de versiones anteriores
            migrate_legacy_webview_data(app);

            // 2. Inicializar base de datos SQLite embebida
            let db_path = get_database_path(app.handle());
            let conn = init_database(&db_path).expect("Error al inicializar la base de datos SQLite");
            app.manage(DbState {
                conn: Mutex::new(conn),
            });

            // 3. Crear la ventana principal de la aplicación
            let window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .expect("falta la configuración de la ventana 'main' en tauri.conf.json");
            WebviewWindowBuilder::from_config(app.handle(), &window_config)?.build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
