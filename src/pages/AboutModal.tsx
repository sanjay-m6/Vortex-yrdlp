import React from "react";
import { Sparkles, ShieldCheck, Code2 } from "lucide-react";
import { SponsorBanner } from "../components/ui/SponsorBanner";

export const AboutModal: React.FC = () => {
  const techStack = [
    { name: "Tauri 2", role: "Desktop Runtime" },
    { name: "Rust", role: "Native Core Engine" },
    { name: "React 19", role: "UI Framework" },
    { name: "TypeScript", role: "Type Safety" },
    { name: "Vite 8", role: "Build Tooling" },
    { name: "Tailwind CSS", role: "Design System" },
    { name: "SQLite + SQLx", role: "Embedded Storage" },
    { name: "yt-dlp", role: "Media Extractor" },
    { name: "FFmpeg", role: "Transcoder & Muxer" },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="border-b border-slate-800/80 pb-4">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-sky-400" />
          <span>About Vortex</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Modern, lightweight, privacy-focused open source desktop media downloader
        </p>
      </div>

      <div className="rounded-2xl bg-slate-900/70 border border-slate-800 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <img
            src="/ytdlpicon.png"
            alt="Vortex Logo"
            className="w-14 h-14 rounded-2xl object-contain shadow-xl shadow-sky-500/20"
          />
          <div>
            <h3 className="text-lg font-bold text-white">Vortex Desktop</h3>
            <p className="text-xs text-slate-400">Version 1.2.0 (Production Release)</p>
            <p className="text-xs text-sky-400 font-medium mt-0.5">High Performance Media Ingestion</p>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-300">
          Vortex is built on top of the world-class <strong className="text-sky-400">yt-dlp</strong> engine and <strong className="text-indigo-400">FFmpeg</strong> multimedia framework, wrapped in a blazing-fast native Rust backend and an ultra-responsive React 19 interface using Tauri 2.
        </p>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-sky-400" />
            <span>Architecture & Technologies</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {techStack.map((tech) => (
              <div
                key={tech.name}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col"
              >
                <span className="text-xs font-bold text-slate-200">{tech.name}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{tech.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Authorized Content & Privacy Policy</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Vortex is designed strictly for downloading authorized online media, personal archival, and creative commons works. Users must comply with relevant copyright laws, terms of service, and access policies of the host platforms.
          </p>
        </div>

        <SponsorBanner />
      </div>
    </div>
  );
};
