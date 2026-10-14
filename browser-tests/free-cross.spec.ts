import { expect, test, type Page } from '@playwright/test';
import { independentTarget } from './independent-target';
async function records(page: Page, store: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(store => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const open = indexedDB.open('cube-trainer');
    open.onsuccess = () => { const db = open.result; const request = db.transaction(store).objectStore(store).getAll(); request.onsuccess = () => { resolve(request.result as Record<string, unknown>[]); db.close(); }; request.onerror = () => reject(request.error); };
    open.onerror = () => reject(open.error);
  }), store);
}
async function physical(page: Page, move: string, ms: number) {
  await page.evaluate(({ move, ms }) => (window as unknown as { physicalCross: (move: string, ms: number) => void }).physicalCross(move, ms), { move, ms });
}
async function finishSetup(page: Page, startMs: number, retry = false) {
  const sequence = await page.getByLabel('Actual setup moves').locator('li').allTextContents();
  if (retry) { expect(sequence.length).toBeGreaterThanOrEqual(15); expect(sequence.length).toBeLessThanOrEqual(25); }
  let ms = startMs;
  for (const token of sequence) {
    const move = token.replace(/^(Current |Completed )/, '');
    await physical(page, move.endsWith('2') ? move[0] : move, ms += 10);
    if (move.endsWith('2')) await physical(page, move[0], ms += 10);
  }
  await expect(page.getByRole('heading', { name: 'You may start' })).toBeVisible();
}
async function prepare(page: Page, failure: 'checkpoint' | 'finalize' | null = null, mode = 'free', scramble = 'R2', sourceAlgorithm = '') {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async ({ failure, scramble, sourceAlgorithm }) => {
    const path = '/browser-tests/cross-practice-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./cross-practice-harness');
    (window as unknown as { physicalCross: ReturnType<typeof harness.mount> }).physicalCross = harness.mount(failure, scramble, sourceAlgorithm);
  }, { failure, scramble, sourceAlgorithm });
  const app = page.locator('body');
  await app.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session').selectOption({ label: 'New session' });
  await app.getByLabel('New session name').fill('Cross session');
  await app.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('dialog', { name: 'New session', exact: true })).toHaveCount(0);
  await app.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
  await expect(app.getByRole('combobox', { name: 'Mode', exact: true })).toHaveValue('semi-guided');
  await expect(app.getByRole('slider', { name: 'Difficulty' })).toHaveValue('6');
  await app.getByRole('combobox', { name: 'Mode', exact: true }).selectOption(mode);
  await app.getByRole('slider', { name: 'Difficulty', exact: true }).press('Home');
  for (let i = 1; i < scramble.split(' ').length; i++) await app.getByRole('slider', { name: 'Difficulty', exact: true }).press('ArrowRight');
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  if (scramble === 'R2') { await physical(page, 'R', 100); await physical(page, 'R', 200); }
  else { for (const [index, move] of scramble.split(' ').entries()) await physical(page, move, 100 + index * 100); }
  await expect(app.getByRole('heading', { name: 'You may start' })).toBeVisible();
  return app;
}

test('free cross retains completion, repeats the exact case, and advances only on request', async ({ page }) => {
  const app = await prepare(page);
  const practice = app;
  await expect.poll(() => page.evaluate(() => (window as unknown as { physicalCross: ReturnType<typeof import('./cross-practice-harness').mount> }).physicalCross.generatedCount())).toBeGreaterThanOrEqual(2);
  await expect(practice.getByText(/Optimal solution from/)).toHaveCount(0);
  await expect(practice.getByRole('button', { name: 'Reveal cross solution' })).toBeVisible();
  await expect(practice.getByRole('button', { name: 'Cancel cross setup' })).toHaveCount(0);
  await expect(app.getByRole('region', { name: 'Exact cross case inspector' })).toHaveCount(0);
  await physical(page, 'D', 1000); await physical(page, "D'", 1100);
  await physical(page, 'R', 2000); await physical(page, 'R', 3500);
  await expect(practice.getByRole('region', { name: 'Cross practice history' }).locator('tbody tr')).toBeVisible();
  expect(await records(page, 'crossAttempts')).toEqual([expect.objectContaining({ status: 'completed', rawDurationMs: 2500, normalizedExecutedCount: 3, assisted: false, rawTrace: [expect.objectContaining({ move: 'D' }), expect.objectContaining({ move: "D'" }), expect.objectContaining({ move: 'R' }), expect.objectContaining({ move: 'R' })], case: expect.objectContaining({ caseId: 'browser-r2', originalScramble: 'R2', optimum: 1 }) })]);
  expect(await records(page, 'timedResults')).toEqual([]);
  await expect(app.getByLabel('Actual setup moves')).toHaveCount(0);
  expect(await records(page, 'crossCheckpoints')).toEqual([]);
  await expect(app.getByLabel('Cross time')).toHaveText('2.50');
  await expect(app.getByLabel('Cross moves')).toHaveText('3 moves executed1 optimal moves');
  await expect(app.getByRole('region', { name: 'Cross practice history' }).getByRole('cell', { name: '3/1', exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Retry same case' }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await finishSetup(page, 4000, true);
  await expect(app.getByLabel('Cross time')).toHaveText('2.50');
  await physical(page, 'D', 5000);
  await expect(app.getByRole('timer')).toHaveText('0.00');
  await physical(page, "D'", 5100); await physical(page, 'R', 5200); await physical(page, 'R', 5300);
  await expect.poll(async () => (await records(page, 'crossAttempts')).length).toBe(2);
  const attempts = await records(page, 'crossAttempts');
  expect(attempts[0].case).toEqual(attempts[1].case);
  expect(attempts[0].id).not.toBe(attempts[1].id);
  await app.getByRole('button', { name: 'Next case' }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await page.reload();
  await page.getByRole('region', { name: 'Cross practice history' }).getByRole('button', { name: '2.50', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('3 moves / optimum 1');
  await expect(page.getByRole('dialog')).toContainText('Unassisted');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Saved timed results' })).toContainText('No saved timed results');
});

test('net identity physical activity is retained as abandoned cross practice', async ({ page }) => {
  const app = await prepare(page);
  await physical(page, 'D', 1000); await physical(page, "D'", 1500);
  await app.getByRole('button', { name: 'Abandon cross practice' }).click();
  await expect(app.getByRole('region', { name: 'Cross practice history' }).locator('tbody tr')).toBeVisible();
  expect(await records(page, 'crossAttempts')).toEqual([expect.objectContaining({ status: 'abandoned', normalizedExecutedCount: 2, rawTrace: [expect.objectContaining({ move: 'D' }), expect.objectContaining({ move: "D'" })] })]);
});

test('reveal updates saved assistance and retry hides the solution again', async ({ page }) => {
  const app = await prepare(page);
  await physical(page, 'R', 1000); await physical(page, 'R', 1500);
  await expect(app.getByRole('button', { name: 'Retry same case' })).toBeEnabled();
  await app.getByRole('button', { name: 'Reveal cross solution' }).click();
  await expect(app.getByText(/Optimal solution from original starting state/)).toBeVisible();
  await expect.poll(async () => (await records(page, 'crossAttempts'))[0]?.assisted).toBe(true);
  await app.getByRole('button', { name: 'Retry same case' }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await expect(app.getByText(/Optimal solution from original starting state/)).toHaveCount(0);
  await finishSetup(page, 2000, true);
  await expect(app.getByRole('button', { name: 'Reveal cross solution' })).toBeEnabled();
  await physical(page, 'R', 3000); await physical(page, 'R', 3100);
  await expect.poll(async () => (await records(page, 'crossAttempts')).length).toBe(2);
  expect((await records(page, 'crossAttempts')).filter(record => record.assisted === false)).toHaveLength(1);
});

test('fully guided accepts an alternative optimal route and keeps completed moves visible', async ({ page }) => {
  const app = await prepare(page, null, 'fully-guided', 'R L');
  const algorithm = app.getByLabel('Optimal cross algorithm', { exact: true });
  await expect(algorithm).toBeVisible();
  await expect(algorithm.locator('li')).toHaveText(["Current L'", "R'"]);
  await physical(page, "L'", 1000);
  await expect(algorithm.locator('li')).toHaveText(["Completed R'", "Current L'"]);
  await page.screenshot({ path: '.scratch/full-cross-trainer/fully-guided-alternative.png', animations: 'disabled' });
  await expect(app.getByRole('combobox', { name: 'Mode', exact: true })).toBeEnabled();
  await physical(page, "R'", 2000);
  await expect(algorithm.locator('[data-completed=true]')).toHaveCount(2);
  await expect(app.getByLabel('Cross time')).toHaveCount(0);
  await expect(app.locator('.cross-success-badge')).toHaveText('Completed 2/2');
  await page.screenshot({ path: '.scratch/full-cross-trainer/guided-completed.png', animations: 'disabled' });
  await expect(app.getByRole('region', { name: 'Cross practice history' }).getByRole('cell', { name: '—', exact: true })).toHaveCount(2);
  await expect.poll(async () => (await records(page, 'crossAttempts'))[0]?.status).toBe('completed');
  expect(await records(page, 'crossAttempts')).toEqual([expect.objectContaining({ mode: 'fully-guided', rawDurationMs: 0, mistakeEpisodes: 0, assisted: true, normalizedExecutedCount: 2 })]);
});

test('semi-guided hides algorithms, tolerates split halves, and requires correction', async ({ page }) => {
  const app = await prepare(page, null, 'semi-guided');
  await expect(app.getByLabel('Optimal cross algorithm')).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Reveal cross solution' })).toHaveCount(0);
  await physical(page, 'R', 1000);
  await expect(app.getByLabel('Undo moves')).toHaveCount(0);
  await physical(page, 'F', 2000);
  await expect(app.getByLabel('Undo moves').locator('li')).toHaveText(["F'", "L'"]);
  await page.screenshot({ path: '.scratch/full-cross-trainer/semi-guided-correction.png', animations: 'disabled' });
  await physical(page, "F'", 2100); await physical(page, "R'", 2200);
  await expect(app.getByLabel('Undo moves')).toHaveCount(0);
  await physical(page, "R'", 2300); await physical(page, "R'", 2400);
  await expect.poll(async () => (await records(page, 'crossAttempts'))[0]?.status).toBe('completed');
  expect(await records(page, 'crossAttempts')).toEqual([expect.objectContaining({ mode: 'semi-guided', rawDurationMs: 0, mistakeEpisodes: 1, assisted: false })]);
});

test('changing mode before the first turn preserves the armed case', async ({ page }) => {
  const app = await prepare(page);
  await app.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('semi-guided');
  await expect(app.getByRole('combobox', { name: 'Mode', exact: true })).toBeEnabled();
  await expect(app.getByText('0 of 1 optimal moves completed')).toBeVisible();
  await expect(app.getByRole('button', { name: 'Reveal cross solution' })).toHaveCount(0);
  await physical(page, 'R', 1000); await physical(page, 'R', 2000);
  await expect.poll(async () => (await records(page, 'crossAttempts')).filter(record => record.status === 'completed').length).toBe(1);
  expect((await records(page, 'crossAttempts')).find(record => record.status === 'completed')).toMatchObject({ mode: 'mixed', normalizedExecutedCount: 1 });
});

test('shares a solved-origin scramble, imports it from a scrambled cube, and copies it from history', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const app = await prepare(page);
  const workspace = await app.getByRole('region', { name: 'Cross workspace' }).boundingBox();
  expect(workspace!.y + workspace!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await app.getByRole('button', { name: 'Copy scramble' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('R2');
  await physical(page, 'F', 1000);
  await app.getByRole('button', { name: 'Import shared scramble' }).click();
  const modal = page.getByRole('dialog', { name: 'Import shared scramble' });
  await modal.getByLabel('Shared scramble').fill('R2');
  await page.screenshot({ path: '.scratch/cross-trainer-improvements/import-modal.png', animations: 'disabled' });
  await modal.getByRole('button', { name: 'Use scramble' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByLabel('Actual setup moves')).toBeVisible();
  await finishSetup(page, 2000);
  await physical(page, 'R', 3000); await physical(page, 'R', 3100);
  await expect.poll(async () => (await records(page, 'crossAttempts')).length).toBe(2);
  const saved = await records(page, 'crossAttempts');
  expect(saved.filter(record => record.status === 'abandoned')).toHaveLength(1);
  expect(saved.filter(record => record.status === 'completed')).toHaveLength(1);
  const imported = saved.find(record => record.status === 'completed')!;
  expect(imported.case).toMatchObject({ originalScramble: 'R2', startingState: (saved[0].case as Record<string, unknown>).startingState, optimum: 1 });
  await app.getByRole('region', { name: 'Cross practice history' }).locator('tbody tr').first().locator('button').first().click();
  const detail = page.getByRole('dialog', { name: 'Cross details' });
  await expect(detail.locator('.scramble-text')).toHaveText('R2');
  await detail.getByRole('button', { name: 'Copy scramble' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('R2');
});

test('converts an unsolved-origin case into a portable scramble and reimports its exact full position', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const app = await prepare(page, null, 'free', 'R2', 'D');
  const copy = app.getByRole('button', { name: 'Copy scramble' });
  await expect(copy).toBeEnabled();
  await copy.click();
  await page.screenshot({ path: '.scratch/cross-trainer-improvements/shared-scramble.png', animations: 'disabled' });
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  expect(await independentTarget(shared)).toBe(await independentTarget('D R2'));
  await physical(page, 'F', 1000);
  await app.getByRole('button', { name: 'Import shared scramble' }).click();
  const modal = page.getByRole('dialog', { name: 'Import shared scramble' });
  await modal.getByLabel('Shared scramble').fill(shared);
  await modal.getByRole('button', { name: 'Use scramble' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByLabel('Actual setup moves')).toBeVisible();
  await finishSetup(page, 2000);
  const target = await independentTarget('D R2');
  await expect(app.getByLabel('Live 3D cube')).toHaveAttribute('data-state', target);
  await physical(page, 'R', 3000); await physical(page, 'R', 3100);
  await expect.poll(async () => (await records(page, 'crossAttempts')).length).toBe(2);
  expect((await records(page, 'crossAttempts')).find(record => record.status === 'completed')?.case).toMatchObject({ startingState: target, originalScramble: shared });
});

test('switches modes during exploration, displays bottom-cross undo, and saves a Mixed assisted result', async ({ page }) => {
  const app = await prepare(page);
  await physical(page, 'F', 1000);
  const modes = app.getByRole('combobox', { name: 'Mode', exact: true });
  await modes.selectOption('fully-guided');
  await expect(app.getByLabel('Undo moves').locator('li')).toHaveText(["F'"]);
  await expect(app.getByText('Hold white on bottom, yellow on top, green in front.', { exact: true })).toBeVisible();
  await modes.selectOption('free');
  await expect(app.getByLabel('Undo moves')).toHaveCount(0);
  await expect(app.getByRole('timer')).toHaveText('0.00');
  await physical(page, "F'", 1500);
  await modes.selectOption('semi-guided');
  await expect(app.getByLabel('Undo moves')).toHaveCount(0);
  await physical(page, 'R', 2000); await physical(page, 'R', 2500);
  await expect.poll(async () => (await records(page, 'crossAttempts'))[0]?.status).toBe('completed');
  expect((await records(page, 'crossAttempts'))[0]).toMatchObject({ mode: 'mixed', rawDurationMs: 1500, normalizedExecutedCount: 3, assisted: true });
  const history = app.getByRole('region', { name: 'Cross practice history' });
  await expect(history.getByRole('cell', { name: '—', exact: true })).toHaveCount(1);
  await history.getByRole('button', { name: 'Mixed', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Mixed');
  await expect(page.getByRole('dialog').getByLabel('Mode changes').locator('li')).toHaveCount(4);
  await page.screenshot({ path: '.scratch/cross-trainer-improvements/mixed-history.png', animations: 'disabled' });
});

test('invalid imported notation preserves the current case and settings persist the instruction convention', async ({ page }) => {
  const app = await prepare(page, null, 'fully-guided', 'R L');
  await app.getByRole('button', { name: 'Import shared scramble' }).click();
  const modal = page.getByRole('dialog', { name: 'Import shared scramble' });
  await modal.getByLabel('Shared scramble').fill('not a scramble');
  await modal.getByRole('button', { name: 'Use scramble' }).click();
  await expect(modal.getByRole('alert')).toContainText('Use face turns');
  expect(await records(page, 'crossAttempts')).toEqual([]);
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Settings', exact: true }).click();
  const preference = page.getByRole('checkbox', { name: 'Mirrored instructions for the cross trainer' });
  await expect(preference).toBeChecked();
  await preference.uncheck();
  await expect(preference).not.toBeChecked();
  await page.reload();
  await expect(preference).not.toBeChecked();
});

test('unfinished cross checkpoint recovers once as interrupted on browser reopening', async ({ page }) => {
  await prepare(page);
  await physical(page, 'D', 1000); await physical(page, 'F', 1500);
  await expect.poll(async () => (await records(page, 'crossCheckpoints'))[0]?.phase).toBe('active');
  await page.reload();
  const history = page.getByRole('region', { name: 'Cross practice history' });
  await expect(history.locator('tbody tr')).toHaveCount(1);
  await expect(history).toContainText('interrupted');
  await history.locator('tbody button').click();
  await expect(page.getByRole('dialog')).toContainText('Browser reopened with unfinished cross practice');
  expect(await records(page, 'crossCheckpoints')).toEqual([]);
  expect(await records(page, 'timedResults')).toEqual([]);
  await page.reload(); await expect(history.locator('tbody tr')).toHaveCount(1);
});

test('cross save failure retains a retryable checkpoint and cannot claim saved', async ({ page }) => {
  const app = await prepare(page, 'finalize');
  await physical(page, 'D', 1000);
  await app.getByRole('button', { name: 'Abandon cross practice' }).click();
  await expect(app.getByText(/Cross attempt was not saved.*Synthetic cross finalize write failure/)).toBeVisible();
  expect(await records(page, 'crossAttempts')).toEqual([]);
  expect(await records(page, 'crossCheckpoints')).toHaveLength(1);
  await page.evaluate(() => (window as unknown as { physicalCross: { enableWrites(): void } }).physicalCross.enableWrites());
  await app.getByRole('button', { name: 'Retry cross save' }).click();
  await expect(app.getByRole('region', { name: 'Cross practice history' }).locator('tbody tr')).toBeVisible();
  expect(await records(page, 'crossAttempts')).toHaveLength(1);
  expect(await records(page, 'crossCheckpoints')).toEqual([]);
});


