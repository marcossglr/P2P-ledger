#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{Manager, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;

#[derive(Debug, Deserialize)]
struct RuntimeInfo {
    port: u16,
    host: Option<String>,
    pid: Option<u32>,
}

/// Obtiene la ruta del archivo runtime temporal emitido por el backend.
fn get_runtime_filepath() -> PathBuf {
    let mut temp = std::env::temp_dir();
    #[cfg(unix)]
    {
        let uid = unsafe { libc_getuid() };
        temp.push(format!("p2p-ledger-runtime-{uid}.json"));
    }
    #[cfg(not(unix))]
    {
        temp.push("p2p-ledger-runtime.json");
    }
    temp
}

#[cfg(unix)]
unsafe fn libc_getuid() -> u32 {
    extern "C" {
        fn getuid() -> u32;
    }
    getuid()
}

#[cfg(unix)]
unsafe fn libc_kill(pid: i32, sig: i32) -> i32 {
    extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }
    kill(pid, sig)
}

/// Verifica si un proceso dado sigue con vida en el sistema operativo.
fn is_process_alive(pid: u32) -> bool {
    #[cfg(unix)]
    {
        // En Unix, kill con señal 0 no envía ninguna señal, pero comprueba si el proceso existe.
        unsafe { libc_kill(pid as i32, 0) == 0 }
    }
    #[cfg(windows)]
    {
        use std::os::windows::raw::HANDLE;
        extern "system" {
            fn OpenProcess(dwDesiredAccess: u32, bInheritHandle: i32, dwProcessId: u32) -> HANDLE;
            fn CloseHandle(hObject: HANDLE) -> i32;
        }
        const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if !handle.is_null() {
                CloseHandle(handle);
                true
            } else {
                false
            }
        }
    }
    #[cfg(not(any(unix, windows)))]
    {
        true
    }
}

/// Comando invocado desde el Frontend para consultar el puerto dinámico del backend en producción.
#[tauri::command]
fn get_backend_port() -> Result<u16, String> {
    let file = get_runtime_filepath();
    if !file.exists() {
        return Err("Runtime file not found yet".to_string());
    }
    let content = fs::read_to_string(&file).map_err(|e| e.to_string())?;
    let info: RuntimeInfo = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Si el archivo registra un PID, verificar que no sea un descriptor huérfano de una sesión anterior cerrada
    if let Some(pid) = info.pid {
        if !is_process_alive(pid) {
            // Eliminar el archivo huérfano y esperar al backend recién lanzado
            let _ = fs::remove_file(&file);
            return Err("Runtime file is stale (process already dead)".to_string());
        }
    }

    Ok(info.port)
}

/// Identificador anterior de la app (antes del rebranding a `io.github.marcossglr.p2pledger`).
/// El WebView guarda su almacenamiento (localStorage: tema, fiat, sonidos, formato de hora...)
/// dentro de una carpeta que depende del identifier, por lo que hay que migrarla una única vez.
const LEGACY_IDENTIFIER: &str = "com.p2pledger.app";

/// Copia recursivamente `src` dentro de `dst`.
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

/// Migra la carpeta de datos locales del WebView desde el identifier anterior al nuevo.
/// Solo actúa si existe la carpeta antigua y la nueva aún no existe; nunca sobrescribe ni borra.
/// Los datos del backend (SQLite) no se ven afectados: viven en `<data>/p2p-ledger`.
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
        // Eliminar una copia parcial para reintentar en el próximo arranque.
        let _ = fs::remove_dir_all(&new_dir);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_backend_port])
        .setup(|app| {
            // 1. Migrar preferencias del identifier anterior ANTES de crear el WebView
            migrate_legacy_webview_data(app);

            // 2. Crear la ventana principal (en tauri.conf.json tiene `"create": false`)
            let window_config = app
                .config()
                .app
                .windows
                .iter()
                .find(|w| w.label == "main")
                .cloned()
                .expect("falta la configuración de la ventana 'main' en tauri.conf.json");
            WebviewWindowBuilder::from_config(app.handle(), &window_config)?.build()?;

            // 3. En producción, iniciar el binario sidecar del backend
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
