import { test, expect, fixture, shiftLog, seed, open, finishWorkout, view, daysAgo } from './helpers.js';
import { readFile } from 'node:fs/promises';

test.describe('set timestamps and rest', () => {
  test('rest times between sets show up in history', async ({ page }) => {
    await page.clock.install();
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    await page.locator('[data-act=startWorkout]').click();
    const done = page.locator('[data-act=done]');
    for (let i = 0; i < await done.count(); i++) {
      await page.clock.fastForward('02:00');
      await done.nth(i).click();
    }
    await page.locator('[data-act=finish]').click();
    const t = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).sessions.at(-1).entries[0].sets.map(s => s.t));
    expect(t.every(x => x > 0)).toBe(true);
    await open(page, 'progress', 'history');
    await page.locator('details.sess').first().locator('summary').click();
    await expect(page.locator('details.sess').first()).toContainText('avg rest 2:00');
  });

  test('sets checked off all at once are not treated as rest', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    await page.locator('[data-act=startWorkout]').click();
    await finishWorkout(page);
    await open(page, 'progress', 'history');
    await page.locator('details.sess').first().locator('summary').click();
    await expect(page.locator('details.sess').first()).toContainText('checked off together');
  });
});

test.describe('comeback after a break', () => {
  test('ramps 90% then 95% then back to normal, without changing progression', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 20));
    await page.goto('/');
    await expect(view(page)).toContainText('Welcome back.');
    await expect(view(page)).toContainText('90%');
    const normal = await page.evaluate(async () => {
      const e = await import('/js/engine.js'); const p = e.activePlan(); const ps = e.planState(p);
      return e.buildEntries(p, ps.next, ps.lifts).map(x => x.target.rows.map(r => r.w));
    });
    await page.locator('[data-act=startWorkout]').click();
    await expect(page.locator('.chip', { hasText: '90% comeback' }).first()).toBeVisible();
    const ramped = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).current.entries.map(x => x.target.rows.map(r => r.w)));
    ramped.forEach((rows, i) => rows.forEach((w, j) => expect(w).toBeLessThanOrEqual(normal[i][j])));
    expect(ramped.flat().some((w, i) => w < normal.flat()[i])).toBe(true);
    await finishWorkout(page);
    await expect(view(page)).toContainText('Comeback set done');
    await page.locator('[data-act=dismissResult]').click();
    await expect(view(page)).toContainText('Comeback session 2 of 2');
    await expect(view(page)).toContainText('95%');
    await page.locator('[data-act=startWorkout]').click();
    await finishWorkout(page);
    await page.locator('[data-act=dismissResult]').click();
    await expect(view(page)).not.toContainText('Comeback session');
  });

  test('can be skipped', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 30));
    await page.goto('/');
    await expect(view(page)).toContainText('85%');
    await page.locator('[data-act=skipComeback]').click();
    await expect(view(page)).not.toContainText('Welcome back');
  });

  test('no ramp after a short gap', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 5));
    await page.goto('/');
    await expect(view(page)).not.toContainText('Welcome back');
  });
});

test.describe('plate plan', () => {
  test('warm-ups for a barbell lift only add plates', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    const steps = await page.evaluate(async () => {
      const pl = await import('/js/features/plates.js');
      return pl.planPath([45, 95, 115, 135].map(t => ({ target: t, flex: null, seg: 'a' })));
    });
    expect(steps.map(s => s.w)).toEqual([45, 95, 115, 135]);
    // 135 is loaded as 25 + 10 + 10 instead of a single 45, so nothing comes off on the way up
    expect(steps.every(s => s.remove.length === 0)).toBe(true);
    expect(steps[3].side).toEqual([25, 10, 10]);
    await page.locator('[data-act=startWorkout]').click();
    await expect(page.locator('details.warm').first()).toContainText('plate plan');
  });

  test('beats loading the fewest plates each time', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    const r = await page.evaluate(async () => {
      const pl = await import('/js/features/plates.js'); const core = await import('/js/core.js'); const eq = await import('/js/equipment.js');
      core.S.equipment.plates = [{ id: 'a', weight: 45, qty: 4 }, { id: 'b', weight: 35, qty: 2 }, { id: 'c', weight: 25, qty: 2 }, { id: 'd', weight: 10, qty: 4 }, { id: 'e', weight: 5, qty: 2 }, { id: 'f', weight: 2.5, qty: 2 }];
      eq.eqChanged();
      const ws = [45, 95, 115, 135, 155];
      const path = pl.planPath(ws.map(t => ({ target: t, flex: null, seg: 'x' })));
      const ex = { load: 'barbell' }; const greedy = ws.map(w => eq.loadOptions(ex).find(o => o.w === w).side.map(p => p.weight));
      let g = 0; let prev = []; for (const s of greedy) { g += pl.changeCost(prev, s); prev = s; }
      const p = path.reduce((a, s) => a + s.remove.length + s.add.length, 0);
      return { g, p };
    });
    expect(r.p).toBeLessThanOrEqual(r.g);
  });
});

test.describe('cardio', () => {
  test('logging cardio fills the weekly meter, report and streak', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 40));
    await page.goto('/');
    await page.locator('[data-act=skipComeback]').click();
    for (const [type, min, effort] of [['walk', '30', 'moderate'], ['run', '20', 'vigorous']]) {
      await page.locator('#cardio-panel [data-act=cardioOpen]').click();
      await page.locator('#cd-type').selectOption(type);
      await page.locator('#cd-min').fill(min);
      await page.locator(`label:has(#cd-ef-${effort})`).click();
      await page.locator('[data-act=cardioSave]').click();
    }
    await expect(page.locator('#cardio-panel')).toContainText('70 of 150 active minutes');
    await open(page, 'progress', 'cardio');
    await expect(view(page)).toContainText('Walk');
    await expect(view(page)).toContainText('Run');
    await open(page, 'progress', 'report');
    await expect(view(page)).toContainText('2 sessions · 50 min');
    await open(page, 'progress', 'trophies');
    await expect(view(page)).toContainText('This week: 2 of 2');
  });

  test('a cardio session can be deleted', async ({ page }) => {
    const d = shiftLog(fixture(), 1);
    d.cardio = [{ id: 'c1', date: daysAgo(0), createdAt: Date.now(), type: 'bike', min: 45, dist: 12, du: 'mi', effort: 'moderate', notes: '' }];
    await seed(page, d);
    await page.goto('/');
    await open(page, 'progress', 'cardio');
    await expect(view(page)).toContainText('12 mi');
    await page.locator('[data-act=cardioDel]').click();
    await page.locator('[data-act=cYes]').click();
    await expect(view(page)).toContainText('No cardio logged yet');
  });
});

test.describe('sharing', () => {
  test('a plan exports to a file and imports as a new plan', async ({ page, browser }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    await open(page, 'plans');
    await page.locator('[data-act=planShare][data-p=sl5]').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=fileSave]').click()]);
    const file = await dl.path();
    const payload = JSON.parse(await readFile(file, 'utf8'));
    expect(payload.kind).toBe('plan');
    expect(payload.plan.start).toBeUndefined();

    await page.locator('#plan-file').setInputFiles(file);
    await page.locator('[data-act=cYes]').click();
    await expect(view(page)).toContainText('(imported)');
    const plans = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).plans.filter(p => p.name.includes('(imported)')));
    expect(plans).toHaveLength(1);
    expect(plans[0].runId).toBeNull();
  });

  test('the backup importer recognises a plan file and only adds the plan', async ({ page }) => {
    const d = shiftLog(fixture(), 1);
    await seed(page, d);
    await page.goto('/');
    const text = await page.evaluate(async () => { const sh = await import('/js/features/share.js'); const c = await import('/js/core.js'); return JSON.stringify(sh.planPayload(c.S.plans.find(p => p.id === 'ss'))); });
    await open(page, 'setup', 'data');
    await page.locator('#import-text').fill(text);
    await page.locator('[data-act=import]').click();
    await expect(page.locator('#modal')).toContainText('Add “');
    await page.locator('[data-act=cYes]').click();
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).sessions.length);
    expect(n).toBe(d.sessions.length);
  });

  test('a PR card renders as an image', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    await open(page, 'progress', 'trophies');
    await page.locator('[data-act=prCard]').first().click();
    const img = page.locator('#modal img.cardprev');
    await expect(img).toBeVisible();
    const size = await img.evaluate(i => [i.naturalWidth, i.naturalHeight]);
    expect(size).toEqual([1080, 1350]);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-act=fileSave]').click()]);
    expect(dl.suggestedFilename()).toMatch(/^iron-ledger-pr-.*\.png$/);
  });
});

test.describe('changing upcoming weights', () => {
  test('a new weight applies to the next workout and progression continues from it', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    const lift = page.locator('.lift').first();
    await lift.locator('[data-act=adjOpen]').click();
    await page.locator('#adj-w').fill('95');
    await page.locator('[data-act=adjSave]').click();
    await expect(lift).toContainText('95 lb');
    await expect(lift).toContainText('Changed from');
    await page.locator('[data-act=startWorkout]').click();
    const w = await page.evaluate(() => JSON.parse(localStorage.getItem('ironledger.v1')).current.entries[0].sets[0].w);
    expect(w).toBe(95);
    await finishWorkout(page);
    await page.locator('[data-act=dismissResult]').click();
    // the change survives reloads and stays in effect for later workouts of that lift
    const base = await page.evaluate(async () => { const e = await import('/js/engine.js'); const p = e.activePlan(); const ps = e.planState(p); const k = p.days[0].slots[0]; return ps.lifts[e.slotKey(p, k)].w; });
    expect(base).toBeGreaterThanOrEqual(95);
    expect(base).toBeLessThan(110);
  });

  test('a change can be undone', async ({ page }) => {
    await seed(page, shiftLog(fixture(), 1));
    await page.goto('/');
    const lift = page.locator('.lift').first();
    const before = await lift.locator('.rx').innerText();
    await lift.locator('[data-act=adjOpen]').click();
    await page.locator('#adj-w').fill('300');
    await page.locator('[data-act=adjSave]').click();
    await expect(lift.locator('.rx')).not.toHaveText(before);
    await lift.locator('[data-act=adjUndo]').click();
    await expect(lift.locator('.rx')).toHaveText(before);
  });
});

test.describe('report comparison', () => {
  const lastOf = d => d.sessions.slice().sort((a, b) => a.date < b.date ? -1 : 1).at(-1);

  test('compares with the same day even from an earlier plan', async ({ page }) => {
    const d = shiftLog(fixture(), 0);
    const last = lastOf(d);
    for (const s of d.sessions) if (s !== last) s.planId = 'older-plan';
    await seed(page, d);
    await page.goto('/');
    await open(page, 'progress', 'report');
    await expect(view(page)).toContainText(`Compared with Day ${last.dayName} on`);
  });

  test('falls back to a similar day only when the same day is over a month old', async ({ page }) => {
    const d = shiftLog(fixture(), 0);
    const last = lastOf(d);
    const cut = daysAgo(31);
    d.sessions = d.sessions.filter(s => s === last || s.dayName !== last.dayName || s.date < cut);
    await seed(page, d);
    await page.goto('/');
    await open(page, 'progress', 'report');
    await expect(view(page)).toContainText('so this is your closest match');
  });
});
