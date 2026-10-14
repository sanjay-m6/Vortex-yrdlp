import React from "react";
import { UrlInput } from "../components/dashboard/UrlInput";
import { QuickStats } from "../components/dashboard/QuickStats";
import { RecentDownloads } from "../components/dashboard/RecentDownloads";

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6 pb-6">
      <UrlInput />
      <QuickStats />
      <RecentDownloads />
    </div>
  );
};
