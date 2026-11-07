#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // En producción, iniciar el binario sidecar del backend
            #[cfg(not(debug_assertions))]
            {
                let sidecar_command = app.shell().sidecar("p2p-ledger-backend");
                if let Ok(cmd) = sidecar_command {
                    let _ = cmd.spawn();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
