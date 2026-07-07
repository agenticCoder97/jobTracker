'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DemoOnly } from '@/components/ui/DemoOnly';
import { deleteStoredFile, openStoredFile, storeFile } from '@/lib/files/client';
import { resetDemoData } from '@/lib/store/reset-demo-data';
import { useAppsStore } from '@/lib/store/apps-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useUiStore } from '@/lib/store/ui-store';
import { useProfileTab, type ProfileTab } from '@/lib/url-params/use-profile-tab';
import { fmtDate } from '@/lib/utils/dates';
import type { Uuid } from '@/lib/types';

const aboutSchema = z.object({ about: z.string().min(1).max(2000) });

const TAB_DEFS: { id: ProfileTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'person' },
  { id: 'resumes', label: 'Resumes', icon: 'description' },
  { id: 'covers', label: 'Cover letters', icon: 'mail' },
  { id: 'preferences', label: 'Preferences', icon: 'tune' },
  { id: 'activity', label: 'Activity', icon: 'history' },
];

export function ProfileView() {
  const { tab, setTab } = useProfileTab();
  const profile = useProfileStore((state) => state.profile);
  const done = profile.completeness.sections.filter((section) => section.done).length;
  const completion = Math.round((done / profile.completeness.sections.length) * 100);
  return (
    <AppShell>
      <main className="scroll-view profile-view">
        <section className="profile-hero">
          <div className="profile-photo">YO</div>
          <div>
            <h1>
              {profile.name} <span>({profile.pronouns})</span>
            </h1>
            <p>{profile.headline}</p>
            <p>
              {profile.location} · {profile.email} · {profile.phone}
            </p>
            <div className="app-card__chips">
              {profile.openToWork ? <span className="chip is-tag">Open to work</span> : null}
              {profile.links.map((link) => (
                <span key={link.label} className="chip">
                  {link.label}
                </span>
              ))}
            </div>
          </div>
          <DemoOnly className="astral-gold-btn" label="Edit profile (hero)">
            <Icon name="edit" size={13} /> Edit profile
          </DemoOnly>
          <DemoOnly className="card-cta" label="Share profile">
            Share
          </DemoOnly>
          <DemoOnly className="icon-btn" label="Profile settings">
            <Icon name="settings" size={15} />
          </DemoOnly>
        </section>

        <div className="profile-tabs" role="tablist">
          {TAB_DEFS.map(({ id, label, icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'is-active' : ''}
              type="button"
              onClick={() => setTab(id)}
            >
              <Icon name={icon} size={14} /> {label}
            </button>
          ))}
          <span className="profile-completion">
            <i style={{ width: `${completion}%` }} />
            {completion}% complete
          </span>
        </div>

        <div className="profile-layout">
          <section className="profile-main">
            {tab === 'overview' ? <OverviewTab /> : null}
            {tab === 'resumes' ? <DocumentsTab kind="resume" /> : null}
            {tab === 'covers' ? <DocumentsTab kind="cover" /> : null}
            {tab === 'preferences' ? <PreferencesTab /> : null}
            {tab === 'activity' ? <ActivityTab /> : null}
          </section>
          <ProfileSidePanel />
        </div>
      </main>
    </AppShell>
  );
}

function OverviewTab() {
  const profile = useProfileStore((state) => state.profile);
  const updateAbout = useProfileStore((state) => state.updateAbout);
  const [editing, setEditing] = useState(false);
  const form = useForm<{ about: string }>({
    resolver: zodResolver(aboutSchema),
    defaultValues: { about: profile.about },
  });
  return (
    <>
      <div className="profile-card">
        <div className="profile-card-head">
          <h2>About</h2>
          <button
            id="about-edit"
            className="icon-btn"
            type="button"
            aria-label="Edit about"
            onClick={() => setEditing(true)}
          >
            <Icon name="edit" size={14} />
          </button>
        </div>
        {editing ? (
          <form
            className="about-form"
            onSubmit={form.handleSubmit((values) => {
              updateAbout(values.about);
              setEditing(false);
            })}
          >
            <textarea aria-label="About text" {...form.register('about')} />
            <div className="company-card__actions">
              <button
                className="card-cta"
                type="button"
                onClick={() => {
                  form.reset({ about: profile.about });
                  setEditing(false);
                }}
              >
                Cancel
              </button>
              <button className="astral-gold-btn" type="submit">
                Save
              </button>
            </div>
          </form>
        ) : (
          <p className="profile-about">{profile.about}</p>
        )}
      </div>
      <div className="profile-card">
        <h2>Experience</h2>
        {profile.experience.map((item) => (
          <div key={item.id} className="experience-row">
            <CompanyLogo companyId={item.company} size={34} radius={7} />
            <div>
              <strong>{item.role}</strong>
              <small>
                {item.company} · {item.from} - {item.to} · {item.location}
              </small>
              <ul>
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="profile-card">
        <h2>Skills</h2>
        <div className="app-card__chips">
          {profile.skills.map((skill) => (
            <span key={skill.name} className="chip">
              {skill.name} · L{skill.level} · {skill.endorsements}
            </span>
          ))}
        </div>
      </div>
      <div className="two-col">
        <div className="profile-card">
          <h2>Education</h2>
          {profile.education.map((ed) => (
            <p key={ed.id}>
              {ed.school} · {ed.degree}
            </p>
          ))}
        </div>
        <div className="profile-card">
          <h2>Certifications</h2>
          {profile.certifications.map((cert) => (
            <p key={cert.name}>
              {cert.name} · {cert.issuer}
            </p>
          ))}
        </div>
      </div>
      <div className="two-col">
        <div className="profile-card">
          <h2>Languages</h2>
          {profile.languages.map((language) => (
            <p key={language.name}>
              <strong>{language.name}</strong> · {language.level}
            </p>
          ))}
        </div>
        <div className="profile-card">
          <h2>Achievements &amp; talks</h2>
          <ul>
            {profile.achievements.map((achievement) => (
              <li key={achievement}>{achievement}</li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

function DocumentsTab({ kind }: { kind: 'resume' | 'cover' }) {
  const resumes = useProfileStore((state) => state.resumes);
  const covers = useProfileStore((state) => state.coverLetters);
  const setDefaultResume = useProfileStore((state) => state.setDefaultResume);
  const setDefaultCover = useProfileStore((state) => state.setDefaultCoverLetter);
  return (
    <div className="profile-card">
      <div className="profile-card-head">
        <h2>{kind === 'resume' ? 'Resumes' : 'Cover letters'}</h2>
        <UploadDocumentButton kind={kind} />
      </div>
      {kind === 'resume'
        ? resumes.map((doc) => (
            <div key={doc.id} className="doc-row">
              <Icon name="description" size={20} />
              <span>
                <strong>{doc.name}</strong>
                <small>
                  {doc.flavor} · {doc.size} · {doc.pages} pages · used {doc.timesUsed} times ·
                  updated {fmtDate(doc.updated)}
                </small>
                {doc.keywords.length > 0 ? (
                  <span className="doc-row__keywords">
                    {doc.keywords.slice(0, 8).map((keyword) => (
                      <em key={keyword} className="chip">
                        {keyword}
                      </em>
                    ))}
                    {doc.keywords.length > 8 ? (
                      <em className="chip">+{doc.keywords.length - 8}</em>
                    ) : null}
                  </span>
                ) : null}
              </span>
              {doc.isDefault ? (
                <span className="chip is-tag">Default</span>
              ) : (
                <button className="card-cta" type="button" onClick={() => setDefaultResume(doc.id)}>
                  Set default
                </button>
              )}
              <DocumentRowActions doc={doc} kind="resume" />
            </div>
          ))
        : covers.map((doc) => (
            <div key={doc.id} className="doc-row">
              <Icon name="mail" size={20} />
              <span>
                <strong>{doc.name}</strong>
                <small>
                  {doc.flavor} · {doc.size} · used {doc.timesUsed} times · updated{' '}
                  {fmtDate(doc.updated)}
                </small>
              </span>
              {doc.isDefault ? (
                <span className="chip is-tag">Default</span>
              ) : (
                <button className="card-cta" type="button" onClick={() => setDefaultCover(doc.id)}>
                  Set default
                </button>
              )}
              <DocumentRowActions doc={doc} kind="cover" />
            </div>
          ))}
    </div>
  );
}

export function UploadDocumentButton({ kind }: { kind: 'resume' | 'cover' }) {
  const addResume = useProfileStore((state) => state.addResume);
  const addCoverLetter = useProfileStore((state) => state.addCoverLetter);
  const pushToast = useUiStore((state) => state.pushToast);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = kind === 'resume' ? 'Upload resume' : 'Upload cover letter';

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const stored = await storeFile(file, kind === 'resume' ? 'resume' : 'cover-letter');
      const base = {
        name: file.name.replace(/\.[^.]+$/, ''),
        flavor: 'Uploaded',
        file: file.name,
        size: stored.size,
        updated: new Date().toISOString(),
        isDefault: false,
        timesUsed: 0,
        ...(stored.storagePath !== undefined ? { storagePath: stored.storagePath } : {}),
        ...(stored.dataUrl !== undefined ? { dataUrl: stored.dataUrl } : {}),
      };
      if (kind === 'resume') {
        addResume({ ...base, pages: 1, keywords: [], summary: '' });
      } else {
        addCoverLetter(base);
      }
      pushToast({ message: `${file.name} uploaded` });
    } catch (error) {
      pushToast({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        hidden
        accept=".pdf,.doc,.docx"
        aria-label={label}
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
      <button
        className="card-cta"
        disabled={busy}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading...' : 'Upload'}
      </button>
    </>
  );
}

function DocumentRowActions({
  doc,
  kind,
}: {
  doc: { id: Uuid; name: string; storagePath?: string; dataUrl?: string };
  kind: 'resume' | 'cover';
}) {
  const removeResume = useProfileStore((state) => state.removeResume);
  const removeCoverLetter = useProfileStore((state) => state.removeCoverLetter);
  const pushToast = useUiStore((state) => state.pushToast);
  const hasFile = Boolean(doc.storagePath ?? doc.dataUrl);
  return (
    <>
      {hasFile ? (
        <button
          className="card-cta"
          type="button"
          onClick={() =>
            void openStoredFile(doc).catch(() =>
              pushToast({ kind: 'error', message: 'Could not open this file.' }),
            )
          }
        >
          Download
        </button>
      ) : (
        <DemoOnly className="card-cta" label={`Preview ${doc.name}`}>
          Preview
        </DemoOnly>
      )}
      <DemoOnly className="card-cta" label={`Edit ${doc.name}`}>
        Edit
      </DemoOnly>
      <button
        className="card-cta"
        type="button"
        onClick={() => {
          if (!window.confirm(`Delete ${doc.name}? This removes it from your library.`)) return;
          void deleteStoredFile(doc);
          if (kind === 'resume') removeResume(doc.id);
          else removeCoverLetter(doc.id);
          pushToast({ message: `${doc.name} deleted` });
        }}
      >
        Delete
      </button>
    </>
  );
}

function PreferencesTab() {
  const profile = useProfileStore((state) => state.profile);
  const pref = profile.preferences;
  return (
    <div className="profile-card">
      <div className="profile-card-head">
        <h2>Search preferences</h2>
        <DemoOnly className="card-cta" label="Edit preferences">
          Edit
        </DemoOnly>
      </div>
      <div className="pref-grid">
        <p>
          <b>Roles</b>
          {pref.roles.join(', ')}
        </p>
        <p>
          <b>Work mode</b>
          {pref.remote.join(', ')}
        </p>
        <p>
          <b>Min comp</b>${pref.minComp}K
        </p>
        <p>
          <b>Notice</b>
          {pref.notice}
        </p>
        <p>
          <b>Industries</b>
          {pref.industries.join(', ')}
        </p>
        <p>
          <b>Avoid</b>
          {pref.avoid.join(', ')}
        </p>
      </div>
    </div>
  );
}

function ActivityTab() {
  const applications = useAppsStore((state) => state.applications);
  const resumes = useProfileStore((state) => state.resumes);
  const profileActivity = useProfileStore((state) => state.activity);
  const mostUsed = [...resumes].sort((a, b) => b.timesUsed - a.timesUsed)[0];
  return (
    <>
      <div className="profile-card">
        <h2>Pipeline summary</h2>
        <p>{applications.length} applications tracked.</p>
        <p>{applications.filter((app) => app.status === 'wishlist').length} roles in Wishlist.</p>
        {mostUsed ? <p>Most-used resume: {mostUsed.name}</p> : null}
      </div>
      <div className="profile-card">
        <h2>Profile audit log</h2>
        {profileActivity.length === 0 ? (
          <p className="muted">No profile changes yet.</p>
        ) : (
          <ul className="activity-log">
            {profileActivity.slice(0, 25).map((entry) => (
              <li key={entry.id}>
                <span className="muted">[{fmtDate(entry.when)}]</span> {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ProfileSidePanel() {
  const profile = useProfileStore((state) => state.profile);
  const resumes = useProfileStore((state) => state.resumes);
  const covers = useProfileStore((state) => state.coverLetters);
  const applications = useAppsStore((state) => state.applications);
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <aside className="profile-side">
      <div className="profile-card">
        <h3>Snapshot</h3>
        <p>Active: {applications.filter((app) => app.status !== 'rejected').length}</p>
        <p>Resumes: {resumes.length}</p>
        <p>Covers: {covers.length}</p>
        <p>Skills: {profile.skills.length}</p>
      </div>
      <div className="profile-card">
        <h3>Completeness</h3>
        {profile.completeness.sections.map((section) => (
          <p key={section.id} className="completeness-row">
            <span>
              {section.done ? '✓' : '○'} {section.label}
            </span>
            {!section.done ? (
              <DemoOnly label={`Add ${section.label}`} className="card-cta is-tiny">
                Add
              </DemoOnly>
            ) : null}
          </p>
        ))}
      </div>
      <div className="profile-card" data-demo-data="true">
        <h3>Who viewed your profile</h3>
        <small>Demo data — no integration in v1</small>
        <p>Rae Okafor · Sourcer - Anthropic</p>
        <p>Mira Halevi · Recruiter - Datadog</p>
        <p>Felix Tan · Recruiter - Vercel</p>
        <DemoOnly label="See all profile viewers" className="card-cta">
          See all 18 viewers →
        </DemoOnly>
      </div>
      <button className="card-cta is-primary" type="button" onClick={() => setResetOpen(true)}>
        Reset demo data
      </button>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset demo data?"
        description="This clears all local changes and restores the seeded JobTracker example data. This cannot be undone."
        confirmLabel="Reset everything"
        destructive
        onConfirm={() => {
          resetDemoData();
          window.location.reload();
        }}
      />
    </aside>
  );
}
