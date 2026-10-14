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
