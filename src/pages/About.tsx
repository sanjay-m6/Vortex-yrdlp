import React, { useState, useEffect } from "react";
import {
  Code2,
  ExternalLink,
  Shield,
  FolderOpen,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Database,
  Cpu,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { GlassCard } from "../components/glass/GlassCard";
import { GlassButton } from "../components/glass/GlassButton";
import { useAppStore } from "../stores/appStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useDownloadStore } from "../stores/downloadStore";
import { api } from "../lib/api";
import { AppUpdateInfo, SystemDiagnosticReport, UpdateState } from "../types";
import { SponsorBanner } from "../components/ui/SponsorBanner";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export const About: React.FC = () => {
  const { showToast } = useAppStore();
  const { lastUpdateCheck, includePrereleases } = useSettingsStore();
  const activeDownloads = useDownloadStore((s) => s.activeCount);

  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    downloaded: number;
    total: number | null;
    percentage: number;
  } | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [showRestartWarning, setShowRestartWarning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [exportingDiag, setExportingDiag] = useState(false);
  const [recentLogs, setRecentLogs] = useState<string[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Synchronize initial state and register real-time download progress listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    api.getUpdateState()
      .then((state) => {
        setUpdateState(state);
      })
      .catch(() => {});

    api.onUpdateDownloadProgress((payload) => {
      setDownloadProgress({
        downloaded: payload.downloadedBytes,
        total: payload.totalBytes,
        percentage: payload.percentage,
      });
      if (payload.stage === "downloading") {
        setUpdateState("downloading");
      } else if (payload.stage === "verifying") {
        setUpdateState("verifying");
      } else if (payload.stage === "ready") {
        setUpdateState("ready_to_install");
      } else if (payload.stage === "failed") {
        setUpdateState("failed");
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateState("checking");
    setActionError(null);
    setDownloadProgress(null);
    try {
      const res = await api.checkAppUpdate({ includePrereleases });
      setUpdateInfo(res);
      if (res.hasUpdate) {
        setUpdateState("update_available");
        showToast(`Update available: v${res.latestVersion}`, "info");
      } else {
        setUpdateState("up_to_date");
        showToast(res.statusMessage || "Vortex is up to date!", "success");
      }
    } catch (err: any) {
      setUpdateState("failed");
      const msg = err?.toString() || "Failed to check for updates";
      setActionError(msg);
      showToast(msg, "error");
    }
  };

  const handleDownloadUpdate = async () => {
    setUpdateState("downloading");
    setActionError(null);
    try {
      await api.downloadUpdate(false);
      setUpdateState("ready_to_install");
      showToast("Update downloaded and cryptographically verified! Ready to install.", "success");
    } catch (err: any) {
      setUpdateState("failed");
      const msg = err?.toString() || "Failed to download update";
      setActionError(msg);
      showToast(msg, "error");
    }
  };

  const handleInstallAndRestart = async (force = false) => {
    if (!force && activeDownloads > 0) {
      setShowRestartWarning(true);
      return;
    }

    setShowRestartWarning(false);
    setUpdateState("installing");
    setActionError(null);
    try {
      await api.installAndRestart(force);
    } catch (err: any) {
      setUpdateState("failed");
      const msg = err?.toString() || "Failed to install update";
      setActionError(msg);
      showToast(msg, "error");
    }
  };

  const handleOpenLogs = async () => {
    try {
      await api.openLogsDirectory();
      showToast("Opened logs directory in File Explorer", "success");
    } catch (err: any) {
      showToast(err?.toString() || "Failed to open logs folder", "error");
    }
  };

  const handleExportDiagnostics = async () => {
    setExportingDiag(true);
    try {
      const report: SystemDiagnosticReport = await api.getDiagnosticsReport();
      const json = JSON.stringify(report, null, 2);
      await navigator.clipboard.writeText(json);
      showToast("Diagnostic report copied to clipboard!", "success");
    } catch (err: any) {
      showToast(err?.toString() || "Failed to export diagnostics", "error");
    } finally {
      setExportingDiag(false);
    }
  };

  const handleViewLogs = async () => {
    if (recentLogs) {
      setRecentLogs(null);
      return;
    }
    setLoadingLogs(true);
    try {
      const logs = await api.readRecentLogs(35);
      setRecentLogs(logs);
    } catch (err: any) {
      showToast(err?.toString() || "Failed to read logs", "error");
    } finally {
      setLoadingLogs(false);
    }
  };

  const techStack = [
    { name: "Tauri 2", desc: "Native Rust Desktop Runtime" },
    { name: "React 19", desc: "Modern Reactive UI Core" },
    { name: "Rust Core", desc: "Async IPC & Process Control" },
    { name: "TypeScript", desc: "Full End-to-End Type Safety" },
    { name: "Tailwind CSS", desc: "Design System & Liquid Themes" },
    { name: "SQLite Local", desc: "Persistent Queue & Library" },
    { name: "yt-dlp", desc: "Universal Extractor Engine" },
    { name: "FFmpeg", desc: "High-Fidelity Audio/Video Post" },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          About Vortex
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Desktop media workstation, updater, diagnostics, and security specifications.
        </p>
      </div>

      {/* Main Identity & Updater Workstation Card */}
      <GlassCard className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/ytdlpicon.png"
              alt="Vortex Logo"
              className="w-14 h-14 rounded-2xl object-contain shadow-md shadow-indigo-600/30 p-1 bg-white/10"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Vortex
                </h3>
                <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Official Build
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                The high-performance, local-first media workstation for Windows.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  v1.2.0 (x64 Windows)
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Checked: {lastUpdateCheck ? new Date(lastUpdateCheck).toLocaleDateString() : "Never"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {(updateState === "idle" || updateState === "up_to_date" || updateState === "failed") && (
              <GlassButton
                size="sm"
                onClick={handleCheckUpdate}
                className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check for Updates</span>
              </GlassButton>
            )}

            {updateState === "checking" && (
              <GlassButton size="sm" disabled className="text-indigo-500">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Checking GitHub...</span>
              </GlassButton>
            )}

            {updateState === "update_available" && (
              <button
                type="button"
                onClick={handleDownloadUpdate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>Download Update</span>
              </button>
            )}

            {updateState === "ready_to_install" && (
              <button
                type="button"
                onClick={() => handleInstallAndRestart(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Install and Restart</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Update State Status Panel */}
        <div className="space-y-3">
          {updateState === "downloading" && (
            <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-900 dark:text-indigo-200">
                <div className="flex items-center gap-2">
                  <DownloadCloud className="w-4 h-4 text-indigo-500 animate-bounce" />
                  <span>Downloading official signed update package...</span>
                </div>
                <span className="font-mono text-[11px]">
                  {downloadProgress ? `${Math.round(downloadProgress.percentage)}%` : "0%"}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                  style={{ width: `${downloadProgress?.percentage || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>
                  {downloadProgress ? formatBytes(downloadProgress.downloaded) : "0 B"} /{" "}
                  {downloadProgress?.total ? formatBytes(downloadProgress.total) : "calculating..."}
                </span>
                <span>SHA256 Minisign signature verified on complete</span>
              </div>
            </div>
          )}

          {updateState === "verifying" && (
            <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-500 animate-spin" />
                <span>Verifying cryptographic Minisign signature...</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">Security Check</span>
            </div>
          )}

          {updateState === "ready_to_install" && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-emerald-900 dark:text-emerald-200">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Update ready for one-click installation!</span>
                </div>
                <span className="text-[10px] font-mono opacity-80">Signature Validated</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                The update package has been downloaded and verified. Clicking Install and Restart will close Vortex, apply the update, and automatically restart.
              </p>
            </div>
          )}

          {updateState === "installing" && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-medium">
              <RotateCcw className="w-4 h-4 animate-spin text-amber-500" />
              <span>Applying update and preparing application restart...</span>
            </div>
          )}

          {updateState === "failed" && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 space-y-2 text-xs text-red-900 dark:text-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span>Update Operation Failed</span>
                </div>
                <GlassButton size="sm" onClick={handleCheckUpdate} className="text-red-600 dark:text-red-400">
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Check</span>
                </GlassButton>
              </div>
              {actionError && (
                <p className="text-[11px] font-mono bg-black/5 dark:bg-white/5 p-2 rounded-lg break-all">
                  {actionError}
                </p>
              )}
            </div>
          )}

          {updateState === "up_to_date" && (
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Vortex is up to date! (v1.2.0)</span>
              </div>
              <span className="text-[10px] font-mono opacity-80">Latest Release</span>
            </div>
          )}

          {updateState === "update_available" && updateInfo && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>A new version of Vortex is available: v{updateInfo.latestVersion}</span>
                </div>
                {updateInfo.publishedAt && (
                  <span className="text-[10px] font-mono opacity-80">
                    Released {new Date(updateInfo.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {updateInfo.releaseNotes && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <span>{showReleaseNotes ? "Hide Release Notes" : "View Release Notes"}</span>
                    {showReleaseNotes ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>

                  {showReleaseNotes && (
                    <div className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line bg-black/5 dark:bg-white/5 p-3 rounded-lg font-mono max-h-48 overflow-y-auto">
                      {updateInfo.releaseNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Downloads Warning Modal */}
        {showRestartWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 p-5 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Active Downloads in Progress
                </h4>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                You currently have{" "}
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {activeDownloads} active download task(s)
                </span>
                . Restarting Vortex now will terminate the running yt-dlp processes.
              </p>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                We recommend waiting until active downloads complete before installing the update.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <GlassButton size="sm" onClick={() => setShowRestartWarning(false)}>
                  <span>Wait for Downloads</span>
                </GlassButton>
                <button
                  type="button"
                  onClick={() => handleInstallAndRestart(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Interrupt & Restart Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tech Stack List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Code2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Architecture & Core Modules</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {techStack.map((item) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.06] dark:border-white/[0.06] space-y-0.5 hover:border-indigo-500/30 transition-colors"
              >
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Diagnostics & Operations */}
        <div className="space-y-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              <span>Production Diagnostics & Logging</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Auto-rotated: 5MB max / 3 backups
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <GlassButton size="sm" onClick={handleOpenLogs}>
              <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
              <span>Open Logs Folder</span>
            </GlassButton>

            <GlassButton
              size="sm"
              onClick={handleExportDiagnostics}
              disabled={exportingDiag}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span>{exportingDiag ? "Exporting..." : "Copy Diagnostic Report"}</span>
            </GlassButton>

            <GlassButton size="sm" onClick={handleViewLogs} disabled={loadingLogs}>
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span>{recentLogs ? "Hide Log Viewer" : "View Recent Logs"}</span>
            </GlassButton>
          </div>

          {/* Inline Log Snippet Viewer */}
          {recentLogs && (
            <div className="p-3 rounded-xl bg-slate-950 text-slate-200 border border-white/10 font-mono text-[11px] max-h-56 overflow-y-auto space-y-1">
              <div className="flex items-center justify-between pb-1 border-b border-white/10 text-slate-400 text-[10px]">
                <span>RECENT APPLICATION LOGS (TAURI & SYSTEM)</span>
                <span>{recentLogs.length} lines</span>
              </div>
              {recentLogs.length === 0 ? (
                <p className="text-slate-500 italic py-2">No log entries found.</p>
              ) : (
                recentLogs.map((line, idx) => (
                  <p key={idx} className="whitespace-pre-wrap break-all leading-tight">
                    {line}
                  </p>
                ))
              )}
            </div>
          )}
        </div>

        {/* Security & Data Integrity Details */}
        <div className="p-4 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>Security & Local Data Policy</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                <Database className="w-3.5 h-3.5 text-indigo-500" />
                Persistent SQLite
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Your database and media downloads reside in LocalAppData and are never wiped by app updates or uninstalls.
              </p>
            </div>
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                Token & URL Redaction
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                All tokens, passwords, and sensitive signatures are scrubbed before writing to disk or telemetry.
              </p>
            </div>
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                <Shield className="w-3.5 h-3.5 text-blue-500" />
                Atomic Binary Updates
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                yt-dlp binaries are downloaded to safe isolated user space with size verification and atomic swaps.
              </p>
            </div>
          </div>
        </div>

        {/* Sponsor & Support Banner */}
        <SponsorBanner />

        {/* Action Links */}
        <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3">
          <GlassButton
            size="sm"
            onClick={() => showToast("GitHub repository link: https://github.com/sanjay-m6/Vortex-ytdlp", "info")}
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </GlassButton>

          <GlassButton
            size="sm"
            onClick={() => showToast("Documentation is available in project root / docs", "info")}
          >
            <span>Documentation</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </GlassButton>

          <GlassButton
            size="sm"
            onClick={() => showToast("Issue tracker: Report issues on GitHub repository", "info")}
          >
            <span>Report Issue</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};
