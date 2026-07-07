import { expect, test } from '@playwright/test';

test.describe('home card UI', () => {
  test('application cards do not render progress bars', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-card').first()).toBeVisible();
    await expect(page.locator('.app-card__bar')).toHaveCount(0);
  });

  test('supported company logos render as image logos', async ({ page }) => {
    await page.goto('/');
    const stripeCard = page.locator('.app-card', { hasText: 'Stripe' }).first();
    await expect(stripeCard).toBeVisible();
    await expect(stripeCard.locator('.app-card__logo img')).toBeVisible();
  });
});
