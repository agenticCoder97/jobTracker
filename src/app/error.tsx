'use client';

import { useEffect } from 'react';
import { ErrorPanel } from '@/components/ui/ErrorPanel';
import { eventLog } from '@/lib/repositories';
import { resetDemoData } from '@/lib/store/reset-demo-data';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    eventLog.appendLog({
      level: 'error',
      message: error.message || 'Unhandled client error',
      ...(error.digest ? { context: { digest: error.digest } } : {}),
    });
  }, [error]);

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: 'var(--bg)' }}>
      <ErrorPanel
        title="Something broke"
        message="We hit an unexpected error rendering this view. Your local data is safe — the app will recover when you retry."
        onRetry={reset}
        onResetDemo={() => {
          resetDemoData();
          window.location.assign('/');
        }}
      />
    </div>
  );
}
