// カラオケ「うたひろば」 (the karaoke box) in the REAL UI at 360 px, English or Arabic (--ar):
//   a fresh profile -> Chapter 3, Mio met with a heart -> the karaoke door with no room says to book at the desk -> Nanami, typed: 二人で一時間
//   お願いします, cash: exactly ¥1,000, the room booked for today -> the invite sheet comes up on the street: Mio -> the room with Mio, typed: the
//   song (桜通りを歌いたいです), a drink (ウーロン茶がいいです), 乾杯, the chorus (桜通りで会おうよ / 明日も一緒に笑おうよ), the praise, また来ましょう ->
//   the booking is used, one room sung, Mio's affinity rose. After every step: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/karaoke.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('karaoke', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const DEBUG = !!process.env.DEBUG;
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const dev = async (cmd, amount) => {
  await page.evaluate(([c, a]) => window.__lw.dispatch({ t: 'dev', cmd: c, amount: a }), [cmd, amount]);
  await t.sleep(300);
};

async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
}

/** Clears story beats, culture cards and word sheets that come up over the street. */
async function settle() {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.cul-scrim').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if ((await screen()) === 'beat') {
      await page.evaluate(() => {
        const ui = window.__lw.useUi.getState();
        for (const id of [...ui.beats]) window.__lw.dispatch({ t: 'beat_done', id });
        ui.clearRequests();
        if (!window.__lw.getGame().dream?.id) window.__lw.dispatch({ t: 'dream_chosen', id: 'travel' });
        window.__lw.useStore.getState().go('world');
      });
    } else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

async function talkToNanami() {
  await settle();
  await go('world');
  await page.evaluate(() => window.__world.teleportNear('aiko'));
  await t.sleep(500);
  await page.evaluate(() => window.__world.teleportNear('nanami'));
  await page.waitForFunction(() => window.__world.nearby === 'nanami', null, { timeout: 20000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
  if (await page.locator('[data-opt=nanami_desk]').count()) await page.locator('[data-opt=nanami_desk]').click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
}

const lineAfter = async (n) => {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
};

/** Plays the conversation: a RegExp (the chip whose Japanese matches) or `{ type }` (typed). */
async function drive(plan) {
  for (const want of plan) {
    await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    const lines = await page.locator('.msg.char').count();
    if ('type' in want) {
      await page.fill('#say', want.type);
      await page.locator('.send').click();
    } else {
      const texts = (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
      const idx = texts.findIndex((x) => want.test(x));
      if (DEBUG) console.log(`   [${texts.join(' | ')}] want ${want} -> ${idx}`);
      assert.ok(idx >= 0, `no suggestion matches ${want} among ${texts.join(' | ')}`);
      await page.locator('.sg').nth(idx).click();
    }
    await Promise.race([lineAfter(lines), page.waitForSelector('.done-card', { timeout: 40000 })]);
  }
  await page.waitForSelector('.done-card', { timeout: 40000 });
}

async function finish() {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  await settle();
}

// ---------------------------------------------------------------------------------------------------------------
await onboard(page, { arabic: AR });
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await dev('advance_chapter');
await settle();
await dev('advance_chapter');
await settle();
// Mio met, one heart (someone to sing with)
await page.evaluate(() => {
  const lw = window.__lw;
  const g = lw.getGame();
  const blank = { ap: 0, met: false, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
  lw.useGame.getState().setGame({ ...g, friends: { ...g.friends, mio: { ...blank, ...(g.friends.mio ?? {}), met: true, ap: 35 } } });
});
assert.ok((await liveGame(page)).chapter.n >= 3, 'Chapter 3');
step('fresh profile -> Chapter 3, Mio met (one heart)');

// the door with no room booked
await go('world');
await page.evaluate(() => window.__world.teleportNear('nanami'));
await page.waitForFunction(() => window.__world.nearby === 'nanami', null, { timeout: 20000 });
await t.sleep(1200);
await t.shot('front');
await page.evaluate(() => window.__world.simulatePick('karaoke:room'));
await page.waitForSelector('[data-karaoke-invite]', { timeout: 5000 });
assert.equal(await page.locator('[data-karaoke-friend]').count(), 0, 'no room: no one to invite yet');
await page.locator('[data-karaoke-later]').click();
await check('the karaoke front');
step('the karaoke box: Nanami at the door; the door with no room says to book at the desk');

// Nanami, typed: two people, one hour, cash
const g0 = await liveGame(page);
await talkToNanami();
await drive([{ type: '二人で一時間お願いします。' }, { type: '現金でお願いします。' }]);
let g = await liveGame(page);
assert.equal(g.karaoke.booked, g.clock.dayIndex, 'the room is booked for today');
assert.equal(g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned), 1000, 'exactly ¥1,000');
// the debrief, then the street: the invite sheet is up (no overlay clean-up here: it would close the sheet)
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await t.sleep(300);
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(800);
for (let i = 0; i < 6 && (await page.locator('.cul-scrim').count()); i++) {
  await page.locator('.cul-scrim .btn.primary').click(); // the karaoke culture card (pay first, by the hour)
  await t.sleep(300);
}
await page.waitForSelector('[data-karaoke-invite] [data-karaoke-friend=mio]', { timeout: 10000 });
await t.shot('invite');
await check('the invite sheet');
step('Nanami, typed: 二人で一時間, cash: ¥1,000; the invite sheet offers Mio');

// the room with Mio
const ap0 = g.friends.mio.ap;
await page.locator('[data-karaoke-friend=mio]').click();
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-link').first().click();
await page.waitForSelector('.convo', { timeout: 25000 });
await drive([
  { type: '桜通りを歌いたいです。' },
  { type: 'ウーロン茶がいいです。' },
  { type: '乾杯！' },
  { type: '桜通りで会おうよ。' },
  { type: '明日も一緒に笑おうよ。' },
  { type: 'ありがとう！楽しいです！' },
  { type: 'また来ましょう！' },
]);
await t.shot('room-done');
await finish();
g = await liveGame(page);
assert.equal(g.karaoke.booked, -1, 'the booking is used');
assert.equal(g.karaoke.sung, 1, 'one room sung');
assert.ok(g.friends.mio.ap > ap0, `Mio's affinity rose (${ap0} -> ${g.friends.mio.ap})`);
await check('after the room');
step(`the room with Mio, typed: the song, a drink, 乾杯, the chorus, the praise, また来ましょう; Mio ${ap0} -> ${g.friends.mio.ap}`);

await t.browser.close();
console.log(`karaoke e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
