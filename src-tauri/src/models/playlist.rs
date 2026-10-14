use super::download_request::{FormatSelection, MediaType};
use super::queue::QueuePriority;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEntryItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub duration_formatted: String,
    pub uploader: Option<String>,
    pub position: usize,
    pub is_available: bool,
    pub availability_note: Option<String>,
    pub existing_status: Option<String>, // "queued", "active", "completed", "failed", or null
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistInfo {
    pub id: String,
    pub title: String,
    pub uploader: Option<String>,
    pub webpage_url: String,
    pub thumbnail: Option<String>,
    pub entry_count: usize,
    pub is_verified_count: bool,
    pub entries: Vec<PlaylistEntryItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistEnqueueRequest {
    pub playlist_id: String,
    pub playlist_title: String,
    pub selected_entries: Vec<PlaylistEntryItem>,
    pub format_selection: FormatSelection,
    pub output_directory: String,
    pub create_subfolder: bool,
    pub media_type: MediaType,
    pub priority: Option<QueuePriority>,
}
