use super::filename::sanitize_filename_output;
use super::model::FolderRule;
use crate::models::EngineError;
use std::path::{Path, PathBuf};

/// Resolves the final output directory given the root directory, folder rules, and metadata.
pub fn resolve_output_directory(
    root_dir: &str,
    folder_rule: Option<FolderRule>,
    video_subfolder: Option<&str>,
    audio_subfolder: Option<&str>,
    playlist_subfolder: bool,
    uploader_subfolder: bool,
    date_subfolder: bool,
    is_audio_only: bool,
    playlist_title: Option<&str>,
    uploader: Option<&str>,
    upload_date: Option<&str>,
) -> Result<PathBuf, EngineError> {
    let root = PathBuf::from(root_dir);

    if !root.is_absolute() {
        return Err(EngineError::invalid_path(
            "Output directory must be an absolute path",
        ));
    }

    let mut path = root.clone();

    // Apply media type subfolder
    if is_audio_only {
        if let Some(audio_dir) = audio_subfolder {
            let sanitized = sanitize_folder_name(audio_dir);
            if !sanitized.is_empty() {
                path = path.join(&sanitized);
            }
        }
    } else if let Some(video_dir) = video_subfolder {
        let sanitized = sanitize_folder_name(video_dir);
        if !sanitized.is_empty() {
            path = path.join(&sanitized);
        }
    }

    // Apply folder rules based on explicit rule or boolean flags
    let use_playlist = matches!(folder_rule, Some(FolderRule::Playlist))
        || (folder_rule.is_none() && playlist_subfolder);
    let use_uploader = matches!(folder_rule, Some(FolderRule::Uploader))
        || (folder_rule.is_none() && uploader_subfolder);
    let use_date =
        matches!(folder_rule, Some(FolderRule::Date)) || (folder_rule.is_none() && date_subfolder);
    let use_media_type = matches!(folder_rule, Some(FolderRule::MediaType));

    if use_playlist {
        if let Some(title) = playlist_title {
            let sanitized = sanitize_folder_name(title);
            if !sanitized.is_empty() {
                path = path.join(&sanitized);
            }
        }
    } else if use_uploader {
        if let Some(name) = uploader {
            let sanitized = sanitize_folder_name(name);
            if !sanitized.is_empty() {
                path = path.join(&sanitized);
            }
        }
    } else if use_date {
        if let Some(date) = upload_date {
            let sanitized = sanitize_folder_name(date);
            if sanitized.len() >= 6 {
                let year = &sanitized[..4];
                let month = &sanitized[4..6];
                path = path.join(year).join(month);
            } else if !sanitized.is_empty() {
                path = path.join(&sanitized);
            }
        }
    } else if use_media_type {
        if is_audio_only {
            path = path.join("Audio");
        } else {
            path = path.join("Video");
        }
    }

    // Verify the resolved path is within the root directory
    validate_path_within_root(&path, &root)?;

    Ok(path)
}

/// Validates that a path does not escape the designated root directory.
pub fn validate_path_within_root(path: &Path, root: &Path) -> Result<(), EngineError> {
    // 1. Path must not contain '..' parent traversal
    for component in path.components() {
        if let std::path::Component::ParentDir = component {
            return Err(EngineError::permission_denied(
                "Path contains '..' component which could escape the output directory",
            ));
        }
    }

    // 2. Syntactic prefix check
    if !path.starts_with(root) {
        return Err(EngineError::permission_denied(format!(
            "Output path {:?} is outside the designated root {:?}",
            path, root
        )));
    }

    // 3. If root and path both exist on disk, ensure symlinks don't escape root
    if let (Ok(root_c), Ok(path_c)) = (root.canonicalize(), path.canonicalize()) {
        if !path_c.starts_with(&root_c) {
            return Err(EngineError::permission_denied(format!(
                "Output path {:?} resolves outside the designated root {:?}",
                path, root
            )));
        }
    }

    Ok(())
}

/// Sanitizes a folder name, removing invalid filesystem characters.
pub fn sanitize_folder_name(name: &str) -> String {
    let sanitized = sanitize_filename_output(name);
    // Additional folder-specific sanitization
    let cleaned: String = sanitized
        .chars()
        .map(|c| {
            if c == '.' && sanitized.starts_with('.') {
                '_'
            } else {
                c
            }
        })
        .collect();

    if cleaned.len() > 100 {
        cleaned.chars().take(100).collect()
    } else {
        cleaned
    }
}

/// Validates that a directory exists and is writable, or can be created.
pub fn validate_writable_directory(dir_path: &Path) -> Result<(), EngineError> {
    if !dir_path.exists() {
        std::fs::create_dir_all(dir_path).map_err(|e| {
            EngineError::io(format!(
                "Failed to create output directory {:?}: {}",
                dir_path, e
            ))
        })?;
    }

    if !dir_path.is_dir() {
        return Err(EngineError::invalid_path(format!(
            "{:?} exists but is not a directory",
            dir_path
        )));
    }

    // Probe writability
    let probe = dir_path.join(".vortex_write_probe.tmp");
    match std::fs::write(&probe, b"ok") {
        Ok(_) => {
            let _ = std::fs::remove_file(probe);
        }
        Err(e) => {
            return Err(EngineError::permission_denied(format!(
                "Directory {:?} is not writable: {}",
                dir_path, e
            )));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_folder_name() {
        assert_eq!(
            sanitize_folder_name("My Playlist: Best Of"),
            "My Playlist Best Of"
        );
        assert_eq!(sanitize_folder_name("../escape"), "escape");
    }

    #[test]
    fn test_folder_name_length_limit() {
        let long_name = "a".repeat(200);
        let result = sanitize_folder_name(&long_name);
        assert!(result.len() <= 100);
    }
}
