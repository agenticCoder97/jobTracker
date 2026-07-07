import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { seedAll } from '@/lib/data/seed';
import { queuePersist, __resetSyncForTests } from '@/lib/store/apps-sync';
import { useAppsStore } from '@/lib/store/apps-store';

describe('apps-sync queuePersist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const seed = seedAll();
    useAppsStore.setState({
      applications: seed.applications,
      activity: seed.activity,
      appDocs: seed.appDocs,
      statusSortMode: seed.statusSortMode,
    });
    __resetSyncForTests();
    (fetch as ReturnType<typeof vi.fn>).mockClear();
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('debounces multiple calls for the same app into one PUT', async () => {
    const app = useAppsStore.getState().applications[0]!;
    queuePersist(app.id);
    queuePersist(app.id);
    queuePersist(app.id);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('/api/apps');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.bundles[0].application.id).toBe(app.id);
    expect(body.bundles[0].activity).toBeDefined();
  });

  test('retries once then toasts on failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 503 });
    const app = useAppsStore.getState().applications[0]!;
    queuePersist(app.id);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('no-ops when adapter is local', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    __resetSyncForTests();
    const app = useAppsStore.getState().applications[0]!;
    queuePersist(app.id);
    await vi.advanceTimersByTimeAsync(500);
    expect(fetch).not.toHaveBeenCalled();
  });
});
