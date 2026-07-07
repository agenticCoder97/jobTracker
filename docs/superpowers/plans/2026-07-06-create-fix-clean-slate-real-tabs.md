# Create Fix, Clean Slate, Real Tabs + Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the production "Create application" failure, ship a clean-slate deployed board (mock stays for local dev), make the Attachments/Linked/Activity/History card tabs real, and make resume/cover-letter upload real with Supabase sync and card linking.

**Architecture:** The adapter flag (`NEXT_PUBLIC_PERSISTENCE_ADAPTER`) now gates seed data as well as sync: supabase mode starts empty and treats the server as source of truth (first-run auto-import removed). Files live in a private Supabase Storage bucket `jobtracker-files` behind `/api/files` (service-role, signed URLs) in supabase mode, and as data URLs in localStorage in local mode. The document library write-throughs to the existing `resumes`/`cover_letters` tables via `/api/documents`, mirroring the board's `apps-sync` pattern.

**Tech Stack:** Next.js 15 App Router, Zustand 5 (persist), Supabase (`@supabase/supabase-js` service-role + Storage), Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-06-create-fix-clean-slate-real-tabs-design.md`

**Conventions for the executor:**
- Package manager is `pnpm`. Run commands from the repo root.
- `tsconfig` uses `exactOptionalPropertyTypes` — spread optional fields conditionally (`...(x !== undefined ? { x } : {})`) or type them `| undefined`.
- Prettier + ESLint run via husky/lint-staged on commit; if a commit fails on formatting, run `pnpm format` and retry.
- The `Icon` component renders Material Symbols by name string — any material symbol name (`upload`, `download`, `link`, `description`) works.
- Branch: `feature/create-fix-clean-slate-real-tabs` (already created off `Development`, spec committed).
- Supabase MCP tools (`mcp__supabase__*`) are available only in the root session — operational steps marked **(root session)** must run there, not in a subagent.

---

### Task 1: Reproduce and fix the production "Create application" bug

The e2e persistence smoke created a card through this exact dialog today in dev mode, so the failure is production-build-specific. **Do not write a fix before reproducing.** Use superpowers:systematic-debugging.

**Files:**
- Likely: `src/components/jobtracker/NewApplicationDialog.tsx` and/or `src/lib/store/apps-store.ts` (root cause unknown until reproduced)
- Test: regression test co-located with the root cause (component test in `tests/unit/components/`, store test in `tests/unit/store/`)

- [ ] **Step 1: Build and run a production server without the adapter (matches the current deploy)**

```bash
pnpm build
PORT=3105 pnpm start
```

(Ensure `.env.local`'s `NEXT_PUBLIC_PERSISTENCE_ADAPTER` is NOT `supabase` for this build — `next build` inlines it. Temporarily comment it out if needed, rebuild, restore afterwards.)

- [ ] **Step 2: Reproduce via browser automation**

Drive `http://localhost:3105` (webapp-testing skill / Playwright / preview tools):

1. Open `/`, wait for the board.
2. Click the top-bar button named `Create`.
3. Fill `#na-company` with `Repro Co`, `#na-role` with `Repro Engineer`.
4. Click the button named `Create application`.
5. Record: browser console errors, network activity, whether the dialog closes, whether a `Repro Co` card exists on the board, and the URL after submit.

Expected per the bug report: submit does nothing. Capture the exact console error — that is the root cause lead. Suspects to check if the console is silent: an exception inside `submit()` in `NewApplicationDialog.tsx` (Zod 4 `z.string().trim().url()` / `z.coerce.number()` behavior in the minified bundle), the `role="alert"` validation errors actually rendering (form silently invalid), or the `useUiStore` dialog state not mounting `NewApplicationDialog` in `AppShell`.

- [ ] **Step 3: Diagnose the root cause**

Read the error, trace to source, confirm by inspection. Do not fix symptoms. If the failure does NOT reproduce locally in a prod build, the deployed bundle is stale — verify the Vercel Production deployment commit matches `origin/Production` HEAD (`vercel ls`, `vercel inspect <url>`), and if so redeploy rather than patching code.

- [ ] **Step 4: Write a failing regression test that captures the root cause**

Whatever the cause, encode it. Example shape if it is a dialog/submit bug (adapt the assertion to the actual cause):

```tsx
// tests/unit/components/new-application-dialog.test.tsx — add to the existing describe
test('submit creates a card with only company and role filled', () => {
  render(<NewApplicationDialog />);
  fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Repro Co' } });
  fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'Repro Engineer' } });
  fireEvent.click(screen.getByRole('button', { name: /create application/i }));
  expect(
    useAppsStore.getState().applications.some((app) => app.companyName === 'Repro Co'),
  ).toBe(true);
});
```

Run: `pnpm test:unit -- tests/unit/components/new-application-dialog.test.tsx`
Expected: FAIL reproducing the bug (if the bug is prod-bundle-only, the regression test may need to pin the specific API misuse — e.g. schema parse output — rather than the render path; use judgment, but a test must exist).

- [ ] **Step 5: Fix minimally, verify test passes**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Re-verify in the production build**

```bash
pnpm build && PORT=3105 pnpm start
```

Repeat Step 2 — the card must appear on the board and the dialog must navigate to the new card. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "fix: create application submit in production build"
```

---

### Task 2: Unique UUIDs for new cards

`seedUuid(displayId)` hashes unknown labels by summing character codes — `JT-43` and `JT-52` collide to the same UUID, so a later card silently overwrites an earlier one (React keys, store lookups, and DB upserts on `id`). New cards must use `crypto.randomUUID()`. Seeded demo cards keep deterministic IDs (they come from `seedAll()`, untouched).

**Files:**
- Modify: `src/lib/store/apps-store.ts` (`createCard`, `addToWishlist`)
- Test: `tests/unit/store/unique-ids.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/store/unique-ids.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('new-card ids', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('createCard ids are random v4 uuids and never collide', () => {
    const ids = Array.from({ length: 30 }, (_, index) =>
      useAppsStore.getState().createCard({
        status: 'wishlist',
        companyName: `Co ${index}`,
        role: 'Engineer',
      }).id,
    );
    expect(new Set(ids).size).toBe(30);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });

  test('addToWishlist ids are random v4 uuids', () => {
    const app = useAppsStore.getState().addToWishlist({
      id: 'listing-1',
      company: 'anthropic',
      role: 'MTS',
      location: 'Remote',
      remote: 'Remote',
      salaryMin: 200,
      salaryMax: 300,
      posted: '2026-07-01',
      match: 90,
      tags: ['TS'],
    } as never);
    expect(app.id).toMatch(UUID_V4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/unique-ids.test.ts`
Expected: FAIL — ids match the `00000000-0000-0000-0000-…` seed pattern, not UUID v4.

- [ ] **Step 3: Implement**

In `src/lib/store/apps-store.ts`:

- In `createCard`, change `id: seedUuid(displayId),` → `id: crypto.randomUUID(),`
- In `addToWishlist`, change `id: seedUuid(displayId),` → `id: crypto.randomUUID(),`
- In both, change `ownerUserId: seed.applications[0]?.ownerUserId ?? '00000000-0000-0000-0000-000000000001',` → `ownerUserId: DEMO_USER_ID,` and add `DEMO_USER_ID` to the `@/lib/types` import.
- If `seedUuid` is now unused in the file, remove it from the `@/lib/data/seed` import.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS (if an existing test asserts the deterministic id shape, update it to assert by `displayId` instead).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/apps-store.ts tests/unit/store/unique-ids.test.ts
git commit -m "fix: random uuids for new cards (char-sum collisions)"
```

---

### Task 3: Seed gating, no first-run import, reset semantics

Supabase mode starts empty (board + document library); local mode keeps the full demo. The first-run auto-import and `/api/apps/import` are removed; the server is the source of truth on every hydration.

**Files:**
- Create: `src/lib/data/board-defaults.ts`
- Modify: `src/lib/store/apps-store.ts`
- Modify: `src/lib/store/apps-sync.ts`
- Modify: `src/lib/store/profile-store.ts`
- Delete: `src/app/api/apps/import/route.ts`
- Test: `tests/unit/store/seed-gating.test.ts`, updates to any existing sync tests

- [ ] **Step 1: Write the failing gating test**

Create `tests/unit/store/seed-gating.test.ts`:

```ts
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('seed gating by persistence adapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('local adapter seeds the demo board', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'local');
    vi.resetModules();
    const { useAppsStore } = await import('@/lib/store/apps-store');
    expect(useAppsStore.getState().applications.length).toBeGreaterThan(0);
  });

  test('supabase adapter starts the board empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const { useAppsStore } = await import('@/lib/store/apps-store');
    expect(useAppsStore.getState().applications).toEqual([]);
    expect(useAppsStore.getState().activity).toEqual({});
    expect(useAppsStore.getState().appDocs).toEqual({});
  });

  test('supabase adapter starts the document library empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const { useProfileStore } = await import('@/lib/store/profile-store');
    expect(useProfileStore.getState().resumes).toEqual([]);
    expect(useProfileStore.getState().coverLetters).toEqual([]);
  });

  test('supabase-mode reset stays empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.resetModules();
    const { useAppsStore } = await import('@/lib/store/apps-store');
    useAppsStore.getState().createCard({ status: 'applied', companyName: 'X', role: 'Y' });
    useAppsStore.getState().reset();
    expect(useAppsStore.getState().applications).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/seed-gating.test.ts`
Expected: FAIL — supabase-mode store still seeds demo data.

- [ ] **Step 3: Create `src/lib/data/board-defaults.ts`**

```ts
import type { SortMode } from '@/lib/data/seed';
import type { Activity, AppDocs, Application, StatusId, Uuid } from '@/lib/types';

export type BoardState = {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
  statusSortMode: Record<StatusId, SortMode>;
};

/** Matches the seed's default column sorting. */
export function defaultStatusSortMode(): Record<StatusId, SortMode> {
  return {
    wishlist: 'lastActivity',
    applied: 'lastActivity',
    screen: 'lastActivity',
    interview: 'lastActivity',
    offer: 'lastActivity',
    rejected: 'lastActivity',
  };
}

export function emptyBoardState(): BoardState {
  return { applications: [], activity: {}, appDocs: {}, statusSortMode: defaultStatusSortMode() };
}
```

- [ ] **Step 4: Gate the apps store**

In `src/lib/store/apps-store.ts`:

Add imports:

```ts
import { emptyBoardState, type BoardState } from '@/lib/data/board-defaults';
import { getPersistenceAdapter } from '@/lib/supabase/env';
```

Replace `const seed = seedAll();` with:

```ts
const seeded = getPersistenceAdapter() === 'local';

function freshBoard(): BoardState {
  if (!seeded) return emptyBoardState();
  const fresh = seedAll();
  return {
    applications: fresh.applications,
    activity: fresh.activity,
    appDocs: fresh.appDocs,
    statusSortMode: fresh.statusSortMode,
  };
}

const initialBoard = freshBoard();
```

In the store creator, replace the four initial-state lines with:

```ts
      applications: initialBoard.applications,
      activity: initialBoard.activity,
      appDocs: initialBoard.appDocs,
      statusSortMode: initialBoard.statusSortMode,
```

Replace the `reset` action body:

```ts
      reset: () => {
        set(freshBoard());
        recordAudit('demo', 'apps', 'reset');
        syncReset();
      },
```

(If Task 2 left no other `seed` usages, drop the unused `seedAll` destructuring leftovers; `seedAll` itself stays imported for `freshBoard`.)

- [ ] **Step 5: Gate the profile store's document library**

In `src/lib/store/profile-store.ts`:

Add import: `import { getPersistenceAdapter } from '@/lib/supabase/env';`

After `const seed = seedAll();` add:

```ts
const seeded = getPersistenceAdapter() === 'local';
```

Change initial state:

```ts
      resumes: seeded ? seed.resumes : [],
      coverLetters: seeded ? seed.coverLetters : [],
```

(`profile` stays seeded in both modes — it is not part of this round.)

In `reset`, change the two lines to:

```ts
          resumes: seeded ? fresh.resumes : [],
          coverLetters: seeded ? fresh.coverLetters : [],
```

- [ ] **Step 6: Remove the import path from sync**

In `src/lib/store/apps-sync.ts`:

Replace `hydrateFromServer` entirely (return type loses `'imported'`):

```ts
/**
 * Hydrate the store from the server. Returns 'server' when server data was
 * applied (the server is the source of truth, even when empty), 'offline'
 * when the request failed (local data kept as an offline cache).
 */
export async function hydrateFromServer(): Promise<'server' | 'offline'> {
  if (!syncEnabled()) return 'offline';
  const response = await fetch('/api/apps').catch(() => null);
  if (!response?.ok) return 'offline';
  const server = (await response.json()) as ServerAppsState;
  useAppsStore.setState({
    applications: server.applications as never,
    activity: server.activity as never,
    appDocs: server.appDocs as never,
  });
  return 'server';
}
```

Replace `resetServer` entirely:

```ts
/** Clear the server board (used by reset in supabase mode). */
export async function resetServer(): Promise<void> {
  if (!syncEnabled() || typeof window === 'undefined') return;
  await fetch('/api/apps', { method: 'DELETE' }).catch(() => null);
}
```

Delete the route:

```bash
git rm src/app/api/apps/import/route.ts
```

Then check for stale references:

```bash
grep -rn "apps/import" src tests
```

Expected: no hits (fix any that appear — e2e or unit tests asserting the old import behavior get updated to the new "server always replaces local" contract).

- [ ] **Step 7: Run all checks**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: PASS. Existing store tests run with the adapter unset (= local mode) and keep their seeded expectations.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: adapter-gated seed data, server-authoritative hydration, no first-run import"
```

---

### Task 4: Types + file-kind helpers

**Files:**
- Modify: `src/lib/types.ts` (`Attachment`, `Resume`, `CoverLetter`)
- Create: `src/lib/files/kind.ts`
- Test: `tests/unit/files/kind.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/files/kind.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { fileKindOf, formatBytes } from '@/lib/files/kind';

describe('fileKindOf', () => {
  test('maps common extensions', () => {
    expect(fileKindOf('resume.pdf')).toBe('pdf');
    expect(fileKindOf('archive.ZIP')).toBe('zip');
    expect(fileKindOf('sheet.xlsx')).toBe('xls');
    expect(fileKindOf('shot.PNG')).toBe('img');
    expect(fileKindOf('letter.docx')).toBe('doc');
    expect(fileKindOf('invite.ics')).toBe('ics');
  });
  test('falls back to file', () => {
    expect(fileKindOf('noext')).toBe('file');
    expect(fileKindOf('weird.xyz')).toBe('file');
  });
});

describe('formatBytes', () => {
  test('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/files/kind.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Extend the types**

In `src/lib/types.ts`, replace the `Attachment` type with:

```ts
export type AttachmentSource = 'upload' | 'resume' | 'cover-letter';
export type Attachment = {
  id: Uuid;
  name: string;
  kind: 'pdf' | 'zip' | 'xls' | 'img' | 'ics' | 'doc' | 'file';
  size: string;
  when: IsoDateTime;
  /** Supabase Storage object path (supabase adapter). */
  storagePath?: string;
  /** Inline data URL (local adapter, small files only). */
  dataUrl?: string;
  source?: AttachmentSource;
  /** Library document id when source is 'resume' | 'cover-letter'. */
  sourceDocId?: Uuid;
};
```

In `Resume` and `CoverLetter`, add after the `file: string;` line:

```ts
  storagePath?: string;
  dataUrl?: string;
```

- [ ] **Step 4: Implement `src/lib/files/kind.ts`**

```ts
import type { Attachment } from '@/lib/types';

const KIND_BY_EXT: Record<string, Attachment['kind']> = {
  pdf: 'pdf',
  zip: 'zip',
  xls: 'xls',
  xlsx: 'xls',
  csv: 'xls',
  png: 'img',
  jpg: 'img',
  jpeg: 'img',
  gif: 'img',
  webp: 'img',
  svg: 'img',
  ics: 'ics',
  doc: 'doc',
  docx: 'doc',
};

export function fileKindOf(fileName: string): Attachment['kind'] {
  const parts = fileName.toLowerCase().split('.');
  const ext = parts.length > 1 ? (parts.at(-1) ?? '') : '';
  return KIND_BY_EXT[ext] ?? 'file';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 5: Run tests, typecheck, commit**

Run: `pnpm test:unit -- tests/unit/files/kind.test.ts && pnpm typecheck`
Expected: PASS.

```bash
git add src/lib/types.ts src/lib/files/kind.ts tests/unit/files/kind.test.ts
git commit -m "feat: attachment/document storage fields + file kind helpers"
```

---

### Task 5: Storage bucket, files repository, /api/files route

**Files:**
- Create: `src/lib/repositories/supabase/files-repository.ts`
- Create: `src/app/api/files/route.ts`
- Test: `tests/unit/api/files-route.test.ts`

- [ ] **Step 1 (root session): Create the private bucket**

Call `mcp__supabase__execute_sql` with `project_id: "zpfvdswiaiqoptfsafpd"`:

```sql
insert into storage.buckets (id, name, public)
values ('jobtracker-files', 'jobtracker-files', false)
on conflict (id) do nothing;
```

Verify: `select id, public from storage.buckets;` shows `jobtracker-files` with `public = false`. (Service role bypasses storage RLS; no policies needed since the client never touches Storage directly.)

- [ ] **Step 2: Write the failing route test**

Create `tests/unit/api/files-route.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest';

const uploadMock = vi.fn().mockResolvedValue({ error: null });
const signMock = vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null });
const removeMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, bytes: unknown, opts: unknown) => uploadMock(bucket, path, bytes, opts),
        createSignedUrl: (path: string, expires: number) => signMock(bucket, path, expires),
        remove: (paths: string[]) => removeMock(bucket, paths),
      }),
    },
  }),
}));

vi.mock('@/lib/supabase/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/env')>()),
  shouldUseSupabaseAdapter: () => true,
}));

import { DELETE, GET, POST } from '@/app/api/files/route';

function multipart(file: File, fields: Record<string, string>): Request {
  const form = new FormData();
  form.set('file', file);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request('http://test/api/files', { method: 'POST', body: form });
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
    const response = await GET(new Request('http://test/api/files?path=attachments%2Fapp-1%2Fx.pdf'));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { url: string }).url).toBe('https://signed.example/x');
  });

  test('GET rejects traversal and foreign prefixes', async () => {
    for (const bad of ['../secret', 'other/x.pdf', 'attachments/../x']) {
      const response = await GET(new Request(`http://test/api/files?path=${encodeURIComponent(bad)}`));
      expect(response.status).toBe(400);
    }
  });

  test('DELETE removes the object', async () => {
    const response = await DELETE(new Request('http://test/api/files?path=documents%2Fresumes%2Fx.pdf', { method: 'DELETE' }));
    expect(response.status).toBe(200);
    expect(removeMock).toHaveBeenCalledWith('jobtracker-files', ['documents/resumes/x.pdf']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/api/files-route.test.ts`
Expected: FAIL — modules do not exist.

- [ ] **Step 4: Implement the repository**

Create `src/lib/repositories/supabase/files-repository.ts`:

```ts
/**
 * Server-only Supabase Storage access for uploaded files (card attachments,
 * resumes, cover letters). One private bucket; the client only ever sees
 * short-lived signed URLs minted here.
 */

import 'server-only';

import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const FILES_BUCKET = 'jobtracker-files';

export async function uploadStoredFile(
  path: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage
    .from(FILES_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`file upload failed: ${error.message}`);
}

export async function signedUrlFor(path: string, expiresInSeconds = 300): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(FILES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`signed url failed: ${error?.message ?? 'no url returned'}`);
  }
  return data.signedUrl;
}

export async function removeStoredFile(path: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.storage.from(FILES_BUCKET).remove([path]);
  if (error) throw new Error(`file remove failed: ${error.message}`);
}
```

- [ ] **Step 5: Implement the route**

Create `src/app/api/files/route.ts`:

```ts
import { NextResponse } from 'next/server';

import {
  removeStoredFile,
  signedUrlFor,
  uploadStoredFile,
} from '@/lib/repositories/supabase/files-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SCOPE_PREFIXES = {
  attachment: 'attachments',
  resume: 'documents/resumes',
  'cover-letter': 'documents/cover-letters',
} as const;
type Scope = keyof typeof SCOPE_PREFIXES;

function adapterDisabled() {
  return NextResponse.json(
    { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
    { status: 501 },
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100);
  return cleaned || 'file';
}

function isValidPath(path: string): boolean {
  return (
    (path.startsWith('attachments/') || path.startsWith('documents/')) && !path.includes('..')
  );
}

export async function POST(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const scope = form?.get('scope');
  const applicationId = form?.get('applicationId');
  if (!(file instanceof File) || typeof scope !== 'string' || !(scope in SCOPE_PREFIXES)) {
    return NextResponse.json({ error: 'invalid body: expected file and scope' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file too large (max 10 MB)' }, { status: 400 });
  }
  const prefix =
    scope === 'attachment' && typeof applicationId === 'string' && applicationId.length > 0
      ? `${SCOPE_PREFIXES.attachment}/${sanitizeName(applicationId)}`
      : SCOPE_PREFIXES[scope as Scope];
  const path = `${prefix}/${crypto.randomUUID()}-${sanitizeName(file.name)}`;
  try {
    await uploadStoredFile(path, await file.arrayBuffer(), file.type || 'application/octet-stream');
    return NextResponse.json({ path, name: file.name, size: file.size });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function GET(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const path = new URL(request.url).searchParams.get('path');
  if (!path || !isValidPath(path)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  try {
    return NextResponse.json({ url: await signedUrlFor(path) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const path = new URL(request.url).searchParams.get('path');
  if (!path || !isValidPath(path)) {
    return NextResponse.json({ error: 'invalid path' }, { status: 400 });
  }
  try {
    await removeStoredFile(path);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}
```

- [ ] **Step 6: Run tests, commit**

Run: `pnpm test:unit -- tests/unit/api/files-route.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/lib/repositories/supabase/files-repository.ts src/app/api/files/route.ts tests/unit/api/files-route.test.ts
git commit -m "feat: private storage bucket routes for file upload/download/delete"
```

---

### Task 6: Adapter-aware client file helper

**Files:**
- Create: `src/lib/files/client.ts`
- Test: `tests/unit/files/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/files/client.test.ts`:

```ts
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
      new Response(JSON.stringify({ path: 'attachments/app-1/x-notes.pdf', name: 'notes.pdf', size: 11 }), {
        status: 200,
      }),
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
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'file too large (max 10 MB)' }), { status: 400 })),
    );
    const file = new File(['x'], 'x.pdf');
    await expect(storeFile(file, 'attachment')).rejects.toThrow(/10 MB/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/files/client.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/files/client.ts`**

```ts
'use client';

/**
 * Adapter-aware client file handling. Supabase mode round-trips through
 * /api/files (private bucket + signed URLs); local/demo mode inlines small
 * files as data URLs so everything persists inside localStorage.
 */

import { fileKindOf, formatBytes } from '@/lib/files/kind';
import type { Attachment } from '@/lib/types';

const LOCAL_MAX_BYTES = 2 * 1024 * 1024;

export type StoredFile = {
  name: string;
  size: string;
  kind: Attachment['kind'];
  storagePath?: string;
  dataUrl?: string;
};

export type FileScope = 'attachment' | 'resume' | 'cover-letter';

function supabaseMode(): boolean {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
}

export async function storeFile(
  file: File,
  scope: FileScope,
  applicationId?: string,
): Promise<StoredFile> {
  const base = { name: file.name, size: formatBytes(file.size), kind: fileKindOf(file.name) };
  if (supabaseMode()) {
    const form = new FormData();
    form.set('file', file);
    form.set('scope', scope);
    if (applicationId) form.set('applicationId', applicationId);
    const response = await fetch('/api/files', { method: 'POST', body: form });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Upload failed (${response.status})`);
    }
    const { path } = (await response.json()) as { path: string };
    return { ...base, storagePath: path };
  }
  if (file.size > LOCAL_MAX_BYTES) {
    throw new Error('File is larger than 2 MB - demo mode stores files in the browser.');
  }
  return { ...base, dataUrl: await readAsDataUrl(file) };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/** Open a stored file in a new tab (signed URL or local blob). */
export async function openStoredFile(stored: {
  storagePath?: string;
  dataUrl?: string;
}): Promise<void> {
  if (stored.dataUrl) {
    const blob = await (await fetch(stored.dataUrl)).blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    return;
  }
  if (!stored.storagePath) throw new Error('No stored file for this item.');
  const response = await fetch(`/api/files?path=${encodeURIComponent(stored.storagePath)}`);
  if (!response.ok) throw new Error('Could not get a download link.');
  const { url } = (await response.json()) as { url: string };
  window.open(url, '_blank', 'noopener');
}

/** Best-effort server-side delete; local data URLs vanish with their record. */
export async function deleteStoredFile(stored: { storagePath?: string }): Promise<void> {
  if (!stored.storagePath || !supabaseMode()) return;
  await fetch(`/api/files?path=${encodeURIComponent(stored.storagePath)}`, {
    method: 'DELETE',
  }).catch(() => null);
}
```

- [ ] **Step 4: Run tests, commit**

Run: `pnpm test:unit -- tests/unit/files/client.test.ts && pnpm typecheck`
Expected: PASS.

```bash
git add src/lib/files/client.ts tests/unit/files/client.test.ts
git commit -m "feat: adapter-aware client file store/open/delete helper"
```

---

### Task 7: Store actions for attachments and links

**Files:**
- Modify: `src/lib/store/apps-store.ts`
- Test: `tests/unit/store/attachments-links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/store/attachments-links.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

function firstAppId(): string {
  return useAppsStore.getState().applications[0]!.id;
}

describe('attachments', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('addAttachment prepends metadata and records history', () => {
    const id = firstAppId();
    const attachment = useAppsStore.getState().addAttachment(id, {
      name: 'notes.pdf',
      kind: 'pdf',
      size: '11 B',
      source: 'upload',
      dataUrl: 'data:application/pdf;base64,aGVsbG8=',
    });
    const activity = useAppsStore.getState().activity[id]!;
    expect(activity.attachments[0]).toMatchObject({ id: attachment.id, name: 'notes.pdf' });
    expect(activity.history[0]).toMatchObject({ type: 'attach' });
    expect(activity.history[0]!.text).toContain('notes.pdf');
  });

  test('linked documents get a linking history message', () => {
    const id = firstAppId();
    useAppsStore.getState().addAttachment(id, {
      name: 'My Resume',
      kind: 'pdf',
      size: '120 KB',
      source: 'resume',
      sourceDocId: 'doc-1',
    });
    expect(useAppsStore.getState().activity[id]!.history[0]!.text).toBe('Resume linked: My Resume');
  });

  test('removeAttachment removes and records history', () => {
    const id = firstAppId();
    const attachment = useAppsStore.getState().addAttachment(id, {
      name: 'notes.pdf',
      kind: 'pdf',
      size: '11 B',
    });
    useAppsStore.getState().removeAttachment(id, attachment.id);
    const activity = useAppsStore.getState().activity[id]!;
    expect(activity.attachments.some((item) => item.id === attachment.id)).toBe(false);
    expect(activity.history[0]!.text).toBe('Attachment removed: notes.pdf');
  });
});

describe('links', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('addLink and removeLink round-trip with history', () => {
    const id = firstAppId();
    useAppsStore.getState().addLink(id, {
      type: 'link',
      title: 'Job posting',
      meta: 'https://example.com/job',
    });
    const added = useAppsStore.getState().activity[id]!.links[0]!;
    expect(added.title).toBe('Job posting');
    expect(useAppsStore.getState().activity[id]!.history[0]).toMatchObject({ type: 'link' });
    useAppsStore.getState().removeLink(id, added.id);
    expect(useAppsStore.getState().activity[id]!.links.some((l) => l.id === added.id)).toBe(false);
    expect(useAppsStore.getState().activity[id]!.history[0]!.text).toBe('Link removed: Job posting');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/attachments-links.test.ts`
Expected: FAIL — `addAttachment` is not a function.

- [ ] **Step 3: Implement**

In `src/lib/store/apps-store.ts`:

Add to the `@/lib/types` type import: `ApplicationLink`, `Attachment`.

Add to `AppsState`:

```ts
  addAttachment: (applicationId: Uuid, input: Omit<Attachment, 'id' | 'when'>) => Attachment;
  removeAttachment: (applicationId: Uuid, attachmentId: Uuid) => void;
  addLink: (applicationId: Uuid, input: Omit<ApplicationLink, 'id'>) => void;
  removeLink: (applicationId: Uuid, linkId: Uuid) => void;
```

Add to the store object (after `addComment`):

```ts
      addAttachment: (applicationId, input) => {
        const attachment: Attachment = {
          ...input,
          id: crypto.randomUUID(),
          when: new Date().toISOString(),
        };
        const text =
          input.source === 'resume'
            ? `Resume linked: ${input.name}`
            : input.source === 'cover-letter'
              ? `Cover letter linked: ${input.name}`
              : `Attachment added: ${input.name}`;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              attachments: [attachment, ...(state.activity[applicationId]?.attachments ?? [])],
              history: [
                historyEvent('attach', text),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'attachment_added', {
          name: input.name,
          source: input.source ?? 'upload',
        });
        sync(applicationId);
        return attachment;
      },
      removeAttachment: (applicationId, attachmentId) => {
        const target = get().activity[applicationId]?.attachments.find(
          (item) => item.id === attachmentId,
        );
        if (!target) return;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              attachments: (state.activity[applicationId]?.attachments ?? []).filter(
                (item) => item.id !== attachmentId,
              ),
              history: [
                historyEvent('attach', `Attachment removed: ${target.name}`),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'attachment_removed', { name: target.name });
        sync(applicationId);
      },
      addLink: (applicationId, input) => {
        const link: ApplicationLink = { ...input, id: crypto.randomUUID() };
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              links: [link, ...(state.activity[applicationId]?.links ?? [])],
              history: [
                historyEvent('link', `Link added: ${input.title}`),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'link_added', { title: input.title });
        sync(applicationId);
      },
      removeLink: (applicationId, linkId) => {
        const target = get().activity[applicationId]?.links.find((item) => item.id === linkId);
        if (!target) return;
        set((state) => ({
          activity: {
            ...state.activity,
            [applicationId]: {
              ...(state.activity[applicationId] ?? emptyActivity()),
              links: (state.activity[applicationId]?.links ?? []).filter(
                (item) => item.id !== linkId,
              ),
              history: [
                historyEvent('link', `Link removed: ${target.title}`),
                ...(state.activity[applicationId]?.history ?? []),
              ],
            },
          },
          applications: state.applications.map((app) =>
            app.id === applicationId ? bump(app) : app,
          ),
        }));
        recordAudit('application', applicationId, 'link_removed', { title: target.title });
        sync(applicationId);
      },
```

- [ ] **Step 4: Run tests, commit**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS.

```bash
git add src/lib/store/apps-store.ts tests/unit/store/attachments-links.test.ts
git commit -m "feat: attachment and link store actions with history events"
```

---

### Task 8: AttachmentsTab — upload, download, remove

**Files:**
- Modify: `src/components/jobtracker/JobTrackerApp.tsx` (`AttachmentsTab`)
- Modify: `src/app/globals.css` (drag-over style)
- Test: `tests/unit/components/attachments-tab.test.tsx`

- [ ] **Step 1: Write the failing component test**

The tab renders inside `CardDetailDialog`. Create `tests/unit/components/attachments-tab.test.tsx`:

```tsx
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';
import { useAppsStore } from '@/lib/store/apps-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

function openAttachmentsTab(displayId: string) {
  render(<CardDetailDialog displayId={displayId} />);
  fireEvent.click(screen.getByRole('button', { name: /attachments/i }));
}

describe('AttachmentsTab', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('uploads a file in local mode and lists it', async () => {
    const app = useAppsStore.getState().applications[0]!;
    openAttachmentsTab(app.displayId);
    const input = screen.getByLabelText(/upload attachment/i);
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(useAppsStore.getState().activity[app.id]?.attachments[0]?.name).toBe('notes.pdf'),
    );
    expect(await screen.findByText('notes.pdf')).toBeInTheDocument();
  });

  test('removes an attachment', async () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().addAttachment(app.id, { name: 'zap.pdf', kind: 'pdf', size: '1 KB' });
    openAttachmentsTab(app.displayId);
    fireEvent.click(screen.getByRole('button', { name: /remove zap\.pdf/i }));
    expect(
      useAppsStore.getState().activity[app.id]!.attachments.some((a) => a.name === 'zap.pdf'),
    ).toBe(false);
  });
});
```

(If `CardDetailDialog` needs more mocks to render — check how `tests/unit/components/new-application-dialog.test.tsx` sets up and mirror it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/components/attachments-tab.test.tsx`
Expected: FAIL — no upload input exists.

- [ ] **Step 3: Implement the tab**

In `src/components/jobtracker/JobTrackerApp.tsx`, add imports:

```ts
import { deleteStoredFile, openStoredFile, storeFile } from '@/lib/files/client';
```

(also add `useRef` to the react import if not present — it is already imported for `CardDetailDialog`.)

Add a small icon helper near `priorityMeta`:

```ts
function attachmentIcon(kind: Attachment['kind']): string {
  if (kind === 'zip') return 'folder_zip';
  if (kind === 'xls') return 'table';
  if (kind === 'img') return 'image';
  if (kind === 'ics') return 'event';
  return 'description';
}
```

(import the `Attachment` type from `@/lib/types`.)

Replace `AttachmentsTab` entirely:

```tsx
function AttachmentsTab({ application }: { application: Application }) {
  const activity = useAppsStore((state) => state.activity[application.id]);
  const addAttachment = useAppsStore((state) => state.addAttachment);
  const removeAttachment = useAppsStore((state) => state.removeAttachment);
  const pushToast = useUiStore((state) => state.pushToast);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachments = activity?.attachments ?? [];

  async function handleFiles(files: FileList | File[]) {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const stored = await storeFile(file, 'attachment', application.id);
        addAttachment(application.id, { ...stored, source: 'upload' });
        pushToast({ message: `${file.name} attached` });
      }
    } catch (error) {
      pushToast({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setBusy(false);
    }
  }

  function remove(attachment: Attachment) {
    removeAttachment(application.id, attachment.id);
    if (attachment.source === 'upload' || attachment.source === undefined) {
      void deleteStoredFile(attachment);
    }
    pushToast({
      message:
        attachment.source === 'resume' || attachment.source === 'cover-letter'
          ? 'Document unlinked'
          : 'Attachment removed',
    });
  }

  return (
    <>
      <div className="row-center" style={{ gap: 8, marginBottom: 12 }}>
        <input
          ref={inputRef}
          hidden
          multiple
          aria-label="Upload attachment"
          type="file"
          onChange={(event) => {
            if (event.target.files?.length) void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          className="astral-gold-btn"
          disabled={busy}
          type="button"
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="upload" size={14} /> {busy ? 'Uploading…' : 'Upload file'}
        </button>
        <button className="card-cta" type="button" onClick={() => setPickerOpen(true)}>
          <Icon name="link" size={14} /> Link document
        </button>
      </div>
      {pickerOpen ? (
        <LinkDocumentPicker application={application} onClose={() => setPickerOpen(false)} />
      ) : null}
      <div
        className={`attach-grid ${dragOver ? 'is-dragover' : ''}`}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
        }}
      >
        {attachments.length ? (
          attachments.map((attachment) => (
            <div key={attachment.id} className="attach-card">
              <Icon name={attachmentIcon(attachment.kind)} />{' '}
              <strong style={{ color: 'var(--white)' }}>{attachment.name}</strong>
              {attachment.source === 'resume' ? (
                <span className="chip is-tag">Resume</span>
              ) : attachment.source === 'cover-letter' ? (
                <span className="chip is-tag">Cover letter</span>
              ) : null}
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                {attachment.size} · {fmtDate(attachment.when)}
              </div>
              <div className="row-center" style={{ gap: 6, marginTop: 8 }}>
                {attachment.storagePath || attachment.dataUrl ? (
                  <button
                    className="card-cta"
                    type="button"
                    onClick={() =>
                      void openStoredFile(attachment).catch(() =>
                        pushToast({ kind: 'error', message: 'Could not open this attachment.' }),
                      )
                    }
                  >
                    Download
                  </button>
                ) : null}
                <button
                  aria-label={`Remove ${attachment.name}`}
                  className="card-cta"
                  type="button"
                  onClick={() => remove(attachment)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">No attachments yet - upload a file or drag one here.</div>
        )}
      </div>
    </>
  );
}
```

Add a placeholder `LinkDocumentPicker` so this task compiles (Task 12 fills it in):

```tsx
function LinkDocumentPicker({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  void application;
  return (
    <div className="empty-state" style={{ marginBottom: 12 }}>
      Document linking lands in a follow-up task.{' '}
      <button className="card-cta" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
```

Append to `src/app/globals.css`:

```css
.attach-grid.is-dragover {
  outline: 2px dashed var(--gold);
  outline-offset: 4px;
  border-radius: 8px;
}
```

- [ ] **Step 4: Run tests, verify visually, commit**

Run: `pnpm test:unit -- tests/unit/components/attachments-tab.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS. Then in `pnpm dev` (local mode): open a card → Attachments → upload a small PDF → row appears with Download/Remove; download opens it; remove clears it; History tab shows both events.

```bash
git add src/components/jobtracker/JobTrackerApp.tsx src/app/globals.css tests/unit/components/attachments-tab.test.tsx
git commit -m "feat: real attachments tab with upload, download, remove"
```

---

### Task 9: LinkedTab — add, open, remove links

**Files:**
- Modify: `src/components/jobtracker/JobTrackerApp.tsx` (`LinkedTab`)
- Test: `tests/unit/components/linked-tab.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `tests/unit/components/linked-tab.test.tsx`:

```tsx
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';
import { useAppsStore } from '@/lib/store/apps-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

function openLinkedTab(displayId: string) {
  render(<CardDetailDialog displayId={displayId} />);
  fireEvent.click(screen.getByRole('button', { name: /linked/i }));
}

describe('LinkedTab', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('adds a link', () => {
    const app = useAppsStore.getState().applications[0]!;
    openLinkedTab(app.displayId);
    fireEvent.change(screen.getByLabelText(/link title/i), { target: { value: 'Take-home' } });
    fireEvent.change(screen.getByLabelText(/link url/i), {
      target: { value: 'https://example.com/exercise' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    const links = useAppsStore.getState().activity[app.id]!.links;
    expect(links[0]).toMatchObject({ title: 'Take-home', meta: 'https://example.com/exercise' });
  });

  test('rejects an invalid url', () => {
    const app = useAppsStore.getState().applications[0]!;
    const before = useAppsStore.getState().activity[app.id]?.links.length ?? 0;
    openLinkedTab(app.displayId);
    fireEvent.change(screen.getByLabelText(/link title/i), { target: { value: 'Bad' } });
    fireEvent.change(screen.getByLabelText(/link url/i), { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    expect(useAppsStore.getState().activity[app.id]?.links.length ?? 0).toBe(before);
  });

  test('removes a link', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().addLink(app.id, {
      type: 'link',
      title: 'Old link',
      meta: 'https://example.com/old',
    });
    openLinkedTab(app.displayId);
    fireEvent.click(screen.getByRole('button', { name: /remove old link/i }));
    expect(
      useAppsStore.getState().activity[app.id]!.links.some((l) => l.title === 'Old link'),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/components/linked-tab.test.tsx`
Expected: FAIL — no link form exists.

- [ ] **Step 3: Implement**

Replace `LinkedTab` in `JobTrackerApp.tsx`:

```tsx
function LinkedTab({ application }: { application: Application }) {
  const activity = useAppsStore((state) => state.activity[application.id]);
  const addLink = useAppsStore((state) => state.addLink);
  const removeLink = useAppsStore((state) => state.removeLink);
  const pushToast = useUiStore((state) => state.pushToast);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const links = activity?.links ?? [];

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    if (!trimmedTitle || !/^https?:\/\/\S+$/.test(trimmedUrl)) {
      pushToast({ kind: 'error', message: 'Enter a title and a valid http(s) URL.' });
      return;
    }
    addLink(application.id, { type: 'link', title: trimmedTitle, meta: trimmedUrl });
    setTitle('');
    setUrl('');
  }

  return (
    <>
      <form className="row-center" style={{ gap: 8, marginBottom: 12 }} onSubmit={submit}>
        <input
          aria-label="Link title"
          placeholder="Title (e.g. Take-home exercise)"
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--white)',
            font: 'inherit',
            padding: '8px 10px',
          }}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          aria-label="Link URL"
          placeholder="https://…"
          style={{
            flex: 1,
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--white)',
            font: 'inherit',
            padding: '8px 10px',
          }}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button className="astral-gold-btn" type="submit">
          <Icon name="add_link" size={14} /> Add link
        </button>
      </form>
      <div className="linked-list">
        {links.length ? (
          links.map((link) => (
            <div key={link.id} className="linked-row">
              <span className="chip is-tag">{link.type}</span>{' '}
              {/^https?:\/\//.test(link.meta) ? (
                <a
                  href={link.meta}
                  rel="noreferrer noopener"
                  style={{ color: 'var(--white)', fontWeight: 600 }}
                  target="_blank"
                >
                  {link.title} <Icon name="open_in_new" size={11} />
                </a>
              ) : (
                <strong style={{ color: 'var(--white)' }}>{link.title}</strong>
              )}
              <div style={{ color: 'var(--muted)', marginTop: 4 }}>{link.meta}</div>
              <button
                aria-label={`Remove ${link.title}`}
                className="card-cta"
                style={{ marginTop: 6 }}
                type="button"
                onClick={() => removeLink(application.id, link.id)}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state">No linked items yet - add the posting, take-home, or docs.</div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests, verify visually, commit**

Run: `pnpm test:unit -- tests/unit/components/linked-tab.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS. Dev-server check: add a link on a card, click it (opens new tab), remove it, History shows both events.

```bash
git add src/components/jobtracker/JobTrackerApp.tsx tests/unit/components/linked-tab.test.tsx
git commit -m "feat: linked tab with add/open/remove links"
```

---

### Task 10: Documents repository + /api/documents route

**Files:**
- Create: `src/lib/repositories/supabase/documents-repository.ts`
- Create: `src/app/api/documents/route.ts`
- Test: `tests/unit/repositories/documents-repository.test.ts`

- [ ] **Step 1: Write the failing repository test**

Create `tests/unit/repositories/documents-repository.test.ts`:

```ts
import { beforeEach, describe, expect, test, vi } from 'vitest';

const upsertMock = vi.fn().mockResolvedValue({ error: null });
const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
const selectEqMock = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => ({
      upsert: (rows: unknown, opts?: unknown) => upsertMock(table, rows, opts),
      select: () => ({ eq: (col: string, val: string) => selectEqMock(table, col, val) }),
      delete: () => ({ eq: (col: string, val: string) => deleteEqMock(table, col, val) }),
    }),
  }),
}));

import {
  deleteDocument,
  listDocuments,
  upsertDocuments,
} from '@/lib/repositories/supabase/documents-repository';
import { DEMO_USER_ID } from '@/lib/types';

const resume = { id: 'r-1', ownerUserId: DEMO_USER_ID, name: 'CV', updatedAt: 'now' } as never;

describe('documents repository', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
    selectEqMock.mockReset();
  });

  test('upsertDocuments writes resume and cover letter rows', async () => {
    await upsertDocuments({ resumes: [resume], coverLetters: [{ ...resume, id: 'c-1' } as never] });
    const tables = upsertMock.mock.calls.map((call) => call[0]);
    expect(tables).toEqual(['resumes', 'cover_letters']);
    const row = upsertMock.mock.calls[0]![1][0];
    expect(row.owner_user_id).toBe(DEMO_USER_ID);
    expect(row.payload.name).toBe('CV');
  });

  test('upsertDocuments skips empty arrays', async () => {
    await upsertDocuments({ resumes: [] });
    expect(upsertMock).not.toHaveBeenCalled();
  });

  test('listDocuments maps payload rows back', async () => {
    selectEqMock.mockImplementation((table: string) =>
      Promise.resolve({
        data: table === 'resumes' ? [{ id: 'r-1', payload: resume }] : [],
        error: null,
      }),
    );
    const state = await listDocuments();
    expect(state.resumes).toHaveLength(1);
    expect(state.coverLetters).toEqual([]);
  });

  test('deleteDocument targets the right table', async () => {
    await deleteDocument('resume', 'r-1');
    expect(deleteEqMock).toHaveBeenCalledWith('resumes', 'id', 'r-1');
    await deleteDocument('cover-letter', 'c-1');
    expect(deleteEqMock).toHaveBeenCalledWith('cover_letters', 'id', 'c-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/repositories/documents-repository.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the repository**

Create `src/lib/repositories/supabase/documents-repository.ts`:

```ts
/**
 * Server-only persistence for the document library (resumes + cover letters).
 * Same JSONB-first pattern as the apps repository: the whole store object is
 * the payload, keyed columns exist for lookups, all rows pinned to the owner.
 */

import 'server-only';

import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CoverLetter, Resume } from '@/lib/types';

export type DocumentsState = {
  resumes: Resume[];
  coverLetters: CoverLetter[];
};

export type DocumentType = 'resume' | 'cover-letter';

const TABLE_BY_TYPE: Record<DocumentType, string> = {
  resume: 'resumes',
  'cover-letter': 'cover_letters',
};

export async function listDocuments(): Promise<DocumentsState> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  const [resumes, coverLetters] = await Promise.all([
    admin.from('resumes').select('id, payload').eq('owner_user_id', owner),
    admin.from('cover_letters').select('id, payload').eq('owner_user_id', owner),
  ]);
  for (const result of [resumes, coverLetters]) {
    if (result.error) throw new Error(`documents list failed: ${result.error.message}`);
  }
  return {
    resumes: (resumes.data ?? []).map((row) => row.payload as Resume),
    coverLetters: (coverLetters.data ?? []).map((row) => row.payload as CoverLetter),
  };
}

export async function upsertDocuments(state: Partial<DocumentsState>): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  if (state.resumes && state.resumes.length > 0) {
    const rows = state.resumes.map((resume) => ({
      id: resume.id,
      owner_user_id: owner,
      payload: resume,
      updated_at: resume.updatedAt,
    }));
    const { error } = await admin.from('resumes').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`resumes upsert failed: ${error.message}`);
  }
  if (state.coverLetters && state.coverLetters.length > 0) {
    const rows = state.coverLetters.map((coverLetter) => ({
      id: coverLetter.id,
      owner_user_id: owner,
      payload: coverLetter,
      updated_at: coverLetter.updatedAt,
    }));
    const { error } = await admin.from('cover_letters').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`cover_letters upsert failed: ${error.message}`);
  }
}

export async function deleteDocument(type: DocumentType, id: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin.from(TABLE_BY_TYPE[type]).delete().eq('id', id);
  if (error) throw new Error(`${TABLE_BY_TYPE[type]} delete failed: ${error.message}`);
}
```

- [ ] **Step 4: Implement the route**

Create `src/app/api/documents/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  deleteDocument,
  listDocuments,
  upsertDocuments,
} from '@/lib/repositories/supabase/documents-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';
import type { CoverLetter, Resume } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const documentSchema = z.object({ id: z.string().min(1), updatedAt: z.string() }).passthrough();
const putSchema = z.object({
  resumes: z.array(documentSchema).max(100).optional(),
  coverLetters: z.array(documentSchema).max(100).optional(),
});

function adapterDisabled() {
  return NextResponse.json(
    { error: 'supabase adapter disabled - set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
    { status: 501 },
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET() {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  try {
    return NextResponse.json(await listDocuments());
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    await upsertDocuments({
      ...(parsed.data.resumes ? { resumes: parsed.data.resumes as unknown as Resume[] } : {}),
      ...(parsed.data.coverLetters
        ? { coverLetters: parsed.data.coverLetters as unknown as CoverLetter[] }
        : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const id = params.get('id');
  if ((type !== 'resume' && type !== 'cover-letter') || !id) {
    return NextResponse.json({ error: 'invalid type or id' }, { status: 400 });
  }
  try {
    await deleteDocument(type, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}
```

- [ ] **Step 5: Run tests, commit**

Run: `pnpm test:unit -- tests/unit/repositories/documents-repository.test.ts && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/lib/repositories/supabase/documents-repository.ts src/app/api/documents/route.ts tests/unit/repositories/documents-repository.test.ts
git commit -m "feat: documents repository and /api/documents routes"
```

---

### Task 11: docs-sync write-through + hydration + profile store wiring

**Files:**
- Create: `src/lib/store/docs-sync.ts`
- Modify: `src/lib/store/profile-store.ts`
- Modify: `src/lib/store/use-hydration.ts`
- Test: `tests/unit/store/docs-sync.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/store/docs-sync.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/docs-sync.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/lib/store/docs-sync.ts`**

```ts
'use client';

/**
 * Write-through for the document library (resumes + cover letters), mirroring
 * apps-sync: optimistic local state, debounced whole-library PUT (the library
 * is small), one retry, warning toast on persistent failure.
 */

import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';

const DEBOUNCE_MS = 400;

let timer: ReturnType<typeof setTimeout> | undefined;

function syncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
}

export function __resetDocsSyncForTests(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
}

/** Queue a debounced persist of the whole document library. */
export function queuePersistDocuments(): void {
  if (!syncEnabled() || typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  const { resumes, coverLetters } = useProfileStore.getState();
  const body = JSON.stringify({ resumes, coverLetters });
  const ok = await putOnce(body).catch(() => false);
  if (ok) return;
  const retried = await putOnce(body).catch(() => false);
  if (!retried) {
    useUiStore.getState().pushToast({
      kind: 'error',
      message: 'Document sync failed - saved locally only.',
    });
  }
}

async function putOnce(body: string): Promise<boolean> {
  const response = await fetch('/api/documents', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return response.ok;
}

/** Fire-and-forget server delete for a removed document. */
export function deleteDocumentOnServer(type: 'resume' | 'cover-letter', id: string): void {
  if (!syncEnabled() || typeof window === 'undefined') return;
  void fetch(`/api/documents?type=${type}&id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).catch(() => null);
}

export type ServerDocumentsState = { resumes: unknown[]; coverLetters: unknown[] };

/** Hydrate the library from the server (server is the source of truth). */
export async function hydrateDocumentsFromServer(): Promise<'server' | 'offline'> {
  if (!syncEnabled()) return 'offline';
  const response = await fetch('/api/documents').catch(() => null);
  if (!response?.ok) return 'offline';
  const server = (await response.json()) as ServerDocumentsState;
  useProfileStore.setState({
    resumes: server.resumes as never,
    coverLetters: server.coverLetters as never,
  });
  return 'server';
}
```

- [ ] **Step 4: Wire the profile store**

In `src/lib/store/profile-store.ts`, add below the `entry` helper:

```ts
function syncDocs(): void {
  void import('@/lib/store/docs-sync').then((mod) => mod.queuePersistDocuments());
}

function syncDocDelete(type: 'resume' | 'cover-letter', id: string): void {
  void import('@/lib/store/docs-sync').then((mod) => mod.deleteDocumentOnServer(type, id));
}
```

Then add calls at the end of each action (after the `set(...)`/`recordAudit` lines):

- `setDefaultResume`, `incrementResumeUse`, `addResume` (before its `return resume;`), `editResume` → `syncDocs();`
- `setDefaultCoverLetter`, `incrementCoverLetterUse`, `addCoverLetter` (before its `return coverLetter;`), `editCoverLetter` → `syncDocs();`
- `removeResume` → `syncDocDelete('resume', id);`
- `removeCoverLetter` → `syncDocDelete('cover-letter', id);`

- [ ] **Step 5: Hydrate documents on load**

In `src/lib/store/use-hydration.ts`, add the import:

```ts
import { hydrateDocumentsFromServer } from '@/lib/store/docs-sync';
```

and change the `.then(async () => { … })` body to run both hydrations:

```ts
      .then(async () => {
        const [outcome] = await Promise.all([hydrateFromServer(), hydrateDocumentsFromServer()]);
        if (outcome === 'offline' && process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase') {
          useUiStore.getState().pushToast({
            kind: 'error',
            message: 'Could not reach the server - showing locally saved data.',
          });
        }
      })
```

- [ ] **Step 6: Run all checks, commit**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: PASS.

```bash
git add src/lib/store/docs-sync.ts src/lib/store/profile-store.ts src/lib/store/use-hydration.ts tests/unit/store/docs-sync.test.ts
git commit -m "feat: document library write-through sync and server hydration"
```

---

### Task 12: Profile upload/download/delete UI + link-document picker

**Files:**
- Modify: `src/components/profile/ProfileView.tsx` (`DocumentsTab`, `DocumentRowActions`, new `UploadDocumentButton`)
- Modify: `src/components/jobtracker/JobTrackerApp.tsx` (replace the placeholder `LinkDocumentPicker`)
- Test: `tests/unit/components/upload-document.test.tsx`, `tests/unit/components/link-document-picker.test.tsx`

- [ ] **Step 1: Write the failing upload test**

Create `tests/unit/components/upload-document.test.tsx`:

```tsx
import { beforeEach, describe, expect, test } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UploadDocumentButton } from '@/components/profile/ProfileView';
import { useProfileStore } from '@/lib/store/profile-store';

describe('UploadDocumentButton', () => {
  beforeEach(() => {
    useProfileStore.getState().reset();
  });

  test('uploads a resume in local mode', async () => {
    render(<UploadDocumentButton kind="resume" />);
    const input = screen.getByLabelText(/upload resume/i);
    const file = new File(['my cv'], 'Nick Resume.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      const resume = useProfileStore.getState().resumes.find((r) => r.name === 'Nick Resume');
      expect(resume).toBeDefined();
      expect(resume!.dataUrl).toMatch(/^data:application\/pdf/);
      expect(resume!.file).toBe('Nick Resume.pdf');
    });
  });

  test('uploads a cover letter in local mode', async () => {
    render(<UploadDocumentButton kind="cover" />);
    const input = screen.getByLabelText(/upload cover letter/i);
    fireEvent.change(input, {
      target: { files: [new File(['dear'], 'Letter.pdf', { type: 'application/pdf' })] },
    });
    await waitFor(() =>
      expect(
        useProfileStore.getState().coverLetters.some((c) => c.name === 'Letter'),
      ).toBe(true),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/components/upload-document.test.tsx`
Expected: FAIL — `UploadDocumentButton` is not exported.

- [ ] **Step 3: Implement the profile upload + row actions**

In `src/components/profile/ProfileView.tsx`:

Add imports:

```ts
import { useRef } from 'react';
import { deleteStoredFile, openStoredFile, storeFile } from '@/lib/files/client';
import { useUiStore } from '@/lib/store/ui-store';
```

(merge `useRef` into the existing react import.)

Add the exported upload button component:

```tsx
export function UploadDocumentButton({ kind }: { kind: 'resume' | 'cover' }) {
  const addResume = useProfileStore((state) => state.addResume);
  const addCoverLetter = useProfileStore((state) => state.addCoverLetter);
  const pushToast = useUiStore((state) => state.pushToast);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = kind === 'resume' ? 'Upload resume' : 'Upload cover letter';

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const stored = await storeFile(file, kind === 'resume' ? 'resume' : 'cover-letter');
      const base = {
        name: file.name.replace(/\.[^.]+$/, ''),
        flavor: 'Uploaded',
        file: file.name,
        size: stored.size,
        updated: new Date().toISOString(),
        isDefault: false,
        timesUsed: 0,
        ...(stored.storagePath !== undefined ? { storagePath: stored.storagePath } : {}),
        ...(stored.dataUrl !== undefined ? { dataUrl: stored.dataUrl } : {}),
      };
      if (kind === 'resume') {
        addResume({ ...base, pages: 1, keywords: [], summary: '' });
      } else {
        addCoverLetter(base);
      }
      pushToast({ message: `${file.name} uploaded` });
    } catch (error) {
      pushToast({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        hidden
        accept=".pdf,.doc,.docx"
        aria-label={label}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
      <button
        className="card-cta"
        disabled={busy}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : 'Upload'}
      </button>
    </>
  );
}
```

In `DocumentsTab`, replace the demo upload button:

```tsx
        <DemoOnly className="card-cta" label={`Upload ${kind}`}>
          Upload
        </DemoOnly>
```

with:

```tsx
        <UploadDocumentButton kind={kind} />
```

Replace `DocumentRowActions` with a real download + delete (Preview/Edit/Duplicate stay demo when there is no stored file):

```tsx
function DocumentRowActions({
  doc,
  kind,
}: {
  doc: { id: Uuid; name: string; storagePath?: string; dataUrl?: string };
  kind: 'resume' | 'cover';
}) {
  const removeResume = useProfileStore((state) => state.removeResume);
  const removeCoverLetter = useProfileStore((state) => state.removeCoverLetter);
  const pushToast = useUiStore((state) => state.pushToast);
  const hasFile = Boolean(doc.storagePath ?? doc.dataUrl);
  return (
    <>
      {hasFile ? (
        <button
          className="card-cta"
          type="button"
          onClick={() =>
            void openStoredFile(doc).catch(() =>
              pushToast({ kind: 'error', message: 'Could not open this file.' }),
            )
          }
        >
          Download
        </button>
      ) : (
        <DemoOnly className="card-cta" label={`Preview ${doc.name}`}>
          Preview
        </DemoOnly>
      )}
      <DemoOnly className="card-cta" label={`Edit ${doc.name}`}>
        Edit
      </DemoOnly>
      <button
        className="card-cta"
        type="button"
        onClick={() => {
          if (!window.confirm(`Delete ${doc.name}? This removes it from your library.`)) return;
          void deleteStoredFile(doc);
          if (kind === 'resume') removeResume(doc.id);
          else removeCoverLetter(doc.id);
          pushToast({ message: `${doc.name} deleted` });
        }}
      >
        Delete
      </button>
    </>
  );
}
```

Update both call sites from `<DocumentRowActions name={doc.name} />` to `<DocumentRowActions doc={doc} kind="resume" />` (resume list) and `<DocumentRowActions doc={doc} kind="cover" />` (cover list). Import `Uuid` from `@/lib/types` if not present. If the old component had a `Duplicate` demo button, drop it (replaced by Delete).

- [ ] **Step 4: Write the failing picker test**

Create `tests/unit/components/link-document-picker.test.tsx`:

```tsx
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';
import { useAppsStore } from '@/lib/store/apps-store';
import { useProfileStore } from '@/lib/store/profile-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

describe('LinkDocumentPicker', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
    useProfileStore.getState().reset();
  });

  test('links a resume as an attachment with source metadata', () => {
    const app = useAppsStore.getState().applications[0]!;
    const resume = useProfileStore.getState().resumes[0]!;
    render(<CardDetailDialog displayId={app.displayId} />);
    fireEvent.click(screen.getByRole('button', { name: /attachments/i }));
    fireEvent.click(screen.getByRole('button', { name: /link document/i }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`link ${resume.name}`, 'i') }));
    const attachment = useAppsStore.getState().activity[app.id]!.attachments[0]!;
    expect(attachment).toMatchObject({ source: 'resume', sourceDocId: resume.id, name: resume.name });
    expect(useAppsStore.getState().activity[app.id]!.history[0]!.text).toBe(
      `Resume linked: ${resume.name}`,
    );
  });

  test('already-linked documents are marked and not re-linkable', () => {
    const app = useAppsStore.getState().applications[0]!;
    const resume = useProfileStore.getState().resumes[0]!;
    useAppsStore.getState().addAttachment(app.id, {
      name: resume.name,
      kind: 'pdf',
      size: resume.size,
      source: 'resume',
      sourceDocId: resume.id,
    });
    render(<CardDetailDialog displayId={app.displayId} />);
    fireEvent.click(screen.getByRole('button', { name: /attachments/i }));
    fireEvent.click(screen.getByRole('button', { name: /link document/i }));
    expect(screen.getByRole('button', { name: new RegExp(`link ${resume.name}`, 'i') })).toBeDisabled();
  });
});
```

- [ ] **Step 5: Run picker test to verify it fails**

Run: `pnpm test:unit -- tests/unit/components/link-document-picker.test.tsx`
Expected: FAIL — placeholder picker has no document buttons.

- [ ] **Step 6: Implement the real picker**

In `src/components/jobtracker/JobTrackerApp.tsx`, add `fileKindOf` to the imports (`@/lib/files/kind`) and `useProfileStore` (already imported for `MatchTab`). Replace the placeholder `LinkDocumentPicker`:

```tsx
function LinkDocumentPicker({
  application,
  onClose,
}: {
  application: Application;
  onClose: () => void;
}) {
  const resumes = useProfileStore((state) => state.resumes);
  const coverLetters = useProfileStore((state) => state.coverLetters);
  const attachments = useAppsStore((state) => state.activity[application.id]?.attachments);
  const addAttachment = useAppsStore((state) => state.addAttachment);
  const pushToast = useUiStore((state) => state.pushToast);

  function isLinked(docId: string): boolean {
    return (attachments ?? []).some((item) => item.sourceDocId === docId);
  }

  function link(
    source: 'resume' | 'cover-letter',
    doc: { id: Uuid; name: string; file: string; size: string; storagePath?: string; dataUrl?: string },
  ) {
    addAttachment(application.id, {
      name: doc.name,
      kind: fileKindOf(doc.file),
      size: doc.size,
      source,
      sourceDocId: doc.id,
      ...(doc.storagePath !== undefined ? { storagePath: doc.storagePath } : {}),
      ...(doc.dataUrl !== undefined ? { dataUrl: doc.dataUrl } : {}),
    });
    pushToast({ message: `${doc.name} linked` });
    onClose();
  }

  const rows = [
    ...resumes.map((doc) => ({ doc, source: 'resume' as const, label: 'Resume' })),
    ...coverLetters.map((doc) => ({ doc, source: 'cover-letter' as const, label: 'Cover letter' })),
  ];

  return (
    <div className="linked-list" style={{ marginBottom: 12 }}>
      {rows.length ? (
        rows.map(({ doc, source, label }) => (
          <div key={doc.id} className="linked-row row-center" style={{ gap: 8 }}>
            <span className="chip is-tag">{label}</span>
            <strong style={{ color: 'var(--white)' }}>{doc.name}</strong>
            <span style={{ color: 'var(--muted)' }}>{doc.size}</span>
            <span className="grow" />
            <button
              aria-label={`Link ${doc.name}`}
              className="card-cta"
              disabled={isLinked(doc.id)}
              type="button"
              onClick={() => link(source, doc)}
            >
              {isLinked(doc.id) ? 'Linked' : 'Link'}
            </button>
          </div>
        ))
      ) : (
        <div className="empty-state">
          No documents in your library yet - upload one on the Profile page.
        </div>
      )}
      <button className="card-cta" style={{ marginTop: 6 }} type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
```

(Import `Uuid` type if not already imported in the file.)

- [ ] **Step 7: Run all tests, verify visually, commit**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: PASS. Dev-server check: Profile → upload a PDF resume → appears with Download/Delete; open a card → Attachments → Link document → pick the resume → attachment row with "Resume" chip; History shows "Resume linked: …".

```bash
git add src/components/profile/ProfileView.tsx src/components/jobtracker/JobTrackerApp.tsx \
  tests/unit/components/upload-document.test.tsx tests/unit/components/link-document-picker.test.tsx
git commit -m "feat: real document upload on profile + link-document picker on cards"
```

---

### Task 13 (root session): Operational — DB cleanup, Vercel env, .env.local

No code. Run in the root session (needs Supabase MCP + Vercel CLI).

- [ ] **Step 1: Delete the test rows (clean slate)**

Call `mcp__supabase__execute_sql` with `project_id: "zpfvdswiaiqoptfsafpd"`:

```sql
delete from public.application_activity
  where owner_user_id = '00000000-0000-0000-0000-000000000001';
delete from public.app_docs
  where owner_user_id = '00000000-0000-0000-0000-000000000001';
delete from public.applications
  where owner_user_id = '00000000-0000-0000-0000-000000000001';
```

Verify: `select count(*) from public.applications;` returns 0.

- [ ] **Step 2: Set the Vercel Production env var**

```bash
printf 'supabase' | vercel env add NEXT_PUBLIC_PERSISTENCE_ADAPTER production
vercel env ls | grep PERSISTENCE
```

Expected: one row, Production only. Do NOT add it to Preview/Development.

- [ ] **Step 3: Point local dev at demo mode**

In `.env.local`, set `NEXT_PUBLIC_PERSISTENCE_ADAPTER=local` (add a comment `# flip to 'supabase' to test real sync locally`). Confirm `.env.local` is still untracked (`git status --short` shows nothing for it).

- [ ] **Step 4: Confirm the bucket exists**

`select id, public from storage.buckets;` — must include `jobtracker-files` / `false` (created in Task 5 Step 1; create it now if it was skipped).

---

### Task 14: E2E updates + full verification

**Files:**
- Modify: `tests/e2e/persistence.spec.ts`
- Verify: whole suite + production build

- [ ] **Step 1: Extend the persistence smoke for the clean-slate contract**

In `tests/e2e/persistence.spec.ts`, add inside the `describe` (after the existing test):

```ts
  test('supabase mode never shows seed demo cards after reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    // Seeded demo boards contain the Anthropic card; a server-backed board must not.
    await expect(page.getByText('JT-1', { exact: true })).toHaveCount(0);
  });
```

(Adjust the seed marker if `JT-1` is not rendered as its own text node — use a seed-only company name from `src/lib/data/seed.ts` instead. The assertion must fail against a seeded board and pass against a server-backed one.)

- [ ] **Step 2: Run the suites in local mode**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint && pnpm test:e2e`
Expected: PASS (persistence spec skips in local mode; all demo-mode e2e keeps passing).

- [ ] **Step 3: Run the persistence suite against a supabase-backed server**

Temporarily set `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase` in `.env.local`, then:

```bash
pnpm test:e2e -- tests/e2e/persistence.spec.ts
```

Expected: PASS — created card survives a localStorage wipe, no seed cards appear. **Afterwards: clean up the rows the test created** (Task 13 Step 1 SQL again) **and restore `.env.local` to `local`.**

- [ ] **Step 4: Production build gate**

```bash
pnpm build
```

Expected: clean build, no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/persistence.spec.ts
git commit -m "test: clean-slate persistence e2e for supabase mode"
```

---

### Task 15: Finish the branch

- [ ] **Step 1:** Use superpowers:finishing-a-development-branch — push the branch, open a PR into `Development`, then merge `Development` → `Production` per the repo's existing flow (see `docs/deployment/branching-and-vercel.md`).
- [ ] **Step 2:** After the Production deploy: verify on the live site — board starts empty, create a card, reload (persists), add a comment on the card and reload (Activity round-trip, spec §5), upload an attachment, link a resume, add a link, check History counts. Confirm `/api/apps` returns the created card with its activity.
