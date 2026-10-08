// Too little cash in a shop conversation (docs/GAME_DESIGN.md §6.2 `short`, §15.4 row 2C): the clerk says politely that it is not enough,
// nothing is bought, no yen move, the learner can leave by tapping, the debrief still opens and nothing crashes. A ¥0 wallet is never stuck.
// Usage: node tools/e2e/game/broke.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('broke');
const { page } = t;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

async function lineAfter(n) {
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k && !document.querySelector('.bubble.typing'), n, { timeout: 30000 });
  await t.sleep(250);
}
const charLines = () => page.locator('.msg.char').count();
const tap = async (i) => {
  const n = await charLines();
  await page.locator('.sg').nth(i).click();
  await lineAfter(n);
};

/** a fresh game with `cash` yen in the wallet, a conversation opened through the request */
async function open(scenarioId, characterId, cash) {
  await page.evaluate(() => window.__lw.useStore.getState().resetGameProgress());
  await skipBeats(page).catch(() => {});
  await page.evaluate((c) => {
    const g = window.__lw.getGame();
    window.__lw.useGame.getState().setGame({ ...g, wallet: { ...g.wallet, cash: c } });
  }, cash);
  await page.evaluate(([s, c]) => window.__lw.useUi.getState().startConvo({ scenarioId: s, characterId: c }), [scenarioId, characterId]);
  await page.waitForSelector('.convo');
  await lineAfter(0);
}

const lastClerkLine = () => page.locator('.msg.char .bubble').last().innerText();

t.step('fresh profile');
await onboard(page, { arabic: t.arabic });
await t.sleep(2000);
await skipBeats(page).catch(() => {});

// ---- café: ¥100 for a ¥450 coffee -------------------------------------------------------------------------------------
t.step('café with ¥100: coffee, hot, no more, cash, and the clerk says it is not enough');
await open('cafe', 'yuki', 100);
await tap(0); // coffee
await tap(0); // hot
await tap(0); // that is all
await tap(1); // cash
assert.match(await lastClerkLine(), /足りません/, 'the clerk politely says it is a little short');
await t.shot('01-short');
await assertNoHScroll(page, 'short branch');
const shortG = await liveGame(page);
assert.equal(shortG.wallet.cash, 100, 'no money moved');
assert.equal(shortG.stats.purchases, 0);
assert.equal(shortG.ledger.filter((e) => e.kind === 'purchase').length, 0, 'no purchase in the ledger');
assert.ok((await page.locator('.sg').count()) >= 1, 'chips are still offered: the polite way out is one tap');

t.step('leave politely by tapping (「また来ます」)');
let guard = 0;
while (!(await page.locator('.done-card').count()) && guard++ < 6) await tap(0);
await page.waitForSelector('.done-card');
assert.equal(await page.locator('.done-card .btn.soft').count(), 0, 'no receipt for a purchase that did not happen');
await t.shot('02-ended');
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback');
await page.waitForSelector('.dbf-card');
// the payment step was never done, so there is no star and no purchase row
assert.equal(await page.locator('.dbf-spent').count(), 0, 'the debrief has no "you paid" row');
await t.shot('03-debrief');
await assertNoHScroll(page, 'debrief after a short branch');
const after = await liveGame(page);
assert.equal(after.stats.purchases, 0);
assert.equal(after.runs.cafe?.complete ?? false, false, 'a shop conversation that never paid is not complete');
// the debrief is honest about pay: whatever it says equals the ledger
const earned = after.totals.earned;
const payText = (await page.locator('.dbf-payline strong').innerText()).replace(/[^\d]/g, '');
assert.equal(Number(payText || 0), earned, 'the pay line is the ledger');
t.step(`debrief opened; earned ¥${earned}, wallet ¥${after.wallet.cash}`);
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(500);
await skipBeats(page).catch(() => {});

// ---- konbini with nothing at all ----------------------------------------------------------------------------------------
t.step('konbini with ¥0: the same polite end, no crash');
await open('konbini', 'tanaka', 0);
guard = 0;
while (!(await page.locator('.done-card').count()) && guard++ < 14) {
  if (await page.locator('.sg').count()) await tap(0);
  else await t.sleep(600);
}
await page.waitForSelector('.done-card');
const konbini = await liveGame(page);
assert.equal(konbini.wallet.cash, 0, 'still ¥0, never negative');
assert.equal(konbini.stats.purchases, 0);
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card');
await t.shot('04-konbini-debrief');
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(400);

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('broke ok');
