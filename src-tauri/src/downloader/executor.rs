use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::downloader::output::{cleanup_partial_files, find_candidate_output, verify_output_file};
use crate::downloader::progress::parse_progress_line;
use crate::downloader::validation::{build_ytdlp_args, validate_output_directory};
use crate::engine::resolver::ToolResolver;
use crate::models::{DownloadProgress, DownloadRequest, DownloadState, EngineError, ToolType};
use crate::process::events::sanitize_output_line;

pub const EVENT_DOWNLOAD_STARTED: &str = "download_started";
pub const EVENT_DOWNLOAD_PROGRESS: &str = "download_progress";
pub const EVENT_DOWNLOAD_PROCESSING: &str = "download_processing";
pub const EVENT_DOWNLOAD_COMPLETED: &str = "download_completed";
pub const EVENT_DOWNLOAD_FAILED: &str = "download_failed";
pub const EVENT_DOWNLOAD_CANCELLING: &str = "download_cancelling";
pub const EVENT_DOWNLOAD_CANCELLED: &str = "download_cancelled";

pub trait DownloadEventEmitter: Send + Sync + 'static {
    fn emit_event(&self, event_name: &str, payload: &DownloadProgress);
}

pub struct TauriDownloadEmitter<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
}

impl<R: tauri::Runtime> TauriDownloadEmitter<R> {
    pub fn new(app: tauri::AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: tauri::Runtime> DownloadEventEmitter for TauriDownloadEmitter<R> {
    fn emit_event(&self, event_name: &str, payload: &DownloadProgress) {
        let _ = self.app.emit(event_name, payload);
        // Also emit legacy download-progress for backward compatibility
        let _ = self.app.emit("download-progress", payload);
    }
}

pub async fn execute_download<E: DownloadEventEmitter>(
    request: DownloadRequest,
    task_id: String,
    attempt_id: u32,
    custom_ytdlp: Option<String>,
    custom_ffmpeg: Option<String>,
    emitter: Arc<E>,
    mut cancel_rx: oneshot::Receiver<()>,
    is_cancelled_flag: Arc<AtomicBool>,
) -> Result<String, EngineError> {
    // 1. Resolve yt-dlp executable
    let ytdlp_res = ToolResolver::resolve_tool(ToolType::YtDlp, custom_ytdlp.as_deref());
    let (ytdlp_bin, _) = ytdlp_res.ok_or_else(|| {
        EngineError::not_found(
            "yt-dlp executable was not found. Please install yt-dlp or configure its path in Settings.",
        )
    })?;

    // 2. Resolve FFmpeg availability
    let ffmpeg_res = ToolResolver::resolve_tool(ToolType::Ffmpeg, custom_ffmpeg.as_deref());
    let ffmpeg_available = ffmpeg_res.is_some();

    // 3. Validate output directory
    let output_dir = validate_output_directory(&request.output_directory)?;

    // 4. Build arguments
    let args = build_ytdlp_args(&request, &output_dir, ffmpeg_available)?;

    // 5. Initial progress state
    let mut progress = DownloadProgress {
        task_id: task_id.clone(),
        attempt_id,
        state: DownloadState::Starting,
        percentage: 0.0,
        downloaded_bytes: 0,
        total_bytes: None,
        speed_bytes_per_sec: None,
        eta_seconds: None,
        speed_formatted: "0 KB/s".to_string(),
        eta_formatted: "--:--".to_string(),
        downloaded_formatted: "0 B".to_string(),
        total_formatted: "Calculating...".to_string(),
        current_filename: None,
        stage: "Initializing download stream...".to_string(),
        output_path: None,
        error_message: None,
    };

    emitter.emit_event(EVENT_DOWNLOAD_STARTED, &progress);

    // 6. Spawn yt-dlp child process
    let mut cmd = Command::new(&ytdlp_bin);
    cmd.args(&args);
    cmd.current_dir(&output_dir);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.kill_on_drop(true);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| {
        let err_msg = format!("Failed to start yt-dlp process: {}", e);
        progress.state = DownloadState::Failed;
        progress.error_message = Some(err_msg.clone());
        emitter.emit_event(EVENT_DOWNLOAD_FAILED, &progress);
        EngineError::execution_failed(err_msg)
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let mut stdout_reader = stdout.map(|s| BufReader::new(s).lines());
    let mut stderr_reader = stderr.map(|s| BufReader::new(s).lines());

    let mut stderr_lines: Vec<String> = Vec::new();
    let mut last_reported_percent = 0.0;
    let mut last_reported_state = DownloadState::Starting;

    // 7. Execution loop
    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                is_cancelled_flag.store(true, Ordering::SeqCst);
                progress.state = DownloadState::Cancelling;
                progress.stage = "Cancelling download...".to_string();
                emitter.emit_event(EVENT_DOWNLOAD_CANCELLING, &progress);

                // Terminate process gracefully, then forcefully if needed
                let _ = child.start_kill();
                let _ = tokio::time::timeout(Duration::from_millis(2000), child.wait()).await;

                // Safe partial file cleanup
                cleanup_partial_files(&output_dir, request.title.as_deref());

                progress.state = DownloadState::Cancelled;
                progress.stage = "Cancelled by user".to_string();
                progress.error_message = Some("Download was cancelled by user".to_string());
                emitter.emit_event(EVENT_DOWNLOAD_CANCELLED, &progress);

                return Err(EngineError::new(
                    crate::models::EngineErrorKind::ExecutionFailed,
                    "Download was cancelled by user",
                ));
            }

            line_res = async {
                if let Some(ref mut reader) = stdout_reader {
                    reader.next_line().await
                } else {
                    Ok(None)
                }
            } => {
                match line_res {
                    Ok(Some(line)) => {
                        if is_cancelled_flag.load(Ordering::SeqCst) {
                            continue;
                        }

                        let updated = parse_progress_line(&line, &mut progress);
                        if updated {
                            // Throttle micro-updates to avoid flooding event bus
                            let percent_changed = (progress.percentage - last_reported_percent).abs() >= 0.5;
                            let state_changed = progress.state != last_reported_state;

                            if percent_changed || state_changed {
                                last_reported_percent = progress.percentage;
                                last_reported_state = progress.state;

                                let evt = if progress.state == DownloadState::Processing {
                                    EVENT_DOWNLOAD_PROCESSING
                                } else {
                                    EVENT_DOWNLOAD_PROGRESS
                                };
                                emitter.emit_event(evt, &progress);
                            }
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }

            err_res = async {
                if let Some(ref mut reader) = stderr_reader {
                    reader.next_line().await
                } else {
                    Ok(None)
                }
            } => {
                if let Ok(Some(line)) = err_res {
                    let sanitized = sanitize_output_line(&line);
                    if !sanitized.trim().is_empty() {
                        stderr_lines.push(sanitized);
                    }
                }
            }
        }
    }

    // 8. Wait for process exit
    let exit_status = child.wait().await.map_err(|e| {
        EngineError::execution_failed(format!("Failed to wait for child process: {}", e))
    })?;

    // Check if cancellation raced with exit
    if is_cancelled_flag.load(Ordering::SeqCst) {
        progress.state = DownloadState::Cancelled;
        progress.stage = "Cancelled by user".to_string();
        emitter.emit_event(EVENT_DOWNLOAD_CANCELLED, &progress);
        return Err(EngineError::new(
            crate::models::EngineErrorKind::ExecutionFailed,
            "Download was cancelled by user",
        ));
    }

    if exit_status.success() {
        // Find and verify final output file
        let candidate_path = progress
            .output_path
            .as_ref()
            .map(PathBuf::from)
            .or_else(|| find_candidate_output(&output_dir, request.title.as_deref()));

        let final_path = match candidate_path {
            Some(p) => p,
            None => {
                let err_msg =
                    "Download exited successfully but output file could not be identified."
                        .to_string();
                progress.state = DownloadState::Failed;
                progress.error_message = Some(err_msg.clone());
                emitter.emit_event(EVENT_DOWNLOAD_FAILED, &progress);
                return Err(EngineError::not_found(err_msg));
            }
        };

        match verify_output_file(&final_path) {
            Ok(file_size) => {
                let path_str = final_path.to_string_lossy().to_string();
                progress.state = DownloadState::Completed;
                progress.percentage = 100.0;
                progress.stage = "Download complete".to_string();
                progress.output_path = Some(path_str.clone());
                progress.current_filename = final_path
                    .file_name()
                    .map(|f| f.to_string_lossy().to_string());
                progress.downloaded_bytes = file_size;
                progress.total_bytes = Some(file_size);
                progress.downloaded_formatted =
                    crate::downloader::progress::format_bytes(file_size);
                progress.total_formatted = progress.downloaded_formatted.clone();
                progress.speed_formatted = "Done".to_string();
                progress.eta_formatted = "00:00".to_string();

                emitter.emit_event(EVENT_DOWNLOAD_COMPLETED, &progress);
                Ok(path_str)
            }
            Err(e) => {
                let err_msg = format!("File verification failed: {}", e.message);
                progress.state = DownloadState::Failed;
                progress.error_message = Some(err_msg.clone());
                emitter.emit_event(EVENT_DOWNLOAD_FAILED, &progress);
                Err(EngineError::execution_failed(err_msg))
            }
        }
    } else {
        let err_details = if !stderr_lines.is_empty() {
            stderr_lines.join("\n")
        } else {
            format!(
                "yt-dlp exited with non-zero status {:?}",
                exit_status.code()
            )
        };

        progress.state = DownloadState::Failed;
        progress.error_message = Some(err_details.clone());
        emitter.emit_event(EVENT_DOWNLOAD_FAILED, &progress);

        Err(EngineError::execution_failed(err_details))
    }
}
