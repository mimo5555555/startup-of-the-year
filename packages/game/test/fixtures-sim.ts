// The economy simulator (agent 1F): a port of docs/economy-ref-sim.mjs that plays its personas through the REAL reducer.
// Every number of the reference model is kept (chapter table, personas, minutes per action, the skill curve, dream items and
// prices); what changes is that each action is an `InputEvent` and the money, chapters, hearts and daily goals are whatever
// `reduce` makes of them. The reference model pays by formula; here the formula is `settleLoop`, so a regression in any owner module
// moves the dates this file measures.
//
// WHERE THIS FIXTURE DIFFERS FROM THE REAL JP PACK (authored in slices 2-4), deliberately:
//  - Chapter objectives are the reference model's requirement table (N objective conversations, shifts, hearts, the phone and its
//    chats) written as predicates: `scenario o<ch>_<i> complete`, `shift n`, `hearts_count`, `own category:phone`, `phone_chat`.
//    The real chapters ask for lessons, discoveries, words, culture phrases and more, which this model does not price.
//    Chapter 1 adds `c1_5` (say 3 new words, easier alternative 2) so the "never speaks" persona is blocked by design (§4.6).
//  - The tap-leaning persona needs 1.3x the objective conversations (the model's `sessionMul`): its pack has 1.3x the objective
//    scenarios, standing in for the replays a tapper needs before the own-words objectives are met.
//  - No friend perks, no points card, no discount of any kind (the real pack has Aiko's -10,000 and Sato's fares): the model has none.
//  - Gifts are one 300-yen item every friend loves (AP 12); the model's gift AP grows with the heart level (12-30).
//    A friend talk is a 12-AP talk (5 + share 4 + one callback 3), the model's flat 12; the first one also gets the +20 "met".
//  - Daily goals are the speak / do / review templates the model's persona can finish; the sim finishes whatever is left at the end
//    of each active day with the cheapest real events ("goal fillers"), because the model assumes every active day earns the
//    full 400 + streak. Goals only exist from Chapter 2 (§2.5); the model pays them from day 1.
//  - Phone chats need a waiting thread (queued once a day), the real rule; the model lets a friend at 2 hearts chat at once.
//  - The second shift of a day at the same job pays 0.5 (real), the model's flat 0.6.
//  - Skill dithers (a conversation of 8 turns has round(8p) independent ones, rounded randomly), so means match the model.
import { createGameState, reduce } from '../src/reducer';
import { heartsForAp } from '../src/friends';
import { reconcile } from '../src/ledger';
import type {
  ChapterDef,
  ConversationFacts,
  DailyTemplate,
  DreamDef,
  DerivedEvent,
  FriendDef,
  GamePack,
  GameState,
  GameView,
  InputEvent,
  ItemDef,
  JobDef,
  Objective,
  Pred,
  ScenarioMeta,
  ShiftResult,
  ShopDef,
  TurnFacts,
} from '../src/types';
import { ECON, JPY, RULES, TAX } from './fixtures-money';

// ---------------------------------------------------------------------------------------------------------------
// The reference model's numbers
// ---------------------------------------------------------------------------------------------------------------

export const BASE_DAY = (d: number): number => new Date(2030, 0, 1 + d, 12, 0, 0).getTime();

/** `CH` of the reference model: objective conversations (`sessions`), minimum active days, reward, the other requirements. */
export const CH = [
  { n: 1, minDays: 1, reward: 2500, sessions: 3 },
  { n: 2, minDays: 2, reward: 2500, sessions: 2, shifts: 1 },
  { n: 3, minDays: 4, reward: 3000, sessions: 2, friends2: 2 },
  { n: 4, minDays: 7, reward: 4000, sessions: 1, phone: true, chats: 4 },
  { n: 5, minDays: 10, reward: 5000, sessions: 3, shifts: 2 },
  { n: 6, minDays: 14, reward: 6000, sessions: 2, heart4: true, shiftsTotal: 5 },
  { n: 7, minDays: 19, reward: 8000, sessions: 3, friends2: 4 },
  { n: 8, minDays: 25, reward: 10000, sessions: 4 },
] as const;

/** An item is buyable when `chapter.n >= gate` (9 = Free Walk). Prices are the reference model's. */
export const ITEMS = {
  phone: { id: 'phone_used', price: 24800, gate: 4 },
  bike: { id: 'bike_mamachari', price: 19800 + 600, gate: 5 },
  helmet: { id: 'bike_helmet', price: 2980, gate: 5 },
  room: { id: 'home_room_ono', price: 60000, gate: 6 },
  plant: { id: 'plant_pothos', price: 1200, gate: 5 },
  lamp: { id: 'paper_lamp', price: 2000, gate: 6 },
  cooker: { id: 'rice_cooker', price: 3500, gate: 6 },
  car: { id: 'car_kei_used', price: 198000, gate: 9 },
} as const;
type ItemKey = keyof typeof ITEMS;

export const DREAMS_REF: Record<string, ItemKey[]> = {
  Phone: ['phone'],
  'Phone + bike + helmet': ['phone', 'bike', 'helmet'],
  fresh_start: ['phone', 'bike', 'room', 'plant', 'lamp', 'cooker'],
  'Phone + kei car': ['phone', 'car'],
};

export interface Persona {
  min: number;
  first: number;
  skip: number;
  shifts: number;
  talks: number;
  prep: number;
  echo: number;
  p0: number;
  pMax: number;
  sessionMul?: number;
  post?: 'div' | 'repeat' | 'shift';
}

export const PERSONAS: Record<string, Persona> = {
  casual: { min: 15, first: 30, skip: 0, shifts: 1, talks: 1, prep: 0.8, echo: 1, p0: 0.15, pMax: 0.87 },
  light: { min: 10, first: 15, skip: 2, shifts: 1, talks: 1, prep: 0.5, echo: 0.5, p0: 0.15, pMax: 0.87 },
  serious: { min: 30, first: 40, skip: 0, shifts: 1, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87 },
  grinder: { min: 90, first: 90, skip: 0, shifts: 2, talks: 3, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87 },
  tapleaning: { min: 15, first: 30, skip: 0, shifts: 1, talks: 1, prep: 0.8, echo: 0, p0: 0.1, pMax: 0.4, sessionMul: 1.3 },
  // the CI ratios: 60-minute personas that play alike until Chapter 8, then do something else
  diversified: { min: 60, first: 60, skip: 0, shifts: 1, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87, post: 'div' },
  repeater: { min: 60, first: 60, skip: 0, shifts: 1, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87, post: 'repeat' },
  shiftonly: { min: 60, first: 60, skip: 0, shifts: 2, talks: 2, prep: 0.9, echo: 1, p0: 0.15, pMax: 0.87, post: 'shift' },
  // a persona that never produces a line of its own: blocked at c1_5 by design
  neverSpeaks: { min: 15, first: 30, skip: 0, shifts: 1, talks: 1, prep: 0.8, echo: 0, p0: 0, pMax: 0 },
};

// ---------------------------------------------------------------------------------------------------------------
// The synthetic pack
// ---------------------------------------------------------------------------------------------------------------

const g = (en: string) => ({ en, ar: `ar:${en}` });
const name = (en: string) => ({ ja: en, en, ar: `ar:${en}` });
const MENU_COFFEE = 'konbini:coffee';
const MENU_ONIGIRI = 'konbini:onigiri';
/**
 * Gifts by price tier (§8.5: under 500 yen -> 6 AP, under 1,500 -> 10, then 15), each loved by every friend (x2). Eight of each: the
 * same item to the same friend within 7 days is worth a quarter (E8), so the persona rotates (the model has no such rule).
 */
const GIFT_TIERS = [300, 1000, 1500] as const;
const GIFTS = GIFT_TIERS.flatMap((price) => Array.from({ length: 8 }, (_, k) => ({ id: `g_${price}_${k}`, price })));
const giftsOf = (price: number): Array<{ id: string; price: number }> => GIFTS.filter((x) => x.price === price);
const FREE_SCENARIOS = 4 + 3 * 8;

export function simPack(opts: { sessionMul?: number } = {}): GamePack {
  const mul = opts.sessionMul ?? 1;
  const sessions = (n: number): number => Math.ceil(n * mul);

  const item = (def: (typeof ITEMS)[ItemKey], shop: string, extra: Partial<ItemDef> = {}): ItemDef => ({ id: def.id, name: name(def.id), price: def.id === ITEMS.bike.id ? 19800 : def.price, cat: 'electronics', shop, gate: { ch: def.gate }, fx: [], tags: [], once: true, ...extra });
  const items: ItemDef[] = [
    item(ITEMS.phone, 'denki', { fx: [{ t: 'feature', id: 'phone' }], tags: ['phone'] }),
    // the bike's 600 registration is the pack rule (`registrationFee`), added by the quote
    item(ITEMS.bike, 'motors', { cat: 'transport', fx: [{ t: 'ride', mul: 1.5, mesh: 'bike' }], tags: ['bicycle'] }),
    item(ITEMS.helmet, 'motors', { cat: 'transport' }),
    item(ITEMS.room, 'aiko', { cat: 'home', fx: [{ t: 'homeTier', tier: 'ono' }], tags: ['flat'], gate: { ch: 6, ageMin: 18 } }),
    item(ITEMS.plant, 'fuku', { cat: 'home', fx: [{ t: 'home', slot: 'plant', comfort: 1 }] }),
    item(ITEMS.lamp, 'fuku', { cat: 'home', fx: [{ t: 'home', slot: 'light', comfort: 1 }] }),
    item(ITEMS.cooker, 'fuku', { cat: 'home', fx: [{ t: 'home', slot: 'kitchen', comfort: 1 }] }),
    item(ITEMS.car, 'motors', { cat: 'transport', fx: [{ t: 'ride', mul: 2.5, mesh: 'car' }], tags: ['car'], body: 148_000, gate: { ch: 9, ageMin: 18 } }),
    ...GIFTS.map((x): ItemDef => ({ id: x.id, name: name(x.id), price: x.price, cat: 'gift', shop: 'aiko', gate: { ch: 2 }, fx: [{ t: 'gift', tags: ['sim'] }], tags: ['sim'] })),
  ];
  const menu = (option: string, price: number) => ({ id: `konbini:${option}`, shop: 'konbini', slot: 'item', option, name: name(option), price, taxClass: 'food', tags: ['food'] });
  const shop = (id: string, openChapter: number, sells: string[]): ShopDef => ({ id, placeId: `place_${id}`, name: g(id), openChapter, surface: 'world', register: 'polite', pay: ['cash'], sells });
  const shops = [
    shop('konbini', 1, [MENU_COFFEE, MENU_ONIGIRI]),
    shop('aiko', 2, [...GIFTS.map((x) => x.id), ITEMS.room.id]),
    shop('fuku', 2, [ITEMS.plant.id, ITEMS.lamp.id, ITEMS.cooker.id]),
    shop('denki', 4, [ITEMS.phone.id]),
    shop('motors', 5, [ITEMS.bike.id, ITEMS.helmet.id, ITEMS.car.id]),
  ];

  const friends: FriendDef[] = Array.from({ length: 5 }, (_, i) => ({
    id: `f${i}`,
    tier: 'A' as const,
    register: 'polite' as const,
    casualAt: 99 as const,
    unlockChapter: 3,
    loves: GIFTS.map((x) => x.id),
    likes: [],
    dislikes: [],
    facts: ['a', 'b', 'c'] as [string, string, string],
    perks: [],
  }));

  const jobs: JobDef[] = [
    ['job_konbini', 1150],
    ['job_cafe', 1200],
    ['job_station', 1400],
  ].map(([id, wage]) => ({ id: id as string, place: 'place_konbini', boss: 'f0', name: g(id as string), wage: wage as number, hours: 0.75, unlock: { k: 'all' as const, of: [] }, archetypes: [], vocabTags: [], bonus: { itemId: MENU_ONIGIRI, needsPerfect: true as const } }));

  const meta = (id: string, extra: Partial<ScenarioMeta> = {}): ScenarioMeta => ({ id, kind: 'talk', band: 'A1', register: 'polite', pay: 'full', ...extra });
  const scenarioMeta: ScenarioMeta[] = [
    meta('shop_konbini', { kind: 'shop', shop: { shopId: 'konbini', itemSlot: 'item', payStep: 'pay', itemMap: { coffee: MENU_COFFEE, onigiri: MENU_ONIGIRI } } }),
    meta('shop_aiko', { kind: 'shop', shop: { shopId: 'aiko', itemSlot: 'giftItem', payStep: 'pay', itemMap: { ...Object.fromEntries(GIFTS.map((x) => [x.id, x.id])), room: ITEMS.room.id } } }),
    meta('shop_fuku', { kind: 'shop', shop: { shopId: 'fuku', itemSlot: 'furniture', payStep: 'pay', itemMap: { plant: ITEMS.plant.id, lamp: ITEMS.lamp.id, cooker: ITEMS.cooker.id } } }),
    meta('shop_denki', { kind: 'shop', shop: { shopId: 'denki', itemSlot: 'denkiItem', payStep: 'pay', itemMap: { phone: ITEMS.phone.id } } }),
    meta('shop_motors', { kind: 'shop', shop: { shopId: 'motors', itemSlot: 'bikeModel', payStep: 'pay', itemMap: { bike: ITEMS.bike.id, helmet: ITEMS.helmet.id, car: ITEMS.car.id } } }),
    ...CH.flatMap((c) => Array.from({ length: sessions(c.sessions) }, (_, i) => meta(`o${c.n}_${i}`, { band: c.n >= 4 ? 'A2' : 'A1' }))),
    ...Array.from({ length: FREE_SCENARIOS }, (_, k) => meta(`f${k}`)),
    meta('rep'),
    meta('drill_a', { pay: 'none', place: 'place_a' }),
    meta('drill_b', { pay: 'none', place: 'place_b' }),
    ...friends.map((f) => meta(`talk_${f.id}`, { kind: 'friend', pay: 'none', friendId: f.id })),
    ...['chat_first', 'chat_greet', 'chat_food', 'chat_plan', 'chat_miss'].map((id) => meta(id, { kind: 'chat', pay: 'none', register: 'casual' })),
  ];

  const obj = (id: string, pred: Pred, extra: Partial<Objective> = {}): Objective => ({ id, pred, text: g(id), ...extra });
  const talks = (n: number, i: number): Objective => obj(`c${n}_s${i}`, { k: 'scenario', id: `o${n}_${i}`, complete: true });
  const sess = (n: number, count: number): Objective[] => Array.from({ length: sessions(count) }, (_, i) => talks(n, i));
  const chapter = (c: (typeof CH)[number], extra: Partial<ChapterDef>, more: Objective[]): ChapterDef => ({
    n: c.n,
    title: name(`Chapter ${c.n}`),
    minDays: c.minDays,
    reward: c.reward,
    opens: [],
    objectives: [...sess(c.n, c.sessions), ...more],
    beats: { open: `b_ch${c.n}_open`, close: `b_ch${c.n}_close` },
    ...extra,
  });
  const chapters: ChapterDef[] = [
    chapter(CH[0], { opens: [{ kind: 'shop', id: 'konbini' }, { kind: 'interaction', id: 'int_lesson' }] }, [obj('c1_5', { k: 'say_new', n: 3 }, { easier: { pred: { k: 'say_new', n: 2 }, afterTries: 3 } })]),
    chapter(CH[1], { opens: [{ kind: 'job', id: 'job_konbini' }, { kind: 'shop', id: 'aiko' }, { kind: 'shop', id: 'fuku' }] }, [obj('c2_shift', { k: 'shift', n: 1 })]),
    chapter(CH[2], { opens: [{ kind: 'job', id: 'job_cafe' }, { kind: 'feature', id: 'friends' }] }, [obj('c3_hearts', { k: 'hearts_count', atLeast: 2, n: 2 })]),
    chapter(CH[3], { opens: [{ kind: 'shop', id: 'denki' }], catchUp: { afterActiveDays: 7, item: ITEMS.phone.id, maxYen: 12_000 } }, [obj('c4_phone', { k: 'own', category: 'phone' }), obj('c4_chats', { k: 'phone_chat', n: 4, friends: 2 })]),
    chapter(CH[4], { opens: [{ kind: 'job', id: 'job_station' }, { kind: 'shop', id: 'motors' }] }, [obj('c5_shift', { k: 'shift', n: 2 })]),
    // the real chapter 6 also waits for a heart-3 friend before it starts; the model has no such gate, and its persona spreads its talks over
    // five friends to heart 2 first, so the gate would hold chapter 6 back by ~10 days (validatePack checks the real gate instead)
    chapter(CH[5], {}, [obj('c6_hearts', { k: 'hearts_count', atLeast: 4, n: 1 }), obj('c6_shift', { k: 'shift', n: 5 })]),
    chapter(CH[6], {}, [obj('c7_hearts', { k: 'hearts_count', atLeast: 2, n: 4 })]),
    chapter(CH[7], {}, []),
  ];

  const dreams: DreamDef[] = [{ id: 'phone_pal', name: name('phone'), horizon: 'short', steps: [{ id: 'pp_1', gate: 4, pred: { k: 'own', category: 'phone' }, text: g('phone') }], items: [ITEMS.phone.id], title: 't_phone', beat: 'b_dream_phone', sticker: 'st_phone', defaultFor: ['casual'] }];
  const tpl = (id: string, slot: DailyTemplate['slot'], counter: DailyTemplate['counter'], target: number, requires?: DailyTemplate['requires']): DailyTemplate => ({ id, slot, counter, target, text: g(id), ...(requires ? { requires } : {}) });
  const daily: DailyTemplate[] = [
    tpl('g_conv2', 'speak', 'conv_distinct', 2),
    tpl('g_indep6', 'speak', 'indep_lines', 6),
    tpl('g_newphrase2', 'speak', 'new_intents', 2),
    tpl('g_buy', 'do', 'purchase', 1, { chapter: 1 }),
    tpl('g_place', 'do', 'places_distinct', 2),
    tpl('g_review8', 'review', 'review_checked', 8, { vocabCards: true }),
    tpl('g_lesson', 'review', 'lesson', 1),
  ];
  const age = { dailyGoals: 3, pocketLines: 4, textScale: 1, minTapPx: 44, ttsRate: 1, echoThreshold: 0.7, ageFloor: 18, voiceDefault: 'consent', adultGate: false, walletStyle: 'full', newCardsPerDay: 8, adultTopics: true } as GamePack['ageProfiles']['adults'];

  return {
    schema: 1,
    id: 'sim',
    language: 'ja',
    district: 'sim',
    name: g('Sim'),
    currency: JPY,
    economy: ECON,
    tax: TAX,
    // no points card: the model has none, and points never change the cash flow it measures
    rules: { ...RULES, pointsCard: false },
    lang: {
      readNumber: (n) => String(n),
      priceMarkup: (n, cur) => ({ markup: String(n), reading: String(n), gloss: { en: `${n} ${cur.code}`, ar: `${n} ${cur.code}` } }),
      parseNumbers: (text) => ({ text, numbers: [] }),
      speechNormalize: (t) => t,
      registerMarkers: { casual: { good: [], bad: [] }, polite: { good: [], bad: [] }, keigo: { good: [], bad: [] } },
    },
    menu: [menu('coffee', 450), menu('onigiri', 160)],
    items,
    shops,
    fares: {},
    jobs,
    chapters,
    dreams,
    daily,
    beats: {},
    friends,
    interactions: { npc: [{ id: 'int_lesson', label: g('Lesson'), kind: 'lesson' }] },
    scenarioMeta,
    pockets: {},
    wordTags: {},
    culture: [],
    titles: [],
    ageProfiles: { kids: age, teens: age, adults: age, seniors: age },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------------------------------------------

export interface SimResult {
  persona: string;
  /** calendar day (1-based) each chapter completed on */
  chDay: number[];
  phoneDay: number | null;
  /** first day each dream is affordable and unlocked (shadow wallets, like the model) */
  dreams: Record<string, number | null>;
  total30: number;
  perDay30: number;
  /** yen by source over the first 30 days */
  comp: { conv: number; mastery: number; shift: number; goals: number; chapter: number };
  /** language yen (loop + stars + first phrases + echo + shifts) on days 31-60 */
  lang3160: number;
  /** language yen per calendar day */
  langPerDay: number[];
  minCash: number;
  /** the money invariants hold at the end: cash + ic = start + earned - spent, checksum = wallet */
  reconciles: boolean;
  /** the first chapter of the run is still current at the end */
  finalChapter: number;
  state: GameState;
  /** days the persona played */
  activeDays: number;
  /** how many of each action the persona took in the first 30 days */
  counts30: { obj: number; free: number; shifts: number; talks: number };
  /** friends at 2+ hearts the moment chapter 3 completed (the phone chats of chapter 4 need two of them) */
  heartsAtCh3: number | null;
  /** yen spent on practice drinks, gifts and goal-filler purchases in the first 40 days */
  spend: { practice: number; gifts: number; goals: number };
}

const LANG_KINDS = new Set(['loop', 'star', 'phrase', 'echo', 'shift']);
const MASTERY_KINDS = new Set(['star', 'phrase', 'echo']);

/** The model's PRNG (mulberry32 on `seed`). */
function mulberry(seed: number): () => number {
  let st = seed >>> 0;
  return () => {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(personaName: string, days: number, seed: number): SimResult {
  const P = PERSONAS[personaName]!;
  const pack = simPack({ sessionMul: P.sessionMul });
  const rnd = mulberry(seed);
  let state = createGameState(pack, BASE_DAY(0));
  let streak = 0;
  let today = 1;
  const view = (): GameView => ({
    vocab: { total: 5, known: new Set(), dueCount: 8, reviewedKeys: new Set(['k']), reviewedSurfaces: new Set() },
    discovered: [],
    lessonsDone: [],
    streakDays: streak,
    profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-01' },
  });
  const ctxRng = mulberry(seed ^ 0x9e3779b9);

  // per-day accumulators
  let dayDerived: DerivedEvent[] = [];
  let minCash = state.wallet.cash;
  let heartsAtCh3: number | null = null;
  const dispatch = (ev: InputEvent): DerivedEvent[] => {
    const r = reduce(state, ev, { pack, now: BASE_DAY(today - 1), view: view(), rng: ctxRng });
    state = r.state;
    dayDerived.push(...r.derived);
    // a chapter's day is the day it COMPLETED (its reward lands), whatever the start gate of the next one does
    for (const e of r.derived) {
      if (e.t !== 'chapter_done') continue;
      S.chDay.push(today);
      if (e.n === 3) heartsAtCh3 = Object.values(state.friends).filter((f) => heartsForAp(f.ap) >= 2).length;
    }
    minCash = Math.min(minCash, state.wallet.cash);
    return r.derived;
  };

  let n = 0; // unique ids
  const uid = (p: string): string => `${p}${(n += 1)}`;
  let wordN = 0;
  const S = { minutes: 0, act: 0, conv: 0, shifts: 0, chDay: [] as number[], chAtStart: 1, phoneDay: null as number | null, done: new Set<string>(), lang3160: 0, lastChapter: 1 };
  const queues = Object.fromEntries(Object.keys(DREAMS_REF).map((k) => [k, { cash: pack.economy.startCash, idx: 0, done: null as number | null }]));
  const incomeDays: number[] = [];
  const langPerDay: number[] = [];
  const comp = { conv: 0, mastery: 0, shift: 0, goals: 0, chapter: 0 };
  let activeDays = 0;
  const counts30 = { obj: 0, free: 0, shifts: 0, talks: 0 };
  const spend = { practice: 0, gifts: 0, goals: 0 };

  const pAt = (m: number): number => Math.min(P.pMax, P.p0 + 0.72 * (1 - Math.exp(-m / 300)));
  const ch = (): number => state.chapter.n;
  const need = (): (typeof CH)[number] => CH[Math.min(ch(), 8) - 1]!;
  const ap = (i: number): number => state.friends[`f${i}`]?.ap ?? 0;
  const hasPhone = (): boolean => (state.owned[ITEMS.phone.id]?.qty ?? 0) > 0;
  const mul = P.sessionMul ?? 1;
  const objSessions = (): number => Math.ceil(need().sessions * mul);

  /** The persona's own counter of objective conversations in the current chapter restarts when a chapter starts. */
  const observeChapter = (): void => {
    while (state.chapter.n > S.lastChapter) {
      S.lastChapter += 1;
      S.act = 0;
    }
  };

  /**
   * A conversation's facts: 20 substantive turns, `floor(20p + u)` of them independent (u random, so the mean is the model's p), the
   * rest tapped suggestions. The independent turns say `round(8p)` distinct intents (the model's `distinct`), of which `round(5p)` are
   * first uses that pay; the others are recalled lines (`copied`), class I but not a first independent use. A scenario played before
   * has no first uses.
   */
  const converse = (scenarioId: string, p: number, o: { fresh: boolean; prepared: boolean; mode?: 'guided' | 'real'; characterId?: string }): ConversationFacts => {
    const N = 20;
    const I = Math.min(N, Math.floor(N * p + rnd()));
    const distinct = Math.max(1, Math.min(8, Math.round(8 * p)));
    const newIntents = o.fresh ? Math.min(distinct, Math.round(5 * p)) : 0;
    const r = I / N + 0.35 * (1 - I / N);
    const turns: TurnFacts[] = Array.from({ length: N }, (_, k): TurnFacts => {
      const independent = k < I;
      const j = k % distinct;
      return {
        id: k,
        cls: independent ? 'I' : 'S',
        credit: independent ? 1 : 0.35,
        substantive: true,
        contentTokens: 3,
        ...(independent ? { intentId: `i${j}`, newWords: [`w${(wordN += 1)}`], ...(j >= newIntents ? { copied: true } : {}) } : { newWords: [] }),
        stepIds: [`s${k % 4}`],
        norm: `${scenarioId}${k}`,
      };
    });
    return {
      sessionId: uid('c'),
      scenarioId,
      characterId: o.characterId ?? 'npc',
      mode: o.mode ?? 'guided',
      abandoned: false,
      durationSec: 360,
      goalDone: 4,
      goalTotal: 4,
      turns,
      // the model's 0.95 "clean" factor: one fallback in 60% of the conversations
      fallbacks: rnd() < 0.6 ? 1 : 0,
      hintUses: 0,
      accuracy: r >= 0.8 && p >= 0.75 ? 90 : 60,
      requestsPolite: true,
      prepared: o.prepared,
      remembered: {},
    };
  };

  const practiceSpend = (): void => {
    if (rnd() < 0.5) {
      if (today <= 40) spend.practice += 450;
      dispatch({ t: 'purchase', sessionId: uid('p'), n: 1, shopId: 'konbini', itemId: MENU_COFFEE, qty: 1, total: 450, method: 'cash', lines: [] });
    }
  };

  const conv = (objective: boolean): void => {
    const p = pAt(S.minutes);
    const band = ch() >= 4 ? 'A2' : 'A1';
    let id: string;
    if (objective) id = `o${ch()}_${S.act}`;
    else if (P.post === 'repeat' && ch() > 8) id = 'rep';
    else id = `f${(S.conv = S.conv + 1) % (4 + 3 * Math.min(ch(), 8))}`;
    const m = pack.scenarioMeta.find((x) => x.id === id)!;
    // free conversations are played at whatever band the player is at now (the model's `band` is per play)
    m.band = band;
    if (today <= 30) counts30[objective ? 'obj' : 'free'] += 1;
    const fresh = !S.done.has(id);
    S.done.add(id);
    const prepared = rnd() < P.prep;
    const facts = converse(id, p, { fresh, prepared });
    dispatch({ t: 'conversation_done', facts });
    // the debrief's hidden-line Say-it: two echoes pay for a full-echo persona, one for a half-echo one
    for (let k = 0; k < Math.round(2 * P.echo); k++) dispatch({ t: 'echo', sessionId: facts.sessionId, lineId: `l${(n += 1)}`, similarity: 0.9 });
    practiceSpend();
    if (objective) S.act += 1;
  };

  const shift = (): void => {
    if (today <= 30) counts30.shifts += 1;
    const p = pAt(S.minutes);
    const job = ch() >= 5 && S.shifts % 3 === 2 ? 'job_station' : ch() >= 3 && S.shifts % 2 === 1 ? 'job_cafe' : 'job_konbini';
    const ticks = 0.7 + 0.3 * p;
    const wrong = 15 - Math.round(15 * ticks);
    const typed = Math.min(10, Math.floor(10 * p + rnd()));
    let t = 0;
    const customers: ShiftResult['customers'] = Array.from({ length: 5 }, (_, i) => {
      const input = (k: number): 'typed' | 'tiles' | 'pick' => (k < typed ? 'typed' : k % 2 ? 'tiles' : 'pick');
      return {
        templateId: `t${i}`,
        served: true,
        assist: 'none' as const,
        tasks: [
          { kind: 'order' as const, ok: i >= wrong },
          { kind: 'total' as const, ok: true, input: input(t++) },
          { kind: 'thanks' as const, ok: true, input: input(t++) },
        ],
      };
    });
    const before = state.jobs[job]?.shifts ?? 0;
    dispatch({ t: 'shift_done', jobId: job, result: { id: uid('sh'), jobId: job, customers, quit: false, durationSec: 240, assistWaived: true } });
    if ((state.jobs[job]?.shifts ?? 0) > before) S.shifts += 1;
  };

  const talk = (): void => {
    if (today <= 30) counts30.talks += 1;
    const f = [0, 1, 2, 3, 4].find((i) => ap(i) < 80) ?? (ap(0) < 240 ? 0 : 1);
    const id = `f${f}`;
    const turns: TurnFacts[] = [0, 1, 2].map((k) => ({ id: k, cls: 'I' as const, credit: 1, substantive: true, contentTokens: 3, stepIds: [], norm: `talk${k}`, newWords: [] }));
    // two remembered facts and a callback to each: a 15-AP talk (5 + share 4 + callbacks 6, the cap of a talk)
    dispatch({ t: 'conversation_done', facts: { sessionId: uid('t'), scenarioId: `talk_${id}`, characterId: id, mode: 'guided', abandoned: false, durationSec: 180, goalDone: 3, goalTotal: 3, turns, fallbacks: 0, hintUses: 0, accuracy: null, requestsPolite: true, prepared: false, remembered: { hobby: 'anime', food: 'ramen' }, callbacks: ['hobby', 'food'] } });
    // a gift that fits the heart level (the model's gift AP is the cap of the level: 12 / 20 / 28 / 30):
    // 300 yen for no heart yet, 1,000 for one heart, 1,500 from two; bought and given only with twice its price in the wallet
    const hearts = heartsForAp(ap(f));
    // the dearer gifts only while a chapter still needs hearts, and not while the phone is still to be saved for
    const dear = heartsNeeded() && hasPhone();
    const tier = hearts === 0 || !dear ? GIFT_TIERS[0] : hearts === 1 ? GIFT_TIERS[1] : GIFT_TIERS[2];
    const recent = state.friends[id]?.giftHistory ?? [];
    const gift = giftsOf(tier).find((x) => !recent.some((h) => h.item === x.id && state.clock.dayIndex - h.day < 7)) ?? giftsOf(tier)[0]!;
    if (state.wallet.cash > 2 * gift.price) {
      if (today <= 40) spend.gifts += gift.price;
      dispatch({ t: 'purchase', sessionId: uid('g'), n: 1, shopId: 'aiko', itemId: gift.id, qty: 1, total: gift.price, method: 'cash', lines: [] });
      dispatch({ t: 'gift_given', friendId: id, itemId: gift.id, sessionId: uid('gift'), assistedHandover: false });
    }
  };

  const chatsToday = new Set<string>();
  const chatCandidates = (): string[] => [0, 1, 2, 3, 4].map((i) => `f${i}`).filter((id) => (state.friends[id]?.ap ?? 0) >= 80 && (state.friends[id]?.threads.length ?? 0) > 0 && !chatsToday.has(id));
  const chat = (): boolean => {
    const id = chatCandidates()[0];
    if (!id) return false;
    chatsToday.add(id);
    const template = state.friends[id]!.threads[0]!.template;
    const turns: TurnFacts[] = [0, 1].map((k) => ({ id: k, cls: 'I' as const, credit: 1, substantive: true, contentTokens: 3, stepIds: [], norm: `chat${k}`, newWords: [] }));
    dispatch({ t: 'phone_chat_done', friendId: id, sessionId: uid('ch'), facts: { sessionId: uid('cf'), scenarioId: template, characterId: id, mode: 'guided', abandoned: false, durationSec: 90, goalDone: 1, goalTotal: 1, turns, fallbacks: 0, hintUses: 0, accuracy: null, requestsPolite: true, prepared: false, remembered: {} } });
    return true;
  };

  const heartsNeeded = (): boolean => {
    const c = need();
    if (ch() > 8) return false;
    const have = (a: number): number => [0, 1, 2, 3, 4].filter((i) => ap(i) >= a).length;
    return ('friends2' in c && have(80) < c.friends2) || ('heart4' in c && have(240) < 1);
  };

  const buyPhone = (): void => {
    if (!hasPhone() && ch() >= 4 && state.wallet.cash >= ITEMS.phone.price) {
      dispatch({ t: 'purchase', sessionId: uid('ph'), n: 1, shopId: 'denki', itemId: ITEMS.phone.id, qty: 1, total: ITEMS.phone.price, method: 'cash', lines: [] });
      if (hasPhone()) {
        S.phoneDay = today;
        catalogSpendDay += ITEMS.phone.price;
      }
    }
  };
  let catalogSpendDay = 0;

  /** Finishes the day's goals the cheap way (the model assumes every active day earns them). */
  const finishGoals = (): void => {
    const drill = (scenarioId: string, lines: number, intents: string[] = []): void => {
      const turns: TurnFacts[] = Array.from({ length: Math.max(lines, 3) }, (_, k) => ({ id: k, cls: 'I' as const, credit: 1, substantive: true, contentTokens: 3, stepIds: [], norm: `${scenarioId}${uid('d')}`, newWords: [], intentId: intents[k] ?? `d${k}` }));
      dispatch({ t: 'conversation_done', facts: { sessionId: uid('dr'), scenarioId, characterId: 'npc', mode: 'guided', abandoned: false, durationSec: 60, goalDone: 3, goalTotal: 3, turns, fallbacks: 0, hintUses: 0, accuracy: null, requestsPolite: true, prepared: false, remembered: {} } });
    };
    for (let round = 0; round < 3; round++) {
      const open = [...state.daily.goals, ...state.daily.carried].filter((x) => !x.done);
      if (open.length === 0) return;
      for (const goal of open) {
        switch (goal.counter) {
          case 'conv_distinct':
          case 'places_distinct':
            drill('drill_a', 3);
            drill('drill_b', 3);
            break;
          case 'indep_lines':
            drill('drill_a', 6);
            break;
          case 'new_intents':
            drill('drill_a', 3, [uid('n'), uid('n'), uid('n')]);
            break;
          case 'purchase':
            if (today <= 40) spend.goals += 160;
            dispatch({ t: 'purchase', sessionId: uid('gb'), n: 1, shopId: 'konbini', itemId: MENU_ONIGIRI, qty: 1, total: 160, method: 'cash', lines: [] });
            break;
          case 'review_checked':
            dispatch({ t: 'srs_review', keys: Array.from({ length: 8 }, (_, k) => `k${k}`), due: 8 });
            break;
          case 'lesson':
            dispatch({ t: 'lesson_done', id: 'greetings' });
            break;
          default:
            break;
        }
      }
    }
  };

  for (let d = 1; d <= days; d++) {
    today = d;
    dayDerived = [];
    catalogSpendDay = 0;
    chatsToday.clear();
    const earnedBefore = state.totals.earned;
    const spentBefore = state.totals.spent;
    let minutes = d === 1 ? P.first : P.min;
    if (P.skip && (d % 7 === 0 || (P.skip > 1 && d % 7 === 3))) minutes = 0;
    if (minutes > 0) {
      streak += 1;
      activeDays += 1;
      dispatch({ t: 'day_observed', nowMs: BASE_DAY(d - 1) });
    } else streak = 0;
    let budget = Math.max(0, minutes - 2);
    S.minutes += minutes;
    let shiftsToday = 0;
    let talksToday = 0;
    const talkCap = personaName === 'light' ? (rnd() < 0.5 ? 1 : 0) : P.talks;
    let guard = 0;
    while (budget >= 1.5 && guard++ < 60) {
      buyPhone();
      observeChapter();
      const objLeft = ch() <= 8 && S.act < objSessions();
      const convCost = ch() >= 4 ? 8 : 6;
      const wantShift = ch() >= 2 && shiftsToday < P.shifts;
      const canTalk = ch() >= 3 && talksToday < talkCap && budget >= 3;
      const canChat = hasPhone() && budget >= 1.5 && chatCandidates().length > 0;
      const order = heartsNeeded() ? ['talk', 'chat', 'obj', 'shift', 'free'] : ch() > 8 ? ['free', 'talk', 'chat', 'shift'] : ['obj', 'chat', 'talk', 'shift', 'free'];
      let did = false;
      for (const t of order) {
        if (t === 'talk' && canTalk) {
          talk();
          talksToday++;
          budget -= 3;
          did = true;
        } else if (t === 'chat' && canChat && chat()) {
          budget -= 1.5;
          did = true;
        } else if (t === 'obj' && objLeft && budget >= convCost) {
          conv(true);
          budget -= convCost;
          did = true;
        } else if (t === 'shift' && wantShift && budget >= 4) {
          shift();
          shiftsToday++;
          budget -= 4;
          did = true;
        } else if (t === 'free' && !(P.post === 'shift' && ch() > 8) && budget >= convCost) {
          conv(false);
          budget -= convCost;
          did = true;
        }
        if (did) break;
      }
      if (!did) break;
    }
    if (minutes > 0) finishGoals();
    buyPhone();
    observeChapter();

    // the day's books
    const income = state.totals.earned - earnedBefore;
    const spent = state.totals.spent - spentBefore - catalogSpendDay;
    incomeDays.push(income);
    let lang = 0;
    for (const e of dayDerived) {
      if (e.t !== 'wallet_changed' || e.delta <= 0) continue;
      if (LANG_KINDS.has(e.kind)) lang += e.delta;
      if (d <= 30) {
        if (e.kind === 'loop') comp.conv += e.delta;
        else if (MASTERY_KINDS.has(e.kind)) comp.mastery += e.delta;
        else if (e.kind === 'shift') comp.shift += e.delta;
        else if (e.kind === 'goal' || e.kind === 'streak') comp.goals += e.delta;
        else if (e.kind === 'chapter') comp.chapter += e.delta;
      }
    }
    langPerDay.push(lang);
    if (d >= 31 && d <= 60) S.lang3160 += lang;
    for (const [k, w] of Object.entries(queues)) {
      w.cash += income - spent;
      const list = DREAMS_REF[k]!;
      while (w.idx < list.length) {
        const def = ITEMS[list[w.idx]!];
        if (ch() < def.gate || w.cash < def.price) break;
        w.cash -= def.price;
        w.idx++;
      }
      if (w.idx >= list.length && w.done === null) w.done = d;
    }
  }
  const total30 = incomeDays.slice(0, 30).reduce((a, b) => a + b, 0);
  return {
    persona: personaName,
    chDay: S.chDay,
    phoneDay: S.phoneDay,
    dreams: Object.fromEntries(Object.entries(queues).map(([k, q]) => [k, q.done])),
    total30,
    perDay30: Math.round(total30 / 30),
    comp,
    lang3160: S.lang3160,
    langPerDay,
    minCash,
    reconciles: reconcile(state, pack.economy.startCash).ok,
    finalChapter: state.chapter.n,
    state,
    activeDays,
    counts30,
    spend,
    heartsAtCh3,
  };
}

const med = (xs: Array<number | null | undefined>): number | null => {
  const a = xs.filter((x): x is number => x != null).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)]! : null;
};

export interface SimMedians {
  persona: string;
  chDay: Array<number | null>;
  phoneDay: number | null;
  dreams: Record<string, number | null>;
  perDay30: number;
  lang3160: number;
  total30: number;
  comp: SimResult['comp'];
  runs: SimResult[];
}

/** Medians over `n` seeded runs (seeds 1..n), like the reference model's `runMany`. */
export function runMany(personaName: string, n: number, days: number): SimMedians {
  const runs = Array.from({ length: n }, (_, i) => simulate(personaName, days, i + 1));
  const mean = (f: (r: SimResult) => number): number => Math.round(runs.reduce((a, r) => a + f(r), 0) / n);
  return {
    persona: personaName,
    chDay: Array.from({ length: 8 }, (_, i) => med(runs.map((r) => r.chDay[i]))),
    phoneDay: med(runs.map((r) => r.phoneDay)),
    dreams: Object.fromEntries(Object.keys(DREAMS_REF).map((k) => [k, med(runs.map((r) => r.dreams[k]))])),
    perDay30: mean((r) => r.perDay30),
    lang3160: mean((r) => r.lang3160),
    total30: mean((r) => r.total30),
    comp: { conv: mean((r) => r.comp.conv), mastery: mean((r) => r.comp.mastery), shift: mean((r) => r.comp.shift), goals: mean((r) => r.comp.goals), chapter: mean((r) => r.comp.chapter) },
    runs,
  };
}
