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
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { api } from "./lib/api";

export function App() {
  // Initialize theme listener (light / dark / system)
  useTheme();

  const initSettings = useSettingsStore((s) => s.init);
  const initDownloads = useDownloadStore((s) => s.init);
  const refreshEngine = useEngineStore((s) => s.refreshStatus);
  const engineStatus = useEngineStore((s) => s.status);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  useEffect(() => {
    initSettings();
    initDownloads();
    refreshEngine();

    // Reveal window smoothly after mounting to eliminate any white pop
    api.appShowWindow().catch(() => {});

    // Check if first-time user or if onboarding not completed
    const completed = localStorage.getItem("vortex_onboarding_completed");
    if (completed !== "true") {
      setOnboardingStep(1);
      setOnboardingOpen(true);
    }
  }, [initSettings, initDownloads, refreshEngine]);

  // If engine check completes and yt-dlp is missing, prompt onboarding step 2
  useEffect(() => {
    if (engineStatus && !engineStatus.ytdlp.available) {
      const completed = localStorage.getItem("vortex_onboarding_completed");
      if (completed !== "true") {
        setOnboardingStep(2);
        setOnboardingOpen(true);
      }
    }
  }, [engineStatus]);

  // Global listener for "open_onboarding" custom events
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const custom = e as CustomEvent<{ step?: number }>;
      setOnboardingStep(custom.detail?.step || 1);
      setOnboardingOpen(true);
    };

    window.addEventListener("open_onboarding", handleOpen);
    return () => window.removeEventListener("open_onboarding", handleOpen);
  }, []);

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
