'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { useUiStore } from '@/lib/store/ui-store';

const TOOLTIP_TEXT = 'Demo only — coming in a future release.';

export function DemoOnly({
  label,
  children,
  className,
  asChild = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /**
   * When true, intercepts the single child's onClick instead of wrapping in
   * an extra <span>. Use for arbitrary children (links, icon-buttons) where
   * an outer wrapper would break layout or produce invalid HTML.
   */
  asChild?: boolean;
}) {
  const pushToast = useUiStore((state) => state.pushToast);

  type DemoEventLike = { preventDefault: () => void; stopPropagation: () => void };
  function fire(event: DemoEventLike) {
    event.preventDefault();
    event.stopPropagation();
    pushToast({ kind: 'info', message: `Demo only — '${label}' isn't wired up yet.` });
  }

  type ChildProps = { onClick?: (event: DemoEventLike) => void; 'data-demo-only'?: string };

  let trigger: ReactNode;
  if (asChild) {
    const child = Children.only(children);
    if (isValidElement<ChildProps>(child)) {
      trigger = cloneElement(child as ReactElement<ChildProps>, {
        onClick: fire,
        'data-demo-only': 'true',
      });
    } else {
      trigger = child;
    }
  } else {
    trigger = (
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        className={className ?? 'card-cta'}
        data-demo-only="true"
        onClick={fire}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fire(event);
          }
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="demo-tooltip" sideOffset={6}>
            {TOOLTIP_TEXT}
            <Tooltip.Arrow className="demo-tooltip__arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
