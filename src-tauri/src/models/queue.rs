use super::download_progress::DownloadProgress;
use super::download_request::DownloadRequest;
use super::download_task::DownloadState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QueuePriority {
    Low = 0,
    Normal = 1,
    High = 2,
}

impl Default for QueuePriority {
    fn default() -> Self {
        Self::Normal
    }
}

impl QueuePriority {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Normal => "normal",
            Self::High => "high",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "high" => Self::High,
            "low" => Self::Low,
            _ => Self::Normal,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItem {
    pub id: String,
    pub request: DownloadRequest,
    pub status: DownloadState,
    pub priority: QueuePriority,
    pub queue_position: usize,
    pub progress: Option<DownloadProgress>,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub output_path: Option<String>,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub attempt_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadAttemptRecord {
    pub id: Option<i64>,
    pub download_id: String,
    pub attempt_number: u32,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub final_status: String,
    pub exit_code: Option<i32>,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueSnapshot {
    pub items: Vec<QueueItem>,
    pub is_paused: bool,
    pub concurrency_limit: usize,
    pub active_count: usize,
    pub queued_count: usize,
    pub completed_count: usize,
    pub failed_count: usize,
}
