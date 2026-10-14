import React, { useState, useEffect, useRef } from "react";
import { Sparkles, AlertCircle, CheckCircle2, FileText, HelpCircle } from "lucide-react";
import { presetApi } from "../../lib/presetApi";
import { TEMPLATE_TOKENS, TemplateToken } from "../../types/presets";

interface FilenameTemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  sampleMetadata?: {
    title?: string;
    id?: string;
    uploader?: string;
    uploadDate?: string;
    playlistTitle?: string;
    playlistIndex?: number;
  };
  className?: string;
}

export const FilenameTemplateEditor: React.FC<FilenameTemplateEditorProps> = ({
  value,
  onChange,
  sampleMetadata,
  className = "",
}) => {
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showTokens, setShowTokens] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchPreview = async () => {
      if (!value.trim()) {
        setPreview("");
        setError("Template cannot be empty");
        return;
      }
      try {
        const result = await presetApi.previewFilenameTemplate(value, sampleMetadata);
        if (!isCancelled) {
          setPreview(result);
          setError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.toString() ?? "Invalid filename template");
          setPreview("");
        }
      }
    };

    const timer = setTimeout(fetchPreview, 150);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [value, sampleMetadata]);

  const insertToken = (token: TemplateToken) => {
    if (!inputRef.current) {
      onChange(value + token.token);
      return;
    }

    const start = inputRef.current.selectionStart ?? value.length;
    const end = inputRef.current.selectionEnd ?? value.length;
    const nextValue = value.substring(0, start) + token.token + value.substring(end);
    onChange(nextValue);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const cursorPosition = start + token.token.length;
        inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    }, 50);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Template Input Header */}
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span>Filename Template</span>
        </label>
        <button
          type="button"
          onClick={() => setShowTokens(!showTokens)}
          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle className="w-3 h-3" />
          <span>{showTokens ? "Hide Tags" : "Available Tags"}</span>
        </button>
      </div>

      {/* Main Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="%(title).150B [%(id)s].%(ext)s"
          className={`w-full rounded-xl bg-white/40 dark:bg-slate-950/40 border px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none transition-all ${
            error
              ? "border-rose-500/50 focus:border-rose-500"
              : "border-black/[0.08] dark:border-white/[0.08] focus:border-indigo-500/60"
          }`}
        />
        <div className="absolute right-3 top-2.5 flex items-center">
          {error ? (
            <AlertCircle className="w-4 h-4 text-rose-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
        </div>
      </div>

      {/* Token Picker Chips */}
      {showTokens && (
        <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] space-y-2 animate-in fade-in duration-200">
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Click any tag to insert it into the template:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_TOKENS.map((token) => (
              <button
                key={token.token}
                type="button"
                onClick={() => insertToken(token)}
                className="px-2 py-1 rounded-lg text-[10px] font-mono font-medium bg-white/70 dark:bg-slate-900/70 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-black/[0.06] dark:border-white/[0.06] hover:border-indigo-500/40 transition-all cursor-pointer shadow-2xs"
                title={`${token.label}: e.g. "${token.example}"`}
              >
                {token.token}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live Preview Box */}
      <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-500/20 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Sparkles className="w-3 h-3" />
          <span>Live Filename Preview</span>
        </div>
        {error ? (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        ) : (
          <p className="text-xs font-mono text-slate-800 dark:text-slate-200 break-all select-all font-medium">
            {preview || "No filename"}
          </p>
        )}
      </div>
    </div>
  );
};
