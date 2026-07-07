import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';
import { useAppsStore } from '@/lib/store/apps-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

function openAttachmentsTab(displayId: string) {
  render(<CardDetailDialog displayId={displayId} />);
  fireEvent.click(screen.getByRole('button', { name: /attachments/i }));
}

describe('AttachmentsTab', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('uploads a file in local mode and lists it', async () => {
    const app = useAppsStore.getState().applications[0]!;
    openAttachmentsTab(app.displayId);
    const input = screen.getByLabelText(/upload attachment/i);
    const file = new File(['hello'], 'notes.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(useAppsStore.getState().activity[app.id]?.attachments[0]?.name).toBe('notes.pdf'),
    );
    expect(await screen.findByText('notes.pdf')).toBeInTheDocument();
  });

  test('removes an attachment', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().addAttachment(app.id, { name: 'zap.pdf', kind: 'pdf', size: '1 KB' });
    openAttachmentsTab(app.displayId);
    fireEvent.click(screen.getByRole('button', { name: /remove zap\.pdf/i }));
    expect(
      useAppsStore.getState().activity[app.id]!.attachments.some((a) => a.name === 'zap.pdf'),
    ).toBe(false);
  });
});
