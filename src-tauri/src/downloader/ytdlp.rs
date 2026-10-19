use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::downloader::parser::parse_ytdlp_line;
use crate::models::{
    DependencyStatus, DownloadOptions, DownloadProgressPayload, MediaMetadata, PlaylistEntry,
    VideoFormat,
};

pub fn resolve_ytdlp_path(custom_path: Option<&str>) -> Option<PathBuf> {
    if let Some(custom) = custom_path {
        let p = PathBuf::from(custom);
        if p.exists() {
            return Some(p);
        }
    }

    // Check project bin directory or executable adjacent bin
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let local_bin = current_dir.join("bin").join("yt-dlp.exe");
    if local_bin.exists() {
        return Some(local_bin);
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            let beside = parent.join("yt-dlp.exe");
            if beside.exists() {
                return Some(beside);
            }
            let beside_bin = parent.join("bin").join("yt-dlp.exe");
            if beside_bin.exists() {
                return Some(beside_bin);
            }
        }
    }

    // Check AppData Python Scripts directory
    if let Ok(appdata) = std::env::var("APPDATA") {
        let py_script = PathBuf::from(&appdata)
            .join("Python")
            .join("Python314")
            .join("Scripts")
            .join("yt-dlp.exe");
        if py_script.exists() {
            return Some(py_script);
        }
        // Generic Python Scripts search
        let py_root = PathBuf::from(&appdata).join("Python");
        if let Ok(entries) = std::fs::read_dir(&py_root) {
            for entry in entries.flatten() {
                let candidate = entry.path().join("Scripts").join("yt-dlp.exe");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    // Check PATH
    #[cfg(target_os = "windows")]
    {
        if let Some(paths) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&paths) {
                let p = dir.join("yt-dlp.exe");
                if p.is_file() {
                    return Some(p);
                }
            }
        }

        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("where.exe");
        cmd.arg("yt-dlp");
        cmd.creation_flags(0x08000000);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = stdout.lines().next() {
                    let p = PathBuf::from(first_line.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("which")
            .arg("yt-dlp")
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = stdout.lines().next() {
                    let p = PathBuf::from(first_line.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }

    None
}

pub fn resolve_ffmpeg_path(custom_path: Option<&str>) -> Option<PathBuf> {
    if let Some(custom) = custom_path {
        let p = PathBuf::from(custom);
        if p.exists() {
            return Some(p);
        }
    }

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let local_bin = current_dir.join("bin").join("ffmpeg.exe");
    if local_bin.exists() {
        return Some(local_bin);
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(paths) = std::env::var_os("PATH") {
            for dir in std::env::split_paths(&paths) {
                let p = dir.join("ffmpeg.exe");
                if p.is_file() {
                    return Some(p);
                }
            }
        }

        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("where.exe");
        cmd.arg("ffmpeg");
        cmd.creation_flags(0x08000000);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = stdout.lines().next() {
                    let p = PathBuf::from(first_line.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("which")
            .arg("ffmpeg")
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = stdout.lines().next() {
                    let p = PathBuf::from(first_line.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }

    None
}

pub async fn check_dependencies(
    custom_ytdlp: Option<String>,
    custom_ffmpeg: Option<String>,
) -> DependencyStatus {
    let ytdlp_path = resolve_ytdlp_path(custom_ytdlp.as_deref());
    let mut ytdlp_installed = false;
    let mut ytdlp_version = None;

    if let Some(ref path) = ytdlp_path {
        let mut cmd = tokio::process::Command::new(path);
        cmd.arg("--version");
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000);
        }
        if let Ok(output) = cmd.output().await {
            if output.status.success() {
                ytdlp_installed = true;
                ytdlp_version = Some(String::from_utf8_lossy(&output.stdout).trim().to_string());
            }
        }
    }

    let ffmpeg_path = resolve_ffmpeg_path(custom_ffmpeg.as_deref());
    let mut ffmpeg_installed = false;
    let mut ffmpeg_version = None;

    if let Some(ref path) = ffmpeg_path {
        let mut cmd = tokio::process::Command::new(path);
        cmd.arg("-version");
        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(0x08000000);
        }
        if let Ok(output) = cmd.output().await {
            if output.status.success() {
                ffmpeg_installed = true;
                let text = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = text.lines().next() {
                    ffmpeg_version = Some(line.trim().to_string());
                }
            }
        }
    }

    DependencyStatus {
        ytdlp_installed,
        ytdlp_version,
        ytdlp_path: ytdlp_path.map(|p| p.to_string_lossy().to_string()),
        ffmpeg_installed,
        ffmpeg_version,
        ffmpeg_path: ffmpeg_path.map(|p| p.to_string_lossy().to_string()),
    }
}

pub async fn analyze_url(url: &str, custom_ytdlp: Option<String>) -> Result<MediaMetadata, String> {
    let ytdlp_bin = resolve_ytdlp_path(custom_ytdlp.as_deref())
        .ok_or_else(|| "yt-dlp executable was not found. Please install yt-dlp.".to_string())?;

    let mut cmd = Command::new(&ytdlp_bin);
    cmd.args([
        "--dump-single-json",
        "--no-warnings",
        "--flat-playlist",
        url,
    ]);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }
    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(if err.trim().is_empty() {
            "yt-dlp failed to inspect URL.".to_string()
        } else {
            err.trim().to_string()
        });
    }

    let json_text = String::from_utf8_lossy(&output.stdout);
    let val: serde_json::Value = serde_json::from_str(&json_text)
        .map_err(|e| format!("Failed to parse yt-dlp metadata: {}", e))?;

    let is_playlist = val.get("_type").and_then(|v| v.as_str()) == Some("playlist");
    let title = val
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Title")
        .to_string();
    let id = val
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let thumbnail = val
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let uploader = val
        .get("uploader")
        .or_else(|| val.get("channel"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let uploader_url = val
        .get("uploader_url")
        .or_else(|| val.get("channel_url"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let duration = val.get("duration").and_then(|v| v.as_f64());
    let duration_string = val
        .get("duration_string")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let description = val
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let view_count = val.get("view_count").and_then(|v| v.as_u64());

    let mut playlist_entries = Vec::new();
    if let Some(entries) = val.get("entries").and_then(|e| e.as_array()) {
        for entry in entries {
            let entry_id = entry
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let entry_title = entry
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Untitled")
                .to_string();
            let entry_url = entry
                .get("url")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let entry_duration = entry.get("duration").and_then(|v| v.as_f64());
            playlist_entries.push(PlaylistEntry {
                id: entry_id,
                title: entry_title,
                url: entry_url,
                duration: entry_duration,
            });
        }
    }

    let mut formats = Vec::new();
    if let Some(fmts) = val.get("formats").and_then(|f| f.as_array()) {
        for fmt in fmts {
            let format_id = fmt
                .get("format_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let ext = fmt
                .get("ext")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let resolution = fmt
                .get("resolution")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let height = fmt.get("height").and_then(|v| v.as_u64()).map(|h| h as u32);
            let width = fmt.get("width").and_then(|v| v.as_u64()).map(|w| w as u32);
            let fps = fmt.get("fps").and_then(|v| v.as_f64());
            let filesize = fmt.get("filesize").and_then(|v| v.as_u64());
            let filesize_approx = fmt.get("filesize_approx").and_then(|v| v.as_u64());
            let vcodec = fmt
                .get("vcodec")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let acodec = fmt
                .get("acodec")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let tbr = fmt.get("tbr").and_then(|v| v.as_f64());
            let format_note = fmt
                .get("format_note")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            let is_audio_only =
                vcodec.as_deref() == Some("none") && acodec.as_deref() != Some("none");
            let is_video_only =
                acodec.as_deref() == Some("none") && vcodec.as_deref() != Some("none");
            let has_both = vcodec.as_deref() != Some("none") && acodec.as_deref() != Some("none");

            formats.push(VideoFormat {
                format_id,
                ext,
                resolution,
                height,
                width,
                fps,
                filesize,
                filesize_approx,
                vcodec,
                acodec,
                tbr,
                format_note,
                is_audio_only,
                is_video_only,
                has_both,
            });
        }
    }

    Ok(MediaMetadata {
        id,
        title,
        url: url.to_string(),
        thumbnail,
        uploader,
        uploader_url,
        duration,
        duration_string,
        description,
        view_count,
        formats,
        is_playlist,
        playlist_count: if is_playlist {
            Some(playlist_entries.len())
        } else {
            None
        },
        playlist_entries: if is_playlist {
            Some(playlist_entries)
        } else {
            None
        },
    })
}

pub async fn run_download(
    app: AppHandle,
    opts: DownloadOptions,
    custom_ytdlp: Option<String>,
    custom_ffmpeg: Option<String>,
    mut cancel_rx: oneshot::Receiver<()>,
) -> Result<String, String> {
    let ytdlp_bin = resolve_ytdlp_path(custom_ytdlp.as_deref())
        .ok_or_else(|| "yt-dlp executable was not found.".to_string())?;

    let download_dir = Path::new(&opts.download_dir);
    if !download_dir.exists() {
        let _ = std::fs::create_dir_all(download_dir);
    }

    let mut args = Vec::new();
    args.push("--newline".to_string());
    args.push("--progress".to_string());
    args.push("--no-colors".to_string());

    if let Some(ffmpeg_path) = resolve_ffmpeg_path(custom_ffmpeg.as_deref()) {
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg_path.to_string_lossy().to_string());
    }

    // Output template
    let out_template = if let Some(ref custom_name) = opts.custom_filename {
        if !custom_name.trim().is_empty() {
            download_dir
                .join(format!("{}.%(ext)s", custom_name.trim()))
                .to_string_lossy()
                .to_string()
        } else {
            download_dir
                .join("%(title)s.%(ext)s")
                .to_string_lossy()
                .to_string()
        }
    } else {
        download_dir
            .join("%(title)s.%(ext)s")
            .to_string_lossy()
            .to_string()
    };

    args.push("-o".to_string());
    args.push(out_template);

    // Audio vs Video options
    if opts.is_audio_only {
        args.push("--extract-audio".to_string());
        let audio_fmt = opts.audio_format.as_deref().unwrap_or("mp3");
        args.push("--audio-format".to_string());
        args.push(audio_fmt.to_string());

        if opts.quality_preset == "mp3_320" || opts.quality_preset == "audio_best" {
            args.push("--audio-quality".to_string());
            args.push("0".to_string());
        } else if opts.quality_preset == "mp3_192" {
            args.push("--audio-quality".to_string());
            args.push("2".to_string());
        } else if opts.quality_preset == "mp3_128" {
            args.push("--audio-quality".to_string());
            args.push("5".to_string());
        }
    } else {
        // Video format selection
        if let Some(ref fid) = opts.format_id {
            if !fid.is_empty() {
                args.push("-f".to_string());
                args.push(format!("{}+ba/b", fid));
            }
        } else {
            match opts.quality_preset.as_str() {
                "4k" => {
                    args.push("-f".to_string());
                    args.push("bv*[height<=2160]+ba/b[height<=2160] / bv*+ba/b".to_string());
                }
                "1440p" => {
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
                _ => {
                    args.push("-f".to_string());
                    args.push("bv*+ba/b".to_string());
                }
            }
        }
    }

    if opts.embed_thumbnail {
        args.push("--embed-thumbnail".to_string());
    }

    if opts.embed_subtitles {
        args.push("--embed-subs".to_string());
    }

    if let Some(ref indices) = opts.playlist_item_indices {
        if !indices.is_empty() {
            let items: Vec<String> = indices.iter().map(|i| i.to_string()).collect();
            args.push("--playlist-items".to_string());
            args.push(items.join(","));
        }
    } else {
        args.push("--no-playlist".to_string());
    }

    args.push(opts.url.clone());

    let mut cmd = Command::new(&ytdlp_bin);
    cmd.args(&args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to open child stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to open child stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut last_percentage: f32 = 0.0;
    let mut last_speed = "0 KB/s".to_string();
    let mut last_eta = "--:--".to_string();
    let mut total_size = "Unknown".to_string();
    let mut final_file_path: Option<String> = None;
    let mut error_lines: Vec<String> = Vec::new();

    // Initial event
    let _ = app.emit(
        "download-progress",
        DownloadProgressPayload {
            download_id: opts.id.clone(),
            status: "downloading".to_string(),
            percentage: 0.0,
            speed: "Starting...".to_string(),
            eta: "--:--".to_string(),
            downloaded_bytes: "0 MB".to_string(),
            total_bytes: "Calculating...".to_string(),
            current_step: "Initializing download stream...".to_string(),
            output_path: None,
            error_message: None,
        },
    );

    loop {
        tokio::select! {
            _ = &mut cancel_rx => {
                let _ = child.kill().await;
                let _ = app.emit(
                    "download-progress",
                    DownloadProgressPayload {
                        download_id: opts.id.clone(),
                        status: "cancelled".to_string(),
                        percentage: last_percentage,
                        speed: "0 KB/s".to_string(),
                        eta: "--:--".to_string(),
                        downloaded_bytes: "0 MB".to_string(),
                        total_bytes: total_size.clone(),
                        current_step: "Download cancelled by user".to_string(),
                        output_path: None,
                        error_message: Some("Download cancelled".to_string()),
                    },
                );
                return Err("Download cancelled by user".to_string());
            }

            line_res = stdout_reader.next_line() => {
                match line_res {
                    Ok(Some(line)) => {
                        if let Some(parsed) = parse_ytdlp_line(&line) {
                            if let Some(p) = parsed.percentage {
                                last_percentage = p;
                            }
                            if let Some(s) = parsed.speed {
                                last_speed = s;
                            }
                            if let Some(e) = parsed.eta {
                                last_eta = e;
                            }
                            if let Some(sz) = parsed.total_size {
                                total_size = sz;
                            }
                            if let Some(p) = parsed.output_path {
                                final_file_path = Some(p);
                            }

                            let _ = app.emit(
                                "download-progress",
                                DownloadProgressPayload {
                                    download_id: opts.id.clone(),
                                    status: if last_percentage >= 99.0 { "processing".to_string() } else { "downloading".to_string() },
                                    percentage: last_percentage,
                                    speed: last_speed.clone(),
                                    eta: last_eta.clone(),
                                    downloaded_bytes: format!("{:.1}%", last_percentage),
                                    total_bytes: total_size.clone(),
                                    current_step: parsed.current_step.unwrap_or_else(|| "Downloading...".to_string()),
                                    output_path: final_file_path.clone(),
                                    error_message: None,
                                },
                            );
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }

            err_line_res = stderr_reader.next_line() => {
                if let Ok(Some(line)) = err_line_res {
                    if !line.trim().is_empty() {
                        error_lines.push(line);
                    }
                }
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Process error: {}", e))?;

    if status.success() {
        let dest_path = final_file_path.unwrap_or_else(|| opts.download_dir.clone());

        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                download_id: opts.id.clone(),
                status: "completed".to_string(),
                percentage: 100.0,
                speed: "0 KB/s".to_string(),
                eta: "00:00".to_string(),
                downloaded_bytes: total_size.clone(),
                total_bytes: total_size.clone(),
                current_step: "Download completed successfully!".to_string(),
                output_path: Some(dest_path.clone()),
                error_message: None,
            },
        );

        Ok(dest_path)
    } else {
        let err_msg = if !error_lines.is_empty() {
            error_lines.join("\n")
        } else {
            "Download failed with non-zero exit code.".to_string()
        };

        let _ = app.emit(
            "download-progress",
            DownloadProgressPayload {
                download_id: opts.id.clone(),
                status: "error".to_string(),
                percentage: last_percentage,
                speed: "0 KB/s".to_string(),
                eta: "--:--".to_string(),
                downloaded_bytes: "0 MB".to_string(),
                total_bytes: total_size,
                current_step: "Failed".to_string(),
                output_path: None,
                error_message: Some(err_msg.clone()),
            },
        );

        Err(err_msg)
    }
}
