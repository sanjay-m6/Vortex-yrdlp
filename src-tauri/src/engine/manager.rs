use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::engine::resolver::ToolResolver;
use crate::engine::version::ToolVersionChecker;
use crate::models::{
    DiagnosticsReport, EngineStatus, ToolSource, ToolState, ToolStatus, ToolType,
    ToolValidationResult,
};
use crate::process::events::now_iso;

pub struct EngineManager {
    cached_status: Arc<RwLock<Option<EngineStatus>>>,
}

impl Default for EngineManager {
    fn default() -> Self {
        Self::new()
    }
}

impl EngineManager {
    pub fn new() -> Self {
        Self {
            cached_status: Arc::new(RwLock::new(None)),
        }
    }

    /// Checks the status of a specific external tool executable.
    pub async fn check_tool(&self, tool: ToolType, custom_path: Option<&str>) -> ToolStatus {
        let resolved = ToolResolver::resolve_tool(tool, custom_path);

        match resolved {
            Some((exe_path, source)) => {
                let path_str = exe_path.to_string_lossy().to_string();
                match ToolVersionChecker::check_version(tool, &exe_path).await {
                    Ok(version) => {
                        // Check if version is deemed too old for yt-dlp (e.g. before 2023)
                        if tool == ToolType::YtDlp && version.starts_with("202") {
                            // Check year if it's 2020, 2021, 2022
                            if version.starts_with("2020.")
                                || version.starts_with("2021.")
                                || version.starts_with("2022.")
                            {
                                return ToolStatus::unsupported(
                                    Some(path_str),
                                    version.clone(),
                                    format!("yt-dlp version {} is too old; please update to 2024 or newer", version),
                                    Some(source),
                                );
                            }
                        }
                        ToolStatus::ready(version, path_str, source)
                    }
                    Err(err) => {
                        let msg = err.message;
                        if err.kind == crate::models::EngineErrorKind::ParseError {
                            ToolStatus::unsupported(
                                Some(path_str),
                                "Unknown".to_string(),
                                msg,
                                Some(source),
                            )
                        } else {
                            ToolStatus::launch_failed(Some(path_str), msg, Some(source))
                        }
                    }
                }
            }
            None => {
                // If the user specified a custom path, indicate that specific failure
                if let Some(custom) = custom_path {
                    let trimmed = custom.trim();
                    if !trimmed.is_empty() {
                        return ToolStatus::launch_failed(
                            Some(trimmed.to_string()),
                            format!(
                                "Configured {} executable was not found or is invalid",
                                tool.as_str()
                            ),
                            Some(ToolSource::UserConfigured),
                        );
                    }
                }

                ToolStatus::not_installed(Some(format!(
                    "{} executable not found in user path, application directory, or system PATH",
                    tool.as_str()
                )))
            }
        }
    }

    /// Retrieves complete engine status (yt-dlp, FFmpeg, FFprobe, OS, Tauri versions).
    pub async fn get_status(
        &self,
        force_refresh: bool,
        custom_ytdlp: Option<String>,
        custom_ffmpeg: Option<String>,
    ) -> EngineStatus {
        if !force_refresh {
            let cache = self.cached_status.read().await;
            if let Some(ref status) = *cache {
                return status.clone();
            }
        }

        // Run checks concurrently
        let (ytdlp, ffmpeg, ffprobe) = tokio::join!(
            self.check_tool(ToolType::YtDlp, custom_ytdlp.as_deref()),
            self.check_tool(ToolType::Ffmpeg, custom_ffmpeg.as_deref()),
            self.check_tool(ToolType::Ffprobe, None)
        );

        let os_info = format!("{} ({})", std::env::consts::OS, std::env::consts::ARCH);
        let app_version = env!("CARGO_PKG_VERSION").to_string();
        let tauri_version = "2.0".to_string();
        let last_checked = Some(now_iso());
        let managed_tools_dir = ToolResolver::get_managed_tools_dir()
            .to_string_lossy()
            .to_string();

        let is_ready = ytdlp.available && ytdlp.state == ToolState::Ready;

        let status = EngineStatus {
            ytdlp,
            ffmpeg,
            ffprobe,
            os_info,
            app_version,
            tauri_version,
            last_checked,
            is_ready,
            managed_tools_dir,
        };

        // Cache result
        let mut cache = self.cached_status.write().await;
        *cache = Some(status.clone());

        status
    }

    /// Validates an arbitrary user-selected executable path for a specific tool.
    pub async fn validate_tool_path(&self, tool: ToolType, path_str: &str) -> ToolValidationResult {
        let p = PathBuf::from(path_str.trim());
        let valid_path = match ToolResolver::validate_executable(&p) {
            Ok(v) => v,
            Err(e) => {
                return ToolValidationResult {
                    valid: false,
                    tool_type: tool.as_str().to_string(),
                    resolved_path: path_str.to_string(),
                    version: None,
                    error: Some(e.message),
                };
            }
        };

        match ToolVersionChecker::check_version(tool, &valid_path).await {
            Ok(version) => ToolValidationResult {
                valid: true,
                tool_type: tool.as_str().to_string(),
                resolved_path: valid_path.to_string_lossy().to_string(),
                version: Some(version),
                error: None,
            },
            Err(e) => ToolValidationResult {
                valid: false,
                tool_type: tool.as_str().to_string(),
                resolved_path: valid_path.to_string_lossy().to_string(),
                version: None,
                error: Some(e.message),
            },
        }
    }

    /// Generates a sanitized diagnostic report string.
    pub fn generate_diagnostics_report(&self, status: &EngineStatus) -> DiagnosticsReport {
        let raw = format!(
            "=== Vortex Engine Diagnostics ===\n\
             Generated: {}\n\
             OS: {}\n\
             Vortex Version: {}\n\
             Tauri Version: {}\n\
             Managed Tools Directory: {}\n\
             Engine Ready: {}\n\n\
             [yt-dlp]\n\
             State: {:?}\n\
             Available: {}\n\
             Version: {}\n\
             Path: {}\n\
             Source: {:?}\n\
             Error: {}\n\n\
             [FFmpeg]\n\
             State: {:?}\n\
             Available: {}\n\
             Version: {}\n\
             Path: {}\n\
             Source: {:?}\n\
             Error: {}\n\n\
             [FFprobe]\n\
             State: {:?}\n\
             Available: {}\n\
             Version: {}\n\
             Path: {}\n\
             Source: {:?}\n\
             Error: {}\n\
             ==================================",
            status.last_checked.as_deref().unwrap_or("N/A"),
            status.os_info,
            status.app_version,
            status.tauri_version,
            status.managed_tools_dir,
            status.is_ready,
            status.ytdlp.state,
            status.ytdlp.available,
            status.ytdlp.version.as_deref().unwrap_or("N/A"),
            status.ytdlp.executable_path.as_deref().unwrap_or("N/A"),
            status.ytdlp.source,
            status.ytdlp.error.as_deref().unwrap_or("None"),
            status.ffmpeg.state,
            status.ffmpeg.available,
            status.ffmpeg.version.as_deref().unwrap_or("N/A"),
            status.ffmpeg.executable_path.as_deref().unwrap_or("N/A"),
            status.ffmpeg.source,
            status.ffmpeg.error.as_deref().unwrap_or("None"),
            status.ffprobe.state,
            status.ffprobe.available,
            status.ffprobe.version.as_deref().unwrap_or("N/A"),
            status.ffprobe.executable_path.as_deref().unwrap_or("N/A"),
            status.ffprobe.source,
            status.ffprobe.error.as_deref().unwrap_or("None"),
        );

        DiagnosticsReport {
            app_version: status.app_version.clone(),
            tauri_version: status.tauri_version.clone(),
            os_info: status.os_info.clone(),
            ytdlp: status.ytdlp.clone(),
            ffmpeg: status.ffmpeg.clone(),
            ffprobe: status.ffprobe.clone(),
            managed_tools_dir: status.managed_tools_dir.clone(),
            last_checked: status.last_checked.clone(),
            raw_report: raw,
        }
    }
}
