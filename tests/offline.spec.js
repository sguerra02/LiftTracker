import { test, expect, fixture, shiftLog, seed } from './helpers.js';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function jsFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await jsFiles(p)); else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

test('the service worker caches every script', async () => {
  const sw = await readFile('sw.js', 'utf8');
  for (const f of await jsFiles('js')) expect(sw, f + ' missing from sw.js SHELL').toContain("'" + f.replace(/\\/g, '/') + "'");
});

test('works offline after the first visit', async ({ page, context }) => {
  await seed(page, shiftLog(fixture(), 1));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-act=startWorkout]')).toBeVisible();
  await context.setOffline(false);
});

test.describe('rest alerts', () => {
  test('a rest alert notification fires from the service worker', async ({ page, context }) => {
  await context.grantPermissions(['notifications']);
  await seed(page, shiftLog(fixture(), 1));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.locator('[data-act=tab][data-tab=setup]').click();
  await page.locator('[data-act=sub][data-s=data]').click();
  await page.locator('[data-act=alertsOn]').click();
  await expect(page.locator('#view')).toContainText('Lock-screen alerts on');
  const shown = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    reg.active.postMessage({ type: 'rest', id: 't1', at: Date.now() + 300, title: 'Rest over', body: 'Next set: Squat', force: true });
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 100)); const n = await reg.getNotifications({ tag: 'rest' }); if (n.length) return n[0].body; }
    return null;
  });
  expect(shown).toBe('Next set: Squat');
});
});
