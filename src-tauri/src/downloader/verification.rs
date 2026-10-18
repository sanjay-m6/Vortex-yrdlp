use rusqlite::Connection;
use std::fs::File;
use std::path::{Path, PathBuf};

use crate::database::{
    fetch_completed_downloads_for_verification, fetch_media_item_by_id, relink_media_item,
    update_media_file_verification,
};
use crate::models::{EngineError, FileAvailability, MediaLibraryItem};

/// Safely inspects a file path on disk without shell execution or directory recursion.
pub fn verify_path_on_disk(path_str: &str) -> (FileAvailability, Option<u64>) {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return (FileAvailability::Unknown, None);
    }

    let path = Path::new(trimmed);

    // 1. Check existence
    if !path.exists() {
        return (FileAvailability::Missing, None);
    }

    // 2. Check metadata: must be a regular file
    let meta = match std::fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return (FileAvailability::Inaccessible, None),
    };

    if !meta.is_file() {
        return (FileAvailability::Inaccessible, None);
    }

    // 3. Check read access
    match File::open(path) {
        Ok(_) => (FileAvailability::Available, Some(meta.len())),
        Err(_) => (FileAvailability::Inaccessible, None),
    }
}

/// Verifies a single library item by task ID and updates SQLite record.
pub fn verify_item_by_id(conn: &Connection, id: &str) -> Result<MediaLibraryItem, EngineError> {
    let item = fetch_media_item_by_id(conn, id)
        .map_err(|e| EngineError::io(format!("Database error reading item '{}': {}", id, e)))?
        .ok_or_else(|| EngineError::not_found(format!("Media item '{}' not found", id)))?;

    if let Some(ref path_str) = item.output_path {
        let (availability, file_size) = verify_path_on_disk(path_str);
        let path = Path::new(path_str);
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e));

        update_media_file_verification(conn, id, availability, file_size, ext.as_deref())
            .map_err(|e| EngineError::io(format!("Failed to update verification status: {}", e)))?;
    } else {
        update_media_file_verification(conn, id, FileAvailability::Unknown, None, None)
            .map_err(|e| EngineError::io(format!("Failed to update verification status: {}", e)))?;
    }

    fetch_media_item_by_id(conn, id)
        .map_err(|e| EngineError::io(format!("Database error refreshing item '{}': {}", id, e)))?
        .ok_or_else(|| {
            EngineError::not_found(format!("Media item '{}' not found after verify", id))
        })
}

/// Batch-verifies completed library items to check file availability without blocking UI.
pub fn batch_verify_library(conn: &Connection, limit: usize) -> Result<usize, EngineError> {
    let items = fetch_completed_downloads_for_verification(conn, limit)
        .map_err(|e| EngineError::io(format!("Failed to fetch items for verification: {}", e)))?;

    let count = items.len();
    for (id, path_str) in items {
        let (availability, file_size) = verify_path_on_disk(&path_str);
        let path = Path::new(&path_str);
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{}", e));

        let _ = update_media_file_verification(conn, &id, availability, file_size, ext.as_deref());
    }

    Ok(count)
}

/// Relinks a missing or moved library file to a new user-selected location.
pub fn relink_file_service(
    conn: &Connection,
    id: &str,
    new_path_str: &str,
) -> Result<MediaLibraryItem, EngineError> {
    let trimmed = new_path_str.trim();
    if trimmed.is_empty() {
        return Err(EngineError::invalid_path("Target path cannot be empty"));
    }

    let path = Path::new(trimmed);
    if !path.exists() {
        return Err(EngineError::not_found(format!(
            "Target file does not exist at '{}'",
            trimmed
        )));
    }

    let meta = std::fs::metadata(path).map_err(|e| {
        EngineError::io(format!("Failed to read metadata for '{}': {}", trimmed, e))
    })?;

    if !meta.is_file() {
        return Err(EngineError::invalid_path(format!(
            "Target path '{}' is not a regular file",
            trimmed
        )));
    }

    // Verify read access
    File::open(path).map_err(|e| {
        EngineError::io(format!(
            "Target file '{}' is not accessible: {}",
            trimmed, e
        ))
    })?;

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e));

    relink_media_item(conn, id, trimmed, meta.len(), ext.as_deref())
        .map_err(|e| EngineError::io(format!("Failed to relink item in database: {}", e)))?;

    fetch_media_item_by_id(conn, id)
        .map_err(|e| EngineError::io(format!("Database error reading relinked item: {}", e)))?
        .ok_or_else(|| EngineError::not_found("Relinked item could not be retrieved"))
}

/// Safely deletes the media file on disk associated with a library record after explicit confirmation.
pub fn delete_media_file_on_disk(conn: &Connection, id: &str) -> Result<(), EngineError> {
    let item = fetch_media_item_by_id(conn, id)
        .map_err(|e| EngineError::io(format!("Database error reading item '{}': {}", id, e)))?
        .ok_or_else(|| EngineError::not_found(format!("Media item '{}' not found", id)))?;

    if let Some(ref path_str) = item.output_path {
        let path = Path::new(path_str);
        if path.exists() {
            if !path.is_file() {
                return Err(EngineError::invalid_path(
                    "Target is not a regular file; directory deletion is prohibited.",
                ));
            }

            std::fs::remove_file(path).map_err(|e| {
                EngineError::io(format!("Failed to delete file '{}': {}", path_str, e))
            })?;
        }

        // Mark as missing in SQLite
        let _ = update_media_file_verification(conn, id, FileAvailability::Missing, None, None);
    }

    // Also clean up any lingering partial files (.part, .ytdl, etc.) in the download output directory
    let out_dir: Option<String> = conn
        .query_row(
            "SELECT output_directory FROM downloads WHERE id = ?1",
            rusqlite::params![id],
            |r| r.get(0),
        )
        .ok()
        .flatten();

    if let Some(ref dir_str) = out_dir {
        let dir = Path::new(dir_str);
        if dir.exists() && dir.is_dir() {
            crate::downloader::output::cleanup_partial_files(dir, Some(&item.title));
        }
    }

    Ok(())
}

/// Opens the specified media file in the user's default OS player / application.
pub fn open_media_file(path_str: &str) -> Result<(), EngineError> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err(EngineError::invalid_path("File path is empty"));
    }

    #[cfg(target_os = "windows")]
    let clean_path = trimmed.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let clean_path = trimmed.to_string();

    let path = Path::new(&clean_path);
    if !path.exists() {
        return Err(EngineError::not_found(format!(
            "File '{}' does not exist on disk",
            clean_path
        )));
    }

    if !path.is_file() {
        return Err(EngineError::invalid_path(
            "Target path is not a regular file",
        ));
    }

    open::that_detached(&clean_path).map_err(|e| {
        EngineError::execution_failed(format!("Failed to open file '{}': {}", clean_path, e))
    })
}

/// Opens the containing directory in the OS file manager with the file selected/highlighted.
pub fn open_containing_folder(path_str: &str) -> Result<(), EngineError> {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return Err(EngineError::invalid_path("File path is empty"));
    }

    #[cfg(target_os = "windows")]
    {
        let clean_path = trimmed.replace('/', "\\");
        let path = PathBuf::from(&clean_path);
        if path.is_file() && path.exists() {
            let status = std::process::Command::new("explorer.exe")
                .arg(format!("/select,{}", clean_path))
                .spawn();
            if status.is_ok() {
                return Ok(());
            }
        }

        // If path is a directory and exists, open directly
        if path.is_dir() && path.exists() {
            return open::that_detached(&clean_path).map_err(|e| {
                EngineError::execution_failed(format!("Failed to open directory: {}", e))
            });
        }

        // Fallback to opening parent directory
        if let Some(parent) = path.parent() {
            if parent.exists() {
                return open::that_detached(parent).map_err(|e| {
                    EngineError::execution_failed(format!("Failed to open directory: {}", e))
                });
            }
        }
        Err(EngineError::not_found("Containing folder does not exist"))
    }

    #[cfg(target_os = "macos")]
    {
        if path.exists() {
            let status = std::process::Command::new("open")
                .args(["-R", trimmed])
                .spawn();
            if status.is_ok() {
                return Ok(());
            }
        }
        if let Some(parent) = path.parent() {
            if parent.exists() {
                return open::that_detached(parent).map_err(|e| {
                    EngineError::execution_failed(format!("Failed to open directory: {}", e))
                });
            }
        }
        Err(EngineError::not_found("Containing folder does not exist"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let target_dir = if path.is_file() {
            path.parent().unwrap_or(&path)
        } else {
            &path
        };
        open::that_detached(target_dir)
            .map_err(|e| EngineError::execution_failed(format!("Failed to open directory: {}", e)))
    }
}
