use tauri::{AppHandle, State};
use crate::db::DbState;
use crate::services::workspaces::{
    list_workspaces, create_new_workspace, switch_active_workspace,
    rename_workspace, delete_workspace_by_id,
    WorkspacesListResponse, WorkspaceSummary,
};

#[tauri::command]
pub fn get_workspaces(app: AppHandle) -> Result<WorkspacesListResponse, String> {
    list_workspaces(&app)
}

#[tauri::command]
pub fn create_workspace(
    app: AppHandle,
    name: String,
    description: Option<String>,
) -> Result<WorkspaceSummary, String> {
    create_new_workspace(&app, &name, &description.unwrap_or_default())
}

#[tauri::command]
pub fn switch_workspace(
    app: AppHandle,
    workspace_id: String,
    state: State<'_, DbState>,
) -> Result<WorkspaceSummary, String> {
    switch_active_workspace(&app, &state, &workspace_id)
}

#[tauri::command]
pub fn update_workspace(
    app: AppHandle,
    workspace_id: String,
    name: String,
    description: Option<String>,
) -> Result<(), String> {
    rename_workspace(&app, &workspace_id, &name, &description.unwrap_or_default())
}

#[tauri::command]
pub fn delete_workspace(
    app: AppHandle,
    workspace_id: String,
) -> Result<(), String> {
    delete_workspace_by_id(&app, &workspace_id)
}
