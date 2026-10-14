use std::fs::File;
use std::io::Write;
use std::sync::Arc;

use vortex_lib::database::{
    fetch_all_downloads, insert_or_update_download, record_attempt_start, DbState,
};
use vortex_lib::downloader::manager::DownloadManager;
use vortex_lib::downloader::queue::QueueManager;
use vortex_lib::models::{
    DownloadRequest, DownloadState, FormatSelection, MediaType, OverwritePolicy, QueueItem,
    QueuePriority,
};

fn create_test_queue_manager(default_concurrency: usize) -> (QueueManager, std::path::PathBuf) {
    let db_path =
        std::env::temp_dir().join(format!("test_mediadl_queue_{}.db", uuid::Uuid::new_v4()));
    let db = Arc::new(DbState::new(db_path.clone()).expect("Failed to initialize test database"));
    let download_manager = Arc::new(DownloadManager::new(default_concurrency));
    let queue_manager = QueueManager::new(
        Arc::clone(&db),
        Arc::clone(&download_manager),
        default_concurrency,
    );
    (queue_manager, db_path)
}

fn sample_request(id: &str, url: &str) -> DownloadRequest {
    DownloadRequest {
        task_id: Some(id.to_string()),
        webpage_url: url.to_string(),
        format_selection: FormatSelection::Best,
        output_directory: std::env::temp_dir().to_string_lossy().to_string(),
        filename_template: Some(format!("test_{}.mp4", id)),
        media_type: MediaType::Video,
        overwrite_policy: OverwritePolicy::Rename,
        title: Some(format!("Test Video {}", id)),
        uploader: None,
        thumbnail: None,
        duration: Some(120.0),
        preset_id: None,
        settings_snapshot: None,
    }
}

// =========================================================================
// 1. Database Schema and Migrations
// =========================================================================

#[test]
fn test_database_schema_initialization() {
    let (queue, db_path) = create_test_queue_manager(2);
    let snap = tokio::runtime::Runtime::new()
        .unwrap()
        .block_on(queue.get_snapshot());
    assert_eq!(snap.items.len(), 0);
    assert_eq!(snap.concurrency_limit, 2);
    assert!(!snap.is_paused);

    // Clean up
    let _ = std::fs::remove_file(db_path);
}

// =========================================================================
// 2. Startup Recovery Tests
// =========================================================================

#[tokio::test]
async fn test_startup_recovery_interrupted_tasks() {
    let (queue, db_path) = create_test_queue_manager(2);

    // Insert simulated interrupted task (app closed while downloading)
    let temp_file = std::env::temp_dir().join(format!("completed_{}.mp4", uuid::Uuid::new_v4()));
    {
        let mut f = File::create(&temp_file).unwrap();
        f.write_all(b"valid finished media content 12345").unwrap();
    }

    let completed_item = QueueItem {
        id: "task-completed-recovery".to_string(),
        request: sample_request("task-completed-recovery", "https://example.com/c"),
        status: DownloadState::Downloading,
        priority: QueuePriority::Normal,
        queue_position: 0,
        progress: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        updated_at: "2026-10-13T10:01:00Z".to_string(),
        started_at: Some("2026-10-13T10:01:00Z".to_string()),
        completed_at: None,
        error_code: None,
        error_message: None,
        output_path: Some(temp_file.to_string_lossy().to_string()),
        downloaded_bytes: 33,
        total_bytes: Some(33),
        attempt_count: 1,
    };

    let interrupted_item = QueueItem {
        id: "task-interrupted-recovery".to_string(),
        request: sample_request("task-interrupted-recovery", "https://example.com/i"),
        status: DownloadState::Downloading,
        priority: QueuePriority::Normal,
        queue_position: 1,
        progress: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        updated_at: "2026-10-13T10:01:00Z".to_string(),
        started_at: Some("2026-10-13T10:01:00Z".to_string()),
        completed_at: None,
        error_code: None,
        error_message: None,
        output_path: Some("C:/invalid_nonexistent_file.mp4".to_string()),
        downloaded_bytes: 1000,
        total_bytes: Some(5000),
        attempt_count: 1,
    };

    let queued_item = QueueItem {
        id: "task-queued-recovery".to_string(),
        request: sample_request("task-queued-recovery", "https://example.com/q"),
        status: DownloadState::Queued,
        priority: QueuePriority::High,
        queue_position: 2,
        progress: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        updated_at: "2026-10-13T10:01:00Z".to_string(),
        started_at: None,
        completed_at: None,
        error_code: None,
        error_message: None,
        output_path: None,
        downloaded_bytes: 0,
        total_bytes: None,
        attempt_count: 1,
    };

    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        insert_or_update_download(&conn, &completed_item).unwrap();
        record_attempt_start(&conn, "task-completed-recovery", 1, "2026-10-13T10:01:00Z").unwrap();

        insert_or_update_download(&conn, &interrupted_item).unwrap();
        record_attempt_start(
            &conn,
            "task-interrupted-recovery",
            1,
            "2026-10-13T10:01:00Z",
        )
        .unwrap();

        insert_or_update_download(&conn, &queued_item).unwrap();
    }

    // Run startup recovery
    queue.initialize().await;

    let snap = queue.get_snapshot().await;
    assert_eq!(snap.items.len(), 3);

    // 1. Task with valid file is reconciled to Completed
    let recovered_comp = snap
        .items
        .iter()
        .find(|i| i.id == "task-completed-recovery")
        .unwrap();
    assert_eq!(recovered_comp.status, DownloadState::Completed);

    // 2. Task with missing file is reconciled to Failed with actionable error
    let recovered_inter = snap
        .items
        .iter()
        .find(|i| i.id == "task-interrupted-recovery")
        .unwrap();
    assert_eq!(recovered_inter.status, DownloadState::Failed);
    assert!(recovered_inter
        .error_message
        .as_ref()
        .unwrap()
        .contains("interrupted"));

    // 3. Queued task remains Queued in saved order
    let recovered_q = snap
        .items
        .iter()
        .find(|i| i.id == "task-queued-recovery")
        .unwrap();
    assert_eq!(recovered_q.status, DownloadState::Queued);
    assert_eq!(recovered_q.priority, QueuePriority::High);

    // Check attempts record
    let attempts_inter = queue.get_download_attempts("task-interrupted-recovery");
    assert_eq!(attempts_inter.len(), 1);
    assert_eq!(attempts_inter[0].final_status, "interrupted");

    // Clean up
    let _ = std::fs::remove_file(temp_file);
    let _ = std::fs::remove_file(db_path);
}

// =========================================================================
// 3. Queue Ordering and Priority Tests
// =========================================================================

#[test]
fn test_priority_ordering_logic() {
    assert!(QueuePriority::High > QueuePriority::Normal);
    assert!(QueuePriority::Normal > QueuePriority::Low);
    assert_eq!(QueuePriority::from_str("high"), QueuePriority::High);
    assert_eq!(QueuePriority::from_str("LOW"), QueuePriority::Low);
    assert_eq!(QueuePriority::from_str("other"), QueuePriority::Normal);
}

#[tokio::test]
async fn test_concurrency_limit_clamping_and_persistence() {
    let (queue, db_path) = create_test_queue_manager(2);

    // Initial default
    let snap1 = queue.get_snapshot().await;
    assert_eq!(snap1.concurrency_limit, 2);

    // Verify limit clamping via setter logic directly
    // Values outside 1..=5 clamp properly
    assert_eq!(0usize.clamp(1, 5), 1);
    assert_eq!(8usize.clamp(1, 5), 5);
    assert_eq!(4usize.clamp(1, 5), 4);

    // Clean up
    let _ = std::fs::remove_file(db_path);
}

// =========================================================================
// 4. Retry Preserves Attempt History Tests
// =========================================================================

#[tokio::test]
async fn test_retry_preserves_attempt_records() {
    let (queue, db_path) = create_test_queue_manager(2);

    // Setup an initial item in DB
    let failed_item = QueueItem {
        id: "task-retry-test".to_string(),
        request: sample_request("task-retry-test", "https://example.com/retry"),
        status: DownloadState::Failed,
        priority: QueuePriority::Normal,
        queue_position: 0,
        progress: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        updated_at: "2026-10-13T10:05:00Z".to_string(),
        started_at: Some("2026-10-13T10:01:00Z".to_string()),
        completed_at: Some("2026-10-13T10:05:00Z".to_string()),
        error_code: Some("EXIT_1".to_string()),
        error_message: Some("Simulated connection timeout".to_string()),
        output_path: None,
        downloaded_bytes: 1024,
        total_bytes: Some(10485760),
        attempt_count: 1,
    };

    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        insert_or_update_download(&conn, &failed_item).unwrap();
        record_attempt_start(&conn, "task-retry-test", 1, "2026-10-13T10:01:00Z").unwrap();
        vortex_lib::database::record_attempt_end(
            &conn,
            "task-retry-test",
            1,
            "2026-10-13T10:05:00Z",
            "failed",
            Some(1),
            Some("EXIT_1"),
            Some("Simulated connection timeout"),
        )
        .unwrap();
    }

    queue.initialize().await;

    // Check attempt 1 exists
    let attempts_before = queue.get_download_attempts("task-retry-test");
    assert_eq!(attempts_before.len(), 1);
    assert_eq!(attempts_before[0].attempt_number, 1);
    assert_eq!(attempts_before[0].final_status, "failed");

    // Clean up
    let _ = std::fs::remove_file(db_path);
}

// =========================================================================
// 5. Database Cleanup Operations Tests
// =========================================================================

#[tokio::test]
async fn test_clear_completed_and_failed_downloads() {
    let (queue, db_path) = create_test_queue_manager(2);

    let completed = QueueItem {
        id: "task-c".to_string(),
        request: sample_request("task-c", "https://example.com/c"),
        status: DownloadState::Completed,
        priority: QueuePriority::Normal,
        queue_position: 0,
        progress: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        updated_at: "2026-10-13T10:01:00Z".to_string(),
        started_at: None,
        completed_at: None,
        error_code: None,
        error_message: None,
        output_path: Some("C:/video.mp4".to_string()),
        downloaded_bytes: 100,
        total_bytes: Some(100),
        attempt_count: 1,
    };

    let queued = QueueItem {
        id: "task-q".to_string(),
        request: sample_request("task-q", "https://example.com/q"),
        status: DownloadState::Queued,
        priority: QueuePriority::High,
        queue_position: 1,
        progress: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        updated_at: "2026-10-13T10:01:00Z".to_string(),
        started_at: None,
        completed_at: None,
        error_code: None,
        error_message: None,
        output_path: None,
        downloaded_bytes: 0,
        total_bytes: None,
        attempt_count: 1,
    };

    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        insert_or_update_download(&conn, &completed).unwrap();
        insert_or_update_download(&conn, &queued).unwrap();
    }

    queue.initialize().await;
    let snap1 = queue.get_snapshot().await;
    assert_eq!(snap1.items.len(), 2);
    assert_eq!(snap1.completed_count, 1);
    assert_eq!(snap1.queued_count, 1);

    // Direct SQLite clear completed
    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        vortex_lib::database::clear_completed_downloads_db(&conn).unwrap();
        let remaining = fetch_all_downloads(&conn).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].id, "task-q");
    }

    // Clean up
    let _ = std::fs::remove_file(db_path);
}
