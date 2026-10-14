use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Utc;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::models::EngineError;
use crate::process::events::{
    now_iso, sanitize_output_line, ProcessCancelledPayload, ProcessErrorPayload,
    ProcessExitedPayload, ProcessOutputPayload, ProcessStartedPayload, EVENT_PROCESS_CANCELLED,
    EVENT_PROCESS_ERROR, EVENT_PROCESS_EXITED, EVENT_PROCESS_OUTPUT, EVENT_PROCESS_STARTED,
};

/// Trait to abstract event emission for production (Tauri) and unit tests.
pub trait ProcessEventEmitter: Send + Sync + 'static {
    fn emit_started(&self, payload: ProcessStartedPayload);
    fn emit_output(&self, payload: ProcessOutputPayload);
    fn emit_exited(&self, payload: ProcessExitedPayload);
    fn emit_error(&self, payload: ProcessErrorPayload);
    fn emit_cancelled(&self, payload: ProcessCancelledPayload);
}

/// Tauri implementation of ProcessEventEmitter
pub struct TauriEventEmitter<R: tauri::Runtime> {
    app: tauri::AppHandle<R>,
}

impl<R: tauri::Runtime> TauriEventEmitter<R> {
    pub fn new(app: tauri::AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: tauri::Runtime> ProcessEventEmitter for TauriEventEmitter<R> {
    fn emit_started(&self, payload: ProcessStartedPayload) {
        let _ = self.app.emit(EVENT_PROCESS_STARTED, payload);
    }
    fn emit_output(&self, payload: ProcessOutputPayload) {
        let _ = self.app.emit(EVENT_PROCESS_OUTPUT, payload);
    }
    fn emit_exited(&self, payload: ProcessExitedPayload) {
        let _ = self.app.emit(EVENT_PROCESS_EXITED, payload);
    }
    fn emit_error(&self, payload: ProcessErrorPayload) {
        let _ = self.app.emit(EVENT_PROCESS_ERROR, payload);
    }
    fn emit_cancelled(&self, payload: ProcessCancelledPayload) {
        let _ = self.app.emit(EVENT_PROCESS_CANCELLED, payload);
    }
}

#[derive(Debug, Clone)]
pub struct ManagedProcessInfo {
    pub id: String,
    pub command: String,
    pub pid: Option<u32>,
    pub started_at: chrono::DateTime<Utc>,
}

struct ActiveProcess {
    id: String,
    command: String,
    pid: Option<u32>,
    started_at: chrono::DateTime<Utc>,
    cancel_tx: Option<oneshot::Sender<()>>,
    is_cancelled: Arc<AtomicBool>,
}

pub struct ProcessManager {
    processes: Arc<Mutex<HashMap<String, ActiveProcess>>>,
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Checks if a process with this ID is currently registered.
    pub fn is_running(&self, id: &str) -> bool {
        if let Ok(map) = self.processes.lock() {
            map.contains_key(id)
        } else {
            false
        }
    }

    /// Returns a list of currently running managed processes.
    pub fn list_running(&self) -> Vec<ManagedProcessInfo> {
        if let Ok(map) = self.processes.lock() {
            map.values()
                .map(|p| ManagedProcessInfo {
                    id: p.id.clone(),
                    command: p.command.clone(),
                    pid: p.pid,
                    started_at: p.started_at,
                })
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Cancel a managed process by ID.
    pub fn cancel(&self, id: &str) -> Result<bool, EngineError> {
        let mut map = self
            .processes
            .lock()
            .map_err(|e| EngineError::io(e.to_string()))?;
        if let Some(proc) = map.get_mut(id) {
            proc.is_cancelled.store(true, Ordering::SeqCst);
            if let Some(tx) = proc.cancel_tx.take() {
                let _ = tx.send(());
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Spawn a managed subprocess with an event emitter.
    pub async fn spawn<E: ProcessEventEmitter>(
        &self,
        emitter: Arc<E>,
        id: String,
        executable: PathBuf,
        args: Vec<String>,
        cwd: Option<PathBuf>,
    ) -> Result<(), EngineError> {
        // 1. Prevent duplicate launches for the same managed ID
        {
            let map = self
                .processes
                .lock()
                .map_err(|e| EngineError::io(e.to_string()))?;
            if map.contains_key(&id) {
                return Err(EngineError::duplicate_process(&id));
            }
        }

        // 2. Validate executable file existence
        if !executable.exists() || !executable.is_file() {
            return Err(EngineError::invalid_path(format!(
                "Executable path '{:?}' does not exist or is not a file",
                executable
            )));
        }

        let is_cancelled = Arc::new(AtomicBool::new(false));
        let (cancel_tx, mut cancel_rx) = oneshot::channel::<()>();
        let command_str = executable.to_string_lossy().to_string();

        let mut cmd = Command::new(&executable);
        cmd.args(&args);
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.kill_on_drop(true);

        #[cfg(target_os = "windows")]
        {
            // CREATE_NO_WINDOW
            cmd.creation_flags(0x08000000);
        }

        // 3. Spawn child process
        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("Failed to start executable {:?}: {}", executable, e);
                emitter.emit_error(ProcessErrorPayload {
                    id: id.clone(),
                    error: err_msg.clone(),
                    timestamp: now_iso(),
                });
                return Err(if e.kind() == std::io::ErrorKind::PermissionDenied {
                    EngineError::permission_denied(err_msg)
                } else {
                    EngineError::execution_failed(err_msg)
                });
            }
        };

        let pid = child.id();

        // 4. Register active process
        {
            let mut map = self
                .processes
                .lock()
                .map_err(|e| EngineError::io(e.to_string()))?;
            map.insert(
                id.clone(),
                ActiveProcess {
                    id: id.clone(),
                    command: command_str.clone(),
                    pid,
                    started_at: Utc::now(),
                    cancel_tx: Some(cancel_tx),
                    is_cancelled: Arc::clone(&is_cancelled),
                },
            );
        }

        // 5. Emit process_started
        emitter.emit_started(ProcessStartedPayload {
            id: id.clone(),
            command: command_str,
            args: args.clone(),
            pid,
            timestamp: now_iso(),
        });

        // 6. Spawn driver task to handle stdout, stderr, and cancellation
        let processes_ref = Arc::clone(&self.processes);
        let id_clone = id.clone();
        let is_cancelled_clone = Arc::clone(&is_cancelled);

        tokio::spawn(async move {
            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let (stdout_done_tx, stdout_done_rx) = oneshot::channel::<()>();
            let (stderr_done_tx, stderr_done_rx) = oneshot::channel::<()>();

            // Concurrent stdout reading
            let emitter_stdout = Arc::clone(&emitter);
            let id_stdout = id_clone.clone();
            if let Some(out) = stdout {
                tokio::spawn(async move {
                    let mut reader = BufReader::new(out).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        let clean_line = sanitize_output_line(&line);
                        emitter_stdout.emit_output(ProcessOutputPayload {
                            id: id_stdout.clone(),
                            stream: "stdout".to_string(),
                            line: clean_line,
                            timestamp: now_iso(),
                        });
                    }
                    let _ = stdout_done_tx.send(());
                });
            } else {
                let _ = stdout_done_tx.send(());
            }

            // Concurrent stderr reading
            let emitter_stderr = Arc::clone(&emitter);
            let id_stderr = id_clone.clone();
            if let Some(err) = stderr {
                tokio::spawn(async move {
                    let mut reader = BufReader::new(err).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        let clean_line = sanitize_output_line(&line);
                        emitter_stderr.emit_output(ProcessOutputPayload {
                            id: id_stderr.clone(),
                            stream: "stderr".to_string(),
                            line: clean_line,
                            timestamp: now_iso(),
                        });
                    }
                    let _ = stderr_done_tx.send(());
                });
            } else {
                let _ = stderr_done_tx.send(());
            }

            // Wait for completion or cancellation
            tokio::select! {
                _ = &mut cancel_rx => {
                    is_cancelled_clone.store(true, Ordering::SeqCst);
                    // Force terminate child
                    let _ = child.start_kill();
                    let _ = tokio::time::timeout(Duration::from_millis(500), child.wait()).await;
                    emitter.emit_cancelled(ProcessCancelledPayload {
                        id: id_clone.clone(),
                        timestamp: now_iso(),
                    });
                }
                status_res = child.wait() => {
                    let _ = stdout_done_rx.await;
                    let _ = stderr_done_rx.await;

                    if is_cancelled_clone.load(Ordering::SeqCst) {
                        emitter.emit_cancelled(ProcessCancelledPayload {
                            id: id_clone.clone(),
                            timestamp: now_iso(),
                        });
                    } else {
                        match status_res {
                            Ok(status) => {
                                emitter.emit_exited(ProcessExitedPayload {
                                    id: id_clone.clone(),
                                    exit_code: status.code(),
                                    success: status.success(),
                                    timestamp: now_iso(),
                                });
                            }
                            Err(e) => {
                                emitter.emit_error(ProcessErrorPayload {
                                    id: id_clone.clone(),
                                    error: format!("Process wait failed: {}", e),
                                    timestamp: now_iso(),
                                });
                            }
                        }
                    }
                }
            }

            // Clean up from active processes map
            if let Ok(mut map) = processes_ref.lock() {
                map.remove(&id_clone);
            }
        });

        Ok(())
    }
}

impl Drop for ProcessManager {
    fn drop(&mut self) {
        if let Ok(mut map) = self.processes.lock() {
            for (_, proc) in map.drain() {
                proc.is_cancelled.store(true, Ordering::SeqCst);
                if let Some(tx) = proc.cancel_tx {
                    let _ = tx.send(());
                }
            }
        }
    }
}
