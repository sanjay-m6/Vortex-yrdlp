import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { libraryApi } from "../lib/libraryApi";
import {
  MediaLibraryFilter,
  MediaLibraryItem,
  MediaLibrarySummary,
} from "../types";

interface LibraryState {
  items: MediaLibraryItem[];
  summary: MediaLibrarySummary;
  filter: MediaLibraryFilter;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  viewMode: "grid" | "list";
  isLoading: boolean;
  error: string | null;
  selectedItem: MediaLibraryItem | null;
  deleteTargetItem: MediaLibraryItem | null;
  relinkTargetItem: MediaLibraryItem | null;

  loadLibrary: (filterOverride?: Partial<MediaLibraryFilter>) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setMediaTypeFilter: (mediaType: string) => void;
  setAvailabilityFilter: (availability: string) => void;
  setSortBy: (sortBy: string) => void;
  setPage: (page: number) => void;
  setViewMode: (mode: "grid" | "list") => void;
  setSelectedItem: (item: MediaLibraryItem | null) => void;
  setDeleteTargetItem: (item: MediaLibraryItem | null) => void;
  setRelinkTargetItem: (item: MediaLibraryItem | null) => void;

  verifyItem: (id: string) => Promise<void>;
  refreshAvailability: () => Promise<void>;
  openFile: (id: string) => Promise<void>;
  openFolder: (id: string) => Promise<void>;
  copyItemPath: (id: string) => Promise<string>;
  relinkItem: (id: string, newPath: string) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
  deleteFile: (id: string, deleteFileOnDisk?: boolean) => Promise<void>;
  retryDownload: (id: string) => Promise<string>;
  initEventListener: () => Promise<() => void>;
}

const defaultSummary: MediaLibrarySummary = {
  totalCompleted: 0,
  totalFailed: 0,
  totalCancelled: 0,
  totalLibraryBytes: 0,
};

const defaultFilter: MediaLibraryFilter = {
  searchQuery: "",
  status: "all",
  mediaType: "all",
  availability: "all",
  sortBy: "newest",
  page: 1,
};

let globalLibraryUnlisteners: Array<() => void> = [];

export const useLibraryStore = create<LibraryState>((set, get) => ({
  items: [],
  summary: defaultSummary,
  filter: defaultFilter,
  totalCount: 0,
  totalPages: 1,
  currentPage: 1,
  viewMode: "grid",
  isLoading: false,
  error: null,
  selectedItem: null,
  deleteTargetItem: null,
  relinkTargetItem: null,

  loadLibrary: async (filterOverride?: Partial<MediaLibraryFilter>) => {
    const currentFilter = get().filter;
    const mergedFilter: MediaLibraryFilter = {
      ...currentFilter,
      ...filterOverride,
    };

    set({ isLoading: true, error: null });
    try {
      const resp = await libraryApi.getDownloadHistory(mergedFilter);
      set({
        items: resp.items,
        totalCount: resp.totalCount,
        totalPages: Math.max(1, resp.totalPages),
        currentPage: resp.page,
        summary: resp.summary,
        filter: mergedFilter,
        isLoading: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
    }
  },

  setSearchQuery: (query: string) => {
    const filter = { ...get().filter, searchQuery: query, page: 1 };
    get().loadLibrary(filter);
  },

  setStatusFilter: (status: string) => {
    const filter = { ...get().filter, status, page: 1 };
    get().loadLibrary(filter);
  },

  setMediaTypeFilter: (mediaType: string) => {
    const filter = { ...get().filter, mediaType, page: 1 };
    get().loadLibrary(filter);
  },

  setAvailabilityFilter: (availability: string) => {
    const filter = { ...get().filter, availability, page: 1 };
    get().loadLibrary(filter);
  },

  setSortBy: (sortBy: string) => {
    const filter = { ...get().filter, sortBy, page: 1 };
    get().loadLibrary(filter);
  },

  setPage: (page: number) => {
    const filter = { ...get().filter, page };
    get().loadLibrary(filter);
  },

  setViewMode: (viewMode: "grid" | "list") => {
    set({ viewMode });
  },

  setSelectedItem: (selectedItem: MediaLibraryItem | null) => {
    set({ selectedItem });
  },

  setDeleteTargetItem: (deleteTargetItem: MediaLibraryItem | null) => {
    set({ deleteTargetItem });
  },

  setRelinkTargetItem: (relinkTargetItem: MediaLibraryItem | null) => {
    set({ relinkTargetItem });
  },

  verifyItem: async (id: string) => {
    try {
      const updated = await libraryApi.verifyLibraryFile(id);
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? updated : i)),
        selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
      }));
    } catch (err) {
      console.error("Failed to verify file:", err);
    }
  },

  refreshAvailability: async () => {
    set({ isLoading: true });
    try {
      await libraryApi.refreshLibraryAvailability();
      await get().loadLibrary();
    } catch (err) {
      console.error("Failed to refresh library availability:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  openFile: async (id: string) => {
    await libraryApi.openLibraryFile(id);
  },

  openFolder: async (id: string) => {
    await libraryApi.openLibraryFolder(id);
  },

  copyItemPath: async (id: string): Promise<string> => {
    return libraryApi.copyPath(id);
  },

  relinkItem: async (id: string, newPath: string) => {
    const updated = await libraryApi.relinkLibraryFile(id, newPath);
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? updated : i)),
      selectedItem: state.selectedItem?.id === id ? updated : state.selectedItem,
      relinkTargetItem: null,
    }));
  },

  removeRecord: async (id: string) => {
    await libraryApi.removeHistoryRecord(id);
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
      selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    }));
    // Refresh summary metrics
    get().loadLibrary();
  },

  deleteFile: async (id: string, deleteFileOnDisk: boolean = true) => {
    try {
      await libraryApi.deleteMediaItem(id, deleteFileOnDisk);
    } catch (err) {
      console.warn("deleteMediaItem invocation error, attempting fallback:", err);
      if (deleteFileOnDisk) {
        try {
          await libraryApi.deleteLibraryFile(id);
        } catch {
          // ignore
        }
      }
      await libraryApi.removeHistoryRecord(id);
    }

    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
      totalCount: Math.max(0, state.totalCount - 1),
      deleteTargetItem: null,
      selectedItem: state.selectedItem?.id === id ? null : state.selectedItem,
    }));
    get().loadLibrary();
  },

  retryDownload: async (id: string): Promise<string> => {
    const res = await libraryApi.retryFailedDownload(id);
    get().loadLibrary();
    return res;
  },

  initEventListener: async () => {
    if (globalLibraryUnlisteners.length > 0) {
      return () => {};
    }

    const unlistenCompleted = await listen("task_completed", () => {
      get().loadLibrary();
    });
    const unlistenFailed = await listen("task_failed", () => {
      get().loadLibrary();
    });
    const unlistenCancelled = await listen("task_cancelled", () => {
      get().loadLibrary();
    });
    const unlistenRetried = await listen("task_retried", () => {
      get().loadLibrary();
    });

    globalLibraryUnlisteners = [
      unlistenCompleted,
      unlistenFailed,
      unlistenCancelled,
      unlistenRetried,
    ];

    return () => {};
  },
}));
