import React, { useState } from "react";
import { Link2, X, FolderOpen, AlertTriangle } from "lucide-react";
import { MediaLibraryItem } from "../../types";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface RelinkModalProps {
  item: MediaLibraryItem | null;
  onClose: () => void;
  onRelink: (id: string, newPath: string) => Promise<void>;
}

export const RelinkModal: React.FC<RelinkModalProps> = ({
  item,
  onClose,
  onRelink,
}) => {
  const [newPath, setNewPath] = useState(item?.outputPath || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPath.trim()) {
      setError("Please specify a valid destination file path.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onRelink(item.id, newPath.trim());
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <GlassCard className="w-full max-w-lg overflow-hidden shadow-2xl border border-amber-500/20">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Link2 className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-sm font-bold">Relink Moved File</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              The recorded file for <strong className="text-slate-900 dark:text-slate-100">{item.title}</strong> could not be located at its recorded path. Please enter or paste the new file path on your computer.
            </p>

            {/* Previously recorded missing path */}
            <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20 space-y-1">
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Original Recorded Location (Missing)
              </span>
              <p className="font-mono text-slate-700 dark:text-slate-300 break-all select-all">
                {item.outputPath || "No location recorded"}
              </p>
            </div>

            {/* New Path Input */}
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                New Target File Path
              </label>
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="C:/Users/Downloads/my_video.mp4"
                className="w-full px-3 py-2 text-xs rounded-lg bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.08] dark:border-white/[0.1] focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 dark:text-slate-100 font-mono"
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-end gap-2">
            <GlassButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <span>Cancel</span>
            </GlassButton>

            <GlassButton
              type="submit"
              size="sm"
              variant="ghost"
              disabled={isSubmitting || !newPath.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Validating..." : "Validate & Relink"}</span>
            </GlassButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};
