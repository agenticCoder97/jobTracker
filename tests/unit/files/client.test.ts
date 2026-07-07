import { afterEach, describe, expect, test, vi } from 'vitest';
import { storeFile } from '@/lib/files/client';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('storeFile', () => {
  test('local mode inlines small files as data urls', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    const file = new File(['hello world'], 'notes.pdf', { type: 'application/pdf' });
    const stored = await storeFile(file, 'attachment', 'app-1');
    expect(stored.dataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(stored.storagePath).toBeUndefined();
    expect(stored.kind).toBe('pdf');
    expect(stored.name).toBe('notes.pdf');
  });

  test('local mode rejects files over 2 MB', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.zip');
    await expect(storeFile(big, 'attachment')).rejects.toThrow(/2 MB/);
  });

  test('supabase mode posts to /api/files and returns the storage path', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ path: 'attachments/app-1/x-notes.pdf', name: 'notes.pdf', size: 11 }),
        {
          status: 200,
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['hello world'], 'notes.pdf', { type: 'application/pdf' });
    const stored = await storeFile(file, 'attachment', 'app-1');
    expect(stored.storagePath).toBe('attachments/app-1/x-notes.pdf');
    expect(stored.dataUrl).toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/files');
    expect((init as RequestInit).method).toBe('POST');
  });

  test('supabase mode surfaces server errors', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'file too large (max 10 MB)' }), { status: 400 }),
      ),
    );
    const file = new File(['x'], 'x.pdf');
    await expect(storeFile(file, 'attachment')).rejects.toThrow(/10 MB/);
  });
});
