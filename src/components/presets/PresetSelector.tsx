import React from "react";
import {
  Sparkles,
  Video,
  Music,
  Smartphone,
  Feather,
  Sliders,
  Settings2,
  Check,
} from "lucide-react";
import { DownloadPreset } from "../../types/presets";

interface PresetSelectorProps {
  presets: DownloadPreset[];
  selectedPresetId: string;
  onSelectPreset: (preset: DownloadPreset) => void;
  onOpenManager?: () => void;
  compact?: boolean;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  presets,
  selectedPresetId,
  onSelectPreset,
  onOpenManager,
  compact = false,
}) => {
  const getPresetIcon = (preset: DownloadPreset) => {
    if (preset.mediaType === "audio_only") {
      return <Music className="w-4 h-4 text-amber-500" />;
    }
    switch (preset.id) {
      case "best-quality":
        return <Sparkles className="w-4 h-4 text-indigo-500" />;
      case "1080p":
      case "720p":
      case "480p":
        return <Video className="w-4 h-4 text-blue-500" />;
      case "small-file":
        return <Feather className="w-4 h-4 text-emerald-500" />;
      case "mobile":
        return <Smartphone className="w-4 h-4 text-cyan-500" />;
      case "custom":
      default:
        return <Sliders className="w-4 h-4 text-purple-500" />;
    }
  };

  const getPresetBadge = (preset: DownloadPreset) => {
    if (preset.mediaType === "audio_only") {
      const fmt = (preset.audioOutputFormat || "mp3").toUpperCase();
      const br = preset.audioBitrate?.replace("k", "k") || "320k";
      return `${fmt} • ${br}`;
    }
    const res = preset.maxResolution === "best" ? "Best" : preset.maxResolution || "Auto";
    const cont = (preset.containerPreference || "auto").toUpperCase();
    return `${res} • ${cont}`;
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Download Quality Preset</span>
          </label>
          {onOpenManager && (
            <button
              type="button"
              onClick={onOpenManager}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <Settings2 className="w-3 h-3" />
              <span>Customize</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((p) => {
            const isSelected = p.id === selectedPresetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p)}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-100 shadow-xs ring-1 ring-indigo-500/30"
                    : "bg-white/40 dark:bg-slate-950/40 border-black/[0.06] dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex-shrink-0">{getPresetIcon(p)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate leading-tight">{p.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-mono">
                    {getPresetBadge(p)}
                  </p>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Preset Profiles</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Select a tailored profile for quality, format, and codec preferences.
          </p>
        </div>

        {onOpenManager && (
          <button
            type="button"
            onClick={onOpenManager}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-black/[0.06] dark:border-white/[0.06] text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-2xs"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Manage Profiles</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        {presets.map((p) => {
          const isSelected = p.id === selectedPresetId;
          return (
            <div
              key={p.id}
              onClick={() => onSelectPreset(p)}
              className={`group p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                isSelected
                  ? "bg-indigo-50/90 dark:bg-indigo-950/70 border-indigo-500/80 text-indigo-950 dark:text-indigo-50 shadow-xs ring-1 ring-indigo-500/40"
                  : "bg-white/40 dark:bg-slate-950/40 border-black/[0.06] dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded-lg bg-black/[0.04] dark:bg-white/[0.04]">
                      {getPresetIcon(p)}
                    </span>
                    <span className="text-xs font-bold truncate">{p.name}</span>
                  </div>

                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-medium ${
                      isSelected
                        ? "bg-indigo-200/80 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200"
                        : "bg-black/[0.04] dark:bg-white/[0.04] text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {getPresetBadge(p)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-[10px]">
                <span className="text-slate-400 dark:text-slate-500">
                  {p.isBuiltIn ? "Built-in" : "Custom"}
                </span>
                {isSelected && (
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                    <Check className="w-3 h-3" />
                    <span>Selected</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
