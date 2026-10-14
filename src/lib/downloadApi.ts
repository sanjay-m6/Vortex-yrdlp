import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { DownloadProgress, DownloadRequest, DownloadTask } from "../types/download";

export const downloadApi = {
  startDownload: async (request: DownloadRequest): Promise<string> => {
    return invoke<string>("start_download", { request });
  },

  cancelDownload: async (taskId: string): Promise<boolean> => {
    return invoke<boolean>("cancel_download", { taskId });
  },

  retryDownload: async (taskId: string): Promise<string> => {
    return invoke<string>("retry_download", { taskId });
  },

  getDownloadStatus: async (taskId: string): Promise<DownloadTask | null> => {
    return invoke<DownloadTask | null>("get_download_status", { taskId });
  },

  listDownloads: async (): Promise<DownloadTask[]> => {
    return invoke<DownloadTask[]>("list_downloads");
  },

  clearCompletedDownloads: async (): Promise<void> => {
    return invoke<void>("clear_completed_downloads");
  },

  openDownloadedFile: async (path: string): Promise<void> => {
    return invoke<void>("open_downloaded_file", { path });
  },

  openDownloadFolder: async (path: string): Promise<void> => {
    return invoke<void>("open_download_folder", { path });
  },

  chooseDownloadDirectory: async (): Promise<string | null> => {
    return invoke<string | null>("choose_download_directory");
  },

  // Event Listeners
  onDownloadStarted: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_started", (event) => {
      callback(event.payload);
    });
  },

  onDownloadProgress: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_progress", (event) => {
      callback(event.payload);
    });
  },

  onDownloadProcessing: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_processing", (event) => {
      callback(event.payload);
    });
  },

  onDownloadCompleted: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_completed", (event) => {
      callback(event.payload);
    });
  },

  onDownloadFailed: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_failed", (event) => {
      callback(event.payload);
    });
  },

  onDownloadCancelling: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_cancelling", (event) => {
      callback(event.payload);
    });
  },

  onDownloadCancelled: async (
    callback: (payload: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgress>("download_cancelled", (event) => {
      callback(event.payload);
    });
  },
};
