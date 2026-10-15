import { expect, test, type Page } from '@playwright/test';

async function fit(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const elements = [document.documentElement, ...document.querySelectorAll('.app-shell, .workspace, .workspace aside, .page-content, .practice-workspace, .history-panel')];
    return elements.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width && rect.height && (rect.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1);
    }).map(el => el.className || el.tagName);
  });
  expect(overflow).toEqual([]);
}
async function mount(page: Page, mode: 'solve' | 'cross'): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async mode => {
    const path = mode === 'solve' ? '/browser-tests/timed-harness.tsx' : '/browser-tests/cross-practice-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
    (window as unknown as { practice: ReturnType<typeof harness.mount> }).practice = harness.mount('finalize');
  }, mode);
  if (mode === 'cross') {
    await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
    await page.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('free');
    await page.getByRole('slider', { name: 'Difficulty' }).press('Home');
  }
}
async function physical(page: Page, move: string, ms: number): Promise<void> {
  await page.evaluate(({ move, ms }) => (window as unknown as { practice: (move: string, ms: number) => void }).practice(move, ms), { move, ms });
}
for (const size of [{ width: 1280, height: 900 }, { width: 1920, height: 1080 }]) {
  for (const theme of ['light', 'dark'] as const) {
    for (const mode of ['solve', 'cross'] as const) {
      test(`${mode} ${theme} ${size.width} actual workspace state samples`, async ({ page }) => {
        await page.setViewportSize(size);
        await page.emulateMedia({ colorScheme: theme });
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await mount(page, mode);
        const capture = async (state: string): Promise<void> => {
          await page.screenshot({ path: `docs/design-review/screenshots/${mode}-${theme}-${size.width}-${state}.png`, fullPage: true, animations: 'disabled' });
          await fit(page);
        };
        const history = page.getByRole('region', { name: mode === 'solve' ? 'Saved timed results' : 'Cross practice history' });
        await expect(history.getByLabel('History session')).toHaveValue(/.+/);
        await expect(history.locator('.empty-history')).toBeVisible();
        await capture('disconnected');
        await capture('empty-history');
        await page.getByRole('button', { name: 'Connect Cube', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
        await expect(page.getByLabel('Actual setup moves')).toBeVisible();
        await capture('preparation');
        await physical(page, 'F', 50);
        await expect(page.getByLabel('Undo moves')).toContainText("F'");
        await capture('correction');
        await physical(page, "F'", 75);
        await physical(page, 'R', 100); await physical(page, 'R', 200);
        await expect(page.getByLabel('Actual setup moves').locator('[aria-current=step]')).toHaveCount(0);
        await capture('ready');
        await physical(page, "R'", 1000);
        await expect(page.getByRole('timer')).toBeVisible();
        await capture('active');
        await physical(page, "R'", 2234);
        await expect(page.getByRole('button', { name: mode === 'solve' ? 'Retry save' : 'Retry cross save', exact: true })).toBeVisible();
        await expect(history.locator('tbody tr')).toHaveCount(0);
        await capture('failed-save');
        await page.evaluate(() => (window as unknown as { practice: { enableWrites(): void } }).practice.enableWrites());
        await page.getByRole('button', { name: mode === 'solve' ? 'Retry save' : 'Retry cross save', exact: true }).click();
        await expect(history.locator('tbody tr')).toHaveCount(1);
        await capture('completed');
        await history.locator('tbody button').click();
        const details = page.getByRole('dialog');
        await expect(details).toContainText('Default');
        expect(await details.innerText()).not.toMatch(/browser-r2|[a-f0-9]{8}-[a-f0-9]{4}-/);
        await page.keyboard.press('Escape');
        await expect(history.locator('tbody button')).toBeFocused();
        if (mode === 'cross') await page.getByRole('button', { name: 'Retry same case', exact: true }).click();
        await expect(page.getByLabel('Actual setup moves')).toBeVisible();
        if (mode === 'cross') {
          const sequence = await page.getByLabel('Actual setup moves').locator('li').allTextContents();
          expect(sequence.length).toBeGreaterThanOrEqual(15);
          expect(sequence.length).toBeLessThanOrEqual(25);
          let ms = 2400;
          for (const token of sequence) {
            const move = token.replace(/^(Current |Completed )/, '');
            await physical(page, move.endsWith('2') ? move[0] : move, ms += 10);
            if (move.endsWith('2')) await physical(page, move[0], ms += 10);
          }
        } else { await physical(page, 'R', 2400); await physical(page, 'R', 2500); }
        await physical(page, 'D', 3000);
        await page.getByRole('button', { name: 'Connected', exact: true }).click();
        await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
        await page.keyboard.press('Escape');
        await expect(history.locator('tbody tr')).toHaveCount(1);
        await expect(page.getByRole('timer')).toBeVisible();
        await capture('recovery');
        expect(errors).toEqual([]);
      });
    }
  }
}
test('keyboard dialogs trap focus, restore openers and reflow at 200 percent / 320 px', async ({ page }) => {
  await mount(page, 'solve');
  await page.getByRole('button', { name: 'Connect Cube', exact: true }).click();
  const device = page.getByRole('button', { name: 'Connected', exact: true });
  await device.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Device', exact: true });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.screenshot({ path: 'docs/design-review/screenshots/device-keyboard.png' });
  await page.keyboard.press('Escape'); await expect(device).toBeFocused();
  const settings = page.getByRole('link', { name: 'Settings', exact: true });
  await settings.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toBeVisible();
  await page.screenshot({ path: 'docs/design-review/screenshots/settings.png' });
  await page.keyboard.press('Escape'); await expect(settings).toBeFocused();
  for (const width of [640, 320]) {
    await page.setViewportSize({ width, height: 450 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Difficulty' })).toBeVisible();
    await page.getByRole('button', { name: 'Connected', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `docs/design-review/screenshots/reflow-${width}.png`, fullPage: true });
  }
});

test('history actions expose tooltips and visible keyboard focus; both themes have readable tokens', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Saved timed results' }).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/src/adapters/local-repository.ts';
    const { LocalRepository } = await import(/* @vite-ignore */ path) as typeof import('../src/adapters/local-repository');
    const repo = new LocalRepository();
    const data = await repo.initialize();
    for (let i = 0; i < 40; i++) await repo.saveTimedResult({ id: `tooltip-${i}`, sessionId: data.currentSessionId!, status: 'completed', startedAt: 1000 + i, rawDurationMs: 1000, penalty: 'none', timingBasis: 'host-monotonic-receipt' });
    repo.close();
  });
  await page.reload();
  const next = page.getByRole('region', { name: 'Saved timed results' }).getByRole('button', { name: 'Next results', exact: true });
  await expect(next).toBeEnabled();
  await next.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Next results');
  expect(await next.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    const contrast = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const luminance = (name: string): number => {
        const hex = style.getPropertyValue(name).trim().slice(1);
        const full = hex.length === 3 ? [...hex].map(c => c + c).join('') : hex;
        const values = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
        return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
      };
      const ratio = (a: string, b: string): number => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      return [ratio('--text', '--canvas'), ratio('--muted', '--canvas'), ratio('--muted', '--surface'), ratio('--accent-text', '--accent'), ratio('--danger', '--surface')];
    });
    for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});

