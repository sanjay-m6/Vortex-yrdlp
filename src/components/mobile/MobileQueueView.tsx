import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ListOrdered,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
  Plus,
  Sliders,
  CheckCircle2,
  Clock,
  Video,
  Music,
  Minus,
} from "lucide-react";
import { useQueueStore } from "../../stores/queueStore";
import { useAppStore } from "../../stores/appStore";
import { QueueItem } from "../../types";

export const MobileQueueView: React.FC = () => {
  const navigate = useNavigate();
  const {
    snapshot,
    init,
    pauseQueue,
    resumeQueue,
    setConcurrency,
    reorder,
    remove,
    clearCompleted,
    clearFailed,
    retryTask,
  } = useQueueStore();

  const { showToast } = useAppStore();

  useEffect(() => {
    init();
  }, [init]);

  const items = snapshot?.items || [];
  const isPaused = snapshot?.isPaused || false;
  const concurrency = snapshot?.concurrencyLimit || 2;

  const pendingItems = items
    .filter((i) => i.status === "queued")
    .sort((a, b) => {
      const pOrder = { high: 2, normal: 1, low: 0 };
      const diff = pOrder[b.priority] - pOrder[a.priority];
      if (diff !== 0) return diff;
      return a.queuePosition - b.queuePosition;
    });

  const activeItems = items.filter(
    (i) =>
      i.status === "downloading" ||
      i.status === "starting" ||
      i.status === "processing"
  );

  const completedCount = snapshot?.completedCount || 0;
  const failedCount = snapshot?.failedCount || 0;

  const handleTogglePause = async () => {
    try {
      if (isPaused) {
        await resumeQueue();
        showToast("Queue scheduling resumed", "success");
      } else {
        await pauseQueue();
        showToast("Queue scheduling paused", "info");
      }
    } catch {
      showToast("Failed to toggle queue state", "error");
    }
  };

  const handleMoveUp = async (item: QueueItem, index: number) => {
    if (index === 0) return;
    try {
      await reorder(item.id, "up");
      showToast(`Moved "${item.request.title || "Item"}" up`, "info");
    } catch {
      showToast("Failed to reorder", "error");
    }
  };

  const handleMoveDown = async (item: QueueItem, index: number) => {
    if (index >= pendingItems.length - 1) return;
    try {
      await reorder(item.id, "down");
      showToast(`Moved "${item.request.title || "Item"}" down`, "info");
    } catch {
      showToast("Failed to reorder", "error");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove(id);
      showToast("Removed from queue", "info");
    } catch {
      showToast("Failed to remove item", "error");
    }
  };

  const handleConcurrencyChange = async (delta: number) => {
    const next = Math.min(5, Math.max(1, concurrency + delta));
    if (next !== concurrency) {
      await setConcurrency(next);
      showToast(`Max concurrent downloads: ${next}`, "info");
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header & Queue Controls */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Download Queue</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
                {pendingItems.length} Waiting
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Persistent task queue scheduling
            </p>
          </div>

          {/* Pause / Resume Queue Scheduler */}
          <button
            type="button"
            onClick={handleTogglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              isPaused
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400"
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Queue</span>
              </>
            )}
          </button>
        </div>

        {/* 2. Control Strip: Concurrency Stepper & Clear Actions */}
        <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Concurrency:
            </span>
            <div className="flex items-center gap-1 bg-black/[0.04] dark:bg-white/[0.06] p-0.5 rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
              <button
                onClick={() => handleConcurrencyChange(-1)}
                disabled={concurrency <= 1}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {concurrency}
              </span>
              <button
                onClick={() => handleConcurrencyChange(1)}
                disabled={concurrency >= 5}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded bg-black/[0.03] dark:bg-white/[0.05] cursor-pointer"
              >
                Clear Done
              </button>
            )}
            {failedCount > 0 && (
              <button
                onClick={clearFailed}
                className="text-[10px] font-semibold text-rose-500 hover:text-rose-600 px-2 py-1 rounded bg-rose-500/10 cursor-pointer"
              >
                Clear Failed
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Active Tasks Summary Banner */}
      {activeItems.length > 0 && (
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span>{activeItems.length} task(s) currently downloading</span>
          </div>

          <button
            onClick={() => navigate("/downloads")}
            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            View →
          </button>
        </div>
      )}

      {/* 4. Queue List */}
      {pendingItems.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-black/[0.06] dark:border-white/[0.06] text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 mx-auto flex items-center justify-center">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Queue is empty
            </p>
            <p className="text-xs text-slate-400">
              Add media to the queue from the Home tab for automated sequential downloading.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Downloads</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendingItems.map((item, index) => (
            <div
              key={item.id}
              className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl flex items-center gap-3 transition-colors"
            >
              {/* Position badge */}
              <div className="w-7 h-7 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-xs font-mono font-bold text-slate-500 flex-shrink-0">
                #{index + 1}
              </div>

              {/* Media Thumbnail */}
              <div className="w-12 h-10 rounded-lg bg-black/10 dark:bg-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {item.request.thumbnail ? (
                  <img
                    src={item.request.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="w-4 h-4 text-indigo-400" />
                )}
              </div>

              {/* Title & Info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.request.title || "Media Stream"}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                  <span
                    className={`font-semibold uppercase ${
                      item.priority === "high"
                        ? "text-rose-500"
                        : item.priority === "low"
                        ? "text-slate-400"
                        : "text-indigo-500"
                    }`}
                  >
                    {item.priority}
                  </span>
                  <span>•</span>
                  <span className="truncate">{item.request.uploader || "Unknown"}</span>
                </div>
              </div>

              {/* Move Up / Down & Remove Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveUp(item, index)}
                  disabled={index === 0}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 active:scale-90 cursor-pointer"
                  title="Move Up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleMoveDown(item, index)}
                  disabled={index === pendingItems.length - 1}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 active:scale-90 cursor-pointer"
                  title="Move Down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 active:scale-90 transition-colors cursor-pointer"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileQueueView;
