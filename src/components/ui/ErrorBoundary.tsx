import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard, ChevronDown, ChevronUp } from "lucide-react";
import { GlassCard } from "../glass/GlassCard";
import { GlassButton } from "../glass/GlassButton";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleGoHome = () => {
    this.handleReset();
    window.location.hash = "#/";
    window.location.pathname = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full py-8 px-4 flex items-center justify-center">
          <GlassCard className="max-w-xl w-full p-6 space-y-4 border-rose-500/30 shadow-2xl bg-white/85 dark:bg-slate-900/85">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {this.props.fallbackTitle || "Something went wrong in this view"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vortex caught an interface exception and prevented a crash.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="p-3 rounded-xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 text-xs font-mono text-rose-600 dark:text-rose-400 break-words">
              {this.state.error?.message || "Unknown rendering exception"}
            </div>

            {/* Stack trace toggle */}
            {this.state.errorInfo && (
              <div>
                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Hide Technical Details</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Show Technical Details</span>
                    </>
                  )}
                </button>

                {this.state.showDetails && (
                  <pre className="mt-2 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto max-h-48">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Recovery actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={this.handleGoHome}
                className="gap-1.5"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </GlassButton>

              <GlassButton
                variant="primary"
                size="sm"
                onClick={this.handleReset}
                className="gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload View</span>
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}
