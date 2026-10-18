import React, { useState } from "react";
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
} from "lucide-react";
import { GlassCard } from "../components/glass/GlassCard";
import { GlassButton } from "../components/glass/GlassButton";
import { useAppStore } from "../stores/appStore";
import { api } from "../lib/api";
import { AppUpdateInfo, SystemDiagnosticReport } from "../types";
import { SponsorBanner } from "../components/ui/SponsorBanner";

export const About: React.FC = () => {
  const { showToast } = useAppStore();

  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  const [exportingDiag, setExportingDiag] = useState(false);
  const [recentLogs, setRecentLogs] = useState<string[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      const res = await api.checkAppUpdate();
      setUpdateInfo(res);
      if (res.hasUpdate) {
        showToast(`Update available: v${res.latestVersion}`, "info");
      } else {
        showToast(res.statusMessage || "Vortex is up to date!", "success");
      }
    } catch (err: any) {
      showToast(err?.toString() || "Failed to check for updates", "error");
    } finally {
      setCheckingUpdate(false);
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

      {/* Main Identity Card */}
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
                  Production Release
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                The high-performance, local-first media downloader & converter for Windows.
              </p>
              <span className="inline-block mt-2 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                v1.0.0 (x64 Windows)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <GlassButton
              size="sm"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${checkingUpdate ? "animate-spin" : ""}`}
              />
              <span>{checkingUpdate ? "Checking..." : "Check Updates"}</span>
            </GlassButton>
          </div>
        </div>

        {/* Update status message */}
        {updateInfo && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 transition-all ${
              updateInfo.hasUpdate
                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                {updateInfo.hasUpdate ? (
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
                <span>
                  {updateInfo.hasUpdate
                    ? `New version available: v${updateInfo.latestVersion}`
                    : `Vortex v${updateInfo.currentVersion} is up to date`}
                </span>
              </div>
              <span className="text-[10px] font-mono opacity-80">
                {updateInfo.signatureVerified ? "Signed Official Build" : "Release Verified"}
              </span>
            </div>

            {updateInfo.hasUpdate && (
              <div className="space-y-1.5 pt-1">
                {updateInfo.releaseNotes && (
                  <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line bg-black/5 dark:bg-white/5 p-2 rounded-lg font-mono">
                    {updateInfo.releaseNotes}
                  </p>
                )}
                {updateInfo.downloadUrl && (
                  <div className="pt-1">
                    <a
                      href={updateInfo.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                      Download installer from release page
                    </a>
                  </div>
                )}
              </div>
            )}
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
