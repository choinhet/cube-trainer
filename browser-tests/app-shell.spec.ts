import { expect, test, type Page } from '@playwright/test';
async function fit(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => [...document.querySelectorAll('main.app-shell, .workspace, .workspace aside, .page-content, .app-shell section')].filter(element => {
    const box = element.getBoundingClientRect();
    return box.width && box.height && (box.bottom > innerHeight + 1 || box.right > innerWidth + 1 || element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
  }).map(element => `${element.tagName}.${element.className}: ${element.scrollHeight}/${element.clientHeight}`));
  expect(overflow).toEqual([]);
}
async function mount(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const path = '/browser-tests/timed-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { physical: ReturnType<typeof harness.mount> }).physical = harness.mount();
  });
}
test.use({ viewport: { width: 1280, height: 900 } });
test('fresh storage, gated routes, persistent settings, tabs and viewport fit', async ({ page }) => {
  await page.goto('/?diagnostic#/debug');
  await expect(page.getByRole('heading', { name: 'Solve', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Debug', exact: true, includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await fit(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Enable Debug')).toBeVisible();
  await page.getByLabel('Enable Debug').click();
  await expect(page.getByRole('link', { name: 'Debug', exact: true, includeHidden: true })).toHaveCount(1);
  await page.getByLabel(/Use inspection/).click();
  await fit(page);
  await page.reload();
  await expect(page.getByLabel(/Use inspection/)).toBeChecked();
  await expect(page.getByLabel('Enable Debug')).toBeChecked();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Debug', exact: true, includeHidden: true }).click();
  for (const step of ['Connection', 'State', 'Evidence', 'Viewer traces', 'Cross cases']) {
    await page.getByRole('button', { name: step, exact: true }).click();
    await fit(page);
  }
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Enable Debug').click();
  await expect(page.getByRole('link', { name: 'Debug', exact: true, includeHidden: true })).toHaveCount(0);
  await page.goto('/#/debug');
  await expect(page.getByRole('heading', { name: 'Solve', exact: true })).toBeVisible();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
  await fit(page);
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('link', { name: 'Insights', exact: true }).click();
  for (const tab of ['Overview', 'Graphs', 'Results']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText(tab);
    await fit(page);
  }
});
test('legacy storage retains selection and disconnected paginated results after reopening', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/src/adapters/local-repository.ts';
    const { LocalRepository } = await import(/* @vite-ignore */ path) as typeof import('../src/adapters/local-repository');
    const repo = new LocalRepository();
    const session = await repo.createSession('Legacy', 1);
    await repo.saveSettings({ reportingTimezone: 'UTC' });
    for (let i = 0; i < 13; i++) await repo.saveTimedResult({ id: `old-${i}`, sessionId: session.id, status: 'completed', startedAt: 1000 + i, rawDurationMs: 12345, penalty: 'none', timingBasis: 'host-monotonic-receipt' });
    repo.close();
  });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByRole('option', { name: 'Legacy' })).toBeAttached();
  const history = page.getByRole('region', { name: 'Saved timed results' });
  const firstPageSize = await history.locator('.history-list tbody tr').count();
  expect(firstPageSize).toBeGreaterThan(5);
  expect(firstPageSize).toBeLessThan(13);
  await history.locator('.history-list button').first().click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Delete result' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await fit(page);
  await history.getByRole('button', { name: 'Next results' }).click();
  await expect(history.locator('.history-list tbody tr')).toHaveCount(13 - firstPageSize);
  await fit(page);
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Reporting timezone')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(history.getByLabel('History session').locator('option:checked')).toHaveText('Legacy');
});
test('navigation DNF preserves connection and technical disconnect preserves the running attempt', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/); await mount(page);
  const app = page.locator('body');
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  async function physical(move: string, ms: number): Promise<void> {
    await page.evaluate(({ move, ms }) => (window as unknown as { physical: (move: string, ms: number) => void }).physical(move, ms), { move, ms });
  }
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await physical('R', 100); await physical('R', 200); await physical("R'", 1000);
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Insights', exact: true }).click();
  await expect(app.locator('.history-list')).toContainText('DNF');
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await physical('R', 1100);
  await expect(app.getByLabel('Actual setup moves').locator('[aria-current=step]')).toHaveCount(0);
  await physical('U', 1200);
  await app.getByRole('button', { name: 'Connected', exact: true }).click();
  await app.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(app.getByRole('timer')).toBeVisible();
  await expect(app.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toHaveCount(1);
  await fit(page);
});
test('cross navigation saves abandonment separately and preserves live tracking', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/cross-practice-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./cross-practice-harness');
    (window as unknown as { crossPhysical: ReturnType<typeof harness.mount> }).crossPhysical = harness.mount();
  });
  const app = page.locator('body');
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
  await app.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('free');
  await app.getByRole('slider', { name: 'Difficulty' }).press('Home');
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  for (const [move, ms] of [['R', 100], ['R', 200], ['D', 1000]] as const) {
    await page.evaluate(({ move, ms }) => (window as unknown as { crossPhysical: (move: string, ms: number) => void }).crossPhysical(move, ms), { move, ms });
  }
  await fit(page);
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Insights', exact: true }).click();
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
  await expect(app.getByRole('region', { name: 'Cross practice history' })).toContainText('abandoned');
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await fit(page);
  if (await page.getByRole('dialog').count()) await page.getByRole('button', { name: 'Close', exact: true }).click();
  await app.getByRole('link', { name: 'Solve', exact: true }).click();
  await expect(app.getByText('No saved timed results.')).toBeVisible();
});
test('long setup steps and solved-cube confirmation fit the minimum desktop viewport', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/preparation-harness.tsx';
    const scramblePath = '/src/domain/scramble.ts';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./preparation-harness');
    const { validateScramble } = await import(/* @vite-ignore */ scramblePath) as typeof import('../src/domain/scramble');
    harness.mount(undefined, undefined, async () => validateScramble(Array.from({ length: 30 }, () => 'R U').join(' ')));
  });
  const app = page.locator('body');
  await app.getByRole('button', { name: 'Connect Cube' }).click();
  await expect(app.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
  await app.getByRole('button', { name: 'Connected', exact: true }).click();
  await app.getByRole('button', { name: 'Reset cube state (D4)', exact: true }).click();
  await fit(page);
  await app.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(app.getByLabel('Actual setup moves')).toBeVisible({ timeout: 45_000 });
  await expect(app.getByLabel('Actual setup moves')).toBeVisible();
  await expect(app.getByLabel('Actual setup moves').locator('li')).toHaveCount(60);
  await fit(page);
  await page.screenshot({ path: 'docs/design-review/screenshots/solve-light-1280-long-guidance.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fit(page);
  await page.screenshot({ path: 'docs/design-review/screenshots/solve-light-1920-long-guidance.png' });
});

