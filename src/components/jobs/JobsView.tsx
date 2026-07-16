'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { STATUSES } from '@/lib/data/seed';
import { useLiveListings } from '@/lib/client/use-live-listings';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import { useJobsParams } from '@/lib/url-params/use-jobs-params';
import { fmtDate } from '@/lib/utils/dates';
import { buildJobsRows, type JobsParams, type JobsRow } from './use-jobs-rows';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

type JobsParamsHook = ReturnType<typeof useJobsParams>;

export function JobsView() {
  const params = useJobsParams();
  const applications = useAppsStore((state) => state.applications);
  const { listings, loading, refetch } = useLiveListings();
  const rows = useMemo(
    () => buildJobsRows(applications, listings, params),
    [applications, listings, params],
  );
  const counts = useMemo(
    () => ({
      all: applications.length + listings.length,
      tracked: applications.length,
      matched: listings.filter((listing) => listing.match >= 60).length,
      open: listings.length,
    }),
    [applications.length, listings],
  );

  return (
    <AppShell>
      <main className="board">
        <JobsHeader count={rows.length} total={counts.all} />
        <JobsFilterBar counts={counts} params={params} />
        <JobsTable
          rows={rows}
          loading={loading}
          showFetchCta={!loading && isSupabase && listings.length === 0}
          onFetchLive={refetch}
        />
      </main>
    </AppShell>
  );
}

function JobsHeader({ count, total }: { count: number; total: number }) {
  return (
    <div className="board__head">
      <div className="board__title-row">
        <h1>Jobs</h1>
        <span className="board__crumbs">Workspace / Jobs</span>
        <span className="board__counter">
          <b>{count}</b> of <b>{total}</b> jobs
        </span>
      </div>
    </div>
  );
}

function JobsFilterBar({
  counts,
  params,
}: {
  counts: Record<'all' | 'tracked' | 'matched' | 'open', number>;
  params: JobsParamsHook;
}) {
  const [draft, setDraft] = useState(params.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setDraft(params.q);
  }, [params.q]);
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  const scopes = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'tracked', label: 'On my board', count: counts.tracked },
    { id: 'matched', label: 'Matched for me', count: counts.matched },
    { id: 'open', label: 'Open positions', count: counts.open },
  ] as const;

  return (
    <div className="board__filters view-filters">
      <div className="topbar__search jobs-search">
        <Icon className="search-icon" name="search" size={14} />
        <input
          aria-label="Search jobs"
          placeholder="Search role, company, location, tag..."
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => params.setParams({ q: next }), 200);
          }}
        />
      </div>
      <span className="filter-divider" />
      {scopes.map((scope) => (
        <button
          key={scope.id}
          className={`filter-chip ${params.scope === scope.id ? 'is-active' : ''}`}
          type="button"
          onClick={() => params.setParams({ scope: scope.id })}
        >
          {scope.label}
          <span className="filter-chip__count">{scope.count}</span>
        </button>
      ))}
      <span className="filter-divider" />
      <select
        aria-label="Filter by status"
        className={`filter-group ${params.statusFilter !== 'all' ? 'is-set' : ''}`}
        value={params.statusFilter}
        onChange={(event) =>
          params.setParams({ status: event.target.value as JobsParams['statusFilter'] })
        }
      >
        <option value="all">Status: All</option>
        {STATUSES.map((status) => (
          <option key={status.id} value={status.id}>
            {status.title}
          </option>
        ))}
        <option value="open">Open / not tracked</option>
      </select>
      <select
        aria-label="Filter by work mode"
        className={`filter-group ${params.remoteFilter !== 'all' ? 'is-set' : ''}`}
        value={params.remoteFilter}
        onChange={(event) =>
          params.setParams({ mode: event.target.value as JobsParams['remoteFilter'] })
        }
      >
        <option value="all">Mode: All</option>
        <option value="Remote">Remote</option>
        <option value="Hybrid">Hybrid</option>
        <option value="Onsite">Onsite</option>
      </select>
    </div>
  );
}

function JobsTable({
  rows,
  loading,
  showFetchCta,
  onFetchLive,
}: {
  rows: JobsRow[];
  loading: boolean;
  showFetchCta: boolean;
  onFetchLive: () => void;
}) {
  return (
    <div className="jobs-table-wrap">
      <table className="jobs-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Status</th>
            <th>Location</th>
            <th>Salary</th>
            <th>Match</th>
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <JobsRowItem key={`${row.kind}-${row.id}`} row={row} />
          ))}
        </tbody>
      </table>
      {loading ? <div className="empty-state">Loading live listings...</div> : null}
      {!loading && showFetchCta ? <FetchLiveJobsEmptyState onFetchLive={onFetchLive} /> : null}
      {!loading && !showFetchCta && rows.length === 0 ? (
        <div className="empty-state">No jobs match those filters.</div>
      ) : null}
    </div>
  );
}

function FetchLiveJobsEmptyState({ onFetchLive }: { onFetchLive: () => void }) {
  const pushToast = useUiStore((state) => state.pushToast);
  const [running, setRunning] = useState(false);

  const runFetch = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/research/run', { method: 'POST' });
      if (!res.ok) throw new Error(`research run ${res.status}`);
      onFetchLive();
    } catch (err) {
      pushToast({ message: err instanceof Error ? err.message : 'Failed to fetch live jobs' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="empty-state">
      <p>No live listings yet. Run a search to pull in open roles.</p>
      <button className="astral-gold-btn" type="button" disabled={running} onClick={runFetch}>
        <Icon name="search" size={14} /> {running ? 'Fetching...' : 'Fetch live jobs'}
      </button>
    </div>
  );
}

function JobsRowItem({ row }: { row: JobsRow }) {
  const router = useRouter();
  const addToWishlist = useAppsStore((state) => state.addToWishlist);
  const pushToast = useUiStore((state) => state.pushToast);
  const href = row.kind === 'tracked' ? `/card/${row.displayId}` : `/listing/${row.displayId}`;

  const wishlist = () => {
    if (row.kind !== 'listing') return;
    const app = addToWishlist(row.listing, 'Jobs');
    pushToast({ message: `${row.companyName} added to Wishlist` });
    router.push(`/card/${app.displayId}`);
  };

  return (
    <tr>
      <td>
        <div className="jobs-row-link">
          <CompanyLogo
            companyId={row.company}
            companyName={row.companyName}
            logoUrl={row.kind === 'tracked' ? row.application.companyLogoUrl : undefined}
            size={34}
            radius={7}
          />
          <span>
            <Link href={href}>
              <strong>{row.role}</strong>
            </Link>
            <span>
              <Link href={`/company/${row.company}`}>{row.companyName}</Link>
              {row.tags.slice(0, 2).map((tag) => (
                <em key={tag}> · {tag}</em>
              ))}
            </span>
          </span>
        </div>
      </td>
      <td>
        <span className="status-pill compact" style={{ color: row.statusColor }}>
          <span className="column__dot" style={{ background: row.statusColor }} />
          {row.statusLabel}
        </span>
      </td>
      <td>{row.location}</td>
      <td>
        ${row.salaryMin}-${row.salaryMax}K
      </td>
      <td>{row.match ? <b className="gold">{row.match}%</b> : <span className="muted">-</span>}</td>
      <td>{row.updated.includes('T') ? fmtDate(row.updated) : row.updated}</td>
      <td>
        {row.kind === 'tracked' ? (
          <Link
            className={`card-cta ${row.status === 'wishlist' ? 'is-primary' : ''}`}
            href={row.status === 'wishlist' ? `/apply/${row.displayId}` : href}
          >
            <Icon name={row.status === 'wishlist' ? 'rocket' : 'external-link'} size={12} />
            {row.status === 'wishlist' ? 'Apply now' : 'Track'}
          </Link>
        ) : (
          <button className="card-cta is-primary" type="button" onClick={wishlist}>
            <Icon name="playlist-add" size={12} /> Wishlist
          </button>
        )}
      </td>
    </tr>
  );
}
