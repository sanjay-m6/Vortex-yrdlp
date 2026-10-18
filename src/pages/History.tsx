import React, { useEffect, useState, useTransition } from "react";
import {
  History as HistoryIcon,
  Search,
  LayoutGrid,
  List as ListIcon,
  RefreshCw,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Ban,
  HardDrive,
  Film,
  Music,
  Filter,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../components/glass/GlassCard";
import { GlassButton } from "../components/glass/GlassButton";
import { EmptyState } from "../components/ui/EmptyState";
import { useLibraryStore } from "../stores/libraryStore";
import { MediaLibraryGrid } from "../components/library/MediaLibraryGrid";
import { MediaLibraryList } from "../components/library/MediaLibraryList";
import { MediaDetailsModal } from "../components/library/MediaDetailsModal";
import { DeleteFileConfirmModal } from "../components/library/DeleteFileConfirmModal";
import { RelinkModal } from "../components/library/RelinkModal";
import { MediaLibraryItem } from "../types";

export const History: React.FC = () => {
  const navigate = useNavigate();
  const {
    items,
    summary,
    filter,
    totalCount,
    totalPages,
    currentPage,
    viewMode,
    isLoading,
    selectedItem,
    deleteTargetItem,
    relinkTargetItem,
    loadLibrary,
    setSearchQuery,
    setStatusFilter,
    setMediaTypeFilter,
    setAvailabilityFilter,
    setSortBy,
    setPage,
    setViewMode,
    setSelectedItem,
    setDeleteTargetItem,
    setRelinkTargetItem,
    verifyItem,
    refreshAvailability,
    openFile,
    openFolder,
    copyItemPath,
    relinkItem,
    removeRecord,
    deleteFile,
    retryDownload,
    initEventListener,
  } = useLibraryStore();

  const [searchInput, setSearchInput] = useState(filter.searchQuery || "");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Initialize and register event listeners on mount
  useEffect(() => {
    loadLibrary();
    initEventListener();
  }, [loadLibrary, initEventListener]);

  // Debounced search query
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== filter.searchQuery) {
        setSearchQuery(searchInput);
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const handleCopyPath = async (id: string, path?: string | null) => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
      try {
        const p = await copyItemPath(id);
        navigator.clipboard.writeText(p);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
        console.error("Failed to copy path:", err);
      }
    }
  };

  const formatTotalSize = (bytes: number) => {
    if (bytes <= 0) return "0 MB";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  };

  const isSearchOrFilterActive =
    (filter.searchQuery && filter.searchQuery.trim().length > 0) ||
    filter.status !== "all" ||
    filter.mediaType !== "all" ||
    filter.availability !== "all";

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto animate-fade-in">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <HistoryIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Media Library & History</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Searchable, persistent library of your completed downloads with live disk verification.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh File Availability */}
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={refreshAvailability}
            disabled={isLoading}
            className="text-xs gap-1.5"
            title="Scan disk to re-verify availability of library files"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Availability</span>
          </GlassButton>

          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08]">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Library Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Completed</span>
          </span>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {summary.totalCompleted}
          </p>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Failed</span>
          </span>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {summary.totalFailed}
          </p>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-slate-400" />
            <span>Cancelled</span>
          </span>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {summary.totalCancelled}
          </p>
        </GlassCard>

        <GlassCard className="p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
            <span>Library Storage</span>
          </span>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono truncate">
            {formatTotalSize(summary.totalLibraryBytes)}
          </p>
        </GlassCard>
      </div>

      {/* 3. Search Bar & Filter Controls */}
      <GlassCard className="p-4 space-y-3.5">
        {/* Search Bar Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search library by media title or uploader..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <select
              value={filter.sortBy || "newest"}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
              <option value="file_size">File Size (Largest)</option>
            </select>
          </div>
        </div>

        {/* Filter Badges & Filters Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-black/[0.04] dark:border-white/[0.05] text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 mr-1">Status:</span>
            {(["all", "completed", "failed", "cancelled"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filter.status === st
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Media Type & Availability Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Media Type */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Type:</span>
              <button
                onClick={() => setMediaTypeFilter("all")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                  filter.mediaType === "all"
                    ? "bg-black/10 dark:bg-white/15 text-slate-900 dark:text-slate-100 font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMediaTypeFilter("video")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${
                  filter.mediaType === "video"
                    ? "bg-black/10 dark:bg-white/15 text-slate-900 dark:text-slate-100 font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Film className="w-3 h-3" />
                <span>Video</span>
              </button>
              <button
                onClick={() => setMediaTypeFilter("audio")}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${
                  filter.mediaType === "audio"
                    ? "bg-black/10 dark:bg-white/15 text-slate-900 dark:text-slate-100 font-semibold"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Music className="w-3 h-3" />
                <span>Audio</span>
              </button>
            </div>

            {/* Availability Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Disk:</span>
              <select
                value={filter.availability || "all"}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="px-2 py-1 text-xs rounded bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All States</option>
                <option value="available">Available on Disk</option>
                <option value="missing">Missing / Moved</option>
                <option value="inaccessible">Inaccessible</option>
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 4. Main Library Media Presentation */}
      {items.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <EmptyState
            icon={HistoryIcon}
            title={
              isSearchOrFilterActive
                ? "No matching media found"
                : "No downloaded media in your library"
            }
            description={
              isSearchOrFilterActive
                ? "No downloaded items match your current search and filter criteria. Try clearing search or resetting filters."
                : "Downloads you complete in Vortex will appear here with thumbnails, verified file metadata, and one-click playback."
            }
            action={
              isSearchOrFilterActive ? (
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    loadLibrary({
                      searchQuery: "",
                      status: "all",
                      mediaType: "all",
                      availability: "all",
                      page: 1,
                    });
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </GlassButton>
              ) : (
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="gap-2"
                >
                  <span>Start a Download</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </GlassButton>
              )
            }
          />
        </GlassCard>
      ) : viewMode === "grid" ? (
        <MediaLibraryGrid
          items={items}
          onOpen={openFile}
          onOpenFolder={openFolder}
          onCopyPath={handleCopyPath}
          onDetails={setSelectedItem}
          onRelink={setRelinkTargetItem}
          onRetry={retryDownload}
          onDelete={setDeleteTargetItem}
          copiedId={copiedId}
        />
      ) : (
        <MediaLibraryList
          items={items}
          onOpen={openFile}
          onOpenFolder={openFolder}
          onCopyPath={handleCopyPath}
          onDetails={setSelectedItem}
          onRelink={setRelinkTargetItem}
          onRetry={retryDownload}
          onDelete={setDeleteTargetItem}
          copiedId={copiedId}
        />
      )}

      {/* 5. Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-black/[0.06] dark:border-white/[0.06] text-xs text-slate-500">
          <div>
            Showing {(currentPage - 1) * (filter.pageSize || 24) + 1} -{" "}
            {Math.min(currentPage * (filter.pageSize || 24), totalCount)} of {totalCount} items
          </div>

          <div className="flex items-center gap-1.5">
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 text-xs"
            >
              Previous
            </GlassButton>

            <span className="px-2.5 py-1 font-mono text-slate-700 dark:text-slate-300">
              {currentPage} / {totalPages}
            </span>

            <GlassButton
              size="sm"
              variant="ghost"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 text-xs"
            >
              Next
            </GlassButton>
          </div>
        </div>
      )}

      {/* 6. Context Modals */}
      {/* Media Details Modal */}
      {selectedItem && (
        <MediaDetailsModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onOpen={openFile}
          onOpenFolder={openFolder}
          onCopyPath={handleCopyPath}
          onRelink={(item) => {
            setSelectedItem(null);
            setRelinkTargetItem(item);
          }}
          onVerify={verifyItem}
          onRetry={retryDownload}
          onRemoveRecord={removeRecord}
          onDeleteFile={(item) => {
            setSelectedItem(null);
            setDeleteTargetItem(item);
          }}
          copiedId={copiedId}
        />
      )}

      {/* Explicit Delete File Confirmation Modal */}
      {deleteTargetItem && (
        <DeleteFileConfirmModal
          item={deleteTargetItem}
          onClose={() => setDeleteTargetItem(null)}
          onConfirm={deleteFile}
        />
      )}

      {/* Relink Moved File Modal */}
      {relinkTargetItem && (
        <RelinkModal
          item={relinkTargetItem}
          onClose={() => setRelinkTargetItem(null)}
          onRelink={relinkItem}
        />
      )}
    </div>
  );
};
