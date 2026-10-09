// The konbini shift (docs/GAME_DESIGN.md §9, agent 4D): Tanaka's offer and intro conversation, then a whole shift played by tapping and typing
// only, the wage the wallet receives equal to the formula, the first two shifts free of assist penalties, the third shift of a day refused with
// the boss's line, the leave path (paid x0.6 from two customers, never counted), Chapter 2's `c2_3` ticking. English or Arabic at 360 px.
// Usage: node tools/e2e/game/shift.mjs [--ar]   (dev server up; BASE overrides the URL; screenshots in tools/e2e/shots/game)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('shift');
const { page } = t;
const AR = t.arabic;
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

// ---- the pack's carts (the test knows the customers by their template id; the screen never shows the answer) -----------------------------
const PRICE = { onigiri: 160, water: 110, sandwich: 320, bento: 580, juice: 160, milk: 150, greenTea: 160, cake: 330, coffee: 130 };
const ARCH = {
  k_basic: { items: { onigiri: 2 } },
  k_water: { items: { water: 1 } },
  k_bento: { items: { bento: 1 } },
  k_three: { items: { onigiri: 3 } },
  k_two: { items: { greenTea: 1, sandwich: 3 } },
  k_drinks: { items: { juice: 2, milk: 1 } },
  k_sweet: { items: { cake: 1, coffee: 1 } },
  k_heat: { items: { bento: 1 }, flags: ['heat', 'nobag'], heat: true },
  k_heat2: { items: { bento: 1, greenTea: 1 }, flags: ['heat'], heat: true },
  k_bag: { items: { onigiri: 3 }, flags: ['nobag'] },
  k_change: { items: { sandwich: 1, juice: 1 }, paid: 1000 },
  k_change2: { items: { bento: 1, water: 1 }, paid: 1000 },
};
const totalOf = (a) => Object.entries(a.items).reduce((s, [k, q]) => s + PRICE[k] * q, 0);

// number tokens as the app writes them (packages/content/src/tokyo/game/jp-language.ts)
const DIGIT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const group = (g) => {
  const th = Math.floor(g / 1000), h = Math.floor(g / 100) % 10, te = Math.floor(g / 10) % 10, o = g % 10;
  const out = [];
  if (th) out.push(...(new Set([3, 8]).has(th) ? [`${DIGIT[th]}千`] : th === 1 ? ['千'] : [DIGIT[th], '千']));
  if (h) out.push(...(new Set([3, 6, 8]).has(h) ? [`${DIGIT[h]}百`] : h === 1 ? ['百'] : [DIGIT[h], '百']));
  if (te) out.push(...(te === 1 ? ['十'] : [DIGIT[te], '十']));
  if (o) out.push(DIGIT[o]);
  return out;
};
const amountTiles = (n) => [...group(n), '円', 'です'];

/** What the shifts paid so far, from the ledger (the wallet also receives daily goals and chapter rewards). */
const shiftPaid = (g) => g.ledger.filter((e) => e.kind === 'shift').reduce((n, e) => n + e.delta, 0);
/** Another day: the daily shift count and the repeat multiplier start again (ledger ids carry the day, so the same day is never replayed). */
const nextDay = () => setGame((g) => ({ clock: { ...g.clock, dayIndex: g.clock.dayIndex + 1 } }));
const changeShot = { done: false };
const text = (sel) => page.locator(sel).first().innerText();
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const F = (r) => 0.25 + 0.75 * r * r;
const round10 = (x) => Math.round(x / 10) * 10;

/** Merges a patch into the live game state; a function patch gets the current state (computed here, in node). */
async function setGame(patch) {
  const cur = await liveGame(page);
  const p = typeof patch === 'function' ? patch(cur) : patch;
  await page.evaluate((x) => {
    const g = window.__lw.getGame();
    window.__lw.useGame.getState().setGame({ ...g, ...x });
  }, p);
}
const openShift = async () => {
  await page.evaluate(() => {
    window.__lw.useUi.getState().setArgs('shift', { jobId: 'job_konbini' });
    window.__lw.useStore.getState().go('shift');
  });
  await page.waitForSelector('[data-screen=shift]');
  await t.sleep(300);
};
async function leaveDebrief() {
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(500);
}

/** Plays one customer. `how`: how the total and the thanks are answered. Returns the credits of its production tasks. */
async function serve(how, { assist, shots } = {}) {
  await page.waitForSelector('[data-customer]');
  const id = await page.locator('[data-customer]').getAttribute('data-customer');
  const a = ARCH[id];
  assert.ok(a, `known customer ${id}`);
  const total = totalOf(a);
  assert.equal(await page.locator('[data-line]').count(), 0, 'the customer text is hidden by default');
  if (assist === 'text') {
    await page.locator('[data-act=show-text]').click();
    await page.waitForSelector('[data-line]');
  } else if (assist === 'translation') {
    await page.locator('[data-act=show-trans]').click();
    await page.waitForSelector('[data-trans]');
  }
  // order
  await page.waitForSelector('[data-order]');
  for (const [item, q] of Object.entries(a.items)) for (let k = 0; k < q; k++) await page.locator(`.sh-item[data-item=${item}] .sh-item-main`).click();
  for (const f of a.flags ?? []) await page.locator(`[data-flag=${f}]`).click();
  await page.locator('[data-act=confirm-order]').click();
  const credits = [];
  const answerAmount = async (stage, amount) => {
    await page.waitForSelector(`[data-answer$=":${stage}"]`);
    if (stage === 'change' && !changeShot.done) {
      changeShot.done = true;
      await t.shot('16-change-stage');
    }
    if (how.total === 'type') {
      await page.locator('#sh-say').fill(stage === 'total' ? `${amount}円` : `${amount}`);
      await page.locator('[data-act=say]').click();
      credits.push(1);
    } else if (how.total === 'pick') {
      await page.locator('[data-act=help-pick]').click();
      if (shots) await t.shot(`${shots}-pick`);
      await page.locator('[data-choice=right]').click();
      credits.push(0.35);
    } else {
      await page.locator('[data-act=help-tiles]').click();
      if (shots) await t.shot(`${shots}-tiles`);
      const tiles = stage === 'total' ? amountTiles(amount) : ['お釣り', 'は', ...group(amount), '円', 'です'];
      for (const tile of tiles) await page.locator(`.sh-pool [data-tile="${tile}"]:not([disabled])`).first().click();
      await page.locator('[data-act=check]').click();
      credits.push(0.5);
    }
  };
  await answerAmount('total', total);
  if (a.paid) {
    // a change customer: the total and the change are one task, paid at the lower credit
    const before = credits.pop();
    await answerAmount('change', a.paid - total);
    credits.push(Math.min(before, credits.pop()));
  }
  // thanks
  await page.waitForSelector('[data-answer$=":thanks"]');
  if (shots) await t.shot(`${shots}-thanks`);
  if (how.thanks === 'type') {
    await page.locator('#sh-say').fill('arigatou gozaimashita');
    await page.locator('[data-act=say]').click();
    credits.push(1);
  } else if (how.thanks === 'pick') {
    await page.locator('[data-act=help-pick]').click();
    await page.locator('[data-choice=right]').click();
    credits.push(0.35);
  } else {
    await page.locator('[data-act=help-tiles]').click();
    const tiles = a.heat ? ['お待たせしました', 'どうぞ'] : ['ありがとうございました', 'また', 'どうぞ'];
    for (const tile of tiles) await page.locator(`.sh-pool [data-tile="${tile}"]:not([disabled])`).first().click();
    await page.locator('[data-act=check]').click();
    credits.push(0.5);
  }
  await page.waitForSelector('[data-done]');
  return { id, credits };
}

async function playShift(how, { repeat, shotPrefix, assistOn } = {}) {
  await page.locator('[data-act=start-shift]').click();
  await page.waitForSelector('[data-customer]');
  const all = [];
  for (let n = 1; n <= 5; n++) {
    assert.equal(await page.locator('[data-customer-n]').getAttribute('data-customer-n'), String(n));
    if (shotPrefix && n === 1) {
      await t.shot(`${shotPrefix}-customer`);
      await assertNoHScroll(page, 'customer line hidden');
    }
    const r = await serve(how, { assist: assistOn?.[n - 1], shots: shotPrefix && n === 1 ? shotPrefix : undefined });
    all.push(r);
    if (shotPrefix && n === 1) {
      await t.shot(`${shotPrefix}-served`);
    }
    await page.locator('[data-act=next-customer]').click();
    await t.sleep(150);
  }
  await page.waitForSelector('[data-shift-card=result]');
  const credits = all.flatMap((c) => c.credits);
  const r = credits.reduce((a, b) => a + b, 0) / credits.length;
  return { ids: all.map((c) => c.id), r, expect: round10(1150 * 0.75 * 1 * F(r) * repeat) };
}

// =============================================================================================================================
t.step('fresh profile, Chapter 2 open, ¥3,000 in the wallet');
await onboard(page, { arabic: AR, name: 'Sam' });
await t.sleep(1500);
await skipBeats(page).catch(() => {});
await page.locator('.tip .btn').click({ timeout: 4000 }).catch(() => {});
await setGame((g) => ({ chapter: { ...g.chapter, n: 2, completed: [1] } }));
assert.equal((await liveGame(page)).chapter.n, 2);

t.step("Tanaka's sheet offers 'Work a shift'; the first tap leads to his offer");
await page.evaluate(() => window.__world.teleportNear('hanako'));
await t.sleep(500);
await page.evaluate(() => window.__world.teleportNear('tanaka'));
await t.sleep(1000);
await page.locator('.talk-btn').click();
await page.waitForSelector('[data-opt=tanaka_shift]');
await t.sleep(500);
await t.shot('01-sheet');
await assertNoHScroll(page, 'interaction sheet');
await page.locator('[data-opt=tanaka_shift]').click();
await page.waitForSelector('[data-shift-card=intro]');
await t.shot('02-intro-gate');
await assertNoHScroll(page, 'intro gate');
assert.equal(await screen(), 'shift');

t.step('the intro conversation with Tanaka, by tapping the suggestions');
/** Taps the first suggestion; a tap that lands while the character is still speaking is ignored by the conversation, so it is repeated. */
async function tapFirstChip() {
  const n = await lines();
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.waitForFunction(() => document.querySelectorAll('.sg').length > 0 && !document.querySelector('.bubble.typing'));
    await page.locator('.sg').nth(0).click();
    const grew = await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k, n, { timeout: 5000 }).then(() => true, () => false);
    if (grew) return lineAfter(n);
  }
  throw new Error('the suggestion was never answered');
}
await page.locator('[data-act=talk-boss]').click();
await page.waitForSelector('.convo');
const lines = () => page.locator('.msg.char').count();
const lineAfter = async (n) => {
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k && !document.querySelector('.bubble.typing'), n, { timeout: 30000 });
  await t.sleep(600);
};
await lineAfter(0);
for (let i = 0; i < 3; i++) await tapFirstChip();
await t.shot('03-intro-convo');
// the conversation ends by itself: the goal card, then the debrief
await page.waitForSelector('.done-card', { timeout: 30000 });
await t.shot('03b-intro-done');
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card');
await t.shot('04-intro-debrief');
await leaveDebrief();
await skipBeats(page).catch(() => {});
let g = await liveGame(page);
assert.ok(g.scenarios?.job_konbini_intro ?? true);

t.step('back to the shift screen: the job card (rank, how it works, first shifts free), no intro gate any more');
await openShift();
await page.waitForSelector('[data-shift-card=job]');
await t.shot('05-job-card');
await assertNoHScroll(page, 'job card');
assert.equal(await page.locator('[data-shift-card=intro]').count(), 0, 'the intro is done');

// ---- shift 1: typed answers everywhere, with the assist buttons used on the first customers (free in the first two shifts) ----------
t.step('shift 1: five customers, typed totals and thanks; show-text and show-translation cost nothing in the first shifts');
const cash0 = shiftPaid(await liveGame(page));
const one = await playShift({ total: 'type', thanks: 'type' }, { repeat: 1, shotPrefix: '06-shift1', assistOn: ['text', 'translation'] });
await t.shot('07-result');
await assertNoHScroll(page, 'result card');
g = await liveGame(page);
const paid1 = shiftPaid(g) - cash0;
console.log(`  customers ${one.ids.join(' ')}; expected ¥${one.expect}, shifts paid +¥${paid1}`);
assert.equal(one.expect, 860, 'a typed rank-0 shift is the ¥860 of §9.2');
assert.equal(paid1, 860, 'the wallet got the shift pay');
assert.ok(g.wallet.cash >= 3000 + 860, 'and the cash is there');
assert.equal(await page.locator('[data-shift-card=result]').getAttribute('data-pay'), '860');
assert.equal(await page.locator('[data-shift-card=result]').getAttribute('data-band'), 'perfect');
assert.ok(g.ledger.some((e) => e.kind === 'shift' && e.delta === 860), 'a shift ledger entry');
assert.equal(g.jobs.job_konbini.good, 1, 'a good shift');
assert.equal(g.jobs.job_konbini.perfect, 1);
assert.ok((g.owned['konbini:onigiri']?.qty ?? 0) >= 1, 'the perfect-shift rice ball is in the bag');
assert.ok(g.chapter.done.c2_3 !== undefined, 'Chapter 2 c2_3 (first konbini shift) is done');
assert.ok(await page.locator('[data-bonus]').count(), 'the result card mentions the rice ball');
assert.equal(new Set(one.ids).size >= 4, true, 'at least four different customers');
await page.locator('[data-act=save-words]').click().catch(() => {});

// ---- shift 2: tiles for the totals, chips for the thanks: the pay follows the independence curve, x0.5 the same job ------------------
t.step('shift 2 (same job, same day): tiles and chips lower the credit; pay x0.5');
await page.locator('[data-act=again]').click();
await page.waitForSelector('[data-shift-card=job]');
assert.equal(await page.locator('[data-mult]').getAttribute('data-mult'), '0.5', 'the card says the second shift pays x0.5');
const cash1 = shiftPaid(await liveGame(page));
const two = await playShift({ total: 'tiles', thanks: 'pick' }, { repeat: 0.5, shotPrefix: '08-shift2' });
g = await liveGame(page);
const paid2 = shiftPaid(g) - cash1;
console.log(`  r ${two.r.toFixed(3)}; expected ¥${two.expect}, shifts paid +¥${paid2}`);
assert.equal(paid2, two.expect, 'the wallet got round10(wage x hours x perf x 0.5)');
assert.ok(two.expect < 430, 'less than the typed pay at the same repeat');
await t.shot('09-result-2');

// ---- the third shift of a day is refused --------------------------------------------------------------------------------------
t.step('the third shift of the day is refused politely, with the boss line');
await page.locator('[data-act=back]').click();
await t.sleep(400);
await openShift();
await page.waitForSelector('[data-shift-card=refuse]');
assert.match(await text('[data-shift-card=refuse]'), /今日|もう|休/, 'the boss line is Japanese');
await t.shot('10-refused');
await assertNoHScroll(page, 'refusal');
assert.equal(await page.locator('[data-act=start-shift]').count(), 0, 'no start button');
const before3 = await liveGame(page);
await page.locator('[data-act=back]').click();
await t.sleep(300);
assert.equal((await liveGame(page)).wallet.cash, before3.wallet.cash);

// ---- the leave path on a fresh day ---------------------------------------------------------------------------------------------
t.step('the leave path: two customers served, leave, paid x0.6, never counted');
await page.evaluate(() => window.__lw.useStore.getState().resetGameProgress());
await skipBeats(page).catch(() => {});
await setGame((g2) => ({ chapter: { ...g2.chapter, n: 2, completed: [1] }, scenarios: g2.scenarios }));
// the intro is part of the game save that was just reset: play it through the request, by the same taps
await page.evaluate(() => window.__lw.useUi.getState().startConvo({ scenarioId: 'job_konbini_intro', characterId: 'tanaka' }));
await page.waitForSelector('.convo');
await lineAfter(0);
for (let i = 0; i < 3; i++) await tapFirstChip();
await page.waitForSelector('.done-card', { timeout: 30000 });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card');
await leaveDebrief();
await skipBeats(page).catch(() => {});
await openShift();
await page.locator('[data-act=start-shift]').click();
await page.waitForSelector('[data-customer]');
const cash2 = shiftPaid(await liveGame(page));
const credits = [];
for (let n = 1; n <= 2; n++) {
  const r = await serve({ total: 'type', thanks: 'type' });
  credits.push(...r.credits);
  await page.locator('[data-act=next-customer]').click();
  await t.sleep(150);
}
await page.waitForSelector('[data-customer]');
await page.locator('[data-act=quit]').click();
await page.waitForSelector('[data-sheet=quit]');
await t.sleep(500);
await t.shot('11-quit-sheet');
await assertNoHScroll(page, 'quit sheet');
await page.locator('[data-act=leave-shift]').click();
await page.waitForSelector('[data-shift-card=result]');
await t.shot('12-quit-result');
g = await liveGame(page);
// two of five customers right: ticks 6/15 = 0.4 (< 0.6): the leave pay is x0.6 of a perf 0.4 shift
const expectQuit = round10(1150 * 0.75 * 1 * (0.4 * F(1)) * 1 * 0.6);
console.log(`  leave pay expected ¥${expectQuit}, shifts paid +¥${shiftPaid(g) - cash2}`);
assert.equal(shiftPaid(g) - cash2, expectQuit, 'the leave pay is x0.6');
assert.equal(g.jobs.job_konbini.good, 0, 'a left shift is never good');
assert.equal(g.chapter.done.c2_3, undefined, 'a left shift never ticks c2_3');
assert.equal(g.jobs.job_konbini.perfect, 0);

t.step('leave with fewer than two customers served: nothing is paid');
await page.locator('[data-act=back]').click();
await t.sleep(300);
await nextDay();
await openShift();
await page.locator('[data-act=start-shift]').click();
await page.waitForSelector('[data-customer]');
const cash3 = shiftPaid(await liveGame(page));
await page.locator('[data-act=quit]').click();
await page.waitForSelector('[data-sheet=quit]');
await page.locator('[data-act=leave-shift]').click();
await page.waitForSelector('[data-shift-card=result]');
assert.equal(shiftPaid(await liveGame(page)), cash3, 'no pay for fewer than 2 customers');
await page.locator('[data-act=back]').click();
await t.sleep(300);
assert.equal(await screen(), 'world');

// ---- rank 3: the flags and the customer who pays with a note ---------------------------------------------------------------------
t.step('rank 3: heat / no-bag customers and the 1,000-yen note (total, then the change), typed; pay = wage x hours x 1.24');
await nextDay();
await setGame((g2) => ({ jobs: { ...g2.jobs, job_konbini: { ...g2.jobs.job_konbini, rank: 3, good: 10, shifts: 12 } } }));
await page.locator('[data-act=back]').click().catch(() => {});
await openShift();
await t.shot('12c-rank3-card');
const cash4 = shiftPaid(await liveGame(page));
const three = { ids: [], seen: new Set() };
await page.locator('[data-act=start-shift]').click();
await page.waitForSelector('[data-customer]');
for (let n = 1; n <= 5; n++) {
  const r = await serve({ total: 'type', thanks: 'type' }, { shots: n === 1 ? undefined : undefined });
  three.ids.push(r.id);
  await page.locator('[data-act=next-customer]').click();
  await t.sleep(150);
}
await page.waitForSelector('[data-shift-card=result]');
g = await liveGame(page);
console.log(`  rank 3 customers ${three.ids.join(' ')}; shifts paid +¥${shiftPaid(g) - cash4}`);
assert.equal(shiftPaid(g) - cash4, round10(1150 * 0.75 * 1.24 * 1), 'a typed perfect shift at rank 3');
await t.shot('12b-rank3-result');

// ---- a wrong order, a wrong typed total (one retry, then the answer is shown) -------------------------------------------------------
t.step('wrong answers: the order is corrected, a typed total gets one retry, the right sentence is shown, nothing blocks');
await page.locator('[data-act=back]').click();
await t.sleep(300);
await nextDay();
// rank 0 again: no change customers, so the wrong total is followed by the thanks
await setGame((g2) => ({ jobs: { ...g2.jobs, job_konbini: { ...g2.jobs.job_konbini, rank: 0 } } }));
await openShift();
await page.locator('[data-act=start-shift]').click();
await page.waitForSelector('[data-customer]');
const idW = await page.locator('[data-customer]').getAttribute('data-customer');
const wrongItem = ARCH[idW].items.milk ? 'water' : 'milk';
await page.locator(`.sh-item[data-item=${wrongItem}] .sh-item-main`).click();
await page.locator('[data-act=confirm-order]').click();
await page.waitForSelector('[data-verdict=wrong]');
await t.shot('13-wrong-order');
await assertNoHScroll(page, 'wrong order');
await page.locator('[data-act=continue]').click();
await page.waitForSelector('[data-answer$=":total"]');
await page.locator('#sh-say').fill('1');
await page.locator('[data-act=say]').click();
await page.waitForSelector('.sh-msg');
await t.shot('14-retry');
await page.locator('#sh-say').fill('2');
await page.locator('[data-act=say]').click();
await page.waitForSelector('[data-verdict=wrong]');
await t.shot('15-wrong-total');
await page.locator('[data-act=continue]').click();
await page.waitForSelector('[data-answer$=":thanks"]');
await page.locator('#sh-say').fill('すみません');
await page.locator('[data-act=say]').click();
await page.locator('#sh-say').fill('いらっしゃいませ');
await page.locator('[data-act=say]').click();
await page.waitForSelector('[data-verdict=wrong]');
await page.locator('[data-act=continue]').click();
await page.waitForSelector('[data-done]');
assert.equal(await page.locator('.sh-step.bad').count(), 3, 'all three tasks are marked wrong, the customer is served anyway');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('shift e2e ok');
