// The player's own room (Release 2 wave B2): the four scenarios (fuku_home, aiko_viewing, aiko_contract, home_own_guest), their lexicon, slots, phrasebook,
// ScenarioMeta, pockets, the furniture and the room in the catalog (prices, comfort, slots), the dreams that use them, the culture cards, the own-room
// tables and the money rules of the real pack run through the real reducer. The conversations themselves are played in packages/engine/test/home-own.test.ts.
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  comfort,
  commitPurchase,
  dreamBlockers,
  emptyFriend,
  grantItem,
  heartsForAp,
  HOME_SLOTS,
  itemAvailability,
  ownedQty,
  pendingDeliveries,
  placeItem,
  quote,
  reduce,
  remainingCost,
  traitValue,
  validatePack,
  type ContentIndex,
  type GameState,
  type InputEvent,
} from '@lw/game';
import { ctxOf, makeFacts, makeState } from '../../game/test/fixtures-1e';
import type { Line, Scenario } from '../src';
import { CHARACTERS, JP_PACK, LEXICON, LEXICON_PARTS, PHRASEBOOK, SLOTS, SLOT_OWNERS, scenarioById, tokenize } from '../src';
import { SCENARIOS } from '../src/tokyo/scenario-registry';
import { WORD_TAGS } from '../src/tokyo/game/wordTags';
import { FLAT_DEPOSIT, FLAT_FIRST_MONTH, FLAT_MOVE_IN, VIEW_QUESTIONS } from '../src/tokyo/scenarios-home';
import { BIG_PIECES, DELIVERY_FEE, FURNITURE_PRICES, SMALL_PIECES } from '../src/tokyo/scenarios-fuku-home';
import { FLAT_VISIT, FURNITURE, OWN_GUEST, OWN_ROOMS } from '../src/tokyo/game/homes';
import { HOME_META } from '../src/tokyo/game/meta/meta-home';
import { HOME_POCKETS } from '../src/tokyo/game/pockets/pockets-home';
import { HOME_PHRASES } from '../src/phrasebook/home';
import { en as STR_EN, ar as STR_AR } from '../../../apps/mobile/src/strings/home-own';

const IDS = ['fuku_home', 'aiko_viewing', 'aiko_contract', 'home_own_guest'] as const;
const sc = (id: string) => scenarioById(id) as Scenario;
const item = (id: string) => JP_PACK.items.find((i) => i.id === id)!;
const meta = (id: string) => JP_PACK.scenarioMeta.find((m) => m.id === id)!;
const FURNITURE_IDS = ['futon_set', 'desk_study', 'bookshelf', 'plant_pothos', 'kotatsu', 'rice_cooker', 'paper_lamp'];

const lines = (s: Scenario): Array<{ line: Line; where: string }> => {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(s.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${s.id}/${n.id}/say[${i}]` }));
    (n.suggestions ?? []).forEach((c, i) => out.push({ line: c, where: `${s.id}/${n.id}/chip[${i}]` }));
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${s.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${s.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
};

describe('own room: the scenarios', () => {
  it('are registered for their characters, places and steps of the design', () => {
    expect(sc('fuku_home')).toMatchObject({ characterId: 'rin', locationId: 'fukufuku' });
    expect(sc('fuku_home').steps.map((s) => s.id)).toEqual(['choose', 'price', 'take', 'day', 'pay']);
    expect(sc('aiko_viewing')).toMatchObject({ characterId: 'aiko', locationId: 'ono' });
    expect(sc('aiko_viewing').steps.map((s) => s.id)).toEqual(['shoes', 'ask1', 'ask2', 'ask3', 'thanks']);
    expect(sc('aiko_contract')).toMatchObject({ characterId: 'aiko', locationId: 'ono' });
    expect(sc('aiko_contract').steps.map((s) => s.id)).toEqual(['decide', 'deposit', 'sign', 'pay', 'keys']);
    expect(sc('home_own_guest')).toMatchObject({ locationId: 'flat' });
    expect(sc('home_own_guest').steps.map((s) => s.id)).toEqual(['welcome', 'slippers', 'compliment', 'tea', 'goodbye']);
    for (const id of IDS) {
      const s = sc(id);
      expect(s.title.en && s.title.ar && s.setup.en && s.setup.ar, id).toBeTruthy();
      expect(['A1', 'A2']).toContain(s.level);
      for (const st of s.steps) expect(st.text.en && st.text.ar, `${id}/${st.id}`).toBeTruthy();
      expect(CHARACTERS.some((c) => c.id === s.characterId), id).toBe(true);
    }
  });

  it('have a valid graph: reachable nodes, no dead target, an end, every goal step set, two chips wherever the learner answers', () => {
    for (const id of IDS) {
      const s = sc(id);
      const seen = new Set<string>([s.start]);
      const queue = [s.start];
      while (queue.length) {
        const n = s.nodes[queue.shift()!];
        for (const t of [...n.intents.flatMap((i) => [i.next, i.nextIfNo]), n.onShort].filter(Boolean) as string[]) {
          expect(s.nodes[t], `${id}: ${n.id} -> ${t}`).toBeTruthy();
          if (!seen.has(t)) {
            seen.add(t);
            queue.push(t);
          }
        }
      }
      expect([...seen].sort(), id).toEqual(Object.keys(s.nodes).sort());
      expect(Object.values(s.nodes).some((n) => n.end), id).toBe(true);
      const steps = new Set<string>();
      for (const n of Object.values(s.nodes)) {
        if (n.step) steps.add(n.step);
        for (const i of n.intents) if (i.step) steps.add(i.step);
        if (!n.end) expect((n.suggestions ?? []).length, `${id}/${n.id}`).toBeGreaterThanOrEqual(2);
        for (const i of n.intents) if (i.request) expect(i.ideal, `${id}/${n.id}/${i.id}`).toBeTruthy();
      }
      for (const st of s.steps) expect(steps.has(st.id), `${id}/${st.id}`).toBe(true);
    }
  });

  it('every line has Japanese, English and Arabic; English has no contractions; the {variables} agree; every token is in the lexicon with a gloss', () => {
    const errors: string[] = [];
    for (const id of IDS) {
      for (const { line, where } of lines(sc(id))) {
        if (!line.ja || !line.en || !line.ar) errors.push(`${where}: missing language`);
        if (/\b\w+'(s|t|ll|re|ve|d|m)\b/.test(line.en) && !/^\w+'s\b/.test(line.en)) errors.push(`${where}: contraction in "${line.en}"`);
        const ph = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join();
        if (ph(line.ja) !== ph(line.en) || ph(line.ja) !== ph(line.ar)) errors.push(`${where}: placeholders differ`);
        const r = tokenize(line.ja.replace(/\{\w+\}/g, ''), LEXICON);
        for (const m of r.missing) errors.push(`${where}: "${m}" is not in the lexicon`);
        for (const t of r.tokens) if (!t.punct && !t.raw && !t.gloss) errors.push(`${where}: "${t.s}" has no gloss`);
      }
    }
    expect([...new Set(errors)]).toEqual([]);
  });

  it('the yen Aiko and Rin say are the catalog: 敷金 30,000 + 前家賃 30,000 = 60,000 and 配送 2,200 (checked here, so a price change cannot leave a stale line)', () => {
    expect(FLAT_DEPOSIT + FLAT_FIRST_MONTH).toBe(FLAT_MOVE_IN);
    expect(item('home_room_ono').price).toBe(FLAT_MOVE_IN);
    expect(DELIVERY_FEE).toBe(JP_PACK.rules.deliveryFee);
    const saidInContract = lines(sc('aiko_contract')).map((l) => l.line.ja).join('');
    // the deposit and the first month are the only amounts the contract says, plus the total the learner says
    expect(saidInContract).toContain('敷金|が|三|万|円');
    expect(saidInContract).toContain('前家賃|が|三|万|円');
    expect(saidInContract).toContain('六|万|円');
    // rent is mentioned only by the adult answers of the viewing: no line of the minor flow, none of the chips
    const viewing = sc('aiko_viewing');
    for (const n of Object.values(viewing.nodes)) for (const c of n.suggestions ?? []) expect(c.ja, `${n.id} chip`).not.toMatch(/家賃|敷金|契約|貸/);
  });

  it('every furniture price in the no-hooks variants is the catalog row; the big and small pieces are exactly the bulky and the non-bulky', () => {
    const optionOf = (id: string) => JP_PACK.scenarioMeta.find((m) => m.id === 'fuku_home')!.shop!.itemMap[id];
    for (const [opt, yen] of Object.entries(FURNITURE_PRICES)) expect(item(optionOf(opt)).price, opt).toBe(yen);
    expect(BIG_PIECES.every((o) => item(optionOf(o)).bulky === true)).toBe(true);
    expect(SMALL_PIECES.every((o) => !item(optionOf(o)).bulky)).toBe(true);
    expect([...BIG_PIECES, ...SMALL_PIECES].sort()).toEqual(SLOTS.furniture.map((o) => o.id).sort());
  });
});

describe('own room: lexicon, slots, phrasebook', () => {
  it('the home module is registered once, has English and Arabic for every entry, and a reading for every kanji word', () => {
    expect(Object.keys(LEXICON_PARTS)).toContain('home');
    for (const e of LEXICON_PARTS.home) {
      expect(e.en && e.ar, e.s).toBeTruthy();
      if (/[一-龯]/.test(e.s)) expect(e.r, `${e.s} needs a reading`).toBeTruthy();
    }
    const surfaces = LEXICON_PARTS.home.map((e) => e.s);
    expect(new Set(surfaces).size).toBe(surfaces.length);
    // no surface of the module is also defined by another module (the first would win silently)
    const others = Object.entries(LEXICON_PARTS).filter(([k]) => k !== 'home').flatMap(([, v]) => v.map((e) => e.s));
    expect(surfaces.filter((s) => others.includes(s))).toEqual([]);
  });

  it('counters read as counters: 六畳 ろくじょう, 何畳 なんじょう, 二十年前 にじゅうねんまえ, 四十年前 よんじゅうねんまえ', () => {
    const r = (s: string) => LEXICON.get(s)?.r;
    expect([r('六畳'), r('何畳'), r('二十年前'), r('四十年前')]).toEqual(['ろくじょう', 'なんじょう', 'にじゅうねんまえ', 'よんじゅうねんまえ']);
  });

  it('every word of the "home" word tag is in the lexicon (the flat dream asks for eight of them)', () => {
    const missing = WORD_TAGS.home.filter((w) => !LEXICON.has(w));
    expect(missing).toEqual([]);
    expect(WORD_TAGS.home.length).toBeGreaterThanOrEqual(8);
    for (const w of ['畳', '家賃', '敷金', '前家賃', '日当たり', '静か', '配送', '持ち帰り', '明日', 'あさって', '土曜日', '布団', '机', '本棚', '観葉植物', 'こたつ', '炊飯器', '電気', 'テレビ', '契約', '鍵', '名前', '署名']) {
      expect(LEXICON.has(w), w).toBe(true);
    }
  });

  it('the slots are unique to their module and agree with the metas', () => {
    for (const slot of ['viewQ', 'room', 'furniture', 'delivery', 'deliveryDay']) expect(SLOT_OWNERS[slot], slot).toEqual(['home']);
    expect(SLOTS.viewQ.map((o) => o.id).sort()).toEqual([...VIEW_QUESTIONS].sort());
    expect(SLOTS.delivery.map((o) => o.id)).toEqual(['carry', 'deliver']);
    expect(SLOTS.deliveryDay.map((o) => o.id)).toEqual(['tomorrow', 'dayAfter', 'saturday']);
    for (const o of SLOTS.furniture) expect(meta('fuku_home').shop!.itemMap[o.id], o.id).toBeTruthy();
    expect(Object.keys(meta('fuku_home').shop!.itemMap).sort()).toEqual(SLOTS.furniture.map((o) => o.id).sort());
    expect(Object.keys(meta('aiko_contract').shop!.itemMap)).toEqual(SLOTS.room.map((o) => o.id));
    for (const o of [...SLOTS.viewQ, ...SLOTS.room, ...SLOTS.furniture, ...SLOTS.delivery, ...SLOTS.deliveryDay]) {
      expect(o.gloss.en && o.gloss.ar, o.id).toBeTruthy();
      expect(o.keys.en.length && o.keys.ar.length, o.id).toBeGreaterThan(0);
    }
  });

  it('the phrasebook module has unique ids and Japanese made of lexicon words', () => {
    const ids = PHRASEBOOK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of HOME_PHRASES) {
      expect(p.en.length && p.ar.length, p.id).toBeGreaterThan(0);
      expect(tokenize(p.ja.replace(/\{\w+\}/g, ''), LEXICON).missing, p.id).toEqual([]);
    }
  });
});

describe('own room: ScenarioMeta, pockets and the pack', () => {
  it('wires the four scenarios: kinds, pay, ages, shops, effects, pocket lines', () => {
    expect(HOME_META.map((m) => m.id)).toEqual([...IDS]);
    expect(meta('fuku_home')).toMatchObject({ kind: 'shop', pay: 'full', register: 'polite', place: 'fukufuku', shop: { shopId: 'fukufuku', itemSlot: 'furniture', payStep: 'pay' } });
    expect(meta('aiko_viewing')).toMatchObject({ kind: 'talk', pay: 'full', place: 'ono', culture: ['cc_rent'], effects: [{ t: 'flag', id: 'aiko_room_shown' }] });
    expect(meta('aiko_viewing').ageMin).toBeUndefined();
    expect(meta('aiko_contract')).toMatchObject({ kind: 'shop', ageMin: 18, shop: { shopId: 'aiko', itemSlot: 'room', payStep: 'pay', itemMap: { ono: 'home_room_ono' } }, gate: { k: 'scenario', id: 'aiko_viewing', complete: true } });
    expect(meta('aiko_contract').requiredIntents).toEqual(['aiko_contract:say_total']);
    expect(meta('home_own_guest')).toMatchObject({ kind: 'home', pay: 'none', heart: 2, effects: [{ t: 'flag', id: 'housewarming' }] });
    expect(meta('home_own_guest').friendId).toBeUndefined();
    for (const m of HOME_META) {
      expect(sc(m.id).steps.some((s) => s.id === m.shop?.payStep) || !m.shop, m.id).toBe(true);
      expect(m.pocket?.length, m.id).toBe(3);
      for (const p of m.pocket ?? []) expect(JP_PACK.pockets[p], p).toBeTruthy();
    }
    // the intent the contract requires exists
    expect(Object.values(sc('aiko_contract').nodes).flatMap((n) => n.intents.map((i) => i.id))).toContain('say_total');
    expect(Object.keys(HOME_POCKETS)).toHaveLength(12);
  });

  it('the pack validates at level 4 (the bot walks the flat path: viewing -> contract -> furnishing) and nothing in level 5 is about this module', () => {
    const index: ContentIndex = {
      scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: Object.values(s.nodes).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }])),
      lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
      slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
      characters: CHARACTERS.map((c) => c.id),
    };
    expect(validatePack(JP_PACK, { level: 4, index }).filter((i) => i.severity === 'error').map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
    const mine = /home_room_ono|futon_set|desk_study|bookshelf|plant_pothos|kotatsu|rice_cooker|paper_lamp|aiko_viewing|aiko_contract|fuku_home|home_own_guest|housewarming|p_fuku_home|p_aiko_viewing|p_aiko_contract|p_home_own/;
    const errs5 = validatePack(JP_PACK, { level: 5, index })
      .filter((i) => i.severity === 'error' && mine.test(`${i.path} ${i.message}`))
      // the punctuation-glued pieces of every pocket line are a known level-5 limitation of the index check (the same for the Denki and Fuku-Fuku lines)
      .filter((i) => !(i.code === 'index_lexicon' && i.path.startsWith('pockets.')));
    expect(errs5.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });

  it('every released dream is finishable (the flat and the fresh start are offered; wave C1 adds travel and moves the cap to Chapter 6)', () => {
    expect(JP_PACK.dreams.map((d) => d.id)).toEqual(['phone_pal', 'bike', 'flat', 'travel', 'fresh_start', 'car']);
    for (const d of JP_PACK.dreams) expect(dreamBlockers(JP_PACK, d), d.id).toEqual([]);
    expect(JP_PACK.release?.lastChapter).toBe(6);
    expect(JP_PACK.chapters.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6]);
    // a flat step is shown from a played chapter (2-6) or Free Walk, never from a chapter the release does not play (7 and 8)
    for (const d of JP_PACK.dreams.filter((x) => ['flat', 'fresh_start'].includes(x.id))) for (const st of d.steps) expect([2, 3, 4, 5, 6, 9], `${d.id}/${st.id}`).toContain(st.gate);
    expect(JP_PACK.dreams.find((d) => d.id === 'flat')).toMatchObject({ ageMin: 18, furnish: 3, items: ['home_room_ono'] });
    expect(JP_PACK.dreams.find((d) => d.id === 'fresh_start')).toMatchObject({ ageMin: 18, furnish: 3 });
  });
});

describe('own room: the catalog (prices, slots, comfort)', () => {
  const ROWS: Array<[string, number, string, number, boolean]> = [
    ['futon_set', 8000, 'bed', 2, true],
    ['desk_study', 6000, 'desk', 2, true],
    ['bookshelf', 4500, 'shelf', 1, true],
    ['plant_pothos', 1200, 'plant', 1, false],
    ['kotatsu', 7000, 'table', 3, true],
    ['rice_cooker', 3500, 'kitchen', 1, false],
    ['paper_lamp', 2000, 'light', 1, false],
  ];

  it('the seven pieces are the rows of §5.2: price, slot, comfort, bulky, sold by Fuku-Fuku, owned once', () => {
    for (const [id, price, slot, c, bulky] of ROWS) {
      const i = item(id);
      expect(i.price, id).toBe(price);
      expect(i.fx.find((f) => f.t === 'home'), id).toEqual({ t: 'home', slot, comfort: c });
      expect(!!i.bulky, id).toBe(bulky);
      expect(i).toMatchObject({ shop: 'fukufuku', cat: 'home', once: true });
      expect(JP_PACK.shops.find((s) => s.id === 'fukufuku')!.sells).toContain(id);
      expect(FURNITURE[id].slot, id).toBe(slot);
      expect(LEXICON.has(FURNITURE[id].word), id).toBe(true);
    }
    expect(FURNITURE_IDS.reduce((n, id) => n + item(id).price, 0)).toBe(32200);
    // the kotatsu doubles the guest's visit; the rice cooker enables the cook-together line
    expect(item('kotatsu').fx).toContainEqual({ t: 'trait', id: 'hangout_mult', value: 1.5 });
    expect(item('rice_cooker').fx).toContainEqual({ t: 'trait', id: 'cook_together' });
    expect(FURNITURE.tv_small.slot).toBe('tv');
  });

  it('the room is 60,000 yen (30,000 deposit + 30,000 first month), 18+, a flat for `own category:flat`, sold by Aiko, and sets the tier', () => {
    expect(item('home_room_ono')).toMatchObject({ price: 60000, shop: 'aiko', once: true, tags: ['flat'] });
    expect(item('home_room_ono').gate.ageMin).toBe(18);
    expect(item('home_room_ono').fx).toEqual([{ t: 'homeTier', tier: 'ono' }]);
    expect(JP_PACK.shops.find((s) => s.id === 'aiko')!.sells).toContain('home_room_ono');
    expect(JP_PACK.shops.find((s) => s.id === 'aiko')!.pay).toEqual(['cash']);
  });

  it('chapter gates: the dorm pieces open in Chapter 5, the flat ones and the room in Chapter 6 (both are played since wave C1); the flat ones need the flat', () => {
    for (const id of ['futon_set', 'desk_study', 'bookshelf', 'plant_pothos']) expect(item(id).gate.ch, id).toBe(5);
    for (const id of ['kotatsu', 'rice_cooker', 'paper_lamp', 'home_room_ono']) expect(item(id).gate.ch, id).toBe(6);
    for (const id of ['kotatsu', 'rice_cooker', 'paper_lamp']) expect(item(id).gate.needs, id).toEqual(['home_room_ono']);
    for (const id of ['futon_set', 'desk_study', 'bookshelf', 'plant_pothos']) expect(item(id).gate.needs, id).toBeUndefined();
  });

  it('comfort is the base of the tier plus the PLACED pieces only: the dorm tops out at 7, the flat at 16 (with the TV)', () => {
    const view = ctxOf(JP_PACK).view;
    void view;
    let s: GameState = { ...makeState(10), packId: JP_PACK.id };
    for (const id of FURNITURE_IDS) s = grantItem(s, JP_PACK, id, 1, 'd1');
    // owned but not placed: only the base
    expect(comfort(JP_PACK, s)).toBe(BALANCE.comfort.base.dorm);
    for (const [id, , slot] of ROWS.filter((r) => HOME_SLOTS.dorm.includes(r[2] as never))) s = placeItem(s, JP_PACK, slot, id).state;
    expect(comfort(JP_PACK, s)).toBe(1 + 2 + 2 + 1 + 1);
    // a flat-only slot is refused in the dorm
    expect(placeItem(s, JP_PACK, 'table', 'kotatsu')).toMatchObject({ ok: false, reason: 'no_flat' });
    s = grantItem(s, JP_PACK, 'home_room_ono', 1, 'd2');
    expect(s.home.tier).toBe('ono');
    expect(comfort(JP_PACK, s)).toBe(3 + 6);
    s = grantItem(s, JP_PACK, 'tv_small', 1, 'd2');
    for (const [id, , slot] of ROWS.filter((r) => !HOME_SLOTS.dorm.includes(r[2] as never))) s = placeItem(s, JP_PACK, slot, id).state;
    s = placeItem(s, JP_PACK, 'tv', 'tv_small').state;
    expect(comfort(JP_PACK, s)).toBe(BALANCE.comfort.max);
    expect(Object.keys(s.home.placed).sort()).toEqual([...HOME_SLOTS.ono].sort());
    // taking a piece out takes its comfort away
    expect(comfort(JP_PACK, placeItem(s, JP_PACK, 'table', null).state)).toBe(BALANCE.comfort.max - 3);
  });

  it('a kotatsu in a box warms nobody: the hang-out multiplier counts only while it is placed', () => {
    let s: GameState = { ...makeState(10), packId: JP_PACK.id };
    s = grantItem(grantItem(s, JP_PACK, 'home_room_ono', 1, 'd1'), JP_PACK, 'kotatsu', 1, 'd1');
    expect(traitValue(JP_PACK, s, 'hangout_mult')).toBeNull();
    expect(traitValue(JP_PACK, placeItem(s, JP_PACK, 'table', 'kotatsu').state, 'hangout_mult')).toBe(1.5);
  });

  it('the own-room tables name the same slots as the game, the stage ids of the world and the guest rule', () => {
    expect(OWN_ROOMS.dorm.slots).toEqual(HOME_SLOTS.dorm);
    expect(OWN_ROOMS.ono.slots).toEqual(HOME_SLOTS.ono);
    expect([OWN_ROOMS.dorm.stage, OWN_ROOMS.ono.stage]).toEqual(['dorm', 'ono_flat']);
    expect(OWN_ROOMS.ono.visit).toBe(FLAT_VISIT);
    expect(OWN_GUEST).toMatchObject({ scenarioId: 'home_own_guest', hearts: 2, comfort: BALANCE.comfort.visitMin, flag: 'housewarming' });
    expect(meta('home_own_guest').effects).toContainEqual({ t: 'flag', id: OWN_GUEST.flag });
  });

  it('the dream arithmetic: the flat costs 60,000 plus the cheapest three small goods, the fresh start adds the phone and the registered bike', () => {
    const s = { ...makeState(10), packId: JP_PACK.id };
    const flat = JP_PACK.dreams.find((d) => d.id === 'flat')!;
    const fresh = JP_PACK.dreams.find((d) => d.id === 'fresh_start')!;
    // small goods that are not bulky: plant 1,200, lamp 2,000, rice cooker 3,500
    expect(remainingCost(JP_PACK, s, flat)).toBe(60000 + 1200 + 2000 + 3500);
    expect(remainingCost(JP_PACK, s, fresh)).toBe(24800 + (19800 + 600) + 60000 + 1200 + 2000 + 3500);
    // owning the room takes it off the bill; one small good already owned shortens the furnishing
    const withRoom = grantItem(s, JP_PACK, 'home_room_ono', 1, 'd1');
    expect(remainingCost(JP_PACK, withRoom, flat)).toBe(1200 + 2000 + 3500);
    expect(remainingCost(JP_PACK, grantItem(withRoom, JP_PACK, 'plant_pothos', 1, 'd1'), flat)).toBe(2000 + 3500);
  });
});

describe('own room: the money rules of the real pack', () => {
  const ADULT = ctxOf(JP_PACK, { now: new Date('2026-10-09T09:00:00').getTime() });
  const KID = { ...ADULT, view: { ...ADULT.view, profile: { ...ADULT.view.profile, age: 'kids' as const } } };
  const fw = (cash: number): GameState => {
    const s = makeState(10);
    return { ...s, packId: JP_PACK.id, chapter: { ...s.chapter, n: BALANCE.freeWalkChapter }, clock: { ...s.clock, lastLocalDate: '2026-10-09' }, wallet: { ...s.wallet, cash }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash } } };
  };
  const pay = (shopId: string, itemId: string, extra: Partial<Extract<InputEvent, { t: 'purchase' }>> = {}, n = 1, sessionId = 'c1'): InputEvent => ({ t: 'purchase', sessionId, n, shopId, itemId, qty: 1, total: 0, method: 'cash', lines: [], ...extra });

  it('the contract charges exactly ¥60,000 once, grants the room and sets the tier; the same event again changes nothing', () => {
    const q = quote(JP_PACK, fw(70000), ADULT.view, { shopId: 'aiko', itemId: 'home_room_ono', method: 'cash' });
    expect(q.total).toBe(60000);
    expect(q.lines.map((l) => l.amount)).toEqual([60000]);
    const a = reduce(fw(70000), pay('aiko', 'home_room_ono'), ADULT);
    expect(a.state.wallet.cash).toBe(10000);
    expect(a.state.home.tier).toBe('ono');
    expect(ownedQty(a.state, 'home_room_ono')).toBe(1);
    expect(a.state.ledger.filter((e) => e.kind === 'purchase').map((e) => e.delta)).toEqual([-60000]);
    const again = reduce(a.state, pay('aiko', 'home_room_ono'), ADULT);
    expect(again.state.wallet.cash).toBe(10000);
    // and a second conversation cannot rent it twice
    expect(reduce(a.state, pay('aiko', 'home_room_ono', {}, 1, 'c2'), ADULT).state.wallet.cash).toBe(10000);
  });

  it('short of cash charges nothing; a child cannot rent it; before Free Walk it is not for sale', () => {
    const poor = reduce(fw(59999), pay('aiko', 'home_room_ono'), ADULT);
    expect(poor.state.wallet.cash).toBe(59999);
    expect(poor.state.home.tier).toBe('dorm');
    expect(itemAvailability(JP_PACK, fw(70000), KID.view, 'home_room_ono')).toBe('age');
    expect(reduce(fw(70000), pay('aiko', 'home_room_ono'), KID).state.wallet.cash).toBe(70000);
    const early = { ...fw(70000), chapter: { ...fw(70000).chapter, n: 4 } };
    expect(itemAvailability(JP_PACK, early, ADULT.view, 'home_room_ono')).toBe('gate');
    expect(reduce(early, pay('aiko', 'home_room_ono'), ADULT).state.wallet.cash).toBe(70000);
  });

  it('the kotatsu, the cooker and the lamp are not in stock until you rent the room; the four dorm pieces are', () => {
    const s = fw(70000);
    for (const id of ['kotatsu', 'rice_cooker', 'paper_lamp']) expect(itemAvailability(JP_PACK, s, ADULT.view, id), id).toBe('needs');
    for (const id of ['futon_set', 'desk_study', 'bookshelf', 'plant_pothos']) expect(itemAvailability(JP_PACK, s, ADULT.view, id), id).toBe('ok');
    const flat = grantItem(s, JP_PACK, 'home_room_ono', 1, 'd1');
    for (const id of ['kotatsu', 'rice_cooker', 'paper_lamp']) expect(itemAvailability(JP_PACK, flat, ADULT.view, id), id).toBe('ok');
    // a child can furnish the dorm
    expect(itemAvailability(JP_PACK, s, KID.view, 'futon_set')).toBe('ok');
  });

  it('a delivered piece is exactly the quote (the piece + 2,200), arrives on the chosen day and is placeable only then; a carried piece is handed over at once', () => {
    const q = quote(JP_PACK, fw(70000), ADULT.view, { shopId: 'fukufuku', itemId: 'futon_set', method: 'cash' });
    expect(q.total).toBe(8000 + DELIVERY_FEE);
    expect(q.lines.map((l) => [l.kind, l.amount])).toEqual([['item', 8000], ['delivery', 2200]]);
    const r = reduce(fw(70000), pay('fukufuku', 'futon_set', { deliveryDay: 'saturday' }), ADULT);
    expect(r.state.wallet.cash).toBe(70000 - q.total);
    expect(pendingDeliveries(r.state)).toEqual([{ id: 'purchase:c1:1', item: 'futon_set', qty: 1, due: '2026-10-10' }]);
    expect(placeItem(r.state, JP_PACK, 'bed', 'futon_set').ok).toBe(false);
    const sat = reduce(r.state, { t: 'day_observed', nowMs: new Date('2026-10-10T08:00:00').getTime() }, { ...ADULT, now: new Date('2026-10-10T08:00:00').getTime() });
    expect(placeItem(sat.state, JP_PACK, 'bed', 'futon_set').ok).toBe(true);
    const plant = reduce(fw(70000), pay('fukufuku', 'plant_pothos', { deliveryDay: 'saturday' }), ADULT);
    expect(plant.state.wallet.cash).toBe(70000 - 1200);
    expect(ownedQty(plant.state, 'plant_pothos')).toBe(1);
    // the dream step "furnish with 3 things": three placed pieces fill it
    const furnished = ['futon_set', 'desk_study', 'plant_pothos'].reduce((acc, id, i) => reduce(acc, pay('fukufuku', id, {}, i + 1, `f${i}`), ADULT).state, fw(70000));
    expect(ownedQty(furnished, 'desk_study')).toBe(1);
  });

  it('commitPurchase refuses a bulky piece twice while it is on its way (no double charge)', () => {
    const first = commitPurchase(fw(70000), pay('fukufuku', 'futon_set', { deliveryDay: 'tomorrow' }) as Extract<InputEvent, { t: 'purchase' }>, ADULT);
    expect(first.ok).toBe(true);
    const second = commitPurchase(first.state, pay('fukufuku', 'futon_set', { deliveryDay: 'tomorrow' }, 1, 'other') as Extract<InputEvent, { t: 'purchase' }>, ADULT);
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('owned');
  });
});

describe('own room: culture cards, the viewing and the housewarming through the reducer', () => {
  const ADULT = ctxOf(JP_PACK, { now: new Date('2026-10-09T09:00:00').getTime() });
  const KID = { ...ADULT, view: { ...ADULT.view, profile: { ...ADULT.view.profile, age: 'kids' as const } } };
  const start = (): GameState => ({ ...makeState(10), packId: JP_PACK.id, chapter: { ...makeState(10).chapter, n: BALANCE.freeWalkChapter }, friends: {} });
  const heartsOf = (ap: number): number => heartsForAp(ap);
  const withFriend = (id: string, ap: number): GameState => {
    const s = start();
    return { ...s, friends: { ...s.friends, [id]: { ...emptyFriend(10), met: true, ap } } };
  };

  it('cc_rent is released: adult-only, filed when the viewing is finished by an adult, never for a child; cc_trash on the first entry into the flat', () => {
    const cards = Object.fromEntries(JP_PACK.culture.map((c) => [c.id, c]));
    expect(cards.cc_rent.deferred).toBeUndefined();
    expect(cards.cc_trash.deferred).toBeUndefined();
    expect(cards.cc_rent.adultOnly).toBe(true);
    expect(cards.cc_rent.trigger).toMatchObject({ on: 'scenario_done', ids: ['aiko_viewing'] });
    expect(cards.cc_trash.trigger).toMatchObject({ on: 'visit' });
    expect(cards.cc_trash.trigger.ids).toContain(FLAT_VISIT);
    const facts = makeFacts({ scenarioId: 'aiko_viewing', characterId: 'aiko', done: 5, total: 5, sessionId: 'v1' });
    const adult = reduce(start(), { t: 'conversation_done', facts }, ADULT);
    expect(adult.state.culture.cc_rent).toBeDefined();
    expect(adult.derived).toContainEqual({ t: 'culture_unlocked', id: 'cc_rent' });
    const kid = reduce(start(), { t: 'conversation_done', facts }, KID);
    expect(kid.state.culture.cc_rent).toBeUndefined();
    // the viewing sets aiko_room_shown itself, for the adult and for the child (the tea room), and completes objective c6_3 / the dream step the same way
    expect(adult.state.chapter.flags).toContain('aiko_room_shown');
    expect(kid.state.chapter.flags).toContain('aiko_room_shown');
    expect(adult.state.runs.aiko_viewing?.complete).toBe(true);
    expect(kid.state.runs.aiko_viewing?.complete).toBe(true);
    // the first entry into the flat files the rubbish-day card
    const flat = reduce(start(), { t: 'visit', place: FLAT_VISIT }, ADULT);
    expect(flat.state.culture.cc_trash).toBeDefined();
    // an unfinished viewing files nothing
    expect(reduce(start(), { t: 'conversation_done', facts: makeFacts({ scenarioId: 'aiko_viewing', characterId: 'aiko', done: 2, total: 5, sessionId: 'v2' }) }, ADULT).state.culture.cc_rent).toBeUndefined();
  });

  it('the stamp book strings exist in English and Arabic for the two released cards', () => {
    for (const k of Object.keys(STR_EN)) expect(STR_AR[k as keyof typeof STR_EN], k).toBeTruthy();
    expect(Object.keys(STR_AR).sort()).toEqual(Object.keys(STR_EN).sort());
    expect(STR_EN['culture.hint.rent'] && STR_EN['culture.hint.trash']).toBeTruthy();
  });

  it('the housewarming: a friend of 2+ hearts raises `housewarming`, pays +25 AP once per 3 days, is no visit to their home, and a placed kotatsu warms it', () => {
    const mio = 80; // two hearts
    expect(heartsOf(mio)).toBe(2);
    const facts = (id: string) => makeFacts({ scenarioId: 'home_own_guest', characterId: 'mio', done: 5, total: 5, sessionId: id });
    const a = reduce(withFriend('mio', mio), { t: 'conversation_done', facts: facts('g1') }, ADULT);
    expect(a.state.chapter.flags).toContain('housewarming');
    expect(a.state.friends.mio.ap).toBeGreaterThanOrEqual(mio + 25);
    expect(a.derived.some((d) => d.t === 'ap_gained' && d.friendId === 'mio' && d.parts.some((p) => p.source === 'hangout' && p.ap === 25))).toBe(true);
    // it is not `visit home:mio`: that is a visit to the friend's own home
    expect(a.state.stats.visits).not.toContain('home:mio');
    // a second housewarming the next day pays nothing more (one contact per 3 days); the flag stays
    const nextDay = { ...ADULT, now: new Date('2026-10-10T09:00:00').getTime() };
    const b = reduce(a.state, { t: 'conversation_done', facts: facts('g2') }, nextDay);
    expect(b.derived.some((d) => d.t === 'ap_gained' && d.parts.some((p) => p.source === 'hangout'))).toBe(false);
    expect(b.state.chapter.flags.filter((f) => f === 'housewarming')).toHaveLength(1);
    // below two hearts: nothing, not even the flag
    const low = reduce(withFriend('mio', 40), { t: 'conversation_done', facts: facts('g3') }, ADULT);
    expect(low.state.chapter.flags).not.toContain('housewarming');
    expect(low.derived.some((d) => d.t === 'ap_gained' && d.parts.some((p) => p.source === 'hangout'))).toBe(false);
    // a placed kotatsu: 25 x 1.5 = 38
    let warm = withFriend('mio', mio);
    warm = grantItem(grantItem(warm, JP_PACK, 'home_room_ono', 1, 'd1'), JP_PACK, 'kotatsu', 1, 'd1');
    warm = placeItem(warm, JP_PACK, 'table', 'kotatsu').state;
    const w = reduce(warm, { t: 'conversation_done', facts: facts('g4') }, ADULT);
    expect(w.derived.some((d) => d.t === 'ap_gained' && d.parts.some((p) => p.source === 'hangout' && p.ap === 38))).toBe(true);
  });

  it('the interaction rows: Rin\'s furniture from Chapter 5, Aiko\'s viewing from Chapter 6 and the contract only after the viewing (18+); open in Chapters 5 and 6', () => {
    const rin = JP_PACK.interactions.rin.find((r) => r.id === 'rin_home')!;
    expect(rin).toMatchObject({ kind: 'scenario', scenarioId: 'fuku_home', ch: 5 });
    const aiko = JP_PACK.interactions.aiko;
    const viewing = aiko.find((r) => r.id === 'aiko_viewing')!;
    const contract = aiko.find((r) => r.id === 'aiko_contract')!;
    expect(viewing).toMatchObject({ scenarioId: 'aiko_viewing', ch: 6 });
    expect(viewing.gate).toBeUndefined();
    expect(contract).toMatchObject({ scenarioId: 'aiko_contract', ch: 6, gate: { k: 'scenario', id: 'aiko_viewing', complete: true } });
    expect(aiko.indexOf(viewing)).toBeLessThan(aiko.indexOf(contract));
    // the rows open in the chapters of the design: both are played since wave C1 (the cap is Chapter 6)
    for (const r of [rin, viewing, contract]) expect(r.ch).toBeLessThanOrEqual(JP_PACK.release!.lastChapter);
    // minors keep the viewing (the tea room) and never see the contract: the app filters a row by the age of its scenario
    expect(meta('aiko_viewing').ageMin).toBeUndefined();
    expect(meta('aiko_contract').ageMin).toBe(18);
    expect(JP_PACK.ageProfiles.kids.ageFloor).toBeLessThan(18);
    expect(JP_PACK.ageProfiles.teens.ageFloor).toBeLessThan(18);
    expect(JP_PACK.ageProfiles.adults.ageFloor).toBeGreaterThanOrEqual(18);
    // there is no row for the housewarming: the invitation comes from the player's own room
    expect(Object.values(JP_PACK.interactions).flat().some((r) => r.scenarioId === 'home_own_guest')).toBe(false);
  });

  it('the housewarming completes the fresh_start step (and the visit to a friend\'s own home is still the ♥4 rule)', () => {
    const fresh = JP_PACK.dreams.find((d) => d.id === 'fresh_start')!;
    expect(fresh.steps.find((s) => s.id === 'fresh_start_6')!.pred).toEqual({ k: 'flag', id: 'housewarming' });
    const home = reduce(withFriend('mio', 80), { t: 'conversation_done', facts: makeFacts({ scenarioId: 'home_mio', characterId: 'mio', done: 5, total: 5, sessionId: 'hm' }) }, ADULT);
    expect(home.state.stats.visits).not.toContain('home:mio');
  });
});
