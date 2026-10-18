import React, { useEffect } from "react";
import { Command, Keyboard, X } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: "Navigation & View",
      items: [
        { keys: ["Ctrl", "N"], description: "New Media Ingestion / Focus URL" },
        { keys: ["Ctrl", "B"], description: "Toggle Collapsible Sidebar Rail" },
        { keys: ["Ctrl", "1"], description: "Navigate to Dashboard" },
        { keys: ["Ctrl", "2"], description: "Navigate to Active Downloads" },
        { keys: ["Ctrl", "3"], description: "Navigate to Download Queue" },
        { keys: ["Ctrl", "4"], description: "Navigate to Media Library History" },
        { keys: ["Ctrl", ","], description: "Open Application Settings" },
      ],
    },
    {
      category: "Global Actions",
      items: [
        { keys: ["Ctrl", "V"], description: "Paste Media Link from Clipboard" },
        { keys: ["Esc"], description: "Close Active Modal / Clear Selection" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-500" />

        {/* Header */}
        <div className="p-5 pb-3 flex items-start justify-between border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Command className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Power-user shortcuts for quick navigation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {shortcuts.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                {group.category}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]"
                  >
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-black/[0.1] dark:border-white/[0.1] shadow-xs text-[10px] font-mono font-semibold text-slate-800 dark:text-slate-200"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
