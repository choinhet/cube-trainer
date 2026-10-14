import { expect, test, type Page } from '@playwright/test';
async function create(page: Page, name: string): Promise<void> {
  await page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').selectOption({ label: 'New session' });
  await expect(page.getByRole('dialog', { name: 'New session', exact: true })).toBeVisible();
  await page.getByLabel('New session name').fill(name);
  await page.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').locator('option:checked')).toHaveText(name);
}
test('creates sessions in a dialog, selects them in history and preserves selection on reopening', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').locator('option:checked')).toHaveText('Default');
  await create(page, 'First'); await create(page, 'Second');
  await page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').selectOption({ label: 'First' });
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('New session name')).toHaveCount(0);
  await expect(page.getByLabel('Current session')).toHaveCount(0);
  await expect(page.getByLabel('Reporting timezone')).toHaveCount(0);
  await expect(page.getByText(/Records belong|Saved reporting timezone/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').locator('option:checked')).toHaveText('First');
});
test('aborted creation leaves the dialog retryable and committed sessions intact', async ({ page }) => {
  await page.goto('/'); await create(page, 'First');
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort()); return request;
    };
  });
  await page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').selectOption({ label: 'New session' });
  await page.getByLabel('New session name').fill('Failed creation');
  await page.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('alert')).toContainText('Session was not created');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').locator('option:checked')).toHaveText('First');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').locator('option')).toHaveCount(3);
});
