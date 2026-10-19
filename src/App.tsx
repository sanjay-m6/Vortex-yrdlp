import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Downloads } from "./pages/Downloads";
import { Queue } from "./pages/Queue";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";
import { About } from "./pages/About";
import { useTheme } from "./hooks/useTheme";
import { useSettingsStore } from "./stores/settingsStore";
import { useDownloadStore } from "./stores/downloadStore";
import { useEngineStore } from "./stores/engineStore";
import { useAppStore } from "./stores/appStore";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { api } from "./lib/api";

export function App() {
  // Initialize theme listener (light / dark / system)
  useTheme();

  const initSettings = useSettingsStore((s) => s.init);
  const initDownloads = useDownloadStore((s) => s.init);
  const refreshEngine = useEngineStore((s) => s.refreshStatus);
  const engineStatus = useEngineStore((s) => s.status);
  const showToast = useAppStore((s) => s.showToast);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  const hasInitializedRef = React.useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    initSettings();
    initDownloads();
    refreshEngine();

    // Reveal window smoothly after mounting to eliminate any white pop
    api.appShowWindow().catch(() => {});

    // Check single source of truth for setup status from backend SQLite
    const checkSetupStatus = async () => {
      try {
        const setupStatus = await api.getSetupStatus();
        const legacyCompleted = localStorage.getItem("vortex_onboarding_completed") === "true";

        if (legacyCompleted && setupStatus.requiresSetup) {
          // Sync legacy completion to backend SQLite
          await api.completeSetupWizard().catch(() => {});
        } else if (setupStatus.requiresSetup) {
          setOnboardingStep(setupStatus.setupStep || 1);
          setOnboardingOpen(true);
        }
      } catch (err) {
        console.warn("Failed to check backend setup status, falling back to local storage:", err);
        const completed = localStorage.getItem("vortex_onboarding_completed");
        if (completed !== "true") {
          setOnboardingStep(1);
          setOnboardingOpen(true);
        }
      }
    };

    checkSetupStatus();
  }, [initSettings, initDownloads, refreshEngine]);

  // Global listener for "open_onboarding" custom events (e.g. from Settings or Header)
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const custom = e as CustomEvent<{ step?: number }>;
      setOnboardingStep(custom.detail?.step || 1);
      setOnboardingOpen(true);
    };

    window.addEventListener("open_onboarding", handleOpen);
    return () => window.removeEventListener("open_onboarding", handleOpen);
  }, []);

  // Background update notification listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    api.onUpdateAvailableNotification((payload) => {
      showToast(
        `Vortex update v${payload.latestVersion} is available! Visit Settings / About to download and install.`,
        "info"
      );
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [showToast]);

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="downloads" element={<Downloads />} />
            <Route path="queue" element={<Queue />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
            <Route path="about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        initialStep={onboardingStep}
      />
    </>
  );
}

export default App;
