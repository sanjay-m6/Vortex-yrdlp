import React from "react";
import { cn } from "../../lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  interactive = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.08] shadow-sm",
        interactive && "glass-card-interactive cursor-pointer hover:shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
