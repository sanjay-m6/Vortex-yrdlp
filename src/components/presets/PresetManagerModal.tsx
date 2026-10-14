import React, { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  Sparkles,
  Video,
  Music,
  Check,
  AlertTriangle,
  FolderTree,
  Sliders,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { FilenameTemplateEditor } from "./FilenameTemplateEditor";
import { usePresetStore } from "../../stores/presetStore";
import { useAppStore } from "../../stores/appStore";
import {
  DownloadPreset,
  PresetMediaType,
  MaxResolution,
  PreferredFrameRate,
  ContainerPreference,
  VideoCodecPreference,
  AudioCodecPreference,
  AudioOutputFormat,
  AudioBitrate,
  FolderRule,
} from "../../types/presets";

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { presets, savePreset, deletePreset, resetPresets } = usePresetStore();
  const { showToast } = useAppStore();

  const [selectedId, setSelectedId] = useState<string>(presets[0]?.id || "best-quality");
  const [editingPreset, setEditingPreset] = useState<DownloadPreset | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const currentPreset =
    editingPreset ||
    presets.find((p) => p.id === selectedId) ||
    presets[0];

  const handleSelectPreset = (preset: DownloadPreset) => {
    setSelectedId(preset.id);
    setEditingPreset(null);
    setIsCreatingNew(false);
  };

  const handleStartCreate = () => {
    const newPreset: DownloadPreset = {
      id: "",
      name: "Custom Quality",
      description: "Custom video and audio download settings",
      isBuiltIn: false,
      mediaType: "video_with_audio",
      maxResolution: "1080p",
      preferredFrameRate: "any",
      containerPreference: "auto",
      videoCodecPreference: "auto",
      audioCodecPreference: "auto",
      audioOutputFormat: "source",
      audioBitrate: "auto",
      filenameTemplate: "%(title).150B [%(id)s].%(ext)s",
      outputFolderRule: "none",
      createdAt: "",
      updatedAt: "",
    };
    setEditingPreset(newPreset);
    setIsCreatingNew(true);
  };

  const handleDuplicate = (preset: DownloadPreset) => {
    const duplicated: DownloadPreset = {
      ...preset,
      id: "",
      name: `${preset.name} (Copy)`,
      isBuiltIn: false,
    };
    setEditingPreset(duplicated);
    setIsCreatingNew(true);
  };

  const handleSave = async () => {
    if (!currentPreset) return;
    if (!currentPreset.name.trim()) {
      showToast("Preset name is required", "error");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await savePreset(currentPreset);
      setSelectedId(saved.id);
      setEditingPreset(null);
      setIsCreatingNew(false);
      showToast("Preset saved successfully", "success");
    } catch (err: any) {
      showToast("Failed to save preset: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this custom preset?")) {
      try {
        await deletePreset(id);
        setSelectedId("best-quality");
        setEditingPreset(null);
        showToast("Preset deleted", "success");
      } catch (err: any) {
        showToast("Cannot delete preset: " + err.message, "error");
      }
    }
  };

  const handleResetDefaults = async () => {
    if (window.confirm("Reset all presets to factory defaults? Custom presets will be retained.")) {
      try {
        await resetPresets();
        showToast("Presets reset to factory defaults", "success");
      } catch (err: any) {
        showToast("Failed to reset presets: " + err.message, "error");
      }
    }
  };

  const updateCurrent = (patch: Partial<DownloadPreset>) => {
    if (editingPreset) {
      setEditingPreset({ ...editingPreset, ...patch });
    } else if (currentPreset) {
      setEditingPreset({ ...currentPreset, ...patch });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white/95 dark:bg-slate-900/95 border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Preset & Quality Manager
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure format preferences, codec rules, and filename templates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDefaults}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06] hover:bg-black/[0.02] cursor-pointer"
              title="Reset built-in presets"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Built-ins</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.05] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar List + Editor Details */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-black/[0.06] dark:divide-white/[0.06]">
          {/* Preset Sidebar */}
          <div className="md:col-span-4 p-4 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Profiles ({presets.length})
              </span>
              <button
                type="button"
                onClick={handleStartCreate}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {presets.map((p) => {
                const isSelected = p.id === currentPreset?.id && !isCreatingNew;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPreset(p)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500/50 text-indigo-950 dark:text-indigo-50 font-semibold shadow-xs"
                        : "bg-white/40 dark:bg-slate-950/40 border-black/[0.04] dark:border-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-black/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {p.mediaType === "audio_only" ? (
                        <Music className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      ) : (
                        <Video className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                      )}
                      <span className="text-xs truncate">{p.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {p.isBuiltIn ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.04] text-slate-400">
                          Built-in
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(p.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Delete preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preset Editor Details */}
          <div className="md:col-span-8 p-6 overflow-y-auto space-y-5">
            {currentPreset && (
              <>
                {/* Name & Description */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {currentPreset.isBuiltIn ? "Built-in Profile" : isCreatingNew ? "Create Profile" : "Edit Profile"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(currentPreset)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicate as Custom</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Profile Name
                      </label>
                      <input
                        type="text"
                        value={currentPreset.name}
                        disabled={currentPreset.isBuiltIn}
                        onChange={(e) => updateCurrent({ name: e.target.value })}
                        className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2 text-xs font-medium disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Description
                      </label>
                      <input
                        type="text"
                        value={currentPreset.description}
                        disabled={currentPreset.isBuiltIn}
                        onChange={(e) => updateCurrent({ description: e.target.value })}
                        className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2 text-xs disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Media Type Toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Media Target
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={currentPreset.isBuiltIn}
                      onClick={() => updateCurrent({ mediaType: "video_with_audio" })}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        currentPreset.mediaType === "video_with_audio"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                          : "bg-white/40 dark:bg-slate-950/40 border-black/[0.06] text-slate-600 dark:text-slate-400"
                      } disabled:opacity-60`}
                    >
                      <Video className="w-4 h-4" />
                      <span>Video with Audio</span>
                    </button>

                    <button
                      type="button"
                      disabled={currentPreset.isBuiltIn}
                      onClick={() => updateCurrent({ mediaType: "audio_only" })}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        currentPreset.mediaType === "audio_only"
                          ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-600 dark:text-indigo-400"
                          : "bg-white/40 dark:bg-slate-950/40 border-black/[0.06] text-slate-600 dark:text-slate-400"
                      } disabled:opacity-60`}
                    >
                      <Music className="w-4 h-4" />
                      <span>Audio Only</span>
                    </button>
                  </div>
                </div>

                {/* Video Options */}
                {currentPreset.mediaType === "video_with_audio" && (
                  <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      Video Configuration
                    </h5>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          Max Resolution
                        </label>
                        <select
                          disabled={currentPreset.isBuiltIn}
                          value={currentPreset.maxResolution || "best"}
                          onChange={(e) =>
                            updateCurrent({ maxResolution: e.target.value as MaxResolution })
                          }
                          className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                        >
                          <option value="best">Best Available</option>
                          <option value="2160p">4K (2160p)</option>
                          <option value="1440p">2K (1440p)</option>
                          <option value="1080p">1080p FHD</option>
                          <option value="720p">720p HD</option>
                          <option value="480p">480p SD</option>
                          <option value="360p">360p</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          Preferred FPS
                        </label>
                        <select
                          disabled={currentPreset.isBuiltIn}
                          value={currentPreset.preferredFrameRate || "any"}
                          onChange={(e) =>
                            updateCurrent({
                              preferredFrameRate: e.target.value as PreferredFrameRate,
                            })
                          }
                          className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                        >
                          <option value="any">Any Frame Rate</option>
                          <option value="30">30 FPS max</option>
                          <option value="60">60 FPS prefer</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          Container Format
                        </label>
                        <select
                          disabled={currentPreset.isBuiltIn}
                          value={currentPreset.containerPreference || "auto"}
                          onChange={(e) =>
                            updateCurrent({
                              containerPreference: e.target.value as ContainerPreference,
                            })
                          }
                          className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                        >
                          <option value="auto">Auto / Source</option>
                          <option value="mp4">MP4 (Recommended)</option>
                          <option value="mkv">MKV</option>
                          <option value="webm">WebM</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          Video Codec
                        </label>
                        <select
                          disabled={currentPreset.isBuiltIn}
                          value={currentPreset.videoCodecPreference || "auto"}
                          onChange={(e) =>
                            updateCurrent({
                              videoCodecPreference: e.target.value as VideoCodecPreference,
                            })
                          }
                          className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                        >
                          <option value="auto">Auto</option>
                          <option value="h264">H.264 (Broadly compatible)</option>
                          <option value="h265">H.265 / HEVC</option>
                          <option value="vp9">VP9</option>
                          <option value="av1">AV1</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Options */}
                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Audio Configuration
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Output Audio Format
                      </label>
                      <select
                        disabled={currentPreset.isBuiltIn}
                        value={currentPreset.audioOutputFormat || "source"}
                        onChange={(e) =>
                          updateCurrent({
                            audioOutputFormat: e.target.value as AudioOutputFormat,
                          })
                        }
                        className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                      >
                        <option value="source">Source (No conversion)</option>
                        <option value="mp3">MP3 (Universal)</option>
                        <option value="m4a">M4A / AAC</option>
                        <option value="opus">Opus</option>
                        <option value="wav">WAV (Lossless)</option>
                        <option value="flac">FLAC (Lossless)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Audio Bitrate
                      </label>
                      <select
                        disabled={currentPreset.isBuiltIn}
                        value={currentPreset.audioBitrate || "auto"}
                        onChange={(e) =>
                          updateCurrent({
                            audioBitrate: e.target.value as AudioBitrate,
                          })
                        }
                        className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                      >
                        <option value="auto">Auto / Source</option>
                        <option value="320k">320 kbps (High)</option>
                        <option value="256k">256 kbps</option>
                        <option value="192k">192 kbps (Standard)</option>
                        <option value="128k">128 kbps (Compact)</option>
                        <option value="96k">96 kbps</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Folder Organization Rule
                      </label>
                      <select
                        disabled={currentPreset.isBuiltIn}
                        value={currentPreset.outputFolderRule || "none"}
                        onChange={(e) =>
                          updateCurrent({
                            outputFolderRule: e.target.value as FolderRule,
                          })
                        }
                        className="w-full rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/[0.08] dark:border-white/[0.08] px-2.5 py-1.5 text-xs disabled:opacity-60"
                      >
                        <option value="none">None (Direct into folder)</option>
                        <option value="playlist">Organize by Playlist</option>
                        <option value="uploader">Organize by Uploader</option>
                        <option value="media_type">Separate Video / Audio</option>
                        <option value="date">Organize by Date (YYYY/MM)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Filename Template */}
                <div className="space-y-1">
                  <FilenameTemplateEditor
                    value={currentPreset.filenameTemplate || "%(title).150B [%(id)s].%(ext)s"}
                    onChange={(tpl) => updateCurrent({ filenameTemplate: tpl })}
                    sampleMetadata={{
                      title: "My Awesome Video",
                      id: "dQw4w9WgXcQ",
                      uploader: "Favorite Creator",
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                  {!currentPreset.isBuiltIn && (
                    <GlassButton
                      variant="primary"
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSaving ? "Saving..." : "Save Profile"}</span>
                    </GlassButton>
                  )}
                  {currentPreset.isBuiltIn && (
                    <GlassButton
                      onClick={() => handleDuplicate(currentPreset)}
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Duplicate to Edit</span>
                    </GlassButton>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
