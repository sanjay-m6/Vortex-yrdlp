use std::path::PathBuf;
use tauri::{command, AppHandle, Emitter, State};

use crate::downloader::AppState;
use crate::models::{DownloadRequest, OverwritePolicy, PlaylistEnqueueRequest, PlaylistInfo};
use crate::playlist::analyzer::inspect_playlist;
use crate::playlist::validation::sanitize_subfolder_name;

pub const EVENT_PLAYLIST_ANALYSIS_STARTED: &str = "playlist_analysis_started";
pub const EVENT_PLAYLIST_ANALYSIS_COMPLETED: &str = "playlist_analysis_completed";
pub const EVENT_PLAYLIST_ANALYSIS_FAILED: &str = "playlist_analysis_failed";
pub const EVENT_PLAYLIST_ANALYSIS_CANCELLED: &str = "playlist_analysis_cancelled";

#[command]
pub async fn analyze_playlist(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PlaylistInfo, String> {
    let custom_ytdlp = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let s = crate::database::load_app_settings(&conn);
        s.custom_ytdlp_path
    };

    let (cancel_rx, is_cancelled) = state.playlist_manager.register_analysis(&url).await;

    let _ = app.emit(
        EVENT_PLAYLIST_ANALYSIS_STARTED,
        &serde_json::json!({ "url": &url }),
    );

    let result = inspect_playlist(
        &url,
        custom_ytdlp.as_deref(),
        cancel_rx,
        is_cancelled,
        Some(&state.db),
    )
    .await;

    state.playlist_manager.unregister_analysis(&url).await;

    match result {
        Ok(info) => {
            let _ = app.emit(EVENT_PLAYLIST_ANALYSIS_COMPLETED, &info);
            Ok(info)
        }
        Err(err) => {
            let is_cancelled_err = err.message.contains("cancelled by user");
            let event_name = if is_cancelled_err {
                EVENT_PLAYLIST_ANALYSIS_CANCELLED
            } else {
                EVENT_PLAYLIST_ANALYSIS_FAILED
            };

            let _ = app.emit(
                event_name,
                &serde_json::json!({
                    "url": &url,
                    "error": &err.message
                }),
            );

            Err(err.message)
        }
    }
}

#[command]
pub async fn cancel_playlist_analysis(
    url: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    Ok(state.playlist_manager.cancel_analysis(&url).await)
}

#[command]
pub async fn enqueue_playlist_selection(
    request: PlaylistEnqueueRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let final_dir = if request.create_subfolder {
        let sub = sanitize_subfolder_name(&request.playlist_title);
        PathBuf::from(&request.output_directory)
            .join(sub)
            .to_string_lossy()
            .to_string()
    } else {
        request.output_directory.clone()
    };

    let mut enqueued_count = 0;

    for entry in request.selected_entries {
        // Skip unavailable entries
        if !entry.is_available || entry.url.is_empty() {
            continue;
        }

        let download_req = DownloadRequest {
            task_id: Some(format!("pl_{}_{}", request.playlist_id, entry.id)),
            webpage_url: entry.url,
            format_selection: request.format_selection.clone(),
            output_directory: final_dir.clone(),
            filename_template: None,
            media_type: request.media_type,
            overwrite_policy: OverwritePolicy::Rename,
            title: Some(entry.title),
            uploader: entry.uploader,
            thumbnail: entry.thumbnail,
            duration: entry.duration,
            preset_id: None,
            settings_snapshot: None,
        };

        match state
            .queue_manager
            .enqueue(download_req, request.priority, app.clone())
            .await
        {
            Ok(_) => enqueued_count += 1,
            Err(e) => {
                // If it's a duplicate already in queue, continue
                eprintln!("Skipped enqueueing item: {}", e.message);
            }
        }
    }

    Ok(enqueued_count)
}
