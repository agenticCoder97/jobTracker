# Home Board Real Tracking (Supabase, Single-User) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Home kanban board and card interactions fully real for a single user — manual application entry with free-form companies, editable card details, archive/delete, all persisted to Supabase.

**Architecture:** Zustand stores stay as the UI layer with optimistic updates; every mutation write-throughs to Supabase via Next.js route handlers using the service-role client pinned to one owner user. Client never talks to Supabase directly. JSONB-first row mapping (one `applications` row per card, one `application_activity` row per card, one `app_docs` row per card).

**Tech Stack:** Next.js 15 App Router, Zustand 5 (persist), Supabase (`@supabase/supabase-js` service-role), Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-06-home-board-supabase-design.md`

**Conventions for the executor:**
- Package manager is `pnpm`. Run commands from the repo root.
- `tsconfig` uses `exactOptionalPropertyTypes` — spread optional fields conditionally (`...(x !== undefined ? { x } : {})`) or type them `| undefined`.
- Prettier + ESLint run via husky/lint-staged on commit; if a commit fails on formatting, run `pnpm format` and retry.
- The adapter kill switch: with `NEXT_PUBLIC_PERSISTENCE_ADAPTER` unset or `local`, all new sync code must no-op and the app must behave exactly as today.

---

### Task 1: Supabase infrastructure (operational — no app code)

The Supabase MCP tools (`mcp__supabase__*`) are available in the root session. If executing this task in a subagent without MCP access, do it in the root session instead.

**Files:**
- Create: `docs/backend/migrations/0002_application_activity_unique.sql`
- Create: `.env.local` (never committed; verify it is gitignored)

- [ ] **Step 1: Restore the paused project**

Call `mcp__supabase__restore_project` with `project_id: "zpfvdswiaiqoptfsafpd"`. Poll `mcp__supabase__get_project` until `status` is `ACTIVE_HEALTHY` (can take a few minutes).

- [ ] **Step 2: Apply migration 0001 (bootstrap)**

Call `mcp__supabase__apply_migration` with `project_id: "zpfvdswiaiqoptfsafpd"`, `name: "0001_bootstrap"`, and `query` = the full contents of `docs/backend/supabase-bootstrap.sql` (read the file; apply verbatim).

- [ ] **Step 3: Write and apply migration 0002**

Create `docs/backend/migrations/0002_application_activity_unique.sql`:

```sql
-- One activity row per application, so the server can upsert on application_id.
create unique index if not exists uq_application_activity_application
  on public.application_activity (application_id);

-- Same guarantee for app_docs already exists via unique (owner_user_id, application_id).
```

Apply it via `mcp__supabase__apply_migration` with `name: "0002_application_activity_unique"`.

- [ ] **Step 4: Create the owner user**

Call `mcp__supabase__execute_sql` with:

```sql
insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'nikhil_netra@hotmail.com',
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.users (id)
values ('00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;
```

Verify: `select id, email from auth.users;` returns the row, and `select id from public.users;` returns it too. (This user cannot log in — no password — which is fine; nothing authenticates this round.)

- [ ] **Step 5: Collect env values**

- `mcp__supabase__get_project_url` → `NEXT_PUBLIC_SUPABASE_URL`
- `mcp__supabase__get_publishable_keys` → use the legacy anon key (JWT) as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the `@supabase/ssr` clients in this repo expect it)
- `SUPABASE_SERVICE_ROLE_KEY`: not exposed via MCP. First try `vercel env pull .env.vercel` (the Vercel project may already hold it); otherwise **ask Nick to paste it** from Supabase Dashboard → Project Settings → API keys → `service_role`. Do not proceed to Task 6+ verification without it.

- [ ] **Step 6: Write `.env.local`**

```
NEXT_PUBLIC_SUPABASE_URL=<from step 5>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from step 5>
SUPABASE_SERVICE_ROLE_KEY=<from step 5>
NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase
```

Run: `grep -n "env" .gitignore` — confirm `.env*` (or equivalent) is ignored; `git status --short` must NOT list `.env.local`.

- [ ] **Step 7: Boot check**

Run: `pnpm dev` briefly (or `pnpm build`) and confirm no env-related startup errors, then stop it. Commit the migration file only:

```bash
git add docs/backend/migrations/0002_application_activity_unique.sql
git commit -m "chore(db): add unique index for application_activity upserts"
```

---

### Task 2: Free-form company helpers

**Files:**
- Modify: `src/lib/company-logos.ts` (export `toDisplayName`, add `slugifyCompanyId`)
- Create: `src/lib/utils/company-name.ts`
- Modify: `src/lib/types.ts` (add `companyName`, `postingUrl` to `Application`)
- Test: `tests/unit/company-name.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/company-name.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { slugifyCompanyId } from '@/lib/company-logos';
import { companyNameOf } from '@/lib/utils/company-name';

describe('slugifyCompanyId', () => {
  test('lowercases and hyphenates', () => {
    expect(slugifyCompanyId('Acme Corp')).toBe('acme-corp');
  });
  test('handles ampersands and punctuation', () => {
    expect(slugifyCompanyId('Bain & Company, Inc.')).toBe('bain-and-company-inc');
  });
  test('trims stray hyphens and falls back when empty', () => {
    expect(slugifyCompanyId('  --  ')).toBe('company');
  });
});

describe('companyNameOf', () => {
  test('prefers explicit companyName', () => {
    expect(companyNameOf({ company: 'acme-corp', companyName: 'Acme Corp' })).toBe('Acme Corp');
  });
  test('falls back to seeded company name', () => {
    expect(companyNameOf({ company: 'anthropic' })).toBe('Anthropic');
  });
  test('derives a display name for unknown slugs', () => {
    expect(companyNameOf({ company: 'acme-corp' })).toBe('Acme Corp');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/company-name.test.ts`
Expected: FAIL — `slugifyCompanyId` / `companyNameOf` not exported.

- [ ] **Step 3: Implement**

In `src/lib/company-logos.ts`: change `function toDisplayName(` to `export function toDisplayName(`, and add at the end of the file:

```ts
/** Derive a stable CompanyId slug from a free-form company name. */
export function slugifyCompanyId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'company';
}
```

Create `src/lib/utils/company-name.ts`:

```ts
import { toDisplayName } from '@/lib/company-logos';
import { COMPANIES } from '@/lib/data/seed';

/**
 * Single source of truth for a card's display name. Free-form (manually
 * entered) companies carry `companyName`; seeded companies resolve from the
 * COMPANIES record; anything else gets a title-cased fallback from the slug.
 */
export function companyNameOf(app: { company: string; companyName?: string }): string {
  return app.companyName ?? COMPANIES[app.company]?.name ?? toDisplayName(app.company);
}
```

In `src/lib/types.ts`, inside `export type Application = Audited & {` directly after the `company: CompanyId;` line, add:

```ts
  /** Display name for free-form companies; seeded companies resolve via COMPANIES. */
  companyName?: string;
```

and after the `source: string;` line add:

```ts
  postingUrl?: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/company-name.test.ts`
Expected: PASS (3 + 3 tests). If the seeded-name assertion fails, check the exact name in `COMPANIES.anthropic.name` in `src/lib/data/seed.ts` and match the test to it.

- [ ] **Step 5: Replace display call sites**

Run: `grep -rn "COMPANIES\[.*\]?.name ?? " src/components src/lib --include='*.ts*'`

For each hit that resolves an **application's** company name (not a listing's), replace the expression with `companyNameOf(<app>)` and add the import `import { companyNameOf } from '@/lib/utils/company-name';`. Known sites:

- `src/components/jobtracker/JobTrackerApp.tsx` — `CompanyLine` (`{COMPANIES[application.company]?.name ?? application.company}`), `SidePanel` "Company" row, and the `CardDetailDialog` crumbs (`{COMPANIES[application.company]?.name}` → `{companyNameOf(application)}`).
- `src/components/jobs/use-jobs-rows.ts` — tracked rows: `const companyName = COMPANIES[application.company]?.name ?? application.company;` → `const companyName = companyNameOf(application);` (leave the listing-row resolution unchanged).

Leave `CompaniesView`, `ResearchView`, and listing-related lookups as they are (out of scope).

- [ ] **Step 6: Verify and commit**

Run: `pnpm typecheck && pnpm test:unit`
Expected: PASS.

```bash
git add src/lib/company-logos.ts src/lib/utils/company-name.ts src/lib/types.ts \
  src/components/jobtracker/JobTrackerApp.tsx src/components/jobs/use-jobs-rows.ts \
  tests/unit/company-name.test.ts
git commit -m "feat: free-form company names with slug + display helpers"
```

---

### Task 3: `createCard` accepts real input

**Files:**
- Modify: `src/lib/store/apps-store.ts`
- Test: `tests/unit/store/create-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/store/create-card.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

describe('createCard with input', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('creates a card with free-form company and details', () => {
    const app = useAppsStore.getState().createCard({
      status: 'applied',
      companyName: 'Acme Corp',
      role: 'Staff Engineer',
      location: 'Austin, TX',
      remote: 'Hybrid',
      salaryMin: 190,
      salaryMax: 250,
      priority: 'high',
      tags: ['Platform', 'Go'],
      postingUrl: 'https://acme.example/jobs/123',
      description: 'Platform team role.',
    });
    expect(app.company).toBe('acme-corp');
    expect(app.companyName).toBe('Acme Corp');
    expect(app.status).toBe('applied');
    expect(app.salaryMin).toBe(190);
    expect(app.postingUrl).toBe('https://acme.example/jobs/123');
    expect(app.displayId).toMatch(/^JT-\d+$/);
    const stored = useAppsStore.getState().getByDisplayId(app.displayId);
    expect(stored?.role).toBe('Staff Engineer');
    const history = useAppsStore.getState().activity[app.id]?.history ?? [];
    expect(history[0]?.text).toContain('created');
  });

  test('applies defaults when optional fields are omitted', () => {
    const app = useAppsStore.getState().createCard({
      status: 'wishlist',
      companyName: 'Tiny Startup',
      role: 'Engineer',
    });
    expect(app.company).toBe('tiny-startup');
    expect(app.location).toBe('Remote');
    expect(app.remote).toBe('Remote');
    expect(app.priority).toBe('med');
    expect(app.tags).toEqual([]);
    expect(app.progress).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/create-card.test.ts`
Expected: FAIL — `createCard` signature mismatch (object arg vs `StatusId`).

- [ ] **Step 3: Implement**

In `src/lib/store/apps-store.ts`:

Add imports: `slugifyCompanyId` from `@/lib/company-logos`, and `Priority` to the type import from `@/lib/types`.

Add above the `AppsState` type:

```ts
export type NewApplicationInput = {
  status: StatusId;
  companyName: string;
  role: string;
  location?: string;
  remote?: RemoteMode;
  salaryMin?: number;
  salaryMax?: number;
  priority?: Priority;
  tags?: string[];
  postingUrl?: string;
  description?: string;
};
```

Change the signature in `AppsState`: `createCard: (input: NewApplicationInput) => Application;`

Replace the `createCard` implementation body with:

```ts
      createCard: (input) => {
        const displayId = nextDisplayId(get().applications);
        const now = new Date().toISOString();
        const app: Application = {
          id: seedUuid(displayId),
          ownerUserId: seed.applications[0]?.ownerUserId ?? '00000000-0000-0000-0000-000000000001',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          displayId,
          status: input.status,
          company: slugifyCompanyId(input.companyName),
          companyName: input.companyName.trim(),
          role: input.role.trim(),
          location: input.location?.trim() || 'Remote',
          remote: input.remote ?? 'Remote',
          salaryMin: input.salaryMin ?? 0,
          salaryMax: input.salaryMax ?? 0,
          level: 'Senior',
          team: 'Product',
          posted: daysAgo(0),
          applied: input.status === 'wishlist' ? null : daysAgo(0),
          lastActivity: now,
          priority: input.priority ?? 'med',
          source: 'Manual entry',
          progress: input.status === 'wishlist' ? 5 : 20,
          tags: input.tags ?? [],
          sourceListingId: null,
          sortIndex: get().applications.filter((item) => item.status === input.status).length,
          archivedAt: null,
        };
        if (input.postingUrl?.trim()) app.postingUrl = input.postingUrl.trim();
        if (input.description?.trim()) app.description = input.description.trim();
        set((state) => ({
          applications: [app, ...state.applications],
          activity: {
            ...state.activity,
            [app.id]: {
              ...emptyActivity(),
              history: [historyEvent('created', 'Card created manually')],
            },
          },
        }));
        recordAudit('application', app.id, 'created', { source: 'manual', status: input.status });
        return app;
      },
```

Fix the two call sites so the build compiles (temporary — Task 4 replaces them with the dialog): in `src/components/jobtracker/JobTrackerApp.tsx`, `TopBar.createApplication` and `BoardView.addCard`, change `createCard('wishlist')` / `createCard(status)` to:

```ts
createCard({ status, companyName: 'New company', role: 'New application' });
```

(with `const status: StatusId = 'wishlist';` in TopBar's case, or just inline the literal).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS (if other existing tests call `createCard('...')` with a string, update them to the object form).

- [ ] **Step 5: Commit**

```bash
git add src/lib/store/apps-store.ts src/components/jobtracker/JobTrackerApp.tsx tests/unit/store/create-card.test.ts
git commit -m "feat: createCard accepts full manual-entry input"
```

---

### Task 4: New-application dialog

**Files:**
- Modify: `src/lib/store/ui-store.ts` (dialog open state)
- Create: `src/components/jobtracker/NewApplicationDialog.tsx`
- Modify: `src/components/jobtracker/JobTrackerApp.tsx` (both trigger call sites)
- Modify: `src/components/layout/AppShell.tsx` (mount the dialog)
- Test: `tests/unit/components/new-application-dialog.test.tsx`

- [ ] **Step 1: Add dialog state to the UI store**

In `src/lib/store/ui-store.ts` add to `UiState`:

```ts
  newAppStatus: StatusId | null;
  openNewApp: (status: StatusId) => void;
  closeNewApp: () => void;
```

with `import type { StatusId } from '@/lib/types';`, and to the store object:

```ts
  newAppStatus: null,
  openNewApp: (newAppStatus) => set({ newAppStatus }),
  closeNewApp: () => set({ newAppStatus: null }),
```

- [ ] **Step 2: Write the failing component test**

Create `tests/unit/components/new-application-dialog.test.tsx`:

```tsx
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NewApplicationDialog } from '@/components/jobtracker/NewApplicationDialog';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

describe('NewApplicationDialog', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
    useUiStore.getState().openNewApp('applied');
  });

  test('renders nothing when closed', () => {
    useUiStore.getState().closeNewApp();
    const { container } = render(<NewApplicationDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  test('requires company and role', () => {
    render(<NewApplicationDialog />);
    fireEvent.click(screen.getByRole('button', { name: /create application/i }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  test('creates a card and closes on valid submit', () => {
    render(<NewApplicationDialog />);
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'Staff Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: /create application/i }));
    const created = useAppsStore
      .getState()
      .applications.find((app) => app.companyName === 'Acme Corp');
    expect(created?.role).toBe('Staff Engineer');
    expect(created?.status).toBe('applied');
    expect(useUiStore.getState().newAppStatus).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/components/new-application-dialog.test.tsx`
Expected: FAIL — module `NewApplicationDialog` does not exist.

- [ ] **Step 4: Implement the dialog**

Create `src/components/jobtracker/NewApplicationDialog.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod';
import { Icon } from '@/components/jobtracker/JobTrackerApp';
import { STATUSES } from '@/lib/data/seed';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import type { Priority, RemoteMode, StatusId } from '@/lib/types';

const schema = z.object({
  companyName: z.string().trim().min(1, 'Company is required'),
  role: z.string().trim().min(1, 'Role is required'),
  location: z.string().trim(),
  remote: z.enum(['Remote', 'Hybrid', 'Onsite']),
  salaryMin: z.coerce.number().min(0).default(0),
  salaryMax: z.coerce.number().min(0).default(0),
  status: z.enum(['wishlist', 'applied', 'screen', 'interview', 'offer', 'rejected']),
  priority: z.enum(['high', 'med', 'low']),
  tags: z.string().trim(),
  postingUrl: z.union([z.literal(''), z.string().trim().url('Must be a valid URL')]),
  description: z.string().trim(),
});

type FormErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

export function NewApplicationDialog() {
  const status = useUiStore((state) => state.newAppStatus);
  if (!status) return null;
  return <NewApplicationForm key={status} initialStatus={status} />;
}

function NewApplicationForm({ initialStatus }: { initialStatus: StatusId }) {
  const router = useRouter();
  const closeNewApp = useUiStore((state) => state.closeNewApp);
  const pushToast = useUiStore((state) => state.pushToast);
  const createCard = useAppsStore((state) => state.createCard);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState({
    companyName: '',
    role: '',
    location: '',
    remote: 'Remote' as RemoteMode,
    salaryMin: '',
    salaryMax: '',
    status: initialStatus,
    priority: 'med' as Priority,
    tags: '',
    postingUrl: '',
    description: '',
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormErrors;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    const data = parsed.data;
    const tags = data.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const app = createCard({
      status: data.status,
      companyName: data.companyName,
      role: data.role,
      ...(data.location ? { location: data.location } : {}),
      remote: data.remote,
      ...(data.salaryMin ? { salaryMin: data.salaryMin } : {}),
      ...(data.salaryMax ? { salaryMax: data.salaryMax } : {}),
      priority: data.priority,
      tags,
      ...(data.postingUrl ? { postingUrl: data.postingUrl } : {}),
      ...(data.description ? { description: data.description } : {}),
    });
    closeNewApp();
    pushToast({ message: `${data.companyName} · ${data.role} added` });
    router.push(`/card/${app.displayId}`);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeNewApp}>
      <section
        aria-label="New application"
        className="modal compact-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="playlist-add" size={14} /> New application
          </div>
          <span className="grow" />
          <button aria-label="Close" className="icon-btn" type="button" onClick={closeNewApp}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <form className="modal__main new-app-form" onSubmit={submit}>
          <Field error={errors.companyName} id="na-company" label="Company">
            <input
              id="na-company"
              placeholder="e.g. Acme Corp"
              value={form.companyName}
              onChange={(event) => setField('companyName', event.target.value)}
            />
          </Field>
          <Field error={errors.role} id="na-role" label="Role">
            <input
              id="na-role"
              placeholder="e.g. Staff Software Engineer"
              value={form.role}
              onChange={(event) => setField('role', event.target.value)}
            />
          </Field>
          <div className="new-app-form__row">
            <Field id="na-location" label="Location">
              <input
                id="na-location"
                placeholder="e.g. Remote (US)"
                value={form.location}
                onChange={(event) => setField('location', event.target.value)}
              />
            </Field>
            <Field id="na-remote" label="Work mode">
              <select
                id="na-remote"
                value={form.remote}
                onChange={(event) => setField('remote', event.target.value as RemoteMode)}
              >
                <option>Remote</option>
                <option>Hybrid</option>
                <option>Onsite</option>
              </select>
            </Field>
          </div>
          <div className="new-app-form__row">
            <Field id="na-salary-min" label="Salary min ($K)">
              <input
                id="na-salary-min"
                inputMode="numeric"
                value={form.salaryMin}
                onChange={(event) => setField('salaryMin', event.target.value)}
              />
            </Field>
            <Field id="na-salary-max" label="Salary max ($K)">
              <input
                id="na-salary-max"
                inputMode="numeric"
                value={form.salaryMax}
                onChange={(event) => setField('salaryMax', event.target.value)}
              />
            </Field>
          </div>
          <div className="new-app-form__row">
            <Field id="na-status" label="Status">
              <select
                id="na-status"
                value={form.status}
                onChange={(event) => setField('status', event.target.value as StatusId)}
              >
                {STATUSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="na-priority" label="Priority">
              <select
                id="na-priority"
                value={form.priority}
                onChange={(event) => setField('priority', event.target.value as Priority)}
              >
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
          </div>
          <Field id="na-tags" label="Tags (comma-separated)">
            <input
              id="na-tags"
              placeholder="e.g. TypeScript, Platform"
              value={form.tags}
              onChange={(event) => setField('tags', event.target.value)}
            />
          </Field>
          <Field error={errors.postingUrl} id="na-url" label="Posting URL">
            <input
              id="na-url"
              placeholder="https://…"
              value={form.postingUrl}
              onChange={(event) => setField('postingUrl', event.target.value)}
            />
          </Field>
          <Field id="na-description" label="Notes / description">
            <textarea
              id="na-description"
              rows={3}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </Field>
          <footer className="dialog-footer">
            <button className="card-cta" type="button" onClick={closeNewApp}>
              Cancel
            </button>
            <button className="astral-gold-btn" type="submit">
              <Icon name="playlist-add" size={14} /> Create application
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="new-app-form__field" htmlFor={id}>
      <span className="side__label">{label}</span>
      {children}
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
```

Add minimal styles to `src/app/globals.css` (append at the end, matching existing token usage):

```css
.new-app-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.new-app-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.new-app-form__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.new-app-form__field input,
.new-app-form__field select,
.new-app-form__field textarea {
  background: var(--panel, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--white);
  padding: 8px 10px;
  font: inherit;
}
.form-error {
  color: var(--error);
  font-size: 12px;
}
```

(If `--panel` doesn't exist in globals.css, use the background token the `.topbar__search input` styles use — check and reuse.)

- [ ] **Step 5: Wire the triggers and mount**

In `src/components/jobtracker/JobTrackerApp.tsx`:

- `TopBar`: replace `createApplication` with `const openNewApp = useUiStore((state) => state.openNewApp);` and `function createApplication() { openNewApp('wishlist'); }`. Remove the now-unused `createCard` selector and `router` usage if orphaned.
- `BoardView`: replace `addCard` with `const openNewApp = useUiStore((state) => state.openNewApp);` and `function addCard(status: StatusId) { openNewApp(status); }`. Remove the unused `createCard` selector.

In `src/components/layout/AppShell.tsx`: import and render `<NewApplicationDialog />` once, as a sibling of the main content (next to wherever `ToastHost` or the shell's children render — read the file and place it just before the closing wrapper).

- [ ] **Step 6: Run tests**

Run: `pnpm test:unit -- tests/unit/components/new-application-dialog.test.tsx && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Visual check + commit**

Run the dev server, open `/`, click "New" in the top bar and a column "+": the dialog opens with the right pre-selected status; creating navigates to the new card; the card shows the free-form company with an initial-fallback logo.

```bash
git add src/components/jobtracker/NewApplicationDialog.tsx src/components/jobtracker/JobTrackerApp.tsx \
  src/components/layout/AppShell.tsx src/lib/store/ui-store.ts src/app/globals.css \
  tests/unit/components/new-application-dialog.test.tsx
git commit -m "feat: new-application dialog with free-form company entry"
```

---

### Task 5: Card editing + archive/delete

**Files:**
- Modify: `src/lib/store/apps-store.ts` (add `archiveApp`, `deleteApp`)
- Modify: `src/components/jobtracker/JobTrackerApp.tsx` (MetaRow, CompanyLine, OverviewTab, SidePanel, CardDetailDialog header, BoardView filter)
- Modify: `src/components/jobs/use-jobs-rows.ts` (filter archived/deleted)
- Test: `tests/unit/store/archive-delete.test.ts`

- [ ] **Step 1: Write the failing store test**

Create `tests/unit/store/archive-delete.test.ts`:

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

describe('archive and delete', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('archiveApp sets archivedAt and unarchives on second call', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().archiveApp(app.id);
    expect(useAppsStore.getState().applications.find((a) => a.id === app.id)?.archivedAt).toBeTruthy();
    useAppsStore.getState().archiveApp(app.id);
    expect(useAppsStore.getState().applications.find((a) => a.id === app.id)?.archivedAt).toBeNull();
  });

  test('deleteApp soft-deletes', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().deleteApp(app.id);
    const stored = useAppsStore.getState().applications.find((a) => a.id === app.id);
    expect(stored?.deletedAt).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/archive-delete.test.ts`
Expected: FAIL — `archiveApp` is not a function.

- [ ] **Step 3: Implement store actions**

In `src/lib/store/apps-store.ts` add to `AppsState`:

```ts
  archiveApp: (id: Uuid) => void;
  deleteApp: (id: Uuid) => void;
```

and to the store (after `applyCard`):

```ts
      archiveApp: (id) => {
        const isArchived = Boolean(get().applications.find((app) => app.id === id)?.archivedAt);
        const archivedAt = isArchived ? null : new Date().toISOString();
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id ? bump({ ...app, archivedAt }) : app,
          ),
          activity: {
            ...state.activity,
            [id]: {
              ...(state.activity[id] ?? emptyActivity()),
              history: [
                historyEvent('field', archivedAt ? 'Card archived' : 'Card unarchived'),
                ...(state.activity[id]?.history ?? []),
              ],
            },
          },
        }));
        recordAudit('application', id, archivedAt ? 'archived' : 'unarchived');
      },
      deleteApp: (id) => {
        set((state) => ({
          applications: state.applications.map((app) =>
            app.id === id ? { ...app, deletedAt: new Date().toISOString() } : app,
          ),
        }));
        recordAudit('application', id, 'deleted');
      },
```

- [ ] **Step 4: Filter archived/deleted from views**

- `src/components/jobtracker/JobTrackerApp.tsx`, `BoardView`: where `filteredApplications` is derived from `applications`, prepend `.filter((app) => !app.archivedAt && !app.deletedAt)` (find the existing filter chain around the board filters and add this first).
- `src/components/jobs/use-jobs-rows.ts`, `buildJobsRows`: change the tracked-rows source to `applications.filter((app) => !app.archivedAt && !app.deletedAt)` (apply before `.map`).
- `getByDisplayId` in the store: exclude deleted → `get().applications.find((app) => app.displayId === displayId && !app.deletedAt)`.

- [ ] **Step 5: Wire header buttons**

In `CardDetailDialog` (`JobTrackerApp.tsx`), replace the demo header buttons block. Keep Watch/Star/Share as `DemoOnly`; make Archive and Delete real:

```tsx
          {(
            [
              { icon: 'eye', label: 'Watch' },
              { icon: 'star', label: 'Star' },
              { icon: 'share-2', label: 'Share' },
            ] as const
          ).map(({ icon, label }) => (
            <DemoOnly key={icon} label={label} asChild>
              <button type="button" className="icon-btn" aria-label={label}>
                <Icon name={icon} />
              </button>
            </DemoOnly>
          ))}
          <button
            type="button"
            className="icon-btn"
            aria-label={application.archivedAt ? 'Unarchive' : 'Archive'}
            onClick={() => {
              archiveApp(application.id);
              pushToast({
                message: application.archivedAt ? 'Card unarchived' : 'Card archived',
              });
            }}
          >
            <Icon name="archive" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete card"
            onClick={() => {
              if (!window.confirm(`Delete ${application.displayId}? This removes it from your board.`)) return;
              deleteApp(application.id);
              pushToast({ message: 'Card deleted' });
              close();
            }}
          >
            <Icon name="trash-2" />
          </button>
```

with selectors added at the top of `CardDetailDialog`:

```ts
  const archiveApp = useAppsStore((state) => state.archiveApp);
  const deleteApp = useAppsStore((state) => state.deleteApp);
  const pushToast = useUiStore((state) => state.pushToast);
```

(Check the `Icon` component's name map for `trash-2`; if absent, use whatever delete/trash glyph exists — grep `'trash` in the file — or fall back to `x`.) When `application.archivedAt` is set, also render a small banner chip in `MetaRow`: `<span className="chip">Archived</span>`.

- [ ] **Step 6: Editable status + priority (MetaRow)**

Replace `MetaRow`'s status and priority pills:

```tsx
function MetaRow({ application }: { application: Application }) {
  const moveStatus = useAppsStore((state) => state.moveStatus);
  const updateApp = useAppsStore((state) => state.updateApp);
  const status = STATUSES.find((item) => item.id === application.status);
  const priority = priorityMeta(application.priority);
  const nextPriority: Record<Priority, Priority> = { high: 'med', med: 'low', low: 'high' };
  return (
    <div className="row-center" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
      <select
        aria-label="Change status"
        className="status-pill"
        style={{ color: status?.color ?? 'var(--gold)' }}
        value={application.status}
        onChange={(event) => moveStatus(application.id, event.target.value as StatusId)}
      >
        {STATUSES.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      <button
        className="priority-pill"
        type="button"
        aria-label={`Priority: ${priority.label}. Click to change.`}
        style={{ color: application.priority === 'high' ? 'var(--error)' : 'var(--warning)' }}
        onClick={() =>
          updateApp(
            application.id,
            { priority: nextPriority[application.priority] },
            `Priority set to ${nextPriority[application.priority]}`,
          )
        }
      >
        <Icon name={priority.icon} size={12} /> {priority.label}
      </button>
      {application.archivedAt ? <span className="chip">Archived</span> : null}
      {application.tags.map((tag) => (
        <span key={tag} className="chip is-tag">
          {tag}
        </span>
      ))}
      {application.applied ? (
        <span className="chip">Applied {fmtDate(application.applied)}</span>
      ) : null}
      {application.nextAction ? (
        <span className="chip is-tag">{application.nextAction}</span>
      ) : null}
    </div>
  );
}
```

Import `Priority` and `StatusId` types if not already imported in the file.

- [ ] **Step 7: CompanyLine — editable location + real posting link**

Replace `CompanyLine`:

```tsx
function CompanyLine({ application }: { application: Application }) {
  const updateApp = useAppsStore((state) => state.updateApp);
  return (
    <div className="modal__company-line">
      <CompanyLogo companyId={application.company} size={24} radius={5} />
      <Link href={`/company/${application.company}`}>{companyNameOf(application)}</Link>
      <span
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Location"
        onBlur={(event) =>
          updateApp(
            application.id,
            { location: event.currentTarget.textContent?.trim() || application.location },
            'Location edited',
          )
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      >
        {application.location}
      </span>
      <span>·</span>
      {application.postingUrl ? (
        <a
          href={application.postingUrl}
          rel="noreferrer noopener"
          target="_blank"
          style={{ color: 'var(--gold)' }}
        >
          View original posting <Icon name="external-link" size={11} />
        </a>
      ) : (
        <button
          style={{ border: 0, background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}
          type="button"
          onClick={() => {
            const url = window.prompt('Posting URL (https://…)');
            if (url?.trim()) updateApp(application.id, { postingUrl: url.trim() }, 'Posting URL added');
          }}
        >
          Add posting link
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Editable description (OverviewTab)**

In `OverviewTab`, replace the "About the role" section with a click-to-edit block:

```tsx
function OverviewTab({ application }: { application: Application }) {
  const updateApp = useAppsStore((state) => state.updateApp);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(application.description ?? '');
  return (
    <>
      <Section title="About the role">
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea
              aria-label="Role description"
              className="new-app-form__field-textarea"
              rows={5}
              style={{ width: '100%', background: 'transparent', color: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, font: 'inherit' }}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="row-center" style={{ gap: 8 }}>
              <button
                className="astral-gold-btn"
                type="button"
                onClick={() => {
                  updateApp(application.id, { description: draft.trim() }, 'Description edited');
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button className="card-cta" type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            role="button"
            tabIndex={0}
            style={{ cursor: 'text' }}
            title="Click to edit"
            onClick={() => {
              setDraft(application.description ?? '');
              setEditing(true);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setDraft(application.description ?? '');
                setEditing(true);
              }
            }}
          >
            {application.description ?? 'No role description yet — click to add one.'}
          </p>
        )}
      </Section>
      {/* …keep the remaining sections (requirements, nextAction, offer, rejectedReason) unchanged… */}
```

(Keep the rest of the existing `OverviewTab` JSX below, untouched. Add `useState` to the react import at the top of the file if this section of the file doesn't already have it in scope.)

- [ ] **Step 9: Editable side panel rows**

In `SidePanel`, add an `EditableSideRow` helper next to `SideRow` and use it for Company, Level, Team, Mode, Salary, Equity:

```tsx
function EditableSideRow({
  label,
  value,
  onCommit,
  type = 'text',
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  type?: 'text' | 'number';
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <div className="side__row">
        <span>{label}</span>
        <button
          className="side__value side__value--editable"
          style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', font: 'inherit', textAlign: 'right' }}
          title={`Edit ${label.toLowerCase()}`}
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
        >
          {value}
        </button>
      </div>
    );
  }
  return (
    <div className="side__row">
      <span>{label}</span>
      <input
        autoFocus
        aria-label={label}
        style={{ width: 120, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--white)', font: 'inherit', padding: '2px 6px', textAlign: 'right' }}
        type={type}
        value={draft}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== value) onCommit(draft.trim());
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setEditing(false);
        }}
      />
    </div>
  );
}
```

Then in `SidePanel` add `const updateApp = useAppsStore((state) => state.updateApp);` and replace the read-only rows:

```tsx
      <SideGroup title="Role">
        <EditableSideRow
          label="Company"
          value={companyNameOf(application)}
          onCommit={(name) =>
            updateApp(
              application.id,
              { companyName: name, company: slugifyCompanyId(name) },
              'Company edited',
            )
          }
        />
        <EditableSideRow
          label="Level"
          value={application.level}
          onCommit={(level) => updateApp(application.id, { level }, 'Level edited')}
        />
        <EditableSideRow
          label="Team"
          value={application.team}
          onCommit={(team) => updateApp(application.id, { team }, 'Team edited')}
        />
        <div className="side__row">
          <span>Mode</span>
          <select
            aria-label="Work mode"
            className="side__value"
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--white)' }}
            value={application.remote}
            onChange={(event) =>
              updateApp(application.id, { remote: event.target.value as RemoteMode }, 'Work mode edited')
            }
          >
            <option>Remote</option>
            <option>Hybrid</option>
            <option>Onsite</option>
          </select>
        </div>
      </SideGroup>
      <SideGroup title="Compensation">
        <EditableSideRow
          label="Salary min ($K)"
          type="number"
          value={String(application.salaryMin)}
          onCommit={(v) => updateApp(application.id, { salaryMin: Number(v) || 0 }, 'Salary edited')}
        />
        <EditableSideRow
          label="Salary max ($K)"
          type="number"
          value={String(application.salaryMax)}
          onCommit={(v) => updateApp(application.id, { salaryMax: Number(v) || 0 }, 'Salary edited')}
        />
        <EditableSideRow
          label="Equity"
          value={application.equity ?? 'Not listed'}
          onCommit={(equity) => updateApp(application.id, { equity }, 'Equity edited')}
        />
        <div className="salary-bar" style={{ height: 8, marginTop: 12 }}>
          <div className="salary-bar__fill" style={{ width: `${salaryWidth}%` }} />
        </div>
      </SideGroup>
```

Imports needed in `JobTrackerApp.tsx`: `slugifyCompanyId` from `@/lib/company-logos`, `companyNameOf` from `@/lib/utils/company-name` (added in Task 2), `RemoteMode` type.

- [ ] **Step 10: Run all checks**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: PASS. Manually verify in the dev server: change status via the pill dropdown (card moves column on the board), cycle priority, edit company/salary in the side panel, archive (card leaves board, chip shows on card), delete (confirm → gone).

- [ ] **Step 11: Commit**

```bash
git add src/lib/store/apps-store.ts src/components/jobtracker/JobTrackerApp.tsx \
  src/components/jobs/use-jobs-rows.ts tests/unit/store/archive-delete.test.ts
git commit -m "feat: editable card details, archive and delete actions"
```

---

### Task 6: Server repository + /api/apps routes

**Files:**
- Create: `src/lib/server/owner.ts`
- Create: `src/lib/repositories/supabase/apps-repository.ts`
- Create: `src/app/api/apps/route.ts`
- Create: `src/app/api/apps/import/route.ts`
- Modify: `vitest.config.ts` (alias `server-only` to a stub)
- Create: `tests/mocks/server-only.ts`
- Test: `tests/unit/repositories/apps-repository.test.ts`

- [ ] **Step 1: Stub `server-only` for vitest**

Create `tests/mocks/server-only.ts`:

```ts
// vitest stand-in for Next.js's `server-only` guard module.
export {};
```

In `vitest.config.ts`, add to `resolve.alias`:

```ts
      'server-only': path.resolve(__dirname, 'tests/mocks/server-only.ts'),
```

- [ ] **Step 2: Owner helper**

Create `src/lib/server/owner.ts`:

```ts
import 'server-only';

import { DEMO_USER_ID } from '@/lib/types';

/**
 * Single-user mode: every server-side read/write is pinned to this owner.
 * When auth lands, this becomes a session lookup — callers don't change.
 */
export function getOwnerUserId(): string {
  return DEMO_USER_ID;
}
```

- [ ] **Step 3: Write the failing repository test**

Create `tests/unit/repositories/apps-repository.test.ts`:

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

import { listAppsState, upsertBundles, clearAppsState } from '@/lib/repositories/supabase/apps-repository';
import { DEMO_USER_ID } from '@/lib/types';

const app = {
  id: 'a-1',
  ownerUserId: DEMO_USER_ID,
  displayId: 'JT-1',
  status: 'applied',
} as never;

describe('apps repository', () => {
  beforeEach(() => {
    upsertMock.mockClear();
    deleteEqMock.mockClear();
    selectEqMock.mockReset();
  });

  test('upsertBundles writes application, activity and docs rows', async () => {
    await upsertBundles([
      {
        application: app,
        activity: { comments: [], history: [], links: [], attachments: [] },
        docs: { applicationId: 'a-1', resumeId: 'r-1', coverLetterId: null, ats: {} as never },
      },
    ]);
    const tables = upsertMock.mock.calls.map((call) => call[0]);
    expect(tables).toContain('applications');
    expect(tables).toContain('application_activity');
    expect(tables).toContain('app_docs');
    const appRow = upsertMock.mock.calls.find((call) => call[0] === 'applications')![1][0];
    expect(appRow.owner_user_id).toBe(DEMO_USER_ID);
    expect(appRow.display_id).toBe('JT-1');
    expect(appRow.payload.status).toBe('applied');
  });

  test('upsertBundles skips activity/docs when absent', async () => {
    await upsertBundles([{ application: app }]);
    const tables = upsertMock.mock.calls.map((call) => call[0]);
    expect(tables).toEqual(['applications']);
  });

  test('listAppsState maps rows back to store shape', async () => {
    selectEqMock.mockImplementation((table: string) => {
      if (table === 'applications')
        return Promise.resolve({ data: [{ id: 'a-1', payload: app }], error: null });
      if (table === 'application_activity')
        return Promise.resolve({
          data: [{ application_id: 'a-1', payload: { comments: [], history: [], links: [], attachments: [] } }],
          error: null,
        });
      return Promise.resolve({ data: [], error: null });
    });
    const state = await listAppsState();
    expect(state.applications).toHaveLength(1);
    expect(state.activity['a-1']).toBeDefined();
    expect(state.appDocs).toEqual({});
  });

  test('clearAppsState deletes owner rows from all three tables', async () => {
    await clearAppsState();
    expect(deleteEqMock.mock.calls.map((call) => call[0]).sort()).toEqual([
      'app_docs',
      'application_activity',
      'applications',
    ]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/repositories/apps-repository.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 5: Implement the repository**

Create `src/lib/repositories/supabase/apps-repository.ts`:

```ts
/**
 * Server-only persistence for the Home board: applications + activity + docs.
 * JSONB-first — each store object is stored whole in `payload`, keyed columns
 * exist only for lookups. All rows are pinned to the single owner user.
 */

import 'server-only';

import { getOwnerUserId } from '@/lib/server/owner';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Activity, AppDocs, Application, Uuid } from '@/lib/types';

export type AppBundle = {
  application: Application;
  activity?: Activity;
  docs?: AppDocs;
};

export type AppsState = {
  applications: Application[];
  activity: Record<Uuid, Activity>;
  appDocs: Record<Uuid, AppDocs>;
};

export async function listAppsState(): Promise<AppsState> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();

  const [apps, activity, docs] = await Promise.all([
    admin.from('applications').select('id, payload').eq('owner_user_id', owner),
    admin.from('application_activity').select('application_id, payload').eq('owner_user_id', owner),
    admin.from('app_docs').select('application_id, payload').eq('owner_user_id', owner),
  ]);
  for (const result of [apps, activity, docs]) {
    if (result.error) throw new Error(`apps-repository list failed: ${result.error.message}`);
  }

  return {
    applications: (apps.data ?? []).map((row) => row.payload as Application),
    activity: Object.fromEntries(
      (activity.data ?? []).map((row) => [row.application_id as Uuid, row.payload as Activity]),
    ),
    appDocs: Object.fromEntries(
      (docs.data ?? []).map((row) => [row.application_id as Uuid, row.payload as AppDocs]),
    ),
  };
}

export async function upsertBundles(bundles: AppBundle[]): Promise<void> {
  if (bundles.length === 0) return;
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();

  const appRows = bundles.map(({ application }) => ({
    id: application.id,
    owner_user_id: owner,
    display_id: application.displayId,
    payload: application,
    updated_at: application.updatedAt,
    deleted_at: application.deletedAt,
  }));
  const { error: appError } = await admin
    .from('applications')
    .upsert(appRows, { onConflict: 'id' });
  if (appError) throw new Error(`applications upsert failed: ${appError.message}`);

  const activityRows = bundles
    .filter((bundle) => bundle.activity)
    .map((bundle) => ({
      application_id: bundle.application.id,
      owner_user_id: owner,
      payload: bundle.activity,
      updated_at: new Date().toISOString(),
    }));
  if (activityRows.length > 0) {
    const { error } = await admin
      .from('application_activity')
      .upsert(activityRows, { onConflict: 'application_id' });
    if (error) throw new Error(`application_activity upsert failed: ${error.message}`);
  }

  const docRows = bundles
    .filter((bundle) => bundle.docs)
    .map((bundle) => ({
      application_id: bundle.application.id,
      owner_user_id: owner,
      payload: bundle.docs,
      updated_at: new Date().toISOString(),
    }));
  if (docRows.length > 0) {
    const { error } = await admin
      .from('app_docs')
      .upsert(docRows, { onConflict: 'owner_user_id,application_id' });
    if (error) throw new Error(`app_docs upsert failed: ${error.message}`);
  }
}

export async function clearAppsState(): Promise<void> {
  const admin = getSupabaseAdminClient();
  const owner = getOwnerUserId();
  // Children first (FK cascade also covers this, but be explicit).
  for (const table of ['app_docs', 'application_activity', 'applications'] as const) {
    const { error } = await admin.from(table).delete().eq('owner_user_id', owner);
    if (error) throw new Error(`${table} clear failed: ${error.message}`);
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/repositories/apps-repository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Route handlers**

Create `src/app/api/apps/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  clearAppsState,
  listAppsState,
  upsertBundles,
} from '@/lib/repositories/supabase/apps-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';
import type { Activity, AppDocs, Application } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Payloads are validated structurally (JSONB-first design): we check the
 * identity fields the DB keys on and pass the rest through as payload.
 */
const bundleSchema = z.object({
  application: z
    .object({
      id: z.string().min(1),
      displayId: z.string().min(1),
      updatedAt: z.string(),
    })
    .passthrough(),
  activity: z.object({}).passthrough().optional(),
  docs: z.object({}).passthrough().optional(),
});

const putSchema = z.object({ bundles: z.array(bundleSchema).min(1).max(200) });

function adapterDisabled() {
  return NextResponse.json(
    { error: 'supabase adapter disabled — set NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase' },
    { status: 501 },
  );
}

export async function GET() {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  try {
    const state = await listAppsState();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    await upsertBundles(
      parsed.data.bundles.map((bundle) => ({
        application: bundle.application as unknown as Application,
        ...(bundle.activity ? { activity: bundle.activity as unknown as Activity } : {}),
        ...(bundle.docs ? { docs: bundle.docs as unknown as AppDocs } : {}),
      })),
    );
    return NextResponse.json({ ok: true, count: parsed.data.bundles.length });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

export async function DELETE() {
  if (!shouldUseSupabaseAdapter()) return adapterDisabled();
  try {
    await clearAppsState();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 503 });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

Create `src/app/api/apps/import/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { listAppsState, upsertBundles } from '@/lib/repositories/supabase/apps-repository';
import { shouldUseSupabaseAdapter } from '@/lib/supabase/env';
import type { Activity, AppDocs, Application } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const importSchema = z.object({
  applications: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(500),
  activity: z.record(z.string(), z.object({}).passthrough()),
  appDocs: z.record(z.string(), z.object({}).passthrough()),
});

/** One-time carry-over of the local board. Only allowed while the server board is empty. */
export async function POST(request: Request) {
  if (!shouldUseSupabaseAdapter()) {
    return NextResponse.json({ error: 'supabase adapter disabled' }, { status: 501 });
  }
  const body = await request.json().catch(() => null);
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const existing = await listAppsState();
    if (existing.applications.length > 0) {
      return NextResponse.json({ error: 'server board is not empty' }, { status: 409 });
    }
    const { applications, activity, appDocs } = parsed.data;
    await upsertBundles(
      applications.map((app) => {
        const id = app.id as string;
        const act = activity[id];
        const docs = appDocs[id];
        return {
          application: app as unknown as Application,
          ...(act ? { activity: act as unknown as Activity } : {}),
          ...(docs ? { docs: docs as unknown as AppDocs } : {}),
        };
      }),
    );
    return NextResponse.json({ ok: true, count: applications.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
```

- [ ] **Step 8: Verify routes compile and behave end-to-end**

Run: `pnpm typecheck && pnpm lint`
Then with the dev server running (env from Task 1):

```bash
curl -s localhost:3000/api/apps | head -c 400
# expect: {"applications":[],"activity":{},"appDocs":{}}
curl -s -X PUT localhost:3000/api/apps -H 'content-type: application/json' \
  -d '{"bundles":[{"application":{"id":"test-1","displayId":"JT-999","updatedAt":"2026-07-06T00:00:00.000Z","status":"applied","role":"Curl Test"}}]}'
# expect: {"ok":true,"count":1}
curl -s localhost:3000/api/apps | head -c 400
# expect: the JT-999 application in the payload
curl -s -X DELETE localhost:3000/api/apps
# expect: {"ok":true}
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/server/owner.ts src/lib/repositories/supabase/apps-repository.ts \
  src/app/api/apps vitest.config.ts tests/mocks/server-only.ts \
  tests/unit/repositories/apps-repository.test.ts
git commit -m "feat: server apps repository and /api/apps routes"
```

---

### Task 7: Client write-through sync + server hydration

**Files:**
- Create: `src/lib/store/apps-sync.ts`
- Modify: `src/lib/store/apps-store.ts` (call sync after each mutation)
- Modify: `src/lib/store/use-hydration.ts` (server hydration step)
- Test: `tests/unit/store/apps-sync.test.ts`

- [ ] **Step 1: Write the failing sync test**

Create `tests/unit/store/apps-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { queuePersist, __resetSyncForTests } from '@/lib/store/apps-sync';
import { useAppsStore } from '@/lib/store/apps-store';

describe('apps-sync queuePersist', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('NEXT_PUBLIC_PERSISTENCE_ADAPTER', 'supabase');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    useAppsStore.getState().reset();
    __resetSyncForTests();
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
```

Note for the executor: `NEXT_PUBLIC_*` vars are inlined at build time in the browser but resolved via `process.env` under vitest, so `vi.stubEnv` works — implement the adapter check as a function call, not a module-level constant.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit -- tests/unit/store/apps-sync.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the sync module**

Create `src/lib/store/apps-sync.ts`:

```ts
'use client';

/**
 * Fire-and-forget write-through from the Zustand board store to /api/apps.
 * Local state is the optimistic source of truth; this module syncs it to
 * Supabase in the background. Per-application debounce coalesces bursts
 * (drag reorder, contentEditable blurs). One retry, then a warning toast —
 * the local copy is never rolled back.
 */

import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import type { Uuid } from '@/lib/types';

const DEBOUNCE_MS = 400;

function syncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
}

const pending = new Map<Uuid, ReturnType<typeof setTimeout>>();

export function __resetSyncForTests(): void {
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
}

/** Queue a debounced persist of one application's current bundle. */
export function queuePersist(appId: Uuid): void {
  if (!syncEnabled() || typeof window === 'undefined') return;
  const existing = pending.get(appId);
  if (existing) clearTimeout(existing);
  pending.set(
    appId,
    setTimeout(() => {
      pending.delete(appId);
      void flush(appId);
    }, DEBOUNCE_MS),
  );
}

async function flush(appId: Uuid): Promise<void> {
  const state = useAppsStore.getState();
  const application = state.applications.find((app) => app.id === appId);
  if (!application) return;
  const activity = state.activity[appId];
  const docs = state.appDocs[appId];
  const body = JSON.stringify({
    bundles: [
      {
        application,
        ...(activity ? { activity } : {}),
        ...(docs ? { docs } : {}),
      },
    ],
  });
  const ok = await putOnce(body).catch(() => false);
  if (ok) return;
  const retried = await putOnce(body).catch(() => false);
  if (!retried) {
    useUiStore.getState().pushToast({
      kind: 'error',
      message: 'Sync failed — change saved locally only.',
    });
  }
}

async function putOnce(body: string): Promise<boolean> {
  const response = await fetch('/api/apps', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body,
  });
  return response.ok;
}

/** Persist many applications at once (board reorder). Not debounced. */
export async function persistMany(appIds: Uuid[]): Promise<void> {
  if (!syncEnabled() || typeof window === 'undefined' || appIds.length === 0) return;
  const state = useAppsStore.getState();
  const bundles = appIds
    .map((id) => state.applications.find((app) => app.id === id))
    .filter((app): app is NonNullable<typeof app> => Boolean(app))
    .map((application) => ({ application }));
  if (bundles.length === 0) return;
  const response = await fetch('/api/apps', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundles }),
  }).catch(() => null);
  if (!response?.ok) {
    useUiStore.getState().pushToast({
      kind: 'error',
      message: 'Sync failed — board order saved locally only.',
    });
  }
}

export type ServerAppsState = {
  applications: unknown[];
  activity: Record<string, unknown>;
  appDocs: Record<string, unknown>;
};

/**
 * Hydrate the store from the server. Returns 'server' when server data was
 * applied, 'imported' when the local board was carried over to an empty
 * server, 'offline' when the request failed (local data kept).
 */
export async function hydrateFromServer(): Promise<'server' | 'imported' | 'offline'> {
  if (!syncEnabled()) return 'offline';
  const response = await fetch('/api/apps').catch(() => null);
  if (!response?.ok) return 'offline';
  const server = (await response.json()) as ServerAppsState;

  if (server.applications.length === 0) {
    const local = useAppsStore.getState();
    if (local.applications.length > 0) {
      await fetch('/api/apps/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          applications: local.applications,
          activity: local.activity,
          appDocs: local.appDocs,
        }),
      }).catch(() => null);
      return 'imported';
    }
    return 'server';
  }

  useAppsStore.setState({
    applications: server.applications as never,
    activity: server.activity as never,
    appDocs: server.appDocs as never,
  });
  return 'server';
}

/** Clear the server board, then re-import current local state (used by reset). */
export async function resetServer(): Promise<void> {
  if (!syncEnabled() || typeof window === 'undefined') return;
  await fetch('/api/apps', { method: 'DELETE' }).catch(() => null);
  const local = useAppsStore.getState();
  await fetch('/api/apps/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      applications: local.applications,
      activity: local.activity,
      appDocs: local.appDocs,
    }),
  }).catch(() => null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit -- tests/unit/store/apps-sync.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Call sync from every store mutation**

In `src/lib/store/apps-store.ts` add `import { persistMany, queuePersist, resetServer } from '@/lib/store/apps-sync';` — **guard against the import cycle**: `apps-sync` imports `apps-store`, so import lazily inside the actions instead if the bundler complains; the clean pattern is:

```ts
// top of file
import type {} from '@/lib/store/apps-sync'; // (no value import at module scope)

function sync(appId: Uuid): void {
  void import('@/lib/store/apps-sync').then((mod) => mod.queuePersist(appId));
}
function syncMany(appIds: Uuid[]): void {
  void import('@/lib/store/apps-sync').then((mod) => mod.persistMany(appIds));
}
function syncReset(): void {
  void import('@/lib/store/apps-sync').then((mod) => mod.resetServer());
}
```

(If `pnpm build` succeeds with direct static imports — zustand stores tolerate the cycle because access happens at call time — prefer the static import and delete the dynamic wrappers. Decide once, at build time, and keep it consistent.)

Then append sync calls at the end of each action, after `recordAudit`:

- `createCard` → `sync(app.id);` (before `return app;`)
- `updateApp` → `sync(id);`
- `moveStatus` → `sync(id);`
- `reorderInStatus` → `syncMany(orderedIds);`
- `addComment` → `sync(applicationId);`
- `addToWishlist` → `sync(app.id);` (before `return app;`)
- `applyCard` → `sync(id);`
- `archiveApp` → `sync(id);`
- `deleteApp` → `sync(id);`
- `reset` → `syncReset();`

- [ ] **Step 6: Server hydration in `useHydration`**

Replace `src/lib/store/use-hydration.ts`:

```ts
'use client';

import { useEffect, useState } from 'react';
import { hydrateFromServer } from '@/lib/store/apps-sync';
import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';

export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      useAppsStore.persist.rehydrate(),
      useProfileStore.persist.rehydrate(),
      useNotificationsStore.persist.rehydrate(),
    ])
      .then(async () => {
        const outcome = await hydrateFromServer();
        if (outcome === 'offline' && process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase') {
          useUiStore.getState().pushToast({
            kind: 'error',
            message: 'Could not reach the server — showing locally saved data.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return hydrated;
}
```

- [ ] **Step 7: Run all unit tests + typecheck**

Run: `pnpm test:unit && pnpm typecheck && pnpm lint`
Expected: PASS. (Existing hydration-dependent tests must still pass with adapter `local` since `hydrateFromServer` no-ops to `'offline'` and no toast fires.)

- [ ] **Step 8: Manual end-to-end check**

With the dev server + Supabase env:
1. Load `/` — first load imports the local demo board (check `curl -s localhost:3000/api/apps | head -c 200` now returns rows).
2. Create an application via the dialog; drag it between columns; add a comment.
3. DevTools → Application → clear localStorage → reload. The board must come back from the server, including your new card and comment.

- [ ] **Step 9: Commit**

```bash
git add src/lib/store/apps-sync.ts src/lib/store/apps-store.ts src/lib/store/use-hydration.ts \
  tests/unit/store/apps-sync.test.ts
git commit -m "feat: write-through sync and server hydration for the board"
```

---

### Task 8: E2E persistence smoke + full verification + deploy

**Files:**
- Create: `tests/e2e/persistence.spec.ts`
- Modify: Vercel project env (via `vercel env`)

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/persistence.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/**
 * Requires a live Supabase-backed dev server (Task 1 env). Skipped in CI /
 * local runs without the adapter enabled.
 */
const supabaseEnabled =
  process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase' &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);

test.describe('board persistence', () => {
  test.skip(!supabaseEnabled, 'supabase adapter not configured');

  test('manually created application survives localStorage wipe', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /new/i }).first().click();
    await page.getByLabel(/company/i).fill('Persistence Test Co');
    await page.getByLabel(/^role/i).fill('E2E Engineer');
    await page.getByRole('button', { name: /create application/i }).click();
    await expect(page.getByText('E2E Engineer').first()).toBeVisible();

    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByText('Persistence Test Co').first()).toBeVisible({ timeout: 15_000 });
  });
});
```

(Adjust the "New" button locator to the actual TopBar button accessible name — check the rendered markup; if the button is icon-only, target it by `aria-label`.)

- [ ] **Step 2: Run the E2E test**

Run: `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase pnpm test:e2e -- persistence.spec.ts`
Expected: PASS against the local dev server (playwright config starts it). Then run the whole suite: `pnpm test:e2e` — existing specs must still pass (they run with the same env now; if any assert on seed cards that the import preserved, they should be unaffected).

- [ ] **Step 3: Full local verification**

Run: `pnpm typecheck && pnpm lint && pnpm test:unit && pnpm build`
Expected: all green.

- [ ] **Step 4: Push env to Vercel and deploy**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production        # paste value
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production   # paste value
vercel env add SUPABASE_SERVICE_ROLE_KEY production       # paste value
vercel env add NEXT_PUBLIC_PERSISTENCE_ADAPTER production # value: supabase
```

(Repeat for `preview` if preview deployments should persist too.) Then push the branch; verify on the deployed URL: create a card, clear site data, reload — card persists.

- [ ] **Step 5: Final commit + wrap-up**

```bash
git add tests/e2e/persistence.spec.ts
git commit -m "test: e2e persistence smoke for supabase-backed board"
```

Use superpowers:finishing-a-development-branch to decide merge/PR.

---

## Self-review notes (spec coverage)

- Spec §4 DB → Task 1. §5 data model → Tasks 2–3. §6 dialog → Task 4; card editing + archive/delete → Task 5. §7 persistence/hydration/reset → Tasks 6–7. §8 routes → Task 6. §9 errors → Tasks 6–7 (503s, offline toast, sync-failure toast). §10 config → Tasks 1 & 8. §11 testing → each task + Task 8.
- Kill switch honored: every new code path checks `shouldUseSupabaseAdapter()` (server) or `NEXT_PUBLIC_PERSISTENCE_ADAPTER` (client) and no-ops in `local` mode.
- Known accepted risks: `seedUuid(displayId)` id reuse after delete+recreate of the same display number (single user, acceptable; ids are upserts), and `window.confirm`/`window.prompt` for delete/posting-link (plain but functional; can be replaced with styled dialogs later).
