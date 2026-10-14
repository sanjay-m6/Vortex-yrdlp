use regex::Regex;
use std::sync::LazyLock;

static RE_PERCENT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"\[download\]\s+([\d\.]+)%\s+of\s+(?:~\s*)?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)",
    )
    .unwrap()
});

static RE_100_PERCENT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\]\s+100%\s+of\s+([^\s]+)").unwrap());

static RE_DESTINATION: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[download\]\s+Destination:\s+(.+)").unwrap());

static RE_MERGER: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[(?:Merger|ffmpeg)\]\s+Merging formats into\s+[\x22']?([^\x22']+)[\x22']?")
        .unwrap()
});

static RE_EXTRACT_AUDIO: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[ExtractAudio\]\s+Destination:\s+(.+)").unwrap());

#[derive(Debug, Clone, Default)]
pub struct ParsedProgress {
    pub percentage: Option<f32>,
    pub total_size: Option<String>,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub current_step: Option<String>,
    pub output_path: Option<String>,
}

pub fn parse_ytdlp_line(line: &str) -> Option<ParsedProgress> {
    let trimmed = line.trim();

    if let Some(caps) = RE_PERCENT.captures(trimmed) {
        let percent = caps
            .get(1)
            .and_then(|m| m.as_str().parse::<f32>().ok())
            .unwrap_or(0.0);
        let total_size = caps.get(2).map(|m| m.as_str().to_string());
        let speed = caps.get(3).map(|m| m.as_str().to_string());
        let eta = caps.get(4).map(|m| m.as_str().to_string());

        return Some(ParsedProgress {
            percentage: Some(percent),
            total_size,
            speed,
            eta,
            current_step: Some("Downloading media stream...".to_string()),
            output_path: None,
        });
    }

    if let Some(caps) = RE_100_PERCENT.captures(trimmed) {
        let total_size = caps.get(1).map(|m| m.as_str().to_string());
        return Some(ParsedProgress {
            percentage: Some(100.0),
            total_size,
            speed: Some("Done".to_string()),
            eta: Some("00:00".to_string()),
            current_step: Some("Download complete, finalizing...".to_string()),
            output_path: None,
        });
    }

    if let Some(caps) = RE_MERGER.captures(trimmed) {
        let dest = caps.get(1).map(|m| m.as_str().trim().to_string());
        return Some(ParsedProgress {
            percentage: Some(99.0),
            total_size: None,
            speed: None,
            eta: None,
            current_step: Some("Muxing audio & video with FFmpeg...".to_string()),
            output_path: dest,
        });
    }

    if let Some(caps) = RE_EXTRACT_AUDIO.captures(trimmed) {
        let dest = caps.get(1).map(|m| m.as_str().trim().to_string());
        return Some(ParsedProgress {
            percentage: Some(99.0),
            total_size: None,
            speed: None,
            eta: None,
            current_step: Some("Extracting & converting audio...".to_string()),
            output_path: dest,
        });
    }

    if let Some(caps) = RE_DESTINATION.captures(trimmed) {
        let dest = caps.get(1).map(|m| m.as_str().trim().to_string());
        return Some(ParsedProgress {
            percentage: None,
            total_size: None,
            speed: None,
            eta: None,
            current_step: Some("Starting file write...".to_string()),
            output_path: dest,
        });
    }

    if trimmed.contains("[Merger]") || trimmed.contains("ffmpeg") {
        return Some(ParsedProgress {
            percentage: Some(98.0),
            total_size: None,
            speed: None,
            eta: None,
            current_step: Some("Processing with FFmpeg...".to_string()),
            output_path: None,
        });
    }

    None
}
