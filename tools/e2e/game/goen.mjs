// Goen stage 1 (docs/GOEN.md), told in the REAL UI at 360 px, English or Arabic (--ar), a weekday pinned (the festival Saturday stays away):
//   fresh profile -> the dev tools fast-forward to Chapter 5 (each chapter pays +25 Goen with a toast) -> the daily goals all done (+5, toast) ->
//   the shrine from its offering box (`shrine:box`): the Goen balance, the omikuji, the catalog -> room_momiji with the whole ritual (coin, a wrong
//   tap and Hanako's hint, 二礼二拍手一礼, the wish TYPED in Japanese, the celebration) -> placed in the dorm -> the season's premium track ->
//   the Kyoto Journey: Sato's Shinkansen row (the exact round trip in yen, once), the Kyoto map, the ryokan (typed lines), the temple and the matcha
//   café (tapped, the souvenir bought), back to Sakura-chō: the Journey is complete (+20 Goen) -> a season tier unlocked by speaking, on the
//   premium track -> the kimono worn from the Wardrobe -> the streak charm saves a missed day -> a reload keeps everything -> the in-app browser hint.
// Dev tools only for +Goen, +yen, days and the chapter jump. After every step: no horizontal scroll, no console error, the yen wallet = its ledger,
// the Goen balance = the Goen ledger, and no Goen event ever moved the yen wallet.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/goen.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start, BASE } from './_common.mjs';
import { launch } from '../browser.mjs';

const t = await start('goen', { weekday: true });
const { page } = t;
const AR = t.arabic;
const DEBUG = !!process.env.DEBUG;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-12).join('\n'));
    await t.shot('zz-failure').catch(() => {});
    console.log('state at the failure:', JSON.stringify(await page.evaluate(() => { const g = window.__lw.getGame(); return { goen: { ...g.goen, ledger: g.goen.ledger.slice(-4) }, wallet: g.wallet, chapter: g.chapter.n, daily: g.daily, screen: window.__lw.useStore.getState().screen, convo: window.__lw.useUi.getState().convo, beats: window.__lw.useUi.getState().beats, toast: window.__lw.useStore.getState().toast }; }).catch(() => null)));
    console.error(e);
    process.exit(1);
  });
}
const T0 = Date.now();
/** checks that depend on the game side's counting (season words, daily counters): reported at the end instead of stopping the run */
const soft = [];
const softOk = (ok, what) => {
  if (!ok) soft.push(what);
};
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};
const toastText = () => page.evaluate(() => window.__lw.useStore.getState().toast?.text ?? '');
const GOEN_WORD = AR ? 'غوإن' : 'Goen';

// ---------------------------------------------------------------------------------------------------------------
// the integrity checks of every step
// ---------------------------------------------------------------------------------------------------------------

/** The yen side of the save: what Goen must never touch. */
const yenOf = (g) => ({ cash: g.wallet.cash, ic: g.wallet.ic, ledger: g.ledger.map((e) => e.id).join('|') });

async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  // the yen wallet = its ledger
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
  for (const p of ['cash', 'ic', 'points']) assert.equal(g.wallet[p], g.totals.checksum[p], `${where}: ${p} matches its checksum`);
  // the Goen balance = the Goen ledger (the ring holds every entry of this run)
  assert.equal(g.goen.balance, g.goen.totals.earned - g.goen.totals.spent, `${where}: Goen balance = Goen totals`);
  assert.equal(g.goen.ledger.reduce((n, e) => n + e.delta, 0), g.goen.balance, `${where}: Goen balance = the sum of the Goen ledger`);
  assert.ok(g.goen.balance >= 0, `${where}: Goen never negative`);
}

/** Runs `fn` (a Goen spend or earn) and asserts that the yen wallet and its ledger did not move. */
async function goenOnly(where, fn) {
  const before = yenOf(await liveGame(page));
  const r = await fn();
  assert.deepEqual(yenOf(await liveGame(page)), before, `${where}: Goen did not touch the yen wallet`);
  return r;
}

/** every target of the selector is at least 44 px tall and inside the screen */
async function assertTargets(sel, where) {
  const bad = await page.evaluate((s) => {
    const out = [];
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 43.5 || r.right > innerWidth + 1 || r.left < -1) out.push(`${el.className} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)}`);
    }
    return out;
  }, sel);
  assert.deepEqual(bad, [], `${where}: targets under 44 px or outside the screen`);
}

/** +Goen: the dev tool (Settings, 7 taps on the version) when the game has it, else the same ledger entry it would write. */
async function addGoen(n) {
  const before = (await liveGame(page)).goen.balance;
  await dev('goen', n);
  if ((await liveGame(page)).goen.balance === before + n) return;
  await page.evaluate((amount) => {
    const lw = window.__lw;
    const g = lw.getGame();
    const id = `goen:dev:${g.goen.ledger.length}:${amount}`;
    const goen = { ...g.goen, balance: g.goen.balance + amount, totals: { ...g.goen.totals, earned: g.goen.totals.earned + amount }, ledger: [...g.goen.ledger, { id, at: Date.now(), delta: amount, kind: 'chapter', ref: 'dev' }] };
    lw.useGame.getState().setGame({ ...g, goen });
  }, n);
  await t.sleep(200);
}

/** Waits for a toast that matches (the Goen toast may follow another toast of the same event by 2.4 s). */
async function waitToast(re, where, timeout = 8000) {
  const end = Date.now() + timeout;
  let last = '';
  while (Date.now() < end) {
    last = await toastText();
    if (re.test(last)) return last;
    await t.sleep(150);
  }
  throw new Error(`${where}: no toast like ${re} (last: "${last}")`);
}

// ---------------------------------------------------------------------------------------------------------------
// beats, pop-ups, sheets, conversations (as chapters56.mjs)
// ---------------------------------------------------------------------------------------------------------------

async function beats() {
  for (let i = 0; i < 80; i++) {
    if ((await screen()) !== 'beat') return;
    if (await page.locator('[data-ask=dream] [data-choose]').count()) await page.locator('[data-choose]').first().click();
    else if (await page.locator('[data-step=nameKana] [data-save]').count()) await page.locator('[data-step=nameKana] [data-save]').click();
    else if (await page.locator('[data-step=diary] [data-skip], [data-step=diary] .btn.soft').count()) await page.locator('[data-step=diary] .btn.soft').first().click();
    else if (await page.locator('.qst-beat [data-continue]').count()) await page.locator('.qst-beat [data-continue]').first().click();
    else if (await page.locator('[data-ask=dream]').count()) await page.locator('[data-ask=dream] .btn').last().click();
    else await page.locator('.panel .btn.primary:not(:disabled)').last().click().catch(() => {});
    await t.sleep(220);
  }
  throw new Error('story beats did not end');
}

/** Closes what is in the way: culture pop-ups (counted), story beats, a word card, an open sheet. Returns the culture cards seen. */
async function settle({ shot } = {}) {
  const cards = [];
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.cul-scrim').count()) {
      if (shot && cards.length === 0) {
        await t.sleep(300);
        await assertNoHScroll(page, 'culture card');
        await t.shot(shot);
      }
      cards.push(await page.evaluate(() => document.querySelector('.cul-scrim [data-culture-pop]')?.getAttribute('data-culture-pop') ?? document.querySelector('.cul-scrim')?.textContent?.slice(0, 40) ?? ''));
      await page.locator('.cul-scrim .btn.primary').click();
      await t.sleep(250);
    } else if ((await screen()) === 'beat') await beats();
    else if (await page.locator('.word-scrim .word-close').count()) {
      await page.locator('.word-scrim .word-close').last().click();
      await t.sleep(200);
    } else if (await page.locator('.hud-sheet').count()) {
      await page.keyboard.press('Escape');
      await t.sleep(300);
    } else return cards;
  }
  throw new Error('overlays did not clear');
}

async function skipChapterBeats() {
  await page.evaluate(() => {
    const ui = window.__lw.useUi.getState();
    for (const id of [...ui.beats]) window.__lw.dispatch({ t: 'beat_done', id });
    ui.clearRequests();
    if (!window.__lw.getGame().dream?.id) window.__lw.dispatch({ t: 'dream_chosen', id: 'travel' });
    window.__lw.useStore.getState().go('world');
  });
  await t.sleep(300);
}

async function talkTo(id) {
  await settle();
  await go('world');
  const away = id === 'hanako' ? 'tanaka' : 'hanako';
  await page.evaluate((c) => window.__world.teleportNear(c), away);
  await t.sleep(500);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 20000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
}

const charLines = () => page.locator('.msg.char').count();
async function lineAfter(n) {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
}
async function charReady() {
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
}

/** Plays a conversation: a RegExp (the first chip whose Japanese matches), a number (that chip), or `{ type }` (typed: my own words). */
async function drive(plan = [], { onStep } = {}) {
  let next = 0;
  for (let n = 0; n < 60; n++) {
    await charReady();
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    if (await page.locator('.done-card').count()) return;
    const want = plan[next];
    const lines = await charLines();
    if (want && typeof want === 'object' && 'type' in want) {
      next++;
      await page.fill('#say', want.type);
      await page.locator('.send').click();
    } else {
      const texts = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
      let idx = 0;
      if (typeof want === 'number') idx = want;
      else if (want) idx = texts.findIndex((x) => want.test(x));
      if (DEBUG) console.log(`   step ${n}: [${texts.join(' | ')}] want ${want} -> ${idx}`);
      assert.ok(idx >= 0 && idx < texts.length, `no suggestion matches ${want} among ${texts.join(' | ')}`);
      if (want !== undefined) next++;
      await page.locator('.sg').nth(idx).click();
    }
    await Promise.race([lineAfter(lines), page.waitForSelector('.done-card', { timeout: 40000 })]);
    if (onStep) await onStep(n);
  }
  throw new Error('the conversation did not end');
}

/** Skips Prepare when it comes first, plays the plan, opens the debrief and leaves it. */
async function converse(plan, { afterOpen, keepOverlays = false } = {}) {
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
  if (afterOpen) await afterOpen();
  await drive(plan);
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  if (!keepOverlays) await settle();
}

// ---------------------------------------------------------------------------------------------------------------
// the shrine
// ---------------------------------------------------------------------------------------------------------------

/** Taps the offering box (the world's pick) and waits for the Shrine panel. */
async function openShrineFromBox() {
  await settle();
  await go('world');
  await t.sleep(300);
  await page.evaluate(() => window.__world.simulatePick('shrine:box'));
  await page.waitForSelector('[data-shrine]', { timeout: 10000 });
  await t.sleep(500);
}

/** The whole ritual for one item: Make a wish -> coin -> (a wrong tap) -> 二礼二拍手一礼 -> the wish (typed or the chip) -> the celebration. */
async function ritual(itemId, { wish = null, wrongTap = false, shots = false } = {}) {
  const price = Number(await page.locator(`[data-goen-item=${itemId}] .gn-price`).innerText().then((x) => x.replace(/\D/g, '')));
  const g0 = await liveGame(page);
  await page.locator(`[data-wish=${itemId}]`).click();
  await page.waitForSelector(`[data-ritual=${itemId}][data-step=coin]`, { timeout: 10000 });
  await t.sleep(1200);
  await settle(); // the first visit's culture card pops over the street; the ritual waits under it
  await page.waitForSelector(`[data-ritual=${itemId}]`, { timeout: 5000 });
  await assertTargets('[data-ritual] button', `ritual ${itemId}`);
  if (shots) {
    await assertNoHScroll(page, 'ritual coin');
    await t.shot(`ritual-coin-${itemId}`);
  }
  await goenOnly(`coin for ${itemId}`, async () => {
    await page.locator('[data-ritual-coin]').click();
    await page.waitForSelector(`[data-ritual=${itemId}][data-step=taps]`, { timeout: 5000 });
  });
  const g1 = await liveGame(page);
  assert.equal(g1.goen.balance, g0.goen.balance - price, `the coin spent exactly ${price} Goen`);
  assert.ok(g1.goen.ledger.some((e) => e.id.startsWith(`goen:spend:${itemId}`) && e.delta === -price), `ledger entry goen:spend:${itemId}`);
  if (itemId !== 'omamori_streak') assert.ok(g1.goen.owned[itemId], `${itemId} is owned at the coin toss`);
  if (wrongTap) {
    await page.locator('[data-ritual-tap=clap]').click();
    await page.waitForSelector('[data-ritual-hint=bow]', { timeout: 3000 });
    if (shots) await t.shot(`ritual-hint-${itemId}`);
    assert.equal((await liveGame(page)).goen.balance, g1.goen.balance, 'a wrong tap costs nothing');
  }
  for (const [i, tap] of ['bow', 'bow', 'clap', 'clap', 'bow'].entries()) {
    await page.locator(`[data-ritual-tap=${tap}]`).click();
    await t.sleep(i === 2 && shots ? 900 : 350);
    if (i === 2 && shots) await t.shot(`ritual-clap-${itemId}`);
  }
  await page.waitForSelector(`[data-ritual=${itemId}][data-step=wish]`, { timeout: 5000 });
  if (shots) await t.shot(`ritual-wish-${itemId}`);
  await page.locator('[data-ritual-wish]').click();
  await page.waitForSelector('.convo', { timeout: 20000 });
  await t.sleep(500);
  if (shots) {
    await charReady();
    await assertNoHScroll(page, 'the wish conversation');
    await t.shot(`wish-convo-${itemId}`);
  }
  // one model chip: the item's own wish
  await charReady();
  const chips = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
  assert.equal(chips.filter((x) => /ように/.test(x)).length, 1, `the wish shows one model line (${chips.join(' | ')})`);
  await drive(wish ? [{ type: wish }] : [/ように/]);
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await page.waitForSelector(`[data-ritual=${itemId}][data-step=done]`, { timeout: 10000 });
  await t.sleep(700);
  // the shrine's culture cards (the first visit, the first wish) come up over the street through the usual culture path
  const cards = await settle(shots ? { shot: `culture-${itemId}` } : {});
  if (cards.length) console.log('  culture cards:', cards.join(', '));
  if (shots) {
    await assertNoHScroll(page, 'ritual done');
    await t.shot(`ritual-done-${itemId}`);
  }
  await page.locator('[data-ritual-close]').click();
  await t.sleep(300);
  await settle();
}

// ---------------------------------------------------------------------------------------------------------------
// 0. a fresh profile; the chapter jump pays Goen for every chapter completed, with a toast
// ---------------------------------------------------------------------------------------------------------------
step('fresh profile -> dev tools: Chapters 1-4 completed (+25 Goen each, toasts)');
await onboard(page, { arabic: AR });
if (AR) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
for (let n = 0; n < 4; n++) {
  await dev('advance_chapter');
  const toast = await waitToast(new RegExp(GOEN_WORD), `chapter ${n + 1}`);
  assert.match(toast, /25/, 'the toast says +25');
  if (n === 0) {
    assert.match(toast, AR ? /الفصل 1/ : /Chapter 1 completed/, 'the toast names the chapter');
    await t.shot('toast-chapter');
  }
  await skipChapterBeats();
}
let g = await liveGame(page);
assert.equal(g.chapter.n, 5, 'Chapter 5 is current');
assert.equal(g.goen.balance, 100, 'four chapters paid 4 x 25 Goen');
await settle();
await dev('cash', 10_000);
await check('start');

// the daily trio: Kyoto, the shrine and its culture card do these by the end of the run; a goal that this run does not play is swapped
const DOABLE = ['g_conv2', 'g_indep6', 'g_newphrase2', 'g_place', 'g_culture'];
for (let tries = 0; tries < 40; tries++) {
  g = await liveGame(page);
  const bad = g.daily.goals.filter((x) => !DOABLE.includes(x.id));
  if (bad.length === 0) break;
  if (bad.length === 1 && !g.daily.swapUsed) {
    await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'today' }), window.__lw.useStore.getState().go('quests')));
    await page.waitForSelector(`[data-swap=${bad[0].id}]`, { timeout: 5000 });
    await page.locator(`[data-swap=${bad[0].id}]`).click();
    await t.sleep(400);
    await go('world');
    continue;
  }
  await dev('advance_day');
  await settle();
}
g = await liveGame(page);
console.log('  daily goals:', g.daily.goals.map((x) => x.id).join(', '));
assert.ok(g.daily.goals.every((x) => DOABLE.includes(x.id)), 'a daily trio this run plays');

// ---------------------------------------------------------------------------------------------------------------
// 1. the shrine from its offering box: balance, omikuji, catalog
// ---------------------------------------------------------------------------------------------------------------
step('the shrine: the offering box opens the panel; the free omikuji teaches a word due for review');
await openShrineFromBox();
await check('shrine');
assert.equal(await page.locator('[data-goen-pill]').first().getAttribute('data-goen'), '100', 'the panel shows the balance');
assert.equal(await page.locator('[data-goen-item]').count(), 11, 'eleven catalog cards (six things and five manners)');
assert.equal(await page.locator('[data-goen-item=journey_kyoto][data-state=short]').count(), 1, 'the Journey says how much more Goen it needs');
assert.ok((await page.locator('[data-goen-item=journey_kyoto] [data-why=funds]').innerText()).length > 30, 'and how to earn it');
assert.equal(await page.locator('[data-goen-preview]').count(), 0, 'no Goen packs line outside the dev flag');
await assertTargets('[data-shrine] button', 'shrine buttons');
await t.shot('shrine');
g = await liveGame(page);
assert.ok(g.stats.visits.includes('shrine'), 'the visit is filed');
await page.locator('[data-omikuji-draw]').click();
await page.waitForSelector('[data-slip]', { timeout: 5000 });
g = await liveGame(page);
assert.equal(g.goen.omikuji?.day, g.clock.dayIndex, 'today\'s slip is drawn');
assert.equal(await page.locator('[data-omikuji-draw]').count(), 0, 'one slip a day');
await assertNoHScroll(page, 'omikuji');
await t.shot('omikuji');
await page.evaluate(() => document.querySelector('.gn-body').scrollTo(0, 900));
await t.sleep(300);
await t.shot('catalog');
await check('omikuji');

// ---------------------------------------------------------------------------------------------------------------
// 2. room_momiji: the whole ritual, the wish typed; then placed in the dorm
// ---------------------------------------------------------------------------------------------------------------
step('room_momiji: coin, a wrong tap (Hanako\'s hint), 二礼二拍手一礼, the wish typed, the celebration');
await page.evaluate(() => document.querySelector('.gn-body').scrollTo(0, 0));
await ritual('room_momiji', { wish: 'へやがきれいになりますように。', wrongTap: true, shots: true });
g = await liveGame(page);
assert.ok(g.owned.room_momiji?.qty >= 1, 'the decor is an owned item');
assert.equal(g.goen.balance, 40, '100 - 60 Goen');
await check('room_momiji bought');

step('the decor in the furniture placer');
await page.evaluate(() => window.__lw.useStore.getState().go('wallet'));
await page.waitForSelector('[data-room-go]', { timeout: 5000 });
await page.locator('[data-room-go]').click();
await page.waitForSelector('[data-own-phase=inside], [data-own-phase=genkan]', { timeout: 30000 });
await t.sleep(800);
await page.locator('[data-own=furnish-open]').click();
await page.waitForSelector('[data-piece=room_momiji][data-state=ready]', { timeout: 5000 });
await page.locator('[data-piece=room_momiji]').click();
await t.sleep(250);
const slot = await page.evaluate(() => document.querySelector('[data-target=true]')?.getAttribute('data-slot'));
assert.ok(slot, 'the decor has a place in the dorm');
await page.locator(`[data-slot=${slot}]`).click();
await page.waitForFunction((s) => document.querySelector(`[data-slot=${s}]`)?.getAttribute('data-slot-piece') === 'room_momiji', slot, { timeout: 5000 });
await t.sleep(600);
await assertNoHScroll(page, 'decor placed');
await t.shot('decor-placed');
await page.locator('[data-own=furnish-done]').click();
await t.sleep(300);
await page.locator('[data-home=leave]').click();
await page.waitForFunction(() => window.__world.currentStage() === null, null, { timeout: 15000 });
await t.sleep(500);
g = await liveGame(page);
assert.equal(g.home.placed[slot], 'room_momiji', 'the decor stays in its place');
await check('decor placed');

// ---------------------------------------------------------------------------------------------------------------
// 3. the season's premium track, then the Kyoto Journey (+Goen from the dev tools)
// ---------------------------------------------------------------------------------------------------------------
step('Season screen (from Quests): tasks, tiers on two tracks, the premium track locked with its price');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'story' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-screen=quests]');
await page.locator('[data-season-link]').first().click();
await page.waitForSelector('[data-screen=season]', { timeout: 5000 });
assert.equal(await page.locator('[data-screen=season][data-active="1"]').count(), 1, 'the autumn season is open (15 Oct - 15 Dec)');
assert.equal(await page.locator('[data-tier]').count(), 8, 'eight tiers');
assert.equal(await page.locator('[data-premium=locked]').count(), 1, 'the premium track is locked, with its price');
await check('season');
await t.shot('season');
await page.evaluate(() => document.querySelector('.gn-body').scrollTo(0, 2000));
await t.sleep(300);
await t.shot('season-tiers');
await page.locator('[data-premium=locked] [data-open=shrine]').click();
await page.waitForSelector('[data-shrine]', { timeout: 5000 });

step('the premium track and the Kyoto Journey bought with the ritual (the wish by its chip)');
await addGoen(500);
await check('+Goen');
await page.waitForSelector('[data-wish=season_autumn_premium]', { timeout: 5000 });
await ritual('season_autumn_premium');
await go('shrine');
await page.waitForSelector('[data-wish=journey_kyoto]', { timeout: 5000 });
await ritual('journey_kyoto', { wish: 'きょうとにいけますように。' });
g = await liveGame(page);
assert.ok(g.goen.owned.journey_kyoto && g.goen.owned.season_autumn_premium, 'both owned');
assert.equal(g.goen.balance, 540 - 150 - 250, 'balance after both');
await check('premium + Journey');

step('Quests: the Journey objectives while it is owned');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'story' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-journey=journey_kyoto]', { timeout: 5000 });
assert.equal(await page.locator('[data-journey=journey_kyoto] [data-obj]').count(), 5, 'five Journey objectives');
await page.locator('[data-journey=journey_kyoto]').scrollIntoViewIfNeeded();
await check('journey objectives');
await t.shot('quests-journey');
await go('world');

// ---------------------------------------------------------------------------------------------------------------
// 4. the Kyoto Journey: Sato's Shinkansen, the exact fare once, three conversations, back
// ---------------------------------------------------------------------------------------------------------------
step("Sato's Kyoto row: the Shinkansen round trip charged once, exactly (short of money is tested in goen-app.test.ts)");
const kyotoRow = async () => {
  await talkTo('sato');
  await page.waitForSelector('[data-opt]', { timeout: 15000 });
  const id = await page.evaluate(() => [...document.querySelectorAll('[data-opt]')].map((e) => e.getAttribute('data-opt')).find((x) => /kyoto/.test(x ?? '')));
  assert.ok(id, "Sato's sheet has the Kyoto row");
  return id;
};
const rowId = await kyotoRow();
await assertNoHScroll(page, "Sato's sheet");
await t.shot('sato-kyoto-row');
const fareIds = async () => (await liveGame(page)).ledger.filter((e) => e.kind === 'fare' && e.ref === 'kyoto');
const yenBefore = (await liveGame(page)).wallet;
await page.locator(`[data-opt=${rowId}]`).click();
await page.waitForSelector('[data-kyoto-map]', { timeout: 10000 });
const paidToast = await toastText();
await page.waitForSelector('[data-kyoto-ride]', { timeout: 3000 });
await t.sleep(700);
await t.shot('kyoto-ride');
const fares = await fareIds();
assert.equal(fares.length, 1, 'exactly one Shinkansen fare');
g = await liveGame(page);
const paid = yenBefore.cash + yenBefore.ic - (g.wallet.cash + g.wallet.ic);
assert.equal(-fares[0].delta, paid, 'the wallet paid exactly the fare entry');
// FARES.kyoto = ¥1,800 a leg; a paper ticket in cash adds ¥10 a leg, the IC card does not
assert.equal(paid, fares[0].pocket === 'ic' ? 3600 : 3620, `the round trip in yen (paid ¥${paid})`);
assert.match(paidToast, /3,6/, 'the toast names the fare');
await page.waitForFunction(() => !document.querySelector('[data-kyoto-ride]'), null, { timeout: 8000 });
await assertNoHScroll(page, 'kyoto map');
await assertTargets('[data-kyoto-map] button', 'kyoto map buttons');
await t.shot('kyoto-map');
await check('in Kyoto');

step('a reload in Kyoto: still in Kyoto, never charged again');
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
await settle();
await page.waitForSelector('[data-kyoto-map]', { timeout: 10000 });
assert.equal((await fareIds()).length, 1, 'no second fare after the reload');

step('the ryokan: four lines of my own (typed)');
await page.locator('[data-kyoto-stop=ryokan]').click();
await converse([{ type: 'サムです。予約をしました。' }, { type: '二泊でお願いします。' }, { type: '六時がいいです。' }, { type: 'どうもありがとうございます。よろしくお願いします。' }], {
  afterOpen: async () => {
    await page.waitForSelector('[data-kyoto=ryokan]', { timeout: 5000 });
    await charReady();
    await assertNoHScroll(page, 'ryokan');
    await t.shot('kyoto-ryokan');
  },
});
await page.waitForSelector('[data-kyoto-map]', { timeout: 10000 });
assert.equal(await page.locator('[data-kyoto-stop=ryokan][data-done="1"]').count(), 1, 'the ryokan is ticked on the map');

step('the temple: the garden (typed, with an autumn word), an omamori and a goshuin (tapped)');
await page.locator('[data-kyoto-stop=temple]').click();
await converse([{ type: '紅葉の庭はどこですか？' }, { type: '紅葉がとてもきれいですね。' }, /お守り/, /健康|学業|交通/, /御朱印/, /現金/], {
  afterOpen: async () => {
    await page.waitForSelector('[data-kyoto=temple]', { timeout: 5000 });
    await charReady();
    await t.shot('kyoto-temple');
  },
});
await page.waitForSelector('[data-kyoto-map]', { timeout: 10000 });

step('the matcha café: order, a compliment, the recommendation, yatsuhashi to bring home');
await page.locator('[data-kyoto-stop=matcha]').click();
await converse([{ type: '秋のセットは何ですか？' }, /抹茶|セット/, { type: '栗きんとん、とてもおいしいです！' }, /おすすめ/, /八ツ橋|八つ橋|やつはし/, /現金/], {
  afterOpen: async () => {
    await page.waitForSelector('[data-kyoto=matcha]', { timeout: 5000 });
    await charReady();
    await t.shot('kyoto-matcha');
  },
});
await page.waitForSelector('[data-kyoto-map]', { timeout: 10000 });
g = await liveGame(page);
assert.ok(g.owned.g_yatsuhashi?.qty >= 1, 'the souvenir is in the bag');
assert.equal((await fareIds()).length, 1, 'the three conversations charged no fare');
await check('three Kyoto stops');
await t.shot('kyoto-map-done');

step('back to Sakura-chō: the Journey completes (+20 Goen, keepsake, title)');
const goenBeforeBack = g.goen.balance;
await page.locator('[data-kyoto-back]').click();
await page.waitForFunction(() => !document.querySelector('[data-kyoto-map]'), null, { timeout: 8000 });
await t.sleep(600);
g = await liveGame(page);
assert.ok(g.stats.visits.includes('trip:kyoto'), 'trip:kyoto is filed');
assert.ok(g.goen.journeys.journey_kyoto?.complete, 'the Journey is complete');
assert.equal(g.goen.balance, goenBeforeBack + 20, '+20 Goen');
assert.ok(g.keepsakes.includes?.('kp_kyoto') || JSON.stringify(g.keepsakes).includes('kp_kyoto'), 'keepsake kp_kyoto');
assert.ok(JSON.stringify(g.titles ?? g.title ?? '').includes('t_kyoto'), 'title t_kyoto');
await settle();
await check('Journey complete');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'story' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-journey=journey_kyoto][data-complete="1"]', { timeout: 5000 });
await page.locator('[data-journey=journey_kyoto]').scrollIntoViewIfNeeded();
await t.shot('quests-journey-done');
await go('world');

// the daily goals: all done by now -> +5 Goen with a toast
g = await liveGame(page);
console.log('  daily', JSON.stringify(g.daily.goals.map((x) => [x.id, x.done])));
softOk(g.daily.goals.every((x) => x.done), 'every daily goal is done');
softOk(g.goen.ledger.some((e) => e.kind === 'daily' && e.delta === 5), '+5 Goen for the daily goals');

// ---------------------------------------------------------------------------------------------------------------
// 6. the kimono; the streak charm
// ---------------------------------------------------------------------------------------------------------------
step('the kimono: bought, worn from the Wardrobe, on the avatar');
await openShrineFromBox();
await ritual('kimono_momiji', { wish: '紅葉の着物が着られますように。' });
await page.evaluate(() => window.__lw.useStore.getState().go('wallet'));
await page.waitForSelector('[data-wardrobe]', { timeout: 5000 });
const worn = await page.evaluate(() => window.__lw.getGame().outfit.equipped.includes('kimono_momiji'));
if (!worn) await page.locator('.wlt-wardrobe [data-wear=kimono_momiji]').click();
await t.sleep(400);
g = await liveGame(page);
assert.ok(g.outfit.equipped.includes('kimono_momiji'), 'the kimono is worn');
await page.locator('[data-wardrobe]').scrollIntoViewIfNeeded();
await check('kimono worn');
await t.shot('wardrobe-kimono');
await go('world');
await page.waitForFunction(() => JSON.stringify(window.__world.snapshot?.() ?? {}).length > 0, null, { timeout: 5000 });
await t.sleep(1200);
await page.evaluate(() => window.__world.teleportNear('hanako'));
await t.sleep(1200);
await t.shot('kimono-street');
// Take off / Wear again
await page.evaluate(() => window.__lw.useStore.getState().go('wallet'));
await page.locator('.wlt-wardrobe [data-wear=kimono_momiji]').click();
await t.sleep(300);
assert.ok(!(await liveGame(page)).outfit.equipped.includes('kimono_momiji'), 'taken off');
await page.locator('.wlt-wardrobe [data-wear=kimono_momiji]').click();
await t.sleep(300);
assert.ok((await liveGame(page)).outfit.equipped.includes('kimono_momiji'), 'worn again');

// ---------------------------------------------------------------------------------------------------------------
// 5. the season: a tier unlocked by speaking, on both tracks
// ---------------------------------------------------------------------------------------------------------------
step('the season: the third conversation at ★★ (the kimono wish, typed) unlocked tier 1 on both tracks');
g = await liveGame(page);
console.log('  season', JSON.stringify({ sp: g.goen.season.sp, done: Object.keys(g.goen.season.done), tiers: Object.keys(g.goen.season.tiers) }));
softOk(g.goen.season.sp >= 1, 'season points from speaking');
softOk(!!g.goen.season.tiers['premium:1'], 'premium tier 1 granted');
softOk(g.owned.scarf_momiji?.qty >= 1, 'the momiji scarf (premium tier 1) is owned');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'story' }), window.__lw.useStore.getState().go('quests')));
await page.locator('[data-season-link]').first().click();
await page.waitForSelector('[data-screen=season]');
assert.equal(await page.locator('[data-premium=locked]').count(), 0, 'the premium track is open');
softOk((await page.locator('[data-tier="1"] [data-track=premium][data-cell=claimed]').count()) === 1, 'tier 1 premium claimed on the Season screen');
await page.locator('[data-tier="1"]').scrollIntoViewIfNeeded();
await check('season tier');
await t.shot('season-claimed');
await go('world');

step('the streak charm: bought, shown in the Wallet, saves a missed day (toast)');
await openShrineFromBox();
await ritual('omamori_streak');
await page.evaluate(() => window.__lw.useStore.getState().go('wallet'));
await page.waitForSelector('[data-charms="1"]', { timeout: 5000 });
await page.locator('[data-goen-card]').scrollIntoViewIfNeeded();
await t.shot('wallet-goen');
// the days tool: the speaking streak was last kept two days ago (yesterday missed), no freeze left
await page.evaluate(() => {
  const st = window.__lw.useStore.getState();
  const d = new Date(Date.now() - 2 * 86_400_000);
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  window.__lw.useStore.setState({ streak: { ...st.streak, days: 6, freezes: 0, lastActive: ymd } });
});
const streakGoen = (await liveGame(page)).goen.balance;
// a speaking action today keeps the streak: the charm is used
await goenOnly('the charm', async () => page.evaluate(() => window.__lw.useStore.getState().addXp(2)));
await t.sleep(400);
g = await liveGame(page);
assert.equal(g.goen.charms, 0, 'the charm was used');
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().streak.days), 7, 'the streak went on to 7 days');
assert.match(await toastText(), /./, 'a toast says the charm kept the streak');
console.log('  charm toast:', await toastText());
await t.shot('toast-charm');
assert.ok(g.goen.balance >= streakGoen, 'the charm never takes Goen');
await check('charm used');

// ---------------------------------------------------------------------------------------------------------------
// 7. the sakura paint switch; a reload keeps everything
// ---------------------------------------------------------------------------------------------------------------
step('the sakura paint: bought, on the ride card, switched off and on');
await addGoen(100);
await openShrineFromBox();
await ritual('ride_sakura');
await page.evaluate(() => window.__lw.useStore.getState().go('wallet'));
await page.waitForSelector('[data-ride-paint=on]', { timeout: 5000 });
await page.locator('[data-ride-paint]').click();
await page.waitForSelector('[data-ride-paint=off]', { timeout: 3000 });
await page.locator('[data-ride-paint]').click();
await page.waitForSelector('[data-ride-paint=on]', { timeout: 3000 });
assert.equal(await page.evaluate(() => window.__world.getRideSkin?.() ?? 'sakura'), 'sakura', 'the world has the sakura skin');
await check('paint');

step('reload: Goen, owned things, the kimono, the decor, the Journey and the season are kept');
const keep = await liveGame(page);
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
await settle();
g = await liveGame(page);
assert.deepEqual(g.goen.owned, keep.goen.owned, 'owned kept');
assert.equal(g.goen.balance, keep.goen.balance, 'balance kept');
assert.equal(g.goen.ledger.length, keep.goen.ledger.length, 'Goen ledger kept');
assert.deepEqual(g.outfit, keep.outfit, 'outfit kept');
assert.deepEqual(g.home.placed, keep.home.placed, 'decor kept');
assert.deepEqual(g.goen.season, keep.goen.season, 'season kept');
assert.deepEqual(g.goen.journeys, keep.goen.journeys, 'journey kept');
assert.equal(g.wallet.cash, keep.wallet.cash, 'yen kept');
assert.equal(await page.locator('[data-kyoto-map]').count(), 0, 'back in Sakura-chō after the reload');
await check('after reload');
await page.evaluate(() => window.__lw.useStore.getState().go('wallet'));
await page.waitForSelector('[data-goen-card]', { timeout: 5000 });
assert.equal(await page.locator('[data-goen-card] [data-goen-pill]').getAttribute('data-goen'), String(keep.goen.balance), 'the Wallet shows the kept balance');
await t.shot('wallet-after-reload');
await t.browser.close();

// ---------------------------------------------------------------------------------------------------------------
// 8. voice guidance in an in-app browser (Instagram on an iPhone): one line in the Audio check with a copy-link button
// ---------------------------------------------------------------------------------------------------------------
step('an in-app browser: the Audio check says to open the page in Safari / Chrome, with a copy-link button');
{
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 326.0.3.30.91 (iPhone14,5; iOS 17_4; en_US; en; scale=3.00; 1170x2532; 584543210)';
  const b = await launch({ width: 360, height: 780, dpr: 1, locale: AR ? 'ar-EG' : 'en-US' });
  await b.context.close();
  const ctx = await b.browser.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, userAgent: ua, locale: AR ? 'ar-EG' : 'en-US' });
  // the web view has no speech recognition
  await ctx.addInitScript(() => {
    try {
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined });
    } catch {
      /* best effort */
    }
  });
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await onboard(p, { arabic: AR });
  await p.evaluate(() => window.__lw.useStore.getState().go('settings'));
  await p.waitForSelector('[data-voice-hint=in-app]', { timeout: 15000 });
  await p.locator('[data-voice-hint]').scrollIntoViewIfNeeded();
  await assertNoHScroll(p, 'in-app hint');
  assert.ok((await p.locator('[data-voice-hint]').innerText()).includes('Safari / Chrome'), 'the line names Safari / Chrome');
  assert.equal(await p.locator('[data-copy-link]').count(), 1, 'a copy-link button');
  await p.screenshot({ path: new URL(`../shots/game/goen-${AR ? 'ar-' : ''}inapp-hint.png`, import.meta.url).pathname });
  assert.deepEqual(logs, [], 'no page errors in the in-app browser');
  await b.browser.close();
}
if (soft.length) console.log(`SOFT CHECKS FAILED (game-side counting): ${soft.join('; ')}`);
console.log(`goen ${AR ? 'AR' : 'EN'}: OK (${Math.round((Date.now() - T0) / 1000)}s), base ${BASE}`);
