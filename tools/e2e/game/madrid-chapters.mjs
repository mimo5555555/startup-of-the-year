// Madrid's Chapters 4-6 (Spanish step 4) in the REAL UI at 360 px, English or Arabic (--ar): a Spanish profile meets Lucía, then the save
// moves on chapter by chapter. Chapter 4: the farmacia (「Me duele la garganta」, the lozenges, by card: exactly 6,50 €), and at three
// hearts Lucía's Sunday tortilla (Hang out on the Interaction sheet; without onion, flip it, taste it). Chapter 5: Taberna El Farolillo
// (a mosto with its free tapa, patatas bravas, ¡Salud!, ¿Me cobras?, cash: exactly 7,50 €). Chapter 6: the padrón at the citizens'
// office (cita previa, papers, address, floor and door: the certificate). After every step: no horizontal scroll, no console error, the
// wallet = its ledger.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/madrid-chapters.mjs [--ar]
import assert from 'node:assert/strict';
import { assertNoConsoleErrors, assertNoHScroll, liveGame, skipBeats, start } from './_common.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5173/';
const t = await start('madrid-chapters');
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

const setChapter = async (n) => {
  await settle();
  await page.evaluate((c) => {
    const lw = window.__lw;
    const g0 = lw.getGame();
    lw.useGame.getState().setGame({ ...g0, chapter: { ...g0.chapter, n: c } });
  }, n);
  await t.sleep(1200);
};
/** a friend close enough for a hang-out (three hearts and more) */
const closeFriend = (friend) =>
  page.evaluate((f) => {
    const lw = window.__lw;
    const g = lw.getGame();
    lw.useGame.getState().setGame({ ...g, friends: { ...g.friends, [f]: { ...g.friends[f], met: true, ap: 2000 } } });
  }, friend);
const spent = (g0, g) => g0.wallet.cash - g.wallet.cash + (g.totals.earned - g0.totals.earned);

// ---------------------------------------------------------------------------------------------------------------
await page.goto(BASE, { waitUntil: 'load' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('lw.target', 'es');
});
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
assert.equal((await liveGame(page)).packId, 'es', 'the Madrid pack');
step('a Spanish profile');

// the first meeting with Lucía (her chat of the day and the hang-out open after it)
await talkTo('lucia');
await type('Me llamo Sam.');
await type('Soy de Egipto.');
await type('Me gusta cocinar.');
await finishConvo();
await check('after meeting Lucía');

// Chapter 4: the farmacia; Lucía's tortilla at three hearts
await setChapter(4);
await settle();
await page.evaluate(() => window.__world.teleportNear('pilar'));
await t.sleep(1500);
await t.shot('fronts-east');
let g0 = await liveGame(page);
await talkTo('pilar');
assert.equal(await lastLine(), 'Buenos días. ¿Qué le pasa?');
assert.equal(await type('Me duele la garganta.'), 'Vaya. Le recomiendo estas pastillas para la garganta. ¿Se las lleva?');
assert.equal(await type('Sí, por favor.'), 'Son 6,50 €. ¿Con tarjeta o en efectivo?');
await t.shot('farmacia');
assert.equal(await type('Con tarjeta.'), 'Aquí tiene. ¡Que se mejore!');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 650, 'exactly 6,50 € for the lozenges');
await check('after the farmacia');
step('the farmacia: 「Me duele la garganta」, the lozenges, 6,50 € by card');

await closeFriend('lucia');
await talkTo('lucia', 'lucia_hang');
assert.ok((await lastLine()).includes('tortilla de patatas'), 'Lucía makes a tortilla');
await type('¡Sí, claro! Te ayudo.');
await type('Vale, pelo las patatas.');
assert.equal(await lastLine(), 'Pregunta importante: ¿tortilla con cebolla o sin cebolla?');
assert.equal(await type('Sin cebolla, por favor.'), '¡Uy, como Javi! Vale, sin cebolla. Ahora, ¡dale la vuelta con el plato!');
await t.shot('tortilla');
await type('¡Uno, dos, tres!');
await type('¡Qué rica, Lucía!');
await finishConvo();
await check('after the tortilla');
step('Chapter 4: Lucía’s tortilla at three hearts (without onion, flipped, tasted)');

// Chapter 5: the taberna
await setChapter(5);
g0 = await liveGame(page);
await talkTo('manolo');
assert.equal(await lastLine(), '¡Buenas! ¿Qué va a ser?');
assert.equal(await type('Un mosto, por favor.'), 'Aquí tienes, con su tapa: unas aceitunas. ¿Quieres una ración?');
assert.equal(await type('Sí, unas patatas bravas, por favor.'), '¡Que aproveche! ¡Salud!');
await type('¡Salud!');
assert.equal(await type('No, gracias. ¿Me cobras?'), 'Son 7,50 €. ¿Con tarjeta o en efectivo?');
await t.shot('taberna');
assert.equal(await type('En efectivo.'), '¡Gracias! ¡Buenas noches!');
await finishConvo();
assert.equal(spent(g0, await liveGame(page)), 750, 'exactly 7,50 €: a mosto and patatas bravas');
await check('after the taberna');
step('the taberna: a mosto with its tapa, bravas, ¡Salud!, ¿Me cobras?, 7,50 € in cash');

// Chapter 6: the padrón
await setChapter(6);
await talkTo('concha');
assert.equal(await lastLine(), 'Buenos días. ¿Tiene cita previa?');
await type('Sí, tengo cita.');
assert.equal(await type('Quiero empadronarme.'), '¿Me da su pasaporte y su contrato de alquiler?');
await type('Aquí tiene.');
await type('Mi dirección es Calle del Ave María, doce.');
assert.equal(await type('Segundo B.'), 'Perfecto. Ya está todo. Aquí tiene su certificado de empadronamiento. ¡Le damos la bienvenida a Madrid, Sam!');
await t.shot('padron');
await type('¡Muchas gracias!');
await finishConvo();
await check('after the padrón');
const done = (await liveGame(page)).runs?.mad_padron?.count ?? 0;
assert.ok(done >= 1, 'the padrón is counted');
step('the padrón: cita previa, papers, address, floor and door, the certificate');

await t.browser.close();
console.log(`madrid-chapters e2e passed (${AR ? 'ar' : 'en'}) in ${Math.round((Date.now() - T0) / 1000)}s`);
