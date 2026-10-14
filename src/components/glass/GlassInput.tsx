import React from "react";
import { cn } from "../../lib/utils";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, icon, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <div className="absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-xl bg-white/70 dark:bg-slate-900/70 border border-black/[0.08] dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs px-3.5 py-2.5 transition-all focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 backdrop-blur-sm",
            icon && "pl-10",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

GlassInput.displayName = "GlassInput";
