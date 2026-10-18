import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { WindowControls } from "./WindowControls";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { FooterBar } from "./FooterBar";
import { Toast } from "../ui/Toast";
import { ErrorBoundary } from "../ui/ErrorBoundary";

export const AppShell: React.FC = () => {
  const location = useLocation();

  return (
    <div className="relative flex flex-col h-screen w-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors duration-300">
      {/* Ambient background glow orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-600/15 dark:via-purple-600/10 dark:to-transparent blur-3xl pointer-events-none select-none -z-0" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-tl from-sky-400/10 via-indigo-500/5 to-transparent dark:from-blue-600/15 dark:via-indigo-600/10 dark:to-transparent blur-3xl pointer-events-none select-none -z-0" />

      {/* Custom Title Bar */}
      <WindowControls />

      {/* Main App Workspace */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Compact Glass Sidebar */}
        <Sidebar />

        {/* Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />

          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="max-w-5xl mx-auto h-full"
              >
                <ErrorBoundary fallbackTitle="View Error">
                  <Outlet />
                </ErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Bottom Status / Footer Bar */}
      <FooterBar />

      {/* Notification Toast */}
      <Toast />
    </div>
  );
};
