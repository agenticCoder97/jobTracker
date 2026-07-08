import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { OutlookImportDialog } from '@/components/jobtracker/OutlookImportDialog';

describe('OutlookImportDialog', () => {
  test('shows candidates, preview, and selected import count', async () => {
    const user = userEvent.setup();
    render(
      <OutlookImportDialog
        open
        onOpenChange={() => undefined}
        candidates={[
          {
            payload: {
              messageId: '1',
              subject: 'Thank you for applying to Staff Engineer at Acme',
              fromName: 'Acme Recruiting',
              fromAddress: 'no-reply@greenhouse.io',
              receivedAt: '2026-07-07T12:00:00.000Z',
              bodyPreview: 'We received your application.',
              confidence: 'high',
              score: 90,
              reasons: ['application confirmation phrase'],
              extracted: {
                companyName: 'Acme',
                role: 'Staff Engineer',
                source: 'Outlook',
                applied: '2026-07-07',
              },
            },
            signature: 'sig',
          },
        ]}
        connectedEmail="me@example.com"
        loading={false}
        onRescan={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import 1 selected/i })).toBeEnabled();
    await user.click(screen.getByText('Thank you for applying to Staff Engineer at Acme'));
    expect(screen.getByText('application confirmation phrase')).toBeInTheDocument();
  });
});
