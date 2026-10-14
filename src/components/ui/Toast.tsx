import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

export const Toast: React.FC = () => {
  const { toast, hideToast } = useAppStore();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-indigo-500 flex-shrink-0" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-black/[0.08] dark:border-white/[0.08] shadow-lg shadow-black/5 dark:shadow-black/40 backdrop-blur-md text-xs font-medium text-slate-800 dark:text-slate-200">
        {icons[toast.type]}
        <span>{toast.message}</span>
        <button
          onClick={hideToast}
          className="ml-2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
