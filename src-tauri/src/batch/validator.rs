pub fn normalize_batch_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    if trimmed.starts_with("file://")
        || trimmed.starts_with("javascript:")
        || trimmed.starts_with("data:")
    {
        return Err("Unsupported URL protocol".to_string());
    }

    // Parse with reqwest::Url (or url::Url)
    match reqwest::Url::parse(trimmed) {
        Ok(parsed) => {
            // Require a valid host
            if parsed.host_str().is_none() {
                return Err("Missing valid host in URL".to_string());
            }

            // Normalization: clean trailing hash fragments while preserving query parameters
            let mut normalized = parsed.clone();
            normalized.set_fragment(None);

            Ok(normalized.to_string())
        }
        Err(e) => Err(format!("Malformed URL: {}", e)),
    }
}
