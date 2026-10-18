use serde::{Deserialize, Serialize};

// =========================================================================
// Typed enums for preset configuration
// =========================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PresetMediaType {
    VideoWithAudio,
    AudioOnly,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MaxResolution {
    Best,
    #[serde(rename = "2160p")]
    Res2160p,
    #[serde(rename = "1440p")]
    Res1440p,
    #[serde(rename = "1080p")]
    Res1080p,
    #[serde(rename = "720p")]
    Res720p,
    #[serde(rename = "480p")]
    Res480p,
    #[serde(rename = "360p")]
    Res360p,
}

impl MaxResolution {
    pub fn height_limit(&self) -> Option<u32> {
        match self {
            Self::Best => None,
            Self::Res2160p => Some(2160),
            Self::Res1440p => Some(1440),
            Self::Res1080p => Some(1080),
            Self::Res720p => Some(720),
            Self::Res480p => Some(480),
            Self::Res360p => Some(360),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreferredFrameRate {
    Any,
    #[serde(rename = "30")]
    Fps30,
    #[serde(rename = "60")]
    Fps60,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContainerPreference {
    Auto,
    Mp4,
    Mkv,
    Webm,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VideoCodecPreference {
    Auto,
    H264,
    H265,
    Vp9,
    Av1,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioCodecPreference {
    Auto,
    Aac,
    Opus,
    Vorbis,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioOutputFormat {
    Source,
    Mp3,
    M4a,
    Opus,
    Wav,
    Flac,
}

impl AudioOutputFormat {
    pub fn requires_ffmpeg(&self) -> bool {
        matches!(self, Self::Mp3 | Self::Wav | Self::Flac)
    }

    pub fn as_ytdlp_format(&self) -> Option<&'static str> {
        match self {
            Self::Source => None,
            Self::Mp3 => Some("mp3"),
            Self::M4a => Some("m4a"),
            Self::Opus => Some("opus"),
            Self::Wav => Some("wav"),
            Self::Flac => Some("flac"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioBitrate {
    Auto,
    #[serde(rename = "320k")]
    Kbps320,
    #[serde(rename = "256k")]
    Kbps256,
    #[serde(rename = "192k")]
    Kbps192,
    #[serde(rename = "128k")]
    Kbps128,
    #[serde(rename = "96k")]
    Kbps96,
}

impl AudioBitrate {
    /// Returns the yt-dlp audio-quality number (VBR scale 0–9 for codecs like mp3)
    pub fn ytdlp_quality(&self) -> Option<&'static str> {
        match self {
            Self::Auto => None,
            Self::Kbps320 => Some("0"),
            Self::Kbps256 => Some("1"),
            Self::Kbps192 => Some("2"),
            Self::Kbps128 => Some("5"),
            Self::Kbps96 => Some("7"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FilenameCollisionPolicy {
    Rename,
    Overwrite,
    Skip,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FolderRule {
    None,
    MediaType,
    Playlist,
    Uploader,
    Date,
}

// =========================================================================
// Download Preset — the core data model
// =========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub is_built_in: bool,

    // Media type
    pub media_type: PresetMediaType,

    // Video preferences (used when media_type == VideoWithAudio)
    pub max_resolution: Option<MaxResolution>,
    pub preferred_frame_rate: Option<PreferredFrameRate>,
    pub container_preference: Option<ContainerPreference>,
    pub video_codec_preference: Option<VideoCodecPreference>,

    // Audio preferences
    pub audio_codec_preference: Option<AudioCodecPreference>,
    pub audio_output_format: Option<AudioOutputFormat>,
    pub audio_bitrate: Option<AudioBitrate>,

    // Filename and output
    pub filename_template: Option<String>,
    pub output_folder_rule: Option<FolderRule>,

    // Metadata timestamps
    pub created_at: String,
    pub updated_at: String,
}

// =========================================================================
// Download Settings — application-level defaults
// =========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSettings {
    pub default_preset_id: String,
    pub default_output_directory: String,
    pub ask_before_download: bool,
    pub filename_collision_policy: FilenameCollisionPolicy,

    // Video defaults
    pub default_max_resolution: MaxResolution,
    pub default_frame_rate: PreferredFrameRate,
    pub default_container: ContainerPreference,
    pub default_video_codec: VideoCodecPreference,

    // Audio defaults
    pub default_audio_codec: AudioCodecPreference,
    pub default_audio_format: AudioOutputFormat,
    pub default_audio_bitrate: AudioBitrate,

    // Filename defaults
    pub default_filename_template: String,

    // Output folder organization
    pub video_subfolder: Option<String>,
    pub audio_subfolder: Option<String>,
    pub playlist_subfolder: bool,
    pub uploader_subfolder: bool,
    pub date_subfolder: bool,
}

impl Default for DownloadSettings {
    fn default() -> Self {
        let download_dir = crate::downloader::validation::default_downloads_dir()
            .to_string_lossy()
            .to_string();

        Self {
            default_preset_id: "best-quality".to_string(),
            default_output_directory: download_dir,
            ask_before_download: false,
            filename_collision_policy: FilenameCollisionPolicy::Rename,

            default_max_resolution: MaxResolution::Best,
            default_frame_rate: PreferredFrameRate::Any,
            default_container: ContainerPreference::Auto,
            default_video_codec: VideoCodecPreference::Auto,

            default_audio_codec: AudioCodecPreference::Auto,
            default_audio_format: AudioOutputFormat::Source,
            default_audio_bitrate: AudioBitrate::Auto,

            default_filename_template: "%(title).150B [%(id)s].%(ext)s".to_string(),

            video_subfolder: None,
            audio_subfolder: None,
            playlist_subfolder: false,
            uploader_subfolder: false,
            date_subfolder: false,
        }
    }
}

// =========================================================================
// Per-download settings snapshot — immutable once enqueued
// =========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSettingsSnapshot {
    pub preset_id: String,
    pub preset_name: String,

    pub media_type: PresetMediaType,
    pub max_resolution: Option<MaxResolution>,
    pub preferred_frame_rate: Option<PreferredFrameRate>,
    pub container_preference: Option<ContainerPreference>,
    pub video_codec_preference: Option<VideoCodecPreference>,
    pub audio_codec_preference: Option<AudioCodecPreference>,
    pub audio_output_format: Option<AudioOutputFormat>,
    pub audio_bitrate: Option<AudioBitrate>,
    pub filename_template: Option<String>,
    pub output_folder_rule: Option<FolderRule>,
    pub output_directory: String,
    pub filename_collision_policy: FilenameCollisionPolicy,

    /// Whether any field differs from the original preset
    pub has_overrides: bool,
}

// =========================================================================
// Validation result for settings
// =========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsValidationResult {
    pub valid: bool,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub ffmpeg_required: bool,
    pub ffmpeg_available: bool,
    pub resolved_format_string: Option<String>,
}
