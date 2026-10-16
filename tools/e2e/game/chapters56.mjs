// Release 2 wave C1: Chapters 5 and 6 are playable, told in the REAL UI at 360 px, English or Arabic (--ar):
//   fresh profile -> the dev tools fast-forward to the START of Chapter 5 -> Chapter 5 "Let's Go Out": the train to Hikarigaoka (the round-trip fare
//   charged once and exactly, the CSS station backdrop behind the talk with Kato, trip filed, back at the station) -> ask Sato the way with three
//   lines of my own -> a station shift (Sato's intro, then the board, the plan, the timetable and the fare table, all five customers by tapping)
//   -> browse Nakamura Motors and say I will think about it -> Chapter 5 completes (reward, title, culture cards, beat) -> Chapter 6 "Visiting Homes"
//   (a friend at 3 hearts starts it; Hanako's try-without-chips beat turns the next shop talk into Real mode once) -> 4 hearts and a friend's home ->
//   Aiko's room -> five shifts in total (konbini, café, station) -> Chapter 6 completes -> the epilogue beat -> Free Walk (chapter.n 9).
// Dev tools are used only for yen, hearts, advancing days and the chapter fast-forward. After every step: no horizontal scroll, no console error,
// and the wallet equals the ledger (cash + ic = start + earned - spent, each pocket against its checksum).
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/chapters56.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';
import { jobHelpers } from './_jobs.mjs';

const t = await start('chapters56');
const { page } = t;
const AR = t.arabic;
const DEBUG = !!process.env.DEBUG;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-12).join('\n'));
    await t.shot('zz-failure').catch(() => {});
    console.log('state at the failure:', JSON.stringify(await page.evaluate(() => { const g = window.__lw.getGame(); return { done: Object.keys(g.chapter.done).filter((k) => k.startsWith('c5') || k.startsWith('c6')), mio: g.friends.mio?.ap, active: g.clock.activeDays, chapter: { n: g.chapter.n, flags: g.chapter.flags, began: g.chapter.began }, trip: g.runs.trip_hikarigaoka, visits: g.stats.visits, ledgerTail: g.ledger.slice(-4), clock: g.clock, wallet: g.wallet, screen: window.__lw.useStore.getState().screen, convo: window.__lw.useUi.getState().convo, beats: window.__lw.useUi.getState().beats }; }).catch(() => null)));
    console.error(e);
    process.exit(1);
  });
}
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const { playJob, serveStation, serveCafe } = jobHelpers(page, t);

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};
const patch = (fn) =>
  page.evaluate((src) => {
    const g = window.__lw.getGame();
    window.__lw.useGame.getState().setGame(new Function('g', `return (${src})(g)`)(g));
  }, fn.toString());
const text = (sel) => page.locator(sel).first().innerText();
const fmt = (n) => `¥${n.toLocaleString('en-US')}`;
const hearts = (friend, ap) =>
  patch(
    new Function(
      'g',
      `const f = g.friends[${JSON.stringify(friend)}] ?? { ap: 0, met: true, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
       return { ...g, friends: { ...g.friends, ${JSON.stringify(friend)}: { ...f, met: true, ap: ${ap} } } };`,
    ),
  );

/** After every step: no horizontal scroll, no console error, wallet = ledger (cash + ic = start + earned - spent, each pocket against its checksum). */
async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
  for (const p of ['cash', 'ic', 'points']) assert.equal(g.wallet[p], g.totals.checksum[p], `${where}: ${p} matches its checksum`);
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

// ---------------------------------------------------------------------------------------------------------------
// beats, pop-ups, sheets
// ---------------------------------------------------------------------------------------------------------------

/** Plays every queued story beat by tapping (the dream question is answered with the first dream, the katakana and diary steps are skipped). */
async function beats({ shotIds = [] } = {}) {
  const played = [];
  for (let i = 0; i < 80; i++) {
    if ((await screen()) !== 'beat') return played;
    const id = await page.evaluate(() => document.querySelector('[data-beat]')?.getAttribute('data-beat') ?? '');
    if (!played.includes(id)) played.push(id);
    if (await page.locator('[data-ask=dream] [data-choose]').count()) {
      await page.locator('[data-choose]').first().click();
    } else if (await page.locator('[data-step=nameKana] [data-save]').count()) {
      await page.locator('[data-step=nameKana] [data-save]').click();
    } else if (await page.locator('[data-step=diary] [data-skip], [data-step=diary] .btn.soft').count()) {
      await page.locator('[data-step=diary] .btn.soft').first().click();
    } else if (await page.locator('.qst-beat [data-continue]').count()) {
      if (shotIds.includes(id)) {
        await assertNoHScroll(page, `beat ${id}`);
        await t.shot(`beat-${id}-${i}`);
      }
      await page.locator('.qst-beat [data-continue]').first().click();
    } else if (await page.locator('[data-ask=dream]').count()) {
      await page.locator('[data-ask=dream] .btn').last().click();
    }
    await t.sleep(220);
  }
  throw new Error('story beats did not end');
}

/** Closes whatever is in the way: culture pop-ups, story beats, a word card, an open sheet. Returns the beats that played. */
async function settle(opts) {
  const played = [];
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.cul-scrim').count()) {
      await page.locator('.cul-scrim .btn.primary').click();
      await t.sleep(250);
    } else if ((await screen()) === 'beat') {
      played.push(...(await beats(opts)));
    } else if (await page.locator('.word-scrim .word-close').count()) {
      await page.locator('.word-scrim .word-close').last().click();
      await t.sleep(200);
    } else if (await page.locator('.hud-sheet').count()) {
      await page.keyboard.press('Escape');
      await t.sleep(300);
    } else if ((await screen()) === 'world' && (await page.locator('.tip .btn').count())) {
      await page.locator('.tip .btn').first().click().catch(() => {});
      await t.sleep(200);
    } else return played;
  }
  throw new Error('overlays did not clear');
}

/** Files the beats of a fast-forwarded chapter the way the player would (they are not the subject here). */
async function skipChapterBeats() {
  await page.evaluate(() => {
    const ui = window.__lw.useUi.getState();
    for (const id of [...ui.beats]) window.__lw.dispatch({ t: 'beat_done', id });
    ui.clearRequests();
    if (!window.__lw.getGame().dream?.id) window.__lw.dispatch({ t: 'dream_chosen', id: 'travel' });
    window.__lw.useStore.getState().go('world');
  });
  await t.sleep(300);
}

/** Walks next to a character (stepping away first: the world only reports a change of "who is near") and presses Talk. */
async function talkTo(id) {
  await settle();
  await go('world');
  const away = id === 'hanako' ? 'tanaka' : 'hanako';
  await page.evaluate((c) => window.__world.teleportNear(c), away);
  await t.sleep(500);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 20000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
}

// ---------------------------------------------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------------------------------------------

const charLines = () => page.locator('.msg.char').count();
async function lineAfter(n) {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
}
async function charReady() {
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
}

/**
 * Plays a conversation. `plan` entries: a RegExp (the first suggestion whose Japanese, spaces removed, matches), a number (that suggestion), or
 * `{ type: '...' }` (typed into the box: my own words). When the plan is used up the first suggestion is tapped until the done card shows.
 */
async function drive(plan = [], { onStep } = {}) {
  let next = 0;
  for (let n = 0; n < 60; n++) {
    await charReady();
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    if (await page.locator('.done-card').count()) return;
    const want = plan[next];
    const lines = await charLines();
    if (want && typeof want === 'object' && 'type' in want) {
      next++;
      await page.fill('#say', want.type);
      await page.locator('.send').click();
    } else {
      const texts = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
      let idx = 0;
      if (typeof want === 'number') idx = want;
      else if (want) idx = texts.findIndex((x) => want.test(x));
      if (DEBUG) console.log(`   step ${n}: [${texts.join(' | ')}] want ${want} -> ${idx}`);
      assert.ok(idx >= 0 && idx < texts.length, `no suggestion matches ${want} among ${texts.join(' | ')}`);
      if (want !== undefined) next++;
      await page.locator('.sg').nth(idx).click();
    }
    await Promise.race([lineAfter(lines), page.waitForSelector('.done-card', { timeout: 40000 })]);
    if (onStep) await onStep(n);
  }
  throw new Error('the conversation did not end');
}

/** Skips Prepare when it comes first, plays the plan, opens the debrief and leaves it (the overlays are settled). */
async function converse(plan, { keepDebrief = false, onStep, afterOpen } = {}) {
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
  if (afterOpen) await afterOpen();
  await drive(plan, { onStep });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  if (!keepDebrief) {
    await page.locator('.panel-foot .btn.primary').click();
    await t.sleep(600);
    await settle();
  }
}

const snap = async () => {
  const g = await liveGame(page);
  return { cash: g.wallet.cash, ic: g.wallet.ic, ids: new Set(g.ledger.map((e) => e.id)) };
};
const fresh = (g, before, pred = () => true) => g.ledger.filter((e) => !before.ids.has(e.id) && pred(e));

/** Opens a person's sheet at their spot and waits for the row. */
async function pickRow(who, opt) {
  await talkTo(who);
  await page.waitForSelector(`[data-opt=${opt}]`, { timeout: 15000 });
}
/** Talk -> the row. A person with a single open thing to do (Nakamura before his bicycle) starts it straight from Talk: no sheet, then nothing to tap. */
async function takeRow(who, opt) {
  await talkTo(who);
  await page.waitForSelector(`[data-opt=${opt}], .prep, .convo, [data-home-phase]`, { timeout: 15000 });
  if (await page.locator(`[data-opt=${opt}]`).count()) await page.locator(`[data-opt=${opt}]`).click();
}

// ---------------------------------------------------------------------------------------------------------------
// 0. a fresh profile, the dev tools take it to the start of Chapter 5
// ---------------------------------------------------------------------------------------------------------------
step('fresh profile -> dev tools fast-forward Chapters 1-4 -> the start of Chapter 5');
await onboard(page, { arabic: AR });
if (AR) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
for (let n = 0; n < 3; n++) {
  await dev('advance_chapter');
  await skipChapterBeats();
}
// the fourth one is played with its beats: Chapter 4 closes with Mio, Chapter 5 opens with Sato
await dev('advance_chapter');
await t.sleep(500);
let played = await settle({ shotIds: ['b_ch5_open'] });
console.log('  beats', played.join(', '));
let g = await liveGame(page);
assert.equal(g.chapter.n, 5, 'Chapter 5 is current');
assert.ok(played.includes('b_ch5_open'), "Sato's opening beat plays when Chapter 5 starts");
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await settle();
await dev('cash', 10_000);
await check('start of Chapter 5');

step('Quests: Chapter 5 shows its four objectives, the first one points at Sato');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'story' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-screen=quests]');
await t.sleep(400);
for (const id of ['c5_1', 'c5_2', 'c5_3', 'c5_4']) assert.equal(await page.locator(`[data-obj=${id}]`).count(), 1, `row ${id}`);
await check('Quests chapter 5');
await t.shot('quests-ch5');
// after three attempts the "ask Sato the way" row offers Hanako's easier version
await patch((s) => ({ ...s, chapter: { ...s.chapter, tries: { ...s.chapter.tries, c5_2: 3 } } }));
await t.sleep(400);
assert.equal(await page.locator('[data-easier=c5_2]').count(), 1, 'Make it easier is offered for c5_2 after three tries');
await check('easier offered');
await t.shot('quests-ch5-easier');
await patch((s) => ({ ...s, chapter: { ...s.chapter, tries: { ...s.chapter.tries, c5_2: 0 } } }));
await go('world');

// ---------------------------------------------------------------------------------------------------------------
// 1. the train to Hikarigaoka
// ---------------------------------------------------------------------------------------------------------------
step("Sato's sheet: 'Take the train' is a row, the fare is charged once, up front, and exactly");
await pickRow('sato', 'trip_hikarigaoka');
for (const opt of ['sato_info', 'sato_ic', 'sato_way', 'sato_shift']) assert.equal(await page.locator(`[data-opt=${opt}]`).count(), 1, `${opt} is listed`);
await assertNoHScroll(page, "Sato's sheet");
await assertTargets('.hud-opt', "Sato's sheet");
await t.shot('sato-sheet');
let before = await snap();
await page.locator('[data-opt=trip_hikarigaoka]').click();
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) {
  await assertNoHScroll(page, 'Prepare for the trip');
  await t.shot('trip-prepare');
  await page.locator('.prep-foot .prep-link').click();
}
await page.waitForSelector('.convo', { timeout: 25000 });
await page.waitForSelector('[data-trip=hikarigaoka]', { timeout: 10000 });
g = await liveGame(page);
const fares = fresh(g, before, (e) => e.kind === 'fare');
assert.equal(fares.length, 1, 'exactly one fare entry at the start of the trip');
assert.equal(fares[0].delta, -2 * (170 + 10), 'the round trip: two paper fares of ¥180');
assert.equal(g.wallet.cash, before.cash - 360, 'the wallet moved by exactly the fare');
await assertNoHScroll(page, 'the ride');
await t.shot('trip-ride');
await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-trip-ride]')).visibility === 'hidden', null, { timeout: 15000 });
await t.sleep(300);
await assertNoHScroll(page, 'Hikarigaoka square');
await t.shot('trip-arrival');
assert.equal(await page.locator('[data-trip-sign]').count(), 1, 'the station sign is on the backdrop');
await drive([]);
await t.shot('trip-done');
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await t.sleep(300);
await assertNoHScroll(page, 'trip debrief');
await t.shot('trip-debrief');
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(600);
await settle();
g = await liveGame(page);
assert.equal(fresh(g, before, (e) => e.kind === 'fare').length, 1, 'still one fare after the talk');
assert.ok(g.stats.visits.includes('trip:hikarigaoka'), 'trip:hikarigaoka is filed');
assert.ok(g.chapter.done.c5_1 !== undefined, 'c5_1 (ride to Hikarigaoka and back) is done');
assert.equal(await screen(), 'world', 'back on the street');
assert.equal(await page.evaluate(() => window.__world.nearby), 'sato', 'at the station, next to Sato');
assert.equal(await page.locator('[data-trip]').count(), 0, 'the backdrop is gone');
await check('after the trip');

// ---------------------------------------------------------------------------------------------------------------
// 2. ask Sato the way, three lines of my own
// ---------------------------------------------------------------------------------------------------------------
step('ask Sato the way: three lines of my own (typed)');
await takeRow('sato', 'sato_way');
// (a typed line that copies a chip word for word counts as the chip's: my own words are phrased differently)
await converse([{ type: 'すみません、出口はどこにありますか' }, { type: 'はい、右に曲がるんですね' }, { type: 'どうも、ありがとうございました' }]);
g = await liveGame(page);
assert.ok((g.runs.sato_directions?.bestIndependent ?? 0) >= 3, `three independent lines (${g.runs.sato_directions?.bestIndependent})`);
assert.ok(g.chapter.done.c5_2 !== undefined, 'c5_2 is done');
await check('after sato_directions');

// ---------------------------------------------------------------------------------------------------------------
// 3. a station shift
// ---------------------------------------------------------------------------------------------------------------
step("the station shift: Sato's intro conversation, then the desk");
await takeRow('sato', 'sato_shift');
await page.waitForSelector('[data-shift-card=intro]');
await assertNoHScroll(page, 'station intro gate');
await t.shot('station-intro');
await page.locator('[data-act=talk-boss]').click();
await page.waitForSelector('.convo', { timeout: 25000 });
await charReady();
await drive([]);
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card');
await t.sleep(300);
assert.equal(await page.locator('[data-act=feedback-then]').count(), 1, "Sato's intro debrief continues to the Shift screen");
await page.locator('[data-act=feedback-then]').click();
await page.waitForSelector('[data-shift-card=job]', { timeout: 10000 });
await t.sleep(300);
await assertNoHScroll(page, 'station job card');
await t.shot('station-card');
before = await snap();
const stIds = await playJob(serveStation, { answer: 'pick', shots: 'station' });
console.log('  station customers', stIds.join(' '));
await assertNoHScroll(page, 'station result');
await t.shot('station-result');
g = await liveGame(page);
const paid = fresh(g, before, (e) => e.kind === 'shift').reduce((n, e) => n + e.delta, 0);
// all answers picked from three: production credit 0.35, F(0.35) = 0.25 + 0.75 x 0.1225, a first shift: x1.0
assert.equal(paid, Math.round((1400 * 0.75 * (0.25 + 0.75 * 0.35 * 0.35)) / 10) * 10, 'the station shift pays the formula');
assert.ok(g.chapter.done.c5_3 !== undefined, 'c5_3 (a station shift) is done');
await page.locator('[data-act=back]').click();
await t.sleep(500);
await settle();
await check('after the station shift');

// ---------------------------------------------------------------------------------------------------------------
// 4. Nakamura Motors
// ---------------------------------------------------------------------------------------------------------------
step("browse Nakamura Motors and say 'I will think about it'");
await takeRow('nakamura', 'nakamura_visit');
await converse([{ type: 'こんにちは' }, { type: '自転車はいくらですか' }, { type: '考えます' }]);
g = await liveGame(page);
assert.equal(g.runs.motors_visit?.complete, true, 'motors_visit is complete');
assert.ok(g.chapter.done.c5_4 !== undefined, 'c5_4 is done');
await check('after Motors');

// ---------------------------------------------------------------------------------------------------------------
// 5. Chapter 5 completes
// ---------------------------------------------------------------------------------------------------------------
step('Chapter 5 completes once a friend is at 3 hearts and the days have passed: reward, title, culture cards, closing beat -> Chapter 6 starts');
await hearts('mio', 150);
const cash5 = (await liveGame(page)).wallet.cash;
let allBeats = [];
// all four objectives are done for real; only the days the chapter needs (minDays) are fast-forwarded
await dev('advance_chapter');
allBeats.push(...(await settle({ shotIds: ['b_ch5_close', 'b_ch6_open'] })));
g = await liveGame(page);
console.log('  beats', allBeats.join(', '), '| chapter', g.chapter.n);
assert.equal(g.chapter.n, 6, 'Chapter 6 is current');
assert.ok(g.chapter.completed.includes(5), 'Chapter 5 is completed');
assert.ok(g.ledger.some((e) => e.kind === 'chapter' && e.ref === 'ch5' && e.delta === 5000), 'the ¥5,000 reward is in the ledger');
assert.ok(g.titles.includes('t_traveller'), 'title: Traveller');
for (const c of ['cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse']) assert.ok(g.culture[c] !== undefined, `culture card ${c} is in the stamp book`);
assert.ok(allBeats.includes('b_ch5_close') && allBeats.includes('b_ch6_open'), "the closing beat of Chapter 5 and Mio's invitation play");
await check('Chapter 6 starts');

step('the stamp book shows the cards of Chapter 5');
await go('culture');
await page.waitForSelector('[data-culture-book]');
for (const c of ['cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse']) assert.equal(await page.locator(`[data-card="${c}"]`).count(), 1, `${c} in the book`);
await t.sleep(300);
await check('stamp book');
await t.shot('stamp-book');
await go('world');

// ---------------------------------------------------------------------------------------------------------------
// 6. Chapter 6: Hanako's try without chips, the shifts, a friend's home, Aiko's room
// ---------------------------------------------------------------------------------------------------------------
step("the café: Yuki's intro and a shift (the first shop-like talk of Chapter 6 is Hanako's try without chips)");
await dev('advance_day');
await settle();
await takeRow('yuki', 'yuki_shift');
await page.waitForSelector('[data-shift-card=intro]');
await page.locator('[data-act=talk-boss]').click();
await page.waitForSelector('.convo', { timeout: 25000 });
await charReady();
await drive([]);
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card');
await t.sleep(300);
await page.locator('[data-act=feedback-then]').click();
await page.waitForSelector('[data-shift-card=job]', { timeout: 10000 });
await assertNoHScroll(page, 'café job card');
await t.shot('cafe-card');
before = await snap();
const cafeIds = await playJob(serveCafe, { answer: 'type', shot: 'cafe' });
console.log('  café customers', cafeIds.join(' '));
await t.shot('cafe-result');
g = await liveGame(page);
assert.equal(fresh(g, before, (e) => e.kind === 'shift').reduce((n, e) => n + e.delta, 0), Math.round((1200 * 0.75) / 10) * 10, 'a typed perfect café shift pays ¥900');
await page.locator('[data-act=back]').click();
await t.sleep(500);
await settle();
await check('after the café shift');

step("Hanako's try without chips: the next shop talk is held for her beat, then plays in Real mode (no chips), and the one after is Guided again");
g = await liveGame(page);
assert.ok(!g.chapter.flags.includes('real_try_seen'), 'not offered yet');
await takeRow('tanaka', 'tanaka_shop');
await page.waitForSelector('.prep, .convo, [data-beat=b_real_try], .qst-beat', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('[data-beat=b_real_try]', { timeout: 25000 });
await assertNoHScroll(page, "Hanako's try beat");
await t.shot('beat-real-try');
for (let i = 0; i < 6 && (await screen()) === 'beat'; i++) {
  await page.locator('.qst-beat [data-continue]').first().click();
  await t.sleep(250);
}
await page.waitForSelector('.convo', { timeout: 25000 });
await t.sleep(600);
assert.equal(await page.locator('.sg').count(), 0, 'Real mode: no suggestion chips');
assert.equal(await page.locator('.dbf-tag').count(), 1, 'the conversation is marked Real');
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.mode), 'real');
g = await liveGame(page);
assert.ok(g.chapter.flags.includes('real_try_seen') && g.chapter.flags.includes('real_try_done'), 'the try is filed and used up');
await assertNoHScroll(page, 'Real mode conversation');
await t.shot('real-try-convo');
// say what I want: an onigiri (typed lines carry the talk: there are no chips)
await page.fill('#say', 'おにぎりをください');
await page.locator('.send').click();
await t.sleep(1500);
for (let i = 0; i < 12 && !(await page.locator('.done-card').count()); i++) {
  await charReady();
  if (await page.locator('.done-card').count()) break;
  await page.fill('#say', ['ひとつ', 'はい', 'げんきん', 'ありがとうございます'][i % 4]);
  await page.locator('.send').click();
  await t.sleep(1200);
}
if (!(await page.locator('.done-card').count())) {
  // leave it: the try only has to be Real once, the story does not depend on this purchase
  await page.locator('.convo-head .icon-btn').first().click();
  await page.locator('.scrim .btn.danger').click();
  await t.sleep(600);
  await settle();
} else {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  await settle();
}
await go('world');
await takeRow('tanaka', 'tanaka_shop');
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('.convo .sg', { timeout: 25000 });
assert.ok((await page.locator('.sg').count()) > 0, 'the next shop talk is Guided again: the chips are back');
await page.locator('.convo-head .icon-btn').first().click();
await page.locator('.scrim .btn.danger').click();
await t.sleep(600);
await settle();
await check('after the try');

step('hearts 4 with a friend: the door opens, the visit (shoes, slippers, 「おじゃまします」), the genkan card');
await hearts('mio', 240);
await dev('advance_day');
await dev('advance_day');
await settle();
await page.evaluate(() => window.__world.simulatePick('door:mio'));
await page.waitForSelector('.prep, [data-home-phase=genkan]', { timeout: 30000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('[data-home-phase=genkan]', { timeout: 30000 });
if (await page.locator('[data-home-mode=panel]').count()) await page.locator('[data-genkan=shoes]').click();
else await page.evaluate(() => window.__world.simulatePick('genkan:shoes'));
await page.waitForSelector('[data-genkan=shoes].done', { timeout: 8000 });
await page.locator('[data-genkan=slippers]').click();
await page.waitForSelector('.convo', { timeout: 20000 });
await drive([]);
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.dbf-card', { timeout: 30000 });
await page.locator('.panel-foot .btn.primary').click();
await page.waitForSelector('[data-home-phase=inside]', { timeout: 15000 });
await settle();
await page.locator('[data-home=leave]').click();
await page.waitForSelector('.hud', { timeout: 8000 });
await t.sleep(500);
await settle();
g = await liveGame(page);
assert.ok(g.stats.visits.includes('home:mio'), 'home:mio is filed');
assert.ok(g.chapter.done.c6_1 !== undefined && g.chapter.done.c6_2 !== undefined, 'c6_1 and c6_2 are done');
await check('after the home visit');

step("Aiko's room: the viewing with three questions");
await takeRow('aiko', 'aiko_viewing');
await converse([]);
g = await liveGame(page);
assert.equal(g.runs.aiko_viewing?.complete, true, 'aiko_viewing is complete');
assert.ok(g.chapter.done.c6_3 !== undefined, 'c6_3 is done');
await check('after the viewing');

step('five shifts in total: the konbini (Tanaka) and a second station shift on other days');
await dev('advance_day');
await settle();
await takeRow('tanaka', 'tanaka_shift');
await page.waitForSelector('[data-shift-card=intro], [data-shift-card=job]');
if (await page.locator('[data-shift-card=intro]').count()) {
  await page.locator('[data-act=talk-boss]').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await charReady();
  await drive([]);
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card');
  await t.sleep(300);
  await page.locator('[data-act=feedback-then]').click();
  await page.waitForSelector('[data-shift-card=job]', { timeout: 10000 });
}
// the konbini customers: tap the order pad from the shared table of shift.mjs is not needed: every order is picked by its widget
const KONBINI = {
  k_basic: { items: { onigiri: 2 } }, k_water: { items: { water: 1 } }, k_bento: { items: { bento: 1 } }, k_three: { items: { onigiri: 3 } },
  k_two: { items: { greenTea: 1, sandwich: 3 } }, k_drinks: { items: { juice: 2, milk: 1 } }, k_sweet: { items: { cake: 1, coffee: 1 } },
  k_heat: { items: { bento: 1 }, flags: ['heat', 'nobag'] }, k_heat2: { items: { bento: 1, greenTea: 1 }, flags: ['heat'] }, k_bag: { items: { onigiri: 3 }, flags: ['nobag'] },
};
const KPRICE = { onigiri: 160, water: 110, sandwich: 320, bento: 580, juice: 160, milk: 150, greenTea: 160, cake: 330, coffee: 130 };
async function serveKonbini() {
  await page.waitForSelector('[data-customer]');
  const id = await page.locator('[data-customer]').getAttribute('data-customer');
  const a = KONBINI[id];
  assert.ok(a, `known konbini customer ${id}`);
  await page.waitForSelector('[data-order]');
  for (const [item, q] of Object.entries(a.items)) for (let k = 0; k < q; k++) await page.locator(`.sh-item[data-item=${item}] .sh-item-main`).click();
  for (const f of a.flags ?? []) await page.locator(`[data-flag=${f}]`).click();
  await page.locator('[data-act=confirm-order]').click();
  await page.waitForSelector('[data-answer$=":total"]');
  await page.locator('#sh-say').fill(`${Object.entries(a.items).reduce((s, [k, q]) => s + KPRICE[k] * q, 0)}円`);
  await page.locator('[data-act=say]').click();
  await page.waitForSelector('[data-answer$=":thanks"]');
  await page.locator('#sh-say').fill('ありがとうございました');
  await page.locator('[data-act=say]').click();
  await page.waitForSelector('[data-done]');
  return id;
}
await playJob(serveKonbini, {});
await page.locator('[data-act=back]').click();
await t.sleep(500);
await settle();
g = await liveGame(page);
console.log('  good shifts so far:', JSON.stringify(Object.fromEntries(Object.entries(g.jobs).map(([k, v]) => [k, v.good]))));
// the fifth good shift: the station again, the next day
await dev('advance_day');
await settle();
await takeRow('sato', 'sato_shift');
await page.waitForSelector('[data-shift-card=job]', { timeout: 10000 });
await playJob(serveStation, { answer: 'pick' });
await page.locator('[data-act=back]').click();
await t.sleep(500);
g = await liveGame(page);
const goodTotal = Object.values(g.jobs).reduce((n, j) => n + j.good, 0);
console.log('  good shifts in total:', goodTotal);
assert.ok(goodTotal >= 4, 'konbini, café and two station shifts counted');
await check('after the shifts');

// a fifth shift if the count is still short (the café again, a different day)
if (goodTotal < 5) {
  await dev('advance_day');
  await settle();
  await pickRow('yuki', 'yuki_shift');
  await page.locator('[data-opt=yuki_shift]').click();
  await page.waitForSelector('[data-shift-card=job]', { timeout: 10000 });
  await playJob(serveCafe, { answer: 'pick' });
  await page.locator('[data-act=back]').click();
  await t.sleep(500);
}
g = await liveGame(page);
assert.ok(Object.values(g.jobs).reduce((n, j) => n + j.good, 0) >= 5, 'five good shifts in total');
assert.ok(g.chapter.done.c6_4 !== undefined, 'c6_4 (five shifts) is done');
await check('five shifts');

// ---------------------------------------------------------------------------------------------------------------
// 7. Chapter 6 completes: the epilogue and Free Walk
// ---------------------------------------------------------------------------------------------------------------
step('Chapter 6 completes: reward, title, culture cards, the epilogue beat, Free Walk (chapter.n 9)');
allBeats = [];
// the objectives are done for real; the days the chapter needs (minDays) are fast-forwarded
await dev('advance_chapter');
allBeats.push(...(await settle({ shotIds: ['b_release_epilogue'] })));
g = await liveGame(page);
console.log('  beats', allBeats.join(', '), '| chapter', g.chapter.n);
assert.equal(g.chapter.n, 9, 'Free Walk (chapter.n 9) is current');
assert.ok(g.chapter.completed.includes(6), 'Chapter 6 is completed');
assert.ok(g.ledger.some((e) => e.kind === 'chapter' && e.ref === 'ch6' && e.delta === 6000), 'the ¥6,000 reward is in the ledger');
assert.ok(g.titles.includes('t_guest'), 'title: Guest');
for (const c of ['cc_shoesoff', 'cc_trash']) assert.ok(g.culture[c] !== undefined, `culture card ${c}`);
assert.ok(allBeats.includes('b_release_epilogue'), 'the epilogue beat plays');
await go('quests');
await page.waitForSelector('[data-screen=quests]');
await t.sleep(400);
assert.equal(await page.locator('[data-freewalk]').count(), 1, 'the Story tab says Free Walk');
await t.shot('quests-freewalk');
await check('Free Walk');
await go('world');

step('a reload keeps everything');
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
g = await liveGame(page);
assert.equal(g.chapter.n, 9);
assert.ok(g.stats.visits.includes('trip:hikarigaoka') && g.stats.visits.includes('home:mio'));
await check('after reload');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`chapters 5-6 e2e ok (${AR ? 'ar' : 'en'})`);
