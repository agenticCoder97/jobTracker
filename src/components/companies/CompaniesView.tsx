'use client';

import Link from 'next/link';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { DemoOnly } from '@/components/ui/DemoOnly';
import { COMPANIES, COMPANY_DETAILS } from '@/lib/data/seed';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore, type CompaniesSort } from '@/lib/store/ui-store';
import type { CompanyDetail } from '@/lib/types';

type CompanyRow = CompanyDetail & {
  name: string;
  appsHere: number;
};

export function useSortedCompanies(): CompanyRow[] {
  const applications = useAppsStore((state) => state.applications);
  const search = useUiStore((state) => state.companiesSearch);
  const sort = useUiStore((state) => state.companiesSort);
  const query = search.trim().toLowerCase();
  const rows = Object.values(COMPANY_DETAILS)
    .map((detail) => ({
      ...detail,
      name: COMPANIES[detail.id]?.name ?? detail.id,
      appsHere: applications.filter((app) => app.company === detail.id).length,
    }))
    .filter((company) =>
      query
        ? `${company.name} ${company.industry} ${company.hq}`.toLowerCase().includes(query)
        : true,
    );

  return rows.sort((a, b) => {
    if (sort === 'open') return b.openRoles - a.openRoles;
    if (sort === 'comp') return b.medianComp - a.medianComp;
    if (sort === 'name') return a.name.localeCompare(b.name);
    return b.rating - a.rating;
  });
}

export function CompaniesView() {
  const companies = useSortedCompanies();
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
  return (
    <article className="company-card">
      <Link className="company-card__main" href={`/company/${company.id}`}>
        <div className="pick__top">
          <CompanyLogo companyId={company.id} size={44} radius={9} />
          <div>
            <h2>{company.name}</h2>
            <p>
              {company.industry} · {company.hq}
            </p>
          </div>
          <div className="pick__match" data-demo-data="true">
            <span className="pick__match-num">
              <Icon name="star" size={13} /> {company.rating}
            </span>
            <span>Glassdoor (demo)</span>
          </div>
        </div>
        <p>
          <Icon name="groups" size={12} /> {company.size} employees · est. {company.founded}
        </p>
        <p>
          <Icon name="payments" size={12} /> Median comp ${company.medianComp}K ·{' '}
          {company.fundingStage}
        </p>
        <p>
          <Icon name="trending_up" size={12} /> CEO approval {company.ceoApproval}% · recommend{' '}
          {company.recommendFriend}%
        </p>
        <div className="app-card__chips">
          {company.tags.map((tag) => (
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
        <DemoOnly className="card-cta" label={`${company.name} site`}>
          <Icon name="external-link" size={12} /> Site
        </DemoOnly>
        <DemoOnly className="card-cta" label={`Bookmark ${company.name}`}>
          <Icon name="star" size={12} />
        </DemoOnly>
      </div>
    </article>
  );
}
