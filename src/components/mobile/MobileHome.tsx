import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2,
  Loader2,
  Clipboard,
  X,
  ArrowRight,
  Download,
  ListOrdered,
  FolderOpen,
  Film,
  Music,
  Video,
  Sparkles,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Folder,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { downloadApi } from "../../lib/downloadApi";
import { useDownloadStore } from "../../stores/downloadStore";
import { useQueueStore } from "../../stores/queueStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePresetStore } from "../../stores/presetStore";
import { useAppStore } from "../../stores/appStore";
import { MediaMetadata } from "../../types";
import { FormatSelection, MediaType } from "../../types/download";
import { DownloadPreset, DownloadSettingsSnapshot } from "../../types/presets";
import { QueuePriority } from "../../types/queue";

export const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);

  // Download options
  const [selectedQuality, setSelectedQuality] = useState<string>("best");
  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(false);
  const [customFilename, setCustomFilename] = useState<string>("");
  const [outputDir, setOutputDir] = useState<string>("");
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);

  // Store hooks
  const { downloadDirectory } = useSettingsStore();
  const { startDownload, tasks, taskOrder } = useDownloadStore();
  const { enqueue } = useQueueStore();
  const { presets, loadPresets, loadDownloadSettings, downloadSettings } = usePresetStore();
  const { showToast } = useAppStore();

  const [selectedPresetId, setSelectedPresetId] = useState<string>("best-quality");

  useEffect(() => {
    loadPresets();
    loadDownloadSettings();
  }, [loadPresets, loadDownloadSettings]);

  useEffect(() => {
    if (downloadSettings?.defaultPresetId) {
      setSelectedPresetId(downloadSettings.defaultPresetId);
    }
  }, [downloadSettings]);

  const activePreset = presets.find((p) => p.id === selectedPresetId) || presets[0];

  const handleSelectPreset = (preset: DownloadPreset) => {
    setSelectedPresetId(preset.id);
    setIsAudioOnly(preset.mediaType === "audio_only");
    if (preset.filenameTemplate && !customFilename) {
      setCustomFilename(preset.filenameTemplate);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        showToast("URL pasted from clipboard", "info");
      }
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  const handleClearUrl = () => {
    setUrl("");
    setError(null);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setMetadata(null);

    try {
      const meta = await api.analyzeMediaUrl(url.trim());
      setMetadata(meta);
      setOutputDir(downloadDirectory);
      setCustomFilename(meta.title || "");
      showToast("Media stream analyzed!", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast("Analysis error: " + msg, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePickDirectory = async () => {
    try {
      const picked = await downloadApi.chooseDownloadDirectory();
      if (picked) {
        setOutputDir(picked);
        showToast("Target folder selected", "success");
      }
    } catch {
      showToast("Folder selection cancelled", "info");
    }
  };

  const buildSnapshot = (): DownloadSettingsSnapshot | undefined => {
    if (!activePreset) return undefined;
    return {
      presetId: activePreset.id,
      presetName: activePreset.name,
      mediaType: isAudioOnly ? "audio_only" : activePreset.mediaType,
      maxResolution: activePreset.maxResolution,
      preferredFrameRate: activePreset.preferredFrameRate,
      containerPreference: activePreset.containerPreference,
      videoCodecPreference: activePreset.videoCodecPreference,
      audioCodecPreference: activePreset.audioCodecPreference,
      audioOutputFormat: activePreset.audioOutputFormat,
      audioBitrate: activePreset.audioBitrate,
      filenameTemplate: customFilename.trim() || activePreset.filenameTemplate || null,
      outputFolderRule: activePreset.outputFolderRule,
      outputDirectory: outputDir || downloadDirectory,
      filenameCollisionPolicy: downloadSettings?.filenameCollisionPolicy || "rename",
      hasOverrides: false,
    };
  };

  const handleStartDownload = async () => {
    if (!metadata || isStartingDownload) return;

    setIsStartingDownload(true);
    try {
      let formatSelection: FormatSelection;
      const mediaType: MediaType = isAudioOnly ? "audio" : "video";

      if (isAudioOnly) {
        formatSelection = {
          mode: "audio_only",
          value: { format: "mp3", quality: "0" },
        };
      } else if (selectedQuality === "best") {
        formatSelection = { mode: "best" };
      } else {
        formatSelection = { mode: "preset", value: selectedQuality };
      }

      const snapshot = buildSnapshot();
      await startDownload({
        webpageUrl: url.trim(),
        formatSelection,
        outputDirectory: outputDir || downloadDirectory,
        filenameTemplate: customFilename.trim() ? customFilename.trim() : null,
        mediaType,
        overwritePolicy: "rename",
        title: metadata.title,
        uploader: metadata.uploader,
        thumbnail: metadata.thumbnail,
        duration: metadata.duration,
        presetId: activePreset?.id,
        settingsSnapshot: snapshot,
      });

      showToast("Download started!", "success");
      navigate("/downloads");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Failed to start download: " + msg, "error");
    } finally {
      setIsStartingDownload(false);
    }
  };

  const handleAddToQueue = async (priority: QueuePriority = "normal") => {
    if (!metadata || isAddingToQueue) return;

    setIsAddingToQueue(true);
    try {
      let formatSelection: FormatSelection;
      const mediaType: MediaType = isAudioOnly ? "audio" : "video";

      if (isAudioOnly) {
        formatSelection = {
          mode: "audio_only",
          value: { format: "mp3", quality: "0" },
        };
      } else if (selectedQuality === "best") {
        formatSelection = { mode: "best" };
      } else {
        formatSelection = { mode: "preset", value: selectedQuality };
      }

      const snapshot = buildSnapshot();
      await enqueue(
        {
          webpageUrl: url.trim(),
          formatSelection,
          outputDirectory: outputDir || downloadDirectory,
          filenameTemplate: customFilename.trim() ? customFilename.trim() : null,
          mediaType,
          overwritePolicy: "rename",
          title: metadata.title,
          uploader: metadata.uploader,
          thumbnail: metadata.thumbnail,
          duration: metadata.duration,
          presetId: activePreset?.id,
          settingsSnapshot: snapshot,
        },
        priority
      );

      showToast("Added to download queue", "success");
      navigate("/queue");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Failed to queue: " + msg, "error");
    } finally {
      setIsAddingToQueue(false);
    }
  };

  const handleReset = () => {
    setMetadata(null);
    setError(null);
    setUrl("");
  };

  // Recent 4 downloads from task list
  const recentTasks = taskOrder.slice(0, 4).map((id) => tasks[id]).filter(Boolean);

  return (
    <div className="space-y-4 pb-4">
      {/* 1. Mobile Welcome Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 backdrop-blur-md">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>Media Downloader</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/25">
            1,000+ Sites
          </span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Paste any video or audio link from YouTube, TikTok, Instagram, Twitter/X, and more.
        </p>
      </div>

      {/* 2. Primary URL Input Card */}
      <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-black/[0.08] dark:border-white/[0.08] shadow-sm backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Link2 className="w-4 h-4 text-indigo-500" />
            <span>Enter Media Link</span>
          </div>

          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste</span>
          </button>
        </div>

        {/* Input & Action Bar */}
        <form onSubmit={handleAnalyze} className="space-y-3">
          <div className="relative flex items-center">
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              disabled={isAnalyzing}
              className="w-full rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder-slate-400 text-xs pl-3 pr-9 py-3 transition-all focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono disabled:opacity-50"
            />
            {url && (
              <button
                type="button"
                onClick={handleClearUrl}
                aria-label="Clear link"
                className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Analyze Button */}
          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing Stream...</span>
              </>
            ) : (
              <>
                <span>Analyze Link</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="font-semibold">Unable to analyze</p>
              <p className="text-[11px] leading-tight break-words">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Media Analysis Card (When URL is Analyzed) */}
      <AnimatePresence>
        {metadata && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-indigo-500/30 shadow-lg backdrop-blur-2xl space-y-4"
          >
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Ready to Download
                </span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Media Thumbnail & Meta */}
            <div className="flex gap-3">
              <div className="w-28 h-20 rounded-xl bg-black/10 dark:bg-white/10 overflow-hidden relative flex-shrink-0 flex items-center justify-center border border-black/[0.08] dark:border-white/[0.08]">
                {metadata.thumbnail ? (
                  <img
                    src={metadata.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="w-8 h-8 text-indigo-400" />
                )}
                {metadata.duration && (
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[9px] font-semibold">
                    {Math.floor(metadata.duration / 60)}:
                    {String(Math.floor(metadata.duration % 60)).padStart(2, "0")}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                  {metadata.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {metadata.uploader || "Unknown Channel"}
                </p>
                <span className="inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                  {metadata.formats?.length || 0} formats available
                </span>
              </div>
            </div>

            {/* Format Selector Pills */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Choose Format</span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                  {isAudioOnly ? "Audio Only (MP3)" : activePreset.name}
                </span>
              </label>

              {/* Mode Toggle (Video vs Audio Only) */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setIsAudioOnly(false)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    !isAudioOnly
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAudioOnly(true)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isAudioOnly
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Audio (MP3)</span>
                </button>
              </div>

              {/* Resolution / Preset Chips */}
              {!isAudioOnly && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {presets.slice(0, 4).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        selectedPresetId === preset.id
                          ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs"
                          : "bg-white/40 dark:bg-slate-800/40 border-black/[0.06] dark:border-white/[0.06] text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="text-[11px] font-bold leading-tight truncate">
                        {preset.name}
                      </div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {preset.description || preset.maxResolution}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Folder Destination */}
            <div className="p-2.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Folder className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate">
                  {outputDir || downloadDirectory || "Default Downloads"}
                </span>
              </div>
              <button
                type="button"
                onClick={handlePickDirectory}
                className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 flex-shrink-0 px-2 py-0.5 rounded bg-indigo-500/10 active:scale-95 cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Primary Download & Queue Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={isStartingDownload}
                onClick={handleStartDownload}
                className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isStartingDownload ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Launching Download...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Now</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isAddingToQueue || isStartingDownload}
                onClick={() => handleAddToQueue("normal")}
                className="w-full h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 border border-black/[0.06] dark:border-white/[0.06] active:scale-[0.98] transition-all cursor-pointer"
              >
                <ListOrdered className="w-3.5 h-3.5 text-indigo-500" />
                <span>Add to Queue</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Quick Action Shortcuts */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => navigate("/downloads")}
          className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3 active:scale-[0.98] transition-all text-left cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Downloads
            </div>
            <div className="text-[10px] text-slate-400">View progress</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/history")}
          className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3 active:scale-[0.98] transition-all text-left cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Media Library
            </div>
            <div className="text-[10px] text-slate-400">Browse saved files</div>
          </div>
        </button>
      </div>

      {/* 5. Recent Media Downloads List */}
      {recentTasks.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 px-1">
            <span>Recent Activity</span>
            <button
              onClick={() => navigate("/downloads")}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer"
            >
              See all
            </button>
          </div>

          <div className="space-y-2">
            {recentTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate("/downloads")}
                className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.06] dark:border-white/[0.06] flex items-center gap-3 active:scale-[0.99] transition-all cursor-pointer"
              >
                <div className="w-12 h-10 rounded-lg bg-black/10 dark:bg-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {t.request?.thumbnail ? (
                    <img
                      src={t.request.thumbnail}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Video className="w-4 h-4 text-indigo-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {t.request?.title || "Downloading media"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                    <span className="capitalize">{t.state}</span>
                    {t.progress?.percentage !== undefined && (
                      <span>• {t.progress.percentage.toFixed(1)}%</span>
                    )}
                    {t.progress?.speedFormatted && <span>• {t.progress.speedFormatted}</span>}
                  </div>
                </div>

                {t.state === "completed" && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                )}
                {t.state === "downloading" && (
                  <Loader2 className="w-4 h-4 text-indigo-500 animate-spin flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileHome;
