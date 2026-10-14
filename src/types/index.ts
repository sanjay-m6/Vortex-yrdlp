export * from "./engine";
export * from "./download";
export * from "./presets";
export * from "./library";

export interface DependencyStatus {
  ytdlp_installed: boolean;
  ytdlp_version: string | null;
  ytdlp_path: string | null;
  ffmpeg_installed: boolean;
  ffmpeg_version: string | null;
  ffmpeg_path: string | null;
}

export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string | null;
  height: number | null;
  width: number | null;
  fps: number | null;
  filesize: number | null;
  filesize_approx: number | null;
  vcodec: string | null;
  acodec: string | null;
  tbr: number | null;
  format_note: string | null;
  is_audio_only: boolean;
  is_video_only: boolean;
  has_both: boolean;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration: number | null;
}

export interface MediaMetadata {
  id: string;
  title: string;
  url: string;
  thumbnail: string | null;
  uploader: string | null;
  uploader_url: string | null;
  duration: number | null;
  duration_string: string | null;
  description: string | null;
  view_count: number | null;
  formats: VideoFormat[];
  is_playlist: boolean;
  playlist_count: number | null;
  playlist_entries: PlaylistEntry[] | null;
}

export interface DownloadOptions {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  format_id: string | null;
  quality_preset: string; // "best" | "4k" | "1440p" | "1080p" | "720p" | "480p" | "audio_best" | "mp3_320" | "mp3_192" | "wav"
  download_dir: string;
  custom_filename: string | null;
  is_audio_only: boolean;
  audio_format: string | null;
  embed_thumbnail: boolean;
  embed_subtitles: boolean;
  playlist_item_indices: number[] | null;
}

export interface DownloadProgressPayload {
  download_id: string;
  status: "queued" | "downloading" | "processing" | "completed" | "error" | "cancelled";
  percentage: number;
  speed: string;
  eta: string;
  downloaded_bytes: string;
  total_bytes: string;
  current_step: string;
  output_path: string | null;
  error_message: string | null;
}

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  file_path: string;
  file_size_bytes: number | null;
  format_name: string;
  is_audio: boolean;
  completed_at: string;
  status: string;
}

export interface AppSettings {
  download_dir: string;
  default_video_quality: string;
  default_audio_format: string;
  max_concurrent_downloads: number;
  rate_limit_kbps: number | null;
  custom_ytdlp_path: string | null;
  custom_ffmpeg_path: string | null;
  auto_remove_completed: boolean;
  embed_metadata: boolean;
}

export * from "./queue";

export interface SystemDiagnosticReport {
  appName: string;
  appVersion: string;
  osType: string;
  osArch: string;
  databasePath: string;
  databaseSizeBytes: number;
  logsDirectory: string;
  ytdlpInstalled: boolean;
  ytdlpVersion: string | null;
  ytdlpPath: string | null;
  ffmpegInstalled: boolean;
  ffmpegVersion: string | null;
  ffmpegPath: string | null;
  generatedAt: string;
  recentLogs: string[];
}

export interface AppUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseName: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  downloadUrl: string | null;
  signatureVerified: boolean;
  statusMessage: string;
}

