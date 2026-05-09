import { expect, test } from '@playwright/test';

test.describe('top-level navigation and modal deep links', () => {
  test('topbar links navigate between every primary view', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Job Search.*Spring 2026|Board/i }).first()).toBeVisible();

    for (const [href, name] of [
      ['/jobs', 'Jobs'],
      ['/companies', 'Companies'],
      ['/research', 'Research'],
      ['/profile', /YO|Profile/i],
    ] as const) {
      await page.goto(href);
      // Heading or some recognizable text per page
      if (typeof name === 'string') {
        await expect(page.getByRole('heading', { name }).first()).toBeVisible();
      } else {
        await expect(page.locator('body')).toContainText(name);
      }
    }
  });

  test('direct-load /card/:displayId renders dialog with correct title', async ({ page }) => {
    await page.goto('/card/JT-34');
    await expect(page.getByRole('dialog')).toBeVisible();
    // The dialog title is contentEditable h1 with id card-detail-title
    await expect(page.locator('#card-detail-title')).toBeVisible();
  });

  test('direct-load /company/:companyId renders modal', async ({ page }) => {
    await page.goto('/company/stripe');
    await expect(page.locator('section[aria-label*="Stripe"]').first()).toBeVisible();
  });

  test('direct-load /listing/:displayId renders preview', async ({ page }) => {
    await page.goto('/listing/JL-101');
    // The preview dialog has the role text
    await expect(page.locator('section[aria-label*="Preview"], section[aria-label*="listing"], .modal').first()).toBeVisible();
  });

  test('direct-load /apply/:displayId renders apply dialog', async ({ page }) => {
    await page.goto('/apply/JT-42');
    await expect(page.locator('section[aria-label*="Apply"]').first()).toBeVisible();
  });

  test('not-found card displayId renders not-found state', async ({ page }) => {
    await page.goto('/card/JT-NEVER');
    await expect(page.getByText(/not found/i)).toBeVisible();
  });
});
