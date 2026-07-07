'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/components/jobtracker/JobTrackerApp';
import { DEFAULT_SEARCH_PREFERENCES, type SearchRemote } from '@/lib/research/preferences';
import { useUiStore } from '@/lib/store/ui-store';

const isSupabase = process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase';

type PreferencesResponse = {
  preferences: {
    keywords: string[];
    location: string;
    remote: SearchRemote;
  };
};

export function SearchPreferencesDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: () => void;
}) {
  const pushToast = useUiStore((state) => state.pushToast);
  const [loading, setLoading] = useState(isSupabase);
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_SEARCH_PREFERENCES.keywords);
  const [keywordDraft, setKeywordDraft] = useState('');
  const [location, setLocation] = useState(DEFAULT_SEARCH_PREFERENCES.location);
  const [remote, setRemote] = useState<SearchRemote>(DEFAULT_SEARCH_PREFERENCES.remote);

  useEffect(() => {
    if (!isSupabase) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/research/preferences');
        if (!res.ok) throw new Error(`preferences ${res.status}`);
        const body = (await res.json()) as PreferencesResponse;
        if (!active) return;
        setKeywords(body.preferences.keywords);
        setLocation(body.preferences.location);
        setRemote(body.preferences.remote);
      } catch {
        if (active) pushToast({ kind: 'error', message: 'Could not load search preferences' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addKeyword() {
    const value = keywordDraft.trim();
    if (!value) return;
    setKeywords((prev) =>
      prev.some((k) => k.toLowerCase() === value.toLowerCase()) ? prev : [...prev, value],
    );
    setKeywordDraft('');
  }

  function removeKeyword(value: string) {
    setKeywords((prev) => prev.filter((k) => k !== value));
  }

  async function save() {
    setSaving(true);
    try {
      if (isSupabase) {
        const res = await fetch('/api/research/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords, location, remote }),
        });
        if (!res.ok) throw new Error(`save failed (${res.status})`);
        await fetch('/api/research/run', { method: 'POST' }).catch(() => {});
      }
      pushToast({ message: 'Search preferences saved' });
      onSaved?.();
      onClose();
    } catch (err) {
      pushToast({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not save preferences',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="Search preferences"
        aria-modal="true"
        className="modal compact-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="tune" size={14} /> Search preferences
          </div>
          <span className="grow" />
          <button
            aria-label="Close search preferences"
            className="icon-btn"
            type="button"
            onClick={onClose}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__main new-app-form">
          {loading ? (
            <div className="empty-state">Loading preferences...</div>
          ) : (
            <>
              <div className="new-app-form__field">
                <span className="side__label">Keywords</span>
                <div className="app-card__chips">
                  {keywords.map((keyword) => (
                    <span key={keyword} className="chip is-tag">
                      {keyword}
                      <button
                        aria-label={`Remove ${keyword}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'inherit',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          marginLeft: 4,
                          padding: 0,
                        }}
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="new-app-form__row">
                  <input
                    aria-label="Add keyword"
                    placeholder="e.g. React, platform, staff"
                    value={keywordDraft}
                    onChange={(event) => setKeywordDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addKeyword();
                      }
                    }}
                  />
                  <button className="card-cta" type="button" onClick={addKeyword}>
                    Add
                  </button>
                </div>
              </div>
              <label className="new-app-form__field" htmlFor="prefs-location">
                <span className="side__label">Location</span>
                <input
                  id="prefs-location"
                  placeholder="e.g. Remote, San Francisco"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </label>
              <label className="new-app-form__field" htmlFor="prefs-remote">
                <span className="side__label">Work mode</span>
                <select
                  id="prefs-remote"
                  value={remote}
                  onChange={(event) => setRemote(event.target.value as SearchRemote)}
                >
                  <option value="any">Any</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </label>
            </>
          )}
        </div>
        <footer className="dialog-footer">
          <button className="card-cta" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="astral-gold-btn"
            disabled={saving || loading}
            type="button"
            onClick={save}
          >
            <Icon name="tune" size={14} /> {saving ? 'Saving...' : 'Save preferences'}
          </button>
        </footer>
      </section>
    </div>
  );
}
