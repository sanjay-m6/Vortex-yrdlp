pub mod batch;
pub mod download_progress;
pub mod download_request;
pub mod download_task;
pub mod engine_status;
pub mod errors;
pub mod library;
pub mod playlist;
pub mod queue;

pub use batch::*;
pub use download_progress::*;
pub use download_request::*;
pub use download_task::*;
pub use engine_status::*;
pub use errors::*;
pub use library::*;
pub use playlist::*;
pub use queue::*;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub ytdlp_installed: bool,
    pub ytdlp_version: Option<String>,
    pub ytdlp_path: Option<String>,
    pub ffmpeg_installed: bool,
    pub ffmpeg_version: Option<String>,
    pub ffmpeg_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub height: Option<u32>,
    pub width: Option<u32>,
    pub fps: Option<f64>,
    pub filesize: Option<u64>,
    pub filesize_approx: Option<u64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub tbr: Option<f64>,
    pub format_note: Option<String>,
    pub is_audio_only: bool,
    pub is_video_only: bool,
    pub has_both: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub title: String,
    pub url: String,
    pub duration: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaMetadata {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
    pub uploader_url: Option<String>,
    pub duration: Option<f64>,
    pub duration_string: Option<String>,
    pub description: Option<String>,
    pub view_count: Option<u64>,
    pub formats: Vec<VideoFormat>,
    pub is_playlist: bool,
    pub playlist_count: Option<usize>,
    pub playlist_entries: Option<Vec<PlaylistEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadOptions {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub format_id: Option<String>,
    pub quality_preset: String, // "best", "4k", "1440p", "1080p", "720p", "480p", "audio_best", "mp3_320", "mp3_192", "wav"
    pub download_dir: String,
    pub custom_filename: Option<String>,
    pub is_audio_only: bool,
    pub audio_format: Option<String>, // "mp3", "m4a", "wav", "opus", "flac"
    pub embed_thumbnail: bool,
    pub embed_subtitles: bool,
    pub playlist_item_indices: Option<Vec<u32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub download_id: String,
    pub status: String, // "queued" | "downloading" | "processing" | "completed" | "error" | "cancelled"
    pub percentage: f32,
    pub speed: String,
    pub eta: String,
    pub downloaded_bytes: String,
    pub total_bytes: String,
    pub current_step: String,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    pub file_path: String,
    pub file_size_bytes: Option<u64>,
    pub format_name: String,
    pub is_audio: bool,
    pub completed_at: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub download_dir: String,
    pub default_video_quality: String,
    pub default_audio_format: String,
    pub max_concurrent_downloads: u32,
    pub rate_limit_kbps: Option<u32>,
    pub custom_ytdlp_path: Option<String>,
    pub custom_ffmpeg_path: Option<String>,
    pub auto_remove_completed: bool,
    pub embed_metadata: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let download_dir = crate::downloader::validation::default_downloads_dir()
            .to_string_lossy()
            .to_string();

        Self {
            download_dir,
            default_video_quality: "1080p".to_string(),
            default_audio_format: "mp3".to_string(),
            max_concurrent_downloads: 3,
            rate_limit_kbps: None,
            custom_ytdlp_path: None,
            custom_ffmpeg_path: None,
            auto_remove_completed: false,
            embed_metadata: true,
        }
    }
}
