import React, { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { windowControls } from "../../lib/window";

export const WindowControls: React.FC = () => {
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    windowControls.isMaximized().then(setIsMax);
  }, []);

  const handleToggleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const max = await windowControls.toggleMaximize();
    setIsMax(max);
  };

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    windowControls.minimize();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    windowControls.close();
  };

  return (
    <div className="h-10 w-full flex items-center justify-between px-3 bg-white/40 dark:bg-slate-950/40 border-b border-black/[0.06] dark:border-white/[0.06] backdrop-blur-md select-none z-50 flex-shrink-0">
      {/* Left branding & middle draggable area */}
      <div
        data-tauri-drag-region
        className="flex-1 h-full flex items-center gap-2 pl-1 cursor-default"
      >
        <img
          src="/ytdlpicon.png"
          alt="Vortex Logo"
          className="w-5 h-5 rounded-lg object-contain shadow-sm shadow-indigo-600/30 pointer-events-none"
        />
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight pointer-events-none">
          Vortex
        </span>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 font-medium pointer-events-none">
          v1.2.0
        </span>
      </div>

      {/* Right window actions - explicitly non-draggable */}
      <div
        className="flex items-center gap-0.5 z-10"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={handleMinimize}
          title="Minimize"
          className="w-8 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5 pointer-events-none" />
        </button>

        <button
          type="button"
          onClick={handleToggleMaximize}
          title={isMax ? "Restore" : "Maximize"}
          className="w-8 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          {isMax ? (
            <Copy className="w-3 h-3 pointer-events-none" />
          ) : (
            <Square className="w-3 h-3 pointer-events-none" />
          )}
        </button>

        <button
          type="button"
          onClick={handleClose}
          title="Close"
          className="w-8 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-white dark:text-slate-400 hover:bg-red-500 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5 pointer-events-none" />
        </button>
      </div>
    </div>
  );
};
