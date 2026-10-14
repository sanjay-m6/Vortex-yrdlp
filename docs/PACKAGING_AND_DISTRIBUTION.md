# MediaDL — Packaging, Security & Distribution Guide

This document specifies the release packaging, Windows installer configuration, dependency distribution strategy, update infrastructure, and security threat model for **MediaDL**.

---

## 1. Release Architecture & Technology Stack

- **Runtime:** Tauri v2 (Rust 1.80+ + Microsoft Edge WebView2)
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Motion
- **Persistence:** Local SQLite database (`mediadl.db`) via `rusqlite` with idempotent migrations
- **Logging:** Zero-dependency production logger with 5MB rolling rotation in `%LOCALAPPDATA%\MediaDL\logs`
- **External Binaries:** `yt-dlp` (Universal Extractor) + `ffmpeg` / `ffprobe` (Audio/Video muxing)

---

## 2. Windows Installer Architecture (NSIS)

### Installer Engine
MediaDL uses the **NSIS (Nullsoft Scriptable Install System)** bundler configured natively through Tauri 2.

### Configuration (`src-tauri/tauri.conf.json`)
```json
{
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ],
    "windows": {
      "nsis": {
        "installMode": "currentUser",
        "languages": ["en-US"],
        "displayLanguageSelector": false
      }
    }
  }
}
```

### Installation Path
- When installed in `currentUser` mode (recommended):
  `%LOCALAPPDATA%\Programs\MediaDL`
- No UAC administrator elevation prompt is required for installation or silent background updates.

### Uninstallation & User Data Retention
- The uninstaller removes:
  - Application binary (`mediadl.exe`)
  - Desktop and Start Menu shortcuts
  - WebView2 cached web storage
- **Strictly Preserved User Data:**
  - Database: `%LOCALAPPDATA%\MediaDL\mediadl.db`
  - Downloaded media files: User's chosen download directory (e.g. `Downloads/MediaDL`)
  - Managed engine tools: `%LOCALAPPDATA%\MediaDL\bin`
  - Application logs: `%LOCALAPPDATA%\MediaDL\logs`

---

## 3. Dependency Strategy (yt-dlp & FFmpeg)

### Licensing & Legal Compliance
- **yt-dlp:** Distributed under The Unlicense (Public Domain). Free to distribute and execute.
- **FFmpeg / FFprobe:** Distributed under GNU Lesser General Public License (LGPL 2.1+) or GPL 3.0+ depending on compiler flags.
- **Distribution Model:** To prevent legal bloat and huge installer payloads, MediaDL uses a **hybrid managed model**:
  1. **System Detection:** Checks system `PATH` for existing `yt-dlp` or `ffmpeg`.
  2. **Custom Paths:** Users can point to their own existing binaries via Settings.
  3. **Managed In-App Downloader:** Users can click "Download / Update yt-dlp" in Settings to automatically fetch the official GitHub release binary.

### Safe Binary Download & Atomic Swap
- Downloads occur to an isolated user directory: `%LOCALAPPDATA%\MediaDL\bin\yt-dlp.exe`.
- Files are initially downloaded to a temporary filename: `yt-dlp.exe.tmp`.
- MediaDL validates that the downloaded payload size is greater than 1 MB before swapping.
- An atomic rename operation replaces the working executable only after full verification succeeds.

---

## 4. Update Infrastructure & Signing Setup

### Architecture
MediaDL supports over-the-air updates via the Tauri 2 Updater plugin and semantic version comparison.

### Generating Signing Keys
To configure cryptographic signature verification for production updates:

1. Generate keypair with Tauri CLI:
   ```powershell
   npx tauri signer generate -w ~/.tauri/mediadl.key
   ```
2. Store the private key and password securely in your CI/CD repository secrets:
   - `TAURI_SIGNING_PRIVATE_KEY`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
3. Add the generated public key to `src-tauri/tauri.conf.json`:
   ```json
   {
     "plugins": {
       "updater": {
         "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...",
         "endpoints": [
           "https://github.com/sanja/MediaDL/releases/latest/download/latest.json"
         ]
       }
     }
   }
   ```

### Manifest Format (`latest.json`)
The update endpoint serves a JSON manifest structured as:
```json
{
  "version": "1.0.1",
  "notes": "Performance optimizations and yt-dlp extractor fixes.",
  "pub_date": "2026-10-15T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/sanja/MediaDL/releases/download/v1.0.1/MediaDL_1.0.1_x64-setup.exe"
    }
  }
}
```

---

## 5. Security & Threat Model

### 1. Process Injection & Command Construction
- Command execution never invokes a system shell (`cmd.exe` or `powershell.exe`).
- Arguments are passed as discrete vector tokens directly to `std::process::Command`.
- Custom format templates and output directories are validated against path traversal (`..`, `/`, `\`, null bytes, Windows reserved device names like `CON`, `PRN`, `AUX`).

### 2. URL Sanitization
- Input URLs are verified to match standard web protocols (`http://`, `https://`).
- Arbitrary protocols (`file://`, `javascript:`, `data:`, `smb://`) are strictly rejected.

### 3. Telemetry & Log Privacy
- Application logs are filtered through a scrubbing pipeline before writing to disk.
- Query parameters such as `sig=`, `signature=`, `access_token=`, `token=`, `key=`, `password=`, and request cookies are replaced with `[REDACTED]`.

---

## 6. GitHub Actions CI/CD Pipeline

A release workflow `.github/workflows/release.yml` for automated multi-platform builds:

```yaml
name: Release MediaDL

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    permissions:
      contents: write
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Dependencies
        run: npm ci

      - name: Validate TypeScript
        run: npx tsc --noEmit

      - name: Run Rust Tests
        run: cargo test --manifest-path src-tauri/Cargo.toml

      - name: Build Tauri Package
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'MediaDL v__VERSION__'
          releaseBody: 'See RELEASE_NOTES.md for full details.'
          releaseDraft: false
          prerelease: false
```

---

## 7. Local Build Instructions

To build the release installer locally on Windows:

```powershell
# 1. Clean verify frontend
npm run build

# 2. Run test suites
cargo test --manifest-path src-tauri/Cargo.toml

# 3. Compile and bundle Windows NSIS Installer
npx tauri build
```

Generated installer path:
`src-tauri/target/release/bundle/nsis/MediaDL_1.0.0_x64-setup.exe`
