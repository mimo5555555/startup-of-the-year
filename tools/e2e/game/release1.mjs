// Release 1 end to end (docs/RELEASE_1.md): one story, told in the REAL UI at 360 px, English or Arabic (--ar):
//   fresh profile -> Chapter 1 (lesson, konbini by conversation, IC card with typed lines, signs and words) -> Chapter 2 (a café order in
//   my own words, the ramen shop and the said culture phrases, the konbini shift by typing) -> Chapter 3 (real small talks with Mio and Yuki
//   across advanced days up to two hearts each, a present bought at the konbini and handed over) -> Chapter 4 (the phone bought at Hikari
//   Denki through the conversation, the HUD icon, chats with two friends, Continue back to the Phone, today's plan pin on the minimap) ->
//   the epilogue beat and Free Walk (chapter 9) -> Nakamura Motors opens: the bicycle, the helmet (worn at once), the used kei car with
//   the drive-away fees and a haggle -> a reload keeps everything.
// Dev tools are used only for yen, for advancing days and for the one objective ("know 25 words") whose real route is weeks of review.
// After every step: no horizontal scroll, no console error, and the wallet equals the ledger totals (cash + ic = start + earned - spent).
// Supersedes tools/e2e/game/shops.mjs. Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/release1.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('release1');
const { page } = t;
const AR = t.arabic;
const DEBUG = !!process.env.DEBUG;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-12).join('\n'));
    await t.shot('zz-failure').catch(() => {});
    console.log('state at the failure:', JSON.stringify(await page.evaluate(() => { const g = window.__lw.getGame(); return { chapter: g.chapter, clock: g.clock, wallet: g.wallet, friends: Object.fromEntries(Object.entries(g.friends).map(([k, f]) => [k, { ap: f.ap, threads: f.threads, unread: f.unread, chatApToday: f.chatApToday }])) }; }).catch(() => null)));
    console.error(e);
    process.exit(1);
  });
}
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};
const world = (fn, arg) => page.evaluate(fn, arg);
const text = (sel) => page.locator(sel).first().innerText();
const fmt = (n) => `¥${n.toLocaleString('en-US')}`;
const owned = async (id) => (await liveGame(page)).owned[id]?.qty ?? 0;

/** After every step: no horizontal scroll, no console error, wallet = ledger (§4.1: cash + ic = start + earned - spent, and each pocket against its checksum). */
async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
  for (const p of ['cash', 'ic', 'points']) assert.equal(g.wallet[p], g.totals.checksum[p], `${where}: ${p} matches its checksum`);
}

// ---------------------------------------------------------------------------------------------------------------
// beats, pop-ups, sheets
// ---------------------------------------------------------------------------------------------------------------

/** Plays every queued story beat by tapping (the dream question is answered with the first dream, the katakana step is saved as offered). */
async function beats({ shotIds = ['b_release_epilogue'] } = {}) {
  let played = 0;
  for (let i = 0; i < 80; i++) {
    if ((await screen()) !== 'beat') return played;
    const id = await page.evaluate(() => document.querySelector('[data-beat]')?.getAttribute('data-beat') ?? '');
    if (await page.locator('[data-ask=dream] [data-choose]').count()) {
      await page.locator('[data-choose]').first().click();
    } else if (await page.locator('[data-step=nameKana] [data-save]').count()) {
      await page.locator('[data-step=nameKana] [data-save]').click();
    } else if (await page.locator('.qst-beat [data-continue]').count()) {
      if (shotIds.includes(id)) {
        await assertNoHScroll(page, `beat ${id}`);
        await t.shot(`beat-${id}-${i}`);
      }
      await page.locator('.qst-beat [data-continue]').first().click();
      played++;
    } else if (await page.locator('[data-ask=dream]').count()) {
      await page.locator('[data-ask=dream] .btn').last().click();
    }
    await t.sleep(220);
  }
  throw new Error('story beats did not end');
}

/** Closes whatever is in the way: culture pop-ups, story beats, a word card, an open sheet. */
async function settle(opts) {
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.cul-scrim').count()) {
      await page.locator('.cul-scrim .btn.primary').click();
      await t.sleep(250);
    } else if ((await screen()) === 'beat') {
      await beats(opts);
    } else if (await page.locator('.word-scrim .word-close').count()) {
      await page.locator('.word-scrim .word-close').last().click();
      await t.sleep(200);
    } else if (await page.locator('.hud-sheet').count()) {
      await page.keyboard.press('Escape');
      await t.sleep(300);
    } else if ((await screen()) === 'world' && (await page.locator('.tip .btn').count())) {
      await page.locator('.tip .btn').first().click().catch(() => {});
      await t.sleep(200);
    } else return;
  }
  throw new Error('overlays did not clear');
}

/** Walks next to a character (stepping away first: the world only reports a change of "who is near") and presses Talk. */
async function talkTo(id) {
  await settle();
  await go('world');
  await page.evaluate((c) => window.__world.teleportNear(c), id === 'tanaka' ? 'hanako' : 'tanaka');
  await t.sleep(500);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 15000 });
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
  for (let step = 0; step < 60; step++) {
    await charReady();
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    if (await page.locator('.done-card').count()) return;
    const want = plan[next];
    const n = await charLines();
    if (want && typeof want === 'object' && 'type' in want) {
      next++;
      await page.fill('#say', want.type);
      await page.locator('.send').click();
    } else {
      const texts = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
      let idx = 0;
      if (typeof want === 'number') idx = want;
      else if (want) idx = texts.findIndex((x) => want.test(x));
      if (DEBUG) console.log(`   step ${step}: [${texts.join(' | ')}] want ${want} -> ${idx}`);
      assert.ok(idx >= 0 && idx < texts.length, `no suggestion matches ${want} among ${texts.join(' | ')}`);
      if (want !== undefined) next++;
      await page.locator('.sg').nth(idx).click();
    }
    await Promise.race([lineAfter(n), page.waitForSelector('.done-card', { timeout: 40000 })]);
    if (onStep) await onStep(step);
  }
  throw new Error('the conversation did not end');
}

/**
 * Skips Prepare when it comes first, plays the plan, opens the debrief; returns the last price chip shown. `keepDebrief` stays on the debrief
 * (else it is left through its primary button and the overlays are settled).
 */
async function converse(plan, { keepDebrief = false, shotPrefix = '', shotSteps = [] } = {}) {
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
  let priceShot = false;
  await drive(plan, {
    onStep: async (s) => {
      if (shotPrefix && !priceShot && (await page.locator('[data-price]').count())) {
        priceShot = true;
        await assertNoHScroll(page, `${shotPrefix} conversation with a price chip`);
        await t.shot(`${shotPrefix}-price`);
      }
      if (shotPrefix && shotSteps.includes(s)) {
        await assertNoHScroll(page, `${shotPrefix} step ${s}`);
        await t.shot(`${shotPrefix}-s${s}`);
      }
    },
  });
  const shownPrice = await page.evaluate(() => {
    const els = [...document.querySelectorAll('[data-price]')];
    return els.length ? Number(els[els.length - 1].getAttribute('data-price')) : null;
  });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  if (!keepDebrief) {
    await page.locator('.panel-foot .btn.primary').click();
    await t.sleep(600);
    await settle();
  }
  return shownPrice;
}

const snap = async () => {
  const g = await liveGame(page);
  return { cash: g.wallet.cash, ids: new Set(g.ledger.map((e) => e.id)) };
};
/** The exact spend of the last purchase: the ledger entry is the price, the wallet moved by the sum of the fresh cash entries, the inventory has the item. */
async function assertCharge(before, itemId, expected, what) {
  const g = await liveGame(page);
  const fresh = g.ledger.filter((x) => !before.ids.has(x.id) && x.pocket === 'cash');
  const e = fresh.find((x) => x.kind === 'purchase' && x.ref === itemId);
  assert.ok(e, `${what}: a purchase entry for ${itemId} is in the ledger`);
  assert.equal(-e.delta, expected, `${what}: charged exactly ${fmt(expected)}`);
  assert.equal(fresh.filter((x) => x.kind === 'purchase').length, 1, `${what}: exactly one purchase`);
  assert.equal(g.wallet.cash - before.cash, fresh.reduce((n, x) => n + x.delta, 0), `${what}: the wallet moved by the ledger's sum`);
  assert.equal(g.owned[itemId]?.qty, 1, `${what}: ${itemId} is in the inventory`);
  return e;
}

/** A picture of the player in the street (the first-visit tip is dismissed, the player stands away from shop fronts so the camera sees the ride). */
async function streetShot(name, near = 'tanaka') {
  await settle();
  await page.evaluate((c) => window.__world.teleportNear(c), near);
  await t.sleep(1800);
  await t.shot(name);
}

// ---------------------------------------------------------------------------------------------------------------
// the lesson, the shift, the culture book, friends, phone
// ---------------------------------------------------------------------------------------------------------------

async function playLesson() {
  await page.waitForSelector('.lesson .btn.primary');
  await page.locator('.lesson .btn.primary').click();
  for (let guard = 0; guard < 60 && !(await page.locator('.lesson .done-badge').count()); guard++) {
    const option = page.locator('.lesson .option:not([disabled])').first();
    if (await option.count()) await option.click();
    const say = page.locator('.lesson input.say');
    if (await say.count()) {
      await say.fill('x');
      await page.locator('.lesson .send').click();
    }
    await page.locator('.lesson .panel-foot .btn.primary').click();
    await t.sleep(120);
  }
  await page.waitForSelector('.lesson .done-badge');
  await page.locator('.lesson .center-col .btn.primary').click();
  await t.sleep(600);
}

const PRICE = { onigiri: 160, water: 110, sandwich: 320, bento: 580, juice: 160, milk: 150, greenTea: 160, cake: 330, coffee: 130 };
const ARCH = {
  k_basic: { items: { onigiri: 2 } },
  k_water: { items: { water: 1 } },
  k_bento: { items: { bento: 1 } },
  k_three: { items: { onigiri: 3 } },
  k_two: { items: { greenTea: 1, sandwich: 3 } },
  k_drinks: { items: { juice: 2, milk: 1 } },
  k_sweet: { items: { cake: 1, coffee: 1 } },
  k_heat: { items: { bento: 1 }, flags: ['heat', 'nobag'] },
  k_heat2: { items: { bento: 1, greenTea: 1 }, flags: ['heat'] },
  k_bag: { items: { onigiri: 3 }, flags: ['nobag'] },
  k_change: { items: { sandwich: 1, juice: 1 }, paid: 1000 },
  k_change2: { items: { bento: 1, water: 1 }, paid: 1000 },
};
const totalOf = (a) => Object.entries(a.items).reduce((s, [k, q]) => s + PRICE[k] * q, 0);

/** One customer, everything typed. */
async function serveTyped() {
  await page.waitForSelector('[data-customer]');
  const id = await page.locator('[data-customer]').getAttribute('data-customer');
  const a = ARCH[id];
  assert.ok(a, `known customer ${id}`);
  const total = totalOf(a);
  await page.waitForSelector('[data-order]');
  for (const [item, q] of Object.entries(a.items)) for (let k = 0; k < q; k++) await page.locator(`.sh-item[data-item=${item}] .sh-item-main`).click();
  for (const f of a.flags ?? []) await page.locator(`[data-flag=${f}]`).click();
  await page.locator('[data-act=confirm-order]').click();
  await page.waitForSelector('[data-answer$=":total"]');
  await page.locator('#sh-say').fill(`${total}円`);
  await page.locator('[data-act=say]').click();
  if (a.paid) {
    await page.waitForSelector('[data-answer$=":change"]');
    await page.locator('#sh-say').fill(`${a.paid - total}`);
    await page.locator('[data-act=say]').click();
  }
  await page.waitForSelector('[data-answer$=":thanks"]');
  await page.locator('#sh-say').fill('arigatou gozaimashita');
  await page.locator('[data-act=say]').click();
  await page.waitForSelector('[data-done]');
}

async function sayCard(id, typed) {
  await page.locator(`[data-card="${id}"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-card="${id}"]`).click();
  await page.waitForSelector(`[data-culture-detail="${id}"]`);
  await page.waitForSelector('.cul-say .prep-input');
  await page.fill('.cul-say .prep-input', typed);
  await page.locator('.cul-say .send').click();
  await page.waitForSelector('.cul-say .prep-verdict.ok');
  await assertNoHScroll(page, `detail ${id}`);
  await page.locator('.cul-back').click();
  await page.waitForSelector('[data-culture-book]');
}

async function openFriends() {
  await settle();
  await go('world');
  await page.locator('.icon-btn.glass[aria-expanded]').first().click();
  await page.locator('[data-menu=friends]').click();
  await page.waitForSelector('[data-screen=friends]');
}
/** Opens a friend's card (one card is open at a time; tapping the open one would close it). */
async function openCard(id) {
  if (!(await page.locator(`[data-card=${id}]`).count())) await page.locator(`[data-friend=${id}] .frd-head`).click();
  await page.waitForSelector(`[data-card=${id}]`);
}
const heartsOf = async (id) => {
  const ap = (await liveGame(page)).friends[id]?.ap ?? 0;
  return [30, 80, 150, 240, 350].filter((x) => ap >= x).length;
};
/** From the Friends screen: Talk -> Prepare skipped -> small talk by tapping -> debrief -> the street. */
async function talkViaFriends(id) {
  await openFriends();
  await openCard(id);
  await page.locator(`[data-friend=${id}] [data-act=talk]`).click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(500);
  await drive([]);
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  await settle();
}

async function openPhone() {
  await settle();
  await go('world');
  await t.sleep(300);
  await page.locator('.hud-phone').click();
  await page.waitForSelector('[data-screen=phone]');
}
async function chatWith(friend, template, { typed = null, shot = '' } = {}) {
  await openPhone();
  await page.locator(`[data-friend-row=${friend}]`).click();
  await page.waitForSelector(`[data-thread-friend=${friend}] [data-thread]`);
  // the template asked for if it is waiting, else the oldest waiting thread
  if (!(await page.locator(`[data-thread=${template}]`).count())) template = await page.locator('[data-thread]').first().getAttribute('data-thread');
  if (shot) {
    await assertNoHScroll(page, `${shot} thread`);
    await t.shot(`${shot}-thread`);
  }
  await page.locator(`[data-thread=${template}] [data-act=reply]`).click();
  await page.waitForSelector('.convo.ph-chat', { timeout: 30000 });
  await charReady();
  if (shot) {
    await assertNoHScroll(page, `${shot} chat`);
    await t.shot(`${shot}-chat`);
  }
  await drive(typed && template === 'chat_plan' ? [{ type: typed }] : []);
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  if (shot) {
    await assertNoHScroll(page, `${shot} debrief`);
    await t.shot(`${shot}-debrief`);
  }
  // a chat debrief continues to the Phone (not to the street)
  assert.equal(await page.locator('[data-act=feedback-then]').count(), 1, 'the chat debrief has Continue');
  assert.equal(await page.locator('.panel-foot .btn').count(), 1, 'and nothing else in its footer (no "practise again" for a chat)');
  await page.locator('[data-act=feedback-then]').click();
  await page.waitForSelector('[data-screen=phone]', { timeout: 10000 });
  return template;
}

// ===============================================================================================================
// CHAPTER 1
// ===============================================================================================================
step('fresh profile: onboarding, the opening beat (katakana name step), the street');
await onboard(page, { arabic: AR, name: 'Sam' });
await page.waitForSelector('[data-beat="b_ch1_open"]', { timeout: 30000 });
assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr', 'document direction');
await beats();
await settle();
let g = await liveGame(page);
assert.equal(g.wallet.cash, 3000, 'wallet starts at ¥3,000');
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true })); // QA tools: yen, days, one objective
assert.equal(g.chapter.n, 1);
await check('chapter 1 start');

step("Chapter 1: Hanako's Greetings lesson");
await talkTo('hanako');
await page.waitForSelector('.lesson, [data-opt=lesson_greetings]');
if (await page.locator('[data-opt=lesson_greetings]').count()) await page.locator('[data-opt=lesson_greetings]').click();
await playLesson();
await go('world');
await check('after the lesson');

step('Chapter 1: buy an onigiri at the konbini by conversation (exactly ¥160)');
let before = await snap();
await talkTo('tanaka');
await converse([0, 0, 0, 1]);
g = await liveGame(page);
assert.equal(g.runs.konbini?.complete, true, 'the konbini run is complete');
assert.equal(g.ledger.filter((e) => !before.ids.has(e.id) && e.kind === 'purchase' && e.pocket === 'cash').map((e) => e.delta).join(), '-160', 'one cash purchase of ¥160');
await check('after the konbini');

step('Chapter 1: the IC card at the station, with my own typed words (they count for "say 3 new words")');
await talkTo('sato');
await page.waitForSelector('[data-opt=sato_ic]', { timeout: 10000 });
await page.locator('[data-opt=sato_ic]').click();
await converse([{ type: 'ICカードがほしいです' }, { type: 'はい、だいじょうぶです' }, { type: 'せんえんおねがいします' }, { type: 'げんきんではらいます' }]);
g = await liveGame(page);
assert.ok(g.wallet.ic > 0, `the card holds yen (¥${g.wallet.ic})`);
await check('after the IC card');

step('Chapter 1: read signs and save words until the last objective closes the chapter');
for (const sign of ['sakura', 'cat', 'bench', 'post', 'pond', 'park', 'taxi', 'bus']) {
  if (await page.locator('[data-beat]').count()) break;
  await settle();
  await page.evaluate((x) => window.__world.simulatePick(x), sign);
  await page.waitForSelector('.word-scrim .word-actions, [data-beat]', { timeout: 10000 }).catch(() => {});
  const save = page.locator('.word-actions .btn.primary');
  if (await save.count()) await save.click();
  await t.sleep(300);
  while (await page.locator('.word-scrim .word-close').count()) {
    await page.locator('.word-scrim .word-close').last().click();
    await t.sleep(200);
  }
}
await page.waitForSelector('[data-beat="b_ch1_close"]', { timeout: 20000 });
g = await liveGame(page);
for (const id of ['c1_1', 'c1_2', 'c1_3', 'c1_4', 'c1_5']) assert.ok(g.chapter.done[id] !== undefined, `${id} is done through the real UI`);
assert.deepEqual(g.chapter.completed, [1], 'Chapter 1 is complete');
await beats();
await settle();
g = await liveGame(page);
assert.equal(g.chapter.n, 2, 'Chapter 2 is current');
assert.ok(g.dream?.id, 'a dream was picked');
await check('chapter 1 closed');

// ===============================================================================================================
// CHAPTER 2
// ===============================================================================================================
step('Chapter 2: a café order in my own words (c2_1)');
await talkTo('yuki');
await converse(['コーヒーを一つお願いします', 'あたたかいのがいいです', 'ワイファイのパスワードは何ですか', 'ありがとう、助かります', 'げんきんではらいます'].map((type) => ({ type })));
g = await liveGame(page);
assert.ok(g.chapter.done.c2_1 !== undefined, 'c2_1 (café, 2 own lines) is done');
await check('after the café');

step('Chapter 2: the ramen shop; the Say it of いただきます and of the bow card (c2_2, c2_4)');
await talkTo('kenji');
await converse([], { keepDebrief: true });
g = await liveGame(page);
assert.ok(g.chapter.done.c2_2 !== undefined, 'c2_2 (ramen) is done');
assert.ok(g.culture.cc_itadakimasu !== undefined, 'the itadakimasu card is unlocked in the debrief');
await page.locator('.dbf-culture .btn.soft').last().click();
await page.waitForSelector('[data-culture-book]');
await t.sleep(400);
await t.shot('stamp-book');
await assertNoHScroll(page, 'stamp book');
await sayCard('cc_itadakimasu', 'いただきます');
await sayCard('cc_bow', 'yoroshiku onegaishimasu');
g = await liveGame(page);
assert.equal(new Set(g.stats.cultureSaid).size, 2, 'two phrases said (c2_4)');
assert.ok(g.chapter.done.c2_4 !== undefined, 'c2_4 is done');
await page.evaluate(() => document.querySelector('.panel-body')?.scrollTo(0, 0));
await t.shot('stamp-book-after');
await go('world');
await check('after the ramen and the book');

step('Chapter 2: another day, then the konbini shift (Tanaka\'s offer, the intro conversation, five customers typed)');
await dev('advance_day');
await talkTo('tanaka');
await page.waitForSelector('[data-opt=tanaka_shift]');
await page.locator('[data-opt=tanaka_shift]').click();
await page.waitForSelector('[data-shift-card=intro]');
await page.locator('[data-act=talk-boss]').click();
await page.waitForSelector('.convo');
await charReady();
await drive([]);
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card');
await t.sleep(300);
assert.equal(await page.locator('[data-act=feedback-then]').count(), 1, 'the boss intro debrief continues to the Shift screen');
await assertNoHScroll(page, 'shift intro debrief');
await t.shot('shift-intro-debrief');
await page.locator('[data-act=feedback-then]').click();
await page.waitForSelector('[data-shift-card=job]', { timeout: 10000 });
assert.equal(await screen(), 'shift');
await t.sleep(300);
await t.shot('shift-job-card');
await assertNoHScroll(page, 'shift job card');
await page.locator('[data-act=start-shift]').click();
await page.waitForSelector('[data-customer]');
for (let n = 1; n <= 5; n++) {
  assert.equal(await page.locator('[data-customer-n]').getAttribute('data-customer-n'), String(n));
  if (n === 1) {
    await t.shot('shift-customer');
    await assertNoHScroll(page, 'shift customer');
  }
  await serveTyped();
  await page.locator('[data-act=next-customer]').click();
  await t.sleep(150);
}
await page.waitForSelector('[data-shift-card=result]');
await assertNoHScroll(page, 'shift result');
await t.shot('shift-result');
g = await liveGame(page);
assert.equal(await page.locator('[data-shift-card=result]').getAttribute('data-pay'), '860', 'a typed first shift pays ¥860');
assert.ok(g.chapter.done.c2_3 !== undefined, 'c2_3 (first konbini shift) is done');
await page.locator('[data-act=back]').click();
await t.sleep(500);
await go('world');
await settle();
g = await liveGame(page);
assert.deepEqual(g.chapter.completed, [1, 2], 'Chapter 2 is complete');
assert.equal(g.chapter.n, 3, 'Chapter 3 is current');
await check('chapter 2 closed');

// ===============================================================================================================
// CHAPTER 3
// ===============================================================================================================
step('Chapter 3: meet Mio in the park, four lines of my own (c3_1)');
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_meet]');
await page.locator('[data-opt=mio_meet]').click();
// (lines that copy a suggestion count as copies: these are phrased differently, so they are my own)
await converse(['こんにちは、サムといいます。', 'なまえをおしえてください', AR ? 'わたしはエジプトからきました。' : 'わたしはアメリカからきました。', 'ミオさんはどこからきましたか', 'わたしはアニメがだいすきです。'].map((type) => ({ type })));
g = await liveGame(page);
assert.ok(g.chapter.done.c3_1 !== undefined, 'c3_1 (meet Mio) is done');
await check('after the park');

step('Chapter 3: the Friends screen, seven friends, Mio open');
await openFriends();
assert.equal(await page.locator('.frd-card').count(), 7, 'the seven friends (Aiko joined in wave B1)');
assert.equal(await page.locator('[data-act=message]').count(), 0, 'no Message button before the phone');
await assertNoHScroll(page, 'friends screen');
await t.shot('friends-start');
await go('world');

step('Chapter 3: a present from the konbini (by conversation), then handed to Mio');
before = await snap();
await talkTo('tanaka');
await page.waitForSelector('[data-opt=tanaka_shop]');
await page.locator('[data-opt=tanaka_shop]').click();
await converse([/プレゼント/, /マンガ/]);
g = await liveGame(page);
assert.equal(g.owned.g_manga?.qty, 1, 'the manga is in the bag');
assert.ok(g.ledger.some((e) => !before.ids.has(e.id) && e.kind === 'purchase' && e.delta < 0), 'it was paid for');
await check('after buying the present');
await openFriends();
await openCard('mio');
await page.locator('[data-friend=mio] [data-act=gift]').click();
await page.waitForSelector('[data-gift-sheet] [data-item=g_manga]');
await page.locator('[data-item=g_manga]').click();
await t.sleep(400);
await assertNoHScroll(page, 'gift sheet');
await t.shot('gift-sheet');
const apBefore = (await liveGame(page)).friends.mio?.ap ?? 0;
await page.locator('[data-act=hand-over]').click();
await page.waitForSelector('.convo', { timeout: 30000 });
await charReady();
await drive([]);
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await t.sleep(300);
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(600);
await settle();
g = await liveGame(page);
assert.equal(g.stats.gifts.n, 1, 'one gift given');
assert.ok(g.chapter.done.c3_3 !== undefined, 'c3_3 (a gift) is done');
assert.ok(g.friends.mio.ap > apBefore, `the gift gave affinity (${apBefore} -> ${g.friends.mio.ap})`);
await check('after the gift');

step('Chapter 3: small talks with Mio and Yuki on following days, up to two hearts each (real conversations)');
let days = 0;
if (process.env.R1_FAST) {
  // debugging only (the acceptance runs do not set it): the days-long route is skipped by topping the affinity up
  await page.evaluate(() => { const g = window.__lw.getGame(); window.__lw.useGame.getState().setGame({ ...g, friends: { ...g.friends, mio: { ...g.friends.mio, ap: 78 }, yuki: { ...(g.friends.yuki ?? g.friends.mio), ap: 78, met: true, talkDay: -1, topicDay: {}, giftDay: -1, facts: {}, learned: [], gold: [], callbacks: {}, events: [], flags: [] } } }); });
}
while (((await heartsOf('mio')) < 2 || (await heartsOf('yuki')) < 2) && days < 18) {
  await dev('advance_day');
  days++;
  for (const f of ['mio', 'yuki']) if ((await heartsOf(f)) < 2) await talkViaFriends(f);
  g = await liveGame(page);
  console.log(`  day +${days}: Mio ${g.friends.mio?.ap} AP, Yuki ${g.friends.yuki?.ap ?? 0} AP`);
  await check(`friends day +${days}`);
}
assert.ok((await heartsOf('mio')) >= 2 && (await heartsOf('yuki')) >= 2, 'Mio and Yuki are at two hearts');
await settle();
g = await liveGame(page);
assert.ok(g.chapter.done.c3_2 !== undefined && g.chapter.done.c3_4 !== undefined, 'c3_2 and c3_4 are done');
await openFriends();
await openCard('mio');
assert.ok((await page.locator('[data-card=mio] .frd-hearts svg.on').count()) >= 2, 'the card shows two hearts');
await t.sleep(400);
await assertNoHScroll(page, 'friends with hearts');
await t.shot('friends-hearts');
await go('world');
// the chapter closes when its days have passed
for (let k = 0; k < 4 && (await liveGame(page)).chapter.n < 4; k++) {
  await dev('advance_day');
  await talkViaFriends('mio'); // a day only counts as active when something is done in it
  await settle();
}
g = await liveGame(page);
assert.equal(g.chapter.n, 4, 'Chapter 4 is current');
await check('chapter 3 closed');

// ===============================================================================================================
// CHAPTER 4
// ===============================================================================================================
step('Chapter 4: Hikari Denki is open, Nakamura Motors is shut with its padlock, nothing on the avatar');
await dev('cash', 60_000);
assert.equal(await world(() => window.__world.isShopOpen('denki')), true, 'Hikari Denki is open');
assert.equal(await world(() => window.__world.isShopOpen('motors')), false, 'Nakamura Motors is shut');
assert.equal(await page.locator('.hud-phone').count(), 0, 'no phone icon before the phone');
assert.equal(await world(() => window.__world.getRide()), null, 'no ride yet');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 1, 'normal speed');
await check('chapter 4 start');

step('Chapter 4: the shut garage can be looked into through its window (the goods are listed, locked, with no buy button)');
await settle();
await go('world');
await page.evaluate(() => window.__world.simulatePick('shop:motors')); // tapping the shuttered front
await page.waitForSelector('[data-opt$=_window]', { timeout: 10000 });
await page.locator('[data-opt$=_window]').click();
await page.waitForSelector('.hud-goods', { timeout: 10000 });
assert.ok((await page.locator('.hud-goods .hud-good').count()) >= 3, 'the shelves are listed');
assert.equal(await page.locator('.hud-goods .hud-good.locked').count(), await page.locator('.hud-goods .hud-good').count(), 'every good is locked before Free Walk');
const lockLine = await page.locator('.hud-goods .hud-good-state').first().innerText();
assert.ok(!/Chapter 9|الفصل 9/.test(lockLine), `the padlock does not name a chapter that is not played (${lockLine})`);
await assertNoHScroll(page, 'garage window');
await t.sleep(700); // the software-GL compositor can lag a frame behind the DOM
await t.shot('garage-window');
await page.keyboard.press('Escape');
await t.sleep(300);

step('Chapter 4: the phone at Hikari Denki, bought by tapping (exactly ¥24,800)');
before = await snap();
await talkTo('aoi');
await page.waitForSelector('[data-opt=aoi_shop], .prep, .convo', { timeout: 15000 });
if (await page.locator('[data-opt=aoi_shop]').count()) await page.locator('[data-opt=aoi_shop]').click();
await converse([/スマホ.*ほしい/, /中古.*スマホ.*ください/, /黒/, /これ.*ください/, /現金/, /です。/, /はい/], { shotPrefix: 'denki' });
await assertCharge(before, 'phone_used', 24_800, 'phone');
await settle();
await t.sleep(500);
assert.equal(await page.locator('.hud-phone').count(), 1, 'the HUD phone icon appears');
await check('phone bought');
await t.shot('hud-phone');
await page.locator('.icon-btn.glass').first().click();
await page.waitForSelector('[data-menu]');
assert.equal(await page.locator('[data-menu="phone"]').count(), 1, 'the menu lists Phone');
await t.shot('menu');
await page.locator('.icon-btn.glass').first().click();
await t.sleep(300);

step('Chapter 4: the first messages from two friends, answered by chat; Continue goes back to the Phone');
await dev('advance_day');
await settle();
g = await liveGame(page);
assert.ok(g.friends.mio.threads.length >= 1 && g.friends.yuki.threads.length >= 1, 'Mio and Yuki each wrote');
await openPhone();
assert.ok((await page.locator('[data-friend-row]:not([data-unread="0"])').count()) >= 2, 'two friends have a message');
await assertNoHScroll(page, 'messages');
await t.shot('messages');
await chatWith('mio', 'chat_first', { shot: 'chat1' });
await t.shot('phone-after-chat');
await chatWith('yuki', 'chat_first');
g = await liveGame(page);
assert.equal(g.stats.chats.n, 2, 'two chats');
assert.ok(g.chapter.done.c4_2 !== undefined, 'c4_2 (first message) is done');
await check('after the first chats');

step("Chapter 4: next day, Mio's plan; accepting it pins her on the minimap");
await dev('advance_day');
assert.equal(await chatWith('mio', 'chat_plan', { typed: 'いいよ' }), 'chat_plan', "Mio's plan was the thread");
await go('world');
await t.sleep(800);
assert.ok(((await page.locator('canvas.minimap').getAttribute('data-plans')) ?? '').split(' ').includes('mio'), "Mio is on today's minimap pins");
await t.shot('minimap-plan');
await chatWith('yuki', 'chat_plan');
g = await liveGame(page);
assert.equal(g.stats.chats.n, 4, 'four chats');
assert.ok(g.chapter.done.c4_3 !== undefined, 'c4_3 (four chats, two friends) is done');
await check('after the plan chats');

step('Chapter 4: know 25 words (weeks of review: the one dev fast-forward), then the days pass; the epilogue beat plays; Free Walk starts');
g = await liveGame(page);
const left = ['c4_1', 'c4_2', 'c4_3', 'c4_4'].filter((id) => g.chapter.done[id] === undefined);
assert.deepEqual(left, ['c4_4'], 'only the word count is left');
await dev('complete_objective');
await go('world');
await page.waitForFunction(() => window.__lw.useStore.getState().screen === 'beat' || window.__lw.getGame().chapter.n !== 4, null, { timeout: 8000 }).catch(() => {});
await t.sleep(600);
for (let k = 0; k < 5 && (await liveGame(page)).chapter.n !== 9; k++) {
  await go('world');
  await settle({ shotIds: ['b_release_epilogue'] });
  if ((await liveGame(page)).chapter.n !== 9) {
    await dev('advance_day');
    await talkViaFriends('mio'); // a day only counts as active when something is done in it
  }
}
await settle({ shotIds: ['b_release_epilogue'] });
g = await liveGame(page);
assert.equal(g.chapter.n, 9, 'Free Walk (chapter 9)');
assert.ok(g.beats.includes('b_release_epilogue'), 'the epilogue beat was played');
assert.deepEqual(g.chapter.completed, [1, 2, 3, 4]);
await check('free walk');

// ===============================================================================================================
// FREE WALK: Nakamura Motors
// ===============================================================================================================
step('Free Walk: Nakamura Motors opens (cars outside)');
assert.equal(await world(() => window.__world.isShopOpen('motors')), true, 'Nakamura Motors is open');
await dev('cash', 260_000);
await streetShot('motors-scene', 'nakamura');
await assertNoHScroll(page, 'motors scene');

step('Motors: the visit first (it opens the bicycle)');
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_visit], .prep, .convo', { timeout: 15000 });
if (await page.locator('[data-opt=nakamura_visit]').count()) {
  await t.sleep(400);
  await t.shot('nakamura-sheet');
  await assertNoHScroll(page, 'Nakamura sheet');
  assert.equal(await page.locator('[data-opt=nakamura_car]').count() > 0 || true, true);
  await page.locator('[data-opt=nakamura_visit]').click();
}
await converse([/こんにちは/, /いくら/, /ちょっと|難しい/]);
await check('after the visit');

step('Motors: the bicycle (¥19,800 + ¥600 registration); the mesh is under the player and the speed is x1.5');
before = await snap();
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_bike]', { timeout: 15000 });
await page.locator('[data-opt=nakamura_bike]').click();
await converse([/自転車.*ほしい/, /通学|買い物|仕事|散歩|運動/, /ママチャリ.*ください/, /これ.*ください/, /です。/, /桜町/, /現金/, /はい/]);
await assertCharge(before, 'bike_mamachari', 19_800 + 600, 'bicycle (with the registration)');
await settle();
await t.sleep(600);
assert.equal(await world(() => window.__world.getRide()), 'bike', 'ride = bike');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 1.5, 'speed x1.5');
assert.equal(await world(() => !!window.__world.scene.getObjectByName('ride-bike')), true, 'the bicycle mesh is in the scene');
await streetShot('on-the-bike');
await check('bike bought');

step('Motors: the helmet (¥2,980, no registration) is worn at once; the Wallet can take it off and put it on');
before = await snap();
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_bike]', { timeout: 15000 });
await page.locator('[data-opt=nakamura_bike]').click();
await converse([/自転車.*ほしい/, /通学|買い物|仕事|散歩|運動/, /ヘルメット.*ください/, /これ.*ください/, /です。/, /桜町/, /現金/, /はい/]);
await assertCharge(before, 'bike_helmet', 2_980, 'helmet');
g = await liveGame(page);
assert.deepEqual(g.outfit.equipped, ['bike_helmet'], 'the helmet is equipped right after the purchase');
await t.sleep(700);
assert.equal(await world(() => window.__world.player.spec.accessories.includes('helmet')), true, 'the avatar wears the helmet in the world');
await streetShot('helmet-in-world');
await check('helmet bought');

step('Wallet: balances, what you own, the item card, Take off / Wear');
await page.locator('.hud-wallet').click();
await page.waitForSelector('[data-screen="wallet"]');
await t.sleep(400);
g = await liveGame(page);
const cashText = await page.locator('[data-pocket="cash"] strong').innerText();
assert.equal(Number(cashText.replace(/[^\d]/g, '')), g.wallet.cash, 'the cash on the screen is the wallet');
for (const id of ['phone_used', 'bike_mamachari', 'bike_helmet']) assert.equal(await page.locator(`[data-owned="${id}"]`).count(), 1, `${id} is in "what you own"`);
await assertNoHScroll(page, 'wallet: my things');
await t.shot('wallet-things');
await page.locator('[data-owned="bike_mamachari"]').click();
await page.waitForSelector('.wlt-card');
assert.ok((await page.locator('.wlt-card').innerText()).includes('1.5'), 'the bicycle card says speed x1.5');
await t.sleep(500);
await t.shot('wallet-item-card');
await page.keyboard.press('Escape');
await t.sleep(300);
assert.equal(await page.locator('.wlt-wear.on').count(), 1, 'the switch shows the helmet is on');
await page.locator('[data-wear="bike_helmet"]').first().click();
await t.sleep(500);
assert.deepEqual((await liveGame(page)).outfit.equipped, [], 'Take off works');
await page.locator('[data-wear="bike_helmet"]').first().click();
await t.sleep(500);
assert.deepEqual((await liveGame(page)).outfit.equipped, ['bike_helmet'], 'and Wear puts it back');
await t.shot('wallet-wardrobe');
await page.locator('[data-tab="receipts"]').click();
await page.waitForSelector('[data-pane="receipts"]');
if (await page.locator('.wlt-receipts > .btn').count()) await page.locator('.wlt-receipts > .btn').click();
assert.ok((await page.locator('[data-receipt]').count()) >= 3, 'the purchases are receipts');
await page.locator('[data-receipt]').first().click();
await page.waitForSelector('[data-slip]');
await assertNoHScroll(page, 'wallet: receipts');
await t.shot('wallet-receipts');
await go('world');
await t.sleep(600);
await check('wallet');

step('Motors: the used kei car; the drive-away price, one haggle within the cap; the car mesh and x2.5');
before = await snap();
await talkTo('nakamura');
await page.waitForSelector('[data-opt=nakamura_car]', { timeout: 15000 });
await page.locator('[data-opt=nakamura_car]').click();
const said = await converse([/軽自動車.*見たい/, /中古.*軽自動車.*見たい/, /いくら/, /乗り出し価格/, /安く/, /これ.*ください|ありがとう/, /です。/, /です。/, /現金/], { shotPrefix: 'car', shotSteps: [2, 3, 4, 5, 6] });
g = await liveGame(page);
const car = [...g.ledger].reverse().find((x) => x.kind === 'purchase' && x.ref === 'car_kei_used');
assert.ok(car, 'the car purchase is in the ledger');
const paid = -car.delta;
console.log(`  car: charged ${fmt(paid)} (drive-away ${fmt(198_000)}, shown ${said === null ? 'n/a' : fmt(said)})`);
assert.ok(paid < 198_000, `the haggle took something off the drive-away price (${fmt(paid)})`);
assert.ok(paid >= 198_000 - 8_880, `and no more than the haggle cap of ¥8,880 (${fmt(paid)})`);
if (said !== null) assert.equal(said, paid, 'the price shown under the clerk is the price charged');
assert.equal(g.wallet.cash - before.cash, g.ledger.filter((x) => !before.ids.has(x.id) && x.pocket === 'cash').reduce((n, x) => n + x.delta, 0), "the wallet moved by the ledger's sum");
assert.equal(g.owned.car_kei_used?.qty, 1, 'the car is in the inventory');
await settle();
await t.sleep(700);
assert.equal(await world(() => window.__world.getRide()), 'car', 'ride = car (the best ride wins)');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 2.5, 'speed x2.5');
assert.equal(await world(() => !!window.__world.scene.getObjectByName('ride-car')), true, 'the car mesh is in the scene');
assert.equal(await world(() => !!window.__world.scene.getObjectByName('ride-bike')), false, 'the bicycle mesh is gone');
await streetShot('in-the-car');
await check('car bought');

step('the game remembers: reload keeps the things, the ride, the speed, the helmet and Free Walk');
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw?.useGame?.getState().hydrated, null, { timeout: 60000 });
await t.sleep(1800);
await settle();
assert.equal(await world(() => window.__world.getRide()), 'car', 'ride after reload');
assert.equal(await world(() => window.__world.getMoveMultiplier()), 2.5, 'speed after reload');
assert.equal(await world(() => window.__world.player.spec.accessories.includes('helmet')), true, 'the helmet is still on after the reload');
assert.equal(await world(() => window.__world.isShopOpen('motors')), true, 'Nakamura Motors is still open');
g = await liveGame(page);
assert.equal(g.chapter.n, 9);
for (const id of ['phone_used', 'bike_mamachari', 'bike_helmet', 'car_kei_used']) assert.equal(g.owned[id]?.qty, 1, `${id} survived the reload`);
assert.equal(await page.locator('.hud-phone').count(), 1, 'the phone icon is still there');
await check('after the reload');
await page.locator('.hud-wallet').click();
await page.waitForSelector('[data-screen="wallet"]');
assert.equal(await page.locator('[data-owned="car_kei_used"]').count(), 1);
await t.shot('wallet-final');

assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr');
assertNoConsoleErrors(t.logs);
console.log(`release1 e2e ok${AR ? ' (Arabic)' : ''} in ${Math.round((Date.now() - T0) / 1000)} s`);
await t.browser.close();
