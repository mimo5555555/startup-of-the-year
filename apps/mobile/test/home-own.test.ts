// The player's own room, the app's side (Release 2 wave B2): the doors, the pieces and the slots, the comfort line, the invitation rules, the rows of
// Rin and Aiko (and what a minor sees), the delivery day that reaches the purchase, the flags of the conversations and the room store. The 3D room, the
// Furnish sheet and the whole story are covered by tools/e2e/game/home-own.mjs.
import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS, FURNITURE, JP_PACK, OWN_GUEST, OWN_ROOMS, scenarioById } from '@lw/content';
import { BALANCE, createGameState, emptyFriend, placeItem, quote, reduce, type GameState, type GameView, type InputEvent, type ReduceResult } from '@lw/game';
import { ConversationSession } from '@lw/engine';
import type { TokyoWorld } from '@lw/world';
import { STRINGS } from '../src/i18n';
import { gameView } from '../src/game/selectors';
import { createConvoGame } from '../src/game/convoHooks';
import { arrivalText, comfortInfo, firstEntry, furnitureOpen, inviteStatus, ownDoors, ownRoomFlags, ownRoomOf, pieceRows, slotRows, transitLine, worldPlaced } from '../src/game/ownLogic';
import { beginOwn, useOwn } from '../src/game/ownStore';
import { beginVisit, useHome } from '../src/game/homeStore';
import { interactionRows, ownDoorStatus, planFor, routePick, syncWorld, type InteractionEnv } from '../src/game/worldSync';

const NOW = Date.UTC(2030, 0, 15, 12);
const adults = { name: 'Sam', level: 'A1' as const, goal: 'travel', age: 'adults' as const, createdAt: '2030-01-15T00:00:00.000Z' };
const kids = { ...adults, age: 'kids' as const };
const viewOf = (profile: typeof adults | typeof kids): GameView => gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: profile as never });
const VIEW = viewOf(adults);

const AP = { h1: 30, h2: 80, h4: 240 };
const withFriend = (s: GameState, id: string, ap: number, more: Record<string, unknown> = {}): GameState => ({
  ...s,
  friends: { ...s.friends, [id]: { ...(s.friends[id] ?? emptyFriend(s.clock.dayIndex)), ap, met: true, ...more } },
});
/** Free Walk (chapter 9) with cash in hand: the pieces of chapters 5 and 6 are on sale */
const free = (cash = 100_000): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, chapter: { ...s.chapter, n: 9 }, wallet: { ...s.wallet, cash }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash } } };
};
const own = (s: GameState, ...ids: string[]): GameState => ({ ...s, owned: { ...s.owned, ...Object.fromEntries(ids.map((id) => [id, { qty: 1, day: 'd0' }])) } });
const flatOf = (s: GameState): GameState => ({ ...s, home: { ...s.home, tier: 'ono' } });
const place = (s: GameState, slot: string, id: string): GameState => {
  const r = placeItem(s, JP_PACK, slot, id);
  expect(r.ok).toBe(true);
  return r.state;
};

const ALL = new Set([...(Object.values(JP_PACK.interactions).flat().map((i) => i.scenarioId).filter(Boolean) as string[]), OWN_GUEST.scenarioId]);
const envOf = (state: GameState, view: GameView = VIEW): InteractionEnv => ({ pack: JP_PACK, state, view, scenarios: ALL, lessons: new Set() });

describe('the doors', () => {
  it('the dorm is open from the start, the flat opens with the tier', () => {
    expect(ownDoors(free())).toEqual([['dorm', true], ['flat', false]]);
    expect(ownDoors(flatOf(free()))).toEqual([['dorm', false], ['flat', true]]);
  });
  it('a tap goes in, or says why not: Aiko\'s building before the rent, the dorm left behind after moving', () => {
    expect(ownDoorStatus(free(), 'dorm').t).toBe('open');
    expect(ownDoorStatus(free(), 'flat').t).toBe('flat_closed');
    expect(ownDoorStatus(flatOf(free()), 'flat').t).toBe('open');
    expect(ownDoorStatus(flatOf(free()), 'dorm').t).toBe('dorm_moved');
  });
  it('the street routes the two own doors apart from the friends\' doors', () => {
    expect(routePick('door:dorm')).toEqual({ t: 'own', door: 'dorm' });
    expect(routePick('door:flat')).toEqual({ t: 'own', door: 'flat' });
    expect(routePick('door:mio')).toEqual({ t: 'door', friend: 'mio' });
  });
  it('syncWorld keeps the world\'s own doors in line with the tier, also for a game loaded in the flat', () => {
    const doors: Record<string, boolean> = {};
    const noop = () => {};
    const world = new Proxy({ setDoorOpen: (who: string, open: boolean) => (doors[who] = open) } as Record<string, unknown>, { get: (t, k) => (k in t ? t[k as string] : noop) }) as unknown as TokyoWorld;
    syncWorld(world, envOf(free()), { completed: [], lessonsDone: [] });
    expect([doors.dorm, doors.flat]).toEqual([true, false]);
    syncWorld(world, envOf(flatOf(free())), { completed: [], lessonsDone: [] });
    expect([doors.dorm, doors.flat]).toEqual([false, true]);
  });
});

describe('the pieces and the places', () => {
  it('an owned piece is ready, a placed one stands in its slot, a paid one on its way is in transit with its date', () => {
    let s = own(free(), 'futon_set', 'plant_pothos');
    s = place(s, 'bed', 'futon_set');
    s = { ...s, deliveries: [{ id: 'l1', item: 'desk_study', qty: 1, due: '2030-01-16' }] };
    const rows = Object.fromEntries(pieceRows(JP_PACK, s).map((p) => [p.id, p]));
    expect(rows.futon_set.state).toBe('placed');
    expect(rows.plant_pothos.state).toBe('ready');
    expect(rows.desk_study).toMatchObject({ state: 'transit', due: '2030-01-16' });
    // a piece on its way cannot be placed before it arrives
    expect(placeItem(s, JP_PACK, 'desk', 'desk_study').ok).toBe(false);
  });
  it('the flat\'s pieces wait in the dorm (no place for them), and every row is a catalog furniture piece', () => {
    const s = own(free(), 'kotatsu');
    expect(pieceRows(JP_PACK, s)[0]).toMatchObject({ id: 'kotatsu', state: 'flat' });
    expect(pieceRows(JP_PACK, flatOf(s))[0].state).toBe('ready');
    for (const p of pieceRows(JP_PACK, own(free(), ...Object.keys(FURNITURE)))) expect(FURNITURE[p.id].slot).toBe(p.slot);
  });
  it('the slots are the room\'s own: 4 in the dorm, 8 in the flat, each with the piece that stands there', () => {
    expect(slotRows(JP_PACK, free()).map((r) => r.slot)).toEqual([...OWN_ROOMS.dorm.slots]);
    expect(slotRows(JP_PACK, flatOf(free()))).toHaveLength(8);
    const s = place(own(free(), 'bookshelf'), 'shelf', 'bookshelf');
    expect(slotRows(JP_PACK, s).find((r) => r.slot === 'shelf')?.piece?.id).toBe('bookshelf');
    expect(ownRoomOf(s).stage).toBe('dorm');
    expect(ownRoomOf(flatOf(s)).stage).toBe('ono_flat');
  });
  it('the world is given only what stands in this room and is still owned', () => {
    let s = place(own(free(), 'futon_set', 'plant_pothos'), 'bed', 'futon_set');
    expect(worldPlaced(s)).toEqual({ bed: 'futon_set' });
    // a sold piece leaves no ghost in the room
    s = { ...s, owned: {} };
    expect(worldPlaced(s)).toEqual({});
  });
  it('comfort rises with the placed pieces and opens the room to friends from 4', () => {
    let s = free();
    expect(comfortInfo(JP_PACK, s)).toMatchObject({ value: 1, max: 7, visitMin: BALANCE.comfort.visitMin, open: false });
    s = place(own(s, 'futon_set', 'desk_study'), 'bed', 'futon_set');
    s = place(s, 'desk', 'desk_study');
    expect(comfortInfo(JP_PACK, s)).toMatchObject({ value: 5, open: true });
    // the line says "of" what the room can reach: the dorm 7, the flat 16 (never "of 16" for a room that cannot get there)
    expect(comfortInfo(JP_PACK, flatOf(free())).max).toBe(16);
    // owned but not placed adds nothing
    expect(comfortInfo(JP_PACK, own(free(), 'futon_set')).value).toBe(1);
  });
  it('the first entry is filed once per room (the flat\'s files the culture card)', () => {
    expect(firstEntry(flatOf(free()))).toBe(true);
    const done = reduce(flatOf(free()), { t: 'visit', place: 'flat' }, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 }).state;
    expect(firstEntry(done)).toBe(false);
    expect(done.culture.cc_trash).toBeDefined();
  });
  it('a date on its way reads in the app\'s language', () => {
    expect(arrivalText('2030-01-16', 'en')).toMatch(/16/);
    expect(arrivalText('not a date', 'en')).toBe('not a date');
    const t = (key: string, vars?: Record<string, string | number>) => (STRINGS.en[key as keyof typeof STRINGS.en] as string).replace(/\{(\w+)\}/g, (_m, k) => String(vars?.[k]));
    expect(transitLine(t as never, '2030-01-16', 'en')).toMatch(/On its way: arrives .*16/);
  });
});

describe('who can be invited', () => {
  const ready = (ap: number, more: Record<string, unknown> = {}) => withFriend(place(own(place(own(free(), 'futon_set', 'desk_study'), 'bed', 'futon_set'), 'desk_study'), 'desk', 'desk_study'), 'mio', ap, more);
  it('needs 2 hearts, then comfort 4, then the friend not met for 3 days', () => {
    expect(inviteStatus(JP_PACK, withFriend(free(), 'mio', AP.h1), 'mio')).toEqual({ t: 'hearts', need: 2 });
    expect(inviteStatus(JP_PACK, withFriend(free(), 'mio', AP.h2), 'mio')).toEqual({ t: 'comfort', need: OWN_GUEST.comfort, have: 1 });
    expect(inviteStatus(JP_PACK, ready(AP.h2), 'mio')).toEqual({ t: 'ok' });
    const recent = ready(AP.h2, { hangoutDay: free().clock.dayIndex });
    expect(inviteStatus(JP_PACK, recent, 'mio')).toEqual({ t: 'wait', days: 3 });
  });
  it('the Talk list of a friend carries the row from 2 hearts, locked with the reason until the room is comfortable', () => {
    const row = (s: GameState) => interactionRows(envOf(s), 'mio').find((r) => r.it.id === 'mio_invite');
    expect(row(withFriend(free(), 'mio', AP.h1))).toBeUndefined();
    expect(row(withFriend(free(), 'mio', AP.h2))?.lock).toEqual({ comfort: 4, have: 1 });
    expect(row(ready(AP.h2))?.lock).toBeNull();
    expect(row(ready(AP.h2, { hangoutDay: free().clock.dayIndex }))?.lock).toEqual({ wait: 3 });
    // a character who is not a friend has no such row
    expect(interactionRows(envOf(free()), 'nakamura').some((r) => r.it.id.endsWith('_invite'))).toBe(false);
  });
  it('before Rin sells furniture (chapters 1 to 4) there is no invite row to a lock nobody can open', () => {
    const early = (s: GameState): GameState => ({ ...s, chapter: { ...s.chapter, n: 3 } });
    expect(furnitureOpen(JP_PACK, early(free()))).toBe(false);
    expect(furnitureOpen(JP_PACK, free())).toBe(true);
    const row = (s: GameState) => interactionRows(envOf(s), 'mio').find((r) => r.it.id === 'mio_invite');
    expect(row(early(withFriend(free(), 'mio', AP.h2)))).toBeUndefined();
    expect(row(withFriend(free(), 'mio', AP.h2))?.lock).toEqual({ comfort: 4, have: 1 });
  });
  it('the invitation plans the housewarming in the room, not a conversation in the street', () => {
    const s = ready(AP.h2);
    const it = interactionRows(envOf(s), 'mio').find((r) => r.it.id === 'mio_invite')!.it;
    // a pocket that is not ready sends the player to Prepare first, as for every scenario; Prepare then starts the room (`talk`)
    expect(['prepare', 'invite']).toContain(planFor(envOf(s), it, 'mio').t);
    const noPocket = { ...JP_PACK, scenarioMeta: JP_PACK.scenarioMeta.map((m) => (m.id === OWN_GUEST.scenarioId ? { ...m, pocket: [] } : m)) };
    expect(planFor({ ...envOf(s), pack: noPocket }, it, 'mio')).toEqual({ t: 'invite', scenarioId: OWN_GUEST.scenarioId, characterId: 'mio' });
  });
});

describe('Rin and Aiko', () => {
  it('Rin\'s furniture row opens from Free Walk', () => {
    const row = interactionRows(envOf(free()), 'rin').find((r) => r.it.id === 'rin_home')!;
    expect(row.lock).toBeNull();
  });
  it('Aiko: the viewing opens first, the contract after it (adults); both are gone once the flat is rented', () => {
    const rows = (s: GameState, v: GameView = VIEW) => interactionRows(envOf(s, v), 'aiko').filter((r) => r.it.id.startsWith('aiko_v') || r.it.id.startsWith('aiko_c'));
    const before = rows(free());
    expect(before.map((r) => [r.it.id, !!r.lock])).toEqual([['aiko_viewing', false], ['aiko_contract', true]]);
    expect(rows(flatOf(free()))).toEqual([]);
  });
  it('a minor sees the viewing as a visit to the tea room and no contract at all (D28)', () => {
    const rows = interactionRows(envOf(free(), viewOf(kids)), 'aiko');
    expect(rows.some((r) => r.it.id === 'aiko_contract')).toBe(false);
    const viewing = rows.find((r) => r.it.id === 'aiko_viewing')!;
    expect(viewing.lock).toBeNull();
    expect(viewing.it.label.en).toMatch(/tea room/i);
    expect(JSON.stringify(viewing.it.label)).not.toMatch(/rent|room at ono|flat|contract/i);
  });
});

describe('the flags of the conversations of the room', () => {
  it('the viewing of a minor is the tea-room visit; an adult\'s is not', () => {
    expect(ownRoomFlags(JP_PACK, free(), 'kids', 'aiko_viewing', 'aiko')).toEqual({ minor: true });
    expect(ownRoomFlags(JP_PACK, free(), 'teens', 'aiko_viewing', 'aiko')).toEqual({ minor: true });
    expect(ownRoomFlags(JP_PACK, free(), 'adults', 'aiko_viewing', 'aiko')).toEqual({});
  });
  it('the housewarming speaks plain form with a friend who does, polite with one who does not', () => {
    expect(ownRoomFlags(JP_PACK, withFriend(free(), 'yuki', AP.h4), 'adults', OWN_GUEST.scenarioId, 'yuki')).toEqual({ casual: true });
    expect(ownRoomFlags(JP_PACK, withFriend(free(), 'yuki', AP.h2), 'adults', OWN_GUEST.scenarioId, 'yuki')).toEqual({});
    expect(ownRoomFlags(JP_PACK, free(), 'adults', 'cafe', 'yuki')).toEqual({});
  });
});

/** The conversation screen's hooks over a real reducer (as convoHooks.test.ts), with the chosen character and profile. */
function rig(scenarioId: string, state: GameState, characterId?: string, view: GameView = VIEW) {
  let st = state;
  const events: InputEvent[] = [];
  const game = createConvoGame({
    pack: JP_PACK,
    scenarioId,
    sessionId: 's_own',
    state: () => st,
    view: () => view,
    characterId,
    commit: (ev): ReduceResult => {
      events.push(ev);
      const r = reduce(st, ev, { pack: JP_PACK, now: NOW, view, rng: () => 0.5 });
      st = r.state;
      return r;
    },
  });
  return { game, events, get state() { return st; } };
}

describe('buying furniture from Rin', () => {
  it('a big piece with a delivery day is charged exactly the quote (piece + 2,200), booked, and not owned until it arrives', () => {
    const r = rig('fuku_home', free());
    const q = quote(JP_PACK, r.state, VIEW, { shopId: 'fukufuku', itemId: 'futon_set', qty: 1, method: 'cash' });
    expect(q.canPay).toBe(true);
    expect(r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'tomorrow', payMethod: 'cash' }).ok).toBe(true);
    const ev = r.events.find((e) => e.t === 'purchase')!;
    expect(ev).toMatchObject({ t: 'purchase', itemId: 'futon_set', deliveryDay: 'tomorrow', total: q.total });
    expect(q.total).toBe(8000 + 2200);
    expect(r.state.wallet.cash).toBe(100_000 - q.total);
    expect(r.state.owned.futon_set).toBeUndefined();
    expect(r.state.deliveries).toHaveLength(1);
    expect(r.state.deliveries![0]).toMatchObject({ item: 'futon_set' });
    expect(r.game.purchases[0].receipt.total).toBe(q.total);
  });
  it('the same event twice (a double tap, a reload) books and charges once', () => {
    const r = rig('fuku_home', free());
    r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'saturday' });
    const ev = r.events.find((e) => e.t === 'purchase')!;
    const again = reduce(r.state, ev, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 }).state;
    expect(again.wallet.cash).toBe(r.state.wallet.cash);
    expect(again.deliveries).toHaveLength(1);
  });
  it('a small piece is carried home: handed over at once, whatever day the slot holds', () => {
    const r = rig('fuku_home', free());
    expect(r.game.hooks.charge({ furniture: 'plant', deliveryDay: 'tomorrow' }).ok).toBe(true);
    expect(r.state.owned.plant_pothos?.qty).toBe(1);
    expect(r.state.deliveries ?? []).toHaveLength(0);
    expect(r.state.wallet.cash).toBe(100_000 - 1200);
  });
  it('short of cash charges nothing and books nothing', () => {
    const r = rig('fuku_home', free(5000));
    expect(r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'tomorrow' }).ok).toBe(false);
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(0);
    expect(r.state.wallet.cash).toBe(5000);
    expect(r.state.deliveries ?? []).toHaveLength(0);
  });
  it('the piece comes with the clock: the next calendar day hands it over and it can be placed', () => {
    const r = rig('fuku_home', free());
    r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'tomorrow' });
    const tomorrow = reduce(r.state, { t: 'day_observed', nowMs: NOW + 86_400_000 }, { pack: JP_PACK, now: NOW + 86_400_000, view: VIEW, rng: () => 0.5 });
    expect(tomorrow.state.owned.futon_set?.qty).toBe(1);
    expect(tomorrow.derived.some((d) => d.t === 'delivered' && d.itemId === 'futon_set')).toBe(true);
    expect(placeItem(tomorrow.state, JP_PACK, 'bed', 'futon_set').ok).toBe(true);
  });
});

describe('signing for the flat', () => {
  const viewed = (s: GameState): GameState => ({ ...s, runs: { ...s.runs, aiko_viewing: { count: 1, best: 1, last: 0, firstDay: 0, stars: 1, completed: true } as never } });
  it('the move-in is exactly 60,000 yen in cash; the tier changes; the flat\'s door opens', () => {
    const r = rig('aiko_contract', viewed(free()));
    expect(r.game.hooks.charge({ room: 'ono', payMethod: 'cash' }).ok).toBe(true);
    expect(r.state.wallet.cash).toBe(40_000);
    expect(r.state.home.tier).toBe('ono');
    expect(ownDoors(r.state)).toEqual([['dorm', false], ['flat', true]]);
  });
  it('short of cash charges nothing', () => {
    const r = rig('aiko_contract', viewed(free(59_000)));
    expect(r.game.hooks.charge({ room: 'ono' }).ok).toBe(false);
    expect(r.state.wallet.cash).toBe(59_000);
    expect(r.state.home.tier).toBe('dorm');
  });
  it('a minor\'s profile is not sold the room (the item is age-gated)', () => {
    const r = rig('aiko_contract', viewed(free()), 'aiko', viewOf(kids));
    expect(r.game.hooks.charge({ room: 'ono' }).ok).toBe(false);
    expect(r.state.wallet.cash).toBe(100_000);
  });
  it('the viewing of a minor sets the session flag that turns it into the tea-room visit', () => {
    expect(rig('aiko_viewing', free(), 'aiko', viewOf(kids)).game.flags.minor).toBe(true);
    expect(rig('aiko_viewing', free(), 'aiko').game.flags.minor).toBeUndefined();
  });
  it('the housewarming conversation gets the guest\'s register from the character it is played with', () => {
    const s = withFriend(free(), 'yuki', AP.h4);
    expect(rig(OWN_GUEST.scenarioId, s, 'yuki').game.flags.casual).toBe(true);
    expect(rig(OWN_GUEST.scenarioId, withFriend(free(), 'yuki', AP.h2), 'yuki').game.flags.casual).toBeUndefined();
    const sc = scenarioById(OWN_GUEST.scenarioId)!;
    const session = new ConversationSession({ scenario: sc, character: CHARACTERS.find((c) => c.id === 'yuki')!, l1: 'en', profileName: 'Sam', topics: [], sessionId: 's', game: rig(OWN_GUEST.scenarioId, s, 'yuki').game.hooks, flags: { casual: true }, policy: BALANCE });
    session.start();
    expect(session.ended).toBe(false);
  });
});

describe('the room in progress', () => {
  beforeEach(() => {
    useOwn.getState().end();
    useHome.getState().end();
  });
  it('asks to go in once (a double tap is ignored) and remembers the room of the current tier', () => {
    expect(beginOwn()).toBe(true);
    expect(beginOwn()).toBe(false);
    expect(useOwn.getState().room).toMatchObject({ tier: 'dorm', stage: 'dorm', phase: 'enter', furnish: false, pick: null });
    useOwn.getState().patch({ furnish: true, pick: 'futon_set' });
    expect(useOwn.getState().room).toMatchObject({ furnish: true, pick: 'futon_set' });
    useOwn.getState().end();
    expect(useOwn.getState().room).toBeNull();
  });
  it('is not started over a friend\'s home, and carries the guest', () => {
    expect(beginVisit('home_mio')).toBe(true);
    expect(beginOwn()).toBe(false);
    useHome.getState().end();
    expect(beginOwn({ guest: 'mio', talk: 'real' })).toBe(true);
    expect(useOwn.getState().room).toMatchObject({ guest: 'mio', talk: 'real' });
  });
});

describe('strings', () => {
  it('every key the room uses has English and Arabic text', () => {
    const keys = Object.keys(STRINGS.en).filter((k) => k.startsWith('ho.'));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) expect((STRINGS.ar as Record<string, string>)[k], k).toBeTruthy();
    for (const slot of [...OWN_ROOMS.ono.slots]) expect(STRINGS.en[`ho.slot.${slot}` as keyof typeof STRINGS.en], slot).toBeTruthy();
  });
});

describe('the conversation host (regression)', () => {
  it('calls the hooks of both rooms on every render: a `||` between two hooks skipped the second one while a friend\'s home was on the panel and crashed the conversation', () => {
    const src = readFileSync(new URL('../src/game/host.tsx', import.meta.url), 'utf8');
    // two hook calls joined by a logical operator on one line would be conditional
    expect(src).not.toMatch(/use\w+\([^\n]*\)\s*(\|\||&&|\?\?)\s*use\w+\(/);
    expect(src).toMatch(/useHome\(/);
    expect(src).toMatch(/useOwn\(/);
  });
});
