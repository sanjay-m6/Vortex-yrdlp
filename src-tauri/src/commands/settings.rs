use crate::database::{load_app_settings, store_app_settings};
use crate::downloader::AppState;
use crate::models::AppSettings;
use serde::{Deserialize, Serialize};
use tauri::{command, State};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetupStatus {
    pub setup_completed: bool,
    pub setup_step: u32,
    pub requires_setup: bool,
    pub ytdlp_ready: bool,
    pub ffmpeg_ready: bool,
}

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

#[command]
pub async fn get_setup_status(state: State<'_, AppState>) -> Result<SetupStatus, String> {
    let settings = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        load_app_settings(&conn)
    };

    let status = state
        .engine
        .get_status(
            false,
            settings.custom_ytdlp_path.clone(),
            settings.custom_ffmpeg_path.clone(),
        )
        .await;

    let ytdlp_ready = status.ytdlp.available;
    let ffmpeg_ready = status.ffmpeg.available;

    let requires_setup = !settings.setup_completed && (!ytdlp_ready || !ffmpeg_ready);

    crate::logging::log_info(
        "Setup",
        &format!(
            "Setup status: setupCompleted={}, step={}, requiresSetup={}, ytdlp={}, ffmpeg={}",
            settings.setup_completed,
            settings.setup_step.unwrap_or(1),
            requires_setup,
            ytdlp_ready,
            ffmpeg_ready
        ),
    );

    Ok(SetupStatus {
        setup_completed: settings.setup_completed,
        setup_step: settings.setup_step.unwrap_or(1),
        requires_setup,
        ytdlp_ready,
        ffmpeg_ready,
    })
}

#[command]
pub async fn save_setup_progress(
    step: u32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut settings = load_app_settings(&conn);
    settings.setup_step = Some(step);
    store_app_settings(&conn, &settings).map_err(|e| e.to_string())?;
    crate::logging::log_info("Setup", &format!("Setup progress updated to step {}", step));
    Ok(())
}

#[command]
pub async fn complete_setup_wizard(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut settings = load_app_settings(&conn);
    settings.setup_completed = true;
    settings.setup_step = Some(4);
    store_app_settings(&conn, &settings).map_err(|e| e.to_string())?;
    crate::logging::log_info("Setup", "Setup Wizard marked as completed in SQLite settings");
    Ok(true)
}

#[command]
pub async fn reset_setup_wizard(
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut settings = load_app_settings(&conn);
    settings.setup_completed = false;
    settings.setup_step = Some(1);
    store_app_settings(&conn, &settings).map_err(|e| e.to_string())?;
    crate::logging::log_info("Setup", "Setup Wizard reset to step 1");
    Ok(())
}
