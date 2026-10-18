use std::cmp::Ordering as CmpOrdering;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::{oneshot, RwLock};

use chrono::Utc;
use tauri::{AppHandle, Emitter, Runtime};

use crate::database::{
    clear_completed_downloads_db, clear_failed_downloads_db, delete_download, fetch_all_downloads,
    fetch_attempts_for_download, fetch_download_by_id, get_setting, insert_or_update_download,
    record_attempt_end, record_attempt_start, set_setting, update_download_priority,
    update_download_status, update_queue_positions, DbState,
};
use crate::downloader::executor::{execute_download, DownloadEventEmitter};
use crate::downloader::manager::DownloadManager;
use crate::downloader::output::verify_output_file;
use crate::downloader::validation::{validate_output_directory, validate_url};
use crate::engine::resolver::ToolResolver;
use crate::models::{
    DownloadAttemptRecord, DownloadProgress, DownloadRequest, DownloadState, EngineError,
    MediaType, QueueItem, QueuePriority, QueueSnapshot, ToolType,
};

pub const EVENT_QUEUE_UPDATED: &str = "queue_updated";
pub const EVENT_TASK_ENQUEUED: &str = "task_enqueued";
pub const EVENT_TASK_STARTED: &str = "task_started";
pub const EVENT_TASK_PROGRESS: &str = "task_progress";
pub const EVENT_TASK_COMPLETED: &str = "task_completed";
pub const EVENT_TASK_FAILED: &str = "task_failed";
pub const EVENT_TASK_CANCELLED: &str = "task_cancelled";
pub const EVENT_TASK_RETRIED: &str = "task_retried";
pub const EVENT_QUEUE_PAUSED: &str = "queue_paused";
pub const EVENT_QUEUE_RESUMED: &str = "queue_resumed";

pub struct QueueEmitter<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> QueueEmitter<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> DownloadEventEmitter for QueueEmitter<R> {
    fn emit_event(&self, event_name: &str, payload: &DownloadProgress) {
        let _ = self.app.emit(event_name, payload);
        let _ = self.app.emit("download_progress", payload);
    }
}

struct ActiveQueueTask {
    cancel_tx: Option<oneshot::Sender<()>>,
    is_cancelled: Arc<AtomicBool>,
}

#[derive(Clone)]
pub struct QueueManager {
    db: Arc<DbState>,
    download_manager: Arc<DownloadManager>,
    items: Arc<RwLock<Vec<QueueItem>>>,
    active_handles: Arc<tokio::sync::Mutex<std::collections::HashMap<String, ActiveQueueTask>>>,
    concurrency_limit: Arc<AtomicUsize>,
    is_paused: Arc<AtomicBool>,
}

impl QueueManager {
    pub fn new(
        db: Arc<DbState>,
        download_manager: Arc<DownloadManager>,
        default_limit: usize,
    ) -> Self {
        Self {
            db,
            download_manager,
            items: Arc::new(RwLock::new(Vec::new())),
            active_handles: Arc::new(tokio::sync::Mutex::new(std::collections::HashMap::new())),
            concurrency_limit: Arc::new(AtomicUsize::new(default_limit.clamp(1, 5))),
            is_paused: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn download_manager(&self) -> &DownloadManager {
        &self.download_manager
    }

    /// Startup recovery: loads persisted tasks, reconciles interrupted downloads, restores queue order.
    pub async fn initialize(&self) {
        // 1. Load saved settings from SQLite
        {
            let conn = match self.db.conn.lock() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to acquire DB lock for queue init: {}", e);
                    return;
                }
            };

            if let Ok(Some(limit_str)) = get_setting(&conn, "concurrency_limit") {
                if let Ok(val) = limit_str.parse::<usize>() {
                    self.concurrency_limit
                        .store(val.clamp(1, 5), Ordering::SeqCst);
                }
            }

            if let Ok(Some(paused_str)) = get_setting(&conn, "queue_paused") {
                if let Ok(val) = paused_str.parse::<bool>() {
                    self.is_paused.store(val, Ordering::SeqCst);
                }
            }
        }

        // 2. Fetch all persisted downloads and reconcile non-terminal tasks
        let mut loaded_items = {
            let conn = match self.db.conn.lock() {
                Ok(c) => c,
                Err(_) => return,
            };
            fetch_all_downloads(&conn).unwrap_or_default()
        };

        for item in &mut loaded_items {
            if item.status.is_active() && item.status != DownloadState::Queued {
                // Reconcile interrupted task: check if output file actually exists and is complete
                let mut is_completed = false;
                if let Some(ref path_str) = item.output_path {
                    let p = Path::new(path_str);
                    if p.exists() && verify_output_file(p).is_ok() {
                        is_completed = true;
                    }
                }

                let conn = match self.db.conn.lock() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let now = Utc::now().to_rfc3339();
                if is_completed {
                    item.status = DownloadState::Completed;
                    item.completed_at = Some(now.clone());
                    let _ = update_download_status(
                        &conn,
                        &item.id,
                        DownloadState::Completed,
                        None,
                        item.output_path.as_deref(),
                        Some(&now),
                    );
                    let _ = record_attempt_end(
                        &conn,
                        &item.id,
                        item.attempt_count,
                        &now,
                        "completed",
                        Some(0),
                        None,
                        None,
                    );
                } else {
                    item.status = DownloadState::Failed;
                    let err_msg =
                        "Download was interrupted: the application exited before completion.";
                    item.error_message = Some(err_msg.to_string());
                    item.completed_at = Some(now.clone());
                    let _ = update_download_status(
                        &conn,
                        &item.id,
                        DownloadState::Failed,
                        Some(err_msg),
                        item.output_path.as_deref(),
                        Some(&now),
                    );
                    let _ = record_attempt_end(
                        &conn,
                        &item.id,
                        item.attempt_count,
                        &now,
                        "interrupted",
                        Some(-1),
                        Some("APP_EXITED"),
                        Some(err_msg),
                    );
                }
            }
        }

        // 3. Populate in-memory queue
        {
            let mut items_lock = self.items.write().await;
            *items_lock = loaded_items;
        }
    }

    /// Startup recovery with app handle: runs initialize, emits events, schedules next tasks.
    pub async fn initialize_with_app<R: Runtime>(&self, app: AppHandle<R>) {
        self.initialize().await;
        self.emit_queue_updated(&app).await;
        if !self.is_paused.load(Ordering::SeqCst) {
            self.schedule_next(app).await;
        }
    }

    /// Adds a new download request to the persistent queue.
    pub async fn enqueue<R: Runtime>(
        &self,
        request: DownloadRequest,
        priority: Option<QueuePriority>,
        app: AppHandle<R>,
    ) -> Result<String, EngineError> {
        validate_url(&request.webpage_url)?;
        validate_output_directory(&request.output_directory)?;

        let task_id = request
            .task_id
            .clone()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let priority = priority.unwrap_or_default();
        let now = Utc::now().to_rfc3339();

        let next_pos = {
            let items = self.items.read().await;
            // Prevent duplicate active/queued tasks
            if let Some(existing) = items.iter().find(|i| i.id == task_id) {
                if existing.status.is_active() {
                    return Err(EngineError::duplicate_process(format!(
                        "Download task '{}' is already in the queue or active",
                        task_id
                    )));
                }
            }

            items
                .iter()
                .filter(|i| i.status == DownloadState::Queued)
                .map(|i| i.queue_position)
                .max()
                .map(|p| p + 1)
                .unwrap_or(0)
        };

        let queue_item = QueueItem {
            id: task_id.clone(),
            request: request.clone(),
            status: DownloadState::Queued,
            priority,
            queue_position: next_pos,
            progress: None,
            created_at: now.clone(),
            updated_at: now.clone(),
            started_at: None,
            completed_at: None,
            error_code: None,
            error_message: None,
            output_path: None,
            downloaded_bytes: 0,
            total_bytes: None,
            attempt_count: 1,
        };

        // 1. Persist to SQLite
        {
            let conn = self.db.conn.lock().map_err(|e| {
                EngineError::io(format!("Database lock error during enqueue: {}", e))
            })?;
            insert_or_update_download(&conn, &queue_item).map_err(|e| {
                EngineError::io(format!("Failed to persist queued download: {}", e))
            })?;
            record_attempt_start(&conn, &task_id, 1, &now).map_err(|e| {
                EngineError::io(format!("Failed to record download attempt: {}", e))
            })?;
        }

        // 2. Add to in-memory items
        {
            let mut items = self.items.write().await;
            items.retain(|i| i.id != task_id);
            items.push(queue_item.clone());
        }

        // 3. Emit events
        let _ = app.emit(EVENT_TASK_ENQUEUED, &queue_item);
        self.emit_queue_updated(&app).await;

        // 4. Trigger scheduler
        self.schedule_next(app).await;

        Ok(task_id)
    }

    /// Schedules eligible queued tasks respecting concurrency limits, priority, and pause state.
    pub fn schedule_next<R: Runtime + 'static>(
        &self,
        app: AppHandle<R>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> {
        let self_clone = self.clone();
        Box::pin(async move {
            self_clone.schedule_next_internal(app).await;
        })
    }

    async fn schedule_next_internal<R: Runtime + 'static>(&self, app: AppHandle<R>) {
        if self.is_paused.load(Ordering::SeqCst) {
            return;
        }

        let limit = self.concurrency_limit.load(Ordering::SeqCst);

        // 1. Determine currently active tasks count
        let (_active_count, candidates) = {
            let items = self.items.read().await;
            let active = items
                .iter()
                .filter(|i| i.status.is_active() && i.status != DownloadState::Queued)
                .count();

            if active >= limit {
                return;
            }

            let slots_available = limit - active;

            // Filter queued tasks and sort by: priority DESC, queue_position ASC
            let mut queued: Vec<QueueItem> = items
                .iter()
                .filter(|i| i.status == DownloadState::Queued)
                .cloned()
                .collect();

            queued.sort_by(|a, b| match b.priority.cmp(&a.priority) {
                CmpOrdering::Equal => a.queue_position.cmp(&b.queue_position),
                other => other,
            });

            let to_start: Vec<QueueItem> = queued.into_iter().take(slots_available).collect();
            (active, to_start)
        };

        if candidates.is_empty() {
            return;
        }

        // 2. Fetch custom engine paths from settings
        let (custom_ytdlp, custom_ffmpeg) = {
            let conn = match self.db.conn.lock() {
                Ok(c) => c,
                Err(_) => return,
            };
            let s = crate::database::load_app_settings(&conn);
            (s.custom_ytdlp_path, s.custom_ffmpeg_path)
        };

        // 3. Dispatch candidates
        for candidate in candidates {
            let task_id = candidate.id.clone();
            let attempt_id = candidate.attempt_count;
            let request = candidate.request.clone();
            let now = Utc::now().to_rfc3339();

            // Transition candidate to Starting in memory and DB
            {
                let mut items = self.items.write().await;
                if let Some(item) = items.iter_mut().find(|i| i.id == task_id) {
                    item.status = DownloadState::Starting;
                    item.started_at = Some(now.clone());
                }
            }

            {
                if let Ok(conn) = self.db.conn.lock() {
                    let _ = update_download_status(
                        &conn,
                        &task_id,
                        DownloadState::Starting,
                        None,
                        None,
                        None,
                    );
                }
            }

            let _ = app.emit(EVENT_TASK_STARTED, &candidate);
            self.emit_queue_updated(&app).await;

            // Setup cancellation handles
            let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
            let is_cancelled = Arc::new(AtomicBool::new(false));

            {
                let mut handles = self.active_handles.lock().await;
                handles.insert(
                    task_id.clone(),
                    ActiveQueueTask {
                        cancel_tx: Some(cancel_tx),
                        is_cancelled: Arc::clone(&is_cancelled),
                    },
                );
            }

            // Spawn execution worker
            let self_items = Arc::clone(&self.items);
            let self_active = Arc::clone(&self.active_handles);
            let db_ref = Arc::clone(&self.db);
            let app_clone = app.clone();
            let emitter = Arc::new(QueueEmitter::new(app.clone()));
            let custom_ytdlp_c = custom_ytdlp.clone();
            let custom_ffmpeg_c = custom_ffmpeg.clone();
            let task_id_clone = task_id.clone();
            let self_clone = self.clone();

            tokio::spawn(async move {
                let res = execute_download(
                    request,
                    task_id_clone.clone(),
                    attempt_id,
                    custom_ytdlp_c,
                    custom_ffmpeg_c,
                    emitter,
                    cancel_rx,
                    is_cancelled,
                )
                .await;

                let completion_time = Utc::now().to_rfc3339();

                // Reconcile completed / failed / cancelled state
                match res {
                    Ok(dest_path) => {
                        {
                            let mut items = self_items.write().await;
                            if let Some(item) = items.iter_mut().find(|i| i.id == task_id_clone) {
                                item.status = DownloadState::Completed;
                                item.output_path = Some(dest_path.clone());
                                item.completed_at = Some(completion_time.clone());
                                item.error_message = None;
                            }
                        }

                        if let Ok(conn) = db_ref.conn.lock() {
                            let _ = update_download_status(
                                &conn,
                                &task_id_clone,
                                DownloadState::Completed,
                                None,
                                Some(&dest_path),
                                Some(&completion_time),
                            );
                            let _ = record_attempt_end(
                                &conn,
                                &task_id_clone,
                                attempt_id,
                                &completion_time,
                                "completed",
                                Some(0),
                                None,
                                None,
                            );
                        }

                        let _ = app_clone.emit(
                            EVENT_TASK_COMPLETED,
                            &serde_json::json!({
                                "taskId": task_id_clone,
                                "outputPath": dest_path
                            }),
                        );
                    }
                    Err(err) => {
                        let is_user_cancel = err.message.contains("cancelled by user");
                        let final_state = if is_user_cancel {
                            DownloadState::Cancelled
                        } else {
                            DownloadState::Failed
                        };

                        {
                            let mut items = self_items.write().await;
                            if let Some(item) = items.iter_mut().find(|i| i.id == task_id_clone) {
                                item.status = final_state;
                                item.completed_at = Some(completion_time.clone());
                                item.error_message = Some(err.message.clone());
                            }
                        }

                        if let Ok(conn) = db_ref.conn.lock() {
                            let _ = update_download_status(
                                &conn,
                                &task_id_clone,
                                final_state,
                                Some(&err.message),
                                None,
                                Some(&completion_time),
                            );
                            let _ = record_attempt_end(
                                &conn,
                                &task_id_clone,
                                attempt_id,
                                &completion_time,
                                if is_user_cancel {
                                    "cancelled"
                                } else {
                                    "failed"
                                },
                                Some(-1),
                                Some("DOWNLOAD_ERROR"),
                                Some(&err.message),
                            );
                        }

                        let evt = if is_user_cancel {
                            EVENT_TASK_CANCELLED
                        } else {
                            EVENT_TASK_FAILED
                        };
                        let _ = app_clone.emit(
                            evt,
                            &serde_json::json!({
                                "taskId": task_id_clone,
                                "error": err.message
                            }),
                        );
                    }
                }

                // Cleanup active handle
                {
                    let mut handles = self_active.lock().await;
                    handles.remove(&task_id_clone);
                }

                // Schedule next eligible queued item
                let _ = app_clone.emit(EVENT_QUEUE_UPDATED, &());
                tauri::async_runtime::spawn(async move {
                    self_clone.schedule_next(app_clone).await;
                });
            });
        }
    }

    /// Cancels an active download task cleanly using child process termination.
    pub async fn cancel_download<R: Runtime>(
        &self,
        task_id: &str,
        app: AppHandle<R>,
    ) -> Result<bool, EngineError> {
        let mut handles = self.active_handles.lock().await;
        if let Some(handle) = handles.get_mut(task_id) {
            handle.is_cancelled.store(true, Ordering::SeqCst);
            if let Some(tx) = handle.cancel_tx.take() {
                let _ = tx.send(());
            }

            {
                let mut items = self.items.write().await;
                if let Some(item) = items.iter_mut().find(|i| i.id == task_id) {
                    if item.status.can_cancel() {
                        item.status = DownloadState::Cancelling;
                    }
                }
            }

            self.emit_queue_updated(&app).await;
            Ok(true)
        } else {
            // Check if task exists but is queued
            let mut items = self.items.write().await;
            if let Some(item) = items.iter_mut().find(|i| i.id == task_id) {
                if item.status == DownloadState::Queued {
                    item.status = DownloadState::Cancelled;
                    item.completed_at = Some(Utc::now().to_rfc3339());
                    if let Ok(conn) = self.db.conn.lock() {
                        let _ = update_download_status(
                            &conn,
                            task_id,
                            DownloadState::Cancelled,
                            Some("Cancelled while queued"),
                            None,
                            item.completed_at.as_deref(),
                        );
                    }
                    drop(items);
                    self.emit_queue_updated(&app).await;
                    return Ok(true);
                }
            }
            Ok(false)
        }
    }

    /// Returns the count of currently executing tasks.
    pub async fn active_downloads_count(&self) -> usize {
        let handles = self.active_handles.lock().await;
        handles.len()
    }

    /// Synchronously checks if there are active download handles (non-blocking).
    pub fn has_active_downloads_sync(&self) -> bool {
        if let Ok(handles) = self.active_handles.try_lock() {
            !handles.is_empty()
        } else {
            true // assume active if locked to be safe against accidental closure
        }
    }

    /// Application shutdown handler: safely cancels running child processes
    /// and marks them with an accurate interrupted state in SQLite so they can be resumed/retried.
    pub async fn shutdown(&self) {
        let mut handles = self.active_handles.lock().await;
        let now = Utc::now().to_rfc3339();

        for (task_id, handle) in handles.drain() {
            handle.is_cancelled.store(true, Ordering::SeqCst);
            if let Some(tx) = handle.cancel_tx {
                let _ = tx.send(());
            }

            if let Ok(conn) = self.db.conn.lock() {
                let _ = update_download_status(
                    &conn,
                    &task_id,
                    DownloadState::Failed,
                    Some("Download was interrupted: the application exited before completion."),
                    None,
                    Some(&now),
                );
            }
        }

        let mut items = self.items.write().await;
        for item in items.iter_mut() {
            if item.status.is_active() && item.status != DownloadState::Queued {
                item.status = DownloadState::Failed;
                item.error_message = Some(
                    "Download was interrupted: the application exited before completion."
                        .to_string(),
                );
                item.completed_at = Some(now.clone());
            }
        }
    }

    /// Retries a previously failed or cancelled task.
    pub async fn retry_download<R: Runtime>(
        &self,
        task_id: &str,
        app: AppHandle<R>,
    ) -> Result<String, EngineError> {
        // Ensure no active process is currently running for this task
        {
            let handles = self.active_handles.lock().await;
            if let Some(h) = handles.get(task_id) {
                if !h.is_cancelled.load(Ordering::SeqCst) {
                    return Err(EngineError::duplicate_process(format!(
                        "Task '{}' is currently running and cannot be retried",
                        task_id
                    )));
                }
            }
        }

        // Clean up any stale cancellation handle
        {
            let mut handles = self.active_handles.lock().await;
            handles.remove(task_id);
        }

        let (request, next_attempt, _next_pos) = {
            let mut items = self.items.write().await;
            let item_pos = items.iter().position(|i| i.id == task_id);

            let idx = match item_pos {
                Some(i) => i,
                None => {
                    // Item not in memory: load from database
                    let db_item = {
                        let conn = self.db.conn.lock().map_err(|e| {
                            EngineError::io(format!("Database error during retry lookup: {}", e))
                        })?;
                        fetch_download_by_id(&conn, task_id).map_err(|e| {
                            EngineError::io(format!("Failed to fetch task from database: {}", e))
                        })?
                    };

                    if let Some(mut loaded) = db_item {
                        loaded.status = DownloadState::Queued;
                        items.push(loaded);
                        items.len() - 1
                    } else {
                        return Err(EngineError::not_found(format!(
                            "Task '{}' not found in queue or database",
                            task_id
                        )));
                    }
                }
            };

            if items[idx].status.is_active() && items[idx].status != DownloadState::Queued {
                return Err(EngineError::duplicate_process(format!(
                    "Task '{}' is currently active and cannot be retried",
                    task_id
                )));
            }

            let max_pos = items
                .iter()
                .filter(|i| i.status == DownloadState::Queued && i.id != task_id)
                .map(|i| i.queue_position)
                .max()
                .map(|p| p + 1)
                .unwrap_or(0);

            let next_attempt = items[idx].attempt_count + 1;
            let request = items[idx].request.clone();

            let item = &mut items[idx];
            item.status = DownloadState::Queued;
            item.attempt_count = next_attempt;
            item.queue_position = max_pos;
            item.started_at = None;
            item.completed_at = None;
            item.error_message = None;
            item.progress = None;

            (request, next_attempt, max_pos)
        };

        // Revalidate URL and output destination before retrying
        validate_url(&request.webpage_url)?;
        validate_output_directory(&request.output_directory)?;

        // Revalidate tools: yt-dlp binary and ffmpeg if audio
        let (custom_ytdlp, custom_ffmpeg) = {
            let conn = match self.db.conn.lock() {
                Ok(c) => c,
                Err(_) => return Err(EngineError::io("Database lock failed")),
            };
            let s = crate::database::load_app_settings(&conn);
            (s.custom_ytdlp_path, s.custom_ffmpeg_path)
        };

        if ToolResolver::resolve_tool(ToolType::YtDlp, custom_ytdlp.as_deref()).is_none() {
            return Err(EngineError::not_found(
                "yt-dlp executable could not be resolved for retry",
            ));
        }
        if request.media_type == MediaType::Audio
            && ToolResolver::resolve_tool(ToolType::Ffmpeg, custom_ffmpeg.as_deref()).is_none()
        {
            return Err(EngineError::not_found(
                "FFmpeg executable could not be resolved for audio retry",
            ));
        }

        let now = Utc::now().to_rfc3339();

        // 1. Record new attempt in SQLite
        {
            let conn = self
                .db
                .conn
                .lock()
                .map_err(|e| EngineError::io(format!("Database error during retry: {}", e)))?;
            record_attempt_start(&conn, task_id, next_attempt, &now)
                .map_err(|e| EngineError::io(format!("Failed to record retry attempt: {}", e)))?;
            update_download_status(&conn, task_id, DownloadState::Queued, None, None, None)
                .map_err(|e| EngineError::io(format!("Failed to update status on retry: {}", e)))?;
        }

        let _ = app.emit(
            EVENT_TASK_RETRIED,
            &serde_json::json!({
                "taskId": task_id,
                "attempt": next_attempt
            }),
        );
        self.emit_queue_updated(&app).await;

        // 2. Schedule next
        self.schedule_next(app).await;

        Ok(task_id.to_string())
    }

    /// Pauses queue scheduling (active downloads continue, no new tasks start).
    pub async fn pause_queue<R: Runtime>(&self, app: AppHandle<R>) -> Result<bool, EngineError> {
        self.is_paused.store(true, Ordering::SeqCst);
        if let Ok(conn) = self.db.conn.lock() {
            let _ = set_setting(&conn, "queue_paused", "true");
        }
        let _ = app.emit(EVENT_QUEUE_PAUSED, &serde_json::json!({ "isPaused": true }));
        self.emit_queue_updated(&app).await;
        Ok(true)
    }

    /// Resumes queue scheduling and starts eligible queued downloads.
    pub async fn resume_queue<R: Runtime>(&self, app: AppHandle<R>) -> Result<bool, EngineError> {
        self.is_paused.store(false, Ordering::SeqCst);
        if let Ok(conn) = self.db.conn.lock() {
            let _ = set_setting(&conn, "queue_paused", "false");
        }
        let _ = app.emit(
            EVENT_QUEUE_RESUMED,
            &serde_json::json!({ "isPaused": false }),
        );
        self.emit_queue_updated(&app).await;
        self.schedule_next(app).await;
        Ok(false)
    }

    /// Sets the maximum concurrent downloads limit (1 to 5).
    pub async fn set_concurrency_limit<R: Runtime>(
        &self,
        limit: usize,
        app: AppHandle<R>,
    ) -> Result<usize, EngineError> {
        let clamped = limit.clamp(1, 5);
        self.concurrency_limit.store(clamped, Ordering::SeqCst);
        if let Ok(conn) = self.db.conn.lock() {
            let _ = set_setting(&conn, "concurrency_limit", &clamped.to_string());
        }
        self.emit_queue_updated(&app).await;
        self.schedule_next(app).await;
        Ok(clamped)
    }

    /// Changes task priority (Low, Normal, High).
    pub async fn set_task_priority<R: Runtime>(
        &self,
        task_id: &str,
        priority: QueuePriority,
        app: AppHandle<R>,
    ) -> Result<(), EngineError> {
        {
            let mut items = self.items.write().await;
            let item = items
                .iter_mut()
                .find(|i| i.id == task_id)
                .ok_or_else(|| EngineError::not_found(format!("Task '{}' not found", task_id)))?;
            item.priority = priority;
        }

        if let Ok(conn) = self.db.conn.lock() {
            let _ = update_download_priority(&conn, task_id, priority);
        }

        self.emit_queue_updated(&app).await;
        self.schedule_next(app).await;
        Ok(())
    }

    /// Moves a queued task up, down, or to top.
    pub async fn reorder_queued_task<R: Runtime>(
        &self,
        task_id: &str,
        direction: &str,
        app: AppHandle<R>,
    ) -> Result<(), EngineError> {
        let mut updates: Vec<(String, usize)> = Vec::new();

        {
            let mut items = self.items.write().await;

            // Collect only pending queued items sorted by current queue_position
            let mut queued_indices: Vec<usize> = items
                .iter()
                .enumerate()
                .filter(|(_, item)| item.status == DownloadState::Queued)
                .map(|(idx, _)| idx)
                .collect();

            queued_indices.sort_by_key(|&idx| items[idx].queue_position);

            let pos_in_queued = queued_indices
                .iter()
                .position(|&idx| items[idx].id == task_id)
                .ok_or_else(|| {
                    EngineError::invalid_path(format!(
                        "Task '{}' is not currently in pending queue",
                        task_id
                    ))
                })?;

            match direction.to_lowercase().as_str() {
                "up" => {
                    if pos_in_queued > 0 {
                        queued_indices.swap(pos_in_queued, pos_in_queued - 1);
                    }
                }
                "down" => {
                    if pos_in_queued + 1 < queued_indices.len() {
                        queued_indices.swap(pos_in_queued, pos_in_queued + 1);
                    }
                }
                "top" => {
                    let item_idx = queued_indices.remove(pos_in_queued);
                    queued_indices.insert(0, item_idx);
                }
                _ => {
                    return Err(EngineError::invalid_path(format!(
                        "Invalid direction '{}'",
                        direction
                    )));
                }
            }

            // Re-assign normalized queue positions
            for (new_pos, &item_idx) in queued_indices.iter().enumerate() {
                items[item_idx].queue_position = new_pos;
                updates.push((items[item_idx].id.clone(), new_pos));
            }
        }

        // Persist new positions transactionally
        if !updates.is_empty() {
            if let Ok(conn) = self.db.conn.lock() {
                let _ = update_queue_positions(&conn, &updates);
            }
        }

        self.emit_queue_updated(&app).await;
        Ok(())
    }

    /// Removes a pending download task from the queue.
    pub async fn remove_queued_download<R: Runtime>(
        &self,
        task_id: &str,
        app: AppHandle<R>,
    ) -> Result<(), EngineError> {
        let mut updates: Vec<(String, usize)> = Vec::new();

        {
            let mut items = self.items.write().await;
            let item_opt = items.iter().find(|i| i.id == task_id);
            if let Some(item) = item_opt {
                if item.status.is_active() && item.status != DownloadState::Queued {
                    return Err(EngineError::execution_failed(
                        "Cannot remove an actively downloading task. Please cancel it instead.",
                    ));
                }
            } else {
                return Err(EngineError::not_found(format!(
                    "Task '{}' not found",
                    task_id
                )));
            }

            items.retain(|i| i.id != task_id);

            // Re-index remaining queued items
            let mut queued_items: Vec<&mut QueueItem> = items
                .iter_mut()
                .filter(|i| i.status == DownloadState::Queued)
                .collect();

            queued_items.sort_by_key(|i| i.queue_position);

            for (idx, item) in queued_items.into_iter().enumerate() {
                item.queue_position = idx;
                updates.push((item.id.clone(), idx));
            }
        }

        if let Ok(conn) = self.db.conn.lock() {
            let _ = delete_download(&conn, task_id);
            if !updates.is_empty() {
                let _ = update_queue_positions(&conn, &updates);
            }
        }

        self.emit_queue_updated(&app).await;
        Ok(())
    }

    /// Clears completed downloads from the queue and database.
    pub async fn clear_completed<R: Runtime>(&self, app: AppHandle<R>) {
        {
            let mut items = self.items.write().await;
            items.retain(|i| i.status != DownloadState::Completed);
        }

        if let Ok(conn) = self.db.conn.lock() {
            let _ = clear_completed_downloads_db(&conn);
        }

        self.emit_queue_updated(&app).await;
    }

    /// Clears failed and cancelled downloads.
    pub async fn clear_failed<R: Runtime>(&self, app: AppHandle<R>) {
        {
            let mut items = self.items.write().await;
            items.retain(|i| {
                i.status != DownloadState::Failed && i.status != DownloadState::Cancelled
            });
        }

        if let Ok(conn) = self.db.conn.lock() {
            let _ = clear_failed_downloads_db(&conn);
        }

        self.emit_queue_updated(&app).await;
    }

    /// Returns a complete snapshot of current queue state and task items.
    pub async fn get_snapshot(&self) -> QueueSnapshot {
        let items = self.items.read().await;
        let mut active = 0;
        let mut queued = 0;
        let mut completed = 0;
        let mut failed = 0;

        for item in items.iter() {
            match item.status {
                DownloadState::Queued => queued += 1,
                DownloadState::Starting
                | DownloadState::Downloading
                | DownloadState::Processing
                | DownloadState::Cancelling => active += 1,
                DownloadState::Completed => completed += 1,
                DownloadState::Failed | DownloadState::Cancelled => failed += 1,
            }
        }

        QueueSnapshot {
            items: items.clone(),
            is_paused: self.is_paused.load(Ordering::SeqCst),
            concurrency_limit: self.concurrency_limit.load(Ordering::SeqCst),
            active_count: active,
            queued_count: queued,
            completed_count: completed,
            failed_count: failed,
        }
    }

    /// Fetches all historical attempt records for a specific download.
    pub fn get_download_attempts(&self, download_id: &str) -> Vec<DownloadAttemptRecord> {
        if let Ok(conn) = self.db.conn.lock() {
            fetch_attempts_for_download(&conn, download_id).unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    /// Emits `queue_updated` with current snapshot.
    pub async fn emit_queue_updated<R: Runtime>(&self, app: &AppHandle<R>) {
        let snapshot = self.get_snapshot().await;
        let _ = app.emit(EVENT_QUEUE_UPDATED, &snapshot);
    }
}
