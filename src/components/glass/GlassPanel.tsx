import React from "react";
import { cn } from "../../lib/utils";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-black/[0.06] dark:border-white/[0.06] p-6 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
