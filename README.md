# Vortex — Modern Desktop Media Downloader & Transcoder

A modern, simple, ultra-fast desktop GUI application built around **yt-dlp** and **FFmpeg** using **Tauri 2**, **Rust**, **React 19**, **TypeScript**, **Tailwind CSS**, and **SQLite**.

---

## 🌟 Key Highlights & Features

- **Blazing Fast Native Backend**: Built with Rust and Tokio for asynchronous media streaming and process orchestration.
- **Modern Glassmorphic UI**: Built with React 19, TypeScript, Tailwind CSS, Lucide icons, and sleek dark mode aesthetics.
- **Smart URL Analyzer**:
  - One-click clipboard paste.
  - Video preview with thumbnail, author/channel, duration, and view counts.
  - Multi-platform support: YouTube, TikTok, Instagram, X (Twitter), Vimeo, Reddit, SoundCloud, and 1,000+ sites.
- **Format & Quality Presets**:
  - **Video**: 4K UHD (2160p), 2K QHD (1440p), Full HD (1080p), HD (720p), SD (480p), or Best Available.
  - **Audio Only**: MP3 (320 kbps, 192 kbps), M4A (AAC), WAV (Lossless PCM), FLAC, Opus.
  - Custom file naming & cover art / subtitles embedding.
- **Real-Time Download Manager**:
  - Live progress percentage bar, download speed gauge (e.g. `8.4 MB/s`), ETA counter (`00:14`), downloaded/total size.
  - Granular step indicators (`"Downloading stream..."`, `"Muxing with FFmpeg..."`).
  - Native pause/cancel support.
- **Batch Downloading**: Paste multiple URLs (one per line) and add them all to the queue with one click.
- **Embedded SQLite Library**:
  - Automatic download history persistence in `vortex.db`.
  - Searchable library with file size, format tags, completion date, and direct "Show in Folder" (Windows Explorer reveal) buttons.
- **Native Dependency Management**:
  - Automatic resolution of `yt-dlp` and `FFmpeg` from bundled `bin/`, Python scripts, or system `PATH`.
  - One-click in-app update & downloader for the latest `yt-dlp` binary directly from GitHub releases.
- **Zero-Friction Destination Selector**: Native folder picker via Rust File Dialogs (`rfd`).

---

## 🏗️ Architecture & Stack

| Layer | Technology |
|---|---|
| **Desktop Framework** | **Tauri 2** (`tauri`, `tauri-build`, `tauri-plugin-opener`) |
| **Backend Core** | **Rust** (`tokio`, `rusqlite`, `regex`, `reqwest`, `rfd`, `dirs`) |
| **Frontend UI** | **React 19 + TypeScript + Vite 8** |
| **Styling** | **Tailwind CSS + Glassmorphism** |
| **State Management** | **Zustand** |
| **Server State** | **TanStack Query v5** |
| **Database** | **SQLite (bundled via rusqlite)** |
| **Downloader & Processor** | **yt-dlp** & **FFmpeg** |

---

## 📁 Project Structure

```text
d:/YTDLP/
├── bin/                       # Local binaries (yt-dlp.exe)
├── src-tauri/                 # Native Rust Core
│   ├── src/
│   │   ├── commands/          # Tauri IPC Command handlers
│   │   │   ├── downloader.rs  # Analyze URL, start & cancel downloads
│   │   │   ├── history.rs     # SQLite history queries & deletions
│   │   │   ├── settings.rs    # Preferences persistence
│   │   │   ├── system.rs      # Binary checks, folder picker, explorer reveal
│   │   │   └── mod.rs
│   │   ├── database/          # SQLite schema & queries
│   │   ├── downloader/        # Process runner, regex parser, ytdlp wrapper
│   │   ├── models/            # Rust data structures (serde)
│   │   ├── lib.rs             # Tauri setup & command router
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json        # Tauri 2 app configuration
├── src/                       # React 19 Frontend
│   ├── components/
│   │   ├── downloader/        # UrlAnalyzer, MediaPreview, BatchModal
│   │   ├── history/           # HistoryView (SQLite table)
│   │   ├── layout/            # Sidebar, Header
│   │   ├── queue/             # QueueView, DownloadCard
│   │   └── settings/          # SettingsView
│   ├── pages/                 # Dashboard, AboutModal
│   ├── stores/                # Zustand stores (downloadStore, settingsStore)
│   ├── lib/api.ts             # Typed Tauri IPC bridge
│   ├── types/index.ts         # TypeScript interfaces
│   ├── App.tsx
│   └── index.css              # Custom Tailwind CSS & glass effects
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🚀 How to Run & Build

### 1. Development Mode (with Live Reload)

Run the desktop application in development mode:
```bash
npm run tauri dev
```
This starts the Vite local server and launches the native Vortex desktop window.

### 2. Standalone Frontend Preview

To test or preview only the React frontend in your browser:
```bash
npm run dev
```
Open [http://localhost:1420](http://localhost:1420).

### 3. Production Release Packaging

To build the optimized `.exe` and installer:
```bash
npm run tauri build
```
The compiled release executable and installer will be located in:
`src-tauri/target/release/`
