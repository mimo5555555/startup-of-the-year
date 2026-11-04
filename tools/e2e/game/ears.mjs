// Listening practice in the REAL UI at 360 px, English or Arabic (--ar):
//   耳トレ from the Quests screen's Today tab: five recorded lines (the voice files are requested), each hidden until answered; four right and
//   one wrong; the reveal shows the Japanese and the meaning; the finish files the day once (ears 1 day, 5 heard, 4 right; the daily `ears`
//   counter); a second session the same day is practice only -> "Listen first" in Settings: a character's line in a conversation is hidden
//   (and cannot be translated) until tapped, then the words show.
// After every step: no horizontal scroll and no console error.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/ears.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, openSettings, skipBeats, start } from './_common.mjs';

const t = await start('ears', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const voiceFiles = [];
page.on('request', (r) => {
  if (/\/voice\/[0-9a-f]+\.mp3/.test(r.url())) voiceFiles.push(r.url());
});
const check = async (where) => {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
};
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);

await onboard(page, { arabic: AR });
await skipBeats(page);
step('fresh profile');

// ---- 耳トレ ----
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'today' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-open=ears][data-done="0"]', { timeout: 10000 });
await page.locator('[data-open=ears]').scrollIntoViewIfNeeded();
await t.shot('quests-card');
await page.locator('[data-open=ears]').click();
await page.waitForSelector('[data-ears-opt]', { timeout: 20000 });
await page.waitForFunction(() => document.querySelector('[data-screen=ears]')?.getAttribute('data-round') === '1');
await t.sleep(800);
assert.ok(voiceFiles.length >= 1, 'the first line plays from a recording');
assert.equal(await page.locator('[data-ears-reveal]').count(), 0, 'the words are hidden before the answer');
await t.shot('round');
await check('ears round 1');
step(`round 1: the line plays from a recording (${voiceFiles.length} file), the words hidden`);

for (let r = 0; r < 5; r++) {
  await page.waitForFunction((n) => document.querySelector('[data-screen=ears]')?.getAttribute('data-round') === String(n), r + 1);
  if (r === 2) {
    const before = voiceFiles.length;
    await page.locator('[data-ears-slow]').click();
    await t.sleep(600);
    assert.ok(voiceFiles.length >= before, 'slower replays');
  }
  await page.locator(`[data-ears-opt][data-right="${r === 4 ? 0 : 1}"]`).first().click();
  await page.waitForSelector('[data-ears-reveal]');
  if (r === 0) await t.shot('reveal');
  await page.locator('[data-ears-next]').click();
}
await page.waitForSelector('[data-ears-done][data-right="4"]');
await t.shot('done');
let g = await liveGame(page);
assert.deepEqual({ days: g.ears.days, heard: g.ears.heard, right: g.ears.right }, { days: 1, heard: 5, right: 4 });
assert.equal(g.daily.counters[g.clock.dayIndex]?.ears, 1, 'the daily ears counter');
await check('ears done');
step('five rounds: 4 right, 1 wrong; filed once (1 day, 5 heard, 4 right), the daily counter ticks');

// a second session the same day: practice
await page.locator('[data-ears-done] .btn.primary').click();
await page.waitForSelector('[data-open=ears][data-done="1"]');
await page.locator('[data-open=ears]').click();
await page.waitForSelector('[data-ears-opt]', { timeout: 20000 });
for (let r = 0; r < 5; r++) {
  await page.waitForFunction((n) => document.querySelector('[data-screen=ears]')?.getAttribute('data-round') === String(n), r + 1);
  await page.locator('[data-ears-opt][data-right="1"]').first().click();
  await page.locator('[data-ears-next]').click();
}
await page.waitForSelector('[data-ears-done][data-right="5"]');
g = await liveGame(page);
assert.equal(g.ears.days, 1, 'the same day counts once');
step('a second session the same day is practice only');

// ---- Listen first ----
await go('world');
await openSettings(page);
await page.locator('.row-switch', { hasText: AR ? 'الاستماع أولًا' : 'Listen first' }).click();
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().settings.listenFirst), true);
await go('world');
await t.sleep(300);
await skipBeats(page);
if (await page.locator('.tip .btn').count()) await page.locator('.tip .btn').first().click();
await page.evaluate(() => window.__world.teleportNear('hanako'));
await t.sleep(500);
await page.evaluate(() => window.__world.teleportNear('yuki'));
await page.waitForFunction(() => window.__world.nearby === 'yuki', null, { timeout: 20000 });
await t.sleep(700);
await page.locator('.talk-btn').click().catch(async (e) => {
  await t.shot('zz-no-talk');
  console.log(await page.evaluate(() => JSON.stringify({ screen: window.__lw.useStore.getState().screen, nearby: window.__world.nearby, convo: !!window.__lw.useUi.getState().convo })));
  throw e;
});
// the first time, "Get ready" comes before the talk: skip it
await t.sleep(800);
if ((await page.evaluate(() => window.__lw.useStore.getState().screen)) === 'prepare') await page.locator('.prep-link').first().click();
await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 }).catch(async (e) => {
  await t.shot('zz-no-line');
  console.log(await page.evaluate(() => JSON.stringify({ screen: window.__lw.useStore.getState().screen, convo: window.__lw.useUi.getState().convo, body: document.body.innerText.slice(0, 400) })));
  throw e;
});
const veil = page.locator('.msg.char [data-veil]').first();
assert.equal(await veil.count(), 1, 'the character line is hidden');
assert.equal(await page.locator('.msg.char').first().locator('.mini[aria-pressed]').isDisabled(), true, 'no translation while hidden');
await t.shot('convo-veiled');
await veil.click();
assert.equal(await page.locator('.msg.char').first().locator('[data-veil]').count(), 0, 'tapped: the words show');
await check('listen first');
step('Listen first: the line is hidden until tapped, then shown');

await t.browser.close();
console.log(`ears e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
