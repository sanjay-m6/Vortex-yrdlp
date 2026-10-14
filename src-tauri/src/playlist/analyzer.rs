use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::database::{fetch_all_downloads, DbState};
use crate::engine::resolver::ToolResolver;
use crate::models::{EngineError, EngineErrorKind, PlaylistEntryItem, PlaylistInfo, ToolType};
use crate::playlist::validation::validate_playlist_url;

pub fn format_duration(seconds: f64) -> String {
    if seconds <= 0.0 {
        return "--:--".to_string();
    }
    let total_secs = seconds.round() as u64;
    let hours = total_secs / 3600;
    let minutes = (total_secs % 3600) / 60;
    let secs = total_secs % 60;

    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}

pub fn parse_playlist_json(
    json_text: &str,
    webpage_url: &str,
    db: Option<&DbState>,
) -> Result<PlaylistInfo, EngineError> {
    let val: serde_json::Value = serde_json::from_str(json_text).map_err(|e| {
        EngineError::execution_failed(format!("Failed to parse playlist JSON: {}", e))
    })?;

    let id = val
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let title = val
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Playlist")
        .to_string();

    let uploader = val
        .get("uploader")
        .or_else(|| val.get("channel"))
        .or_else(|| val.get("uploader_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let thumbnail = val
        .get("thumbnail")
        .or_else(|| {
            val.get("thumbnails")
                .and_then(|t| t.as_array())
                .and_then(|arr| arr.last())
                .and_then(|t| t.get("url"))
        })
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Fetch existing tasks from DB to mark existing_status if DB is available
    let existing_downloads = if let Some(database) = db {
        if let Ok(conn) = database.conn.lock() {
            fetch_all_downloads(&conn).unwrap_or_default()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    let mut entries = Vec::new();

    if let Some(entries_arr) = val.get("entries").and_then(|e| e.as_array()) {
        for (idx, entry) in entries_arr.iter().enumerate() {
            let entry_id = entry
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let entry_title = entry
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled Entry")
                .to_string();

            let entry_url = entry
                .get("url")
                .or_else(|| entry.get("webpage_url"))
                .and_then(|v| v.as_str())
                .map(|s| {
                    if s.starts_with("http://") || s.starts_with("https://") {
                        s.to_string()
                    } else if !entry_id.is_empty() {
                        format!("https://www.youtube.com/watch?v={}", entry_id)
                    } else {
                        s.to_string()
                    }
                })
                .unwrap_or_else(|| {
                    if !entry_id.is_empty() {
                        format!("https://www.youtube.com/watch?v={}", entry_id)
                    } else {
                        "".to_string()
                    }
                });

            let duration = entry.get("duration").and_then(|v| v.as_f64());
            let duration_formatted = duration
                .map(format_duration)
                .unwrap_or_else(|| "--:--".to_string());

            let entry_uploader = entry
                .get("uploader")
                .or_else(|| entry.get("channel"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let entry_thumb = entry
                .get("thumbnail")
                .or_else(|| {
                    entry
                        .get("thumbnails")
                        .and_then(|t| t.as_array())
                        .and_then(|arr| arr.last())
                        .and_then(|t| t.get("url"))
                })
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            // Detect availability
            let lower_title = entry_title.to_lowercase();
            let is_unavailable = lower_title.contains("[private video]")
                || lower_title.contains("[deleted video]")
                || lower_title.contains("unavailable");

            let availability_note = if is_unavailable {
                Some(entry_title.clone())
            } else {
                None
            };

            // Check if URL or ID exists in database
            let existing_status = existing_downloads.iter().find_map(|d| {
                if (!entry_url.is_empty() && d.request.webpage_url == entry_url)
                    || (!entry_id.is_empty() && d.id.contains(&entry_id))
                {
                    Some(format!("{:?}", d.status).to_lowercase())
                } else {
                    None
                }
            });

            entries.push(PlaylistEntryItem {
                id: entry_id,
                title: entry_title,
                url: entry_url,
                thumbnail: entry_thumb,
                duration,
                duration_formatted,
                uploader: entry_uploader,
                position: idx + 1,
                is_available: !is_unavailable,
                availability_note,
                existing_status,
            });
        }
    }

    let entry_count = entries.len();
    let is_verified_count = val.get("playlist_count").is_some() || !entries.is_empty();

    Ok(PlaylistInfo {
        id,
        title,
        uploader,
        webpage_url: webpage_url.to_string(),
        thumbnail,
        entry_count,
        is_verified_count,
        entries,
    })
}

pub async fn inspect_playlist(
    url: &str,
    custom_ytdlp: Option<&str>,
    mut cancel_rx: oneshot::Receiver<()>,
    is_cancelled: Arc<AtomicBool>,
    db: Option<&DbState>,
) -> Result<PlaylistInfo, EngineError> {
    validate_playlist_url(url)?;

    let (ytdlp_bin, _) =
        ToolResolver::resolve_tool(ToolType::YtDlp, custom_ytdlp).ok_or_else(|| {
            EngineError::not_found(
                "yt-dlp executable was not found. Please install yt-dlp in Settings.",
            )
        })?;

    let mut cmd = Command::new(&ytdlp_bin);
    cmd.args([
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        "--ignore-errors",
        url,
    ]);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    cmd.kill_on_drop(true);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| {
        EngineError::execution_failed(format!("Failed to spawn yt-dlp playlist inspector: {}", e))
    })?;

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| EngineError::execution_failed("Failed to open child stdout"))?;

    let mut buffer = Vec::new();
    let mut chunk = [0u8; 16384];

    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                is_cancelled.store(true, Ordering::SeqCst);
                let _ = child.start_kill();
                return Err(EngineError::new(
                    EngineErrorKind::ExecutionFailed,
                    "Playlist analysis cancelled by user",
                ));
            }
            res = stdout.read(&mut chunk) => {
                match res {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        buffer.extend_from_slice(&chunk[..n]);
                        // Bound memory size to 25MB to prevent out-of-memory on massive playlists
                        if buffer.len() > 25 * 1024 * 1024 {
                            let _ = child.start_kill();
                            return Err(EngineError::execution_failed(
                                "Playlist metadata exceeded memory limit (25MB)",
                            ));
                        }
                    }
                    Err(e) => {
                        return Err(EngineError::execution_failed(format!(
                            "Failed to read playlist output: {}", e
                        )));
                    }
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| {
        EngineError::execution_failed(format!("Failed to wait for inspector process: {}", e))
    })?;

    if is_cancelled.load(Ordering::SeqCst) {
        return Err(EngineError::new(
            EngineErrorKind::ExecutionFailed,
            "Playlist analysis cancelled by user",
        ));
    }

    if !status.success() && buffer.is_empty() {
        return Err(EngineError::execution_failed(
            "yt-dlp failed to inspect playlist URL. The playlist may be private or unsupported.",
        ));
    }

    let json_text = String::from_utf8_lossy(&buffer);
    parse_playlist_json(&json_text, url, db)
}
