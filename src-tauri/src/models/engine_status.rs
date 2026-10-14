use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolType {
    YtDlp,
    Ffmpeg,
    Ffprobe,
}

impl ToolType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ToolType::YtDlp => "yt-dlp",
            ToolType::Ffmpeg => "ffmpeg",
            ToolType::Ffprobe => "ffprobe",
        }
    }

    pub fn default_executable_name(&self) -> &'static str {
        if cfg!(target_os = "windows") {
            match self {
                ToolType::YtDlp => "yt-dlp.exe",
                ToolType::Ffmpeg => "ffmpeg.exe",
                ToolType::Ffprobe => "ffprobe.exe",
            }
        } else {
            match self {
                ToolType::YtDlp => "yt-dlp",
                ToolType::Ffmpeg => "ffmpeg",
                ToolType::Ffprobe => "ffprobe",
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolState {
    Ready,
    NotInstalled,
    VersionUnsupported,
    LaunchFailed,
    Checking,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolSource {
    UserConfigured,
    AppManaged,
    SystemPath,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub available: bool,
    pub state: ToolState,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub error: Option<String>,
    pub source: Option<ToolSource>,
}

impl Default for ToolStatus {
    fn default() -> Self {
        Self {
            available: false,
            state: ToolState::NotInstalled,
            version: None,
            executable_path: None,
            error: None,
            source: None,
        }
    }
}

impl ToolStatus {
    pub fn not_installed(err: Option<String>) -> Self {
        Self {
            available: false,
            state: ToolState::NotInstalled,
            version: None,
            executable_path: None,
            error: err,
            source: None,
        }
    }

    pub fn ready(version: String, path: String, source: ToolSource) -> Self {
        Self {
            available: true,
            state: ToolState::Ready,
            version: Some(version),
            executable_path: Some(path),
            error: None,
            source: Some(source),
        }
    }

    pub fn launch_failed(path: Option<String>, error: String, source: Option<ToolSource>) -> Self {
        Self {
            available: false,
            state: ToolState::LaunchFailed,
            version: None,
            executable_path: path,
            error: Some(error),
            source,
        }
    }

    pub fn unsupported(
        path: Option<String>,
        version: String,
        error: String,
        source: Option<ToolSource>,
    ) -> Self {
        Self {
            available: false,
            state: ToolState::VersionUnsupported,
            version: Some(version),
            executable_path: path,
            error: Some(error),
            source,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub ytdlp: ToolStatus,
    pub ffmpeg: ToolStatus,
    pub ffprobe: ToolStatus,
    pub os_info: String,
    pub app_version: String,
    pub tauri_version: String,
    pub last_checked: Option<String>,
    pub is_ready: bool,
    pub managed_tools_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ToolValidationResult {
    pub valid: bool,
    pub tool_type: String,
    pub resolved_path: String,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub app_version: String,
    pub tauri_version: String,
    pub os_info: String,
    pub ytdlp: ToolStatus,
    pub ffmpeg: ToolStatus,
    pub ffprobe: ToolStatus,
    pub managed_tools_dir: String,
    pub last_checked: Option<String>,
    pub raw_report: String,
}
