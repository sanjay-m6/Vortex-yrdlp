# MediaDL v1.0.0 Release Notes

**MediaDL** is a modern, high-performance desktop media downloader and converter built with Tauri 2, Rust, React 19, and SQLite.

---

## 🌟 Highlights & New Features

### 1. Production Windows Installer & Packaging
- **NSIS Standalone Installer:** Engineered a clean, self-contained Windows installer (`MediaDL_1.0.0_x64-setup.exe`) configured for `currentUser` installation. Requires no administrator elevation and installs predictably into `%LOCALAPPDATA%\Programs\MediaDL`.
- **Application Identity & Branding:** Configured consistent branding assets across the `.exe`, NSIS installer screens, Windows taskbar, window chrome, and system tray.
- **Data Preservation Guarantee:** Uninstaller cleanly removes binary executables and shortcuts while strictly preserving user configuration, download history, and media files.

### 2. Managed Binary Lifecycle & Atomic Updates
- **Safe Directory Strategy:** Resolved filesystem permission restrictions by relocating managed tools from read-only application roots to `%LOCALAPPDATA%\MediaDL\bin`.
- **Atomic Swap Protection:** In-app `yt-dlp` updates now download to temporary `.tmp` files and verify minimum binary size (>1MB) before atomic replacement, eliminating binary corruption risks from interrupted downloads.
- **Dependency Diagnostics:** Comprehensive detection and version reporting for `yt-dlp`, `ffmpeg`, and `ffprobe`, with support for custom user-configured paths.

### 3. Structured Logging & Sensitive Token Redaction
- **Log Rotation:** Centralized logger writes to `%LOCALAPPDATA%\MediaDL\logs\mediadl.log` with automatic 5MB rotation and up to 3 retained backups.
- **Privacy & Security Filtering:** Sensitive URL parameters (`sig=`, `signature=`, `access_token=`, `token=`, `key=`, `password=`, `cookie:`) are automatically redacted prior to disk persistence and telemetry.
- **Diagnostics Export:** One-click diagnostics generator in the UI produces sanitized environment reports (OS, architecture, database size, tool versions, and recent logs) for troubleshooting.

### 4. Over-The-Air Update Infrastructure
- **Semver-Compliant Update Engine:** Integrated background release checking against verified endpoints with semantic version comparison (`is_newer_version`).
- **Update Center:** User-facing check in the About page provides release notes, signature verification badges, and direct download links.

### 5. UI/UX Polishing & Resilient Architecture
- **Global Error Boundary:** Added a resilient React error boundary with one-click reload and error diagnostic views to catch and isolate any unexpected UI exceptions.
- **Liquid Glass Aesthetic & Animated Theme Switching:** Fluid theme transitions powered by the View Transitions API and circular reveal splashes across Dark and Light modes.
- **Queue & History Cards:** Real-time download metrics (percentage, speed in MB/s, ETA, downloaded size), aspect-ratio media thumbnails, and robust state machines (Queued, Downloading, Merging, Completed, Cancelled, Failed).

---

## 🐛 Bug Fixes & Hardening

- **Resolved White-Screen Crash on Downloads:** Fixed schema mismatch between backend `QueueItem` (`status: DownloadState`, `progress: Option<DownloadProgress>`) and frontend expectations with an idempotent `normalizeTask` adapter.
- **Resolved Write Permission Failures:** Fixed `download_latest_ytdlp` attempting to write to read-only paths in packaged environments by binding strictly to `ToolResolver::get_managed_tools_dir()`.
- **Prevented Process Zombie Leaking:** Enhanced process tree termination and child cancellation handling for `yt-dlp` subprocesses on Windows.
- **Strict Path Traversal Protection:** Implemented path validation ensuring user downloads and custom templates cannot escape the target output directory.

---

## 💻 System Requirements

- **Operating System:** Windows 10 (version 1809 or higher) or Windows 11 (64-bit x86_64).
- **Runtime:** Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 10/11).
- **Processor:** Intel Core i3 / AMD Ryzen 3 or higher.
- **Memory:** 4 GB RAM minimum (8 GB recommended for multi-stream 4K merges).
- **Disk Space:** 120 MB for application installation; additional storage required for media downloads.
- **External Dependencies:**
  - `yt-dlp` (auto-downloadable via MediaDL Settings/Engine).
  - `ffmpeg` & `ffprobe` (recommended for audio extraction and video stream merging).

---

## 🔒 Security & Verification

- **Capabilities:** Tauri 2 least-privilege capability policy restricting file dialogs, IPC endpoints, and window operations.
- **Database Safety:** SQLite database migrations are strictly transactional and idempotent. Existing user media entries and settings are preserved during all updates.
