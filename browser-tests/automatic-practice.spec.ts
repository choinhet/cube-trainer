import { expect, test } from '@playwright/test';
test('automatically prepares scrambles and preserves a recovered solve result', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/timed-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { physical: ReturnType<typeof harness.mount> }).physical = harness.mount();
  });
  await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
  await page.getByRole('button', { name: 'Connect Cube', exact: true }).click();
  const guidance = page.getByLabel('Actual setup moves');
  await expect(guidance).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { physical: ReturnType<typeof import('./timed-harness').mount> }).physical.generatedCount())).toBe(2);
  await expect(page.getByRole('button', { name: /Generate.*scramble/ })).toHaveCount(0);
  async function move(move: string, ms: number, recovered = false) {
    await page.evaluate(({ move, ms, recovered }) => (window as unknown as { physical: ReturnType<typeof import('./timed-harness').mount> }).physical(move, ms, recovered), { move, ms, recovered });
  }
  await move('R', 100); await move('R', 200);
  await expect(page.getByRole('heading', { name: 'You may start' })).toBeVisible();
  await move("R'", 1000); await move("R'", 2234, true);
  await expect(page.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByRole('cell', { name: '1.62', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next scramble', exact: true })).toHaveCount(0);
  await expect(guidance).toBeVisible();
  await expect(guidance).toContainText('R2');
  await expect(page.getByLabel('Solve time')).toHaveText('1.23');
  await move('R', 2400); await move('R', 2500);
  await expect(page.getByLabel('Solve time')).toHaveText('1.23');
  await move("R'", 3000);
  await expect(page.getByRole('timer')).toHaveText('0.00');
});
test('settings checkboxes and dialog close icon align, with spaced insight tabs', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByRole('checkbox')).toHaveCount(5);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  const geometry = await close.evaluate(button => {
    const rect = button.getBoundingClientRect(), icon = button.querySelector('svg')!.getBoundingClientRect();
    return { x: Math.abs(rect.x + rect.width / 2 - icon.x - icon.width / 2), y: Math.abs(rect.y + rect.height / 2 - icon.y - icon.height / 2) };
  });
  expect(geometry.x).toBeLessThan(1); expect(geometry.y).toBeLessThan(1);
  await page.screenshot({ path: 'docs/design-review/screenshots/settings-fixed.png' });
  await close.click();
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  const tabs = page.getByRole('tab');
  const first = await tabs.nth(0).boundingBox(), second = await tabs.nth(1).boundingBox();
  expect(second!.x - first!.x - first!.width).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: 'docs/design-review/screenshots/insights-fixed.png' });
});

test('cube face labels are optional and the checkbox persists across reopening', async ({ page }) => {
  await page.goto('/');
  const labels = () => page.getByLabel('Live 3D cube').locator('.cube-tile').evaluateAll(tiles => tiles.map(tile => tile.textContent).join(''));
  await expect(page.getByLabel('Live 3D cube')).toBeVisible();
  expect(await labels()).toBe('');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: /Show cube face labels/ });
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect.poll(labels).toBe('URFDLB');
  await page.reload();
  await expect(checkbox).toBeChecked();
  await expect.poll(labels).toBe('URFDLB');
  await checkbox.click();
  await expect.poll(labels).toBe('');
});
