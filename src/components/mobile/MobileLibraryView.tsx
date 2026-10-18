import React, { useEffect, useState, useMemo } from "react";
import {
  Film,
  Music,
  Search,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  FileQuestion,
  RefreshCw,
  X,
} from "lucide-react";
import { useLibraryStore } from "../../stores/libraryStore";
import { useAppStore } from "../../stores/appStore";
import { DeleteFileConfirmModal } from "../library/DeleteFileConfirmModal";
import { RelinkModal } from "../library/RelinkModal";
import { MediaLibraryItem } from "../../types";

export const MobileLibraryView: React.FC = () => {
  const {
    items,
    filter,
    loadLibrary,
    setSearchQuery,
    setMediaTypeFilter,
    openFile,
    openFolder,
    copyItemPath,
    deleteFile,
    removeRecord,
    relinkItem,
    setDeleteTargetItem,
    deleteTargetItem,
    setRelinkTargetItem,
    relinkTargetItem,
  } = useLibraryStore();

  const { showToast } = useAppStore();

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [searchInput, setSearchInput] = useState(filter.searchQuery || "");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Debounced search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchInput, setSearchQuery]);

  const handleCopyPath = async (item: MediaLibraryItem) => {
    try {
      await copyItemPath(item.id);
      setCopiedId(item.id);
      showToast("Path copied to clipboard", "success");
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      showToast("Could not copy path", "error");
    }
  };

  const handleOpenFile = async (item: MediaLibraryItem) => {
    try {
      await openFile(item.id);
      showToast("Opening file...", "info");
    } catch (e) {
      showToast("Cannot open file: " + String(e), "error");
    }
  };

  const handleOpenFolder = async (item: MediaLibraryItem) => {
    try {
      await openFolder(item.id);
      showToast("Revealed in folder", "info");
    } catch (e) {
      showToast("Cannot reveal folder: " + String(e), "error");
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter.mediaType && filter.mediaType !== "all") {
        if (item.mediaType !== filter.mediaType) return false;
      }
      return true;
    });
  }, [items, filter.mediaType]);

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "--";
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header & Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Media Library</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
              {filteredItems.length} Files
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Downloaded media files and metadata records
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === "list"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-400"
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              viewMode === "grid"
                ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-xs"
                : "text-slate-400"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Search & Type Filters */}
      <div className="space-y-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search library..."
            className="w-full rounded-xl bg-white/70 dark:bg-slate-900/70 border border-black/[0.08] dark:border-white/[0.08] pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5">
          {[
            { id: "all" as const, label: "All Media" },
            { id: "video" as const, label: "Videos" },
            { id: "audio" as const, label: "Audio" },
          ].map((cat) => {
            const isSelected = (filter.mediaType || "all") === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setMediaTypeFilter(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white/60 dark:bg-slate-900/60 border border-black/[0.06] dark:border-white/[0.06] text-slate-600 dark:text-slate-400"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Media Items (List or Grid View) */}
      {filteredItems.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-black/[0.06] dark:border-white/[0.06] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 mx-auto flex items-center justify-center">
            <Film className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No files in library
            </p>
            <p className="text-xs text-slate-400">
              Completed downloads will automatically be saved and indexed here.
            </p>
          </div>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl flex items-center gap-3"
            >
              {/* Media Thumbnail */}
              <div
                onClick={() => handleOpenFile(item)}
                className="w-16 h-12 rounded-xl bg-black/10 dark:bg-white/10 overflow-hidden relative flex-shrink-0 flex items-center justify-center border border-black/[0.06] dark:border-white/[0.06] cursor-pointer"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : item.mediaType === "audio" ? (
                  <Music className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Film className="w-5 h-5 text-indigo-400" />
                )}

                {item.duration && (
                  <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-white font-mono text-[8px] font-semibold">
                    {Math.floor(item.duration / 60)}:
                    {String(Math.floor(item.duration % 60)).padStart(2, "0")}
                  </span>
                )}
              </div>

              {/* Media Details */}
              <div
                onClick={() => handleOpenFile(item)}
                className="flex-1 min-w-0 cursor-pointer space-y-0.5"
              >
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {item.title}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="uppercase font-semibold text-indigo-600 dark:text-indigo-400">
                    {item.fileExtension || "media"}
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(item.fileSizeBytes)}</span>
                  {item.createdAt && (
                    <>
                      <span>•</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </>
                  )}
                </div>

                {/* File availability alert if missing */}
                {item.fileAvailability === "missing" && (
                  <div className="flex items-center gap-1 text-[9px] text-amber-500 font-semibold mt-0.5">
                    <FileQuestion className="w-3 h-3" />
                    <span>File moved or missing</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenFile(item)}
                  className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 active:scale-95 cursor-pointer"
                  title="Open file"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenFolder(item)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95 cursor-pointer"
                  title="Reveal in folder"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyPath(item)}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 active:scale-95 cursor-pointer"
                  title="Copy path"
                >
                  {copiedId === item.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTargetItem(item)}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 active:scale-95 cursor-pointer"
                  title="Delete file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 gap-3">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-2.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl space-y-2 flex flex-col justify-between"
            >
              <div
                onClick={() => handleOpenFile(item)}
                className="w-full aspect-video rounded-xl bg-black/10 dark:bg-white/10 overflow-hidden relative flex items-center justify-center cursor-pointer"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film className="w-6 h-6 text-indigo-400" />
                )}
                {item.duration && (
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.2 rounded bg-black/80 text-white font-mono text-[8px] font-semibold">
                    {Math.floor(item.duration / 60)}:
                    {String(Math.floor(item.duration % 60)).padStart(2, "0")}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h4
                  onClick={() => handleOpenFile(item)}
                  className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight cursor-pointer"
                >
                  {item.title}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="uppercase font-semibold text-indigo-600">
                    {item.fileExtension || "media"}
                  </span>
                  <span>{formatFileSize(item.fileSizeBytes)}</span>
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => handleOpenFile(item)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
                >
                  Play
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenFolder(item)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetItem(item)}
                    className="p-1 text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetItem && (
        <DeleteFileConfirmModal
          item={deleteTargetItem}
          onClose={() => setDeleteTargetItem(null)}
          onConfirm={async (id, deleteFileOnDisk) => {
            if (deleteFileOnDisk) {
              await deleteFile(id);
              showToast("File deleted from disk", "success");
            } else {
              await removeRecord(id);
              showToast("Record removed from history", "info");
            }
            setDeleteTargetItem(null);
          }}
        />
      )}

      {/* Relink Modal */}
      {relinkTargetItem && (
        <RelinkModal
          item={relinkTargetItem}
          onClose={() => setRelinkTargetItem(null)}
          onRelink={async (id, newPath) => {
            await relinkItem(id, newPath);
            showToast("File relinked successfully", "success");
            setRelinkTargetItem(null);
          }}
        />
      )}
    </div>
  );
};

export default MobileLibraryView;
