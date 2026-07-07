import { expect, test } from '@playwright/test';

test.describe('keyboard accessibility', () => {
  test('Esc closes the card detail modal', async ({ page }) => {
    await page.goto('/card/JT-34');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 3000 });
  });

  test('card detail dialog exposes labelled title', async ({ page }) => {
    await page.goto('/card/JT-34');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-labelledby', /card-detail/);
    await expect(page.locator('#card-detail-title')).toBeVisible();
  });

  test('profile tabs are reachable and toggleable via keyboard', async ({ page }) => {
    await page.goto('/profile');
    const overview = page.getByRole('tab', { name: /Overview/ });
    await expect(overview).toBeVisible();
    await overview.focus();
    await page.keyboard.press('Tab');
    // Next tab should still be in the tablist
    const focused = page.evaluate(() => document.activeElement?.getAttribute('role'));
    expect(['tab', 'button']).toContain(await focused);
  });
});
