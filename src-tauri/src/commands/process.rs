use crate::downloader::AppState;
use tauri::{command, State};

#[command]
pub async fn cancel_managed_process(
    id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    // 1. Try ProcessManager first
    let cancelled_managed = state
        .process_manager
        .cancel(&id)
        .map_err(|e| e.to_string())?;
    if cancelled_managed {
        return Ok(true);
    }

    // 2. Fall back to legacy cancel_handles if present
    let mut map = state.cancel_handles.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = map.remove(&id) {
        let _ = sender.send(());
        Ok(true)
    } else {
        Ok(false)
    }
}
