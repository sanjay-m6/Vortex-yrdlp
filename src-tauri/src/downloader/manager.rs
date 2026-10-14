use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{oneshot, RwLock, Semaphore};

use chrono::Utc;
use tauri::AppHandle;

use crate::downloader::executor::{execute_download, TauriDownloadEmitter};
use crate::models::{DownloadProgress, DownloadRequest, DownloadState, DownloadTask, EngineError};

pub struct ActiveAttempt {
    pub attempt_id: u32,
    pub cancel_tx: Option<oneshot::Sender<()>>,
    pub is_cancelled: Arc<AtomicBool>,
}

pub struct DownloadManager {
    tasks: Arc<RwLock<HashMap<String, DownloadTask>>>,
    task_order: Arc<RwLock<Vec<String>>>,
    active_attempts: Arc<tokio::sync::Mutex<HashMap<String, ActiveAttempt>>>,
    semaphore: Arc<Semaphore>,
}

impl Default for DownloadManager {
    fn default() -> Self {
        Self::new(3)
    }
}

impl DownloadManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            tasks: Arc::new(RwLock::new(HashMap::new())),
            task_order: Arc::new(RwLock::new(Vec::new())),
            active_attempts: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    /// Registers and starts a new media download.
    pub async fn start_download<R: tauri::Runtime>(
        &self,
        request: DownloadRequest,
        app: AppHandle<R>,
        custom_ytdlp: Option<String>,
        custom_ffmpeg: Option<String>,
    ) -> Result<String, EngineError> {
        let task_id = request
            .task_id
            .clone()
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        let attempt_id = 1;

        // 1. Prevent duplicate registration
        {
            let tasks = self.tasks.read().await;
            if let Some(existing) = tasks.get(&task_id) {
                if existing.state.is_active() {
                    return Err(EngineError::duplicate_process(format!(
                        "Download task with ID '{}' is already active",
                        task_id
                    )));
                }
            }
        }

        // 2. Initialize task in central registry
        let initial_progress = DownloadProgress {
            task_id: task_id.clone(),
            attempt_id,
            state: DownloadState::Queued,
            stage: "Queued for download...".to_string(),
            ..Default::default()
        };

        let task = DownloadTask {
            id: task_id.clone(),
            attempt_id,
            request: request.clone(),
            state: DownloadState::Queued,
            progress: initial_progress,
            output_path: None,
            error: None,
            created_at: Utc::now().to_rfc3339(),
            started_at: None,
            completed_at: None,
        };

        {
            let mut tasks = self.tasks.write().await;
            tasks.insert(task_id.clone(), task);

            let mut order = self.task_order.write().await;
            if !order.contains(&task_id) {
                order.push(task_id.clone());
            }
        }

        // 3. Setup active attempt cancellation handle
        let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
        let is_cancelled = Arc::new(AtomicBool::new(false));

        {
            let mut attempts = self.active_attempts.lock().await;
            attempts.insert(
                task_id.clone(),
                ActiveAttempt {
                    attempt_id,
                    cancel_tx: Some(cancel_tx),
                    is_cancelled: Arc::clone(&is_cancelled),
                },
            );
        }

        // 4. Spawn background worker with concurrency semaphore
        let tasks_ref = Arc::clone(&self.tasks);
        let active_attempts_ref = Arc::clone(&self.active_attempts);
        let sem = Arc::clone(&self.semaphore);
        let task_id_clone = task_id.clone();
        let emitter = Arc::new(TauriDownloadEmitter::new(app));

        tokio::spawn(async move {
            let _permit = sem.acquire().await;

            // Check if cancelled while waiting in queue
            if is_cancelled.load(Ordering::SeqCst) {
                let mut tasks = tasks_ref.write().await;
                if let Some(t) = tasks.get_mut(&task_id_clone) {
                    t.state = DownloadState::Cancelled;
                    t.completed_at = Some(Utc::now().to_rfc3339());
                }
                let mut attempts = active_attempts_ref.lock().await;
                attempts.remove(&task_id_clone);
                return;
            }

            // Update task to Starting
            {
                let mut tasks = tasks_ref.write().await;
                if let Some(t) = tasks.get_mut(&task_id_clone) {
                    t.state = DownloadState::Starting;
                    t.started_at = Some(Utc::now().to_rfc3339());
                }
            }

            let result = execute_download(
                request,
                task_id_clone.clone(),
                attempt_id,
                custom_ytdlp,
                custom_ffmpeg,
                emitter,
                cancel_rx,
                is_cancelled,
            )
            .await;

            // Update final status in registry
            {
                let mut tasks = tasks_ref.write().await;
                if let Some(t) = tasks.get_mut(&task_id_clone) {
                    t.completed_at = Some(Utc::now().to_rfc3339());
                    match result {
                        Ok(dest) => {
                            t.state = DownloadState::Completed;
                            t.output_path = Some(dest);
                            t.error = None;
                        }
                        Err(e) => {
                            if t.state != DownloadState::Cancelled {
                                t.state = DownloadState::Failed;
                                t.error = Some(e.message);
                            }
                        }
                    }
                }
            }

            let mut attempts = active_attempts_ref.lock().await;
            attempts.remove(&task_id_clone);
        });

        Ok(task_id)
    }

    /// Cancels an active download task.
    pub async fn cancel_download(&self, task_id: &str) -> Result<bool, EngineError> {
        let mut attempts = self.active_attempts.lock().await;
        if let Some(attempt) = attempts.get_mut(task_id) {
            attempt.is_cancelled.store(true, Ordering::SeqCst);
            if let Some(tx) = attempt.cancel_tx.take() {
                let _ = tx.send(());
            }

            // Mark state as Cancelling in registry
            let mut tasks = self.tasks.write().await;
            if let Some(t) = tasks.get_mut(task_id) {
                if t.state.can_cancel() {
                    t.state = DownloadState::Cancelling;
                }
            }
            Ok(true)
        } else {
            // Check if task exists in registry but is already in terminal state
            let tasks = self.tasks.read().await;
            if let Some(task) = tasks.get(task_id) {
                if task.state.is_terminal() {
                    return Err(EngineError::execution_failed(format!(
                        "Task '{}' is already in terminal state '{:?}'",
                        task_id, task.state
                    )));
                }
            }
            Ok(false)
        }
    }

    /// Retries a previously failed or cancelled task.
    pub async fn retry_download<R: tauri::Runtime>(
        &self,
        task_id: &str,
        app: AppHandle<R>,
        custom_ytdlp: Option<String>,
        custom_ffmpeg: Option<String>,
    ) -> Result<String, EngineError> {
        let (request, next_attempt_id) = {
            let tasks = self.tasks.read().await;
            let task = tasks.get(task_id).ok_or_else(|| {
                EngineError::not_found(format!("Task '{}' not found for retry", task_id))
            })?;

            if task.state.is_active() {
                return Err(EngineError::duplicate_process(format!(
                    "Task '{}' is currently active and cannot be retried",
                    task_id
                )));
            }

            (task.request.clone(), task.attempt_id + 1)
        };

        // Reset task state for new attempt
        {
            let mut tasks = self.tasks.write().await;
            if let Some(task) = tasks.get_mut(task_id) {
                task.attempt_id = next_attempt_id;
                task.state = DownloadState::Queued;
                task.error = None;
                task.progress = DownloadProgress {
                    task_id: task_id.to_string(),
                    attempt_id: next_attempt_id,
                    state: DownloadState::Queued,
                    stage: format!("Queued for retry attempt {}...", next_attempt_id),
                    ..Default::default()
                };
            }
        }

        // Setup active attempt
        let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
        let is_cancelled = Arc::new(AtomicBool::new(false));

        {
            let mut attempts = self.active_attempts.lock().await;
            attempts.insert(
                task_id.to_string(),
                ActiveAttempt {
                    attempt_id: next_attempt_id,
                    cancel_tx: Some(cancel_tx),
                    is_cancelled: Arc::clone(&is_cancelled),
                },
            );
        }

        let tasks_ref = Arc::clone(&self.tasks);
        let active_attempts_ref = Arc::clone(&self.active_attempts);
        let sem = Arc::clone(&self.semaphore);
        let task_id_clone = task_id.to_string();
        let emitter = Arc::new(TauriDownloadEmitter::new(app));

        tokio::spawn(async move {
            let _permit = sem.acquire().await;

            if is_cancelled.load(Ordering::SeqCst) {
                let mut tasks = tasks_ref.write().await;
                if let Some(t) = tasks.get_mut(&task_id_clone) {
                    t.state = DownloadState::Cancelled;
                }
                let mut attempts = active_attempts_ref.lock().await;
                attempts.remove(&task_id_clone);
                return;
            }

            {
                let mut tasks = tasks_ref.write().await;
                if let Some(t) = tasks.get_mut(&task_id_clone) {
                    t.state = DownloadState::Starting;
                    t.started_at = Some(Utc::now().to_rfc3339());
                }
            }

            let result = execute_download(
                request,
                task_id_clone.clone(),
                next_attempt_id,
                custom_ytdlp,
                custom_ffmpeg,
                emitter,
                cancel_rx,
                is_cancelled,
            )
            .await;

            {
                let mut tasks = tasks_ref.write().await;
                if let Some(t) = tasks.get_mut(&task_id_clone) {
                    t.completed_at = Some(Utc::now().to_rfc3339());
                    match result {
                        Ok(dest) => {
                            t.state = DownloadState::Completed;
                            t.output_path = Some(dest);
                            t.error = None;
                        }
                        Err(e) => {
                            if t.state != DownloadState::Cancelled {
                                t.state = DownloadState::Failed;
                                t.error = Some(e.message);
                            }
                        }
                    }
                }
            }

            let mut attempts = active_attempts_ref.lock().await;
            attempts.remove(&task_id_clone);
        });

        Ok(task_id.to_string())
    }

    /// Retrieves status of a specific download task.
    pub async fn get_task_status(&self, task_id: &str) -> Option<DownloadTask> {
        let tasks = self.tasks.read().await;
        tasks.get(task_id).cloned()
    }

    /// Lists all download tasks in stable submission order.
    pub async fn list_tasks(&self) -> Vec<DownloadTask> {
        let tasks = self.tasks.read().await;
        let order = self.task_order.read().await;

        order
            .iter()
            .filter_map(|id| tasks.get(id).cloned())
            .collect()
    }

    /// Clears completed and cancelled tasks.
    pub async fn clear_completed(&self) {
        let mut tasks = self.tasks.write().await;
        let mut order = self.task_order.write().await;

        order.retain(|id| {
            if let Some(task) = tasks.get(id) {
                !task.state.is_terminal()
            } else {
                false
            }
        });

        tasks.retain(|_, task| !task.state.is_terminal());
    }

    /// Application shutdown handler to cancel all active tasks cleanly.
    pub async fn shutdown(&self) {
        let mut attempts = self.active_attempts.lock().await;
        for (_, attempt) in attempts.drain() {
            attempt.is_cancelled.store(true, Ordering::SeqCst);
            if let Some(tx) = attempt.cancel_tx {
                let _ = tx.send(());
            }
        }
    }
}
