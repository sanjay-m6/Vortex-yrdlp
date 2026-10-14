use crate::downloader::AppState;
use crate::models::DependencyStatus;
use std::path::{Path, PathBuf};
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
    let dir = dirs::download_dir()
        .unwrap_or_else(|| PathBuf::from("."))
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
        open::that(p).map_err(|e| format!("Failed to open directory: {}", e))?;
    } else {
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer.exe")
                .arg(format!("/select,{}", p.display()))
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

#[command]
pub async fn download_latest_ytdlp() -> Result<String, String> {
    let target_dir = crate::engine::resolver::ToolResolver::get_managed_tools_dir();

    if !target_dir.exists() {
        let _ = std::fs::create_dir_all(&target_dir);
    }

    let target_exe = target_dir.join("yt-dlp.exe");
    let temp_exe = target_dir.join("yt-dlp.exe.download.tmp");

    let client = reqwest::Client::builder()
        .user_agent("Vortex/1.0.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let res = client
        .get("https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe")
        .send()
        .await
        .map_err(|e| format!("Failed to download yt-dlp: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("Failed to read binary bytes: {}", e))?;

    // Verify minimum expected size (yt-dlp.exe is at least 5 MB)
    if bytes.len() < 1_000_000 {
        return Err("Downloaded binary file is too small or incomplete".to_string());
    }

    // Write to temporary file first to avoid corrupting active executable
    tokio::fs::write(&temp_exe, &bytes)
        .await
        .map_err(|e| format!("Failed to write temporary binary: {}", e))?;

    // Atomic replacement
    tokio::fs::rename(&temp_exe, &target_exe)
        .await
        .map_err(|e| format!("Failed to replace yt-dlp executable: {}", e))?;

    Ok(target_exe.to_string_lossy().to_string())
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
pub async fn app_close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[command]
pub async fn app_is_maximized(window: tauri::Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}
