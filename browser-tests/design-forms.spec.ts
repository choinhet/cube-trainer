import { expect, test, type Locator, type Page } from '@playwright/test';

test.use({ colorScheme: 'dark' });

async function bounded(page: Page, dialog: Locator, action: Locator) {
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
  await expect(action).toBeVisible();
  for (const control of [dialog.getByRole('button', { name: 'Close', exact: true }), action]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  }
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [375, 640]) {
  test(`New session keeps its long draft and reachable actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 812 });
    await page.goto('/');
    if (width === 640) await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    const picker = page.locator('.stage-session').getByLabel('History session');
    await expect(picker).toHaveValue(/.+/);
    await picker.focus();
    await picker.selectOption({ label: 'New session' });
    const dialog = page.getByRole('dialog', { name: 'New session', exact: true });
    const input = dialog.getByLabel('New session name');
    const draft = 'Long session name for focused cross practice and careful review of every attempt '.repeat(2).slice(0, 120);
    await input.fill(draft);
    await bounded(page, dialog, dialog.getByRole('button', { name: 'Create session', exact: true }));
    await page.screenshot({ path: `test-results/new-session-form-${width}.png`, animations: 'disabled' });
    await input.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(picker).toBeFocused();
    await picker.selectOption({ label: 'New session' });
    await expect(input).toHaveValue(draft);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  test(`Import keeps invalid long input and reachable recovery at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 640 ? 450 : 812 });
    await page.goto('/');
    await expect(page.getByLabel('History session').first()).toHaveValue(/.+/);
    await page.evaluate(async () => {
      const path = '/browser-tests/cross-practice-harness.tsx';
      const harness = await import(/* @vite-ignore */ path) as typeof import('./cross-practice-harness');
      (window as unknown as { physicalCross: ReturnType<typeof harness.mount> }).physicalCross = harness.mount();
    });
    await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
    await page.getByRole('button', { name: 'Connect Cube', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Connected', exact: true })).toBeVisible();
    if (width === 640) await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
    const opener = page.getByRole('button', { name: 'Import shared scramble', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Import shared scramble', exact: true });
    const input = dialog.getByRole('textbox', { name: 'Shared scramble', exact: true });
    const invalid = `${"R U2 F' ".repeat(16)}INVALID`;
    await input.fill(invalid);
    const submit = dialog.getByRole('button', { name: 'Use scramble', exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(dialog.getByRole('alert')).toContainText('Check the scramble and try again');
    await expect(input).toHaveValue(invalid);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await bounded(page, dialog, submit);
    await page.screenshot({ path: `test-results/import-form-${width}.png`, animations: 'disabled' });
    await input.focus();
    await input.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}
