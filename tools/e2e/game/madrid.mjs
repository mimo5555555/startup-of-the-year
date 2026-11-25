// Spanish in Madrid in the REAL UI at 360 px, English or Arabic (--ar):
//   onboarding: pick the UI language, then "Español · Spanish in Madrid" -> the app restarts in Spanish (its own saves) and onboarding goes
//   on in the UI language just picked -> Lola's welcome beat at the bar -> Lucía at the portal, typed: Me llamo Sam, Soy de Egipto, Me gusta
//   cocinar (she says them back) -> Bar El Rincón, typed: Un café con leche / Una tostada con tomate (Son 4,30 €) / Con tarjeta -> exactly
//   €4.30 charged -> the panadería: what a napolitana is, one napolitana, nothing else, cash: exactly €1.50 -> Chapter 2: Javi in the
//   plaza (football: Atleti) and the churrería (porras and a chocolate: exactly €5.00) -> Lola on a small-talk visit (with tú; the yes
//   chip, a reply, back to 「Bueno, ¿qué te pongo?」) and on a plain return (「¡Otra vez por aquí!」) -> Lucía's chat of the day -> Chapter 3:
//   the mercado (a kilo of oranges and the olive oil: exactly €10.40) and the olive oil handed to Lucía from the Friends screen ->
//   Settings: back to Japanese -> Tokyo, its save untouched, the Spanish save kept. After every step: no horizontal scroll, no console
//   error, the wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/madrid.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const t = await start('madrid');
const { page } = t;
const AR = t.arabic;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const screen = () => page.evaluate(() => window.__lw.useStore.getState().screen);

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
async function talkTo(id, opt) {
  await settle();
  await page.evaluate((x) => window.__world.teleportNear(x), id);
  await page.waitForFunction((x) => window.__world.nearby === x, id, { timeout: 20000 });
  await t.sleep(900);
  await page.locator('.talk-btn').click();
  await t.sleep(600);
  // several things to do with this character: the Interaction sheet, pick the one asked for
  if (opt) {
    await page.waitForSelector(`[data-opt="${opt}"]`, { timeout: 15000 });
    await page.locator(`[data-opt="${opt}"]`).click();
    await t.sleep(600);
  }
  await page.waitForSelector('.prep, .convo', { timeout: 25000 });
  if (await page.locator('.prep').count()) await page.locator('.prep-foot .prep-link').click();
  await page.waitForSelector('.convo', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.msg.char').length > 0 && !document.querySelector('.bubble.typing'), null, { timeout: 40000 });
}
async function finishConvo() {
  await page.waitForSelector('.done-card', { timeout: 40000 });
  await page.locator('.done-card .btn.primary').click();
  await page.waitForSelector('.feedback .dbf-card', { timeout: 25000 });
  await t.sleep(300);
  await page.locator('.panel-foot .btn.primary').click();
  await t.sleep(800);
}
const spent = (g0, g) => g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned);
const chips = () => page.locator('.sg').evaluateAll((els) => els.map((e) => e.innerText.split('\n')[0]));
/** taps a chip and waits for the answer */
async function pick(i = 0) {
  const m = await page.locator('.msg.char').count();
  await page.locator('.sg').nth(i).click();
  await page.waitForFunction((k) => (document.querySelectorAll('.msg.char').length > k || !!document.querySelector('.done-card')) && !document.querySelector('.bubble.typing'), m, { timeout: 40000 });
  await t.sleep(250);
  return lastLine();
}
const setVisits = (id, n) =>
  page.evaluate(([sid, count]) => {
    const lw = window.__lw;
    const g = lw.getGame();
    lw.useGame.getState().setGame({ ...g, runs: { ...g.runs, [sid]: { ...g.runs[sid], count } } });
  }, [id, n]);

// ---------------------------------------------------------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.onb');
await page.getByRole('button', { name: AR ? 'العربية' : 'English' }).first().click();
assert.equal(await page.locator('[data-learn]').count(), 4, 'four languages to learn');
await page.locator('[data-learn=es]').click();
assert.ok((await page.locator('[data-learn=es]').innerText()).includes('Español'), 'Spanish named in Spanish');
assert.ok((await page.locator('.hero-sub').innerText()).includes(AR ? 'مدريد' : 'Madrid'), 'the tagline follows the pick');
assert.equal(await page.locator('.soon .chip').count(), 1, 'only Russian is still to come');
await t.shot('pick');
const jaSave = await page.evaluate(() => localStorage.getItem('lw.v1.state'));
assert.ok(jaSave, 'the Japanese app has its own save');
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('.onb-foot .btn.primary').click()]);
await page.waitForSelector('.onb');
assert.equal(await page.evaluate(() => localStorage.getItem('lw.target')), 'es');
assert.equal(await page.evaluate(() => document.documentElement.dir), AR ? 'rtl' : 'ltr', 'the UI language carried over the restart');
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
assert.equal((await liveGame(page)).packId, 'es', 'the Madrid pack');
assert.equal((await liveGame(page)).wallet.cash, 3000, '€30 to start');
assert.equal(await screen(), 'beat', 'Lola’s welcome');
await t.shot('welcome');
step('onboarding in Spanish: the restart, the UI language kept, the Madrid pack, Lola’s welcome');

// the street and the plaza, before anyone is spoken to
await settle();
await t.sleep(800);
await t.shot('street');
await page.evaluate(() => window.__world.teleportNear('javi'));
await t.sleep(900);
await t.shot('plaza');

// Lucía at the portal of the flat
await talkTo('lucia');
assert.ok((await lastLine()).startsWith('¡Hola! ¡Por fin llegas!'), 'Lucía says tú');
assert.equal(await type('Me llamo Sam.'), '¡Mucho gusto, Sam! ¿De dónde eres?');
assert.ok((await type('Soy de Egipto.')).includes('Me encantaría conocer Egipto.'), 'the country said back');
await t.shot('lucia');
assert.ok((await type('Me gusta cocinar.')).startsWith('¡Genial! Pues un día cocinamos juntos.'), 'the hobby');
await finishConvo();
await check('after Lucía');
step('Lucía: name, country and hobby typed in Spanish, said back');

// breakfast at the bar
await talkTo('lola');
assert.equal(await lastLine(), '¡Buenos días! ¿Qué te pongo?');
let g0 = await liveGame(page);
assert.equal(await type('Un café con leche, por favor.'), '¡Marchando! ¿Y para comer? Tenemos tostadas y tortilla.');
assert.equal(await type('Una tostada con tomate, por favor.'), 'Son 4,30 €. ¿Con tarjeta o en efectivo?');
await t.shot('pay');
await type('Con tarjeta.');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 430, 'exactly €4.30: a café con leche and a tostada');
await check('after the bar');
step('the bar: typed Spanish, 「Son 4,30 €」, exactly €4.30 charged');
const voice = await page.evaluate(() => ({ ...window.__lwVoice, missed: [...window.__lwVoice.missed] }));
const manifest = await page.evaluate(() => fetch('voice-es/manifest.json').then((r) => (r.ok ? r.json() : { entries: {} })).catch(() => ({ entries: {} })));
if (Object.keys(manifest.entries ?? {}).length > 0) {
  assert.ok(voice.recorded > 0, `Spanish lines played from their recordings (${JSON.stringify(voice)})`);
  assert.ok(!voice.missed.some((x) => x.includes('¡Buenos días! ¿Qué te pongo')), 'Lola’s greeting is recorded');
}
step(`voices: ${voice.recorded} lines from recordings, ${voice.fallback} by the device voice`);

// bread at the panadería: what a napolitana is, then one, cash
await talkTo('carmen');
assert.equal(await lastLine(), 'Buenos días. ¿Qué desea?');
g0 = await liveGame(page);
assert.ok((await type('¿Qué es una napolitana?')).includes('hojaldre'), 'Carmen explains the napolitana');
assert.ok((await type('Pues una napolitana, por favor.')).startsWith('¿Algo más?'), 'one napolitana');
assert.equal(await type('No, nada más, gracias.'), 'Son 1,50 €. ¿Con tarjeta o en efectivo?');
await type('En efectivo.');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 150, 'exactly €1.50 for the napolitana');
await check('after the panadería');
step('the panadería: what a napolitana is, one napolitana, cash: exactly €1.50');

// Chapter 2: Javi in the plaza, the churrería
await settle();
await page.evaluate(() => {
  const lw = window.__lw;
  const g = lw.getGame();
  lw.useGame.getState().setGame({ ...g, chapter: { ...g.chapter, n: 2 } });
});
await t.sleep(1200);
await talkTo('javi');
assert.ok((await lastLine()).startsWith('¡Hola! ¿Acabas de llegar al barrio?'), 'Javi in the plaza');
await type('Sí, acabo de llegar.');
await type('Soy Sam.');
assert.ok((await type('¡Sí, me encanta el fútbol!')).includes('¿Y eres del Madrid o del Atleti?'), 'football');
assert.equal(await type('Del Atleti, como tú.'), '¡Vale! Esta noche a las nueve en el Bar El Rincón. ¡Hasta luego, Sam!');
await t.shot('javi');
await finishConvo();
await check('after Javi');
await talkTo('rafa');
assert.equal(await lastLine(), '¡Buenas! ¿Churros o porras?');
g0 = await liveGame(page);
assert.ok((await type('¿Qué son las porras?')).includes('más gordos'), 'Rafa explains the porras');
await type('Una ración de porras, por favor.');
assert.equal(await type('Sí, un chocolate, por favor.'), 'Son 5,00 €. ¿Con tarjeta o en efectivo?');
await t.shot('churreria');
assert.equal(await type('Con tarjeta.'), '¡Que aproveche!');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 500, 'exactly €5.00: porras and a chocolate');
await check('after the churrería');
step('Chapter 2: Javi (Atleti) in the plaza; the churrería: porras and a chocolate, exactly €5.00');

// Spanish step 3: Lola knows you now. A visit with small talk (the third in turn, with tú), then a plain return (the fourth)
await setVisits('mad_bar', 2);
await talkTo('lola');
const remark = await lastLine();
assert.ok(remark.startsWith('¡Buenos días! ') && remark !== '¡Buenos días! ¿Qué te pongo?', `Lola makes small talk (${remark})`);
assert.ok(/¿(Te gusta|Tienes planes|Hoy descansas|Qué tal el fin de semana)/.test(remark), `with tú (${remark})`);
const cs = await chips();
assert.ok(/^(¡?Sí|¡Muy bien)/.test(cs[0]), `the yes chip is on top (${cs.join(' | ')})`);
await t.shot('smalltalk');
const talkReply = await pick(0);
assert.ok(talkReply.endsWith('Bueno, ¿qué te pongo?'), `a reply, then back to the bar (${talkReply})`);
assert.ok(!(await chips()).includes(cs[0]), 'answered: the small talk chips are gone');
g0 = await liveGame(page);
assert.ok((await type('Un cortado, por favor.')).startsWith('¡Marchando!'), 'the order after the small talk');
assert.equal(await type('No, nada más, gracias.'), 'Son 1,60 €. ¿Con tarjeta o en efectivo?');
await type('Con tarjeta.');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 160, 'exactly €1.60 for the cortado');
await check('after the small talk');
step(`small talk at the bar: 「${remark}」 → ${cs[0]} → 「${talkReply}」; a cortado, €1.60`);
await setVisits('mad_bar', 3);
await talkTo('lola');
assert.equal(await lastLine(), '¡Hola! ¡Otra vez por aquí! ¿Qué te pongo hoy?', 'a regular is greeted as one');
await type('Un café solo, por favor.');
await type('No, nada más, gracias.');
await type('Con tarjeta.');
await finishConvo();
await check('after the return');
step('a plain return: 「¡Hola! ¡Otra vez por aquí!」, a café solo');

// Lucía's chat of the day (Small talk on the Interaction sheet, now the first meeting is done): greet, answer, react, goodbye
await talkTo('lucia', 'lucia_talk');
const hello = await lastLine();
assert.ok(hello.startsWith('¡Hola, Sam!'), `Lucía greets by name (${hello})`);
const ask = await type('¡Hola! Bien, gracias.');
assert.ok(ask.startsWith('¿') && ask.endsWith('?'), `Lucía asks today’s question (${ask})`);
await t.shot('chat');
const react = await pick(0);
assert.ok(react.startsWith('¡'), `Lucía reacts (${react})`);
assert.equal(await type('¿En serio? ¡Qué bien!'), '¡Me ha encantado charlar contigo! ¡Hasta mañana!');
await type('¡Hasta mañana!');
await finishConvo();
await check('after the chat');
step(`a chat with Lucía: 「${hello}」 → 「${ask}」 → 「${react}」`);

// Chapter 3: Andrés's olive oil at the mercado, then a present for Lucía from the Friends screen
await settle();
await page.evaluate(() => {
  const lw = window.__lw;
  const g = lw.getGame();
  lw.useGame.getState().setGame({ ...g, chapter: { ...g.chapter, n: 3 } });
});
await t.sleep(1200);
await talkTo('andres');
assert.equal(await lastLine(), '¡Buenos días! ¿Qué le pongo?');
g0 = await liveGame(page);
assert.equal(await type('Un kilo de naranjas, por favor.'), 'Aquí tiene. ¿Algo más? Tengo un aceite de oliva buenísimo.');
assert.equal(await type('Sí, una lata de aceite, por favor.'), 'Son 10,40 €. ¿Con tarjeta o en efectivo?');
await type('En efectivo.');
await finishConvo();
let g = await liveGame(page);
assert.equal(spent(g0, g), 1040, 'exactly €10.40: a kilo of oranges and the olive oil');
assert.equal(g.owned.mad_aceite?.qty, 1, 'the olive oil is in the bag');
await check('after the mercado');
step('Chapter 3: the mercado, a kilo of oranges and a tin of olive oil, exactly €10.40');
await settle();
await page.locator('.icon-btn.glass[aria-expanded]').first().click();
await page.locator('[data-menu=friends]').click();
await page.waitForSelector('[data-screen=friends]');
if (!(await page.locator('[data-card=lucia]').count())) await page.locator('[data-friend=lucia] .frd-head').click();
await page.locator('[data-friend=lucia] [data-act=gift]').click();
await page.waitForSelector('[data-gift-sheet] [data-item=mad_aceite]');
await page.locator('[data-item=mad_aceite]').click();
await t.sleep(500);
await assertNoHScroll(page, 'gift sheet');
await t.shot('gift-sheet');
const ap0 = (await liveGame(page)).friends.lucia?.ap ?? 0;
await page.locator('[data-act=hand-over]').click();
await page.waitForSelector('.convo', { timeout: 30000 });
await page.waitForSelector('.sg', { timeout: 30000 });
assert.equal((await chips())[0], '¡Tengo una lata de aceite para ti!', 'the hand-over chip names the olive oil');
const thanks = await pick(0);
assert.ok(/gracias/i.test(thanks), `Lucía thanks you (${thanks})`);
await pick(0);
assert.equal(await lastLine(), '¡Gracias, Sam! Eres un sol.');
await pick(0);
await page.waitForSelector('.done-card', { timeout: 30000 });
await page.locator('.done-card .btn.primary').click();
await page.waitForSelector('[data-gift-reaction]', { timeout: 25000 });
await t.shot('gift-reaction');
await assertNoHScroll(page, 'gift reaction');
g = await liveGame(page);
assert.equal(g.owned.mad_aceite, undefined, 'the olive oil is given away');
assert.ok(g.friends.lucia.ap > ap0, `Lucía is closer: +${g.friends.lucia.ap - ap0}`);
await page.locator('.panel-foot .btn.primary').click();
await t.sleep(700);
await settle();
await check('gift handed over');
step(`a present for Lucía: the olive oil (「${thanks}」), +${g.friends.lucia.ap - ap0} affinity`);

// back to Japanese: Tokyo, and the Japanese save is still there
await settle();
assert.equal(await page.evaluate(() => localStorage.getItem('lw.v1.state')), jaSave, 'the Japanese save is untouched');
assert.ok((await page.evaluate(() => localStorage.getItem('lw.es.v1.state')))?.includes('"Sam"'), 'the Spanish profile is in the Spanish save');
await page.evaluate(() => window.__lw.useStore.getState().go('settings'));
await page.waitForSelector('[data-learn=ja]');
assert.equal(await page.locator('[data-learn]').count(), 4);
await t.shot('settings');
await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('[data-learn=ja]').click()]);
assert.equal(await page.evaluate(() => localStorage.getItem('lw.target')), 'ja');
assert.ok(await page.evaluate(() => !!localStorage.getItem('lw.es.v1.state')), 'the Spanish save stays for next time');
step('Settings: back to Japanese (the Spanish save kept, the Japanese one untouched)');

await t.browser.close();
console.log(`madrid e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
