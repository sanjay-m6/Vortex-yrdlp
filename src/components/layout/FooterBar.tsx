import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Info,
  FolderDown,
  Download,
  CheckCircle2,
  AlertCircle,
  Command,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useDownloadStore } from "../../stores/downloadStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAppStore } from "../../stores/appStore";
import { api } from "../../lib/api";
import { DonateModal } from "../ui/DonateModal";
import { ShortcutsModal } from "../ui/ShortcutsModal";

export const FooterBar: React.FC = () => {
  const navigate = useNavigate();
  const { isReady, isMissing, isChecking, status } = useEngineStatus();
  const { activeCount } = useDownloadStore();
  const { downloadDirectory } = useSettingsStore();
  const { showToast } = useAppStore();

  const [donateOpen, setDonateOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const folderName = useMemo(() => {
    if (!downloadDirectory) return "Downloads";
    const parts = downloadDirectory.split(/[/\\]/).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "Downloads";
  }, [downloadDirectory]);

  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (downloadDirectory) {
        await api.revealInExplorer(downloadDirectory);
        showToast("Opened destination folder in File Explorer", "success");
      } else {
        showToast("No download destination directory set", "info");
      }
    } catch (err: any) {
      showToast(`Could not open folder: ${err?.message || String(err)}`, "error");
    }
  };

  const handleOpenGithub = async () => {
    const url = "https://github.com/sanjay-m6/Vortex-ytdlp";
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleCheckUpdates = async () => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    showToast("Checking for updates...", "info");
    try {
      const res = await api.checkAppUpdate();
      if (res.hasUpdate) {
        showToast(`Update available: v${res.latestVersion}`, "info");
      } else {
        showToast("Vortex is up to date (v1.0.0)", "success");
      }
    } catch (err: any) {
      showToast(err?.toString() || "Update check completed", "info");
    } finally {
      setCheckingUpdates(false);
    }
  };

  return (
    <>
      <footer className="h-8 w-full flex items-center justify-between px-3 bg-white/75 dark:bg-[#0c101d]/85 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/[0.07] select-none z-30 flex-shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
        {/* Left Side: System & Transfer Health */}
        <div className="flex items-center gap-3">
          {/* Engine Status */}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            title={
              isReady
                ? `Core Engine: yt-dlp ${status?.ytdlp?.version || "Ready"} — click to configure`
                : "Engine requires configuration — click to setup"
            }
            className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer group"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isChecking
                  ? "bg-slate-400 animate-pulse"
                  : isReady
                  ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse"
                  : isMissing
                  ? "bg-amber-500 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {isChecking
                ? "Checking Engine..."
                : isReady
                ? status?.ytdlp?.version
                  ? `yt-dlp v${status.ytdlp.version}`
                  : "Engine Ready"
                : "Engine Missing"}
            </span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Active Download Gauge */}
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => navigate("/downloads")}
              className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              title="Click to view active downloads"
            >
              <Download className="w-3 h-3 animate-pulse" />
              <span>
                {activeCount} active stream{activeCount > 1 ? "s" : ""}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/70" />
              <span>Ready</span>
            </div>
          )}

          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

          {/* Quick Destination Folder */}
          <button
            type="button"
            onClick={handleOpenFolder}
            title={`Download Destination: ${downloadDirectory}\nClick to open in File Explorer`}
            className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
          >
            <FolderDown className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-colors" />
            <span className="font-mono text-[10px] truncate max-w-[140px]">{folderName}</span>
          </button>
        </div>

        {/* Right Side: Actions (About, Donate, GitHub, Shortcuts, Updates) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Donate Option */}
          <button
            type="button"
            onClick={() => setDonateOpen(true)}
            title="Support Vortex open source development"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 font-semibold transition-all cursor-pointer group"
          >
            <Heart className="w-3 h-3 text-rose-500 fill-rose-500/30 group-hover:scale-110 transition-transform" />
            <span>Donate</span>
          </button>

          {/* About Option */}
          <button
            type="button"
            onClick={() => navigate("/about")}
            title="About Vortex, licenses, and architecture"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 font-semibold transition-all cursor-pointer"
          >
            <Info className="w-3 h-3" />
            <span>About</span>
          </button>

          {/* GitHub Repo */}
          <button
            type="button"
            onClick={handleOpenGithub}
            title="Open Vortex GitHub Repository"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-medium transition-colors cursor-pointer"
          >
            <svg
              className="w-3 h-3 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span className="hidden md:inline">GitHub</span>
          </button>

          {/* Keyboard Shortcuts */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard Shortcuts Cheatsheet"
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <Command className="w-3 h-3" />
          </button>

          {/* Version / Updates */}
          <button
            type="button"
            onClick={handleCheckUpdates}
            title="Click to check for Vortex updates"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-mono text-[10px] transition-colors cursor-pointer"
          >
            <Sparkles className={`w-2.5 h-2.5 text-amber-500 ${checkingUpdates ? "animate-spin" : ""}`} />
            <span>v1.0.0</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      <DonateModal isOpen={donateOpen} onClose={() => setDonateOpen(false)} />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
};
