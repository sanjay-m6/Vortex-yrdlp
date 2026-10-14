#![allow(
    clippy::too_many_arguments,
    clippy::should_implement_trait,
    clippy::derivable_impls,
    clippy::vec_init_then_push
)]

pub mod batch;
pub mod commands;
pub mod database;
pub mod downloader;
pub mod engine;
pub mod logging;
pub mod models;
pub mod playlist;
pub mod presets;
pub mod process;
pub mod updater;

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;

use database::DbState;
use downloader::manager::DownloadManager;
use downloader::queue::QueueManager;
use downloader::AppState;
use engine::EngineManager;
use playlist::PlaylistAnalysisManager;
use process::ProcessManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init_logger();
    logging::log_info("System", "Vortex v1.0.0 initializing...");

    let app_data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Vortex");

    if !app_data_dir.exists() {
        let legacy_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("MediaDL");
        if legacy_dir.exists() {
            let legacy_db = legacy_dir.join("mediadl.db");
            if legacy_db.exists() {
                let _ = fs::create_dir_all(&app_data_dir);
                let _ = fs::copy(&legacy_db, app_data_dir.join("vortex.db"));
            }
        }
    }

    let db_path = app_data_dir.join("vortex.db");

    let db_state = match DbState::new(db_path.clone()) {
        Ok(db) => {
            logging::log_info(
                "Database",
                &format!("SQLite database ready at {:?}", db_path),
            );
            db
        }
        Err(e) => {
            logging::log_error(
                "Database",
                &format!("Failed to initialize database at {:?}: {}", db_path, e),
            );
            // Fallback to in-memory database if disk fails
            DbState::new(PathBuf::from(":memory:")).expect("Failed to initialize fallback database")
        }
    };

    let engine = Arc::new(EngineManager::new());
    let process_manager = Arc::new(ProcessManager::new());
    let download_manager = Arc::new(DownloadManager::new(3));
    let playlist_manager = Arc::new(PlaylistAnalysisManager::new());
    let db_arc = Arc::new(db_state);
    let queue_manager = Arc::new(QueueManager::new(
        Arc::clone(&db_arc),
        Arc::clone(&download_manager),
        2,
    ));

    let app_state = AppState {
        cancel_handles: Arc::new(Mutex::new(HashMap::new())),
        db: db_arc,
        engine,
        process_manager,
        download_manager,
        queue_manager,
        playlist_manager,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .setup(|app| {
            let state = app.state::<AppState>();
            let queue_mgr = Arc::clone(&state.queue_manager);
            let handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                queue_mgr.initialize_with_app(handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Phase 6 Playlist & Batch Download commands
            commands::playlist::analyze_playlist,
            commands::playlist::cancel_playlist_analysis,
            commands::playlist::enqueue_playlist_selection,
            commands::batch::validate_batch_urls,
            commands::batch::import_batch_file,
            commands::batch::enqueue_batch_selection,
            commands::batch::get_existing_media_status,
            // Phase 5 Queue & Task Persistence commands
            commands::download::enqueue_download,
            commands::download::start_download,
            commands::download::cancel_download,
            commands::download::retry_download,
            commands::download::remove_queued_download,
            commands::download::reorder_download,
            commands::download::set_download_priority,
            commands::download::pause_queue,
            commands::download::resume_queue,
            commands::download::set_concurrency_limit,
            commands::download::get_concurrency_limit,
            commands::download::get_queue_snapshot,
            commands::download::get_download_status,
            commands::download::list_downloads,
            commands::download::clear_completed_downloads,
            commands::download::clear_failed_downloads,
            commands::download::get_task_attempts,
            commands::download::open_downloaded_file,
            commands::download::open_download_folder,
            commands::download::choose_download_directory,
            // Phase 2 Engine & Process commands
            commands::engine::get_engine_status,
            commands::engine::check_ytdlp_version,
            commands::engine::check_ffmpeg_status,
            commands::engine::validate_tool_path,
            commands::engine::set_tool_path,
            commands::engine::pick_tool_executable,
            commands::engine::get_diagnostics,
            commands::process::cancel_managed_process,
            // Existing system & app commands
            commands::system::check_system_dependencies,
            commands::system::pick_download_directory,
            commands::system::get_default_download_directory,
            commands::system::reveal_in_explorer,
            commands::system::download_latest_ytdlp,
            commands::system::app_minimize_window,
            commands::system::app_toggle_maximize_window,
            commands::system::app_close_window,
            commands::system::app_is_maximized,
            commands::downloader::analyze_media_url,
            commands::downloader::start_media_download,
            commands::downloader::cancel_media_download,
            commands::history::get_download_history,
            commands::history::search_media_library,
            commands::history::get_media_details,
            commands::history::verify_library_file,
            commands::history::refresh_library_availability,
            commands::history::open_library_file,
            commands::history::open_library_folder,
            commands::history::copy_path,
            commands::history::relink_library_file,
            commands::history::remove_history_record,
            commands::history::delete_library_file,
            commands::history::retry_failed_download,
            commands::history::remove_history_item,
            commands::history::clear_download_history,
            commands::settings::get_app_settings,
            commands::settings::update_app_settings,
            // Phase 7 Presets & Advanced Settings commands
            commands::presets::get_presets,
            commands::presets::get_preset_by_id_cmd,
            commands::presets::save_preset,
            commands::presets::delete_preset,
            commands::presets::reset_presets,
            commands::presets::get_download_settings,
            commands::presets::update_download_settings,
            commands::presets::validate_download_settings_cmd,
            commands::presets::preview_filename_template_cmd,
            commands::presets::resolve_output_directory_cmd,
            // Phase 10 Production Logging & Updater commands
            logging::get_diagnostics_report,
            logging::open_logs_directory,
            logging::read_recent_logs,
            updater::check_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
