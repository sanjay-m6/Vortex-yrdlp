use crate::downloader::AppState;
use crate::models::DependencyStatus;
use std::path::Path;
use tauri::{command, State};

#[command]
pub async fn check_system_dependencies(
    state: State<'_, AppState>,
) -> Result<DependencyStatus, String> {
    let settings = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        crate::database::load_app_settings(&conn)
    };

    let status = state
        .engine
        .get_status(
            false,
            settings.custom_ytdlp_path,
            settings.custom_ffmpeg_path,
        )
        .await;
    Ok(DependencyStatus {
        ytdlp_installed: status.ytdlp.available,
        ytdlp_version: status.ytdlp.version,
        ytdlp_path: status.ytdlp.executable_path,
        ffmpeg_installed: status.ffmpeg.available,
        ffmpeg_version: status.ffmpeg.version,
        ffmpeg_path: status.ffmpeg.executable_path,
    })
}

#[command]
pub async fn pick_download_directory() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Download Directory")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[command]
pub async fn get_default_download_directory() -> Result<String, String> {
    let dir = crate::downloader::validation::default_downloads_dir()
        .to_string_lossy()
        .to_string();
    Ok(dir)
}

#[command]
pub async fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File or folder does not exist".to_string());
    }

    if p.is_dir() {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let clean = p.display().to_string().replace('/', "\\");
            let status = std::process::Command::new("explorer.exe")
                .raw_arg(format!("\"{}\"", clean))
                .spawn();
            if status.is_ok() {
                return Ok(());
            }
        }
        open::that(p).map_err(|e| format!("Failed to open directory: {}", e))?;
    } else {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let clean = p.display().to_string().replace('/', "\\");
            let _ = std::process::Command::new("explorer.exe")
                .raw_arg(format!("/select,\"{}\"", clean))
                .spawn();
        }
        #[cfg(not(target_os = "windows"))]
        {
            if let Some(parent) = p.parent() {
                let _ = open::that(parent);
            }
        }
    }

    Ok(())
}

pub use crate::engine::installer::{EssentialToolsInstallResult, ToolDownloadProgressPayload};

pub async fn download_ytdlp_internal(app: Option<&tauri::AppHandle>) -> Result<String, String> {
    let dummy_engine = crate::engine::EngineManager::new();
    let installer = crate::engine::ToolInstallManager::new();
    installer.download_ytdlp(app, &dummy_engine).await
}

pub async fn download_ffmpeg_internal(app: Option<&tauri::AppHandle>) -> Result<String, String> {
    let dummy_engine = crate::engine::EngineManager::new();
    let installer = crate::engine::ToolInstallManager::new();
    installer.download_ffmpeg(app, &dummy_engine).await
}

#[command]
pub async fn download_latest_ytdlp(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .installer
        .download_ytdlp(Some(&app), &state.engine)
        .await
}

#[command]
pub async fn download_latest_ffmpeg(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .installer
        .download_ffmpeg(Some(&app), &state.engine)
        .await
}

#[command]
pub async fn download_all_essential_tools(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<EssentialToolsInstallResult, String> {
    state
        .installer
        .download_all_essential_tools(Some(&app), &state.engine)
        .await
}

#[command]
pub async fn app_minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[command]
pub async fn app_toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

#[command]
pub async fn app_close_window(
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let active_count = state.queue_manager.active_downloads_count().await;
    if active_count > 0 {
        // Active downloads in progress: preserve by hiding window instead of terminating process
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub async fn app_show_window(window: tauri::Window) -> Result<(), String> {
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn app_get_active_downloads_count(state: State<'_, AppState>) -> Result<usize, String> {
    Ok(state.queue_manager.active_downloads_count().await)
}

#[command]
pub async fn app_exit(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.queue_manager.shutdown().await;
    app.exit(0);
    Ok(())
}

#[command]
pub async fn app_is_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}
