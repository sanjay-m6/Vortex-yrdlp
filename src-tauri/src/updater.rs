use crate::database::{load_app_settings, store_app_settings};
use crate::downloader::AppState;
use crate::logging::{log_error, log_info, log_warn};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{command, AppHandle, Emitter, State};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateState {
    Idle,
    Checking,
    UpToDate,
    UpdateAvailable,
    Downloading,
    Verifying,
    ReadyToInstall,
    Installing,
    RestartRequired,
    Failed,
}

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
    pub state: UpdateState,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgressPayload {
    pub stage: String, // "downloading" | "verifying" | "installing" | "ready" | "failed"
    pub percentage: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckOptions {
    pub include_prereleases: Option<bool>,
    pub force: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePreferences {
    pub auto_check_updates: bool,
    pub check_frequency: String, // "startup" | "daily" | "weekly"
    pub notify_on_update: bool,
    pub include_prereleases: bool,
    pub auto_install_updates: bool,
    pub last_update_check: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
    html_url: String,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    draft: bool,
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

/// Checks whether an update check should be performed based on check_frequency and last_check timestamp.
pub fn is_check_due(frequency: &str, last_check: Option<&str>) -> bool {
    let last = match last_check {
        Some(t) => match DateTime::parse_from_rfc3339(t) {
            Ok(dt) => dt.with_timezone(&Utc),
            Err(_) => return true,
        },
        None => return true,
    };

    let now = Utc::now();
    let elapsed = now.signed_duration_since(last);

    match frequency {
        "startup" => true,
        "weekly" => elapsed >= chrono::Duration::days(7),
        _ => elapsed >= chrono::Duration::hours(24), // default "daily"
    }
}

pub struct UpdateManager {
    pending_update: tokio::sync::Mutex<Option<Update>>,
    current_state: Mutex<UpdateState>,
    last_info: Mutex<Option<AppUpdateInfo>>,
    install_lock: tokio::sync::Mutex<()>,
}

impl Default for UpdateManager {
    fn default() -> Self {
        Self::new()
    }
}

impl UpdateManager {
    pub fn new() -> Self {
        Self {
            pending_update: tokio::sync::Mutex::new(None),
            current_state: Mutex::new(UpdateState::Idle),
            last_info: Mutex::new(None),
            install_lock: tokio::sync::Mutex::new(()),
        }
    }

    pub fn get_state(&self) -> UpdateState {
        self.current_state.lock().unwrap().clone()
    }

    pub fn set_state(&self, state: UpdateState) {
        *self.current_state.lock().unwrap() = state;
    }

    pub fn get_cached_info(&self) -> Option<AppUpdateInfo> {
        self.last_info.lock().unwrap().clone()
    }

    pub async fn check_for_update(
        &self,
        app: &AppHandle,
        app_state: &AppState,
        options: UpdateCheckOptions,
    ) -> Result<AppUpdateInfo, String> {
        self.set_state(UpdateState::Checking);
        let current_version = env!("CARGO_PKG_VERSION").to_string();
        log_info(
            "Updater",
            &format!(
                "Checking for updates (current version: v{})",
                current_version
            ),
        );

        // 1. Try official Tauri 2 Updater endpoint first (with signature verification)
        let mut tauri_update_found: Option<Update> = None;
        let mut tauri_release_notes: Option<String> = None;
        let mut tauri_date: Option<String> = None;

        if let Ok(updater) = app.updater() {
            match updater.check().await {
                Ok(Some(up)) => {
                    log_info(
                        "Updater",
                        &format!("Tauri updater found version {}", up.version),
                    );
                    tauri_release_notes = up.body.clone();
                    tauri_date = up.date.map(|d| d.to_string());
                    tauri_update_found = Some(up);
                }
                Ok(None) => {
                    log_info(
                        "Updater",
                        "Tauri updater: already running latest verified version",
                    );
                }
                Err(e) => {
                    log_warn("Updater", &format!("Tauri updater check returned: {}", e));
                }
            }
        }

        // 2. Query GitHub Releases API for release details, changelog, and prereleases
        let client = reqwest::Client::builder()
            .user_agent(format!("Vortex-Desktop-Updater/{}", current_version))
            .timeout(Duration::from_secs(8))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let gh_url = "https://api.github.com/repos/sanjay-m6/Vortex-ytdlp/releases";
        let gh_res = client.get(gh_url).send().await;

        let mut github_latest: Option<GitHubRelease> = None;
        if let Ok(resp) = gh_res {
            if resp.status().is_success() {
                if let Ok(releases) = resp.json::<Vec<GitHubRelease>>().await {
                    let include_pre = options.include_prereleases.unwrap_or(false);
                    for r in releases {
                        if r.draft {
                            continue;
                        }
                        if r.prerelease && !include_pre {
                            continue;
                        }
                        github_latest = Some(r);
                        break;
                    }
                }
            }
        }

        // Determine effective latest version and metadata
        let (
            latest_version,
            has_update,
            release_name,
            release_notes,
            published_at,
            download_url,
            sig_verified,
        ) = if let Some(up) = tauri_update_found {
            let v = up.version.clone();
            let has = is_newer_version(&current_version, &v);
            let notes =
                tauri_release_notes.or_else(|| github_latest.as_ref().and_then(|g| g.body.clone()));
            let name = github_latest
                .as_ref()
                .and_then(|g| g.name.clone())
                .or_else(|| Some(format!("Vortex v{}", v)));
            let date =
                tauri_date.or_else(|| github_latest.as_ref().and_then(|g| g.published_at.clone()));
            let url = github_latest.as_ref().map(|g| g.html_url.clone());

            // Store pending update for one-click installation
            *self.pending_update.lock().await = Some(up);
            (v, has, name, notes, date, url, true)
        } else if let Some(gh) = github_latest {
            let v = gh
                .tag_name
                .trim_start_matches('v')
                .trim_start_matches('V')
                .to_string();
            let has = is_newer_version(&current_version, &v);
            (
                v,
                has,
                gh.name,
                gh.body,
                gh.published_at,
                Some(gh.html_url),
                false,
            )
        } else {
            (
                current_version.clone(),
                false,
                Some(format!("Vortex v{}", current_version)),
                Some("Current production build.".to_string()),
                Some(Utc::now().to_rfc3339()),
                None,
                true,
            )
        };

        let new_state = if has_update {
            UpdateState::UpdateAvailable
        } else {
            UpdateState::UpToDate
        };
        self.set_state(new_state.clone());

        let status_message = if has_update {
            format!("Update v{} is available!", latest_version)
        } else {
            format!("Vortex is up to date (v{}).", current_version)
        };

        let update_info = AppUpdateInfo {
            current_version: current_version.clone(),
            latest_version,
            has_update,
            release_name,
            release_notes,
            published_at,
            download_url,
            signature_verified: sig_verified,
            status_message,
            state: new_state,
            error_message: None,
        };

        // Cache last info
        *self.last_info.lock().unwrap() = Some(update_info.clone());

        // Persist last_update_check timestamp in SQLite AppSettings
        let now_str = Utc::now().to_rfc3339();
        if let Ok(conn) = app_state.db.conn.lock() {
            let mut settings = load_app_settings(&conn);
            settings.last_update_check = Some(now_str);
            let _ = store_app_settings(&conn, &settings);
        }

        Ok(update_info)
    }

    pub async fn download_and_install_update(
        &self,
        app: &AppHandle,
        app_state: &AppState,
        restart_immediately: bool,
        force: bool,
    ) -> Result<(), String> {
        let _guard = match self.install_lock.try_lock() {
            Ok(g) => g,
            Err(_) => return Err("An update installation is already in progress.".to_string()),
        };

        // Guard against interrupting active downloads
        if !force && app_state.queue_manager.has_active_downloads_sync() {
            return Err("Active downloads are currently running. Please wait for them to finish, or confirm to force update.".to_string());
        }

        let update = {
            let mut pending = self.pending_update.lock().await;
            pending.take()
        };

        let update = match update {
            Some(u) => u,
            None => {
                // If not cached, re-check to acquire the Update handle
                log_info(
                    "Updater",
                    "Pending update handle not found; checking for update first",
                );
                let info = self
                    .check_for_update(app, app_state, UpdateCheckOptions::default())
                    .await?;
                if !info.has_update {
                    return Err("No update available to install.".to_string());
                }
                let mut pending = self.pending_update.lock().await;
                pending.take().ok_or_else(|| "Could not acquire Tauri update package for download. Please check GitHub release assets.".to_string())?
            }
        };

        self.set_state(UpdateState::Downloading);
        let _ = app.emit(
            "update_download_progress",
            UpdateProgressPayload {
                stage: "downloading".to_string(),
                percentage: 0.0,
                downloaded_bytes: 0,
                total_bytes: None,
                message: "Starting download of verified update package...".to_string(),
            },
        );

        let app_handle_progress = app.clone();
        let mut downloaded: u64 = 0;

        let res = update
            .download_and_install(
                move |chunk_len, total_bytes| {
                    downloaded += chunk_len as u64;
                    let pct = if let Some(tot) = total_bytes {
                        if tot > 0 {
                            ((downloaded as f64 / tot as f64) * 100.0).min(99.0)
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    };

                    let _ = app_handle_progress.emit(
                        "update_download_progress",
                        UpdateProgressPayload {
                            stage: "downloading".to_string(),
                            percentage: pct,
                            downloaded_bytes: downloaded,
                            total_bytes,
                            message: format!("Downloading update: {:.1}%", pct),
                        },
                    );
                },
                move || {
                    let _ = app.emit(
                        "update_download_progress",
                        UpdateProgressPayload {
                            stage: "verifying".to_string(),
                            percentage: 100.0,
                            downloaded_bytes: downloaded,
                            total_bytes: None,
                            message: "Verifying cryptographic signature and applying update..."
                                .to_string(),
                        },
                    );
                },
            )
            .await;

        match res {
            Ok(_) => {
                log_info(
                    "Updater",
                    "Update successfully downloaded, verified, and staged",
                );
                self.set_state(UpdateState::RestartRequired);
                let _ = app.emit(
                    "update_download_progress",
                    UpdateProgressPayload {
                        stage: "ready".to_string(),
                        percentage: 100.0,
                        downloaded_bytes: downloaded,
                        total_bytes: None,
                        message: "Update ready. Restart Vortex to apply the new version."
                            .to_string(),
                    },
                );

                if restart_immediately {
                    log_info("Updater", "Restarting application to complete update");
                    app.restart();
                }
                Ok(())
            }
            Err(e) => {
                let err_msg: String = format!("Failed to download or verify update: {}", e);
                log_error("Updater", &err_msg);
                self.set_state(UpdateState::Failed);
                let _ = app.emit(
                    "update_download_progress",
                    UpdateProgressPayload {
                        stage: "failed".to_string(),
                        percentage: 0.0,
                        downloaded_bytes: downloaded,
                        total_bytes: None,
                        message: err_msg.clone(),
                    },
                );
                Err(err_msg)
            }
        }
    }

    pub fn trigger_restart(
        &self,
        app: &AppHandle,
        app_state: &AppState,
        force: bool,
    ) -> Result<(), String> {
        if !force && app_state.queue_manager.has_active_downloads_sync() {
            return Err("Active downloads are running. Please pause or wait for them to finish, or confirm to force restart.".to_string());
        }
        log_info("Updater", "Restarting application via updater trigger");
        app.restart();
    }
}

// =========================================================================
// Tauri IPC Commands
// =========================================================================

#[command]
pub async fn check_app_update(
    options: Option<UpdateCheckOptions>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppUpdateInfo, String> {
    let opts = options.unwrap_or_default();
    state
        .update_manager
        .check_for_update(&app, &state, opts)
        .await
}

#[command]
pub async fn download_update(
    restart_immediately: Option<bool>,
    force: Option<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .update_manager
        .download_and_install_update(
            &app,
            &state,
            restart_immediately.unwrap_or(false),
            force.unwrap_or(false),
        )
        .await
}

#[command]
pub async fn install_and_restart(
    force: Option<bool>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .update_manager
        .trigger_restart(&app, &state, force.unwrap_or(false))
}

#[command]
pub async fn get_update_state(state: State<'_, AppState>) -> Result<UpdateState, String> {
    Ok(state.update_manager.get_state())
}

#[command]
pub async fn get_update_preferences(
    state: State<'_, AppState>,
) -> Result<UpdatePreferences, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let settings = load_app_settings(&conn);
    Ok(UpdatePreferences {
        auto_check_updates: settings.auto_check_updates,
        check_frequency: settings.check_frequency,
        notify_on_update: settings.notify_on_update,
        include_prereleases: settings.include_prereleases,
        auto_install_updates: settings.auto_install_updates,
        last_update_check: settings.last_update_check,
    })
}

#[command]
pub async fn save_update_preferences(
    prefs: UpdatePreferences,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut settings = load_app_settings(&conn);
    settings.auto_check_updates = prefs.auto_check_updates;
    settings.check_frequency = prefs.check_frequency;
    settings.notify_on_update = prefs.notify_on_update;
    settings.include_prereleases = prefs.include_prereleases;
    settings.auto_install_updates = prefs.auto_install_updates;
    store_app_settings(&conn, &settings).map_err(|e| e.to_string())?;
    log_info("Updater", "Update preferences saved to SQLite");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semver_parsing() {
        assert_eq!(parse_semver("1.0.0"), Some((1, 0, 0)));
        assert_eq!(parse_semver("v2.4.12"), Some((2, 4, 12)));
        assert_eq!(parse_semver("V3.0.0"), Some((3, 0, 0)));
        assert_eq!(parse_semver("1.0.0-beta.1"), Some((1, 0, 0)));
        assert_eq!(parse_semver("1.2.3-rc.2+2026"), Some((1, 2, 3)));
        assert_eq!(parse_semver("invalid"), None);
        assert_eq!(parse_semver("1.0"), None);
    }

    #[test]
    fn test_is_newer_version() {
        // Newer patch
        assert!(is_newer_version("1.0.0", "1.0.1"));
        // Newer minor
        assert!(is_newer_version("1.0.0", "1.1.0"));
        // Newer major
        assert!(is_newer_version("1.0.0", "2.0.0"));
        assert!(is_newer_version("1.9.9", "2.0.0"));
        // Same version
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("1.1.0", "v1.1.0"));
        // Older versions
        assert!(!is_newer_version("1.1.0", "1.0.5"));
        assert!(!is_newer_version("2.0.0", "1.9.9"));
        assert!(!is_newer_version("1.2.3", "1.2.2"));
    }

    #[test]
    fn test_is_check_due() {
        // None timestamp is always due
        assert!(is_check_due("daily", None));
        assert!(is_check_due("weekly", None));
        assert!(is_check_due("startup", None));

        // "startup" is always due
        let recent = Utc::now().to_rfc3339();
        assert!(is_check_due("startup", Some(&recent)));

        // Recent timestamp is NOT due for daily or weekly
        assert!(!is_check_due("daily", Some(&recent)));
        assert!(!is_check_due("weekly", Some(&recent)));

        // 2 days ago is due for daily, but not weekly
        let two_days_ago = (Utc::now() - chrono::Duration::days(2)).to_rfc3339();
        assert!(is_check_due("daily", Some(&two_days_ago)));
        assert!(!is_check_due("weekly", Some(&two_days_ago)));

        // 8 days ago is due for both daily and weekly
        let eight_days_ago = (Utc::now() - chrono::Duration::days(8)).to_rfc3339();
        assert!(is_check_due("daily", Some(&eight_days_ago)));
        assert!(is_check_due("weekly", Some(&eight_days_ago)));
    }

    #[test]
    fn test_update_state_machine_transitions() {
        let mgr = UpdateManager::new();
        assert_eq!(mgr.get_state(), UpdateState::Idle);

        mgr.set_state(UpdateState::Checking);
        assert_eq!(mgr.get_state(), UpdateState::Checking);

        mgr.set_state(UpdateState::UpdateAvailable);
        assert_eq!(mgr.get_state(), UpdateState::UpdateAvailable);

        mgr.set_state(UpdateState::Downloading);
        assert_eq!(mgr.get_state(), UpdateState::Downloading);

        mgr.set_state(UpdateState::ReadyToInstall);
        assert_eq!(mgr.get_state(), UpdateState::ReadyToInstall);

        mgr.set_state(UpdateState::RestartRequired);
        assert_eq!(mgr.get_state(), UpdateState::RestartRequired);
    }
}
