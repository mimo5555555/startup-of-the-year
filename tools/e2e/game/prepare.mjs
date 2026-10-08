// Prepare end to end in the real UI (agent 2E, docs/GAME_DESIGN.md §11.1, §11.3, §11.5): the konbini pocket studied, then recalled with
// the Japanese hidden (typed in romaji, kana for kanji, built from tiles, one line peeked at), the readiness the game stores, the
// +10% reaching the conversation, the 7-day expiry, Skip, the Real toggle after Chapter 1, and the hidden-line echo in the debrief
// (¥20 for a pass, nothing for a Peek). Screenshots at 360 px in English or Arabic.
// Usage: node tools/e2e/game/prepare.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { DAY_MS, assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('prepare');
const { page } = t;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

const openPrepare = (scenarioId, characterId) =>
  page.evaluate(
    ([s, c]) => {
      window.__lw.useUi.getState().setArgs('prepare', { scenarioId: s, characterId: c });
      window.__lw.useStore.getState().go('prepare');
    },
    [scenarioId, characterId],
  );
const stage = () => page.locator('.prep').getAttribute('data-stage');
const footPrimary = () => page.locator('.prep-foot .btn.primary');
const prep = async () => (await liveGame(page)).prep;
const submit = async (text) => {
  await page.fill('.prep-input', text);
  await page.keyboard.press('Enter');
};
const KONBINI = ['p_konbini_1', 'p_konbini_2', 'p_konbini_3', 'p_konbini_4'];

t.step('fresh profile');
await onboard(page, { arabic: t.arabic });
await t.sleep(2000);
await skipBeats(page).catch(() => {});

// ---- study ---------------------------------------------------------------------------------------------------------
t.step('open Prepare for the konbini: four lines to study, nothing ready, no Real toggle in Chapter 1');
await openPrepare('konbini', 'tanaka');
await page.waitForSelector('.prep[data-stage="study"]');
if (t.arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl in Arabic');
assert.equal(await page.locator('.prep-card[data-line]').count(), 1, 'one study card at a time');
assert.equal(await page.locator('.prep-mode').count(), 0, 'Guided/Real appears only after Chapter 1');
assert.ok((await page.locator('.prep-card .ja').first().innerText()).includes('これ'), 'the first line is これをください');
assert.equal(await page.locator('.prep-key').count(), 1, 'a key line is marked');
await assertNoHScroll(page, 'study');
await t.shot('01-study');
for (let i = 0; i < 3; i++) await footPrimary().click();
await t.sleep(200);
assert.equal(await page.locator('.prep-card[data-line]').count(), 1);
await t.shot('02-study-last');
await footPrimary().click(); // Test yourself

// ---- recall --------------------------------------------------------------------------------------------------------
t.step('recall: the Japanese is hidden, the meaning and a replay button show');
await page.waitForSelector('.prep[data-stage="recall"]');
let g = await prep();
for (const id of KONBINI) assert.equal(g[id]?.s, 'seen', `${id} is studied after the study step`);
assert.equal(await page.locator('.prep-hidden').count(), 1, 'the line is hidden');
assert.equal(await page.locator('.prep-say .ja').count(), 0, 'no Japanese text on screen');
assert.equal(await footPrimary().isDisabled(), true, 'Next waits for a pass or a Peek');
await assertNoHScroll(page, 'recall');
await t.shot('03-recall-hidden');

t.step('line 1 typed in romaji (a near miss first: it is free to retry)');
// a wrong line must not pass, and trying again is free
await submit('ikura desu ka');
await page.waitForSelector('.prep-verdict.near');
await t.shot('04-near-miss');
await submit('kore o kudasai');
await page.waitForSelector('.prep-verdict.ok');
assert.equal(await page.locator('.prep-say .ja').count(), 1, 'the line is shown after a pass');
await t.shot('05-pass');
await footPrimary().click();

t.step('line 2 (a key line) peeked at: studied, never ready');
await page.waitForSelector('.prep-hidden');
await page.locator('.prep-say .prep-row .btn').nth(1).click();
await page.waitForSelector('.prep-verdict.peek');
await t.shot('06-peek');
assert.equal(await page.locator('.prep-input').count(), 0, 'no more attempts after a Peek');
await footPrimary().click();

t.step('line 3 typed in kana for a kanji line; line 4 built from the tiles');
await page.waitForSelector('.prep-hidden');
await submit('ふくろはいりません');
await page.waitForSelector('.prep-verdict.ok');
await footPrimary().click();
await page.waitForSelector('.prep-hidden');
await page.locator('.prep-say .prep-link').click();
await page.waitForSelector('.prep-tile');
const deck = await page.locator('.prep-tiles .prep-tile').allTextContents();
assert.equal(deck.length, 5, 'three pieces and two that do not belong');
await t.shot('07-tiles');
await assertNoHScroll(page, 'tiles');
for (const piece of ['カード', 'で', 'お願いします。']) await page.locator('.prep-tiles .prep-tile', { hasText: new RegExp(`^${piece}$`) }).click();
await page.waitForSelector('.prep-verdict.ok');
await footPrimary().click(); // See results

// ---- what the game stored ------------------------------------------------------------------------------------------
t.step('the game: lines 1, 3, 4 ready; the peeked key line only studied; so the pocket is not ready yet');
await page.waitForSelector('.prep[data-stage="done"]');
g = await prep();
assert.equal(g.p_konbini_1.s, 'ready');
assert.equal(g.p_konbini_2.s, 'seen', 'a peek never makes a line ready');
assert.equal(g.p_konbini_3.s, 'ready');
assert.equal(g.p_konbini_4.s, 'ready');
assert.equal(await page.locator('.prep-card[data-ready]').getAttribute('data-ready'), '0');
assert.equal(await page.locator('.prep-status.ready').count(), 3);
const vocab = await page.evaluate(() => window.__lw.useStore.getState().vocab.filter((v) => v.key?.startsWith('p_konbini_')));
assert.equal(vocab.length, 4, 'a phrase card per studied line');
assert.ok(vocab.every((v) => v.source === 'goal' && Date.parse(v.card.due) > Date.now() + 20 * 3600_000), 'goal cards, first due tomorrow');
await assertNoHScroll(page, 'done, not yet');
await t.shot('08-done-not-ready');

t.step('practise again: only the peeked line is asked; passing it makes the pocket ready');
await page.locator('.prep-foot .btn.soft').click();
await page.waitForSelector('.prep[data-stage="recall"]');
assert.equal(await page.locator('.prep-count').innerText().then((s) => s.replace(/\D+/g, ' ').trim()), '1 1');
await submit('いくらですか');
await page.waitForSelector('.prep-verdict.ok');
await footPrimary().click();
await page.waitForSelector('.prep-card[data-ready="1"]');
g = await prep();
assert.equal(g.p_konbini_2.s, 'ready');
await t.shot('09-done-ready');
assert.equal(await page.locator('.prep-foot .btn.primary').count(), 1);

t.step('reopening a ready pocket shows the one-line "You\'re ready"; after 7 days it is studied again');
await page.locator('.prep-foot .btn.soft').click();
await page.waitForSelector('.prep[data-stage="study"]');
await openPrepare('konbini', 'tanaka');
await page.waitForSelector('.prep[data-stage="study"], .prep[data-stage="ready"]');
await page.evaluate(() => window.__lw.useStore.getState().go('world'));
await t.sleep(300);
await openPrepare('konbini', 'tanaka');
await t.sleep(400);
assert.equal(await stage(), 'ready', 'a fresh pocket is shown as ready');
await t.shot('10-ready-banner');
await page.evaluate((d) => {
  const g = window.__lw.getGame();
  window.__lw.useGame.getState().setGame({ ...g, clock: { ...g.clock, dayIndex: g.clock.dayIndex + d } });
}, 7);
await page.evaluate(() => window.__lw.useStore.getState().go('world'));
await t.sleep(300);
await openPrepare('konbini', 'tanaka');
await t.sleep(400);
assert.equal(await stage(), 'study', 'after 7 days the stamps are gone and the pocket is studied again');
await page.evaluate((d) => {
  const g = window.__lw.getGame();
  window.__lw.useGame.getState().setGame({ ...g, clock: { ...g.clock, dayIndex: g.clock.dayIndex - d } });
}, 7);

// ---- Real toggle ----------------------------------------------------------------------------------------------------
t.step('after Chapter 1 the Guided/Real toggle appears, and Start carries the mode');
await page.evaluate(() => {
  const g = window.__lw.getGame();
  window.__lw.useGame.getState().setGame({ ...g, chapter: { ...g.chapter, n: 2 } });
  window.__lw.useStore.getState().go('world');
});
await t.sleep(300);
await openPrepare('cafe', 'yuki');
await page.waitForSelector('.prep-mode');
assert.equal(await page.locator('.prep-mode-btn').count(), 2);
await page.locator('.prep-mode-btn').nth(1).click();
assert.equal(await page.locator('.prep-mode-btn').nth(1).getAttribute('aria-checked'), 'true');
await assertNoHScroll(page, 'mode toggle');
await t.shot('11-mode-toggle');

t.step('Skip is one tap: it starts the conversation in the chosen mode and asks for nothing');
await page.locator('.prep-foot .prep-link').click();
await page.waitForFunction(() => window.__lw.useUi.getState().convo?.scenarioId === 'cafe');
const convo = await page.evaluate(() => window.__lw.useUi.getState().convo);
assert.equal(convo.mode, 'real');
assert.equal((await prep()).p_cafe_1, undefined, 'skipping before studying prepares nothing');
await page.evaluate(() => window.__lw.useUi.getState().endConvo());
await t.sleep(300);

// ---- the conversation and the debrief echo ------------------------------------------------------------------------
t.step('cafe: prepare all four lines, play the café with the chips, then echo in the debrief');
await page.evaluate(() => {
  window.__lw.dispatch({ t: 'prepare_done', scenarioId: 'cafe', ready: ['p_cafe_1', 'p_cafe_2', 'p_cafe_3', 'p_cafe_4'], seen: ['p_cafe_1', 'p_cafe_2', 'p_cafe_3', 'p_cafe_4'] });
  window.__lw.useStore.getState().go('world');
  window.__lw.useUi.getState().startConvo({ scenarioId: 'cafe', characterId: 'yuki', mode: 'guided' });
});
const lineAfter = async (n) => {
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k && !document.querySelector('.bubble.typing'), n, { timeout: 30000 });
  await t.sleep(250);
};
await page.waitForSelector('.convo');
await lineAfter(0);
for (const i of [0, 0, 1, 0, 1]) {
  const n = await page.locator('.msg.char').count();
  await page.locator('.sg').nth(i).click();
  await lineAfter(n);
}
await page.waitForSelector('.done-card', { timeout: 30000 });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-keep');
assert.match(await page.locator('.feedback').innerText(), /10%/, 'the pay rows say the pocket was ready (+10%)');
const echoes = page.locator('.prep-echo-open');
assert.ok((await echoes.count()) >= 2, 'a Say it button on each kept line');
const cashBefore = (await liveGame(page)).wallet.cash;
const words = await page.locator('.dbf-keep').first().locator('.dbf-keep-line .ja .jp').allTextContents();
await echoes.first().scrollIntoViewIfNeeded();
await echoes.first().click();
await page.waitForSelector('.prep-echo .prep-hidden');
await assertNoHScroll(page, 'debrief echo open');
await t.shot('12-echo-open');
await submit(words.join(''));
await page.waitForSelector('.prep-echo .prep-verdict.ok');
await t.sleep(300);
const afterPass = await liveGame(page);
assert.equal(afterPass.wallet.cash, cashBefore + 20, 'a passed echo pays ¥20');
assert.ok(afterPass.ledger.some((e) => e.kind === 'echo'), 'the ledger has the echo');
await t.shot('13-echo-paid');

const vocabBefore = await page.evaluate(() => window.__lw.useStore.getState().vocab.length);
const second = page.locator('.prep-echo-open').first();
await second.scrollIntoViewIfNeeded();
await second.click();
await page.locator('.prep-echo:not([data-phase="said"]) .prep-say .prep-row .btn').nth(1).click();
await page.waitForSelector('.prep-echo[data-phase="peeked"]');
await t.sleep(300);
const afterPeek = await liveGame(page);
assert.equal(afterPeek.wallet.cash, afterPass.wallet.cash, 'a Peek pays nothing');
assert.ok((await page.evaluate(() => window.__lw.useStore.getState().vocab.length)) > vocabBefore, 'a Peek still makes the card');
await t.shot('14-echo-peeked');

// ---- the checked review ----------------------------------------------------------------------------------------------
t.step('Vocab review: a due card reviewed before can be answered by typing, and that counts as a checked review');
await page.evaluate(() => {
  const st = window.__lw.useStore;
  const v = st.getState().vocab.find((x) => x.key === 'p_konbini_1');
  const due = new Date(Date.now() - 1000).toISOString();
  // an earlier review (reps >= 1) and due now; "produce" mode is on odd reps
  const later = new Date(Date.now() + 86_400_000).toISOString();
  // only this card is due, so it is the first in the queue
  st.setState({ vocab: st.getState().vocab.map((x) => (x.id === v.id ? { ...x, card: { ...x.card, reps: 1, due } } : { ...x, card: { ...x.card, due: later } })) });
  st.getState().go('vocab');
});
await page.waitForSelector('.review');
const before = await page.evaluate(() => Object.values(window.__lw.getGame().daily.counters).reduce((s, d) => s + (d.review_checked ?? 0), 0));
const typedInput = page.locator('.prep-review-type .prep-input');
assert.equal(await typedInput.count(), 1, 'the due card is in produce mode with a typed check');
{
  await t.shot('15-review-type');
  await typedInput.fill('kore o kudasai');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.rate-grid');
  await page.locator('.rate.good').click();
  await t.sleep(300);
  const after = await page.evaluate(() => Object.values(window.__lw.getGame().daily.counters).reduce((s, d) => s + (d.review_checked ?? 0), 0));
  assert.equal(after, before + 1, 'a typed answer on a due, already-reviewed card counts for the daily goal');
}

await assertNoHScroll(page, 'vocab review');
assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('prepare e2e ok');
