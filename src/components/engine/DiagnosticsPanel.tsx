import React, { useState } from "react";
import {
  Activity,
  Copy,
  Check,
  RefreshCw,
  FileText,
  ShieldCheck,
  FolderOpen,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useAppStore } from "../../stores/appStore";
import { api } from "../../lib/api";

export const DiagnosticsPanel: React.FC = () => {
  const { status, isChecking, refreshStatus, loadDiagnostics } = useEngineStatus();
  const { showToast } = useAppStore();
  const [copied, setCopied] = useState(false);

  const handleOpenLogs = async () => {
    try {
      await api.openLogsDirectory();
      showToast("Opened logs folder in Explorer", "success");
    } catch {
      showToast("Could not open logs folder", "error");
    }
  };

  const handleCopyDiagnostics = async () => {
    try {
      const diag = await loadDiagnostics();
      if (diag && diag.rawReport) {
        await navigator.clipboard.writeText(diag.rawReport);
        setCopied(true);
        showToast("Sanitized diagnostics copied to clipboard", "success");
        setTimeout(() => setCopied(false), 2500);
      } else {
        showToast("Could not generate diagnostic report", "error");
      }
    } catch {
      showToast("Failed to copy diagnostics", "error");
    }
  };

  const handleRefresh = async () => {
    await refreshStatus(true);
    showToast("Diagnostics updated", "info");
  };

  const ytdlp = status?.ytdlp;
  const ffmpeg = status?.ffmpeg;

  return (
    <GlassCard className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            System & Engine Diagnostics
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            size="sm"
            onClick={handleOpenLogs}
            title="Open application logs directory in File Explorer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Logs</span>
          </GlassButton>

          <GlassButton
            size="sm"
            onClick={handleCopyDiagnostics}
            title="Copy sanitized report to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Report</span>
              </>
            )}
          </GlassButton>

          <GlassButton
            size="sm"
            onClick={handleRefresh}
            disabled={isChecking}
            title="Refresh diagnostic status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </GlassButton>
        </div>
      </div>

      {/* Diagnostics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            Operating System
          </span>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            {status?.osInfo || "Detecting..."}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            App & Tauri Versions
          </span>
          <p className="font-mono text-slate-800 dark:text-slate-200">
            Vortex v{status?.appVersion || "1.0.0"} (Tauri {status?.tauriVersion || "2.0"})
          </p>
        </div>

        <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            yt-dlp Engine
          </span>
          <p className="font-mono text-slate-800 dark:text-slate-200 truncate">
            {ytdlp?.available
              ? `v${ytdlp.version} (${ytdlp.source})`
              : `Unavailable — ${ytdlp?.state}`}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] space-y-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            FFmpeg Support
          </span>
          <p className="font-mono text-slate-800 dark:text-slate-200 truncate">
            {ffmpeg?.available
              ? `v${ffmpeg.version} (${ffmpeg.source})`
              : "Optional — Not detected"}
          </p>
        </div>
      </div>

      {/* Diagnostic details & privacy badge */}
      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5 font-mono">
          <FileText className="w-3.5 h-3.5 text-slate-400" />
          Last checked: {status?.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : "Never"}
        </span>

        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sanitized (zero secret leaks)</span>
        </span>
      </div>
    </GlassCard>
  );
};
