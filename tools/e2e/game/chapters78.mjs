// Release 2 wave C2: Chapters 7 and 8 are playable and the story ends, told in the REAL UI at 360 px, English or Arabic (--ar):
//   fresh profile -> the dev tools fast-forward to the START of Chapter 7 (Chapter 6 closes with its diary line, two taps) -> the festival is on in
//   the park at dusk with the friends at two hearts or more -> festival food at two stalls (exact cash charges) -> the speech: the five-line
//   rehearsal in Prepare, then the speech itself in Real mode with five lines of my own (typed) -> Chapter 7 completes (reward, title, cc_matsuri,
//   the fireworks beat, the diary step) -> Chapter 8: the Letter Home (3 sentences of my own typed, 2 picked from the ideas), the card saved as an
//   image (a download, no network request), Hanako reads it (TTS) -> Chapter 8 completes -> the real ending (Hanako with the Letter) -> Free Walk;
//   a reload keeps everything.
// Dev tools are used only for yen, hearts, advancing days and the chapter fast-forward (and the days a chapter still needs). After every step: no
// horizontal scroll, no console error, the wallet equals the ledger, and no MediaRecorder, getUserMedia or audio blob was ever created.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/chapters78.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, onboard, start } from './_common.mjs';

const t = await start('chapters78');
const { page } = t;
const AR = t.arabic;
const DEBUG = !!process.env.DEBUG;
for (const ev of ['uncaughtException', 'unhandledRejection']) {
  process.on(ev, async (e) => {
    console.log(t.logs.slice(-12).join('\n'));
    await t.shot('zz-failure').catch(() => {});
    console.log(
      'state at the failure:',
      JSON.stringify(
        await page
          .evaluate(() => {
            const g = window.__lw.getGame();
            return { done: g.chapter.done, chapter: { n: g.chapter.n, flags: g.chapter.flags, began: g.chapter.began }, clock: g.clock, runs: Object.fromEntries(Object.entries(g.runs).filter(([k]) => k.startsWith('matsuri'))), letter: g.letter, diary: g.diary, screen: window.__lw.useStore.getState().screen, convo: window.__lw.useUi.getState().convo, beats: window.__lw.useUi.getState().beats };
          })
          .catch(() => null),
      ),
    );
    console.error(e);
    process.exit(1);
  });
}
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);

// ---- the spies: no audio is ever recorded or stored, TTS calls, network requests -------------------------------
await page.addInitScript(() => {
  const spy = (window.__spy = { recorders: 0, gum: 0, audioBlobs: 0, spoken: [] });
  if (window.MediaRecorder) {
    const R = window.MediaRecorder;
    window.MediaRecorder = class extends R {
      constructor(...a) {
        super(...a);
        spy.recorders++;
      }
    };
  }
  const md = navigator.mediaDevices;
  if (md?.getUserMedia) {
    const g = md.getUserMedia.bind(md);
    md.getUserMedia = (...a) => (spy.gum++, g(...a));
  }
  const B = window.Blob;
  window.Blob = class extends B {
    constructor(parts, opts) {
      super(parts, opts);
      if (/^audio\//.test(opts?.type ?? '')) spy.audioBlobs++;
    }
  };
  // the TTS spy: a stand-in engine with one Japanese voice (headless Chromium has none, and the app then only paces the animation)
  const voice = { name: 'Spy JA', lang: 'ja-JP', localService: true, default: false, voiceURI: 'spy-ja' };
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  const fake = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [voice],
    addEventListener() {},
    removeEventListener() {},
    cancel() {},
    pause() {},
    resume() {},
    speak(u) {
      spy.spoken.push(u.text);
      setTimeout(() => u.onstart?.(), 5);
      setTimeout(() => u.onend?.(), 30);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
});
const requests = [];
page.on('request', (r) => requests.push(r.url()));

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
const hearts = (friend, ap) =>
  patch(
    new Function(
      'g',
      `const f = g.friends[${JSON.stringify(friend)}] ?? { ap: 0, met: true, apDay: g.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
       return { ...g, friends: { ...g.friends, ${JSON.stringify(friend)}: { ...f, met: true, ap: ${ap} } } };`,
    ),
  );

/** After every step: no horizontal scroll, no console error, wallet = ledger, and no audio recorded or stored anywhere. */
async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
  for (const p of ['cash', 'ic', 'points']) assert.equal(g.wallet[p], g.totals.checksum[p], `${where}: ${p} matches its checksum`);
  const spy = await page.evaluate(() => {
    let stored = false;
    for (let i = 0; i < localStorage.length; i++) if (/data:audio|audio\/(webm|ogg|wav|mp4|mpeg)/.test(localStorage.getItem(localStorage.key(i)) ?? '')) stored = true;
    return { ...window.__spy, stored };
  });
  assert.equal(spy.recorders, 0, `${where}: no MediaRecorder`);
  assert.equal(spy.gum, 0, `${where}: no getUserMedia`);
  assert.equal(spy.audioBlobs, 0, `${where}: no audio blob`);
  assert.equal(spy.stored, false, `${where}: no audio in storage`);
}

// ---------------------------------------------------------------------------------------------------------------
// beats, pop-ups, sheets
// ---------------------------------------------------------------------------------------------------------------

/** Plays every queued beat by tapping. The katakana step is saved, the dream question answered, the diary filled with two taps (or skipped). */
async function beats({ shotIds = [], diary = 'taps', onBeat } = {}) {
  const played = [];
  for (let i = 0; i < 80; i++) {
    if ((await screen()) !== 'beat') return played;
    const id = await page.evaluate(() => document.querySelector('[data-beat]')?.getAttribute('data-beat') ?? '');
    if (!played.includes(id)) {
      played.push(id);
      if (onBeat) await onBeat(id);
    }
    if (await page.locator('[data-ask=dream] [data-choose]').count()) {
      await page.locator('[data-choose]').first().click();
    } else if (await page.locator('[data-step=nameKana] [data-save]').count()) {
      await page.locator('[data-step=nameKana] [data-save]').click();
    } else if (await page.locator('[data-step=diary]').count()) {
      if (shotIds.includes(id)) {
        await assertNoHScroll(page, `diary ${id}`);
        await t.shot(`diary-${id}`);
      }
      if (diary === 'taps') {
        await page.locator('[data-step=diary] [data-what="0"]').click();
        await page.locator('[data-step=diary] [data-feel="0"]').click();
        await page.locator('[data-step=diary] [data-save]').click();
      } else if (diary === 'type') {
        await page.fill('#qst-diary', 'お祭りはとても楽しかったです。');
        await page.locator('[data-step=diary] [data-save]').click();
      } else await page.locator('[data-step=diary] [data-skip]').click();
    } else if (await page.locator('.qst-beat [data-continue]').count()) {
      if (shotIds.includes(id)) {
        await assertNoHScroll(page, `beat ${id}`);
        await t.shot(`beat-${id}-${i}`);
      }
      await page.locator('.qst-beat [data-continue]').first().click();
    } else if (await page.locator('[data-ask=dream]').count()) {
      await page.locator('[data-ask=dream] .btn').last().click();
    }
    await t.sleep(250);
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

/** Puts the player next to a character (stepping away first: the world only reports a change of "who is near"). */
async function standBy(id) {
  await settle();
  await go('world');
  await page.evaluate((c) => window.__world.teleportNear(c === 'tanaka' ? 'hanako' : 'tanaka'), id);
  await t.sleep(400);
  await page.evaluate((c) => window.__world.teleportNear(c), id);
  await page.waitForFunction((c) => window.__world.nearby === c, id, { timeout: 20000 });
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

/** Types every line of `lines` (my own words), then taps the first suggestion (if any) until the done card shows. */
async function typeAll(lines) {
  let next = 0;
  for (let n = 0; n < 40; n++) {
    await charReady();
    await page.waitForSelector('.sg, .done-card, #say', { timeout: 40000 });
    if (await page.locator('.done-card').count()) return;
    const before = await charLines();
    if (next < lines.length) {
      if (DEBUG) console.log(`   type: ${lines[next]}`);
      await page.fill('#say', lines[next++]);
      await page.locator('.send').click();
    } else if (await page.locator('.sg').count()) {
      await page.locator('.sg').first().click();
    } else throw new Error('nothing left to say and no suggestion');
    await Promise.race([lineAfter(before), page.waitForSelector('.done-card', { timeout: 40000 })]);
  }
  throw new Error('the conversation did not end');
}

/** Leaves the debrief (its primary button) and settles the overlays. */
async function leaveDebrief() {
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(600);
  await settle();
}

const snap = async () => {
  const g = await liveGame(page);
  return { cash: g.wallet.cash, ids: new Set(g.ledger.map((e) => e.id)) };
};
const fresh = (g, before, pred = () => true) => g.ledger.filter((e) => !before.ids.has(e.id) && pred(e));

// ---------------------------------------------------------------------------------------------------------------
// 0. a fresh profile, the dev tools take it to the start of Chapter 7
// ---------------------------------------------------------------------------------------------------------------
step('fresh profile -> the katakana name -> dev tools fast-forward Chapters 1-5 -> Chapter 6 closes (diary, two taps) -> the start of Chapter 7');
await onboard(page, { arabic: AR });
if (AR) assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl', 'dir=rtl');
await settle();
await page.evaluate(() => window.__lw.dispatch({ t: 'profile_set', dev: true }));
// Chapter 6 starts with a friend at three hearts
await hearts('mio', 150);
for (let n = 0; n < 5; n++) {
  await dev('advance_chapter');
  await skipChapterBeats();
}
// the sixth is played with its beats: Chapter 6's closing (with Hanako's Letter preview and the diary line), then Chapter 7's opening
await dev('advance_chapter');
await t.sleep(500);
let played = await settle({ shotIds: ['b_ch6_close', 'b_ch6_close_flat', 'b_ch7_open'] });
console.log('  beats', played.join(', '));
let g = await liveGame(page);
assert.equal(g.chapter.n, 7, 'Chapter 7 is current');
assert.ok(played.includes('b_ch6_close') || played.includes('b_ch6_close_flat'), "one of Chapter 6's closings plays");
assert.ok(played.includes('b_ch7_open'), 'the festival opening beat plays');
assert.ok(!played.includes('b_release_epilogue'), 'no "to be continued" after Chapter 6');
assert.ok(g.diary.some((d) => d.chapter === 6 && d.assisted), "the two-tap diary line is Chapter 6's (assisted)");
assert.ok(g.me.nameKana, 'the katakana name is set');
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await dev('cash', 10_000);
const TWO = 80;
for (const f of ['kenji', 'yuki', 'tanaka']) await hearts(f, TWO);
await check('start of Chapter 7');

// ---------------------------------------------------------------------------------------------------------------
// 1. the festival is on at the park at dusk
// ---------------------------------------------------------------------------------------------------------------
step('the next play day the park is the festival: dusk, stalls, lanterns, four friends at two hearts');
await dev('advance_day');
await settle();
await page.waitForFunction(() => window.__world.festivalInfo()?.on === true, null, { timeout: 20000 });
await standBy('kenji');
await t.sleep(2500);
const info = await page.evaluate(() => window.__world.festivalInfo());
if (DEBUG) console.log('  festival', JSON.stringify(info));
assert.ok(info.picks.includes('festival:stage') && info.picks.some((p) => p.startsWith('stall:')), 'the stalls and the stage are pickable');
for (const f of ['mio', 'yuki', 'tanaka']) assert.ok(info.guests.includes(f), `${f} (two hearts) came to the festival`);
assert.ok(info.guests.includes('hanako'), 'Hanako is at the stage');
await check('festival on');
await t.shot('festival-park');

// ---------------------------------------------------------------------------------------------------------------
// 2. festival food at two stalls, exact cash
// ---------------------------------------------------------------------------------------------------------------
const PRICES = { takoyaki: 600, yakisoba: 500 };
const ORDER = { takoyaki: 'たこ焼きをください。', yakisoba: '焼きそばをください。' };
for (const [stall, yen] of Object.entries(PRICES)) {
  step(`the ${stall} stall: Prepare, then the talk with my own lines; exactly ¥${yen} in cash`);
  await standBy('kenji');
  const before = await snap();
  await page.evaluate((id) => window.__world.simulatePick(id), `stall:${stall}`);
  await page.waitForSelector('.prep, .convo, [data-beat]', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  // the first shop talk of the chapter may be Hanako's try without chips (a short beat, then the talk in Real mode)
  await page.waitForFunction(() => !!document.querySelector('.convo') || window.__lw.useStore.getState().screen === 'beat', null, { timeout: 25000 });
  if ((await screen()) === 'beat') await settle();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await t.sleep(400);
  await typeAll(['はい、とても楽しいです。', ORDER[stall], '現金でお願いします。', 'ありがとうございます！']);
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  g = await liveGame(page);
  const paid = fresh(g, before, (e) => e.delta < 0);
  assert.equal(paid.length, 1, `${stall}: exactly one charge`);
  assert.equal(paid[0].delta, -yen, `${stall}: charged ¥${yen}`);
  assert.equal(paid[0].pocket, 'cash', `${stall}: cash only`);
  // the talk pays its yen too (pay 'full'): the wallet moved by exactly the new ledger entries, the one charge among them
  const moved = fresh(g, before, (e) => e.pocket === 'cash').reduce((n, e) => n + e.delta, 0);
  assert.equal(g.wallet.cash, before.cash + moved, `${stall}: the wallet moved by exactly its ledger entries`);
  if (DEBUG) console.log('  entries', JSON.stringify(fresh(g, before)));
  await check(`${stall} debrief`);
  if (stall === 'takoyaki') await t.shot('stall-debrief');
  await leaveDebrief();
}
g = await liveGame(page);
assert.ok(g.stats.visits.includes('festival'), 'the festival visit is filed');
assert.ok(g.culture.cc_matsuri !== undefined, 'cc_matsuri is in the stamp book');
assert.ok(g.chapter.done.c7_2 !== undefined, 'c7_2 (festival food, 3+ own lines) is done');

// ---------------------------------------------------------------------------------------------------------------
// 3. the speech: the rehearsal in Prepare, then Real mode with five lines of my own
// ---------------------------------------------------------------------------------------------------------------
step('the stage: the five-line rehearsal (listen, type, a tick per line)');
await standBy('hanako');
await page.evaluate(() => window.__world.simulatePick('festival:stage'));
await page.waitForSelector('[data-rehearsal]', { timeout: 25000 });
assert.equal(await page.locator('.fest-line').count(), 5, 'five lines');
await page.locator('[data-listen="1"]').click();
await t.sleep(300);
const plains = await page.locator('.fest-line').evaluateAll((els) => els.map((e) => e.getAttribute('data-plain')));
console.log('  speech', plains.join(' '));
for (let i = 1; i <= 5; i++) {
  await page.fill(`[data-type="${i}"]`, plains[i - 1]);
  await page.locator(`[data-check="${i}"]`).click();
  await page.waitForSelector(`.fest-line[data-line="${i}"][data-ok="1"]`, { timeout: 5000 });
}
assert.equal(await page.locator('[data-ticks="5"]').count(), 1, 'all five lines ticked');
assert.equal(await page.locator('[data-start=guided]').count(), 0, 'no Guided offer: Real mode was used already (the try without chips)');
await check('rehearsal');
await page.locator('[data-line="1"]').scrollIntoViewIfNeeded();
await t.shot('speech-rehearsal');

step('the speech in Real mode: no chips, five lines typed');
await page.locator('[data-start=real]').click();
await page.waitForSelector('.convo', { timeout: 25000 });
await charReady();
assert.equal(await page.locator('.sg').count(), 0, 'Real mode: no suggestion chips');
await typeAll(plains);
await t.shot('speech-done');
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await t.sleep(400);
g = await liveGame(page);
console.log('  speech run', JSON.stringify(g.runs.matsuri_speech));
assert.ok(g.runs.matsuri_speech.bestIndependent >= 5, 'five lines of my own');
assert.equal(await page.locator('[data-capstone][data-own="5"]').count(), 1, 'the debrief counts the own lines against the five needed');
await check('speech debrief');
await t.shot('speech-debrief');
await leaveDebrief();
g = await liveGame(page);
assert.ok(g.chapter.done.c7_3 !== undefined, 'c7_3 (the speech) is done');

// ---------------------------------------------------------------------------------------------------------------
// 4. Chapter 7 completes: reward, title, cc_matsuri, the fireworks beat, the diary step
// ---------------------------------------------------------------------------------------------------------------
step('Chapter 7 completes: culture_said through the dev tools only if needed, then the days; the fireworks beat and the diary');
g = await liveGame(page);
if (g.chapter.done.c7_4 === undefined) console.log('  culture_said 6 not reached by the fast-forwarded chapters: the dev tools mark it');
const cash7 = g.wallet.cash;
let fireworksSeen = false;
await dev('advance_chapter');
played = await settle({
  shotIds: ['b_ch7_close'],
  diary: 'type',
  onBeat: async (id) => {
    if (id !== 'b_ch7_close') return;
    await page.waitForFunction(() => window.__world.isFireworks(), null, { timeout: 10000 });
    fireworksSeen = true;
    await t.sleep(2500);
    await t.shot('fireworks');
  },
});
g = await liveGame(page);
console.log('  beats', played.join(', '), '| chapter', g.chapter.n);
assert.equal(g.chapter.n, 8, 'Chapter 8 is current');
assert.ok(g.chapter.completed.includes(7));
assert.ok(g.ledger.some((e) => e.kind === 'chapter' && e.ref === 'ch7' && e.delta === 8000), 'the ¥8,000 reward');
assert.ok(g.titles.includes('t_resident'), 'title: Resident');
assert.ok(g.culture.cc_matsuri !== undefined, 'cc_matsuri');
assert.ok(fireworksSeen, 'fireworks during the closing beat');
assert.ok(played.includes('b_ch7_close') && played.includes('b_ch8_open'), 'the closing of Chapter 7 and the opening of Chapter 8 play');
assert.equal(await page.evaluate(() => window.__world.isFireworks()), false, 'the fireworks stop after the beat');
assert.ok(g.wallet.cash >= cash7 + 8000);
assert.ok(g.diary.some((d) => d.chapter === 7 && !d.assisted), "the typed diary line is Chapter 7's (my own)");
await check('Chapter 8 starts');

// ---------------------------------------------------------------------------------------------------------------
// 5. the Letter Home
// ---------------------------------------------------------------------------------------------------------------
step("Hanako's row opens the Letter: 3 sentences of my own typed, 2 picked from the ideas; the diary line added");
await standBy('hanako');
await page.locator('.talk-btn').click();
await page.waitForSelector('[data-opt=hanako_letter]', { timeout: 15000 });
await page.locator('[data-opt=hanako_letter]').click();
await page.waitForSelector('[data-screen=letter][data-editing="1"]', { timeout: 15000 });
assert.equal(await page.locator('[data-frame]').count(), 5, 'five frames');
await check('Letter open');
await t.shot('letter-frames');
const OWN = ['わたしは元気です。', '日本はとても楽しいです。', '友だちがたくさんいます。'];
for (let i = 0; i < 3; i++) {
  const f = page.locator(`[data-frame][data-n="${i + 1}"]`);
  await f.locator('[data-type]').fill(OWN[i]);
  await f.locator('[data-use]').click();
  await page.waitForSelector(`[data-frame][data-n="${i + 1}"][data-assisted="0"]`);
}
for (const n of [4, 5]) {
  const f = page.locator(`[data-frame][data-n="${n}"]`);
  await f.locator('[data-ideas]').click();
  await f.locator('[data-idea="0"]').click();
  await page.waitForSelector(`[data-frame][data-n="${n}"][data-assisted="1"]`);
}
assert.equal(await page.locator('.ltr-count[data-own="3"]').count(), 1, '3 of 3 own');
if (await page.locator('[data-diary-add="0"]').count()) await page.locator('[data-diary-add="0"]').click();
await check('Letter written');
await t.shot('letter-filled');
await page.locator('[data-finish]').click();
await page.waitForSelector('[data-letter-card]', { timeout: 10000 });
g = await liveGame(page);
assert.ok(g.chapter.flags.includes('letter_written'), 'letter_written');
assert.ok(g.letter.length >= 5 && g.letter.filter((s) => !s.assisted).length === 3, 'five sentences stored, three of them my own');
for (const s of g.letter) assert.deepEqual(Object.keys(s).sort(), ['assisted', 'ja'], 'only the written Japanese is stored');
await check('Letter card');
await t.shot('letter-card');

step('the card is saved as an image (a download, no network request); Hanako reads it back (TTS)');
const reqBefore = requests.length;
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('[data-save-image]').click()]);
assert.match(download.suggestedFilename(), /\.png$/, 'a PNG is downloaded');
await t.sleep(500);
const net = requests.slice(reqBefore).filter((u) => !u.startsWith('blob:') && !u.startsWith('data:'));
assert.deepEqual(net, [], 'saving the image makes no network request');
const spokenBefore = (await page.evaluate(() => window.__spy.spoken.length)) ?? 0;
await page.locator('[data-read]').click();
await t.sleep(1500);
const spoken = await page.evaluate(() => window.__spy.spoken);
assert.ok(spoken.length > spokenBefore && spoken.slice(spokenBefore).join('').includes(OWN[0].replace('。', '')), 'TTS reads the Letter');
await check('Letter read back');

// ---------------------------------------------------------------------------------------------------------------
// 6. Chapter 8 completes: the real ending, Free Walk
// ---------------------------------------------------------------------------------------------------------------
step('the dream: picking it again in Chapter 8 counts (c8_4); words and stars through the days only');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'dream' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-screen=quests]');
await t.sleep(300);
await page.locator('[data-change-dream]').click();
await page.waitForSelector('[data-picker] [data-choose]');
await page.locator('[data-picker] [data-choose]').click();
await t.sleep(300);
g = await liveGame(page);
assert.ok(g.chapter.flags.includes('dream_epilogue'), 'dream_epilogue: the dream chosen again in Chapter 8');
await go('world');
console.log('  ch8 done', JSON.stringify(g.chapter.done), 'flags', g.chapter.flags.filter((f) => /dream|letter/.test(f)).join(','));

step('Chapter 8 completes: the ending beat (Hanako with the Letter), then Free Walk');
let endingCard = false;
await dev('advance_chapter');
played = await settle({
  shotIds: ['b_ch8_close'],
  onBeat: async (id) => {
    if (id !== 'b_ch8_close') return;
    endingCard = (await page.locator('.qst-beat [data-letter-card]').count()) === 1;
    await t.sleep(400);
    await assertNoHScroll(page, 'the ending');
    await t.shot('ending');
  },
});
g = await liveGame(page);
console.log('  beats', played.join(', '), '| chapter', g.chapter.n);
assert.equal(g.chapter.n, 9, 'Free Walk');
assert.ok(g.chapter.completed.includes(8));
assert.ok(played.includes('b_ch8_close'), 'the real ending plays');
assert.ok(!played.includes('b_release_epilogue'), 'no "to be continued"');
assert.ok(endingCard, 'the ending shows the Letter');
assert.ok(g.ledger.some((e) => e.kind === 'chapter' && e.ref === 'ch8' && e.delta === 10000), 'the ¥10,000 reward');
await page.evaluate(() => (window.__lw.useUi.getState().setArgs('quests', { tab: 'story' }), window.__lw.useStore.getState().go('quests')));
await page.waitForSelector('[data-freewalk][data-story-done="1"]', { timeout: 10000 });
await check('Free Walk');
await t.shot('quests-story-done');
await go('world');
await t.sleep(300);
// the car dream and the car row open at Free Walk
await standBy('nakamura');
await page.locator('.talk-btn').click();
await page.waitForSelector('[data-opt=nakamura_car]', { timeout: 15000 });
assert.equal(await page.locator('[data-opt=nakamura_car][disabled], [data-opt=nakamura_car].locked').count(), 0, "Nakamura's cars are open at Free Walk");
await page.keyboard.press('Escape');
await t.sleep(300);

step('a reload keeps everything');
await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await t.sleep(1500);
g = await liveGame(page);
assert.equal(g.chapter.n, 9);
assert.ok(g.chapter.flags.includes('letter_written') && g.letter.length >= 5);
assert.ok(g.diary.length >= 2, 'the diary lines are kept');
await go('letter');
await page.waitForSelector('[data-letter-card]', { timeout: 10000 });
await check('after reload');

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`chapters 7-8 e2e ok (${AR ? 'ar' : 'en'})`);
