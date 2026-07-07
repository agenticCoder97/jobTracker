import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { CardDetailDialog } from '@/components/jobtracker/JobTrackerApp';
import { useAppsStore } from '@/lib/store/apps-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

function openLinkedTab(displayId: string) {
  render(<CardDetailDialog displayId={displayId} />);
  fireEvent.click(screen.getByRole('button', { name: /linked/i }));
}

describe('LinkedTab', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
  });

  test('adds a link', () => {
    const app = useAppsStore.getState().applications[0]!;
    openLinkedTab(app.displayId);
    fireEvent.change(screen.getByLabelText(/link title/i), { target: { value: 'Take-home' } });
    fireEvent.change(screen.getByLabelText(/link url/i), {
      target: { value: 'https://example.com/exercise' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    const links = useAppsStore.getState().activity[app.id]!.links;
    expect(links[0]).toMatchObject({ title: 'Take-home', meta: 'https://example.com/exercise' });
  });

  test('rejects an invalid url', () => {
    const app = useAppsStore.getState().applications[0]!;
    const before = useAppsStore.getState().activity[app.id]?.links.length ?? 0;
    openLinkedTab(app.displayId);
    fireEvent.change(screen.getByLabelText(/link title/i), { target: { value: 'Bad' } });
    fireEvent.change(screen.getByLabelText(/link url/i), { target: { value: 'not-a-url' } });
    fireEvent.click(screen.getByRole('button', { name: /add link/i }));
    expect(useAppsStore.getState().activity[app.id]?.links.length ?? 0).toBe(before);
  });

  test('removes a link', () => {
    const app = useAppsStore.getState().applications[0]!;
    useAppsStore.getState().addLink(app.id, {
      type: 'link',
      title: 'Old link',
      meta: 'https://example.com/old',
    });
    openLinkedTab(app.displayId);
    fireEvent.click(screen.getByRole('button', { name: /remove old link/i }));
    expect(
      useAppsStore.getState().activity[app.id]!.links.some((l) => l.title === 'Old link'),
    ).toBe(false);
  });
});
