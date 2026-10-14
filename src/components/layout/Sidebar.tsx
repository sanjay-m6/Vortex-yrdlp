import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Download,
  ListOrdered,
  History,
  Settings,
  Info,
  Sparkles,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const Sidebar: React.FC = () => {
  const mainNav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/downloads", label: "Downloads", icon: Download },
    { to: "/queue", label: "Queue", icon: ListOrdered },
    { to: "/history", label: "History", icon: History },
  ];

  const bottomNav = [
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/about", label: "About", icon: Info },
  ];

  return (
    <aside className="w-[230px] flex-shrink-0 flex flex-col justify-between h-full bg-white/60 dark:bg-slate-950/60 border-r border-black/[0.06] dark:border-white/[0.06] backdrop-blur-xl p-3 select-none">
      {/* Top Section */}
      <div className="space-y-4">
        {/* App Branding */}
        <div className="flex items-center gap-2.5 px-3 py-2">
          <img
            src="/ytdlpicon.png"
            alt="Vortex Logo"
            className="w-8 h-8 rounded-xl object-contain shadow-sm shadow-indigo-600/30"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                Vortex
              </h2>
              <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                v1.0.0
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Desktop Utility</span>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-500" />
                    )}
                    <Icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "")} />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="space-y-1 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 relative",
                  isActive
                    ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-500" />
                  )}
                  <Icon className={cn("w-4 h-4", isActive ? "text-indigo-600 dark:text-indigo-400" : "")} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </aside>
  );
};
