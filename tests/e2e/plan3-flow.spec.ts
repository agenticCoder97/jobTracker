import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('research renders sections and adds a pick to wishlist', async ({ page }) => {
  await page.goto('/research');
  await expect(page.getByRole('heading', { name: 'Research' })).toBeVisible();
  await expect(page.getByText("Today's picks for you")).toBeVisible();
  await expect(page.getByText('LinkedIn signals')).toBeVisible();
  await expect(page.getByText('Watched companies')).toBeVisible();

  await page
    .getByRole('button', { name: /Add to wishlist/i })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /On wishlist/i }).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Senior Software Engineer, Product').first()).toBeVisible();
});

test('profile about persists and tabs are URL backed', async ({ page }) => {
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: /You/ })).toBeVisible();

  await page.locator('#about-edit').click();
  await page.locator('textarea[name="about"]').fill('Persisted profile note');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.reload();
  await expect(page.getByText('Persisted profile note')).toBeVisible();

  await page.getByRole('button', { name: 'resumes' }).click();
  await expect(page).toHaveURL(/tab=resumes/);
  await expect(page.getByRole('heading', { name: 'Resumes' })).toBeVisible();

  await page.getByRole('button', { name: 'covers' }).click();
  await expect(page).toHaveURL(/tab=covers/);
  await expect(page.getByRole('heading', { name: 'Cover letters' })).toBeVisible();
});
