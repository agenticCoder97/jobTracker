'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { resolveIcon } from '@/lib/icon-map';
import type { SignedImportCandidate } from '@/lib/outlook/candidate-signing';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SignedImportCandidate[];
  connectedEmail: string | null;
  loading: boolean;
  onRescan: () => Promise<void> | void;
  onImport: (candidates: SignedImportCandidate[]) => Promise<void> | void;
};

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

function formatReceived(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function OutlookImportDialog({
  open,
  onOpenChange,
  candidates,
  connectedEmail,
  loading,
  onRescan,
  onImport,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Candidates arrive after the dialog opens (the scan resolves asynchronously),
  // so preselect high-confidence rows whenever a fresh result set lands.
  useEffect(() => {
    const highConfidenceIds = candidates
      .filter((candidate) => candidate.payload.confidence === 'high')
      .map((candidate) => candidate.payload.messageId);
    setSelectedIds(new Set(highConfidenceIds));
    setPreviewId(candidates[0]?.payload.messageId ?? null);
  }, [candidates]);

  if (!open) return null;

  const preview =
    candidates.find((candidate) => candidate.payload.messageId === previewId) ?? candidates[0];
  const selectedCount = candidates.filter((candidate) =>
    selectedIds.has(candidate.payload.messageId),
  ).length;

  function toggle(messageId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  function close() {
    onOpenChange(false);
  }

  function importSelected() {
    const chosen = candidates.filter((candidate) => selectedIds.has(candidate.payload.messageId));
    if (chosen.length === 0) return;
    void onImport(chosen);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        aria-label="Outlook application scan"
        aria-modal="true"
        className="modal outlook-import"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <div className="modal__crumbs">
            <Icon name="mail-search" size={14} /> Outlook application scan
          </div>
          {connectedEmail ? (
            <span className="outlook-import__account">{connectedEmail}</span>
          ) : null}
          <span className="grow" />
          <button aria-label="Close" className="icon-btn" type="button" onClick={close}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="modal__main outlook-import__body">
          <ul className="outlook-import__list">
            {candidates.length === 0 ? (
              <li className="outlook-import__empty">
                {loading ? 'Scanning your inbox…' : 'No application emails from the last 3 days.'}
              </li>
            ) : (
              candidates.map((candidate) => {
                const { payload } = candidate;
                const isSelected = selectedIds.has(payload.messageId);
                const isActive = preview?.payload.messageId === payload.messageId;
                return (
                  <li
                    key={payload.messageId}
                    className={`outlook-import__row ${isActive ? 'is-active' : ''}`}
                  >
                    <input
                      aria-label={`Select ${payload.subject}`}
                      checked={isSelected}
                      type="checkbox"
                      onChange={() => toggle(payload.messageId)}
                    />
                    <button
                      className="outlook-import__row-main"
                      type="button"
                      onClick={() => setPreviewId(payload.messageId)}
                    >
                      <span className="outlook-import__row-top">
                        <strong>{payload.extracted.companyName}</strong>
                        <span className={`outlook-import__confidence is-${payload.confidence}`}>
                          {payload.confidence}
                        </span>
                      </span>
                      <span className="outlook-import__role">{payload.extracted.role}</span>
                      <span className="outlook-import__subject">{payload.subject}</span>
                      <span className="outlook-import__meta">
                        {payload.fromName} · {formatReceived(payload.receivedAt)}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="outlook-import__preview">
            {preview ? (
              <>
                <h3 className="outlook-import__preview-subject">
                  {preview.payload.extracted.companyName} · {preview.payload.extracted.role}
                </h3>
                <p className="outlook-import__preview-from">
                  {preview.payload.fromName} &lt;{preview.payload.fromAddress}&gt;
                </p>
                <p className="outlook-import__preview-body">{preview.payload.bodyPreview}</p>
                <dl className="outlook-import__fields">
                  <div>
                    <dt>Source</dt>
                    <dd>{preview.payload.extracted.source}</dd>
                  </div>
                  <div>
                    <dt>Applied</dt>
                    <dd>{preview.payload.extracted.applied}</dd>
                  </div>
                  {preview.payload.extracted.postingUrl ? (
                    <div>
                      <dt>Posting</dt>
                      <dd>{preview.payload.extracted.postingUrl}</dd>
                    </div>
                  ) : null}
                </dl>
                <ul className="outlook-import__reasons">
                  {preview.payload.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="outlook-import__preview-empty">Select an email to preview it.</p>
            )}
          </div>
        </div>

        <footer className="dialog-footer">
          <button className="card-cta" type="button" onClick={close}>
            Cancel
          </button>
          <button
            className="card-cta"
            disabled={loading}
            type="button"
            onClick={() => void onRescan()}
          >
            <Icon name="refresh-cw" size={14} /> Rescan
          </button>
          <button
            className="astral-gold-btn"
            disabled={selectedCount === 0 || loading}
            type="button"
            onClick={importSelected}
          >
            <Icon name="playlist-add" size={14} /> Import {selectedCount} selected
          </button>
        </footer>
      </section>
    </div>
  );
}
