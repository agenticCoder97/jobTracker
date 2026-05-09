/**
 * Generic HTTP client used by every provider module.
 *
 * Responsibilities:
 *   - Retry on transient failures (429/5xx) with exponential backoff.
 *   - Surface a `ProviderCallReport` so the caller can persist it to
 *     `api_call_log`.
 *   - Honour an AbortSignal so cron runs can bail cleanly if the function
 *     budget is about to expire.
 *
 * Server-only — never import from a Client Component.
 */

import 'server-only';

import type { ProviderCallReport, ProviderId } from '@/lib/api/types';

export type FetchProviderOptions = {
  providerId: ProviderId;
  url: string;
  init?: RequestInit;
  signal?: AbortSignal;
  /** Header that exposes the rate-limit remaining count (provider-specific). */
  rateLimitHeader?: string;
  retries?: number;
  ownerUserId?: string;
};

export type FetchProviderResult<T> = {
  data: T | null;
  report: ProviderCallReport;
};

const DEFAULT_RETRIES = 2;
const RETRY_BASE_MS = 250;

export async function fetchProvider<T>(
  options: FetchProviderOptions,
): Promise<FetchProviderResult<T>> {
  const { providerId, url, init, signal, rateLimitHeader, retries = DEFAULT_RETRIES } = options;

  let attempt = 0;
  let lastErr: string | undefined;

  while (attempt <= retries) {
    const startedAt = Date.now();
    try {
      const response = await fetch(url, {
        ...init,
        ...(signal ? { signal } : {}),
      });
      const latencyMs = Date.now() - startedAt;
      const rateLimitRemaining = rateLimitHeader
        ? Number(response.headers.get(rateLimitHeader) ?? NaN)
        : undefined;

      if (response.ok) {
        const data = (await response.json()) as T;
        return {
          data,
          report: {
            providerId,
            requestPath: stripBase(url),
            httpStatus: response.status,
            latencyMs,
            ...(Number.isFinite(rateLimitRemaining)
              ? { rateLimitRemaining: rateLimitRemaining as number }
              : {}),
            ...(options.ownerUserId ? { ownerUserId: options.ownerUserId } : {}),
          },
        };
      }

      // Retryable conditions
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        lastErr = `${response.status} ${response.statusText}`;
        await sleep(RETRY_BASE_MS * 2 ** attempt);
        attempt += 1;
        continue;
      }

      // Non-retryable error
      const body = await response.text().catch(() => '');
      return {
        data: null,
        report: {
          providerId,
          requestPath: stripBase(url),
          httpStatus: response.status,
          latencyMs,
          ...(options.ownerUserId ? { ownerUserId: options.ownerUserId } : {}),
          error: truncate(`${response.status} ${response.statusText} ${body}`, 500),
        },
      };
    } catch (error) {
      lastErr = error instanceof Error ? error.message : String(error);
      if (signal?.aborted) {
        return {
          data: null,
          report: {
            providerId,
            requestPath: stripBase(url),
            httpStatus: 0,
            latencyMs: 0,
            ...(options.ownerUserId ? { ownerUserId: options.ownerUserId } : {}),
            error: 'aborted',
          },
        };
      }
      await sleep(RETRY_BASE_MS * 2 ** attempt);
      attempt += 1;
    }
  }

  return {
    data: null,
    report: {
      providerId,
      requestPath: stripBase(url),
      httpStatus: 0,
      latencyMs: 0,
      ...(options.ownerUserId ? { ownerUserId: options.ownerUserId } : {}),
      error: truncate(`exhausted retries: ${lastErr ?? 'unknown'}`, 500),
    },
  };
}

function stripBase(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
