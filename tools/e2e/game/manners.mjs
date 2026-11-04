// Manners (所作, docs/ROADMAP.md) in the REAL UI at 360 px, English or Arabic (--ar):
//   the shrine lists the five manners with their prices -> the deep bow (お辞儀) bought with Goen -> a conversation with Mio (met) shows the
//   manners row; tapping お辞儀 arms it (the hint names a fitting line) -> 「ありがとうございます」 typed: good manners, Mio's affinity +4 ->
//   armed again with 「またね」: a gentle hint, nothing more -> a manner not owned is not offered. No horizontal scroll, no console error.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/manners.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('manners', { weekday: true });
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const go = (s) => page.evaluate((x) => window.__lw.useStore.getState().go(x), s);
const toast = () => page.evaluate(() => window.__lw.useStore.getState().toast?.text ?? '');
const check = async (where) => {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
};
async function waitToast(re, what) {
  for (let i = 0; i < 40; i++) {
    const x = await toast();
    if (re.test(x)) return x;
    await t.sleep(150);
  }
  throw new Error(`no toast for ${what}: last "${await toast()}"`);
}

await onboard(page, { arabic: AR });
await skipBeats(page);
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
// 100 Goen to spend, and Mio already met (the manners only count with a friend you know)
await page.evaluate(() => {
  const lw = window.__lw;
  const g = lw.getGame();
  const goen = { ...g.goen, balance: g.goen.balance + 100, totals: { ...g.goen.totals, earned: g.goen.totals.earned + 100 }, ledger: [...g.goen.ledger, { id: 'goen:test:100', at: Date.now(), delta: 100, kind: 'chapter', ref: 'test' }] };
  const blank = { ap: 0, met: false, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
  const mio = { ...blank, ...(g.friends.mio ?? {}), met: true };
  lw.useGame.getState().setGame({ ...g, goen, friends: { ...g.friends, mio: { ...mio } } });
});
step('fresh profile, 100 Goen');

// the shrine lists the manners
await go('shrine');
await page.waitForSelector('[data-goen-item=manner_ojigi]', { state: 'attached', timeout: 10000 }).catch(async (e) => {
  await t.shot('zz-shrine');
  console.log(await page.evaluate(() => JSON.stringify({ screen: window.__lw.useStore.getState().screen, body: document.body.innerText.slice(0, 300) })));
  throw e;
});
for (const id of ['manner_ojigi', 'manner_eshaku', 'manner_wave', 'manner_ryote', 'manner_itadakimasu']) assert.equal(await page.locator(`[data-goen-item=${id}]`).count(), 1, id);
await page.locator('[data-goen-item=manner_ojigi]').scrollIntoViewIfNeeded();
await t.shot('shrine-manners');
await check('shrine');
// the coin toss of the ritual is the purchase (the whole ritual is exercised by goen.mjs)
await page.evaluate(() => window.__lw.dispatch({ t: 'goen_spend', itemId: 'manner_ojigi', id: 'e2e' }));
let g = await liveGame(page);
assert.ok(g.goen.owned.manner_ojigi, 'the deep bow is owned');
assert.equal(g.goen.balance, 60);
step('the shrine lists five manners; the deep bow (40 Goen) is bought');

// a conversation with Mio (the shrine visit's culture card comes up over the street first)
await go('world');
await t.sleep(600);
for (let i = 0; i < 6 && (await page.locator('.cul-scrim').count()); i++) {
  await page.locator('.cul-scrim .btn.primary').click();
  await t.sleep(300);
}
await page.evaluate(() => window.__world.teleportNear('tanaka'));
await t.sleep(500);
await page.evaluate(() => window.__world.teleportNear('mio'));
await page.waitForFunction(() => window.__world.nearby === 'mio', null, { timeout: 20000 });
await t.sleep(700);
await page.locator('.talk-btn').click();
await t.sleep(700);
if (await page.locator('[data-opt=mio_meet]').count()) await page.locator('[data-opt=mio_meet]').click();
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-link').first().click();
await page.waitForSelector('.convo', { timeout: 25000 });
await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
await page.waitForSelector('[data-manners] [data-manner=manner_ojigi]');
assert.equal(await page.locator('[data-manner]').count(), 1, 'only the manner owned is offered');
step('in the conversation: the manners row offers お辞儀');

// arm it, then a line that fits
const ap0 = (await liveGame(page)).friends.mio.ap;
await page.locator('[data-manner=manner_ojigi]').click();
assert.equal(await page.locator('[data-manner=manner_ojigi]').getAttribute('aria-pressed'), 'true', 'armed');
await waitToast(/ありがとうございます/, 'armed hint');
await t.shot('armed');
let lines = await page.locator('.msg.char').count();
await page.fill('#say', 'ありがとうございます。');
await page.locator('.send').click();
await waitToast(AR ? /آداب/ : /Good manners/, 'good manners');
await t.shot('good-manners');
g = await liveGame(page);
assert.equal(g.friends.mio.ap, ap0 + 4, `Mio's affinity +4 (${ap0} -> ${g.friends.mio.ap})`);
assert.equal(await page.locator('[data-manner=manner_ojigi]').getAttribute('aria-pressed'), 'false', 'disarmed after the line');
await check('good manners');
step('お辞儀 + 「ありがとうございます」: good manners, Mio +4');

// a line that does not fit: a hint, nothing else
await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), lines, { timeout: 40000 });
if (!(await page.locator('.done-card').count())) {
  lines = await page.locator('.msg.char').count();
  await page.locator('[data-manner=manner_ojigi]').click();
  await page.fill('#say', 'またね');
  await page.locator('.send').click();
  await waitToast(/ありがとうございます/, 'the hint names a fitting line');
  assert.equal((await liveGame(page)).friends.mio.ap, ap0 + 4, 'no more affinity');
  step('お辞儀 + 「またね」: a gentle hint, nothing more');
}

await check('end');
await t.browser.close();
console.log(`manners e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
