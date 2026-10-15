import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'dark' });

for (const width of [1280, 375]) {
test.describe(`${width}px`, () => {
test.use({ viewport: { width, height: 900 } });

test('saved solve hover stays in a compact floating card without moving the analysis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('History session').first()).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const repositoryPath = '/src/adapters/local-repository.ts';
    const cubePath = '/src/domain/cube.ts';
    const { LocalRepository } = await import(/* @vite-ignore */ repositoryPath) as typeof import('../src/adapters/local-repository');
    const { SOLVED } = await import(/* @vite-ignore */ cubePath) as typeof import('../src/domain/cube');
    const repository = new LocalRepository();
    const data = await repository.initialize();
    const moves = "R U R' R U R' U R U2 R' R U R' U' R' F R2 U' R' U' R U R' F' U".split(' ');
    await repository.saveTimedResult({ id: 'hover-regression', sessionId: data.currentSessionId!, status: 'completed', startedAt: 1000, rawDurationMs: 2400, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, rawTurns: moves.map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null })) });
    repository.close();
  });
  await page.reload();
  const history = page.getByRole('region', { name: 'Saved timed results' });
  await history.locator('tbody button').first().click();
  const dialog = page.getByRole('dialog', { name: 'Solve details' });
  await expect.soft(page.getByRole('tooltip')).toHaveCount(0);
  const analysis = dialog.getByRole('region', { name: 'CFOP phase timing' });
  const before = await analysis.boundingBox();
  const phase = analysis.getByRole('button', { name: /PLL - T execution:/ });
  await phase.hover();
  const card = analysis.getByRole('status');
  await expect(card).toBeVisible();
  await expect.soft(card).toHaveCSS('position', 'absolute');
  expect.soft((await card.boundingBox())!.width).toBeLessThanOrEqual(280);
  expect.soft((await card.boundingBox())!.y + (await card.boundingBox())!.height).toBeLessThanOrEqual(900);
  expect.soft(Math.abs((await analysis.boundingBox())!.height - before!.height)).toBeLessThan(1);
  expect.soft((await analysis.getByLabel('Phase timing bar').boundingBox())!.height).toBeLessThanOrEqual(16);
  await expect.soft(analysis.getByRole('columnheader').nth(1)).toHaveCSS('text-align', 'center');
  await page.screenshot({ path: `docs/design-review/screenshots/restored-solve-hover-${width}.png`, animations: 'disabled' });
  await page.mouse.move(10, 10);
  await expect(analysis.getByRole('status')).toHaveCount(0);
  await analysis.getByRole('button', { name: 'Show OLL - 27 details' }).hover();
  await expect(analysis.getByRole('status')).toContainText('OLL - 27');
  await page.screenshot({ path: `docs/design-review/screenshots/restored-solve-header-hover-${width}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect.soft(history.locator('th').first()).toHaveCSS('text-align', 'center');
  await expect.soft(history.locator('td').first()).toHaveCSS('text-align', 'center');
  expect.soft(await page.getByRole('link', { name: 'Solve', exact: true }).evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
});

test('live solve analysis uses page scrolling, keeps the cube centered and preserves hover', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('History session').first()).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/timed-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { presentation: ReturnType<typeof harness.mount> }).presentation = harness.mount('finalize');
  });
  await page.getByRole('button', { name: 'Connect Cube', exact: true }).click();
  await expect(page.getByLabel('Actual setup moves')).toBeVisible();
  await expect.soft(page.getByRole('button', { name: 'Cancel preparation', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    const physical = (window as unknown as { presentation: (move: string, ms: number) => void }).presentation;
    physical('R', 100); physical('R', 200); physical("R'", 1000); physical("R'", 2234);
  });
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
  const analysis = page.getByRole('region', { name: 'CFOP phase timing' });
  await expect.soft(analysis).toHaveCSS('overflow-y', 'visible');
  await expect.soft(analysis).toHaveCSS('max-height', 'none');
  const camera = await page.getByLabel('Camera orbit', { exact: true }).boundingBox();
  const timer = await page.getByLabel('Solve time', { exact: true }).boundingBox();
  expect.soft(Math.abs(camera!.x + camera!.width / 2 - timer!.x - timer!.width / 2)).toBeLessThan(8);
  await analysis.locator('.cfop-segment').last().hover();
  await expect.soft(analysis.getByRole('status')).toHaveCSS('position', 'absolute');
  const card = await analysis.getByRole('status').boundingBox();
  expect(card!.y).toBeGreaterThanOrEqual(0);
  expect(card!.y + card!.height).toBeLessThanOrEqual(900);
  await page.screenshot({ path: `docs/design-review/screenshots/restored-live-solve-${width}.png`, fullPage: true, animations: 'disabled' });
});

test('idle Cross keeps the cube and move timer on the same center line', async ({ page }) => {
  await page.goto('/#/cross');
  const workspace = page.getByRole('region', { name: 'Cross workspace' });
  const cube = workspace.getByLabel('Camera orbit', { exact: true });
  const value = workspace.locator('.cross-focused-moves .timer-value');
  await expect(value).toContainText('0');
  const camera = await cube.boundingBox();
  const timer = await value.boundingBox();
  const stage = await workspace.boundingBox();
  expect(Math.abs(camera!.x + camera!.width / 2 - stage!.x - stage!.width / 2)).toBeLessThan(8);
  expect(Math.abs(timer!.x + timer!.width / 2 - stage!.x - stage!.width / 2)).toBeLessThan(1);
  await page.screenshot({ path: `docs/design-review/screenshots/restored-cross-center-${width}.png`, fullPage: true, animations: 'disabled' });
});
});
}
