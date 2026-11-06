// ゲームセンター「ピコピコ」 (the game centre) in the REAL UI at 360 px, English or Arabic (--ar):
//   a fresh profile -> Chapter 2 -> a crane machine with no goes says where to buy them -> Shota's conversation, typed: change
//   (両替お願いします), the help (取りやすくしてもらえますか: the culture card), three goes (三回お願いします), cash: exactly ¥300, 3 goes -> the
//   crane game: the help is shown; the claw moved over the white Cat Ninja and dropped until a prize is won or the goes run out; each try uses
//   one go; a win puts the prize in the bag. After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/arcade.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('arcade', { weekday: true });
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

async function talkToShota() {
  await settle();
  await go('world');
  await page.evaluate(() => window.__world.teleportNear('aiko'));
  await t.sleep(500);
  await page.evaluate(() => window.__world.teleportNear('shota'));
  await page.waitForFunction(() => window.__world.nearby === 'shota', null, { timeout: 20000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
  if (await page.locator('[data-opt=shota_crane]').count()) await page.locator('[data-opt=shota_crane]').click();
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
step('fresh profile -> Chapter 2 (the game centre opens with it)');

// a crane machine with no goes: it says where to buy them
await go('world');
await page.evaluate(() => window.__world.teleportNear('shota'));
await page.waitForFunction(() => window.__world.nearby === 'shota', null, { timeout: 20000 });
await t.sleep(1200);
await t.shot('front');
await page.evaluate(() => window.__world.simulatePick('arcade:crane'));
await t.sleep(400);
assert.match(await page.evaluate(() => window.__lw.useStore.getState().toast?.text ?? ''), AR ? /شوتا/ : /Shota/, 'no goes: the machine says to buy from Shota');
assert.notEqual(await screen(), 'crane');
await check('the game centre front');
step('the game centre: Shota at the door; a machine with no goes says where to buy them');

// Shota, typed: change, the help, three goes, cash
const g0 = await liveGame(page);
await talkToShota();
await drive([{ type: '両替お願いします。' }, { type: 'すみません、取りやすくしてもらえますか？' }, { type: '三回お願いします。' }, { type: '現金でお願いします。' }]);
let g = await liveGame(page);
assert.equal(g.arcade.plays, 3, 'three goes');
assert.equal(g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned), 300, 'exactly ¥300');
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().screen), 'world');
await finish();
await check('after Shota');
step('Shota, typed: 両替, 取りやすくしてもらえますか, 三回, cash: ¥300, three goes, the help on');

// the crane game
await page.evaluate(() => window.__world.simulatePick('arcade:crane'));
await page.waitForSelector('[data-screen=crane][data-plays="3"]', { timeout: 10000 });
assert.equal(await page.locator('[data-crane-assist]').count(), 1, 'the help is shown');
await t.shot('crane');
await check('the crane game');
// line the claw up over the white Cat Ninja (x 0.85 from 0.50: 9 steps of 0.04) and drop
for (let i = 0; i < 9; i++) await page.locator('[data-crane-right]').click();
let tries = 0;
for (; tries < 3; tries++) {
  await page.locator('[data-crane-drop]').click();
  await page.waitForSelector('[data-crane-result]', { timeout: 10000 });
  if ((await page.locator('[data-crane-result]').getAttribute('data-crane-result')) === 'won') break;
  if (tries < 2) await page.locator('[data-crane-again]').click();
}
await t.shot('crane-result');
g = await liveGame(page);
assert.equal(g.arcade.tries, Math.min(tries + 1, 3), 'each try uses one go');
assert.equal(g.arcade.plays, 3 - g.arcade.tries);
if (g.arcade.won) assert.equal(g.owned.fig_neko_white?.qty, 1, 'the white Cat Ninja is in the bag');
await check('after the crane');
step(`the crane game: ${g.arcade.tries} tr${g.arcade.tries === 1 ? 'y' : 'ies'}, ${g.arcade.won ? 'the white Cat Ninja won' : 'no prize this time'}`);

await t.browser.close();
console.log(`arcade e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
