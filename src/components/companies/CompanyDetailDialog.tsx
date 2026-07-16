'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { DemoOnly } from '@/components/ui/DemoOnly';
import { COMPANY_DETAILS, STATUSES } from '@/lib/data/seed';
import { useCompanyWatch } from '@/lib/client/use-company-watch';
import { useLiveCompanies } from '@/lib/client/use-live-companies';
import { useLiveListings } from '@/lib/client/use-live-listings';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';

export function CompanyDetailDialog({ companyId }: { companyId: string }) {
  const router = useRouter();
  const applications = useAppsStore((state) => state.applications);
  const addToWishlist = useAppsStore((state) => state.addToWishlist);
  const pushToast = useUiStore((state) => state.pushToast);
  const { companies, loading: companiesLoading } = useLiveCompanies();
  const { listings } = useLiveListings();
  const company = companies.find((item) => item.id === companyId);
  const detail = COMPANY_DETAILS[companyId] ?? null;
  const { watched, pending, toggle } = useCompanyWatch(companyId, company?.watched ?? false);

  if (!company) {
    return (
      <div className="modal-backdrop">
        <div className="modal compact-modal">
          <div className="modal__main">
            <h1 className="modal__title">
              {companiesLoading ? 'Loading company...' : 'Company not found'}
            </h1>
            {companiesLoading ? null : (
              <Link className="astral-gold-btn" href="/companies">
                Back to companies
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const roles = listings.filter((listing) => listing.company === companyId);
  const pipeline = applications.filter((app) => app.company === companyId);

  async function onToggleWatch() {
    const ok = await toggle();
    if (!ok) {
      pushToast({ kind: 'error', message: `Could not update watchlist for ${company!.name}` });
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label={`${company.name} detail`} className="modal">
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="domain" size={14} /> Companies
            <Icon name="chevron-right" size={12} />
            <span>{company.name}</span>
          </div>
          <span className="grow" />
          <button
            aria-label={`${watched ? 'Remove bookmark for' : 'Star'} ${company.name}`}
            aria-pressed={watched}
            className="icon-btn"
            disabled={pending}
            type="button"
            onClick={onToggleWatch}
          >
            <Icon
              name="star"
              size={15}
              {...(watched
                ? {
                    style: {
                      color: 'var(--gold)',
                      fontVariationSettings: '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24',
                    },
                  }
                : {})}
            />
          </button>
          {company.domain ? (
            <a
              aria-label={`Open ${company.name} site`}
              className="icon-btn"
              href={`https://${company.domain}`}
              rel="noreferrer"
              target="_blank"
            >
              <Icon name="external-link" size={15} />
            </a>
          ) : null}
          <button
            aria-label="Close company detail"
            className="icon-btn"
            type="button"
            onClick={() => router.back()}
          >
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="modal__body company-detail-body">
          <main className="modal__main">
            <div className="listing-hero">
              <CompanyLogo companyId={companyId} company={company} size={64} radius={12} />
              <div>
                <h1 className="modal__title">{company.name}</h1>
                <div className="modal__company-line">
                  <span>{detail?.industry ?? '—'}</span>
                  <span>{detail?.hq ?? '—'}</span>
                  <span>{detail ? `${detail.size} employees` : '—'}</span>
                  <span>{detail ? `Founded ${detail.founded}` : '—'}</span>
                  <b>{detail?.fundingStage ?? '—'}</b>
                </div>
                <div className="app-card__chips">
                  {(detail?.tags ?? []).map((tag) => (
                    <span key={tag} className="chip is-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <DemoOnly className="astral-gold-btn" label={`Follow ${company.name}`}>
                <Icon name="person_add" size={13} /> Follow
              </DemoOnly>
            </div>

            <div className="kpi-grid" {...(detail ? { 'data-demo-data': 'true' } : {})}>
              <Kpi
                meta={detail ? 'Demo data' : 'No data yet'}
                title="Glassdoor rating"
                value={detail ? `${detail.rating}` : '—'}
              />
              <Kpi
                meta={detail ? 'Demo data' : 'No data yet'}
                title="CEO approval"
                value={detail ? `${detail.ceoApproval}%` : '—'}
              />
              <Kpi
                meta={detail ? 'Demo data' : 'No data yet'}
                title="Median comp"
                value={detail ? `$${detail.medianComp}K` : '—'}
              />
              <Kpi
                meta={detail ? 'Demo data' : 'No data yet'}
                title="Interview difficulty"
                value={detail ? `${detail.interviewDifficulty}/5` : '—'}
              />
            </div>

            <section className="modal__section">
              <h4>Open roles for you ({roles.length})</h4>
              <div className="linked-list">
                {roles.length ? (
                  roles.map((role) => (
                    <div key={role.id} className="linked-row action-row">
                      <span className="linked-row__type">{role.match}%</span>
                      <Link className="linked-row__title" href={`/listing/${role.displayId}`}>
                        {role.role}
                      </Link>
                      <span className="linked-row__meta">
                        {role.location} · ${role.salaryMin}-${role.salaryMax}K
                      </span>
                      <button
                        className="card-cta is-primary"
                        type="button"
                        onClick={() => {
                          const app = addToWishlist(role, 'Jobs');
                          pushToast({ message: `${role.role} added to Wishlist` });
                          router.push(`/card/${app.displayId}`);
                        }}
                      >
                        <Icon name="playlist-add" size={12} /> Wishlist
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">No matched open roles right now.</div>
                )}
              </div>
            </section>

            <section className="modal__section">
              <h4>Your pipeline at {company.name}</h4>
              <div className="linked-list">
                {pipeline.length ? (
                  pipeline.map((app) => {
                    const status = STATUSES.find((item) => item.id === app.status);
                    return (
                      <Link key={app.id} className="linked-row" href={`/card/${app.displayId}`}>
                        <span className="linked-row__type">{app.displayId}</span>
                        <span className="linked-row__title">{app.role}</span>
                        <span className="linked-row__meta" style={{ color: status?.color }}>
                          {status?.title ?? app.status}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <div className="empty-state">No applications at this company yet.</div>
                )}
              </div>
            </section>

            <section className="modal__section" data-demo-data="true">
              <h4>Recent employee reviews · Demo data — no integration in v1</h4>
              {[
                [
                  'Best engineering culture I have experienced',
                  'Smart peers, real autonomy, and thoughtful code review.',
                ],
                [
                  'Fast-paced; not for everyone',
                  'Expectations are high, but the work is genuinely interesting.',
                ],
              ].map(([title, body]) => (
                <div key={title} className="activity__bubble review-card">
                  <b>★★★★★ {title}</b>
                  <p>{body}</p>
                </div>
              ))}
            </section>
          </main>
        </div>
      </section>
    </div>
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
