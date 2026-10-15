import { expect, test } from '@playwright/test';
import { independentTarget } from './independent-target';

test('real worker generates a random-state scramble and the browser guides correction and every setup turn', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/preparation-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./preparation-harness');
    (window as unknown as { physical: (move: string) => void }).physical = harness.mount();
  });
  const app = page.locator('body');
  await app.locator('.stage-session').getByLabel('History session').selectOption({ label: 'New session' });
  await app.getByLabel('New session name').fill('Scramble practice');
  await app.getByRole('button', { name: 'Create session' }).click();
  await expect(page.getByRole('dialog', { name: 'New session', exact: true })).toHaveCount(0);
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  const original = app.getByLabel('Actual setup moves');
  await expect(original).toBeVisible({ timeout: 45_000 });
  const moves = await original.locator('li').evaluateAll(elements => elements.map(el => el.lastChild!.textContent!));
  expect(moves.length).toBeGreaterThan(1);
  expect(moves.every(move => /^[URFDLB](2|')?$/.test(move))).toBe(true);
  const target = await independentTarget(moves.join(' '));
  expect(target).toBe(await independentTarget(moves.join(' ')));
  const wrong = moves[0][0] === 'U' ? 'F' : 'U';
  const physical = async (move: string): Promise<void> => { await page.evaluate(move => (window as unknown as { physical: (move: string) => void }).physical(move), move); };
  await physical(wrong);
  await expect(app.getByLabel('Undo moves')).toBeVisible();
  await physical(`${wrong}'`);
  for (const move of moves) {
    await physical(move.endsWith('2') ? move[0] : move);
    if (move.endsWith('2')) await physical(move[0]);
  }
  await expect(app.getByLabel('Actual setup moves').locator('[aria-current=step]')).toHaveCount(0);
  await expect(app.getByLabel('Live 3D cube')).toHaveAttribute('data-state', target!);
  await expect(app.getByRole('button', { name: 'Generate practice scramble' })).toHaveCount(0);
  await expect(app.getByRole('button', { name: 'Cancel preparation' })).toHaveCount(0);
  await app.getByRole('link', { name: 'Insights', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(original).toBeVisible({ timeout: 45_000 });
  expect(errors).toEqual([]);
});
