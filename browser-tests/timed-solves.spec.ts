import { expect, test } from '@playwright/test';

test('physical completion saves exact precision and captured session, then survives browser reopening', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/timed-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { timedPhysical: ReturnType<typeof harness.mount> }).timedPhysical = harness.mount();
  });
  const app = page.locator('body');
  await app.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').selectOption({ label: 'New session' });
  await app.getByLabel('New session name').fill('Original session');
  await app.getByRole('button', { name: 'Create session' }).click();
  await expect(app.getByRole('region', { name: 'Saved timed results' }).getByRole('combobox', { name: 'History session' }).locator('option:checked')).toHaveText('Original session');
  const firstSession = await app.getByRole('region', { name: 'Saved timed results' }).getByRole('combobox', { name: 'History session' }).inputValue();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await app.getByRole('link', { name: 'Settings', exact: true }).click();
  await app.getByLabel(/Use inspection/).click();
  await expect(app.getByLabel(/Use inspection/)).toBeChecked();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  async function physical(move: string, ms: number): Promise<void> {
    await page.evaluate(({ move, ms }) => (window as unknown as { timedPhysical: (move: string, ms: number) => void }).timedPhysical(move, ms), { move, ms });
  }
  await physical('R', 100); await physical('R', 200);
  await expect(app.getByLabel('Inspection time')).toBeVisible();
  await expect(app.getByRole('timer')).toHaveCount(0);
  await page.evaluate(async () => {
    const path = '/src/adapters/local-repository.ts';
    const { LocalRepository } = await import(/* @vite-ignore */ path) as typeof import('../src/adapters/local-repository');
    await new LocalRepository().createSession('Later session');
  });
  await physical("R'", 15200);
  await expect(app.getByRole('timer')).toHaveText('0.00');
  await physical("R'", 16434.567);
  await expect(app.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  // Close the newly prepared attempt so reopening recovers only the saved solve.
  await app.getByRole('button', { name: 'Connected', exact: true }).click();
  await expect.poll(() => page.evaluate(() => new Promise<number>(resolve => {
    const open = indexedDB.open('cube-trainer');
    open.onsuccess = () => { const db = open.result; const request = db.transaction('checkpoints').objectStore('checkpoints').count(); request.onsuccess = () => { resolve(request.result); db.close(); }; };
  }))).toBe(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByRole('option', { name: 'Later session' })).toBeAttached();
  await expect(page.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toContainText('3.23 (+2)');
  const records = await page.evaluate(() => new Promise<unknown[]>((resolve, reject) => {
    const open = indexedDB.open('cube-trainer');
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction('timedResults').objectStore('timedResults').getAll();
      request.onsuccess = () => { resolve(request.result as unknown[]); db.close(); };
      request.onerror = () => reject(request.error);
    };
    open.onerror = () => reject(open.error);
  }));
  expect(records).toEqual([expect.objectContaining({ sessionId: firstSession, startedAt: 1791850000000, rawDurationMs: 1234.566999999999, penalty: '+2', status: 'completed', timingBasis: 'host-monotonic-receipt' })]);
});

