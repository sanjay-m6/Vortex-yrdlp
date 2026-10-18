# Vortex / MediaDL — Cross-Platform Build & Release Guide

This document specifies the architecture, local build procedures, GitHub Actions CI/CD workflows, signing configuration, and platform-specific runtime considerations for **Vortex (MediaDL)** across Windows, Linux, macOS, and Android.

---

## 1. Supported Platform Matrix

| Platform | Target Triple | Package Formats | Status | Runtime Prerequisites |
| :--- | :--- | :--- | :--- | :--- |
| **Windows** | `x86_64-pc-windows-msvc` | `.exe` (NSIS), `.msi` (WiX) | **Production Ready** | WebView2 Evergreen (pre-installed on Win 10/11) |
| **Linux** | `x86_64-unknown-linux-gnu` | `.deb`, `.AppImage` | **Production Ready** | WebKitGTK 4.1, GTK 3, Ayatana AppIndicator |
| **macOS** | `aarch64-apple-darwin` / `x86_64` | `.dmg`, `.app` | **Supported** | macOS 10.15+ (Unsigned dev / Notarized prod) |
| **Android** | `aarch64`, `armv7`, `x86_64` | `.apk`, `.aab` | **Configured** | Android 7.0+ (API 24+) |

---

## 2. Local Development & Build Prerequisites

### Windows (Host)
- **Node.js**: `20.x` LTS or newer with `npm`.
- **Rust**: `1.80+` via `rustup` with target `x86_64-pc-windows-msvc`.
- **C++ Build Tools**: Visual Studio 2022 C++ Build Tools & Windows 10/11 SDK.
- **WebView2**: Evergreen WebView2 Runtime.

### Linux (Host / Ubuntu 22.04)
Install required development libraries for Tauri 2:
```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Android (Host / Runner)
- **Java**: OpenJDK 17 (`temurin` or `openjdk-17-jdk`).
- **Android SDK**: API 34+ platform, Build-Tools 34.0.0+, Platform-Tools.
- **Android NDK**: r26b (`26.1.10909125`) or r27.
- **Rust Android Targets**:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
  ```

---

## 3. Local Build Commands

### A. Windows Desktop
```powershell
# 1. Install frontend dependencies
npm ci

# 2. Validate TypeScript & build frontend
npx tsc --noEmit
npm run build

# 3. Run Rust unit and integration test suite
cargo test --manifest-path src-tauri/Cargo.toml

# 4. Compile and bundle Windows NSIS installer
npx tauri build --bundles nsis
```
Output path: `src-tauri/target/release/bundle/nsis/Vortex_1.0.0_x64-setup.exe`

### B. Linux Desktop
```bash
# 1. Install dependencies & build frontend
npm ci
npm run build

# 2. Run Rust tests & linter
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml

# 3. Compile and bundle Debian package & AppImage
npx tauri build --bundles deb,appimage
```
Output paths:
- `src-tauri/target/release/bundle/deb/vortex_1.0.0_amd64.deb`
- `src-tauri/target/release/bundle/appimage/vortex_1.0.0_amd64.AppImage`

### C. Android Mobile
```bash
# 1. Configure environment variables
export ANDROID_HOME="/usr/local/lib/android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/26.1.10909125"

# 2. Initialize Android target (already committed in src-tauri/gen/android)
npx tauri android init --ci --skip-targets-install

# 3. Build Release APK
npm run tauri android build -- --ci --apk
```
Output path: `src-tauri/gen/android/app/build/outputs/apk/universal/release/*.apk`

---

## 4. GitHub Actions CI/CD Architecture

The repository contains 4 modular, production-ready workflows under `.github/workflows/`:

```
.github/workflows/
├── ci.yml               # Automated code quality, TypeScript & Rust test suite
├── build-desktop.yml    # Cross-platform matrix builder (Windows, Linux, macOS)
├── build-android.yml    # Dedicated Android APK & AAB builder
└── release.yml          # End-to-end tag & dispatch release publisher
```

### 1. `ci.yml` (Continuous Integration)
- **Triggers**:
  - Pull requests to `main` / `master`.
  - Pushes to `main` / `master`.
  - Manual execution via `workflow_dispatch`.
- **Jobs**:
  - `frontend-validation`: Runs `npm ci`, `npx tsc --noEmit`, and `npm run build`.
  - `rust-validation`: Installs WebKitGTK / Tauri Linux prerequisites, runs `cargo fmt --check`, `cargo clippy -- -D warnings`, and executes all 67 unit & integration tests.

### 2. `build-desktop.yml` (Desktop Builder)
- **Triggers**:
  - Manual trigger via `workflow_dispatch` (choice of `release` or `debug`).
  - Reusable workflow call via `workflow_call`.
  - Pull requests modifying desktop core files (`src/**`, `src-tauri/**`).
- **Matrix**:
  - `windows-latest` (`x86_64-pc-windows-msvc`) -> Windows `.exe` installer.
  - `ubuntu-22.04` (`x86_64-unknown-linux-gnu`) -> Linux `.deb` & `.AppImage`.
  - `macos-latest` (`aarch64-apple-darwin`) -> macOS `.dmg`.
- **Artifacts**: Uploaded as individual platform zips (`vortex-windows-x64`, `vortex-linux-x64`, `vortex-macos-arm64`) with 14-day retention.

### 3. `build-android.yml` (Android Builder)
- **Triggers**:
  - Manual trigger via `workflow_dispatch` (choice of `apk`, `aab`, or `both`).
  - Reusable workflow call via `workflow_call`.
- **Features**:
  - Configures Java 17 Temurin, Android SDK, Android NDK 26b, and 4 Rust Android targets (`aarch64`, `armv7`, `i686`, `x86_64`).
  - Builds optimized release APKs and App Bundles (`.aab`).
  - Uploads artifacts as `vortex-android-package`.

### 4. `release.yml` (Automated Release Publisher)
- **Triggers**:
  - Pushing a version tag: `git push origin v1.0.0`.
  - Manual workflow dispatch with version input (e.g. `v1.0.0`, draft, pre-release options).
- **Execution Pipeline**:
  1. **Validation Gate**: Verifies tag follows SemVer format (`vX.Y.Z`).
  2. **CI Quality Gate**: Runs all TypeScript, formatting, clippy, and Rust tests before packaging.
  3. **Desktop Matrix Build**: Builds Windows (`.exe`), Linux (`.deb`, `.AppImage`), and macOS (`.dmg`).
  4. **Android Build**: Compiles Android release APK.
  5. **Collation & Checksumming**: Downloads all artifacts, calculates cryptographic SHA-256 hashes, and outputs `SHA256SUMS.txt`.
  6. **Publishing**: Automatically creates the GitHub Release with `RELEASE_NOTES.md` body and attaches all platform packages + checksum file.

---

## 5. Repository Secrets & Signing Setup

Configure the following secrets under **Settings > Secrets and variables > Actions**:

| Secret Name | Purpose | Required |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | Built-in GitHub Actions token for creating releases and attaching assets. | **Automatic** (ensure `contents: write` permission is enabled) |
| `TAURI_SIGNING_PRIVATE_KEY` | Private key for Tauri over-the-air updater manifest signatures. | Optional (required only for updater signatures) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the Tauri updater private key. | Optional |

> [!NOTE]
> Pull requests from external forks do not have access to repository secrets. Builds remain unsigned during PR checks to prevent secret leakage.

### Generating Tauri Updater Signing Keys
```bash
npx tauri signer generate -w ~/.tauri/vortex.key
```
Store the private key content in `TAURI_SIGNING_PRIVATE_KEY` and the password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

---

## 6. How to Create and Publish a Release

### Method A: Using Git Tags (Recommended)
```bash
# 1. Ensure working directory is clean and tests pass
npm run build
cargo test --manifest-path src-tauri/Cargo.toml

# 2. Create annotated git tag
git tag -a v1.0.0 -m "Release Vortex v1.0.0"

# 3. Push tag to GitHub
git push origin v1.0.0
```
GitHub Actions will automatically launch the `release.yml` pipeline, build all target binaries, compute checksums, and publish the release.

### Method B: Using GitHub Actions Web Interface
1. Go to your repository on GitHub.
2. Click **Actions** > **Release - Multi-Platform Distribution**.
3. Click **Run workflow**.
4. Enter the release version (e.g. `v1.0.0`), select whether it is a draft or pre-release, and click **Run workflow**.

---

## 7. Platform Specifics & Known Limitations

### yt-dlp & FFmpeg Binary Resolution
- **Desktop (Windows, Linux, macOS)**:
  - Supports system `PATH` detection (`which yt-dlp` / `where yt-dlp.exe`).
  - Supports custom user-defined paths configured in Settings.
  - Automatically downloads official upstream binaries to the managed directory (`%LOCALAPPDATA%\Vortex\bin` on Windows, `~/.local/share/Vortex/bin` on Linux, `~/Library/Application Support/Vortex/bin` on macOS) with atomic `.tmp` swap and verification.
- **Android Mobile**:
  - Android OS security policy (W^X / SELinux restrictions starting in Android 10) prevents downloading and executing arbitrary native binaries from application data storage.
  - Subprocess execution via `std::process::Command` on Android must point to binaries bundled inside the APK's native library directory (`lib/arm64-v8a/`) or run via a Python runtime layer (e.g., Chaquopy or python-for-android).
  - Storage selection on Android requires Storage Access Framework (SAF) URI permissions rather than desktop absolute filesystem paths.

### System Tray & Window Controls
- System tray integration is guarded with `#[cfg(desktop)]` and compiles exclusively for desktop operating systems.
- Frameless custom titlebar controls (`minimize`, `maximize`, `close`) are desktop-specific; on Android, the operating system manages window chrome and task switching natively.
