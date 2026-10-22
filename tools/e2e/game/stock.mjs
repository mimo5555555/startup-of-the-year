// Stock the player cannot buy yet, and the car lesson's numbers (review of Release 1 shopping). Free Walk, plenty of cash, no helmet:
//  - the dealer's first price is the BODY price ¥148,000 (with its chip), the drive-away price ¥198,000 on request;
//  - the low-mileage car is "not available yet": a price question gets the offer line again, never an empty price;
//  - the power-assist bicycle without the helmet: "I will take it" is answered by the offer line, not by a registration form, and no yen move.
// Usage: node tools/e2e/game/stock.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

// Free Walk / Chapter 8: a weekday, so the Saturday festival never turns the park mid-run (`clockShift`)
const t = await start('stock', { weekday: true });
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
const lastLine = () => page.locator('.msg.char .bubble').last().innerText();
const lastChip = async () => (await page.locator('.msg.char').last().locator('.dbf-price b').first().innerText().catch(() => '')).replace(/[^0-9]/g, '');

async function open(scenarioId, characterId) {
  await page.evaluate(() => window.__lw.useStore.getState().resetGameProgress());
  await skipBeats(page).catch(() => {});
  await page.evaluate(() => {
    const g = window.__lw.getGame();
    window.__lw.useGame.getState().setGame({ ...g, chapter: { ...g.chapter, n: 9 }, wallet: { ...g.wallet, cash: 400000 } });
  });
  await page.evaluate(([s, c]) => window.__lw.useUi.getState().startConvo({ scenarioId: s, characterId: c }), [scenarioId, characterId]);
  await page.waitForSelector('.convo');
  await lineAfter(0);
}

t.step('fresh profile');
await onboard(page, { arabic: t.arabic });
await t.sleep(2000);
await skipBeats(page).catch(() => {});

t.step('the used kei car: body price first, then the drive-away price');
await open('motors_car', 'nakamura');
await tap(0); // I would like to see a kei car
await tap(0); // the used one
await tap(0); // how much is it?
assert.match(await lastLine(), /148,000|１４８|百四十八/, 'the body price is said with its number');
assert.equal(await lastChip(), '148000', 'the chip under the line shows the body price');
await t.shot('01-body-price');
await assertNoHScroll(page, 'body price');
await tap(0); // the drive-away price
assert.equal(await lastChip(), '198000', 'the drive-away price is the total with fees');
await t.shot('02-drive-away');

t.step('the low-mileage car is not available yet: the offer line, never an empty price');
await open('motors_car', 'nakamura');
await tap(0);
await tap(1); // the low-mileage kei car
const offer = await lastLine();
await tap(0); // how much is it?
assert.equal(await lastLine(), offer, 'a price question gets the offer line again');
assert.ok(!/…/.test(await lastLine()), 'no empty price');
await t.shot('03-good-locked');

t.step('the e-bike without the helmet: "I will take it" does not open a registration form');
await open('motors_bike', 'nakamura');
await tap(0); // I would like a bicycle
await tap(2); // for a ride around town
await tap(3); // the power-assist bicycle
const ebike = await lastLine();
await tap(1); // I will take this one
assert.equal(await lastLine(), ebike, 'the same offer line, no bill');
await t.shot('04-ebike-locked');
await assertNoHScroll(page, 'ebike offer');
const g = await liveGame(page);
assert.equal(g.ledger.filter((e) => e.kind === 'purchase').length, 0, 'nothing was charged');
assert.equal(g.wallet.cash, 400000);

assertNoConsoleErrors(t.logs);
console.log('stock ok');
await t.browser.close();
