// The phone end to end in the real UI (docs/GAME_DESIGN.md §8.7; agent 4C-lite): fresh profile -> the dev tools take the game to Chapter 4 ->
// the phone is "bought" (state patch) with Mio and Tanaka at 2 hearts -> the HUD phone icon shows the unread badge -> Messages lists the
// friends -> Mio's first message (chat_first, plain form) -> Reply opens the text conversation (no pause button, no camera) -> reply by
// typing Japanese, by typing English (the assist card), and by tapping -> the debrief -> c4_2 (first message) ticks, +4 AP, one thread
// per friend per day -> the next day a plan (chat_plan) is accepted and its pin shows on the Map tab -> four chats with two friends tick
// c4_3. Checks the hearts/AP caps (4 per chat, 8 per day), 44 px targets and no horizontal scroll at 360 px. English and, with --ar,
// Arabic (RTL).
// Usage: node tools/e2e/game/friends-phone.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('friends-phone');
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

/** closes any culture pop-up the world shows (it would sit over the HUD), then taps the HUD phone icon */
async function openPhone() {
  await t.sleep(400);
  for (let k = 0; k < 12 && (await page.locator('.cul-scrim').count()); k++) {
    await page.locator('.cul-pop .btn.primary').click();
    await t.sleep(300);
  }
  await page.locator('.hud-phone').click();
  await page.waitForSelector('[data-screen=phone]');
}

/** waits for the friend's line to settle, then returns how many of their messages are on screen */
const waitFriend = async () => {
  await page.waitForFunction(() => !document.querySelector('.bubble.typing') && document.querySelectorAll('.msg.char').length > 0, null, { timeout: 40000 });
  return page.locator('.msg.char').count();
};
/** sends text from the input bar and waits for the friend's reply (or the end card) */
async function typeLine(line) {
  const n = await waitFriend();
  await page.fill('#say', line);
  await page.locator('.inputbar .send').click();
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card'), n, { timeout: 40000 });
  await t.sleep(900);
}
/** taps the i-th suggestion once the friend has finished typing */
async function tapChip(i = 0) {
  await page.waitForFunction(() => !document.querySelector('.bubble.typing') && document.querySelectorAll('.sg').length > 0, null, { timeout: 40000 });
  const n = await page.locator('.msg.char').count();
  await page.locator('.sg').nth(i).click();
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card'), n, { timeout: 40000 }).catch(() => {});
  await t.sleep(300);
}
async function tapToEnd() {
  for (let k = 0; k < 20 && !(await page.locator('.done-card').count()); k++) {
    if (await page.locator('.sg').count()) await tapChip(0);
    else await t.sleep(400);
  }
  await page.waitForSelector('.done-card', { timeout: 30000 });
}
async function finishChat() {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.dbf-card, .fb, .panel', { timeout: 30000 });
  await t.sleep(500);
}
/** phone -> friend's thread -> Reply -> the text conversation is open and the friend has said the first line */
async function openThreadAndReply(friend, template) {
  await go('world');
  await openPhone();
  await page.locator(`[data-friend-row=${friend}]`).click();
  await page.waitForSelector(`[data-thread-friend=${friend}] [data-thread=${template}]`);
  await page.locator(`[data-thread=${template}] [data-act=reply]`).click();
  await page.waitForSelector('.convo.ph-chat', { timeout: 30000 });
  await waitFriend();
}
const chatsOf = (g) => g.stats.chats;

// ---- 1. a fresh profile, taken to Chapter 4 with the dev tools ------------------------------------------------------------
t.step('fresh profile -> dev tools -> Chapter 4');
await onboard(page, { arabic });
await skipBeats(page).catch(() => {});
if (arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await patch((g) => ({ ...g, flags: { ...g.flags, dev: true } }));
for (let n = 0; n < 3; n++) {
  await dev('advance_chapter');
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
assert.equal(g.chapter.n, 4, 'Chapter 4 is current');
assert.equal(await page.locator('.hud-phone').count(), 0, 'no phone icon before the phone');

// ---- 2. the phone: Messages turn on ---------------------------------------------------------------------------------------------
t.step('the phone is owned: Mio and Tanaka at 2 hearts, a new day brings their first messages');
await patch((g) => {
  const friend = (ap) => ({ ap, met: true, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 });
  return { ...g, owned: { ...g.owned, phone_used: { qty: 1, day: 'd0' } }, friends: { ...g.friends, mio: friend(80), tanaka: friend(80) } };
});
await dev('advance_day');
g = await liveGame(page);
assert.deepEqual(g.friends.mio.threads.map((x) => x.template), ['chat_first'], "Mio's story message comes first");
assert.deepEqual(g.friends.tanaka.threads.map((x) => x.template), ['chat_first']);
assert.equal(g.friends.yuki, undefined, 'a friend below 2 hearts gets none');
await go('world');
await t.sleep(500);
assert.equal(await page.locator('.hud-phone').count(), 1, 'the phone icon shows with the phone');
assert.equal((await text('.hud-phone .dot-badge')).trim(), '2', 'two unread');
await t.shot('0-hud');

t.step('Messages: the friends, the unread badges, 44 px rows');
await openPhone();
assert.equal(await page.locator('[data-friend-row]').count(), 6, 'the six friends');
assert.equal(await page.locator('[data-friend-row][data-unread="1"]').count(), 2, 'two with a message');
assert.equal((await text('.ph-tab .ph-badge')).trim(), '2', 'the tab badge counts them');
const preview = await text('[data-friend-row=mio] .ja-preview');
assert.ok(/スマホ/.test(preview), `the first words of Mio's message: ${preview}`);
assert.equal(await page.locator('[data-friend-row=yuki][data-unread="0"]').count(), 1, 'Yuki has no message');
assert.ok(/♥2/.test(await text('[data-friend-row=yuki]')), 'Yuki: messages start at ♥2');
await assertNoHScroll(page, 'messages list');
await assertTargets('.ph-row, .ph-tab, [data-act=phone-back]', 'messages list');
await t.shot('1-messages');

// ---- 3. Mio's thread -----------------------------------------------------------------------------------------------------------
t.step("Mio's thread: chat_first in plain form, a translation on tap, Reply");
await page.locator('[data-friend-row=mio]').click();
await page.waitForSelector('[data-thread-friend=mio] [data-thread=chat_first]');
assert.ok(/買った/.test(await text('[data-thread=chat_first] .ph-bubble')), 'Mio speaks plain form at 2 hearts');
await page.locator('[data-thread=chat_first] .mini').click();
assert.ok((await text('[data-thread=chat_first] .tr')).length > 3, 'the translation shows on tap');
await assertNoHScroll(page, 'thread');
await assertTargets('.ph-reply, .ph-tab', 'thread');
await t.shot('2-thread');
await page.locator('[data-thread=chat_first] [data-act=reply]').click();
await page.waitForSelector('.convo.ph-chat', { timeout: 30000 });
await waitFriend();
assert.equal(await page.locator('.convo.ph-chat .convo-head [aria-label]').evaluateAll((els) => els.filter((e) => /pause|إيقاف/i.test(e.getAttribute('aria-label') ?? '')).length), 0, 'no pause button in a text chat');
assert.equal(await page.locator('.convo.ph-chat').getAttribute('data-channel'), 'chat');
await assertNoHScroll(page, 'chat');
await t.shot('3-chat');

// ---- 4. reply: typing Japanese, then English (assist), then tapping ------------------------------------------------------------
t.step('reply by typing Japanese');
await typeLine('はい、買いました！');
assert.ok((await page.locator('.msg.me').count()) >= 1, 'my message is in the thread');
t.step('reply by typing English (the assist card), send the Japanese');
await waitFriend();
await page.fill('#say', 'It is a black phone');
await page.locator('.inputbar .send').click();
await page.waitForSelector('.assist', { timeout: 10000 });
if (await page.locator('.assist .btn.primary').count()) {
  await t.shot('3b-assist');
  const n = await page.locator('.msg.char').count();
  await page.locator('.assist .btn.primary').click();
  await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card'), n, { timeout: 40000 });
} else {
  // the translator did not know the sentence: cancel and tap the colour instead (still a real path)
  await page.locator('.assist .btn.soft').click();
  await tapChip(0);
}
await t.sleep(900);
t.step('reply by tapping, to the end');
await tapToEnd();
await t.shot('4-chat-done');
await assertTargets('.done-card .btn, .inputbar button', 'chat dock');
await finishChat();
g = await liveGame(page);
assert.equal(chatsOf(g).n, 1, 'one chat counted');
assert.deepEqual(g.friends.mio.threads, [], "Mio's thread is answered");
assert.equal(g.friends.mio.unread, 0);
assert.equal(g.friends.mio.ap, 84, 'a chat is worth +4 AP');
assert.equal(g.friends.mio.facts['purchase:phone'], 'phone', 'Mio remembers the phone');
assert.equal(g.friends.mio.chatApToday, 4, 'within the 8 a day');
assert.ok(g.chapter.done.c4_2 !== undefined, 'objective c4_2 (first message) done');
await t.shot('4b-debrief');

// ---- 5. one thread per friend per day ----------------------------------------------------------------------------------------
t.step('Mio has nothing more today; Tanaka answers by tapping');
await go('world');
await openPhone();
assert.equal(await page.locator('[data-friend-row][data-unread="1"]').count(), 1, 'only Tanaka is waiting');
await page.locator('[data-friend-row=mio]').click();
await page.waitForSelector('[data-thread-empty]');
assert.equal(await page.locator('[data-act=reply]').count(), 0, 'no dead button: nothing to reply to');
await assertNoHScroll(page, 'empty thread');
await t.shot('5-thread-empty');
await openThreadAndReply('tanaka', 'chat_first');
assert.ok(!/買った？/.test(await text('.msg.char .bubble')), 'Tanaka speaks polite form');
await tapToEnd();
await finishChat();
g = await liveGame(page);
assert.equal(chatsOf(g).n, 2);
assert.equal(g.friends.tanaka.ap, 84);
assert.ok(g.chapter.done.c4_3 === undefined, 'c4_3 needs four chats');

// ---- 6. the next day: a plan, its pin, the map ---------------------------------------------------------------------------------
t.step('next day: Mio asks to meet (chat_plan); accepting pins the park');
await go('world');
await dev('advance_day');
g = await liveGame(page);
assert.equal(g.friends.mio.threads.length, 1, 'one new thread a day');
assert.equal(g.friends.mio.threads[0].template, 'chat_plan', "Mio's plan comes next");
await openThreadAndReply('mio', 'chat_plan');
assert.ok(/公園/.test(await text('.msg.char .bubble')), "Mio's place is the park");
await typeLine('いいよ');
await tapToEnd();
await finishChat();
g = await liveGame(page);
assert.equal(chatsOf(g).n, 3);
assert.ok(g.friends.mio.flags.some((f) => f === `plan_${g.clock.dayIndex}`), "today's plan is filed");
await go('world');
await openPhone();
await page.locator('[data-tab-btn=map]').click();
await page.waitForSelector('[data-map-list]');
assert.equal(await page.locator('[data-pin]').count() >= 6, true, 'a pin per friend');
assert.equal(await page.locator('[data-pin=mio]').getAttribute('data-plan'), '1', "Mio's pin carries today's plan");
assert.equal(await page.locator('[data-pin]').first().getAttribute('data-pin'), 'mio', 'the plan comes first');
await assertNoHScroll(page, 'map');
await assertTargets('.ph-walk, .ph-tab', 'map');
await t.shot('6-map');

t.step('Tanaka answers (polite), then c4_3 ticks: four chats with two friends');
await openThreadAndReply('tanaka', 'chat_plan');
await tapToEnd();
await finishChat();
g = await liveGame(page);
assert.equal(chatsOf(g).n, 4);
assert.equal(Object.values(chatsOf(g).friends).filter((n) => n > 0).length, 2, 'two different friends');
assert.ok(g.chapter.done.c4_3 !== undefined, 'objective c4_3 done');
for (const id of ['mio', 'tanaka']) assert.ok(g.friends[id].chatApToday <= 8, `${id}: chat AP within the daily cap`);
await go('quests');
await page.waitForSelector('[data-screen=quests]');
assert.equal(await page.locator('[data-obj=c4_3]').getAttribute('data-done'), '1', 'c4_3 shows as done');
await t.shot('7-quests-c4_3');

// ---- 7. Walk there ---------------------------------------------------------------------------------------------------------------
t.step('Map pins: Walk there returns to the street');
await go('world');
await openPhone();
await page.locator('[data-tab-btn=map]').click();
await page.locator('[data-pin=hanako] [data-act=walk]').click();
await page.waitForFunction(() => window.__lw.useStore.getState().screen === 'world');
await t.sleep(600);
assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`friends-phone e2e OK${arabic ? ' (ar)' : ''}`);
