import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  Folder,
  Palette,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Video,
  Music,
  Zap,
  X,
  RefreshCw,
  Sun,
  Moon,
  Laptop,
  Check,
} from "lucide-react";
import { api } from "../../lib/api";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useSettingsStore, ThemeMode } from "../../stores/settingsStore";
import { useTheme } from "../../hooks/useTheme";
import { useAppStore } from "../../stores/appStore";
import { ToolDownloadProgressPayload } from "../../types";
import { cn } from "../../lib/utils";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  initialStep = 1,
}) => {
  const [step, setStep] = useState(initialStep);
  const { status: engineStatus, refreshStatus, isLoading: engineLoading } = useEngineStatus();
  const { theme, downloadDirectory, updateSettings } = useSettingsStore();
  const { switchThemeWithSplash } = useTheme();
  const { showToast } = useAppStore();

  // Tool downloading state
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeDownloadTool, setActiveDownloadTool] = useState<string | null>(null);
  const [progressPayload, setProgressPayload] = useState<ToolDownloadProgressPayload | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Sync initialStep only when modal transitions from closed to open
  const prevIsOpenRef = React.useRef(isOpen);
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setStep(initialStep);
      setDownloadError(null);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialStep]);

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    api.saveSetupProgress(nextStep).catch(() => {});
  };

  const handleClose = () => {
    api.saveSetupProgress(step).catch(() => {});
    onClose();
  };

  // Listen to download progress events from the backend
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    api
      .onToolDownloadProgress((payload) => {
        setProgressPayload(payload);
        if (payload.stage === "completed" || payload.stage === "failed") {
          if (payload.stage === "failed") {
            setDownloadError(payload.message);
          }
        }
      })
      .then((unsub) => {
        unlisten = unsub;
      })
      .catch((e) => console.warn("Could not register progress listener:", e));

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!isOpen) return null;

  const ytdlpReady = engineStatus?.ytdlp?.available ?? false;
  const ffmpegReady = engineStatus?.ffmpeg?.available ?? false;
  const allEnginesReady = ytdlpReady && ffmpegReady;

  // Formats raw version strings so git hashes like 'N-123074-g4e32fb4c2a-20260228' look elegant
  const formatEngineVersion = (raw: string | null | undefined, type: "ytdlp" | "ffmpeg"): string => {
    if (!raw) return "Ready";
    const clean = raw.trim();
    if (type === "ffmpeg") {
      const dateMatch = clean.match(/20\d{6}/);
      if (dateMatch) {
        const d = dateMatch[0];
        return `v${d.slice(0, 4)}.${d.slice(4, 6)} (Nightly)`;
      }
      const versionMatch = clean.match(/^(\d+\.\d+(\.\d+)?)/);
      if (versionMatch) {
        return `v${versionMatch[1]}`;
      }
      if (clean.length > 14) {
        return `v${clean.slice(0, 10)}…`;
      }
      return `v${clean}`;
    }
    return clean.startsWith("v") ? clean : `v${clean}`;
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    setProgressPayload({
      tool: "Engines",
      stage: "starting",
      percentage: 0,
      downloadedBytes: 0,
      totalBytes: null,
      message: "Starting essential engine installations...",
    });

    try {
      const res = await api.downloadAllEssentialTools();
      await refreshStatus(true);
      if (res.success) {
        showToast("All essential engines installed successfully!", "success");
      } else {
        showToast(res.message, "info");
      }
    } catch (err: any) {
      const msg = err?.toString() || "Failed to download engines";
      setDownloadError(msg);
      showToast(msg, "error");
    } finally {
      setIsDownloading(false);
      await refreshStatus(true);
    }
  };

  const handleDownloadYtdlpOnly = async () => {
    setIsDownloading(true);
    setActiveDownloadTool("yt-dlp");
    setDownloadError(null);
    try {
      await api.downloadLatestYtdlp();
      await refreshStatus(true);
      showToast("yt-dlp installed and verified!", "success");
    } catch (e: any) {
      setDownloadError(e?.toString() || "yt-dlp download failed");
    } finally {
      setIsDownloading(false);
      setActiveDownloadTool(null);
      await refreshStatus(true);
    }
  };

  const handleDownloadFfmpegOnly = async () => {
    setIsDownloading(true);
    setActiveDownloadTool("FFmpeg");
    setDownloadError(null);
    try {
      await api.downloadLatestFfmpeg();
      await refreshStatus(true);
      showToast("FFmpeg installed and verified!", "success");
    } catch (e: any) {
      setDownloadError(e?.toString() || "FFmpeg download failed");
    } finally {
      setIsDownloading(false);
      setActiveDownloadTool(null);
      await refreshStatus(true);
    }
  };

  const handlePickDirectory = async () => {
    try {
      const picked = await api.pickDownloadDirectory();
      if (picked) {
        updateSettings({ downloadDirectory: picked });
        showToast("Storage directory updated", "success");
      }
    } catch {
      // User cancelled picker
    }
  };

  const completeOnboarding = async () => {
    try {
      await api.completeSetupWizard();
    } catch (err) {
      console.warn("Failed to complete setup wizard in backend SQLite:", err);
    }
    localStorage.setItem("vortex_onboarding_completed", "true");
    await refreshStatus(true);
    onClose();
  };

  const wizardSteps = [
    { id: 1, title: "Welcome", icon: Sparkles },
    { id: 2, title: "Engines", icon: Cpu },
    { id: 3, title: "Preferences", icon: Palette },
    { id: 4, title: "Ready", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Vortex Setup Wizard
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Step {step} of 4
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {step === 1 && "Welcome to the modern media downloader and transcoder"}
                {step === 2 && "Configure and verify local download and muxing engines"}
                {step === 3 && "Personalize your appearance and default media folder"}
                {step === 4 && "Setup complete! Vortex is ready for high-speed downloads"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Close Setup Wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="flex-shrink-0 px-6 py-2.5 border-b border-black/[0.06] dark:border-white/[0.06] bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between gap-1 sm:gap-2">
          {wizardSteps.map((s) => {
            const isActive = step === s.id;
            const isDone = step > s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(s.id)}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-xs"
                    : isDone
                    ? "text-emerald-600 dark:text-emerald-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                )}
              >
                <span
                  className={cn(
                    "w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold font-mono transition-colors",
                    isActive
                      ? "bg-indigo-600 text-white"
                      : isDone
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-black/[0.06] dark:bg-white/[0.06] text-slate-400 dark:text-slate-500"
                  )}
                >
                  {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : s.id}
                </span>
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            );
          })}
        </div>

        {/* Wizard Steps Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: Welcome & Overview */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-2 text-center py-2">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/20">
                  <Download className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Welcome to Vortex Downloader
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  The ultimate media downloader and audio transcoder built with a high-speed Rust core, powered by yt-dlp and FFmpeg.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    High-Speed Downloads
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Multi-connection stream extraction for maximum bandwidth utilization.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Music className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Audio & Transcoding
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Lossless and converted MP3, FLAC, M4A, and Opus with embedded tags.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    100% Local & Private
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Zero cloud reliance. Everything runs securely on your local system.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Continue to Engine Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Essential Engines (Matching the screenshot request) */}
          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-500" />
                    <span>Essential Download Engines</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
                    Vortex requires <strong className="text-slate-800 dark:text-slate-200">yt-dlp</strong> for stream parsing and downloading, and <strong className="text-slate-800 dark:text-slate-200">FFmpeg</strong> for combining 1080p/4K audio+video streams and audio extraction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => refreshStatus(true)}
                  disabled={engineLoading}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                  title="Re-check engines"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", engineLoading && "animate-spin")} />
                </button>
              </div>

              {/* Engine Status Cards */}
              <div className="space-y-2.5">
                {/* yt-dlp card */}
                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-indigo-500/30 transition-all flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          yt-dlp Engine
                        </span>
                        {ytdlpReady ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{formatEngineVersion(engineStatus?.ytdlp?.version, "ytdlp")}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            <span>Not Installed</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {ytdlpReady
                          ? "Installed in managed directory and verified."
                          : "Required for extracting streams from YouTube, SoundCloud, and 1,000+ sites."}
                      </p>
                    </div>
                  </div>

                  {!ytdlpReady && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadYtdlpOnly}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                    >
                      {isDownloading && activeDownloadTool === "yt-dlp" ? "Installing..." : "Install"}
                    </button>
                  )}
                </div>

                {/* FFmpeg card */}
                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.08] dark:border-white/[0.08] hover:border-purple-500/30 transition-all flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Music className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          FFmpeg & FFprobe
                        </span>
                        {ffmpegReady ? (
                          <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{formatEngineVersion(engineStatus?.ffmpeg?.version, "ffmpeg")}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            <span>Not Installed</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {ffmpegReady
                          ? "Available for stream muxing and audio transcoding."
                          : "Required to merge 1080p/4K separate video+audio streams and convert formats."}
                      </p>
                    </div>
                  </div>

                  {!ffmpegReady && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadFfmpegOnly}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                    >
                      {isDownloading && activeDownloadTool === "FFmpeg" ? "Installing..." : "Install"}
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar during download */}
              {isDownloading && (
                <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-500/30 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {progressPayload?.tool ? `Installing ${progressPayload.tool}` : "Installing Essential Engines..."}
                      </span>
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                      {progressPayload ? `${progressPayload.percentage.toFixed(0)}%` : "0%"}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, progressPayload?.percentage || 0))}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {progressPayload?.message || "Downloading official release binaries..."}
                  </p>
                </div>
              )}

              {downloadError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              {/* Engines Ready Banner */}
              {allEnginesReady && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/[0.08] border border-emerald-500/20 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      All Essential Engines Ready
                    </h4>
                    <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80">
                      yt-dlp and FFmpeg are active and configured for high-speed multi-connection downloads.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="pt-2 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Back
                </button>

                <div className="flex items-center gap-2">
                  {!allEnginesReady && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadAll}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download All (One-Click)</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95",
                      allEnginesReady
                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/25"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    )}
                  >
                    <span>{allEnginesReady ? "Next: Preferences" : "Skip For Now"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Quick Preferences */}
          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-cyan-500" />
                  <span>Personalize Preferences</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure your default visual appearance and media storage destination.
                </p>
              </div>

              {/* Theme choice */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Application Theme
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "light", label: "Light", icon: Sun },
                      { id: "system", label: "System", icon: Laptop },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const isSelected = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => switchThemeWithSplash(t.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-2 p-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer",
                          isSelected
                            ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs"
                            : "bg-black/[0.02] dark:bg-white/[0.02] border-black/[0.08] dark:border-white/[0.08] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Storage location */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Default Media Storage Folder
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={downloadDirectory || "Downloads"}
                    className="flex-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 truncate outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePickDirectory}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-semibold active:scale-95 transition-all cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(4)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-bold shadow-md shadow-indigo-500/25 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Ready & Complete */}
          {step === 4 && (
            <div className="space-y-5 text-center py-4 animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  You're All Set!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Vortex is fully configured and ready to parse media links, schedule batch queues, and transcode audio.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-medium">yt-dlp Engine:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {ytdlpReady ? "Ready & Verified" : "Will download automatically on first run"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-medium">FFmpeg Transcoder:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {ffmpegReady ? "Ready & Verified" : "Will download automatically on first run"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Theme Mode:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                    {theme}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Destination:</span>
                  <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                    {downloadDirectory || "Downloads"}
                  </span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-600 to-emerald-600 hover:from-indigo-600 hover:to-emerald-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Vortex & Start Downloading</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
