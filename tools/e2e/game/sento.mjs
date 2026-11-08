// 銭湯「桜の湯」 (the public bath) in the REAL UI at 360 px, English or Arabic (--ar):
//   a fresh profile -> Chapter 2 -> Genzō at the bath's door -> typed: 大人一人お願いします, タオルを借りたいです, かけ湯って何ですか (he explains),
//   はい、わかりました, カードは使えますか (cash only: nothing charged), 現金でお願いします: exactly ¥650 (the bath and the towel) -> the street: the
//   bath sheet is up; a step out of order shakes, then かけ湯 → 洗う → つかる → 出る, さっぱり！ -> "Talk to Genzō" starts the talk after the bath,
//   typed: いいお湯でした, コーヒー牛乳をください, はい、どうぞ: exactly ¥150 -> both culture cards collected (cc_sento, cc_yuagari); talking to
//   Genzō again lists both options. After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/sento.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('sento', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const DEBUG = !!process.env.DEBUG;
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};

async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
}

/** Clears story beats, culture cards and word sheets that come up over the street. */
async function settle() {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.cul-scrim').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if ((await screen()) === 'beat') {
      await page.evaluate(() => {
        const ui = window.__lw.useUi.getState();
        for (const id of [...ui.beats]) window.__lw.dispatch({ t: 'beat_done', id });
        ui.clearRequests();
        if (!window.__lw.getGame().dream?.id) window.__lw.dispatch({ t: 'dream_chosen', id: 'travel' });
        window.__lw.useStore.getState().go('world');
      });
    } else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

async function nearGenzo() {
  await go('world');
  await page.evaluate(() => window.__world.teleportNear('nanami'));
  await t.sleep(500);
  await page.evaluate(() => window.__world.teleportNear('genzo'));
  await page.waitForFunction(() => window.__world.nearby === 'genzo', null, { timeout: 20000 });
  await t.sleep(700);
}

async function openConvo() {
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link, .prep-link').first().click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
}

const lineAfter = async (n) => {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
};

/** Plays the conversation: `{ type }` lines typed in order; `end` waits for the done card. */
async function drive(plan, end = true) {
  for (const want of plan) {
    await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    const lines = await page.locator('.msg.char').count();
    if (DEBUG) console.log(`   typing ${want.type}`);
    await page.fill('#say', want.type);
    await page.locator('.send').click();
    await Promise.race([lineAfter(lines), page.waitForSelector('.done-card', { timeout: 40000 })]);
  }
  if (end) await page.waitForSelector('.done-card', { timeout: 40000 });
}

/** The done card and the debrief, back to the street; culture cards on the way are closed (never the bath sheet: Escape would close it). */
async function debrief() {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(800);
  for (let i = 0; i < 6 && (await page.locator('.cul-scrim').count()); i++) {
    await page.locator('.cul-scrim .btn.primary').click();
    await t.sleep(300);
  }
}

// ---------------------------------------------------------------------------------------------------------------
await onboard(page, { arabic: AR });
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await dev('advance_chapter');
await settle();
assert.ok((await liveGame(page)).chapter.n >= 2, 'Chapter 2');
step('fresh profile -> Chapter 2');

// the bath's front, Genzō in the doorway
await nearGenzo();
await t.sleep(800);
await t.shot('front');
await check('the bath front');
step('the public bath: Genzō in the doorway');

// the bandai, typed: one adult, a rental towel, what kakeyu is, understood, the card (cash only), cash
const g0 = await liveGame(page);
await page.locator('.talk-btn').click();
await t.sleep(600);
if (await page.locator('[data-opt=genzo_desk]').count()) await page.locator('[data-opt=genzo_desk]').click();
await openConvo();
await drive([{ type: '大人一人お願いします。' }, { type: 'タオルを借りたいです。' }, { type: 'かけ湯って何ですか？' }, { type: 'はい、わかりました。' }, { type: 'カードは使えますか？' }], false);
let g = await liveGame(page);
assert.equal(g.totals.spent, g0.totals.spent, 'asking for the card charges nothing');
await drive([{ type: '現金でお願いします。' }]);
await t.shot('desk-done');
g = await liveGame(page);
assert.equal(g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned), 650, 'exactly ¥650: the bath and the towel');
step('the bandai, typed: 大人一人, the towel, かけ湯 explained, the card refused, cash: ¥650');

// the street: the bath sheet
await debrief();
await page.waitForSelector('[data-sento-bath][data-placed="0"]', { timeout: 10000 });
await t.shot('bath');
await page.locator('[data-sb-step=soak]').click();
await page.waitForSelector('.sb-step.wrong[data-sb-step=soak]', { timeout: 3000 });
assert.equal(await page.locator('[data-sento-bath]').getAttribute('data-placed'), '0', 'out of order places nothing');
for (const id of ['kakeyu', 'wash', 'soak', 'dry']) {
  await page.locator(`[data-sb-step=${id}]`).click();
  await page.waitForSelector(`[data-sb-step=${id}][data-placed="1"]`, { timeout: 3000 });
}
await page.waitForSelector('[data-sento-bath][data-placed="4"] [data-sb-after]', { timeout: 3000 });
await t.shot('bath-done');
await check('the bath sheet');
step('the bath sheet: a step out of order shakes; かけ湯 → 洗う → つかる → 出る, さっぱり！');

// after the bath: いいお湯でした, a coffee milk, cash
const g1 = await liveGame(page);
await page.locator('[data-sb-after]').click();
await openConvo();
await drive([{ type: 'いいお湯でした！' }, { type: 'コーヒー牛乳をください。' }, { type: 'はい、どうぞ。' }]);
await t.shot('after-done');
g = await liveGame(page);
assert.equal(g1.wallet.cash - g.wallet.cash + (g.totals.earned - g1.totals.earned), 150, 'exactly ¥150: the coffee milk');
await debrief();
await settle();
g = await liveGame(page);
assert.ok(g.culture.cc_sento, 'the bath manners card is collected');
assert.ok(g.culture.cc_yuagari, 'the いいお湯でした card is collected');
await check('after the bath');
step('after the bath, typed: いいお湯でした, コーヒー牛乳, cash: ¥150; both culture cards collected');

// Genzō again: both things to do are listed
await nearGenzo();
await page.locator('.talk-btn').click();
await page.waitForSelector('[data-opt=genzo_after]', { timeout: 10000 });
assert.equal(await page.locator('[data-opt=genzo_desk]').count(), 1, 'the bath is still offered');
await t.shot('options');
await page.keyboard.press('Escape');
await check('the options');
step('Genzō again: the bath and the after-bath milk are both offered');

await t.browser.close();
console.log(`sento e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
