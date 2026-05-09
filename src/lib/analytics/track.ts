/**
 * Single emit point for client-side analytics.
 *
 * Today this is a no-op-friendly stub. Once the backend is live it will:
 *   1. Forward to Vercel Analytics via `window.va?.track(...)`.
 *   2. Debounce + POST to a server action that inserts into `user_actions`
 *      under the current `auth.uid()`.
 *
 * Keeping the call sites symbolic now means we don't have to chase down
 * every UI surface later.
 */

import { track as vercelTrack } from '@vercel/analytics';

import type { AnalyticsEventMap, AnalyticsEventName } from '@/lib/analytics/events';

export function track<E extends AnalyticsEventName>(
  name: E,
  payload: AnalyticsEventMap[E],
): void {
  if (typeof window === 'undefined') return;

  try {
    vercelTrack(name, payload as Record<string, string | number | boolean | null>);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[track] vercel analytics emit failed', error);
    }
  }

  // TODO(phase 2): debounced POST to /api/analytics/track for `user_actions`
  // table. Currently a no-op so the call sites compile + future-proof the API.
}
