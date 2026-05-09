'use client';

import Link from 'next/link';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { DemoOnly } from '@/components/ui/DemoOnly';
import {
  COMPANIES,
  COMPANIES_WATCH,
  DAILY_PICKS,
  LINKEDIN_EVENTS,
  LINKEDIN_INMAIL,
  LINKEDIN_SUGGESTED,
  MARKET_SALARIES,
  MARKET_SKILLS,
} from '@/lib/data/seed';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import type { DailyPick } from '@/lib/types';

export function ResearchView() {
  const applications = useAppsStore((state) => state.applications);
  const openApps = applications.filter((app) => app.status !== 'rejected').length;
  const offers = applications.filter((app) => app.status === 'offer').length;
  return (
    <AppShell>
      <main className="scroll-view research-view">
        <div className="board__title-row">
          <h1>Research</h1>
          <span className="board__crumbs">Workspace / Research</span>
          <span className="board__counter">
            <b>{DAILY_PICKS.length}</b> daily picks
          </span>
        </div>
        <section className="hero-grid">
          <div className="panel">
            <h2>Daily spotlight</h2>
            <p>
              {DAILY_PICKS[0]?.role} at {COMPANIES[DAILY_PICKS[0]?.company ?? '']?.name}
            </p>
            <Link className="astral-gold-btn" href="#daily-picks">
              <Icon name="travel_explore" size={14} /> Review picks
            </Link>
          </div>
          <div className="panel">
            <h2>Your search momentum</h2>
            <p>
              {openApps} active applications · {offers} offer in flight · 3 warm referral paths
            </p>
            <DemoOnly className="card-cta" label="Tune preferences">
              <Icon name="tune" size={12} /> Tune preferences
            </DemoOnly>
          </div>
        </section>

        <section id="daily-picks" className="view-section">
          <h2>Today&apos;s picks for you</h2>
          <div className="companies-grid">
            {DAILY_PICKS.map((pick) => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        </section>

        <section className="view-section">
          <h2>Pipeline analytics</h2>
          <div className="kpi-grid">
            <Kpi title="Open applications" value={`${openApps}`} meta="+2 vs last week" />
            <Kpi title="Avg time to response" value="6.4d" meta="flat" />
            <Kpi title="Conversion to onsite" value="38%" meta="+4%" />
            <Kpi title="Offers in flight" value={`${offers}`} meta="1 deadline soon" />
          </div>
        </section>

        <section className="view-section two-col">
          <div className="panel">
            <h2>Total comp by level</h2>
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
            <h2>Skill demand</h2>
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
            <DemoOnly className="card-cta" label="Change market trend role">
              <Icon name="swap_horiz" size={12} /> Change role
            </DemoOnly>
          </div>
        </section>

        <section className="view-section">
          <h2>
            LinkedIn signals <span>Demo data - no LinkedIn integration in v1</span>
          </h2>
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
          <h2>Watched companies</h2>
          <div className="watched-grid">
            {COMPANIES_WATCH.map((item) => (
              <Link key={item.company} className="watched-card" href={`/company/${item.company}`}>
                <CompanyLogo companyId={item.company} size={34} radius={7} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.meta}</small>
                </span>
                <b>{item.count}</b>
              </Link>
            ))}
            <DemoOnly className="watched-card dashed" label="Watch another company">
              <Icon name="add" size={16} /> Watch another company
            </DemoOnly>
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function PickCard({ pick }: { pick: DailyPick }) {
  const addToWishlist = useAppsStore((state) => state.addToWishlist);
  const applications = useAppsStore((state) => state.applications);
  const pushToast = useUiStore((state) => state.pushToast);
  const company = COMPANIES[pick.company];
  const onWishlist = applications.some((app) => app.sourceListingId === pick.id);
  return (
    <article className="company-card">
      <div className="pick__top">
        <CompanyLogo companyId={pick.company} size={44} radius={9} />
        <div>
          <h2>{pick.role}</h2>
          <p>
            {company?.name ?? pick.company} · {pick.location}
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
            pushToast({ message: `${company?.name ?? pick.company} added to Wishlist` });
          }}
        >
          <Icon name={onWishlist ? 'check' : 'playlist-add'} size={12} />
          {onWishlist ? 'On wishlist' : 'Add to wishlist'}
        </button>
        <DemoOnly className="card-cta" label={`Open ${pick.role}`}>
          Open
        </DemoOnly>
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
