import { create } from "zustand";

export type ToastType = "success" | "info" | "error";

interface ToastState {
  message: string;
  type: ToastType;
}

interface AppStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toast: ToastState | null;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toast: null,
  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => {
      set((state) => (state.toast?.message === message ? { toast: null } : state));
    }, 3200);
  },
  hideToast: () => set({ toast: null }),
}));
