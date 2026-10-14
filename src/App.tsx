import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Downloads } from "./pages/Downloads";
import { Queue } from "./pages/Queue";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";
import { About } from "./pages/About";
import { useTheme } from "./hooks/useTheme";

export function App() {
  // Initialize theme listener (light / dark / system)
  useTheme();

  return (
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
  );
}

export default App;
