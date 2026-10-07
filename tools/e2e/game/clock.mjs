// The clock (docs/GAME_DESIGN.md D3, D27, §14.5 observeClock) in the real app: a +400-day jump is ONE rollover, the return to today
// reopens nothing and does not pin the calendar, and the next real day counts one. Playwright's clock moves `Date` only (timers
// keep running, so the debounced saves still happen). Usage: node tools/e2e/game/clock.mjs [--ar]   (BASE overrides the URL)
import assert from 'node:assert/strict';
import { DAY_MS, assertNoConsoleErrors, assertNoHScroll, gameState, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('clock');
const { page } = t;
const focus = async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(150);
  await skipBeats(page).catch(() => {});
};
const day = async () => (await liveGame(page)).clock;

t.step('fresh profile in the world');
await onboard(page, { arabic: t.arabic });
await t.sleep(800);
const t0 = Date.now();
const c0 = await day();
assert.equal(typeof c0.dayIndex, 'number');
assert.match(c0.lastLocalDate, /^\d{4}-\d{2}-\d{2}$/);
await t.shot('01-day0');

t.step('+400 days: exactly one rollover');
await page.clock.setFixedTime(new Date(t0 + 400 * DAY_MS));
await focus();
const c1 = await day();
assert.equal(c1.dayIndex, c0.dayIndex + 1, 'one rollover whatever the jump');
assert.ok(c1.lastLocalDate > c0.lastLocalDate, 'the date moved forward');
await page.waitForTimeout(400);
assert.equal((await gameState(page)).clock.dayIndex, c1.dayIndex, 'and it is saved');

t.step('visibilitychange is observed too (the same date is not a second day)');
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(150);
assert.equal((await day()).dayIndex, c1.dayIndex);

t.step('back to today: nothing reopens, the calendar is not pinned in the future');
await page.clock.setFixedTime(new Date(t0 + 1000));
await focus();
const c2 = await day();
assert.equal(c2.dayIndex, c1.dayIndex, 'no new day');
assert.equal(c2.lastLocalDate, c0.lastLocalDate, 're-anchored to today');
await t.shot('02-back-to-today');

t.step('the next real day counts exactly one');
await page.clock.setFixedTime(new Date(t0 + DAY_MS + 1000));
await focus();
assert.equal((await day()).dayIndex, c1.dayIndex + 1);

t.step('a time-zone hop (-1 day then +1 day) grants at most one extra day');
const before = (await day()).dayIndex;
await page.clock.setFixedTime(new Date(t0 + 1000));
await focus();
await page.clock.setFixedTime(new Date(t0 + DAY_MS + 1000));
await focus();
assert.ok((await day()).dayIndex - before <= 1, 'at most one extra rollover');

await t.sleep(300);
await assertNoHScroll(page, 'world after the clock tests');
assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('clock ok');
