import { expect, test } from '@playwright/test';

test('board opens card detail tabs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Job Search · Spring 2026')).toBeVisible();
  await page.getByText('Staff Software Engineer, Spend').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /Match/ }).click();
  await expect(page.getByText('ATS match score')).toBeVisible();
  await page.getByRole('button', { name: /Activity/ }).click();
  await page.getByPlaceholder('Add a comment...').fill('Playwright smoke comment');
  await page.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(page.getByText('Playwright smoke comment')).toBeVisible();
});
