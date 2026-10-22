// Release 2 wave B1, the hang-outs and the home visits end to end in the real UI at 360 px (docs/GAME_DESIGN.md §6.4, §8.8):
// fresh profile -> the dev tools take the game to Chapter 3 -> Mio at 3 hearts: a hang-out by tapping (keepsake, friendship, no yen,
// then "come back in N days" instead of a dead tap) -> the closed door says 「まだ入れません」 at 3 hearts and 「また今度ね」 inside
// the 3 days -> 4 hearts, 3 days later: the door opens -> the 3D visit to Mio's room (slippers first = the host's gentle line, shoes,
// slippers, the conversation to its end, a word card, Leave to the street) -> a second visit in PANEL FALLBACK mode (?panel=1) at Kenji's
// -> reload: the visits and the keepsakes are kept and the player is on the street. At each step: no horizontal scroll, no console
// errors, the wallet unchanged (hang-outs and visits pay hearts, not yen). English and, with --ar, Arabic (RTL).
// Usage: node tools/e2e/game/home.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { BASE, assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

const t = await start('home');
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
const world = (fn, ...args) => page.evaluate(([src, a]) => new Function(`return (${src})`)()(window.__world, ...a), [fn.toString(), args]);
const hearts = (friend, ap) =>
  patch(
    new Function(
      'g',
      `const f = g.friends[${JSON.stringify(friend)}] ?? { ap: 0, met: true, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
       return { ...g, friends: { ...g.friends, ${JSON.stringify(friend)}: { ...f, met: true, ap: ${ap} } } };`,
    ),
  );

/** closes whatever overlay is up (culture pop-ups, word cards, beats) until the street is clear */
async function settle() {
  for (let i = 0; i < 24; i++) {
    const screen = await page.evaluate(() => window.__lw.useStore.getState().screen);
    if (await page.locator('.cul-scrim .btn.primary').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if (screen === 'beat') await page.locator('.panel .btn.primary:not(:disabled), .panel [data-step=diary] [data-skip]').last().click().catch(() => {});
    else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

/** the beats of the chapter are not the subject: file them the way the player would */
async function skipChapterBeats() {
  await page.evaluate(() => {
    const ui = window.__lw.useUi.getState();
    for (const id of [...ui.beats]) window.__lw.dispatch({ t: 'beat_done', id });
    ui.clearRequests();
    window.__lw.dispatch({ t: 'dream_chosen', id: 'bike' });
    window.__lw.useStore.getState().go('world');
  });
  await t.sleep(300);
}

async function talkTo(id) {
  await settle();
  await go('world');
  await page.evaluate((c) => window.__world.teleportNear(c), id === 'tanaka' ? 'hanako' : 'tanaka');
  await t.sleep(500);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 20000 });
  await t.sleep(600);
  await page.locator('.talk-btn').click();
  await t.sleep(500);
}

/** taps the first suggestion until the "done" card shows */
async function tapThrough() {
  const tap = async () => {
    await page.waitForFunction(() => !document.querySelector('.bubble.typing') && document.querySelectorAll('.sg').length > 0, null, { timeout: 40000 });
    const n = await page.locator('.msg.char').count();
    await page.locator('.sg').first().click();
    await page.waitForFunction((k) => document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card'), n, { timeout: 40000 }).catch(() => {});
    await t.sleep(200);
  };
  for (let k = 0; k < 40 && !(await page.locator('.done-card').count()); k++) {
    if (await page.locator('.sg').count()) await tap();
    else await t.sleep(400);
  }
  await page.waitForSelector('.done-card', { timeout: 30000 });
}
/** the done card -> the debrief */
async function toDebrief() {
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.dbf-card', { timeout: 30000 });
  await t.sleep(500);
}
/** a hang-out or a visit pays hearts, not yen: the only ledger rows are the day's goal and streak bonuses, and wallet = checksum */
const noYenMoved = (a, b, where) => {
  const added = b.ledger.slice(a.ledger.length);
  assert.deepEqual(
    added.filter((e) => !['goal', 'streak'].includes(e.kind)),
    [],
    `${where}: no pay or purchase in the ledger`,
  );
  const bonus = added.reduce((n, e) => n + (e.pocket === 'cash' ? e.delta : 0), 0);
  assert.equal(b.wallet.cash, a.wallet.cash + bonus, `${where}: cash = before + the bonuses of the ledger`);
  assert.equal(b.wallet.ic, a.wallet.ic, `${where}: ic unchanged`);
  assert.equal(b.wallet.cash, b.totals.checksum.cash, `${where}: wallet = checksum`);
};
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
/** taps a door in the street; the Get-ready screen comes first (the pocket of the visit), skipped here */
async function knockOn(door) {
  await world((w, id) => w.simulatePick(id), door);
  await page.waitForSelector('.prep, [data-home-phase=genkan]', { timeout: 30000 });
  if (await page.locator('.prep').count()) {
    await t.shot(`prepare-${door.split(':')[1]}`);
    await page.locator('.prep-foot .prep-link').click();
  }
  await page.waitForSelector('[data-home-phase=genkan]', { timeout: 30000 });
}
/** a shot of the street or a room: the render loop rests meanwhile (a software-GL screenshot can outlast a 5 s tooltip) */
async function shot3d(name) {
  await page.evaluate(() => window.__world.setActive(false));
  await t.sleep(900); // the pop-in animations of the cards settle once the render loop rests
  await t.shot(name);
  await page.evaluate(() => window.__world.setActive(true));
}
const homePhase = () => page.evaluate(() => document.querySelector('[data-home-phase]')?.getAttribute('data-home-phase') ?? null);

// ---- 1. a fresh profile, Chapter 3 -------------------------------------------------------------------------------------
t.step('fresh profile -> dev tools -> Chapter 3');
await onboard(page, { arabic });
await skipBeats(page).catch(() => {});
if (arabic) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await patch((g) => ({ ...g, flags: { ...g.flags, dev: true } }));
for (let n = 0; n < 2; n++) {
  await dev('advance_chapter');
  await skipChapterBeats();
}
let g = await liveGame(page);
assert.equal(g.chapter.n, 3, 'Chapter 3 is current');
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await settle();

t.step("Aiko is a friend now: her tap opens the interaction sheet (tea house, talk, gift, hang-out locked) instead of the tea scenario");
await talkTo('aiko');
await page.waitForSelector('.hud-sheet [data-opt]', { timeout: 15000 });
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo), null, 'no conversation started by the tap');
assert.equal(await page.locator('[data-opt=aiko_shop]:not([aria-disabled=true])').count(), 1, 'the tea house row is open');
assert.equal(await page.locator('[data-opt=aiko_hang]').getAttribute('aria-disabled'), 'true', 'her hang-out waits for 3 hearts');
assert.equal(await page.locator('[data-opt=home_aiko]').getAttribute('aria-disabled'), 'true', 'her home waits for 4 hearts');
await assertNoHScroll(page, "Aiko's sheet");
await assertTargets('.hud-opt', "Aiko's sheet");
await t.shot('0-aiko-sheet');
await page.keyboard.press('Escape');
await t.sleep(300);

// ---- 2. the hang-out with Mio at 3 hearts -------------------------------------------------------------------------------
t.step('Mio at 2 hearts: the hang-out row is locked and says what it needs');
await hearts('mio', 80);
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_hang]', { timeout: 15000 });
assert.equal(await page.locator('[data-opt=mio_hang]').getAttribute('aria-disabled'), 'true', 'locked at 2 hearts');
assert.ok(/3|ثلاث/.test(await text('[data-opt=mio_hang] small')), `the row says 3 hearts: ${await text('[data-opt=mio_hang] small')}`);
await assertNoHScroll(page, 'talk list, locked hang-out');
await t.shot('1-hang-locked');
await page.keyboard.press('Escape');

t.step('Mio at 3 hearts: Hang out -> the conversation to the end -> the keepsake and the friendship, no yen');
await hearts('mio', 150);
const before = await liveGame(page);
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_hang]:not([aria-disabled=true])', { timeout: 15000 });
await t.shot('2-talk-list');
await page.locator('[data-opt=mio_hang]').click();
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('.convo', { timeout: 25000 });
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId), 'hang_mio_photo');
await page.waitForSelector('.sg', { timeout: 40000 });
await assertNoHScroll(page, 'hang-out conversation');
await t.shot('3-hang-convo');
await tapThrough();
await toDebrief();
g = await liveGame(page);
noYenMoved(before, g, 'hang-out');
assert.ok(g.friends.mio.ap > 150, `friendship grew: ${before.friends.mio?.ap} -> ${g.friends.mio.ap}`);
assert.ok(g.friends.mio.ap - 150 <= 60, `within the daily cap: +${g.friends.mio.ap - 150}`);
assert.ok(g.keepsakes.includes('photo_mio'), 'the keepsake is kept');
assert.equal(await page.locator('[data-keepsakes] [data-keepsake]').count(), 1, 'the debrief names the keepsake');
await assertNoHScroll(page, 'hang-out debrief');
await t.shot('4-hang-debrief');
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(900);
await settle();

t.step('the same day: the hang-out row says how long to wait (no dead tap)');
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_hang]', { timeout: 15000 });
assert.equal(await page.locator('[data-opt=mio_hang]').getAttribute('aria-disabled'), 'true');
assert.ok(/3|2|ثلاث|يوم|ثلاثة/.test(await text('[data-opt=mio_hang] small')), 'the cooldown text');
await t.shot('5-hang-cooldown');
await page.keyboard.press('Escape');

// ---- 3. the closed door -------------------------------------------------------------------------------------------------
t.step('the door at 3 hearts is closed: 「まだ入れません」 and the reason');
await go('world');
await t.sleep(400);
assert.equal(await world((w) => w.isDoorOpen('mio')), false, 'the world door is closed at 3 hearts');
await world((w) => w.simulatePick('door:mio'));
await page.waitForSelector('[data-home=door-tip]', { timeout: 8000 });
assert.equal(await page.locator('[data-door-status=hearts]').count(), 1, 'the hearts reason');
// the line carries furigana and romaji (.rt, .rm): read the base text only
const tipJa = await page.evaluate(() => {
  const c = document.querySelector('.home-tip-ja').cloneNode(true);
  c.querySelectorAll('.rt, .rm').forEach((e) => e.remove());
  return c.textContent;
});
assert.ok(/まだ入れません/.test(tipJa), `the Japanese line: ${tipJa}`);
assert.ok(/4/.test(await text('.home-tip-text')), 'it says 4 hearts');
await assertNoHScroll(page, 'door tip');
await shot3d('6-door-closed');
await page.locator('[data-home=door-tip]').click();

t.step('4 hearts inside the 3 days: the door is open but the tap says to come back later');
await hearts('mio', 240);
await t.sleep(500);
assert.equal(await world((w) => w.isDoorOpen('mio')), true, 'the world door opens at 4 hearts, live');
await world((w) => w.simulatePick('door:mio'));
await page.waitForSelector('[data-door-status=wait]', { timeout: 8000 });
await shot3d('7-door-wait');
await page.locator('[data-home=door-tip]').click();

// ---- 4. the visit to Mio's room, 3D ---------------------------------------------------------------------------------------
t.step('three days later: tap the open door -> the genkan in the 3D room');
for (let n = 0; n < 3; n++) await dev('advance_day');
await settle();
await go('world');
await t.sleep(400);
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ graphics: 'high' }));
const beforeVisit = await liveGame(page);
await knockOn('door:mio');
assert.equal(await page.locator('[data-home-mode="3d"]').count(), 1, 'the 3D room loaded');
assert.equal(await world((w) => w.currentStage()), 'mio_1r');
assert.equal(await page.locator('.hud').count(), 0, 'the street HUD is out of the way inside');
await t.sleep(900);
await assertNoHScroll(page, 'genkan');
await assertTargets('[data-genkan], [data-home=leave-x]', 'genkan buttons');
await shot3d('8-genkan');

t.step('slippers first: the host answers gently, nothing changes');
await page.locator('[data-genkan=slippers]').click();
await page.waitForSelector('[data-home=say]', { timeout: 5000 });
assert.ok(/脱いで/.test(await text('[data-home=say]')), `the host's gentle line: ${await text('[data-home=say]')}`);
assert.equal(await page.locator('[data-genkan=shoes].done').count(), 0, 'no step done');
assert.equal(await homePhase(), 'genkan');
await assertNoHScroll(page, 'wrong-order line');
await shot3d('9-genkan-wrong');

t.step('shoes (a tap on them in the room), then the slippers (button) -> the conversation starts');
await world((w) => w.simulatePick('genkan:shoes'));
await page.waitForSelector('[data-genkan=shoes].done', { timeout: 5000 });
await shot3d('10-shoes-off');
await page.locator('[data-genkan=slippers]').click();
await page.waitForSelector('.convo', { timeout: 15000 });
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId), 'home_mio');
g = await liveGame(page);
assert.ok(g.flags.genkan_ok || g.friends.mio.flags?.includes('genkan_ok') || JSON.stringify(g).includes('genkan_ok'), 'genkan_ok is filed');
assert.ok(!g.stats.visits.includes('home:mio') && g.culture.cc_shoesoff === undefined, 'the genkan alone files no visit and no card: the talk does');
await page.waitForSelector('.sg', { timeout: 40000 });
await t.sleep(500);
await assertNoHScroll(page, 'home conversation');
await t.shot('11-home-convo');
await tapThrough();
await toDebrief();
g = await liveGame(page);
noYenMoved(beforeVisit, g, 'home visit');
assert.ok(g.keepsakes.includes('photo_printed'), 'the visit keepsake');
assert.equal(await page.locator('[data-keepsakes] [data-keepsake]').count(), 1, 'the debrief names it');
assert.ok(g.stats.visits.includes('home:mio'), 'visits stat');
assert.ok(g.culture.cc_shoesoff !== undefined, 'the genkan culture card is collected when the talk is finished');
await t.shot('12-home-debrief');
await page.locator('.panel-foot .btn.primary').click();
await page.waitForSelector('[data-home-phase=inside]', { timeout: 15000 });
await settle();

t.step('back in the room: tap a prop -> its word card; the found counter');
await t.sleep(600);
await assertTargets('[data-home=leave]', 'leave');
await world((w) => w.simulatePick('prop:mio_1r:kamera'));
await page.waitForSelector('.word-scrim', { timeout: 8000 });
assert.ok(/カメラ/.test(await text('.word-scrim')), 'the camera word card');
await assertNoHScroll(page, 'word card');
await shot3d('13-word-card');
await page.locator('.word-scrim .word-close').last().click();
await t.sleep(400);
assert.ok(/1/.test(await text('[data-home=found]')), `one word found: ${await text('[data-home=found]')}`);
await shot3d('14-inside');
t.step('Leave -> the street, at the door');
await page.locator('[data-home=leave]').click();
await page.waitForFunction(() => window.__world.currentStage() === null, null, { timeout: 15000 });
await page.waitForSelector('.hud', { timeout: 8000 });
await t.sleep(900);
assert.equal(await page.locator('[data-home-phase]').count(), 0, 'no home UI on the street');
await assertNoHScroll(page, 'street after leaving');
await shot3d('15-street-after');

t.step('the stamp book: the genkan card was collected by the first visit (it was hidden before)');
await go('culture');
await page.waitForSelector('[data-culture-book]', { timeout: 10000 });
assert.equal(await page.locator('[data-card=cc_shoesoff]').count(), 1, 'cc_shoesoff is in the stamp book');
assert.notEqual(await page.locator('[data-card=cc_shoesoff]').getAttribute('data-state'), 'locked', 'and collected');
await t.shot('15b-stamp-book');
await go('world');
await t.sleep(500);

// ---- 5. the second visit, panel fallback, Kenji -------------------------------------------------------------------------------
t.step('?panel=1: Kenji at 4 hearts, the panel fallback with the same genkan buttons and conversation');
await hearts('kenji', 240);
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.goto(`${BASE}?panel=1`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
await settle();
await go('world');
await t.sleep(600);
const beforeKenji = await liveGame(page);
await knockOn('door:kenji');
assert.equal(await page.locator('[data-home-mode=panel]').count(), 1, 'the panel fallback');
assert.equal(await world((w) => w.currentStage()), null, 'no stage loaded');
await t.sleep(600);
await assertNoHScroll(page, 'panel genkan');
await assertTargets('[data-genkan], [data-home=leave-x]', 'panel genkan buttons');
await t.shot('16-panel-genkan');
await page.locator('[data-genkan=slippers]').click();
await page.waitForSelector('[data-home=say]', { timeout: 5000 });
await t.shot('17-panel-wrong');
await page.locator('[data-genkan=shoes]').click();
await page.locator('[data-genkan=slippers]').click();
await page.waitForSelector('.convo', { timeout: 15000 });
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId), 'home_kenji');
await page.waitForSelector('.sg', { timeout: 40000 });
await t.sleep(400);
await assertNoHScroll(page, 'panel conversation');
await t.shot('18-panel-convo');
t.step('leave the talk half way: back in the room with "Talk to Kenji", and Leave asks first');
await page.locator('.convo-head .icon-btn').first().click();
await page.locator('.scrim .btn.danger').click();
await page.waitForSelector('[data-home-phase=inside]', { timeout: 15000 });
await settle();
await page.waitForSelector('[data-home=talk]', { timeout: 5000 });
await assertTargets('[data-home=talk], [data-home=leave]', 'talk again / leave');
await t.shot('18b-panel-unfinished');
await page.locator('[data-home=leave]').click();
await page.waitForSelector('[data-home=confirm]', { timeout: 5000 });
await assertNoHScroll(page, 'leave confirm');
await t.shot('18c-leave-confirm');
await page.locator('[data-home=stay]').click();
assert.equal(await page.locator('[data-home=confirm]').count(), 0, 'Stay closes the question');
await page.locator('[data-home=talk]').click();
await page.waitForSelector('.sg', { timeout: 40000 });
await tapThrough();
await toDebrief();
g = await liveGame(page);
noYenMoved(beforeKenji, g, 'panel visit');
assert.ok(g.keepsakes.includes('hina_drawing'), "Hina's drawing");
await page.locator('.panel-foot .btn.primary').click();
await page.waitForSelector('[data-home-phase=inside]', { timeout: 15000 });
await settle();
assert.ok((await page.locator('[data-prop]').count()) === 6, 'six prop chips');
await t.sleep(400);
await assertNoHScroll(page, 'panel inside');
await assertTargets('[data-prop], [data-home=leave]', 'panel chips');
await t.shot('19-panel-inside');
await page.locator('[data-prop=suihanki]').click();
await page.waitForSelector('.word-scrim', { timeout: 8000 });
assert.ok(/炊飯器/.test(await text('.word-scrim')), 'the rice cooker card');
await t.shot('20-panel-word');
await page.locator('.word-scrim .word-close').last().click();
await t.sleep(300);
assert.equal(await page.locator('[data-prop=suihanki].seen').count(), 1, 'the chip shows it was seen');
await page.locator('[data-home=leave]').click();
await page.waitForSelector('.hud', { timeout: 8000 });
await t.sleep(600);
assert.equal(await page.locator('[data-home-phase]').count(), 0);
await assertNoHScroll(page, 'street after panel');

// ---- 6. reload: state kept, the player on the street ----------------------------------------------------------------------------
t.step('reload: visits and keepsakes are kept, the player is on the street');
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
await settle();
g = await liveGame(page);
assert.ok(g.stats.visits.includes('home:mio') && g.stats.visits.includes('home:kenji'), `visits kept: ${g.stats.visits}`);
for (const k of ['photo_mio', 'photo_printed', 'hina_drawing']) assert.ok(g.keepsakes.includes(k), `${k} kept`);
assert.equal(await world((w) => w.currentStage()), null, 'on the street');
assert.equal(await page.locator('[data-home-phase]').count(), 0);
assert.equal(await world((w) => w.isDoorOpen('mio')), true, 'the door is still open after the reload');
assert.equal(await world((w) => w.isDoorOpen('aiko')), false, "Aiko's door is shut (she is not at 4 hearts)");
await assertNoHScroll(page, 'after reload');
await t.shot('21-reload');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`home e2e passed (${arabic ? 'ar' : 'en'})`);
