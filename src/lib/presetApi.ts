import { invoke } from "@tauri-apps/api/core";
import {
  DownloadPreset,
  DownloadSettings,
  DownloadSettingsSnapshot,
  FolderRule,
  SettingsValidationResult,
} from "../types/presets";

export const presetApi = {
  getPresets: async (): Promise<DownloadPreset[]> => {
    return invoke<DownloadPreset[]>("get_presets");
  },

  getPresetById: async (id: string): Promise<DownloadPreset | null> => {
    return invoke<DownloadPreset | null>("get_preset_by_id_cmd", { id });
  },

  savePreset: async (preset: DownloadPreset): Promise<DownloadPreset> => {
    return invoke<DownloadPreset>("save_preset", { preset });
  },

  deletePreset: async (id: string): Promise<boolean> => {
    return invoke<boolean>("delete_preset", { id });
  },

  resetPresets: async (): Promise<DownloadPreset[]> => {
    return invoke<DownloadPreset[]>("reset_presets");
  },

  getDownloadSettings: async (): Promise<DownloadSettings> => {
    return invoke<DownloadSettings>("get_download_settings");
  },

  updateDownloadSettings: async (settings: DownloadSettings): Promise<DownloadSettings> => {
    return invoke<DownloadSettings>("update_download_settings", { settings });
  },

  validateDownloadSettings: async (
    snapshot: DownloadSettingsSnapshot
  ): Promise<SettingsValidationResult> => {
    return invoke<SettingsValidationResult>("validate_download_settings_cmd", { snapshot });
  },

  previewFilenameTemplate: async (
    template: string,
    metadata?: {
      title?: string;
      id?: string;
      uploader?: string;
      uploadDate?: string;
      playlistTitle?: string;
      playlistIndex?: number;
    }
  ): Promise<string> => {
    return invoke<string>("preview_filename_template_cmd", {
      template,
      title: metadata?.title ?? null,
      id: metadata?.id ?? null,
      uploader: metadata?.uploader ?? null,
      uploadDate: metadata?.uploadDate ?? null,
      playlistTitle: metadata?.playlistTitle ?? null,
      playlistIndex: metadata?.playlistIndex ?? null,
    });
  },

  resolveOutputDirectory: async (params: {
    rootDir: string;
    folderRule?: FolderRule | null;
    videoSubfolder?: string | null;
    audioSubfolder?: string | null;
    playlistSubfolder?: boolean;
    uploaderSubfolder?: boolean;
    dateSubfolder?: boolean;
    isAudioOnly?: boolean;
    playlistTitle?: string | null;
    uploader?: string | null;
    uploadDate?: string | null;
  }): Promise<string> => {
    return invoke<string>("resolve_output_directory_cmd", {
      rootDir: params.rootDir,
      folderRule: params.folderRule ?? null,
      videoSubfolder: params.videoSubfolder ?? null,
      audioSubfolder: params.audioSubfolder ?? null,
      playlistSubfolder: params.playlistSubfolder ?? false,
      uploaderSubfolder: params.uploaderSubfolder ?? false,
      dateSubfolder: params.dateSubfolder ?? false,
      isAudioOnly: params.isAudioOnly ?? false,
      playlistTitle: params.playlistTitle ?? null,
      uploader: params.uploader ?? null,
      uploadDate: params.uploadDate ?? null,
    });
  },
};
