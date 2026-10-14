import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FolderOpen,
  Terminal,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useAppStore } from "../../stores/appStore";

interface EngineStatusCardProps {
  onOpenSetup?: () => void;
  onOpenDiagnostics?: () => void;
}

export const EngineStatusCard: React.FC<EngineStatusCardProps> = ({
  onOpenSetup,
  onOpenDiagnostics,
}) => {
  const { status, overallState, isChecking, refreshStatus, pickAndSetPath } =
    useEngineStatus();
  const { showToast } = useAppStore();

  const handlePickYtdlp = async () => {
    const res = await pickAndSetPath("ytdlp");
    if (res.success) {
      showToast("yt-dlp executable configured successfully", "success");
    } else if (!res.cancelled) {
      showToast(res.error || "Failed to validate yt-dlp executable", "error");
    }
  };

  const handleRefresh = async () => {
    await refreshStatus(true);
    showToast("Engine status refreshed", "info");
  };

  const ytdlp = status?.ytdlp;
  const ffmpeg = status?.ffmpeg;

  return (
    <GlassCard className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            yt-dlp Engine Status
          </h3>
        </div>

        <GlassButton
          size="sm"
          onClick={handleRefresh}
          disabled={isChecking}
          title="Re-run engine verification"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
          <span>{isChecking ? "Checking..." : "Recheck"}</span>
        </GlassButton>
      </div>

      {/* Main Status Display */}
      {overallState === "ready" && ytdlp && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Engine Ready — yt-dlp v{ytdlp.version || "Installed"}
                </p>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                  Executable detected and verified for media extraction
                </p>
              </div>
            </div>

            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              {ytdlp.source === "user_configured"
                ? "Custom Path"
                : ytdlp.source === "app_managed"
                ? "App Managed"
                : "System PATH"}
            </span>
          </div>

          <div className="pt-2 border-t border-emerald-500/20 text-[11px] text-slate-600 dark:text-slate-300 font-mono truncate">
            <span className="text-slate-400 dark:text-slate-500 mr-1.5">Path:</span>
            {ytdlp.executablePath || "Resolved in system"}
          </div>
        </div>
      )}

      {overallState === "missing" && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                yt-dlp Not Found
              </p>
              <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                The yt-dlp engine is required to analyze and download media. Place the
                executable in the application tools folder or select your existing file.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <GlassButton size="sm" variant="primary" onClick={handlePickYtdlp}>
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Select Executable</span>
            </GlassButton>

            {onOpenSetup && (
              <GlassButton size="sm" onClick={onOpenSetup}>
                <span>Setup Guide</span>
              </GlassButton>
            )}
          </div>
        </div>
      )}

      {overallState === "error" && ytdlp && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-3">
          <div className="flex items-start gap-2.5">
            <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                Engine Verification Failed
              </p>
              <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                {ytdlp.error || "The executable could not be executed or returned an error."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <GlassButton size="sm" onClick={handlePickYtdlp}>
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Select Different Executable</span>
            </GlassButton>

            {onOpenDiagnostics && (
              <GlassButton size="sm" onClick={onOpenDiagnostics}>
                <span>View Diagnostics</span>
              </GlassButton>
            )}
          </div>
        </div>
      )}

      {/* FFmpeg Companion Status */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] text-xs">
        <div className="flex items-center gap-2">
          {ffmpeg?.available ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-slate-400" />
          )}
          <div>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              FFmpeg Support
            </span>
            <span className="text-[11px] text-slate-500 ml-1.5">
              {ffmpeg?.available
                ? `(v${ffmpeg.version || "Installed"})`
                : "(Optional for Phase 2 — media muxing & format conversion)"}
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            ffmpeg?.available
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20"
          }`}
        >
          {ffmpeg?.available ? "Available" : "Not Detected"}
        </span>
      </div>
    </GlassCard>
  );
};
