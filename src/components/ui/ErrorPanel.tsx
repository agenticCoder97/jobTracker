'use client';

import { Icon } from '@/components/jobtracker/JobTrackerApp';

export function ErrorPanel({
  title = 'Something went wrong',
  message,
  onRetry,
  onResetDemo,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onResetDemo?: () => void;
}) {
  return (
    <div className="error-panel" role="alert" aria-live="assertive">
      <div className="error-panel__icon">
        <Icon name="warning" size={28} />
      </div>
      <h2 className="error-panel__title">{title}</h2>
      {message ? <p className="error-panel__msg">{message}</p> : null}
      <div className="error-panel__actions">
        {onRetry ? (
          <button className="astral-gold-btn" type="button" onClick={onRetry}>
            <Icon name="refresh" size={13} /> Try again
          </button>
        ) : null}
        {onResetDemo ? (
          <button className="card-cta is-danger" type="button" onClick={onResetDemo}>
            Reset demo data
          </button>
        ) : null}
      </div>
    </div>
  );
}
