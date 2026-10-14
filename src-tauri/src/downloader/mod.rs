pub mod executor;
pub mod manager;
pub mod output;
pub mod parser;
pub mod progress;
pub mod queue;
pub mod validation;
pub mod verification;
pub mod ytdlp;

pub use executor::*;
pub use manager::*;
pub use output::*;
pub use parser::*;
pub use progress::*;
pub use queue::*;
pub use validation::*;
pub use verification::*;

use crate::database::DbState;
use crate::engine::EngineManager;
use crate::process::ProcessManager;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

pub struct AppState {
    pub cancel_handles: Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    pub db: Arc<DbState>,
    pub engine: Arc<EngineManager>,
    pub process_manager: Arc<ProcessManager>,
    pub download_manager: Arc<manager::DownloadManager>,
    pub queue_manager: Arc<queue::QueueManager>,
    pub playlist_manager: Arc<crate::playlist::PlaylistAnalysisManager>,
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            cancel_handles: Arc::clone(&self.cancel_handles),
            db: Arc::clone(&self.db),
            engine: Arc::clone(&self.engine),
            process_manager: Arc::clone(&self.process_manager),
            download_manager: Arc::clone(&self.download_manager),
            queue_manager: Arc::clone(&self.queue_manager),
            playlist_manager: Arc::clone(&self.playlist_manager),
        }
    }
}
