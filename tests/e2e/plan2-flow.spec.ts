import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test('jobs filters and listing preview add an untracked job to wishlist', async ({ page }) => {
  await page.goto('/jobs?scope=open&q=perplexity');
  await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible();
  await expect(page.getByText('Software Engineer, Search')).toBeVisible();

  await page.getByRole('link', { name: 'Software Engineer, Search' }).click();
  await expect(page.getByRole('heading', { name: 'Software Engineer, Search' })).toBeVisible();
  await page.getByRole('button', { name: /Add to wishlist/i }).click();

  await expect(page).toHaveURL(/\/card\/JT-/);
  await expect(page.getByRole('heading', { name: 'Software Engineer, Search' })).toBeVisible();
});

test('companies search opens detail and can wishlist an open role', async ({ page }) => {
  await page.goto('/companies');
  await page.getByLabel('Search companies').fill('perplexity');
  await page
    .getByRole('link', { name: /Perplexity/ })
    .first()
    .click();

  await expect(page.getByRole('heading', { name: 'Perplexity' })).toBeVisible();
  await expect(page.getByText('Demo data').first()).toBeVisible();
  await page
    .getByRole('button', { name: /Wishlist/i })
    .first()
    .click();

  await expect(page).toHaveURL(/\/card\/JT-/);
  await expect(page.getByRole('heading', { name: 'Software Engineer, Search' })).toBeVisible();
});

test('apply flow submits a wishlist card with selected documents', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: /Apply now/i })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /Submit application/i })).toBeVisible();

  await page.getByText('Resume - Frontend / Product Engineering').click();
  await page.getByLabel('Include cover letter').click();
  await page.getByRole('button', { name: /Submit application/i }).click();

  await expect(page).toHaveURL(/\/card\/JT-/);
  await expect(page.getByRole('button', { name: 'Applied', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Match/ }).click();
  await expect(page.getByText('Resume - Frontend / Product Engineering')).toBeVisible();
});
