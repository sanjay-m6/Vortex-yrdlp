use tauri::{command, AppHandle, Runtime, State};

use crate::database::{
    clear_completed_downloads_db, clear_failed_downloads_db, delete_history_record,
    fetch_media_item_by_id, query_media_library,
};
use crate::downloader::{
    batch_verify_library, delete_media_file_on_disk, open_containing_folder, open_media_file,
    relink_file_service, verify_item_by_id, AppState,
};
use crate::models::{MediaLibraryFilter, MediaLibraryItem, MediaLibraryResponse};

#[command]
pub async fn get_download_history(
    filter: Option<MediaLibraryFilter>,
    state: State<'_, AppState>,
) -> Result<MediaLibraryResponse, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let f = filter.unwrap_or_default();
    query_media_library(&conn, &f).map_err(|e| e.to_string())
}

#[command]
pub async fn search_media_library(
    filter: MediaLibraryFilter,
    state: State<'_, AppState>,
) -> Result<MediaLibraryResponse, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    query_media_library(&conn, &filter).map_err(|e| e.to_string())
}

#[command]
pub async fn get_media_details(
    id: String,
    state: State<'_, AppState>,
) -> Result<MediaLibraryItem, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    fetch_media_item_by_id(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Media item '{}' not found", id))
}

#[command]
pub async fn verify_library_file(
    id: String,
    state: State<'_, AppState>,
) -> Result<MediaLibraryItem, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    verify_item_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[command]
pub async fn refresh_library_availability(state: State<'_, AppState>) -> Result<usize, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    batch_verify_library(&conn, 100).map_err(|e| e.to_string())
}

#[command]
pub async fn open_library_file(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let item = fetch_media_item_by_id(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Media item '{}' not found", id))?;

    let path_str = item
        .output_path
        .ok_or_else(|| "Media item has no recorded output path".to_string())?;

    open_media_file(&path_str).map_err(|e| e.to_string())
}

#[command]
pub async fn open_library_folder(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let item = fetch_media_item_by_id(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Media item '{}' not found", id))?;

    let path_str = item
        .output_path
        .ok_or_else(|| "Media item has no recorded output path".to_string())?;

    open_containing_folder(&path_str).map_err(|e| e.to_string())
}

#[command]
pub async fn copy_path(id: String, state: State<'_, AppState>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let item = fetch_media_item_by_id(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Media item '{}' not found", id))?;

    item.output_path
        .ok_or_else(|| "Media item has no recorded output path".to_string())
}

#[command]
pub async fn relink_library_file(
    id: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<MediaLibraryItem, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    relink_file_service(&conn, &id, &new_path).map_err(|e| e.to_string())
}

#[command]
pub async fn remove_history_record(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    delete_history_record(&conn, &id).map_err(|e| e.to_string())
}

#[command]
pub async fn delete_library_file(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    delete_media_file_on_disk(&conn, &id).map_err(|e| e.to_string())
}

#[command]
pub async fn retry_failed_download<R: Runtime>(
    id: String,
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .queue_manager
        .retry_download(&id, app)
        .await
        .map_err(|e| e.to_string())
}

// Backward-compatible aliases
#[command]
pub async fn remove_history_item(id: String, state: State<'_, AppState>) -> Result<(), String> {
    remove_history_record(id, state).await
}

#[command]
pub async fn clear_download_history(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let _ = clear_completed_downloads_db(&conn);
    let _ = clear_failed_downloads_db(&conn);
    Ok(())
}
