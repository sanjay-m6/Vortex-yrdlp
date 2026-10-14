import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  FileVideo,
  Music,
  FolderOpen,
  Play,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { EmptyState } from "../ui/EmptyState";
import { useLibraryStore } from "../../stores/libraryStore";
import { useAppStore } from "../../stores/appStore";

export const RecentDownloads: React.FC = () => {
  const navigate = useNavigate();
  const { items, totalCount, loadLibrary, openFile, openFolder, copyItemPath } =
    useLibraryStore();
  const { showToast } = useAppStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLibrary({ pageSize: 5, sortBy: "newest" });
  }, [loadLibrary]);

  const handleCopyPath = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await copyItemPath(id);
      setCopiedId(id);
      showToast("File path copied to clipboard", "success");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast("Failed to copy file path", "error");
    }
  };

  const handleOpenFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openFile(id);
  };

  const handleOpenFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    openFolder(id);
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "--";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  const recentItems = items.slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Recent Downloads
          </h3>
          {totalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/[0.04] dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
              {totalCount} total
            </span>
          )}
        </div>

        {totalCount > 0 && (
          <button
            onClick={() => navigate("/history")}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {recentItems.length === 0 ? (
        <GlassCard className="p-8">
          <EmptyState
            icon={Download}
            title="No downloads yet"
            description="Media you download with Vortex will automatically be saved and organized here."
          />
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {recentItems.map((item) => {
            const isAudio = item.mediaType === "audio";
            const isAvailable = item.fileAvailability === "available";
            const isCopied = copiedId === item.id;

            return (
              <GlassCard
                key={item.id}
                interactive
                onClick={() => navigate("/history")}
                className="p-3 flex items-center justify-between gap-3 group transition-all"
              >
                {/* Left Thumbnail & Info */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-12 h-9 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] overflow-hidden flex-shrink-0 flex items-center justify-center border border-black/[0.06] dark:border-white/[0.06]">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : isAudio ? (
                      <Music className="w-4 h-4 text-indigo-500" />
                    ) : (
                      <FileVideo className="w-4 h-4 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4
                      className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
                      title={item.title}
                    >
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="uppercase font-mono text-[10px] px-1 rounded bg-black/[0.04] dark:bg-white/[0.06]">
                        {item.formatLabel || item.fileExtension || item.mediaType}
                      </span>
                      <span>{formatBytes(item.fileSizeBytes)}</span>
                      {item.completedAt && (
                        <>
                          <span>•</span>
                          <span>{formatDate(item.completedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {isAvailable && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleOpenFile(item.id, e)}
                        title="Open Media File"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenFolder(item.id, e)}
                        title="Open Containing Folder"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleCopyPath(item.id, e)}
                    title="Copy File Path"
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
