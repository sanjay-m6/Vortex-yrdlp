use crate::models::EngineError;

/// Approved template fields for filename templates.
const APPROVED_FIELDS: &[&str] = &[
    "title",
    "id",
    "uploader",
    "upload_date",
    "playlist_title",
    "playlist_index",
    "ext",
    "epoch",
    "channel",
    "channel_id",
    "view_count",
    "like_count",
    "duration",
    "duration_string",
    "format_id",
    "resolution",
    "height",
    "width",
    "fps",
    "format_note",
    "webpage_url_basename",
];

/// Maximum allowed filename length after template expansion.
pub const MAX_FILENAME_LENGTH: usize = 200;

/// Validates a filename template string for safety.
/// Templates use yt-dlp's %(field)s syntax.
pub fn validate_filename_template(template: &str) -> Result<(), EngineError> {
    if template.trim().is_empty() {
        return Err(EngineError::invalid_path(
            "Filename template cannot be empty",
        ));
    }

    if template.len() > 500 {
        return Err(EngineError::invalid_path(
            "Filename template is too long (max 500 characters)",
        ));
    }

    // Prevent path traversal
    if template.contains("..") || template.contains('/') || template.contains('\\') {
        return Err(EngineError::permission_denied(
            "Filename template cannot contain path separators or '..' sequences",
        ));
    }

    // Prevent shell injection characters
    let dangerous_chars = ['`', '$', '|', ';', '&', '>', '<', '\n', '\r', '\0'];
    for c in dangerous_chars {
        if template.contains(c) {
            return Err(EngineError::permission_denied(format!(
                "Filename template contains forbidden character: '{}'",
                c.escape_default()
            )));
        }
    }

    // Validate template field references
    let mut i = 0;
    let bytes = template.as_bytes();
    while i < bytes.len() {
        if i + 1 < bytes.len() && bytes[i] == b'%' && bytes[i + 1] == b'(' {
            // Find the closing )s
            let start = i + 2;
            let mut end = start;
            while end < bytes.len() && bytes[end] != b')' {
                end += 1;
            }

            if end >= bytes.len() {
                return Err(EngineError::invalid_path(
                    "Unclosed template field reference: missing ')s'",
                ));
            }

            let field_spec = &template[start..end];
            // The field name can have .NB suffixes (e.g. %(title).150B)
            let field_name = field_spec.split('.').next().unwrap_or(field_spec);
            let field_name = field_name.split(':').next().unwrap_or(field_name);

            if !APPROVED_FIELDS.contains(&field_name) {
                return Err(EngineError::invalid_path(format!(
                    "Unsupported template field '{}'. Approved fields: {}",
                    field_name,
                    APPROVED_FIELDS.join(", ")
                )));
            }

            i = end + 1;
        } else {
            i += 1;
        }
    }

    Ok(())
}

/// Previews what a filename template would produce given sample metadata.
pub fn preview_filename_template(
    template: &str,
    title: Option<&str>,
    id: Option<&str>,
    uploader: Option<&str>,
    upload_date: Option<&str>,
    playlist_title: Option<&str>,
    playlist_index: Option<u32>,
) -> Result<String, EngineError> {
    validate_filename_template(template)?;

    let mut result = template.to_string();

    // Simple replacements for preview purposes
    let replacements: Vec<(&str, String)> = vec![
        (
            "%(title)s",
            title.unwrap_or("Sample Video Title").to_string(),
        ),
        ("%(id)s", id.unwrap_or("dQw4w9WgXcQ").to_string()),
        (
            "%(uploader)s",
            uploader.unwrap_or("Channel Name").to_string(),
        ),
        (
            "%(upload_date)s",
            upload_date.unwrap_or("20241014").to_string(),
        ),
        (
            "%(playlist_title)s",
            playlist_title.unwrap_or("My Playlist").to_string(),
        ),
        (
            "%(playlist_index)s",
            playlist_index
                .map(|i| i.to_string())
                .unwrap_or("01".to_string()),
        ),
        ("%(ext)s", "mp4".to_string()),
        (
            "%(channel)s",
            uploader.unwrap_or("Channel Name").to_string(),
        ),
        ("%(resolution)s", "1920x1080".to_string()),
        ("%(duration_string)s", "10:30".to_string()),
    ];

    for (pattern, value) in &replacements {
        result = result.replace(pattern, value);
    }

    // Handle truncation patterns like %(title).150B
    let re_pattern = regex::Regex::new(r"%\((\w+)\)\.(\d+)B").unwrap();
    let captures: Vec<(String, String, usize)> = re_pattern
        .captures_iter(&result)
        .map(|cap| {
            let full = cap[0].to_string();
            let field = cap[1].to_string();
            let max_len: usize = cap[2].parse().unwrap_or(150);
            (full, field, max_len)
        })
        .collect();

    for (full_match, field, max_len) in captures {
        let value = match field.as_str() {
            "title" => title.unwrap_or("Sample Video Title"),
            "id" => id.unwrap_or("dQw4w9WgXcQ"),
            "uploader" | "channel" => uploader.unwrap_or("Channel Name"),
            _ => &field,
        };

        let truncated: String = value.chars().take(max_len).collect();
        result = result.replace(&full_match, &truncated);
    }

    // Sanitize result
    let sanitized = sanitize_filename_output(&result);

    if sanitized.is_empty() {
        return Ok("media_download.mp4".to_string());
    }

    // Limit length
    let final_name = if sanitized.len() > MAX_FILENAME_LENGTH {
        let mut s: String = sanitized.chars().take(MAX_FILENAME_LENGTH).collect();
        // Try to preserve extension
        if let Some(dot_pos) = sanitized.rfind('.') {
            let ext = &sanitized[dot_pos..];
            if ext.len() <= 10 {
                s.truncate(MAX_FILENAME_LENGTH - ext.len());
                s.push_str(ext);
            }
        }
        s
    } else {
        sanitized
    };

    Ok(final_name)
}

/// Sanitizes a generated filename, removing invalid filesystem characters.
/// Preserves Unicode but removes characters forbidden on Windows.
pub fn sanitize_filename_output(name: &str) -> String {
    let filtered: String = name
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
        "media_download".to_string()
    } else {
        clean
    }
}

/// Returns the set of approved template field names for the frontend.
pub fn approved_template_fields() -> Vec<TemplateField> {
    vec![
        TemplateField {
            name: "title".to_string(),
            description: "Media title".to_string(),
            example: "My Video Title".to_string(),
        },
        TemplateField {
            name: "id".to_string(),
            description: "Media identifier".to_string(),
            example: "dQw4w9WgXcQ".to_string(),
        },
        TemplateField {
            name: "uploader".to_string(),
            description: "Uploader or channel name".to_string(),
            example: "Channel Name".to_string(),
        },
        TemplateField {
            name: "upload_date".to_string(),
            description: "Upload date (YYYYMMDD)".to_string(),
            example: "20241014".to_string(),
        },
        TemplateField {
            name: "playlist_title".to_string(),
            description: "Playlist name".to_string(),
            example: "My Playlist".to_string(),
        },
        TemplateField {
            name: "playlist_index".to_string(),
            description: "Position in playlist".to_string(),
            example: "01".to_string(),
        },
        TemplateField {
            name: "ext".to_string(),
            description: "File extension".to_string(),
            example: "mp4".to_string(),
        },
        TemplateField {
            name: "resolution".to_string(),
            description: "Video resolution".to_string(),
            example: "1920x1080".to_string(),
        },
        TemplateField {
            name: "duration_string".to_string(),
            description: "Duration".to_string(),
            example: "10:30".to_string(),
        },
    ]
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateField {
    pub name: String,
    pub description: String,
    pub example: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_template() {
        assert!(validate_filename_template("%(title)s.%(ext)s").is_ok());
    }

    #[test]
    fn test_valid_template_with_truncation() {
        assert!(validate_filename_template("%(title).150B [%(id)s].%(ext)s").is_ok());
    }

    #[test]
    fn test_empty_template_rejected() {
        assert!(validate_filename_template("").is_err());
    }

    #[test]
    fn test_path_traversal_rejected() {
        assert!(validate_filename_template("../%(title)s.%(ext)s").is_err());
        assert!(validate_filename_template("%(title)s/../secret.%(ext)s").is_err());
    }

    #[test]
    fn test_shell_injection_rejected() {
        assert!(validate_filename_template("%(title)s; rm -rf /").is_err());
        assert!(validate_filename_template("$(whoami).%(ext)s").is_err());
    }

    #[test]
    fn test_unsupported_field_rejected() {
        assert!(validate_filename_template("%(password)s.%(ext)s").is_err());
    }

    #[test]
    fn test_preview_produces_output() {
        let result = preview_filename_template(
            "%(title)s [%(id)s].%(ext)s",
            Some("Test Video"),
            Some("abc123"),
            None,
            None,
            None,
            None,
        );
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Test Video [abc123].mp4");
    }

    #[test]
    fn test_sanitize_windows_reserved() {
        assert_eq!(sanitize_filename_output("CON"), "_CON");
        assert_eq!(sanitize_filename_output("NUL.txt"), "_NUL.txt");
    }

    #[test]
    fn test_sanitize_invalid_chars() {
        assert_eq!(sanitize_filename_output("file:name<test>"), "filenametest");
    }

    #[test]
    fn test_unicode_preserved() {
        let result = sanitize_filename_output("日本語のタイトル");
        assert_eq!(result, "日本語のタイトル");
    }
}
