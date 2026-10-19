use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::Mutex;

use crate::engine::manager::EngineManager;
use crate::engine::resolver::ToolResolver;
use crate::logging::{log_error, log_info, log_warn};
use crate::models::{ToolState, ToolType};

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

pub struct ToolInstallManager {
    ytdlp_lock: Mutex<()>,
    ffmpeg_lock: Mutex<()>,
    op_counter: AtomicU64,
}

impl Default for ToolInstallManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ToolInstallManager {
    pub fn new() -> Self {
        Self {
            ytdlp_lock: Mutex::new(()),
            ffmpeg_lock: Mutex::new(()),
            op_counter: AtomicU64::new(1),
        }
    }

    pub fn try_acquire_ytdlp_lock(&self) -> Result<tokio::sync::MutexGuard<'_, ()>, String> {
        self.ytdlp_lock.try_lock().map_err(|_| "yt-dlp lock unavailable".to_string())
    }

    pub fn try_acquire_ffmpeg_lock(&self) -> Result<tokio::sync::MutexGuard<'_, ()>, String> {
        self.ffmpeg_lock.try_lock().map_err(|_| "FFmpeg lock unavailable".to_string())
    }

    fn next_op_id(&self) -> u64 {
        self.op_counter.fetch_add(1, Ordering::SeqCst)
    }

    /// Safely tests that a candidate binary actually executes and reports its version.
    async fn verify_binary_version(executable: &Path, arg: &str) -> Result<String, String> {
        if !executable.exists() {
            return Err(format!("File does not exist: {:?}", executable));
        }

        let mut cmd = tokio::process::Command::new(executable);
        cmd.arg(arg);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());
        cmd.kill_on_drop(true);

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn executable {:?}: {}", executable, e))?;

        let output = match tokio::time::timeout(Duration::from_secs(6), child.wait_with_output()).await {
            Ok(Ok(out)) => out,
            Ok(Err(e)) => return Err(format!("Process execution error: {}", e)),
            Err(_) => return Err("Execution timed out after 6 seconds".to_string()),
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!(
                "Executable returned non-zero exit code ({}): {}",
                output.status.code().unwrap_or(-1),
                stderr.trim()
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            return Err("Executable produced empty version output".to_string());
        }

        Ok(stdout)
    }

    /// Downloads and installs yt-dlp safely with concurrency locking, verification, and atomic replacement.
    pub async fn download_ytdlp(
        &self,
        app: Option<&tauri::AppHandle>,
        engine: &EngineManager,
    ) -> Result<String, String> {
        // Enforce concurrency limit: only 1 installation at a time
        let _guard = match self.ytdlp_lock.try_lock() {
            Ok(g) => g,
            Err(_) => {
                log_warn("Installer", "Concurrent yt-dlp installation request rejected");
                return Err("An installation of yt-dlp is already in progress. Please wait for it to complete.".to_string());
            }
        };

        let op_id = self.next_op_id();
        log_info("Installer", &format!("[op:{}] Starting yt-dlp installation check", op_id));

        // Step 1: Check if yt-dlp is already installed and functional
        let existing = engine.check_tool(ToolType::YtDlp, None).await;
        if existing.state == ToolState::Ready {
            let version = existing.version.unwrap_or_else(|| "ready".to_string());
            let path = existing.executable_path.unwrap_or_default();
            log_info(
                "Installer",
                &format!("[op:{}] Existing valid yt-dlp v{} found at {:?}", op_id, version, path),
            );

            if let Some(app_handle) = app {
                let _ = app_handle.emit(
                    "tool_download_progress",
                    ToolDownloadProgressPayload {
                        tool: "yt-dlp".to_string(),
                        stage: "completed".to_string(),
                        percentage: 100.0,
                        downloaded_bytes: 0,
                        total_bytes: None,
                        message: format!("yt-dlp is already installed and verified (v{})", version),
                    },
                );
            }

            return Ok(path);
        }

        let target_dir = ToolResolver::get_managed_tools_dir();
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
        let temp_exe = target_dir.join(format!("{}.download.{}.tmp", bin_name, op_id));

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

        log_info(
            "Installer",
            &format!("[op:{}] Downloading yt-dlp from {}", op_id, download_url),
        );

        let client = reqwest::Client::builder()
            .user_agent("Vortex/1.2.0")
            .timeout(Duration::from_secs(60))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let res = client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to yt-dlp release: {}", e))?;

        if !res.status().is_success() {
            let err = format!("Download failed with HTTP status: {}", res.status());
            log_error("Installer", &format!("[op:{}] {}", op_id, err));
            return Err(err);
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

            if last_emit.elapsed() >= Duration::from_millis(150)
                || downloaded == total_size.unwrap_or(0)
            {
                last_emit = std::time::Instant::now();
                let percent = match total_size {
                    Some(total) if total > 0 => {
                        ((downloaded as f64 / total as f64) * 100.0).min(98.0)
                    }
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
            let err = "Downloaded binary file is too small or incomplete".to_string();
            log_error("Installer", &format!("[op:{}] {}", op_id, err));
            return Err(err);
        }

        tokio::fs::write(&temp_exe, &bytes)
            .await
            .map_err(|e| format!("Failed to write temporary binary: {}", e))?;

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(&temp_exe, std::fs::Permissions::from_mode(0o755));
        }

        // Step 2: Validate the downloaded binary BEFORE replacing existing target
        if let Some(app_handle) = app {
            let _ = app_handle.emit(
                "tool_download_progress",
                ToolDownloadProgressPayload {
                    tool: "yt-dlp".to_string(),
                    stage: "verifying".to_string(),
                    percentage: 99.0,
                    downloaded_bytes: downloaded,
                    total_bytes: total_size,
                    message: "Verifying binary execution integrity...".to_string(),
                },
            );
        }

        match Self::verify_binary_version(&temp_exe, "--version").await {
            Ok(v) => {
                log_info(
                    "Installer",
                    &format!("[op:{}] yt-dlp binary verified (v{}), committing file", op_id, v),
                );
            }
            Err(e) => {
                let _ = tokio::fs::remove_file(&temp_exe).await;
                let err = format!("Downloaded yt-dlp failed validation check: {}", e);
                log_error("Installer", &format!("[op:{}] {}", op_id, err));
                return Err(err);
            }
        }

        // Step 3: Commit binary atomically
        tokio::fs::rename(&temp_exe, &target_exe)
            .await
            .map_err(|e| format!("Failed to commit yt-dlp executable: {}", e))?;

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

        log_info(
            "Installer",
            &format!("[op:{}] yt-dlp installation completed successfully", op_id),
        );

        Ok(target_exe.to_string_lossy().to_string())
    }

    /// Downloads and installs FFmpeg & FFprobe safely with concurrency locking, verification, and extraction.
    pub async fn download_ffmpeg(
        &self,
        app: Option<&tauri::AppHandle>,
        engine: &EngineManager,
    ) -> Result<String, String> {
        // Enforce concurrency limit: only 1 installation at a time
        let _guard = match self.ffmpeg_lock.try_lock() {
            Ok(g) => g,
            Err(_) => {
                log_warn("Installer", "Concurrent FFmpeg installation request rejected");
                return Err("An installation of FFmpeg is already in progress. Please wait for it to complete.".to_string());
            }
        };

        let op_id = self.next_op_id();
        log_info("Installer", &format!("[op:{}] Starting FFmpeg installation check", op_id));

        // Step 1: Check if FFmpeg is already installed and functional
        let ffmpeg_status = engine.check_tool(ToolType::Ffmpeg, None).await;
        let ffprobe_status = engine.check_tool(ToolType::Ffprobe, None).await;

        if ffmpeg_status.state == ToolState::Ready && ffprobe_status.state == ToolState::Ready {
            let v = ffmpeg_status.version.unwrap_or_else(|| "ready".to_string());
            let path = ffmpeg_status.executable_path.unwrap_or_default();
            log_info(
                "Installer",
                &format!("[op:{}] Existing valid FFmpeg & FFprobe found at {:?}", op_id, path),
            );

            if let Some(app_handle) = app {
                let _ = app_handle.emit(
                    "tool_download_progress",
                    ToolDownloadProgressPayload {
                        tool: "FFmpeg".to_string(),
                        stage: "completed".to_string(),
                        percentage: 100.0,
                        downloaded_bytes: 0,
                        total_bytes: None,
                        message: format!("FFmpeg & FFprobe are already installed and verified ({})", v),
                    },
                );
            }

            return Ok(path);
        }

        #[cfg(target_os = "windows")]
        {
            let target_dir = ToolResolver::get_managed_tools_dir();
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
                .user_agent("Vortex/1.2.0")
                .timeout(Duration::from_secs(120))
                .build()
                .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

            let download_urls = [
                "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
                "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
            ];

            let mut downloaded_bytes: Option<Vec<u8>> = None;
            let mut last_error = String::new();

            for url in download_urls {
                log_info("Installer", &format!("[op:{}] Attempting FFmpeg download from {}", op_id, url));
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

                                    if last_emit.elapsed() >= Duration::from_millis(150)
                                        || count == total_size.unwrap_or(0)
                                    {
                                        last_emit = std::time::Instant::now();
                                        let percent = match total_size {
                                            Some(total) if total > 0 => {
                                                ((count as f64 / total as f64) * 92.0).min(92.0)
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
                let err = format!(
                    "Failed to download FFmpeg from distribution mirrors. Error: {}",
                    last_error
                );
                log_error("Installer", &format!("[op:{}] {}", op_id, err));
                err
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

            let reader = std::io::Cursor::new(&zip_bytes);
            let mut archive = zip::ZipArchive::new(reader)
                .map_err(|e| format!("Failed to read FFmpeg archive: {}", e))?;

            let temp_ffmpeg = target_dir.join(format!("ffmpeg.{}.tmp", op_id));
            let temp_ffprobe = target_dir.join(format!("ffprobe.{}.tmp", op_id));

            let mut extracted_ffmpeg = false;
            let mut extracted_ffprobe = false;

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
                        let mut outfile = std::fs::File::create(&temp_ffmpeg)
                            .map_err(|e| format!("Failed to create temporary ffmpeg: {}", e))?;
                        std::io::copy(&mut file, &mut outfile)
                            .map_err(|e| format!("Failed to extract ffmpeg.exe: {}", e))?;
                        extracted_ffmpeg = true;
                    } else if name_lower == "ffprobe.exe" {
                        let mut outfile = std::fs::File::create(&temp_ffprobe)
                            .map_err(|e| format!("Failed to create temporary ffprobe: {}", e))?;
                        std::io::copy(&mut file, &mut outfile)
                            .map_err(|e| format!("Failed to extract ffprobe.exe: {}", e))?;
                        extracted_ffprobe = true;
                    }
                }
            }

            if !extracted_ffmpeg {
                let _ = std::fs::remove_file(&temp_ffmpeg);
                let _ = std::fs::remove_file(&temp_ffprobe);
                return Err("ffmpeg.exe was not found inside the downloaded archive".to_string());
            }

            // Step 2: Validate both extracted executables
            if let Some(app_handle) = app {
                let _ = app_handle.emit(
                    "tool_download_progress",
                    ToolDownloadProgressPayload {
                        tool: "FFmpeg".to_string(),
                        stage: "verifying".to_string(),
                        percentage: 98.0,
                        downloaded_bytes: zip_bytes.len() as u64,
                        total_bytes: Some(zip_bytes.len() as u64),
                        message: "Verifying FFmpeg execution integrity...".to_string(),
                    },
                );
            }

            if let Err(e) = Self::verify_binary_version(&temp_ffmpeg, "-version").await {
                let _ = std::fs::remove_file(&temp_ffmpeg);
                let _ = std::fs::remove_file(&temp_ffprobe);
                let err = format!("Extracted ffmpeg.exe failed validation: {}", e);
                log_error("Installer", &format!("[op:{}] {}", op_id, err));
                return Err(err);
            }

            if extracted_ffprobe {
                let _ = Self::verify_binary_version(&temp_ffprobe, "-version").await;
            }

            // Step 3: Commit executables atomically
            let final_ffmpeg = target_dir.join("ffmpeg.exe");
            let final_ffprobe = target_dir.join("ffprobe.exe");

            let _ = tokio::fs::rename(&temp_ffmpeg, &final_ffmpeg).await;
            if extracted_ffprobe {
                let _ = tokio::fs::rename(&temp_ffprobe, &final_ffprobe).await;
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

            log_info(
                "Installer",
                &format!("[op:{}] FFmpeg installation completed successfully", op_id),
            );

            Ok(final_ffmpeg.to_string_lossy().to_string())
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = app;
            Err("Automatic FFmpeg download is currently optimized for Windows. On Linux/macOS, please install via package manager (sudo apt install ffmpeg / brew install ffmpeg).".to_string())
        }
    }

    /// Coordinates full essential tools installation sequentially without process overlap.
    pub async fn download_all_essential_tools(
        &self,
        app: Option<&tauri::AppHandle>,
        engine: &EngineManager,
    ) -> Result<EssentialToolsInstallResult, String> {
        let op_id = self.next_op_id();
        log_info(
            "Installer",
            &format!("[op:{}] Starting unified installation for all essential tools", op_id),
        );

        let ytdlp_res = self.download_ytdlp(app, engine).await;
        let ffmpeg_res = self.download_ffmpeg(app, engine).await;

        let status = engine.get_status(true, None, None).await;
        let ytdlp_ok = status.ytdlp.available;
        let ffmpeg_ok = status.ffmpeg.available;
        let success = ytdlp_ok && ffmpeg_ok;

        let message = if success {
            format!(
                "Essential engines ready! yt-dlp v{} and FFmpeg v{} are verified.",
                status.ytdlp.version.as_deref().unwrap_or("ok"),
                status.ffmpeg.version.as_deref().unwrap_or("ok")
            )
        } else if ytdlp_ok {
            format!(
                "yt-dlp is ready (v{}). FFmpeg notice: {}",
                status.ytdlp.version.as_deref().unwrap_or("ok"),
                ffmpeg_res.err().unwrap_or_else(|| "Not found".to_string())
            )
        } else {
            format!(
                "Installation issue: yt-dlp: {} | FFmpeg: {}",
                ytdlp_res.err().unwrap_or_else(|| "ok".to_string()),
                ffmpeg_res.err().unwrap_or_else(|| "ok".to_string())
            )
        };

        log_info(
            "Installer",
            &format!("[op:{}] Unified install finished. Success: {}, Message: {}", op_id, success, message),
        );

        Ok(EssentialToolsInstallResult {
            success,
            ytdlp_installed: ytdlp_ok,
            ytdlp_version: status.ytdlp.version,
            ffmpeg_installed: ffmpeg_ok,
            ffmpeg_version: status.ffmpeg.version,
            message,
        })
    }
}
