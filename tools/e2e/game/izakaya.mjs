// 居酒屋「なごみ」 (the izakaya, Chapter 6) in the REAL UI at 360 px, English or Arabic (--ar):
//   a fresh profile -> Chapter 6 -> Misaki at the izakaya's door -> typed: 二人です, ウーロン茶を二つください, お通しって何ですか (she explains:
//   ¥300 a person), 焼き鳥をください, 乾杯！, すみません！お会計お願いします (全部で千九百八十円), 割り勘でお願いします (お一人様九百九十円),
//   現金でお願いします: exactly ¥990, half of two oolong teas, the yakitori and two お通し -> both culture cards (cc_otoshi, cc_warikan).
//   After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/izakaya.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('izakaya', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);

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

const lastLine = async () => (await page.locator('.msg.char').last().innerText()).replace(/\s+/g, '');
const lineAfter = async (n) => {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
};
async function type(text) {
  await page.waitForSelector('#say', { timeout: 40000 });
  const n = await page.locator('.msg.char').count();
  await page.fill('#say', text);
  await page.locator('.send').click();
  await Promise.race([lineAfter(n), page.waitForSelector('.done-card', { timeout: 40000 })]);
  return lastLine();
}

// ---------------------------------------------------------------------------------------------------------------
await onboard(page, { arabic: AR });
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true, furigana: false, romaji: false }));
await settle();
// (the izakaya opens with Chapter 6: the test sets the chapter, playing there is chapters56.mjs's subject)
await page.evaluate(() => {
  const lw = window.__lw;
  const g0 = lw.getGame();
  lw.useGame.getState().setGame({ ...g0, chapter: { ...g0.chapter, n: 6, completed: [1, 2, 3, 4, 5] } });
});
assert.equal((await liveGame(page)).chapter.n, 6, 'Chapter 6');
step('fresh profile -> Chapter 6');

// Misaki at the izakaya's door
await go('world');
await page.evaluate(() => window.__world.teleportNear('misaki'));
await page.waitForFunction(() => window.__world.nearby === 'misaki', null, { timeout: 20000 });
await t.sleep(1200);
await t.shot('front');
await check('the izakaya front');
step('the izakaya: Misaki at the door');

const g0 = await liveGame(page);
await page.locator('.talk-btn').click();
await t.sleep(600);
if (await page.locator('[data-opt=misaki_dinner]').count()) await page.locator('[data-opt=misaki_dinner]').click();
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
// the chapter's opening beat plays first (the test jumped to Chapter 6), then the conversation
await t.sleep(800);
if ((await screen()) === 'beat') await skipBeats(page);
await page.waitForSelector('.convo', { timeout: 25000 });
await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
assert.ok((await lastLine()).includes('何名様'), 'Misaki asks how many');

// (from Chapter 6 the game offers the conversation in Real mode: typed, no chips; the beer chip's age gate is the engine test's subject)
const toTable = await type('二人です。');
assert.ok(toTable.includes('お飲み物'), `to the table, and the drinks (${toTable})`);
await t.shot('drinks');
let line = await type('ウーロン茶を二つください。');
assert.ok(line.includes('お通し'), `the お通し comes with the drinks (${line})`);
line = await type('お通しって何ですか？');
assert.ok(line.includes('三百円'), `she explains it: ¥300 a person (${line})`);
await type('焼き鳥をください。');
await type('乾杯！');
line = await type('すみません！お会計お願いします。');
assert.ok(line.includes('千九百八十円') && line.includes('ご一緒'), `the whole bill, and "one bill?" (${line})`);
await t.shot('bill');
line = await type('割り勘でお願いします。');
assert.ok(line.includes('お一人様九百九十円'), `split: ¥990 each (${line})`);
await type('現金でお願いします。');
await page.waitForSelector('.done-card', { timeout: 40000 });
let g = await liveGame(page);
assert.equal(g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned), 990, 'exactly ¥990: half of 350 × 2 + 680 + 300 × 2');
await t.shot('done');
step('typed: 二人, ウーロン茶を二つ, お通し explained, 焼き鳥, 乾杯, お会計 (¥1,980), 割り勘 (¥990 each), cash: ¥990');

// the debrief and the street: both culture cards
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await t.sleep(300);
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(800);
await settle();
g = await liveGame(page);
assert.ok(g.culture.cc_otoshi, 'the お通し card is collected');
assert.ok(g.culture.cc_warikan, 'the 割り勘 card is collected');
await check('after the evening');
step('both culture cards collected: お通し and 割り勘');

await t.browser.close();
console.log(`izakaya e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
