use crate::models::{EngineError, ToolSource, ToolType};
use std::path::{Path, PathBuf};

pub struct ToolResolver;

impl ToolResolver {
    /// Returns the primary application-managed tools directory.
    pub fn get_managed_tools_dir() -> PathBuf {
        if let Some(data_dir) = dirs::data_local_dir() {
            let app_tools = data_dir.join("Vortex").join("bin");
            if app_tools.exists() {
                return app_tools;
            }
            let legacy_tools = data_dir.join("MediaDL").join("bin");
            if legacy_tools.exists() {
                return legacy_tools;
            }
        }

        // Check local working directory bin
        if let Ok(cwd) = std::env::current_dir() {
            let local_bin = cwd.join("bin");
            if local_bin.exists() {
                return local_bin;
            }
        }

        // Default fallback to appdata/Vortex/bin
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Vortex")
            .join("bin")
    }

    /// Validates an executable candidate path.
    pub fn validate_executable(path: &Path) -> Result<PathBuf, EngineError> {
        if !path.exists() {
            return Err(EngineError::invalid_path(format!(
                "Path does not exist: {:?}",
                path
            )));
        }

        if !path.is_file() {
            return Err(EngineError::invalid_path(format!(
                "Path is not a regular file: {:?}",
                path
            )));
        }

        #[cfg(target_os = "windows")]
        {
            if let Some(ext) = path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ext_str != "exe" && ext_str != "bat" && ext_str != "cmd" {
                    return Err(EngineError::invalid_path(format!(
                        "File does not have an executable extension (.exe, .bat, .cmd): {:?}",
                        path
                    )));
                }
            } else {
                return Err(EngineError::invalid_path(format!(
                    "File is missing an executable extension: {:?}",
                    path
                )));
            }
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = path.metadata() {
                let permissions = metadata.permissions();
                if permissions.mode() & 0o111 == 0 {
                    return Err(EngineError::permission_denied(format!(
                        "File is not marked executable: {:?}",
                        path
                    )));
                }
            }
        }

        // Canonicalize if possible, otherwise return path
        Ok(path.canonicalize().unwrap_or_else(|_| path.to_path_buf()))
    }

    /// Resolves executable path using the explicit priority order:
    /// 1. User-configured path
    /// 2. Application-managed tools directory
    /// 3. System PATH lookup
    pub fn resolve_tool(tool: ToolType, user_path: Option<&str>) -> Option<(PathBuf, ToolSource)> {
        // Priority 1: User-configured path
        if let Some(custom) = user_path {
            let trimmed = custom.trim();
            if !trimmed.is_empty() {
                let custom_path = PathBuf::from(trimmed);
                if let Ok(valid_path) = Self::validate_executable(&custom_path) {
                    return Some((valid_path, ToolSource::UserConfigured));
                }
            }
        }

        let exe_name = tool.default_executable_name();

        // Priority 2: Application-managed tools directory
        // Check current working dir /bin
        if let Ok(cwd) = std::env::current_dir() {
            let bin_candidate = cwd.join("bin").join(exe_name);
            if let Ok(valid) = Self::validate_executable(&bin_candidate) {
                return Some((valid, ToolSource::AppManaged));
            }
        }

        // Check current exe directory and adjacent bin
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(parent) = exe_path.parent() {
                let direct = parent.join(exe_name);
                if let Ok(valid) = Self::validate_executable(&direct) {
                    return Some((valid, ToolSource::AppManaged));
                }
                let beside_bin = parent.join("bin").join(exe_name);
                if let Ok(valid) = Self::validate_executable(&beside_bin) {
                    return Some((valid, ToolSource::AppManaged));
                }
            }
        }

        // Check AppData/Vortex/bin (and legacy MediaDL/bin)
        if let Some(data_dir) = dirs::data_local_dir() {
            let appdata_bin = data_dir.join("Vortex").join("bin").join(exe_name);
            if let Ok(valid) = Self::validate_executable(&appdata_bin) {
                return Some((valid, ToolSource::AppManaged));
            }
            let legacy_bin = data_dir.join("MediaDL").join("bin").join(exe_name);
            if let Ok(valid) = Self::validate_executable(&legacy_bin) {
                return Some((valid, ToolSource::AppManaged));
            }
        }

        // Priority 3: System PATH lookup
        if let Some(path) = Self::lookup_in_system(tool) {
            return Some((path, ToolSource::SystemPath));
        }

        None
    }

    fn lookup_in_system(tool: ToolType) -> Option<PathBuf> {
        let name = tool.as_str();

        #[cfg(target_os = "windows")]
        {
            // Try where.exe
            if let Ok(output) = std::process::Command::new("where.exe").arg(name).output() {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    for line in text.lines() {
                        let candidate = PathBuf::from(line.trim());
                        if let Ok(valid) = Self::validate_executable(&candidate) {
                            return Some(valid);
                        }
                    }
                }
            }

            // Check WinGet packages for ffmpeg/yt-dlp
            if let Some(local_app_data) = dirs::data_local_dir() {
                let winget_dir = local_app_data
                    .join("Microsoft")
                    .join("WinGet")
                    .join("Packages");
                if winget_dir.exists() {
                    if let Ok(entries) = std::fs::read_dir(&winget_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            let folder_name = path
                                .file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_lowercase();
                            if folder_name.contains(name) {
                                // Search shallow subdirectories for bin/*.exe or *.exe
                                let exe_name = tool.default_executable_name();
                                let candidate1 = path.join(exe_name);
                                if let Ok(valid) = Self::validate_executable(&candidate1) {
                                    return Some(valid);
                                }
                                let candidate2 = path.join("bin").join(exe_name);
                                if let Ok(valid) = Self::validate_executable(&candidate2) {
                                    return Some(valid);
                                }

                                if let Ok(subentries) = std::fs::read_dir(&path) {
                                    for sub in subentries.flatten() {
                                        let subpath = sub.path();
                                        if subpath.is_dir() {
                                            let sub_bin = subpath.join("bin").join(exe_name);
                                            if let Ok(valid) = Self::validate_executable(&sub_bin) {
                                                return Some(valid);
                                            }
                                            let sub_direct = subpath.join(exe_name);
                                            if let Ok(valid) =
                                                Self::validate_executable(&sub_direct)
                                            {
                                                return Some(valid);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Check Python Scripts directory for yt-dlp
            if tool == ToolType::YtDlp {
                if let Ok(appdata) = std::env::var("APPDATA") {
                    let py_root = PathBuf::from(&appdata).join("Python");
                    if let Ok(entries) = std::fs::read_dir(&py_root) {
                        for entry in entries.flatten() {
                            let candidate = entry.path().join("Scripts").join("yt-dlp.exe");
                            if let Ok(valid) = Self::validate_executable(&candidate) {
                                return Some(valid);
                            }
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = std::process::Command::new("which").arg(name).output() {
                if output.status.success() {
                    let text = String::from_utf8_lossy(&output.stdout);
                    if let Some(line) = text.lines().next() {
                        let candidate = PathBuf::from(line.trim());
                        if let Ok(valid) = Self::validate_executable(&candidate) {
                            return Some(valid);
                        }
                    }
                }
            }

            // Common Unix paths
            let common_dirs = ["/usr/local/bin", "/usr/bin", "/bin", "/opt/homebrew/bin"];
            for dir in common_dirs {
                let candidate = PathBuf::from(dir).join(name);
                if let Ok(valid) = Self::validate_executable(&candidate) {
                    return Some(valid);
                }
            }
        }

        None
    }
}
