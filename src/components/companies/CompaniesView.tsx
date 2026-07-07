'use client';

import Link from 'next/link';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { COMPANY_DETAILS } from '@/lib/data/seed';
import { useCompanyWatch } from '@/lib/client/use-company-watch';
import { useLiveCompanies, type LiveCompany } from '@/lib/client/use-live-companies';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore, type CompaniesSort } from '@/lib/store/ui-store';
import type { CompanyDetail } from '@/lib/types';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

export type CompanyRow = LiveCompany & {
  appsHere: number;
  detail: CompanyDetail | null;
};

export function useSortedCompanies(): { rows: CompanyRow[]; loading: boolean } {
  const { companies, loading } = useLiveCompanies();
  const applications = useAppsStore((state) => state.applications);
  const search = useUiStore((state) => state.companiesSearch);
  const sort = useUiStore((state) => state.companiesSort);
  const query = search.trim().toLowerCase();

  const rows: CompanyRow[] = companies
    .map((company) => {
      const detail = COMPANY_DETAILS[company.id] ?? null;
      return {
        ...company,
        // Seed companies carry a static demo open-role count on CompanyDetail;
        // live companies get their count from cached external_jobs. Prefer
        // the live count and fall back to the demo number only when the live
        // pipeline hasn't produced one yet (keeps the local/demo grid from
        // regressing to all-zero counts).
        openRoles: company.openRoles > 0 ? company.openRoles : (detail?.openRoles ?? 0),
        appsHere: applications.filter((app) => app.company === company.id).length,
        detail,
      };
    })
    .filter((company) =>
      query
        ? `${company.name} ${company.detail?.industry ?? ''} ${company.detail?.hq ?? ''}`
            .toLowerCase()
            .includes(query)
        : true,
    );

  rows.sort((a, b) => {
    if (sort === 'open') return b.openRoles - a.openRoles;
    if (sort === 'comp') return (b.detail?.medianComp ?? 0) - (a.detail?.medianComp ?? 0);
    if (sort === 'name') return a.name.localeCompare(b.name);
    return (b.detail?.rating ?? 0) - (a.detail?.rating ?? 0);
  });

  return { rows, loading };
}

export function CompaniesView() {
  const { rows: companies, loading } = useSortedCompanies();
  return (
    <AppShell>
      <main className="scroll-view">
        <div className="board__title-row">
          <h1>Companies</h1>
          <span className="board__crumbs">Workspace / Companies</span>
          <span className="board__counter">
            <b>{companies.length}</b> companies tracked
          </span>
        </div>
        <CompaniesFilterBar />
        <div className="companies-grid">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </div>
        {loading ? <div className="empty-state">Loading companies...</div> : null}
        {!loading && isSupabase && companies.length === 0 ? (
          <div className="empty-state">
            No companies yet. Refresh from Research to pull in live roles.
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}

function CompaniesFilterBar() {
  const search = useUiStore((state) => state.companiesSearch);
  const sort = useUiStore((state) => state.companiesSort);
  const setSearch = useUiStore((state) => state.setCompaniesSearch);
  const setSort = useUiStore((state) => state.setCompaniesSort);
  const options: Array<{ id: CompaniesSort; label: string; icon: string }> = [
    { id: 'rating', label: 'Top rated', icon: 'star' },
    { id: 'open', label: 'Most open roles', icon: 'work' },
    { id: 'comp', label: 'Highest comp', icon: 'payments' },
    { id: 'name', label: 'A-Z', icon: 'sort_by_alpha' },
  ];
  return (
    <div className="board__filters view-filters">
      <div className="topbar__search companies-search">
        <Icon className="search-icon" name="search" size={14} />
        <input
          aria-label="Search companies"
          placeholder="Search companies, industries..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {options.map((option) => (
        <button
          key={option.id}
          className={`filter-chip ${sort === option.id ? 'is-active' : ''}`}
          type="button"
          onClick={() => setSort(option.id)}
        >
          <Icon name={option.icon} size={12} /> {option.label}
        </button>
      ))}
    </div>
  );
}

function CompanyCard({ company }: { company: CompanyRow }) {
  const pushToast = useUiStore((state) => state.pushToast);
  const { watched, pending, toggle } = useCompanyWatch(company.id, company.watched);
  const detail = company.detail;

  async function onToggleWatch() {
    const ok = await toggle();
    if (!ok) {
      pushToast({ kind: 'error', message: `Could not update watchlist for ${company.name}` });
    }
  }

  return (
    <article className="company-card">
      <Link className="company-card__main" href={`/company/${company.id}`}>
        <div className="pick__top">
          <CompanyLogo companyId={company.id} size={44} radius={9} />
          <div>
            <h2>{company.name}</h2>
            <p>
              {detail ? `${detail.industry} · ${detail.hq}` : '—'}
            </p>
          </div>
          <div className="pick__match" data-demo-data={detail ? 'true' : undefined}>
            {detail ? (
              <>
                <span className="pick__match-num">
                  <Icon name="star" size={13} /> {detail.rating}
                </span>
                <span>Glassdoor (demo)</span>
              </>
            ) : (
              <span className="pick__match-num">—</span>
            )}
          </div>
        </div>
        <p>
          <Icon name="groups" size={12} />{' '}
          {detail ? `${detail.size} employees · est. ${detail.founded}` : '—'}
        </p>
        <p>
          <Icon name="payments" size={12} />{' '}
          {detail ? `Median comp $${detail.medianComp}K · ${detail.fundingStage}` : '—'}
        </p>
        <p>
          <Icon name="trending_up" size={12} />{' '}
          {detail
            ? `CEO approval ${detail.ceoApproval}% · recommend ${detail.recommendFriend}%`
            : '—'}
        </p>
        <div className="app-card__chips">
          {(detail?.tags ?? []).map((tag) => (
            <span key={tag} className="chip is-tag">
              {tag}
            </span>
          ))}
          {company.appsHere ? <span className="chip">{company.appsHere} on board</span> : null}
        </div>
      </Link>
      <div className="company-card__actions">
        <Link className="card-cta is-primary" href={`/company/${company.id}`}>
          <Icon name="work" size={12} /> {company.openRoles} open roles
        </Link>
        {company.domain ? (
          <a
            className="card-cta"
            href={`https://${company.domain}`}
            rel="noreferrer"
            target="_blank"
          >
            <Icon name="external-link" size={12} /> Site
          </a>
        ) : null}
        <button
          aria-label={`${watched ? 'Remove bookmark for' : 'Bookmark'} ${company.name}`}
          aria-pressed={watched}
          className="card-cta"
          disabled={pending}
          type="button"
          onClick={onToggleWatch}
        >
          <Icon
            name="star"
            size={12}
            {...(watched
              ? {
                  style: {
                    color: 'var(--gold)',
                    fontVariationSettings: '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 20',
                  },
                }
              : {})}
          />
        </button>
      </div>
    </article>
  );
}
