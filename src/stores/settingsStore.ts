import { create } from "zustand";
import { api } from "../lib/api";

export type ThemeMode = "light" | "dark" | "system";

export interface SettingsState {
  theme: ThemeMode;
  downloadDirectory: string;
  askBeforeDownload: boolean;
  startWithSystem: boolean;
  minimizeToTray: boolean;
  setupCompleted: boolean;
  setupStep: number;
  isInitialized: boolean;
  autoCheckUpdates: boolean;
  checkFrequency: "startup" | "daily" | "weekly";
  notifyOnUpdate: boolean;
  includePrereleases: boolean;
  autoInstallUpdates: boolean;
  lastUpdateCheck: string | null;
  init: () => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  updateSettings: (partial: Partial<SettingsState>) => void;
  updateAutoUpdatePreferences: (partial: Partial<{
    autoCheckUpdates: boolean;
    checkFrequency: "startup" | "daily" | "weekly";
    notifyOnUpdate: boolean;
    includePrereleases: boolean;
    autoInstallUpdates: boolean;
  }>) => Promise<void>;
  refreshSetupStatus: () => Promise<{ setupCompleted: boolean; setupStep: number; requiresSetup: boolean }>;
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
  setupCompleted: false,
  setupStep: 1,
  isInitialized: false,
  autoCheckUpdates: true,
  checkFrequency: "startup",
  notifyOnUpdate: true,
  includePrereleases: false,
  autoInstallUpdates: false,
  lastUpdateCheck: null,

  init: async () => {
    try {
      const appSettings = await api.getAppSettings();
      if (appSettings.download_dir && (!get().downloadDirectory || get().downloadDirectory === "Downloads")) {
        set({ downloadDirectory: appSettings.download_dir });
      }
      if (typeof appSettings.setup_completed === "boolean") {
        set({
          setupCompleted: appSettings.setup_completed,
          setupStep: appSettings.setup_step || 1,
        });
      }
    } catch (e) {
      console.warn("Could not query backend settings from SQLite:", e);
    }

    try {
      const updatePrefs = await api.getUpdatePreferences();
      set({
        autoCheckUpdates: updatePrefs.autoCheckUpdates,
        checkFrequency: updatePrefs.checkFrequency,
        notifyOnUpdate: updatePrefs.notifyOnUpdate,
        includePrereleases: updatePrefs.includePrereleases,
        autoInstallUpdates: updatePrefs.autoInstallUpdates,
        lastUpdateCheck: updatePrefs.lastUpdateCheck,
      });
    } catch (e) {
      console.warn("Could not query update preferences:", e);
    }

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

    set({ isInitialized: true });
  },

  refreshSetupStatus: async () => {
    try {
      const status = await api.getSetupStatus();
      set({
        setupCompleted: status.setupCompleted,
        setupStep: status.setupStep,
      });
      return status;
    } catch (e) {
      console.warn("Could not fetch setup status:", e);
      return {
        setupCompleted: get().setupCompleted,
        setupStep: get().setupStep,
        requiresSetup: !get().setupCompleted,
      };
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

  updateAutoUpdatePreferences: async (partial) => {
    const current = {
      autoCheckUpdates: partial.autoCheckUpdates ?? get().autoCheckUpdates,
      checkFrequency: partial.checkFrequency ?? get().checkFrequency,
      notifyOnUpdate: partial.notifyOnUpdate ?? get().notifyOnUpdate,
      includePrereleases: partial.includePrereleases ?? get().includePrereleases,
      autoInstallUpdates: partial.autoInstallUpdates ?? get().autoInstallUpdates,
      lastUpdateCheck: get().lastUpdateCheck,
    };
    try {
      await api.saveUpdatePreferences(current);
      set({
        autoCheckUpdates: current.autoCheckUpdates,
        checkFrequency: current.checkFrequency,
        notifyOnUpdate: current.notifyOnUpdate,
        includePrereleases: current.includePrereleases,
        autoInstallUpdates: current.autoInstallUpdates,
      });
    } catch (e) {
      console.error("Failed to save update preferences:", e);
      throw e;
    }
  },
}));
