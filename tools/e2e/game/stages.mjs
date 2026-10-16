// Release 2 wave B1 + B2, the 3D side: the three friend homes and the player's own two rooms (stages) and the door facades, driven through `window.__world` in the
// REAL app at 360 px (the app wires the UI around them; see the home-visit scripts). For each of Mio's 1R, Aiko's tatami room and
// Kenji's flat: enter, check the stage's own draw calls and triangles against the budget (<= 12 calls), do the genkan, walk the
// host's way, hold a conversation shot, leave and land in front of the door. Then the three doors: closed by default, opened
// with `setDoorOpen`. Screenshots (the canvas only, no HUD) go to tools/e2e/shots/game/stages-*.png.
// Usage: BASE=http://127.0.0.1:5173/ node tools/e2e/game/stages.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { assertNoConsoleErrors, onboard, start } from './_common.mjs';

const t = await start('stages');
const { page } = t;
const T0 = Date.now();
const step = (m) => console.log(`• [${Math.round((Date.now() - T0) / 1000)}s] ${m}`);
const shots = new URL('../shots/game/', import.meta.url).pathname;
/** the world's canvas as a PNG (the HUD is not in it), after one fresh render */
const canvasShot = async (name) => {
  const url = await page.evaluate(() => {
    const w = window.__world;
    w.renderer.render(w.scene, w.camera);
    return w.renderer.domElement.toDataURL('image/png');
  });
  writeFileSync(`${shots}stages-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
};
/** runs `fn(world, ...args)` in the page */
const world = (fn, ...args) => page.evaluate(([src, a]) => new Function(`return (${src})`)()(window.__world, ...a), [fn.toString(), args]);

step('onboarding, the opening beats, the street');
await onboard(page, {});
for (let i = 0; i < 40; i++) {
  const sc = await page.evaluate(() => window.__lw.useStore.getState().screen);
  if (sc === 'world') break;
  if (sc === 'beat') await page.locator('.panel .btn.primary').last().click().catch(() => {});
  else await page.evaluate(() => window.__lw.useStore.getState().go('world'));
  await t.sleep(500);
}
assert.equal(await page.evaluate(() => window.__lw.useStore.getState().screen), 'world', 'on the street');
await t.sleep(1500);

const HOMES = [
  { id: 'mio_1r', host: 'mio', door: 'door:mio', props: ['kutsu', 'tsukue', 'kamera', 'poster', 'hondana', 'mado'] },
  { id: 'aiko_tatami', host: 'aiko', door: 'door:aiko', props: ['tatami', 'kotatsu', 'zabuton', 'shoji', 'kyusu', 'hana'] },
  { id: 'kenji_flat', host: 'kenji', door: 'door:kenji', props: ['chabudai', 'suihanki', 'shashin', 'yakyu', 'e', 'zabuton'] },
];

for (const h of HOMES) {
  step(`${h.id}: enter`);
  assert.equal(await world((w, id) => w.enterStage(id), h.id), true, `${h.id} enters`);
  await t.sleep(1200);
  const info = await world((w) => w.stageInfo());
  assert.equal(info.id, h.id);
  assert.ok(info.meshes >= 2 && info.meshes <= 12, `${h.id}: ${info.meshes} stage draw calls (budget 12)`);
  assert.ok(info.triangles <= 6000, `${h.id}: ${info.triangles} stage triangles`);
  for (const p of h.props) assert.ok(info.picks.includes(`prop:${h.id}:${p}`), `${h.id}: prop ${p} is tappable`);
  for (const p of ['stage:exit', 'genkan:shoes', 'genkan:slippers']) assert.ok(info.picks.includes(p), `${h.id}: ${p}`);
  assert.equal(info.people[0], h.host, 'the host is first');
  const inside = await world((w) => ({ stage: w.currentStage(), snap: w.snapshot(), calls: w.renderer.info.render.calls, tris: w.renderer.info.render.triangles }));
  assert.equal(inside.stage, h.id);
  assert.equal(inside.snap.stage, h.id);
  assert.deepEqual(inside.snap.npcs, [], 'no street NPCs on the minimap in a room');
  console.log(`  in the room: stage ${info.meshes} calls / ${info.triangles} tris; the whole frame (street hidden, people, sparkles) ${inside.calls} calls / ${inside.tris} tris`);
  await canvasShot(`${h.id}-1-genkan`);

  step(`${h.id}: the genkan (shoes, then slippers), walk to the host, a conversation shot`);
  await world((w) => w.setStageState({ shoesOff: true }));
  assert.ok(!(await world((w) => w.stageInfo().picks)).includes('genkan:shoes'), 'the shoes pick is done');
  await world((w) => w.setStageState({ slippersOn: true }));
  await world((w, host) => w.teleportNear(host), h.host);
  await page.waitForFunction((host) => window.__world.nearby === host, h.host, { timeout: 20000 });
  await world((w, host) => w.enterConversation(host), h.host);
  await t.sleep(3500);
  await canvasShot(`${h.id}-2-conversation`);
  await world((w) => w.exitConversation());
  await t.sleep(500);

  step(`${h.id}: leave by the door`);
  assert.equal(await world((w) => w.exitStage()), true);
  await t.sleep(1500);
  const out = await world((w) => ({ stage: w.currentStage(), p: w.snapshot().player, city: w.city.group.visible, npcs: w.snapshot().npcs.length }));
  assert.equal(out.stage, null);
  assert.equal(out.city, true, 'the street is back');
  assert.ok(out.npcs > 0, 'street NPCs are back on the minimap');
  await canvasShot(`${h.id}-3-door-closed`);
  assert.equal(await world((w, id) => w.isDoorOpen(id), h.door), false, `${h.door} is closed by default`);
  await world((w, id) => w.setDoorOpen(id, true), h.door);
  await t.sleep(700);
  assert.equal(await world((w, id) => w.isDoorOpen(id), h.door), true);
  await canvasShot(`${h.id}-4-door-open`);
  await world((w, id) => w.setDoorOpen(id, false), h.door);
}

// wave B2: the player's own rooms (no host; furniture drawn from `placed`, the placement view, the guest), and their two doors
const ALL = { bed: 'futon_set', desk: 'desk_study', shelf: 'bookshelf', table: 'kotatsu', plant: 'plant_pothos', kitchen: 'rice_cooker', light: 'paper_lamp', tv: 'tv_small' };
for (const [id, door, slots] of [['dorm', 'door:dorm', ['bed', 'desk', 'shelf', 'plant']], ['ono_flat', 'door:flat', Object.keys(ALL)]]) {
  step(`${id}: enter empty, furnish, placement view, a guest, leave`);
  assert.equal(await world((w, i) => w.enterStage(i, { state: { shoesOff: true, slippersOn: true } }), id), true, `${id} enters`);
  await t.sleep(800);
  await canvasShot(`${id}-1-empty`);
  const placed = Object.fromEntries(slots.map((s) => [s, ALL[s]]));
  await world((w, p) => w.setStagePlaced(p), placed);
  const info = await world((w) => w.stageInfo());
  assert.ok(info.meshes <= 12 && info.triangles <= 8000, `${id}: ${info.meshes} calls / ${info.triangles} tris furnished`);
  assert.deepEqual(info.people, [], 'nobody lives in your own room');
  await t.sleep(500);
  await canvasShot(`${id}-2-furnished`);
  await world((w) => w.setStageState({ showSlots: true, slotFocus: 'desk' }));
  const view = await world((w) => w.stageInfo());
  for (const s of slots) assert.ok(view.picks.includes(`slot:${s}`), `${id}: slot:${s} is tappable in the placement view`);
  await world((w) => w.setStageState({ showSlots: false, slotFocus: null }));
  assert.ok(!(await world((w) => w.stageInfo().picks)).some((p) => p.startsWith('slot:')), 'slot picks go away with the view');
  await world((w) => w.exitStage());
  await t.sleep(600);
  assert.equal(await world((w, i) => w.currentStage(), id), null);
  await world((w, i, p) => w.enterStage(i, { state: { shoesOff: true, slippersOn: true }, placed: p, guest: 'mio' }), id, placed);
  assert.deepEqual((await world((w) => w.stageInfo())).people, ['mio'], 'the housewarming guest');
  await world((w) => w.exitStage());
  await t.sleep(600);
  assert.equal(await world((w, d) => w.isDoorOpen(d), door), door === 'door:dorm', `${door}: the dorm is open from the start, the flat is closed until rented`);
}
await world((w) => w.setDoorOpen('flat', true));
assert.equal(await world((w) => w.isDoorOpen('door:flat')), true);
await world((w) => w.setDoorOpen('flat', false));
assert.equal(await world((w) => w.enterStage('nonsense')), false, 'an unknown stage is refused');
assert.equal(await world((w) => w.currentStage()), null);

assertNoConsoleErrors(t.logs);
await t.browser.close();
console.log(`stages e2e passed in ${Math.round((Date.now() - T0) / 1000)} s`);
