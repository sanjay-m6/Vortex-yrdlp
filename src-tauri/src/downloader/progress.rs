use crate::models::{DownloadProgress, DownloadState};
use regex::Regex;
use std::sync::LazyLock;

static RE_STANDARD_PERCENT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"\[download\]\s+([\d\.]+)%\s+of\s+(?:~\s*)?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)",
    )
    .unwrap()
});

static RE_DESTINATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\]\s+Destination:\s+(.+)").unwrap());

static RE_MERGER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[(?:Merger|ffmpeg)\]\s+Merging formats into\s+[\x22']?([^\x22']+)[\x22']?")
        .unwrap()
});

static RE_EXTRACT_AUDIO: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[ExtractAudio\]\s+Destination:\s+(.+)").unwrap());

pub fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.0} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

pub fn format_speed(bytes_per_sec: u64) -> String {
    format!("{}/s", format_bytes(bytes_per_sec))
}

pub fn format_eta(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{:02}:{:02}:{:02}", hours, minutes, secs)
    } else {
        format!("{:02}:{:02}", minutes, secs)
    }
}

pub fn parse_progress_line(raw_line: &str, current: &mut DownloadProgress) -> bool {
    let line = raw_line.trim();

    // 1. Structured machine-readable template line:
    // [vortex_progress]downloaded|total|estimate|speed|eta|percent|filename
    let progress_data = line
        .strip_prefix("[vortex_progress]")
        .or_else(|| line.strip_prefix("[mediadl_progress]"));

    if let Some(data) = progress_data {
        let parts: Vec<&str> = data.split('|').collect();
        if parts.len() >= 7 {
            let downloaded: u64 = parts[0].parse().unwrap_or(0);
            let total: Option<u64> = parts[1].parse().ok();
            let estimate: Option<u64> = parts[2].parse().ok();
            let speed: Option<u64> = parts[3].parse().ok();
            let eta: Option<u64> = parts[4].parse().ok();
            let percent_str = parts[5].trim().trim_end_matches('%');
            let percent: f32 = percent_str.parse().unwrap_or(0.0);
            let filename = parts[6].trim();

            current.percentage = percent.clamp(0.0, 100.0);
            current.downloaded_bytes = downloaded;
            current.downloaded_formatted = format_bytes(downloaded);

            let eff_total = total.or(estimate);
            current.total_bytes = eff_total;
            if let Some(t) = eff_total {
                current.total_formatted = format_bytes(t);
            }

            current.speed_bytes_per_sec = speed;
            if let Some(s) = speed {
                current.speed_formatted = format_speed(s);
            }

            current.eta_seconds = eta;
            if let Some(e) = eta {
                current.eta_formatted = format_eta(e);
            }

            if !filename.is_empty() && filename != "NA" {
                current.current_filename = Some(filename.to_string());
                current.output_path = Some(filename.to_string());
            }

            current.state = if current.percentage >= 99.5 {
                DownloadState::Processing
            } else {
                DownloadState::Downloading
            };
            current.stage = if current.state == DownloadState::Processing {
                "Finalizing stream...".to_string()
            } else {
                "Downloading...".to_string()
            };

            return true;
        }
    }

    // 2. Structured post-process template line:
    // [vortex_postprocess]status|postprocessor
    let postprocess_data = line
        .strip_prefix("[vortex_postprocess]")
        .or_else(|| line.strip_prefix("[mediadl_postprocess]"));

    if let Some(data) = postprocess_data {
        let parts: Vec<&str> = data.split('|').collect();
        let pp_name = if parts.len() >= 2 { parts[1] } else { "FFmpeg" };
        current.state = DownloadState::Processing;
        current.stage = format!("Processing with {}...", pp_name);
        return true;
    }

    // 3. Fallback: Standard yt-dlp terminal output lines
    if let Some(caps) = RE_STANDARD_PERCENT.captures(line) {
        if let Some(p) = caps.get(1).and_then(|m| m.as_str().parse::<f32>().ok()) {
            current.percentage = p.clamp(0.0, 100.0);
        }
        if let Some(total_str) = caps.get(2) {
            current.total_formatted = total_str.as_str().to_string();
        }
        if let Some(spd) = caps.get(3) {
            current.speed_formatted = spd.as_str().to_string();
        }
        if let Some(e) = caps.get(4) {
            current.eta_formatted = e.as_str().to_string();
        }

        current.state = if current.percentage >= 99.5 {
            DownloadState::Processing
        } else {
            DownloadState::Downloading
        };
        current.stage = if current.state == DownloadState::Processing {
            "Finalizing stream...".to_string()
        } else {
            "Downloading...".to_string()
        };
        return true;
    }

    if let Some(caps) = RE_MERGER.captures(line) {
        let dest = caps.get(1).map(|m| m.as_str().trim().to_string());
        current.state = DownloadState::Processing;
        current.percentage = 99.0;
        current.stage = "Muxing audio & video with FFmpeg...".to_string();
        if let Some(d) = dest {
            current.output_path = Some(d.clone());
            current.current_filename = Some(d);
        }
        return true;
    }

    if let Some(caps) = RE_EXTRACT_AUDIO.captures(line) {
        let dest = caps.get(1).map(|m| m.as_str().trim().to_string());
        current.state = DownloadState::Processing;
        current.percentage = 99.0;
        current.stage = "Extracting & converting audio...".to_string();
        if let Some(d) = dest {
            current.output_path = Some(d.clone());
            current.current_filename = Some(d);
        }
        return true;
    }

    if let Some(caps) = RE_DESTINATION.captures(line) {
        let dest = caps.get(1).map(|m| m.as_str().trim().to_string());
        if let Some(d) = dest {
            current.output_path = Some(d.clone());
            current.current_filename = Some(d);
        }
        return true;
    }

    if line.contains("[Merger]") || line.contains("[ffmpeg]") || line.contains("FixupM3u8") {
        current.state = DownloadState::Processing;
        current.percentage = 99.0;
        current.stage = "Post-processing with FFmpeg...".to_string();
        return true;
    }

    false
}
