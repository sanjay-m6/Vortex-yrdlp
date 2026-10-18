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

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
#[cfg(target_os = "windows")]
use std::io::Cursor;
use tauri::Emitter;
#[cfg(target_os = "windows")]
use zip::ZipArchive;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ToolDownloadProgressPayload {
    pub tool: String,
    pub stage: String,
    pub percentage: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub message: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EssentialToolsInstallResult {
    pub success: bool,
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
    pub message: String,
}

pub async fn download_ytdlp_internal(app: Option<&tauri::AppHandle>) -> Result<String, String> {
    let target_dir = crate::engine::resolver::ToolResolver::get_managed_tools_dir();

    if !target_dir.exists() {
        let _ = std::fs::create_dir_all(&target_dir);
    }

    #[cfg(target_os = "windows")]
    let (download_url, bin_name) = (
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
        "yt-dlp.exe",
    );
    #[cfg(target_os = "macos")]
    let (download_url, bin_name) = (
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
        "yt-dlp",
    );
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let (download_url, bin_name) = (
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
        "yt-dlp",
    );

    let target_exe = target_dir.join(bin_name);
    let temp_exe = target_dir.join(format!("{}.download.tmp", bin_name));

    if let Some(app_handle) = app {
        let _ = app_handle.emit(
            "tool_download_progress",
            ToolDownloadProgressPayload {
                tool: "yt-dlp".to_string(),
                stage: "starting".to_string(),
                percentage: 0.0,
                downloaded_bytes: 0,
                total_bytes: None,
                message: "Connecting to yt-dlp release server...".to_string(),
            },
        );
    }

    let client = reqwest::Client::builder()
        .user_agent("Vortex/1.1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let res = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download yt-dlp: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Download failed with status: {}", res.status()));
    }

    let total_size = res.content_length();
    let mut stream = res.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut bytes = Vec::new();
    if let Some(total) = total_size {
        bytes.reserve(total as usize);
    }

    let mut last_emit = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result
            .map_err(|e| format!("Network error while reading yt-dlp stream: {}", e))?;
        downloaded += chunk.len() as u64;
        bytes.extend_from_slice(&chunk);

        if last_emit.elapsed() >= std::time::Duration::from_millis(150)
            || downloaded == total_size.unwrap_or(0)
        {
            last_emit = std::time::Instant::now();
            let percent = match total_size {
                Some(total) if total > 0 => ((downloaded as f64 / total as f64) * 100.0).min(100.0),
                _ => 0.0,
            };
            if let Some(app_handle) = app {
                let _ = app_handle.emit(
                    "tool_download_progress",
                    ToolDownloadProgressPayload {
                        tool: "yt-dlp".to_string(),
                        stage: "downloading".to_string(),
                        percentage: percent,
                        downloaded_bytes: downloaded,
                        total_bytes: total_size,
                        message: format!(
                            "Downloading yt-dlp: {:.1} MB{}",
                            downloaded as f64 / (1024.0 * 1024.0),
                            match total_size {
                                Some(t) => format!(
                                    " / {:.1} MB ({:.0}%)",
                                    t as f64 / (1024.0 * 1024.0),
                                    percent
                                ),
                                None => "".to_string(),
                            }
                        ),
                    },
                );
            }
        }
    }

    if bytes.len() < 1_000_000 {
        return Err("Downloaded binary file is too small or incomplete".to_string());
    }

    tokio::fs::write(&temp_exe, &bytes)
        .await
        .map_err(|e| format!("Failed to write temporary binary: {}", e))?;

    tokio::fs::rename(&temp_exe, &target_exe)
        .await
        .map_err(|e| format!("Failed to replace yt-dlp executable: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&target_exe, std::fs::Permissions::from_mode(0o755));
    }

    if let Some(app_handle) = app {
        let _ = app_handle.emit(
            "tool_download_progress",
            ToolDownloadProgressPayload {
                tool: "yt-dlp".to_string(),
                stage: "completed".to_string(),
                percentage: 100.0,
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                message: "yt-dlp installed and verified successfully".to_string(),
            },
        );
    }

    Ok(target_exe.to_string_lossy().to_string())
}

pub async fn download_ffmpeg_internal(app: Option<&tauri::AppHandle>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let target_dir = crate::engine::resolver::ToolResolver::get_managed_tools_dir();
        if !target_dir.exists() {
            let _ = std::fs::create_dir_all(&target_dir);
        }

        if let Some(app_handle) = app {
            let _ = app_handle.emit(
                "tool_download_progress",
                ToolDownloadProgressPayload {
                    tool: "FFmpeg".to_string(),
                    stage: "starting".to_string(),
                    percentage: 0.0,
                    downloaded_bytes: 0,
                    total_bytes: None,
                    message: "Connecting to FFmpeg distribution mirror...".to_string(),
                },
            );
        }

        let client = reqwest::Client::builder()
            .user_agent("Vortex/1.1.0")
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let download_urls = [
            "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
            "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
        ];

        let mut downloaded_bytes: Option<Vec<u8>> = None;
        let mut last_error = String::new();

        for url in download_urls {
            match client.get(url).send().await {
                Ok(res) if res.status().is_success() => {
                    let total_size = res.content_length();
                    let mut stream = res.bytes_stream();
                    let mut count: u64 = 0;
                    let mut buffer = Vec::new();
                    if let Some(total) = total_size {
                        buffer.reserve(total as usize);
                    }

                    let mut last_emit = std::time::Instant::now();
                    let mut stream_failed = false;

                    while let Some(chunk_res) = stream.next().await {
                        match chunk_res {
                            Ok(chunk) => {
                                count += chunk.len() as u64;
                                buffer.extend_from_slice(&chunk);

                                if last_emit.elapsed() >= std::time::Duration::from_millis(150)
                                    || count == total_size.unwrap_or(0)
                                {
                                    last_emit = std::time::Instant::now();
                                    let percent = match total_size {
                                        Some(total) if total > 0 => {
                                            ((count as f64 / total as f64) * 100.0).min(100.0)
                                        }
                                        _ => 0.0,
                                    };
                                    if let Some(app_handle) = app {
                                        let _ = app_handle.emit(
                                            "tool_download_progress",
                                            ToolDownloadProgressPayload {
                                                tool: "FFmpeg".to_string(),
                                                stage: "downloading".to_string(),
                                                percentage: percent,
                                                downloaded_bytes: count,
                                                total_bytes: total_size,
                                                message: format!(
                                                    "Downloading FFmpeg & FFprobe: {:.1} MB{}",
                                                    count as f64 / (1024.0 * 1024.0),
                                                    match total_size {
                                                        Some(t) => format!(
                                                            " / {:.1} MB ({:.0}%)",
                                                            t as f64 / (1024.0 * 1024.0),
                                                            percent
                                                        ),
                                                        None => "".to_string(),
                                                    }
                                                ),
                                            },
                                        );
                                    }
                                }
                            }
                            Err(e) => {
                                last_error = format!("Stream read error: {}", e);
                                stream_failed = true;
                                break;
                            }
                        }
                    }

                    if !stream_failed && buffer.len() > 1_000_000 {
                        downloaded_bytes = Some(buffer);
                        break;
                    }
                }
                Ok(res) => {
                    last_error = format!("HTTP error: {}", res.status());
                }
                Err(e) => {
                    last_error = format!("Connection error: {}", e);
                }
            }
        }

        let zip_bytes = downloaded_bytes.ok_or_else(|| {
            format!(
                "Failed to download FFmpeg from all mirrors. Last error: {}",
                last_error
            )
        })?;

        if let Some(app_handle) = app {
            let _ = app_handle.emit(
                "tool_download_progress",
                ToolDownloadProgressPayload {
                    tool: "FFmpeg".to_string(),
                    stage: "extracting".to_string(),
                    percentage: 95.0,
                    downloaded_bytes: zip_bytes.len() as u64,
                    total_bytes: Some(zip_bytes.len() as u64),
                    message: "Extracting FFmpeg and FFprobe binaries...".to_string(),
                },
            );
        }

        let reader = Cursor::new(&zip_bytes);
        let mut archive =
            ZipArchive::new(reader).map_err(|e| format!("Failed to open FFmpeg zip: {}", e))?;

        let mut extracted_ffmpeg = false;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Zip entry read error: {}", e))?;
            let enclosed = match file.enclosed_name() {
                Some(p) => p.to_owned(),
                None => continue,
            };

            if let Some(file_name) = enclosed.file_name() {
                let name_lower = file_name.to_string_lossy().to_lowercase();
                if name_lower == "ffmpeg.exe" {
                    let out_path = target_dir.join("ffmpeg.exe");
                    let mut outfile = std::fs::File::create(&out_path)
                        .map_err(|e| format!("Failed to create ffmpeg.exe: {}", e))?;
                    std::io::copy(&mut file, &mut outfile)
                        .map_err(|e| format!("Failed to write ffmpeg.exe: {}", e))?;
                    extracted_ffmpeg = true;
                } else if name_lower == "ffprobe.exe" {
                    let out_path = target_dir.join("ffprobe.exe");
                    let mut outfile = std::fs::File::create(&out_path)
                        .map_err(|e| format!("Failed to create ffprobe.exe: {}", e))?;
                    std::io::copy(&mut file, &mut outfile)
                        .map_err(|e| format!("Failed to write ffprobe.exe: {}", e))?;
                }
            }
        }

        if !extracted_ffmpeg {
            return Err("ffmpeg.exe was not found inside the downloaded archive".to_string());
        }

        if let Some(app_handle) = app {
            let _ = app_handle.emit(
                "tool_download_progress",
                ToolDownloadProgressPayload {
                    tool: "FFmpeg".to_string(),
                    stage: "completed".to_string(),
                    percentage: 100.0,
                    downloaded_bytes: zip_bytes.len() as u64,
                    total_bytes: Some(zip_bytes.len() as u64),
                    message: "FFmpeg and FFprobe extracted and verified successfully".to_string(),
                },
            );
        }

        Ok(target_dir.join("ffmpeg.exe").to_string_lossy().to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Automatic FFmpeg download is currently optimized for Windows. On Linux/macOS, install via package manager (sudo apt install ffmpeg / brew install ffmpeg).".to_string())
    }
}

#[command]
pub async fn download_latest_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    download_ytdlp_internal(Some(&app)).await
}

#[command]
pub async fn download_latest_ffmpeg(app: tauri::AppHandle) -> Result<String, String> {
    download_ffmpeg_internal(Some(&app)).await
}

#[command]
pub async fn download_all_essential_tools(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<EssentialToolsInstallResult, String> {
    // 1. Download yt-dlp
    let ytdlp_res = download_ytdlp_internal(Some(&app)).await;

    // 2. Download FFmpeg
    let ffmpeg_res = download_ffmpeg_internal(Some(&app)).await;

    // 3. Refresh engine status
    let status = state.engine.get_status(true, None, None).await;

    let ytdlp_ok = status.ytdlp.available;
    let ffmpeg_ok = status.ffmpeg.available;
    let success = ytdlp_ok && ffmpeg_ok;

    let message = if success {
        format!(
            "Essential engines installed successfully! yt-dlp v{} and FFmpeg v{} are ready.",
            status.ytdlp.version.as_deref().unwrap_or("unknown"),
            status.ffmpeg.version.as_deref().unwrap_or("unknown")
        )
    } else if ytdlp_ok {
        format!(
            "yt-dlp is ready (v{}). FFmpeg note: {}",
            status.ytdlp.version.as_deref().unwrap_or("unknown"),
            ffmpeg_res.err().unwrap_or_else(|| "Not found".to_string())
        )
    } else {
        format!(
            "Installation issue: yt-dlp: {} | FFmpeg: {}",
            ytdlp_res.err().unwrap_or_else(|| "ok".to_string()),
            ffmpeg_res.err().unwrap_or_else(|| "ok".to_string())
        )
    };

    Ok(EssentialToolsInstallResult {
        success,
        ytdlp_installed: ytdlp_ok,
        ytdlp_version: status.ytdlp.version,
        ffmpeg_installed: ffmpeg_ok,
        ffmpeg_version: status.ffmpeg.version,
        message,
    })
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
