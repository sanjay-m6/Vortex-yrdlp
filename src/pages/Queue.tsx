import React, { useEffect, useState } from "react";
import {
  ListOrdered,
  Play,
  Pause,
  Sliders,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  Trash2,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  Video,
  Music,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  FolderOpen,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../components/glass/GlassCard";
import { GlassButton } from "../components/glass/GlassButton";
import { EmptyState } from "../components/ui/EmptyState";
import { DownloadCard } from "../components/download/DownloadCard";
import { useQueueStore } from "../stores/queueStore";
import { QueueItem, QueuePriority } from "../types";
import { downloadApi } from "../lib/downloadApi";

export const Queue: React.FC = () => {
  const navigate = useNavigate();
  const {
    snapshot,
    isLoading,
    init,
    pauseQueue,
    resumeQueue,
    setConcurrency,
    reorder,
    setPriority,
    remove,
    clearCompleted,
    clearFailed,
    retryTask,
  } = useQueueStore();

  useEffect(() => {
    init();
  }, [init]);

  const items = snapshot?.items || [];
  const isPaused = snapshot?.isPaused || false;
  const concurrency = snapshot?.concurrencyLimit || 2;

  const activeItems = items.filter(
    (i) =>
      i.status === "downloading" ||
      i.status === "starting" ||
      i.status === "processing" ||
      i.status === "cancelling"
  );

  const pendingItems = items
    .filter((i) => i.status === "queued")
    .sort((a, b) => {
      // Sort by priority desc, then queue position asc
      const pOrder = { high: 2, normal: 1, low: 0 };
      const diff = pOrder[b.priority] - pOrder[a.priority];
      if (diff !== 0) return diff;
      return a.queuePosition - b.queuePosition;
    });

  const completedCount = snapshot?.completedCount || 0;
  const failedCount = snapshot?.failedCount || 0;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>Download Queue</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deterministic queue scheduling with persistent SQLite order and concurrency controls.
          </p>
        </div>

        {/* Global Queue Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Pause / Resume Button */}
          <GlassButton
            size="sm"
            variant={isPaused ? "primary" : "secondary"}
            onClick={() => (isPaused ? resumeQueue() : pauseQueue())}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Queue</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Queue</span>
              </>
            )}
          </GlassButton>

          {/* Concurrency Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.06] dark:border-white/[0.06] text-xs">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 dark:text-slate-400 font-medium">Max Concurrency:</span>
            <select
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
              aria-label="Max Concurrency"
              className="bg-transparent font-semibold text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
            >
              {[1, 2, 3, 4, 5].map((val) => (
                <option key={val} value={val} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {val} {val === 1 ? "task" : "tasks"}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Completed */}
          {completedCount > 0 && (
            <GlassButton size="sm" variant="ghost" onClick={clearCompleted} className="text-xs">
              <span>Clear Completed ({completedCount})</span>
            </GlassButton>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Pending Queue</span>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
              {pendingItems.length}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Active Running</span>
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {activeItems.length} / {concurrency}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Completed</span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {completedCount}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block">Queue Status</span>
            <span
              className={`text-xs font-bold uppercase tracking-wider block mt-1 ${
                isPaused
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isPaused ? "Paused" : "Active"}
            </span>
          </div>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isPaused
                ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            {isPaused ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </div>
        </GlassCard>
      </div>

      {/* Active Downloads Section */}
      {activeItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active Downloads ({activeItems.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeItems.map((item) => {
              // Convert QueueItem to DownloadTask representation for the DownloadCard
              const taskObj = {
                id: item.id,
                attemptId: item.attemptCount,
                request: item.request,
                state: item.status,
                progress: item.progress || {
                  taskId: item.id,
                  attemptId: item.attemptCount,
                  state: item.status,
                  percentage: 0,
                  downloadedBytes: item.downloadedBytes,
                  totalBytes: item.totalBytes || null,
                  speedBytesPerSec: null,
                  etaSeconds: null,
                  speedFormatted: "Calculating...",
                  etaFormatted: "--:--",
                  downloadedFormatted: `${Math.round(item.downloadedBytes / (1024 * 1024))} MB`,
                  totalFormatted: item.totalBytes ? `${Math.round(item.totalBytes / (1024 * 1024))} MB` : "Unknown",
                  currentFilename: null,
                  stage: "Starting download stream...",
                  outputPath: item.outputPath || null,
                  errorMessage: item.errorMessage || null,
                },
                outputPath: item.outputPath || null,
                error: item.errorMessage || null,
                createdAt: item.createdAt,
                startedAt: item.startedAt || null,
                completedAt: item.completedAt || null,
              };

              return <DownloadCard key={item.id} task={taskObj} />;
            })}
          </div>
        </div>
      )}

      {/* Pending Queue Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Pending In Queue ({pendingItems.length})</span>
          </h3>
        </div>

        {pendingItems.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <EmptyState
              icon={ListOrdered}
              title="No pending tasks in queue"
              description="Add media URLs from Dashboard to queue them for automatic sequential downloading."
              action={
                <GlassButton variant="primary" size="sm" onClick={() => navigate("/")} className="gap-2">
                  <span>Add Media to Queue</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </GlassButton>
              }
            />
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {pendingItems.map((item, index) => (
              <GlassCard
                key={item.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-indigo-500/30 transition-all duration-150"
              >
                {/* Left: Position, Thumbnail & Details */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Position Badge */}
                  <span className="w-7 h-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center text-xs font-bold text-slate-500 font-mono flex-shrink-0">
                    #{index + 1}
                  </span>

                  {/* Thumbnail / Icon */}
                  <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0 relative border border-black/[0.06] dark:border-white/[0.06]">
                    {item.request.thumbnail ? (
                      <img
                        src={item.request.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : item.request.mediaType === "audio" ? (
                      <Music className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <Video className="w-5 h-5 text-indigo-500" />
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate max-w-sm sm:max-w-md">
                      {item.request.title || item.request.webpageUrl}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] font-mono font-medium text-indigo-600 dark:text-indigo-400">
                        {typeof item.request.formatSelection === "object" && "mode" in item.request.formatSelection
                          ? item.request.formatSelection.mode
                          : "best"}
                      </span>
                      <span>·</span>
                      <span className="truncate max-w-[200px] font-mono">
                        {item.request.outputDirectory}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Priority Controls, Reordering & Delete */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {/* Priority Pill Selector */}
                  <div className="flex items-center gap-1 bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-xl border border-black/[0.06] dark:border-white/[0.06]">
                    {(["low", "normal", "high"] as QueuePriority[]).map((p) => {
                      const isSelected = item.priority === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setPriority(item.id, p)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg font-semibold capitalize transition-all ${
                            isSelected
                              ? p === "high"
                                ? "bg-rose-500 text-white shadow-xs"
                                : p === "normal"
                                ? "bg-indigo-600 text-white shadow-xs"
                                : "bg-slate-500 text-white shadow-xs"
                              : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {/* Reorder Buttons */}
                  <div className="flex items-center gap-0.5">
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => reorder(item.id, "top")}
                      title="Move to Top"
                      className="w-7 h-7 p-0 text-slate-500 hover:text-indigo-600"
                      disabled={index === 0}
                    >
                      <ChevronsUp className="w-3.5 h-3.5" />
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => reorder(item.id, "up")}
                      title="Move Up"
                      className="w-7 h-7 p-0 text-slate-500 hover:text-indigo-600"
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => reorder(item.id, "down")}
                      title="Move Down"
                      className="w-7 h-7 p-0 text-slate-500 hover:text-indigo-600"
                      disabled={index === pendingItems.length - 1}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </GlassButton>
                  </div>

                  {/* Remove Button */}
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(item.id)}
                    title="Remove from Queue"
                    className="w-7 h-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </GlassButton>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
