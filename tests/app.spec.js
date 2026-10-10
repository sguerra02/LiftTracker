import { test, expect, fixture, shiftLog, seed, open, finishWorkout, view } from './helpers.js';

test('first-run setup leads to a plan ready to start', async ({ page }) => {
  await page.goto('/');
  await expect(view(page)).toContainText('Set up your gym');
  await page.locator('#wz-bw').fill('180');
  await page.locator('[data-act=wizFinish]').click();
  await expect(view(page)).toContainText('Set your starting weights');
  await page.locator('[data-act=startPlan]').click();
  await expect(page.locator('[data-act=startWorkout]')).toBeVisible();
});

test('every tab and sub-tab renders with a full log', async ({ page }) => {
  await seed(page, shiftLog(fixture(), 1));
  await page.goto('/');
  for (const [tab, subs] of [['today', []], ['progress', ['report', 'goals', 'history', 'cardio', 'trophies', 'projection']], ['plans', []], ['setup', ['equipment', 'data']]]) {
    await open(page, tab);
    for (const s of subs) {
      await page.locator(`[data-act=sub][data-s=${s}]`).click();
      await expect(page.locator(`[data-act=sub][data-s=${s}]`)).toHaveAttribute('aria-selected', 'true');
    }
  }
});

test('finishing a workout moves the plan forward', async ({ page }) => {
  await seed(page, shiftLog(fixture(), 1));
  await page.goto('/');
  const day = await page.locator('.rot button.next').innerText();
  await page.locator('[data-act=startWorkout]').click();
  await finishWorkout(page);
  await expect(view(page)).toContainText('Next:');
  await page.locator('[data-act=dismissResult]').click();
  await expect(page.locator('.rot button.next')).not.toHaveText(day);
});

test('backup downloads and imports back to the same log', async ({ page }) => {
  const data = shiftLog(fixture(), 1);
  await seed(page, data);
  await page.goto('/');
  await open(page, 'setup', 'data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=export]').first().click()]);
  const file = await dl.path();
  const backup = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  expect(backup.app).toBe('iron-ledger');
  expect(backup.data.sessions).toHaveLength(data.sessions.length);

  await page.locator('[data-act=reset]').click();
  await page.locator('[data-act=cYes]').click();
  await open(page, 'setup', 'data');
  await page.locator('#import-file').setInputFiles(file);
  await page.locator('[data-act=cYes]').click();
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).sessions.length);
  expect(n).toBe(data.sessions.length);
});

test('switching to kg and back keeps every weight', async ({ page }) => {
  await seed(page, shiftLog(fixture(), 1));
  await page.goto('/');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).sessions.flatMap(s => s.entries.flatMap(e => e.sets.map(x => x.w))));
  for (const u of ['kg', 'lb']) {
    await open(page, 'setup', 'data');
    await page.locator(`[data-act=unitSwitch][data-u=${u}]`).click();
    await page.locator('[data-act=cYes]').click();
  }
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).sessions.flatMap(s => s.entries.flatMap(e => e.sets.map(x => x.w))));
  expect(after).toEqual(before);
});

test('every built-in program can start and log a workout', async ({ page }) => {
  test.setTimeout(90_000);
  await seed(page, shiftLog(fixture(), 1));
  await page.goto('/');
  const ids = await page.evaluate(async () => (await import('/js/core.js')).defaultPlans().map(p => p.id));
  expect(ids.length).toBeGreaterThan(10);
  for (const id of ids) {
    await open(page, 'plans');
    const use = page.locator(`[data-act=usePlan][data-p=${id}]`);
    if (await use.count()) await use.click(); else await open(page, 'today');
    if (await page.locator('[data-act=startPlan]').count()) await page.locator('[data-act=startPlan]').click();
    await page.locator('[data-act=startWorkout]').click();
    await finishWorkout(page);
    await expect(view(page), id).toContainText('Next');
  }
});
