'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CompanyLogo, Icon } from '@/components/jobtracker/JobTrackerApp';
import { AppShell } from '@/components/layout/AppShell';
import { DemoOnly } from '@/components/ui/DemoOnly';
import { resetDemoData } from '@/lib/store/reset-demo-data';
import { useAppsStore } from '@/lib/store/apps-store';
import { useProfileStore } from '@/lib/store/profile-store';
import { useProfileTab, type ProfileTab } from '@/lib/url-params/use-profile-tab';

const aboutSchema = z.object({ about: z.string().min(1).max(2000) });

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
          <button
            className="astral-gold-btn"
            type="button"
            onClick={() => document.getElementById('about-edit')?.focus()}
          >
            <Icon name="edit" size={13} /> Edit profile
          </button>
          <DemoOnly className="card-cta" label="Share profile">
            Share
          </DemoOnly>
          <DemoOnly className="icon-btn" label="Profile settings">
            <Icon name="settings" size={15} />
          </DemoOnly>
        </section>

        <div className="profile-tabs">
          {(['overview', 'resumes', 'covers', 'preferences', 'activity'] as ProfileTab[]).map(
            (id) => (
              <button
                key={id}
                className={tab === id ? 'is-active' : ''}
                type="button"
                onClick={() => setTab(id)}
              >
                {id}
              </button>
            ),
          )}
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
            <textarea {...form.register('about')} />
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
              {skill.name} · {skill.endorsements}
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
    </>
  );
}

function DocumentsTab({ kind }: { kind: 'resume' | 'cover' }) {
  const resumes = useProfileStore((state) => state.resumes);
  const covers = useProfileStore((state) => state.coverLetters);
  const setDefaultResume = useProfileStore((state) => state.setDefaultResume);
  const setDefaultCover = useProfileStore((state) => state.setDefaultCoverLetter);
  const docs = kind === 'resume' ? resumes : covers;
  return (
    <div className="profile-card">
      <div className="profile-card-head">
        <h2>{kind === 'resume' ? 'Resumes' : 'Cover letters'}</h2>
        <DemoOnly className="card-cta" label={`Upload ${kind}`}>
          Upload
        </DemoOnly>
      </div>
      {docs.map((doc) => (
        <div key={doc.id} className="doc-row">
          <Icon name={kind === 'resume' ? 'description' : 'mail'} size={20} />
          <span>
            <strong>{doc.name}</strong>
            <small>
              {doc.flavor} · {doc.size} · used {doc.timesUsed} times
            </small>
          </span>
          {doc.isDefault ? (
            <span className="chip is-tag">Default</span>
          ) : (
            <button
              className="card-cta"
              type="button"
              onClick={() =>
                kind === 'resume' ? setDefaultResume(doc.id) : setDefaultCover(doc.id)
              }
            >
              Set default
            </button>
          )}
          <DemoOnly className="card-cta" label={`Preview ${doc.name}`}>
            Preview
          </DemoOnly>
          <DemoOnly className="card-cta" label={`Edit ${doc.name}`}>
            Edit
          </DemoOnly>
        </div>
      ))}
    </div>
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
  const mostUsed = [...resumes].sort((a, b) => b.timesUsed - a.timesUsed)[0];
  return (
    <div className="profile-card">
      <h2>Recent activity</h2>
      <p>{applications.length} applications tracked.</p>
      <p>{applications.filter((app) => app.status === 'wishlist').length} roles in Wishlist.</p>
      <p>Most-used resume: {mostUsed?.name}</p>
    </div>
  );
}

function ProfileSidePanel() {
  const profile = useProfileStore((state) => state.profile);
  const resumes = useProfileStore((state) => state.resumes);
  const covers = useProfileStore((state) => state.coverLetters);
  const applications = useAppsStore((state) => state.applications);
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
          <p key={section.id}>
            {section.done ? '✓' : '○'} {section.label}
          </p>
        ))}
      </div>
      <div className="profile-card">
        <h3>Who viewed your profile</h3>
        <small>Demo data</small>
        <p>Rae Okafor · Sourcer - Anthropic</p>
        <p>Mira Halevi · Recruiter - Datadog</p>
        <p>Felix Tan · Recruiter - Vercel</p>
      </div>
      <button
        className="card-cta is-primary"
        type="button"
        onClick={() => {
          if (window.confirm('Reset demo data?')) {
            resetDemoData();
            window.location.reload();
          }
        }}
      >
        Reset demo data
      </button>
    </aside>
  );
}
