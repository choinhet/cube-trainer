import { expect, test } from '@playwright/test';
for (const width of [1280, 375]) {
  test(`Solve detail phase selection, supporting Details and bounded scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByLabel('History session').first()).toHaveValue(/.+/);
    await page.evaluate(async () => {
      const repositoryPath = '/src/adapters/local-repository.ts';
      const cubePath = '/src/domain/cube.ts';
      const { LocalRepository } = await import(/* @vite-ignore */ repositoryPath) as typeof import('../src/adapters/local-repository');
      const { SOLVED } = await import(/* @vite-ignore */ cubePath) as typeof import('../src/domain/cube');
      const repository = new LocalRepository(); const data = await repository.initialize();
      const moves = "R U R' R U R' U R U2 R' R U R' U' R' F R2 U' R' U' R U R' F' U".split(' ');
      await repository.saveTimedResult({ id: 'design-solve', sessionId: data.currentSessionId!, status: 'completed', startedAt: 1000, rawDurationMs: 2400, penalty: 'none', timingBasis: 'host-monotonic-receipt', facelets: SOLVED, originalScramble: Array(8).fill('R U2 F2 L2 D B2').join(' '), rawTurns: moves.map((move, serial) => ({ move, serial, hostMs: serial * 100, deviceMs: null })) });
      repository.close();
    });
    await page.reload();
    const opener = page.getByRole('region', { name: 'Saved timed results' }).locator('tbody button').first();
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Solve details' });
    await expect(dialog.getByLabel('Total time')).toHaveText('2.40');
    await expect(dialog.getByRole('table', { name: 'Step analysis' })).toBeVisible();
    await page.screenshot({ path: "test-results/solve-details-initial-" + width + ".png" });
    const details = dialog.getByRole('button', { name: 'Details', exact: true });
    await expect(details).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog.getByRole('table', { name: 'Solve details' })).toBeHidden();
    const phase = dialog.getByRole('button', { name: 'Show PLL - T details' });
    const phaseBounds = await phase.boundingBox();
    expect(phaseBounds!.width).toBeGreaterThanOrEqual(44);
    expect(phaseBounds!.height).toBeGreaterThanOrEqual(44);
    await phase.focus(); await page.keyboard.press('Enter');
    await expect(dialog.getByRole('region', { name: 'Phase details', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(phase).toBeFocused();
    await expect(dialog.getByRole('region', { name: 'Phase details', exact: true })).toHaveCount(0);
    await phase.click(); await dialog.getByRole('button', { name: 'Close phase details' }).click();
    await details.click();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByRole('table', { name: 'Solve details' })).toBeVisible();
    await expect(dialog.getByRole('table', { name: 'Cumulative phase times' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/solve-details-design-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
  });
}
