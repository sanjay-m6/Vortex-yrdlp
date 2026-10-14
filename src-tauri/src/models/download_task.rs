use super::download_progress::DownloadProgress;
use super::download_request::DownloadRequest;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DownloadState {
    Queued,
    Starting,
    Downloading,
    Processing,
    Cancelling,
    Cancelled,
    Completed,
    Failed,
}

impl DownloadState {
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            DownloadState::Completed | DownloadState::Failed | DownloadState::Cancelled
        )
    }

    pub fn is_active(&self) -> bool {
        matches!(
            self,
            DownloadState::Queued
                | DownloadState::Starting
                | DownloadState::Downloading
                | DownloadState::Processing
                | DownloadState::Cancelling
        )
    }

    pub fn can_cancel(&self) -> bool {
        matches!(
            self,
            DownloadState::Queued
                | DownloadState::Starting
                | DownloadState::Downloading
                | DownloadState::Processing
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
    pub id: String,
    pub attempt_id: u32,
    pub request: DownloadRequest,
    pub state: DownloadState,
    pub progress: DownloadProgress,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}
