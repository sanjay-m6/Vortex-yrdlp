use tauri::{command, AppHandle, State};

use crate::downloader::AppState;
use crate::models::{
    DownloadAttemptRecord, DownloadRequest, QueueItem, QueuePriority, QueueSnapshot,
};

#[command]
pub async fn enqueue_download(
    request: DownloadRequest,
    priority: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let p = priority.map(|s| QueuePriority::from_str(&s));
    state
        .queue_manager
        .enqueue(request, p, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn start_download(
    request: DownloadRequest,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .queue_manager
        .enqueue(request, None, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn cancel_download(
    task_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .queue_manager
        .cancel_download(&task_id, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn retry_download(
    task_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state
        .queue_manager
        .retry_download(&task_id, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn remove_queued_download(
    task_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .queue_manager
        .remove_queued_download(&task_id, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn reorder_download(
    task_id: String,
    direction: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .queue_manager
        .reorder_queued_task(&task_id, &direction, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn set_download_priority(
    task_id: String,
    priority: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let p = QueuePriority::from_str(&priority);
    state
        .queue_manager
        .set_task_priority(&task_id, p, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn pause_queue(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .queue_manager
        .pause_queue(app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn resume_queue(app: AppHandle, state: State<'_, AppState>) -> Result<bool, String> {
    state
        .queue_manager
        .resume_queue(app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn set_concurrency_limit(
    limit: usize,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    state
        .queue_manager
        .set_concurrency_limit(limit, app)
        .await
        .map_err(|e| e.message)
}

#[command]
pub async fn get_concurrency_limit(state: State<'_, AppState>) -> Result<usize, String> {
    let snap = state.queue_manager.get_snapshot().await;
    Ok(snap.concurrency_limit)
}

#[command]
pub async fn get_queue_snapshot(state: State<'_, AppState>) -> Result<QueueSnapshot, String> {
    Ok(state.queue_manager.get_snapshot().await)
}

#[command]
pub async fn get_download_status(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<Option<QueueItem>, String> {
    let snap = state.queue_manager.get_snapshot().await;
    Ok(snap.items.into_iter().find(|i| i.id == task_id))
}

#[command]
pub async fn list_downloads(state: State<'_, AppState>) -> Result<Vec<QueueItem>, String> {
    let snap = state.queue_manager.get_snapshot().await;
    Ok(snap.items)
}

#[command]
pub async fn clear_completed_downloads(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.queue_manager.clear_completed(app).await;
    Ok(())
}

#[command]
pub async fn clear_failed_downloads(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.queue_manager.clear_failed(app).await;
    Ok(())
}

#[command]
pub async fn get_task_attempts(
    task_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<DownloadAttemptRecord>, String> {
    Ok(state.queue_manager.get_download_attempts(&task_id))
}

#[command]
pub async fn open_downloaded_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("File path is empty".to_string());
    }

    #[cfg(target_os = "windows")]
    let clean = trimmed.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let clean = trimmed.to_string();

    let mut direct_path = std::path::PathBuf::from(&clean);

    // If direct path doesn't exist, check if it's a task ID or if recorded in database
    if !direct_path.exists() {
        if let Ok(conn) = state.db.conn.lock() {
            if let Ok(Some(item)) = crate::database::fetch_download_by_id(&conn, trimmed) {
                if let Some(ref p_str) = item.output_path {
                    #[cfg(target_os = "windows")]
                    let cand = std::path::PathBuf::from(p_str.replace('/', "\\"));
                    #[cfg(not(target_os = "windows"))]
                    let cand = std::path::PathBuf::from(p_str);
                    if cand.exists() {
                        direct_path = cand;
                    }
                }
            }
        }
    }

    if !direct_path.exists() {
        return Err(format!("File does not exist on disk: {}", clean));
    }

    if !direct_path.is_file() {
        return Err(format!("Target is not a regular file: {}", clean));
    }

    open::that_detached(&direct_path).map_err(|e| format!("Failed to open file: {}", e))
}

#[command]
pub async fn open_download_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".to_string());
    }

    #[cfg(target_os = "windows")]
    let clean = trimmed.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let clean = trimmed.to_string();

    let mut direct_path = std::path::PathBuf::from(&clean);

    // If direct path doesn't exist, check if it's a task ID
    if !direct_path.exists() {
        if let Ok(conn) = state.db.conn.lock() {
            if let Ok(Some(item)) = crate::database::fetch_download_by_id(&conn, trimmed) {
                if let Some(ref p_str) = item.output_path {
                    #[cfg(target_os = "windows")]
                    let p = std::path::PathBuf::from(p_str.replace('/', "\\"));
                    #[cfg(not(target_os = "windows"))]
                    let p = std::path::PathBuf::from(p_str);

                    if p.exists() {
                        direct_path = p;
                    } else if let Some(parent) = p.parent() {
                        if parent.exists() {
                            direct_path = parent.to_path_buf();
                        }
                    }
                } else {
                    let out_dir = std::path::PathBuf::from(&item.request.output_directory);
                    if out_dir.exists() {
                        direct_path = out_dir;
                    }
                }
            }
        }
    }

    if !direct_path.exists() {
        return Err(format!("File or folder does not exist: {}", clean));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let clean_str = direct_path.to_string_lossy().replace('/', "\\");
        if direct_path.is_file() {
            let status = std::process::Command::new("explorer.exe")
                .raw_arg(format!("/select,\"{}\"", clean_str))
                .spawn();
            if status.is_ok() {
                return Ok(());
            }
        }

        let dir = if direct_path.is_dir() {
            clean_str
        } else {
            direct_path
                .parent()
                .map(|p| p.to_string_lossy().replace('/', "\\"))
                .unwrap_or(clean_str)
        };
        let status = std::process::Command::new("explorer.exe")
            .raw_arg(format!("\"{}\"", dir))
            .spawn();
        if status.is_ok() {
            return Ok(());
        }
        open::that_detached(dir).map_err(|e| format!("Failed to open folder: {}", e))
    }

    #[cfg(target_os = "macos")]
    {
        if direct_path.is_file() {
            let _ = std::process::Command::new("open")
                .args(["-R", &direct_path.to_string_lossy()])
                .spawn();
            return Ok(());
        }
        let dir = if direct_path.is_dir() {
            &direct_path
        } else {
            direct_path.parent().unwrap_or(&direct_path)
        };
        open::that_detached(dir).map_err(|e| format!("Failed to open folder: {}", e))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let dir = if direct_path.is_dir() {
            &direct_path
        } else {
            direct_path.parent().unwrap_or(&direct_path)
        };
        open::that_detached(dir).map_err(|e| format!("Failed to open folder: {}", e))
    }
}

#[command]
pub async fn choose_download_directory() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Download Directory")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}
