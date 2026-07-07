'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NewApplicationDialog } from '@/components/jobtracker/NewApplicationDialog';
import { DemoOnly } from '@/components/ui/DemoOnly';
import { getCompanyLogoSources, resolveLogoCompany, slugifyCompanyId } from '@/lib/company-logos';
import { COMPANIES, STATUSES, TEAM } from '@/lib/data/seed';
import { deleteStoredFile, openStoredFile, storeFile } from '@/lib/files/client';
import { fileKindOf } from '@/lib/files/kind';
import { resolveIcon } from '@/lib/icon-map';
import { useAppsStore } from '@/lib/store/apps-store';
import { useNotificationsStore } from '@/lib/store/notifications-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useHydration } from '@/lib/store/use-hydration';
import { useUiStore, type BoardSortMode, type FilterId } from '@/lib/store/ui-store';
import { companyNameOf } from '@/lib/utils/company-name';
import { daysFrom, fmtDate } from '@/lib/utils/dates';
import { gradeFor } from '@/lib/utils/ats';
import { resolveOrder } from '@/lib/utils/sort-resolver';
import type {
  Application,
  Attachment,
  CompanyId,
  Priority,
  RemoteMode,
  StatusId,
  TeamId,
  Uuid,
} from '@/lib/types';

type JobTrackerAppProps = {
  initialCardDisplayId?: string;
};

const FILTERS: { id: FilterId; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'inbox' },
  { id: 'mine', label: 'Mine', icon: 'user' },
  { id: 'high', label: 'High prio', icon: 'flame' },
  { id: 'thisweek', label: 'Action this week', icon: 'calendar-days' },
  { id: 'remote', label: 'Remote only', icon: 'globe' },
  { id: 'referral', label: 'Has referral', icon: 'users' },
];

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'file-text' },
  { id: 'match', label: 'Match', icon: 'sparkles' },
  { id: 'activity', label: 'Activity', icon: 'message-square' },
  { id: 'attachments', label: 'Attachments', icon: 'paperclip' },
  { id: 'linked', label: 'Linked', icon: 'link-2' },
  { id: 'history', label: 'History', icon: 'history' },
] as const;

type DetailTab = (typeof tabs)[number]['id'];

export function JobTrackerApp({ initialCardDisplayId }: JobTrackerAppProps) {
  const hydrated = useHydration();
  return (
    <div className="app-shell">
      <TopBar />
      <main className="board">{hydrated ? <BoardView /> : <BoardSkeleton />}</main>
      {hydrated && initialCardDisplayId ? (
        <CardDetailDialog displayId={initialCardDisplayId} />
      ) : null}
      <NewApplicationDialog />
      <ToastHost />
    </div>
  );
}

export function PlaceholderApp({ title, description }: { title: string; description: string }) {
  return (
    <div className="app-shell">
      <TopBar />
      <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div className="empty-state" style={{ maxWidth: 680 }}>
          <h1 style={{ margin: 0, color: 'var(--white)', fontSize: 28 }}>{title}</h1>
          <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{description}</p>
          <Link className="astral-gold-btn" href="/">
            <Icon name="layout-dashboard" size={14} /> Back to board
          </Link>
        </div>
      </main>
      <NewApplicationDialog />
      <ToastHost />
    </div>
  );
}

export function Icon({
  name,
  size = 16,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-rounded ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size,
        fontVariationSettings: `"wght" 500, "GRAD" 0, "opsz" ${Math.max(20, size)}`,
        ...style,
      }}
    >
      {resolveIcon(name)}
    </span>
  );
}

export function CompanyLogo({
  companyId,
  size = 32,
  radius = 6,
}: {
  companyId: CompanyId;
  size?: number;
  radius?: number;
}) {
  const company = resolveLogoCompany(companyId, COMPANIES[companyId]);
  const logoSources = useMemo(() => getCompanyLogoSources(company, size), [company, size]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = logoSources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
  }, [company.id, size]);

  if (source) {
    return (
      <span
        aria-label={`${company.name} logo`}
        className="app-card__logo is-image-logo"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Logo fallbacks include external SVG sources and need native onError source cycling. */}
        <img
          alt=""
          aria-hidden="true"
          decoding="async"
          height={size}
          loading="lazy"
          referrerPolicy={source.referrerPolicy}
          src={source.src}
          width={size}
          onError={() => setSourceIndex((current) => current + 1)}
        />
      </span>
    );
  }

  return (
    <span
      aria-label={`${company.name} logo`}
      className="app-card__logo"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: company.bg,
        color: company.dark ? '#0A0A0B' : '#fff',
        border: company.ring ? '0.5px solid var(--border)' : undefined,
      }}
    >
      {company.initial}
    </span>
  );
}

function Avatar({ who, size = 22 }: { who: TeamId; size?: number }) {
  const teamMember = TEAM[who];
  if (!teamMember) return null;
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: teamMember.color,
        fontSize: size <= 22 ? 10 : 12,
      }}
    >
      {teamMember.initial}
    </span>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const unreadCount = useNotificationsStore(
    (state) =>
      state.notifications.filter(
        (notification) => !state.readAt[notification.id] && !state.dismissedAt[notification.id],
      ).length,
  );
  const openNewApp = useUiStore((state) => state.openNewApp);
  const pushToast = useUiStore((state) => state.pushToast);

  function createApplication() {
    openNewApp('wishlist');
  }

  function demo(label: string) {
    pushToast({ kind: 'info', message: `Demo only: ${label} is not wired yet.` });
  }

  return (
    <header className="topbar">
      <Link className="topbar__brand" href="/">
        <span className="star">★</span>
        <span>JobTrack</span>
      </Link>
      <nav className="topbar__nav" aria-label="Primary">
        <Link
          className={pathname === '/' || pathname.startsWith('/card') ? 'is-active' : ''}
          href="/"
        >
          <Icon name="layout-dashboard" /> Home
        </Link>
        <Link className={pathname.startsWith('/jobs') ? 'is-active' : ''} href="/jobs">
          <Icon name="list" /> Jobs
        </Link>
        <Link className={pathname.startsWith('/companies') ? 'is-active' : ''} href="/companies">
          <Icon name="building-2" /> Companies
        </Link>
        <Link className={pathname.startsWith('/research') ? 'is-active' : ''} href="/research">
          <Icon name="compass" /> Research
        </Link>
      </nav>
      <Link className="topbar__search" href="/jobs?focus=search">
        <Icon className="search-icon" name="search" size={14} />
        <input
          aria-label="Search"
          readOnly
          placeholder="Search applications, companies, notes..."
        />
        <kbd>⌘K</kbd>
      </Link>
      <div className="topbar__right">
        <button className="astral-gold-btn" onClick={createApplication}>
          <Icon name="plus" size={14} /> Create
        </button>
        <div style={{ position: 'relative' }}>
          <button
            className="topbar__icon-btn"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Icon name="bell" />
            {unreadCount > 0 ? (
              <span
                style={{
                  position: 'absolute',
                  top: 7,
                  right: 7,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--error)',
                  border: '2px solid var(--surface)',
                }}
              />
            ) : null}
          </button>
          {notificationsOpen ? <NotificationsPopover /> : null}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="topbar__avatar" onClick={() => setUserOpen((open) => !open)}>
            YO
          </button>
          {userOpen ? (
            <PopoverPanel right={0} width={268}>
              <div className="row-center" style={{ gap: 10, padding: 10 }}>
                <span className="topbar__avatar">YO</span>
                <div>
                  <div style={{ color: 'var(--white)', fontWeight: 700 }}>You · @youruser</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>you@example.com</div>
                </div>
              </div>
              <MenuButton href="/profile" icon="user" label="Profile" />
              <MenuButton
                icon="settings"
                label="Account settings"
                onClick={() => demo('Account settings')}
              />
              <MenuButton
                icon="bell"
                label="Notification preferences"
                onClick={() => demo('Notification preferences')}
              />
              <MenuButton icon="moon" label="Appearance" onClick={() => demo('Appearance')} />
              <MenuButton
                icon="circle-help"
                label="Help and shortcuts"
                onClick={() => demo('Help and shortcuts')}
              />
              <MenuButton icon="log-out" label="Log out" onClick={() => demo('Log out')} danger />
            </PopoverPanel>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function PopoverPanel({
  children,
  width,
  right = 0,
}: {
  children: ReactNode;
  width: number;
  right?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 44,
        right,
        zIndex: 100,
        width,
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-pop)',
        padding: 6,
      }}
    >
      {children}
    </div>
  );
}

function MenuButton({
  href,
  icon,
  label,
  onClick,
  danger,
}: {
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className = 'row-center';
  const style: CSSProperties = {
    gap: 10,
    width: '100%',
    border: 0,
    borderRadius: 'var(--radius-lg)',
    background: 'transparent',
    color: danger ? 'var(--error)' : 'var(--body)',
    cursor: 'pointer',
    padding: '9px 10px',
    textAlign: 'left',
  };

  if (href) {
    return (
      <Link className={className} href={href} style={style}>
        <Icon name={icon} /> {label}
      </Link>
    );
  }

  return (
    <button className={className} style={style} onClick={onClick}>
      <Icon name={icon} /> {label}
    </button>
  );
}

function NotificationsPopover() {
  const notifications = useNotificationsStore((state) => state.notifications);
  const readAt = useNotificationsStore((state) => state.readAt);
  const markAllRead = useNotificationsStore((state) => state.markAllRead);
  return (
    <PopoverPanel right={0} width={360}>
      <div
        className="row-center"
        style={{ justifyContent: 'space-between', padding: '8px 10px 12px' }}
      >
        <strong style={{ color: 'var(--white)' }}>Notifications</strong>
        <button
          style={{ border: 0, background: 'transparent', color: 'var(--gold)', cursor: 'pointer' }}
          onClick={markAllRead}
        >
          Mark all read
        </button>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="row-center"
            style={{ gap: 10, borderRadius: 'var(--radius-lg)', padding: 10 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: readAt[notification.id] ? 'transparent' : 'var(--gold)',
              }}
            />
            <div>
              <div style={{ color: 'var(--white)', fontSize: 13 }}>{notification.title}</div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>{notification.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </PopoverPanel>
  );
}

function BoardView() {
  const applications = useAppsStore((state) => state.applications);
  const moveStatus = useAppsStore((state) => state.moveStatus);
  const reorderInStatus = useAppsStore((state) => state.reorderInStatus);
  const boardFilter = useUiStore((state) => state.boardFilter);
  const setBoardFilter = useUiStore((state) => state.setBoardFilter);
  const boardCompanyFilter = useUiStore((state) => state.boardCompanyFilter);
  const setBoardCompanyFilter = useUiStore((state) => state.setBoardCompanyFilter);
  const boardLocationFilter = useUiStore((state) => state.boardLocationFilter);
  const setBoardLocationFilter = useUiStore((state) => state.setBoardLocationFilter);
  const boardTagFilter = useUiStore((state) => state.boardTagFilter);
  const setBoardTagFilter = useUiStore((state) => state.setBoardTagFilter);
  const boardSortMode = useUiStore((state) => state.boardSortMode);
  const setBoardSortMode = useUiStore((state) => state.setBoardSortMode);
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const openNewApp = useUiStore((state) => state.openNewApp);
  const [draggingId, setDraggingId] = useState<Uuid | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<StatusId | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const counts = useMemo(() => computeFilterCounts(applications), [applications]);
  const filteredApplications = useMemo(
    () =>
      filterApplications(
        applications.filter((app) => !app.archivedAt && !app.deletedAt),
        boardFilter,
        {
          company: boardCompanyFilter,
          location: boardLocationFilter,
          tag: boardTagFilter,
        },
      ),
    [applications, boardCompanyFilter, boardFilter, boardLocationFilter, boardTagFilter],
  );
  const companyOptions = useMemo(() => {
    const companies = Array.from(new Set(applications.map((application) => application.company)));
    return companies.sort((a, b) =>
      (COMPANIES[a]?.name ?? a).localeCompare(COMPANIES[b]?.name ?? b),
    );
  }, [applications]);
  const locationOptions = useMemo(
    () => Array.from(new Set(applications.map((application) => application.location))).sort(),
    [applications],
  );
  const tagOptions = useMemo(
    () => Array.from(new Set(applications.flatMap((application) => application.tags))).sort(),
    [applications],
  );
  const byStatus = useMemo(() => {
    const groups: Record<StatusId, Application[]> = {
      wishlist: [],
      applied: [],
      screen: [],
      interview: [],
      offer: [],
      rejected: [],
    };
    for (const application of filteredApplications) groups[application.status].push(application);
    for (const status of STATUSES) {
      groups[status.id] = resolveOrder(groups[status.id], boardSortMode);
    }
    return groups;
  }, [boardSortMode, filteredApplications]);

  function addCard(status: StatusId) {
    openNewApp(status);
  }

  function statusForDragTarget(id: string, overStatus?: StatusId): StatusId | null {
    if (overStatus) return overStatus;
    const statusMatch = STATUSES.find((status) => status.id === id);
    if (statusMatch) return statusMatch.id;
    return applications.find((application) => application.id === id)?.status ?? null;
  }

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const overId = event.over?.id ? String(event.over.id) : null;
    const overStatus = event.over?.data.current?.status as StatusId | undefined;
    setDragOverStatus(overId ? statusForDragTarget(overId, overStatus) : null);
  }

  function onDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    const activeApp = applications.find((application) => application.id === activeId);
    const targetStatus = overId
      ? statusForDragTarget(overId, event.over?.data.current?.status as StatusId | undefined)
      : null;

    if (activeApp && targetStatus) {
      if (activeApp.status === targetStatus) {
        const currentIds = byStatus[targetStatus].map((application) => application.id);
        const oldIndex = currentIds.indexOf(activeId);
        const newIndex = currentIds.indexOf(overId ?? activeId);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          setBoardSortMode('manual');
          reorderInStatus(targetStatus, arrayMove(currentIds, oldIndex, newIndex));
        }
      } else {
        setBoardSortMode('manual');
        moveStatus(activeId, targetStatus);
      }
    }

    setDraggingId(null);
    setDragOverStatus(null);
  }

  return (
    <>
      <div className="board__head">
        <div className="board__title-row">
          <h1>Job Search · Spring 2026</h1>
          <span className="board__crumbs">
            Workspace / <span>Personal</span> / Board
          </span>
          <span className="board__counter">
            <b>{applications.length}</b> applications ·{' '}
            <b>{applications.filter((app) => app.status !== 'rejected').length}</b> active
          </span>
        </div>
        <div className="board__filters">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              className={`filter-chip ${boardFilter === filter.id ? 'is-active' : ''}`}
              onClick={() => setBoardFilter(filter.id)}
            >
              <Icon name={filter.icon} size={12} />
              {filter.label}
              <span className="filter-chip__count">{counts[filter.id]}</span>
            </button>
          ))}
          <span className="filter-divider" />
          <label className={`filter-group ${boardCompanyFilter !== 'all' ? 'is-set' : ''}`}>
            <Icon name="building-2" size={12} />
            <select
              aria-label="Filter by company"
              value={boardCompanyFilter}
              onChange={(event) => setBoardCompanyFilter(event.target.value)}
            >
              <option value="all">Company: All</option>
              {companyOptions.map((companyId) => (
                <option key={companyId} value={companyId}>
                  {COMPANIES[companyId]?.name ?? companyId}
                </option>
              ))}
            </select>
          </label>
          <label className={`filter-group ${boardLocationFilter !== 'all' ? 'is-set' : ''}`}>
            <Icon name="map-pin" size={12} />
            <select
              aria-label="Filter by location"
              value={boardLocationFilter}
              onChange={(event) => setBoardLocationFilter(event.target.value)}
            >
              <option value="all">Location: All</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </label>
          <label className={`filter-group ${boardTagFilter !== 'all' ? 'is-set' : ''}`}>
            <Icon name="tag" size={12} />
            <select
              aria-label="Filter by tag"
              value={boardTagFilter}
              onChange={(event) => setBoardTagFilter(event.target.value)}
            >
              <option value="all">Tags: All</option>
              {tagOptions.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-group is-set">
            <Icon name="arrow-down-up" size={12} />
            <select
              aria-label="Sort board"
              value={boardSortMode}
              onChange={(event) => setBoardSortMode(event.target.value as BoardSortMode)}
            >
              <option value="lastActivity">Sort: Last activity</option>
              <option value="priority">Sort: Priority</option>
              <option value="dateApplied">Sort: Applied date</option>
              <option value="manual">Sort: Manual</option>
            </select>
          </label>
          <span className="view-toggle">
            {(['board', 'list', 'timeline'] as const).map((mode) => (
              <button
                key={mode}
                className={viewMode === mode ? 'is-active' : ''}
                onClick={() => setViewMode(mode)}
              >
                <Icon
                  name={mode === 'board' ? 'kanban-square' : mode === 'list' ? 'list' : 'calendar'}
                  size={12}
                />
                {mode[0]?.toUpperCase()}
                {mode.slice(1)}
              </button>
            ))}
          </span>
        </div>
      </div>
      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragCancel={() => {
            setDraggingId(null);
            setDragOverStatus(null);
          }}
          onDragEnd={onDragEnd}
        >
          <div className="board__columns">
            {STATUSES.map((status) => (
              <Column
                key={status.id}
                statusId={status.id}
                items={byStatus[status.id]}
                draggingId={draggingId}
                dragOver={dragOverStatus === status.id}
                onAddCard={addCard}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div style={{ padding: 24 }}>
          <div className="empty-state">
            <h2 style={{ margin: 0, color: 'var(--white)' }}>Coming soon</h2>
            <p style={{ color: 'var(--muted)' }}>
              The {viewMode} view is planned after the board workflow.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function computeFilterCounts(applications: Application[]): Record<FilterId, number> {
  return {
    all: applications.length,
    mine: applications.length,
    high: applications.filter((app) => app.priority === 'high').length,
    thisweek: applications.filter((app) => app.nextActionDue && daysFrom(app.nextActionDue) > -7)
      .length,
    remote: applications.filter((app) => app.remote === 'Remote').length,
    referral: applications.filter((app) => Boolean(app.referral) || app.tags.includes('Referral'))
      .length,
  };
}

export function filterApplications(
  applications: Application[],
  filter: FilterId,
  fields: { company: string; location: string; tag: string } = {
    company: 'all',
    location: 'all',
    tag: 'all',
  },
): Application[] {
  return applications.filter((app) => {
    if (filter === 'high' && app.priority !== 'high') return false;
    if (filter === 'thisweek' && !(app.nextActionDue && daysFrom(app.nextActionDue) > -7)) {
      return false;
    }
    if (filter === 'remote' && app.remote !== 'Remote') return false;
    if (filter === 'referral' && !(Boolean(app.referral) || app.tags.includes('Referral'))) {
      return false;
    }
    if (fields.company !== 'all' && app.company !== fields.company) return false;
    if (fields.location !== 'all' && app.location !== fields.location) return false;
    if (fields.tag !== 'all' && !app.tags.includes(fields.tag)) return false;
    return true;
  });
}

function Column({
  statusId,
  items,
  draggingId,
  dragOver,
  onAddCard,
}: {
  statusId: StatusId;
  items: Application[];
  draggingId: Uuid | null;
  dragOver: boolean;
  onAddCard: (status: StatusId) => void;
}) {
  const status = STATUSES.find((item) => item.id === statusId);
  const { isOver, setNodeRef } = useDroppable({
    id: statusId,
    data: { type: 'column', status: statusId },
  });
  if (!status) return null;
  return (
    <section
      ref={setNodeRef}
      className={`column ${dragOver || isOver ? 'is-drag-over' : ''}`}
      data-status={statusId}
    >
      <div className="column__head">
        <span className="column__dot" style={{ background: status.dot }} />
        <span className="column__title">{status.title}</span>
        <span className="column__count">{items.length}</span>
        <DemoOnly label={`${status.title} column actions`} asChild>
          <button
            type="button"
            className="icon-btn"
            aria-label={`${status.title} column actions`}
            style={{ width: 22, height: 22, borderRadius: 'var(--radius-sm)' }}
          >
            <Icon name="more-horizontal" size={14} />
          </button>
        </DemoOnly>
      </div>
      <div className="column__list">
        <SortableContext
          id={statusId}
          items={items.map((application) => application.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              isDragging={draggingId === application.id}
            />
          ))}
        </SortableContext>
        <button className="column__add" onClick={() => onAddCard(statusId)}>
          <Icon name="plus" size={13} /> Add application
        </button>
      </div>
    </section>
  );
}

function ApplicationCard({
  application,
  isDragging,
}: {
  application: Application;
  isDragging: boolean;
}) {
  const router = useRouter();
  const activity = useAppsStore((state) => state.activity[application.id]);
  const days = daysFrom(application.applied ?? application.posted);
  const priority = priorityMeta(application.priority);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: application.id,
    data: { type: 'application', status: application.status },
  });

  return (
    <div
      ref={setNodeRef}
      className={`app-card ${isDragging ? 'is-dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/card/${application.displayId}`)}
    >
      <div className="app-card__top">
        <CompanyLogo companyId={application.company} />
        <div className="app-card__title-wrap">
          <div className="app-card__role">{application.role}</div>
          <div className="app-card__company">
            <Link
              href={`/company/${application.company}`}
              onClick={(event) => event.stopPropagation()}
            >
              {companyNameOf(application)}
            </Link>
            <span className="sep" />
            <span>{application.remote}</span>
          </div>
        </div>
      </div>
      <div className="app-card__chips">
        <span className={`chip ${priority.className}`}>
          <Icon name={priority.icon} size={10} /> {priority.label}
        </span>
        <span className="chip">
          <Icon name="dollar-sign" size={10} /> ${application.salaryMin}-{application.salaryMax}K
        </span>
        {application.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="chip is-tag">
            {tag}
          </span>
        ))}
      </div>
      <div className="app-card__bottom">
        <span className="app-card__id">{application.displayId}</span>
        <span className="row-center" style={{ gap: 4 }}>
          <Icon name="calendar" size={11} />
          <b>{days}d</b>
        </span>
        <span className="row-center" style={{ gap: 4 }}>
          <Icon name="message-square" size={11} />
          {activity?.comments.length ?? 0}
        </span>
        <span className="row-center" style={{ gap: 4 }}>
          <Icon name="paperclip" size={11} />
          {activity?.attachments.length ?? 0}
        </span>
        <span className="grow" />
        <Avatar who="me" />
      </div>
      <Link
        className={`card-cta ${application.status === 'wishlist' ? 'is-primary' : ''}`}
        href={
          application.status === 'wishlist'
            ? `/apply/${application.displayId}`
            : `/card/${application.displayId}`
        }
        onClick={(event) => event.stopPropagation()}
      >
        <Icon name={application.status === 'wishlist' ? 'rocket' : 'external-link'} size={12} />
        {application.status === 'wishlist' ? 'Apply now' : 'Track'}
      </Link>
    </div>
  );
}

function priorityMeta(priority: Priority): { label: string; icon: string; className: string } {
  if (priority === 'high')
    return { label: 'High', icon: 'arrow-up', className: 'is-priority-high' };
  if (priority === 'med') return { label: 'Med', icon: 'minus', className: 'is-priority-med' };
  return { label: 'Low', icon: 'arrow-down', className: 'is-priority-low' };
}

function attachmentIcon(kind: Attachment['kind']): string {
  if (kind === 'zip') return 'folder_zip';
  if (kind === 'xls') return 'table';
  if (kind === 'img') return 'image';
  if (kind === 'ics') return 'event';
  return 'description';
}

export function CardDetailDialog({ displayId }: { displayId: string }) {
  const router = useRouter();
  const application = useAppsStore((state) => state.getByDisplayId(displayId));
  const updateApp = useAppsStore((state) => state.updateApp);
  const archiveApp = useAppsStore((state) => state.archiveApp);
  const deleteApp = useAppsStore((state) => state.deleteApp);
  const pushToast = useUiStore((state) => state.pushToast);
  const [tab, setTab] = useState<DetailTab>('overview');
  const hadInAppHistoryRef = useRef(false);
  useEffect(() => {
    hadInAppHistoryRef.current =
      typeof window !== 'undefined' &&
      typeof window.history !== 'undefined' &&
      window.history.length > 1;
  }, []);

  function close() {
    if (hadInAppHistoryRef.current) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!application) {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={close}>
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="card-detail-not-found-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="modal__main">
            <div className="empty-state">
              <h1 id="card-detail-not-found-title" style={{ marginTop: 0, color: 'var(--white)' }}>
                Card not found
              </h1>
              <p style={{ color: 'var(--muted)' }}>
                The application <strong>{displayId}</strong> doesn&apos;t exist or was removed.
              </p>
              <button className="astral-gold-btn" onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            Board <Icon name="chevron-right" size={14} /> <span>{companyNameOf(application)}</span>{' '}
            <span className="id">{application.displayId}</span>
          </div>
          <span className="grow" />
          {application.status === 'wishlist' ? (
            <Link className="astral-gold-btn" href={`/apply/${application.displayId}`}>
              <Icon name="rocket" size={14} /> Apply now
            </Link>
          ) : null}
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
              if (
                !window.confirm(`Delete ${application.displayId}? This removes it from your board.`)
              ) {
                return;
              }
              deleteApp(application.id);
              pushToast({ message: 'Card deleted' });
              close();
            }}
          >
            <Icon name="trash-2" />
          </button>
          <button className="icon-btn" aria-label="Close" onClick={close}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal__body">
          <div className="modal__main">
            <h1
              id="card-detail-title"
              className="modal__title"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="false"
              aria-label="Role title"
              onBlur={(event) =>
                updateApp(
                  application.id,
                  { role: event.currentTarget.textContent ?? application.role },
                  'Role title edited',
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
            >
              {application.role}
            </h1>
            <CompanyLine application={application} />
            <MetaRow application={application} />
            <TabBar application={application} tab={tab} onTabChange={setTab} />
            <TabContent application={application} tab={tab} />
          </div>
          <SidePanel application={application} />
        </div>
      </div>
    </div>
  );
}

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
            const url = window.prompt('Posting URL (https://...)');
            if (url?.trim())
              updateApp(application.id, { postingUrl: url.trim() }, 'Posting URL added');
          }}
        >
          Add posting link
        </button>
      )}
    </div>
  );
}

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

function TabBar({
  application,
  tab,
  onTabChange,
}: {
  application: Application;
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
}) {
  const activity = useAppsStore((state) => state.activity[application.id]);
  const docs = useAppsStore((state) => state.appDocs[application.id]);
  const counts: Partial<Record<DetailTab, number>> = {
    activity: activity?.comments.length ?? 0,
    attachments: activity?.attachments.length ?? 0,
    linked: activity?.links.length ?? 0,
    history: activity?.history.length ?? 0,
  };
  if (docs) counts.match = docs.ats.score;

  return (
    <div className="modal__tabs" role="tablist">
      {tabs.map((item) => (
        <button
          key={item.id}
          className={tab === item.id ? 'is-active' : ''}
          onClick={() => onTabChange(item.id)}
        >
          <Icon name={item.icon} size={14} />
          {item.label}
          {counts[item.id] !== undefined ? <span className="num">{counts[item.id]}</span> : null}
        </button>
      ))}
    </div>
  );
}

function TabContent({ application, tab }: { application: Application; tab: DetailTab }) {
  if (tab === 'match') return <MatchTab application={application} />;
  if (tab === 'activity') return <ActivityTab application={application} />;
  if (tab === 'attachments') return <AttachmentsTab application={application} />;
  if (tab === 'linked') return <LinkedTab application={application} />;
  if (tab === 'history') return <HistoryTab application={application} />;
  return <OverviewTab application={application} />;
}

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
              rows={5}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'transparent',
                color: 'var(--white)',
                font: 'inherit',
                padding: 8,
              }}
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
            {application.description ?? 'No role description yet - click to add one.'}
          </p>
        )}
      </Section>
      {application.requirements?.length ? (
        <Section title="What they want">
          <ul>
            {application.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      {application.nextAction ? (
        <Section title="Next action">
          <div className="empty-state">
            <strong style={{ color: 'var(--white)' }}>{application.nextAction}</strong>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>
              Due {fmtDate(application.nextActionDue)}
            </div>
          </div>
        </Section>
      ) : null}
      {application.offer ? (
        <Section title="Offer breakdown">
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}
          >
            {Object.entries(application.offer).map(([label, value]) => (
              <div key={label} className="empty-state">
                <div style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{label}</div>
                <strong style={{ color: 'var(--white)' }}>${value}K</strong>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
      {application.rejectedReason ? (
        <Section title="Rejection reason">
          <div
            className="empty-state"
            style={{ borderColor: 'rgba(239,83,80,0.45)', color: 'var(--error)' }}
          >
            {application.rejectedReason}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function MatchTab({ application }: { application: Application }) {
  const docs = useAppsStore((state) => state.appDocs[application.id]);
  const resumes = useProfileStore((state) => state.resumes);
  const coverLetters = useProfileStore((state) => state.coverLetters);
  if (!docs) {
    return (
      <div className="empty-state">
        <h3 style={{ marginTop: 0, color: 'var(--white)' }}>No linked documents</h3>
        <p style={{ color: 'var(--muted)' }}>Apply with a resume to generate ATS scoring.</p>
      </div>
    );
  }
  const grade = gradeFor(docs.ats.score);
  const resume = resumes.find((item) => item.id === docs.resumeId);
  const coverLetter = coverLetters.find((item) => item.id === docs.coverLetterId);
  return (
    <>
      <Section title="Documents linked">
        <div className="linked-list">
          <div className="linked-row">Resume: {resume?.name ?? 'Unknown resume'}</div>
          <div className="linked-row">Cover letter: {coverLetter?.name ?? 'None linked'}</div>
        </div>
      </Section>
      <Section title="ATS match score">
        <div className="ats-score-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <strong style={{ color: grade.color, fontSize: 42 }}>{docs.ats.score}</strong>
            <span style={{ color: grade.color }}>{grade.label}</span>
          </div>
          <div className="ats-bar" style={{ height: 8 }}>
            <div
              className="ats-bar__fill"
              style={{ width: `${docs.ats.score}%`, background: grade.color }}
            />
          </div>
          <p style={{ color: 'var(--muted)' }}>
            Required {docs.ats.reqHit}/{docs.ats.required.length} · Nice {docs.ats.niceHit}/
            {docs.ats.nice.length}
          </p>
        </div>
      </Section>
      <Section title="Keyword coverage">
        <div className="app-card__chips">
          {docs.ats.required.map((keyword) => (
            <span
              key={keyword}
              className={`chip ${docs.ats.missingHard.includes(keyword) ? 'is-priority-high' : 'is-tag'}`}
            >
              {keyword}
            </span>
          ))}
          {docs.ats.nice.map((keyword) => (
            <span
              key={keyword}
              className={`chip ${docs.ats.missingSoft.includes(keyword) ? 'is-priority-med' : ''}`}
            >
              {keyword}
            </span>
          ))}
        </div>
      </Section>
      <Section title="Suggested edits">
        <ol>
          {docs.ats.edits.map((edit) => (
            <li key={edit}>{edit}</li>
          ))}
        </ol>
      </Section>
    </>
  );
}

function ActivityTab({ application }: { application: Application }) {
  const activity = useAppsStore((state) => state.activity[application.id]);
  const addComment = useAppsStore((state) => state.addComment);
  const [text, setText] = useState('');

  function submit() {
    addComment(application.id, text);
    setText('');
  }

  return (
    <>
      <div className="comment-box">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a comment..."
        />
        <div className="row-center" style={{ justifyContent: 'space-between' }}>
          <div className="row-center" style={{ gap: 4 }}>
            {(
              [
                { icon: 'paperclip', label: 'Attach file to comment' },
                { icon: 'at-sign', label: 'Mention teammate' },
                { icon: 'smile', label: 'Insert emoji' },
              ] as const
            ).map(({ icon, label }) => (
              <DemoOnly key={icon} label={label} asChild>
                <button type="button" className="icon-btn" aria-label={label}>
                  <Icon name={icon} />
                </button>
              </DemoOnly>
            ))}
          </div>
          <button className="astral-gold-btn" disabled={!text.trim()} onClick={submit}>
            Comment
          </button>
        </div>
      </div>
      <div className="activity">
        {(activity?.comments ?? []).map((comment) => (
          <div key={comment.id} className="activity__item">
            <Avatar who={comment.who} size={28} />
            <div className="activity__bubble">
              <div className="activity__meta">
                {TEAM[comment.who]?.name ?? comment.who} · {fmtDate(comment.when)}
              </div>
              <div>{comment.text}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

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
          <Icon name="upload" size={14} /> {busy ? 'Uploading...' : 'Upload file'}
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
    doc: {
      id: Uuid;
      name: string;
      file: string;
      size: string;
      storagePath?: string;
      dataUrl?: string;
    },
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
      <button className="card-cta" type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

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
          placeholder="https://..."
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
          <div className="empty-state">
            No linked items yet - add the posting, take-home, or docs.
          </div>
        )}
      </div>
    </>
  );
}

function HistoryTab({ application }: { application: Application }) {
  const activity = useAppsStore((state) => state.activity[application.id]);
  const history = activity?.history ?? [];
  return (
    <div className="history-list">
      {history.map((event) => (
        <div key={event.id} className="history-line">
          <div className="row-center" style={{ justifyContent: 'space-between', gap: 12 }}>
            <span>
              <Icon
                name={
                  event.type === 'status'
                    ? 'arrow-right-circle'
                    : event.type === 'comment'
                      ? 'message-square'
                      : 'history'
                }
              />{' '}
              {event.text}
            </span>
            <span style={{ color: 'var(--muted)' }}>{fmtDate(event.when)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SidePanel({ application }: { application: Application }) {
  const updateApp = useAppsStore((state) => state.updateApp);
  const salaryWidth = Math.min(
    100,
    Math.max(8, ((application.salaryMax - application.salaryMin) / 300) * 100),
  );
  return (
    <aside className="modal__side">
      <SideGroup title="Status">
        <SideRow
          label="Stage"
          value={
            STATUSES.find((status) => status.id === application.status)?.title ?? application.status
          }
        />
        <SideRow label="Priority" value={priorityMeta(application.priority).label} />
        <SideRow label="Owner" value={<Avatar who="me" />} />
      </SideGroup>
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
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--white)',
            }}
            value={application.remote}
            onChange={(event) =>
              updateApp(
                application.id,
                { remote: event.target.value as RemoteMode },
                'Work mode edited',
              )
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
          onCommit={(value) =>
            updateApp(application.id, { salaryMin: Number(value) || 0 }, 'Salary edited')
          }
        />
        <EditableSideRow
          label="Salary max ($K)"
          type="number"
          value={String(application.salaryMax)}
          onCommit={(value) =>
            updateApp(application.id, { salaryMax: Number(value) || 0 }, 'Salary edited')
          }
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
      <SideGroup title="Timeline">
        <SideRow label="Posted" value={fmtDate(application.posted)} />
        <SideRow label="Applied" value={fmtDate(application.applied)} />
        <SideRow label="Last activity" value={`${daysFrom(application.lastActivity)}d ago`} />
        <SideRow label="Next due" value={fmtDate(application.nextActionDue)} />
      </SideGroup>
      <SideGroup title="Source">
        <SideRow label="Source" value={application.source} />
        <SideRow label="Referral" value={application.referral ?? 'None'} />
        <div className="app-card__chips" style={{ marginTop: 10 }}>
          {application.tags.map((tag) => (
            <span key={tag} className="chip is-tag">
              {tag}
            </span>
          ))}
        </div>
      </SideGroup>
      <SideGroup title="Watchers">
        <div className="avatar-stack">
          <Avatar who="me" />
          {application.referral?.includes('Marc') ? <Avatar who="marc" /> : null}
          {application.referral?.includes('Priya') ? <Avatar who="priya" /> : null}
          {application.referral?.includes('Dana') ? <Avatar who="dana" /> : null}
        </div>
      </SideGroup>
    </aside>
  );
}

function SideGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="side__group">
      <div className="side__label">{title}</div>
      {children}
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="side__row">
      <span>{label}</span>
      <span className="side__value">{value}</span>
    </div>
  );
}

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
          style={{
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            font: 'inherit',
            textAlign: 'right',
          }}
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
        style={{
          width: 120,
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--white)',
          font: 'inherit',
          padding: '2px 6px',
          textAlign: 'right',
        }}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="modal__section">
      <h4>{title}</h4>
      <div className="modal__desc">{children}</div>
    </section>
  );
}

export function ToastHost() {
  const toasts = useUiStore((state) => state.toasts);
  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="board__columns">
      {STATUSES.map((status) => (
        <div key={status.id} className="column" />
      ))}
    </div>
  );
}
