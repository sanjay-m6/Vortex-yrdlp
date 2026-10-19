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
  ToolDownloadProgressPayload,
  EssentialToolsInstallResult,
  SetupStatus,
  UpdateState,
  UpdateProgressPayload,
  UpdateCheckOptions,
  UpdatePreferences,
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

  downloadLatestFfmpeg: async (): Promise<string> => {
    return invoke("download_latest_ffmpeg");
  },

  downloadAllEssentialTools: async (): Promise<EssentialToolsInstallResult> => {
    return invoke("download_all_essential_tools");
  },

  onToolDownloadProgress: async (
    callback: (payload: ToolDownloadProgressPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<ToolDownloadProgressPayload>("tool_download_progress", (event) => {
      callback(event.payload);
    });
  },

  appShowWindow: async (): Promise<void> => {
    return invoke("app_show_window");
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

  getSetupStatus: async (): Promise<SetupStatus> => {
    return invoke("get_setup_status");
  },

  saveSetupProgress: async (step: number): Promise<void> => {
    return invoke("save_setup_progress", { step });
  },

  completeSetupWizard: async (): Promise<boolean> => {
    return invoke("complete_setup_wizard");
  },

  resetSetupWizard: async (): Promise<void> => {
    return invoke("reset_setup_wizard");
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

  checkAppUpdate: async (options?: UpdateCheckOptions): Promise<AppUpdateInfo> => {
    return invoke("check_app_update", { options });
  },

  downloadUpdate: async (restartImmediately?: boolean, force?: boolean): Promise<void> => {
    return invoke("download_update", { restartImmediately, force });
  },

  installAndRestart: async (force?: boolean): Promise<void> => {
    return invoke("install_and_restart", { force });
  },

  getUpdateState: async (): Promise<UpdateState> => {
    return invoke("get_update_state");
  },

  getUpdatePreferences: async (): Promise<UpdatePreferences> => {
    return invoke("get_update_preferences");
  },

  saveUpdatePreferences: async (prefs: UpdatePreferences): Promise<void> => {
    return invoke("save_update_preferences", { prefs });
  },

  onUpdateDownloadProgress: async (
    callback: (payload: UpdateProgressPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<UpdateProgressPayload>("update_download_progress", (event) => {
      callback(event.payload);
    });
  },

  onUpdateAvailableNotification: async (
    callback: (payload: AppUpdateInfo) => void
  ): Promise<UnlistenFn> => {
    return listen<AppUpdateInfo>("update_available_notification", (event) => {
      callback(event.payload);
    });
  },
};
