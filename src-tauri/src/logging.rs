use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::command;

const MAX_LOG_SIZE_BYTES: u64 = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUP_LOGS: usize = 3;

static LOGGER: OnceLock<ProductionLogger> = OnceLock::new();

pub struct ProductionLogger {
    log_dir: PathBuf,
    current_file: PathBuf,
}

impl Default for ProductionLogger {
    fn default() -> Self {
        Self::new()
    }
}

impl ProductionLogger {
    pub fn new() -> Self {
        let log_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Vortex")
            .join("logs");

        let _ = fs::create_dir_all(&log_dir);
        let current_file = log_dir.join("vortex.log");

        Self {
            log_dir,
            current_file,
        }
    }

    pub fn rotate_if_needed(&self) {
        if let Ok(metadata) = fs::metadata(&self.current_file) {
            if metadata.len() >= MAX_LOG_SIZE_BYTES {
                for i in (1..MAX_BACKUP_LOGS).rev() {
                    let from = self.log_dir.join(format!("vortex.log.{}", i));
                    let to = self.log_dir.join(format!("vortex.log.{}", i + 1));
                    if from.exists() {
                        let _ = fs::rename(&from, &to);
                    }
                }
                let first_backup = self.log_dir.join("vortex.log.1");
                let _ = fs::rename(&self.current_file, &first_backup);
            }
        }
    }

    pub fn append_log(&self, level: &str, target: &str, raw_message: &str) {
        self.rotate_if_needed();

        let sanitized = sanitize_log_message(raw_message);
        let timestamp = Utc::now().to_rfc3339();
        let formatted = format!("[{}] [{}] [{}] {}\n", timestamp, level, target, sanitized);

        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.current_file)
        {
            let _ = file.write_all(formatted.as_bytes());
        }
    }
}

/// Sanitizes potential tokens, passwords, cookies, or secrets from URL parameters and messages.
pub fn sanitize_log_message(msg: &str) -> String {
    let patterns = [
        ("token=", "token=[REDACTED]"),
        ("key=", "key=[REDACTED]"),
        ("auth=", "auth=[REDACTED]"),
        ("sig=", "sig=[REDACTED]"),
        ("signature=", "signature=[REDACTED]"),
        ("password=", "password=[REDACTED]"),
        ("access_token=", "access_token=[REDACTED]"),
        ("cookie:", "cookie: [REDACTED]"),
    ];

    let mut result = msg.to_string();
    for (pat, repl) in patterns {
        if let Some(idx) = result.to_lowercase().find(pat) {
            let end = result[idx..]
                .find('&')
                .map(|e| idx + e)
                .unwrap_or(result.len());
            result.replace_range(idx..end, repl);
        }
    }
    result
}

pub fn init_logger() {
    LOGGER.get_or_init(ProductionLogger::new);
}

pub fn log_info(target: &str, message: &str) {
    if let Some(logger) = LOGGER.get() {
        logger.append_log("INFO", target, message);
    }
}

pub fn log_warn(target: &str, message: &str) {
    if let Some(logger) = LOGGER.get() {
        logger.append_log("WARN", target, message);
    }
}

pub fn log_error(target: &str, message: &str) {
    if let Some(logger) = LOGGER.get() {
        logger.append_log("ERROR", target, message);
    }
}

// =========================================================================
// Tauri IPC Commands
// =========================================================================

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDiagnosticReport {
    pub app_name: String,
    pub app_version: String,
    pub os_type: String,
    pub os_arch: String,
    pub database_path: String,
    pub database_size_bytes: u64,
    pub logs_directory: String,
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
    pub ffmpeg_path: Option<String>,
    pub generated_at: String,
    pub recent_logs: Vec<String>,
}

#[command]
pub async fn get_diagnostics_report(
    state: tauri::State<'_, crate::downloader::AppState>,
) -> Result<SystemDiagnosticReport, String> {
    let engine_status = state.engine.get_status(false, None, None).await;

    let app_data = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Vortex");

    let db_path = app_data.join("vortex.db");
    let db_size = fs::metadata(&db_path).map(|m| m.len()).unwrap_or(0);
    let log_dir = app_data.join("logs");

    let recent_logs = read_recent_log_lines(60);

    Ok(SystemDiagnosticReport {
        app_name: "Vortex".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os_type: std::env::consts::OS.to_string(),
        os_arch: std::env::consts::ARCH.to_string(),
        database_path: db_path.to_string_lossy().to_string(),
        database_size_bytes: db_size,
        logs_directory: log_dir.to_string_lossy().to_string(),
        ytdlp_installed: engine_status.ytdlp.available,
        ytdlp_version: engine_status.ytdlp.version,
        ytdlp_path: engine_status.ytdlp.executable_path,
        ffmpeg_installed: engine_status.ffmpeg.available,
        ffmpeg_version: engine_status.ffmpeg.version,
        ffmpeg_path: engine_status.ffmpeg.executable_path,
        generated_at: Utc::now().to_rfc3339(),
        recent_logs,
    })
}

#[command]
pub async fn open_logs_directory() -> Result<(), String> {
    let log_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Vortex")
        .join("logs");

    if !log_dir.exists() {
        let _ = fs::create_dir_all(&log_dir);
    }

    open::that(&log_dir).map_err(|e| format!("Failed to open logs directory: {}", e))
}

#[command]
pub async fn read_recent_logs(lines: Option<usize>) -> Result<Vec<String>, String> {
    let count = lines.unwrap_or(50).min(200);
    Ok(read_recent_log_lines(count))
}

fn read_recent_log_lines(count: usize) -> Vec<String> {
    let mut log_file = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Vortex")
        .join("logs")
        .join("vortex.log");

    if !log_file.exists() {
        let legacy = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("MediaDL")
            .join("logs")
            .join("mediadl.log");
        if legacy.exists() {
            log_file = legacy;
        } else {
            return vec!["[INFO] [System] No log entries yet.".to_string()];
        }
    }

    if let Ok(file) = File::open(&log_file) {
        let reader = BufReader::new(file);
        let all_lines: Vec<String> = reader.lines().map_while(Result::ok).collect();
        let total = all_lines.len();
        let start = total.saturating_sub(count);
        all_lines[start..].to_vec()
    } else {
        vec!["[WARN] [System] Could not open log file.".to_string()]
    }
}
