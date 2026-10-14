import React from "react";
import {
  FileVideo,
  Music,
  FolderOpen,
  Play,
  RotateCw,
  Info,
  Copy,
  Trash2,
  Link2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { MediaLibraryItem } from "../../types";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface MediaLibraryListProps {
  items: MediaLibraryItem[];
  onOpen: (id: string) => void;
  onOpenFolder: (id: string) => void;
  onCopyPath: (id: string, path?: string | null) => void;
  onDetails: (item: MediaLibraryItem) => void;
  onRelink: (item: MediaLibraryItem) => void;
  onRetry: (id: string) => void;
  onDelete: (item: MediaLibraryItem) => void;
  copiedId: string | null;
}

export const MediaLibraryList: React.FC<MediaLibraryListProps> = ({
  items,
  onOpen,
  onOpenFolder,
  onCopyPath,
  onDetails,
  onRelink,
  onRetry,
  onDelete,
  copiedId,
}) => {
  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "--";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "--";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  const renderAvailabilityBadge = (item: MediaLibraryItem) => {
    switch (item.fileAvailability) {
      case "available":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case "missing":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Missing
          </span>
        );
      case "inaccessible":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-500">
            <XCircle className="w-3 h-3 text-rose-500" />
            Inaccessible
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <HelpCircle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isCompleted = item.status === "completed";
        const isFailed = item.status === "failed";
        const isCancelled = item.status === "cancelled";
        const isAudio = item.mediaType === "audio";
        const isAvailable = item.fileAvailability === "available";
        const isCopied = copiedId === item.id;

        return (
          <GlassCard
            key={item.id}
            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-black/15 dark:hover:border-white/15 transition-all"
          >
            {/* Left: Thumbnail & Title Info */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              {/* Thumbnail Container */}
              <div className="w-16 h-11 rounded-lg bg-slate-100 dark:bg-slate-900/60 overflow-hidden flex items-center justify-center flex-shrink-0 relative border border-black/[0.06] dark:border-white/[0.06]">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : isAudio ? (
                  <Music className="w-5 h-5 text-indigo-500" />
                ) : (
                  <FileVideo className="w-5 h-5 text-indigo-500" />
                )}

                {isCompleted && isAvailable && (
                  <button
                    onClick={() => onOpen(item.id)}
                    className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                    title="Play File"
                  >
                    <Play className="w-4 h-4 text-white fill-current" />
                  </button>
                )}
              </div>

              {/* Title, Uploader, and Badges */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4
                    onClick={() => onDetails(item)}
                    className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                    title={item.title}
                  >
                    {item.title}
                  </h4>
                  {!isCompleted && (
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                        isFailed
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                      }`}
                    >
                      {item.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                  {item.uploader && <span className="truncate max-w-xs">{item.uploader}</span>}
                  <span>•</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                    {item.formatLabel}
                  </span>
                  <span>•</span>
                  <span>{formatBytes(item.fileSizeBytes)}</span>
                  <span>•</span>
                  <span>{formatDate(item.completedAt || item.createdAt)}</span>
                  <span>•</span>
                  {renderAvailabilityBadge(item)}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
              {isCompleted && isAvailable && (
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpen(item.id)}
                  className="p-1.5 h-8 w-8 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  title="Open File"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </GlassButton>
              )}

              {item.outputPath && (
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenFolder(item.id)}
                  className="p-1.5 h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  title="Open Containing Folder"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </GlassButton>
              )}

              {item.outputPath && (
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onCopyPath(item.id, item.outputPath)}
                  className="p-1.5 h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  title={isCopied ? "Copied!" : "Copy File Path"}
                >
                  {isCopied ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </GlassButton>
              )}

              {item.fileAvailability === "missing" && (
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onRelink(item)}
                  className="p-1.5 h-8 w-8 text-amber-500 hover:text-amber-600"
                  title="Relink moved file"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </GlassButton>
              )}

              {(isFailed || isCancelled) && (
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onRetry(item.id)}
                  className="p-1.5 h-8 w-8 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                  title="Retry download in queue"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </GlassButton>
              )}

              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onDetails(item)}
                className="p-1.5 h-8 w-8 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                title="View Media Details"
              >
                <Info className="w-3.5 h-3.5" />
              </GlassButton>

              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item)}
                className="p-1.5 h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                title="Delete File / Remove Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </GlassButton>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
};
