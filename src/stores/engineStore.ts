import { create } from "zustand";
import { EngineStatus, DiagnosticsReport, ToolState } from "../types/engine";
import { engineApi } from "../lib/engine";

export type OverallEngineState =
  | "unknown"
  | "checking"
  | "ready"
  | "missing"
  | "error";

interface EngineStoreState {
  status: EngineStatus | null;
  overallState: OverallEngineState;
  isLoading: boolean;
  error: string | null;
  diagnostics: DiagnosticsReport | null;
  lastUpdated: number | null;

  // Actions
  refreshStatus: (forceRefresh?: boolean) => Promise<void>;
  validateAndSetPath: (
    tool: "ytdlp" | "ffmpeg",
    path: string | null
  ) => Promise<{ success: boolean; error?: string }>;
  pickAndSetPath: (
    tool: "ytdlp" | "ffmpeg"
  ) => Promise<{ success: boolean; error?: string; cancelled?: boolean }>;
  loadDiagnostics: () => Promise<DiagnosticsReport | null>;
}

function computeOverallState(
  status: EngineStatus | null,
  isLoading: boolean
): OverallEngineState {
  if (isLoading && !status) return "checking";
  if (!status) return "unknown";

  const ytdlp = status.ytdlp;
  if (ytdlp.state === "ready" && status.isReady) {
    return "ready";
  }
  if (ytdlp.state === "not_installed") {
    return "missing";
  }
  if (
    ytdlp.state === "launch_failed" ||
    ytdlp.state === "version_unsupported"
  ) {
    return "error";
  }
  if (ytdlp.state === "checking") {
    return "checking";
  }
  return "unknown";
}

export const useEngineStore = create<EngineStoreState>((set, get) => ({
  status: null,
  overallState: "unknown",
  isLoading: false,
  error: null,
  diagnostics: null,
  lastUpdated: null,

  refreshStatus: async (forceRefresh = false) => {
    set({ isLoading: true, error: null });
    try {
      const status = await engineApi.getEngineStatus(forceRefresh);
      set({
        status,
        overallState: computeOverallState(status, false),
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({
        isLoading: false,
        error: msg,
        overallState: "error",
      });
    }
  },

  validateAndSetPath: async (tool, path) => {
    set({ isLoading: true, error: null });
    try {
      await engineApi.setToolPath(tool, path);
      // Refresh status after setting
      const updated = await engineApi.getEngineStatus(true);
      set({
        status: updated,
        overallState: computeOverallState(updated, false),
        isLoading: false,
        lastUpdated: Date.now(),
      });
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  pickAndSetPath: async (tool) => {
    try {
      const picked = await engineApi.pickToolExecutable(tool);
      if (!picked) {
        return { success: false, cancelled: true };
      }
      return await get().validateAndSetPath(tool, picked);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  },

  loadDiagnostics: async () => {
    try {
      const diag = await engineApi.getDiagnostics();
      set({ diagnostics: diag });
      return diag;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      return null;
    }
  },
}));
