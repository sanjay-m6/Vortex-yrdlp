import { create } from "zustand";
import { DownloadRequest, QueueItem, QueuePriority, QueueSnapshot } from "../types";
import { queueApi } from "../lib/queueApi";
import { downloadApi } from "../lib/downloadApi";

interface QueueStoreState {
  snapshot: QueueSnapshot | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  init: () => Promise<() => void>;
  refresh: () => Promise<void>;
  enqueue: (request: DownloadRequest, priority?: QueuePriority) => Promise<string>;
  remove: (taskId: string) => Promise<void>;
  reorder: (taskId: string, direction: "up" | "down" | "top") => Promise<void>;
  setPriority: (taskId: string, priority: QueuePriority) => Promise<void>;
  pauseQueue: () => Promise<void>;
  resumeQueue: () => Promise<void>;
  setConcurrency: (limit: number) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  clearFailed: () => Promise<void>;
}

export const useQueueStore = create<QueueStoreState>((set, get) => ({
  snapshot: null,
  isLoading: false,
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return () => {};

    set({ isLoading: true });
    try {
      const snap = await queueApi.getQueueSnapshot();
      set({ snapshot: snap, isInitialized: true, isLoading: false });
    } catch (e) {
      console.error("Failed to load initial queue snapshot:", e);
      set({ isLoading: false });
    }

    // Set up real-time listener for queue updates
    const unlistenQueue = await queueApi.listenQueueUpdated((snap) => {
      set({ snapshot: snap });
    });

    const unlistenProgress = await queueApi.listenTaskProgress((progress) => {
      set((state) => {
        if (!state.snapshot) return state;
        const updatedItems = state.snapshot.items.map((item) => {
          if (item.id === progress.taskId) {
            return {
              ...item,
              status: progress.state,
              progress,
              downloadedBytes: progress.downloadedBytes,
              totalBytes: progress.totalBytes,
              outputPath: progress.outputPath || item.outputPath,
            };
          }
          return item;
        });

        return {
          snapshot: {
            ...state.snapshot,
            items: updatedItems,
          },
        };
      });
    });

    const unlistenCompleted = await queueApi.listenTaskCompleted((data) => {
      set((state) => {
        if (!state.snapshot) return state;
        const updatedItems = state.snapshot.items.map((item) => {
          if (item.id === data.taskId) {
            return {
              ...item,
              status: "completed" as const,
              outputPath: data.outputPath,
              completedAt: new Date().toISOString(),
            };
          }
          return item;
        });
        return {
          snapshot: {
            ...state.snapshot,
            items: updatedItems,
            activeCount: Math.max(0, state.snapshot.activeCount - 1),
            completedCount: state.snapshot.completedCount + 1,
          },
        };
      });
    });

    return () => {
      unlistenQueue();
      unlistenProgress();
      unlistenCompleted();
    };
  },

  refresh: async () => {
    try {
      const snap = await queueApi.getQueueSnapshot();
      set({ snapshot: snap });
    } catch (e) {
      console.error("Failed to refresh queue snapshot:", e);
    }
  },

  enqueue: async (request: DownloadRequest, priority?: QueuePriority) => {
    const id = await queueApi.enqueueDownload(request, priority);
    await get().refresh();
    return id;
  },

  remove: async (taskId: string) => {
    await queueApi.removeQueuedDownload(taskId);
    await get().refresh();
  },

  reorder: async (taskId: string, direction: "up" | "down" | "top") => {
    await queueApi.reorderDownload(taskId, direction);
    await get().refresh();
  },

  setPriority: async (taskId: string, priority: QueuePriority) => {
    await queueApi.setDownloadPriority(taskId, priority);
    await get().refresh();
  },

  pauseQueue: async () => {
    await queueApi.pauseQueue();
    await get().refresh();
  },

  resumeQueue: async () => {
    await queueApi.resumeQueue();
    await get().refresh();
  },

  setConcurrency: async (limit: number) => {
    await queueApi.setConcurrencyLimit(limit);
    await get().refresh();
  },

  cancelTask: async (taskId: string) => {
    await downloadApi.cancelDownload(taskId);
    await get().refresh();
  },

  retryTask: async (taskId: string) => {
    await downloadApi.retryDownload(taskId);
    await get().refresh();
  },

  clearCompleted: async () => {
    await queueApi.clearCompletedDownloads();
    await get().refresh();
  },

  clearFailed: async () => {
    await queueApi.clearFailedDownloads();
    await get().refresh();
  },
}));
