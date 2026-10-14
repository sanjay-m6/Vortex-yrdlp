use chrono::Utc;
use std::sync::Arc;
use tauri::{command, AppHandle, State};
use tokio::sync::oneshot;

use crate::database::add_history_entry;
use crate::downloader::ytdlp::{analyze_url as run_analyze, run_download};
use crate::downloader::AppState;
use crate::models::{DownloadOptions, HistoryItem, MediaMetadata};

#[command]
pub async fn analyze_media_url(
    url: String,
    state: State<'_, AppState>,
) -> Result<MediaMetadata, String> {
    let custom_ytdlp = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        crate::database::load_app_settings(&conn).custom_ytdlp_path
    };

    run_analyze(&url, custom_ytdlp).await
}

#[command]
pub async fn start_media_download(
    app: AppHandle,
    state: State<'_, AppState>,
    options: DownloadOptions,
) -> Result<String, String> {
    let (custom_ytdlp, custom_ffmpeg) = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let s = crate::database::load_app_settings(&conn);
        (s.custom_ytdlp_path, s.custom_ffmpeg_path)
    };

    let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
    let download_id = options.id.clone();

    {
        let mut map = state.cancel_handles.lock().map_err(|e| e.to_string())?;
        map.insert(download_id.clone(), cancel_tx);
    }

    let cancel_handles_clone = Arc::clone(&state.cancel_handles);
    let db_clone = Arc::clone(&state.db);
    let opts_clone = options.clone();

    tokio::spawn(async move {
        let result = run_download(
            app,
            opts_clone.clone(),
            custom_ytdlp,
            custom_ffmpeg,
            cancel_rx,
        )
        .await;

        // Clean up cancel handle
        if let Ok(mut map) = cancel_handles_clone.lock() {
            map.remove(&opts_clone.id);
        }

        // Record to SQLite history
        let completed_at = Utc::now().to_rfc3339();
        let (status, final_path) = match result {
            Ok(ref path) => ("completed".to_string(), path.clone()),
            Err(ref err) => ("failed".to_string(), err.clone()),
        };

        let file_size_bytes = std::fs::metadata(&final_path).map(|m| m.len()).ok();

        let history_entry = HistoryItem {
            id: opts_clone.id,
            url: opts_clone.url,
            title: opts_clone.title,
            thumbnail: opts_clone.thumbnail,
            duration: opts_clone.duration,
            file_path: final_path,
            file_size_bytes,
            format_name: if opts_clone.is_audio_only {
                opts_clone
                    .audio_format
                    .unwrap_or_else(|| "MP3".to_string())
                    .to_uppercase()
            } else {
                opts_clone.quality_preset.to_uppercase()
            },
            is_audio: opts_clone.is_audio_only,
            completed_at,
            status,
        };

        if let Ok(conn) = db_clone.conn.lock() {
            let _ = add_history_entry(&conn, &history_entry);
        }
    });

    Ok(download_id)
}

#[command]
pub async fn cancel_media_download(id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let mut map = state.cancel_handles.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = map.remove(&id) {
        let _ = sender.send(());
        Ok(true)
    } else {
        Ok(false)
    }
}
