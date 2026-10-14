import React, { useState } from "react";
import {
  ExternalLink,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  FileCode,
} from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";
import { useEngineStatus } from "../../hooks/useEngineStatus";
import { useAppStore } from "../../stores/appStore";
import { engineApi } from "../../lib/engine";

interface EngineSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EngineSetupDialog: React.FC<EngineSetupDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { status, pickAndSetPath } = useEngineStatus();
  const { showToast } = useAppStore();
  const [manualPath, setManualPath] = useState("");
  const [validating, setValidating] = useState(false);

  if (!isOpen) return null;

  const handleSelectFile = async () => {
    const res = await pickAndSetPath("ytdlp");
    if (res.success) {
      showToast("yt-dlp executable configured successfully!", "success");
      onClose();
    } else if (!res.cancelled) {
      showToast(res.error || "Selected file failed validation", "error");
    }
  };

  const handleValidateManual = async () => {
    if (!manualPath.trim()) return;
    setValidating(true);
    try {
      const res = await engineApi.validateToolPath("ytdlp", manualPath.trim());
      if (res.valid) {
        await engineApi.setToolPath("ytdlp", manualPath.trim());
        showToast(`yt-dlp v${res.version || "valid"} configured!`, "success");
        onClose();
      } else {
        showToast(res.error || "Path does not point to a working yt-dlp executable", "error");
      }
    } catch (e) {
      showToast(String(e), "error");
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <GlassCard className="w-full max-w-lg p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              yt-dlp Engine Setup Guide
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <p>
            Vortex requires the open-source <strong className="text-indigo-500">yt-dlp</strong> CLI executable to process media URLs. You can obtain it officially:
          </p>

          {/* Option 1 */}
          <div className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] space-y-2">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>Option 1: Official GitHub Release</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </h4>
            <p className="text-[11px] text-slate-500">
              Download the official <code className="font-mono bg-black/[0.04] dark:bg-white/[0.08] px-1 py-0.5 rounded">yt-dlp.exe</code> binary from GitHub:
            </p>
            <a
              href="https://github.com/yt-dlp/yt-dlp/releases/latest"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              <span>Visit yt-dlp Releases Page</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Option 2 */}
          <div className="p-3.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] space-y-2">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              Option 2: Place in Managed Tools Directory
            </h4>
            <p className="text-[11px] text-slate-500">
              Place the downloaded executable directly in the application tools directory:
            </p>
            <div className="p-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.05] font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all select-all">
              {status?.managedToolsDir || "bin/"}
            </div>
          </div>

          {/* Option 3 */}
          <div className="space-y-2 pt-1">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">
              Option 3: Select File On Your System
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste full path to yt-dlp executable..."
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                className="flex-1 rounded-xl bg-white/50 dark:bg-slate-950/50 border border-black/[0.08] dark:border-white/[0.08] px-3 py-2 text-xs font-mono"
              />
              <GlassButton
                size="sm"
                onClick={handleValidateManual}
                disabled={validating || !manualPath.trim()}
              >
                <span>Apply</span>
              </GlassButton>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
          <GlassButton size="sm" onClick={handleSelectFile} variant="primary">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse Executable...</span>
          </GlassButton>

          <GlassButton size="sm" onClick={onClose}>
            <span>Done</span>
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};
