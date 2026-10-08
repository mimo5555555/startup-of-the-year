import './_fakeStorage';
import { describe, expect, it } from 'vitest';
import { JP_PACK, LESSONS } from '@lw/content';
import { createGameState, disclosure, validatePack, type GamePack, type GameState, type Interaction, type ItemDef, type JobDef, type ShopDef, type FriendDef } from '@lw/game';
import { STRINGS } from '../src/i18n';
import { gameView } from '../src/game/selectors';
import {
  HUD_BUDGET,
  doorOpens,
  goalTarget,
  goodsOf,
  hudElements,
  interactionRows,
  legacyGoal,
  legacyPlan,
  menuIds,
  needsSheet,
  npcBadge,
  openRows,
  pinOf,
  planFor,
  routePick,
  shopStates,
  type InteractionEnv,
} from '../src/game/worldSync';
import { characterById, scenariosForCharacter, scenarioForCharacter } from '../src/content';

const at = (n: number, patch: Partial<GameState> = {}): GameState => ({ ...createGameState(JP_PACK, Date.UTC(2030, 0, 15)), chapter: { ...createGameState(JP_PACK, 0).chapter, n }, ...patch });
const profile = { name: 'Sam', level: 'A1' as const, goal: 'travel', age: 'adults' as const, createdAt: '2030-01-15T00:00:00.000Z' };
const view = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: profile as never });

const ALL_SCENARIOS = new Set(Object.values(JP_PACK.interactions).flat().map((i) => i.scenarioId).filter(Boolean) as string[]);
/** the five scenarios of the original tour: other slices register more as they land, and these tests must not depend on them */
const REAL_SCENARIOS: ReadonlySet<string> = new Set(['cafe', 'konbini', 'ramen', 'station', 'park']);
const LESSON_IDS = new Set(['greetings', 'numbers', 'shopping', 'polite_casual', 'directions', 'home_manners']);

const job = (id: string): JobDef => ({ id, place: 'konbini', boss: 'tanaka', name: { en: id, ar: id }, wage: 1150, hours: 0.75, unlock: { k: 'all', of: [] }, archetypes: [] }) as unknown as JobDef;
const shop = (id: string, openChapter: number, sells: string[] = []): ShopDef => ({ id, placeId: id, name: { en: id, ar: id }, openChapter, surface: 'world', register: 'polite', pay: ['cash'], sells });
const item = (id: string, shopId: string, price: number, ch: number): ItemDef =>
  ({ id, name: { ja: id, reading: id, en: id, ar: id }, price, cat: 'electronics', shop: shopId, gate: { ch }, fx: [], tags: [] }) as unknown as ItemDef;

/** The pack with the tables later slices fill in, so the chapter logic can be exercised now. */
const packWith = (extra: Partial<GamePack>): GamePack => ({ ...JP_PACK, ...extra });
const envOf = (state: GameState, pack: GamePack = JP_PACK, scenarios: ReadonlySet<string> = REAL_SCENARIOS, lessons: ReadonlySet<string> = new Set(LESSONS.map((l) => l.id))): InteractionEnv => ({ pack, state, view, scenarios, lessons });

const FULL = packWith({
  jobs: [job('job_konbini'), job('job_cafe'), job('job_station')],
  friends: ['tanaka', 'yuki', 'sato', 'kenji', 'hanako', 'mio', 'rin', 'aiko', 'nakamura'].map(
    (id) => ({ id, tier: 'A', register: 'polite', casualAt: 99, unlockChapter: 3, loves: [], likes: [], dislikes: [], facts: ['a', 'b', 'c'], perks: [] }) as FriendDef,
  ),
  items: [item('x', 'konbini', 100, 1)],
  shops: [shop('konbini', 1), shop('denki', 4), shop('motors', 5), shop('fukufuku', 2)],
});

describe('HUD disclosure (§2.5)', () => {
  it('never shows more than 4 elements, whatever is unlocked', () => {
    for (const dreamChip of [false, true]) for (const phoneIcon of [false, true]) expect(hudElements({ dreamChip, phoneIcon }).length).toBeLessThanOrEqual(HUD_BUDGET);
  });

  it('Chapter 1 before the closing beat: wallet, tracker, level chip and the sign counter, no dream chip', () => {
    expect(hudElements({ dreamChip: false, phoneIcon: false })).toEqual(['wallet', 'tracker', 'level', 'found']);
  });

  it('after the closing beat the dream chip replaces the sign counter; the phone replaces the level chip', () => {
    expect(hudElements({ dreamChip: true, phoneIcon: false })).toEqual(['wallet', 'tracker', 'dream', 'level']);
    expect(hudElements({ dreamChip: true, phoneIcon: true })).toEqual(['wallet', 'tracker', 'dream', 'phone']);
  });

  it('follows the real disclosure of a fresh game: no dream chip, no daily goals', () => {
    const d = disclosure(JP_PACK, at(1), view);
    expect(d.dreamChip).toBe(false);
    expect(d.dailyGoals).toBe(false);
    expect(hudElements(d)).not.toContain('dream');
  });

  it('the menu lists Friends only from Chapter 3 and Phone only when owned; the original three keep their order', () => {
    expect(menuIds({ friends: false, phoneIcon: false })).toEqual({ play: ['quests', 'wallet', 'lessons'], study: ['vocab', 'stats', 'settings'] });
    expect(menuIds({ friends: true, phoneIcon: true }).play).toEqual(['quests', 'friends', 'phone', 'wallet', 'lessons']);
  });
});

describe('the interaction table (§6.1)', () => {
  const table = Object.entries(JP_PACK.interactions);
  const all = table.flatMap(([, l]) => l);

  it('has unique ids, a field for every kind, and only registered characters', () => {
    expect(new Set(all.map((i) => i.id)).size).toBe(all.length);
    for (const [who, list] of table) {
      expect(characterById(who), who).toBeTruthy();
      for (const i of list) {
        if (i.kind === 'shift') expect(i.jobId, i.id).toBeTruthy();
        else if (i.kind === 'window') expect(i.shopId, i.id).toBeTruthy();
        else if (i.kind === 'lesson') expect(i.lessonId, i.id).toBeTruthy();
        else if (i.kind !== 'gift') expect(i.scenarioId, i.id).toBeTruthy();
        expect(i.label.en && i.label.ar, i.id).toBeTruthy();
      }
    }
  });

  it('gives every spawned character a table, with the §6.1 options', () => {
    for (const who of ['tanaka', 'yuki', 'sato', 'kenji', 'hanako', 'mio', 'aoi', 'rin', 'aiko', 'nakamura']) expect(JP_PACK.interactions[who]?.length, who).toBeGreaterThan(0);
    const ids = (who: string) => JP_PACK.interactions[who].map((i) => i.id);
    expect(ids('tanaka')).toEqual(expect.arrayContaining(['tanaka_shop', 'tanaka_shift', 'tanaka_talk', 'tanaka_gift']));
    expect(ids('sato')).toEqual(expect.arrayContaining(['sato_ic', 'sato_way', 'trip_hikarigaoka', 'sato_shift']));
    expect(JP_PACK.interactions.sato.find((i) => i.id === 'trip_hikarigaoka')).toMatchObject({ kind: 'trip', ch: 5 });
    expect(JP_PACK.interactions.kenji.find((i) => i.id === 'home_kenji')).toMatchObject({ kind: 'visit', gate: { k: 'hearts', friend: 'kenji', atLeast: 4 } });
  });

  it('passes the interaction checks of validatePack (level 2: fields and ids; the job and shop references need the tables of 3E / 4D)', () => {
    expect(validatePack(JP_PACK, { level: 2 }).filter((i) => i.path.startsWith('interactions'))).toEqual([]);
    const refs = all.filter((i) => i.jobId || i.shopId);
    expect(refs.map((i) => i.jobId ?? i.shopId).sort()).toEqual(['denki', 'job_cafe', 'job_konbini', 'job_station', 'motors']);
  });

  it('a fresh player: every ordinary NPC has exactly one open option, so Talk starts it directly', () => {
    for (const who of ['tanaka', 'yuki', 'kenji', 'mio']) {
      const rows = interactionRows(envOf(at(1), FULL), who);
      expect(openRows(rows).length, who).toBe(1);
      expect(needsSheet(rows), who).toBe(false);
    }
    const sato = interactionRows(envOf(at(1), FULL), 'sato');
    expect(openRows(sato).map((r) => r.it.id)).toEqual(['sato_info']);
  });

  it('opens the sheet once there is more than one thing to do: station_ic joins Sato on day 1 when it is registered', () => {
    const withIc = new Set([...REAL_SCENARIOS, 'station_ic']);
    const rows = interactionRows(envOf(at(1), FULL, withIc), 'sato');
    expect(openRows(rows).map((r) => r.it.id)).toEqual(['sato_info', 'sato_ic']);
    expect(needsSheet(rows)).toBe(true);
  });

  it('chapter gates: the shift is a locked teaser one chapter ahead and open from Chapter 2', () => {
    const ch1 = interactionRows(envOf(at(1), FULL), 'tanaka');
    expect(ch1.find((r) => r.it.id === 'tanaka_shift')?.lock).toEqual({ ch: 2 });
    // gifts and small talk are two chapters away: not listed at all
    expect(ch1.some((r) => r.it.id === 'tanaka_gift')).toBe(false);
    const ch2 = interactionRows(envOf(at(2), FULL), 'tanaka');
    expect(ch2.find((r) => r.it.id === 'tanaka_shift')?.lock).toBeNull();
    expect(needsSheet(ch2)).toBe(true);
  });

  it('hearts gates: hang-outs and home visits are locked behind hearts, small talk with Tanaka needs a heart', () => {
    const ch3 = interactionRows(envOf(at(3), FULL, ALL_SCENARIOS), 'mio');
    expect(ch3.find((r) => r.it.id === 'mio_hang')?.lock).toEqual({ hearts: 3 });
    expect(ch3.find((r) => r.it.id === 'mio_talk')?.lock).toBeNull();
    const tanaka = interactionRows(envOf(at(3), FULL, ALL_SCENARIOS), 'tanaka');
    expect(tanaka.find((r) => r.it.id === 'tanaka_talk')?.lock).toEqual({ hearts: 1 });
  });

  it('hides an option whose scenario, job or lesson a later slice has not built yet', () => {
    const rows = interactionRows(envOf(at(3), JP_PACK), 'mio');
    expect(rows.map((r) => r.it.id)).toEqual(['mio_meet']);
    // an unknown lesson is not offered
    expect(interactionRows(envOf(at(1), FULL, REAL_SCENARIOS, new Set(['greetings'])), 'hanako').map((r) => r.it.id)).toEqual(['lesson_greetings']);
  });

  it('Hanako teaches the lessons that exist; the lesson list appears when there are several', () => {
    const rows = interactionRows(envOf(at(1), FULL, REAL_SCENARIOS, LESSON_IDS), 'hanako');
    expect(openRows(rows).map((r) => r.it.lessonId)).toEqual(['greetings', 'numbers', 'shopping']);
    expect(needsSheet(rows)).toBe(true);
    // Chapter 3 lessons are two chapters away: not listed yet
    expect(rows.some((r) => r.it.lessonId === 'polite_casual')).toBe(false);
  });

  it('window shopping: only while the shop is closed, from Chapter 2', () => {
    const win = (n: number) => interactionRows(envOf(at(n), FULL, ALL_SCENARIOS), 'aoi').find((r) => r.it.kind === 'window');
    expect(win(1)?.lock).toEqual({ ch: 2 });
    expect(win(2)?.lock).toBeNull();
    expect(win(3)?.lock).toBeNull();
    expect(win(4)).toBeUndefined(); // Hikari Denki is open: the Goods sheet takes over
  });

  it('Nakamura offers the bike first once the garage has been visited', () => {
    const before = openRows(interactionRows(envOf(at(5), FULL, ALL_SCENARIOS), 'nakamura')).map((r) => r.it.id);
    expect(before[0]).toBe('nakamura_visit');
    const visited = at(5);
    visited.runs = { ...visited.runs, motors_visit: { count: 1, complete: true, stars: 1, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [] } };
    const after = openRows(interactionRows(envOf(visited, FULL, ALL_SCENARIOS), 'nakamura')).map((r) => r.it.id);
    expect(after[0]).toBe('nakamura_bike');
  });

  it('a character with no table falls back to what Talk always did', () => {
    const bare = packWith({ interactions: {} });
    expect(interactionRows(envOf(at(1), bare), 'yuki')).toEqual([]);
    expect(legacyPlan(characterById('yuki')!)).toEqual({ t: 'convo', scenarioId: 'cafe', characterId: 'yuki' });
    expect(legacyPlan(characterById('hanako')!)).toEqual({ t: 'lesson', lessonId: 'greetings' });
  });
});

describe('content.ts is multi-valued', () => {
  it('lists every scenario of a character and keeps the primary one first', () => {
    expect(scenariosForCharacter('yuki').map((s) => s.id)).toContain('cafe');
    expect(scenarioForCharacter('yuki')?.id).toBe('cafe');
    expect(scenarioForCharacter('hanako')).toBeUndefined();
  });
});

describe('what an option does', () => {
  const lineIds = ['p_konbini_1', 'p_konbini_2'];
  const withPocket = packWith({
    scenarioMeta: JP_PACK.scenarioMeta.map((m) => (m.id === 'konbini' ? { ...m, pocket: lineIds } : m)),
    pockets: { p_konbini_1: { id: 'p_konbini_1', line: { ja: 'これをください。', en: 'This one, please.', ar: 'هذا من فضلك.' }, key: true }, p_konbini_2: { id: 'p_konbini_2', line: { ja: 'いくらですか。', en: 'How much?', ar: 'بكم؟' }, key: true } } as never,
  });
  // the real pack now authors pocket lines (2E), so "no pocket data" is a fixture of its own
  const noPocket = packWith({ scenarioMeta: JP_PACK.scenarioMeta.map((m) => ({ ...m, pocket: undefined })), pockets: {} as never });
  const konbini = JP_PACK.interactions.tanaka[0];

  it('starts the conversation straight away when the scenario has no pocket data', () => {
    expect(planFor(envOf(at(1), noPocket), konbini, 'tanaka')).toEqual({ t: 'convo', scenarioId: 'konbini', characterId: 'tanaka' });
  });

  it('goes through Prepare while the pocket is not ready, and straight in once it is', () => {
    expect(planFor(envOf(at(1), withPocket), konbini, 'tanaka')).toEqual({ t: 'prepare', scenarioId: 'konbini', characterId: 'tanaka' });
    const ready = at(1);
    ready.prep = { p_konbini_1: { s: 'ready', at: ready.clock.dayIndex }, p_konbini_2: { s: 'ready', at: ready.clock.dayIndex } };
    expect(planFor(envOf(ready, withPocket), konbini, 'tanaka').t).toBe('convo');
  });

  it("enters the ramen shop at the firmness question when the ticket from the machine is waiting", () => {
    const ramen = JP_PACK.interactions.kenji[0];
    const s = at(2);
    expect(planFor(envOf(s, noPocket), ramen, 'kenji')).toEqual({ t: 'convo', scenarioId: 'ramen', characterId: 'kenji' });
    s.tickets = { ramen: { flavor: 'shoyu' } };
    expect(planFor(envOf(s, noPocket), ramen, 'kenji')).toEqual({ t: 'convo', scenarioId: 'ramen', characterId: 'kenji', startNode: 'start_ticket' });
  });

  it('plans lessons, shifts, gifts and window shopping', () => {
    const e = envOf(at(3), FULL, ALL_SCENARIOS);
    const get = (who: string, id: string): Interaction => JP_PACK.interactions[who].find((i) => i.id === id)!;
    expect(planFor(e, get('hanako', 'lesson_greetings'), 'hanako')).toEqual({ t: 'lesson', lessonId: 'greetings' });
    expect(planFor(e, get('tanaka', 'tanaka_shift'), 'tanaka')).toEqual({ t: 'shift', jobId: 'job_konbini' });
    expect(planFor(e, get('tanaka', 'tanaka_gift'), 'tanaka')).toEqual({ t: 'gift', characterId: 'tanaka' });
    expect(planFor(e, get('aoi', 'aoi_window'), 'aoi')).toEqual({ t: 'window', shopId: 'denki' });
  });
});

describe('shutters and badges', () => {
  it('opens each shop at its chapter', () => {
    expect(shopStates(FULL, at(1)).slice(0, 4)).toEqual([['konbini', true], ['denki', false], ['motors', false], ['fukufuku', false]]);
    expect(shopStates(FULL, at(4)).find(([id]) => id === 'denki')).toEqual(['denki', true]);
    expect(shopStates(FULL, at(9)).every(([, open]) => open)).toBe(true);
  });

  it('follows the pack shops, then the shops only a chapter lists (Fuku-Fuku opens in Chapter 2, §15.4)', () => {
    const described = JP_PACK.shops.map((s) => [s.id, at(1).chapter.n >= s.openChapter]);
    expect(shopStates(JP_PACK, at(1)).slice(0, described.length)).toEqual(described);
    const state = (n: number) => new Map(shopStates(JP_PACK, at(n)));
    expect(state(1).get('fukufuku')).toBe(false);
    expect(state(1).get('aiko')).toBe(false);
    expect(state(2).get('fukufuku')).toBe(true);
    expect(state(2).get('aiko')).toBe(true);
    expect(state(1).get('konbini')).toBe(true);
  });

  it('badges: lesson / done for Hanako, new / done for the shops, a padlock when nothing is open', () => {
    const c = (id: string) => characterById(id)!;
    expect(npcBadge(envOf(at(1)), c('hanako'), {}, [])).toBe('lesson');
    expect(npcBadge(envOf(at(1)), c('hanako'), {}, ['greetings'])).toBe('done');
    expect(npcBadge(envOf(at(1)), c('tanaka'), {}, [])).toBe('new');
    expect(npcBadge(envOf(at(1)), c('tanaka'), { konbini: { count: 1, best: 2 } }, [])).toBe('done');
    // Aoi has nothing open at Chapter 1 (the denki scenario is not registered yet, the window opens at Chapter 2)
    expect(npcBadge(envOf(at(1), FULL, REAL_SCENARIOS), c('aoi'), {}, [])).toBe('locked');
  });
});

describe('the tracker and the minimap pin', () => {
  it('points at a friend, at the NPC of a place, or at a screen', () => {
    expect(goalTarget({ kind: 'objective', id: 'c1_1', text: { en: '', ar: '' }, pin: { friend: 'hanako' } })).toEqual({ t: 'npc', id: 'hanako' });
    expect(goalTarget({ kind: 'objective', id: 'c1_2', text: { en: '', ar: '' }, pin: { place: 'cafe' } })).toEqual({ t: 'npc', id: 'yuki' });
    expect(goalTarget({ kind: 'objective', id: 'c5_1', text: { en: '', ar: '' }, pin: { place: 'hikarigaoka' } })).toEqual({ t: 'npc', id: 'sato' });
    expect(goalTarget({ kind: 'lesson', id: 'numbers', text: { en: '', ar: '' } })).toEqual({ t: 'npc', id: 'hanako' });
    expect(goalTarget({ kind: 'practice', id: 'cafe', text: { en: '', ar: '' } })).toEqual({ t: 'npc', id: 'yuki' });
    expect(goalTarget({ kind: 'review', id: 'review', text: { en: '', ar: '' } })).toEqual({ t: 'screen', screen: 'vocab' });
    expect(goalTarget({ kind: 'dream', id: 's1', text: { en: '', ar: '' } })).toEqual({ t: 'screen', screen: 'quests', tab: 'dream' });
    expect(goalTarget({ kind: 'daily', id: 'g_x', text: { en: '', ar: '' } })).toEqual({ t: 'screen', screen: 'quests', tab: 'today' });
    expect(goalTarget(null)).toBeNull();
  });

  it('pins an NPC, the Ono-sō door as a point, and nothing for a goal that lives in a screen', () => {
    expect(pinOf({ kind: 'objective', id: 'a', text: { en: '', ar: '' }, pin: { friend: 'mio' } })).toEqual({ npc: 'mio' });
    expect(pinOf({ kind: 'objective', id: 'b', text: { en: '', ar: '' }, pin: { place: 'ono' } })).toMatchObject({ x: expect.any(Number), z: expect.any(Number) });
    expect(pinOf({ kind: 'review', id: 'review', text: { en: '', ar: '' } })).toBeNull();
  });

  it('the fallback tour goes Hanako, café, konbini, station, ramen, park and then ends', () => {
    const done: Record<string, unknown> = {};
    const seq: string[] = [];
    let lessons: string[] = [];
    for (let i = 0; i < 8; i++) {
      const g = legacyGoal(done, lessons);
      if (!g) break;
      seq.push(g.pin!.friend!);
      if (g.kind === 'lesson') lessons = [...lessons, g.id];
      else done[g.id] = { count: 1, best: 3 };
    }
    expect(seq).toEqual(['hanako', 'yuki', 'tanaka', 'sato', 'kenji', 'mio']);
    expect(legacyGoal(done, lessons)).toBeNull();
  });
});

describe('picks and doors', () => {
  it('routes panels, doors and shop fronts game first, and leaves every other id to the sign word card', () => {
    expect(routePick('vending')).toEqual({ t: 'vending' });
    expect(routePick('ramen_machine')).toEqual({ t: 'ticket', kind: 'ramen' });
    expect(routePick('ticket')).toEqual({ t: 'ticket', kind: 'station' });
    expect(routePick('door:mio')).toEqual({ t: 'door', friend: 'mio' });
    expect(routePick('door:dorm')).toEqual({ t: 'door', friend: null });
    expect(routePick('shop:denki')).toEqual({ t: 'shop', shopId: 'denki' });
    for (const id of ['sakura', 'pond', 'konbini', 'station', 'torii']) expect(routePick(id)).toBeNull();
  });

  it('a door stays shut until the friend is at the home-visit heart (and the visit scenario exists)', () => {
    const scenarios = new Set([...REAL_SCENARIOS, 'home_mio']);
    const near = at(6);
    expect(doorOpens(envOf(near, FULL, scenarios), 'mio')).toBe(false);
    near.friends = { mio: { ...createGameState(JP_PACK, 0).friends.mio, ap: 9999 } as never };
    expect(doorOpens(envOf(near, FULL, scenarios), 'mio')).toBe(true);
    // the scenario is not built: the door says 「まだ入れません」
    expect(doorOpens(envOf(near, FULL, REAL_SCENARIOS), 'mio')).toBe(false);
    expect(doorOpens(envOf(near, FULL, scenarios), null)).toBe(false);
  });
});

describe('goods', () => {
  it('lists what a shop sells, earliest chapter then cheapest, without repeats', () => {
    const pack = packWith({
      shops: [shop('denki', 4, ['phone_used', 'phone_case'])],
      items: [item('phone_case', 'denki', 1500, 4), item('phone_used', 'denki', 24800, 4), item('phone_pro', 'denki', 98000, 7)],
    });
    expect(goodsOf(pack, 'denki').map((g) => g.id)).toEqual(['phone_case', 'phone_used', 'phone_pro']);
    expect(goodsOf(pack, 'nowhere')).toEqual([]);
  });
});

describe('hud strings', () => {
  it('has the tracker, menu and sheet strings in both languages', () => {
    for (const k of ['hud.quests', 'hud.friends', 'hud.phone', 'hud.lessons', 'hud.choose', 'hud.closedSay', 'hud.windowNote', 'hud.noGoods', 'hud.doorLocked']) {
      expect((STRINGS.en as Record<string, string>)[k], k).toBeTruthy();
      expect((STRINGS.ar as Record<string, string>)[k], k).toMatch(/[؀-ۿ]/);
    }
  });
});
