import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorPanel } from '@/components/ui/ErrorPanel';

describe('ErrorPanel', () => {
  test('renders title, message, and both actions', () => {
    render(
      <ErrorPanel
        title="Boom"
        message="It broke."
        onRetry={() => {}}
        onResetDemo={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('It broke.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset demo data/ })).toBeInTheDocument();
  });

  test('Try again invokes onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorPanel onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('Reset demo invokes onResetDemo', async () => {
    const onResetDemo = vi.fn();
    render(<ErrorPanel onResetDemo={onResetDemo} />);
    await userEvent.click(screen.getByRole('button', { name: /Reset demo data/ }));
    expect(onResetDemo).toHaveBeenCalledTimes(1);
  });

  test('omits actions if no callback provided', () => {
    render(<ErrorPanel />);
    expect(screen.queryByRole('button', { name: /Try again/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reset demo data/ })).toBeNull();
  });
});
