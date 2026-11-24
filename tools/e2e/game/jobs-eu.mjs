// Jobs in Berlin and Amsterdam in the REAL UI at 360 px, English or Arabic (--ar): Murat's Späti (default) or Femke's café (--nl).
// Chapter 2: "Work a shift" on the boss's Interaction sheet, the boss's offer first (Sie, then du / u, then je), then five customers:
// tap the order (and the table), say the total in digits, in words, from tiles or picked from three, the change or the second bill, then
// the thanks (typed without umlauts once). The result card's pay is the wallet's, and every customer line and staff sentence played has
// its recording. Then at a high rank until a note (and, at the café, separate bills) came up, and the boss's refusal of a third shift.
// After every shift: no horizontal scroll, no console error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/jobs-eu.mjs [--nl] [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';
import { assertPadTargets } from './_jobs.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const NL = process.argv.includes('--nl');
const t = await start(NL ? 'jobs-amsterdam' : 'jobs-berlin');
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);

// ---------------------------------------------------------------------------------------------------------------
// The city: the boss, the job, what each customer wants, and how the language says an amount
// ---------------------------------------------------------------------------------------------------------------

const DE_WORDS = {
  units: ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'],
  tens: ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'],
  and: 'und',
  euro: 'Euro',
};
const NL_WORDS = {
  units: ['nul', 'één', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'],
  tens: ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'],
  and: 'en',
  euro: 'euro',
};
const W = NL ? NL_WORDS : DE_WORDS;
/** 0-99 in words: einundzwanzig, eenentwintig (typed the way a learner types it) */
const under100 = (n) => (n < 20 ? W.units[n] : n % 10 === 0 ? W.tens[n / 10] : `${n % 10 === 1 && !NL ? 'ein' : W.units[n % 10]}${W.and}${W.tens[Math.floor(n / 10)]}`);
/** cents in words: 「drei Euro achtzig」, 「zeven euro vijftig」 */
const words = (cents) => `${under100(Math.floor(cents / 100))} ${W.euro}${cents % 100 ? ` ${under100(cents % 100)}` : ''}`;
/** cents as written: 3,80 */
const digits = (cents) => `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
/** the price as the shift's tile shows it: 「3,80 €」 or 「€ 3,80」 */
const tile = (cents) => (NL ? `€ ${digits(cents)}` : `${digits(cents)} €`);

const CITY = NL
  ? {
      target: 'nl',
      boss: 'femke',
      job: 'job_ams_cafe',
      wage: '€ 14,40/h',
      offer: ['Ja, graag!', 'Hallo, welkom!', 'Dank u wel! Fijne dag nog!'],
      offerAccepted: 'Top! Zeg maar je, hoor.',
      price: { koffie: 300, verkeerd: 380, thee: 280, chocomel: 350, appeltaart: 450 },
      customers: {
        cf_koffie: { items: { koffie: 1 } },
        cf_thee: { items: { thee: 2 } },
        cf_verkeerd: { items: { verkeerd: 1 } },
        cf_taart: { items: { appeltaart: 1 } },
        cf_two: { items: { koffie: 1, appeltaart: 1 } },
        cf_two_b: { items: { verkeerd: 2, thee: 1 } },
        cf_two_c: { items: { chocomel: 1, koffie: 2 } },
        cf_table: { items: { thee: 2 }, table: 4 },
        cf_table_b: { items: { chocomel: 1 }, table: 2 },
        cf_table_c: { items: { koffie: 3, appeltaart: 1 }, table: 6 },
        cf_split: { items: { koffie: 1, thee: 1 }, split: true },
        cf_split_b: { items: { verkeerd: 1, appeltaart: 1 }, split: true },
        cf_note: { items: { chocomel: 2 }, paid: 2000 },
        cf_note_b: { items: { thee: 1, appeltaart: 1 }, paid: 1000 },
      },
      totalSentence: (n) => `Dat is dan ${tile(n)}`,
      totalPieces: (n) => ['Dat', 'is', 'dan', tile(n)],
      thanksTyped: ['dank u wel, fijne dag nog', 'Bedankt!'],
      band: 'Perfect!',
      refuse: 'Genoeg voor vandaag. Rust lekker uit!',
      tables: true,
      kinds: ['split', 'change'],
    }
  : {
      target: 'de',
      boss: 'murat',
      job: 'job_spaeti',
      wage: '13,90 €/h',
      offer: ['Ja, gern!', 'Hallo!', 'Danke schön! Schönen Abend noch!'],
      offerAccepted: 'Super! Wir duzen uns hier, okay?',
      price: { clubmate: 205, wasser: 125, schorle: 175, cola: 175 },
      customers: {
        sp_mate: { items: { clubmate: 1 } },
        sp_wasser: { items: { wasser: 2 } },
        sp_cola: { items: { cola: 1 } },
        sp_schorle: { items: { schorle: 3 } },
        sp_two: { items: { cola: 1, wasser: 1 } },
        sp_two_b: { items: { clubmate: 2, schorle: 1 } },
        sp_two_c: { items: { wasser: 1, cola: 2 } },
        sp_mind: { items: { clubmate: 1 } },
        sp_mind_b: { items: { wasser: 2 } },
        sp_mind_c: { items: { schorle: 2, cola: 2 } },
        sp_note: { items: { clubmate: 1, cola: 1 }, paid: 500 },
        sp_note_b: { items: { clubmate: 3 }, paid: 1000 },
        sp_note_c: { items: { wasser: 2, schorle: 2 }, paid: 2000 },
      },
      totalSentence: (n) => `Das macht ${tile(n)}`,
      totalPieces: (n) => ['Das', 'macht', tile(n)],
      // without umlauts, the way one types without a German keyboard
      thanksTyped: ['danke schoen, schoenen abend noch', 'Vielen Dank!'],
      band: 'Perfekt!',
      refuse: 'Für heute ist genug. Ruh dich aus!',
      tables: false,
      kinds: ['change'],
    };

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

/** What the shifts paid so far, from the ledger (the wallet also receives daily goals and chapter rewards). */
const shiftPaid = (g) => g.ledger.filter((e) => e.kind === 'shift').reduce((n, e) => n + e.delta, 0);

async function check(where) {
  await assertNoHScroll(page, where);
  assertNoConsoleErrors(t.logs);
  const g = await liveGame(page);
  assert.equal(g.wallet.cash + g.wallet.ic, 3000 + g.totals.earned - g.totals.spent, `${where}: wallet = ledger totals`);
}

async function settle() {
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.cul-scrim').count()) await page.locator('.cul-scrim .btn.primary').click();
    else if ((await screen()) === 'beat') await skipBeats(page);
    else if (await page.locator('.word-scrim .word-close').count()) await page.locator('.word-scrim .word-close').last().click();
    else if (await page.locator('.hud-sheet').count()) await page.keyboard.press('Escape');
    else return;
    await t.sleep(250);
  }
  throw new Error('overlays did not clear');
}

const lastLine = async () => (await page.locator('.msg.char').last().innerText()).split('\n')[0];
async function type(text) {
  await page.waitForSelector('#say', { timeout: 40000 });
  const n = await page.locator('.msg.char').count();
  await page.fill('#say', text);
  await page.locator('.send').click();
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), n, { timeout: 40000 });
  await t.sleep(250);
  return lastLine();
}

/** The job's rank, on another day (ledger ids carry the day: the day's shift count and repeat multiplier start again). */
async function nextDayAtRank(rank) {
  await page.evaluate(
    ([job, r]) => {
      const lw = window.__lw;
      const g = lw.getGame();
      lw.useGame.getState().setGame({ ...g, clock: { ...g.clock, dayIndex: g.clock.dayIndex + 1 }, jobs: { ...g.jobs, [job]: { ...g.jobs[job], rank: r } } });
    },
    [CITY.job, rank],
  );
  await t.sleep(600);
}

/** Back to the street, then the shift screen afresh (the job card). */
const openShift = async () => {
  if ((await screen()) === 'shift') {
    await page.locator('[data-shift-card] [data-act=back]').last().click();
    await page.waitForFunction(() => window.__lw.useStore.getState().screen !== 'shift');
    await settle();
  }
  await page.evaluate((id) => {
    window.__lw.useUi.getState().setArgs('shift', { jobId: id });
    window.__lw.useStore.getState().go('shift');
  }, CITY.job);
  await page.waitForSelector('[data-screen=shift]');
  await t.sleep(300);
};

/** One production step: typed, from tiles, or picked from three. */
async function answer(how, text, pieces) {
  if (how === 'pick') {
    await page.locator('[data-act=help-pick]').click();
    await page.locator('[data-choice=right]').click();
  } else if (how === 'tiles') {
    await page.locator('[data-act=help-tiles]').click();
    await page.waitForSelector('[data-tiles]');
    for (const p of pieces) await page.locator(`.sh-pool .sh-tile[data-tile="${p}"]:not([disabled])`).first().click();
    await page.locator('[data-act=check]').click();
  } else {
    await page.locator('#sh-say').fill(text);
    await page.locator('[data-act=say]').click();
  }
}

/** Plays one customer; `how(i, step)` picks how each answer is given. Returns what kind of customer it was. */
async function serve(i, how, shots) {
  await page.waitForSelector('[data-customer]');
  const id = await page.locator('[data-customer]').getAttribute('data-customer');
  const a = CITY.customers[id];
  assert.ok(a, `known customer ${id}`);
  assert.equal(await page.locator('[data-line]').count(), 0, 'the customer’s line is heard, its text hidden by default');
  if (i === 0) await page.locator('[data-act=greet]').click();
  await page.waitForSelector('[data-order]');
  assert.equal(await page.locator('[data-tables]').count(), CITY.tables ? 1 : 0, 'the table picker is the café’s');
  assert.equal(await page.locator('[data-flag]').count(), 0, 'no hot/iced or heat/bag switches here');
  for (const [item, q] of Object.entries(a.items)) for (let k = 0; k < q; k++) await page.locator(`.sh-item[data-item=${item}] .sh-item-main`).click();
  if (a.table) await page.locator(`[data-table="${a.table}"]`).click();
  if (shots && !serve.padShot) {
    serve.padShot = true;
    await assertNoHScroll(page, 'order pad');
    await assertPadTargets(page, '[data-order]', 'order pad');
    await t.shot('order');
  }
  await page.locator('[data-act=confirm-order]').click();
  const lines = Object.entries(a.items).map(([k, q]) => CITY.price[k] * q);
  const sum = lines.reduce((x, y) => x + y, 0);
  const first = a.split ? lines[0] : sum;
  await page.waitForSelector('[data-answer$=":total"]');
  const placeholder = await page.locator('#sh-say').getAttribute('placeholder');
  assert.ok(placeholder.includes('12,34'), `the example amount (${placeholder})`);
  const h = how(i, 'total');
  await answer(h, h === 'words' ? words(first) : h === 'sentence' ? CITY.totalSentence(first) : digits(first), CITY.totalPieces(first));
  if (shots && h === 'tiles' && !serve.tileShot) serve.tileShot = true;
  if (a.split) {
    await page.waitForSelector('[data-answer$=":change"]');
    if (shots) await t.shot('split');
    await answer('type', words(sum - lines[0]));
  }
  if (a.paid) {
    await page.waitForSelector('[data-answer$=":change"]');
    if (shots) await t.shot('change');
    await answer('type', `${digits(a.paid - sum)}`);
  }
  await page.waitForSelector('[data-answer$=":thanks"]');
  const th = how(i, 'thanks');
  await answer(th, CITY.thanksTyped[i % 2]);
  // every answer was right: no correction card
  assert.equal(await page.locator('[data-verdict]').count(), 0, `${id}: no correction`);
  await page.waitForSelector('[data-done]');
  return a.split ? 'split' : a.paid ? 'change' : 'order';
}

/** Plays a whole shift from the job card; returns the kinds served and the pay. */
async function playShift(how, { shots } = {}) {
  await page.waitForSelector('[data-shift-card=job]');
  const g0 = await liveGame(page);
  await page.locator('[data-act=start-shift]').click();
  const kinds = [];
  for (let i = 0; i < 5; i++) {
    kinds.push(await serve(i, how, shots));
    await page.locator('[data-act=next-customer]').click();
  }
  await page.waitForSelector('[data-shift-card=result]');
  const pay = Number(await page.locator('[data-shift-card=result]').getAttribute('data-pay'));
  const band = await page.locator('[data-shift-card=result]').getAttribute('data-band');
  assert.equal(band, 'perfect', 'every answer right: a perfect shift');
  assert.ok((await page.locator('.sh-result .sh-boss').first().innerText()).includes(CITY.band), `the boss says ${CITY.band}`);
  const g = await liveGame(page);
  assert.ok(pay > 0, 'the shift pays');
  // the wallet may also get a daily goal or the chapter's objective: the shift's own ledger entry is what the card says
  assert.equal(shiftPaid(g) - shiftPaid(g0), pay, 'the result card’s pay is the shift’s ledger entry');
  assert.ok(g.wallet.cash - g0.wallet.cash >= pay, 'and it is in the wallet');
  return { kinds, pay };
}

// ---------------------------------------------------------------------------------------------------------------
// A profile in the city, Chapter 2
// ---------------------------------------------------------------------------------------------------------------

await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate((target) => {
  localStorage.clear();
  localStorage.setItem('lw.target', target);
}, CITY.target);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await page.getByRole('button', { name: AR ? 'العربية' : 'English' }).first().click();
const next = () => page.locator('.onb-foot .btn.primary').click();
await next();
await page.fill('#name', 'Sam');
await next();
await next();
await next();
for (const i of [2, 4, 5]) await page.locator('.chips.wrap .chip').nth(i).click();
await next();
await page.waitForFunction(() => !!window.__world && !!window.__lw, null, { timeout: 60000 });
await page.evaluate(() => window.__lw.useStore.getState().updateSettings({ seenTutorial: true }));
await t.sleep(1500);
assert.equal((await liveGame(page)).packId, CITY.target, 'the city’s pack');
await settle();
await page.evaluate(() => {
  const lw = window.__lw;
  const g0 = lw.getGame();
  lw.useGame.getState().setGame({ ...g0, chapter: { ...g0.chapter, n: 2 } });
});
await t.sleep(1200);
step(`a ${NL ? 'Dutch' : 'German'} profile in Chapter 2`);

// the boss's sheet has the shift; the boss wants a word first
await settle();
await page.evaluate((x) => window.__world.teleportNear(x), CITY.boss);
await page.waitForFunction((x) => window.__world.nearby === x, CITY.boss, { timeout: 20000 });
await t.sleep(900);
await page.locator('.talk-btn').click();
await page.waitForSelector(`[data-opt="${CITY.boss}_shift"]`, { timeout: 15000 });
await t.shot('sheet');
await page.locator(`[data-opt="${CITY.boss}_shift"]`).click();
await page.waitForSelector('[data-shift-card=intro]');
await page.locator('[data-act=talk-boss]').click();
await page.waitForSelector('.convo', { timeout: 25000 });
if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
const accepted = await type(CITY.offer[0]);
assert.ok(accepted.startsWith(CITY.offerAccepted), `the boss offers du / je (${accepted})`);
await type(CITY.offer[1]);
await type(CITY.offer[2]);
await page.waitForSelector('.done-card', { timeout: 40000 });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
await t.sleep(300);
await page.locator('.panel-foot .btn.primary').click();
// the debrief hands over to the shift
await page.waitForSelector('[data-shift-card=job]', { timeout: 20000 });
const wage = (await page.locator('[data-wage]').innerText()).replace(/[⁦-⁩]/g, '');
assert.equal(wage, CITY.wage, 'the wage, in euro');
await t.shot('job');
step(`the boss's offer (「${accepted}」), then the job card (${wage})`);

// ---------------------------------------------------------------------------------------------------------------
// The first shift: rank 0, typed in digits, in words and as a sentence, one total from tiles
// ---------------------------------------------------------------------------------------------------------------

const missedBefore = await page.evaluate(() => window.__lwVoice?.missed?.length ?? 0);
const ways = ['digits', 'words', 'sentence', 'tiles', 'digits'];
const first = await playShift((i, s) => (s === 'total' ? ways[i] : 'type'), { shots: true });
await t.shot('result');
await check('after the first shift');
step(`the first shift: ${first.kinds.join(', ')}; paid ${first.pay} cents`);

// every customer line and staff sentence the shift played is recorded
const missed = await page.evaluate((n) => (window.__lwVoice?.missed ?? []).slice(n), missedBefore);
const shiftMissed = missed.filter((m) => /^customer/.test(m) || /Das macht|Sie bekommen|Dat is dan|U krijgt|Hallo/.test(m));
assert.deepEqual(shiftMissed, [], 'the shift’s lines are recorded');

// ---------------------------------------------------------------------------------------------------------------
// Higher ranks: until a note (and at the café, separate bills) came up; answers picked from three
// ---------------------------------------------------------------------------------------------------------------

const seen = new Set();
for (let round = 0; round < 5 && !CITY.kinds.every((k) => seen.has(k)); round++) {
  await nextDayAtRank(4);
  await openShift();
  const r = await playShift((i, s) => (s === 'thanks' && i % 2 ? 'pick' : 'type'), { shots: true });
  for (const k of r.kinds) seen.add(k);
  await check(`after shift ${round + 2}`);
  step(`a shift at rank 4: ${r.kinds.join(', ')}; paid ${r.pay} cents`);
}
for (const k of CITY.kinds) assert.ok(seen.has(k), `a ${k} customer was served`);

// two shifts today: the boss says no to a third
await openShift();
await playShift(() => 'type');
await check('a second shift the same day');
await openShift();
await page.waitForSelector('[data-shift-card=refuse]');
assert.ok((await page.locator('[data-shift-card=refuse] .sh-boss').innerText()).includes(CITY.refuse), 'the boss’s refusal, in the language being learned');
await t.shot('refuse');
await check('the refusal');
step('a third shift today: the boss says no');

await t.browser.close();
console.log(`jobs e2e passed (${NL ? 'Amsterdam' : 'Berlin'}, ${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
