# JobTracker — Design

_Status: approved 2026-05-08 (revised after full UI walkthrough)_
_Linear project: https://linear.app/nnetraganti/project/jobtracker-99168ad50e27_
_Repo: https://github.com/agenticCoder97/jobTracker_

## 1. Goal & scope

Single-user web app for tracking job applications, faithfully reproducing the "JobTrack" prototype (Astral dark/gold theme) as a production-grade Next.js app.

**v1 is UI-first.** Mock data only; all interactions persist to `localStorage`. No backend, no auth, no file uploads. The design is wired so a backend can slot in later (replace store actions with API calls) without rewriting components.

**Source of truth for the visual design** is the prototype bundle in `.design-bundle/software-engineer/project/` (HTML + JSX + tokens.css + app.css). Production code reproduces the visual output element-for-element, not the prototype's internal structure.

## 2. Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript strict |
| Styling | Tailwind CSS v4 + `tokens.css` mapped via `@theme inline` |
| State | Zustand + `persist` middleware → `localStorage` |
| UI primitives | Radix UI (Dialog, DropdownMenu, Popover, Tabs, Tooltip, Checkbox, RadioGroup, Select) |
| Drag-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Forms | `react-hook-form` + `zod` |
| Animation | `framer-motion` (modal enter/exit, drag transitions) |
| Dates | `date-fns` |
| Icons | Material Symbols Rounded (Google Fonts) — wrapped in `<Icon name>` with lucide-style alias map |
| Body font | Inter via `next/font/google` |
| Lint | ESLint (Next core-web-vitals + TS strict + import-sort) |
| Format | Prettier + Tailwind plugin |
| Pre-commit | Husky + lint-staged (lint + format staged files) |
| Unit test | Vitest + React Testing Library + jsdom |
| E2E | Playwright (smoke: nav between views, drag a card, edit profile, apply flow) |
| CI | GitHub Actions: typecheck + lint + unit + build on PR |
| Deploy | Vercel native Git integration |
| Package manager | pnpm |
| Backend + DB roadmap | Optional later Supabase Postgres adapter; app must work fully without it |
| Logging roadmap | Local structured audit/app logging first; optional Supabase-backed logs later |

## 3. Project structure

```
jobtracker/
├── src/
│   ├── app/
│   │   ├── layout.tsx              ← TopBar + ToastHost + theme provider + font + Material Symbols stylesheet link
│   │   ├── page.tsx                ← Board (route /)
│   │   ├── @modal/
│   │   │   ├── default.tsx         ← returns null
│   │   │   ├── card/[id]/page.tsx
│   │   │   ├── company/[id]/page.tsx
│   │   │   └── apply/[id]/page.tsx ← Resume Picker Modal (apply flow)
│   │   ├── jobs/page.tsx
│   │   ├── companies/page.tsx
│   │   ├── research/page.tsx
│   │   ├── profile/page.tsx
│   │   └── globals.css             ← imports tokens + tailwind layers + component utilities
│   ├── components/
│   │   ├── topbar/
│   │   │   ├── TopBar.tsx
│   │   │   ├── BrandMark.tsx       ← ★ + JobTrack
│   │   │   ├── NavTabs.tsx         ← Home / Jobs / Companies / Research
│   │   │   ├── SearchTrigger.tsx   ← input + ⌘K kbd
│   │   │   ├── CreateButton.tsx    ← gold pill
│   │   │   ├── NotificationsPopover.tsx ← list + Mark all read + unread dot
│   │   │   └── AvatarDropdown.tsx  ← YO + user menu (Profile/Settings/Notif/Appearance/Help/Logout) with kbd shortcuts
│   │   ├── board/
│   │   │   ├── BoardView.tsx       ← title row + filter bar + 6 columns
│   │   │   ├── TitleRow.tsx        ← h1 "Job Search · Spring 2026" + crumbs + counter
│   │   │   ├── FilterBar.tsx       ← chip group + 4 dropdown filter groups + view toggle
│   │   │   ├── ViewToggle.tsx      ← Board / List / Timeline
│   │   │   ├── Column.tsx          ← header (dot+title+count+more) + cards + Add application
│   │   │   └── ApplicationCard.tsx ← logo + role + company + chips + bar + footer + CTA
│   │   ├── card-detail/
│   │   │   ├── CardDetailDialog.tsx ← Radix Dialog wrapper
│   │   │   ├── CardHeader.tsx       ← crumbs + Apply now + watch/star/share/archive/more/close
│   │   │   ├── CardTitle.tsx        ← contentEditable role title
│   │   │   ├── CompanyLine.tsx      ← logo + company link + location + View original posting
│   │   │   ├── MetaRow.tsx          ← Status + Priority + tag chips + Applied chip + Next action chip
│   │   │   ├── TabBar.tsx           ← 6 tabs with count badges
│   │   │   ├── tabs/
│   │   │   │   ├── OverviewTab.tsx
│   │   │   │   ├── MatchTab.tsx     ← ATS panel (its own tab)
│   │   │   │   ├── ActivityTab.tsx
│   │   │   │   ├── AttachmentsTab.tsx
│   │   │   │   ├── LinkedTab.tsx
│   │   │   │   └── HistoryTab.tsx
│   │   │   └── side/
│   │   │       ├── SidePanel.tsx
│   │   │       ├── StatusGroup.tsx
│   │   │       ├── RoleGroup.tsx
│   │   │       ├── CompensationGroup.tsx ← salary band bar
│   │   │       ├── TimelineGroup.tsx
│   │   │       ├── SourceGroup.tsx       ← tags + add tag
│   │   │       └── WatchersGroup.tsx     ← avatar stack + add watcher
│   │   ├── company-detail/
│   │   │   ├── CompanyDetailDialog.tsx
│   │   │   ├── CompanyHero.tsx     ← 64px logo + meta line + tags + Follow
│   │   │   ├── KpiGrid.tsx         ← 4 stat cards
│   │   │   ├── OpenRolesSection.tsx
│   │   │   ├── PipelineSection.tsx
│   │   │   └── ReviewsSection.tsx
│   │   ├── jobs/
│   │   │   ├── JobsView.tsx
│   │   │   ├── JobsHeader.tsx      ← title + crumbs + counter + filter bar
│   │   │   ├── JobsFilterBar.tsx   ← search + 4 scope chips + Status + Mode dropdowns
│   │   │   └── JobsTable.tsx       ← 7 columns
│   │   ├── companies/
│   │   │   ├── CompaniesView.tsx
│   │   │   ├── CompaniesFilterBar.tsx ← search + 4 sort chips
│   │   │   ├── CompanyGrid.tsx
│   │   │   └── CompanyCard.tsx     ← logo + name + industry/HQ + Glassdoor + size + comp + CEO% + tags + actions
│   │   ├── research/
│   │   │   ├── ResearchView.tsx
│   │   │   ├── ResearchHero.tsx       ← 2 cards (Daily spotlight + Momentum)
│   │   │   ├── DailyPicksSection.tsx
│   │   │   ├── PickCard.tsx           ← with toggleable Add/On wishlist state
│   │   │   ├── PipelineKpisSection.tsx
│   │   │   ├── MarketTrendsSection.tsx ← Comp by level + Skill demand
│   │   │   ├── LinkedInSection.tsx     ← 3 cards
│   │   │   ├── PeopleCard.tsx         ← People to connect with
│   │   │   ├── InMailCard.tsx         ← Recruiter InMail
│   │   │   ├── EventsCard.tsx         ← Events near you
│   │   │   └── WatchedCompaniesSection.tsx ← grid + dashed add card
│   │   ├── profile/
│   │   │   ├── ProfileView.tsx
│   │   │   ├── ProfileHero.tsx        ← bg + 80px photo + name + pronouns + open-to-work + headline + meta + links + Edit/Share/Settings
│   │   │   ├── ProfileTabs.tsx        ← Overview/Resumes/Cover letters/Preferences/Activity + completion bar
│   │   │   ├── tabs/
│   │   │   │   ├── ProfileOverviewTab.tsx ← About + Experience + Education + Skills + Languages+Certs row + Achievements
│   │   │   │   ├── ResumesTab.tsx     ← ResumeManager kind=resume
│   │   │   │   ├── CoverLettersTab.tsx ← ResumeManager kind=cover
│   │   │   │   ├── PreferencesTab.tsx ← Search preferences card with 6 sections
│   │   │   │   └── ActivityTab.tsx    ← Recent activity card
│   │   │   ├── ResumeManager.tsx      ← kind=resume|cover; rows with icon + name + Default + flavor + meta + keywords + actions
│   │   │   └── side/
│   │   │       ├── SnapshotCard.tsx        ← Active / Resumes / Covers / Skills
│   │   │       ├── CompletenessCard.tsx    ← checklist with Add links
│   │   │       └── WhoViewedCard.tsx       ← 3 viewer rows + See all
│   │   ├── apply/
│   │   │   └── ResumePickerModal.tsx  ← Apply flow modal (radio group of resumes + optional cover letter + Submit)
│   │   └── ui/
│   │       ├── Dialog.tsx             ← Radix wrapper
│   │       ├── DropdownMenu.tsx
│   │       ├── Popover.tsx
│   │       ├── Tabs.tsx
│   │       ├── Tooltip.tsx
│   │       ├── Pill.tsx
│   │       ├── Chip.tsx               ← with priority/tag/status variants
│   │       ├── StatusPill.tsx         ← popover-driven status switcher (used in card head + side panel + jobs table cell)
│   │       ├── PriorityPill.tsx       ← popover-driven priority switcher
│   │       ├── CompanyLogo.tsx        ← initial-on-bg logo, ring/dark variants
│   │       ├── Avatar.tsx             ← team member avatar
│   │       ├── AvatarStack.tsx
│   │       ├── ProgressBar.tsx
│   │       ├── ScoreBar.tsx           ← ats horizontal bar
│   │       ├── ScoreRing.tsx          ← ats big number variant
│   │       ├── Toast.tsx + ToastHost.tsx
│   │       ├── Icon.tsx               ← lucide→Material Symbols ICON_MAP wrapper
│   │       ├── Kbd.tsx                ← keyboard shortcut display
│   │       ├── GoldButton.tsx
│   │       └── EmptyState.tsx
│   ├── lib/
│   │   ├── store/
│   │   │   ├── apps-store.ts
│   │   │   ├── profile-store.ts
│   │   │   ├── notifications-store.ts
│   │   │   ├── ui-store.ts
│   │   │   └── persist-config.ts
│   │   ├── data/seed/
│   │   │   ├── statuses.ts
│   │   │   ├── companies.ts
│   │   │   ├── company-details.ts
│   │   │   ├── team.ts
│   │   │   ├── applications.ts
│   │   │   ├── activity.ts
│   │   │   ├── notifications.ts
│   │   │   ├── daily-picks.ts
│   │   │   ├── job-listings.ts
│   │   │   ├── market-salaries.ts
│   │   │   ├── market-skills.ts
│   │   │   ├── linkedin.ts
│   │   │   ├── companies-watch.ts
│   │   │   ├── profile.ts
│   │   │   ├── resumes.ts
│   │   │   ├── cover-letters.ts
│   │   │   └── app-docs.ts
│   │   ├── icon-map.ts                ← lucide name → Material Symbols glyph mapping (ported verbatim from prototype)
│   │   ├── utils/ats.ts               ← computeAts() + grade label/color
│   │   ├── utils/dates.ts             ← daysFrom/daysAgo, fmtDate
│   │   ├── utils/cn.ts                ← clsx + tailwind-merge
│   │   └── types/                     ← Application, Resume, CoverLetter, Company, JobListing, Profile, Activity, Notification, AtsResult
│   └── styles/tokens.css              ← ported verbatim from prototype
├── tests/{unit,e2e}/
├── .github/workflows/ci.yml
├── .husky/pre-commit
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

## 4. Routing model

URL is the source of truth for which view is open and (where applicable) which modal is overlaid. Modals are implemented with the App Router **parallel route + intercepting route** pattern so the same URL renders correctly whether reached by in-app navigation (modal overlay) or by direct hit / refresh (modal still appears, with a stable underlying view).

### URL table

All URLs are absolute paths. There are no "current-view-relative" modal URLs.

| URL | View / behavior |
| --- | --- |
| `/` | Board |
| `/jobs` | Jobs table |
| `/jobs?scope=matched&q=…&status=…&mode=…` | Jobs with filters from URL search params (see §6 for canonical-state rules) |
| `/companies` | Companies grid |
| `/research` | Research |
| `/profile` | Profile, Overview tab |
| `/profile?tab=resumes\|covers\|preferences\|activity` | Profile with tab pre-selected |
| `/card/[displayId]` | Card detail (modal overlay on Board if reached via in-app nav; modal over Board if direct-loaded) |
| `/company/[companyId]` | Company detail (same pattern) |
| `/apply/[displayId]` | Resume picker / apply flow (same pattern) |

`[displayId]` is the human-readable application id like `JT-42`. Internally the store keys by UUID; `displayId` is the URL-stable handle (see §5).

### File-system layout (concrete)

```
src/app/
├── layout.tsx                       ← declares parallel slots: { children, modal }
├── @modal/
│   ├── default.tsx                  ← returns null (when no modal open)
│   ├── (.)card/[displayId]/page.tsx     ← intercepts /card/[id] from / (Board)
│   ├── (.)company/[companyId]/page.tsx
│   ├── (.)apply/[displayId]/page.tsx
│   ├── (..)jobs/(.)card/[displayId]/page.tsx     ← intercepts /card/[id] from /jobs
│   ├── (..)jobs/(.)company/[companyId]/page.tsx
│   ├── (..)jobs/(.)apply/[displayId]/page.tsx
│   ├── (..)companies/(.)card/[displayId]/page.tsx
│   ├── (..)companies/(.)company/[companyId]/page.tsx
│   ├── (..)companies/(.)apply/[displayId]/page.tsx
│   ├── (..)research/(.)card/[displayId]/page.tsx
│   ├── (..)research/(.)company/[companyId]/page.tsx
│   ├── (..)research/(.)apply/[displayId]/page.tsx
│   ├── (..)profile/(.)card/[displayId]/page.tsx
│   ├── (..)profile/(.)company/[companyId]/page.tsx
│   └── (..)profile/(.)apply/[displayId]/page.tsx
├── page.tsx                         ← Board (route /)
├── jobs/page.tsx
├── companies/page.tsx
├── research/page.tsx
├── profile/page.tsx
├── card/[displayId]/page.tsx        ← canonical full route (direct-load fallback)
├── company/[companyId]/page.tsx     ← canonical full route
└── apply/[displayId]/page.tsx       ← canonical full route
```

The `(.)` and `(..)` segments are Next.js intercepting-route prefixes — `(.)` intercepts a sibling segment, `(..)` intercepts one level up. To keep the modal overlaid on whatever underlying view the user came from, every top-level view needs its own intercepting copy.

The canonical (non-intercepted) `card/[displayId]/page.tsx` etc. are reached only on direct URL load (browser refresh, paste-link, copy-as-Markdown). These routes render `<Board />` (or chosen default underlay) plus the modal in the same render tree, so the experience is identical to in-app navigation.

To minimize file duplication, the modal page bodies are thin shells:

```tsx
// app/@modal/(.)card/[displayId]/page.tsx
import { CardDetailDialog } from '@/components/card-detail/CardDetailDialog';
export default function Page({ params }: { params: { displayId: string } }) {
  return <CardDetailDialog displayId={params.displayId} />;
}
```

All 4 intercepting copies + the canonical route delegate to the same `CardDetailDialog`. Same pattern for Company and Apply.

### Closing modals

`CardDetailDialog` calls `router.back()` on Esc / X / backdrop click. If there's no in-app history (direct load), `router.back()` falls through to `router.replace(referrerView ?? '/')` — the dialog reads the underlying segment via `useSelectedLayoutSegment()` and falls back to `/`.

### Why parallel + intercepting (vs. simpler patterns)

A pure state-driven dialog (no URL change) is simpler but loses URL shareability and back-button. A non-intercepted modal route loses the underlying-view backdrop on refresh. Parallel + intercepting is the App Router idiom for exactly this trade-off.

## 5. Data model (TypeScript types)

All types in `src/lib/types/index.ts`. Backend-compatible from day one (UUID primary keys, audit timestamps, owner scoping). Display IDs from the prototype (`JT-42`) live alongside as `displayId` — used for URLs and human reference, never as a foreign key.

```ts
// ─── Primitives ──────────────────────────────────────────────────────────
type Uuid = string;                   // crypto.randomUUID()
type IsoDateTime = string;            // ISO-8601 with timezone
type IsoDate = string;                // YYYY-MM-DD
type StatusId = 'wishlist' | 'applied' | 'screen' | 'interview' | 'offer' | 'rejected';
type Priority = 'high' | 'med' | 'low';
type CompanyId = string;              // slug-style key into companies record (e.g. 'stripe')
type TeamId = string;                 // 'me' | 'dana' | 'marc' | 'priya'
type RemoteMode = 'Remote' | 'Hybrid' | 'Onsite';

// Owner/audit base — every mutable user-owned entity carries these.
type Audited = {
  id: Uuid;
  ownerUserId: Uuid;                  // fixed demo user in v1
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
};

// ─── Applications ───────────────────────────────────────────────────────
type Application = Audited & {
  displayId: string;                  // 'JT-42' — used for URLs, not for FK
  status: StatusId;
  company: CompanyId;
  role: string;
  location: string;
  remote: RemoteMode;
  salaryMin: number;
  salaryMax: number;
  equity?: string;
  level: string;
  team: string;
  posted: IsoDate;
  applied: IsoDate | null;
  lastActivity: IsoDateTime;
  priority: Priority;
  source: string;
  referral?: string;
  progress: number;                   // 0-100
  tags: string[];
  description?: string;
  requirements?: string[];
  contacts?: Contact[];
  nextAction?: string;
  nextActionDue?: IsoDate;
  rejectedReason?: string;
  offer?: { base: number; bonus: number; equity: number; total: number };
  match?: number;
  sourceListingId: Uuid | null;       // FK to JobListing if added from Jobs/Research
  sortIndex: number;                  // per-status ordering; see §8.2 sort-precedence
  archivedAt: IsoDateTime | null;
};

type Contact = { name: string; role: string; email: string };

// ─── Activity (per-application sub-collections) ─────────────────────────
type Activity = {
  comments: Comment[];
  history: HistoryEvent[];
  links: ApplicationLink[];
  attachments: Attachment[];
};
type Comment = { id: Uuid; who: TeamId; when: IsoDateTime; text: string };
type HistoryEvent = {
  id: Uuid;
  type: 'created' | 'status' | 'field' | 'attach' | 'comment' | 'link' | 'document';
  when: IsoDateTime;
  who: TeamId;
  text: string;
};
type ApplicationLink = { id: Uuid; type: string; title: string; meta: string };
type Attachment = {
  id: Uuid;
  name: string;
  kind: 'pdf' | 'zip' | 'xls' | 'img' | 'ics';
  size: string;
  when: IsoDateTime;
};

// ─── Notifications (immutable rows + per-user read/dismiss state) ────────
type Notification = {
  id: Uuid;
  // Immutable content — produced by future backend or seed.
  title: string;
  meta: string;
  createdAt: IsoDateTime;
};
// Per-user state lives in useNotificationsStore as:
//   readAt:      Record<Uuid, IsoDateTime>
//   dismissedAt: Record<Uuid, IsoDateTime>
// `read` is derived: !!readAt[notification.id]. Never stored on Notification.

// ─── Resumes / cover letters / app docs ──────────────────────────────────
type Resume = Audited & {
  name: string;
  flavor: string;
  file: string;                       // metadata-only label in v1
  size: string;
  pages: number;
  updated: IsoDateTime;
  isDefault: boolean;
  keywords: string[];
  summary: string;
  timesUsed: number;
};
type CoverLetter = Audited & {
  name: string;
  flavor: string;
  file: string;
  size: string;
  updated: IsoDateTime;
  isDefault: boolean;
  timesUsed: number;
};
type AppDocs = {
  applicationId: Uuid;
  resumeId: Uuid;
  coverLetterId: Uuid | null;
  ats: AtsResult;
};
type AtsResult = {
  required: string[]; nice: string[]; reqHit: number; niceHit: number; score: number;
  edits: string[]; missingHard: string[]; missingSoft: string[];
  rewrites: { from: string; to: string }[];
};

// ─── Profile ────────────────────────────────────────────────────────────
type Profile = Audited & {
  name: string;
  handle: string;
  email: string;
  phone: string;
  location: string;
  pronouns: string;
  headline: string;
  about: string;
  links: ProfileLink[];
  openToWork: boolean;
  preferences: SearchPrefs;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
  certifications: Cert[];
  achievements: string[];
  completeness: { sections: ProfileCompletenessSection[] };
};
type ProfileLink = { label: string; url: string; icon: string };
type SearchPrefs = {
  roles: string[];
  remote: string[];
  minComp: number;
  industries: string[];
  avoid: string[];
  notice: string;
};
type Experience = {
  id: Uuid;
  company: CompanyId;
  role: string;
  from: string;                       // free-text "Mar 2023" — not parsed
  to: string;                         // "Present" | "Feb 2023"
  dur: string;                        // "3 yrs"
  location: string;
  bullets: string[];
};
type Education = {
  id: Uuid;
  school: string;
  degree: string;
  from: string;
  to: string;
  detail: string;
};
type Skill = { name: string; level: 1 | 2 | 3 | 4 | 5; years: number; endorsements: number };
type Language = { name: string; level: 'Native' | 'Conversational' | 'Beginner' };
type Cert = { name: string; issuer: string; when: string };
type ProfileCompletenessSection = { id: string; label: string; done: boolean };

// ─── Companies (immutable mock content for v1) ──────────────────────────
type Company = { id: CompanyId; name: string; bg: string; initial: string; ring?: boolean; dark?: boolean };
type CompanyDetail = {
  id: CompanyId;
  industry: string; hq: string; size: string; founded: number;
  rating: number; ceoApproval: number; recommendFriend: number; openRoles: number;
  interviewDifficulty: number; medianComp: number; fundingStage: string;
  tags: string[];
  // All marked-as-demo fields here (rating, ceoApproval, etc.) render with
  // a subtle "Demo data" pill in the UI — see §8.13 / §8.14.
};

// ─── Job listings (untracked, discoverable in Jobs + Research) ──────────
type JobListing = {
  id: Uuid;
  displayId: string;                  // 'JL-101'
  company: CompanyId;
  role: string;
  location: string;
  remote: RemoteMode;
  salaryMin: number;
  salaryMax: number;
  posted: IsoDate;
  match: number;
  tags: string[];
  saved: boolean;
};

type DailyPick = {
  id: Uuid;
  company: CompanyId;
  role: string;
  location: string;
  salary: string;
  match: number;
  why: string[];
  posted: string;                     // free-text "2 days ago"
  applicants: string;
};

// ─── Demo user (single fixed user in v1) ────────────────────────────────
const DEMO_USER_ID: Uuid = '00000000-0000-0000-0000-000000000001';
```

**ID convention:** components and stores key by `Uuid`. URLs use `displayId` for applications/listings (`/card/JT-42`) and the `companyId` slug for companies (`/company/stripe`). Repositories translate `displayId ↔ id` at the boundary.

## 6. State management

State has **two tiers**: URL search params (canonical for view/filter/tab state that should be shareable) and Zustand stores (canonical for everything else). There is no duplication — if a value lives in the URL, components read it from `useSearchParams()` directly and there is no store mirror.

### Canonical-state authority

| State | Source of truth | Reason |
| --- | --- | --- |
| Top-level view (`/`, `/jobs`, …) | URL pathname | Shareable, refresh-stable, native browser nav |
| Open modal id (`/card/[displayId]`, `/company/[companyId]`, `/apply/[displayId]`) | URL pathname | Same |
| Jobs filters (`scope`, `q`, `status`, `mode`) | URL search params | Shareable filtered views (e.g., Research → Jobs deep link) |
| Profile tab (`tab=resumes`) | URL search params | Shareable Profile section |
| Board filters, board sort mode, board view mode | Zustand `useUiStore` | Workspace-private; not part of shareable URL surface |
| Companies search + sort | Zustand `useUiStore` | Workspace-private |
| Persisted domain data (apps, profile, resumes, notifications) | Zustand persisted stores | localStorage-backed |
| Toasts | Zustand `useUiStore` (ephemeral) | Transient runtime state |

URL-canonical state is read via small typed wrappers (`useJobsParams()`, `useProfileTabParam()`) that parse `useSearchParams()` and return defaults when missing. Mutations call `router.replace(buildUrl(next))` — no duplicate store update. This is finding-#4 explicit.

### Stores

**Four Zustand stores**, each with a single responsibility. Persisted ones use `persist` middleware with a versioned migrate function. All store actions delegate through repositories (see §11.5) so the same call signatures work later against Supabase.

#### `useAppsStore` (persisted, key `jobtracker:apps:v1`)

- `applications: Application[]`
- `activity: Record<Uuid, Activity>`               // keyed by application UUID
- `appDocs: Record<Uuid, AppDocs>`
- `statusSortMode: Record<StatusId, SortMode>`     // see "Board sort precedence" below
- Actions: `moveStatus(id, newStatus)`, `reorderInStatus(statusId, orderedIds)`, `updateApp(id, patch)`, `createCard(statusId)`, `addToWishlist(jobLike)`, `applyCard(id, { resumeId, coverLetterId })`, `addComment(id, text)`, `addAttachment(id, fileMeta)`, `addLink(id, link)`, `linkResume(id, resumeId)`, `linkCoverLetter(id, clId)`, `setStatusSortMode(statusId, mode)`.
- Every mutation appends a `HistoryEvent`, bumps `updatedAt`, bumps `lastActivity`, and emits an `audit_events` log entry (§11.5). `applyCard` also sets `applied=today`, bumps `progress` to ≥20, and calls `useProfileStore.getState().incrementResumeUse(...)` for the linked docs.

#### `useProfileStore` (persisted, key `jobtracker:profile:v1`)

- `profile: Profile`, `resumes: Resume[]`, `coverLetters: CoverLetter[]`
- Actions: `updateProfile(patch)`, `updateAbout(text)`, `addResume(meta)`, `removeResume(id)`, `setDefaultResume(id)`, `editResume(id, patch)`, `incrementResumeUse(id)` (and the cover-letter analogues).
- Resumes/CLs are metadata-only in v1: `file` is a label string, not a binary.
- `updateAbout` is the single editable profile field in v1 (see finding #11). Other Edit affordances are demo-only (§8.17).

#### `useNotificationsStore` (persisted, key `jobtracker:notifications:v1`)

- `notifications: Notification[]`                  // immutable content
- `readAt: Record<Uuid, IsoDateTime>`              // per-user state
- `dismissedAt: Record<Uuid, IsoDateTime>`         // per-user state
- Selectors: `selectUnread(state)` returns `notifications.filter(n => !readAt[n.id] && !dismissedAt[n.id])`.
- Actions: `markRead(id)`, `markAllRead()`, `dismiss(id)`.
- This is finding-#7 explicit: notifications are immutable; read/dismissed state is per-user. No `read: boolean` on the row.

#### `useUiStore` (NOT persisted, in-memory only)

- Board: `boardFilters` (chip set), `boardCompanyFilter`, `boardLocationFilter`, `boardTagsFilter`, `boardViewMode` ('board'|'list'|'timeline').
- Companies: `companiesSearch`, `companiesSort` ('rating'|'open'|'comp'|'name').
- `toasts` — ephemeral.

URL-canonical state (`jobsScope`, `jobsSearch`, `jobsStatusFilter`, `jobsRemoteFilter`, `profileTab`) is **not** in this store.

### Board sort precedence (finding #8)

`SortMode = 'manual' | 'lastActivity' | 'priority' | 'dateApplied'`. Default is `'lastActivity'`. Per-status — i.e., each column can have its own mode (matches the prototype's per-column 3-dot menu).

Resolution rules (deterministic):

1. **`mode === 'manual'`** — order by `sortIndex` ascending, ties broken by `updatedAt` descending. `sortIndex` is contiguous integers per (status). Set by `reorderInStatus` (drag) and by promoting the current order when user picks "Manual" from the column menu.
2. **`mode === 'lastActivity'`** — order by `lastActivity` descending, ties by `updatedAt` descending.
3. **`mode === 'priority'`** — order by `priority` (high > med > low), then `lastActivity` descending.
4. **`mode === 'dateApplied'`** — order by `applied ?? posted` descending.

Effects of mutations:

- **Drag within a column**: forces `mode = 'manual'`, recomputes `sortIndex` for that status, appends history event `field: 'Reordered manually'`.
- **Drag across columns** (status change): card lands at the **end** of the destination column. If destination is in `manual` mode, `sortIndex` = `max(sortIndex)+1`. The source column closes its gap (`sortIndex` recompacted).
- **Pick a non-manual sort from column menu**: sets `mode`. `sortIndex` is preserved (so user can switch back to "Manual" without losing their manual order).
- **Field edit (priority, applied, etc.)**: re-renders affected rows, no precedence change.

UI: column header shows the current mode label next to the count when not `lastActivity` (the default). `is-manual-mode` chip is gold when manual.

### Versioned migrate

Future schema bumps run `migrate(persistedState, fromVersion)` per store, seed-merging new fields with defaults. Migration failures fall back to seed + log an `app_logs` entry (see §11.5).

### Reset to defaults

A small "Reset demo data" muted button at the bottom of the Profile side column. Confirm dialog → wipes all `jobtracker:*` localStorage keys → reloads.

### SSR-safety

Stores guard `localStorage` access during SSR; a `useHydration` hook delays render of persisted-state-dependent UI until client hydration completes. Server-rendered shell renders skeleton placeholders (matches prototype's empty states) for first paint.

## 7. Seed data

The prototype's `data.js` and `profile-data.js` port to typed `.ts` files under `src/lib/data/seed/`. Field names and shapes from the prototype are preserved, but each mutable entity is augmented with the `Audited` fields (`id: Uuid`, `ownerUserId: DEMO_USER_ID`, `createdAt`, `updatedAt`, `deletedAt: null`) and applications carry both `id: Uuid` and `displayId` (the prototype's `'JT-42'`). UUIDs in the seed are deterministic — generated once with `crypto.randomUUID()` and committed as constants — so test snapshots and audit logs stay stable.

The `daysAgo()` helper anchors to a fixed `today = '2026-05-08'` so the relative dates stay consistent. `lib/utils/dates.ts` exposes `daysFrom(date, anchor)` for runtime calculations.

On first run (no persisted state), stores hydrate from seed via the local repository adapter (§11.5). After that, persisted state wins. "Reset demo data" wipes all `jobtracker:*` keys and re-hydrates.

## 8. View specs (full UI element enumeration)

### 8.1 TopBar (rendered in root layout, every view)

Single horizontal bar:

- **Brand** — gold star (★) glyph + "JobTrack" wordmark. Gold accent.
- **Nav tabs** — 4 buttons with icons: `Home` (space_dashboard), `Jobs` (list), `Companies` (apartment), `Research` (explore). Active tab gets `gold-soft` background pill + gold text.
- **Search input** — pill-shaped, search icon + placeholder `"Search applications, companies, notes…"` + `<kbd>⌘K</kbd>` glyph on the right. Clicking opens `/jobs` with search input focused.
- **Create button** — gold pill with `add` icon + "Create" label. Click → creates a wishlist card and opens `…/card/<new-id>` modal.
- **Notifications icon button** — bell icon. If `unread > 0`, an absolutely-positioned blue dot. Click → `NotificationsPopover`.
- **Avatar button** — circular, shows "YO" initials in white-on-dark; on open gets gold ring. Click → `AvatarDropdown`.

#### NotificationsPopover

- Header: "Notifications" h4 + "Mark all read" link aligned right.
- List: each row = colored dot (gold if unread, muted if read) + title (white, semibold) + meta (muted, small). Up to 5 visible; scroll for more.

#### AvatarDropdown (user menu)

- Header row: 36px avatar "YO" + name "You · @youruser" + email "you@example.com".
- Separator.
- Menu items (icon + label + optional kbd shortcut on right):
  - `Profile` (person, ⌘P) — navigates to `/profile`.
  - `Account settings` (settings, ⌘,) — no-op for v1.
  - `Notification preferences` (notifications) — no-op for v1.
  - `Appearance: Dark` (dark_mode) — no-op for v1.
  - `Help & shortcuts` (help) — no-op for v1.
- Separator.
- `Log out` (logout, ⌃⌘Q) — danger-red text. No-op for v1.

### 8.2 Board (`/`)

#### Title row

- h1: `"Job Search · Spring 2026"` (display-size, white, tight letter-spacing).
- Breadcrumbs: `"Workspace / Personal / Board"` (muted; "Personal" highlighted).
- Counter: `"<b>X</b> applications · <b>Y</b> active"` (active = status ≠ rejected).

#### Filter bar (single horizontal row, wraps if narrow)

- 6 **filter chips** (chip + icon + label + count badge): All (`inbox`), Mine (`person`), High prio (`local_fire_department`), Action this week (`event`), Remote only (`public`), Has referral (`group`). Active chip gets gold-tint background.
- Vertical divider line.
- 4 **dropdown filter groups**: Company (`apartment` icon + `chevron_down`), Location (`location_on`), Tags (`label`), `Sort: Last activity` (`swap_vert`). Each opens a Radix DropdownMenu with options.
- Right-aligned **view toggle** — 3 segmented buttons: Board (active, `view_column`), List (`list`), Timeline (`calendar_today`). Only Board is functional in v1; List + Timeline render `EmptyState` placeholder ("Coming soon").

#### Columns (6, one per `STATUS`)

- **Header**: colored dot (status color) + title + count number + 3-dot more button (Radix DropdownMenu — actions: Sort by date / Sort by priority / Collapse — Sort actions are functional, Collapse is no-op for v1).
- **Card list**: scrollable; each card is `<ApplicationCard>` (drag source via dnd-kit `useSortable`).
- **Add application** button at the bottom of each column — pill with `add` icon + "Add application". Click → `createCard(statusId)`, opens new card modal.
- Column gets `is-drag-over` outline when a card hovers over it.

#### ApplicationCard

- **Top row**: 32px CompanyLogo + role title (white, semibold, 2-line clamp) + company name (link to company modal) + remote mode chip ("Remote"/"Hybrid"/"Onsite").
- **Chips row**: priority chip (icon + label, color-coded — high red, med muted, low blue), salary chip ($XXX–$YYYK), up to 2 tag chips.
- **Progress bar**: thin horizontal bar, gold fill at `progress%`, tooltip "X% through pipeline".
- **Footer row**: `JT-XX` ID (mono small), `Xd` chip with calendar icon (days since applied/posted), comment count + chat icon, attachment count + paperclip icon, spacer, owner Avatar (22px).
- **CTA row** (full width):
  - If `status === 'wishlist'`: gold pill "Apply now" with rocket icon → opens `…/apply/<id>` modal.
  - Else: muted pill "Track" with external_link icon → opens card detail modal.
- Visual states: `is-dragging` (opacity 0.5, scale 0.98).

### 8.3 Card Detail Modal (`@modal/card/[id]`)

Radix `Dialog` with full-viewport backdrop. Press Esc / click backdrop / click X → `router.back()`. Modal body is a 2-column grid (main + side panel), max-width ~1100px.

#### Modal head (sticky)

- Left: breadcrumbs `[view_column] Job Search · Spring 2026 [chevron_right] JT-XX`.
- Spacer.
- Right buttons cluster:
  - If `status === 'wishlist'`: primary "Apply now" pill (rocket icon).
  - Watch (`visibility`), Star (`star`), Share (`share`), Archive (`archive`), More (`more_horiz`), Close (`close`) — all icon-only buttons with tooltips.

#### Modal main (left column, scrollable)

1. **Title** — h1, contentEditable; on blur dispatches `updateApp({ role })`.
2. **Company line** — 24px CompanyLogo + company name link + location + " · " + "View original posting" link (external_link icon).
3. **Meta row** (flex-wrap):
   - `StatusPill` (colored dot + status name + chevron_down → popover with all statuses, current marked with check).
   - `PriorityPill` (icon + label + popover).
   - Tag chips (each a `Chip is-tag`).
   - `Applied <date>` chip with calendar icon.
   - `Next action` chip in gold-tint with bell icon (truncated to first sentence of `nextAction`).
4. **Tab bar** (6 tabs, icon + label + optional count badge):
   - Overview (`description`)
   - Match (`auto_awesome`) — count only if there's a score
   - Activity (`chat_bubble`) + count
   - Attachments (`attachment`) + count
   - Linked (`link`) + count
   - History (`history`) + count
   - Active tab gets gold underline + white text.
5. **Tab content** — see 8.4 / 8.5 / 8.6 / 8.7 / 8.8 / 8.9 below.

#### Modal side (right column, scrollable independently)

`SidePanel` — see 8.10.

### 8.4 OverviewTab

Stack of sections (each: small h4 with leading icon + content):

- **About the role** (`description` icon) — `app.description` paragraph.
- **What they want** (`check_circle` icon) — bulleted `app.requirements` list.
- **Next action** (`notifications` icon) — callout: dark elevated background, alarm icon + text + "Mark done" check button on the right.
- **Offer breakdown** (`card_giftcard` icon) — only if `app.offer`. 4-column grid of stat tiles: `Base` / `Bonus` / `Equity / yr` / `Total / yr`. Total tile uses gold text. Each tile = uppercase tiny caption + big number.
- **Rejection reason** (`cancel` icon, error-red heading) — only if `app.rejectedReason`. Red-tinted callout box.

### 8.5 MatchTab (ATS)

Three-section layout:

1. **Documents linked to this application** (`description` icon)
   - Resume row: gold-tinted icon (file_text) + name + meta (file · size · updated date) + Preview button + Swap button (opens dropdown of other resumes).
   - Cover letter row (if linked): blue-tinted icon (mail) + name + meta + Preview + Swap. If no cover letter linked, "Add cover letter" button.

2. **ATS match score** (`auto_awesome` icon)
   - Big colored score number (color = grade-derived: ≥85 success-green, ≥70 gold, ≥50 warning, else error). `<num>%` format.
   - Grade label: `Excellent` / `Strong` / `Moderate` / `Weak` `match`.
   - Sub line: `<reqHit>/<required.length> required keywords · <niceHit>/<nice.length> nice-to-haves present`.
   - Horizontal `ScoreBar` — fill width = score%, color = grade color.

3. **Keyword coverage** (`label` icon) — 2-column grid:
   - Left: "Required (N)" header + chip list. Hit chips: green-tint with `check`. Miss chips: red-tint with `close`.
   - Right: "Nice-to-have (N)" + chip list. Hit chips: green-tint. Miss chips: muted-tint with `remove`.

4. **Suggested edits to improve your match** (`edit` icon) — only if `ats.edits.length > 0`. Numbered list (gold circle number); each item: text + "Apply" button (mock).

5. **Suggested bullet rewrites** (`edit` icon) — only if `ats.rewrites.length > 0`. Each rewrite is a 2-row card: "Current" line (red-tint label) + bullet text, "Suggested" line (green-tint label) + new text, "Use this" gold button.

If no `appDocs[id]`: render an EmptyState — "Link a resume to this application to see how well it matches the role" + "Link resume" button.

### 8.6 ActivityTab

- **Comment input** (composite control):
  - Textarea: placeholder "Leave a comment, log a call, or @mention someone…"
  - Action row below: 3 icon buttons left (attach, mention, emoji), spacer, Cancel (clears input), Comment (gold pill, disabled if empty). Submit → `addComment` action.
- **Comment thread** below:
  - Each item: 32px team-color avatar (initial) + bubble (name in white bold + timestamp + body text).
  - Empty state: "No comments yet. Log your first thought above." centered, muted, in dashed border box.

### 8.7 AttachmentsTab

- Action row: "Upload file" (gold pill, upload icon) + "Attach link" (muted pill, link icon).
- If empty: dashed-border empty state "Drop files here, or click upload above."
- Else: grid of attach cards. Each card: large kind-colored icon (PDF→red `description`, ZIP→gold `folder_zip`, XLS→green `table_chart`, IMG→blue `image`, ICS→warning `calendar_today`, other→muted `insert_drive_file`) + filename (truncate-ellipsis) + meta (size · date).

### 8.8 LinkedTab

- Action row: "Link item" (gold) + "Link to another card" (muted, fork_right icon).
- If empty: "No linked items yet."
- Else: list of linked rows. Each row: small type badge (e.g., `JD`, `NOTE`, `JT-39`) + title + meta (muted) + external_link icon.

### 8.9 HistoryTab

- If empty: "No activity yet."
- Else: timeline (most-recent first). Each row: type-icon (`add_circle` for created, `arrow_circle_right` for status, `edit` for field, `attachment` for attach, `chat_bubble` for comment) + text + right-aligned date.

### 8.10 SidePanel (right column of card detail)

6 grouped sections (each: small uppercase muted h5 + label/value rows):

1. **Status**
   - Stage → StatusPill (popover-driven).
   - Priority → PriorityPill.
   - Owner → Avatar(me) + "You".
2. **Role**
   - Company → 18px logo + name (link to company modal).
   - Level (text).
   - Team (text).
   - Location (text).
   - Work mode → mode icon (Remote→public, Hybrid→business, Onsite→work) + label.
3. **Compensation**
   - Salary → "$XXX–$YYYK".
   - Equity (if any).
   - **Salary band bar** — horizontal bar, gold-tint background, gold range fill positioned by `(salaryMin - 120) / (420 - 120)` left and right offsets.
   - Caption row: `$120K` left, `vs. market band` center muted, `$420K` right.
4. **Timeline**
   - Posted (date).
   - Applied (date or "—").
   - Days pending — gold accent if applied; clock icon + "Xd".
   - Last activity (date).
   - Next due (date) — error-red if overdue (`daysFrom(nextActionDue) > 0`).
5. **Source**
   - Source (text).
   - Referral — gold accent + group icon if present.
   - Tags — flex-wrap chips + small `add` icon button at end.
6. **Watchers**
   - Avatar stack (overlapping) — currently 2 avatars (you + Dana).
   - "+" icon button to add watcher.

### 8.11 Resume Picker Modal (`@modal/apply/[id]`)

Triggered by Wishlist card "Apply now" CTA. Smaller modal (max-width 720px).

- **Head**: crumbs `[rocket_launch] Apply to <Company> · <Role>` + Close button.
- **Body**:
  - Muted intro line: "Pick the documents to attach. They'll be linked to this application — you can swap them later from the card."
  - Section: uppercase tiny "Choose a resume" header. Radio group of all resumes — each option = radio dot + name + flavor (sub) + page count chip. Selected option gets gold border + gold-tint bg.
  - Section header row: "Cover letter" + "Include" checkbox right-aligned.
  - If Include checked: radio group of cover letters with same chrome.
  - Footer (right-aligned): "Cancel" (muted) + "Submit application" (gold pill, rocket icon). Submit → calls `applyCard(id, { resumeId, coverLetterId? })`, closes modal, fires toast "Marked as applied · moved to Applied column".

### 8.12 Jobs (`/jobs`)

#### Header

- h1 "Jobs" + crumbs "Workspace / Jobs" + counter "X of Y jobs".
- Filter bar:
  - Search input (max-width 320, placeholder "Search role, company, location, tag…").
  - Vertical divider.
  - 4 scope chips with counts: `All`, `On my board`, `Matched for me`, `Open positions`. Active chip gold-tint.
  - Vertical divider.
  - Status select (Radix Select): `Status: All` + each STATUS title + `Open / not tracked`.
  - Mode select: `Mode: All` + Remote / Hybrid / Onsite.

#### Table

- 7 columns: `Job`, `Status`, `Location`, `Salary`, `Match`, `Updated`, `Action` (right-aligned header).
- Row chrome:
  - **Job** cell: 32px CompanyLogo + role (white, semibold) + sub line (gold company link + " · " + first 2 tags).
  - **Status** cell: small StatusPill (read-only — for tracked rows shows app status; for untracked shows neutral "Open").
  - **Location** cell: muted text.
  - **Salary** cell: `$XXX–$YYYK` white.
  - **Match** cell: gold percent if present, else muted "—".
  - **Updated** cell: muted date.
  - **Action** cell: tracked → "Track" muted button (opens card modal); untracked → "Wishlist" gold button (calls `addToWishlist`).
- Row click:
  - **Tracked** → open card detail modal at `/card/[displayId]`.
  - **Untracked** → open the **Job Listing Preview modal** at `/listing/[displayId]` (read-only view of the listing chrome — same company logo, role, location, salary, match, tags, posted-on; primary CTA inside the modal is "Add to wishlist" gold pill).
- The "Wishlist" button in the Action cell is the only place that mutates state from a row interaction. Row click never silently mutates state. (Finding #10.)
- Empty state: "No jobs match your filters." (centered, muted, generous padding).

URL params (canonical, see §6): `scope`, `q`, `status`, `mode` all serialize so URLs are shareable. `?scope=matched` deep-link from Research pre-checks the matched chip.

#### 8.12.1 Job Listing Preview modal (`/listing/[displayId]`)

A lightweight read-only modal opened from untracked Jobs rows and untracked entries on Company Detail. Mirrors the Card Detail modal chrome but no tabs, no drag, no comments — single-column body.

- Head: crumbs `[work] Jobs [chevron_right] <displayId>` + Close.
- Body: 64px logo + role h1 + company link + location + salary + tag chips + match chip + posted/applicants line.
- Footer: muted "Open original" link (no-op, demo-only) + gold "Add to wishlist" button → calls `addToWishlist`, fires toast, replaces URL with the new card's `/card/[displayId]` so the user lands on the freshly-created card.

### 8.13 Companies (`/companies`)

#### Header

- h1 "Companies" + crumbs "Workspace / Companies" + counter "X companies tracked".
- Filter bar:
  - Search input (max-width 360, placeholder "Search companies, industries…").
  - 4 sort chips with leading icons: `Top rated` (star), `Most open roles` (inbox), `Highest comp` (attach_money), `A–Z` (swap_vert). Active chip gold-tint.

#### Grid

- 3-col responsive grid of `CompanyCard`s.

#### CompanyCard

- **Top row**: 44px logo + name (semibold) + industry · HQ sub + Glassdoor block (gold star + rating + "Glassdoor (demo)" caption — finding #12).
- **Stat rows** (small, with leading icons; whole stat block has a tiny "Demo data" pill aligned right):
  - `<group>` size employees · est. founded
  - `<attach_money>` Median comp $XXXK · funding stage
  - `<trending_up>` CEO approval X% · would refer friend Y%
- **Tag row**: company tags + "X on board" gold-tint pill if user has applications at that company.
- **Action row**: "X open roles" gold pill (briefcase icon) → opens detail modal · "Site" muted pill (external_link, demo-only) · bookmark icon button (demo-only).
- Whole card click → opens company detail modal.

### 8.14 Company Detail Modal (`@modal/company/[id]`)

Larger modal (max-width 980px), single-column body.

#### Head

- Crumbs: `[apartment] Companies [chevron_right] <Name>` + spacer + 3 icon buttons (Star, External link, Close).

#### Body

1. **Hero row** (flex):
   - 64px logo (10px radius).
   - Right side: h1 name + meta line (`industry · HQ · size employees · Founded YYYY · <gold>fundingStage</gold>`) + tag chips wrap.
   - Far right: "Follow" gold pill (user_add icon).

2. **KPI grid** (4 cards, each footer carries a small "Demo data" caption — finding #12):
   - Glassdoor rating: gold star + rating + "X open roles" sub.
   - CEO approval: percent + "Would recommend friend Y%" sub.
   - Median comp: `$XXXK` + "Senior SWE band" sub.
   - Interview difficulty: `4.1` + `/ 5` muted suffix + "avg 4 rounds" flat-delta sub.

3. **Open roles for you (N)** section — header + linked-row list (match% badge + role + location/salary meta + "Wishlist" gold button right-aligned). Empty state: "No matched listings right now. Add to your watch list to be notified."

4. **Your pipeline at <Company> (N)** section — only if user has apps at this company. Linked-row list (`JT-ID` badge + role + status dot+title + "Applied <date>" meta). Click row → open card modal.

5. **Recent employee reviews** section — section header carries a "Demo data — not from a real review source" muted caption. 2-3 review bubbles. Each: star rating row (★★★★☆) + bold title + body text + role/tenure right-aligned.

### 8.15 Research (`/research`)

#### ResearchHero — 2 cards side-by-side

- **Daily spotlight** card (gold-accent eyebrow + h2 + body + 2 buttons "Review picks" gold + "Tune preferences"):
  - Eyebrow: gold sparkles + "Daily spotlight · May 8".
  - h2: "3 high-fit roles dropped overnight"
  - Body: "Anthropic, Perplexity, and Cloudflare all opened roles…"
- **Your search momentum** card:
  - Eyebrow: gold trending_up + "Your search momentum".
  - h2: "Last 14 days".
  - 2x2 stat grid: Applied (7 +3), Response rate (42% +8pt), Active loops (3 -1 down), Median days to reply (5.2 -1.8).

#### Daily picks section

- **Section head**: h3 "Today's picks for you" + sub "Ranked by stack match, seniority, location… Refreshed 6 hours ago." + right-aligned "See all 47 matches →" link.
- **Picks grid** (3-col responsive) of `PickCard`s:
  - Top row: company logo (clickable → company modal) + role + company sub (clickable) + match score block (big gold number + "match" caption).
  - 3 small rows: location (map_pin), salary (attach_money), applicants/posted (group + "X applicants · posted Yd ago").
  - Reasons row: tag chips from `pick.why`.
  - Actions row: primary "Add to wishlist" (toggles to "On wishlist" with check after add) + "Open" muted + Dismiss (X) icon button.

#### Pipeline analytics section

- **Section head**: h3 "Pipeline analytics" + sub "Your search performance vs. last 30 days." + "Detailed report →".
- 4 KPI cards (label + big number + delta with trending_up icon):
  - Applications open: 9 (+2)
  - Avg time to response: 5.2d (-1.8d)
  - Conversion to onsite: 38% (+12pt)
  - Offers in flight: 1 (flat — minus icon)

#### Market trends section

- **Section head**: h3 "Market trends" + sub "Senior Software Engineer · United States · Last 30 days" + "Change role ↓".
- 2-col grid:
  - **Total comp by level** card: h4 + sub + vertical bar chart (one bar per level, gold bar for highlighted "Senior+ (L5)", others muted) with `$XXXK` on top of each bar + level label below + footer legend ("Your target band" gold square + "Source: aggregated public listings" muted).
  - **Skill demand · 30d** card: h4 + sub + horizontal bar list. Each row: skill name + delta chip (gold ↑ or red ↓) + horizontal progress bar at `weight%`.

#### LinkedIn section

- **Section head**: h3 "LinkedIn" + sub + "Open LinkedIn ↗" (demo-only) + small "Demo data — no LinkedIn integration in v1" caption (finding #12).
- 3-col row of cards:
  - **People to connect with** (`person_add` h4) + sub + person rows: avatar + name + title + mutual line + "Connect" gold button (demo-only).
  - **Recruiter InMail** (`mail` h4 + "3 unread messages" sub) + InMail rows: avatar + name (with "· Xh" timestamp suffix) + title + 2-line preview clamped + "Reply" muted button (demo-only).
  - **Events near you** (`event` h4 + sub) + event rows: date block (month uppercase + day number, gold-tint bg) + title + meta + footer "Find more events" muted button (demo-only).

#### Watched companies section

- **Section head**: h3 "Companies you're watching" + sub + "Manage list →".
- Grid of small cards:
  - Logo + name + meta (e.g., "+2 new roles this week") + count badge (gold).
  - Plus dashed-border "Watch another company" tile at the end.
- Click any card → company detail modal.

### 8.16 Profile (`/profile`)

#### Hero

- Background: subtle gradient panel.
- 80px square photo "YO" (gold-tint bg).
- Name h1 + (pronouns) muted in parens + "Open to work" gold-tint pill (briefcase icon).
- Headline (one line, body text).
- Meta row: location (map_pin), email (mail), "500+ connections" (no icon).
- 4 social links: LinkedIn (link), GitHub (fork_right), Portfolio (public), Twitter (alternate_email).
- Right side actions: "Edit profile" gold pill (edit icon) + "Share" muted pill + Settings icon button.

#### Profile tabs

- 5 tabs: Overview (person), Resumes (description), Cover letters (mail), Preferences (tune), Activity (history).
- Active tab → gold underline.
- Right-aligned: completion bar — small horizontal bar with fill at `completion%` + caption "Profile X% complete".

#### Body — 2-column layout (main + side)

##### Overview tab (main)

- **About card**: h3 "About" + edit icon button + paragraph (`profile.about`, preserves linebreaks). **Editable in v1**: clicking the edit icon swaps the paragraph for a `<textarea>` (rhf + zod, max 2000 chars); Save → `useProfileStore.updateAbout(text)` + history event; Cancel reverts. This is the single editable profile field in v1 (finding #11) — keeps Profile testable end-to-end (see §14 E2E #7).
- **Experience card**: h3 + add icon button. Each experience row: 44px CompanyLogo + role (white, semibold) + meta line (company link + " · " + dates + " · " + duration) + location row (map_pin + location) + bulleted achievements list.
- **Education card**: h3 + add icon button. Each row: school icon + school name + degree/dates meta + detail line.
- **Skills card**: h3 + add icon button. Grid of skills, each: skill name + endorsement count (group icon + N) + horizontal level bar (level/5 fill) + "Xy" years suffix.
- **Languages + Certifications row** (2-col):
  - Languages card: each row = language name + level (Native/Conversational/Beginner).
  - Certifications card: each row = check_circle icon + cert name + "issuer · when" meta.
- **Achievements & talks card**: bulleted list.

##### Resumes / Cover letters tabs (main)

- `ResumeManager` for the chosen kind. Outer card with header row (h3 "Your resumes (N)" + sub + "Upload resume" gold pill).
- Resume rows: large icon (gold for resumes, blue for covers) + name (semibold) + "Default" gold-tint pill if default + flavor sub + meta line (file · size · pages · updated date · "Used in N applications") + keyword chips (first 8 + "+N" overflow caption) + 4 action icon buttons right (Preview/Edit/Duplicate/Delete).

##### Preferences tab (main)

- Single card "Search preferences" + h3 + "Edit" muted pill.
- 6 fields in a 2-col grid:
  - Target roles → tag chips list.
  - Work mode → chips.
  - Min total comp → big "$XXXK" value.
  - Notice period → text value.
  - Industries (interested) → chips.
  - Industries (avoid) → red "✕ industry" chips.

##### Activity tab (main)

- Single card with summary line: "You've made X status changes, sent Y follow-ups, and used your <Resume> N times in the last 30 days." (computed from store; mock copy in v1).

##### Side cards (always visible regardless of active main tab)

1. **Search snapshot** — h4 + 2x2 grid: Active / Resumes / Covers / Skills (each = label + number).
2. **Profile completeness** — h4 + checklist: each row = check_circle (filled gold) or circle (muted) + label + "Add" link if not done.
3. **Who viewed your profile** — h4 (with "Demo data" caption) + 3 viewer rows (avatar + name + title) + "See all 18 viewers →" gold link (demo-only).

#### Reset demo data

A small "Reset demo data" muted button at the very bottom of the side column. Confirmation dialog, then wipes all `jobtracker:*` keys from localStorage and reloads.

### 8.17 Demo-only controls (finding #9)

Many controls in the design are visually present but out of scope for v1. Rather than disable them (which feels broken) or hide them (which loses design fidelity), each demo-only control:

1. Renders the same visual chrome as a functional control.
2. Has a small "Demo" chip-tooltip on hover (Radix Tooltip), text: "Demo only — coming in a future release."
3. On click: fires a toast — `"Demo only — '<label>' isn't wired up yet."` (single-line, 2.8s, blue info variant). No state mutation.
4. Has `data-demo-only="true"` attribute so e2e tests can assert no-op.

Demo-only controls (canonical list — anything tagged "no-op" elsewhere in §8 maps to one of these):

| Where | Control |
| --- | --- |
| TopBar AvatarDropdown | Account settings · Notification preferences · Appearance · Help & shortcuts · Log out |
| Card detail head | Watch · Star · Share · Archive · More |
| Card detail Overview | Next-action "Mark done" check |
| Card detail Match (ATS) | "Apply" on suggested edit · "Use this" on rewrite · "Preview" / "Swap" on linked docs |
| Card detail Attachments | "Upload file" · "Attach link" · attachment cards (open) |
| Card detail Linked | "Link item" · "Link to another card" · linked-row external icon |
| Card detail Side panel | Watchers "Add" · Tags "Add" |
| Jobs / Job Listing Preview | "Open original" link |
| Companies card | "Site" · bookmark icon |
| Company detail | "Follow" pill · Star · External link |
| Research hero | "Tune preferences" |
| Research picks | "Open" · Dismiss (X) — "Add to wishlist" remains functional |
| Research analytics | "Detailed report →" · "Change role ↓" |
| Research LinkedIn | "Open LinkedIn ↗" · "Connect" · "Reply" · "Find more events" |
| Research watch | "Manage list →" · "Watch another company" |
| Profile hero | "Edit profile" · "Share" · Settings — _About inline-edit is functional, see §8.16_ |
| Profile cards | All edit-pencil and add (+) icons EXCEPT About |
| Profile Preferences | "Edit" pill |
| Profile WhoViewed | "See all 18 viewers →" |
| Profile completeness | per-row "Add" links |

Implementation: a single `<DemoOnly label="…">{children}</DemoOnly>` wrapper applies the tooltip, click handler, and `data-demo-only` attribute. Test helpers query `[data-demo-only]` to assert no-op.

## 9. Drag-and-drop

`DndContext` at the BoardView level. Each `Column` is `useDroppable`. Each `ApplicationCard` is `useSortable` inside per-column `SortableContext`. On `onDragEnd`:

1. Same column → reorder array, update local `sortIndex`.
2. Different column → call `moveStatus(activeId, targetColumnId)`. Store appends a `HistoryEvent` (`{ type: 'status', text: 'Wishlist → Applied' }`) and bumps `lastActivity`. If target is `applied` and `applied` field is null, set it to today.

Visual: column shows `is-drag-over` outline; card shows `is-dragging` (opacity 0.5, scale 0.98). Drag overlay uses framer-motion fade.

Keyboard a11y: dnd-kit's keyboard sensor + screen-reader announcements enabled. Drag handle = whole card.

## 10. ATS scoring

`utils/ats.ts` exports:

- `computeAts({ resumeKeywords, required, nice }): AtsResult` — pure function, mirrors prototype's `makeATS`.
- `gradeFor(score: number): { label: string; color: string }` — maps to Excellent/Strong/Moderate/Weak + color.

Initial seed `appDocs` ports verbatim from prototype's `APP_DOCS`. Re-runs when user swaps the linked resume.

## 11. Persistence layer

Zustand `persist` config per store. Each store has its own key (`jobtracker:apps:v1`, `jobtracker:profile:v1`, `jobtracker:notifications:v1`). UI store is in-memory only. Hydration boundary (`useHydration` hook) prevents SSR/CSR mismatch for persisted-state-dependent UI.

```ts
import { createJSONStorage, persist } from 'zustand/middleware';

export const useAppsStore = create<AppsState>()(
  persist(
    (set, get) => ({
      // ...state + actions
    }),
    {
      name: 'jobtracker:apps:v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState, fromVersion) => migrateApps(persistedState, fromVersion),
      partialize: (state) => ({
        applications: state.applications,
        activity: state.activity,
        appDocs: state.appDocs,
        statusSortMode: state.statusSortMode,
      }),
      // Skip writes during SSR — `localStorage` is undefined on the server.
      skipHydration: true,
    },
  ),
);
```

Equivalent shape for `useProfileStore` (persisting `profile`, `resumes`, `coverLetters`) and `useNotificationsStore` (persisting `notifications`, `readAt`, `dismissedAt`). `skipHydration: true` is required because `app/layout.tsx` is server-rendered; client components call `useAppsStore.persist.rehydrate()` inside the `useHydration` hook on first render to avoid SSR/CSR mismatch.

## 11.5 Optional Supabase backend and logging plan

The initial app must work fully without Supabase. The default runtime is seed data plus localStorage persistence, with no network, auth, database, or hosted backend required. Supabase is a later optional persistence adapter, not a v1 dependency.

The UI-first implementation should keep store actions shaped like backend use cases so Supabase can be added later without rewriting components. Do not let React components know whether data came from seed data, Zustand persistence, or Supabase.

### Required local-first behavior

- First load seeds all demo data from local TypeScript seed files.
- All user-visible mutations persist to localStorage.
- App startup must not require Supabase environment variables.
- Missing Supabase configuration must not produce console errors, failed network requests, blocked routes, or degraded UI.
- Reset demo data wipes local `jobtracker:*` keys and reseeds locally.
- Tests and local development run without Supabase.
- Supabase code should be lazy/adapter-gated so the production UI can still run in local-only mode.

### Supabase integration boundary

- Add a repository layer under `src/lib/repositories/`:
  - `applications-repository.ts`
  - `companies-repository.ts`
  - `profile-repository.ts`
  - `notifications-repository.ts`
  - `event-log-repository.ts`
- Store actions call repository functions through a thin service/use-case layer. In v1, the repository delegates to seed/localStorage. In the later Supabase milestone, a second adapter delegates to Supabase queries or Server Actions.
- Keep IDs stable and server-compatible from day one. Prefer UUIDs for new records and store display IDs like `JT-42` separately as `displayId`.
- Add `createdAt`, `updatedAt`, and `deletedAt` fields to mutable domain entities before the Supabase migration.
- Add `ownerUserId` to all user-owned entities even while the app is single-user. It can point at a fixed demo user in v1.

### Later proposed Supabase schema

Initial tables:

- `profiles` — user profile, preferences, open-to-work settings.
- `companies` — company identity/logo metadata.
- `company_details` — Glassdoor/LinkedIn-style mock metadata, clearly marked as demo data.
- `job_listings` — discoverable jobs shown in Jobs and Research.
- `applications` — tracked application cards and board state.
- `application_activity` — comments, history, links, attachments as typed activity events.
- `application_documents` — resume/cover-letter links per application.
- `resumes` — metadata only in v1; file storage can be added later.
- `cover_letters` — metadata only in v1.
- `notifications` — in-app notification rows and read state.
- `watched_companies` — user watchlist.
- `audit_events` — durable append-only record of user actions.
- `app_logs` — structured operational/client logs worth persisting.

Recommended columns for mutable tables:

```ts
{
  id: string;              // uuid
  ownerUserId: string;     // auth.users.id later; fixed demo user in v1
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

Recommended `applications` additions beyond the existing type:

```ts
{
  displayId: string;       // "JT-42"
  sourceListingId: string | null;
  sortIndex: number;
  archivedAt: string | null;
}
```

### Later row-level security and auth posture

- Enable RLS from the start on Supabase tables, even if the first deployment uses a single demo user.
- Policies should scope all user-owned rows by `owner_user_id = auth.uid()`.
- Public seed/demo content, such as companies and demo job listings, should be read-only from the client.
- Mutations should go through Server Actions or API routes when they need validation, cross-table writes, or audit logging.

### Logging and audit events

There are two distinct logging streams:

1. **Audit events** — product/domain history shown to the user and useful for backend debugging.
2. **Application logs** — operational diagnostics, warnings, errors, and telemetry.

In v1, audit events should be stored locally in the app/activity state and persisted through localStorage. In the Supabase milestone, the same event shape can be written to an append-only `audit_events` table.

`audit_events` should be generated for:

- Application created.
- Application status changed.
- Card reordered.
- Application fields edited.
- Job added to wishlist.
- Application submitted.
- Comment/link/attachment/document changed.
- Profile/resume/cover-letter metadata changed.
- Notification marked read/dismissed.
- Demo data reset.

In v1, `app_logs` may be kept in memory and surfaced through console logging in development only. In the Supabase milestone, selected warnings/errors can be persisted to an `app_logs` table.

`app_logs` should capture:

- Client errors caught by error boundaries.
- Failed Supabase queries/mutations.
- Hydration/persistence migration failures.
- Validation failures.
- Unexpected missing seed/data references.

Suggested log envelope:

```ts
type AppLog = {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  message: string;
  userId?: string;
  requestId?: string;
  entityType?: string;
  entityId?: string;
  route?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
```

Client logging should be throttled and should never persist resume contents, cover-letter contents, email bodies, API keys, auth tokens, or raw uploaded files. For v1 metadata-only documents, filenames are acceptable; later file uploads require a stricter privacy pass.

### Optional backend migration milestones

The local-only adapter (seed + localStorage) remains a supported runtime in **every** environment — development, preview, production — and is not deprecated by later milestones. The Supabase adapter is selected by an explicit `NEXT_PUBLIC_PERSISTENCE_ADAPTER=supabase` env var (default: `local`). When `local`, no Supabase code paths run, no env vars are required, and no network calls are made. (Finding #5.)

1. **UI/local milestone** — implement repository interfaces with seed + Zustand persistence. The only adapter shipped.
2. **Supabase schema milestone** — add SQL migrations, generated TypeScript database types, RLS policies, and seed script. No runtime impact yet.
3. **Read-path milestone** — add a Supabase adapter that loads companies, listings, applications, profile, notifications. Selected only when the env var is set; the local adapter remains the default and works in any environment.
4. **Write-path milestone** — extend the Supabase adapter with mutations / Server Actions; audit events written transactionally. Local adapter still handles all writes when selected.
5. **Logging milestone** — add client error boundary logging, mutation failure logging, audit-event inspection utilities (works regardless of adapter).
6. **Auth milestone** — replace fixed demo user with Supabase Auth (Supabase adapter only); verify RLS with tests. Local adapter continues to use `DEMO_USER_ID`.

## 12. Styling

`tokens.css` ports verbatim. `tailwind.config.ts` (or Tailwind v4 `@theme inline`) consumes it so utilities like `bg-surface`, `text-gold`, `rounded-xl`, `border-border` map straight to tokens.

Custom utilities in `globals.css` (using `@layer components`):

- `.astral-card` — surface bg + xl radius + hairline border.
- `.astral-gold-btn` — gradient gold pill, scale-on-press.
- `.astral-badge`, `.astral-badge--success/warning/error/muted`.
- `.app-card`, `.app-card.is-dragging` — kanban card chrome.
- `.column.is-drag-over` — column outline.
- `.modal-backdrop`, `.modal`, `.modal__head`, `.modal__main`, `.modal__side`, `.modal__tabs` — card detail layout.
- `.chip`, `.chip.is-tag`, `.chip.is-priority-high/med/low`.
- `.status-pill`, `.priority-pill`, `.status-menu`.
- `.salary-bar`, `.salary-bar__fill`.
- `.ats-score-card`, `.ats-bar`, `.ats-kw`, `.ats-kw.is-hit/is-miss`, `.ats-edits`, `.ats-rewrite`.
- `.resume-list`, `.resume-row`, `.resume-pick`.
- `.kpi-card`, `.salary-chart`, `.bar-col`, `.skill-row`.
- `.li-card`, `.li-people`, `.li-person`, `.li-event`.
- `.profile__hero`, `.profile__photo`, `.profile__card`, `.profile__exp`, `.profile__skill`.
- `.toast-host`, `.toast`.

Inter loaded via `next/font/google`; Material Symbols loaded via `<link>` in root layout. `Icon` component renders `<span class="material-symbols-rounded">` with `font-variation-settings` set per size for crisp glyphs.

### Icon mapping

`src/lib/icon-map.ts` ports the prototype's lucide-name → Material-Symbols-glyph map verbatim (e.g., `'layout-dashboard' → 'space_dashboard'`, `'compass' → 'explore'`, `'flame' → 'local_fire_department'`, `'rocket' → 'rocket_launch'`, etc.). Components use `<Icon name="layout-dashboard" />` and the wrapper resolves the glyph. New icons added directly by glyph name.

## 13. Accessibility

- Radix primitives → focus management, ARIA, keyboard nav free.
- `prefers-reduced-motion` respected via Tailwind's `motion-safe`/`motion-reduce` for framer-motion transitions.
- All icons paired with text or `aria-label`.
- Drag-drop has keyboard fallback (dnd-kit keyboard sensor + screen-reader announcements).
- Color contrast: gold-on-dark passes AA for text; status pills use both color and label.
- contentEditable title has `role="textbox"` + `aria-multiline="false"` + Enter blurs.

## 14. Testing

- **Unit** (Vitest + RTL): pure utils (`ats`, `dates`, `cn`, `sort-resolver`), store actions (`moveStatus`, `reorderInStatus`, `applyCard`, `addToWishlist`, `addComment`, `linkResume`, `updateAbout`, `markRead`, `dismiss`), filter logic for board / jobs / companies / research, board sort precedence resolver (every (mode, mutation) cell in the table from §6).
- **Component** (RTL): board column drop accepts/rejects, card detail tabs render correct content, ATS panel renders correct grade for various scores, ResumeManager renders all rows + actions, profile completeness recalculates on edits, notification popover marks all read, `<DemoOnly>` wrapper fires toast and does not mutate state, About inline-edit save/cancel flows, untracked Jobs row click opens preview modal (no state mutation).
- **E2E** (Playwright smoke):
  1. nav between all 5 views via top bar
  2. drag a card across columns → verify history entry + status change
  3. open a card → switch tabs → add a comment → verify it appears
  4. open a wishlist card → click "Apply now" → pick a resume → submit → card moves to Applied
  5. add a job from Research → verify wishlist card appears on board
  6. open a company from a board card → verify pipeline section shows
  7. edit Profile → About → save → refresh → verify persistence (the one editable profile field)
  8. "Reset demo data" → confirm → verify board returns to seed state
  9. click an untracked Jobs row → verify Job Listing Preview modal opens, no card created (finding #10 regression guard)
  10. direct-load `/card/JT-34` → verify Board renders behind Card Detail modal
  11. click any `<DemoOnly>` control (e.g., AvatarDropdown → "Account settings") → verify toast appears, URL/state unchanged
- CI runs unit + component on every PR. E2E runs on PR to `Production` only.

## 15. CI/CD + branching + deploy

**Branches:**

- `main` — protected, untouched after the initial scaffold push.
- `Development` — daily integration branch. Pushes auto-deploy to a Vercel preview environment with stable URL `jobtracker-dev.vercel.app` (alias).
- `Production` — production. Pushes auto-deploy to `jobtracker.vercel.app` (or your custom domain).
- `Patch` — hotfix branch off `Production`. PRs from `Patch` → `Production` for emergency fixes; merge back to `Development` afterward.

**Vercel project config:**

- Production Branch: `Production`.
- Preview deploys: every other branch gets a preview URL.
- Domain aliases set per branch (Vercel "Branch URL" feature) so `Development` always lands on `jobtracker-dev.<...>.vercel.app`.

**GitHub Actions (`.github/workflows/ci.yml`):**

Runs on every PR + on push to `Development` / `Production` / `Patch`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test:unit`
5. `pnpm build` (smoke)

Branch protection rules (configured in GitHub after first push):

- `main`, `Production`: require PR + passing CI + 1 approval + linear history.
- `Development`: require passing CI.

## 16. Out of scope (v1)

All visible-but-non-functional controls are enumerated as "demo-only" in §8.17 — they show a tooltip + toast on click and never mutate state.

- Real backend / API (Supabase adapter is staged in §11.5; default adapter remains local in all environments)
- Authentication
- Real file upload (resumes/attachments are metadata-only)
- Real LinkedIn / job-board integrations (LinkedIn section in Research is demo data, labeled in UI)
- Real notifications (bell list is mock data; read/dismiss state is local)
- Real Glassdoor / company review data (Companies + Company Detail mark mock fields with "Demo data")
- Multi-user / collaborator features (Watchers UI exists but Add-watcher is demo-only)
- Real-time collaboration
- Email / push notifications
- List view + Timeline view for the board (toggle present, content is "Coming soon" placeholder)
- Mobile responsive (prototype is `width=1440`; v1 is desktop-only)
- Resume / cover letter file preview (button is demo-only)
- All Account settings / Notification prefs / Appearance / Help screens (menu items demo-only)
- Profile editing beyond About (all other Profile edit/add icons are demo-only)
- "Mark done" on next action (demo-only)
- "Follow" company (demo-only)

## 17. Risks & open questions

- **Material Symbols + React reconciler issue** — the chat transcript noted lucide breaking React's DOM. Material Symbols is font-based so it's safe, but verify in early smoke test.
- **localStorage 5MB cap** — non-issue for v1 mock data (~50 KB), worth a comment in the store for future-me.
- **Vercel branch aliasing with capitalized branch names** — `Development` / `Production` / `Patch` are unusual capitalization. If Vercel's Git integration has issues, fall back to lowercase. Verify on first push.
- **Drag-drop on touch devices** — dnd-kit supports it; mobile is not a v1 target.
- **Persisted state stale after schema bump** — versioned `migrate` mitigates, but the "Reset demo data" button is the safety valve.
- **Parallel-route modals + browser back** — first hard-refresh on a `/card/[displayId]` URL needs the underlying view to render correctly behind the modal. Mitigated by the canonical full-route fallback (§4) that renders `<Board />` + `CardDetailDialog` together. Verify with E2E #10.
- **Sort-mode UX clarity** — switching column sort mode then dragging a card auto-flips the column to manual; users may not notice. Mitigated by the manual-mode chip on the column header (§6).
- **Demo-only volume** — many controls are non-functional. The `<DemoOnly>` wrapper + tooltip pattern keeps the experience honest, but if the count grows further, consider hiding the most decorative controls (e.g., Watch/Star/Share/Archive/More) behind a "More actions" overflow menu.
