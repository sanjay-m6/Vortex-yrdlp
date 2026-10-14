import { invoke } from "@tauri-apps/api/core";
import { MediaLibraryFilter, MediaLibraryItem, MediaLibraryResponse } from "../types";

export const libraryApi = {
  getDownloadHistory: async (
    filter?: MediaLibraryFilter
  ): Promise<MediaLibraryResponse> => {
    return invoke<MediaLibraryResponse>("get_download_history", { filter });
  },

  searchMediaLibrary: async (
    filter: MediaLibraryFilter
  ): Promise<MediaLibraryResponse> => {
    return invoke<MediaLibraryResponse>("search_media_library", { filter });
  },

  getMediaDetails: async (id: string): Promise<MediaLibraryItem> => {
    return invoke<MediaLibraryItem>("get_media_details", { id });
  },

  verifyLibraryFile: async (id: string): Promise<MediaLibraryItem> => {
    return invoke<MediaLibraryItem>("verify_library_file", { id });
  },

  refreshLibraryAvailability: async (): Promise<number> => {
    return invoke<number>("refresh_library_availability");
  },

  openLibraryFile: async (id: string): Promise<void> => {
    return invoke<void>("open_library_file", { id });
  },

  openLibraryFolder: async (id: string): Promise<void> => {
    return invoke<void>("open_library_folder", { id });
  },

  copyPath: async (id: string): Promise<string> => {
    return invoke<string>("copy_path", { id });
  },

  relinkLibraryFile: async (
    id: string,
    newPath: string
  ): Promise<MediaLibraryItem> => {
    return invoke<MediaLibraryItem>("relink_library_file", {
      id,
      newPath,
    });
  },

  removeHistoryRecord: async (id: string): Promise<void> => {
    return invoke<void>("remove_history_record", { id });
  },

  deleteLibraryFile: async (id: string): Promise<void> => {
    return invoke<void>("delete_library_file", { id });
  },

  retryFailedDownload: async (id: string): Promise<string> => {
    return invoke<string>("retry_failed_download", { id });
  },
};
