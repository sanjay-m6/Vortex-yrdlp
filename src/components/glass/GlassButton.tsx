import React from "react";
import { cn } from "../../lib/utils";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  className,
  variant = "secondary",
  size = "md",
  disabled,
  type = "button",
  ...props
}) => {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs rounded-xl",
    md: "px-4 py-2 text-xs font-semibold rounded-xl",
    lg: "px-6 py-2.5 text-sm font-semibold rounded-2xl",
  };

  const variantClasses = {
    primary:
      "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 border border-indigo-500/50 active:scale-[0.98]",
    secondary:
      "bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-black/[0.08] dark:border-white/[0.08] shadow-sm active:scale-[0.98]",
    ghost:
      "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 active:scale-[0.98]",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
