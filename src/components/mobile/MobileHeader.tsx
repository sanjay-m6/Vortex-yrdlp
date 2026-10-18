import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Heart, ArrowDownCircle } from "lucide-react";
import { useDownloadStore } from "../../stores/downloadStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTheme } from "../../hooks/useTheme";
import { DonateModal } from "../ui/DonateModal";

export const MobileHeader: React.FC = () => {
  const navigate = useNavigate();
  const activeCount = useDownloadStore((s) => s.activeCount);
  const theme = useSettingsStore((s) => s.theme);
  const { switchThemeWithSplash } = useTheme();
  const [donateOpen, setDonateOpen] = useState(false);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = (e: React.MouseEvent) => {
    switchThemeWithSplash(isDark ? "light" : "dark", e);
  };

  return (
    <>
      <header
        className="sticky top-0 z-30 w-full bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06] px-4 py-2.5 transition-colors select-none"
        style={{
          paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        }}
      >
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          {/* Brand Identity */}
          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer active:scale-98 transition-transform"
          >
            <img
              src="/ytdlpicon.png"
              alt="MediaDL"
              className="w-7 h-7 rounded-lg object-contain shadow-sm shadow-indigo-600/30"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  MediaDL
                </span>
                <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Mobile
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Fast & Private Downloader
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5">
            {/* Active Download Beacon */}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => navigate("/downloads")}
                aria-label={`${activeCount} active downloads`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold active:scale-95 transition-transform cursor-pointer"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                </span>
                <ArrowDownCircle className="w-3.5 h-3.5" />
                <span>{activeCount}</span>
              </button>
            )}

            {/* Quick Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] active:scale-95 transition-all cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>

            {/* Donate / Support Button */}
            <button
              type="button"
              onClick={() => setDonateOpen(true)}
              aria-label="Support the project"
              className="p-2 rounded-xl text-rose-500 hover:text-rose-600 bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Heart className="w-4 h-4 fill-rose-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Support / Donate Modal */}
      <DonateModal isOpen={donateOpen} onClose={() => setDonateOpen(false)} />
    </>
  );
};

export default MobileHeader;
