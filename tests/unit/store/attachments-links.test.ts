import { beforeEach, describe, expect, test } from 'vitest';
import { useAppsStore } from '@/lib/store/apps-store';

function firstAppId(): string {
  return useAppsStore.getState().applications[0]!.id;
}

describe('attachments', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('addAttachment prepends metadata and records history', () => {
    const id = firstAppId();
    const attachment = useAppsStore.getState().addAttachment(id, {
      name: 'notes.pdf',
      kind: 'pdf',
      size: '11 B',
      source: 'upload',
      dataUrl: 'data:application/pdf;base64,aGVsbG8=',
    });
    const activity = useAppsStore.getState().activity[id]!;
    expect(activity.attachments[0]).toMatchObject({ id: attachment.id, name: 'notes.pdf' });
    expect(activity.history[0]).toMatchObject({ type: 'attach' });
    expect(activity.history[0]!.text).toContain('notes.pdf');
  });

  test('linked documents get a linking history message', () => {
    const id = firstAppId();
    useAppsStore.getState().addAttachment(id, {
      name: 'My Resume',
      kind: 'pdf',
      size: '120 KB',
      source: 'resume',
      sourceDocId: 'doc-1',
    });
    expect(useAppsStore.getState().activity[id]!.history[0]!.text).toBe(
      'Resume linked: My Resume',
    );
  });

  test('removeAttachment removes and records history', () => {
    const id = firstAppId();
    const attachment = useAppsStore.getState().addAttachment(id, {
      name: 'notes.pdf',
      kind: 'pdf',
      size: '11 B',
    });
    useAppsStore.getState().removeAttachment(id, attachment.id);
    const activity = useAppsStore.getState().activity[id]!;
    expect(activity.attachments.some((item) => item.id === attachment.id)).toBe(false);
    expect(activity.history[0]!.text).toBe('Attachment removed: notes.pdf');
  });
});

describe('links', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('addLink and removeLink round-trip with history', () => {
    const id = firstAppId();
    useAppsStore.getState().addLink(id, {
      type: 'link',
      title: 'Job posting',
      meta: 'https://example.com/job',
    });
    const added = useAppsStore.getState().activity[id]!.links[0]!;
    expect(added.title).toBe('Job posting');
    expect(useAppsStore.getState().activity[id]!.history[0]).toMatchObject({ type: 'link' });
    useAppsStore.getState().removeLink(id, added.id);
    expect(useAppsStore.getState().activity[id]!.links.some((l) => l.id === added.id)).toBe(false);
    expect(useAppsStore.getState().activity[id]!.history[0]!.text).toBe(
      'Link removed: Job posting',
    );
  });
});
