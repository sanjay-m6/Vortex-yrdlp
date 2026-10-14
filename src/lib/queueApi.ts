import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  DownloadAttemptRecord,
  DownloadProgress,
  DownloadRequest,
  QueueItem,
  QueuePriority,
  QueueSnapshot,
} from "../types";

export const queueApi = {
  /**
   * Adds a download to the persistent queue with optional priority.
   */
  enqueueDownload: async (
    request: DownloadRequest,
    priority?: QueuePriority
  ): Promise<string> => {
    return await invoke<string>("enqueue_download", {
      request,
      priority: priority || null,
    });
  },

  /**
   * Removes a pending task from the queue.
   */
  removeQueuedDownload: async (taskId: string): Promise<void> => {
    await invoke("remove_queued_download", { taskId });
  },

  /**
   * Moves a queued task up, down, or to top.
   */
  reorderDownload: async (
    taskId: string,
    direction: "up" | "down" | "top"
  ): Promise<void> => {
    await invoke("reorder_download", { taskId, direction });
  },

  /**
   * Updates task priority (low, normal, high).
   */
  setDownloadPriority: async (
    taskId: string,
    priority: QueuePriority
  ): Promise<void> => {
    await invoke("set_download_priority", { taskId, priority });
  },

  /**
   * Pauses queue scheduling (active downloads continue).
   */
  pauseQueue: async (): Promise<boolean> => {
    return await invoke<boolean>("pause_queue");
  },

  /**
   * Resumes queue scheduling.
   */
  resumeQueue: async (): Promise<boolean> => {
    return await invoke<boolean>("resume_queue");
  },

  /**
   * Sets maximum concurrent downloads limit (1 to 5).
   */
  setConcurrencyLimit: async (limit: number): Promise<number> => {
    return await invoke<number>("set_concurrency_limit", { limit });
  },

  /**
   * Gets current concurrency limit.
   */
  getConcurrencyLimit: async (): Promise<number> => {
    return await invoke<number>("get_concurrency_limit");
  },

  /**
   * Gets current queue snapshot with all items and counts.
   */
  getQueueSnapshot: async (): Promise<QueueSnapshot> => {
    return await invoke<QueueSnapshot>("get_queue_snapshot");
  },

  /**
   * Clears completed tasks from the queue and database.
   */
  clearCompletedDownloads: async (): Promise<void> => {
    await invoke("clear_completed_downloads");
  },

  /**
   * Clears failed and cancelled tasks.
   */
  clearFailedDownloads: async (): Promise<void> => {
    await invoke("clear_failed_downloads");
  },

  /**
   * Fetches attempt records for a specific download task.
   */
  getTaskAttempts: async (taskId: string): Promise<DownloadAttemptRecord[]> => {
    return await invoke<DownloadAttemptRecord[]>("get_task_attempts", { taskId });
  },

  /**
   * Event listeners
   */
  listenQueueUpdated: async (
    callback: (snapshot: QueueSnapshot) => void
  ): Promise<UnlistenFn> => {
    return await listen<QueueSnapshot>("queue_updated", (event) => {
      callback(event.payload);
    });
  },

  listenTaskEnqueued: async (
    callback: (task: QueueItem) => void
  ): Promise<UnlistenFn> => {
    return await listen<QueueItem>("task_enqueued", (event) => {
      callback(event.payload);
    });
  },

  listenTaskStarted: async (
    callback: (task: QueueItem) => void
  ): Promise<UnlistenFn> => {
    return await listen<QueueItem>("task_started", (event) => {
      callback(event.payload);
    });
  },

  listenTaskProgress: async (
    callback: (progress: DownloadProgress) => void
  ): Promise<UnlistenFn> => {
    return await listen<DownloadProgress>("download_progress", (event) => {
      callback(event.payload);
    });
  },

  listenTaskCompleted: async (
    callback: (data: { taskId: string; outputPath: string }) => void
  ): Promise<UnlistenFn> => {
    return await listen<{ taskId: string; outputPath: string }>(
      "task_completed",
      (event) => {
        callback(event.payload);
      }
    );
  },

  listenTaskFailed: async (
    callback: (data: { taskId: string; error: string }) => void
  ): Promise<UnlistenFn> => {
    return await listen<{ taskId: string; error: string }>(
      "task_failed",
      (event) => {
        callback(event.payload);
      }
    );
  },

  listenTaskCancelled: async (
    callback: (data: { taskId: string; error: string }) => void
  ): Promise<UnlistenFn> => {
    return await listen<{ taskId: string; error: string }>(
      "task_cancelled",
      (event) => {
        callback(event.payload);
      }
    );
  },

  listenTaskRetried: async (
    callback: (data: { taskId: string; attempt: number }) => void
  ): Promise<UnlistenFn> => {
    return await listen<{ taskId: string; attempt: number }>(
      "task_retried",
      (event) => {
        callback(event.payload);
      }
    );
  },
};
