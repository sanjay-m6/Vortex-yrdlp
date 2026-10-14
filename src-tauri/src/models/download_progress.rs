use super::download_task::DownloadState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub task_id: String,
    pub attempt_id: u32,
    pub state: DownloadState,
    pub percentage: f32,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: Option<u64>,
    pub eta_seconds: Option<u64>,
    pub speed_formatted: String,
    pub eta_formatted: String,
    pub downloaded_formatted: String,
    pub total_formatted: String,
    pub current_filename: Option<String>,
    pub stage: String,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
}

impl Default for DownloadProgress {
    fn default() -> Self {
        Self {
            task_id: String::new(),
            attempt_id: 1,
            state: DownloadState::Queued,
            percentage: 0.0,
            downloaded_bytes: 0,
            total_bytes: None,
            speed_bytes_per_sec: None,
            eta_seconds: None,
            speed_formatted: "0 KB/s".to_string(),
            eta_formatted: "--:--".to_string(),
            downloaded_formatted: "0 B".to_string(),
            total_formatted: "Unknown".to_string(),
            current_filename: None,
            stage: "Queued".to_string(),
            output_path: None,
            error_message: None,
        }
    }
}
