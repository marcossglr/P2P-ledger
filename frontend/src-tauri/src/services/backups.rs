use std::fs;
use std::path::{Path, PathBuf};
use chrono::Local;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;
use crate::db::get_database_path;

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupEntry {
    pub filename: String,
    pub size_bytes: u64,
    pub size_kb: f64,
    pub size_mb: f64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupsListResponse {
    pub status: String,
    pub current_db_size_bytes: u64,
    pub current_db_size_kb: f64,
    pub current_db_size_mb: f64,
    pub backups: Vec<BackupEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBackupResponse {
    pub status: String,
    pub filename: String,
    pub size_mb: f64,
    pub message: String,
}

pub fn get_backups_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("p2p-ledger")
        .join("backups");

    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

fn is_safe_filename(name: &str) -> bool {
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return false;
    }
    name.ends_with(".db") && name.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.')
}

pub fn list_backups(app: &AppHandle) -> Result<BackupsListResponse, String> {
    let db_path = get_database_path(app);
    let backups_dir = get_backups_dir(app);

    let current_db_size = if db_path.exists() {
        fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let mut backups = Vec::new();
    if backups_dir.exists() {
        if let Ok(entries) = fs::read_dir(&backups_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("db") {
                    if let Ok(meta) = fs::metadata(&path) {
                        let len = meta.len();
                        let created_at = meta.modified()
                            .ok()
                            .and_then(|time| {
                                let dt: chrono::DateTime<Local> = time.into();
                                Some(dt.format("%Y-%m-%d %H:%M:%S").to_string())
                            })
                            .unwrap_or_else(|| "-".to_string());

                        let filename = entry.file_name().to_string_lossy().to_string();
                        backups.push(BackupEntry {
                            filename,
                            size_bytes: len,
                            size_kb: (len as f64 / 1024.0 * 100.0).round() / 100.0,
                            size_mb: (len as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0,
                            created_at,
                        });
                    }
                }
            }
        }
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(BackupsListResponse {
        status: "success".to_string(),
        current_db_size_bytes: current_db_size,
        current_db_size_kb: (current_db_size as f64 / 1024.0 * 100.0).round() / 100.0,
        current_db_size_mb: (current_db_size as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0,
        backups,
    })
}

pub fn create_backup(app: &AppHandle, conn: &Connection) -> Result<CreateBackupResponse, String> {
    let backups_dir = get_backups_dir(app);
    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("backup_{}.db", timestamp);
    let target_path = backups_dir.join(&filename);

    // Usar VACUUM INTO para generar un snapshot transaccionalmente seguro y compacto
    let sql = format!("VACUUM INTO '{}';", target_path.to_string_lossy().replace('\'', "''"));
    conn.execute(&sql, []).map_err(|e| format!("Error generando backup: {}", e))?;

    let size_mb = if target_path.exists() {
        fs::metadata(&target_path)
            .map(|m| (m.len() as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0)
            .unwrap_or(0.0)
    } else {
        0.0
    };

    Ok(CreateBackupResponse {
        status: "success".to_string(),
        filename,
        size_mb,
        message: "Copia de seguridad creada con éxito".to_string(),
    })
}

pub fn restore_backup(app: &AppHandle, conn: &mut Connection, filename: &str) -> Result<String, String> {
    if !is_safe_filename(filename) {
        return Err("Nombre de archivo de respaldo inválido".to_string());
    }

    let backups_dir = get_backups_dir(app);
    let backup_file = backups_dir.join(filename);
    if !backup_file.exists() {
        return Err(format!("El archivo de respaldo {} no existe", filename));
    }

    let backup_conn = Connection::open(&backup_file).map_err(|e| format!("No se pudo abrir el respaldo: {}", e))?;

    // Usar SQLite Online Backup API en Rust
    let backup = rusqlite::backup::Backup::new(&backup_conn, conn)
        .map_err(|e| format!("Error iniciando restauración: {}", e))?;

    backup.run_to_completion(5, std::time::Duration::from_millis(50), None)
        .map_err(|e| format!("Error durante la restauración: {}", e))?;

    Ok(format!("Base de datos restaurada exitosamente desde {}", filename))
}

pub fn delete_backup(app: &AppHandle, filename: &str) -> Result<(), String> {
    if !is_safe_filename(filename) {
        return Err("Nombre de archivo de respaldo inválido".to_string());
    }

    let backups_dir = get_backups_dir(app);
    let target = backups_dir.join(filename);
    if target.exists() {
        fs::remove_file(target).map_err(|e| format!("Error eliminando respaldo: {}", e))?;
    }
    Ok(())
}

pub fn save_uploaded_backup_bytes(app: &AppHandle, filename: &str, bytes: &[u8]) -> Result<CreateBackupResponse, String> {
    let clean_name = Path::new(filename)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("uploaded_backup.db");

    let final_name = if is_safe_filename(clean_name) {
        clean_name.to_string()
    } else {
        let ts = Local::now().format("%Y%m%d_%H%M%S").to_string();
        format!("backup_upload_{}.db", ts)
    };

    let backups_dir = get_backups_dir(app);
    let target_path = backups_dir.join(&final_name);

    fs::write(&target_path, bytes).map_err(|e| format!("Error guardando archivo: {}", e))?;

    let size_mb = (bytes.len() as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0;
    Ok(CreateBackupResponse {
        status: "success".to_string(),
        filename: final_name,
        size_mb,
        message: "Respaldo importado correctamente".to_string(),
    })
}

pub fn read_backup_bytes(app: &AppHandle, filename: &str) -> Result<Vec<u8>, String> {
    if !is_safe_filename(filename) {
        return Err("Nombre de archivo de respaldo inválido".to_string());
    }

    let backups_dir = get_backups_dir(app);
    let target = backups_dir.join(filename);
    if !target.exists() {
        return Err(format!("El archivo {} no existe", filename));
    }

    fs::read(target).map_err(|e| format!("Error leyendo respaldo: {}", e))
}
