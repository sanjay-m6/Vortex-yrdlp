import { useEffect } from "react";
import { useEngineStore } from "../stores/engineStore";

export const useEngineStatus = () => {
  const {
    status,
    overallState,
    isLoading,
    error,
    diagnostics,
    lastUpdated,
    refreshStatus,
    validateAndSetPath,
    pickAndSetPath,
    loadDiagnostics,
  } = useEngineStore();

  useEffect(() => {
    if (!status && !isLoading) {
      refreshStatus(false);
    }
  }, [status, isLoading, refreshStatus]);

  return {
    status,
    overallState,
    isLoading,
    error,
    diagnostics,
    lastUpdated,
    isReady: overallState === "ready",
    isMissing: overallState === "missing",
    isError: overallState === "error",
    isChecking: overallState === "checking" || isLoading,
    refreshStatus,
    validateAndSetPath,
    pickAndSetPath,
    loadDiagnostics,
  };
};
