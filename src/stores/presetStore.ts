import { create } from "zustand";
import { presetApi } from "../lib/presetApi";
import {
  DownloadPreset,
  DownloadSettings,
  DownloadSettingsSnapshot,
  SettingsValidationResult,
} from "../types/presets";

export interface PresetState {
  presets: DownloadPreset[];
  activePresetId: string;
  downloadSettings: DownloadSettings | null;
  isLoading: boolean;
  error: string | null;
  validationResult: SettingsValidationResult | null;

  loadPresets: () => Promise<void>;
  loadDownloadSettings: () => Promise<void>;
  setActivePresetId: (id: string) => void;
  savePreset: (preset: DownloadPreset) => Promise<DownloadPreset>;
  deletePreset: (id: string) => Promise<boolean>;
  resetPresets: () => Promise<void>;
  updateDownloadSettings: (partial: Partial<DownloadSettings>) => Promise<void>;
  validateSnapshot: (snapshot: DownloadSettingsSnapshot) => Promise<SettingsValidationResult>;
  getActivePreset: () => DownloadPreset | undefined;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  activePresetId: "best-quality",
  downloadSettings: null,
  isLoading: false,
  error: null,
  validationResult: null,

  loadPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const presets = await presetApi.getPresets();
      set({ presets, isLoading: false });
    } catch (err: any) {
      set({ error: err?.toString() ?? "Failed to load presets", isLoading: false });
    }
  },

  loadDownloadSettings: async () => {
    try {
      const settings = await presetApi.getDownloadSettings();
      set({
        downloadSettings: settings,
        activePresetId: settings.defaultPresetId || "best-quality",
      });
    } catch (err: any) {
      console.error("Failed to load download settings:", err);
    }
  },

  setActivePresetId: (id: string) => {
    set({ activePresetId: id });
  },

  savePreset: async (preset: DownloadPreset) => {
    set({ isLoading: true, error: null });
    try {
      const saved = await presetApi.savePreset(preset);
      set((state) => {
        const existingIndex = state.presets.findIndex((p) => p.id === saved.id);
        const newPresets =
          existingIndex >= 0
            ? state.presets.map((p) => (p.id === saved.id ? saved : p))
            : [...state.presets, saved];
        return { presets: newPresets, isLoading: false };
      });
      return saved;
    } catch (err: any) {
      const message = err?.toString() ?? "Failed to save preset";
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  deletePreset: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const success = await presetApi.deletePreset(id);
      if (success) {
        set((state) => {
          const newPresets = state.presets.filter((p) => p.id !== id);
          const activePresetId =
            state.activePresetId === id ? "best-quality" : state.activePresetId;
          return { presets: newPresets, activePresetId, isLoading: false };
        });
      }
      return success;
    } catch (err: any) {
      const message = err?.toString() ?? "Failed to delete preset";
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  resetPresets: async () => {
    set({ isLoading: true, error: null });
    try {
      const presets = await presetApi.resetPresets();
      set({ presets, isLoading: false });
    } catch (err: any) {
      set({ error: err?.toString() ?? "Failed to reset presets", isLoading: false });
    }
  },

  updateDownloadSettings: async (partial: Partial<DownloadSettings>) => {
    const current = get().downloadSettings;
    if (!current) return;
    const merged: DownloadSettings = { ...current, ...partial };
    try {
      const updated = await presetApi.updateDownloadSettings(merged);
      set({ downloadSettings: updated });
    } catch (err: any) {
      console.error("Failed to update download settings:", err);
      throw err;
    }
  },

  validateSnapshot: async (snapshot: DownloadSettingsSnapshot) => {
    try {
      const result = await presetApi.validateDownloadSettings(snapshot);
      set({ validationResult: result });
      return result;
    } catch (err: any) {
      const fallbackResult: SettingsValidationResult = {
        valid: false,
        warnings: [],
        errors: [err?.toString() ?? "Validation failed"],
        ffmpegRequired: false,
        ffmpegAvailable: false,
      };
      set({ validationResult: fallbackResult });
      return fallbackResult;
    }
  },

  getActivePreset: () => {
    const { presets, activePresetId } = get();
    return presets.find((p) => p.id === activePresetId) ?? presets[0];
  },
}));
