import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  ProcessCancelledPayload,
  ProcessErrorPayload,
  ProcessExitedPayload,
  ProcessOutputPayload,
  ProcessStartedPayload,
} from "../types/engine";

export const processEvents = {
  onProcessStarted: async (
    callback: (payload: ProcessStartedPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<ProcessStartedPayload>("process_started", (event) => {
      callback(event.payload);
    });
  },

  onProcessOutput: async (
    callback: (payload: ProcessOutputPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<ProcessOutputPayload>("process_output", (event) => {
      callback(event.payload);
    });
  },

  onProcessExited: async (
    callback: (payload: ProcessExitedPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<ProcessExitedPayload>("process_exited", (event) => {
      callback(event.payload);
    });
  },

  onProcessError: async (
    callback: (payload: ProcessErrorPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<ProcessErrorPayload>("process_error", (event) => {
      callback(event.payload);
    });
  },

  onProcessCancelled: async (
    callback: (payload: ProcessCancelledPayload) => void
  ): Promise<UnlistenFn> => {
    return listen<ProcessCancelledPayload>("process_cancelled", (event) => {
      callback(event.payload);
    });
  },
};
