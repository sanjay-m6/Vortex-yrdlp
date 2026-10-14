use chrono::Utc;
use serde::{Deserialize, Serialize};

pub const EVENT_PROCESS_STARTED: &str = "process_started";
pub const EVENT_PROCESS_OUTPUT: &str = "process_output";
pub const EVENT_PROCESS_EXITED: &str = "process_exited";
pub const EVENT_PROCESS_ERROR: &str = "process_error";
pub const EVENT_PROCESS_CANCELLED: &str = "process_cancelled";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStartedPayload {
    pub id: String,
    pub command: String,
    pub args: Vec<String>,
    pub pid: Option<u32>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessOutputPayload {
    pub id: String,
    pub stream: String, // "stdout" or "stderr"
    pub line: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessExitedPayload {
    pub id: String,
    pub exit_code: Option<i32>,
    pub success: bool,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessErrorPayload {
    pub id: String,
    pub error: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessCancelledPayload {
    pub id: String,
    pub timestamp: String,
}

/// Sanitizes untrusted process output lines by:
/// 1. Stripping non-printable control characters (while keeping spaces/tabs).
/// 2. Scrubbing potential tokens, credentials, cookies, or auth params.
pub fn sanitize_output_line(raw: &str) -> String {
    // Filter non-printable ASCII control characters (0..=31 except tab) and DEL (127)
    let filtered: String = raw
        .chars()
        .filter(|&c| c == '\t' || (!c.is_control() && c != '\u{7f}'))
        .collect();

    // Redact sensitive patterns if found in output
    let mut sanitized = filtered;

    // Redact cookie headers or parameters
    if let Some(idx) = sanitized.find("--cookies") {
        if let Some(space_idx) = sanitized[idx..].find(' ') {
            let rest = &sanitized[idx + space_idx + 1..];
            let end_idx = rest.find(' ').unwrap_or(rest.len());
            let to_replace = &rest[..end_idx];
            if !to_replace.is_empty() {
                sanitized = sanitized.replace(to_replace, "[REDACTED_COOKIE]");
            }
        }
    }

    // Redact token / password / auth / secret patterns
    let secret_keywords = [
        "--password ",
        "password=",
        "--token ",
        "token=",
        "--api-key ",
        "api_key=",
        "--secret ",
        "secret=",
        "bearer ",
    ];
    for kw in secret_keywords {
        let mut search_from = 0;
        while search_from < sanitized.len() {
            if let Some(rel_start) = sanitized[search_from..].to_lowercase().find(kw) {
                let start = search_from + rel_start;
                let val_start = start + kw.len();
                let rest = &sanitized[val_start..];
                let end_idx = rest
                    .find(|c: char| c.is_whitespace() || c == '&' || c == ';')
                    .unwrap_or(rest.len());
                let to_replace = &rest[..end_idx];
                if !to_replace.is_empty() && to_replace != "[REDACTED]" {
                    sanitized = format!(
                        "{}{}[REDACTED]{}",
                        &sanitized[..start],
                        kw,
                        &sanitized[val_start + end_idx..]
                    );
                    search_from = start + kw.len() + "[REDACTED]".len();
                } else {
                    search_from = val_start + end_idx;
                }
            } else {
                break;
            }
        }
    }

    sanitized
}

pub fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
