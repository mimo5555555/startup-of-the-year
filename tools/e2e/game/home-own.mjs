// Release 2 wave B2, the player's own room end to end in the REAL UI at 360 px (docs/GAME_DESIGN.md §8.8, D12, D23): fresh profile, the dev tools only for
// yen, the chapter jump to Free Walk and hearts ->
//   the dorm (door:dorm, always open): the Furnish sheet with its four places, nothing to place yet ->
//   Rin: the kotatsu is "not in stock" (a flat piece, nothing charged); a futon with DELIVERY (exactly 8,000 + 2,200 charged, booked, not owned), a
//   houseplant carried home (1,200) -> the Wallet's room card says when the futon arrives -> the plant is placed (piece, then place; wrong place answered;
//   a placed piece taken out and put back), comfort rises -> the next calendar day delivers the futon (toast), it is placed in 3D by the marker of the bed
//   -> comfort 4 -> Aiko: the viewing (three questions), then the contract: a wrong total is corrected, 六万円, the signature, cash, EXACTLY 60,000 yen ->
//   the flat's door opens, the dorm's closes (a tap says so) -> the flat: the genkan once, cc_trash, the room kept the dorm's pieces, two more pieces
//   bought and placed -> a friend (2 hearts) is invited from her Talk list (locked while the room is too bare) -> the housewarming in the room, the
//   flag, the friendship, the 3-day wait -> reload keeps the tier, the placements and the doors -> the panel fallback (?panel=1) shows the same room
//   with the furniture as word chips. At each step: no horizontal scroll, no console error, wallet = ledger.
// Usage: node tools/e2e/game/home-own.mjs [--ar]   (dev server up; BASE overrides the URL)
import assert from 'node:assert/strict';
import { BASE, DAY_MS, assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, skipBeats, start } from './_common.mjs';

// Free Walk / Chapter 8: a weekday, so the Saturday festival never turns the park mid-run (`clockShift`)
const t = await start('home-own', { weekday: true });
const { page, arabic: AR } = t;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-15).join('\n'));
    await t.shot('zz-failure').catch(() => {});
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
  await t.sleep(250);
};
const patch = (fn) =>
  page.evaluate((src) => {
    const g = window.__lw.getGame();
    window.__lw.useGame.getState().setGame(new Function('g', `return (${src})(g)`)(g));
  }, fn.toString());
const world = (fn, ...args) => page.evaluate(([src, a]) => new Function(`return (${src})`)()(window.__world, ...a), [fn.toString(), args]);
const hearts = (friend, ap) =>
  patch(
    new Function(
      'g',
      `const f = g.friends[${JSON.stringify(friend)}] ?? { ap: 0, met: true, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
       return { ...g, friends: { ...g.friends, ${JSON.stringify(friend)}: { ...f, met: true, ap: ${ap} } } };`,
    ),
  );
const text = (sel) => page.locator(sel).first().innerText();

/** After every step: no horizontal scroll, no console error, wallet = ledger (cash + ic = start + earned - spent; each pocket against its checksum). */
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

/** Closes whatever is in the way: culture pop-ups, story beats, a word card, an open sheet. */
async function settle() {
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.cul-scrim .btn.primary').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if ((await screen()) === 'beat') {
      if (await page.locator('[data-ask=dream] [data-choose]').count()) await page.locator('[data-choose]').first().click();
      else if (await page.locator('[data-step=nameKana] [data-save]').count()) await page.locator('[data-step=nameKana] [data-save]').click();
      else if (await page.locator('.qst-beat [data-continue]').count()) await page.locator('.qst-beat [data-continue]').first().click();
      else if (await page.locator('[data-ask=dream] .btn').count()) await page.locator('[data-ask=dream] .btn').last().click();
      else await page.locator('.panel .btn.primary:not(:disabled), .panel [data-step=diary] [data-skip]').last().click().catch(() => {});
    } else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

async function talkTo(id) {
  await settle();
  await go('world');
  await page.evaluate((c) => window.__world.teleportNear(c), id === 'tanaka' ? 'hanako' : 'tanaka');
  await t.sleep(500);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 20000 });
  await t.sleep(700);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
}

const charLines = () => page.locator('.msg.char').count();
async function lineAfter(n) {
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
}
const chips = async () => (await page.locator('.sg').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
async function tap(re) {
  const n = await charLines();
  const texts = await chips();
  const idx = texts.findIndex((x) => re.test(x));
  assert.ok(idx >= 0, `no suggestion matches ${re} among ${texts.join(' | ')}`);
  await page.locator('.sg').nth(idx).click();
  await lineAfter(n);
}
async function say(line) {
  const n = await charLines();
  await page.fill('#say', line);
  await page.locator('.send').click();
  await lineAfter(n);
}
const lastChar = () => page.locator('.msg.char').last().innerText();
const lastChip = async () => (await page.locator('.msg.char').last().locator('.dbf-price b').first().innerText().catch(() => '')).replace(/[^0-9]/g, '');

/** Walks to a character, presses Talk and picks the row; ends on the first line of the conversation (the Get-ready screen is skipped). */
async function openConvo(charId, optId, scenarioId) {
  await talkTo(charId);
  await page.waitForSelector(`[data-opt=${optId}], .prep, .convo`, { timeout: 15000 });
  if (await page.locator(`[data-opt=${optId}]`).count()) await page.locator(`[data-opt=${optId}]`).click();
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
  await t.sleep(400);
  if (scenarioId) assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId ?? null), scenarioId, `the ${scenarioId} conversation`);
}
/** taps the first suggestion until the "done" card shows */
async function tapThrough() {
  for (let k = 0; k < 40 && !(await page.locator('.done-card').count()); k++) {
    if (await page.locator('.sg').count()) {
      await page.waitForFunction(() => !document.querySelector('.bubble.typing') && document.querySelectorAll('.sg').length > 0, null, { timeout: 40000 }).catch(() => {});
      const n = await charLines();
      await page.locator('.sg').first().click();
      await page.waitForFunction((c) => document.querySelectorAll('.msg.char').length > c || !!document.querySelector('.done-card'), n, { timeout: 40000 }).catch(() => {});
      await t.sleep(200);
    } else await t.sleep(400);
  }
  await page.waitForSelector('.done-card', { timeout: 30000 });
}
/** The done card, the debrief and back (to the world, or to the room when the talk was in one). */
async function finish() {
  await page.waitForSelector('.done-card', { timeout: 40000 });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.dbf-card', { timeout: 25000 });
  await t.sleep(500);
}
async function backToWorld() {
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(900);
  await settle();
  await go('world');
  await t.sleep(600);
}
/** a shot of the street or a room: the render loop rests meanwhile (a software-GL screenshot can outlast a 5 s tooltip) */
async function shot3d(name) {
  await page.evaluate(() => window.__world.setActive(false));
  await t.sleep(900);
  await t.shot(name);
  await page.evaluate(() => window.__world.setActive(true));
}
const ownPhase = () => page.evaluate(() => document.querySelector('[data-own-phase]')?.getAttribute('data-own-phase') ?? null);
const ownAttr = (a) => page.evaluate((x) => document.querySelector('[data-own-phase]')?.getAttribute(x) ?? null, a);
const comfortNow = async () => Number(await page.locator('[data-own=comfort]').first().getAttribute('data-comfort'));
const toastText = () => page.evaluate(() => window.__lw.useStore.getState().toast?.text ?? '');

/** taps a door in the street and waits until the room is up (the genkan or inside) */
async function enter(door) {
  await go('world');
  await t.sleep(300);
  await world((w, id) => w.simulatePick(id), door);
  await page.waitForSelector('[data-own-phase=inside], [data-own-phase=genkan]', { timeout: 30000 });
  await t.sleep(700);
}
async function leaveRoom() {
  await page.locator('[data-home=leave]').click();
  await page.waitForFunction(() => window.__world.currentStage() === null, null, { timeout: 15000 });
  await page.waitForSelector('.hud', { timeout: 10000 });
  await t.sleep(500);
}
const openFurnish = async () => {
  await page.locator('[data-own=furnish-open]').click();
  await page.waitForSelector('[data-own=furnish]', { timeout: 5000 });
  await t.sleep(400);
};
const closeFurnish = async () => {
  await page.locator('[data-own=furnish-done]').click();
  await page.waitForFunction(() => !document.querySelector('[data-own=furnish]'), null, { timeout: 5000 });
};
/** piece, then place (the list); the room redraws live */
async function placeByList(piece, slot) {
  await page.locator(`[data-piece=${piece}][data-state=ready]`).click();
  await t.sleep(250);
  assert.equal(await page.locator('[data-target=true]').count(), 1, 'the place of the picked piece is marked');
  await page.locator(`[data-slot=${slot}]`).click();
  await page.waitForFunction(([s, p]) => document.querySelector(`[data-slot=${s}]`)?.getAttribute('data-slot-piece') === p, [slot, piece], { timeout: 5000 });
  await t.sleep(300);
}

// ---- 0. a fresh profile in Free Walk ----------------------------------------------------------------------------------------
step('fresh profile -> dev tools: yen, Free Walk, hearts');
await onboard(page, { arabic: AR });
await skipBeats(page).catch(() => {});
if (AR) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
await patch((g) => ({ ...g, chapter: { ...g.chapter, n: 9 } }));
await dev('cash', 100_000);
await page.evaluate(() => window.__lw.dispatch({ t: 'dream_chosen', id: 'flat' }));
await hearts('mio', 80); // 2 hearts: can be invited once the room is comfortable
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true, graphics: 'high' }));
await settle();
await go('world');
let g = await liveGame(page);
assert.equal(g.chapter.n, 9, 'Free Walk');
assert.notEqual(await world((w) => w.festivalInfo()?.on), true, 'an ordinary day in the park (the calendar is pinned to a weekday)');
assert.equal(g.home.tier, 'dorm', 'the dorm is the first room');
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().profile.age), 'adults', 'an adult profile');
assert.equal(await world((w) => w.isDoorOpen('dorm')), true, 'the dorm door is open from the start');
assert.equal(await world((w) => w.isDoorOpen('flat')), false, "the flat's door is shut");
await check('start');

// ---- 1. the flat's door before the rent -------------------------------------------------------------------------------------
step("the flat's door says it is Aiko's building");
await world((w) => w.simulatePick('door:flat'));
await page.waitForSelector('[data-door-status=flat_closed]', { timeout: 8000 });
await shot3d('1-flat-door-closed');
await assertNoHScroll(page, 'flat door tip');
await page.locator('[data-home=door-tip]').click();

// ---- 2. the dorm ------------------------------------------------------------------------------------------------------------
step('the dorm: 3D room, no street HUD, comfort 1, the Furnish sheet shows 4 empty places and nothing to place');
await enter('door:dorm');
assert.equal(await ownAttr('data-own-mode'), '3d', 'the 3D dorm loaded');
assert.equal(await ownPhase(), 'inside', 'no genkan for the dorm');
assert.equal(await world((w) => w.currentStage()), 'dorm');
assert.equal(await page.locator('.hud').count(), 0, 'the street HUD is out of the way inside');
assert.equal(await comfortNow(), 1, 'comfort 1 in the dorm');
await assertTargets('[data-own=furnish-open], [data-home=leave], [data-home=leave-x]', 'dorm buttons');
await shot3d('2-dorm');
await world((w) => w.setMove(0, 1)); // a thumb still on the stick when Furnish is tapped: the stick goes away, the walking must stop
await openFurnish();
assert.equal(await world((w) => w.stick.lengthSq()), 0, 'opening Furnish stops the walk');
assert.equal(await page.locator('[data-own=slots] [data-slot]').count(), 4, 'four places in the dorm');
assert.deepEqual(await world((w) => w.stageInfo().slots), ['bed', 'shelf', 'desk', 'plant'], 'the stage has the same four places');
assert.equal(await world((w) => w.getStageState().showSlots), true, 'the markers show while the sheet is open');
assert.equal(await page.locator('[data-piece]').count(), 0, 'no pieces yet');
assert.ok((await text('[data-own=hint]')).length > 10, 'the sheet says there is nothing to place yet');
await assertNoHScroll(page, 'furnish, empty');
await assertTargets('[data-own=furnish] button', 'furnish buttons');
await shot3d('3-furnish-empty');
await closeFurnish();
assert.equal(await world((w) => w.getStageState().showSlots), false, 'the markers are off again');
await leaveRoom();
assert.equal(await page.locator('[data-own-phase]').count(), 0, 'no room UI on the street');
await check('dorm');

// ---- 3. Rin: the kotatsu is not for the dorm, a futon with delivery, a plant carried home --------------------------------------
step('Rin: the kotatsu is not in stock yet (a flat piece): nothing charged');
const cash0 = (await liveGame(page)).wallet.cash;
await openConvo('rin', 'rin_home', 'fuku_home');
await t.shot('4-rin-greet');
await say('こたつをください');
assert.match(await lastChar(), /in stock|بعد/, `Rin says it is not in stock: ${await lastChar()}`);
assert.equal((await liveGame(page)).wallet.cash, cash0, 'nothing charged');

step('Rin: a futon with delivery -> exactly the piece plus 2,200, booked, not owned yet');
await tap(/布団/);
assert.equal(await lastChip(), '8000', 'the price chip shows 8,000');
await tap(/これ/);
await tap(/配送/);
await tap(/明日/);
assert.equal(await lastChip(), '10200', 'the total with the delivery fee: 10,200');
await t.shot('5-rin-total');
await assertNoHScroll(page, 'delivery quote');
await tap(/現金/);
await tapThrough();
const beforeLedger = g.ledger.length;
g = await liveGame(page);
assert.equal(g.wallet.cash, cash0 - 10_200, 'charged exactly 8,000 + 2,200');
const purchase = g.ledger.slice(beforeLedger).filter((e) => e.kind === 'purchase' && e.pocket === 'cash');
assert.equal(purchase.length, 1, 'one purchase in the ledger');
assert.equal(purchase[0].delta, -10_200, 'the ledger row is the quote');
assert.equal(g.owned.futon_set, undefined, 'a delivered piece is not owned until it arrives');
assert.equal(g.deliveries?.length, 1, 'the delivery is booked');
const due = g.deliveries[0].due;
const tomorrow = new Date(`${g.clock.lastLocalDate}T12:00:00Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
assert.equal(due, tomorrow.toISOString().slice(0, 10), `the futon is due tomorrow (${due})`);
await finish();
await t.shot('6-rin-debrief');
await check('futon bought');
await backToWorld();

step('Rin: a houseplant is carried home (1,200, no day to choose)');
const cashPlant = (await liveGame(page)).wallet.cash;
await openConvo('rin', 'rin_home', 'fuku_home');
await say('観葉植物をください');
assert.equal(await lastChip(), '1200', 'the plant is 1,200');
await tap(/これ/);
await tap(/持ち帰り/);
await tap(/現金/);
await tapThrough();
g = await liveGame(page);
assert.equal(g.wallet.cash, cashPlant - 1_200, 'charged exactly 1,200');
assert.equal(g.owned.plant_pothos?.qty, 1, 'the plant is owned at once');
assert.equal(g.deliveries.length, 1, 'still only the futon on its way');
await finish();
await check('plant bought');
await backToWorld();

step("the Wallet's room card says when the futon arrives; the receipt is the quote");
await go('wallet');
await page.waitForSelector('[data-room-card]', { timeout: 10000 });
assert.equal(await page.locator('[data-delivery=futon_set]').count(), 1, 'the futon is listed as on its way');
assert.ok(/arrives|تصل/.test(await text('[data-delivery=futon_set]')), `the note: ${await text('[data-delivery=futon_set]')}`);
await assertNoHScroll(page, 'wallet room card');
await t.shot('7-wallet-on-its-way');
await page.locator('[data-tab="receipts"]').click();
await page.waitForSelector('[data-pane="receipts"]');
if (await page.locator('.wlt-receipts > .btn').count()) await page.locator('.wlt-receipts > .btn').click();
assert.ok((await page.locator('[data-receipt]').count()) >= 2, 'the purchases are receipts');
await go('world');

// ---- 4. place the plant ----------------------------------------------------------------------------------------------------
step('the dorm again: the plant is a piece to place, the futon is on its way; wrong place answered; place, take out, place; comfort rises');
await enter('door:dorm');
await openFurnish();
assert.equal(await page.locator('[data-piece=plant_pothos][data-state=ready]').count(), 1, 'the plant is ready');
assert.equal(await page.locator('[data-piece=futon_set][data-state=transit]').count(), 1, 'the futon is on its way');
assert.ok(/arrives|تصل/.test(await text('[data-piece=futon_set]')), 'the futon says when it arrives');
await t.shot('8-furnish-pieces');
await assertNoHScroll(page, 'furnish with pieces');
await page.locator('[data-piece=plant_pothos]').click();
await page.locator('[data-slot=bed]').click();
await page.waitForFunction(() => /bed|plant|سرير|نبتة|السرير|النبتة/i.test(window.__lw.useStore.getState().toast?.text ?? ''), null, { timeout: 4000 });
assert.equal((await liveGame(page)).home.placed.plant, undefined, 'a wrong place places nothing');
assert.equal(await page.locator('[data-piece=plant_pothos][aria-pressed=true]').count(), 1, 'the piece stays picked after a wrong place');
await page.locator('[data-slot=plant]').click();
await page.waitForFunction(() => document.querySelector('[data-slot=plant]')?.getAttribute('data-slot-piece') === 'plant_pothos', null, { timeout: 5000 });
assert.equal((await liveGame(page)).home.placed.plant, 'plant_pothos', 'placed in the game');
assert.equal(await comfortNow(), 2, 'comfort 2 with the plant');
const placedTri = await world((w) => w.stageInfo().triangles);
await shot3d('9-plant-placed');
await page.locator('[data-slot=plant]').click(); // a placed piece: tap to take it out
await page.waitForFunction(() => document.querySelector('[data-slot=plant]')?.getAttribute('data-slot-piece') === '', null, { timeout: 5000 });
assert.equal(await comfortNow(), 1, 'comfort 1 again');
assert.ok((await world((w) => w.stageInfo().triangles)) < placedTri, 'the room redrew without the plant');
await placeByList('plant_pothos', 'plant');
assert.equal(await comfortNow(), 2);
await closeFurnish();
await leaveRoom();
await check('plant placed');

// ---- 5. the invitation is locked while the room is bare ----------------------------------------------------------------------
step("Mio's Talk list: 'Invite to your room' is there at 2 hearts but locked until the room is comfortable");
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_invite]', { timeout: 15000 });
assert.equal(await page.locator('[data-opt=mio_invite]').getAttribute('aria-disabled'), 'true', 'locked at comfort 2');
assert.ok(/4/.test(await text('[data-opt=mio_invite] small')), `the row says comfort 4: ${await text('[data-opt=mio_invite] small')}`);
await assertNoHScroll(page, 'invite locked');
await assertTargets('.hud-opt', 'talk list');
await t.shot('10-invite-locked');
await page.keyboard.press('Escape');

// ---- 6. the next day: the futon arrives ---------------------------------------------------------------------------------------
step('the next calendar day: the futon is delivered (toast), owned, placeable; the 3D marker of the bed places it; comfort 4');
await page.evaluate((ms) => window.__lw.dispatch({ t: 'day_observed', nowMs: ms }), t.now() + DAY_MS);
await page.waitForFunction(() => /futon|فوتون/i.test(window.__lw.useStore.getState().toast?.text ?? ''), null, { timeout: 4000 }).catch(() => {});
g = await liveGame(page);
assert.equal(g.owned.futon_set?.qty, 1, 'the futon arrived');
assert.equal(g.deliveries?.length ?? 0, 0, 'nothing on its way any more');
await enter('door:dorm');
await openFurnish();
await page.locator('[data-piece=futon_set][data-state=ready]').click();
await t.sleep(300);
assert.equal(await world((w) => w.getStageState().slotFocus), 'bed', 'the bed marker is in focus');
await shot3d('11-futon-picked');
await world((w) => w.simulatePick('slot:bed'));
await page.waitForFunction(() => document.querySelector('[data-slot=bed]')?.getAttribute('data-slot-piece') === 'futon_set', null, { timeout: 5000 });
assert.equal(await comfortNow(), 4, 'comfort 4: a friend can visit');
assert.ok(/visit|زيارتك|يمكن/.test(await text('[data-own=comfort-line]')), 'the sheet says friends can visit now');
await closeFurnish();
await shot3d('12-dorm-furnished');
await leaveRoom();
await check('futon placed');
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_invite]:not([aria-disabled=true])', { timeout: 15000 });
await page.keyboard.press('Escape');

// ---- 7. Aiko: the viewing -------------------------------------------------------------------------------------------------------
step('Aiko: the viewing (three questions); the contract waits for it');
await talkTo('aiko');
await page.waitForSelector('[data-opt=aiko_viewing]', { timeout: 15000 });
assert.notEqual(await page.locator('[data-opt=aiko_viewing]').getAttribute('aria-disabled'), 'true', 'the viewing is open');
assert.equal(await page.locator('[data-opt=aiko_contract]').getAttribute('aria-disabled'), 'true', 'the contract waits for the viewing');
await assertNoHScroll(page, "Aiko's sheet");
await t.shot('13-aiko-sheet');
const ledgerView = (await liveGame(page)).ledger.length;
await page.locator('[data-opt=aiko_viewing]').click();
await page.waitForSelector('.prep, .convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('.convo', { timeout: 25000 });
await page.waitForSelector('.sg', { timeout: 40000 });
await t.sleep(500);
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId), 'aiko_viewing');
await tapThrough();
await finish();
g = await liveGame(page);
assert.deepEqual(g.ledger.slice(ledgerView).filter((e) => e.delta < 0 && e.pocket === 'cash'), [], 'a viewing costs nothing (the conversation only pays)');
assert.ok(g.culture.cc_rent !== undefined, 'the rent card is collected');
assert.ok(g.chapter.flags.includes('aiko_room_shown'), 'the room was shown');
await check('viewing');
await backToWorld();

// ---- 8. Aiko: the contract ----------------------------------------------------------------------------------------------------------
step('the contract: a wrong total is corrected, 六万円, the signature, cash: exactly 60,000 yen');
const cashSign = (await liveGame(page)).wallet.cash;
await openConvo('aiko', 'aiko_contract', 'aiko_contract');
await t.shot('14-contract-start');
await tap(/ここ/);
await say('三万円です');
await t.shot('15-contract-wrong-total');
await tap(/六万円/);
await t.shot('16-contract-total');
await assertNoHScroll(page, 'contract: signature');
await tap(/です/); // the signature chip: 「<name>です」
await tap(/現金/);
await t.shot('17-contract-paid');
await tapThrough();
g = await liveGame(page);
assert.equal(g.wallet.cash, cashSign - 60_000, 'charged exactly 60,000 yen');
const rent = g.ledger.filter((e) => e.kind === 'purchase' && e.pocket === 'cash' && e.delta === -60_000);
assert.equal(rent.length, 1, 'one 60,000-yen purchase in the ledger');
assert.equal(g.owned.home_room_ono?.qty, 1, 'the room is owned');
assert.equal(g.home.tier, 'ono', 'the tier is the flat');
await finish();
await t.shot('18-contract-debrief');
await check('contract');
await backToWorld();
await t.sleep(800);
assert.equal(await world((w) => w.isDoorOpen('flat')), true, "the flat's door opened");
assert.equal(await world((w) => w.isDoorOpen('dorm')), false, "the dorm's door closed");
assert.ok(g.dream.steps.flat_4 !== undefined || (await liveGame(page)).dream.steps.flat_4 !== undefined, 'the flat dream: the contract step ticked');
// the contract is signed once: the rows are gone from Aiko's list
await talkTo('aiko');
await page.waitForSelector('[data-opt]', { timeout: 15000 });
assert.equal(await page.locator('[data-opt=aiko_contract], [data-opt=aiko_viewing]').count(), 0, 'no contract or viewing row once the flat is yours');
await page.keyboard.press('Escape');
await world((w) => w.simulatePick('door:dorm'));
await page.waitForSelector('[data-door-status=dorm_moved]', { timeout: 8000 });
await shot3d('19-dorm-moved');
await page.locator('[data-home=door-tip]').click();

// ---- 9. the flat -------------------------------------------------------------------------------------------------------------------------
step('the flat: the genkan the first time (slippers first is answered), the stamp card cc_trash, the dorm\'s pieces came along');
await enter('door:flat');
assert.equal(await ownPhase(), 'genkan', 'your own flat has a genkan the first time');
assert.equal(await world((w) => w.currentStage()), 'ono_flat');
await page.locator('[data-genkan=slippers]').click();
await t.sleep(300);
assert.equal(await page.locator('[data-genkan=shoes].done').count(), 0, 'no step done by the wrong order');
await assertNoHScroll(page, 'flat genkan');
await shot3d('20-flat-genkan');
await page.locator('[data-genkan=shoes]').click();
await page.locator('[data-genkan=slippers]').click();
await page.waitForSelector('[data-own-phase=inside]', { timeout: 10000 });
await page.waitForSelector('.cul-scrim', { timeout: 10000 });
g = await liveGame(page);
assert.ok(g.culture.cc_trash !== undefined, 'cc_trash is collected on the first entry into the flat');
assert.ok(g.stats.visits.includes('flat'), 'the visit is filed');
await t.shot('21-trash-card');
await settle();
assert.equal(await comfortNow(), 3 + 2 + 1, 'comfort of the flat: base 3 + the futon 2 + the plant 1');
assert.equal(await page.locator('.hud').count(), 0, 'no street HUD inside the flat');
await shot3d('22-flat-with-dorm-pieces');
await openFurnish();
assert.equal(await page.locator('[data-own=slots] [data-slot]').count(), 8, 'eight places in the flat');
assert.deepEqual((await world((w) => w.stageInfo().slots)).sort(), ['bed', 'desk', 'kitchen', 'light', 'plant', 'shelf', 'table', 'tv'], 'the stage has the same eight');
await t.shot('23-flat-furnish');
await assertNoHScroll(page, 'flat furnish');
await closeFurnish();
await leaveRoom();
await check('flat');

step('Rin sells the flat pieces now: a rice cooker and a paper lamp (carried), placed -> three pieces furnished');
for (const [ja, chip, price] of [['炊飯器をください', 'riceCooker', '3500'], ['和風ランプをください', 'lamp', '2000']]) {
  const before = (await liveGame(page)).wallet.cash;
  await openConvo('rin', 'rin_home', 'fuku_home');
  await say(ja);
  assert.equal(await lastChip(), price, `${chip} is ${price}`);
  await tap(/これ/);
  await tap(/持ち帰り/);
  await tap(/現金/);
  await tapThrough();
  assert.equal((await liveGame(page)).wallet.cash, before - Number(price), `charged exactly ${price}`);
  await finish();
  await backToWorld();
}
await enter('door:flat');
assert.equal(await ownPhase(), 'inside', 'no genkan the second time');
await openFurnish();
await placeByList('rice_cooker', 'kitchen');
await placeByList('paper_lamp', 'light');
assert.equal(await comfortNow(), 8, 'comfort 8');
await shot3d('24-flat-furnished');
await t.shot('25-flat-furnish-sheet');
await assertTargets('[data-own=furnish] button', 'flat furnish with pieces: every button inside the screen');
await closeFurnish();
g = await liveGame(page);
assert.deepEqual(Object.keys(g.home.placed).sort(), ['bed', 'kitchen', 'light', 'plant'], 'four pieces stand in the flat');
assert.ok(g.dream.steps.flat_5 !== undefined, 'the flat dream: furnish 3 things ticked');
await leaveRoom();
await check('flat furnished');

// ---- 10. the housewarming -------------------------------------------------------------------------------------------------------------
step('Invite Mio from her Talk list: the housewarming in the flat, Mio stands in the room, the flag and the friendship');
const apBefore = (await liveGame(page)).friends.mio.ap;
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_invite]:not([aria-disabled=true])', { timeout: 15000 });
await t.shot('26-invite-open');
await page.locator('[data-opt=mio_invite]').click();
await page.waitForSelector('.prep, [data-own-phase]', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForSelector('[data-own-phase]', { timeout: 30000 });
assert.equal(await world((w) => w.currentStage()), 'ono_flat', 'the housewarming is in the flat');
await page.waitForSelector('.convo', { timeout: 30000 });
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.scenarioId), 'home_own_guest');
assert.equal(await page.evaluate(() => window.__lw.useUi.getState().convo?.characterId), 'mio', 'the guest is the conversation\'s character');
await page.waitForSelector('.sg', { timeout: 40000 });
await t.sleep(900);
await assertNoHScroll(page, 'housewarming conversation');
await t.shot('27-housewarming-convo');
await tapThrough();
await finish();
g = await liveGame(page);
assert.ok(g.chapter.flags.includes('housewarming'), 'the housewarming flag is raised');
assert.ok(g.friends.mio.ap > apBefore && g.friends.mio.ap - apBefore <= 60, `friendship grew within the caps: ${apBefore} -> ${g.friends.mio.ap}`);
assert.ok(!g.stats.visits.includes('home:mio'), "it is not a visit to Mio's own home");
await t.shot('28-housewarming-debrief');
await check('housewarming');
await page.locator('.panel-foot .btn.primary').click();
await page.waitForSelector('[data-own-phase=inside]', { timeout: 15000 });
await settle();
await t.sleep(600);
assert.equal(await page.locator('[data-home=talk]').count(), 0, 'no Talk again after the housewarming');
await assertTargets('[data-home=leave], [data-own=furnish-open]', 'room buttons');
await shot3d('29-after-housewarming');
await leaveRoom();
step('the same friend again inside 3 days: the row says how long to wait (no dead tap)');
await talkTo('mio');
await page.waitForSelector('[data-opt=mio_invite]', { timeout: 15000 });
assert.equal(await page.locator('[data-opt=mio_invite]').getAttribute('aria-disabled'), 'true', 'locked for 3 days');
assert.ok(/3|2|ثلاث|يوم|ثلاثة/.test(await text('[data-opt=mio_invite] small')), `the wait text: ${await text('[data-opt=mio_invite] small')}`);
await t.shot('30-invite-wait');
await page.keyboard.press('Escape');
await check('invite wait');

// ---- 11. reload ------------------------------------------------------------------------------------------------------------------------
step('reload: the tier, the placements, the flag and the doors are kept');
const placedBefore = (await liveGame(page)).home.placed;
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1800);
await settle();
g = await liveGame(page);
assert.equal(g.home.tier, 'ono', 'the tier is kept');
assert.deepEqual(g.home.placed, placedBefore, 'the placements are kept');
assert.ok(g.chapter.flags.includes('housewarming'), 'the flag is kept');
assert.equal(await world((w) => w.isDoorOpen('flat')), true, "the flat's door is open after the reload");
assert.equal(await world((w) => w.isDoorOpen('dorm')), false, "the dorm's door is closed after the reload");
assert.equal(await world((w) => w.currentStage()), null, 'on the street');
await enter('door:flat');
assert.equal(await ownPhase(), 'inside', 'no genkan again');
assert.equal(await comfortNow(), 8, 'the furnished flat is back');
await shot3d('31-flat-after-reload');
await leaveRoom();
await check('reload');

// ---- 12. the panel fallback ---------------------------------------------------------------------------------------------------------------
step('?panel=1: the same flat as a CSS room, the furniture as word chips, and the Furnish sheet works');
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.goto(`${BASE}?panel=1`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
await settle();
await go('world');
await world((w, id) => w.simulatePick(id), 'door:flat');
await page.waitForSelector('[data-own-phase=inside]', { timeout: 30000 });
assert.equal(await ownAttr('data-own-mode'), 'panel', 'the panel fallback');
assert.equal(await world((w) => w.currentStage()), null, 'no stage loaded');
assert.equal(await page.locator('[data-own=things] [data-thing]').count(), 4, 'four pieces as chips');
await t.sleep(500);
await assertNoHScroll(page, 'panel room');
await assertTargets('[data-thing], [data-own=furnish-open], [data-home=leave]', 'panel room targets');
await t.shot('32-panel-room');
await page.locator('[data-thing=rice_cooker]').click();
await page.waitForSelector('.word-scrim', { timeout: 8000 });
assert.ok(/炊飯器/.test(await text('.word-scrim')), 'the rice cooker word card');
await page.locator('.word-scrim .word-close').last().click();
await openFurnish();
await t.shot('33-panel-furnish');
await page.locator('[data-slot=light]').click(); // take the lamp out
await page.waitForFunction(() => document.querySelector('[data-slot=light]')?.getAttribute('data-slot-piece') === '', null, { timeout: 5000 });
await placeByList('paper_lamp', 'light');
await closeFurnish();
await assertNoHScroll(page, 'panel furnished');
await page.locator('[data-home=leave]').click();
await page.waitForSelector('.hud', { timeout: 10000 });
await check('panel');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`home-own e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
