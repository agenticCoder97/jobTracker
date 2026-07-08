import { expect, test } from '@playwright/test';

const highCandidate = {
  payload: {
    messageId: 'message-1',
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
  signature: 'test-signature-high',
};

const mediumCandidate = {
  payload: {
    messageId: 'message-2',
    subject: 'Your application for Backend Engineer',
    fromName: 'Globex Talent',
    fromAddress: 'jobs@globex.example',
    receivedAt: '2026-07-06T09:00:00.000Z',
    bodyPreview: 'Your application for Backend Engineer was received.',
    confidence: 'medium',
    score: 60,
    reasons: ['application confirmation phrase'],
    extracted: {
      companyName: 'Globex',
      role: 'Backend Engineer',
      source: 'Outlook',
      applied: '2026-07-06',
    },
  },
  signature: 'test-signature-medium',
};

test.describe('outlook import review flow', () => {
  test('scans, preselects high confidence, and imports two selected', async ({ page }) => {
    await page.route('**/api/outlook/status', (route) =>
      route.fulfill({ json: { connected: true, email: 'me@example.com' } }),
    );
    await page.route('**/api/outlook/scan', (route) =>
      route.fulfill({
        json: { connectedEmail: 'me@example.com', candidates: [highCandidate, mediumCandidate] },
      }),
    );
    await page.route('**/api/outlook/import', (route) =>
      route.fulfill({
        json: {
          imported: [
            {
              applicationId: 'a-1',
              displayId: 'JT-A1',
              companyName: 'Acme',
              role: 'Staff Engineer',
            },
            {
              applicationId: 'a-2',
              displayId: 'JT-A2',
              companyName: 'Globex',
              role: 'Backend Engineer',
            },
          ],
        },
      }),
    );

    await page.goto('/');
    await expect(page.locator('.app-card').first()).toBeVisible();

    await page.getByRole('button', { name: 'Scan email' }).click();

    const dialog = page.getByRole('dialog', { name: 'Outlook application scan' });
    await expect(dialog).toBeVisible();

    const highRow = page.getByLabel('Select Thank you for applying to Staff Engineer at Acme');
    const mediumRow = page.getByLabel('Select Your application for Backend Engineer');
    await expect(highRow).toBeChecked();
    await expect(mediumRow).not.toBeChecked();
    await expect(dialog.getByRole('button', { name: /Import 1 selected/i })).toBeVisible();

    await mediumRow.check();
    await dialog.getByRole('button', { name: /Import 2 selected/i }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('2 applications imported from Outlook')).toBeVisible();
  });
});
