import { expect, test } from '@playwright/test';

for (const frame of [
  { name: 'desktop', width: 1440, height: 900, theme: 'light' as const },
  { name: 'mobile', width: 390, height: 844, theme: 'light' as const },
  { name: 'desktop-dark', width: 1440, height: 900, theme: 'dark' as const },
]) {
  test(`Competition Stage practice and supporting screens ${frame.name}`, async ({ page }) => {
    await page.setViewportSize(frame);
    await page.emulateMedia({ colorScheme: frame.theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.stage-session').getByLabel('History session')).toHaveValue(/.+/);
    await page.evaluate(async () => {
      const path = '/browser-tests/timed-harness.tsx';
      const harness = await import(/* @vite-ignore */ path) as typeof import('./timed-harness');
      (window as unknown as { stage: ReturnType<typeof harness.mount> }).stage = harness.mount();
    });
    await page.getByRole('button', { name: 'Connect Cube', exact: true }).click();
    await expect(page.getByLabel('Actual setup moves')).toBeVisible();
    const practice = page.getByRole('region', { name: 'Solve workspace' });
    const cube = await practice.getByLabel('Camera orbit', { exact: true }).boundingBox();
    expect(Math.abs(cube!.x + cube!.width / 2 - frame.width / 2)).toBeLessThan(8);
    await page.evaluate(() => {
      const move = (window as unknown as { stage: ReturnType<typeof import('./timed-harness').mount> }).stage;
      move('R', 100); move('R', 200); move("R'", 1000); move("R'", 2234);
    });
    await expect(page.getByLabel('Solve time', { exact: true })).toHaveText('1.23');
    await expect(page.getByRole('region', { name: 'Saved timed results' }).locator('tbody tr')).toHaveCount(1);
    await expect(page.getByLabel('Actual setup moves')).toBeVisible();
    // Physical-turn transforms settle over 90ms; capture the final cube state.
    await page.waitForTimeout(120);
    const analysis = page.getByRole('region', { name: 'CFOP phase timing' });
    await expect(analysis.getByRole('table', { name: 'Step analysis' })).toBeHidden();
    await page.screenshot({ path: `.impeccable/review/${frame.name}.png`, fullPage: true, animations: 'disabled' });
    await analysis.getByRole('button', { name: 'View analysis', exact: true }).click();
    await expect(analysis.getByRole('table', { name: 'Step analysis' })).toBeVisible();
    await analysis.getByRole('button', { name: 'Hide analysis', exact: true }).click();
    await expect(page.getByLabel('Solve time', { exact: true })).toHaveText('1.23');
    await page.getByRole('button', { name: 'Connected', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Device' })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/${frame.name}-device.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/${frame.name}-settings.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('link', { name: 'Cross Trainer', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Mode', exact: true })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/${frame.name}-cross.png`, fullPage: true, animations: 'disabled' });
    await page.getByRole('link', { name: 'Insights', exact: true }).click();
    await page.screenshot({ path: `.impeccable/review/${frame.name}-insights.png`, fullPage: true, animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
