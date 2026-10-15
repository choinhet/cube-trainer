import { expect, test } from '@playwright/test';

test('Insights and diagnostic tabs fit narrow, desktop and enlarged text layouts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Enable Debug').check();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  for (const width of [1280, 390, 640]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((large) => { document.documentElement.style.fontSize = large ? '32px' : ''; }, width === 640);
    await page.getByRole('link', { name: 'Insights', exact: true }).click();
    await page.getByRole('tab', { name: 'Graphs', exact: true }).click();
    await expect(page.getByRole('tabpanel')).toContainText('not available yet');
    await page.getByRole('link', { name: 'Debug', exact: true }).click();
    const connection = page.getByRole('tab', { name: 'Connection', exact: true });
    await connection.click();
    await connection.press('End');
    await expect(page.getByRole('tab', { name: 'Cross cases', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Viewer traces', exact: true }).click();
    await expect(page.getByRole('tabpanel', { name: 'Viewer traces' })).toContainText('Raw state');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/navigation-${width}.png`, fullPage: true });
  }
});
