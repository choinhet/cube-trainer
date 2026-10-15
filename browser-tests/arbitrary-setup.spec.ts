import { expect, test } from '@playwright/test';
import { independentTarget } from './independent-target';

test('real worker and live guidance reach the full target from an arbitrary source', async ({ page }) => {
  const sourceAlg = "F2 D R' U L2 B";
  const source = await independentTarget(sourceAlg);
  await page.goto('/');
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async source => {
    const path = '/browser-tests/preparation-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./preparation-harness');
    (window as unknown as { physical: (move: string) => void }).physical = harness.mount(source);
  }, source);
  const app = page.locator('body');
  await app.locator('.stage-session').getByLabel('History session').selectOption({ label: 'New session' });
  await app.getByLabel('New session name').fill('Arbitrary setup');
  await app.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('dialog', { name: 'New session', exact: true })).toHaveCount(0);
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  const actual = app.getByLabel('Actual setup moves');
  await expect(actual).toBeVisible({ timeout: 45_000 });
  const moves = await actual.locator('li').evaluateAll(elements => elements.map(el => el.lastChild!.textContent!));
  const original = await page.evaluate(() => (window as unknown as { physical: { exercise(): { original: string } } }).physical.exercise().original);
  const target = await independentTarget(original);
  expect(await independentTarget(`${sourceAlg} ${moves.join(' ')}`)).toBe(target);
  expect(moves.join(' ')).not.toBe(original);
  const physical = async (move: string): Promise<void> => { await page.evaluate(move => (window as unknown as { physical: (move: string) => void }).physical(move), move); };
  const wrong = moves[0][0] === 'U' ? 'F' : 'U';
  await physical(wrong);
  await expect(app.getByLabel('Undo moves')).toBeVisible();
  await physical(`${wrong}'`);
  for (const move of moves) {
    await physical(move.endsWith('2') ? move[0] : move);
    if (move.endsWith('2')) await physical(move[0]);
  }
  await expect(app.getByLabel('Actual setup moves').locator('[aria-current=step]')).toHaveCount(0);
  await expect(app.getByLabel('Live 3D cube')).toHaveAttribute('data-state', target);

  await app.getByRole('link', { name: 'Insights', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
});

test('production setup worker solves deterministic full-state fixtures and reports invalid states', async ({ page }) => {
  await page.goto('http://127.0.0.1:5175');
  const fixtures = await Promise.all(['R U F2 D L B2', "B' D2 L F U2 R"].map(async sourceAlg => ({ sourceAlg, source: await independentTarget(sourceAlg) })));
  const target = { original: "L2 U B' R D2", target: await independentTarget("L2 U B' R D2") };
  const results = await page.evaluate(async ({ fixtures, target }) => {
    const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]')!;
    const bundle = await (await fetch(script.src)).text();
    const path = bundle.match(/\/assets\/setup\.worker-[\w-]+\.js/)?.[0];
    if (!path) throw new Error('Setup worker missing from production bundle');
    async function solve(source: string) {
      return new Promise<{ setup?: { source: string; target: string; moves: string[] }; error?: string }>((resolve, reject) => {
        const worker = new Worker(path!, { type: 'module' });
        const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Setup timed out')); }, 20_000);
        worker.onmessage = event => { clearTimeout(timeout); worker.terminate(); resolve(event.data); };
        worker.onerror = event => { clearTimeout(timeout); worker.terminate(); reject(new Error(event.message)); };
        worker.postMessage({ source, target });
      });
    }
    return [await solve(fixtures[0].source), await solve(fixtures[1].source), await solve('invalid')];
  }, { fixtures, target });
  for (const [i, fixture] of fixtures.entries()) {
    expect(results[i].error).toBeUndefined();
    expect(results[i].setup?.source).toBe(fixture.source);
    expect(results[i].setup?.target).toBe(target.target);
    expect(await independentTarget(`${fixture.sourceAlg} ${results[i].setup!.moves.join(' ')}`)).toBe(target.target);
  }
  expect(results[2].error).toContain('valid');
});

test('loading stays interactive and cancellation, solver errors and movement cannot arm a setup', async ({ page }) => {
  const source = await independentTarget('F');
  await page.goto('/');
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async source => {
    const path = '/browser-tests/preparation-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./preparation-harness');
    let calls = 0;
    (window as unknown as { physical: (move: string) => void }).physical = harness.mount(source, async (_source, _target, signal) => {
      calls++;
      if (calls === 2) throw new Error('Synthetic solver failure');
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true }));
    });
  }, source);
  const app = page.locator('body');
  await app.locator('.stage-session').getByLabel('History session').selectOption({ label: 'New session' });
  await app.getByLabel('New session name').fill('Cancellation checks');
  await app.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('dialog', { name: 'New session', exact: true })).toHaveCount(0);
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  const leaveAndReturn = async () => {
    await app.getByRole('link', { name: 'Insights', exact: true }).click();
    await app.getByRole('link', { name: 'Solve', exact: true }).click();
  };
  const loading = app.getByText(/Computing setup.*Keep cube still/);
  await expect(loading).toBeVisible({ timeout: 45_000 });
  await app.getByLabel('Live 3D cube').press('ArrowRight');
  await leaveAndReturn();
  await expect(app.getByRole('alert')).toContainText('Synthetic solver failure', { timeout: 45_000 });
  await expect(app.getByLabel('Actual setup moves')).toHaveCount(0);
  await leaveAndReturn();
  await expect(loading).toBeVisible({ timeout: 45_000 });
  await page.evaluate(() => (window as unknown as { physical: (move: string) => void }).physical('R'));
  await expect(app.getByRole('alert')).toContainText('cube moved');
  await expect(app.getByLabel('Live 3D cube')).toHaveAttribute('data-state', await independentTarget('F R'));
  await expect(app.getByLabel('Actual setup moves')).toHaveCount(0);
});
