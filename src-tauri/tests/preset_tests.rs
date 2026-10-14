use vortex_lib::database::{
    delete_preset_by_id, fetch_all_presets, fetch_download_settings, fetch_preset_by_id, init_db,
    insert_or_update_preset, store_download_settings,
};
use vortex_lib::presets::builtins::{
    built_in_preset_ids, get_built_in_presets, is_built_in_preset,
};
use vortex_lib::presets::filename::{preview_filename_template, validate_filename_template};
use vortex_lib::presets::model::{
    AudioBitrate, AudioOutputFormat, DownloadPreset, FilenameCollisionPolicy, FolderRule,
    PresetMediaType,
};
use vortex_lib::presets::output::resolve_output_directory;
use vortex_lib::presets::resolver::{create_settings_snapshot, resolve_preset_to_ytdlp_args};
use rusqlite::Connection;

fn setup_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("failed to open in-memory db");
    init_db(&conn).expect("failed to initialize test db");
    conn
}

#[test]
fn test_built_in_presets_count_and_uniqueness() {
    let builtins = get_built_in_presets();
    assert_eq!(builtins.len(), 8);

    let mut ids = std::collections::HashSet::new();
    for p in &builtins {
        assert!(!p.name.is_empty());
        assert!(p.is_built_in);
        assert!(ids.insert(p.id.clone()), "Duplicate preset ID: {}", p.id);
        assert!(is_built_in_preset(&p.id));
    }

    let ids_list = built_in_preset_ids();
    assert_eq!(ids_list.len(), 8);
    assert!(ids_list.contains(&"best-quality"));
    assert!(ids_list.contains(&"1080p"));
    assert!(ids_list.contains(&"720p"));
    assert!(ids_list.contains(&"480p"));
    assert!(ids_list.contains(&"audio-only"));
    assert!(ids_list.contains(&"small-file"));
    assert!(ids_list.contains(&"mobile"));
    assert!(ids_list.contains(&"custom"));
}

#[test]
fn test_database_presets_seeding_and_crud() {
    let conn = setup_test_db();

    // 1. Check all built-ins are seeded
    let all_presets = fetch_all_presets(&conn).expect("fetch presets failed");
    assert!(all_presets.len() >= 8);

    // 2. Fetch specific preset
    let p_1080p = fetch_preset_by_id(&conn, "1080p").expect("fetch 1080p failed");
    assert!(p_1080p.is_some());
    let p_1080p = p_1080p.unwrap();
    assert_eq!(p_1080p.name, "1080p");
    assert!(p_1080p.is_built_in);

    // 3. Built-in cannot be deleted
    let delete_builtin_res = delete_preset_by_id(&conn, "1080p").expect("delete call failed");
    assert!(!delete_builtin_res, "Built-in preset must not be deletable");

    // 4. Create a custom preset
    let custom = DownloadPreset {
        id: "podcast-preset".to_string(),
        name: "My Podcast Preset".to_string(),
        description: "Custom MP3 at 192kbps".to_string(),
        is_built_in: false,
        media_type: PresetMediaType::AudioOnly,
        max_resolution: None,
        preferred_frame_rate: None,
        container_preference: None,
        video_codec_preference: None,
        audio_codec_preference: None,
        audio_output_format: Some(AudioOutputFormat::Mp3),
        audio_bitrate: Some(AudioBitrate::Kbps192),
        filename_template: Some("%(title).100B [%(upload_date)s].%(ext)s".to_string()),
        output_folder_rule: Some(FolderRule::Uploader),
        created_at: "2026-10-14T00:00:00Z".to_string(),
        updated_at: "2026-10-14T00:00:00Z".to_string(),
    };

    insert_or_update_preset(&conn, &custom).expect("insert custom failed");

    let fetched = fetch_preset_by_id(&conn, "podcast-preset").expect("fetch custom failed");
    assert!(fetched.is_some());
    let fetched = fetched.unwrap();
    assert_eq!(fetched.name, "My Podcast Preset");
    assert!(!fetched.is_built_in);
    assert_eq!(fetched.audio_bitrate, Some(AudioBitrate::Kbps192));

    // 5. Delete custom preset
    let delete_custom_res =
        delete_preset_by_id(&conn, "podcast-preset").expect("delete custom failed");
    assert!(delete_custom_res, "Custom preset should be deleted");

    let fetched_again = fetch_preset_by_id(&conn, "podcast-preset").expect("fetch custom failed");
    assert!(fetched_again.is_none());
}

#[test]
fn test_download_settings_persistence() {
    let conn = setup_test_db();

    // Default settings seeded
    let settings = fetch_download_settings(&conn);
    assert_eq!(settings.default_preset_id, "best-quality");
    assert_eq!(
        settings.filename_collision_policy,
        FilenameCollisionPolicy::Rename
    );

    // Update settings
    let mut modified = settings;
    modified.default_preset_id = "1080p".to_string();
    modified.filename_collision_policy = FilenameCollisionPolicy::Overwrite;
    modified.playlist_subfolder = true;

    store_download_settings(&conn, &modified).expect("store settings failed");

    let reloaded = fetch_download_settings(&conn);
    assert_eq!(reloaded.default_preset_id, "1080p");
    assert_eq!(
        reloaded.filename_collision_policy,
        FilenameCollisionPolicy::Overwrite
    );
    assert!(reloaded.playlist_subfolder);
}

#[test]
fn test_resolver_video_format_strings() {
    let builtins = get_built_in_presets();
    let temp_dir = std::env::temp_dir().to_string_lossy().to_string();

    // 1080p preset resolution
    let p_1080p = builtins.iter().find(|p| p.id == "1080p").unwrap();
    let snap_1080p = create_settings_snapshot(p_1080p, &temp_dir, None);
    let res = resolve_preset_to_ytdlp_args(&snap_1080p, true).unwrap();
    assert!(res.args.contains(&"-f".to_string()));
    let idx = res.args.iter().position(|a| a == "-f").unwrap();
    assert!(res.args[idx + 1].contains("height<=1080"));

    // 720p preset resolution
    let p_720p = builtins.iter().find(|p| p.id == "720p").unwrap();
    let snap_720p = create_settings_snapshot(p_720p, &temp_dir, None);
    let res = resolve_preset_to_ytdlp_args(&snap_720p, true).unwrap();
    let idx = res.args.iter().position(|a| a == "-f").unwrap();
    assert!(res.args[idx + 1].contains("height<=720"));

    // Audio only resolution
    let p_audio = builtins.iter().find(|p| p.id == "audio-only").unwrap();
    let snap_audio = create_settings_snapshot(p_audio, &temp_dir, None);
    let res = resolve_preset_to_ytdlp_args(&snap_audio, true).unwrap();
    assert!(res.args.contains(&"--extract-audio".to_string()));
    assert!(res.args.contains(&"--audio-format".to_string()));
    assert!(res.args.contains(&"mp3".to_string()));
}

#[test]
fn test_resolver_ffmpeg_enforcement() {
    let builtins = get_built_in_presets();
    let temp_dir = std::env::temp_dir().to_string_lossy().to_string();

    let p_audio = builtins.iter().find(|p| p.id == "audio-only").unwrap();
    let snap_audio = create_settings_snapshot(p_audio, &temp_dir, None);

    // When ffmpeg is available: ok
    assert!(resolve_preset_to_ytdlp_args(&snap_audio, true).is_ok());

    // When ffmpeg is not available: error with clear explanation
    let err = resolve_preset_to_ytdlp_args(&snap_audio, false).unwrap_err();
    assert!(err.message.contains("FFmpeg is required"));
}

#[test]
fn test_filename_template_preview_and_validation() {
    assert!(validate_filename_template("%(title)s - %(uploader)s [%(id)s].%(ext)s").is_ok());
    assert!(validate_filename_template("%(title).120B.%(ext)s").is_ok());

    // Injection & illegal syntax
    assert!(validate_filename_template("%(malicious); rm -rf /").is_err());
    assert!(validate_filename_template("%(invalid_field_123)s").is_err());

    // Preview
    let preview = preview_filename_template(
        "%(title)s by %(uploader)s [%(id)s].%(ext)s",
        Some("Awesome Song"),
        Some("xyz789"),
        Some("Artist Name"),
        None,
        None,
        None,
    )
    .expect("preview failed");

    assert_eq!(preview, "Awesome Song by Artist Name [xyz789].mp4");
}

#[test]
fn test_output_folder_rules() {
    let root = if cfg!(windows) {
        "C:\\Downloads"
    } else {
        "/home/user/Downloads"
    };

    let dir = resolve_output_directory(
        root,
        Some(FolderRule::Playlist),
        None,
        None,
        false,
        false,
        false,
        false,
        Some("My Favorite Tracks"),
        None,
        None,
    )
    .expect("resolve failed");

    assert!(dir.to_string_lossy().contains("My Favorite Tracks"));
}
