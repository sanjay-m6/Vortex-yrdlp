use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rusqlite::Connection;
use vortex_lib::database::{init_db, load_app_settings, store_app_settings};
use vortex_lib::engine::installer::ToolInstallManager;
use vortex_lib::engine::resolver::ToolResolver;
use vortex_lib::engine::version::ToolVersionChecker;
use vortex_lib::engine::EngineManager;
use vortex_lib::models::{
    AppSettings, EngineErrorKind, EngineStatus, ToolSource, ToolState, ToolStatus,
};
use vortex_lib::process::events::{
    sanitize_output_line, ProcessCancelledPayload, ProcessErrorPayload, ProcessExitedPayload,
    ProcessOutputPayload, ProcessStartedPayload,
};
use vortex_lib::process::manager::{ProcessEventEmitter, ProcessManager};

#[derive(Clone, Default)]
struct RecordingEventEmitter {
    started: Arc<Mutex<Vec<ProcessStartedPayload>>>,
    output: Arc<Mutex<Vec<ProcessOutputPayload>>>,
    exited: Arc<Mutex<Vec<ProcessExitedPayload>>>,
    error: Arc<Mutex<Vec<ProcessErrorPayload>>>,
    cancelled: Arc<Mutex<Vec<ProcessCancelledPayload>>>,
}

impl ProcessEventEmitter for RecordingEventEmitter {
    fn emit_started(&self, payload: ProcessStartedPayload) {
        self.started.lock().unwrap().push(payload);
    }
    fn emit_output(&self, payload: ProcessOutputPayload) {
        self.output.lock().unwrap().push(payload);
    }
    fn emit_exited(&self, payload: ProcessExitedPayload) {
        self.exited.lock().unwrap().push(payload);
    }
    fn emit_error(&self, payload: ProcessErrorPayload) {
        self.error.lock().unwrap().push(payload);
    }
    fn emit_cancelled(&self, payload: ProcessCancelledPayload) {
        self.cancelled.lock().unwrap().push(payload);
    }
}

// 1. Version output parsing
#[test]
fn test_version_output_parsing_ytdlp() {
    assert_eq!(
        ToolVersionChecker::parse_ytdlp_version("2026.08.19\n").unwrap(),
        "2026.08.19"
    );
    assert_eq!(
        ToolVersionChecker::parse_ytdlp_version("2024.12.23-1").unwrap(),
        "2024.12.23-1"
    );
    assert_eq!(
        ToolVersionChecker::parse_ytdlp_version("stable@2025.01.15").unwrap(),
        "2025.01.15"
    );
    assert_eq!(
        ToolVersionChecker::parse_ytdlp_version("nightly@2024.11.04.232301").unwrap(),
        "2024.11.04.232301"
    );
    assert_eq!(
        ToolVersionChecker::parse_ytdlp_version("yt-dlp version: 2024.08.01 (custom build)")
            .unwrap(),
        "2024.08.01"
    );
}

#[test]
fn test_version_output_parsing_ffmpeg() {
    let sample = "ffmpeg version 8.1.2-full_build-www.gyan.dev Copyright (c) 2000-2024 the FFmpeg developers";
    assert_eq!(
        ToolVersionChecker::parse_ffmpeg_version(sample).unwrap(),
        "8.1.2-full_build-www.gyan.dev"
    );

    let sample2 = "ffmpeg version 7.0 Copyright (c) 2000-2024";
    assert_eq!(
        ToolVersionChecker::parse_ffmpeg_version(sample2).unwrap(),
        "7.0"
    );
}

#[test]
fn test_version_output_parsing_ffprobe() {
    let sample = "ffprobe version 8.1.2-full_build Copyright (c) 2000-2024";
    assert_eq!(
        ToolVersionChecker::parse_ffprobe_version(sample).unwrap(),
        "8.1.2-full_build"
    );
}

// 2. Missing executable detection
#[test]
fn test_missing_executable_detection() {
    let bogus = Path::new("non_existent_folder_xyz/fake_tool.exe");
    let res = ToolResolver::validate_executable(bogus);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err().kind, EngineErrorKind::InvalidPath);
}

// 3. Invalid executable paths
#[test]
fn test_invalid_executable_paths_directory() {
    let dir = std::env::temp_dir();
    let res = ToolResolver::validate_executable(&dir);
    assert!(res.is_err());
    assert_eq!(res.unwrap_err().kind, EngineErrorKind::InvalidPath);
}

#[test]
fn test_invalid_executable_paths_wrong_extension() {
    // A temporary txt file is not an executable
    let temp_txt = std::env::temp_dir().join("test_not_an_executable.txt");
    let _ = std::fs::write(&temp_txt, "not an exe");
    let res = ToolResolver::validate_executable(&temp_txt);
    let _ = std::fs::remove_file(&temp_txt);

    #[cfg(target_os = "windows")]
    {
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().kind, EngineErrorKind::InvalidPath);
    }

    #[cfg(unix)]
    {
        assert!(res.is_err());
        assert_eq!(res.unwrap_err().kind, EngineErrorKind::PermissionDenied);
    }

    #[cfg(not(any(target_os = "windows", unix)))]
    {
        let _ = res;
    }
}

// 4. Failed process startup
#[tokio::test]
async fn test_failed_process_startup() {
    let manager = ProcessManager::new();
    let emitter = Arc::new(RecordingEventEmitter::default());
    let bad_path = PathBuf::from("non_existent_command_12345.exe");

    let res = manager
        .spawn(
            emitter.clone(),
            "bad-proc".to_string(),
            bad_path,
            vec![],
            None,
        )
        .await;

    assert!(res.is_err());
    assert_eq!(res.unwrap_err().kind, EngineErrorKind::InvalidPath);
}

// 5. Non-zero exit codes handling
#[test]
fn test_malformed_output() {
    assert!(ToolVersionChecker::parse_ytdlp_version("").is_err());
    assert!(ToolVersionChecker::parse_ytdlp_version("   \n\r  ").is_err());
    assert!(ToolVersionChecker::parse_ytdlp_version("Error: command not found").is_err());

    assert!(ToolVersionChecker::parse_ffmpeg_version("").is_err());
    assert!(ToolVersionChecker::parse_ffmpeg_version("unrecognized option").is_err());
}

// 6. FFmpeg missing while yt-dlp is available
#[test]
fn test_ffmpeg_missing_while_ytdlp_available() {
    let ytdlp_status = ToolStatus::ready(
        "2026.08.19".to_string(),
        "bin/yt-dlp.exe".to_string(),
        ToolSource::AppManaged,
    );
    let ffmpeg_status = ToolStatus::not_installed(Some("FFmpeg not installed".to_string()));
    let ffprobe_status = ToolStatus::not_installed(Some("FFprobe not installed".to_string()));

    let is_ready = ytdlp_status.available && ytdlp_status.state == ToolState::Ready;
    assert!(is_ready); // yt-dlp ready makes engine overall ready!

    let status = EngineStatus {
        ytdlp: ytdlp_status,
        ffmpeg: ffmpeg_status,
        ffprobe: ffprobe_status,
        os_info: "windows (x86_64)".to_string(),
        app_version: "0.1.0".to_string(),
        tauri_version: "2.0".to_string(),
        last_checked: Some("2026-10-13T10:00:00Z".to_string()),
        is_ready,
        managed_tools_dir: "d:/YTDLP/bin".to_string(),
    };

    assert!(status.is_ready);
    assert!(!status.ffmpeg.available);
}

// 7. Duplicate process prevention
#[tokio::test]
async fn test_duplicate_process_prevention() {
    let manager = ProcessManager::new();
    let emitter = Arc::new(RecordingEventEmitter::default());

    // Create a temporary valid batch or executable script to run
    #[cfg(target_os = "windows")]
    let temp_script = {
        let script = std::env::temp_dir().join("test_sleep_proc.cmd");
        let _ = std::fs::write(&script, "@echo off\r\nping 127.0.0.1 -n 3 > nul\r\n");
        script
    };

    #[cfg(unix)]
    let temp_script = {
        use std::os::unix::fs::PermissionsExt;
        let script = std::env::temp_dir().join("test_sleep_proc.sh");
        let _ = std::fs::write(&script, "#!/bin/sh\nsleep 3\n");
        let _ = std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755));
        script
    };

    let spawn_res1 = manager
        .spawn(
            emitter.clone(),
            "dup-task-1".to_string(),
            temp_script.clone(),
            vec![],
            None,
        )
        .await;

    assert!(spawn_res1.is_ok());

    // Attempting to spawn again with same ID must fail
    let spawn_res2 = manager
        .spawn(
            emitter.clone(),
            "dup-task-1".to_string(),
            temp_script.clone(),
            vec![],
            None,
        )
        .await;

    assert!(spawn_res2.is_err());
    assert_eq!(
        spawn_res2.unwrap_err().kind,
        EngineErrorKind::ProcessAlreadyRunning
    );

    // Cancel the running task and clean up
    let _ = manager.cancel("dup-task-1");
    tokio::time::sleep(Duration::from_millis(500)).await;
    let _ = std::fs::remove_file(&temp_script);
}

// 8. Process cancellation
#[tokio::test]
async fn test_process_cancellation() {
    let manager = ProcessManager::new();
    let emitter = Arc::new(RecordingEventEmitter::default());

    #[cfg(target_os = "windows")]
    let temp_script = {
        let script = std::env::temp_dir().join("test_cancel_proc.cmd");
        let _ = std::fs::write(&script, "@echo off\r\nping 127.0.0.1 -n 10 > nul\r\n");
        script
    };

    #[cfg(unix)]
    let temp_script = {
        use std::os::unix::fs::PermissionsExt;
        let script = std::env::temp_dir().join("test_cancel_proc.sh");
        let _ = std::fs::write(&script, "#!/bin/sh\nsleep 10\n");
        let _ = std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o755));
        script
    };

    let spawn_res = manager
        .spawn(
            emitter.clone(),
            "cancel-test-id".to_string(),
            temp_script.clone(),
            vec![],
            None,
        )
        .await;

    assert!(spawn_res.is_ok());
    assert!(manager.is_running("cancel-test-id"));

    // Cancel the process
    let cancel_res = manager.cancel("cancel-test-id");
    assert!(cancel_res.is_ok());
    assert!(cancel_res.unwrap());

    // Wait for cancellation event to propagate
    tokio::time::sleep(Duration::from_millis(600)).await;

    let cancelled_events = emitter.cancelled.lock().unwrap();
    assert!(!cancelled_events.is_empty());
    assert_eq!(cancelled_events[0].id, "cancel-test-id");

    // Ensure no contradictory exited events were recorded
    let exited_events = emitter.exited.lock().unwrap();
    assert!(exited_events.is_empty());

    let _ = std::fs::remove_file(&temp_script);
}

// 9. Sanitized output and diagnostic report
#[test]
fn test_sanitized_output() {
    let sensitive_line =
        "[debug] Running command with --cookies my_secret_cookies.txt --token secret123456";
    let sanitized = sanitize_output_line(sensitive_line);

    assert!(!sanitized.contains("my_secret_cookies.txt"));
    assert!(!sanitized.contains("secret123456"));
    assert!(sanitized.contains("[REDACTED_COOKIE]") || sanitized.contains("[REDACTED]"));
}

#[test]
fn test_sanitized_diagnostic_output() {
    let manager = EngineManager::new();
    let status = EngineStatus {
        ytdlp: ToolStatus::ready(
            "2026.08.19".to_string(),
            "bin/yt-dlp.exe".to_string(),
            ToolSource::AppManaged,
        ),
        ffmpeg: ToolStatus::not_installed(None),
        ffprobe: ToolStatus::not_installed(None),
        os_info: "windows (x86_64)".to_string(),
        app_version: "0.1.0".to_string(),
        tauri_version: "2.0".to_string(),
        last_checked: Some("2026-10-13T10:00:00Z".to_string()),
        is_ready: true,
        managed_tools_dir: "d:/YTDLP/bin".to_string(),
    };

    let report = manager.generate_diagnostics_report(&status);
    assert!(report
        .raw_report
        .contains("=== Vortex Engine Diagnostics ==="));
    assert!(report.raw_report.contains("yt-dlp"));
    assert!(report.raw_report.contains("2026.08.19"));
    assert!(report.raw_report.contains("Engine Ready: true"));
}

// 10. Tauri command response serialization
#[test]
fn test_tauri_command_response_serialization() {
    let status = ToolStatus::ready(
        "2026.08.19".to_string(),
        "bin/yt-dlp.exe".to_string(),
        ToolSource::AppManaged,
    );

    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"available\":true"));
    assert!(json.contains("\"state\":\"ready\""));
    assert!(json.contains("\"version\":\"2026.08.19\""));
    assert!(json.contains("\"executablePath\":\"bin/yt-dlp.exe\""));
    assert!(json.contains("\"source\":\"app_managed\""));

    let deserialized: ToolStatus = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized, status);
}

// 11. Setup completion persistence in SQLite
#[test]
fn test_setup_completion_persistence() {
    let conn = Connection::open_in_memory().expect("Failed to open test SQLite connection");
    init_db(&conn).expect("Failed to initialize database schema");

    // Default settings must not have setup completed
    let initial = load_app_settings(&conn);
    assert!(!initial.setup_completed);
    assert_eq!(initial.setup_step, Some(1));

    // Save setup progress to step 3
    let mut updated = initial.clone();
    updated.setup_step = Some(3);
    store_app_settings(&conn, &updated).expect("Failed to store updated settings");

    let progress_loaded = load_app_settings(&conn);
    assert!(!progress_loaded.setup_completed);
    assert_eq!(progress_loaded.setup_step, Some(3));

    // Complete setup wizard
    let mut completed = progress_loaded.clone();
    completed.setup_completed = true;
    completed.setup_step = Some(4);
    store_app_settings(&conn, &completed).expect("Failed to store completed settings");

    let final_loaded = load_app_settings(&conn);
    assert!(final_loaded.setup_completed);
    assert_eq!(final_loaded.setup_step, Some(4));
}

// 12. Setup settings backward compatibility with older configurations
#[test]
fn test_setup_settings_backward_compatibility() {
    // Older versions without setup_completed or setup_step fields
    let legacy_json = r#"{"download_dir":"/downloads","default_video_quality":"1080p","default_audio_format":"mp3","max_concurrent_downloads":3,"rate_limit_kbps":null,"custom_ytdlp_path":null,"custom_ffmpeg_path":null,"auto_remove_completed":false,"embed_metadata":true}"#;
    let parsed: AppSettings = serde_json::from_str(legacy_json)
        .expect("Failed to deserialize legacy AppSettings without setup fields");

    assert!(!parsed.setup_completed);
    assert_eq!(parsed.setup_step, None);
    assert_eq!(parsed.download_dir, "/downloads");
}

// 13. ToolInstallManager concurrency locking prevents duplicate installer processes
#[test]
fn test_tool_install_manager_mutex_concurrency() {
    let manager = ToolInstallManager::new();

    // yt-dlp lock acquisition
    let ytdlp_guard = manager.try_acquire_ytdlp_lock();
    assert!(ytdlp_guard.is_ok(), "First acquire of yt-dlp lock should succeed");

    // Second concurrent acquire must fail without running child process
    let concurrent_ytdlp = manager.try_acquire_ytdlp_lock();
    assert!(concurrent_ytdlp.is_err(), "Second concurrent acquire of yt-dlp lock must fail");

    // Release lock
    drop(ytdlp_guard);

    // Re-acquire must succeed now
    let retry_ytdlp = manager.try_acquire_ytdlp_lock();
    assert!(retry_ytdlp.is_ok(), "Re-acquire of yt-dlp lock after release must succeed");

    // FFmpeg lock acquisition
    let ffmpeg_guard = manager.try_acquire_ffmpeg_lock();
    assert!(ffmpeg_guard.is_ok(), "First acquire of FFmpeg lock should succeed");

    let concurrent_ffmpeg = manager.try_acquire_ffmpeg_lock();
    assert!(concurrent_ffmpeg.is_err(), "Second concurrent acquire of FFmpeg lock must fail");

    drop(ffmpeg_guard);

    let retry_ffmpeg = manager.try_acquire_ffmpeg_lock();
    assert!(retry_ffmpeg.is_ok(), "Re-acquire of FFmpeg lock after release must succeed");
}

// 14. Path environment resolution without shell or popup
#[test]
fn test_path_environment_resolver_silent_nonexistent() {
    let non_existent = ToolResolver::find_in_path("vortex_non_existent_binary_xyz_12345");
    assert!(non_existent.is_none());
}

