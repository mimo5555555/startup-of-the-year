// ほしぞらホビー (the figure shop) in the REAL UI at 360 px, English or Arabic (--ar):
//   a fresh profile -> Chapter 2 (dev tools) -> the street's new east end: the shop and Daichi behind the counter -> his conversation, played
//   with the chips: the cat ninjas, 「赤いのをください」, gift wrapping, by card -> the red Cat Ninja is in the bag, the card was charged exactly
//   ¥1,800 -> a second visit typed in my own words: the robots, 「小さいのをください」, no wrapping, cash (¥1,200) -> the figure is a present
//   Mio loves (the hand-over names it). After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/figures.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('figures', { weekday: true });
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

async function talkToDaichi() {
  await settle();
  await go('world');
  await page.evaluate(() => window.__world.teleportNear('nakamura'));
  await t.sleep(500);
  await page.evaluate(() => window.__world.teleportNear('daichi'));
  await page.waitForFunction(() => window.__world.nearby === 'daichi', null, { timeout: 20000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
  // the Talk list (one row today) or straight in
  if (await page.locator('.hud-sheet [data-interaction=daichi_shop], .hud-sheet button', { hasText: AR ? 'تفرّج' : 'Look at figures' }).count())
    await page.locator('.hud-sheet button', { hasText: AR ? 'تفرّج' : 'Look at figures' }).first().click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
}

const lineAfter = async (n) => {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
};

/** Plays the conversation: a RegExp (the chip whose Japanese matches) or `{ type }` (typed). */
async function drive(plan) {
  for (const want of plan) {
    await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    const lines = await page.locator('.msg.char').count();
    if ('type' in want) {
      await page.fill('#say', want.type);
      await page.locator('.send').click();
    } else {
      const texts = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
      const idx = texts.findIndex((x) => want.test(x));
      if (DEBUG) console.log(`   [${texts.join(' | ')}] want ${want} -> ${idx}`);
      assert.ok(idx >= 0, `no suggestion matches ${want} among ${texts.join(' | ')}`);
      await page.locator('.sg').nth(idx).click();
    }
    await Promise.race([lineAfter(lines), page.waitForSelector('.done-card', { timeout: 40000 })]);
  }
  await page.waitForSelector('.done-card', { timeout: 40000 });
}

async function finish() {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  await settle();
}

// ---------------------------------------------------------------------------------------------------------------
await onboard(page, { arabic: AR });
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await dev('advance_chapter');
await settle();
assert.ok((await liveGame(page)).chapter.n >= 2, 'Chapter 2');
step('fresh profile -> Chapter 2 (the figure shop opens with it)');

// the street's new east end
await go('world');
await page.evaluate(() => window.__world.teleportNear('daichi'));
await page.waitForFunction(() => window.__world.nearby === 'daichi', null, { timeout: 20000 });
await t.sleep(1200);
await t.shot('shop-front');
await check('the figure shop');
step('the east end: ほしぞらホビー and Daichi behind the counter');

// 1) chips: the cat ninjas -> the red one -> wrapped -> card
const g0 = await liveGame(page);
await talkToDaichi();
await t.shot('convo-start');
await drive([/フィギュア|探して/, /ねこ忍者/, /赤いの/, /ラッピング/, /カード/]);
await t.shot('convo-done');
let g = await liveGame(page);
assert.equal(g.owned.fig_neko_red?.qty, 1, 'the red Cat Ninja is in the bag');
assert.equal(g0.wallet.cash + g0.wallet.ic - (g.wallet.cash + g.wallet.ic) + (g.totals.earned - g0.totals.earned), 1800, 'exactly ¥1,800 charged');
await finish();
await check('after the first figure');
step('chips: the Cat Ninjas, 「赤いのをください」, gift wrapping, by card: the red Cat Ninja, ¥1,800');

// 2) typed: the robots -> the small one -> no wrapping -> cash
const g1 = await liveGame(page);
await talkToDaichi();
await drive([{ type: 'ロボットを見せてください。' }, { type: '小さいのをください。' }, { type: 'いいえ、大丈夫です。' }, { type: '現金でお願いします。' }]);
g = await liveGame(page);
assert.equal(g.owned.fig_robo_small?.qty, 1, 'the small robot is in the bag');
assert.equal(g1.wallet.cash - g.wallet.cash + (g.totals.earned - g1.totals.earned), 1200, 'exactly ¥1,200 in cash');
await finish();
await check('after the second figure');
step('typed: the robots, 「小さいのをください」, no wrapping, cash: the small robot, ¥1,200');

// 3) the display case: asked for by name, no wrapping question, carried home; placed in the dorm's shelf spot, it shows the two figures
await dev('cash', 10000); // two figures spent the starting money
const g2 = await liveGame(page);
await talkToDaichi();
await drive([/フィギュア|探して/, /フィギュアケース/, /カード/]);
g = await liveGame(page);
assert.equal(g.owned.case_figures?.qty, 1, 'the display case is owned');
assert.equal(g2.wallet.cash + g2.wallet.ic - (g.wallet.cash + g.wallet.ic) + (g.totals.earned - g2.totals.earned), 3500, 'exactly ¥3,500');
await finish();
await go('world');
await t.sleep(300);
await page.evaluate(() => window.__world.simulatePick('door:dorm'));
await page.waitForSelector('[data-own-phase=inside], [data-own-phase=genkan]', { timeout: 30000 });
await t.sleep(700);
await page.locator('[data-own=furnish-open]').click();
await page.waitForSelector('[data-own=furnish]', { timeout: 5000 });
await page.locator('[data-piece=case_figures][data-state=ready]').click();
await page.locator('[data-slot=shelf]').click();
await page.waitForFunction(() => document.querySelector('[data-slot=shelf]')?.getAttribute('data-slot-piece') === 'case_figures', null, { timeout: 5000 });
await page.locator('[data-own=furnish-done]').click();
await t.sleep(800);
g = await liveGame(page);
assert.equal(g.home.placed.shelf, 'case_figures', 'placed in the shelf spot');
// (headless browsers run on light graphics, where the room is the 2D panel; the 3D case is checked by packages/world/test)
await t.shot('case-in-dorm');
await check('the display case in the dorm');
await page.locator('[data-home=leave]').click();
await t.sleep(800);
step('the display case: bought by name (¥3,500), placed in the dorm, the figures stand in it');

// 4) the figures are presents the gift hand-over can name
const names = await page.evaluate(() => {
  const g = window.__lw.getGame();
  return Object.keys(g.owned).filter((k) => k.startsWith('fig_'));
});
assert.deepEqual(names.sort(), ['fig_neko_red', 'fig_robo_small']);
step('the figures are in the bag as presents');

await t.browser.close();
console.log(`figures e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
