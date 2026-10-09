// Culture cards end to end in the real UI (docs/GAME_DESIGN.md §10; agent 4F): a card pops up in the world, the ramen conversation unlocks
// cc_itadakimasu in its debrief, the stamp book lists cards (locked silhouettes with hints), and the Say it of a say:true card makes
// `culture_said` tick (objective c2_4: two phrases said).
// Usage: node tools/e2e/game/culture.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('culture');
const { page, arabic } = t;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

await onboard(page, { arabic });
await skipBeats(page).catch(() => {});
await page.locator('.tip .btn.primary').click().catch(() => {});

// 1. a card unlocked in the world pops up over it
t.step('pop-up over the world');
await page.evaluate(() => window.__lw.dispatch({ t: 'culture_seen', id: 'cc_vending' }));
await page.waitForSelector('[data-culture-pop="cc_vending"]', { timeout: 10000 });
await page.waitForFunction(() => getComputedStyle(document.querySelector('.cul-scrim')).opacity === '1', null, { timeout: 20000 });
await t.shot('1-popup');
await assertNoHScroll(page, 'pop-up');
await page.locator('.cul-pop .btn.primary').click();
await page.waitForSelector('[data-culture-pop]', { state: 'detached' });

// 2. the ramen conversation: tapping the suggestions finishes it, and the debrief shows the card
t.step('ramen conversation');
const charLines = () => page.locator('.msg.char').count();
await page.evaluate(() => window.__lw.useUi.getState().startConvo({ scenarioId: 'ramen', characterId: 'kenji', mode: 'guided' }));
await page.waitForSelector('.convo', { timeout: 30000 });
for (let i = 0; i < 40; i++) {
  if (await page.locator('.done-card').count()) break;
  await page.waitForFunction(() => !document.querySelector('.bubble.typing'), null, { timeout: 30000 });
  const n = await charLines();
  const sg = page.locator('.sg');
  if (!(await sg.count())) {
    await t.sleep(400);
    continue;
  }
  await sg.first().click();
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card'), n, { timeout: 30000 }).catch(() => {});
  await t.sleep(250);
}
await page.waitForSelector('.done-card', { timeout: 30000 });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.dbf-culture', { timeout: 30000 });
const cardIds = await page.evaluate(() => Object.keys(window.__lw.getGame().culture));
assert.ok(cardIds.includes('cc_itadakimasu'), `ramen unlocks cc_itadakimasu (have ${cardIds})`);
await page.locator('.dbf-culture').last().scrollIntoViewIfNeeded();
await t.shot('2-debrief-card');
assert.equal(await page.locator('[data-culture-pop]').count(), 0, 'the debrief shows the card itself: no pop-up');

// 3. the stamp book
t.step('stamp book');
await page.locator('.dbf-culture .btn.soft').last().click();
await page.waitForSelector('[data-culture-book]');
const locked = await page.locator('[data-state="locked"]').count();
const total = cardIds.length + locked;
assert.equal(total, 19, 'the book lists the 19 earnable cards');
await t.shot('3-book-top');
await assertNoHScroll(page, 'stamp book');
await page.locator('.cul-grid').scrollIntoViewIfNeeded();
await page.locator('[data-card="cc_gift"]').scrollIntoViewIfNeeded();
await t.shot('3-book-locked');

// 4. Say it on the ramen card, then on the bow card (unlocked through the event the Hanako chat raises)
t.step('say it');
async function sayCard(id, typed) {
  await page.locator(`[data-card="${id}"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-card="${id}"]`).click();
  await page.waitForSelector(`[data-culture-detail="${id}"]`);
  await page.waitForSelector('.cul-say .prep-input');
  await t.shot(`4-detail-${id}`);
  await page.fill('.cul-say .prep-input', typed);
  await page.locator('.cul-say .send').click();
  await page.waitForSelector('.cul-say .prep-verdict.ok');
  await t.shot(`4-said-${id}`);
  await assertNoHScroll(page, `detail ${id}`);
  await page.locator('.cul-back').click();
  await page.waitForSelector('[data-culture-book]');
}
await sayCard('cc_itadakimasu', 'いただきます');
let g = await liveGame(page);
assert.deepEqual(g.stats.cultureSaid, ['cc_itadakimasu']);
await page.evaluate(() => window.__lw.dispatch({ t: 'culture_seen', id: 'cc_bow' }));
assert.equal(await page.locator('[data-culture-pop]').count(), 0, 'no pop-up over the stamp book itself');
await page.waitForSelector('[data-card="cc_bow"][data-state="seen"]');
await sayCard('cc_bow', 'yoroshiku onegaishimasu');
g = await liveGame(page);
assert.equal(new Set(g.stats.cultureSaid).size, 2, 'two phrases said: c2_4 is met');
assert.ok(await page.locator('[data-card="cc_bow"][data-state="said"]').count(), 'the stamp shows it as said');
await page.locator('[data-culture-said]').scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('.panel-body')?.scrollTo(0, 0));
await t.shot('5-book-after');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('culture e2e OK');
