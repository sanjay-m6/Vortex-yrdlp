import React, { useState } from "react";
import {
  FileVideo,
  FileAudio,
  CheckCircle2,
  XCircle,
  Clock,
  Folder,
  FileCheck,
  RotateCcw,
  Ban,
  Loader2,
  Copy,
  Check,
  Film,
  Music,
  ExternalLink,
  HardDrive,
  Gauge,
  Sparkles,
} from "lucide-react";
import { DownloadTask } from "../../types/download";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { useDownloadStore, normalizeTask } from "../../stores/downloadStore";
import { useAppStore } from "../../stores/appStore";

interface DownloadCardProps {
  task: DownloadTask;
}

export const DownloadCard: React.FC<DownloadCardProps> = ({ task: rawTask }) => {
  const task = normalizeTask(rawTask);
  const { cancelDownload, retryDownload, openFile, openFolder } = useDownloadStore();
  const { showToast } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [isCancellingLocal, setIsCancellingLocal] = useState(false);

  const { progress, request, state } = task;

  const handleCancel = async () => {
    setIsCancellingLocal(true);
    const success = await cancelDownload(task.id);
    if (!success) {
      showToast("Cancellation request submitted", "info");
    }
  };

  const handleRetry = async () => {
    try {
      await retryDownload(task.id);
      showToast("Download restarted", "info");
    } catch (e) {
      showToast(String(e), "error");
    }
  };

  const handleOpenFile = async () => {
    const target = task.outputPath || task.progress?.outputPath || task.id;
    if (target) {
      try {
        await openFile(target);
      } catch (e: any) {
        showToast(e?.message || String(e) || "Could not open file", "error");
      }
    } else {
      showToast("No output file path recorded for this download", "info");
    }
  };

  const handleOpenFolder = async () => {
    const target = task.outputPath || task.progress?.outputPath || request.outputDirectory || task.id;
    if (target) {
      try {
        await openFolder(target);
      } catch (e: any) {
        showToast(e?.message || String(e) || "Could not open folder", "error");
      }
    } else {
      showToast("No destination folder found for this download", "info");
    }
  };

  const handleCopyPath = async () => {
    const p = task.outputPath || task.progress?.outputPath || request.outputDirectory;
    if (p) {
      try {
        await navigator.clipboard.writeText(p);
        setCopied(true);
        showToast("File path copied to clipboard", "success");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        showToast("Failed to copy path", "error");
      }
    } else {
      showToast("No path available to copy", "info");
    }
  };

  // State styling badge
  const getStateBadge = () => {
    switch (state) {
      case "downloading":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 dark:bg-sky-500/15 px-2.5 py-0.5 rounded-full border border-sky-500/20 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
            <span>Downloading</span>
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-500/15 px-2.5 py-0.5 rounded-full border border-purple-500/20 shadow-xs">
            <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
            <span>Muxing</span>
          </span>
        );
      case "starting":
      case "queued":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
            <Clock className="w-3 h-3" />
            <span>{state === "starting" ? "Starting" : "Queued"}</span>
          </span>
        );
      case "cancelling":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Cancelling...</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
            <Ban className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      case "completed":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Completed</span>
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>Failed</span>
          </span>
        );
      default:
        return null;
    }
  };

  const isAudio = request.mediaType === "audio";
  const displayTitle = request.title || progress.currentFilename || "Media Download";

  const getFormatBadge = () => {
    if (!request.formatSelection) return "BEST";
    if (typeof request.formatSelection === "string") return request.formatSelection;
    if (request.formatSelection.mode === "preset") {
      return String(request.formatSelection.value || "").toUpperCase();
    }
    if (request.formatSelection.mode === "best") {
      return "BEST QUALITY";
    }
    if (request.formatSelection.mode === "audio_only") {
      return String(request.formatSelection.value?.format || "MP3").toUpperCase();
    }
    return "CUSTOM";
  };

  const isLive =
    state === "downloading" ||
    state === "processing" ||
    state === "starting" ||
    state === "cancelling";

  return (
    <GlassCard className="p-4 sm:p-4.5 space-y-3.5 transition-all duration-200 hover:border-indigo-500/30 hover:shadow-md">
      <div className="flex items-start gap-3.5">
        {/* Media Thumbnail Container */}
        <div className="w-24 h-16 sm:w-28 sm:h-18 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] flex-shrink-0 overflow-hidden relative flex items-center justify-center shadow-xs">
          {request.thumbnail ? (
            <img
              src={request.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : isAudio ? (
            <div className="flex flex-col items-center justify-center gap-1 text-indigo-500">
              <Music className="w-6 h-6" />
              <span className="text-[9px] font-semibold uppercase tracking-wider font-mono">Audio</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
              <Film className="w-6 h-6" />
              <span className="text-[9px] font-semibold uppercase tracking-wider font-mono">Video</span>
            </div>
          )}

          {/* Media Duration Badge */}
          {request.duration && request.duration > 0 && (
            <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-medium shadow-xs">
              {Math.floor(request.duration / 60)}:
              {String(Math.floor(request.duration % 60)).padStart(2, "0")}
            </span>
          )}

          {/* Media Type Icon Badge */}
          <div className="absolute top-1 left-1 w-5 h-5 rounded-md bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-[10px]">
            {isAudio ? <Music className="w-2.5 h-2.5" /> : <Film className="w-2.5 h-2.5" />}
          </div>
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4
              className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate tracking-tight"
              title={displayTitle}
            >
              {displayTitle}
            </h4>
            <div className="flex-shrink-0">{getStateBadge()}</div>
          </div>

          {/* Metadata badges row */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
            {request.uploader && (
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                {request.uploader}
              </span>
            )}

            {request.uploader && <span>•</span>}

            <span className="px-1.5 py-0.2 rounded bg-black/[0.04] dark:bg-white/[0.06] font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
              {getFormatBadge()}
            </span>

            {progress.currentFilename && (
              <>
                <span>•</span>
                <span className="truncate max-w-[180px] font-mono text-[10px]" title={progress.currentFilename}>
                  {progress.currentFilename}
                </span>
              </>
            )}
          </div>

          {/* Stage description or Error */}
          {state === "failed" && task.error ? (
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 dark:text-rose-400 leading-snug break-words">
              {task.error}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate pt-0.5">
              {progress.stage}
            </p>
          )}
        </div>
      </div>

      {/* Progress Bar (Active states) */}
      {isLive && (
        <div className="space-y-1.5 pt-1">
          <div className="h-2 w-full bg-black/[0.06] dark:bg-white/[0.06] rounded-full overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                state === "processing"
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse"
                  : state === "cancelling"
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-600"
              }`}
              style={{ width: `${Math.max(progress.percentage, 2)}%` }}
            />
          </div>

          {/* Live Progress Stats Row */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 flex-wrap gap-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {progress.percentage.toFixed(1)}%
            </span>
            <span>
              {progress.downloadedFormatted} / {progress.totalFormatted}
            </span>
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
              <Gauge className="w-3 h-3" />
              <span>{progress.speedFormatted}</span>
            </span>
            <span>ETA {progress.etaFormatted}</span>
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06] gap-2">
        <span
          className="text-[10px] text-slate-400 font-mono truncate max-w-[280px]"
          title={task.outputPath || request.outputDirectory}
        >
          {task.outputPath || request.outputDirectory}
        </span>

        <div className="flex items-center gap-2">
          {/* Active: Cancel button */}
          {isLive && (
            <GlassButton
              size="sm"
              onClick={handleCancel}
              disabled={state === "cancelling" || isCancellingLocal}
              className="text-rose-500 hover:text-rose-600 border-rose-500/20"
            >
              {state === "cancelling" || isCancellingLocal ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3 h-3" />
                  <span>Cancel</span>
                </>
              )}
            </GlassButton>
          )}

          {/* Failed or Cancelled: Retry */}
          {(state === "failed" || state === "cancelled") && (
            <GlassButton size="sm" onClick={handleRetry} className="gap-1.5">
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </GlassButton>
          )}

          {/* Completed: Open File & Folder Controls */}
          {state === "completed" && (
            <>
              <GlassButton
                size="sm"
                variant="primary"
                onClick={handleOpenFile}
                title="Play or open media file"
                className="gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Open File</span>
              </GlassButton>

              <GlassButton
                size="sm"
                onClick={handleOpenFolder}
                title="Show in destination folder"
                className="gap-1.5"
              >
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                <span>Folder</span>
              </GlassButton>

              <GlassButton
                size="sm"
                onClick={handleCopyPath}
                title="Copy file path"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                )}
              </GlassButton>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
