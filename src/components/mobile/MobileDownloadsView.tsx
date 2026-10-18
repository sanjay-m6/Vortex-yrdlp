import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  FolderOpen,
  FileVideo,
  RotateCcw,
  Trash2,
  Search,
  X,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useDownloadStore } from "../../stores/downloadStore";
import { useAppStore } from "../../stores/appStore";
import { api } from "../../lib/api";
import { downloadApi } from "../../lib/downloadApi";
import { DownloadTask } from "../../types";

type FilterTab = "all" | "active" | "completed" | "failed";

export const MobileDownloadsView: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const {
    tasks,
    taskOrder,
    activeCount,
    completedCount,
    failedCount,
    cancelDownload,
    clearCompleted,
    retryDownload,
  } = useDownloadStore();

  const { showToast } = useAppStore();

  const allTasks = useMemo(() => {
    return taskOrder.map((id) => tasks[id]).filter(Boolean);
  }, [taskOrder, tasks]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      if (activeTab === "active") {
        if (
          t.state !== "downloading" &&
          t.state !== "starting" &&
          t.state !== "processing" &&
          t.state !== "cancelling" &&
          t.state !== "queued"
        ) {
          return false;
        }
      } else if (activeTab === "completed") {
        if (t.state !== "completed") return false;
      } else if (activeTab === "failed") {
        if (t.state !== "failed" && t.state !== "cancelled") return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();
        const title = (t.request?.title || "").toLowerCase();
        const uploader = (t.request?.uploader || "").toLowerCase();
        return title.includes(query) || uploader.includes(query);
      }

      return true;
    });
  }, [allTasks, activeTab, search]);

  const handleOpenFile = async (task: DownloadTask) => {
    const path = task.outputPath || task.progress?.outputPath || task.progress?.currentFilename;
    if (!path) {
      showToast("File path is not available", "error");
      return;
    }
    try {
      await downloadApi.openDownloadedFile(path);
      showToast("Opening file...", "info");
    } catch (e) {
      showToast("Could not open file: " + String(e), "error");
    }
  };

  const handleOpenFolder = async (task: DownloadTask) => {
    const path = task.outputPath || task.progress?.outputPath || task.request?.outputDirectory;
    if (!path) return;
    try {
      await downloadApi.openDownloadFolder(path);
      showToast("Revealed in folder", "info");
    } catch (e) {
      showToast("Could not reveal folder: " + String(e), "error");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelDownload(id);
      showToast("Download cancelled", "info");
    } catch {
      showToast("Failed to cancel download", "error");
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryDownload(id);
      showToast("Retrying download...", "info");
    } catch (e) {
      showToast("Retry failed: " + String(e), "error");
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header & Summary Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Downloads</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
              {allTasks.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real-time download progress and task manager
          </p>
        </div>

        {completedCount > 0 && (
          <button
            type="button"
            onClick={clearCompleted}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2.5 py-1 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear Done</span>
          </button>
        )}
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search downloads..."
            className="w-full rounded-xl bg-white/70 dark:bg-slate-900/70 border border-black/[0.08] dark:border-white/[0.08] pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "all" as const, label: "All", count: allTasks.length },
            { id: "active" as const, label: "Active", count: activeCount },
            { id: "completed" as const, label: "Completed", count: completedCount },
            { id: "failed" as const, label: "Failed", count: failedCount },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-white/60 dark:bg-slate-900/60 border border-black/[0.06] dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-black/[0.05] dark:bg-white/[0.08] text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Downloads List */}
      {filteredTasks.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-black/[0.06] dark:border-white/[0.06] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 mx-auto flex items-center justify-center">
            <Download className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No downloads found
            </p>
            <p className="text-xs text-slate-400">
              {search
                ? "No matching tasks found."
                : "Enter a URL on the Home tab to begin downloading."}
            </p>
          </div>
          {!search && (
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold active:scale-95 transition-transform cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Download Media</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => {
            const isDownloading =
              t.state === "downloading" ||
              t.state === "starting" ||
              t.state === "processing";
            const isCompleted = t.state === "completed";
            const isFailed = t.state === "failed" || t.state === "cancelled";

            const percent = t.progress?.percentage ?? (isCompleted ? 100 : 0);

            return (
              <div
                key={t.id}
                className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl space-y-3 transition-colors"
              >
                {/* Top Row: Thumbnail + Info + Status Badge */}
                <div className="flex gap-3 items-start">
                  <div className="w-20 h-14 rounded-xl bg-black/10 dark:bg-white/10 overflow-hidden relative flex-shrink-0 flex items-center justify-center border border-black/[0.06] dark:border-white/[0.06]">
                    {t.request?.thumbnail ? (
                      <img
                        src={t.request.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileVideo className="w-6 h-6 text-indigo-400" />
                    )}

                    {t.request?.duration && (
                      <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-white font-mono text-[8px] font-semibold">
                        {Math.floor(t.request.duration / 60)}:
                        {String(Math.floor(t.request.duration % 60)).padStart(2, "0")}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                      {t.request?.title || t.progress?.currentFilename || "Media Download"}
                    </h3>

                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
                        {t.request?.mediaType || "video"}
                      </span>
                      {t.request?.uploader && <span>• {t.request.uploader}</span>}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {isDownloading && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Downloading</span>
                      </span>
                    )}
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Done</span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                        <XCircle className="w-3 h-3" />
                        <span className="capitalize">{t.state}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar (Visible for active downloads) */}
                {isDownloading && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span>{percent.toFixed(1)}%</span>
                      {t.progress?.speedFormatted && <span>{t.progress.speedFormatted}</span>}
                      {t.progress?.etaFormatted && <span>ETA {t.progress.etaFormatted}</span>}
                      {t.progress?.downloadedBytes && (
                        <span>
                          {(t.progress.downloadedBytes / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                  {isDownloading && (
                    <button
                      type="button"
                      onClick={() => handleCancel(t.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}

                  {isFailed && (
                    <button
                      type="button"
                      onClick={() => handleRetry(t.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  )}

                  {isCompleted && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenFile(t)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open File</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenFolder(t)}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-black/[0.03] dark:bg-white/[0.05] active:scale-95 transition-all cursor-pointer"
                        title="Reveal in folder"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileDownloadsView;
