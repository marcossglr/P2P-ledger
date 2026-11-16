use std::fs;
use std::path::PathBuf;
use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri::Manager;
use crate::db::{init_database, DbState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkspaceMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspacesConfig {
    pub active_workspace_id: String,
    pub workspaces: Vec<WorkspaceMeta>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceSummary {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub is_active: bool,
    pub is_default: bool,
    pub db_size_mb: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspacesListResponse {
    pub active_workspace_id: String,
    pub workspaces: Vec<WorkspaceSummary>,
}

pub fn get_app_base_dir(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("p2p-ledger");

    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }
    app_dir
}

pub fn get_workspaces_dir(app: &AppHandle) -> PathBuf {
    let dir = get_app_base_dir(app).join("workspaces");
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    dir
}

pub fn get_workspaces_config_path(app: &AppHandle) -> PathBuf {
    get_app_base_dir(app).join("workspaces.json")
}

fn sanitize_workspace_id(name: &str) -> String {
    let mut clean: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect();
    
    while clean.contains("__") {
        clean = clean.replace("__", "_");
    }
    clean = clean.trim_matches('_').to_string();
    if clean.is_empty() {
        clean = "perfil".to_string();
    }
    format!("{}_{}", clean, Local::now().format("%Y%m%d%H%M%S"))
}

pub fn get_workspace_db_path(app: &AppHandle, workspace_id: &str) -> PathBuf {
    if workspace_id == "default" {
        get_app_base_dir(app).join("ledger.db")
    } else {
        get_workspaces_dir(app).join(format!("{}.db", workspace_id))
    }
}

pub fn load_or_init_workspaces_config(app: &AppHandle) -> WorkspacesConfig {
    let config_path = get_workspaces_config_path(app);
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<WorkspacesConfig>(&content) {
                if !config.workspaces.is_empty() {
                    return config;
                }
            }
        }
    }

    // Si no existe, crear la configuración inicial con el workspace por defecto (usando ledger.db existente)
    let default_ws = WorkspaceMeta {
        id: "default".to_string(),
        name: "Principal".to_string(),
        description: "Espacio de trabajo principal".to_string(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        is_default: true,
    };

    let initial_config = WorkspacesConfig {
        active_workspace_id: "default".to_string(),
        workspaces: vec![default_ws],
    };

    let _ = save_workspaces_config(app, &initial_config);
    initial_config
}

pub fn save_workspaces_config(app: &AppHandle, config: &WorkspacesConfig) -> Result<(), String> {
    let config_path = get_workspaces_config_path(app);
    let json_data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(config_path, json_data).map_err(|e| e.to_string())
}

pub fn list_workspaces(app: &AppHandle) -> Result<WorkspacesListResponse, String> {
    let config = load_or_init_workspaces_config(app);

    let mut summaries = Vec::new();
    for ws in &config.workspaces {
        let db_path = get_workspace_db_path(app, &ws.id);
        let size_mb = if db_path.exists() {
            fs::metadata(&db_path)
                .map(|m| (m.len() as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0)
                .unwrap_or(0.0)
        } else {
            0.0
        };

        summaries.push(WorkspaceSummary {
            id: ws.id.clone(),
            name: ws.name.clone(),
            description: ws.description.clone(),
            created_at: ws.created_at.clone(),
            is_active: ws.id == config.active_workspace_id,
            is_default: ws.is_default,
            db_size_mb: size_mb,
        });
    }

    Ok(WorkspacesListResponse {
        active_workspace_id: config.active_workspace_id,
        workspaces: summaries,
    })
}

pub fn create_new_workspace(
    app: &AppHandle,
    name: &str,
    description: &str,
) -> Result<WorkspaceSummary, String> {
    let clean_name = name.trim();
    if clean_name.is_empty() {
        return Err("El nombre del workspace no puede estar vacío".to_string());
    }

    let mut config = load_or_init_workspaces_config(app);
    let ws_id = sanitize_workspace_id(clean_name);
    let db_path = get_workspace_db_path(app, &ws_id);

    // Inicializar SQLite con el esquema de P2P Ledger en el nuevo archivo .db
    let _ = init_database(&db_path).map_err(|e| format!("Error creando base de datos: {}", e))?;

    let meta = WorkspaceMeta {
        id: ws_id.clone(),
        name: clean_name.to_string(),
        description: description.trim().to_string(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        is_default: false,
    };

    config.workspaces.push(meta.clone());
    save_workspaces_config(app, &config)?;

    let size_mb = fs::metadata(&db_path)
        .map(|m| (m.len() as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0)
        .unwrap_or(0.0);

    Ok(WorkspaceSummary {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        created_at: meta.created_at,
        is_active: false,
        is_default: false,
        db_size_mb: size_mb,
    })
}

pub fn switch_active_workspace(
    app: &AppHandle,
    state: &DbState,
    target_workspace_id: &str,
) -> Result<WorkspaceSummary, String> {
    let mut config = load_or_init_workspaces_config(app);

    let target_meta = config
        .workspaces
        .iter()
        .find(|w| w.id == target_workspace_id)
        .cloned()
        .ok_or_else(|| format!("El workspace '{}' no existe", target_workspace_id))?;

    let db_path = get_workspace_db_path(app, target_workspace_id);
    let new_conn = init_database(&db_path).map_err(|e| format!("Error abriendo workspace: {}", e))?;

    // Reemplazar la conexión de SQLite en memoria (DbState)
    {
        let mut conn = state.conn.lock().map_err(|e| e.to_string())?;
        *conn = new_conn;
    }

    config.active_workspace_id = target_workspace_id.to_string();
    save_workspaces_config(app, &config)?;

    let size_mb = fs::metadata(&db_path)
        .map(|m| (m.len() as f64 / (1024.0 * 1024.0) * 100.0).round() / 100.0)
        .unwrap_or(0.0);

    Ok(WorkspaceSummary {
        id: target_meta.id,
        name: target_meta.name,
        description: target_meta.description,
        created_at: target_meta.created_at,
        is_active: true,
        is_default: target_meta.is_default,
        db_size_mb: size_mb,
    })
}

pub fn rename_workspace(
    app: &AppHandle,
    workspace_id: &str,
    new_name: &str,
    new_description: &str,
) -> Result<(), String> {
    let clean_name = new_name.trim();
    if clean_name.is_empty() {
        return Err("El nombre del workspace no puede estar vacío".to_string());
    }

    let mut config = load_or_init_workspaces_config(app);
    let mut found = false;
    for ws in &mut config.workspaces {
        if ws.id == workspace_id {
            ws.name = clean_name.to_string();
            ws.description = new_description.trim().to_string();
            found = true;
            break;
        }
    }

    if !found {
        return Err(format!("El workspace '{}' no fue encontrado", workspace_id));
    }

    save_workspaces_config(app, &config)
}

pub fn delete_workspace_by_id(
    app: &AppHandle,
    workspace_id: &str,
) -> Result<(), String> {
    if workspace_id == "default" {
        return Err("No se puede eliminar el workspace Principal".to_string());
    }

    let mut config = load_or_init_workspaces_config(app);
    if config.active_workspace_id == workspace_id {
        return Err("No se puede eliminar el workspace que está actualmente activo. Cambia a otro workspace primero.".to_string());
    }

    let idx = config
        .workspaces
        .iter()
        .position(|w| w.id == workspace_id)
        .ok_or_else(|| format!("El workspace '{}' no existe", workspace_id))?;

    config.workspaces.remove(idx);
    save_workspaces_config(app, &config)?;

    // Eliminar archivo físico .db y posibles archivos WAL/SHM
    let db_path = get_workspace_db_path(app, workspace_id);
    if db_path.exists() {
        let _ = fs::remove_file(&db_path);
    }
    let wal_path = db_path.with_extension("db-wal");
    if wal_path.exists() {
        let _ = fs::remove_file(wal_path);
    }
    let shm_path = db_path.with_extension("db-shm");
    if shm_path.exists() {
        let _ = fs::remove_file(shm_path);
    }

    Ok(())
}
