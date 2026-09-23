import { test, expect } from '@playwright/test';
test('workspace journey, responsive navigation and theme persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Email address').fill('browser-' + Date.now() + '@example.test');
  await page.getByRole('button', { name: 'Continue to Stylework' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('Total leads', { exact: true })).toBeVisible();
  await expect(page.locator('.recent-row').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-light.png', fullPage: true });
  await page.getByRole('link', { name: 'Leads CRM' }).click();
  await expect(page.getByRole('heading', { name: 'All leads' })).toBeVisible();
  await expect(page.locator('.lead-row').first()).toBeVisible();
  expect(await page.locator('.lead-row').count()).toBeLessThan(40);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.locator('.virtual-toolbar')).toContainText('100');
  await page.getByRole('searchbox', { name: 'Search' }).fill('Orbit');
  await expect(page).toHaveURL(/q=Orbit/);
  await expect(page.locator('.lead-row').first()).toContainText('Orbit');
  await page.locator('.lead-row').first().click();
  await expect(page.getByRole('heading', { name: 'Contact information' })).toBeVisible();
  await expect(page.locator('.activity-row').first()).toBeVisible();
  const status = page.getByLabel('Lead status'),
    options = await status
      .locator('option:not([disabled])')
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
  const current = await status.inputValue();
  await status.selectOption(options.find((value) => value !== current)!);
  await expect(status).toBeEnabled();
  await page.locator('.activity-row').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Add status' }).click();
  const name = 'Review ' + Date.now();
  await page.getByLabel('Status name').fill(name);
  await page.getByRole('button', { name: 'Save status' }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive ' + name, exact: true }).click();
  await page.getByRole('button', { name: 'Archive status', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Total leads', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity timeline' })).toBeVisible();
  await expect(page.locator('.activity-row').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/mobile-activity.png', fullPage: true });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect(errors).toEqual([]);
});

test('manual lead creation and both date bounds use REST', async ({ page }) => {
  const graphqlRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/graphql')) graphqlRequests.push(request.url());
  });
  await page.goto('/');
  await page.getByLabel('Email address').fill('manual-browser-' + Date.now() + '@example.test');
  await page.getByRole('button', { name: 'Continue to Stylework' }).click();
  await page.getByRole('link', { name: 'Leads CRM' }).click();
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add lead' }),
    name = 'Manual Journey ' + Date.now();
  await dialog.getByLabel('Full name').fill(name);
  await dialog.getByLabel('Email', { exact: true }).fill('manual@example.test');
  await dialog.getByLabel('Company').fill('Manual Co');
  await dialog.getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.activity-row').first()).toContainText('Lead created');
  await page.getByRole('link', { name: 'Leads CRM' }).click();
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  await page.getByLabel('Created from', { exact: true }).fill(day);
  await page.getByLabel('Created through', { exact: true }).fill(day);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name);
  await expect(page.locator('.lead-row').first()).toContainText(name);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('link', { name: 'Activity', exact: true }).click();
  await page.getByLabel('Created from', { exact: true }).fill(day);
  await page.getByLabel('Created through', { exact: true }).fill(day);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(name);
  await expect(page.locator('.activity-row').first()).toContainText(name);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(graphqlRequests).toEqual([]);
});
