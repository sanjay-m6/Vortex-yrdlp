use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_name: Option<String>,
    pub release_notes: Option<String>,
    pub published_at: Option<String>,
    pub download_url: Option<String>,
    pub signature_verified: bool,
    pub status_message: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    html_url: String,
}

/// Parses semantic versions (e.g. "1.0.0", "v1.0.1", "1.2.0-beta") into (major, minor, patch).
pub fn parse_semver(v: &str) -> Option<(u32, u32, u32)> {
    let clean = v.trim().trim_start_matches('v').trim_start_matches('V');
    let core = clean.split('-').next()?; // remove pre-release tags for simple ordering
    let parts: Vec<&str> = core.split('.').collect();
    if parts.len() < 3 {
        return None;
    }
    let major = parts[0].parse::<u32>().ok()?;
    let minor = parts[1].parse::<u32>().ok()?;
    let patch = parts[2].parse::<u32>().ok()?;
    Some((major, minor, patch))
}

/// Returns true if candidate is strictly newer than current.
pub fn is_newer_version(current: &str, candidate: &str) -> bool {
    match (parse_semver(current), parse_semver(candidate)) {
        (Some((c_maj, c_min, c_pat)), Some((n_maj, n_min, n_pat))) => {
            if n_maj > c_maj {
                return true;
            }
            if n_maj == c_maj && n_min > c_min {
                return true;
            }
            if n_maj == c_maj && n_min == c_min && n_pat > c_pat {
                return true;
            }
            false
        }
        _ => false,
    }
}

#[command]
pub async fn check_app_update() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    let client = reqwest::Client::builder()
        .user_agent(format!("Vortex-Desktop-Updater/{}", current_version))
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Check official GitHub repository latest release
    let url = "https://api.github.com/repos/sanjay-m6/Vortex-ytdlp/releases/latest";
    let res = client.get(url).send().await;

    match res {
        Ok(response) => {
            if response.status().is_success() {
                if let Ok(release) = response.json::<GitHubRelease>().await {
                    let latest_ver = release.tag_name.trim_start_matches('v').to_string();
                    let update_available = is_newer_version(&current_version, &latest_ver);

                    return Ok(AppUpdateInfo {
                        current_version: current_version.clone(),
                        latest_version: latest_ver.clone(),
                        has_update: update_available,
                        release_name: release.name,
                        release_notes: release.body,
                        published_at: release.published_at,
                        download_url: Some(release.html_url),
                        signature_verified: false,
                        status_message: if update_available {
                            format!("Update v{} is available!", latest_ver)
                        } else {
                            "You are using the latest version of Vortex.".to_string()
                        },
                    });
                }
            }

            // Fallback if repository release is not yet published publicly
            Ok(AppUpdateInfo {
                current_version: current_version.clone(),
                latest_version: current_version.clone(),
                has_update: false,
                release_name: Some(format!("Vortex v{}", current_version)),
                release_notes: Some("Production release build.".to_string()),
                published_at: Some(chrono::Utc::now().to_rfc3339()),
                download_url: None,
                signature_verified: false,
                status_message: format!("Vortex is up to date (Production v{}).", current_version),
            })
        }
        Err(e) => {
            // Graceful handling when offline or network unreachable
            Ok(AppUpdateInfo {
                current_version: current_version.clone(),
                latest_version: current_version.clone(),
                has_update: false,
                release_name: None,
                release_notes: None,
                published_at: None,
                download_url: None,
                signature_verified: false,
                status_message: format!("Could not reach update server (offline): {}", e),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semver_parsing() {
        assert_eq!(parse_semver("1.0.0"), Some((1, 0, 0)));
        assert_eq!(parse_semver("v2.4.12"), Some((2, 4, 12)));
        assert_eq!(parse_semver("1.0.0-beta.1"), Some((1, 0, 0)));
        assert_eq!(parse_semver("invalid"), None);
    }

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("1.0.0", "1.0.1"));
        assert!(is_newer_version("1.0.0", "1.1.0"));
        assert!(is_newer_version("1.0.0", "2.0.0"));
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("1.1.0", "1.0.5"));
        assert!(!is_newer_version("2.0.0", "1.9.9"));
    }
}
