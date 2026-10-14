use rusqlite::Connection;
use std::fs::File;
use std::io::Write;

use vortex_lib::database::library::{
    delete_history_record, fetch_media_item_by_id, init_library_schema, query_media_library,
};
use vortex_lib::database::{init_db, insert_or_update_download};
use vortex_lib::downloader::verification::{
    delete_media_file_on_disk, relink_file_service, verify_item_by_id, verify_path_on_disk,
};
use vortex_lib::models::{
    DownloadRequest, DownloadState, FileAvailability, FormatSelection, MediaLibraryFilter,
    MediaType, OverwritePolicy, QueueItem, QueuePriority,
};

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("Failed to open test SQLite db");
    init_db(&conn).expect("Failed to initialize database schema");
    conn
}

struct TestTempDir {
    path: std::path::PathBuf,
}

impl TestTempDir {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("test_mediadl_lib_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path).expect("failed to create test directory");
        Self { path }
    }

    fn path(&self) -> &std::path::Path {
        &self.path
    }
}

impl Drop for TestTempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

fn create_mock_queue_item(
    id: &str,
    title: &str,
    uploader: Option<&str>,
    status: DownloadState,
    media_type: MediaType,
    output_path: Option<&str>,
    file_size: u64,
) -> QueueItem {
    QueueItem {
        id: id.to_string(),
        request: DownloadRequest {
            task_id: Some(id.to_string()),
            webpage_url: format!("https://example.com/watch?v={}", id),
            format_selection: FormatSelection::Best,
            output_directory: "C:/downloads".to_string(),
            filename_template: Some(format!("{}.mp4", id)),
            media_type,
            overwrite_policy: OverwritePolicy::Rename,
            title: Some(title.to_string()),
            uploader: uploader.map(|u| u.to_string()),
            thumbnail: Some(format!("https://img.example.com/{}.jpg", id)),
            duration: Some(180.0),
            preset_id: Some("best-quality".to_string()),
            settings_snapshot: None,
        },
        status,
        priority: QueuePriority::Normal,
        queue_position: 0,
        progress: None,
        created_at: "2026-10-14T08:00:00Z".to_string(),
        updated_at: "2026-10-14T08:05:00Z".to_string(),
        started_at: Some("2026-10-14T08:01:00Z".to_string()),
        completed_at: if status.is_terminal() {
            Some("2026-10-14T08:04:00Z".to_string())
        } else {
            None
        },
        error_code: if status == DownloadState::Failed {
            Some("ERR_TEST".to_string())
        } else {
            None
        },
        error_message: if status == DownloadState::Failed {
            Some("Simulated test download failure".to_string())
        } else {
            None
        },
        output_path: output_path.map(|p| p.to_string()),
        downloaded_bytes: file_size,
        total_bytes: Some(file_size),
        attempt_count: 1,
    }
}

#[test]
fn test_database_schema_and_migrations_idempotency() {
    let conn = setup_test_db();

    // Verify calling init_library_schema again succeeds idempotently
    assert!(init_library_schema(&conn).is_ok());

    // Check table info for added columns
    let mut stmt = conn
        .prepare("SELECT name FROM pragma_table_info('downloads')")
        .unwrap();
    let col_names: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .flatten()
        .collect();

    assert!(col_names.contains(&"uploader".to_string()));
    assert!(col_names.contains(&"duration".to_string()));
    assert!(col_names.contains(&"file_extension".to_string()));
    assert!(col_names.contains(&"format_label".to_string()));
    assert!(col_names.contains(&"file_size_bytes".to_string()));
    assert!(col_names.contains(&"file_availability".to_string()));
    assert!(col_names.contains(&"last_verified_at".to_string()));
}

#[test]
fn test_media_library_search_and_filtering() {
    let conn = setup_test_db();

    // Seed 4 records:
    // 1. Rust Tutorial (Video, Completed, Uploader: TechWithRust, 50MB)
    // 2. Synthwave Mix (Audio, Completed, Uploader: RetroVibes, 15MB)
    // 3. Failed Stream (Video, Failed, Uploader: TechWithRust, 0MB)
    // 4. Cancelled Podcast (Audio, Cancelled, Uploader: AudioWorld, 0MB)
    let item1 = create_mock_queue_item(
        "item-1",
        "Rust Async Programming Tutorial",
        Some("TechWithRust"),
        DownloadState::Completed,
        MediaType::Video,
        Some("C:/downloads/rust_tutorial.mp4"),
        52_428_800,
    );
    let item2 = create_mock_queue_item(
        "item-2",
        "Night Chill Synthwave Mix",
        Some("RetroVibes"),
        DownloadState::Completed,
        MediaType::Audio,
        Some("C:/downloads/synthwave.mp3"),
        15_728_640,
    );
    let item3 = create_mock_queue_item(
        "item-3",
        "Corrupted Live Stream",
        Some("TechWithRust"),
        DownloadState::Failed,
        MediaType::Video,
        None,
        0,
    );
    let item4 = create_mock_queue_item(
        "item-4",
        "Podcast Episode 42",
        Some("AudioWorld"),
        DownloadState::Cancelled,
        MediaType::Audio,
        None,
        0,
    );

    insert_or_update_download(&conn, &item1).unwrap();
    insert_or_update_download(&conn, &item2).unwrap();
    insert_or_update_download(&conn, &item3).unwrap();
    insert_or_update_download(&conn, &item4).unwrap();

    // 1. Default query (returns all 4 items)
    let res_all = query_media_library(&conn, &MediaLibraryFilter::default()).unwrap();
    assert_eq!(res_all.total_count, 4);
    assert_eq!(res_all.summary.total_completed, 2);
    assert_eq!(res_all.summary.total_failed, 1);
    assert_eq!(res_all.summary.total_cancelled, 1);

    // 2. Search query by title ("programming")
    let filter_search_title = MediaLibraryFilter {
        search_query: Some("programming".to_string()),
        ..Default::default()
    };
    let res_search = query_media_library(&conn, &filter_search_title).unwrap();
    assert_eq!(res_search.total_count, 1);
    assert_eq!(res_search.items[0].id, "item-1");

    // 3. Search query by uploader ("TechWithRust")
    let filter_search_uploader = MediaLibraryFilter {
        search_query: Some("TechWithRust".to_string()),
        ..Default::default()
    };
    let res_uploader = query_media_library(&conn, &filter_search_uploader).unwrap();
    assert_eq!(res_uploader.total_count, 2);

    // 4. Status filter: Completed only
    let filter_completed = MediaLibraryFilter {
        status: Some("completed".to_string()),
        ..Default::default()
    };
    let res_completed = query_media_library(&conn, &filter_completed).unwrap();
    assert_eq!(res_completed.total_count, 2);

    // 5. Media type filter: Audio only
    let filter_audio = MediaLibraryFilter {
        media_type: Some("audio".to_string()),
        ..Default::default()
    };
    let res_audio = query_media_library(&conn, &filter_audio).unwrap();
    assert_eq!(res_audio.total_count, 2);
    assert!(res_audio.items.iter().all(|i| i.media_type == "audio"));

    // 6. Combined filter: Completed + Audio
    let filter_combined = MediaLibraryFilter {
        status: Some("completed".to_string()),
        media_type: Some("audio".to_string()),
        ..Default::default()
    };
    let res_combined = query_media_library(&conn, &filter_combined).unwrap();
    assert_eq!(res_combined.total_count, 1);
    assert_eq!(res_combined.items[0].id, "item-2");
}

#[test]
fn test_sorting_and_pagination() {
    let conn = setup_test_db();

    for i in 1..=15 {
        let title = format!("Video {:02}", i);
        let size = i * 1_000_000;
        let item = create_mock_queue_item(
            &format!("item-{}", i),
            &title,
            Some("Channel"),
            DownloadState::Completed,
            MediaType::Video,
            Some(&format!("C:/downloads/{}.mp4", i)),
            size,
        );
        insert_or_update_download(&conn, &item).unwrap();
    }

    // Pagination: Page 1 with page_size = 5
    let page1_filter = MediaLibraryFilter {
        page: Some(1),
        page_size: Some(5),
        sort_by: Some("file_size".to_string()),
        ..Default::default()
    };
    let page1 = query_media_library(&conn, &page1_filter).unwrap();
    assert_eq!(page1.total_count, 15);
    assert_eq!(page1.items.len(), 5);
    assert_eq!(page1.total_pages, 3);
    // Highest file size first (item-15 has 15MB)
    assert_eq!(page1.items[0].id, "item-15");

    // Page 2
    let page2_filter = MediaLibraryFilter {
        page: Some(2),
        page_size: Some(5),
        sort_by: Some("file_size".to_string()),
        ..Default::default()
    };
    let page2 = query_media_library(&conn, &page2_filter).unwrap();
    assert_eq!(page2.items.len(), 5);
    assert_eq!(page2.items[0].id, "item-10");

    // Title alphabetical sort
    let title_filter = MediaLibraryFilter {
        sort_by: Some("title".to_string()),
        page_size: Some(5),
        ..Default::default()
    };
    let title_res = query_media_library(&conn, &title_filter).unwrap();
    assert_eq!(title_res.items[0].title, "Video 01");
}

#[test]
fn test_file_verification_available_and_missing() {
    let conn = setup_test_db();
    let temp_dir = TestTempDir::new();

    // 1. Create a real file on disk
    let real_file_path = temp_dir.path().join("real_download.mp4");
    {
        let mut f = File::create(&real_file_path).unwrap();
        f.write_all(b"sample video bytes content").unwrap();
    }

    let (avail, size) = verify_path_on_disk(&real_file_path.to_string_lossy());
    assert_eq!(avail, FileAvailability::Available);
    assert_eq!(size, Some(26)); // 26 bytes

    // 2. Check non-existent file
    let missing_path = temp_dir.path().join("non_existent.mp4");
    let (avail_missing, size_missing) = verify_path_on_disk(&missing_path.to_string_lossy());
    assert_eq!(avail_missing, FileAvailability::Missing);
    assert_eq!(size_missing, None);

    // 3. Check directory instead of file (should be Inaccessible)
    let dir_path = temp_dir.path().join("subfolder");
    std::fs::create_dir_all(&dir_path).unwrap();
    let (avail_dir, _) = verify_path_on_disk(&dir_path.to_string_lossy());
    assert_eq!(avail_dir, FileAvailability::Inaccessible);

    // 4. Verify DB item update
    let item = create_mock_queue_item(
        "verify-task-1",
        "Test Real File",
        Some("Creator"),
        DownloadState::Completed,
        MediaType::Video,
        Some(&real_file_path.to_string_lossy()),
        0,
    );
    insert_or_update_download(&conn, &item).unwrap();

    let verified = verify_item_by_id(&conn, "verify-task-1").unwrap();
    assert_eq!(verified.file_availability, FileAvailability::Available);
    assert_eq!(verified.file_size_bytes, Some(26));
}

#[test]
fn test_relink_missing_file() {
    let conn = setup_test_db();
    let temp_dir = TestTempDir::new();

    // Initial item pointing to nonexistent location
    let item = create_mock_queue_item(
        "relink-task",
        "Lost File",
        Some("Artist"),
        DownloadState::Completed,
        MediaType::Video,
        Some("C:/moved/lost_video.mp4"),
        100,
    );
    insert_or_update_download(&conn, &item).unwrap();

    // Create new location
    let new_location = temp_dir.path().join("recovered_video.mp4");
    {
        let mut f = File::create(&new_location).unwrap();
        f.write_all(b"recovered video stream payload").unwrap();
    }

    let relinked =
        relink_file_service(&conn, "relink-task", &new_location.to_string_lossy()).unwrap();
    assert_eq!(relinked.file_availability, FileAvailability::Available);
    assert_eq!(
        relinked.output_path,
        Some(new_location.to_string_lossy().to_string())
    );
    assert_eq!(relinked.file_size_bytes, Some(30));
}

#[test]
fn test_remove_history_record_does_not_delete_file() {
    let conn = setup_test_db();
    let temp_dir = TestTempDir::new();

    let test_file = temp_dir.path().join("keep_me.mp4");
    {
        let mut f = File::create(&test_file).unwrap();
        f.write_all(b"important downloaded content").unwrap();
    }

    let item = create_mock_queue_item(
        "remove-record-task",
        "Do Not Delete Disk File",
        Some("Channel"),
        DownloadState::Completed,
        MediaType::Video,
        Some(&test_file.to_string_lossy()),
        28,
    );
    insert_or_update_download(&conn, &item).unwrap();

    // Remove history record from SQLite
    delete_history_record(&conn, "remove-record-task").unwrap();

    // Check DB record is gone
    let queried = fetch_media_item_by_id(&conn, "remove-record-task").unwrap();
    assert!(queried.is_none());

    // CRITICAL: Disk file MUST still exist!
    assert!(test_file.exists());
}

#[test]
fn test_explicit_file_deletion() {
    let conn = setup_test_db();
    let temp_dir = TestTempDir::new();

    let delete_file = temp_dir.path().join("delete_me.mp4");
    {
        let mut f = File::create(&delete_file).unwrap();
        f.write_all(b"temporary content to be deleted").unwrap();
    }
    assert!(delete_file.exists());

    let item = create_mock_queue_item(
        "delete-file-task",
        "Targeted Deletion",
        Some("Channel"),
        DownloadState::Completed,
        MediaType::Video,
        Some(&delete_file.to_string_lossy()),
        31,
    );
    insert_or_update_download(&conn, &item).unwrap();

    // Call delete_media_file_on_disk
    delete_media_file_on_disk(&conn, "delete-file-task").unwrap();

    // Disk file must be gone
    assert!(!delete_file.exists());

    // Record availability in DB is updated to Missing
    let updated = fetch_media_item_by_id(&conn, "delete-file-task")
        .unwrap()
        .unwrap();
    assert_eq!(updated.file_availability, FileAvailability::Missing);
}
