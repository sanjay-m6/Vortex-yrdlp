import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  AppSettings,
  DependencyStatus,
  DownloadOptions,
  DownloadProgressPayload,
  HistoryItem,
  MediaMetadata,
  SystemDiagnosticReport,
  AppUpdateInfo,
} from "../types";

export const api = {
  checkDependencies: async (): Promise<DependencyStatus> => {
    return invoke("check_system_dependencies");
  },

  pickDownloadDirectory: async (): Promise<string | null> => {
    return invoke("pick_download_directory");
  },

  getDefaultDownloadDirectory: async (): Promise<string> => {
    return invoke("get_default_download_directory");
  },

  revealInExplorer: async (path: string): Promise<void> => {
    return invoke("reveal_in_explorer", { path });
  },

  downloadLatestYtdlp: async (): Promise<string> => {
    return invoke("download_latest_ytdlp");
  },

  analyzeMediaUrl: async (url: string): Promise<MediaMetadata> => {
    return invoke("analyze_media_url", { url });
  },

  startMediaDownload: async (options: DownloadOptions): Promise<string> => {
    return invoke("start_media_download", { options });
  },

  cancelMediaDownload: async (id: string): Promise<boolean> => {
    return invoke("cancel_media_download", { id });
  },

  getDownloadHistory: async (): Promise<HistoryItem[]> => {
    return invoke("get_download_history");
  },

  removeHistoryItem: async (id: string): Promise<void> => {
    return invoke("remove_history_item", { id });
  },

  clearDownloadHistory: async (): Promise<void> => {
    return invoke("clear_download_history");
  },

  getAppSettings: async (): Promise<AppSettings> => {
    return invoke("get_app_settings");
  },

  updateAppSettings: async (settings: AppSettings): Promise<void> => {
    return invoke("update_app_settings", { settings });
  },

  onDownloadProgress: async (
    callback: (payload: DownloadProgressPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<DownloadProgressPayload>("download-progress", (event) => {
      callback(event.payload);
    });
  },

  // Phase 10 Production Logging & Updates
  getDiagnosticsReport: async (): Promise<SystemDiagnosticReport> => {
    return invoke("get_diagnostics_report");
  },

  openLogsDirectory: async (): Promise<void> => {
    return invoke("open_logs_directory");
  },

  readRecentLogs: async (lines?: number): Promise<string[]> => {
    return invoke("read_recent_logs", { lines });
  },

  checkAppUpdate: async (): Promise<AppUpdateInfo> => {
    return invoke("check_app_update");
  },
};
