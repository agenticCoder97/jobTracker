'use client';

import { type ReactNode } from 'react';
import { useUiStore } from '@/lib/store/ui-store';

export function DemoOnly({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const pushToast = useUiStore((state) => state.pushToast);
  return (
    <button
      className={className ?? 'card-cta'}
      data-demo-only="true"
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        pushToast({ kind: 'info', message: `${label} is demo-only in v1` });
      }}
    >
      {children}
    </button>
  );
}
