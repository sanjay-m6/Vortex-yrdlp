pub mod analyzer;
pub mod validation;

pub use analyzer::*;
pub use validation::*;

use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tokio::sync::{oneshot, Mutex};

pub struct ActiveAnalysis {
    pub cancel_tx: Option<oneshot::Sender<()>>,
    pub is_cancelled: Arc<AtomicBool>,
}

pub struct PlaylistAnalysisManager {
    active_analyses: Arc<Mutex<HashMap<String, ActiveAnalysis>>>,
}

impl Default for PlaylistAnalysisManager {
    fn default() -> Self {
        Self {
            active_analyses: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl PlaylistAnalysisManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn register_analysis(&self, id: &str) -> (oneshot::Receiver<()>, Arc<AtomicBool>) {
        let (tx, rx) = oneshot::channel();
        let is_cancelled = Arc::new(AtomicBool::new(false));

        let mut map = self.active_analyses.lock().await;
        map.insert(
            id.to_string(),
            ActiveAnalysis {
                cancel_tx: Some(tx),
                is_cancelled: Arc::clone(&is_cancelled),
            },
        );

        (rx, is_cancelled)
    }

    pub async fn unregister_analysis(&self, id: &str) {
        let mut map = self.active_analyses.lock().await;
        map.remove(id);
    }

    pub async fn cancel_analysis(&self, id: &str) -> bool {
        let mut map = self.active_analyses.lock().await;
        if let Some(active) = map.get_mut(id) {
            active
                .is_cancelled
                .store(true, std::sync::atomic::Ordering::SeqCst);
            if let Some(tx) = active.cancel_tx.take() {
                let _ = tx.send(());
            }
            true
        } else {
            false
        }
    }
}
