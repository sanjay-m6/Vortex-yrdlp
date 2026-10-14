import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2,
  Loader2,
  Clipboard,
  ArrowRight,
  Download,
  Folder,
  Music,
  Video,
  Sparkles,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  ListOrdered,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useDownloadStore } from "../../stores/downloadStore";
import { useQueueStore } from "../../stores/queueStore";
import { usePresetStore } from "../../stores/presetStore";
import { PresetSelector } from "../presets/PresetSelector";
import { PresetManagerModal } from "../presets/PresetManagerModal";
import { api } from "../../lib/api";
import { downloadApi } from "../../lib/downloadApi";
import { MediaMetadata } from "../../types";
import { FormatSelection, MediaType } from "../../types/download";
import { QueuePriority } from "../../types/queue";
import { DownloadPreset, DownloadSettingsSnapshot } from "../../types/presets";

export const UrlInput: React.FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);

  // Presets & format options
  const {
    presets,
    loadPresets,
    loadDownloadSettings,
    downloadSettings,
  } = usePresetStore();
  const [selectedPresetId, setSelectedPresetId] = useState<string>("best-quality");
  const [managerOpen, setManagerOpen] = useState(false);

  React.useEffect(() => {
    loadPresets();
    loadDownloadSettings();
  }, [loadPresets, loadDownloadSettings]);

  React.useEffect(() => {
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

  const [selectedQuality, setSelectedQuality] = useState<string>("best");
  const [isAudioOnly, setIsAudioOnly] = useState<boolean>(false);
  const [customFilename, setCustomFilename] = useState<string>("");
  const [outputDir, setOutputDir] = useState<string>("");
  const [isStartingDownload, setIsStartingDownload] = useState(false);

  const { showToast } = useAppStore();
  const { downloadDirectory } = useSettingsStore();
  const { startDownload } = useDownloadStore();
  const { enqueue } = useQueueStore();
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);

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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      showToast("Could not access clipboard", "error");
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setError(null);
    setMetadata(null);

    try {
      const meta = await api.analyzeMediaUrl(url.trim());
      setMetadata(meta);
      setOutputDir(downloadDirectory);
      setCustomFilename(meta.title || "");
      showToast("URL analyzed successfully", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast("Analysis failed: " + msg, "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePickDirectory = async () => {
    try {
      const picked = await downloadApi.chooseDownloadDirectory();
      if (picked) {
        setOutputDir(picked);
      }
    } catch {
      showToast("Directory selection cancelled", "info");
    }
  };

  const handleStartDownload = async () => {
    if (!metadata) return;

    setIsStartingDownload(true);
    try {
      let formatSelection: FormatSelection;
      let mediaType: MediaType = isAudioOnly ? "audio" : "video";

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
    if (!metadata) return;

    setIsAddingToQueue(true);
    try {
      let formatSelection: FormatSelection;
      let mediaType: MediaType = isAudioOnly ? "audio" : "video";

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

      showToast("Added to download queue!", "success");
      navigate("/queue");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast("Failed to queue download: " + msg, "error");
    } finally {
      setIsAddingToQueue(false);
    }
  };

  const handleReset = () => {
    setMetadata(null);
    setError(null);
    setUrl("");
  };

  return (
    <div className="space-y-4">
      {/* Welcome Banner */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Media Ingestion Core
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Inspect media streams, configure presets, and trigger downloads via yt-dlp.
        </p>
      </div>

      {/* Main Glass Input Card */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-indigo-500" />
            <span>Paste a media URL to analyze</span>
          </div>

          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>Paste from clipboard</span>
          </button>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isAnalyzing}
              className="w-full rounded-xl bg-white/50 dark:bg-slate-950/50 border border-black/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-xs px-4 py-3 transition-all focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-slate-400 dark:text-slate-500">
              {isAnalyzing && (
                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Inspecting stream formats with yt-dlp...
                </span>
              )}
              {!isAnalyzing && !metadata && (
                <span>yt-dlp engine verified — ready for stream analysis.</span>
              )}
            </div>

            <GlassButton
              type="submit"
              variant="primary"
              disabled={isAnalyzing || !url.trim()}
              className="px-5 py-2 text-xs font-semibold"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <span>Analyze URL</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </GlassButton>
          </div>
        </form>

        {/* Error message banner */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Analysis Failed</p>
              <p className="text-[11px] leading-relaxed">{error}</p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Analysis Results & Download Confirmation Card */}
      {metadata && (
        <GlassCard className="p-5 space-y-5 border-indigo-500/30">
          <div className="flex items-start justify-between border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Media Details & Download Options
              </h3>
            </div>

            <GlassButton size="sm" onClick={handleReset}>
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </GlassButton>
          </div>

          {/* Media Header Preview */}
          <div className="flex items-start gap-4">
            <div className="w-32 h-20 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06] flex-shrink-0 overflow-hidden relative flex items-center justify-center">
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
                <span className="absolute bottom-1 right-1 bg-black/75 text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-medium">
                  {Math.floor(metadata.duration / 60)}:
                  {String(Math.floor(metadata.duration % 60)).padStart(2, "0")}
                </span>
              )}
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-2">
                {metadata.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {metadata.uploader || "Unknown Author"}
              </p>
              <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                {metadata.formats?.length || 0} formats available
              </p>
            </div>
          </div>

          {/* Quality & Preset Selector */}
          <PresetSelector
            compact
            presets={presets}
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            onOpenManager={() => setManagerOpen(true)}
          />

          {/* Output Destination & Custom Filename */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Destination Folder
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={outputDir || downloadDirectory}
                  className="flex-1 rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 truncate"
                />
                <GlassButton size="sm" onClick={handlePickDirectory}>
                  <Folder className="w-3 h-3 text-indigo-500" />
                  <span>Browse</span>
                </GlassButton>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                File Title / Template
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="%(title)s.%(ext)s"
                className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          {/* Action Buttons: Add to Queue & Start Download */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/[0.06] gap-3">
            <span className="text-[11px] text-slate-500 font-mono">
              Ready to process {isAudioOnly ? "audio stream" : "video & audio"}
            </span>

            <div className="flex items-center gap-2.5">
              <GlassButton
                variant="secondary"
                size="md"
                disabled={isAddingToQueue || isStartingDownload}
                onClick={() => handleAddToQueue("normal")}
                className="gap-2 text-xs font-semibold"
              >
                {isAddingToQueue ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Queueing...</span>
                  </>
                ) : (
                  <>
                    <ListOrdered className="w-4 h-4 text-indigo-500" />
                    <span>Add to Queue</span>
                  </>
                )}
              </GlassButton>

              <GlassButton
                variant="primary"
                size="md"
                disabled={isStartingDownload || isAddingToQueue}
                onClick={handleStartDownload}
                className="gap-2 px-6 text-xs font-semibold"
              >
                {isStartingDownload ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Starting...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Now</span>
                  </>
                )}
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Preset Manager Modal */}
      <PresetManagerModal
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
      />
    </div>
  );
};
