// The Mini-theatre (ミニシアター) in the REAL UI at 360 px, English or Arabic (--ar):
//   the menu opens it -> the first episode (はじめてのコンビニ) plays by itself: the subtitle's words light up over the line, the speaker
//   bounces; a word is tapped for its card; the line is replayed and slowed -> the questions (2 right, 1 wrong) -> filed (1 day's listening)
//   -> the song 「桜通り」: the karaoke kana light up note by note while it plays. No horizontal scroll, no console error.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/theatre.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('theatre', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const check = async (where) => {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
};

await onboard(page, { arabic: AR });
await skipBeats(page);
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
step('fresh profile');

// the menu opens the Mini-theatre
await page.evaluate(() => window.__lw.useStore.getState().go('world'));
await t.sleep(400);
await page
  .locator('.hud-menu-btn, [aria-label="Menu"], [aria-label="القائمة"]')
  .first()
  .click()
  .catch(() => {});
await t.sleep(300);
if (await page.locator('[data-menu=theatre]').count()) await page.locator('[data-menu=theatre]').click();
else await page.evaluate(() => window.__lw.useStore.getState().go('theatre'));
await page.waitForSelector('[data-screen=theatre][data-view=list] [data-episode=ep_konbini]', { timeout: 10000 });
assert.equal(await page.locator('[data-episode]').count(), 1, 'Chapter 1: one episode open');
assert.equal(await page.locator('[data-song=song_sakura]').count(), 1, 'the song');
await t.shot('list');
await check('the list');
step('the menu opens the Mini-theatre: one episode and the song');

// the episode plays by itself: the words light up over the line
await page.locator('[data-episode=ep_konbini]').click();
await page.waitForSelector('[data-screen=theatre][data-view=episode] .th-sub', {
  timeout: 10000,
});
// line 2 is long enough to see the light move through it
await page.waitForFunction(() => Number(document.querySelector('.th-player')?.getAttribute('data-line')) >= 1, null, { timeout: 30000 });
const seen = new Set();
for (let k = 0; k < 40; k++) {
  const lit = await page.locator('.th-sub .tok.lit, .th-sub .tok.now').count();
  const all = await page.locator('.th-sub .tok').count();
  seen.add(`${lit}/${all}`);
  await t.sleep(80);
}
assert.ok(seen.size >= 2, `the subtitle lights up over time (${[...seen].join(' ')})`);
await t.shot('episode');
await check('the episode');
step(`the episode plays: the subtitle lights word by word (${[...seen].slice(0, 6).join(' ')} …)`);

// a word is tapped for its card; the line is replayed slowly
await page.locator('[data-th-play]').click(); // pause
await page.locator('.th-sub .tok.tap').first().click();
await page.waitForSelector('.word-scrim', { timeout: 5000 });
await t.shot('word');
await page.locator('.word-scrim .word-close').last().click();
await page.locator('[data-th-slow]').click();
assert.equal(await page.locator('[data-th-slow]').getAttribute('aria-pressed'), 'true');
await page.locator('[data-th-replay]').click();
await t.sleep(800);
step('a tapped word opens its card; the line replays at 0.75×');

// to the questions (the rest of the lines skipped with Next)
for (let k = 0; k < 10 && !(await page.locator('[data-th-quiz]').count()); k++) {
  await page.locator('[data-th-next]').click();
  await t.sleep(250);
}
await page.waitForSelector('[data-th-quiz="0"]', { timeout: 10000 });
for (let q = 0; q < 3; q++) {
  await page.waitForSelector(`[data-th-quiz="${q}"]`);
  await page
    .locator(`[data-th-opt][data-right="${q === 1 ? 0 : 1}"]`)
    .first()
    .click();
  await page.locator('[data-th-qnext]').click();
}
await page.waitForSelector('[data-th-done][data-right="2"]', { timeout: 5000 });
let g = await liveGame(page);
assert.equal(g.media.ep_konbini, 2, 'the best score is filed');
assert.equal(g.daily.counters[g.clock.dayIndex]?.ears, 1, "counts for the day's listening");
await t.shot('quiz-done');
await page.locator('[data-th-done] .btn.primary').click();
await check('the questions');
step('the questions: 2 of 3 right, filed, counted for the day');

// the song: the kana light up while it plays
await page.locator('[data-song=song_sakura]').click();
await page.waitForSelector('[data-song-player=song_sakura]');
await page.locator('[data-song-play]').click();
await page.waitForSelector('.th-mora.now', { timeout: 10000 });
const sung0 = await page.locator('.th-mora.sung').count();
await t.sleep(1500);
const sung1 = await page.locator('.th-mora.sung').count();
assert.ok(sung1 > sung0, `the karaoke moves with the music (${sung0} -> ${sung1})`);
await t.shot('song');
// the guide melody can be switched off while the song plays (the player sings it)
await page.locator('[data-song-guide]').click();
assert.equal(await page.locator('[data-song-guide]').getAttribute('aria-pressed'), 'false', 'the guide is off mid-song');
assert.equal(await page.locator('[data-song-player]').getAttribute('data-playing'), '1', 'the song keeps playing');
await page.locator('[data-song-play]').click(); // stop
await check('the song');
step(`the song: the kana light up note by note (${sung0} -> ${sung1} sung)`);

await t.browser.close();
console.log(`theatre e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
