import { expect, test } from '@playwright/test';

/**
 * Live-data smoke for the Jobs tab. Requires a Supabase-backed dev server with
 * the service-role key, so it runs only in the `chromium-supabase` project and
 * is skipped in CI/local runs without the adapter configured.
 *
 * The pipeline fans out to The Muse (no API key needed), so a `POST
 * /api/research/run` reliably populates `external_jobs` before the UI assertions.
 */
const supabaseEnabled =
  process.env.NEXT_PUBLIC_PERSISTENCE_ADAPTER === 'supabase' &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);

test.describe('live jobs', () => {
  test.skip(!supabaseEnabled, 'supabase adapter not configured');

  test('fetched listing can be wishlisted and survives reload', async ({ page, request }) => {
    // Populate the cache from live providers, then confirm the read API serves rows.
    const runResponse = await request.post('/api/research/run');
    expect(runResponse.ok()).toBe(true);

    await expect
      .poll(
        async () => {
          const response = await request.get('/api/jobs/listings');
          if (!response.ok()) return 0;
          const body = (await response.json()) as { listings: unknown[] };
          return body.listings.length;
        },
        { timeout: 20_000 },
      )
      .toBeGreaterThan(0);

    // Open positions scope shows the live listings, each with a Wishlist action.
    await page.goto('/jobs?scope=open');
    const wishlistButton = page.getByRole('button', { name: /Wishlist/i }).first();
    await expect(wishlistButton).toBeVisible({ timeout: 15_000 });

    // Capture the role from the same row before wishlisting so we can assert it persisted.
    const role = (
      await wishlistButton.locator('xpath=ancestor::tr').getByRole('strong').first().textContent()
    )?.trim();
    expect(role && role.length > 0).toBe(true);

    // Wishlisting navigates to the new card and writes it through to Supabase.
    const persisted = page.waitForResponse(
      (response) => response.url().endsWith('/api/apps') && response.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await wishlistButton.click();
    await expect(page).toHaveURL(/\/card\//, { timeout: 15_000 });
    await expect(page.getByText(role!, { exact: false }).first()).toBeVisible();
    const persistResponse = await persisted;
    expect(persistResponse.ok(), await persistResponse.text()).toBe(true);

    // Survives a full reload (persisted through the write-through adapter).
    await page.reload();
    await expect(page.getByText(role!, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  });
});
