import React, { useState } from "react";
import {
  Palette,
  Download,
  Cpu,
  Info,
  Sun,
  Moon,
  Laptop,
  Folder,
  RefreshCw,
  Heart,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileCode2,
} from "lucide-react";
import { useSettingsStore, ThemeMode } from "../../stores/settingsStore";
import { useTheme } from "../../hooks/useTheme";
import { useAppStore } from "../../stores/appStore";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { usePresetStore } from "../../stores/presetStore";
import { api } from "../../lib/api";
import { DonateModal } from "../ui/DonateModal";
import { PresetManagerModal } from "../presets/PresetManagerModal";

export const MobileSettingsView: React.FC = () => {
  const { switchThemeWithSplash } = useTheme();
  const {
    theme,
    downloadDirectory,
    updateSettings,
  } = useSettingsStore();

  const { showToast } = useAppStore();
  const { status: engineStatus, isLoading: engineLoading, refreshStatus } = useEngineStatus();
  const { presets, downloadSettings, updateDownloadSettings } = usePresetStore();

  const [donateOpen, setDonateOpen] = useState(false);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [diagnosticsOutput, setDiagnosticsOutput] = useState<string | null>(null);

  const handleThemeChange = (newTheme: ThemeMode, e?: React.MouseEvent) => {
    if (newTheme === theme) return;
    switchThemeWithSplash(newTheme, e);
    showToast(`Switched to ${newTheme} theme`, "success");
  };

  const handlePickDirectory = async () => {
    try {
      const picked = await api.pickDownloadDirectory();
      if (picked) {
        updateSettings({ downloadDirectory: picked });
        showToast("Download directory updated", "success");
      }
    } catch {
      showToast("Directory selection cancelled", "info");
    }
  };

  const handleRunDiagnostics = async () => {
    setDiagnosticsRunning(true);
    try {
      const report = await api.getDiagnosticsReport();
      const summary = `OS: ${report.osType} (${report.osArch})\nDatabase: ${report.databasePath} (${(report.databaseSizeBytes / 1024).toFixed(1)} KB)\nyt-dlp: ${report.ytdlpVersion || (report.ytdlpInstalled ? "Installed" : "Not Found")}\nFFmpeg: ${report.ffmpegVersion || (report.ffmpegInstalled ? "Installed" : "Not Found")}\nLogs: ${report.logsDirectory}`;
      setDiagnosticsOutput(summary);
      showToast("Diagnostics complete", "success");
    } catch (e) {
      showToast("Diagnostics failed: " + String(e), "error");
    } finally {
      setDiagnosticsRunning(false);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Header */}
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Settings & Preferences
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure appearance, download rules, and media engines
        </p>
      </div>

      {/* 2. Appearance Section */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          <Palette className="w-3.5 h-3.5 text-indigo-500" />
          <span>Appearance</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "light" as const, label: "Light", icon: Sun },
            { id: "dark" as const, label: "Dark", icon: Moon },
            { id: "system" as const, label: "System", icon: Laptop },
          ].map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => handleThemeChange(opt.id, e)}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.06] text-slate-600 dark:text-slate-400"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Downloads Section */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          <Download className="w-3.5 h-3.5 text-indigo-500" />
          <span>Download Rules</span>
        </div>

        {/* Output Directory Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Storage Location
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={downloadDirectory || "Default system Downloads folder"}
              className="flex-1 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 truncate"
            />
            <button
              type="button"
              onClick={handlePickDirectory}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold active:scale-95 cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>
          </div>
        </div>

        {/* Preset Manager Trigger */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setPresetModalOpen(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-xs font-semibold text-slate-800 dark:text-slate-200 active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-indigo-500" />
              <span>Manage Quality Presets</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* 4. Media Engine Diagnostics */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            <Cpu className="w-3.5 h-3.5 text-indigo-500" />
            <span>Media Engine</span>
          </div>

          <button
            type="button"
            onClick={() => refreshStatus(true)}
            disabled={engineLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 active:scale-90 cursor-pointer"
            title="Refresh engine status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${engineLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tool Status Pills */}
        <div className="space-y-2">
          {/* yt-dlp status */}
          <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">yt-dlp</span>
              {engineStatus?.ytdlp?.version && (
                <span className="text-[10px] font-mono text-slate-400">
                  v{engineStatus.ytdlp.version}
                </span>
              )}
            </div>

            {engineStatus?.ytdlp?.available ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500">
                <AlertCircle className="w-3 h-3" />
                <span>Not Installed</span>
              </span>
            )}
          </div>

          {/* ffmpeg status */}
          <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">FFmpeg</span>
              {engineStatus?.ffmpeg?.version && (
                <span className="text-[10px] font-mono text-slate-400">
                  {engineStatus.ffmpeg.version.slice(0, 16)}
                </span>
              )}
            </div>

            {engineStatus?.ffmpeg?.available ? (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span>Optional</span>
              </span>
            )}
          </div>
        </div>

        {/* Diagnostics Button */}
        {/* Download Essential Engines Wizard Button */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("open_onboarding", { detail: { step: 2 } }))}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-600 dark:text-indigo-400 active:scale-[0.99] transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>Download All Essential Engines (Setup Wizard)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={handleRunDiagnostics}
          disabled={diagnosticsRunning}
          className="w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.06] active:scale-[0.99] transition-all cursor-pointer"
        >
          {diagnosticsRunning ? "Running Diagnostics..." : "Run Engine Diagnostics"}
        </button>

        {diagnosticsOutput && (
          <div className="p-3 rounded-xl bg-black/80 text-emerald-400 font-mono text-[9px] max-h-36 overflow-y-auto whitespace-pre-wrap">
            {diagnosticsOutput}
          </div>
        )}
      </div>

      {/* 5. About & Support */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-xs backdrop-blur-xl space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-indigo-500" />
          <span>About MediaDL</span>
        </div>

        <div className="flex items-center gap-3">
          <img
            src="/ytdlpicon.png"
            alt="Logo"
            className="w-10 h-10 rounded-xl object-contain shadow-sm shadow-indigo-600/30"
          />
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              MediaDL / Vortex
            </div>
            <div className="text-[10px] text-slate-400">
              Version 1.2.0 • Mobile & Desktop
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Apache License 2.0
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDonateOpen(true)}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Heart className="w-3.5 h-3.5 fill-white" />
          <span>Support the Project</span>
        </button>
      </div>

      {/* Modals */}
      <DonateModal isOpen={donateOpen} onClose={() => setDonateOpen(false)} />
      <PresetManagerModal isOpen={presetModalOpen} onClose={() => setPresetModalOpen(false)} />
    </div>
  );
};

export default MobileSettingsView;
