import { DownloadProgress, DownloadRequest, DownloadState } from "./download";

export type QueuePriority = "low" | "normal" | "high";

export interface QueueItem {
  id: string;
  request: DownloadRequest;
  status: DownloadState;
  priority: QueuePriority;
  queuePosition: number;
  progress?: DownloadProgress | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  outputPath?: string | null;
  downloadedBytes: number;
  totalBytes?: number | null;
  attemptCount: number;
}

export interface DownloadAttemptRecord {
  id?: number | null;
  downloadId: string;
  attemptNumber: number;
  startedAt: string;
  endedAt?: string | null;
  finalStatus: string;
  exitCode?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface QueueSnapshot {
  items: QueueItem[];
  isPaused: boolean;
  concurrencyLimit: number;
  activeCount: number;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
}
