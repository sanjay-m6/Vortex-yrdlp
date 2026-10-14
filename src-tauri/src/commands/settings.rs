use crate::database::{load_app_settings, store_app_settings};
use crate::downloader::AppState;
use crate::models::AppSettings;
use tauri::{command, State};

#[command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    Ok(load_app_settings(&conn))
}

#[command]
pub async fn update_app_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    store_app_settings(&conn, &settings).map_err(|e| e.to_string())
}
