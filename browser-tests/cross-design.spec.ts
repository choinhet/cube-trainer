import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'dark' });

test('Cross details expose metrics, supporting evidence and keyboard dismissal across viewport sizes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('History session').first()).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const localPath = '/src/adapters/local-repository.ts';
    const crossPath = '/src/adapters/cross-repository.ts';
    const attemptPath = '/src/domain/cross-attempt.ts';
    const cubePath = '/src/domain/cube.ts';
    const { LocalRepository } = await import(/* @vite-ignore */ localPath) as typeof import('../src/adapters/local-repository');
    const { CrossRepository } = await import(/* @vite-ignore */ crossPath) as typeof import('../src/adapters/cross-repository');
    const { CrossAttempt } = await import(/* @vite-ignore */ attemptPath) as typeof import('../src/domain/cross-attempt');
    const { SOLVED, turn } = await import(/* @vite-ignore */ cubePath) as typeof import('../src/domain/cube');
    const repository = new LocalRepository();
    const session = await repository.createSession('Cross detail keyboard and long content');
    const attempt = new CrossAttempt('detail-layout', session.id, { caseId: `long-case-${'technical-evidence-'.repeat(12)}`, startingState: turn(SOLVED, 'R2'), originalScramble: `${"R R' ".repeat(24)}R2`, color: 'white', optimum: 1 });
    attempt.arm();
    attempt.receive({ move: 'D', serial: 1, hostMs: 0, deviceMs: null }, 1000);
    attempt.receive({ move: "D'", serial: 2, hostMs: 200, deviceMs: null }, 1200);
    attempt.receive({ move: 'R', serial: 3, hostMs: 1000, deviceMs: null }, 2000);
    const record = attempt.receive({ move: 'R', serial: 4, hostMs: 2000, deviceMs: null }, 3000)!;
    await new CrossRepository(repository).finalize(record);
    repository.close();
  });
  await page.reload();
  await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
  for (const width of [1280, 375, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(large => { document.documentElement.style.fontSize = large ? '32px' : ''; }, width === 640);
    const result = page.getByRole('region', { name: 'Cross practice history' }).locator('tbody button').first();
    await result.focus();
    await result.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Cross details' });
    await expect(dialog.getByText('Executed moves', { exact: true }).locator('..')).toHaveText('Executed moves3');
    await expect(dialog.getByText('Move difference', { exact: true }).locator('..')).toHaveText('Move difference2');
    await expect(dialog.getByText('Time', { exact: true }).locator('..')).toContainText('2.00 seconds');
    const disclosure = dialog.getByRole('button', { name: 'Case and raw turns' });
    await disclosure.focus();
    await disclosure.press('Enter');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByText(/^Case ID:/)).toContainText('technical-evidence-');
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/cross-details-${width}.png`, fullPage: false, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(result).toBeFocused();
  }
});
