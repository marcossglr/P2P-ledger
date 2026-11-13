use log::info;
use tauri::{AppHandle, State};
use crate::db::DbState;
use crate::services::backups::{
    list_backups, create_backup, restore_backup, delete_backup,
    save_uploaded_backup_bytes, read_backup_bytes,
    BackupsListResponse, CreateBackupResponse,
};
use crate::services::csv_importer::{import_binance_csv_text, BinanceCsvImportResult};

#[tauri::command]
pub fn get_backups_list(app: AppHandle) -> Result<BackupsListResponse, String> {
    list_backups(&app)
}

#[tauri::command]
pub fn create_db_backup(app: AppHandle, state: State<'_, DbState>) -> Result<CreateBackupResponse, String> {
    info!("[Backup] Creando copia de seguridad de la base de datos...");
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    create_backup(&app, &conn)
}

#[tauri::command]
pub fn restore_db_backup(
    app: AppHandle,
    filename: String,
    state: State<'_, DbState>,
) -> Result<String, String> {
    info!("[Backup] Restaurando base de datos desde archivo: {}...", filename);
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
    restore_backup(&app, &mut conn, &filename)
}

#[tauri::command]
pub fn delete_db_backup(app: AppHandle, filename: String) -> Result<(), String> {
    delete_backup(&app, &filename)
}

#[tauri::command]
pub fn upload_db_backup(
    app: AppHandle,
    filename: String,
    file_bytes: Vec<u8>,
) -> Result<CreateBackupResponse, String> {
    save_uploaded_backup_bytes(&app, &filename, &file_bytes)
}

#[tauri::command]
pub fn export_db_backup(
    app: AppHandle,
    filename: String,
) -> Result<Vec<u8>, String> {
    read_backup_bytes(&app, &filename)
}

#[tauri::command]
pub fn import_binance_csv(
    csv_text: String,
    filename: String,
    state: State<'_, DbState>,
) -> Result<BinanceCsvImportResult, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    import_binance_csv_text(&conn, &csv_text, &filename)
}
