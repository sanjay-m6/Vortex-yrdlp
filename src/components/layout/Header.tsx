import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sun, Moon, Laptop, Settings, ShieldCheck } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { useEngineStatus } from "../../hooks/useEngineStatus";

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, switchThemeWithSplash, cycleThemeWithSplash } = useTheme();
  const { isReady, isMissing, isChecking, status } = useEngineStatus();

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case "/downloads":
        return "Downloads";
      case "/queue":
        return "Queue";
      case "/history":
        return "History";
      case "/settings":
        return "Settings";
      case "/about":
        return "About";
      default:
        return "Dashboard";
    }
  };

  const handleCycleTheme = (e: React.MouseEvent) => {
    cycleThemeWithSplash(e);
  };

  const themeIcon = {
    light: <Sun className="w-4 h-4 text-amber-500" />,
    dark: <Moon className="w-4 h-4 text-indigo-400" />,
    system: <Laptop className="w-4 h-4 text-slate-500" />,
  }[theme];

  return (
    <header className="h-14 w-full flex items-center justify-between px-6 border-b border-black/[0.06] dark:border-white/[0.06] bg-white/40 dark:bg-slate-950/40 backdrop-blur-md select-none flex-shrink-0">
      {/* Page Title */}
      <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
        {getPageTitle(location.pathname)}
      </h1>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Dynamic Engine Readiness Indicator */}
        {isChecking ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
            <span>Checking Engine...</span>
          </div>
        ) : isReady ? (
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold cursor-pointer hover:bg-emerald-500/20 transition-colors"
            title={`yt-dlp v${status?.ytdlp.version || "Ready"} — Click to configure`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Engine Ready</span>
          </button>
        ) : isMissing ? (
          <button
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-semibold cursor-pointer hover:bg-amber-500/20 transition-colors"
            title="yt-dlp is not installed. Click to setup."
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Engine Missing</span>
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
