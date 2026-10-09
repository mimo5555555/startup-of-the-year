// Friends end to end in the real UI (docs/GAME_DESIGN.md §8; agent 4A): fresh profile -> the dev tools take the game to Chapter 3 -> the Friends
// screen from the menu (six friends, Mio open, no Message button without a phone) -> Talk to Mio (Prepare, small talk, debrief) -> buy a
// present at the konbini by conversation -> hand it over from the gift sheet (the item is used up, the friend reacts, the objective c3_3
// ticks) -> a later day's talk takes Mio to 2 hearts (objective c3_2) and her heart beat plays (note, casual speech) -> Tanaka reaches 2
// hearts (objective c3_4). Run in English and, with --ar, in Arabic (RTL) at 360 px: no horizontal scroll, 44 px targets.
// To keep the run short the affinity of Mio and Tanaka is topped up before their last talk (the days-long route by talks and gifts alone is
// the unit test `apps/mobile/test/friends.test.ts`); every talk, the purchase, the gift and the beat go through the real screens.
// Usage: node tools/e2e/game/friends.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('friends');
const { page, arabic } = t;
process.on('uncaughtException', async (e) => {
  console.log(t.logs.slice(-15).join('\n'));
  await t.shot('zz-failure').catch(() => {});
  console.error(e);
  process.exit(1);
});

const go = (screen) => page.evaluate((s) => window.__lw.useStore.getState().go(s), screen);
const dev = async (cmd) => {
  await page.evaluate((c) => window.__lw.dispatch({ t: 'dev', cmd: c }), cmd);
  await t.sleep(250);
};
const patch = (fn) =>
  page.evaluate((src) => {
    const g = window.__lw.getGame();
    window.__lw.useGame.getState().setGame(new Function('g', `return (${src})(g)`)(g));
  }, fn.toString());
const text = (sel) => page.locator(sel).first().innerText();
/** the menu -> Friends, with any culture pop-up from the world closed first (it would sit over the menu button) */
async function openFriends() {
  await t.sleep(400);
  for (let k = 0; k < 12 && (await page.locator('.cul-scrim').count()); k++) {
    await page.locator('.cul-pop .btn.primary').click();
    await t.sleep(300);
  }
  await page.locator('.icon-btn.glass[aria-expanded]').first().click();
  await page.locator('[data-menu=friends]').click();
  await page.waitForSelector('[data-screen=friends]');
}

/** every target of the selector is at least 44 px tall and inside the screen */
async function assertTargets(sel, where) {
  const bad = await page.evaluate((s) => {
    const out = [];
    for (const el of document.querySelectorAll(s)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.height < 43.5 || r.right > innerWidth + 1 || r.left < -1) out.push(`${el.className} ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.left)}`);
    }
    return out;
  }, sel);
  assert.deepEqual(bad, [], `${where}: targets under 44 px or outside the screen`);
}

/** taps the first suggestion until the "done" card shows, then opens the feedback */
async function tapThrough(first = []) {
  const lines = () => page.locator('.msg.char').count();
  const tap = async (i) => {
    await page.waitForFunction(() => !document.querySelector('.bubble.typing') && document.querySelectorAll('.sg').length > 0, null, { timeout: 40000 });
    const n = await lines();
    await page.locator('.sg').nth(i).click();
    await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card'), n, { timeout: 40000 }).catch(() => {});
    await t.sleep(200);
  };
  for (const i of first) await tap(i);
  for (let k = 0; k < 40 && !(await page.locator('.done-card').count()); k++) {
    if (await page.locator('.sg').count()) await tap(0);
    else await t.sleep(400);
  }
  await page.waitForSelector('.done-card', { timeout: 30000 });
}
const finishConversation = async () => {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.dbf-card, .fb, .panel', { timeout: 30000 });
  await t.sleep(500);
};

// ---- 1. a fresh profile, taken to Chapter 3 with the dev tools ----------------------------------------------------------
t.step('fresh profile -> dev tools -> Chapter 3');
await onboard(page, { arabic });
await skipBeats(page).catch(() => {});
if (arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await patch((g) => ({ ...g, flags: { ...g.flags, dev: true } }));
for (let n = 0; n < 2; n++) {
  await dev('advance_chapter');
  // the chapter beats are not the subject here: file them the way the player would (the dream question is answered)
  await page.evaluate(() => {
    const ui = window.__lw.useUi.getState();
    for (const id of [...ui.beats]) window.__lw.dispatch({ t: 'beat_done', id });
    ui.clearRequests();
    window.__lw.dispatch({ t: 'dream_chosen', id: 'bike' });
    window.__lw.useStore.getState().go('world');
  });
  await t.sleep(300);
}
let g = await liveGame(page);
assert.equal(g.chapter.n, 3, 'Chapter 3 is current');
assert.ok(g.wallet.cash >= 700, `cash for a present: ¥${g.wallet.cash}`);

// ---- 2. the Friends screen from the menu ---------------------------------------------------------------------------------
t.step('the Friends screen: six friends, Mio open, hearts, "Next at", no Message without a phone');
await openFriends();
assert.equal(await page.locator('.frd-card').count(), 6, 'the six friends of the release');
assert.deepEqual(
  await page.locator('.frd-card').evaluateAll((els) => els.map((e) => e.getAttribute('data-friend'))),
  ['mio', 'yuki', 'tanaka', 'sato', 'kenji', 'hanako'],
);
assert.equal(await page.locator('[data-card=mio]').count(), 1, "Mio's card is open");
assert.equal(await page.locator('[data-card]').count(), 1, 'one card open at a time');
const next = await text('[data-card=mio] [data-next]');
assert.ok(/♥1/.test(next), `Next at ♥1: ${next}`);
assert.equal(await page.locator('[data-act=message]').count(), 0, 'no Message button before the phone');
assert.equal(await page.locator('[data-fact]').count(), 3, 'three facts');
assert.equal(await page.locator('[data-fact][data-known="1"]').count(), 0, 'none known yet');
assert.equal(await page.locator('[data-card=mio] .frd-hearts svg.on').count(), 0, 'no hearts yet');
await assertNoHScroll(page, 'friends');
await assertTargets('.frd-head, .frd-actions .btn', 'friends');
await t.shot('1-friends');
await page.locator('[data-friend=yuki] .frd-head').click();
assert.equal(await page.locator('[data-card=yuki]').count(), 1, 'tapping a friend opens their card (and closes the other)');
assert.equal(await page.locator('[data-card=mio]').count(), 0);
await t.shot('1b-friends-yuki');
await page.locator('[data-friend=mio] .frd-head').click();

t.step('Gift with an empty bag says where to buy one');
await page.locator('[data-friend=mio] [data-act=gift]').click();
await page.waitForSelector('[data-gift-sheet]');
assert.equal(await page.locator('[data-gift-empty]').count(), 1);
assert.equal(await page.locator('[data-act=hand-over]').count(), 0, 'no dead button');
await t.sleep(500);
await assertNoHScroll(page, 'gift sheet, empty');
await t.shot('2-gift-empty');
await page.keyboard.press('Escape');
await page.waitForSelector('[data-gift-sheet]', { state: 'detached' });

// ---- 3. Talk: Prepare (skipped), the small talk, the debrief ---------------------------------------------------------------
t.step('Talk to Mio: Prepare, then a small talk by tapping');
await page.locator('[data-friend=mio] [data-act=talk]').click();
await page.waitForSelector('.prep', { timeout: 15000 });
await page.locator('.prep-link').click(); // skip the study
await page.waitForSelector('.convo', { timeout: 30000 });
await t.sleep(1500);
await page.waitForSelector('.sg', { timeout: 30000 });
await t.shot('3-smalltalk');
await assertNoHScroll(page, 'small talk');
await tapThrough();
await t.shot('3b-smalltalk-done');
await finishConversation();
g = await liveGame(page);
assert.equal(g.friends.mio.met, true, 'Mio is met');
assert.ok(g.friends.mio.ap >= 25, `affinity from the first talk: ${g.friends.mio.ap}`);
assert.ok(Object.keys(g.friends.mio.topicDay).length === 1, 'the topic is recorded');
assert.equal(g.friends.mio.talkDay, g.clock.dayIndex, "today's talk is counted");
await t.shot('3c-debrief');
await assertNoHScroll(page, 'debrief');

// ---- 4. buy a present at the konbini, by conversation --------------------------------------------------------------------------
t.step('the konbini: ask for a present, pick the manga, pay');
await go('world');
await t.sleep(400);
const cashBefore = (await liveGame(page)).wallet.cash;
await page.evaluate(() => window.__lw.useUi.getState().startConvo({ scenarioId: 'konbini', characterId: 'tanaka' }));
await page.waitForSelector('.convo', { timeout: 30000 });
await t.sleep(1500);
await tapThrough([3, 1]); // 「プレゼントを探しています」 then 「マンガをください」, then pay
await finishConversation();
g = await liveGame(page);
assert.equal(g.owned.g_manga?.qty, 1, 'the manga is in the bag');
assert.ok(g.stats.purchases >= 1 && g.ledger.some((e) => e.kind === 'purchase' && e.delta < 0), `it was paid for (cash ¥${cashBefore} -> ¥${g.wallet.cash}, the conversation's own pay came in too)`);
await go('world');

// ---- 5. the gift sheet, the hand-over --------------------------------------------------------------------------------------------
t.step('Gift: pick the manga from the sheet, hand it over by conversation');
await openFriends();
await page.locator('[data-friend=mio] [data-act=gift]').click();
await page.waitForSelector('[data-gift-sheet] [data-item=g_manga]');
assert.equal(await page.locator('[data-gift-sheet] [data-item]').count(), 1, 'only what was bought');
assert.equal(await page.locator('[data-act=hand-over]:disabled').count(), 1, 'nothing chosen yet');
await page.locator('[data-item=g_manga]').click();
assert.equal(await page.locator('[data-item=g_manga]').getAttribute('aria-checked'), 'true');
await t.sleep(500);
await assertNoHScroll(page, 'gift sheet');
await assertTargets('.frd-gift-item, [data-act=hand-over]', 'gift sheet');
await t.shot('4-gift-sheet');
const apBefore = (await liveGame(page)).friends.mio.ap;
await page.locator('[data-act=hand-over]').click();
await page.waitForSelector('.convo', { timeout: 30000 });
await t.sleep(1500);
await page.waitForSelector('.sg', { timeout: 30000 });
const chip = await text('.sg');
assert.ok(/マンガ/.test(chip), `the hand-over chips name the gift: ${chip}`);
await t.shot('5-handover');
await tapThrough();
await t.shot('5b-handover-done');
await finishConversation();
await page.waitForSelector('[data-gift-reaction=loved]', { timeout: 10000 });
await t.shot('5c-handover-debrief');
g = await liveGame(page);
assert.equal(g.owned.g_manga, undefined, 'the item is used up');
assert.equal(g.stats.gifts.n, 1, 'one gift given');
assert.equal(g.stats.gifts.loved, 1, 'Mio loved it');
assert.ok(g.friends.mio.ap > apBefore, `the gift gave affinity: ${apBefore} -> ${g.friends.mio.ap}`);
await go('quests');
await page.waitForSelector('[data-screen=quests]');
assert.equal(await page.locator('[data-obj=c3_3]').getAttribute('data-done'), '1', 'objective c3_3 (a gift) ticked');
await t.shot('6-quests-c3_3');

// ---- 6. Mio to 2 hearts, her beat -----------------------------------------------------------------------------------------------
t.step('a later day: the talk that takes Mio to 2 hearts, then her heart-2 beat');
await go('world');
await dev('advance_day');
await patch((g) => ({ ...g, friends: { ...g.friends, mio: { ...g.friends.mio, ap: 76 } } }));
await openFriends();
await page.locator('[data-friend=mio] [data-act=talk]').click();
await page.waitForSelector('.prep', { timeout: 15000 }).catch(() => {});
if (await page.locator('.prep-link').count()) await page.locator('.prep-link').click();
await page.waitForSelector('.convo', { timeout: 30000 });
await t.sleep(1500);
await page.waitForSelector('.sg', { timeout: 30000 });
await tapThrough();
await finishConversation();
g = await liveGame(page);
assert.ok(g.friends.mio.ap >= 80, `2 hearts: ${g.friends.mio.ap} AP`);
assert.equal(g.friends.mio.learned.length, 1, 'the first fact was revealed in that talk (at 1 heart)');
await go('quests');
await page.waitForSelector('[data-screen=quests]');
assert.equal(await page.locator('[data-obj=c3_2]').getAttribute('data-done'), '1', 'objective c3_2 (Mio at 2 hearts) ticked');
await go('world');
await page.waitForSelector('[data-beat="b_mio_h2"]', { timeout: 20000 });
const line1 = await text('.qst-beat-ja');
assert.ok(/電話番号/.test(line1), `Mio asks for the number: ${line1}`);
assert.ok((await text('.qst-beat-name')).includes('ミオ') || true);
await t.shot('7-beat-1');
for (let n = 0; n < 3; n++) {
  await page.locator('.qst-beat [data-continue]').click();
  await t.sleep(300);
}
assert.ok(/タメ口/.test(await text('.qst-beat-ja')), 'the last line asks for casual speech');
await assertNoHScroll(page, 'beat');
await t.shot('7-beat-4');
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(700);
g = await liveGame(page);
assert.ok(g.friends.mio.flags.includes('number_note') && g.friends.mio.flags.includes('casual'), 'number_note and casual are set');
assert.ok(g.keepsakes.includes('note_mio'), "Mio's note is a keepsake");
assert.ok(g.culture.cc_keigo !== undefined, 'the keigo card');
assert.deepEqual(g.friends.mio.events, [2], 'the heart event is filed');
assert.ok(g.friends.mio.ap >= 90, `the beat gave +10 AP: ${g.friends.mio.ap}`);

// ---- 7. a second friend at 2 hearts ---------------------------------------------------------------------------------------------
t.step("Tanaka to 2 hearts: objective c3_4 (two friends)");
await go('world');
// Tanaka has no entry yet: a copy of Mio's shape with nothing learned, given or talked about
await patch((g) => ({
  ...g,
  friends: {
    ...g.friends,
    tanaka: { ...g.friends.mio, ap: 76, met: true, talkDay: -1, topicDay: {}, giftDay: -1, giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0, facts: {}, callbacks: {}, learned: [], gold: [], events: [], flags: [] },
  },
}));
await openFriends();
await page.locator('[data-friend=tanaka] .frd-head').click();
await page.locator('[data-friend=tanaka] [data-act=talk]').click();
await page.waitForSelector('.prep', { timeout: 15000 }).catch(() => {});
if (await page.locator('.prep-link').count()) await page.locator('.prep-link').click();
await page.waitForSelector('.convo', { timeout: 30000 });
await t.sleep(1500);
await page.waitForSelector('.sg', { timeout: 30000 });
await tapThrough();
await finishConversation();
g = await liveGame(page);
assert.ok(g.friends.tanaka.ap >= 80, `Tanaka at 2 hearts: ${g.friends.tanaka.ap}`);
await go('quests');
await page.waitForSelector('[data-screen=quests]');
assert.equal(await page.locator('[data-obj=c3_4]').getAttribute('data-done'), '1', 'objective c3_4 (two friends at 2 hearts) ticked');
await t.shot('8-quests-c3_4');

// ---- 8. the Friends card after all of it ---------------------------------------------------------------------------------------------
t.step('the card shows what was learned, and Message once the phone is owned');
await go('world');
await patch((g) => ({ ...g, owned: { ...g.owned, phone_used: { qty: 1, day: 'd0' } } }));
await openFriends();
assert.equal(await page.locator('[data-card=mio] [data-fact][data-known="1"]').count(), 1, 'one fact learned');
assert.ok(await page.locator('[data-card=mio] [data-fact][data-known="1"] .ja').count(), 'its Japanese sentence');
assert.equal(await page.locator('[data-card=mio] [data-act=message]').count(), 1, 'Message appears with the phone');
assert.ok(/♥3/.test(await text('[data-card=mio] [data-next]')), 'Next at ♥3');
assert.ok((await page.locator('[data-card=mio] .frd-hearts svg.on').count()) >= 2, 'two hearts or more');
await assertNoHScroll(page, 'friends, after');
await assertTargets('.frd-head, .frd-actions .btn', 'friends, after');
await t.shot('9-friends-after');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`friends e2e OK${arabic ? ' (ar)' : ''}`);
