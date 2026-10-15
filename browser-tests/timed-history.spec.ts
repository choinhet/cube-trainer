import { expect, test, type Page } from '@playwright/test';
async function mount(page: Page, failure: 'edit' | 'delete' | null = null): Promise<void> {
  await page.evaluate(async failure => {
    const path = '/browser-tests/history-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./history-harness');
    await harness.mount(failure);
  }, failure);
}
test('disconnected history preserves penalty edits, DNF exclusion and deletion across reopening', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/); await mount(page);
  const history = page.locator('body').getByRole('region', { name: 'Saved timed results' });
  await expect(history.getByRole('listitem')).toHaveCount(3);
  const first = history.getByRole('listitem').first();
  await expect(first).toContainText('Historical practice (historical session)');
  await expect(history).toContainText('Current practice (current session)');
  await expect(first.locator('time')).not.toContainText('1970-01-01T00:00:01.000Z');
  await expect(first.locator('time')).toHaveAttribute('datetime', '1970-01-01T00:00:01.000Z');
  await first.getByRole('button', { name: '+2', exact: true }).click();
  await expect(first).toContainText('3.23 (+2)');
  await page.reload(); await mount(page);
  await expect(first).toContainText('3.23 (+2)');
  await first.getByRole('button', { name: 'DNF', exact: true }).click();
  await expect(first).toContainText('DNF (1.23)');
  await expect(first).toContainText('Excluded from timed statistics');
  await expect(history.getByRole('listitem')).toHaveCount(3);
  await first.getByRole('button', { name: 'Delete result' }).click();
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await page.reload(); await mount(page);
  await expect(history.getByRole('listitem')).toHaveCount(2);
  await expect(history.getByRole('listitem').last()).toContainText('Disconnected');
  await expect(history.getByRole('listitem').last()).toContainText('0.99 s');
  await expect(history.getByRole('listitem').last().getByRole('combobox')).toHaveCount(0);
  const raw = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('cube-trainer'); open.onsuccess = () => {
      const request = open.result.transaction('timedResults').objectStore('timedResults').get('second');
      request.onsuccess = () => { resolve((request.result as { rawDurationMs: number }).rawDurationMs); open.result.close(); };
      request.onerror = () => reject(request.error);
    }; open.onerror = () => reject(open.error);
  }));
  expect(raw).toBe(1234.567);
});
for (const failure of ['edit', 'delete'] as const) {
  test(`failed ${failure} keeps the persisted history visible across reopening`, async ({ page }) => {
    await page.goto('/'); await mount(page, failure);
    const history = page.locator('body').getByRole('region', { name: 'Saved timed results' });
    const first = history.getByRole('listitem').first();
    await expect(history.getByRole('listitem')).toHaveCount(3);
    if (failure === 'edit') {
      await first.getByRole('button', { name: '+2', exact: true }).click();
      await expect(first.getByRole('alert')).toContainText('Penalty was not saved');
    } else {
      await first.getByRole('button', { name: 'Delete result' }).click();
      await expect(first.getByRole('alert')).toContainText('Result was not deleted');
    }
    await expect(first).toContainText('1.23');
    await expect(history.getByRole('listitem')).toHaveCount(3);
    await page.reload(); await mount(page);
    await expect(history.getByRole('listitem')).toHaveCount(3); await expect(first).toContainText('1.23');
  });
}

test('permission cancellation leaves integrated history available', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/history-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./history-harness');
    await harness.mount(null, true);
  });
  const app = page.locator('body');
  const history = app.getByRole('region', { name: 'Saved timed results' });
  await expect(history.locator('tbody tr')).toHaveCount(3);
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByText(/NotFoundError: Chooser canceled/)).toBeVisible();
  await expect(app.getByRole('button', { name: 'Connect Cube', exact: true })).toBeVisible();
  await expect(history.locator('tbody tr')).toHaveCount(3);
  await history.locator('.history-list button').last().click();
  await expect(page.getByRole('dialog').getByRole('button', { name: '+2', exact: true })).toBeEnabled();
});
