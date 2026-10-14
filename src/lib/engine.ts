import { invoke } from "@tauri-apps/api/core";
import {
  DiagnosticsReport,
  EngineStatus,
  ToolStatus,
  ToolValidationResult,
} from "../types/engine";

export const engineApi = {
  /**
   * Retrieves full engine status across yt-dlp, FFmpeg, and FFprobe.
   */
  getEngineStatus: async (forceRefresh = false): Promise<EngineStatus> => {
    return invoke<EngineStatus>("get_engine_status", { forceRefresh });
  },

  /**
   * Runs an isolated version check for yt-dlp.
   */
  checkYtdlpVersion: async (): Promise<ToolStatus> => {
    return invoke<ToolStatus>("check_ytdlp_version");
  },

  /**
   * Runs an isolated version check for FFmpeg.
   */
  checkFfmpegStatus: async (): Promise<ToolStatus> => {
    return invoke<ToolStatus>("check_ffmpeg_status");
  },

  /**
   * Validates whether a file at the given path is a working executable for the specified tool.
   */
  validateToolPath: async (
    tool: "ytdlp" | "ffmpeg",
    path: string
  ): Promise<ToolValidationResult> => {
    return invoke<ToolValidationResult>("validate_tool_path", { tool, path });
  },

  /**
   * Validates and sets a custom path for a tool (or resets to default if path is null/empty).
   */
  setToolPath: async (
    tool: "ytdlp" | "ffmpeg",
    path: string | null
  ): Promise<ToolStatus> => {
    return invoke<ToolStatus>("set_tool_path", { tool, path });
  },

  /**
   * Opens the native file picker dialog to let the user select a binary, validates it, and returns the path.
   */
  pickToolExecutable: async (tool: "ytdlp" | "ffmpeg"): Promise<string | null> => {
    return invoke<string | null>("pick_tool_executable", { tool });
  },

  /**
   * Retrieves a sanitized diagnostic report suitable for copying to clipboard or viewing.
   */
  getDiagnostics: async (): Promise<DiagnosticsReport> => {
    return invoke<DiagnosticsReport>("get_diagnostics");
  },

  /**
   * Cancels a managed background process safely.
   */
  cancelManagedProcess: async (id: string): Promise<boolean> => {
    return invoke<boolean>("cancel_managed_process", { id });
  },
};
