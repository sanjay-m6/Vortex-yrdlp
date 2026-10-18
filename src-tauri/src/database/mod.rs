use chrono::Utc;
use rusqlite::{params, Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

use crate::models::{
    AppSettings, DownloadAttemptRecord, DownloadRequest, DownloadState, FormatSelection,
    HistoryItem, MediaType, OverwritePolicy, QueueItem, QueuePriority,
};
use crate::presets::model::{DownloadPreset, DownloadSettings};

pub mod library;
pub use library::*;

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(&db_path)?;
        init_db(&conn)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }
}

pub fn init_db(conn: &Connection) -> Result<()> {
    // 1. Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // 2. Initialize schema with migrations
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            webpage_url TEXT NOT NULL,
            media_id TEXT,
            title TEXT NOT NULL,
            thumbnail_url TEXT,
            format_selection TEXT NOT NULL,
            media_type TEXT NOT NULL,
            output_directory TEXT NOT NULL,
            output_filename TEXT,
            status TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'normal',
            queue_position INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            error_code TEXT,
            error_message TEXT,
            downloaded_bytes INTEGER DEFAULT 0,
            total_bytes INTEGER,
            output_path TEXT
        );

        CREATE TABLE IF NOT EXISTS download_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            download_id TEXT NOT NULL REFERENCES downloads(id) ON DELETE CASCADE,
            attempt_number INTEGER NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            final_status TEXT NOT NULL,
            exit_code INTEGER,
            error_code TEXT,
            error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            thumbnail TEXT,
            duration REAL,
            file_path TEXT NOT NULL,
            file_size_bytes INTEGER,
            format_name TEXT NOT NULL,
            is_audio INTEGER NOT NULL,
            completed_at TEXT NOT NULL,
            status TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT
        );

        CREATE TABLE IF NOT EXISTS download_presets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            is_built_in INTEGER NOT NULL DEFAULT 0,
            preset_data TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_downloads_queue_position ON downloads(queue_position);
        CREATE INDEX IF NOT EXISTS idx_attempts_download_id ON download_attempts(download_id);
        CREATE INDEX IF NOT EXISTS idx_presets_builtin ON download_presets(is_built_in);
        ",
    )?;

    // 3. Migration: add settings_snapshot column to downloads if not present
    let has_snapshot_col: bool = conn
        .prepare(
            "SELECT COUNT(*) FROM pragma_table_info('downloads') WHERE name = 'settings_snapshot'",
        )?
        .query_row([], |row| row.get::<_, i64>(0))
        .unwrap_or(0)
        > 0;

    if !has_snapshot_col {
        conn.execute_batch("ALTER TABLE downloads ADD COLUMN settings_snapshot TEXT;")?;
    }

    // 4. Seed built-in presets idempotently
    seed_built_in_presets(conn)?;

    // 5. Seed default download settings if not present
    seed_default_download_settings(conn)?;

    // 6. Initialize Phase 8 Library schema and indexes
    init_library_schema(conn)?;

    Ok(())
}

// =========================================================================
// Downloads Table Persistence
// =========================================================================

pub fn insert_or_update_download(conn: &Connection, item: &QueueItem) -> Result<()> {
    let format_json = serde_json::to_string(&item.request.format_selection)
        .unwrap_or_else(|_| "\"best\"".to_string());
    let media_type_str = match item.request.media_type {
        MediaType::Video => "video",
        MediaType::Audio => "audio",
    };
    let status_str = format!("{:?}", item.status).to_lowercase();
    let priority_str = item.priority.as_str();
    let snapshot_json = item
        .request
        .settings_snapshot
        .as_ref()
        .and_then(|s| serde_json::to_string(s).ok());

    conn.execute(
        "INSERT INTO downloads (
            id, webpage_url, media_id, title, thumbnail_url, format_selection,
            media_type, output_directory, output_filename, status, priority,
            queue_position, created_at, updated_at, started_at, completed_at,
            error_code, error_message, downloaded_bytes, total_bytes, output_path,
            settings_snapshot, uploader, duration
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            thumbnail_url = excluded.thumbnail_url,
            status = excluded.status,
            priority = excluded.priority,
            queue_position = excluded.queue_position,
            updated_at = excluded.updated_at,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            error_code = excluded.error_code,
            error_message = excluded.error_message,
            downloaded_bytes = excluded.downloaded_bytes,
            total_bytes = excluded.total_bytes,
            output_path = excluded.output_path,
            settings_snapshot = COALESCE(excluded.settings_snapshot, downloads.settings_snapshot),
            uploader = COALESCE(excluded.uploader, downloads.uploader),
            duration = COALESCE(excluded.duration, downloads.duration)",
        params![
            item.id,
            item.request.webpage_url,
            item.id,
            item.request.title.as_deref().unwrap_or("Media Download"),
            item.request.thumbnail,
            format_json,
            media_type_str,
            item.request.output_directory,
            item.request.filename_template,
            status_str,
            priority_str,
            item.queue_position as i64,
            item.created_at,
            item.updated_at,
            item.started_at,
            item.completed_at,
            item.error_code,
            item.error_message,
            item.downloaded_bytes as i64,
            item.total_bytes.map(|b| b as i64),
            item.output_path,
            snapshot_json,
            item.request.uploader,
            item.request.duration,
        ],
    )?;

    Ok(())
}

pub fn update_download_status(
    conn: &Connection,
    id: &str,
    status: DownloadState,
    error_msg: Option<&str>,
    output_path: Option<&str>,
    completed_at: Option<&str>,
) -> Result<()> {
    let status_str = format!("{:?}", status).to_lowercase();
    let now = Utc::now().to_rfc3339();

    let (file_size_bytes, file_ext, file_avail) = if status == DownloadState::Completed {
        if let Some(path_str) = output_path {
            let path = std::path::Path::new(path_str);
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| format!(".{}", e));
            let size = std::fs::metadata(path).ok().map(|m| m.len() as i64);
            (size, ext, Some("available"))
        } else {
            (None, None, None)
        }
    } else {
        (None, None, None)
    };

    conn.execute(
        "UPDATE downloads SET
            status = ?1,
            error_message = ?2,
            output_path = COALESCE(?3, output_path),
            completed_at = COALESCE(?4, completed_at),
            updated_at = ?5,
            file_size_bytes = COALESCE(?6, file_size_bytes),
            file_extension = COALESCE(?7, file_extension),
            file_availability = COALESCE(?8, file_availability),
            last_verified_at = CASE WHEN ?8 IS NOT NULL THEN ?5 ELSE last_verified_at END
        WHERE id = ?9",
        params![
            status_str,
            error_msg,
            output_path,
            completed_at,
            now,
            file_size_bytes,
            file_ext,
            file_avail,
            id
        ],
    )?;

    Ok(())
}

pub fn update_download_progress(
    conn: &Connection,
    id: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET
            downloaded_bytes = ?1,
            total_bytes = COALESCE(?2, total_bytes),
            updated_at = ?3
        WHERE id = ?4",
        params![
            downloaded_bytes as i64,
            total_bytes.map(|b| b as i64),
            now,
            id
        ],
    )?;

    Ok(())
}

pub fn update_queue_positions(conn: &Connection, positions: &[(String, usize)]) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let tx = conn.unchecked_transaction()?;

    for (id, pos) in positions {
        tx.execute(
            "UPDATE downloads SET queue_position = ?1, updated_at = ?2 WHERE id = ?3",
            params![*pos as i64, now, id],
        )?;
    }

    tx.commit()?;
    Ok(())
}

pub fn update_download_priority(
    conn: &Connection,
    id: &str,
    priority: QueuePriority,
) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE downloads SET priority = ?1, updated_at = ?2 WHERE id = ?3",
        params![priority.as_str(), now, id],
    )?;
    Ok(())
}

pub fn fetch_all_downloads(conn: &Connection) -> Result<Vec<QueueItem>> {
    let mut stmt = conn.prepare(
        "SELECT
            d.id, d.webpage_url, d.media_id, d.title, d.thumbnail_url,
            d.format_selection, d.media_type, d.output_directory, d.output_filename,
            d.status, d.priority, d.queue_position, d.created_at, d.updated_at,
            d.started_at, d.completed_at, d.error_code, d.error_message,
            d.downloaded_bytes, d.total_bytes, d.output_path,
            (SELECT COUNT(*) FROM download_attempts a WHERE a.download_id = d.id) as attempts,
            d.settings_snapshot, d.uploader, d.duration
        FROM downloads d
        ORDER BY d.queue_position ASC, d.created_at ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let webpage_url: String = row.get(1)?;
        let title: String = row.get(3)?;
        let thumbnail: Option<String> = row.get(4)?;
        let format_json: String = row.get(5)?;
        let media_type_str: String = row.get(6)?;
        let output_directory: String = row.get(7)?;
        let output_filename: Option<String> = row.get(8)?;
        let status_str: String = row.get(9)?;
        let priority_str: String = row.get(10)?;
        let queue_position: i64 = row.get(11)?;
        let created_at: String = row.get(12)?;
        let updated_at: String = row.get(13)?;
        let started_at: Option<String> = row.get(14)?;
        let completed_at: Option<String> = row.get(15)?;
        let error_code: Option<String> = row.get(16)?;
        let error_message: Option<String> = row.get(17)?;
        let downloaded_bytes: i64 = row.get(18)?;
        let total_bytes: Option<i64> = row.get(19)?;
        let output_path: Option<String> = row.get(20)?;
        let attempt_count: i64 = row.get(21)?;
        let snapshot_json: Option<String> = row.get(22).ok();
        let uploader: Option<String> = row.get(23).ok();
        let duration: Option<f64> = row.get(24).ok();
        let settings_snapshot: Option<crate::presets::model::DownloadSettingsSnapshot> =
            snapshot_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
        let preset_id = settings_snapshot.as_ref().map(|s| s.preset_id.clone());

        let format_selection: FormatSelection =
            serde_json::from_str(&format_json).unwrap_or(FormatSelection::Best);
        let media_type = match media_type_str.as_str() {
            "audio" => MediaType::Audio,
            _ => MediaType::Video,
        };

        let status = match status_str.to_lowercase().as_str() {
            "starting" => DownloadState::Starting,
            "downloading" => DownloadState::Downloading,
            "processing" => DownloadState::Processing,
            "completed" => DownloadState::Completed,
            "failed" => DownloadState::Failed,
            "cancelling" => DownloadState::Cancelling,
            "cancelled" => DownloadState::Cancelled,
            _ => DownloadState::Queued,
        };

        let request = DownloadRequest {
            task_id: Some(id.clone()),
            webpage_url,
            format_selection,
            output_directory,
            filename_template: output_filename,
            media_type,
            overwrite_policy: OverwritePolicy::Rename,
            title: Some(title),
            uploader,
            thumbnail,
            duration,
            preset_id,
            settings_snapshot,
        };

        Ok(QueueItem {
            id,
            request,
            status,
            priority: QueuePriority::from_str(&priority_str),
            queue_position: queue_position.max(0) as usize,
            progress: None,
            created_at,
            updated_at,
            started_at,
            completed_at,
            error_code,
            error_message,
            output_path,
            downloaded_bytes: downloaded_bytes.max(0) as u64,
            total_bytes: total_bytes.map(|b| b.max(0) as u64),
            attempt_count: attempt_count.max(1) as u32,
        })
    })?;

    let mut result = Vec::new();
    for r in rows.flatten() {
        result.push(r);
    }
    Ok(result)
}

pub fn fetch_download_by_id(conn: &Connection, id: &str) -> Result<Option<QueueItem>> {
    let mut stmt = conn.prepare(
        "SELECT
            d.id, d.webpage_url, d.media_id, d.title, d.thumbnail_url,
            d.format_selection, d.media_type, d.output_directory, d.output_filename,
            d.status, d.priority, d.queue_position, d.created_at, d.updated_at,
            d.started_at, d.completed_at, d.error_code, d.error_message,
            d.downloaded_bytes, d.total_bytes, d.output_path,
            (SELECT COUNT(*) FROM download_attempts a WHERE a.download_id = d.id) as attempts,
            d.settings_snapshot, d.uploader, d.duration
        FROM downloads d
        WHERE d.id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let webpage_url: String = row.get(1)?;
        let title: String = row.get(3)?;
        let thumbnail: Option<String> = row.get(4)?;
        let format_json: String = row.get(5)?;
        let media_type_str: String = row.get(6)?;
        let output_directory: String = row.get(7)?;
        let output_filename: Option<String> = row.get(8)?;
        let status_str: String = row.get(9)?;
        let priority_str: String = row.get(10)?;
        let queue_position: i64 = row.get(11)?;
        let created_at: String = row.get(12)?;
        let updated_at: String = row.get(13)?;
        let started_at: Option<String> = row.get(14)?;
        let completed_at: Option<String> = row.get(15)?;
        let error_code: Option<String> = row.get(16)?;
        let error_message: Option<String> = row.get(17)?;
        let downloaded_bytes: i64 = row.get(18)?;
        let total_bytes: Option<i64> = row.get(19)?;
        let output_path: Option<String> = row.get(20)?;
        let attempt_count: i64 = row.get(21)?;
        let snapshot_json: Option<String> = row.get(22).ok();
        let uploader: Option<String> = row.get(23).ok();
        let duration: Option<f64> = row.get(24).ok();
        let settings_snapshot: Option<crate::presets::model::DownloadSettingsSnapshot> =
            snapshot_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok());
        let preset_id = settings_snapshot.as_ref().map(|s| s.preset_id.clone());

        let format_selection: FormatSelection =
            serde_json::from_str(&format_json).unwrap_or(FormatSelection::Best);
        let media_type = match media_type_str.as_str() {
            "audio" => MediaType::Audio,
            _ => MediaType::Video,
        };

        let status = match status_str.to_lowercase().as_str() {
            "starting" => DownloadState::Starting,
            "downloading" => DownloadState::Downloading,
            "processing" => DownloadState::Processing,
            "completed" => DownloadState::Completed,
            "failed" => DownloadState::Failed,
            "cancelling" => DownloadState::Cancelling,
            "cancelled" => DownloadState::Cancelled,
            _ => DownloadState::Queued,
        };

        let request = DownloadRequest {
            task_id: Some(id.clone()),
            webpage_url,
            format_selection,
            output_directory,
            filename_template: output_filename,
            media_type,
            overwrite_policy: OverwritePolicy::Rename,
            title: Some(title),
            uploader,
            thumbnail,
            duration,
            preset_id,
            settings_snapshot,
        };

        Ok(Some(QueueItem {
            id,
            request,
            status,
            priority: QueuePriority::from_str(&priority_str),
            queue_position: queue_position.max(0) as usize,
            progress: None,
            created_at,
            updated_at,
            started_at,
            completed_at,
            error_code,
            error_message,
            output_path,
            downloaded_bytes: downloaded_bytes.max(0) as u64,
            total_bytes: total_bytes.map(|b| b.max(0) as u64),
            attempt_count: attempt_count.max(1) as u32,
        }))
    } else {
        Ok(None)
    }
}

pub fn delete_download(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM downloads WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn clear_completed_downloads_db(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM downloads WHERE status = 'completed'", [])?;
    Ok(())
}

pub fn clear_failed_downloads_db(conn: &Connection) -> Result<()> {
    conn.execute(
        "DELETE FROM downloads WHERE status = 'failed' OR status = 'cancelled'",
        [],
    )?;
    Ok(())
}

// =========================================================================
// Download Attempts Persistence
// =========================================================================

pub fn record_attempt_start(
    conn: &Connection,
    download_id: &str,
    attempt_number: u32,
    started_at: &str,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO download_attempts (download_id, attempt_number, started_at, final_status)
         VALUES (?1, ?2, ?3, 'running')",
        params![download_id, attempt_number as i64, started_at],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn record_attempt_end(
    conn: &Connection,
    download_id: &str,
    attempt_number: u32,
    ended_at: &str,
    final_status: &str,
    exit_code: Option<i32>,
    error_code: Option<&str>,
    error_message: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE download_attempts SET
            ended_at = ?1,
            final_status = ?2,
            exit_code = ?3,
            error_code = ?4,
            error_message = ?5
        WHERE download_id = ?6 AND attempt_number = ?7",
        params![
            ended_at,
            final_status,
            exit_code,
            error_code,
            error_message,
            download_id,
            attempt_number as i64,
        ],
    )?;
    Ok(())
}

pub fn fetch_attempts_for_download(
    conn: &Connection,
    download_id: &str,
) -> Result<Vec<DownloadAttemptRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, download_id, attempt_number, started_at, ended_at, final_status, exit_code, error_code, error_message
         FROM download_attempts WHERE download_id = ?1 ORDER BY attempt_number ASC"
    )?;

    let rows = stmt.query_map(params![download_id], |row| {
        Ok(DownloadAttemptRecord {
            id: row.get(0)?,
            download_id: row.get(1)?,
            attempt_number: row.get::<_, i64>(2)? as u32,
            started_at: row.get(3)?,
            ended_at: row.get(4)?,
            final_status: row.get(5)?,
            exit_code: row.get(6)?,
            error_code: row.get(7)?,
            error_message: row.get(8)?,
        })
    })?;

    let mut result = Vec::new();
    for r in rows.flatten() {
        result.push(r);
    }
    Ok(result)
}

pub fn fetch_all_attempts(conn: &Connection) -> Result<Vec<DownloadAttemptRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, download_id, attempt_number, started_at, ended_at, final_status, exit_code, error_code, error_message
         FROM download_attempts ORDER BY download_id ASC, attempt_number ASC"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(DownloadAttemptRecord {
            id: row.get(0)?,
            download_id: row.get(1)?,
            attempt_number: row.get::<_, i64>(2)? as u32,
            started_at: row.get(3)?,
            ended_at: row.get(4)?,
            final_status: row.get(5)?,
            exit_code: row.get(6)?,
            error_code: row.get(7)?,
            error_message: row.get(8)?,
        })
    })?;

    let mut result = Vec::new();
    for r in rows.flatten() {
        result.push(r);
    }
    Ok(result)
}

// =========================================================================
// Settings Persistence
// =========================================================================

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
        params![key, value, now],
    )?;
    Ok(())
}

// =========================================================================
// History Legacy Support
// =========================================================================

pub fn add_history_entry(conn: &Connection, item: &HistoryItem) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO history (id, url, title, thumbnail, duration, file_path, file_size_bytes, format_name, is_audio, completed_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            item.id,
            item.url,
            item.title,
            item.thumbnail,
            item.duration,
            item.file_path,
            item.file_size_bytes,
            item.format_name,
            if item.is_audio { 1 } else { 0 },
            item.completed_at,
            item.status,
        ],
    )?;
    Ok(())
}

pub fn fetch_history(conn: &Connection) -> Result<Vec<HistoryItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, url, title, thumbnail, duration, file_path, file_size_bytes, format_name, is_audio, completed_at, status 
         FROM history ORDER BY completed_at DESC"
    )?;

    let rows = stmt.query_map([], |row| {
        let is_audio_int: i32 = row.get(8)?;
        Ok(HistoryItem {
            id: row.get(0)?,
            url: row.get(1)?,
            title: row.get(2)?,
            thumbnail: row.get(3)?,
            duration: row.get(4)?,
            file_path: row.get(5)?,
            file_size_bytes: row.get(6)?,
            format_name: row.get(7)?,
            is_audio: is_audio_int != 0,
            completed_at: row.get(9)?,
            status: row.get(10)?,
        })
    })?;

    let mut result = Vec::new();
    for item in rows.flatten() {
        result.push(item);
    }
    Ok(result)
}

pub fn delete_history(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM history WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn clear_all_history(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM history", [])?;
    Ok(())
}

pub fn load_app_settings(conn: &Connection) -> AppSettings {
    let mut stmt = match conn.prepare("SELECT value FROM settings WHERE key = 'app_settings'") {
        Ok(s) => s,
        Err(_) => return AppSettings::default(),
    };

    let mut rows = match stmt.query([]) {
        Ok(r) => r,
        Err(_) => return AppSettings::default(),
    };

    if let Ok(Some(row)) = rows.next() {
        if let Ok(json_str) = row.get::<_, String>(0) {
            if let Ok(settings) = serde_json::from_str::<AppSettings>(&json_str) {
                return settings;
            }
        }
    }

    AppSettings::default()
}

pub fn store_app_settings(conn: &Connection, settings: &AppSettings) -> Result<()> {
    let json_str = serde_json::to_string(settings).unwrap_or_default();
    set_setting(conn, "app_settings", &json_str)?;
    Ok(())
}

// =========================================================================
// Presets Persistence
// =========================================================================

pub fn seed_built_in_presets(conn: &Connection) -> Result<()> {
    let builtins = crate::presets::builtins::get_built_in_presets();
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO download_presets (id, name, description, is_built_in, preset_data, created_at, updated_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)"
    )?;

    for preset in builtins {
        let preset_json = serde_json::to_string(&preset).unwrap_or_default();
        stmt.execute(params![
            preset.id,
            preset.name,
            preset.description,
            preset_json,
            preset.created_at,
            preset.updated_at,
        ])?;
    }
    Ok(())
}

pub fn seed_default_download_settings(conn: &Connection) -> Result<()> {
    let existing = get_setting(conn, "download_settings")?;
    if existing.is_none() {
        let default_settings = DownloadSettings::default();
        let json_str = serde_json::to_string(&default_settings).unwrap_or_default();
        set_setting(conn, "download_settings", &json_str)?;
    }
    Ok(())
}

pub fn fetch_all_presets(conn: &Connection) -> Result<Vec<DownloadPreset>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, is_built_in, preset_data, created_at, updated_at
         FROM download_presets ORDER BY is_built_in DESC, name ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        let preset_data: String = row.get(4)?;
        if let Ok(preset) = serde_json::from_str::<DownloadPreset>(&preset_data) {
            Ok(preset)
        } else {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let description: String = row.get(2)?;
            let is_built_in: i64 = row.get(3)?;
            let created_at: String = row.get(5)?;
            let updated_at: String = row.get(6)?;
            Ok(DownloadPreset {
                id,
                name,
                description,
                is_built_in: is_built_in != 0,
                media_type: crate::presets::model::PresetMediaType::VideoWithAudio,
                max_resolution: Some(crate::presets::model::MaxResolution::Best),
                preferred_frame_rate: Some(crate::presets::model::PreferredFrameRate::Any),
                container_preference: Some(crate::presets::model::ContainerPreference::Auto),
                video_codec_preference: Some(crate::presets::model::VideoCodecPreference::Auto),
                audio_codec_preference: Some(crate::presets::model::AudioCodecPreference::Auto),
                audio_output_format: Some(crate::presets::model::AudioOutputFormat::Source),
                audio_bitrate: Some(crate::presets::model::AudioBitrate::Auto),
                filename_template: None,
                output_folder_rule: None,
                created_at,
                updated_at,
            })
        }
    })?;

    let mut result = Vec::new();
    for r in rows.flatten() {
        result.push(r);
    }
    Ok(result)
}

pub fn fetch_preset_by_id(conn: &Connection, id: &str) -> Result<Option<DownloadPreset>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, is_built_in, preset_data, created_at, updated_at
         FROM download_presets WHERE id = ?1",
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        let preset_data: String = row.get(4)?;
        if let Ok(preset) = serde_json::from_str::<DownloadPreset>(&preset_data) {
            Ok(Some(preset))
        } else {
            let pid: String = row.get(0)?;
            let name: String = row.get(1)?;
            let description: String = row.get(2)?;
            let is_built_in: i64 = row.get(3)?;
            let created_at: String = row.get(5)?;
            let updated_at: String = row.get(6)?;
            Ok(Some(DownloadPreset {
                id: pid,
                name,
                description,
                is_built_in: is_built_in != 0,
                media_type: crate::presets::model::PresetMediaType::VideoWithAudio,
                max_resolution: Some(crate::presets::model::MaxResolution::Best),
                preferred_frame_rate: Some(crate::presets::model::PreferredFrameRate::Any),
                container_preference: Some(crate::presets::model::ContainerPreference::Auto),
                video_codec_preference: Some(crate::presets::model::VideoCodecPreference::Auto),
                audio_codec_preference: Some(crate::presets::model::AudioCodecPreference::Auto),
                audio_output_format: Some(crate::presets::model::AudioOutputFormat::Source),
                audio_bitrate: Some(crate::presets::model::AudioBitrate::Auto),
                filename_template: None,
                output_folder_rule: None,
                created_at,
                updated_at,
            }))
        }
    } else {
        Ok(None)
    }
}

pub fn insert_or_update_preset(conn: &Connection, preset: &DownloadPreset) -> Result<()> {
    let preset_json = serde_json::to_string(preset).unwrap_or_default();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO download_presets (id, name, description, is_built_in, preset_data, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            preset_data = excluded.preset_data,
            updated_at = excluded.updated_at",
        params![
            preset.id,
            preset.name,
            preset.description,
            if preset.is_built_in { 1 } else { 0 },
            preset_json,
            preset.created_at,
            now,
        ],
    )?;

    Ok(())
}

pub fn delete_preset_by_id(conn: &Connection, id: &str) -> Result<bool> {
    // Check if it is a built-in preset
    let mut check_stmt = conn.prepare("SELECT is_built_in FROM download_presets WHERE id = ?1")?;
    let mut rows = check_stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        let is_built_in: i64 = row.get(0)?;
        if is_built_in != 0 {
            return Ok(false); // Cannot delete built-in presets
        }
    } else {
        return Ok(false); // Not found
    }

    let affected = conn.execute("DELETE FROM download_presets WHERE id = ?1", params![id])?;
    Ok(affected > 0)
}

pub fn reset_built_in_presets(conn: &Connection) -> Result<()> {
    let builtins = crate::presets::builtins::get_built_in_presets();
    let mut stmt = conn.prepare(
        "INSERT OR REPLACE INTO download_presets (id, name, description, is_built_in, preset_data, created_at, updated_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6)"
    )?;

    for preset in builtins {
        let preset_json = serde_json::to_string(&preset).unwrap_or_default();
        stmt.execute(params![
            preset.id,
            preset.name,
            preset.description,
            preset_json,
            preset.created_at,
            preset.updated_at,
        ])?;
    }
    Ok(())
}

pub fn fetch_download_settings(conn: &Connection) -> DownloadSettings {
    if let Ok(Some(json_str)) = get_setting(conn, "download_settings") {
        if let Ok(settings) = serde_json::from_str::<DownloadSettings>(&json_str) {
            return settings;
        }
    }
    DownloadSettings::default()
}

pub fn store_download_settings(conn: &Connection, settings: &DownloadSettings) -> Result<()> {
    let json_str = serde_json::to_string(settings).unwrap_or_default();
    set_setting(conn, "download_settings", &json_str)?;
    Ok(())
}
