import { expect, test } from '@playwright/test';

test('four physical F2L pairs remain accessible after offline saved-history reopening on a narrow screen', async ({ page }) => {
  const sequence = "R U R' L' U' L R' U' R L U L' R U R' U' R' F R2 U' R' U' R U R' F' U".split(' ');
  const solution = sequence.flatMap(move => move.endsWith('2') ? [move[0], move[0]] : [move]);
  const scramble = solution.slice().reverse().map(move => move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move}'`);
  const scrambleNotation = sequence.slice().reverse().map(move => move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move}'`).join(' ');
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async scramble => {
    const path = '/browser-tests/timed-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { timedPhysical: ReturnType<typeof harness.mount> }).timedPhysical = harness.mount(null, scramble);
  }, scrambleNotation);
  await page.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(page.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  async function physical(move: string, ms: number) { await page.evaluate(({ move, ms }) => (window as unknown as { timedPhysical: (move: string, ms: number) => void }).timedPhysical(move, ms), { move, ms }); }
  for (const [index, move] of scramble.entries()) await physical(move, 100 + index * 100);
  for (const [index, move] of solution.entries()) await physical(move, 10000 + index * 100);
  const current = page.getByRole('region', { name: 'CFOP phase timing' });
  await expect(current.getByRole('button', { name: /F2L pair 1 execution:/ })).toHaveCSS('background-color', 'rgb(121, 214, 187)');
  await expect(current.getByRole('button', { name: /F2L pair 1 execution:/ })).toHaveCSS('height', '44px');
  await current.getByText('F2L pair details').click();
  await expect(current.getByText('Execution: 0.2 s')).toHaveCount(4);
  await page.getByRole('button', { name: 'Connected', exact: true }).click();
  await page.reload();
  await page.context().setOffline(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: 'Saved timed results' }).getByRole('button', { name: '2.70', exact: true }).click();
  const saved = page.getByRole('dialog').getByRole('region', { name: 'CFOP phase timing' });
  await saved.getByText('F2L pair details').click();
  await expect(saved.locator('details').filter({ hasText: 'F2L pair details' }).getByText('Recognition: 0.1 s')).toHaveCount(3);
  await saved.getByRole('button', { name: /F2L pair 2 recognition:/ }).click();
  await expect(saved.getByRole('status')).toContainText('F2L pair 2 recognition: 0.1 s');
  await saved.getByText('Algorithm details').click();
  await expect(saved.getByText('PLL - T', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

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
  await expect(app.getByRole('region', { name: 'CFOP phase timing' })).toContainText('orange Cross');
  await expect(app.getByRole('region', { name: 'CFOP phase timing' })).toContainText('1.234566999999999 s');
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
  await page.getByRole('region', { name: 'Saved timed results' }).getByRole('button', { name: '3.23 (+2)', exact: true }).click();
  const breakdown = page.getByRole('dialog').getByRole('region', { name: 'CFOP phase timing' });
  await expect(breakdown).toContainText('orange Cross');
  await breakdown.getByRole('button', { name: /PLL.*:/ }).focus();
  await expect(breakdown.getByRole('status')).toContainText('PLL');
  await page.getByRole('button', { name: '+2', exact: true }).click();
  await expect(breakdown).toContainText('1.234566999999999 s');
});





test('legacy shared receipts recover offline history details and preserve raw timing through penalty edits', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/src/adapters/local-repository.ts';
    const { LocalRepository } = await import(/* @vite-ignore */ path) as typeof import('../src/adapters/local-repository');
    const repository = new LocalRepository();
    const session = await repository.createSession('Legacy practice');
    const base = { sessionId: session.id, status: 'completed' as const, startedAt: 1790000000000, penalty: 'none' as const, timingBasis: 'host-monotonic-receipt' as const };
    await repository.saveTimedResult({ ...base, id: 'legacy-recovery', rawDurationMs: 300.125, facelets: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB', rawTurns: [
      { move: 'U', serial: 255, hostMs: 100, deviceMs: null },
      { move: 'U', serial: 0, hostMs: 400, deviceMs: null, recovered: true },
      { move: 'U', serial: 1, hostMs: 400, deviceMs: null },
    ] });
    await repository.saveTimedResult({ ...base, id: 'legacy-total-only', rawDurationMs: 1234.567 });
  });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByRole('button', { name: '0.30', exact: true })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByRole('region', { name: 'Saved timed results' }).getByRole('button', { name: '0.30', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const breakdown = dialog.getByRole('region', { name: 'CFOP phase timing' });
  const execution = breakdown.getByRole('button', { name: /PLL - Unrecognized execution: 0.300125 seconds/ });
  await execution.focus();
  await expect(breakdown.getByRole('status')).toContainText('0.300125 s');
  await execution.click();
  await expect(breakdown.getByRole('status')).toContainText('PLL - Unrecognized execution');
  expect(await dialog.innerText()).not.toMatch(/estimat|reconstruct|uncertain|confidence/i);
  await dialog.getByRole('button', { name: '+2', exact: true }).click();
  await expect(dialog.getByText('2.30 (+2)', { exact: true })).toBeVisible();
  await expect(execution).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('region', { name: 'Saved timed results' }).getByRole('button', { name: '1.23', exact: true }).click();
  await expect(dialog.getByText('Detailed timing unavailable', { exact: true })).toBeVisible();
  await expect(dialog.getByText('1.23', { exact: true })).toBeVisible();
});
