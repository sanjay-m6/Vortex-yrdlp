export type ToolState =
  | "ready"
  | "not_installed"
  | "version_unsupported"
  | "launch_failed"
  | "checking";

export type ToolSource = "user_configured" | "app_managed" | "system_path";

export interface ToolStatus {
  available: boolean;
  state: ToolState;
  version: string | null;
  executablePath: string | null;
  error: string | null;
  source: ToolSource | null;
}

export interface EngineStatus {
  ytdlp: ToolStatus;
  ffmpeg: ToolStatus;
  ffprobe: ToolStatus;
  osInfo: string;
  appVersion: string;
  tauriVersion: string;
  lastChecked: string | null;
  isReady: boolean;
  managedToolsDir: string;
}

export interface ToolValidationResult {
  valid: boolean;
  toolType: string;
  resolvedPath: string;
  version: string | null;
  error: string | null;
}

export interface DiagnosticsReport {
  appVersion: string;
  tauriVersion: string;
  osInfo: string;
  ytdlp: ToolStatus;
  ffmpeg: ToolStatus;
  ffprobe: ToolStatus;
  managedToolsDir: string;
  lastChecked: string | null;
  rawReport: string;
}

export interface ProcessStartedPayload {
  id: string;
  command: string;
  args: string[];
  pid: number | null;
  timestamp: string;
}

export interface ProcessOutputPayload {
  id: string;
  stream: "stdout" | "stderr";
  line: string;
  timestamp: string;
}

export interface ProcessExitedPayload {
  id: string;
  exitCode: number | null;
  success: boolean;
  timestamp: string;
}

export interface ProcessErrorPayload {
  id: string;
  error: string;
  timestamp: string;
}

export interface ProcessCancelledPayload {
  id: string;
  timestamp: string;
}
