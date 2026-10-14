use tauri::{command, State};

use crate::downloader::AppState;
use crate::models::{DiagnosticsReport, EngineStatus, ToolStatus, ToolType, ToolValidationResult};

fn parse_tool_type(name: &str) -> Result<ToolType, String> {
    match name.to_lowercase().replace("-", "").as_str() {
        "ytdlp" => Ok(ToolType::YtDlp),
        "ffmpeg" => Ok(ToolType::Ffmpeg),
        "ffprobe" => Ok(ToolType::Ffprobe),
        _ => Err(format!(
            "Unknown tool type: '{}'. Expected 'ytdlp', 'ffmpeg', or 'ffprobe'.",
            name
        )),
    }
}

#[command]
pub async fn get_engine_status(
    force_refresh: Option<bool>,
    state: State<'_, AppState>,
) -> Result<EngineStatus, String> {
    let (custom_ytdlp, custom_ffmpeg) = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let s = crate::database::load_app_settings(&conn);
        (s.custom_ytdlp_path, s.custom_ffmpeg_path)
    };

    let force = force_refresh.unwrap_or(false);
    let status = state
        .engine
        .get_status(force, custom_ytdlp, custom_ffmpeg)
        .await;
    Ok(status)
}

#[command]
pub async fn check_ytdlp_version(state: State<'_, AppState>) -> Result<ToolStatus, String> {
    let custom_ytdlp = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        crate::database::load_app_settings(&conn).custom_ytdlp_path
    };

    let status = state
        .engine
        .check_tool(ToolType::YtDlp, custom_ytdlp.as_deref())
        .await;
    Ok(status)
}

#[command]
pub async fn check_ffmpeg_status(state: State<'_, AppState>) -> Result<ToolStatus, String> {
    let custom_ffmpeg = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        crate::database::load_app_settings(&conn).custom_ffmpeg_path
    };

    let status = state
        .engine
        .check_tool(ToolType::Ffmpeg, custom_ffmpeg.as_deref())
        .await;
    Ok(status)
}

#[command]
pub async fn validate_tool_path(
    tool: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<ToolValidationResult, String> {
    let tool_type = parse_tool_type(&tool)?;
    let result = state.engine.validate_tool_path(tool_type, &path).await;
    Ok(result)
}

#[command]
pub async fn set_tool_path(
    tool: String,
    path: Option<String>,
    state: State<'_, AppState>,
) -> Result<ToolStatus, String> {
    let tool_type = parse_tool_type(&tool)?;

    // If a path was provided, validate it first
    if let Some(ref p) = path {
        let trimmed = p.trim();
        if !trimmed.is_empty() {
            let validation = state.engine.validate_tool_path(tool_type, trimmed).await;
            if !validation.valid {
                return Err(validation
                    .error
                    .unwrap_or_else(|| "Path validation failed".to_string()));
            }
        }
    }

    // Persist into database settings
    {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let mut settings = crate::database::load_app_settings(&conn);
        let path_clean = path.clone().filter(|s| !s.trim().is_empty());

        match tool_type {
            ToolType::YtDlp => settings.custom_ytdlp_path = path_clean,
            ToolType::Ffmpeg => settings.custom_ffmpeg_path = path_clean,
            ToolType::Ffprobe => {}
        }

        crate::database::store_app_settings(&conn, &settings)
            .map_err(|e| format!("Failed to save settings: {}", e))?;
    }

    // Check newly configured tool status
    let status = state.engine.check_tool(tool_type, path.as_deref()).await;

    // Refresh engine cache
    let _ = get_engine_status(Some(true), state).await;

    Ok(status)
}

#[command]
pub async fn pick_tool_executable(
    tool: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let tool_type = parse_tool_type(&tool)?;
    let filter_name = match tool_type {
        ToolType::YtDlp => "yt-dlp Executable",
        ToolType::Ffmpeg => "FFmpeg Executable",
        ToolType::Ffprobe => "FFprobe Executable",
    };

    #[cfg(target_os = "windows")]
    let dialog = rfd::AsyncFileDialog::new()
        .set_title(format!("Select {}", tool_type.as_str()))
        .add_filter(filter_name, &["exe", "cmd", "bat"]);

    #[cfg(not(target_os = "windows"))]
    let dialog = rfd::AsyncFileDialog::new().set_title(format!("Select {}", tool_type.as_str()));

    let file = dialog.pick_file().await;

    if let Some(f) = file {
        let path_str = f.path().to_string_lossy().to_string();
        let validation = state.engine.validate_tool_path(tool_type, &path_str).await;
        if !validation.valid {
            return Err(validation
                .error
                .unwrap_or_else(|| "Selected file is not valid".to_string()));
        }
        Ok(Some(path_str))
    } else {
        Ok(None)
    }
}

#[command]
pub async fn get_diagnostics(state: State<'_, AppState>) -> Result<DiagnosticsReport, String> {
    let status = get_engine_status(Some(false), state.clone()).await?;
    let report = state.engine.generate_diagnostics_report(&status);
    Ok(report)
}
