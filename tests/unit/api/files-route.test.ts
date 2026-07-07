import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as SupabaseEnv from '@/lib/supabase/env';

const uploadMock = vi.fn().mockResolvedValue({ error: null });
const signMock = vi
  .fn()
  .mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
const removeMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, bytes: unknown, opts: unknown) =>
          uploadMock(bucket, path, bytes, opts),
        createSignedUrl: (path: string, expires: number) => signMock(bucket, path, expires),
        remove: (paths: string[]) => removeMock(bucket, paths),
      }),
    },
  }),
}));

vi.mock('@/lib/supabase/env', async (importOriginal) => ({
  ...(await importOriginal<typeof SupabaseEnv>()),
  shouldUseSupabaseAdapter: () => true,
}));

import { DELETE, GET, POST } from '@/app/api/files/route';

function multipart(file: File, fields: Record<string, string>): Request {
  const form = new FormData();
  form.set('file', file);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return { formData: () => Promise.resolve(form) } as Request;
}

describe('/api/files', () => {
  beforeEach(() => {
    uploadMock.mockClear();
    signMock.mockClear();
    removeMock.mockClear();
  });

  test('POST uploads an attachment under the application prefix', async () => {
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    const response = await POST(multipart(file, { scope: 'attachment', applicationId: 'app-1' }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { path: string; name: string; size: number };
    expect(body.path).toMatch(/^attachments\/app-1\/[0-9a-f-]{36}-notes\.pdf$/);
    expect(body.name).toBe('notes.pdf');
    expect(uploadMock).toHaveBeenCalledWith('jobtracker-files', body.path, expect.anything(), {
      contentType: 'application/pdf',
      upsert: false,
    });
  });

  test('POST uploads a resume under documents/resumes', async () => {
    const file = new File(['cv'], 'My Resume.pdf', { type: 'application/pdf' });
    const response = await POST(multipart(file, { scope: 'resume' }));
    const body = (await response.json()) as { path: string };
    expect(body.path).toMatch(/^documents\/resumes\/[0-9a-f-]{36}-My_Resume\.pdf$/);
  });

  test('POST rejects missing file or bad scope', async () => {
    const form = new FormData();
    form.set('scope', 'attachment');
    const response = await POST(new Request('http://test/api/files', { method: 'POST', body: form }));
    expect(response.status).toBe(400);
  });

  test('POST rejects oversized files', async () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.zip');
    const response = await POST(multipart(big, { scope: 'attachment' }));
    expect(response.status).toBe(400);
  });

  test('GET returns a signed url for a valid path', async () => {
    const response = await GET(
      new Request('http://test/api/files?path=attachments%2Fapp-1%2Fx.pdf'),
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { url: string }).url).toBe('https://signed.example/x');
  });

  test('GET rejects traversal and foreign prefixes', async () => {
    for (const bad of ['../secret', 'other/x.pdf', 'attachments/../x']) {
      const response = await GET(
        new Request(`http://test/api/files?path=${encodeURIComponent(bad)}`),
      );
      expect(response.status).toBe(400);
    }
  });

  test('DELETE removes the object', async () => {
    const response = await DELETE(
      new Request('http://test/api/files?path=documents%2Fresumes%2Fx.pdf', { method: 'DELETE' }),
    );
    expect(response.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith('jobtracker-files', ['documents/resumes/x.pdf']);
  });
});
