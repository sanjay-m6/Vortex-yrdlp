use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileAvailability {
    Available,
    Missing,
    Inaccessible,
    Unknown,
}

impl Default for FileAvailability {
    fn default() -> Self {
        Self::Unknown
    }
}

impl FileAvailability {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Available => "available",
            Self::Missing => "missing",
            Self::Inaccessible => "inaccessible",
            Self::Unknown => "unknown",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "available" => Self::Available,
            "missing" => Self::Missing,
            "inaccessible" => Self::Inaccessible,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryItem {
    pub id: String,
    pub title: String,
    pub source_url: String,
    pub uploader: Option<String>,
    pub thumbnail_url: Option<String>,
    pub media_type: String,
    pub format_label: String,
    pub file_extension: Option<String>,
    pub output_path: Option<String>,
    pub file_size_bytes: Option<u64>,
    pub duration: Option<f64>,
    pub status: String,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub last_error: Option<String>,
    pub attempt_count: u32,
    pub file_availability: FileAvailability,
    pub last_verified_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryFilter {
    pub search_query: Option<String>,
    pub status: Option<String>,
    pub media_type: Option<String>,
    pub availability: Option<String>,
    pub sort_by: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibrarySummary {
    pub total_completed: usize,
    pub total_failed: usize,
    pub total_cancelled: usize,
    pub total_library_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaLibraryResponse {
    pub items: Vec<MediaLibraryItem>,
    pub total_count: usize,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
    pub summary: MediaLibrarySummary,
}
