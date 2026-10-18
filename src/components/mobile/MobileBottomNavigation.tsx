import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Download, ListOrdered, Film, Settings } from "lucide-react";
import { motion } from "motion/react";
import { useDownloadStore } from "../../stores/downloadStore";
import { useQueueStore } from "../../stores/queueStore";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export const MobileBottomNavigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const activeCount = useDownloadStore((s) => s.activeCount);
  const queueSnapshot = useQueueStore((s) => s.snapshot);

  const queuedCount = (queueSnapshot?.items || []).filter(
    (item) => item.status === "queued"
  ).length;

  const navItems: NavItem[] = [
    {
      path: "/",
      label: "Home",
      icon: Home,
    },
    {
      path: "/downloads",
      label: "Downloads",
      icon: Download,
      badge: activeCount > 0 ? activeCount : undefined,
    },
    {
      path: "/queue",
      label: "Queue",
      icon: ListOrdered,
      badge: queuedCount > 0 ? queuedCount : undefined,
    },
    {
      path: "/history",
      label: "Library",
      icon: Film,
    },
    {
      path: "/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0B0F19]/90 border-t border-black/[0.08] dark:border-white/[0.08] backdrop-blur-2xl select-none transition-colors duration-200"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
      }}
    >
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] py-1 rounded-xl transition-all duration-200 active:scale-95 cursor-pointer ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
              }`}
            >
              {/* Active Pill Indicator */}
              {isActive && (
                <motion.div
                  layoutId="mobileNavPill"
                  className="absolute -top-[1px] w-8 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}

              {/* Icon Container with Badge */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive
                      ? "bg-indigo-500/10 dark:bg-indigo-500/20"
                      : "bg-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform duration-200" />
                </div>

                {/* Notification Badge */}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-[10px] font-bold text-white flex items-center justify-center shadow-xs animate-pulse">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] tracking-tight leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNavigation;
