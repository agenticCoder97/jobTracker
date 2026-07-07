'use client';

import { TopBar, ToastHost } from '@/components/jobtracker/JobTrackerApp';
import { NewApplicationDialog } from '@/components/jobtracker/NewApplicationDialog';
import { useHydration } from '@/lib/store/use-hydration';

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydration();

  return (
    <div className="app-shell">
      <TopBar />
      {hydrated ? children : null}
      <NewApplicationDialog />
      <ToastHost />
    </div>
  );
}
