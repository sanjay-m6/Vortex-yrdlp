export type MediaType = "video" | "audio";

export type OverwritePolicy = "overwrite" | "rename" | "skip";

export type FormatSelection =
  | { mode: "best" }
  | { mode: "preset"; value: string }
  | { mode: "custom"; value: string }
  | { mode: "audio_only"; value: { format: string; quality?: string } };

import type { DownloadSettingsSnapshot } from "./presets";

export interface DownloadRequest {
  taskId?: string;
  webpageUrl: string;
  formatSelection: FormatSelection;
  outputDirectory: string;
  filenameTemplate?: string | null;
  mediaType: MediaType;
  overwritePolicy: OverwritePolicy;
  title?: string | null;
  uploader?: string | null;
  thumbnail?: string | null;
  duration?: number | null;
  presetId?: string;
  settingsSnapshot?: DownloadSettingsSnapshot;
}

export type DownloadState =
  | "queued"
  | "starting"
  | "downloading"
  | "processing"
  | "cancelling"
  | "cancelled"
  | "completed"
  | "failed";

export interface DownloadProgress {
  taskId: string;
  attemptId: number;
  state: DownloadState;
  percentage: number;
  downloadedBytes: number;
  totalBytes: number | null;
  speedBytesPerSec: number | null;
  etaSeconds: number | null;
  speedFormatted: string;
  etaFormatted: string;
  downloadedFormatted: string;
  totalFormatted: string;
  currentFilename: string | null;
  stage: string;
  outputPath: string | null;
  errorMessage: string | null;
}

export interface DownloadTask {
  id: string;
  attemptId: number;
  request: DownloadRequest;
  state: DownloadState;
  progress: DownloadProgress;
  outputPath: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
