'use client';

import { TopBar, ToastHost } from '@/components/jobtracker/JobTrackerApp';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <TopBar />
      {children}
      <ToastHost />
    </div>
  );
}
