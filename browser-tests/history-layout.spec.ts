import { expect, test } from '@playwright/test';

for (const mode of ['solve', 'cross'] as const) {
  test(`${mode} history aligns numeric columns, fits rows to height, and anchors pagination`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
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
      const session = await repository.createSession('Layout practice');
      const crosses = new CrossRepository(repository);
      for (let i = 0; i < 40; i++) {
        await repository.saveTimedResult({ id: `layout-${i}`, sessionId: session.id, status: 'completed', startedAt: 1791917674899 + i, rawDurationMs: 2000, penalty: 'none', timingBasis: 'host-monotonic-receipt', rawTurns: [{ move: 'R', serial: 1, hostMs: 0, deviceMs: null }, { move: 'R', serial: 2, hostMs: 2000, deviceMs: null }] });
        const attempt = new CrossAttempt(`cross-${i}`, session.id, { caseId: 'layout', startingState: turn(SOLVED, 'R2'), originalScramble: 'R2', color: 'white', optimum: 1 });
        attempt.arm(); attempt.receive({ move: 'R', serial: 1, hostMs: 0, deviceMs: null }, 1791917674899 + i);
        await crosses.finalize(attempt.receive({ move: 'R', serial: 2, hostMs: 2000, deviceMs: null }, 1791917676899 + i)!);
      }
      repository.close();
    });
    await page.reload();
    if (mode === 'cross') await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
    const history = page.getByRole('region', { name: mode === 'solve' ? 'Saved timed results' : 'Cross practice history' });
    await expect(history.locator('tbody tr')).not.toHaveCount(0);
    await expect.poll(() => history.locator('tbody tr').count()).toBeGreaterThan(5);
    const shortCount = await history.locator('tbody tr').count();
    const checkGeometry = async () => {
      const geometry = await history.evaluate(element => {
        const panel = element.getBoundingClientRect();
        const footer = element.querySelector('.history-pagination')!.getBoundingClientRect();
        const cells = [...element.querySelectorAll('tbody tr:first-child td')].map(cell => cell.getBoundingClientRect());
        const buttons = [...element.querySelectorAll('.history-pagination button')].map(button => button.getBoundingClientRect().width);
        return { bottomGap: panel.bottom - footer.bottom, columnGap: cells[1].x + cells[1].width / 2 - cells[0].x - cells[0].width / 2, buttons, numericAligned: [...element.querySelectorAll('.history-list th, .history-list td')].every(head => getComputedStyle(head).textAlign === 'center'), overflow: element.querySelector('.history-table-area')!.scrollHeight > element.querySelector('.history-table-area')!.clientHeight + 1 };
      });
      expect(geometry.bottomGap).toBeLessThanOrEqual(18);
      expect(geometry.columnGap).toBeLessThanOrEqual(100);
      expect(geometry.buttons.every(width => width >= 44)).toBe(true);
      expect(geometry.numericAligned).toBe(true);
      expect(geometry.overflow).toBe(false);
    };
    await checkGeometry();
    await page.setViewportSize({ width: 1280, height: 1080 });
    await expect.poll(() => history.locator('tbody tr').count()).toBeGreaterThan(shortCount);
    await checkGeometry();
    await page.screenshot({ path: `test-results/history-${mode}-1080.png` });
    if (mode === 'solve') {
      await history.locator('tbody button').first().click();
      const dialog = page.getByRole('dialog', { name: 'Solve details' });
      await dialog.getByRole('button', { name: 'Details', exact: true }).click();
      await expect(dialog.getByRole('table', { name: 'Solve details' })).toBeVisible();
      await expect(dialog.locator('time')).toContainText('Oct 13, 2026');
      await expect(dialog.getByRole('button', { name: '+2', exact: true })).toHaveAttribute('aria-pressed', 'false');
      await dialog.getByRole('button', { name: '+2', exact: true }).click();
      await expect(dialog.getByLabel('Total time')).toHaveText('4.00 (+2)');
      await expect(dialog.getByRole('button', { name: '+2', exact: true })).toBeEnabled();
      await page.screenshot({ path: 'test-results/solve-details.png' });
      await dialog.getByRole('button', { name: '+2', exact: true }).click();
      await expect(dialog.getByLabel('Total time')).toHaveText('2.00');
      await expect(dialog.getByRole('button', { name: 'Delete result' })).toHaveText('');
    }
  });
}



