import { create } from "zustand";
import { api } from "../lib/api";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  theme: ThemeMode;
  downloadDirectory: string;
  askBeforeDownload: boolean;
  startWithSystem: boolean;
  minimizeToTray: boolean;
  init: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  updateSettings: (partial: Partial<SettingsState>) => void;
}

const STORAGE_KEY = "vortex_settings";
const LEGACY_STORAGE_KEY = "mediadl_phase1_settings";

const loadInitialSettings = (): Partial<SettingsState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not read settings from localStorage:", e);
  }
  return {};
};

const saveSettings = (state: Partial<SettingsState>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save settings to localStorage:", e);
  }
};

const initial = loadInitialSettings();

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: initial.theme || "light",
  downloadDirectory: initial.downloadDirectory || "Downloads",
  askBeforeDownload: initial.askBeforeDownload ?? false,
  startWithSystem: initial.startWithSystem ?? false,
  minimizeToTray: initial.minimizeToTray ?? false,

  init: async () => {
    const current = get().downloadDirectory;
    if (!current || current === "Downloads") {
      try {
        const defaultDir = await api.getDefaultDownloadDirectory();
        if (defaultDir) {
          get().updateSettings({ downloadDirectory: defaultDir });
        }
      } catch (e) {
        console.warn("Could not query default download directory:", e);
      }
    }
  },

  setTheme: (theme) =>
    set((state) => {
      const updated = { ...state, theme };
      saveSettings(updated);
      return updated;
    }),

  updateSettings: (partial) =>
    set((state) => {
      const updated = { ...state, ...partial };
      saveSettings(updated);
      return updated;
    }),
}));
