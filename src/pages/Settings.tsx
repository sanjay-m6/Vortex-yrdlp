import React, { useState } from "react";
import { Folder, Palette, Download, AppWindow, Sun, Moon, Laptop, Cpu, RefreshCw } from "lucide-react";
import { GlassCard } from "../components/glass/GlassCard";
import { GlassButton } from "../components/glass/GlassButton";
import { useSettingsStore, ThemeMode } from "../stores/settingsStore";
import { useTheme } from "../hooks/useTheme";
import { useAppStore } from "../stores/appStore";
import { api } from "../lib/api";
import { EngineStatusCard } from "../components/engine/EngineStatusCard";
import { EngineDetails } from "../components/engine/EngineDetails";
import { DiagnosticsPanel } from "../components/engine/DiagnosticsPanel";
import { EngineSetupDialog } from "../components/engine/EngineSetupDialog";
import { AdvancedSettingsCard } from "../components/presets/AdvancedSettingsCard";
import { MobileSettingsView } from "../components/mobile/MobileSettingsView";
import { useMobile } from "../hooks/useMobile";

export const Settings: React.FC = () => {
  const isMobile = useMobile();
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const { switchThemeWithSplash } = useTheme();
  const {
    theme,
    downloadDirectory,
    askBeforeDownload,
    startWithSystem,
    minimizeToTray,
    updateSettings,
  } = useSettingsStore();

  if (isMobile) {
    return <MobileSettingsView />;
  }

  const { showToast } = useAppStore();

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

  const handleThemeChange = (newTheme: ThemeMode, e?: React.MouseEvent) => {
    if (newTheme === theme) return;
    switchThemeWithSplash(newTheme, e);
    showToast(`Theme changed to ${newTheme}`, "success");
  };

  return (
    <div className="space-y-6 pb-6 max-w-3xl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage your application preferences and layout.
        </p>
      </div>

      {/* 1. Appearance Section */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Palette className="w-3.5 h-3.5 text-indigo-500" />
          <span>Appearance</span>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-800 dark:text-slate-200">
            Application Theme
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "light" as const, label: "Light", icon: Sun },
              { id: "dark" as const, label: "Dark", icon: Moon },
              { id: "system" as const, label: "System", icon: Laptop },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = theme === option.id;
              return (
                <button
                  key={option.id}
                  onClick={(e) => handleThemeChange(option.id, e)}
                  className={`flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600/40 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "bg-white/40 dark:bg-slate-950/40 border-black/[0.06] dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.02]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* 2. Downloads Section */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Download className="w-3.5 h-3.5 text-indigo-500" />
          <span>Downloads</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-800 dark:text-slate-200">
              Default Download Folder
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={downloadDirectory}
                className="flex-1 rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 font-mono"
              />
              <GlassButton size="sm" onClick={handlePickDirectory}>
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                <span>Browse</span>
              </GlassButton>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Ask where to save files
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Prompt for a location before initiating each download
              </p>
            </div>
            <input
              type="checkbox"
              checked={askBeforeDownload}
              onChange={(e) => {
                updateSettings({ askBeforeDownload: e.target.checked });
                showToast("Preferences saved", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </GlassCard>

      {/* 3. Advanced Download Preferences & Presets */}
      <AdvancedSettingsCard />

      {/* 4. Application Section */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <AppWindow className="w-3.5 h-3.5 text-indigo-500" />
          <span>Application</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Start with system
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Automatically launch Vortex on login
              </p>
            </div>
            <input
              type="checkbox"
              checked={startWithSystem}
              onChange={(e) => {
                updateSettings({ startWithSystem: e.target.checked });
                showToast("Preferences saved", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Minimize to tray
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Keep application running in background when closed
              </p>
            </div>
            <input
              type="checkbox"
              checked={minimizeToTray}
              onChange={(e) => {
                updateSettings({ minimizeToTray: e.target.checked });
                showToast("Preferences saved", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>
        </div>
      </GlassCard>

      {/* 5. Software Updates Section */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
            <span>Automatic & Manual Updates</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            Official GitHub Releases
          </span>
        </div>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Automatically check for updates
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Check GitHub Releases in the background for new versions
              </p>
            </div>
            <input
              type="checkbox"
              checked={useSettingsStore((s) => s.autoCheckUpdates)}
              onChange={async (e) => {
                await useSettingsStore.getState().updateAutoUpdatePreferences({ autoCheckUpdates: e.target.checked });
                showToast("Update settings updated", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {useSettingsStore((s) => s.autoCheckUpdates) && (
            <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Check frequency
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  How often Vortex contacts GitHub Releases for new updates
                </p>
              </div>
              <select
                value={useSettingsStore((s) => s.checkFrequency)}
                onChange={async (e) => {
                  await useSettingsStore.getState().updateAutoUpdatePreferences({
                    checkFrequency: e.target.value as "startup" | "daily" | "weekly",
                  });
                  showToast("Check frequency updated", "success");
                }}
                className="text-xs rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3 py-1.5 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-hidden"
              >
                <option value="startup">On Application Startup</option>
                <option value="daily">Once Daily</option>
                <option value="weekly">Once Weekly</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Notify when update is available
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Display an in-app banner or notification when a new version is released
              </p>
            </div>
            <input
              type="checkbox"
              checked={useSettingsStore((s) => s.notifyOnUpdate)}
              onChange={async (e) => {
                await useSettingsStore.getState().updateAutoUpdatePreferences({ notifyOnUpdate: e.target.checked });
                showToast("Update settings updated", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Include Pre-releases & Betas
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Check for experimental preview builds and beta release candidates
              </p>
            </div>
            <input
              type="checkbox"
              checked={useSettingsStore((s) => s.includePrereleases)}
              onChange={async (e) => {
                await useSettingsStore.getState().updateAutoUpdatePreferences({ includePrereleases: e.target.checked });
                showToast("Update settings updated", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Automatic Background Installation
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Download verified updates automatically (disabled by default; requires no active downloads)
              </p>
            </div>
            <input
              type="checkbox"
              checked={useSettingsStore((s) => s.autoInstallUpdates)}
              onChange={async (e) => {
                await useSettingsStore.getState().updateAutoUpdatePreferences({ autoInstallUpdates: e.target.checked });
                showToast("Update settings updated", "success");
              }}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/[0.06] text-xs">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Last checked:{" "}
              {useSettingsStore((s) => s.lastUpdateCheck)
                ? new Date(useSettingsStore.getState().lastUpdateCheck!).toLocaleString()
                : "Never checked"}
            </span>

            <GlassButton
              size="sm"
              onClick={async () => {
                try {
                  const res = await api.checkAppUpdate({
                    includePrereleases: useSettingsStore.getState().includePrereleases,
                  });
                  if (res.hasUpdate) {
                    showToast(`Update available: v${res.latestVersion}! Visit About to install.`, "info");
                  } else {
                    showToast("Vortex is up to date!", "success");
                  }
                } catch (e: any) {
                  showToast(e?.toString() || "Failed to check for updates", "error");
                }
              }}
            >
              <RefreshCw className="w-3 h-3 text-indigo-500" />
              <span>Check for Updates Now</span>
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* 4. Engine Infrastructure & Integration */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-indigo-500" />
          <span>Downloader Engine Integration</span>
        </div>

        <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 border border-indigo-500/20">
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Essential Engines Setup Wizard
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              One-click automated download and verification of official yt-dlp & FFmpeg binaries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open_onboarding", { detail: { step: 2 } }))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Launch Wizard</span>
          </button>
        </div>

        <EngineStatusCard
          onOpenSetup={() => setSetupDialogOpen(true)}
          onOpenDiagnostics={() => {
            const el = document.getElementById("diagnostics-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        <EngineDetails />
      </div>

      {/* 5. System Diagnostics */}
      <div id="diagnostics-section">
        <DiagnosticsPanel />
      </div>

      {/* Engine Setup Dialog */}
      <EngineSetupDialog
        isOpen={setupDialogOpen}
        onClose={() => setSetupDialogOpen(false)}
      />
    </div>
  );
};
