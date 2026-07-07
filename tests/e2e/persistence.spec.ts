import { expect, test } from '@playwright/test';

/**
 * Requires a live Supabase-backed dev server. Skipped in CI/local runs without
 * the adapter and server-side admin key enabled.
 */
const supabaseEnabled =
  process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase' &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

test.describe('board persistence', () => {
  test.skip(!supabaseEnabled, 'supabase adapter not configured');

  test('manually created application survives localStorage wipe', async ({ page, request }) => {
    const hydrated = page.waitForResponse(
      (response) => response.url().endsWith('/api/apps') && response.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await page.goto('/');
    expect((await hydrated).ok()).toBe(true);
    await page.getByRole('button', { name: /^create$/i }).click();
    await page.locator('#na-company').fill('Persistence Test Co');
    await page.locator('#na-role').fill('E2E Engineer');
    const persisted = page.waitForResponse(
      (response) => response.url().endsWith('/api/apps') && response.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: /create application/i }).click();
    await expect(page.getByText('E2E Engineer').first()).toBeVisible();
    const persistResponse = await persisted;
    const persistBody = await persistResponse.text();
    expect(persistResponse.ok(), persistBody).toBe(true);

    await expect
      .poll(async () => {
        const response = await request.get('/api/apps');
        const state = await response.json();
        return state.applications.some(
          (app: { companyName?: string; role?: string }) =>
            app.companyName === 'Persistence Test Co' && app.role === 'E2E Engineer',
        );
      })
      .toBe(true);

    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.getByText('Persistence Test Co').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('E2E Engineer').first()).toBeVisible();
  });

  test('supabase mode never shows seed demo cards after reload', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.locator('.app-card__id', { hasText: 'JT-42' })).toHaveCount(0);
  });
});
