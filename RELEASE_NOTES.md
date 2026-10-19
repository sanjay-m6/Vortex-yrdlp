# Vortex v1.2.0 Release Notes

**Vortex** is a next-generation desktop media workstation built with Tauri 2, Rust, React 19, and SQLite, powered by yt-dlp & FFmpeg.

---

## 🌟 What's New in v1.2.0

### 1. Complete Automatic & Manual Software Updater
- **Official Tauri 2 Updater Integration:** Seamless OTA updates powered by `@tauri-apps/plugin-updater` and GitHub Releases.
- **Cryptographic Minisign Verification:** Updates are signed with Minisign keys and cryptographically verified prior to execution.
- **Dedicated Update Workstation (About Screen):**
  - Live state machine: `idle`, `checking`, `up_to_date`, `update_available`, `downloading`, `verifying`, `ready_to_install`, `installing`, `failed`.
  - Real-time download progress bar with percentage, downloaded MB, and total MB.
  - Expandable changelog and release notes preview.
  - One-click **Install and Restart**.
- **Configurable Automatic Update Checking (Settings Screen):**
  - Check frequency: On Application Startup, Once Daily, or Once Weekly.
  - In-app notification alerts when a new update is released.
  - Optional support for pre-releases and beta releases.
  - Automatic background installation option with download safety checks.
- **Active Task & Workload Safety:**
  - Before applying any update, Vortex checks for running downloads (`has_active_downloads_sync`).
  - Active downloads prompt a safety confirmation dialog, preventing interrupted transfers without explicit user approval.
- **Application Data Preservation:**
  - SQLite database (`vortex.db`), download history, presets, custom folder settings, and logs reside in `%LOCALAPPDATA%\Vortex\` and survive updates completely intact.

### 2. Critical Stability & Window Management Fixes
- **Single-Instance Enforcement:** Fixed multiple window stacking by locking application instance to single-window mode (`tauri-plugin-single-instance`). Second launches focus the existing window.
- **Silent Background Process Execution:** Added `CREATE_NO_WINDOW (0x08000000)` on all Windows subprocesses in `ToolResolver`, `ToolInstaller`, `YtDlpDownloader`, and diagnostics. Completely eliminates the black CMD/terminal popup window during application startup and tool verification.
- **Setup Wizard Deduplication:** Synchronized onboarding completion with persistent backend SQLite state (`setup_completed`, `setup_step`), permanently preventing the setup wizard from opening repeatedly or looping.
- **Smooth Window Reveal:** Window is revealed after DOM mount, eliminating initial white pop.

### 3. CI/CD & Multi-Platform Release Pipeline
- **Automated Signed Artifacts:** GitHub Actions workflow generates, signs, and packages `.nsis.zip`, `.sig`, and `latest.json` alongside `.exe` and `.msi` installers.
- **Checksum Verification:** Automated SHA-256 manifest generation (`SHA256SUMS.txt`).

---

## 💻 System Requirements

- **Operating System:** Windows 10 (version 1809 or higher) or Windows 11 (64-bit x86_64).
- **Runtime:** Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 10/11).
- **Processor:** Intel Core i3 / AMD Ryzen 3 or higher.
- **Memory:** 4 GB RAM minimum (8 GB recommended for 4K / multi-stream downloads).
- **Disk Space:** 120 MB for installation; additional storage for downloaded media.
