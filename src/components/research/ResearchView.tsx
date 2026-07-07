'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { DemoOnly } from '@/components/ui/DemoOnly';
import {
  LINKEDIN_EVENTS,
  LINKEDIN_INMAIL,
  LINKEDIN_SUGGESTED,
  MARKET_SALARIES,
  MARKET_SKILLS,
} from '@/lib/data/seed';
import { useLiveCompanies, type LiveCompany } from '@/lib/client/use-live-companies';
import { useLivePicks } from '@/lib/client/use-live-picks';
import { companySlug } from '@/lib/research/derive-companies';
import { toCompany } from '@/lib/research/to-company';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import type { DailyPick } from '@/lib/types';
import { SearchPreferencesDialog } from './SearchPreferencesDialog';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';
const TERMINAL_STATUSES = new Set(['rejected', 'offer']);

function pickListingHref(pick: DailyPick): string {
  const separatorIndex = pick.id.indexOf(':');
  const sourceId = separatorIndex === -1 ? pick.id : pick.id.slice(separatorIndex + 1);
  return `/listing/JOB-${sourceId}`;
}

export function ResearchView() {
  const applications = useAppsStore((state) => state.applications);
  const pushToast = useUiStore((state) => state.pushToast);
  const { picks, loading: picksLoading, refetch: refetchPicks } = useLivePicks();
  const { companies, loading: companiesLoading, refetch: refetchCompanies } = useLiveCompanies();

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [manualWatches, setManualWatches] = useState<LiveCompany[]>([]);
  const [removedWatchIds, setRemovedWatchIds] = useState<Set<string>>(new Set());
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [watchDialogOpen, setWatchDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const visiblePicks = useMemo(
    () => picks.filter((pick) => !dismissedIds.has(pick.id)),
    [picks, dismissedIds],
  );
  const heroPick = visiblePicks[0] ?? null;

  const companyById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const watchedCompanies = useMemo(() => {
    const map = new Map<string, LiveCompany>();
    for (const company of companies) {
      if (company.watched && !removedWatchIds.has(company.id)) map.set(company.id, company);
    }
    for (const company of manualWatches) {
      if (!removedWatchIds.has(company.id) && !map.has(company.id)) map.set(company.id, company);
    }
    return Array.from(map.values());
  }, [companies, manualWatches, removedWatchIds]);

  const openApps = applications.filter((app) => !TERMINAL_STATUSES.has(app.status)).length;
  const offers = applications.filter((app) => app.status === 'offer').length;
  const applied = applications.filter((app) => app.status === 'applied').length;

  async function dismissPick(pick: DailyPick) {
    setDismissedIds((prev) => new Set(prev).add(pick.id));
    if (!isSupabase) return;
    try {
      const res = await fetch('/api/research/picks/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobKey: pick.id }),
      });
      if (!res.ok) throw new Error(`dismiss ${res.status}`);
    } catch {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(pick.id);
        return next;
      });
      pushToast({ kind: 'error', message: `Could not dismiss ${pick.role}` });
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch('/api/research/run', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        jobsUpserted?: number;
        errors?: Array<{ providerId: string; error: string }>;
      };
      if (!res.ok) throw new Error(body.error ?? `refresh failed (${res.status})`);
      const errorCount = body.errors?.length ?? 0;
      pushToast({
        kind: errorCount ? 'info' : 'success',
        message: `Refreshed: ${body.jobsUpserted ?? 0} jobs updated${
          errorCount ? ` · ${errorCount} provider error(s)` : ''
        }`,
      });
      refetchPicks();
      refetchCompanies();
    } catch (err) {
      pushToast({ kind: 'error', message: err instanceof Error ? err.message : 'Refresh failed' });
    } finally {
      setRefreshing(false);
    }
  }

  async function submitWatch(name: string, domain: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const key = companySlug(trimmedName);
    if (!key) return;
    const trimmedDomain = domain.trim() || undefined;
    const manualCompany = toCompany(
      {
        sourceProvider: 'themuse',
        sourceId: key,
        name: trimmedName,
        raw: null,
        ...(trimmedDomain
          ? { domain: trimmedDomain, logoUrl: `https://logo.clearbit.com/${trimmedDomain}` }
          : {}),
      },
      { openRoles: 0, watched: true },
    );
    setManualWatches((prev) => [...prev.filter((c) => c.id !== key), manualCompany]);
    setRemovedWatchIds((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setWatchDialogOpen(false);
    if (!isSupabase) {
      pushToast({ message: `${trimmedName} added to watchlist` });
      return;
    }
    try {
      const res = await fetch('/api/companies/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyKey: key }),
      });
      if (!res.ok) throw new Error(`watch ${res.status}`);
      pushToast({ message: `${trimmedName} added to watchlist` });
      refetchCompanies();
    } catch {
      pushToast({ kind: 'error', message: `Could not watch ${trimmedName}` });
    }
  }

  async function unwatch(company: LiveCompany) {
    setManualWatches((prev) => prev.filter((c) => c.id !== company.id));
    setRemovedWatchIds((prev) => new Set(prev).add(company.id));
    if (!isSupabase) return;
    try {
      const res = await fetch('/api/companies/watch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyKey: company.id }),
      });
      if (!res.ok) throw new Error(`unwatch ${res.status}`);
      refetchCompanies();
    } catch {
      setRemovedWatchIds((prev) => {
        const next = new Set(prev);
        next.delete(company.id);
        return next;
      });
      pushToast({ kind: 'error', message: `Could not remove ${company.name}` });
    }
  }

  return (
    <AppShell>
      <main className="scroll-view research-view">
        <div className="board__title-row">
          <h1>Research</h1>
          <span className="board__crumbs">Workspace / Research</span>
          <span className="board__counter">
            <b>{visiblePicks.length}</b> daily picks
          </span>
          <button className="card-cta" disabled={refreshing} type="button" onClick={handleRefresh}>
            <Icon name="refresh" size={12} /> {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <section className="hero-grid">
          <div className="panel">
            <h2>Daily spotlight</h2>
            <p>
              {heroPick
                ? `${heroPick.role} at ${companyById.get(heroPick.company)?.name ?? heroPick.company}`
                : picksLoading
                  ? 'Loading picks...'
                  : 'No picks yet — refresh to pull in live roles.'}
            </p>
            <Link className="astral-gold-btn" href="#daily-picks">
              <Icon name="travel_explore" size={14} /> Review picks
            </Link>
          </div>
          <div className="panel" data-demo-data="true">
            <SectionHead title="Your search momentum" sub="Last 14 days · demo data" />
            <div className="momentum-grid">
              <MomentumStat label="Applied" value={`${applied}`} delta="+3" />
              <MomentumStat label="Response rate" value="42%" delta="+8pt" />
              <MomentumStat label="Active loops" value={`${openApps}`} delta="-1" down />
              <MomentumStat label="Median days to reply" value="5.2" delta="-1.8" />
            </div>
            <button className="card-cta" type="button" onClick={() => setPrefsOpen(true)}>
              <Icon name="tune" size={12} /> Tune preferences
            </button>
          </div>
        </section>

        <section id="daily-picks" className="view-section">
          <SectionHead
            title="Today's picks for you"
            sub={`${visiblePicks.length} picks · refreshed daily`}
            right={
              <Link className="card-cta" href="/jobs?scope=matched">
                See all matches →
              </Link>
            }
          />
          <div className="companies-grid">
            {visiblePicks.map((pick) => (
              <PickCard
                key={pick.id}
                companyName={companyById.get(pick.company)?.name}
                pick={pick}
                onDismiss={dismissPick}
              />
            ))}
            {!picksLoading && visiblePicks.length === 0 ? (
              <div className="empty-state">
                {isSupabase
                  ? 'No picks yet. Run Refresh above to pull in live roles.'
                  : 'No picks right now.'}
              </div>
            ) : null}
          </div>
        </section>

        <section className="view-section" data-demo-data="true">
          <SectionHead
            title="Pipeline analytics"
            sub="Open apps / offers / applied are real; the rest is demo data"
            right={
              <DemoOnly className="card-cta" label="Detailed report">
                Detailed report →
              </DemoOnly>
            }
          />
          <div className="kpi-grid">
            <Kpi title="Open applications" value={`${openApps}`} meta="Live" />
            <Kpi title="Avg time to response" value="6.4d" meta="Demo data" />
            <Kpi title="Conversion to onsite" value="38%" meta="Demo data" />
            <Kpi title="Offers in flight" value={`${offers}`} meta="Live" />
          </div>
        </section>

        <section className="view-section two-col" data-demo-data="true">
          <div className="panel">
            <SectionHead title="Total comp by level" sub="Demo market data" />
            {MARKET_SALARIES.map((item) => (
              <Bar
                key={item.lvl}
                label={item.lvl}
                value={item.comp}
                max={510}
                highlight={item.hi}
                suffix="K"
              />
            ))}
          </div>
          <div className="panel">
            <SectionHead
              title="Skill demand"
              sub="Demo market data"
              right={
                <DemoOnly className="card-cta" label="Change market trend role">
                  <Icon name="swap_horiz" size={12} /> Change role ↓
                </DemoOnly>
              }
            />
            {MARKET_SKILLS.map((item) => (
              <Bar
                key={item.name}
                label={`${item.name} ${item.delta}`}
                value={item.weight}
                max={100}
                highlight={!item.down}
                suffix="%"
              />
            ))}
          </div>
        </section>

        <section className="view-section" data-demo-data="true">
          <SectionHead title="LinkedIn signals" sub="Demo data — no LinkedIn integration in v1" />
          <div className="three-col">
            <SocialPanel
              title="People to connect with"
              items={LINKEDIN_SUGGESTED.map((p) => `${p.name} · ${p.title}`)}
              action="Connect"
            />
            <SocialPanel
              title="Recruiter InMail"
              items={LINKEDIN_INMAIL.map((m) => `${m.name}: ${m.preview}`)}
              action="Reply"
            />
            <SocialPanel
              title="Events near you"
              items={LINKEDIN_EVENTS.map((e) => `${e.month} ${e.day} · ${e.title}`)}
              action="Open LinkedIn"
            />
          </div>
        </section>

        <section className="view-section">
          <SectionHead
            title="Watched companies"
            sub={`${watchedCompanies.length} watched`}
            right={
              <button className="card-cta" type="button" onClick={() => setManageDialogOpen(true)}>
                Manage list →
              </button>
            }
          />
          <div className="watched-grid">
            {watchedCompanies.map((item) => (
              <Link key={item.id} className="watched-card" href={`/company/${item.id}`}>
                <CompanyLogo companyId={item.id} size={34} radius={7} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.domain ?? `${item.openRoles} open roles`}</small>
                </span>
                <b>{applications.filter((app) => app.company === item.id).length}</b>
              </Link>
            ))}
            {!companiesLoading && watchedCompanies.length === 0 ? (
              <div className="empty-state">No watched companies yet.</div>
            ) : null}
            <button
              className="watched-card dashed"
              type="button"
              onClick={() => setWatchDialogOpen(true)}
            >
              <Icon name="add" size={16} /> Watch another company
            </button>
          </div>
        </section>
      </main>

      {prefsOpen ? (
        <SearchPreferencesDialog
          onClose={() => setPrefsOpen(false)}
          onSaved={() => {
            refetchPicks();
            refetchCompanies();
          }}
        />
      ) : null}
      {watchDialogOpen ? (
        <WatchCompanyDialog onClose={() => setWatchDialogOpen(false)} onSubmit={submitWatch} />
      ) : null}
      {manageDialogOpen ? (
        <ManageWatchlistDialog
          companies={watchedCompanies}
          onClose={() => setManageDialogOpen(false)}
          onRemove={unwatch}
        />
      ) : null}
    </AppShell>
  );
}

function SectionHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h3>{title}</h3>
        {sub ? <small className="muted">{sub}</small> : null}
      </div>
      {right ? <div className="section-head__right">{right}</div> : null}
    </div>
  );
}

function MomentumStat({
  label,
  value,
  delta,
  down,
}: {
  label: string;
  value: string;
  delta: string;
  down?: boolean;
}) {
  return (
    <div className="momentum-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <span className={down ? 'is-down' : 'is-up'}>{delta}</span>
    </div>
  );
}

function PickCard({
  pick,
  companyName,
  onDismiss,
}: {
  pick: DailyPick;
  companyName?: string | undefined;
  onDismiss: (pick: DailyPick) => void;
}) {
  const addToWishlist = useAppsStore((state) => state.addToWishlist);
  const applications = useAppsStore((state) => state.applications);
  const pushToast = useUiStore((state) => state.pushToast);
  const onWishlist = applications.some((app) => app.sourceListingId === pick.id);
  return (
    <article className="company-card">
      <div className="pick__top">
        <CompanyLogo companyId={pick.company} size={44} radius={9} />
        <div>
          <h2>{pick.role}</h2>
          <p>
            {companyName ?? pick.company} · {pick.location}
          </p>
        </div>
        <div className="pick__match">
          <span className="pick__match-num">{pick.match}%</span>
          <span>match</span>
        </div>
      </div>
      <p>{pick.salary}</p>
      <p>
        {pick.posted} · {pick.applicants} applicants
      </p>
      <div className="app-card__chips">
        {pick.why.map((why) => (
          <span key={why} className="chip is-tag">
            {why}
          </span>
        ))}
      </div>
      <div className="company-card__actions">
        <button
          className={`card-cta ${onWishlist ? '' : 'is-primary'}`}
          disabled={onWishlist}
          type="button"
          onClick={() => {
            addToWishlist(pick, 'Research');
            pushToast({ message: `${companyName ?? pick.company} added to Wishlist` });
          }}
        >
          <Icon name={onWishlist ? 'check' : 'playlist-add'} size={12} />
          {onWishlist ? 'On wishlist' : 'Add to wishlist'}
        </button>
        <Link className="card-cta" href={pickListingHref(pick)}>
          Open
        </Link>
        <button
          aria-label={`Dismiss ${pick.role}`}
          className="icon-btn"
          type="button"
          onClick={() => onDismiss(pick)}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </article>
  );
}

function Kpi({ title, value, meta }: { title: string; value: string; meta: string }) {
  return (
    <div className="ats-score-card kpi-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function Bar({
  label,
  value,
  max,
  highlight,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  highlight: boolean;
  suffix: string;
}) {
  return (
    <div className="metric-bar">
      <span>{label}</span>
      <div>
        <i
          style={{
            width: `${Math.min(100, (value / max) * 100)}%`,
            background: highlight ? 'var(--gold)' : 'var(--error)',
          }}
        />
      </div>
      <b>
        {value}
        {suffix}
      </b>
    </div>
  );
}

function SocialPanel({ title, items, action }: { title: string; items: string[]; action: string }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
      <DemoOnly className="card-cta" label={action}>
        {action}
      </DemoOnly>
    </div>
  );
}

function WatchCompanyDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string, domain: string) => void;
}) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        aria-label="Watch another company"
        aria-modal="true"
        className="modal compact-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(name, domain);
        }}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="add" size={14} /> Watch another company
          </div>
          <span className="grow" />
          <button aria-label="Close" className="icon-btn" type="button" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__main new-app-form">
          <label className="new-app-form__field" htmlFor="watch-company-name">
            <span className="side__label">Company name</span>
            <input
              autoFocus
              id="watch-company-name"
              placeholder="e.g. Acme Corp"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="new-app-form__field" htmlFor="watch-company-domain">
            <span className="side__label">Domain (optional)</span>
            <input
              id="watch-company-domain"
              placeholder="e.g. acme.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
            />
          </label>
        </div>
        <footer className="dialog-footer">
          <button className="card-cta" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="astral-gold-btn" disabled={!name.trim()} type="submit">
            <Icon name="add" size={14} /> Watch company
          </button>
        </footer>
      </form>
    </div>
  );
}

function ManageWatchlistDialog({
  companies,
  onClose,
  onRemove,
}: {
  companies: LiveCompany[];
  onClose: () => void;
  onRemove: (company: LiveCompany) => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-label="Manage watchlist"
        aria-modal="true"
        className="modal compact-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="star" size={14} /> Manage watchlist
          </div>
          <span className="grow" />
          <button aria-label="Close" className="icon-btn" type="button" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__main">
          <div className="linked-list">
            {companies.length ? (
              companies.map((company) => (
                <div key={company.id} className="linked-row action-row">
                  <CompanyLogo companyId={company.id} size={28} radius={6} />
                  <span className="linked-row__title">{company.name}</span>
                  <button className="card-cta" type="button" onClick={() => onRemove(company)}>
                    <Icon name="x" size={12} /> Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state">No watched companies yet.</div>
            )}
          </div>
        </div>
        <footer className="dialog-footer">
          <button className="astral-gold-btn" type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
