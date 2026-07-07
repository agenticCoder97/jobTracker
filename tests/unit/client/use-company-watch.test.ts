import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('useCompanyWatch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('local mode toggles optimistically with no network call', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    vi.resetModules();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { useCompanyWatch } = await import('@/lib/client/use-company-watch');

    const { result } = renderHook(() => useCompanyWatch('acme', false));
    expect(result.current.watched).toBe(false);

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.watched).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('supabase mode posts the watch request and stays optimistic on success', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchSpy);
    const { useCompanyWatch } = await import('@/lib/client/use-company-watch');

    const { result } = renderHook(() => useCompanyWatch('acme', false));

    await act(async () => {
      await result.current.toggle();
    });

    expect(result.current.watched).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/companies/watch',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ companyKey: 'acme' }) }),
    );
  });

  test('supabase mode reverts the optimistic update when the request fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchSpy);
    const { useCompanyWatch } = await import('@/lib/client/use-company-watch');

    const { result } = renderHook(() => useCompanyWatch('acme', false));

    let succeeded = true;
    await act(async () => {
      succeeded = await result.current.toggle();
    });

    expect(succeeded).toBe(false);
    await waitFor(() => expect(result.current.watched).toBe(false));
  });
});
