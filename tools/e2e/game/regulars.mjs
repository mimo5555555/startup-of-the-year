// Shopkeepers who know you, in the REAL UI at 360 px, English or Arabic (--ar):
//   a fresh profile -> the konbini, first visit: the usual 「いらっしゃいませ。」, typed おにぎりをください / 大丈夫です / 現金で -> the second visit:
//   Tanaka remembers (「前回のおにぎり、どうでしたか？」) with the two answer chips on top; the good chip is answered (「よかったです！…」) and the
//   chips go; typed お茶をください … -> the third visit: small talk about the season (「涼しくなりましたね。秋は好きですか？」 in autumn), the
//   yes chip, a warm reply back to the shop -> the fourth visit: the regular's greeting (いつもありがとうございます), no answer chips; typed
//   「また来ました」 is understood. After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/regulars.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('regulars', { weekday: true });
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

/** Walks to Tanaka and opens the shop conversation; returns its first line, as written (no furigana, no romaji). */
async function visit() {
  await settle();
  await go('world');
  await page.evaluate(() => window.__world.teleportNear('tanaka'));
  await page.waitForFunction(() => window.__world.nearby === 'tanaka', null, { timeout: 20000 });
  await t.sleep(600);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
  if (await page.locator('[data-opt=tanaka_shop]').count()) await page.locator('[data-opt=tanaka_shop]').click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link, .prep-link').first().click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
  await t.sleep(300);
  return lastLine();
}

const lastLine = async () => (await page.locator('.msg.char').last().innerText()).replace(/\s+/g, '');
const chips = async () => (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));

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
}

async function finish() {
  await page.waitForSelector('.done-card', { timeout: 40000 });
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
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true, furigana: false, romaji: false }));
await settle();
step('fresh profile');

// the first visit: the usual greeting
let first = await visit();
assert.ok(!first.includes('前回') && !first.includes('いつも'), `first visit: the usual greeting (${first})`);
assert.ok(!(await chips()).some((c) => c.includes('おいしかった')), 'no answer chips on a first visit');
await type('おにぎりをください。');
await type('大丈夫です。');
await type('現金でお願いします。');
await finish();
let g = await liveGame(page);
assert.equal(g.runs.konbini?.count, 1, 'one visit counted');
await check('after the first visit');
step(`first visit: 「${first}」; bought an onigiri`);

// the second visit: he remembers the onigiri
first = await visit();
assert.ok(first.includes('前回') && first.includes('おにぎり'), `second visit: Tanaka asks about the onigiri (${first})`);
let cs = await chips();
assert.ok(cs[0].includes('おいしかった'), `the good answer chip is on top (${cs.join(' | ')})`);
assert.ok(cs[1].includes('まあまあ'), 'then the so-so one');
await t.shot('remembers');
const n = await page.locator('.msg.char').count();
await page.locator('.sg').first().click();
await lineAfter(n);
const reply = await lastLine();
assert.ok(reply.includes('よかった'), `Tanaka is glad (${reply})`);
cs = await chips();
assert.ok(!cs.some((c) => c.includes('おいしかった') || c.includes('まあまあ')), `answered: the answer chips are gone (${cs.join(' | ')})`);
await t.shot('answered');
await type('お茶をください。');
await type('大丈夫です。');
await type('現金でお願いします。');
await finish();
await check('after the second visit');
step(`second visit: 「${first}」 → おいしかったです → 「${reply}」; bought green tea`);

// the third visit: small talk about the season (whatever the real date's season in Tokyo is)
first = await visit();
assert.ok(/好きですか|見ましたか/.test(first), `third visit: Tanaka makes small talk about the season (${first})`);
cs = await chips();
assert.ok(cs[0].startsWith('はい、'), `the yes chip is on top (${cs.join(' | ')})`);
const yesChip = cs[0];
await t.shot('smalltalk');
const m = await page.locator('.msg.char').count();
await page.locator('.sg').first().click();
await lineAfter(m);
const talkReply = await lastLine();
assert.ok(talkReply.includes('いいですね') && talkReply.includes('ごゆっくり'), `a warm reply, then back to the shop (${talkReply})`);
assert.ok(!(await chips()).includes(yesChip), 'answered: the small talk chips are gone');
await type('水をください。');
await type('大丈夫です。');
await type('現金でお願いします。');
await finish();
await check('after the third visit');
step(`third visit: 「${first}」 → ${yesChip} → 「${talkReply}」; bought water`);

// the fourth visit: a regular, nothing asked
first = await visit();
assert.ok(first.includes('いつも'), `fourth visit: the regular's greeting (${first})`);
assert.ok(!first.includes('前回') && !/好きですか|見ましたか/.test(first), 'nothing asked this time');
assert.ok(!(await chips()).some((c) => c.includes('おいしかった') || c.startsWith('はい、')), 'no answer chips');
await type('また来ました！');
const back = await lastLine();
assert.ok(back.includes('ありがとう'), `「また来ました」 is understood (${back})`);
await t.shot('regular');
await check('the fourth visit');
step(`fourth visit: 「${first}」; また来ました → 「${back}」`);

await t.browser.close();
console.log(`regulars e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
