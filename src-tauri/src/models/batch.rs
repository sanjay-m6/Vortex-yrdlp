use super::download_request::{FormatSelection, MediaType};
use super::queue::QueuePriority;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BatchEntryStatus {
    Valid,
    DuplicateWithinBatch,
    AlreadyQueued,
    AlreadyCompleted,
    InvalidUrl,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchValidatedEntry {
    pub original_line: usize,
    pub raw_input: String,
    pub normalized_url: Option<String>,
    pub status: BatchEntryStatus,
    pub reason: Option<String>,
    pub title_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchValidationResult {
    pub entries: Vec<BatchValidatedEntry>,
    pub total_count: usize,
    pub valid_count: usize,
    pub duplicate_count: usize,
    pub already_queued_count: usize,
    pub already_completed_count: usize,
    pub invalid_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchEnqueueRequest {
    pub urls: Vec<String>,
    pub format_selection: FormatSelection,
    pub output_directory: String,
    pub media_type: MediaType,
    pub priority: Option<QueuePriority>,
    pub source_group_title: Option<String>,
}
