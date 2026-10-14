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
  HelpCircle,
  XCircle,
} from "lucide-react";
import { MediaLibraryItem } from "../../types";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface MediaLibraryGridProps {
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

export const MediaLibraryGrid: React.FC<MediaLibraryGridProps> = ({
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            File available
          </span>
        );
      case "missing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Missing from disk
          </span>
        );
      case "inaccessible":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3 text-rose-500" />
            Inaccessible
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
            <HelpCircle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
            className="flex flex-col justify-between overflow-hidden group hover:shadow-lg transition-all border border-black/[0.06] dark:border-white/[0.08]"
          >
            {/* Top Thumbnail Section */}
            <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-900/60 overflow-hidden flex items-center justify-center">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback on broken remote thumbnail
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : isAudio ? (
                <div className="flex flex-col items-center justify-center gap-2 text-indigo-500 dark:text-indigo-400">
                  <Music className="w-10 h-10 stroke-[1.5]" />
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Audio Track</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-indigo-500 dark:text-indigo-400">
                  <FileVideo className="w-10 h-10 stroke-[1.5]" />
                  <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Video</span>
                </div>
              )}

              {/* Status & Format Badges Overlay */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white shadow-xs">
                  {item.formatLabel}
                </span>
                {item.fileExtension && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase bg-black/50 backdrop-blur-md text-slate-200">
                    {item.fileExtension.replace(".", "")}
                  </span>
                )}
              </div>

              {/* Status tag if failed or cancelled */}
              {!isCompleted && (
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md text-white ${
                      isFailed ? "bg-rose-600/85" : "bg-slate-600/85"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              )}

              {/* Play Overlay if available */}
              {isCompleted && isAvailable && (
                <button
                  onClick={() => onOpen(item.id)}
                  className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer backdrop-blur-[2px]"
                  title="Open in default player"
                >
                  <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-900/90 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
                    <Play className="w-5 h-5 ml-0.5 fill-current" />
                  </div>
                </button>
              )}
            </div>

            {/* Middle Info Section */}
            <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
              <div>
                <h3
                  onClick={() => onDetails(item)}
                  className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                  title={item.title}
                >
                  {item.title}
                </h3>
                {item.uploader && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                    {item.uploader}
                  </p>
                )}
              </div>

              <div className="space-y-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.05]">
                {/* File size & Download Date */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>{formatBytes(item.fileSizeBytes)}</span>
                  <span>{formatDate(item.completedAt || item.createdAt)}</span>
                </div>

                {/* Availability status badge */}
                <div>{renderAvailabilityBadge(item)}</div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="px-3.5 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.04] dark:border-white/[0.05] flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                {isCompleted && isAvailable ? (
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpen(item.id)}
                    className="p-1.5 h-7 w-7 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    title="Open File"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </GlassButton>
                ) : null}

                {item.outputPath && (
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenFolder(item.id)}
                    className="p-1.5 h-7 w-7 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
                    className="p-1.5 h-7 w-7 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
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
                    className="p-1.5 h-7 w-7 text-amber-500 hover:text-amber-600"
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
                    className="p-1.5 h-7 w-7 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                    title="Retry download in queue"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </GlassButton>
                )}
              </div>

              <div className="flex items-center gap-1">
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onDetails(item)}
                  className="p-1.5 h-7 w-7 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title="View Media Details"
                >
                  <Info className="w-3.5 h-3.5" />
                </GlassButton>

                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(item)}
                  className="p-1.5 h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  title="Delete File / Remove Record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
};
