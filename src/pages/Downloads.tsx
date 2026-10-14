import React, { useEffect, useState, useMemo } from "react";
import {
  Download,
  Trash2,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  Activity,
  FolderOpen,
  Filter,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "../components/glass/GlassCard";
import { EmptyState } from "../components/ui/EmptyState";
import { GlassButton } from "../components/glass/GlassButton";
import { useNavigate } from "react-router-dom";
import { useDownloadStore } from "../stores/downloadStore";
import { DownloadCard } from "../components/download/DownloadCard";
import { ErrorBoundary } from "../components/ui/ErrorBoundary";

type TabFilter = "all" | "active" | "completed" | "failed";

export const Downloads: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    tasks,
    taskOrder,
    activeCount,
    completedCount,
    failedCount,
    init,
    loadTasks,
    clearCompleted,
  } = useDownloadStore();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    init().then((u) => {
      unlisten = u;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [init]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTasks();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const allTasks = useMemo(() => {
    return taskOrder.map((id) => tasks[id]).filter(Boolean);
  }, [taskOrder, tasks]);

  const filteredTasks = useMemo(() => {
    return allTasks.filter((t) => {
      // Status filter
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

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const title = (t.request?.title || "").toLowerCase();
        const filename = (t.progress?.currentFilename || "").toLowerCase();
        const uploader = (t.request?.uploader || "").toLowerCase();
        const url = (t.request?.webpageUrl || "").toLowerCase();

        return (
          title.includes(query) ||
          filename.includes(query) ||
          uploader.includes(query) ||
          url.includes(query)
        );
      }

      return true;
    });
  }, [allTasks, activeTab, searchQuery]);

  return (
    <ErrorBoundary fallbackTitle="Downloads View Error">
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>Downloads Manager</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live media streaming, background transcode, and persistent history.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <GlassButton
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh downloads list"
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </GlassButton>

            {completedCount > 0 && (
              <GlassButton
                size="sm"
                onClick={() => clearCompleted()}
                title="Clear completed download entries"
                className="gap-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear Completed ({completedCount})</span>
              </GlassButton>
            )}
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <GlassCard className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Total Tasks</span>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
                {allTasks.length}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
          </GlassCard>

          <GlassCard className="p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Active Streams</span>
              <span className="text-xl font-bold text-sky-600 dark:text-sky-400 font-mono">
                {activeCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Activity className={`w-4 h-4 ${activeCount > 0 ? "animate-pulse" : ""}`} />
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
              <span className="text-[11px] font-medium text-slate-400 block">Failed / Cancelled</span>
              <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
                {failedCount}
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </GlassCard>
        </div>

        {/* Search & Tabs Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.04] text-xs">
            {[
              { id: "all" as const, label: "All", count: allTasks.length },
              { id: "active" as const, label: "Active", count: activeCount },
              { id: "completed" as const, label: "Completed", count: completedCount },
              { id: "failed" as const, label: "Failed", count: failedCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === tab.id
                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
                      : "bg-black/[0.05] dark:bg-white/[0.05] text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search downloads..."
              className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] text-xs pl-8 pr-3 py-1.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-mono"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Download Items List or Empty State */}
        {filteredTasks.length > 0 ? (
          <div className="space-y-3">
            {filteredTasks.map((t) => (
              <DownloadCard key={t.id} task={t} />
            ))}
          </div>
        ) : (
          <GlassCard className="p-10">
            <EmptyState
              icon={Download}
              title={
                searchQuery
                  ? "No matching downloads found"
                  : activeTab === "active"
                  ? "No active downloads in progress"
                  : activeTab === "completed"
                  ? "No completed downloads yet"
                  : activeTab === "failed"
                  ? "No failed or cancelled downloads"
                  : "No downloads in queue"
              }
              description={
                searchQuery
                  ? `No downloads matched "${searchQuery}". Try clearing your search query.`
                  : activeTab === "active"
                  ? "Active media downloads will show real-time percentage, download speed, and ETA gauges here."
                  : "Paste and analyze any video or audio URL on the Dashboard to start downloading."
              }
              action={
                searchQuery ? (
                  <GlassButton size="sm" onClick={() => setSearchQuery("")}>
                    <span>Clear Search Filter</span>
                  </GlassButton>
                ) : (
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => navigate("/")}
                    className="gap-2"
                  >
                    <span>Go to Dashboard</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </GlassButton>
                )
              }
            />
          </GlassCard>
        )}
      </div>
    </ErrorBoundary>
  );
};
