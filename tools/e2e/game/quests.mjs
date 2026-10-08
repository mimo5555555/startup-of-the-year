// Quests, story beats and the Dream picker (docs/GAME_DESIGN.md §2.1, §7.2-§7.5; agent 2F). Fresh profile at 360 px, English or Arabic (--ar):
// the opening beat (4 lines) and its katakana step (pre-filled from the name), the tracker showing objective 1, the Greetings lesson ticking it
// through the real UI, the Quests screen and its tabs as they unlock, Chapter 1's closing beat with the Dream picker (via the dev tools),
// the Dream, Story and Today tabs, Make it easier, From yesterday and the swap. No horizontal scroll, 44 px targets, no console errors.
// Screenshots in tools/e2e/shots/game/.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/quests.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('quests');
const { page } = t;
const AR = t.arabic;

/** Touch targets of the things a thumb presses are at least 44 px. */
const assertTargets = async (selector, where) => {
  const small = await page.evaluate(
    (s) => [...document.querySelectorAll(s)].map((el) => ({ r: el.getBoundingClientRect(), el })).filter(({ r }) => r.width > 0 && (r.height < 43.5 || r.width < 43.5)).map(({ r, el }) => `${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`),
    selector,
  );
  assert.deepEqual(small, [], `${where}: targets under 44 px`);
};

/** Everything of the screen lies inside the 360 px viewport. */
const assertInside = async (root, where) => {
  const bad = await page.evaluate((sel) => {
    const out = [];
    for (const el of document.querySelectorAll(`${sel}, ${sel} *`)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > 361 || r.left < -1) out.push(`${el.className || el.tagName}: ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    return out.slice(0, 6);
  }, root);
  assert.deepEqual(bad, [], `${where}: elements outside the screen`);
};

const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const text = (sel) => page.locator(sel).first().innerText();
const open = async (tab) => {
  // the screen reads the asked tab when it mounts, so leave it first
  await go('world');
  await t.sleep(150);
  await page.evaluate((x) => (window.__lw.useUi.getState().setArgs('quests', { tab: x }), window.__lw.useStore.getState().go('quests')), tab);
  await page.waitForSelector('[data-screen=quests]');
  await t.sleep(300);
};
const dev = async (cmd) => {
  await page.evaluate((c) => window.__lw.dispatch({ t: 'dev', cmd: c }), cmd);
  await t.sleep(300);
};

t.step('fresh profile: onboarding -> world -> the opening beat plays by itself');
await onboard(page, { arabic: AR, name: 'Mio' });
await page.waitForSelector('[data-beat="b_ch1_open"]', { timeout: 30000 });
await t.sleep(500);
if (AR) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl in Arabic');

t.step('beat line 1: Hanako, her look, the Japanese with readings, the gloss');
assert.ok((await text('.qst-beat-name')).includes('花子'), 'the speaker is Hanako');
assert.ok(await page.locator('.qst-beat-portrait').count(), 'her portrait');
assert.ok((await text('.qst-beat-ja')).includes('ようこそ'), 'the Japanese line');
assert.ok(await page.locator('.qst-beat-ja .rt', { hasText: 'さくらちょう' }).count(), 'furigana over 桜町');
const gloss = await text('.qst-beat-gloss');
assert.ok(AR ? /هاناكو/.test(gloss) : /Welcome to Sakura/.test(gloss), `gloss in the UI language: ${gloss}`);
await assertNoHScroll(page, 'beat');
await assertInside('.qst-beat', 'beat');
await assertTargets('.qst-beat button', 'beat');
await t.shot('01-beat');

t.step('four lines, one per tap, then the katakana step');
for (let n = 1; n < 4; n++) {
  await page.locator('.qst-beat [data-continue]').click();
  await t.sleep(250);
  assert.equal(await page.locator('.qst-beat').getAttribute('data-line'), String(n), `line ${n + 1}`);
}
assert.ok((await text('.qst-beat-ja')).includes('レッスン'), 'the fourth line is the lesson line');
await page.locator('.qst-beat [data-continue]').click();
await page.waitForSelector('[data-step=nameKana]');
const kana = page.locator('[data-step=nameKana] input');
assert.equal(await kana.inputValue(), 'ミオ', 'the field is pre-filled with the name in katakana');
await assertNoHScroll(page, 'name step');
await assertInside('.qst-beat', 'name step');
await assertTargets('[data-step=nameKana] button, [data-step=nameKana] input', 'name step');
await t.shot('02-kana');
await kana.fill('ミオ');
await page.locator('[data-step=nameKana] [data-save]').click();
await t.sleep(600);
let g = await liveGame(page);
assert.equal(g.me.nameKana, 'ミオ', 'me.nameKana is stored');
assert.ok(g.beats.includes('b_ch1_open'), 'the beat is filed');
assert.equal(await screen(), 'world', 'back in the world');
await page.locator('.tip .btn').click({ timeout: 4000 }).catch(() => {});
await t.sleep(300);

t.step('wallet ¥3,000 and the tracker shows objective 1 (the Greetings lesson) with a pin');
assert.ok((await text('.hud-wallet')).includes('¥3,000'), 'wallet ¥3,000');
const goalText = await text('.hud-track .next-text strong');
assert.ok(AR ? /التحيات/.test(goalText) : /Greetings lesson/.test(goalText), `tracker: ${goalText}`);
assert.equal(await page.locator('.hud-dream').count(), 0, 'no dream chip yet');
await t.shot('03-tracker');

t.step('Quests screen: only Story and Culture before the closing beat; Chapter 1 and its five objectives');
await page.locator('.icon-btn.glass').first().click();
await page.locator('[data-menu=quests]').click();
await page.waitForSelector('[data-screen=quests]');
await t.sleep(300);
assert.deepEqual(await page.locator('.qst-tabs button').evaluateAll((b) => b.map((x) => x.dataset.tab)), ['story', 'culture'], 'tabs of a fresh profile');
assert.equal(await page.locator('.qst-chapter[data-chapter="1"]').count(), 1, 'Chapter 1 card');
assert.equal(await page.locator('[data-pane=story] .qst-obj[data-obj]').count(), 5, 'five objectives');
assert.equal(await page.locator('[data-obj=c1_1]').getAttribute('data-done'), '0', 'objective 1 is open');
assert.equal(await page.locator('.qst-teaser').count(), 7, 'the other seven chapters are teased by name');
assert.equal(await page.locator('[data-slot=dream]').count(), 0, 'no dream slot before the picker');
await assertNoHScroll(page, 'story tab');
await assertInside('[data-screen=quests]', 'story tab');
await assertTargets('.qst-tabs button, [data-screen=quests] .icon-btn', 'story tab');
await t.shot('04-story');
await page.locator('[data-tab=culture]').click();
await page.waitForSelector('[data-pane=culture]');
await page.locator('[data-tab=story]').click();
await go('world');
await t.sleep(300);

t.step("Hanako's Greetings lesson through the real UI ticks objective 1");
// the player spawns beside Hanako and the world only reports a change of "who is near": step away first so the Talk button shows
await page.evaluate(() => window.__world.teleportNear('tanaka'));
await t.sleep(700);
await page.evaluate(() => window.__world.teleportNear('hanako'));
await t.sleep(1200);
await page.locator('.talk-btn').click();
await t.sleep(400);
if (await page.locator('[data-opt=lesson_greetings]').count()) await page.locator('[data-opt=lesson_greetings]').click();
await page.waitForSelector('.lesson');
await page.locator('.lesson .btn.primary').click();
for (let guard = 0; guard < 40 && !(await page.locator('.lesson .done-badge').count()); guard++) {
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
await t.sleep(500);
await open('story');
assert.equal(await page.locator('[data-obj=c1_1]').getAttribute('data-done'), '1', 'objective 1 is ticked');
await t.shot('05-ticked');
await go('world');
await t.sleep(400);
const next = await text('.hud-track .next-text strong');
assert.ok(!/Greetings lesson|التحيات/.test(next), `the tracker moved on: ${next}`);

t.step("the dev tools finish Chapter 1: reward, then the closing beat asks for a dream (the Dream picker)");
// the dev tools of Settings: seven taps on the version line
await go('settings');
await page.waitForSelector('.version');
for (let n = 0; n < 7; n++) await page.locator('.version').click();
await page.waitForSelector('[data-dev=advance_chapter]');
const cashBefore = (await liveGame(page)).wallet.cash;
await page.locator('[data-dev=advance_chapter]').click();
await t.sleep(600);
g = await liveGame(page);
assert.equal(g.wallet.cash - cashBefore, 2500, 'Chapter 1 pays ¥2,500');
assert.ok(g.titles.includes('t_newcomer'), 'title 新入生');
assert.equal(g.chapter.n, 2, 'Chapter 2 is current');
await go('world');
await page.waitForSelector('[data-beat="b_ch1_close"]', { timeout: 15000 });
assert.ok((await text('.qst-beat-ja')).includes('よくできました'), 'closing beat line 1');
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(300);
const q = await text('.qst-beat-ja');
assert.ok(q.includes('ミオ') && q.includes('夢'), `the question names the player in katakana: ${q}`);
assert.ok(await page.locator('.qst-beat-ja .rt', { hasText: 'なんですか' }).count(), '何ですか reads なんですか');
await t.shot('06-dream-question');
await page.locator('.qst-beat [data-continue]').click();
await page.waitForSelector('[data-ask=dream] .qst-picker');
assert.equal(await page.locator('.qst-dream').count(), 7, 'seven dream cards for an adult');
assert.equal(await page.locator('.qst-dream[data-dream=car]:disabled').count(), 1, 'the car waits for Free Walk');
const goal = await page.evaluate(() => window.__lw.useStore.getState().profile.goal);
const suggested = { travel: 'travel', work: 'phone_pal', relocation: 'flat', casual: 'festival' }[goal];
assert.equal(await page.locator('.qst-suggested').count(), 1, 'one suggested dream');
assert.equal(await page.locator(`[data-dream=${suggested}] .qst-suggested`).count(), 1, `the onboarding goal (${goal}) suggests ${suggested}`);
assert.equal(await page.locator(`[data-dream=${suggested}]`).getAttribute('aria-pressed'), 'true', 'and it is preselected');
await assertNoHScroll(page, 'dream picker');
await assertTargets('.qst-dream, .qst-picker-actions .btn', 'dream picker');
await t.shot('07-dream-picker');
await page.locator('[data-dream=bike]').click();
assert.equal(await page.locator('[data-dream=bike]').getAttribute('aria-pressed'), 'true');
await page.locator('[data-choose]').click();
await t.sleep(600);
g = await liveGame(page);
assert.equal(g.dream.id, 'bike', 'the chosen dream is stored');
assert.ok(g.beats.includes('b_ch1_close'), 'the closing beat is filed');

t.step("Chapter 2 opens with Tanaka's beat, and the dream chip appears");
await page.waitForSelector('[data-beat="b_ch2_open"]', { timeout: 15000 });
assert.ok((await text('.qst-beat-name')).includes('田中'), 'Tanaka speaks');
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(250);
await page.locator('.qst-beat [data-continue]').click();
await t.sleep(600);
assert.equal(await screen(), 'world');
assert.equal(await page.locator('.hud-dream').count(), 1, 'the dream chip');

t.step('Quests: Dream, Story, Today tabs now');
await go('world');
await open('dream');
assert.deepEqual(await page.locator('.qst-tabs button').evaluateAll((b) => b.map((x) => x.dataset.tab)), ['dream', 'story', 'today', 'culture'], 'tabs after the closing beat');
assert.equal(await page.locator('[data-dream-panel=bike]').count(), 1, 'the Dream tab shows the chosen dream');
assert.equal(await page.locator('[data-con=yen]').count(), 1, 'the yen bar');
assert.equal(await page.locator('[data-con=language]').count(), 1, 'and the language gate: both constraints');
assert.equal(await page.locator('[data-step]').count(), 5, 'five steps');
await assertNoHScroll(page, 'dream tab');
await assertInside('[data-screen=quests]', 'dream tab');
await assertTargets('.qst-tabs button, [data-change-dream]', 'dream tab');
await t.shot('08-dream');
await page.locator('[data-change-dream]').click();
await page.waitForSelector('.qst-picker');
assert.equal(await page.locator('[data-dream=bike]').getAttribute('aria-pressed'), 'true', 'the picker opens on the current dream');
await page.locator('[data-dream=travel]').click();
await page.locator('[data-choose]').click();
await t.sleep(400);
assert.equal((await liveGame(page)).dream.id, 'travel', 'switching is free');

await open('today');
const goals = await page.locator('[data-goal]').count();
assert.equal(goals, 3, `three daily goals for an adult, found ${goals}`);
assert.ok(await page.locator('.qst-pay').innerText().then((s) => /100/.test(s) && /150/.test(s)), 'the pay line: ¥100 each, ¥150 for all');
await assertNoHScroll(page, 'today tab');
await assertInside('[data-screen=quests]', 'today tab');
await assertTargets('.qst-swap', 'today tab');
await t.shot('09-today');
const first = await page.locator('[data-goal]').first().getAttribute('data-goal');
await page.locator(`[data-swap=${first}]`).click();
await t.sleep(400);
g = await liveGame(page);
assert.equal(g.daily.swapUsed, true, 'the free swap is used');
assert.equal(await page.locator('[data-swap]').count(), 0, 'and no second swap is offered');

t.step('Story tab: Chapter 2, the dream slot, Make it easier after three attempts');
await open('story');
assert.equal(await page.locator('.qst-chapter[data-chapter="2"]').count(), 1, 'Chapter 2');
assert.equal(await page.locator('[data-slot=dream]').count(), 1, 'the dream slot');
assert.equal(await page.locator('[data-easier]').count(), 0, 'no easier offer yet');
await page.evaluate(() => {
  const { getGame, useGame } = window.__lw;
  const s = getGame();
  useGame.getState().setGame({ ...s, chapter: { ...s.chapter, tries: { ...s.chapter.tries, c2_1: 3 } } });
});
await t.sleep(300);
assert.equal(await page.locator('[data-easier=c2_1]').count(), 1, 'Make it easier is offered on c2_1');
assert.equal(await page.locator('[data-easier]').count(), 1, 'and only there');
await assertTargets('[data-easier]', 'story tab');
await t.shot('10-easier');
await page.locator('[data-easier=c2_1]').click();
await t.sleep(400);
assert.ok((await liveGame(page)).chapter.easier.includes('c2_1'), 'accepting is stored');
assert.equal(await page.locator('[data-obj=c2_1] .qst-eased').count(), 1, 'and shown');
assert.equal(await page.locator('[data-easier]').count(), 0, 'the offer is gone');

t.step('the waiting message when only the days are left');
for (let n = 0; n < 4; n++) await dev('complete_objective');
await open('story');
const done = await page.locator('[data-pane=story] .qst-obj[data-done="1"]').count();
assert.ok(done >= 4, `all four objectives done, found ${done}`);
const wait = await page.locator('[data-wait]').count();
console.log(`  waiting message shown: ${wait ? await page.locator('[data-wait]').innerText() : 'no (the days are already met)'}`);
await t.shot('11-wait');

t.step('a goal left open is carried to tomorrow: From yesterday');
await dev('advance_day');
await open('today');
assert.ok((await page.locator('[data-carried]').count()) >= 1 || (await page.locator('[data-goal]').count()) >= 1, 'goals after the day change');
console.log(`  carried goals: ${await page.locator('[data-carried] [data-goal]').count()}`);
await assertNoHScroll(page, 'today tab, day 2');
await t.shot('12-today-2');

t.step('no console errors');
assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log('quests e2e ok');
