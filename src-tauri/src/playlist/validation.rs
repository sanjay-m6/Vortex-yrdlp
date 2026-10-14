use crate::downloader::validation::sanitize_filename;
use crate::models::EngineError;

/// Validates that the playlist URL is a valid HTTP/HTTPS address.
pub fn validate_playlist_url(url: &str) -> Result<(), EngineError> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return Err(EngineError::invalid_path("Playlist URL cannot be empty"));
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err(EngineError::invalid_path(
            "Playlist URL must begin with http:// or https://",
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

/// Detects whether a URL is likely to contain a playlist.
pub fn is_likely_playlist(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains("list=") || lower.contains("/playlist") || lower.contains("/album")
}

/// Sanitizes a playlist title to create a safe subfolder name.
pub fn sanitize_subfolder_name(title: &str) -> String {
    let sanitized = sanitize_filename(title);
    if sanitized.is_empty() {
        "Playlist_Media".to_string()
    } else {
        sanitized
    }
}
