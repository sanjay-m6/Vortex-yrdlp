use std::collections::HashMap;
use tauri::{command, AppHandle, Emitter, State};

use crate::batch::deduplication::validate_and_deduplicate_batch;
use crate::database::fetch_all_downloads;
use crate::downloader::AppState;
use crate::models::{BatchEnqueueRequest, BatchValidationResult, DownloadRequest, OverwritePolicy};

pub const EVENT_BATCH_VALIDATION_COMPLETED: &str = "batch_validation_completed";
pub const EVENT_BATCH_ENQUEUE_COMPLETED: &str = "batch_enqueue_completed";

#[command]
pub async fn validate_batch_urls(
    urls_text: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<BatchValidationResult, String> {
    let result = validate_and_deduplicate_batch(&urls_text, Some(&state.db));
    let _ = app.emit(EVENT_BATCH_VALIDATION_COMPLETED, &result);
    Ok(result)
}

#[command]
pub async fn import_batch_file(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<BatchValidationResult>, String> {
    #[cfg(not(target_os = "android"))]
    {
        let file = rfd::AsyncFileDialog::new()
            .set_title("Select Text File with Media URLs")
            .add_filter("Text Files", &["txt", "list", "urls"])
            .pick_file()
            .await;

        let handle = match file {
            Some(h) => h,
            None => return Ok(None),
        };

        let bytes = handle.read().await;
        // Limit to 5MB
        if bytes.len() > 5 * 1024 * 1024 {
            return Err("Imported file is too large (maximum 5MB)".to_string());
        }

        let text = String::from_utf8_lossy(&bytes);
        let result = validate_and_deduplicate_batch(&text, Some(&state.db));
        let _ = app.emit(EVENT_BATCH_VALIDATION_COMPLETED, &result);
        Ok(Some(result))
    }
    #[cfg(target_os = "android")]
    {
        let _ = (app, state);
        Ok(None)
    }
}

#[command]
pub async fn enqueue_batch_selection(
    request: BatchEnqueueRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let mut enqueued = 0;

    for url in request.urls {
        let trimmed = url.trim();
        if trimmed.is_empty() {
            continue;
        }

        let download_req = DownloadRequest {
            task_id: None,
            webpage_url: trimmed.to_string(),
            format_selection: request.format_selection.clone(),
            output_directory: request.output_directory.clone(),
            filename_template: None,
            media_type: request.media_type,
            overwrite_policy: OverwritePolicy::Rename,
            title: request.source_group_title.clone(),
            uploader: None,
            thumbnail: None,
            duration: None,
            preset_id: None,
            settings_snapshot: None,
        };

        match state
            .queue_manager
            .enqueue(download_req, request.priority, app.clone())
            .await
        {
            Ok(_) => enqueued += 1,
            Err(e) => {
                eprintln!("Skipped enqueueing batch item: {}", e.message);
            }
        }
    }

    let _ = app.emit(
        EVENT_BATCH_ENQUEUE_COMPLETED,
        &serde_json::json!({ "enqueuedCount": enqueued }),
    );

    Ok(enqueued)
}

#[command]
pub async fn get_existing_media_status(
    urls: Vec<String>,
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let all = fetch_all_downloads(&conn).unwrap_or_default();

    let mut map = HashMap::new();
    for url in urls {
        if let Some(item) = all.iter().find(|d| d.request.webpage_url == url) {
            map.insert(url, format!("{:?}", item.status).to_lowercase());
        } else {
            map.insert(url, "none".to_string());
        }
    }

    Ok(map)
}
