import { expect, test, type Page } from '@playwright/test';
import type { mount } from './locked-view-harness';
type Harness = ReturnType<typeof mount>;
declare global { interface Window { lockedView: Harness } }
async function mountApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('region',{name:'Saved timed results'}).getByLabel('History session')).toHaveValue(/.+/);
  await page.evaluate(async () => {
    const path = '/browser-tests/locked-view-harness.tsx';
    const harness = await import(/* @vite-ignore */ path) as typeof import('./locked-view-harness');
    window.lockedView = harness.mount();
  });
  await expect(page.getByRole('button',{name:'Connect Cube',exact:true})).toBeEnabled();
}
async function gyro(page: Page, degrees: number): Promise<void> {
  await page.evaluate(d => window.lockedView.gyro({x:0,y:0,z:Math.sin(d*Math.PI/360),w:Math.cos(d*Math.PI/360)}),degrees);
}
const screenshots = 'test-results/locked-view';
for (const mode of ['Solve', 'Cross Trainer']) {
  test(`${mode} locked viewing controls, gyro lifecycle and logical slice turns`, async ({page}) => {
    await page.setViewportSize({width:1280,height:900});
    await mountApp(page);
    await page.getByRole('link',{name:'Settings',exact:true}).click();
    await page.getByRole('checkbox',{name:'Locked 3D mode',exact:true}).check();
    await page.getByRole('spinbutton',{name:'Default angle (degrees)',exact:true}).fill('35');
    const camera = page.getByLabel('Camera orbit'), pose = page.getByLabel('Physical orientation'), view = page.getByLabel('Live 3D cube');
    await expect(camera).toHaveCSS('transform', /matrix3d/);
    await expect(camera).toHaveAttribute('style','transform: rotateX(-24deg) rotateY(-35deg);');
    await page.screenshot({path:`${screenshots}/settings.png`});
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:mode,exact:true}).click();
    await page.getByRole('button',{name:'Connect Cube',exact:true}).click();
    await expect(page.getByRole('button',{name:'Connected',exact:true})).toBeVisible();
    await gyro(page,0);
    const initial = await pose.getAttribute('style');
    await gyro(page,49); await expect(pose).toHaveAttribute('style',initial!);
    await gyro(page,50); await expect(pose).not.toHaveAttribute('style',initial!);
    const quarter = await pose.getAttribute('style');
    await gyro(page,41); await expect(pose).toHaveAttribute('style',quarter!);
    await gyro(page,39); await expect(pose).toHaveAttribute('style',initial!);
    await expect(pose).toHaveCSS('transition-duration','0s');
    await view.press('ArrowRight'); const manual = await pose.getAttribute('style');
    await gyro(page,2); await expect(pose).toHaveAttribute('style',manual!);
    await page.getByRole('button',{name:'Connected',exact:true}).click();
    await page.getByRole('button',{name:'Reset gyro (U4)',exact:true}).click();
    await expect(pose).toHaveAttribute('style',initial!);
    await page.keyboard.press('Escape');
    await view.press('ArrowRight');
    await page.getByRole('button',{name:'Connected',exact:true}).click();
    await page.getByRole('button',{name:'Disconnect',exact:true}).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Connect Cube',exact:true}).click();
    await expect(page.getByRole('button',{name:'Connected',exact:true})).toBeVisible();
    await expect(pose).toHaveAttribute('style',initial!);
    const rotations = await page.evaluate(async () => {
      const path = '/src/domain/cube-orientation.ts';
      const { CUBE_ORIENTATIONS } = await import(/* @vite-ignore */ path) as typeof import('../src/domain/cube-orientation');
      return CUBE_ORIENTATIONS;
    });
    const reached = new Set<string>();
    for (const rotation of rotations) {
      await page.evaluate(q => window.lockedView.gyro({x:-q.x,y:q.z,z:q.y,w:q.w}), rotation);
      await expect.poll(async () => pose.evaluate(el => el.getAttribute('style'))).not.toBeNull();
      const matrix = await pose.evaluate(el => (el as HTMLElement).style.transform.slice(9,-1).split(',').map(Number).map(v => Math.round(v)));
      reached.add(matrix.join(','));
    }
    expect(reached.size).toBe(24);
    await gyro(page,0);
    await page.evaluate(() => window.lockedView.report());
    await page.evaluate(() => { window.lockedView.move("R'"); window.lockedView.move('L'); });
    await gyro(page,0);
    await expect(view).not.toHaveAttribute('data-state','UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    const slice = await view.getAttribute('data-state');
    await page.evaluate(() => { window.lockedView.move('R'); window.lockedView.move("L'"); });
    await expect(view).toHaveAttribute('data-state','UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
    expect(slice).toHaveLength(54);
    await expect(page.getByLabel('Turning layer')).toHaveCount(0);
    await page.screenshot({path:`${screenshots}/${mode === 'Solve' ? 'solve' : 'cross'}-locked.png`});
    await page.reload();
    await expect(page.getByLabel('Camera orbit')).toHaveAttribute('style','transform: rotateX(-24deg) rotateY(-35deg);');
  });
}
