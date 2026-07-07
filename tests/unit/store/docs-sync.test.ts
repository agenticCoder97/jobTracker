import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('docs-sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  test('queuePersistDocuments PUTs the whole library once per burst', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { queuePersistDocuments } = await import('@/lib/store/docs-sync');
    queuePersistDocuments();
    queuePersistDocuments();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/documents');
    expect((init as RequestInit).method).toBe('PUT');
    const body = JSON.parse(String((init as RequestInit).body)) as {
      resumes: unknown[];
      coverLetters: unknown[];
    };
    expect(Array.isArray(body.resumes)).toBe(true);
    expect(Array.isArray(body.coverLetters)).toBe(true);
  });

  test('no-ops in local mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { queuePersistDocuments } = await import('@/lib/store/docs-sync');
    queuePersistDocuments();
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('hydrateDocumentsFromServer replaces the library', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    const server = { resumes: [{ id: 'r-9', name: 'Server CV' }], coverLetters: [] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(server), { status: 200 })),
    );
    vi.resetModules();
    const { hydrateDocumentsFromServer } = await import('@/lib/store/docs-sync');
    const { useProfileStore } = await import('@/lib/store/profile-store');
    const outcome = await hydrateDocumentsFromServer();
    expect(outcome).toBe('server');
    expect(useProfileStore.getState().resumes).toEqual([{ id: 'r-9', name: 'Server CV' }]);
  });
});
