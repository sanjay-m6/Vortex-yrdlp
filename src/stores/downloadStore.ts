import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { DownloadProgress, DownloadRequest, DownloadTask, DownloadState } from "../types/download";
import { downloadApi } from "../lib/downloadApi";
import { useAppStore } from "./appStore";

export interface DownloadStoreState {
  tasks: Record<string, DownloadTask>;
  taskOrder: string[];
  activeCount: number;
  completedCount: number;
  failedCount: number;
  isInitialized: boolean;

  // Actions
  init: () => Promise<() => void>;
  loadTasks: () => Promise<void>;
  startDownload: (request: DownloadRequest) => Promise<string>;
  cancelDownload: (taskId: string) => Promise<boolean>;
  retryDownload: (taskId: string) => Promise<string>;
  clearCompleted: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  openFolder: (path: string) => Promise<void>;
}

/**
 * Normalizes any raw task (e.g. from SQLite / Rust QueueItem / incomplete event)
 * into a fully valid and guaranteed DownloadTask structure.
 */
export function normalizeTask(raw: any): DownloadTask {
  if (!raw) {
    const fallbackId = `task_${Date.now()}`;
    return {
      id: fallbackId,
      attemptId: 1,
      request: {
        webpageUrl: "",
        formatSelection: { mode: "best" },
        outputDirectory: "",
        mediaType: "video",
        overwritePolicy: "rename",
      },
      state: "queued",
      progress: {
        taskId: fallbackId,
        attemptId: 1,
        state: "queued",
        percentage: 0,
        downloadedBytes: 0,
        totalBytes: null,
        speedBytesPerSec: null,
        etaSeconds: null,
        speedFormatted: "-- MB/s",
        etaFormatted: "--:--",
        downloadedFormatted: "0.0 MB",
        totalFormatted: "-- MB",
        currentFilename: null,
        stage: "Queued",
        outputPath: null,
        errorMessage: null,
      },
      outputPath: null,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
  }

  const id = String(raw.id || raw.taskId || `task_${Date.now()}`);
  const attemptId = Number(raw.attemptId || raw.attemptCount || 1);
  const state: DownloadState = (raw.state || raw.status || "queued") as DownloadState;

  const rawReq = raw.request || {};
  const request: DownloadRequest = {
    taskId: id,
    webpageUrl: rawReq.webpageUrl || raw.webpageUrl || raw.url || "",
    formatSelection: rawReq.formatSelection || { mode: "best" },
    outputDirectory: rawReq.outputDirectory || raw.outputDirectory || "",
    filenameTemplate: rawReq.filenameTemplate || raw.filenameTemplate || null,
    mediaType: rawReq.mediaType || raw.mediaType || "video",
    overwritePolicy: rawReq.overwritePolicy || "rename",
    title: rawReq.title || raw.title || null,
    uploader: rawReq.uploader || raw.uploader || null,
    thumbnail: rawReq.thumbnail || raw.thumbnail || null,
    duration: rawReq.duration ?? raw.duration ?? null,
    presetId: rawReq.presetId || raw.presetId,
    settingsSnapshot: rawReq.settingsSnapshot || raw.settingsSnapshot,
  };

  const rawProg = raw.progress || {};
  const downloadedBytes = Number(rawProg.downloadedBytes ?? raw.downloadedBytes ?? 0);
  const totalBytes =
    typeof rawProg.totalBytes === "number"
      ? rawProg.totalBytes
      : typeof raw.totalBytes === "number"
      ? raw.totalBytes
      : null;

  let percentage = rawProg.percentage;
  if (typeof percentage !== "number" || isNaN(percentage)) {
    if (totalBytes && totalBytes > 0) {
      percentage = Math.min(100, Math.max(0, (downloadedBytes / totalBytes) * 100));
    } else {
      percentage = state === "completed" ? 100 : 0;
    }
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes || bytes <= 0) return "-- MB";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const progress: DownloadProgress = {
    taskId: id,
    attemptId,
    state,
    percentage: Math.min(100, Math.max(0, percentage)),
    downloadedBytes,
    totalBytes,
    speedBytesPerSec: rawProg.speedBytesPerSec ?? null,
    etaSeconds: rawProg.etaSeconds ?? null,
    speedFormatted: rawProg.speedFormatted || "-- MB/s",
    etaFormatted: rawProg.etaFormatted || "--:--",
    downloadedFormatted: rawProg.downloadedFormatted || formatSize(downloadedBytes),
    totalFormatted: rawProg.totalFormatted || (totalBytes ? formatSize(totalBytes) : "Unknown size"),
    currentFilename:
      rawProg.currentFilename ||
      (raw.outputPath ? String(raw.outputPath).split(/[/\\]/).pop() : null),
    stage:
      rawProg.stage ||
      (state === "queued"
        ? "Waiting in queue"
        : state === "starting"
        ? "Starting process..."
        : state === "downloading"
        ? "Downloading stream..."
        : state === "processing"
        ? "Muxing with FFmpeg..."
        : state === "completed"
        ? "Download completed"
        : state === "failed"
        ? "Download failed"
        : state === "cancelled"
        ? "Cancelled"
        : "Ready"),
    outputPath: rawProg.outputPath || raw.outputPath || null,
    errorMessage: rawProg.errorMessage || raw.errorMessage || raw.error || null,
  };

  return {
    id,
    attemptId,
    request,
    state,
    progress,
    outputPath: raw.outputPath || progress.outputPath || null,
    error: raw.errorMessage || raw.error || progress.errorMessage || null,
    createdAt: raw.createdAt || new Date().toISOString(),
    startedAt: raw.startedAt || null,
    completedAt: raw.completedAt || null,
  };
}

function calculateCounts(tasks: Record<string, DownloadTask>) {
  let active = 0;
  let completed = 0;
  let failed = 0;

  Object.values(tasks).forEach((t) => {
    if (
      t.state === "starting" ||
      t.state === "downloading" ||
      t.state === "processing" ||
      t.state === "cancelling" ||
      t.state === "queued"
    ) {
      active++;
    } else if (t.state === "completed") {
      completed++;
    } else if (t.state === "failed" || t.state === "cancelled") {
      failed++;
    }
  });

  return { active, completed, failed };
}

let globalDownloadUnlisteners: Array<() => void> = [];
let isAttachingListeners = false;

export const useDownloadStore = create<DownloadStoreState>((set, get) => ({
  tasks: {},
  taskOrder: [],
  activeCount: 0,
  completedCount: 0,
  failedCount: 0,
  isInitialized: false,

  init: async () => {
    // Always load the latest tasks from SQLite
    await get().loadTasks();

    if (globalDownloadUnlisteners.length > 0 || isAttachingListeners) {
      return () => {};
    }

    isAttachingListeners = true;

    // Safely update task progress while respecting state transitions and attempt IDs
    const handleProgressUpdate = (payload: DownloadProgress) => {
      set((state) => {
        const existing = state.tasks[payload.taskId];
        if (!existing) {
          // Construct normalized optimistic task
          const optimistic = normalizeTask({
            id: payload.taskId,
            attemptId: payload.attemptId,
            state: payload.state,
            progress: payload,
            outputPath: payload.outputPath,
            errorMessage: payload.errorMessage,
            startedAt: new Date().toISOString(),
          });

          const updatedTasks = { ...state.tasks, [payload.taskId]: optimistic };
          const order = state.taskOrder.includes(payload.taskId)
            ? state.taskOrder
            : [payload.taskId, ...state.taskOrder];
          const counts = calculateCounts(updatedTasks);
          return {
            tasks: updatedTasks,
            taskOrder: order,
            activeCount: counts.active,
            completedCount: counts.completed,
            failedCount: counts.failed,
          };
        }

        // Prevent stale events from earlier attempts
        if (payload.attemptId < existing.attemptId) {
          return state;
        }

        // Prevent late progress events from overwriting terminal states
        if (
          existing.state === "completed" ||
          existing.state === "cancelled" ||
          existing.state === "failed"
        ) {
          if (
            payload.state !== "completed" &&
            payload.state !== "cancelled" &&
            payload.state !== "failed"
          ) {
            return state;
          }
        }

        // If currently cancelling, ignore progress updates unless confirmed cancelled
        if (existing.state === "cancelling" && payload.state !== "cancelled") {
          return state;
        }

        const updatedTask = normalizeTask({
          ...existing,
          state: payload.state,
          progress: {
            ...existing.progress,
            ...payload,
          },
          outputPath: payload.outputPath || existing.outputPath,
          error: payload.errorMessage || existing.error,
          completedAt:
            payload.state === "completed" ||
            payload.state === "cancelled" ||
            payload.state === "failed"
              ? new Date().toISOString()
              : existing.completedAt,
        });

        const updatedTasks = { ...state.tasks, [payload.taskId]: updatedTask };
        const counts = calculateCounts(updatedTasks);

        return {
          tasks: updatedTasks,
          activeCount: counts.active,
          completedCount: counts.completed,
          failedCount: counts.failed,
        };
      });
    };

    try {
      const u1 = await downloadApi.onDownloadStarted(handleProgressUpdate);
      const u2 = await downloadApi.onDownloadProgress(handleProgressUpdate);
      const u3 = await downloadApi.onDownloadProcessing(handleProgressUpdate);
      const u4 = await downloadApi.onDownloadCompleted(handleProgressUpdate);
      const u5 = await downloadApi.onDownloadFailed(handleProgressUpdate);
      const u6 = await downloadApi.onDownloadCancelling(handleProgressUpdate);
      const u7 = await downloadApi.onDownloadCancelled(handleProgressUpdate);
      const u8 = await listen<{ taskId: string; outputPath: string }>(
        "task_completed",
        (event) => {
          set((state) => {
            const existing = state.tasks[event.payload.taskId];
            if (existing) {
              const updated = normalizeTask({
                ...existing,
                state: "completed",
                outputPath: event.payload.outputPath || existing.outputPath,
                progress: {
                  ...existing.progress,
                  state: "completed",
                  outputPath: event.payload.outputPath || existing.progress.outputPath,
                },
              });
              const updatedTasks = { ...state.tasks, [event.payload.taskId]: updated };
              const counts = calculateCounts(updatedTasks);
              return {
                tasks: updatedTasks,
                completedCount: counts.completed,
                activeCount: counts.active,
              };
            }
            return state;
          });
        }
      );

      globalDownloadUnlisteners = [u1, u2, u3, u4, u5, u6, u7, u8];
      set({ isInitialized: true });
    } catch (e) {
      console.error("Failed to attach download event listeners:", e);
    } finally {
      isAttachingListeners = false;
    }

    return () => {
      // Retain persistent listeners across page navigation to avoid missing background download events
    };
  },

  loadTasks: async () => {
    try {
      const list = await downloadApi.listDownloads();
      const taskMap: Record<string, DownloadTask> = {};
      const order: string[] = [];

      list.forEach((raw) => {
        const task = normalizeTask(raw);
        taskMap[task.id] = task;
        order.push(task.id);
      });

      const counts = calculateCounts(taskMap);
      set({
        tasks: taskMap,
        taskOrder: order,
        activeCount: counts.active,
        completedCount: counts.completed,
        failedCount: counts.failed,
      });
    } catch (e) {
      console.warn("Failed to list downloads:", e);
    }
  },

  startDownload: async (request: DownloadRequest) => {
    const taskId = await downloadApi.startDownload(request);
    await get().loadTasks();
    return taskId;
  },

  cancelDownload: async (taskId: string) => {
    set((state) => {
      const t = state.tasks[taskId];
      if (t && (t.state === "downloading" || t.state === "starting" || t.state === "processing")) {
        const updated = {
          ...state.tasks,
          [taskId]: { ...t, state: "cancelling" as const },
        };
        return { tasks: updated };
      }
      return state;
    });

    try {
      return await downloadApi.cancelDownload(taskId);
    } catch (e) {
      console.error("Cancel failed:", e);
      await get().loadTasks();
      return false;
    }
  },

  retryDownload: async (taskId: string) => {
    const newId = await downloadApi.retryDownload(taskId);
    await get().loadTasks();
    return newId;
  },

  clearCompleted: async () => {
    await downloadApi.clearCompletedDownloads();
    await get().loadTasks();
  },

  openFile: async (path: string) => {
    try {
      await downloadApi.openDownloadedFile(path);
      useAppStore.getState().showToast("Opening media file in default player...", "info");
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      useAppStore.getState().showToast(`Could not open file: ${msg}`, "error");
    }
  },

  openFolder: async (path: string) => {
    try {
      await downloadApi.openDownloadFolder(path);
      useAppStore.getState().showToast("Opened destination folder in File Explorer", "success");
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      useAppStore.getState().showToast(`Could not open folder: ${msg}`, "error");
    }
  },
}));
