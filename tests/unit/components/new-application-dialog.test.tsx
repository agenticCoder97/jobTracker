import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NewApplicationDialog } from '@/components/jobtracker/NewApplicationDialog';
import { useAppsStore } from '@/lib/store/apps-store';
import { useUiStore } from '@/lib/store/ui-store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

describe('NewApplicationDialog', () => {
  beforeEach(() => {
    useAppsStore.getState().reset();
    useUiStore.getState().openNewApp('applied');
  });

  test('renders nothing when closed', () => {
    useUiStore.getState().closeNewApp();
    const { container } = render(<NewApplicationDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  test('requires company and role', () => {
    render(<NewApplicationDialog />);
    fireEvent.click(screen.getByRole('button', { name: /create application/i }));
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
  });

  test('creates a card and closes on valid submit', () => {
    render(<NewApplicationDialog />);
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme Corp' } });
    fireEvent.change(screen.getByLabelText(/^role/i), { target: { value: 'Staff Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: /create application/i }));
    const created = useAppsStore
      .getState()
      .applications.find((app) => app.companyName === 'Acme Corp');
    expect(created?.role).toBe('Staff Engineer');
    expect(created?.status).toBe('applied');
    expect(created?.companyLogoUrl).toContain('https://img.logo.dev/name/Acme%20Corp?');
    expect(useUiStore.getState().newAppStatus).toBeNull();
  });
});
