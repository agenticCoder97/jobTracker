'use client';

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { z } from 'zod';
import { STATUSES } from '@/lib/data/seed';
import { resolveIcon } from '@/lib/icon-map';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';
import type { Priority, RemoteMode, StatusId } from '@/lib/types';

const schema = z.object({
  companyName: z.string().trim().min(1, 'Company is required'),
  role: z.string().trim().min(1, 'Role is required'),
  location: z.string().trim(),
  remote: z.enum(['Remote', 'Hybrid', 'Onsite']),
  salaryMin: z.coerce.number().min(0).default(0),
  salaryMax: z.coerce.number().min(0).default(0),
  status: z.enum(['wishlist', 'applied', 'screen', 'interview', 'offer', 'rejected']),
  priority: z.enum(['high', 'med', 'low']),
  tags: z.string().trim(),
  postingUrl: z.union([z.literal(''), z.string().trim().url('Must be a valid URL')]),
  description: z.string().trim(),
});

type FormData = z.infer<typeof schema>;
type FormErrors = Partial<Record<keyof FormData, string>>;

function Icon({
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

export function NewApplicationDialog() {
  const status = useUiStore((state) => state.newAppStatus);
  if (!status) return null;
  return <NewApplicationForm key={status} initialStatus={status} />;
}

function NewApplicationForm({ initialStatus }: { initialStatus: StatusId }) {
  const router = useRouter();
  const closeNewApp = useUiStore((state) => state.closeNewApp);
  const pushToast = useUiStore((state) => state.pushToast);
  const createCard = useAppsStore((state) => state.createCard);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState({
    companyName: '',
    role: '',
    location: '',
    remote: 'Remote' as RemoteMode,
    salaryMin: '',
    salaryMax: '',
    status: initialStatus,
    priority: 'med' as Priority,
    tags: '',
    postingUrl: '',
    description: '',
  });

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && key in form) {
          const formKey = key as keyof FormData;
          if (!next[formKey]) next[formKey] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    const data = parsed.data;
    const tags = data.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const app = createCard({
      status: data.status,
      companyName: data.companyName,
      role: data.role,
      ...(data.location ? { location: data.location } : {}),
      remote: data.remote,
      ...(data.salaryMin ? { salaryMin: data.salaryMin } : {}),
      ...(data.salaryMax ? { salaryMax: data.salaryMax } : {}),
      priority: data.priority,
      tags,
      ...(data.postingUrl ? { postingUrl: data.postingUrl } : {}),
      ...(data.description ? { description: data.description } : {}),
    });
    closeNewApp();
    pushToast({ message: `${data.companyName} · ${data.role} added` });
    router.push(`/card/${app.displayId}`);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={closeNewApp}>
      <form
        aria-label="New application"
        aria-modal="true"
        className="modal compact-modal"
        role="dialog"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="playlist-add" size={14} /> New application
          </div>
          <span className="grow" />
          <button aria-label="Close" className="icon-btn" type="button" onClick={closeNewApp}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal__main new-app-form">
          <Field error={errors.companyName} id="na-company" label="Company">
            <input
              id="na-company"
              placeholder="e.g. Acme Corp"
              value={form.companyName}
              onChange={(event) => setField('companyName', event.target.value)}
            />
          </Field>
          <Field error={errors.role} id="na-role" label="Role">
            <input
              id="na-role"
              placeholder="e.g. Staff Software Engineer"
              value={form.role}
              onChange={(event) => setField('role', event.target.value)}
            />
          </Field>
          <div className="new-app-form__row">
            <Field id="na-location" label="Location">
              <input
                id="na-location"
                placeholder="e.g. Remote (US)"
                value={form.location}
                onChange={(event) => setField('location', event.target.value)}
              />
            </Field>
            <Field id="na-remote" label="Work mode">
              <select
                id="na-remote"
                value={form.remote}
                onChange={(event) => setField('remote', event.target.value as RemoteMode)}
              >
                <option>Remote</option>
                <option>Hybrid</option>
                <option>Onsite</option>
              </select>
            </Field>
          </div>
          <div className="new-app-form__row">
            <Field id="na-salary-min" label="Salary min ($K)">
              <input
                id="na-salary-min"
                inputMode="numeric"
                value={form.salaryMin}
                onChange={(event) => setField('salaryMin', event.target.value)}
              />
            </Field>
            <Field id="na-salary-max" label="Salary max ($K)">
              <input
                id="na-salary-max"
                inputMode="numeric"
                value={form.salaryMax}
                onChange={(event) => setField('salaryMax', event.target.value)}
              />
            </Field>
          </div>
          <div className="new-app-form__row">
            <Field id="na-status" label="Status">
              <select
                id="na-status"
                value={form.status}
                onChange={(event) => setField('status', event.target.value as StatusId)}
              >
                {STATUSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="na-priority" label="Priority">
              <select
                id="na-priority"
                value={form.priority}
                onChange={(event) => setField('priority', event.target.value as Priority)}
              >
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </select>
            </Field>
          </div>
          <Field id="na-tags" label="Tags (comma-separated)">
            <input
              id="na-tags"
              placeholder="e.g. TypeScript, Platform"
              value={form.tags}
              onChange={(event) => setField('tags', event.target.value)}
            />
          </Field>
          <Field error={errors.postingUrl} id="na-url" label="Posting URL">
            <input
              id="na-url"
              placeholder="https://..."
              value={form.postingUrl}
              onChange={(event) => setField('postingUrl', event.target.value)}
            />
          </Field>
          <Field id="na-description" label="Notes / description">
            <textarea
              id="na-description"
              rows={3}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </Field>
        </div>
        <footer className="dialog-footer">
          <button className="card-cta" type="button" onClick={closeNewApp}>
            Cancel
          </button>
          <button className="astral-gold-btn" type="submit">
            <Icon name="playlist-add" size={14} /> Create application
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="new-app-form__field" htmlFor={id}>
      <span className="side__label">{label}</span>
      {children}
      {error ? (
        <span className="form-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
