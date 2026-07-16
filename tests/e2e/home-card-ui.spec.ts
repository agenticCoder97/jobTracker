import { expect, test } from '@playwright/test';

test.describe('home card UI', () => {
  test('application cards do not render progress bars', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.app-card').first()).toBeVisible();
    await expect(page.locator('.app-card__bar')).toHaveCount(0);
  });

  test('company logos request Logo.dev with the publishable key and display options', async ({
    page,
  }) => {
    const logoRequest = page.waitForRequest((request) =>
      request.url().startsWith('https://img.logo.dev/stripe.com?'),
    );

    await page.goto('/');
    const stripeCard = page.locator('.app-card', { hasText: 'Stripe' }).first();
    await expect(stripeCard).toBeVisible();
    await expect(stripeCard.locator('.app-card__logo img')).toBeVisible();

    const logoUrl = new URL((await logoRequest).url());
    expect(logoUrl.searchParams.get('token')).toBe('pk_DxDDkkPsRtKwBfYjNH6yHQ');
    expect(logoUrl.searchParams.get('format')).toBe('png');
    expect(logoUrl.searchParams.get('retina')).toBe('true');
    expect(logoUrl.searchParams.get('fallback')).toBe('404');
  });
});
