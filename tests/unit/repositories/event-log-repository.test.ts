import { beforeEach, describe, expect, test } from 'vitest';
import { createLocalEventLogRepository } from '@/lib/repositories/local/event-log-repository';
import { FORBIDDEN_METADATA_KEYS, redactMetadata } from '@/lib/repositories/types';

describe('redactMetadata', () => {
  test('strips forbidden keys', () => {
    const input: Record<string, unknown> = {
      ok: 'keep',
      token: 'sk_xxx',
      apiKey: 'AKIA',
      rawFile: 'binary',
      resumeText: 'long string',
      coverLetterText: 'longer string',
    };
    const out = redactMetadata(input);
    expect(out).toEqual({ ok: 'keep' });
    for (const key of FORBIDDEN_METADATA_KEYS) {
      expect(out).not.toHaveProperty(key);
    }
  });

  test('passes through undefined', () => {
    expect(redactMetadata(undefined)).toBeUndefined();
  });
});

describe('local event log repository', () => {
  const owner = '00000000-0000-0000-0000-000000000001';
  let repo = createLocalEventLogRepository();

  beforeEach(() => {
    repo = createLocalEventLogRepository();
  });

  test('appendAudit assigns id, createdAt, and stores', () => {
    const event = repo.appendAudit({
      ownerUserId: owner,
      entityType: 'application',
      entityId: 'JT-1',
      event: 'created',
    });
    expect(event.id).toBeTruthy();
    expect(event.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(repo.listAudit()).toHaveLength(1);
  });

  test('listAudit filters by entityId and entityType', () => {
    repo.appendAudit({ ownerUserId: owner, entityType: 'application', entityId: 'A', event: 'a' });
    repo.appendAudit({ ownerUserId: owner, entityType: 'application', entityId: 'B', event: 'b' });
    repo.appendAudit({ ownerUserId: owner, entityType: 'profile', entityId: 'A', event: 'p' });
    expect(repo.listAudit({ entityId: 'A' })).toHaveLength(2);
    expect(repo.listAudit({ entityType: 'profile' })).toHaveLength(1);
    expect(repo.listAudit({ entityId: 'A', entityType: 'profile' })).toHaveLength(1);
  });

  test('appendAudit redacts forbidden metadata keys', () => {
    const event = repo.appendAudit({
      ownerUserId: owner,
      entityType: 'application',
      entityId: 'JT-2',
      event: 'updated',
      metadata: { ok: 'value', token: 'x', resumeText: 'leak' },
    });
    expect(event.metadata).toEqual({ ok: 'value' });
  });

  test('appendLog assigns id, createdAt, and stores; redacts context', () => {
    const log = repo.appendLog({
      level: 'info',
      message: 'hello',
      context: { ok: 1, token: 'leak', apiKey: 'leak' },
    });
    expect(log.id).toBeTruthy();
    expect(log.context).toEqual({ ok: 1 });
    expect(repo.listLogs()).toHaveLength(1);
  });

  test('reset clears both audit and logs', () => {
    repo.appendAudit({ ownerUserId: owner, entityType: 'demo', entityId: 'x', event: 'reset' });
    repo.appendLog({ level: 'warn', message: 'oops' });
    repo.reset();
    expect(repo.listAudit()).toHaveLength(0);
    expect(repo.listLogs()).toHaveLength(0);
  });
});
