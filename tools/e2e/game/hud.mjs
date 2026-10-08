// The world HUD (docs/GAME_DESIGN.md §2.5, §6.1, §6.5, §7.5; agent 2B). Fresh profile at 360 px, English or Arabic (--ar):
// wallet pill with ¥3,000 and the tracker card, no dream chip and no daily goals before Chapter 1's closing beat, at most 4 HUD elements,
// the old controls untouched, a character with one option still starts the conversation directly, the Interaction sheet when there are
// several, panel picks, the menu, no horizontal scroll, 44 px targets, no console errors. Screenshots in tools/e2e/shots/game/.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/hud.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('hud');
const { page } = t;
const W = 360;

/** Every element of the HUD (and the sheets) lies inside the screen. */
const assertInside = async (where) => {
  const bad = await page.evaluate((w) => {
    const out = [];
    for (const el of document.querySelectorAll('.hud *, .hud-sheet *, .hud-menu-wrap *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > w + 1 || r.left < -1) out.push(`${el.className || el.tagName}: ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return out.slice(0, 6);
  }, W);
  assert.deepEqual(bad, [], `${where}: HUD elements outside the ${W} px screen`);
};

/** Touch targets of the things a thumb presses are at least 44 px. */
const assertTargets = async (selector, where) => {
  const small = await page.evaluate((s) => [...document.querySelectorAll(s)].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && (r.height < 43.5 || r.width < 43.5)).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`), selector);
  assert.deepEqual(small, [], `${where}: targets under 44 px`);
};

/** Closes the word card that a first open grants, then the panel itself (its own X button, or the stub's Close button). */
const closePanel = async () => {
  while (await page.locator('.word-scrim .word-close').count()) {
    await page.locator('.word-scrim .word-close').last().click();
    await t.sleep(250);
  }
  await page.locator('.scrim:not(.word-scrim) :is([aria-label="Close"], [aria-label="إغلاق"]), .scrim:not(.word-scrim) .btn.soft.wide').first().click();
  await t.sleep(300);
};

t.step('fresh profile: onboarding -> world');
await onboard(page, { arabic: t.arabic });
await t.sleep(2500);
await page.locator('.tip .btn').click().catch(() => {});
await t.sleep(300);
if (t.arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl in Arabic');
// the opening beat of Chapter 2F's StoryBeat may be waiting; the HUD under it is what this script looks at
await skipBeats(page).catch(() => {});
await t.sleep(500);

t.step('the wallet pill shows ¥3,000 and the tracker card shows a next goal');
const wallet = page.locator('.hud-wallet');
assert.equal(await wallet.count(), 1, 'one wallet pill');
assert.ok((await wallet.innerText()).includes('¥3,000'), `wallet shows ¥3,000, got ${await wallet.innerText()}`);
assert.equal(await page.locator('.hud-wallet bdi[dir=ltr]').count() > 0, true, 'the amount is a left-to-right span');
const tracker = page.locator('.hud-track');
assert.equal(await tracker.count(), 1, 'one tracker card');
assert.ok((await tracker.locator('.next-text strong').innerText()).trim().length > 0, 'the tracker names a goal');
await t.shot('01-hud');

t.step('progressive disclosure: no dream chip and no daily goals before the closing beat; at most 4 elements');
assert.equal(await page.locator('.hud-dream').count(), 0, 'no dream chip');
const g = await liveGame(page);
assert.equal(g.daily.goals.length, 0, 'no daily goals yet');
const parts = await page.evaluate(() => ['.hud-wallet', '.hud-track', '.hud-dream', '.lvl', '.hud-phone', '.found'].filter((s) => document.querySelector(`.hud ${s}`)));
assert.ok(parts.length <= 4, `HUD elements: ${parts.join(' ')}`);
console.log('  HUD elements:', parts.join(' '));

t.step('the controls the user likes are still there');
for (const sel of ['.lvl', '.flame', '.minimap', '.stick', '.icon-btn.glass']) assert.ok(await page.locator(`.hud ${sel}`).count(), `${sel} still on the HUD`);
assert.equal(await page.locator('.icon-btn.glass').first().getAttribute('aria-expanded'), 'false', 'the menu button is still the first glass button');

t.step('layout: inside the screen, no horizontal scroll, 44 px targets');
await assertNoHScroll(page, 'hud');
await assertInside('hud');
await assertTargets('.hud-wallet, .hud-track, .hud-dream, .hud .icon-btn', 'hud');

t.step('one option: Talk starts the conversation directly');
await page.evaluate(() => window.__world.teleportNear('tanaka'));
await t.sleep(900);
await t.shot('02-near-tanaka');
await page.locator('.talk-btn').click();
await page.waitForSelector('.msg.char', { timeout: 15000 });
assert.equal(await page.locator('.hud-sheet').count(), 0, 'no sheet for a character with one option');
await assertNoHScroll(page, 'conversation');
await page.evaluate(() => window.__lw.useUi.getState().endConvo());
await t.sleep(600);
assert.equal(await page.locator('.hud').count(), 1, 'back on the HUD');

t.step('the Goods sheet (the bag button next to Talk): names, meanings, prices read in Japanese, no purchase');
await page.evaluate(() => window.__world.teleportNear('tanaka'));
await t.sleep(700);
if (await page.locator('.hud-goods-btn').count()) {
  await page.locator('.hud-goods-btn').click();
  await page.waitForSelector('.hud-goods .hud-good');
  assert.ok((await page.locator('.hud-good .hud-price').first().innerText()).includes('¥'), 'goods carry a yen price');
  assert.ok(await page.locator('.hud-good .hud-say').count(), 'prices can be heard in Japanese');
  assert.equal(await page.locator('.hud-goods .btn.primary').count(), 0, 'nothing to buy on the goods sheet');
  await t.sleep(900);
  await t.shot('02b-goods');
  await assertNoHScroll(page, 'goods');
  await assertInside('goods');
  await assertTargets('.hud-say', 'goods');
  await page.locator('.hud-goods .btn.soft').click();
  await t.sleep(300);
} else {
  console.log('  no goods in the shops of this pack yet (3E): the Goods sheet is covered by the unit tests');
}
await page.evaluate(() => window.__world.teleportNear('hanako'));
await t.sleep(300);

t.step('standing in a spot reports it to the game (stats.spots)');
await page.evaluate(() => window.__world.teleportNear('sato'));
await t.sleep(700);
assert.ok((await liveGame(page)).stats.spots.includes('station_plaza'), 'the station plaza spot was recorded without the world prefix');

t.step('several options: the Interaction sheet (when the station can also sell the IC card), else the direct conversation');
await page.locator('.talk-btn').click();
await t.sleep(700);
if (await page.locator('.hud-sheet').count()) {
  const opts = await page.locator('.hud-opt:not(.alt):not(.locked)').count();
  assert.ok(opts >= 2, `the sheet lists at least two open options, got ${opts}`);
  await t.sleep(900);
  await t.shot('03-sheet');
  await assertNoHScroll(page, 'sheet');
  await assertInside('sheet');
  await assertTargets('.hud-opt', 'sheet');
  await page.locator('.hud-opt:not(.locked)').first().click();
  await page.waitForSelector('.msg.char, .panel', { timeout: 15000 });
  console.log('  sheet options:', opts);
  if (await page.locator('.msg.char').count()) await page.evaluate(() => window.__lw.useUi.getState().endConvo());
  else await page.evaluate(() => window.__lw.useStore.getState().go('world'));
} else {
  await page.waitForSelector('.msg.char', { timeout: 15000 });
  console.log('  Sato has one open option here (station_ic is not registered): conversation started directly');
  await page.evaluate(() => window.__lw.useUi.getState().endConvo());
}
await t.sleep(600);

t.step('panel picks: vending machine, ramen ticket machine and station ticket machine open their panels');
await page.evaluate(() => window.__world.simulatePick('vending'));
await t.sleep(600);
assert.ok(await page.locator('.scrim:not(.word-scrim):not(.hud-scrim)').count(), 'the vending panel is open');
// the first open also grants the sign discovery and its word card, which sits on top
assert.ok(await page.locator('.word-scrim').count(), 'the first open shows the sign word card');
await t.shot('04-vending');
await closePanel();
await page.evaluate(() => window.__world.simulatePick('ramen_machine'));
await t.sleep(600);
assert.ok(await page.locator('.scrim:not(.word-scrim):not(.hud-scrim)').count(), 'the ramen ticket panel is open');
await closePanel();
await page.evaluate(() => window.__world.simulatePick('ticket'));
await t.sleep(600);
assert.ok(await page.locator('.scrim:not(.word-scrim):not(.hud-scrim)').count(), 'the station ticket panel is open');
await closePanel();
assert.equal(await page.locator('.scrim').count(), 0, 'panels closed');
// a second tap on the vending machine opens the panel without the word card
await page.evaluate(() => window.__world.simulatePick('vending'));
await t.sleep(500);
assert.equal(await page.locator('.word-scrim').count(), 0, 'no word card the second time');
await closePanel();

t.step('a door that is not open says so');
await page.evaluate(() => window.__world.simulatePick('door:mio'));
await t.sleep(400);
assert.ok((await page.locator('.toast, [role=status]').allInnerTexts()).join(' ').includes('まだ入れません'), 'the tooltip says 「まだ入れません」');

t.step('menu: the game group above the three original entries');
await page.locator('.icon-btn.glass').first().click();
await t.sleep(300);
const menuIds = await page.locator('.hud-menu-wrap [data-menu]').evaluateAll((els) => els.map((e) => e.getAttribute('data-menu')));
assert.deepEqual(menuIds, ['quests', 'wallet', 'lessons', 'vocab', 'stats', 'settings'], 'menu entries of a fresh profile (no Friends before Chapter 3, no Phone before it is owned)');
assert.equal(await page.locator('.menu button').count(), 3, 'the original .menu keeps its three entries');
await t.shot('05-menu');
await assertInside('menu');
await assertTargets('.hud-menu button, .menu button', 'menu');
await page.locator('[data-menu=quests]').click();
await page.waitForSelector('.panel');
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().screen), 'quests');
await page.evaluate(() => window.__lw.useStore.getState().go('world'));
await t.sleep(500);

t.step('the Lessons entry opens the Greetings lesson directly while it is the only lesson');
await page.locator('.icon-btn.glass').first().click();
await page.locator('[data-menu=lessons]').click();
await t.sleep(500);
const lessonOrSheet = (await page.locator('.lesson').count()) + (await page.locator('.hud-sheet').count());
assert.ok(lessonOrSheet > 0, 'Lessons opens a lesson or the lesson list');
if (await page.locator('.hud-sheet').count()) await page.locator('.hud-sheet .btn.soft').click();
else await page.evaluate(() => window.__lw.useStore.getState().go('world'));
await t.sleep(500);

t.step('tracker: tapping it walks to the goal (or opens Quests)');
const before = await page.evaluate(() => window.__world.snapshot().player);
await page.locator('.hud-track').click();
await t.sleep(1500);
const after = await page.evaluate(() => ({ player: window.__world.snapshot().player, screen: window.__lw.useStore.getState().screen }));
assert.ok(after.screen !== 'world' || Math.hypot(after.player.x - before.x, after.player.z - before.z) > 0.5, 'the player walks towards the goal');
if (after.screen !== 'world') await page.evaluate(() => window.__lw.useStore.getState().go('world'));
await t.sleep(300);

t.step('after the closing beat: the dream chip joins, still at most 4 elements (once the chapter table is loaded)');
await page.evaluate(() => window.__lw.dispatch({ t: 'beat_done', id: 'b_ch1_close' }));
await t.sleep(400);
if (await page.locator('.hud-dream').count()) {
  const after4 = await page.evaluate(() => ['.hud-wallet', '.hud-track', '.hud-dream', '.lvl', '.hud-phone', '.found'].filter((s) => document.querySelector(`.hud ${s}`)));
  assert.ok(after4.length <= 4, `HUD elements: ${after4.join(' ')}`);
  await assertNoHScroll(page, 'hud with dream chip');
  await assertInside('hud with dream chip');
  await assertTargets('.hud-dream', 'dream chip');
  await t.shot('06-hud-dream');
} else {
  console.log('  no chapter table yet (agent 2F): the dream chip is covered by the unit tests');
}

await assertNoHScroll(page, 'final');
assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('hud e2e ok');
