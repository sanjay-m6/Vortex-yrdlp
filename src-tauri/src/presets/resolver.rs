use super::model::*;
use crate::engine::resolver::ToolResolver;
use crate::models::EngineError;
use crate::models::ToolType;

/// Resolves a DownloadPreset + overrides into yt-dlp CLI arguments.
/// All validation happens here in Rust — the frontend never provides raw CLI args.
pub fn resolve_preset_to_ytdlp_args(
    snapshot: &DownloadSettingsSnapshot,
    ffmpeg_available: bool,
) -> Result<PresetResolution, EngineError> {
    let mut args = Vec::new();
    let mut warnings = Vec::new();
    let mut ffmpeg_required = false;

    match snapshot.media_type {
        PresetMediaType::VideoWithAudio => {
            let format_string = build_video_format_string(snapshot, &mut warnings);
            args.push("-f".to_string());
            args.push(format_string.clone());

            // Check if format string implies merging (uses +)
            if format_string.contains('+') {
                ffmpeg_required = true;
            }

            // Container preference via --merge-output-format
            if let Some(container) = &snapshot.container_preference {
                match container {
                    ContainerPreference::Mp4 => {
                        args.push("--merge-output-format".to_string());
                        args.push("mp4".to_string());
                        ffmpeg_required = true;
                    }
                    ContainerPreference::Mkv => {
                        args.push("--merge-output-format".to_string());
                        args.push("mkv".to_string());
                        ffmpeg_required = true;
                    }
                    ContainerPreference::Webm => {
                        args.push("--merge-output-format".to_string());
                        args.push("webm".to_string());
                        ffmpeg_required = true;
                    }
                    ContainerPreference::Auto => {}
                }
            }
        }
        PresetMediaType::AudioOnly => {
            let audio_format = snapshot
                .audio_output_format
                .unwrap_or(AudioOutputFormat::Mp3);

            if audio_format.requires_ffmpeg() {
                ffmpeg_required = true;
            }

            args.push("--extract-audio".to_string());

            if let Some(fmt) = audio_format.as_ytdlp_format() {
                args.push("--audio-format".to_string());
                args.push(fmt.to_string());
            }

            if let Some(bitrate) = &snapshot.audio_bitrate {
                if let Some(quality) = bitrate.ytdlp_quality() {
                    args.push("--audio-quality".to_string());
                    args.push(quality.to_string());
                }
            }
        }
    }

    // Validate FFmpeg requirement
    if ffmpeg_required && !ffmpeg_available {
        return Err(EngineError::not_found(
            "FFmpeg is required for this preset configuration (stream merging or audio conversion). \
             Please install FFmpeg or configure its path in Settings."
        ));
    }

    // Filename collision policy
    match snapshot.filename_collision_policy {
        FilenameCollisionPolicy::Overwrite => {
            args.push("--force-overwrites".to_string());
        }
        FilenameCollisionPolicy::Rename | FilenameCollisionPolicy::Skip => {
            args.push("--no-overwrites".to_string());
        }
    }

    Ok(PresetResolution {
        args,
        warnings,
        ffmpeg_required,
    })
}

/// Builds the yt-dlp format selection string from preset video settings.
fn build_video_format_string(
    snapshot: &DownloadSettingsSnapshot,
    _warnings: &mut Vec<String>,
) -> String {
    let mut constraints = Vec::new();

    // Resolution constraint
    if let Some(max_res) = &snapshot.max_resolution {
        if let Some(height) = max_res.height_limit() {
            constraints.push(format!("height<={}", height));
        }
    }

    // Frame rate constraint
    if let Some(fps) = &snapshot.preferred_frame_rate {
        match fps {
            PreferredFrameRate::Fps30 => constraints.push("fps<=30".to_string()),
            PreferredFrameRate::Fps60 => constraints.push("fps<=60".to_string()),
            PreferredFrameRate::Any => {}
        }
    }

    // Video codec preference (soft preference via sorting, not hard constraint)
    let codec_sort = match &snapshot.video_codec_preference {
        Some(VideoCodecPreference::H264) => Some("+codec:avc"),
        Some(VideoCodecPreference::H265) => Some("+codec:hevc"),
        Some(VideoCodecPreference::Vp9) => Some("+codec:vp9"),
        Some(VideoCodecPreference::Av1) => Some("+codec:av1"),
        _ => None,
    };

    // Build format selection string
    // Pattern: bv*[constraints]+ba / b[constraints] / bv*+ba / b
    let constraint_str = if constraints.is_empty() {
        String::new()
    } else {
        format!("[{}]", constraints.join("]["))
    };

    let format_string = if constraint_str.is_empty() {
        "bv*+ba/b".to_string()
    } else {
        format!("bv*{}+ba/b{} / bv*+ba/b", constraint_str, constraint_str)
    };

    // If there's no height limit, simplify
    if constraints.is_empty() && codec_sort.is_none() {
        return "bv*+ba/b".to_string();
    }

    format_string
}

/// Validates all settings in a snapshot before allowing a download to be enqueued.
pub fn validate_download_settings(
    snapshot: &DownloadSettingsSnapshot,
    custom_ytdlp: Option<&str>,
    custom_ffmpeg: Option<&str>,
) -> SettingsValidationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // 1. Validate yt-dlp availability
    let ytdlp_available = ToolResolver::resolve_tool(ToolType::YtDlp, custom_ytdlp).is_some();
    if !ytdlp_available {
        errors.push(
            "yt-dlp executable not found. Please install yt-dlp or configure its path.".to_string(),
        );
    }

    // 2. Check FFmpeg
    let ffmpeg_available = ToolResolver::resolve_tool(ToolType::Ffmpeg, custom_ffmpeg).is_some();
    let ffmpeg_required = is_ffmpeg_required(snapshot);

    if ffmpeg_required && !ffmpeg_available {
        errors.push(
            "FFmpeg is required for this preset but is not available. \
             Stream merging or audio conversion will not work."
                .to_string(),
        );
    }

    // 3. Validate output directory
    let dir_path = std::path::Path::new(&snapshot.output_directory);
    if snapshot.output_directory.is_empty() {
        errors.push("Output directory is not set.".to_string());
    } else if !dir_path.is_absolute() {
        errors.push("Output directory must be an absolute path.".to_string());
    }

    // 4. Validate filename template if specified
    if let Some(ref template) = snapshot.filename_template {
        if let Err(e) = super::filename::validate_filename_template(template) {
            errors.push(format!("Invalid filename template: {}", e.message));
        }
    }

    // 5. Resolve format string for preview
    let resolved_format = match resolve_preset_to_ytdlp_args(snapshot, ffmpeg_available) {
        Ok(res) => {
            warnings.extend(res.warnings);
            // Extract the -f argument value
            let f_idx = res.args.iter().position(|a| a == "-f");
            f_idx.and_then(|i| res.args.get(i + 1).cloned())
        }
        Err(e) => {
            errors.push(e.message);
            None
        }
    };

    SettingsValidationResult {
        valid: errors.is_empty(),
        warnings,
        errors,
        ffmpeg_required,
        ffmpeg_available,
        resolved_format_string: resolved_format,
    }
}

/// Determines whether FFmpeg is required for the given settings.
fn is_ffmpeg_required(snapshot: &DownloadSettingsSnapshot) -> bool {
    match snapshot.media_type {
        PresetMediaType::AudioOnly => {
            let fmt = snapshot
                .audio_output_format
                .unwrap_or(AudioOutputFormat::Source);
            fmt.requires_ffmpeg()
        }
        PresetMediaType::VideoWithAudio => {
            // Merging separate streams requires FFmpeg
            // Container conversion requires FFmpeg
            let needs_container = matches!(
                snapshot.container_preference,
                Some(ContainerPreference::Mp4)
                    | Some(ContainerPreference::Mkv)
                    | Some(ContainerPreference::Webm)
            );
            // When resolution is specified, separate streams may be merged
            let needs_merge = snapshot
                .max_resolution
                .as_ref()
                .map(|r| r != &MaxResolution::Best)
                .unwrap_or(false);

            needs_container || needs_merge
        }
    }
}

/// Creates a DownloadSettingsSnapshot from a preset and optional overrides.
pub fn create_settings_snapshot(
    preset: &DownloadPreset,
    output_directory: &str,
    overrides: Option<&DownloadSettingsOverrides>,
) -> DownloadSettingsSnapshot {
    let has_overrides = overrides.is_some();

    let mut snapshot = DownloadSettingsSnapshot {
        preset_id: preset.id.clone(),
        preset_name: preset.name.clone(),
        media_type: preset.media_type,
        max_resolution: preset.max_resolution,
        preferred_frame_rate: preset.preferred_frame_rate,
        container_preference: preset.container_preference,
        video_codec_preference: preset.video_codec_preference,
        audio_codec_preference: preset.audio_codec_preference,
        audio_output_format: preset.audio_output_format,
        audio_bitrate: preset.audio_bitrate,
        filename_template: preset.filename_template.clone(),
        output_folder_rule: preset.output_folder_rule,
        output_directory: output_directory.to_string(),
        filename_collision_policy: FilenameCollisionPolicy::Rename,
        has_overrides,
    };

    // Apply overrides
    if let Some(ov) = overrides {
        if let Some(mt) = ov.media_type {
            snapshot.media_type = mt;
        }
        if let Some(res) = ov.max_resolution {
            snapshot.max_resolution = Some(res);
        }
        if let Some(fps) = ov.preferred_frame_rate {
            snapshot.preferred_frame_rate = Some(fps);
        }
        if let Some(container) = ov.container_preference {
            snapshot.container_preference = Some(container);
        }
        if let Some(vcodec) = ov.video_codec_preference {
            snapshot.video_codec_preference = Some(vcodec);
        }
        if let Some(acodec) = ov.audio_codec_preference {
            snapshot.audio_codec_preference = Some(acodec);
        }
        if let Some(afmt) = ov.audio_output_format {
            snapshot.audio_output_format = Some(afmt);
        }
        if let Some(bitrate) = ov.audio_bitrate {
            snapshot.audio_bitrate = Some(bitrate);
        }
        if let Some(ref tpl) = ov.filename_template {
            snapshot.filename_template = Some(tpl.clone());
        }
        if let Some(dir) = &ov.output_directory {
            snapshot.output_directory = dir.clone();
        }
        if let Some(policy) = ov.filename_collision_policy {
            snapshot.filename_collision_policy = policy;
        }
    }

    snapshot
}

/// Per-download overrides the user can apply before enqueueing.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSettingsOverrides {
    pub media_type: Option<PresetMediaType>,
    pub max_resolution: Option<MaxResolution>,
    pub preferred_frame_rate: Option<PreferredFrameRate>,
    pub container_preference: Option<ContainerPreference>,
    pub video_codec_preference: Option<VideoCodecPreference>,
    pub audio_codec_preference: Option<AudioCodecPreference>,
    pub audio_output_format: Option<AudioOutputFormat>,
    pub audio_bitrate: Option<AudioBitrate>,
    pub filename_template: Option<String>,
    pub output_directory: Option<String>,
    pub filename_collision_policy: Option<FilenameCollisionPolicy>,
}

use serde::{Deserialize, Serialize};

/// The result of resolving a preset into yt-dlp arguments.
#[derive(Debug, Clone)]
pub struct PresetResolution {
    pub args: Vec<String>,
    pub warnings: Vec<String>,
    pub ffmpeg_required: bool,
}
