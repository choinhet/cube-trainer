import { expect, test, type Page } from '@playwright/test';

async function prepare(page: Page, failure: 'checkpoint' | 'finalize' | null = null) {
  await page.goto('/');
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async failure => {
    const path = '/browser-tests/timed-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { physical: ReturnType<typeof harness.mount> }).physical = harness.mount(failure);
  }, failure);
  const app = page.locator('body');
  await app.locator('.stage-session').getByLabel('History session').selectOption({ label: 'New session' });
  await app.getByLabel('New session name').fill('Recovery session');
  await app.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('dialog', { name: 'New session', exact: true })).toHaveCount(0);
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  if (failure === 'checkpoint') return app;
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await app.getByRole('link', { name: 'Settings', exact: true }).click();
  await app.getByLabel(/Use inspection/).click();
  await expect(app.getByLabel(/Use inspection/)).toBeChecked();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  return app;
}
async function physical(page: Page, move: string, ms: number): Promise<void> {
  await page.evaluate(({ move, ms }) => (window as unknown as { physical: (move: string, ms: number) => void }).physical(move, ms), { move, ms });
}
async function records(page: Page, store: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(store => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const open = indexedDB.open('cube-trainer');
    open.onsuccess = () => {
      const db = open.result; const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => { resolve(request.result as Record<string, unknown>[]); db.close(); }; request.onerror = () => reject(request.error);
    }; open.onerror = () => reject(open.error);
  }), store);
}
for (const phase of ['setup', 'inspection', 'active']) {
  test(`browser interruption during ${phase} recovers one record with available data`, async ({ page }) => {
    const app = await prepare(page);
    await expect(app.getByLabel('Actual setup moves')).toBeVisible();
    if (phase !== 'setup') { await physical(page, 'R', 100); await physical(page, 'R', 200); }
    if (phase === 'active') { await physical(page, "R'", 1000); await physical(page, 'U', 2234.567); }
    await expect.poll(async () => (await records(page, 'checkpoints'))[0]?.phase).toBe(phase);
    await page.reload();
    const history = page.getByRole('region', { name: 'Saved timed results' });
    await expect(history.locator('tbody tr')).toHaveCount(1);
    await history.locator('.history-list button').first().click();
    await expect(page.getByRole('dialog', { name: 'Solve details' })).toContainText('Browser interruption');
    await expect(page.getByRole('dialog', { name: 'Solve details' })).toContainText('Excluded from timed statistics');
    if (phase === 'active') await expect(page.getByRole('dialog', { name: 'Solve details' })).toContainText('1.23 s');
    else await expect(page.getByRole('dialog', { name: 'Solve details' })).toContainText('Solve timing had not started');
    const results = await records(page, 'timedResults');
    expect(results[0]).toMatchObject({ status: 'interrupted', interruptionPhase: phase, solveStarted: phase === 'active' });
    expect(results[0].rawTurns).toHaveLength(phase === 'setup' ? 0 : phase === 'inspection' ? 2 : 4);
    expect(results[0].facelets).toEqual(expect.any(String));
    expect(await records(page, 'checkpoints')).toEqual([]);
    await page.reload(); await expect(history.locator('tbody tr')).toHaveCount(1);
    expect(await records(page, 'timedResults')).toHaveLength(1);
  });
}
test('result write failure stays visible, retains checkpoint, and retries atomically without duplicates', async ({ page }) => {
  const app = await prepare(page, 'finalize');
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await physical(page, 'R', 100); await physical(page, 'R', 200); await physical(page, "R'", 1000);
  await app.getByRole('button', { name: 'Abandon solve (DNF)' }).click();
  await expect(app.getByText(/Result was not saved.*Synthetic result write failure/)).toBeVisible();
  await expect(app.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toHaveCount(0);
  expect(await records(page, 'timedResults')).toEqual([]);
  expect(await records(page, 'checkpoints')).toHaveLength(1);
  await page.evaluate(() => (window as unknown as { physical: { enableWrites(): void } }).physical.enableWrites());
  await app.getByRole('button', { name: 'Retry save' }).click();
  await expect(app.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toBeVisible();
  expect(await records(page, 'timedResults')).toEqual([expect.objectContaining({ status: 'completed', penalty: 'dnf' })]);
  expect(await records(page, 'checkpoints')).toEqual([]);
});
test('checkpoint failure is visible and never creates a completed solve', async ({ page }) => {
  const app = await prepare(page, 'checkpoint');
  await expect(app.getByRole('region', { name: 'Automatic solve timing' }).getByText(/^Active attempt checkpoint was not saved:/)).toBeVisible();
  await expect(app.getByText(/^Interrupted:/)).toBeVisible();
  await expect.poll(async () => (await records(page, 'timedResults')).length).toBe(1);
  expect(await records(page, 'timedResults')).toEqual([expect.objectContaining({ status: 'interrupted', interruptionPhase: 'setup', solveStarted: false })]);
});

