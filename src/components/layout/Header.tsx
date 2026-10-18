import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sun,
  Moon,
  Laptop,
  Settings,
  PanelLeft,
  Plus,
} from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useAppStore } from "../../stores/appStore";

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, switchThemeWithSplash } = useTheme();
  const { isReady, isMissing, isChecking, status } = useEngineStatus();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case "/downloads":
        return { title: "Active Downloads", subtitle: "Real-time stream telemetry and active extraction jobs" };
      case "/queue":
        return { title: "Download Queue", subtitle: "Scheduled, queued, and waiting batch items" };
      case "/history":
        return { title: "Media Library", subtitle: "Completed downloads, local media files, and archives" };
      case "/settings":
        return { title: "Settings", subtitle: "Engine binaries, destination directory, and network rules" };
      case "/about":
        return { title: "About Vortex", subtitle: "System architecture, release notes, and diagnostics" };
      default:
        return { title: "Dashboard", subtitle: "Ingest media URLs, inspect streams, and transcode" };
    }
  };

  const pageInfo = getPageTitle(location.pathname);

  const handleNewDownload = () => {
    navigate("/");
    setTimeout(() => {
      const input = document.getElementById("media-url-input");
      if (input) {
        input.focus();
      }
    }, 100);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewDownload();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <header className="h-14 w-full flex items-center justify-between px-5 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-slate-950/40 backdrop-blur-md select-none flex-shrink-0 z-20">
      {/* Left: Sidebar Toggle & Page Title */}
      <div className="flex items-center gap-3">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Expand Sidebar (Ctrl+B)"
            className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
            {pageInfo.title}
          </h1>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline-block mt-0.5">
            {pageInfo.subtitle}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Quick New Download CTA */}
        <button
          type="button"
          onClick={handleNewDownload}
          title="New Download (Ctrl+N)"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-xs hover:shadow-indigo-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Download</span>
        </button>

        {/* Engine Readiness Indicator */}
        {isChecking ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
            <span>Checking Engine...</span>
          </div>
        ) : isReady ? (
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold cursor-pointer hover:bg-emerald-500/20 transition-colors"
            title={`yt-dlp v${status?.ytdlp?.version || "Ready"} — Click to configure`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden md:inline">Engine Ready</span>
          </button>
        ) : isMissing ? (
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold cursor-pointer hover:bg-amber-500/20 transition-colors"
            title="yt-dlp is not installed. Click to setup."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Setup Engine</span>
          </button>
        ) : (
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-semibold cursor-pointer hover:bg-rose-500/20 transition-colors"
            title="Engine verification failed. Click for diagnostics."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Engine Error</span>
          </button>
        )}

        {/* Segmented Theme Switcher */}
        <div className="flex items-center p-0.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
          <button
            onClick={(e) => switchThemeWithSplash("light", e)}
            title="Light Theme"
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer ${
              theme === "light"
                ? "bg-white dark:bg-slate-800 text-amber-500 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => switchThemeWithSplash("dark", e)}
            title="Dark Theme"
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-white dark:bg-slate-800 text-indigo-400 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => switchThemeWithSplash("system", e)}
            title="System Theme (Follows OS)"
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-all cursor-pointer ${
              theme === "system"
                ? "bg-white dark:bg-slate-800 text-indigo-500 dark:text-indigo-400 shadow-xs"
                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Settings Shortcut */}
        <button
          onClick={() => navigate("/settings")}
          title="Open Settings"
          className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
