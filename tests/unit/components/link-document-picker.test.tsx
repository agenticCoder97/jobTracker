import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';
import { useAppsStore } from '@/lib/store/apps-store';
import { useProfileStore } from '@/lib/store/profile-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

describe('LinkDocumentPicker', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
    useProfileStore.getState().reset();
  });

  test('links a resume as an attachment with source metadata', () => {
    const app = useAppsStore.getState().applications[0]!;
    const resume = useProfileStore.getState().resumes[0]!;
    render(<CardDetailDialog displayId={app.displayId} />);
    fireEvent.click(screen.getByRole('button', { name: /attachments/i }));
    fireEvent.click(screen.getByRole('button', { name: /link document/i }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`link ${resume.name}`, 'i') }));
    const attachment = useAppsStore.getState().activity[app.id]!.attachments[0]!;
    expect(attachment).toMatchObject({
      source: 'resume',
      sourceDocId: resume.id,
      name: resume.name,
    });
    expect(useAppsStore.getState().activity[app.id]!.history[0]!.text).toBe(
      `Resume linked: ${resume.name}`,
    );
  });

  test('already-linked documents are marked and not re-linkable', () => {
    const app = useAppsStore.getState().applications[0]!;
    const resume = useProfileStore.getState().resumes[0]!;
    useAppsStore.getState().addAttachment(app.id, {
      name: resume.name,
      kind: 'pdf',
      size: resume.size,
      source: 'resume',
      sourceDocId: resume.id,
    });
    render(<CardDetailDialog displayId={app.displayId} />);
    fireEvent.click(screen.getByRole('button', { name: /attachments/i }));
    fireEvent.click(screen.getByRole('button', { name: /link document/i }));
    expect(
      screen.getByRole('button', { name: new RegExp(`link ${resume.name}`, 'i') }),
    ).toBeDisabled();
  });
});
