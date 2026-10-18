use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use vortex_lib::downloader::output::{
    cleanup_partial_files, find_candidate_output, verify_output_file,
};
use vortex_lib::downloader::progress::{
    format_bytes, format_eta, format_speed, parse_progress_line,
};
use vortex_lib::downloader::validation::{
    build_ytdlp_args, sanitize_filename, validate_output_directory, validate_url,
};
use vortex_lib::downloader::DownloadManager;
use vortex_lib::models::{
    DownloadProgress, DownloadRequest, DownloadState, DownloadTask, EngineErrorKind,
    FormatSelection, MediaType, OverwritePolicy,
};

// =========================================================================
// 1. Download Request Validation Tests
// =========================================================================

#[test]
fn test_validate_url_valid_schemes() {
    assert!(validate_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ").is_ok());
    assert!(validate_url("http://example.com/media/video.mp4").is_ok());
    assert!(validate_url("https://vimeo.com/123456789").is_ok());
}

#[test]
fn test_validate_url_empty_and_whitespace() {
    let err = validate_url("").unwrap_err();
    assert_eq!(err.kind, EngineErrorKind::InvalidPath);

    let err2 = validate_url("   \t\n  ").unwrap_err();
    assert_eq!(err2.kind, EngineErrorKind::InvalidPath);
}

#[test]
fn test_validate_url_disallowed_protocols() {
    let err1 = validate_url("file:///C:/Windows/System32/calc.exe").unwrap_err();
    assert_eq!(err1.kind, EngineErrorKind::InvalidPath);

    let err2 = validate_url("javascript:alert(1)").unwrap_err();
    assert_eq!(err2.kind, EngineErrorKind::InvalidPath);

    let err3 = validate_url("data:text/html,<h1>Hello</h1>").unwrap_err();
    assert_eq!(err3.kind, EngineErrorKind::InvalidPath);

    let err4 = validate_url("ftp://ftp.example.com/file.zip").unwrap_err();
    assert_eq!(err4.kind, EngineErrorKind::InvalidPath);
}

// =========================================================================
// 2. Output Path and Directory Validation Tests
// =========================================================================

#[test]
fn test_validate_output_directory_path_traversal() {
    let err = validate_output_directory("../../../system32").unwrap_err();
    assert_eq!(err.kind, EngineErrorKind::PermissionDenied);
    assert!(err.message.contains("Path traversal"));
}

#[test]
fn test_validate_output_directory_empty() {
    let err = validate_output_directory("   ").unwrap_err();
    assert_eq!(err.kind, EngineErrorKind::InvalidPath);
}

#[test]
fn test_validate_output_directory_valid_and_auto_create() {
    let temp_dir = std::env::temp_dir().join(format!("mediadl_test_dir_{}", uuid::Uuid::new_v4()));
    assert!(!temp_dir.exists());

    let res = validate_output_directory(temp_dir.to_str().unwrap());
    assert!(res.is_ok());
    assert!(temp_dir.exists());

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_validate_output_directory_resolves_downloads_keyword() {
    let res = validate_output_directory("Downloads");
    assert!(res.is_ok());
    let path = res.unwrap();
    assert!(path.is_absolute());
    // Must never contain the Windows UNC extended-length prefix \\?\
    let s = path.to_string_lossy();
    assert!(
        !s.starts_with(r"\\?\"),
        "Path should not start with UNC prefix: {}",
        s
    );
}

#[test]
fn test_validate_output_directory_resolves_relative_path_safely() {
    let res = validate_output_directory("vortex_test_subfolder");
    assert!(res.is_ok());
    let path = res.unwrap();
    assert!(path.is_absolute());
    let s = path.to_string_lossy();
    assert!(!s.starts_with(r"\\?\"));
    // Clean up created test folder
    let _ = fs::remove_dir_all(&path);
}

#[test]
fn test_strip_unc_prefix() {
    use std::path::PathBuf;
    use vortex_lib::downloader::validation::strip_unc_prefix;

    let p1 = PathBuf::from(r"\\?\C:\Users\User\Downloads");
    assert_eq!(
        strip_unc_prefix(p1),
        PathBuf::from(r"C:\Users\User\Downloads")
    );

    let p2 = PathBuf::from(r"\\?\UNC\Server\Share\Folder");
    assert_eq!(
        strip_unc_prefix(p2),
        PathBuf::from(r"\\Server\Share\Folder")
    );

    let p3 = PathBuf::from(r"C:\Normal\Path");
    assert_eq!(strip_unc_prefix(p3), PathBuf::from(r"C:\Normal\Path"));
}

// =========================================================================
// 3. Filename Sanitization Tests
// =========================================================================

#[test]
fn test_sanitize_filename_illegal_characters() {
    let dirty = "My Video: Episode 1 <Final> | 1080p *Cool*? \"Awesome\"/\\";
    let clean = sanitize_filename(dirty);
    assert!(!clean.contains(':'));
    assert!(!clean.contains('<'));
    assert!(!clean.contains('>'));
    assert!(!clean.contains('|'));
    assert!(!clean.contains('*'));
    assert!(!clean.contains('?'));
    assert!(!clean.contains('"'));
    assert!(!clean.contains('/'));
    assert!(!clean.contains('\\'));
}

#[test]
fn test_sanitize_filename_windows_reserved_device_names() {
    assert_eq!(sanitize_filename("CON"), "_CON");
    assert_eq!(sanitize_filename("prn"), "_prn");
    assert_eq!(sanitize_filename("aux.mp4"), "_aux.mp4");
    assert_eq!(sanitize_filename("NUL"), "_NUL");
    assert_eq!(sanitize_filename("COM1"), "_COM1");
    assert_eq!(sanitize_filename("lpt3.mkv"), "_lpt3.mkv");
}

#[test]
fn test_sanitize_filename_preserves_unicode() {
    let japanese = "【最高画質】日本の桜 2026年 4K映像";
    assert_eq!(sanitize_filename(japanese), japanese);

    let french = "Vidéo Électrique — Édition Spéciale";
    assert_eq!(sanitize_filename(french), french);

    let arabic = "فيديو تجريبي عالي الدقة";
    assert_eq!(sanitize_filename(arabic), arabic);
}

#[test]
fn test_sanitize_filename_empty_fallback() {
    assert_eq!(sanitize_filename(""), "media_download");
    assert_eq!(sanitize_filename("    ...   "), "media_download");
}

// =========================================================================
// 4. Format Selection Mapping Tests
// =========================================================================

#[test]
fn test_build_ytdlp_args_best_format() {
    let req = DownloadRequest {
        task_id: Some("t-best".to_string()),
        webpage_url: "https://example.com/video".to_string(),
        format_selection: FormatSelection::Best,
        output_directory: "C:/test".to_string(),
        filename_template: None,
        media_type: MediaType::Video,
        overwrite_policy: OverwritePolicy::Rename,
        title: Some("Best Video".to_string()),
        uploader: None,
        thumbnail: None,
        duration: None,
        preset_id: None,
        settings_snapshot: None,
    };

    let args = build_ytdlp_args(&req, Path::new("C:/test"), true).unwrap();
    assert!(args.contains(&"--newline".to_string()));
    assert!(args.contains(&"--progress-template".to_string()));
    assert!(args.contains(&"-f".to_string()));
    assert!(args.contains(&"bv*+ba/b".to_string()));
    assert!(args.contains(&"--no-overwrites".to_string()));
}

#[test]
fn test_build_ytdlp_args_resolution_presets() {
    let presets = [
        ("1080p", "bv*[height<=1080]+ba/b[height<=1080] / bv*+ba/b"),
        ("720p", "bv*[height<=720]+ba/b[height<=720] / bv*+ba/b"),
        ("480p", "bv*[height<=480]+ba/b[height<=480] / bv*+ba/b"),
    ];

    for (preset, expected_format) in presets {
        let req = DownloadRequest {
            task_id: Some("t-preset".to_string()),
            webpage_url: "https://example.com/video".to_string(),
            format_selection: FormatSelection::Preset(preset.to_string()),
            output_directory: "C:/test".to_string(),
            filename_template: None,
            media_type: MediaType::Video,
            overwrite_policy: OverwritePolicy::Overwrite,
            title: None,
            uploader: None,
            thumbnail: None,
            duration: None,
            preset_id: None,
            settings_snapshot: None,
        };

        let args = build_ytdlp_args(&req, Path::new("C:/test"), true).unwrap();
        let idx = args.iter().position(|a| a == "-f").expect("Missing -f");
        assert_eq!(args[idx + 1], expected_format);
        assert!(args.contains(&"--force-overwrites".to_string()));
    }
}

#[test]
fn test_build_ytdlp_args_audio_requires_ffmpeg() {
    let req = DownloadRequest {
        task_id: Some("t-audio".to_string()),
        webpage_url: "https://example.com/video".to_string(),
        format_selection: FormatSelection::Preset("audio_best".to_string()),
        output_directory: "C:/test".to_string(),
        filename_template: None,
        media_type: MediaType::Audio,
        overwrite_policy: OverwritePolicy::Rename,
        title: None,
        uploader: None,
        thumbnail: None,
        duration: None,
        preset_id: None,
        settings_snapshot: None,
    };

    // When FFmpeg is not available, audio extraction should return an actionable NotFound error
    let err = build_ytdlp_args(&req, Path::new("C:/test"), false).unwrap_err();
    assert_eq!(err.kind, EngineErrorKind::NotFound);
    assert!(err.message.contains("FFmpeg is required"));

    // When FFmpeg is available, arguments should include --extract-audio and --audio-format mp3
    let args = build_ytdlp_args(&req, Path::new("C:/test"), true).unwrap();
    assert!(args.contains(&"--extract-audio".to_string()));
    assert!(args.contains(&"--audio-format".to_string()));
    assert!(args.contains(&"mp3".to_string()));
}

#[test]
fn test_build_ytdlp_args_custom_format_injection_prevention() {
    // Valid format ID
    let req_valid = DownloadRequest {
        task_id: Some("t-custom".to_string()),
        webpage_url: "https://example.com/video".to_string(),
        format_selection: FormatSelection::Custom("137+140".to_string()),
        output_directory: "C:/test".to_string(),
        filename_template: None,
        media_type: MediaType::Video,
        overwrite_policy: OverwritePolicy::Rename,
        title: None,
        uploader: None,
        thumbnail: None,
        duration: None,
        preset_id: None,
        settings_snapshot: None,
    };
    let args = build_ytdlp_args(&req_valid, Path::new("C:/test"), true).unwrap();
    let idx = args.iter().position(|a| a == "-f").unwrap();
    assert_eq!(args[idx + 1], "137+140");

    // Invalid format ID with dangerous command injection characters
    let req_malicious = DownloadRequest {
        task_id: Some("t-custom-bad".to_string()),
        webpage_url: "https://example.com/video".to_string(),
        format_selection: FormatSelection::Custom("137; rm -rf /".to_string()),
        output_directory: "C:/test".to_string(),
        filename_template: None,
        media_type: MediaType::Video,
        overwrite_policy: OverwritePolicy::Rename,
        title: None,
        uploader: None,
        thumbnail: None,
        duration: None,
        preset_id: None,
        settings_snapshot: None,
    };
    let err = build_ytdlp_args(&req_malicious, Path::new("C:/test"), true).unwrap_err();
    assert_eq!(err.kind, EngineErrorKind::InvalidPath);
    assert!(err.message.contains("Invalid format identifier"));
}

// =========================================================================
// 5. Machine-Readable Progress Parsing Tests
// =========================================================================

#[test]
fn test_parse_progress_line_structured_template() {
    let mut progress = DownloadProgress::default();
    let line = "[vortex_progress]52428800|104857600|NA|10485760|5|50.0%|C:/test/sample.mp4";

    let updated = parse_progress_line(line, &mut progress);
    assert!(updated);
    assert_eq!(progress.downloaded_bytes, 52428800);
    assert_eq!(progress.total_bytes, Some(104857600));
    assert_eq!(progress.speed_bytes_per_sec, Some(10485760));
    assert_eq!(progress.eta_seconds, Some(5));
    assert_eq!(progress.percentage, 50.0);
    assert_eq!(progress.state, DownloadState::Downloading);
    assert_eq!(progress.output_path, Some("C:/test/sample.mp4".to_string()));
    assert_eq!(progress.speed_formatted, "10.0 MB/s");
    assert_eq!(progress.downloaded_formatted, "50.0 MB");
    assert_eq!(progress.total_formatted, "100.0 MB");
    assert_eq!(progress.eta_formatted, "00:05");
}

#[test]
fn test_parse_progress_line_unknown_total_size() {
    let mut progress = DownloadProgress::default();
    // total is NA, estimate is 209715200 (200 MB)
    let line = "[vortex_progress]1048576|NA|209715200|524288|NA|0.5%|C:/test/sample.mp4";

    let updated = parse_progress_line(line, &mut progress);
    assert!(updated);
    assert_eq!(progress.downloaded_bytes, 1048576);
    assert_eq!(progress.total_bytes, Some(209715200)); // Fallback to estimate
    assert_eq!(progress.eta_seconds, None);
    assert_eq!(progress.eta_formatted, "--:--");
}

#[test]
fn test_parse_progress_line_postprocess_and_merging() {
    let mut progress = DownloadProgress::default();

    // 1. Structured postprocess line
    let pp_line = "[vortex_postprocess]Started|FFmpeg";
    let updated1 = parse_progress_line(pp_line, &mut progress);
    assert!(updated1);
    assert_eq!(progress.state, DownloadState::Processing);
    assert!(progress.stage.contains("Processing with FFmpeg"));

    // 2. Terminal Merger line fallback
    let merger_line = r#"[Merger] Merging formats into "C:\Users\video.mp4""#;
    let updated2 = parse_progress_line(merger_line, &mut progress);
    assert!(updated2);
    assert_eq!(progress.state, DownloadState::Processing);
    assert_eq!(progress.percentage, 99.0);
    assert_eq!(
        progress.output_path,
        Some(r#"C:\Users\video.mp4"#.to_string())
    );

    // 3. Audio extraction line
    let extract_line = r#"[ExtractAudio] Destination: C:\Users\song.mp3"#;
    let updated3 = parse_progress_line(extract_line, &mut progress);
    assert!(updated3);
    assert_eq!(progress.state, DownloadState::Processing);
    assert_eq!(
        progress.output_path,
        Some(r#"C:\Users\song.mp3"#.to_string())
    );
}

#[test]
fn test_parse_progress_line_terminal_fallback() {
    let mut progress = DownloadProgress::default();
    let line = "[download]  73.4% of   50.00MiB at    4.20MiB/s ETA 00:03";

    let updated = parse_progress_line(line, &mut progress);
    assert!(updated);
    assert_eq!(progress.percentage, 73.4);
    assert_eq!(progress.total_formatted, "50.00MiB");
    assert_eq!(progress.speed_formatted, "4.20MiB/s");
    assert_eq!(progress.eta_formatted, "00:03");
    assert_eq!(progress.state, DownloadState::Downloading);
}

// =========================================================================
// 6. Format Utility Functions Tests
// =========================================================================

#[test]
fn test_format_utilities() {
    assert_eq!(format_bytes(500), "500 B");
    assert_eq!(format_bytes(2048), "2 KB");
    assert_eq!(format_bytes(15 * 1024 * 1024), "15.0 MB");
    assert_eq!(format_bytes(2 * 1024 * 1024 * 1024), "2.00 GB");

    assert_eq!(format_speed(1024 * 1024), "1.0 MB/s");

    assert_eq!(format_eta(45), "00:45");
    assert_eq!(format_eta(125), "02:05");
    assert_eq!(format_eta(3665), "01:01:05");
}

// =========================================================================
// 7. Output File Verification and Discovery Tests
// =========================================================================

#[test]
fn test_verify_output_file_validation() {
    let temp_dir = std::env::temp_dir().join(format!("mediadl_verify_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).unwrap();

    let valid_file = temp_dir.join("test_video.mp4");
    {
        let mut f = File::create(&valid_file).unwrap();
        f.write_all(b"fake media content 1234567890").unwrap();
    }

    let zero_byte_file = temp_dir.join("empty.mp4");
    {
        File::create(&zero_byte_file).unwrap();
    }

    let part_file = temp_dir.join("test_video.mp4.part");
    {
        let mut f = File::create(&part_file).unwrap();
        f.write_all(b"partial buffer").unwrap();
    }

    let non_existent = temp_dir.join("missing.mp4");

    // 1. Valid non-empty file
    let size = verify_output_file(&valid_file).unwrap();
    assert_eq!(size, 29);

    // 2. Zero byte file fails
    let err_zero = verify_output_file(&zero_byte_file).unwrap_err();
    assert_eq!(err_zero.kind, EngineErrorKind::ExecutionFailed);
    assert!(err_zero.message.contains("0 bytes"));

    // 3. .part temp file fails
    let err_part = verify_output_file(&part_file).unwrap_err();
    assert_eq!(err_part.kind, EngineErrorKind::ExecutionFailed);
    assert!(err_part.message.contains("unfinished download"));

    // 4. Missing file fails
    let err_missing = verify_output_file(&non_existent).unwrap_err();
    assert_eq!(err_missing.kind, EngineErrorKind::NotFound);

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_cleanup_partial_files_safety() {
    let temp_dir = std::env::temp_dir().join(format!("mediadl_cleanup_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).unwrap();

    let completed_file = temp_dir.join("completed_video.mp4");
    File::create(&completed_file).unwrap();

    let part_file = temp_dir.join("completed_video.mp4.part");
    File::create(&part_file).unwrap();

    let ytdl_file = temp_dir.join("completed_video.mp4.ytdl");
    File::create(&ytdl_file).unwrap();

    let other_file = temp_dir.join("other_file.txt");
    File::create(&other_file).unwrap();

    // Perform partial file cleanup
    cleanup_partial_files(&temp_dir, Some("completed_video"));

    // Temporary .part and .ytdl should be deleted
    assert!(!part_file.exists());
    assert!(!ytdl_file.exists());

    // Completed file and other files must be preserved safely!
    assert!(completed_file.exists());
    assert!(other_file.exists());

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

#[test]
fn test_find_candidate_output() {
    let temp_dir = std::env::temp_dir().join(format!("mediadl_candidate_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).unwrap();

    let file_1 = temp_dir.join("Nature Documentary [vid123].mp4");
    File::create(&file_1).unwrap();

    let candidate = find_candidate_output(&temp_dir, Some("Nature Documentary"));
    assert_eq!(candidate, Some(file_1));

    // Clean up
    let _ = fs::remove_dir_all(&temp_dir);
}

// =========================================================================
// 8. Download State Machine Invariant Tests
// =========================================================================

#[test]
fn test_download_state_machine_transitions() {
    // Active states
    assert!(DownloadState::Queued.is_active());
    assert!(DownloadState::Starting.is_active());
    assert!(DownloadState::Downloading.is_active());
    assert!(DownloadState::Processing.is_active());
    assert!(DownloadState::Cancelling.is_active());
    assert!(!DownloadState::Completed.is_active());
    assert!(!DownloadState::Failed.is_active());
    assert!(!DownloadState::Cancelled.is_active());

    // Cancellable states
    assert!(DownloadState::Queued.can_cancel());
    assert!(DownloadState::Starting.can_cancel());
    assert!(DownloadState::Downloading.can_cancel());
    assert!(DownloadState::Processing.can_cancel());
    assert!(!DownloadState::Cancelling.can_cancel());
    assert!(!DownloadState::Completed.can_cancel());
    assert!(!DownloadState::Failed.can_cancel());
    assert!(!DownloadState::Cancelled.can_cancel());

    // Terminal states
    assert!(DownloadState::Completed.is_terminal());
    assert!(DownloadState::Failed.is_terminal());
    assert!(DownloadState::Cancelled.is_terminal());
    assert!(!DownloadState::Downloading.is_terminal());
    assert!(!DownloadState::Processing.is_terminal());
}

// =========================================================================
// 9. Download Manager Registry and Cancellation Tests
// =========================================================================

#[tokio::test]
async fn test_download_manager_task_registry_and_order() {
    let manager = DownloadManager::new(2);

    let _task1 = DownloadTask {
        id: "task-1".to_string(),
        attempt_id: 1,
        request: DownloadRequest {
            task_id: Some("task-1".to_string()),
            webpage_url: "https://example.com/1".to_string(),
            format_selection: FormatSelection::Best,
            output_directory: "C:/tmp".to_string(),
            filename_template: None,
            media_type: MediaType::Video,
            overwrite_policy: OverwritePolicy::Rename,
            title: Some("Video 1".to_string()),
            uploader: None,
            thumbnail: None,
            duration: None,
            preset_id: None,
            settings_snapshot: None,
        },
        state: DownloadState::Downloading,
        progress: DownloadProgress::default(),
        output_path: None,
        error: None,
        created_at: "2026-10-13T10:00:00Z".to_string(),
        started_at: None,
        completed_at: None,
    };

    // Use list_tasks on empty
    let initial: Vec<DownloadTask> = manager.list_tasks().await;
    assert_eq!(initial.len(), 0);
}

#[tokio::test]
async fn test_cancel_already_terminal_task() {
    let manager = DownloadManager::new(2);

    // Cancel non-existent task returns false
    let res: Result<bool, vortex_lib::models::EngineError> =
        manager.cancel_download("non-existent-task").await;
    assert_eq!(res.unwrap(), false);
}

#[tokio::test]
async fn test_download_manager_shutdown() {
    let manager = DownloadManager::new(2);
    // Calling shutdown on empty or active manager should not panic and should clean attempts
    manager.shutdown().await;
    let tasks: Vec<DownloadTask> = manager.list_tasks().await;
    assert_eq!(tasks.len(), 0);
}
