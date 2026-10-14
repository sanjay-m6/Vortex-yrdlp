use crate::models::{DownloadRequest, EngineError, FormatSelection, MediaType, OverwritePolicy};
use std::path::{Path, PathBuf};

/// Validates that the webpage URL is a legitimate HTTP/HTTPS address.
pub fn validate_url(url: &str) -> Result<(), EngineError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(EngineError::invalid_path("URL cannot be empty"));
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(EngineError::invalid_path(
            "URL must begin with http:// or https://",
        ));
    }

    if trimmed.starts_with("file://")
        || trimmed.starts_with("javascript:")
        || trimmed.starts_with("data:")
    {
        return Err(EngineError::permission_denied("Unsupported URL protocol"));
    }

    Ok(())
}

/// Validates that the output directory exists or can be created, has no path traversal, and is writable.
pub fn validate_output_directory(dir_str: &str) -> Result<PathBuf, EngineError> {
    let trimmed = dir_str.trim();
    if trimmed.is_empty() {
        return Err(EngineError::invalid_path(
            "Output directory cannot be empty",
        ));
    }

    let path = PathBuf::from(trimmed);

    // Check for obvious path traversal
    if trimmed.contains("..") {
        return Err(EngineError::permission_denied(
            "Path traversal '..' is not permitted in destination directory",
        ));
    }

    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| {
            EngineError::io(format!(
                "Failed to create output directory {:?}: {}",
                path, e
            ))
        })?;
    }

    if !path.is_dir() {
        return Err(EngineError::invalid_path(format!(
            "Destination {:?} is not a directory",
            path
        )));
    }

    // Verify writability with a small probe file
    let probe_file = path.join(".vortex_write_probe.tmp");
    match std::fs::write(&probe_file, b"ok") {
        Ok(_) => {
            let _ = std::fs::remove_file(probe_file);
        }
        Err(e) => {
            return Err(EngineError::permission_denied(format!(
                "Destination directory {:?} is not writable: {}",
                path, e
            )));
        }
    }

    Ok(path.canonicalize().unwrap_or(path))
}

/// Sanitizes filenames removing illegal characters and reserved device names.
pub fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "media_download".to_string();
    }

    // Disallowed characters in Windows & common filesystems: < > : " / \ | ? * and ASCII controls
    let filtered: String = trimmed
        .chars()
        .filter(|&c| {
            let code = c as u32;
            !(code <= 31
                || c == '<'
                || c == '>'
                || c == ':'
                || c == '"'
                || c == '/'
                || c == '\\'
                || c == '|'
                || c == '?'
                || c == '*')
        })
        .collect();

    let mut clean = filtered.trim_matches(&[' ', '.'][..]).to_string();

    // Check Windows reserved names
    let reserved_names = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
        "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
    ];

    let upper_stem = clean.split('.').next().unwrap_or("").to_uppercase();

    if reserved_names.contains(&upper_stem.as_str()) {
        clean = format!("_{}", clean);
    }

    if clean.is_empty() {
        return "media_download".to_string();
    }

    // Cap length to 180 chars
    if clean.len() > 180 {
        clean.truncate(180);
    }

    clean
}

/// Resolves format selection and request parameters into safe, structured yt-dlp CLI arguments.
pub fn build_ytdlp_args(
    request: &DownloadRequest,
    output_dir: &Path,
    ffmpeg_available: bool,
) -> Result<Vec<String>, EngineError> {
    validate_url(&request.webpage_url)?;

    let mut args = Vec::new();

    // 1. Structured machine-readable progress templates
    args.push("--newline".to_string());
    args.push("--progress-template".to_string());
    args.push(
        "download:[vortex_progress]%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress._percent_str)s|%(progress.filename)s"
            .to_string(),
    );
    args.push("--progress-template".to_string());
    args.push(
        "postprocess:[vortex_postprocess]%(progress.status)s|%(progress.postprocessor)s"
            .to_string(),
    );

    // 2. Output template and path
    let template = if let Some(ref snapshot) = request.settings_snapshot {
        snapshot
            .filename_template
            .clone()
            .or_else(|| request.filename_template.clone())
            .unwrap_or_else(|| "%(title).150B [%(id)s].%(ext)s".to_string())
    } else if let Some(ref tpl) = request.filename_template {
        let sanitized_tpl = sanitize_filename(tpl);
        if sanitized_tpl.contains("%(") {
            sanitized_tpl
        } else {
            format!("{}.%(ext)s", sanitized_tpl)
        }
    } else {
        "%(title).150B [%(id)s].%(ext)s".to_string()
    };

    let output_target = output_dir.join(template);
    args.push("-o".to_string());
    args.push(output_target.to_string_lossy().to_string());

    // 3. Format selection from snapshot or legacy format_selection
    if let Some(ref snapshot) = request.settings_snapshot {
        let resolution =
            crate::presets::resolver::resolve_preset_to_ytdlp_args(snapshot, ffmpeg_available)?;
        args.extend(resolution.args);
    } else {
        match &request.format_selection {
            FormatSelection::Best => {
                args.push("-f".to_string());
                args.push("bv*+ba/b".to_string());
            }
            FormatSelection::Preset(preset) => match preset.to_lowercase().as_str() {
                "4k" | "2160p" => {
                    args.push("-f".to_string());
                    args.push("bv*[height<=2160]+ba/b[height<=2160] / bv*+ba/b".to_string());
                }
                "1440p" | "2k" => {
                    args.push("-f".to_string());
                    args.push("bv*[height<=1440]+ba/b[height<=1440] / bv*+ba/b".to_string());
                }
                "1080p" => {
                    args.push("-f".to_string());
                    args.push("bv*[height<=1080]+ba/b[height<=1080] / bv*+ba/b".to_string());
                }
                "720p" => {
                    args.push("-f".to_string());
                    args.push("bv*[height<=720]+ba/b[height<=720] / bv*+ba/b".to_string());
                }
                "480p" => {
                    args.push("-f".to_string());
                    args.push("bv*[height<=480]+ba/b[height<=480] / bv*+ba/b".to_string());
                }
                "audio_best" | "mp3_320" => {
                    if !ffmpeg_available {
                        return Err(EngineError::not_found(
                        "FFmpeg is required to extract and convert audio streams. Please install FFmpeg or configure its path in Settings.",
                    ));
                    }
                    args.push("--extract-audio".to_string());
                    args.push("--audio-format".to_string());
                    args.push("mp3".to_string());
                    args.push("--audio-quality".to_string());
                    args.push("0".to_string());
                }
                "mp3_192" => {
                    if !ffmpeg_available {
                        return Err(EngineError::not_found(
                            "FFmpeg is required to extract and convert audio streams.",
                        ));
                    }
                    args.push("--extract-audio".to_string());
                    args.push("--audio-format".to_string());
                    args.push("mp3".to_string());
                    args.push("--audio-quality".to_string());
                    args.push("2".to_string());
                }
                "wav" => {
                    if !ffmpeg_available {
                        return Err(EngineError::not_found(
                            "FFmpeg is required for WAV audio extraction.",
                        ));
                    }
                    args.push("--extract-audio".to_string());
                    args.push("--audio-format".to_string());
                    args.push("wav".to_string());
                }
                _ => {
                    args.push("-f".to_string());
                    args.push("bv*+ba/b".to_string());
                }
            },
            FormatSelection::Custom(fmt_id) => {
                // Strictly validate format id characters to avoid argument injection
                let is_safe = fmt_id.chars().all(|c| {
                    c.is_ascii_alphanumeric()
                        || c == '+'
                        || c == '/'
                        || c == '-'
                        || c == '_'
                        || c == '.'
                });

                if !is_safe || fmt_id.is_empty() {
                    return Err(EngineError::invalid_path(format!(
                        "Invalid format identifier: '{}'",
                        fmt_id
                    )));
                }

                if fmt_id.contains('+') && !ffmpeg_available {
                    return Err(EngineError::not_found(
                    "FFmpeg is required to merge separate video and audio formats. Please configure FFmpeg in Settings.",
                ));
                }

                args.push("-f".to_string());
                args.push(fmt_id.clone());
            }
            FormatSelection::AudioOnly { format, quality } => {
                let valid_fmts = ["mp3", "m4a", "wav", "opus", "flac", "aac"];
                if !valid_fmts.contains(&format.to_lowercase().as_str()) {
                    return Err(EngineError::invalid_path(format!(
                        "Unsupported audio format: '{}'",
                        format
                    )));
                }

                if !ffmpeg_available && (format == "mp3" || format == "wav" || format == "flac") {
                    return Err(EngineError::not_found(
                    "FFmpeg is required to convert audio formats. Please configure FFmpeg in Settings.",
                ));
                }

                args.push("--extract-audio".to_string());
                args.push("--audio-format".to_string());
                args.push(format.to_lowercase());

                if let Some(ref q) = quality {
                    let q_clean: String = q.chars().filter(|c| c.is_ascii_digit()).collect();
                    if !q_clean.is_empty() {
                        args.push("--audio-quality".to_string());
                        args.push(q_clean);
                    }
                }
            }
        };

        // Media type constraint
        if request.media_type == MediaType::Audio && !args.iter().any(|a| a == "--extract-audio") {
            args.push("--extract-audio".to_string());
        }

        // Overwrite policy
        match request.overwrite_policy {
            OverwritePolicy::Overwrite => {
                args.push("--force-overwrites".to_string());
            }
            OverwritePolicy::Rename | OverwritePolicy::Skip => {
                args.push("--no-overwrites".to_string());
            }
        }
    }

    // Other safe defaults
    args.push("--no-playlist".to_string());
    args.push("--no-warnings".to_string());

    // Target URL
    args.push(request.webpage_url.clone());

    Ok(args)
}
