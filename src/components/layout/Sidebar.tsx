import React, { useEffect, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Download,
  ListOrdered,
  History,
  Settings,
  Info,
  Plus,
  PanelLeftClose,
  PanelLeft,
  FolderDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useDownloadStore } from "../../stores/downloadStore";
import { useQueueStore } from "../../stores/queueStore";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAppStore } from "../../stores/appStore";
import { api } from "../../lib/api";

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { sidebarOpen, toggleSidebar, showToast } = useAppStore();
  const { activeCount, completedCount, tasks } = useDownloadStore();
  const { snapshot } = useQueueStore();
  const { isReady, isMissing, status } = useEngineStatus();
  const { downloadDirectory } = useSettingsStore();

  const queuedCount = snapshot?.queuedCount ?? 0;

  // Find primary active downloading task if any
  const activeTask = useMemo(() => {
    return Object.values(tasks).find(
      (t) => t.state === "downloading" || t.state === "processing" || t.state === "starting"
    );
  }, [tasks]);

  // Extract human-friendly folder name
  const folderName = useMemo(() => {
    if (!downloadDirectory) return "Downloads";
    const parts = downloadDirectory.split(/[/\\]/).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "Downloads";
  }, [downloadDirectory]);

  // Open download directory in OS File Explorer
  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (downloadDirectory) {
        await api.revealInExplorer(downloadDirectory);
        showToast("Opened destination folder in File Explorer", "success");
      } else {
        showToast("No download destination folder configured", "info");
      }
    } catch (err: any) {
      showToast(`Could not open folder: ${err?.message || String(err)}`, "error");
      console.error("Failed to open destination folder:", err);
    }
  };

  // Navigate to Dashboard and focus URL input
  const handleNewDownload = () => {
    navigate("/");
    setTimeout(() => {
      const input = document.getElementById("media-url-input");
      if (input) {
        input.focus();
      }
    }, 100);
  };

  // Keyboard shortcut: Ctrl+B / Cmd+B for sidebar toggle, Ctrl+N / Cmd+N for new download
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewDownload();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const mainNav = [
    {
      to: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      to: "/downloads",
      label: "Downloads",
      icon: Download,
      badge: activeCount,
      badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25",
      pulse: activeCount > 0,
    },
    {
      to: "/queue",
      label: "Queue",
      icon: ListOrdered,
      badge: queuedCount,
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
      pulse: false,
    },
    {
      to: "/history",
      label: "History",
      icon: History,
      badge: completedCount > 0 ? completedCount : undefined,
      badgeColor: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20",
      pulse: false,
    },
  ];

  const bottomNav = [
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "flex-shrink-0 flex flex-col justify-between h-full bg-white/70 dark:bg-[#0c101d]/75 border-r border-black/[0.06] dark:border-white/[0.07] backdrop-blur-2xl select-none transition-all duration-200 ease-in-out z-20",
        sidebarOpen ? "w-[240px] p-3" : "w-[68px] p-2"
      )}
    >
      {/* ====================================================================
          EXPANDED STATE
         ==================================================================== */}
      {sidebarOpen ? (
        <>
          {/* Top Section */}
          <div className="space-y-4">
            {/* App Branding & Collapse Toggle */}
            <div className="flex items-center justify-between px-1.5 py-1">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
              >
                <div className="relative">
                  <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-sm group-hover:bg-indigo-500/35 transition-all" />
                  <img
                    src="/ytdlpicon.png"
                    alt="Vortex Logo"
                    className="relative w-8 h-8 rounded-xl object-contain shadow-sm shadow-indigo-600/30 group-hover:scale-105 transition-transform"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      Vortex
                    </h2>
                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      v1.2.0
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Desktop Utility</span>
                </div>
              </button>

              <button
                type="button"
                onClick={toggleSidebar}
                title="Collapse sidebar (Ctrl+B)"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* Quick New Download CTA */}
            <button
              type="button"
              onClick={handleNewDownload}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-sm shadow-indigo-600/25 active:scale-[0.98] transition-all cursor-pointer group"
            >
              <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
              <span>New Download</span>
              <span className="text-[9px] font-mono opacity-60 ml-auto bg-black/20 px-1.5 py-0.5 rounded">Ctrl+N</span>
            </button>

            {/* Main Navigation */}
            <div className="space-y-1">
              <div className="px-3 pt-1 pb-1">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  Workspace
                </span>
              </div>
              <nav className="space-y-1">
                {mainNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative select-none",
                          isActive
                            ? "text-indigo-600 dark:text-indigo-300 font-semibold bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-transparent dark:from-indigo-500/20 dark:via-indigo-500/10 dark:to-transparent border border-indigo-500/20 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                          )}
                          <div
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-150 flex-shrink-0 ml-1",
                              isActive
                                ? "bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400"
                                : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="flex-1 truncate tracking-tight">{item.label}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span
                              className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none shadow-xs flex-shrink-0",
                                item.badgeColor
                              )}
                            >
                              {item.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="space-y-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
            {/* Live Active Stream Mini Widget or Engine & Directory Info */}
            {activeTask ? (
              <div
                onClick={() => navigate("/downloads")}
                className="p-2.5 rounded-xl bg-indigo-500/[0.08] dark:bg-indigo-950/40 border border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer group shadow-xs"
                title="Active stream in progress — click to view downloads"
              >
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
                    <span className="truncate">{activeTask.request.title || "Downloading..."}</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 ml-1.5 flex-shrink-0">
                    {Math.round(activeTask.progress.percentage)}%
                  </span>
                </div>

                <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, activeTask.progress.percentage))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  <span className="truncate">{activeTask.progress.speedFormatted || "Streaming"}</span>
                  <span className="flex-shrink-0 ml-1">{activeTask.progress.etaFormatted ? `ETA ${activeTask.progress.etaFormatted}` : ""}</span>
                </div>
              </div>
            ) : null}

            {/* Preferences Section */}
            <div className="space-y-1">
              <div className="px-3 pt-1 pb-1">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                  System
                </span>
              </div>
              <nav className="space-y-1">
                {bottomNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative select-none",
                          isActive
                            ? "text-indigo-600 dark:text-indigo-300 font-semibold bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-transparent dark:from-indigo-500/20 dark:via-indigo-500/10 dark:to-transparent border border-indigo-500/20 shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] border border-transparent"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-600 dark:from-indigo-400 dark:to-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                          )}
                          <div
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-150 flex-shrink-0 ml-1",
                              isActive
                                ? "bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400"
                                : "text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="flex-1 truncate tracking-tight">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>
        </>
      ) : (
        /* ====================================================================
            COLLAPSED STATE (Icon-Rail)
           ==================================================================== */
        <>
          {/* Collapsed Top Section */}
          <div className="flex flex-col items-center gap-3">
            {/* Logo / Expand Trigger */}
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand Sidebar (Ctrl+B)"
              className="relative p-1 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors group cursor-pointer focus:outline-none"
            >
              <div className="absolute inset-0 rounded-xl bg-indigo-500/20 blur-sm group-hover:bg-indigo-500/35 transition-all" />
              <img
                src="/ytdlpicon.png"
                alt="Vortex Logo"
                className="relative w-8 h-8 rounded-xl object-contain shadow-sm shadow-indigo-600/30 group-hover:scale-105 transition-transform"
              />
            </button>

            {/* Quick New Download CTA Icon */}
            <button
              type="button"
              onClick={handleNewDownload}
              title="New Download (Ctrl+N)"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-sm shadow-indigo-600/25 active:scale-[0.98] transition-all cursor-pointer group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            </button>

            {/* Main Nav Icons */}
            <nav className="w-full space-y-1.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col items-center">
              {mainNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    title={item.label}
                    className={({ isActive }) =>
                      cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative group cursor-pointer select-none",
                        isActive
                          ? "bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-xs"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                        <Icon className="w-4 h-4" />
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Collapsed Bottom Section */}
          <div className="w-full flex flex-col items-center pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            {/* Expand button at bottom */}
            <button
              type="button"
              onClick={toggleSidebar}
              title="Expand Sidebar (Ctrl+B)"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </aside>
  );
};
