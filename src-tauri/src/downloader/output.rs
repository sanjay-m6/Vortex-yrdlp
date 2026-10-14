use crate::models::EngineError;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// Verifies that a downloaded media file actually exists, is not empty, and is not an incomplete temp file.
pub fn verify_output_file(path: &Path) -> Result<u64, EngineError> {
    if !path.exists() {
        return Err(EngineError::not_found(format!(
            "Final output file does not exist: {:?}",
            path
        )));
    }

    if !path.is_file() {
        return Err(EngineError::invalid_path(format!(
            "Final output path is not a file: {:?}",
            path
        )));
    }

    // Verify it is not an unfinished temporary file
    if let Some(ext) = path.extension() {
        let ext_str = ext.to_string_lossy().to_lowercase();
        if ext_str == "part" || ext_str == "ytdl" || ext_str == "temp" {
            return Err(EngineError::execution_failed(format!(
                "File appears to be an unfinished download: {:?}",
                path
            )));
        }
    }

    let meta = std::fs::metadata(path)
        .map_err(|e| EngineError::io(format!("Failed to read metadata for {:?}: {}", path, e)))?;

    if meta.len() == 0 {
        return Err(EngineError::execution_failed(format!(
            "Output file was created but is 0 bytes: {:?}",
            path
        )));
    }

    Ok(meta.len())
}

/// Discovers the most recently modified media file in the output directory if an exact path wasn't captured.
pub fn find_candidate_output(output_dir: &Path, title_hint: Option<&str>) -> Option<PathBuf> {
    let entries = std::fs::read_dir(output_dir).ok()?;
    let mut best_match: Option<(PathBuf, SystemTime)> = None;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ext_str == "part" || ext_str == "ytdl" || ext_str == "temp" {
                    continue;
                }
            }

            if let Some(hint) = title_hint {
                let filename = path.file_name().unwrap_or_default().to_string_lossy();
                let hint_words: Vec<&str> = hint.split_whitespace().collect();
                // If hint word matches
                if !hint_words.is_empty()
                    && !filename
                        .to_lowercase()
                        .contains(&hint_words[0].to_lowercase())
                {
                    continue;
                }
            }

            let mtime = entry
                .metadata()
                .and_then(|m| m.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            match best_match {
                None => best_match = Some((path, mtime)),
                Some((_, prev_mtime)) if mtime > prev_mtime => {
                    best_match = Some((path, mtime));
                }
                _ => {}
            }
        }
    }

    best_match.map(|(p, _)| p)
}

/// Safely removes temporary partial download files (.part, .ytdl, .temp) without deleting completed files.
pub fn cleanup_partial_files(output_dir: &Path, stem_hint: Option<&str>) {
    let entries = match std::fs::read_dir(output_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ext_str == "part" || ext_str == "ytdl" || ext_str == "temp" {
                    if let Some(hint) = stem_hint {
                        let fname = path.file_name().unwrap_or_default().to_string_lossy();
                        if !fname.contains(hint) {
                            continue;
                        }
                    }
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }
}
