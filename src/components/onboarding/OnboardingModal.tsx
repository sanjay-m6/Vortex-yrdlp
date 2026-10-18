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
  ExternalLink,
} from "lucide-react";
import { api } from "../../lib/api";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useSettingsStore, ThemeMode } from "../../stores/settingsStore";
import { useTheme } from "../../hooks/useTheme";
import { useAppStore } from "../../stores/appStore";
import { ToolDownloadProgressPayload } from "../../types";

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

  // Listen to download progress events from the backend
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    api.onToolDownloadProgress((payload) => {
      setProgressPayload(payload);
      if (payload.stage === "completed" || payload.stage === "failed") {
        if (payload.stage === "failed") {
          setDownloadError(payload.message);
        }
      }
    }).then((unsub) => {
      unlisten = unsub;
    }).catch((e) => console.warn("Could not register progress listener:", e));

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  if (!isOpen) return null;

  const ytdlpReady = engineStatus?.ytdlp?.available ?? false;
  const ffmpegReady = engineStatus?.ffmpeg?.available ?? false;
  const allEnginesReady = ytdlpReady && ffmpegReady;

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
      // User cancelled
    }
  };

  const completeOnboarding = () => {
    localStorage.setItem("vortex_onboarding_completed", "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-slate-900/95 border border-white/10 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        {/* Ambient Backlight Glow */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        {/* Modal Top Header with Step Counter */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Vortex Setup Wizard</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-semibold border border-indigo-500/30">
                  Step {step} of 4
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Setup Wizard"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Steps Content */}
        <div className="relative z-10 p-6 overflow-y-auto space-y-5 flex-1">
          {/* STEP 1: Welcome & Overview */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="space-y-2 text-center py-2">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/25">
                  <Download className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-extrabold text-white">
                  Welcome to Vortex Downloader
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  The ultimate media downloader and audio transcoder built with high-speed Rust core, powered by yt-dlp and FFmpeg.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">High-Speed Downloads</h4>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Multi-connection stream extraction for maximum bandwidth.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Music className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Audio & Transcoding</h4>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Clean MP3, FLAC, M4A, and Opus conversion with metadata.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1.5">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-white">Zero Cloud Reliance</h4>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Everything runs locally on your machine with offline SQLite.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <span>Continue to Engine Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Essential Engines (Core User Request) */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>Essential Download Engines</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vortex requires <strong className="text-slate-200">yt-dlp</strong> for link parsing & downloading, and <strong className="text-slate-200">FFmpeg</strong> for combining 1080p/4K audio+video streams and converting audio.
                </p>
              </div>

              {/* Engine Status Cards */}
              <div className="space-y-2.5">
                {/* yt-dlp card */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">yt-dlp Engine</span>
                        {ytdlpReady ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>v{engineStatus?.ytdlp?.version || "Ready"}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            <span>Missing</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {ytdlpReady
                          ? "Installed in managed directory and verified."
                          : "Required for extracting streams from YouTube and other sites."}
                      </p>
                    </div>
                  </div>

                  {!ytdlpReady && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadYtdlpOnly}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-semibold border border-indigo-500/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Download
                    </button>
                  )}
                </div>

                {/* FFmpeg card */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">FFmpeg & FFprobe</span>
                        {ffmpegReady ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>v{engineStatus?.ffmpeg?.version || "Ready"}</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            <span>Missing</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {ffmpegReady
                          ? "Available for stream muxing and audio transcoding."
                          : "Required to merge high-res video and extract MP3 audio."}
                      </p>
                    </div>
                  </div>

                  {!ffmpegReady && (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={handleDownloadFfmpegOnly}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white text-xs font-semibold border border-purple-500/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Progress Bar while downloading */}
              {isDownloading && (
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-300 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{progressPayload?.tool ? `Installing ${progressPayload.tool}` : "Installing Essential Engines..."}</span>
                    </span>
                    <span className="font-mono text-indigo-400 font-semibold">
                      {progressPayload ? `${progressPayload.percentage.toFixed(0)}%` : "0%"}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, progressPayload?.percentage || 0))}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 truncate">
                    {progressPayload?.message || "Downloading official binaries..."}
                  </p>
                </div>
              )}

              {downloadError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{downloadError}</span>
                </div>
              )}

              {/* Main Action: Download All or Proceed */}
              <div className="pt-2 flex flex-col gap-2">
                {!allEnginesReady ? (
                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={handleDownloadAll}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Downloading & Setting Up Engines...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Download & Setup All Essential Engines (One-Click)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All essential engines are verified and ready for high-speed downloads!</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold active:scale-95 transition-all cursor-pointer"
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
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  <span>Personalize Preferences</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure your default appearance and storage location.
                </p>
              </div>

              {/* Theme choice */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Application Theme
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["dark", "light", "system"] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => switchThemeWithSplash(t)}
                      className={`p-3 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                        theme === t
                          ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm"
                          : "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white"
                      }`}
                    >
                      {t} Mode
                    </button>
                  ))}
                </div>
              </div>

              {/* Storage location */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Default Media Storage Folder
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={downloadDirectory || "Downloads"}
                    className="flex-1 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-xs font-mono text-slate-300 truncate"
                  />
                  <button
                    type="button"
                    onClick={handlePickDirectory}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold active:scale-95 cursor-pointer"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>Browse</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Ready & Complete */}
          {step === 4 && (
            <div className="space-y-5 text-center py-4 animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-extrabold text-white">
                  You're All Set!
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Vortex is configured and ready to parse media links, schedule downloads, and transcode audio.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-left text-xs space-y-1.5 max-w-sm mx-auto">
                <div className="flex items-center justify-between text-slate-300">
                  <span>yt-dlp Engine:</span>
                  <span className="font-semibold text-emerald-400">{ytdlpReady ? "Ready" : "Will download on first run"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>FFmpeg Transcoder:</span>
                  <span className="font-semibold text-emerald-400">{ffmpegReady ? "Ready" : "Will download on first run"}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Theme:</span>
                  <span className="font-semibold text-white capitalize">{theme}</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={completeOnboarding}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Dashboard & Start Downloading</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
