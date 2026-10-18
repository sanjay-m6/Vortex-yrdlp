import React, { useState } from "react";
import {
  X,
  Copy,
  CheckCircle2,
  FolderOpen,
  Play,
  RotateCw,
  Trash2,
  Link2,
  ExternalLink,
  Clock,
  HardDrive,
  FileText,
  AlertTriangle,
  User,
  Film,
  Music,
  RefreshCw,
} from "lucide-react";
import { MediaLibraryItem } from "../../types";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface MediaDetailsModalProps {
  item: MediaLibraryItem | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onCopyPath: (id: string, path?: string | null) => void;
  onRelink: (item: MediaLibraryItem) => void;
  onVerify: (id: string) => void;
  onRetry: (id: string) => void;
  onRemoveRecord: (id: string) => void;
  onDeleteFile: (item: MediaLibraryItem) => void;
  copiedId: string | null;
}

export const MediaDetailsModal: React.FC<MediaDetailsModalProps> = ({
  item,
  onClose,
  onOpen,
  onOpenFolder,
  onCopyPath,
  onRelink,
  onVerify,
  onRetry,
  onRemoveRecord,
  onDeleteFile,
  copiedId,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!item) return null;

  const isCompleted = item.status === "completed";
  const isFailed = item.status === "failed";
  const isCancelled = item.status === "cancelled";
  const isAvailable = item.fileAvailability === "available";
  const isCopiedPath = copiedId === item.id;

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "--";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]} (${bytes.toLocaleString()} bytes)`;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return "--:--";
    const totalSecs = Math.round(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(item.sourceUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <GlassCard className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-black/10 dark:border-white/10">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {item.mediaType === "audio" ? (
              <Music className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            ) : (
              <Film className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            )}
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              Media Details & Verification
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-5 text-xs">
          {/* Main Hero Card with Thumbnail */}
          <div className="flex flex-col sm:flex-row gap-4 p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05]">
            <div className="w-full sm:w-44 aspect-video rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden flex-shrink-0 relative flex items-center justify-center">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : item.mediaType === "audio" ? (
                <Music className="w-8 h-8 text-indigo-400" />
              ) : (
                <Film className="w-8 h-8 text-indigo-400" />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                  {item.title}
                </h4>
                {item.uploader && (
                  <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1 font-medium">
                    <User className="w-3.5 h-3.5" />
                    <span>{item.uploader}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md font-semibold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px]">
                  {item.formatLabel}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-md font-semibold uppercase text-[10px] ${
                    isCompleted
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : isFailed
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                      : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                  }`}
                >
                  Status: {item.status}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${
                    isAvailable
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  }`}
                >
                  Disk: {item.fileAvailability}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* File Size */}
            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Verified File Size</span>
              </span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                {formatBytes(item.fileSizeBytes)}
              </p>
            </div>

            {/* Duration */}
            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Duration</span>
              </span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                {formatDuration(item.duration)}
              </p>
            </div>

            {/* Created At */}
            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Download Queued</span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Completed At */}
            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Download Finished</span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                {item.completedAt ? new Date(item.completedAt).toLocaleString() : "Not completed"}
              </p>
            </div>

            {/* Attempt Count */}
            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium">Attempt Records</span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                {item.attemptCount} {item.attemptCount === 1 ? "attempt" : "attempts"}
              </p>
            </div>

            {/* Last Verified */}
            <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>Disk Verification</span>
                <button
                  onClick={() => onVerify(item.id)}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Check disk status now"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>Re-check</span>
                </button>
              </span>
              <p className="font-mono text-slate-800 dark:text-slate-200">
                {item.lastVerifiedAt ? new Date(item.lastVerifiedAt).toLocaleString() : "Pending check"}
              </p>
            </div>
          </div>

          {/* Source Webpage URL */}
          <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Source Webpage URL</span>
              <button
                onClick={handleCopyUrl}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copiedUrl ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? "Copied" : "Copy URL"}</span>
              </button>
            </span>
            <p className="font-mono text-slate-800 dark:text-slate-200 truncate select-all">
              {item.sourceUrl}
            </p>
          </div>

          {/* Stored File Path */}
          <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1.5">
            <span className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
              <span>Output Destination Path</span>
              {item.outputPath && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onCopyPath(item.id, item.outputPath)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isCopiedPath ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{isCopiedPath ? "Copied" : "Copy Path"}</span>
                  </button>
                </div>
              )}
            </span>
            <p className="font-mono text-slate-800 dark:text-slate-200 break-all select-all">
              {item.outputPath || "No output path recorded"}
            </p>
          </div>

          {/* Error Message if Failed */}
          {item.lastError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 space-y-1">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Error details</span>
              </span>
              <p className="font-mono text-[11px] whitespace-pre-wrap">{item.lastError}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 p-4 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {isCompleted && isAvailable && (
              <GlassButton
                size="sm"
                variant="primary"
                onClick={() => onOpen(item.id)}
                className="gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Open File</span>
              </GlassButton>
            )}

            {item.outputPath && (
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onOpenFolder(item.id)}
                className="gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Show in Folder</span>
              </GlassButton>
            )}

            {item.fileAvailability === "missing" && (
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onRelink(item)}
                className="gap-1.5 text-amber-500 hover:text-amber-600"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Relink Moved File</span>
              </GlassButton>
            )}

            {(isFailed || isCancelled) && (
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onRetry(item.id)}
                className="gap-1.5 text-indigo-600 dark:text-indigo-400"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Retry Download</span>
              </GlassButton>
            )}
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() => onRemoveRecord(item.id)}
              className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              title="Removes from history table but leaves file on disk"
            >
              <span>Remove Record</span>
            </GlassButton>

            {isCompleted && isAvailable && (
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onDeleteFile(item)}
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete File</span>
              </GlassButton>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
