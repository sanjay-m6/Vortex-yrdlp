use crate::database::{
    delete_preset_by_id, fetch_all_presets, fetch_download_settings, fetch_preset_by_id,
    insert_or_update_preset, load_app_settings, reset_built_in_presets, store_download_settings,
};
use crate::downloader::AppState;
use crate::presets::builtins::is_built_in_preset;
use crate::presets::filename::{preview_filename_template, validate_filename_template};
use crate::presets::model::{
    DownloadPreset, DownloadSettings, DownloadSettingsSnapshot, FolderRule,
    SettingsValidationResult,
};
use crate::presets::output::resolve_output_directory;
use crate::presets::resolver::validate_download_settings;
use chrono::Utc;
use tauri::{command, State};

#[command]
pub async fn get_presets(state: State<'_, AppState>) -> Result<Vec<DownloadPreset>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    fetch_all_presets(&conn).map_err(|e| e.to_string())
}

#[command]
pub async fn get_preset_by_id_cmd(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<DownloadPreset>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    fetch_preset_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[command]
pub async fn save_preset(
    mut preset: DownloadPreset,
    state: State<'_, AppState>,
) -> Result<DownloadPreset, String> {
    if preset.name.trim().is_empty() {
        return Err("Preset name cannot be empty".to_string());
    }

    if let Some(ref tpl) = preset.filename_template {
        validate_filename_template(tpl).map_err(|e| e.message)?;
    }

    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;

    // If ID is empty, generate an ID based on name
    if preset.id.trim().is_empty() {
        let base_slug: String = preset
            .name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect();
        let timestamp = Utc::now().timestamp_millis();
        preset.id = format!("{}-{}", base_slug.trim_matches('-'), timestamp);
        preset.is_built_in = false;
    } else if is_built_in_preset(&preset.id) {
        // Built-in presets keep is_built_in = true
        preset.is_built_in = true;
    }

    let now = Utc::now().to_rfc3339();
    if preset.created_at.is_empty() {
        preset.created_at = now.clone();
    }
    preset.updated_at = now;

    insert_or_update_preset(&conn, &preset).map_err(|e| e.to_string())?;
    Ok(preset)
}

#[command]
pub async fn delete_preset(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    if is_built_in_preset(&id) {
        return Err("Cannot delete built-in presets".to_string());
    }

    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    delete_preset_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[command]
pub async fn reset_presets(state: State<'_, AppState>) -> Result<Vec<DownloadPreset>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    reset_built_in_presets(&conn).map_err(|e| e.to_string())?;
    fetch_all_presets(&conn).map_err(|e| e.to_string())
}

#[command]
pub async fn get_download_settings(state: State<'_, AppState>) -> Result<DownloadSettings, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    Ok(fetch_download_settings(&conn))
}

#[command]
pub async fn update_download_settings(
    settings: DownloadSettings,
    state: State<'_, AppState>,
) -> Result<DownloadSettings, String> {
    if !settings.default_filename_template.is_empty() {
        validate_filename_template(&settings.default_filename_template).map_err(|e| e.message)?;
    }

    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    store_download_settings(&conn, &settings).map_err(|e| e.to_string())?;
    Ok(settings)
}

#[command]
pub async fn validate_download_settings_cmd(
    snapshot: DownloadSettingsSnapshot,
    state: State<'_, AppState>,
) -> Result<SettingsValidationResult, String> {
    let (custom_ytdlp, custom_ffmpeg): (Option<String>, Option<String>) = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let app_settings = load_app_settings(&conn);
        (
            app_settings.custom_ytdlp_path,
            app_settings.custom_ffmpeg_path,
        )
    };

    let result =
        validate_download_settings(&snapshot, custom_ytdlp.as_deref(), custom_ffmpeg.as_deref());

    Ok(result)
}

#[command]
pub async fn preview_filename_template_cmd(
    template: String,
    title: Option<String>,
    id: Option<String>,
    uploader: Option<String>,
    upload_date: Option<String>,
    playlist_title: Option<String>,
    playlist_index: Option<u32>,
) -> Result<String, String> {
    preview_filename_template(
        &template,
        title.as_deref(),
        id.as_deref(),
        uploader.as_deref(),
        upload_date.as_deref(),
        playlist_title.as_deref(),
        playlist_index,
    )
    .map_err(|e| e.message)
}

#[command]
pub async fn resolve_output_directory_cmd(
    root_dir: String,
    folder_rule: Option<FolderRule>,
    video_subfolder: Option<String>,
    audio_subfolder: Option<String>,
    playlist_subfolder: bool,
    uploader_subfolder: bool,
    date_subfolder: bool,
    is_audio_only: bool,
    playlist_title: Option<String>,
    uploader: Option<String>,
    upload_date: Option<String>,
) -> Result<String, String> {
    let resolved = resolve_output_directory(
        &root_dir,
        folder_rule,
        video_subfolder.as_deref(),
        audio_subfolder.as_deref(),
        playlist_subfolder,
        uploader_subfolder,
        date_subfolder,
        is_audio_only,
        playlist_title.as_deref(),
        uploader.as_deref(),
        upload_date.as_deref(),
    )
    .map_err(|e| e.message)?;

    Ok(resolved.to_string_lossy().to_string())
}
