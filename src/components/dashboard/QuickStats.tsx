import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ListOrdered, History, ArrowUpRight } from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { useDownloadStore } from "../../stores/downloadStore";

export const QuickStats: React.FC = () => {
  const navigate = useNavigate();
  const { activeCount, completedCount, tasks, init } = useDownloadStore();

  useEffect(() => {
    init();
  }, [init]);

  const queuedCount = Object.values(tasks).filter(
    (t) => t.state === "queued"
  ).length;

  const stats = [
    {
      title: "Downloads",
      count: activeCount,
      icon: Download,
      to: "/downloads",
      label: "Active media streams",
    },
    {
      title: "Queue",
      count: queuedCount,
      icon: ListOrdered,
      to: "/queue",
      label: "Waiting in queue",
    },
    {
      title: "Completed",
      count: completedCount,
      icon: History,
      to: "/history",
      label: "Finished downloads",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((item) => {
        const Icon = item.icon;
        return (
          <GlassCard
            key={item.title}
            interactive
            onClick={() => navigate(item.to)}
            className="p-4 flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {item.title}
                </span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:text-indigo-500 transition-opacity" />
            </div>

            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {item.count}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {item.label}
              </span>
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
};
