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

  test('new applications persist and request a canonical Logo.dev URL at creation', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^create$/i }).click();
    await page.locator('#na-company').fill('Anthropic');
    await page.locator('#na-role').fill('Logo.dev Test Engineer');

    const logoRequest = page.waitForRequest((request) =>
      request.url().startsWith('https://img.logo.dev/anthropic.com?'),
    );
    await page.getByRole('button', { name: /create application/i }).click();

    await expect(
      page.locator('.app-card__role', { hasText: 'Logo.dev Test Engineer' }).first(),
    ).toBeVisible();
    const logoUrl = new URL((await logoRequest).url());
    expect(logoUrl.searchParams.get('token')).toBe('pk_DxDDkkPsRtKwBfYjNH6yHQ');
    expect(logoUrl.searchParams.get('size')).toBe('128');
    expect(logoUrl.searchParams.get('format')).toBe('png');
    expect(logoUrl.searchParams.get('fallback')).toBe('404');
  });
});
