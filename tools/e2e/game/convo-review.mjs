// Review regressions of the conversation screen in the real UI: (1) the X of a FINISHED conversation settles it (its coffee was already
// charged at the end node, so throwing it away would take the money and pay nothing), (2) the X of an open one still asks first,
// (3) tapping Hint twice is one hint.
// Usage: node tools/e2e/game/convo-review.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('convo-review');
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
async function open() {
  await page.evaluate(() => window.__lw.useStore.getState().resetGameProgress());
  await skipBeats(page).catch(() => {});
  await page.evaluate(() => window.__lw.useUi.getState().startConvo({ scenarioId: 'cafe', characterId: 'yuki', mode: 'guided' }));
  await page.waitForSelector('.convo');
  await lineAfter(0);
}

t.step('fresh profile');
await onboard(page, { arabic: t.arabic });
await t.sleep(2000);
await skipBeats(page).catch(() => {});

t.step('two taps on a chip in one task (the 2nd would pick from the NEXT node) send one line');
await open();
{
  const n = await charLines();
  await page.evaluate(() => {
    const b = document.querySelectorAll('.sg');
    b[0].click();
    b[0].click();
  });
  await lineAfter(n);
  assert.equal(await page.locator('.msg.me').count(), 1, 'one learner line, not two');
  await page.evaluate(() => window.__lw.useUi.getState().endConvo());
  await page.waitForSelector('.convo', { state: 'detached' });
}

t.step('an open conversation: the X asks first, Stay keeps it');
await open();
await page.locator('.convo-head .icon-btn').first().click();
await page.waitForSelector('[role="alertdialog"]');
await t.shot('01-leave-asks');
await page.locator('[role="alertdialog"] .btn.soft').click();
await page.waitForSelector('[role="alertdialog"]', { state: 'detached' });
assert.equal((await liveGame(page)).totals.earned, 0, 'nothing paid yet');

t.step('tapping Hint three times in a row at one node');
for (let i = 0; i < 3; i++) await page.locator('.tools .tool').first().click();
await page.waitForSelector('.hint-card');
await t.shot('02-hint-open');
{
  // the hinted chip pulses (an endless animation), which Playwright never calls stable
  const n = await charLines();
  await page.locator('.hint-card .btn.primary').click();
  await lineAfter(n);
}

t.step('play to the end by tapping, then press the X instead of "See feedback"');
await tap(0); // hot
await tap(1); // the Wi-Fi password
await tap(0); // thank you: the clerk names the total
await tap(1); // cash
await page.waitForSelector('.done-card', { timeout: 30000 });
await t.shot('03-done-card');
const before = await liveGame(page);
assert.equal(before.wallet.cash, 3000 - 450, 'the coffee was charged at the end node');
assert.equal(before.totals.earned, 0, 'and the conversation is not paid yet');
await page.locator('.convo-head .icon-btn').first().click();
await page.waitForSelector('.feedback .dbf-payline', { timeout: 15000 });
await t.shot('04-feedback-after-x');
const g = await liveGame(page);
assert.ok(g.totals.earned > 0, `the conversation was paid (earned ${g.totals.earned})`);
assert.equal(g.wallet.cash, 3000 + g.totals.earned - 450, 'wallet = start + pay - the coffee');
const line = (await page.locator('.dbf-payline strong').innerText()).trim();
assert.equal(line.replace(/[^\d]/g, ''), String(g.totals.earned), 'the debrief pay line is the ledger');
await assertNoHScroll(page, 'feedback after X');
assertNoConsoleErrors(t.logs);
console.log('convo-review OK');
await t.browser.close();
