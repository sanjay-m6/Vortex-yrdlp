import React, { useEffect, useState } from "react";
import {
  Sliders,
  FolderTree,
  FileCheck,
  ShieldAlert,
  Settings2,
  Folder,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { FilenameTemplateEditor } from "./FilenameTemplateEditor";
import { PresetManagerModal } from "./PresetManagerModal";
import { usePresetStore } from "../../stores/presetStore";
import { useAppStore } from "../../stores/appStore";
import { FilenameCollisionPolicy } from "../../types/presets";

export const AdvancedSettingsCard: React.FC = () => {
  const {
    presets,
    downloadSettings,
    loadPresets,
    loadDownloadSettings,
    updateDownloadSettings,
  } = usePresetStore();

  const { showToast } = useAppStore();
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    loadPresets();
    loadDownloadSettings();
  }, [loadPresets, loadDownloadSettings]);

  if (!downloadSettings) return null;

  const handleCollisionPolicyChange = async (policy: FilenameCollisionPolicy) => {
    try {
      await updateDownloadSettings({ filenameCollisionPolicy: policy });
      showToast("Collision policy updated", "success");
    } catch {
      showToast("Failed to update policy", "error");
    }
  };

  const handleTemplateChange = async (tpl: string) => {
    try {
      await updateDownloadSettings({ defaultFilenameTemplate: tpl });
    } catch {
      // Handled in store
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Preset Defaults Header */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span>Default Quality Profile</span>
            </div>

            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium lowercase"
            >
              <Settings2 className="w-3 h-3" />
              <span>Manage all profiles</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Default Preset Profile
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Applied to quick downloads and clipboard ingestions
              </p>
            </div>

            <select
              value={downloadSettings.defaultPresetId}
              onChange={async (e) => {
                await updateDownloadSettings({ defaultPresetId: e.target.value });
                showToast("Default preset updated", "success");
              }}
              className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isBuiltIn ? "(Built-in)" : "(Custom)"}
                </option>
              ))}
            </select>
          </div>
        </GlassCard>

        {/* Output Organization Rules */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <FolderTree className="w-3.5 h-3.5 text-indigo-500" />
            <span>Folder Organization Rules</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Video Subfolder (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Videos"
                  value={downloadSettings.videoSubfolder || ""}
                  onChange={(e) =>
                    updateDownloadSettings({
                      videoSubfolder: e.target.value.trim() || null,
                    })
                  }
                  className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Audio Subfolder (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Music"
                  value={downloadSettings.audioSubfolder || ""}
                  onChange={(e) =>
                    updateDownloadSettings({
                      audioSubfolder: e.target.value.trim() || null,
                    })
                  }
                  className="w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Organize playlists into folders
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically create a folder matching the playlist name
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={downloadSettings.playlistSubfolder}
                  onChange={(e) => {
                    updateDownloadSettings({ playlistSubfolder: e.target.checked });
                    showToast("Organization preferences updated", "success");
                  }}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Organize by uploader / channel
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Group downloads inside creator-named subfolders
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={downloadSettings.uploaderSubfolder}
                  onChange={(e) => {
                    updateDownloadSettings({ uploaderSubfolder: e.target.checked });
                    showToast("Organization preferences updated", "success");
                  }}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                <div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    Organize by date (YYYY/MM)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sort incoming files into year/month directories
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={downloadSettings.dateSubfolder}
                  onChange={(e) => {
                    updateDownloadSettings({ dateSubfolder: e.target.checked });
                    showToast("Organization preferences updated", "success");
                  }}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Filename Collision Rules */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Filename Collision Policy</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: "rename" as const,
                title: "Rename with counter",
                desc: "Safely appends (1), (2) to avoid overwriting existing files.",
              },
              {
                id: "overwrite" as const,
                title: "Overwrite existing",
                desc: "Replaces any conflicting file at the destination directory.",
              },
              {
                id: "skip" as const,
                title: "Skip download",
                desc: "Does not redownload if target filename already exists.",
              },
            ].map((opt) => {
              const isSelected = downloadSettings.filenameCollisionPolicy === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleCollisionPolicyChange(opt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-500/60 text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-500/30"
                      : "bg-white/40 dark:bg-slate-950/40 border-black/[0.06] text-slate-600 dark:text-slate-400 hover:bg-black/[0.02]"
                  }`}
                >
                  <p className="text-xs font-bold leading-tight mb-1">{opt.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {opt.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Global Filename Template */}
        <GlassCard className="p-5 space-y-4">
          <FilenameTemplateEditor
            value={downloadSettings.defaultFilenameTemplate}
            onChange={handleTemplateChange}
            sampleMetadata={{
              title: "Synthwave Sunset Chillout",
              id: "8UVNT4wvIGY",
              uploader: "ChillVibes Music",
            }}
          />
        </GlassCard>
      </div>

      {/* Preset Manager Modal */}
      <PresetManagerModal
        isOpen={managerOpen}
        onClose={() => setManagerOpen(false)}
      />
    </>
  );
};
