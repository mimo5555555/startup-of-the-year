// The first full game loop (docs/GAME_DESIGN.md §15.4 acceptance). SKELETON: it drives the steps that exist now (onboarding -> world ->
// game save -> the routes -> the dev tools -> reload) and marks, with TODO(2x), every step that arrives with a later agent; the slice
// gate fills them in. Screenshots at 360 px in tools/e2e/shots/game/. Usage: node tools/e2e/game/game-loop.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, gameState, liveGame, onboard, openSettings, skipBeats, start } from './_common.mjs';

const t = await start('loop');
const { page } = t;
const route = async (name) => {
  await page.evaluate((n) => window.__lw.useStore.getState().go(n), name);
  await page.waitForSelector('.panel');
  await t.sleep(200);
};
const back = async () => {
  await page.locator('.panel-head .icon-btn').first().click();
  await t.sleep(300);
};

t.step('fresh profile: onboarding -> world');
await onboard(page, { arabic: t.arabic });
if (t.arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl in Arabic');
await t.sleep(2500);
await t.shot('01-world');
await assertNoHScroll(page, 'world');

t.step('the game starts with the pack wallet, seeded, and the save is on disk');
const g0 = await gameState(page);
assert.equal(g0.wallet.cash, 3000, 'wallet starts at ¥3,000');
assert.equal(g0.seeded, true);
assert.equal(g0.chapter.n, 1);

// TODO(2F): Hanako's opening beat (b_ch1_open) shows through the real StoryBeat: four lines, then the katakana-name step (me.nameKana)
// TODO(2B): the wallet pill shows ¥3,000 and the tracker card shows Chapter 1 objective 1 (Greetings lesson) with a map pin
await skipBeats(page).catch(() => {});

t.step('every game route opens, shows its title and returns to the world');
for (const name of ['quests', 'friends', 'phone', 'shift', 'prepare', 'wallet', 'letter', 'culture']) {
  await route(name);
  assert.ok((await page.locator('.panel-head h1').innerText()).trim().length > 0, `${name} has a title`);
  await assertNoHScroll(page, name);
  await t.shot(`02-route-${name}`);
  await back();
  assert.equal(await page.evaluate(() => window.__lw.useStore.getState().screen), 'world', `${name} goes back to the world`);
}

t.step('dev tools: hidden until the version line is tapped 7 times, then +¥10,000');
await openSettings(page);
assert.equal(await page.locator('[data-dev]').count(), 0, 'not shown by default');
for (let i = 0; i < 7; i++) await page.locator('p.version').click();
await t.sleep(200);
assert.equal(await page.locator('[data-dev]').count(), 4, 'four tools after 7 taps');
await page.locator('[data-dev=cash]').scrollIntoViewIfNeeded();
await t.shot('03-dev-tools');
await page.locator('[data-dev=cash]').click();
await t.sleep(200);
assert.equal((await liveGame(page)).wallet.cash, 13_000);
await assertNoHScroll(page, 'settings');
// the money event is on disk at once (E10)
assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('lw.game.jp.v1')).state.wallet.cash)), 13_000);

t.step('reload: the game state persisted');
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw?.useGame?.getState().hydrated, null, { timeout: 60000 });
await skipBeats(page).catch(() => {});
await t.sleep(800);
const g1 = await liveGame(page);
assert.equal(g1.wallet.cash, 13_000);
assert.equal(g1.flags.dev, true);
await t.shot('04-after-reload');

t.step('Reset game progress: only the game goes back to the start');
await openSettings(page);
await page.locator('.btn.danger-text').first().click();
await page.locator('.card.warn .btn.danger').click();
await t.sleep(300);
const g2 = await liveGame(page);
assert.equal(g2.wallet.cash, 3000);
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().profile?.name), 'Sam', 'the profile stays');
await t.shot('05-after-game-reset');

// TODO(2A->2G) the remaining acceptance steps, each added by the agent that builds it:
//  - TODO(2F) Greetings lesson ticks objective c1_1; TODO(2E) konbini Prepare recall check; TODO(2D+2C) buy onigiri: wallet -¥160, loop pay credited
//  - TODO(2C) compact debrief: stars, ONE pay line, hidden-line echo; reload keeps it
//  - TODO(2G) IC card + top-up at the station, vending panel, ramen ticket (world.simulatePick('ramen_machine')), short-of-cash branch
//  - TODO(2F) Chapter 1 completes (+¥2,500), closing beat opens the Dream picker, Chapter 2 becomes current, Fuku-Fuku shutter opens, daily goals tick

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('game-loop ok');
