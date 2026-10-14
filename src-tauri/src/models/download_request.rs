use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaType {
    Video,
    Audio,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverwritePolicy {
    Overwrite,
    Rename,
    Skip,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "mode", content = "value", rename_all = "snake_case")]
pub enum FormatSelection {
    Best,
    Preset(String), // "4k", "1440p", "1080p", "720p", "480p", "audio_best", "mp3_320", "mp3_192", "wav"
    Custom(String), // e.g. "137" or "248+251"
    AudioOnly {
        format: String,          // "mp3", "m4a", "wav", "opus", "flac"
        quality: Option<String>, // "0", "2", "5"
    },
}

impl Default for MediaType {
    fn default() -> Self {
        Self::Video
    }
}

impl Default for OverwritePolicy {
    fn default() -> Self {
        Self::Rename
    }
}

impl Default for FormatSelection {
    fn default() -> Self {
        Self::Best
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub task_id: Option<String>,
    pub webpage_url: String,
    #[serde(default)]
    pub format_selection: FormatSelection,
    pub output_directory: String,
    pub filename_template: Option<String>,
    #[serde(default)]
    pub media_type: MediaType,
    #[serde(default)]
    pub overwrite_policy: OverwritePolicy,
    pub title: Option<String>,
    pub uploader: Option<String>,
    pub thumbnail: Option<String>,
    pub duration: Option<f64>,
    #[serde(default)]
    pub preset_id: Option<String>,
    #[serde(default)]
    pub settings_snapshot: Option<crate::presets::model::DownloadSettingsSnapshot>,
}

impl Default for DownloadRequest {
    fn default() -> Self {
        Self {
            task_id: None,
            webpage_url: String::new(),
            format_selection: FormatSelection::Best,
            output_directory: String::new(),
            filename_template: None,
            media_type: MediaType::Video,
            overwrite_policy: OverwritePolicy::Rename,
            title: None,
            uploader: None,
            thumbnail: None,
            duration: None,
            preset_id: None,
            settings_snapshot: None,
        }
    }
}
