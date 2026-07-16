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

test('card company edits inline and an unknown company dialog closes back to the card', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByText('Staff Software Engineer, Spend').click();

  const cardDialog = page.getByRole('dialog');
  await cardDialog.getByRole('button', { name: 'Edit company' }).click();
  const companyInput = cardDialog.getByRole('textbox', { name: 'Company name' });
  await companyInput.fill('Acme Health');
  await companyInput.press('Enter');

  await expect(cardDialog.getByRole('button', { name: 'Edit company' })).toHaveText('Acme Health');
  await cardDialog.getByRole('link', { name: 'Open Acme Health company details' }).click();

  const companyDialog = page.getByRole('dialog');
  await expect(companyDialog.getByRole('heading', { name: 'Company not found' })).toBeVisible();
  await companyDialog.getByRole('button', { name: 'Close company detail' }).click();

  await expect(page.getByRole('dialog').getByRole('button', { name: 'Edit company' })).toHaveText(
    'Acme Health',
  );
  await expect(page).toHaveURL(/\/card\//);
});
