import React from "react";
import { Folder, RotateCcw, CheckCircle, AlertCircle } from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useAppStore } from "../../stores/appStore";

export const EngineDetails: React.FC = () => {
  const { status, isChecking, pickAndSetPath, validateAndSetPath } =
    useEngineStatus();
  const { showToast } = useAppStore();

  const handlePick = async (tool: "ytdlp" | "ffmpeg") => {
    const res = await pickAndSetPath(tool);
    if (res.success) {
      showToast(`${tool} path configured`, "success");
    } else if (!res.cancelled) {
      showToast(res.error || `Failed to configure ${tool}`, "error");
    }
  };

  const handleReset = async (tool: "ytdlp" | "ffmpeg") => {
    const res = await validateAndSetPath(tool, null);
    if (res.success) {
      showToast(`${tool} reset to default lookup`, "info");
    } else {
      showToast(res.error || `Failed to reset ${tool}`, "error");
    }
  };

  const ytdlp = status?.ytdlp;
  const ffmpeg = status?.ffmpeg;

  return (
    <div className="space-y-4">
      {/* yt-dlp Card */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              yt-dlp Engine
            </h4>
            {ytdlp?.available ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>v{ytdlp.version || "Installed"}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Not Installed</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ytdlp?.source === "user_configured" && (
              <GlassButton
                size="sm"
                onClick={() => handleReset("ytdlp")}
                disabled={isChecking}
                title="Reset to automatic resolution"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </GlassButton>
            )}
            <GlassButton
              size="sm"
              onClick={() => handlePick("ytdlp")}
              disabled={isChecking}
            >
              <Folder className="w-3 h-3 text-indigo-500" />
              <span>Browse...</span>
            </GlassButton>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-black/[0.03] dark:bg-white/[0.03] p-2.5 rounded-lg break-all">
          <div className="flex justify-between text-slate-400 dark:text-slate-500 mb-1">
            <span>Resolved Path</span>
            <span>
              Source:{" "}
              {ytdlp?.source === "user_configured"
                ? "Custom"
                : ytdlp?.source === "app_managed"
                ? "Managed"
                : "System PATH"}
            </span>
          </div>
          {ytdlp?.executablePath || "No executable resolved"}
        </div>
      </GlassCard>

      {/* FFmpeg Card */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              FFmpeg Transcoder
            </h4>
            {ffmpeg?.available ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>v{ffmpeg.version || "Installed"}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Optional (Not Found)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ffmpeg?.source === "user_configured" && (
              <GlassButton
                size="sm"
                onClick={() => handleReset("ffmpeg")}
                disabled={isChecking}
                title="Reset to automatic resolution"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </GlassButton>
            )}
            <GlassButton
              size="sm"
              onClick={() => handlePick("ffmpeg")}
              disabled={isChecking}
            >
              <Folder className="w-3 h-3 text-indigo-500" />
              <span>Browse...</span>
            </GlassButton>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-black/[0.03] dark:bg-white/[0.03] p-2.5 rounded-lg break-all">
          <div className="flex justify-between text-slate-400 dark:text-slate-500 mb-1">
            <span>Resolved Path</span>
            <span>
              Source:{" "}
              {ffmpeg?.source === "user_configured"
                ? "Custom"
                : ffmpeg?.source === "app_managed"
                ? "Managed"
                : ffmpeg?.source === "system_path"
                ? "System PATH"
                : "None"}
            </span>
          </div>
          {ffmpeg?.executablePath || "No executable resolved"}
        </div>
      </GlassCard>
    </div>
  );
};
