import React, { useState } from "react";
import { AlertTriangle, Trash2, X, HardDrive } from "lucide-react";
import { MediaLibraryItem } from "../../types";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface DeleteFileConfirmModalProps {
  item: MediaLibraryItem | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export const DeleteFileConfirmModal: React.FC<DeleteFileConfirmModalProps> = ({
  item,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(item.id);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <GlassCard className="w-full max-w-lg overflow-hidden shadow-2xl border border-rose-500/20">
        {/* Header */}
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold">Confirm Permanent File Deletion</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Are you sure you want to delete this downloaded file permanently from your disk?
            This operation removes the actual media file from storage and cannot be undone.
          </p>

          {/* Full Target Path Display */}
          <div className="p-3 rounded-lg bg-rose-500/[0.06] border border-rose-500/20 space-y-1.5">
            <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Target File on Disk</span>
            </span>
            <p className="font-mono text-slate-800 dark:text-slate-200 break-all select-all font-medium">
              {item.outputPath || "No output path recorded"}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] space-y-1">
            <span className="text-[11px] text-slate-400">Media Title</span>
            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {item.title}
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-end gap-2">
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
          >
            <span>Cancel</span>
          </GlassButton>

          <GlassButton
            size="sm"
            variant="ghost"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? "Deleting..." : "Permanently Delete File"}</span>
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};
