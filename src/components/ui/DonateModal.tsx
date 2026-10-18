import React, { useEffect } from "react";
import {
  Heart,
  X,
  ExternalLink,
  Star,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "../../lib/utils";
import kofiIcon from "../../assets/sponsor/9148201.webp";
import paypalIcon from "../../assets/sponsor/paypal.webp";

export const SUPPORT_LINKS = [
  { 
    name: 'Ko-fi', 
    url: 'https://ko-fi.com/infinity86', 
    logo: (
      <img src={kofiIcon} alt="Ko-fi" className="w-[18px] h-[18px] object-contain flex-shrink-0 mr-0.5" />
    ), 
    colorClass: 'bg-[#ff5e5b] hover:bg-[#ff4c49] text-white shadow-lg shadow-rose-500/10 hover:shadow-rose-500/20' 
  },
  { 
    name: 'PayPal', 
    url: 'https://paypal.me/infinity86s?locale.x=en_GB&country.x=IN', 
    logo: (
      <img src={paypalIcon} alt="PayPal" className="w-[18px] h-[18px] object-contain flex-shrink-0 mr-0.5" />
    ), 
    colorClass: 'bg-[#0070ba] hover:bg-[#005ea6] text-white shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20' 
  },
  { 
    name: 'GitHub', 
    url: 'https://github.com/sponsors/sanjay-m6', 
    logo: (
      <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
      </svg>
    ), 
    colorClass: 'bg-[#24292f] hover:bg-[#1a1f24] text-white shadow-lg shadow-black/15 hover:shadow-black/25' 
  },
];

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
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

  const handleOpenLink = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white/95 dark:bg-[#0f172a]/95 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl backdrop-blur-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-indigo-500 to-purple-500" />

        {/* Header */}
        <div className="p-5 pb-4 flex items-start justify-between border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Heart className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>Support Vortex</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Open Source
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Keep the project ad-free, fast, and continuously maintained.
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

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Quick Support Channels */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Choose your preferred platform
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {SUPPORT_LINKS.map((link) => (
                <button
                  key={link.name}
                  onClick={() => handleOpenLink(link.url)}
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                    link.colorClass
                  )}
                >
                  {link.logo}
                  <span>{link.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Star on GitHub */}
          <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Star on GitHub
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Free and helps more people discover Vortex.
                </p>
              </div>
            </div>

            <button
              onClick={() => handleOpenLink("https://github.com/sanjay-m6/Vortex-ytdlp")}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-black/[0.08] dark:border-white/[0.08] shadow-xs hover:border-indigo-500/40 transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            >
              <span>Star</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-slate-500">
          <span>Thank you for using Vortex ❤️</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
