import React from "react";
import { UrlInput } from "../components/dashboard/UrlInput";
import { QuickStats } from "../components/dashboard/QuickStats";
import { RecentDownloads } from "../components/dashboard/RecentDownloads";
import { MobileHome } from "../components/mobile/MobileHome";
import { useMobile } from "../hooks/useMobile";

export const Dashboard: React.FC = () => {
  const isMobile = useMobile();

  if (isMobile) {
    return <MobileHome />;
  }

  return (
    <div className="space-y-6 pb-6">
      <UrlInput />
      <QuickStats />
      <RecentDownloads />
    </div>
  );
};
