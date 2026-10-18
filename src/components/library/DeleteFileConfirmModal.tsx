import React, { useState } from "react";
import { AlertTriangle, Trash2, X, HardDrive, AlertCircle, Film, Music } from "lucide-react";
import { MediaLibraryItem } from "../../types";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface DeleteFileConfirmModalProps {
  item: MediaLibraryItem | null;
  onClose: () => void;
  onConfirm: (id: string, deleteFileOnDisk: boolean) => Promise<void>;
}

export const DeleteFileConfirmModal: React.FC<DeleteFileConfirmModalProps> = ({
  item,
  onClose,
  onConfirm,
}) => {
  const [deleteFromDisk, setDeleteFromDisk] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const hasRecordedPath = Boolean(item.outputPath && item.outputPath.trim().length > 0);
  const isFileAvailable = item.fileAvailability === "available" || (hasRecordedPath && item.status === "completed");

  const handleConfirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(item.id, hasRecordedPath && isFileAvailable ? deleteFromDisk : false);
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
            <Trash2 className="w-5 h-5 flex-shrink-0" />
            <h3 className="text-sm font-bold">
              {hasRecordedPath && isFileAvailable ? "Delete Video & Media File" : "Remove from Library"}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            {hasRecordedPath && isFileAvailable
              ? "Are you sure you want to delete this video? You can remove the downloaded file permanently from your disk, or keep the file and only remove the library entry."
              : "Are you sure you want to remove this video from your library history?"}
          </p>

          {/* Media Info Summary */}
          <div className="p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.05] flex items-start gap-3">
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-16 h-10 object-cover rounded bg-slate-200 dark:bg-slate-800 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-10 rounded bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-500 flex-shrink-0">
                {item.mediaType === "audio" ? <Music className="w-5 h-5" /> : <Film className="w-5 h-5" />}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Media Title</span>
              <p className="font-medium text-slate-900 dark:text-slate-100 text-xs line-clamp-2">
                {item.title}
              </p>
              <div className="flex items-center gap-2 pt-0.5 text-[10px] text-slate-500">
                <span className="font-mono uppercase font-bold">{item.formatLabel || item.mediaType}</span>
                {item.status !== "completed" && (
                  <span className={`px-1.5 py-0.5 rounded font-semibold uppercase ${
                    item.status === "failed" ? "bg-rose-500/10 text-rose-500" : "bg-slate-500/10 text-slate-400"
                  }`}>
                    {item.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Scenario A: File Recorded on Disk */}
          {hasRecordedPath && isFileAvailable ? (
            <div className="space-y-3">
              {/* Full Target Path Display */}
              <div className="p-3 rounded-lg bg-rose-500/[0.06] border border-rose-500/20 space-y-1.5">
                <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>Target File on Disk</span>
                </span>
                <p className="font-mono text-slate-800 dark:text-slate-200 break-all select-all font-medium text-[11px]">
                  {item.outputPath}
                </p>
              </div>

              {/* Disk Deletion Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors">
                <input
                  type="checkbox"
                  checked={deleteFromDisk}
                  onChange={(e) => setDeleteFromDisk(e.target.checked)}
                  disabled={isDeleting}
                  className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                    Also permanently delete media file from disk
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {deleteFromDisk
                      ? "The file will be removed from your disk and the entry removed from library."
                      : "The file will remain on your computer; only this library entry will be removed."}
                  </span>
                </div>
              </label>
            </div>
          ) : (
            /* Scenario B: No File on Disk or Failed / Cancelled / Missing */
            <div className="p-3 rounded-lg bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border border-amber-500/20 space-y-1">
              <span className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{item.status === "failed" ? "Download Interrupted / Failed" : "No File Saved on Disk"}</span>
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.status === "failed"
                  ? "This download was interrupted or did not complete, so no video file was saved to storage. Removing it will cleanly delete this record from your library."
                  : item.fileAvailability === "missing"
                  ? "The downloaded file was moved or already deleted from disk. Removing this will clear the record from your library."
                  : "No downloaded media file is associated with this record. Removing this will clear the entry from your library."}
              </p>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
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
            <span>
              {isDeleting
                ? "Deleting..."
                : hasRecordedPath && isFileAvailable && deleteFromDisk
                ? "Delete Video & File"
                : "Remove from Library"}
            </span>
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
};
