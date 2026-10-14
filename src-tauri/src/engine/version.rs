use regex::Regex;
use std::path::Path;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;

use crate::models::{EngineError, ToolType};

pub struct ToolVersionChecker;

impl ToolVersionChecker {
    /// Checks version of the tool executable by running safe argument-based command with timeout.
    pub async fn check_version(
        tool: ToolType,
        executable_path: &Path,
    ) -> Result<String, EngineError> {
        if !executable_path.exists() {
            return Err(EngineError::not_found(format!(
                "Executable not found at {:?}",
                executable_path
            )));
        }

        let arg = match tool {
            ToolType::YtDlp => "--version",
            ToolType::Ffmpeg | ToolType::Ffprobe => "-version",
        };

        let mut cmd = Command::new(executable_path);
        cmd.arg(arg);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.kill_on_drop(true);

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = cmd.spawn().map_err(|e| {
            EngineError::execution_failed(format!("Failed to execute {:?}: {}", executable_path, e))
        })?;

        // 5-second timeout for version query
        let output =
            match tokio::time::timeout(Duration::from_secs(5), child.wait_with_output()).await {
                Ok(Ok(out)) => out,
                Ok(Err(e)) => {
                    return Err(EngineError::execution_failed(format!(
                        "Process execution failed: {}",
                        e
                    )))
                }
                Err(_) => {
                    return Err(EngineError::timeout(format!(
                        "Version check timed out after 5s for {:?}",
                        executable_path
                    )))
                }
            };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            let err_summary = if !stderr.trim().is_empty() {
                stderr.trim()
            } else if !stdout.trim().is_empty() {
                stdout.trim()
            } else {
                "Unknown error"
            };
            return Err(EngineError::execution_failed(format!(
                "Process exited with status {:?}: {}",
                output.status.code(),
                err_summary
            )));
        }

        match tool {
            ToolType::YtDlp => Self::parse_ytdlp_version(&stdout),
            ToolType::Ffmpeg => Self::parse_ffmpeg_version(&stdout),
            ToolType::Ffprobe => Self::parse_ffprobe_version(&stdout),
        }
    }

    /// Parses yt-dlp version from stdout string.
    pub fn parse_ytdlp_version(output: &str) -> Result<String, EngineError> {
        let trimmed = output.trim();
        if trimmed.is_empty() {
            return Err(EngineError::parse_error("yt-dlp version output was empty"));
        }

        // Look for standard date format: YYYY.MM.DD (optionally with patch/git tags)
        let re = Regex::new(r"(?i)(\d{4}\.\d{2}\.\d{2}(?:[.\-_][\w\d]+)*)").unwrap();
        if let Some(captures) = re.captures(trimmed) {
            if let Some(matched) = captures.get(1) {
                return Ok(matched.as_str().to_string());
            }
        }

        // Fallback: check first non-empty line
        for line in trimmed.lines() {
            let l = line.trim();
            if !l.is_empty() && l.len() <= 60 && l.chars().any(|c| c.is_ascii_digit()) {
                return Ok(l.to_string());
            }
        }

        Err(EngineError::parse_error(format!(
            "Could not parse valid yt-dlp version from output: {:?}",
            trimmed
        )))
    }

    /// Parses ffmpeg version from stdout string.
    pub fn parse_ffmpeg_version(output: &str) -> Result<String, EngineError> {
        let trimmed = output.trim();
        if trimmed.is_empty() {
            return Err(EngineError::parse_error("ffmpeg version output was empty"));
        }

        let re = Regex::new(r"(?i)ffmpeg version\s+([^\s,]+)").unwrap();
        if let Some(captures) = re.captures(trimmed) {
            if let Some(matched) = captures.get(1) {
                return Ok(matched.as_str().to_string());
            }
        }

        // Fallback: check first line
        if let Some(first_line) = trimmed.lines().next() {
            let l = first_line.trim();
            if l.to_lowercase().starts_with("ffmpeg version") {
                return Ok(l.to_string());
            }
        }

        Err(EngineError::parse_error(format!(
            "Could not parse ffmpeg version from output: {:?}",
            trimmed
        )))
    }

    /// Parses ffprobe version from stdout string.
    pub fn parse_ffprobe_version(output: &str) -> Result<String, EngineError> {
        let trimmed = output.trim();
        if trimmed.is_empty() {
            return Err(EngineError::parse_error("ffprobe version output was empty"));
        }

        let re = Regex::new(r"(?i)ffprobe version\s+([^\s,]+)").unwrap();
        if let Some(captures) = re.captures(trimmed) {
            if let Some(matched) = captures.get(1) {
                return Ok(matched.as_str().to_string());
            }
        }

        // Fallback: check first line
        if let Some(first_line) = trimmed.lines().next() {
            let l = first_line.trim();
            if l.to_lowercase().starts_with("ffprobe version") {
                return Ok(l.to_string());
            }
        }

        Err(EngineError::parse_error(format!(
            "Could not parse ffprobe version from output: {:?}",
            trimmed
        )))
    }
}
