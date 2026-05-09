# Build report

Captured from `pnpm build` (Next.js 15.5.18, production target).

## Route sizes

| Route | Render mode | Page bundle | First Load JS |
| --- | --- | ---: | ---: |
| `/` | Static | 164 B | 160 kB |
| `/_not-found` | Static | 997 B | 103 kB |
| `/jobs` | Static | 164 B | 163 kB |
| `/companies` | Static | 1.56 kB | 161 kB |
| `/research` | Static | 2.51 kB | 162 kB |
| `/profile` | Static | 11.3 kB | 197 kB |
| `/card/[displayId]` | Dynamic | 164 B | 160 kB |
| `/company/[companyId]` | Dynamic | 1.57 kB | 163 kB |
| `/listing/[displayId]` | Dynamic | 1.19 kB | 164 kB |
| `/apply/[displayId]` | Dynamic | 1.65 kB | 193 kB |
| `/(.)card/[displayId]` (intercepted modal) | Dynamic | 162 B | 160 kB |
| `/(.)company/[companyId]` (intercepted modal) | Dynamic | 164 B | 162 kB |
| `/(.)listing/[displayId]` (intercepted modal) | Dynamic | 1.18 kB | 161 kB |
| `/(.)apply/[displayId]` (intercepted modal) | Dynamic | 1.65 kB | 193 kB |
| Shared by all | — | — | 102 kB |

## Notable observations

- **`/profile` is the heaviest route** at 197 kB First Load. It pulls in `react-hook-form` + `zod` + `@radix-ui/react-dialog` + the full `JobTrackerApp` chunk through `AppShell`. Acceptable for v1; if size becomes a concern, lazy-load `ConfirmDialog` and the About edit form.
- **`/apply` parity** between page route and intercepted modal — both 193 kB First Load — confirms intercepted modals share the same chunk, no duplicate code.
- **All 14 routes** are under 200 kB First Load, comfortably within Next.js's recommended budget.

## Component file sizes

`src/components/jobtracker/JobTrackerApp.tsx` is currently ~1360 lines and wraps TopBar, Board, Card Detail, ToastHost, BoardSkeleton, SidePanel, every detail tab, and shared `Icon`/`CompanyLogo` exports used by sibling views.

**Decision (Plan 4 §19):** the file is intentionally retained as-is for v1.

- All v1 functionality works through this consolidated file. Splitting it now risks breaking sibling views (`JobsView`, `ProfileView`, etc.) that import `Icon`, `CompanyLogo`, `CardDetailDialog`, and `PlaceholderApp` from it.
- The decomposition planned in Plan 1 (`src/components/topbar/`, `src/components/board/`, `src/components/card-detail/tabs/*`) is captured as a follow-up — track in a future "Refactor: extract JobTrackerApp" issue.
- No other component file exceeds 500 lines: `ProfileView.tsx` (~430), `ResearchView.tsx` (~290), `JobsView.tsx` (~225), `CompanyDetailDialog.tsx` (~190), `ResumePickerDialog.tsx` (~180).

## Bundle hygiene

- No client component imports Node-only modules. Verified: no `node:fs`, `node:path`, or `process.cwd()` in `src/components/**`.
- Static routes (`/`, `/jobs`, `/companies`, `/research`, `/profile`, `/_not-found`) are server-rendered as static pages; client interactivity lives in the imported `'use client'` view components, which is the intended pattern.
- Dynamic routes (`/card/...`, `/company/...`, `/listing/...`, `/apply/...`) need request-time params; that is correct for these per-record routes.
