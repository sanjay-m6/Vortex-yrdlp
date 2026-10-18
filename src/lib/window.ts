import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const windowControls = {
  minimize: async () => {
    try {
      await invoke("app_minimize_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
      } catch (e) {
        console.warn("Window minimize fallback error:", e);
      }
    }
  },

  toggleMaximize: async (): Promise<boolean> => {
    try {
      return await invoke<boolean>("app_toggle_maximize_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.toggleMaximize();
        return await appWindow.isMaximized();
      } catch (e) {
        console.warn("Window toggleMaximize fallback error:", e);
        return false;
      }
    }
  },

  close: async () => {
    try {
      await invoke("app_close_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.close();
      } catch (e) {
        console.warn("Window close fallback error:", e);
      }
    }
  },

  show: async () => {
    try {
      await invoke("app_show_window");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.show();
        await appWindow.setFocus();
      } catch (e) {
        console.warn("Window show fallback error:", e);
      }
    }
  },

  exit: async () => {
    try {
      await invoke("app_exit");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.close();
      } catch (e) {
        console.warn("App exit fallback error:", e);
      }
    }
  },

  getActiveDownloadsCount: async (): Promise<number> => {
    try {
      return await invoke<number>("app_get_active_downloads_count");
    } catch {
      return 0;
    }
  },

  isMaximized: async (): Promise<boolean> => {
    try {
      return await invoke<boolean>("app_is_maximized");
    } catch {
      try {
        const appWindow = getCurrentWindow();
        return await appWindow.isMaximized();
      } catch {
        return false;
      }
    }
  },
};
