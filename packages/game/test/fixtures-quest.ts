// Shared fixtures of the quest tests (agent 1D): a small synthetic pack (five chapters, dreams, the ten daily templates) and a
// hand-built GameState / GameView. The full JP pack is authored later (slice 2); nothing here imports content.
import { BALANCE } from '../src/balance';
import { ECON, JPY, RULES, TAX, rng } from './fixtures-money';
import type {
  ChapterDef,
  DailyTemplate,
  DreamDef,
  FriendDef,
  GamePack,
  GameState,
  GameView,
  ItemDef,
  JobDef,
  Objective,
  Pred,
  RunRecord,
  ScenarioMeta,
  ShopDef,
} from '../src/types';

export { BALANCE, rng, JPY, ECON };

const g = (en: string): { en: string; ar: string } => ({ en, ar: `ar:${en}` });
const name = (en: string) => ({ ja: en, en, ar: `ar:${en}` });

const item = (id: string, price: number, shop: string, ch: number, extra: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name: name(id),
  price,
  cat: 'electronics',
  shop,
  gate: { ch },
  fx: [],
  tags: [],
  ...extra,
});

export const ITEMS: ItemDef[] = [
  item('phone_used', 24_800, 'denki', 4, { tags: ['phone'], fx: [{ t: 'feature', id: 'phone' }], once: true }),
  item('phone_pro', 128_000, 'denki', 5, { tags: ['phone'], fx: [{ t: 'feature', id: 'phone' }], once: true }),
  item('phone_case', 1_200, 'denki', 4, { tags: ['phone_accessory'] }),
  item('bike_mamachari', 19_800, 'motors', 5, { cat: 'transport', tags: ['bicycle'], once: true }),
  item('bike_helmet', 2_600, 'motors', 5, { cat: 'transport' }),
  item('home_room_ono', 60_000, 'aiko', 5, { cat: 'home', tags: ['flat'], once: true }),
  item('yukata', 8_000, 'fuku', 4, { cat: 'clothing', tags: ['yukata'] }),
  item('futon_set', 12_800, 'fuku', 5, { cat: 'home', bulky: true }),
  item('plant_pothos', 1_500, 'fuku', 5, { cat: 'home' }),
  item('paper_lamp', 2_200, 'fuku', 5, { cat: 'home' }),
  item('mug_set', 3_000, 'fuku', 5, { cat: 'home' }),
  item('rug_small', 3_500, 'fuku', 5, { cat: 'home' }),
  item('car_kei_used', 198_000, 'motors', 9, { cat: 'transport', tags: ['car'], once: true, gate: { ch: 9, ageMin: 18 } }),
];

const shop = (id: string, openChapter: number): ShopDef => ({ id, placeId: `place_${id}`, name: { en: id, ar: id }, openChapter, surface: 'world', register: 'polite', pay: ['cash'], sells: [] });
export const SHOPS: ShopDef[] = [shop('konbini', 1), shop('cafe', 1), shop('ramen', 2), shop('fuku', 2), shop('aiko', 2), shop('denki', 4), shop('motors', 5), { ...shop('vending', 1), surface: 'panel' }];

const friend = (id: string, unlockChapter: number, extra: Partial<FriendDef> = {}): FriendDef => ({
  id,
  tier: 'A',
  register: 'polite',
  casualAt: 99,
  unlockChapter,
  loves: [],
  likes: [],
  dislikes: [],
  facts: ['a', 'b', 'c'],
  perks: [],
  ...extra,
});
export const FRIENDS: FriendDef[] = [
  friend('tanaka', 1),
  friend('mio', 1, { home: { stage: 'mio', door: 'mio' } }),
  friend('aiko', 2, { home: { stage: 'aiko', door: 'aiko' } }),
  friend('nakamura', 5),
];

export const JOBS: JobDef[] = [
  { id: 'job_konbini', place: 'place_konbini', boss: 'tanaka', name: g('konbini'), wage: 1150, hours: 0.75, unlock: { k: 'all', of: [] }, archetypes: [], vocabTags: [], bonus: { itemId: 'onigiri', needsPerfect: true } },
];

const meta = (id: string, extra: Partial<ScenarioMeta> = {}): ScenarioMeta => ({ id, kind: 'talk', band: 'A1', register: 'polite', pay: 'full', ...extra });
export const SCENARIOS: ScenarioMeta[] = [
  meta('konbini', { kind: 'shop', shop: { shopId: 'konbini', payStep: 'pay', itemMap: {} } }),
  meta('cafe', { kind: 'shop', shop: { shopId: 'cafe', payStep: 'pay', itemMap: {} } }),
  meta('ramen', { kind: 'shop', shop: { shopId: 'ramen', payStep: 'pay', itemMap: {} } }),
  meta('park', { place: 'place_park', friendId: 'mio' }),
  meta('sato_directions', { place: 'place_station' }),
  // gated on a friendship: opens with whatever opens the friend and the heart
  meta('aiko_viewing', { shop: { shopId: 'aiko', payStep: 'pay', itemMap: {} }, gate: { k: 'hearts', friend: 'aiko', atLeast: 1 } }),
  meta('motors_visit', { shop: { shopId: 'motors', payStep: 'pay', itemMap: {} } }),
  meta('chat_first', { kind: 'chat', pay: 'none' }),
];

const obj = (id: string, pred: Pred, extra: Partial<Objective> = {}): Objective => ({ id, pred, text: g(id), ...extra });
const dreamSlot = (n: number): Objective => ({ id: `c${n}_star`, pred: { k: 'all', of: [] }, text: g('dream step'), dream: true });

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1,
    title: name('First Hello'),
    minDays: 1,
    reward: 2_500,
    rewardTitle: 't_newcomer',
    rewardCulture: ['cc_irasshaimase', 'cc_bow'],
    opens: [{ kind: 'place', id: 'place_konbini' }, { kind: 'place', id: 'place_station' }, { kind: 'interaction', id: 'int_konbini' }],
    objectives: [
      obj('c1_1', { k: 'lesson', id: 'greetings' }, { pin: { place: 'school' } }),
      obj('c1_2', { k: 'scenario', id: 'konbini', complete: true }, { pin: { place: 'place_konbini' } }),
      obj('c1_3', { k: 'discover', n: 4 }),
      obj('c1_4', { k: 'words_saved', n: 5 }),
      obj('c1_5', { k: 'say_new', n: 3 }, { easier: { pred: { k: 'say_new', n: 2 }, afterTries: 3 } }),
      dreamSlot(1),
    ],
    beats: { open: 'b_ch1_open', close: 'b_ch1_close' },
  },
  {
    n: 2,
    title: name('Welcome'),
    minDays: 2,
    reward: 2_500,
    rewardCulture: ['cc_notip'],
    opens: [{ kind: 'job', id: 'job_konbini' }, { kind: 'shop', id: 'ramen' }, { kind: 'place', id: 'place_ramen' }],
    objectives: [
      obj('c2_1', { k: 'scenario', id: 'cafe', minIndependent: 2 }, { pin: { place: 'place_cafe' }, easier: { pred: { k: 'scenario', id: 'cafe', minIndependent: 1 }, afterTries: 3 } }),
      obj('c2_2', { k: 'scenario', id: 'ramen', complete: true }, { pin: { place: 'place_ramen' } }),
      obj('c2_3', { k: 'shift', job: 'job_konbini', n: 1, minAcc: 0.6 }),
      obj('c2_4', { k: 'culture_said', n: 2 }),
      dreamSlot(2),
    ],
    beats: { open: 'b_ch2_open', close: 'b_ch2_close' },
  },
  {
    n: 3,
    title: name('First Friend'),
    minDays: 4,
    reward: 3_000,
    rewardTitle: 't_friend',
    opens: [{ kind: 'feature', id: 'gift' }],
    objectives: [
      obj('c3_1', { k: 'scenario', id: 'park', minIndependent: 4 }, { easier: { pred: { k: 'scenario', id: 'park', minIndependent: 2 }, afterTries: 3 } }),
      obj('c3_2', { k: 'hearts', friend: 'mio', atLeast: 2 }, { pin: { friend: 'mio' } }),
      obj('c3_3', { k: 'gift', n: 1 }),
      obj('c3_4', { k: 'hearts_count', atLeast: 2, n: 2 }),
      dreamSlot(3),
    ],
    beats: { open: 'b_ch3_open', close: 'b_ch3_close' },
  },
  {
    n: 4,
    title: name('Stay Connected'),
    minDays: 7,
    reward: 4_000,
    opens: [{ kind: 'shop', id: 'denki' }],
    catchUp: { afterActiveDays: BALANCE.catchUp.afterActiveDays, item: 'phone_used', maxYen: BALANCE.catchUp.max },
    objectives: [
      obj('c4_1', { k: 'own', category: 'phone' }, { pin: { place: 'place_denki' } }),
      obj('c4_2', { k: 'phone_chat', n: 1 }),
      obj('c4_3', { k: 'phone_chat', n: 4, friends: 2 }),
      obj('c4_4', { k: 'words_known', n: 25 }),
      dreamSlot(4),
    ],
    beats: { open: 'b_ch4_open', close: 'b_ch4_close' },
  },
  {
    n: 5,
    title: name('Let us Go Out'),
    minDays: 10,
    reward: 5_000,
    startGate: { k: 'hearts_count', atLeast: 3, n: 1 },
    opens: [{ kind: 'interaction', id: 'int_trip_hikarigaoka' }, { kind: 'interaction', id: 'int_visit_home' }, { kind: 'job', id: 'job_station' }],
    objectives: [
      obj('c5_1', { k: 'visit', place: 'trip:hikarigaoka' }),
      obj('c5_2', { k: 'scenario', id: 'sato_directions', minIndependent: 3 }, { easier: { pred: { k: 'scenario', id: 'sato_directions', minIndependent: 2 }, afterTries: 3 } }),
      obj('c5_3', { k: 'shift', n: 2 }),
      dreamSlot(5),
    ],
    beats: { open: 'b_ch5_open', close: 'b_ch5_close' },
  },
];

const step = (id: string, gate: number, pred: Pred): DreamDef['steps'][number] => ({ id, gate, pred, text: g(id) });
const dream = (id: string, extra: Partial<DreamDef> & Pick<DreamDef, 'steps' | 'items'>): DreamDef => ({
  id,
  name: name(id),
  horizon: 'short',
  title: `t_dream_${id}`,
  beat: `b_dream_${id}`,
  sticker: `st_${id}`,
  ...extra,
});

export const DREAMS: DreamDef[] = [
  dream('phone_pal', {
    items: ['phone_used'],
    defaultFor: ['work'],
    keepsake: 'k_phone',
    steps: [
      step('pp_s1', 2, { k: 'words_known', tag: 'numbers', n: 2 }),
      step('pp_s2', 3, { k: 'hearts', friend: 'tanaka', atLeast: 1 }),
      step('pp_s3', 4, { k: 'own', category: 'phone' }),
      step('pp_s4', 4, { k: 'phone_chat', n: 3, friends: 2 }),
    ],
  }),
  dream('bike', {
    items: ['bike_mamachari', 'bike_helmet'],
    steps: [step('bk_s1', 2, { k: 'words_known', tag: 'direction', n: 1 }), step('bk_s2', 3, { k: 'scenario', id: 'sato_directions', minIndependent: 2 }), step('bk_s3', 5, { k: 'own', category: 'bicycle' })],
  }),
  dream('flat', {
    ageMin: 18,
    horizon: 'long',
    items: ['home_room_ono'],
    furnish: 3,
    defaultFor: ['relocation'],
    steps: [step('fl_s1', 2, { k: 'hearts', friend: 'aiko', atLeast: 1 }), step('fl_s2', 3, { k: 'hearts', friend: 'aiko', atLeast: 2 }), step('fl_s3', 5, { k: 'own', item: 'home_room_ono' }), step('fl_s4', 5, { k: 'item_placed', n: 3 })],
  }),
  dream('festival', {
    horizon: 'medium',
    items: ['yukata'],
    defaultFor: ['casual'],
    steps: [step('fe_s1', 2, { k: 'hearts', friend: 'mio', atLeast: 1 }), step('fe_s2', 3, { k: 'hearts', friend: 'mio', atLeast: 2 }), step('fe_s3', 4, { k: 'own', item: 'yukata' })],
  }),
  dream('travel', { items: [], defaultFor: ['travel'], steps: [step('tr_s1', 2, { k: 'words_known', tag: 'transport', n: 1 }), step('tr_s2', 3, { k: 'lesson', id: 'ic' })] }),
  dream('fresh_start', {
    ageMin: 18,
    horizon: 'long',
    items: ['phone_used', 'bike_mamachari', 'home_room_ono'],
    furnish: 3,
    steps: [step('fs_s1', 4, { k: 'own', category: 'phone' }), step('fs_s2', 5, { k: 'own', category: 'bicycle' }), step('fs_s3', 5, { k: 'own', item: 'home_room_ono' })],
  }),
  dream('car', { ageMin: 18, openChapter: 9, horizon: 'epilogue', items: ['car_kei_used'], steps: [step('car_s1', 9, { k: 'wallet', atLeast: 198_000 }), step('car_s2', 9, { k: 'own', category: 'car' })] }),
];

const tpl = (id: string, slot: DailyTemplate['slot'], counter: DailyTemplate['counter'], target: number, requires?: DailyTemplate['requires'], extra: Partial<DailyTemplate> = {}): DailyTemplate => ({
  id,
  slot,
  counter,
  target,
  text: g(id),
  ...(requires ? { requires } : {}),
  ...extra,
});

/** The ten §7.4 templates. */
export const DAILY: DailyTemplate[] = [
  tpl('g_conv2', 'speak', 'conv_distinct', 2),
  tpl('g_indep6', 'speak', 'indep_lines', 6),
  tpl('g_newphrase2', 'speak', 'new_intents', 2),
  tpl('g_buy', 'do', 'purchase', 1, { chapter: 1 }),
  tpl('g_shift', 'do', 'shift_good', 1, { job: true }),
  tpl('g_friend', 'do', 'friend_contact', 1, { chapter: 3, friends: true }),
  tpl('g_place', 'do', 'places_distinct', 2),
  tpl('g_review8', 'review', 'review_checked', 8, { vocabCards: true }),
  tpl('g_lesson', 'review', 'lesson', 1),
  tpl('g_culture', 'review', 'culture_new', 1, { unseenCulture: true }),
];

const ageProfile = (ageFloor: number, dailyGoals: number) => ({ ageFloor, dailyGoals }) as unknown as GamePack['ageProfiles']['adults'];

/** A pack with five chapters; chapter 5 has a start gate (a ♥3 friend), so chapter 4 completes into a waiting state. */
export function mkQuestPack(over: Partial<GamePack> = {}): GamePack {
  return {
    schema: 1,
    id: 'jp',
    language: 'ja',
    district: 'sakura',
    name: g('Sakura'),
    currency: JPY,
    economy: ECON,
    tax: TAX,
    rules: RULES,
    menu: [],
    items: ITEMS,
    shops: SHOPS,
    fares: {},
    jobs: JOBS,
    chapters: CHAPTERS,
    dreams: DREAMS,
    daily: DAILY,
    beats: {},
    friends: FRIENDS,
    interactions: {
      tanaka: [{ id: 'int_konbini', label: g('Konbini'), kind: 'scenario', scenarioId: 'konbini' }],
      sato: [
        { id: 'int_trip_hikarigaoka', label: g('Trip to Hikarigaoka'), kind: 'trip', scenarioId: 'sato_directions' },
        { id: 'int_visit_home', label: g('Visit a home'), kind: 'visit' },
        { id: 'int_lesson', label: g('Lesson'), kind: 'lesson' },
      ],
      cafe: [{ id: 'int_cafe', label: g('Café'), kind: 'scenario', scenarioId: 'cafe' }],
    },
    scenarioMeta: SCENARIOS,
    pockets: {},
    wordTags: { numbers: ['一', '二', '三', '四', '五'], direction: ['右', '左'], transport: ['駅', '電車'], home: ['部屋'], car: ['車'] },
    culture: [
      { id: 'cc_irasshaimase', trigger: { on: 'shop_start' }, phrase: { ja: 'a', en: 'a', ar: 'a' }, text: g('a') },
      { id: 'cc_bow', trigger: { on: 'talk_start' }, phrase: { ja: 'a', en: 'a', ar: 'a' }, text: g('a') },
      { id: 'cc_notip', trigger: { on: 'payment' }, phrase: { ja: 'a', en: 'a', ar: 'a' }, text: g('a'), say: true },
      { id: 'cc_adult', trigger: { on: 'visit' }, phrase: { ja: 'a', en: 'a', ar: 'a' }, text: g('a'), adultOnly: true },
    ],
    titles: [],
    ageProfiles: { kids: ageProfile(6, 2), teens: ageProfile(13, 3), adults: ageProfile(18, 3), seniors: ageProfile(50, 3) },
    ...over,
  } as GamePack;
}

export function mkView(over: { age?: GameView['profile']['age']; goal?: string; streakDays?: number; due?: number; reviewed?: string[]; surfaces?: string[]; saved?: number; discovered?: string[]; lessons?: string[]; createdAt?: string } = {}): GameView {
  const reviewed = over.reviewed ?? [];
  return {
    vocab: {
      total: over.saved ?? 0,
      known: new Set<string>(),
      dueCount: over.due ?? 0,
      reviewedKeys: new Set(reviewed),
      reviewedSurfaces: new Set(over.surfaces ?? []),
    },
    discovered: over.discovered ?? [],
    lessonsDone: over.lessons ?? [],
    streakDays: over.streakDays ?? 0,
    profile: { age: over.age ?? 'adults', goal: over.goal ?? 'casual', level: 'A1', createdAt: over.createdAt ?? '2026-10-04' },
  };
}

/** A full GameState (createGameState is the reducer owner's); `cash` seeds the checksum like the real one. */
export function mkState(over: { cash?: number; chapter?: number; dayIndex?: number; activeDays?: number; began?: { dayIndex: number; activeDays: number } } = {}): GameState {
  const cash = over.cash ?? ECON.startCash;
  const dayIndex = over.dayIndex ?? 0;
  return {
    v: 1,
    packId: 'jp',
    clock: { dayIndex, lastLocalDate: '2026-10-04', lastSeenAt: 0, activeDays: over.activeDays ?? 0, lastActiveDay: -1 },
    wallet: { cash, ic: 0, points: 0 },
    totals: { earned: 0, spent: 0, checksum: { cash, ic: 0, points: 0 } },
    ledger: [],
    seen: [],
    pay: { day: `d${dayIndex}`, langToday: 0, firstPhraseToday: 0, echoToday: 0, echoSession: null, scenarioToday: {}, lastPaid: {}, shiftsToday: {}, seenIntents: [], pointsToday: 0, perkToday: 0, haggleToday: [], perkFreeToday: [] },
    runs: {},
    stats: { purchases: 0, spentOnPurchases: 0, gifts: { n: 0, liked: 0, loved: 0 }, chats: { n: 0, friends: {} }, hangouts: {}, visits: [], spots: [], tickets: 0, sayNew: 0, srsReviews: 0, cultureSaid: [], perksUsed: [], perkBuys: {} },
    owned: {},
    outfit: { equipped: [], colours: {} },
    home: { tier: 'dorm', placed: {} },
    tickets: {},
    chapter: { n: over.chapter ?? 1, done: {}, completed: [], flags: [], easier: [], tries: {}, began: over.began ?? { dayIndex: 0, activeDays: 0 } },
    dream: { id: null, steps: {}, done: false },
    daily: { day: dayIndex, goals: [], carried: [], counters: {}, sets: {}, swapUsed: false, allPaid: false, streakPaid: false, recent: [] },
    friends: {},
    jobs: {},
    prep: {},
    culture: {},
    titles: [],
    activeTitle: null,
    stickers: [],
    keepsakes: [],
    beats: [],
    words: { said: [] },
    diary: [],
    letter: [],
    income: [],
    coach: { recent: [], realFor: [], sinceChange: 0 },
    audio: { sttConsent: 'unset', micPref: 'auto', listenPref: 'on' },
    me: { nameKana: '' },
    flags: {},
    seeded: true,
  };
}

/** A friend entry at a given AP (hearts are derived from it). */
export const friendAt = (ap: number): GameState['friends'][string] => ({
  ap,
  met: ap > 0,
  apDay: 0,
  apToday: 0,
  chatApToday: 0,
  unread: 0,
  threads: [],
  chatRecent: [],
  facts: {},
  learned: [],
  gold: [],
  callbacks: {},
  topicDay: {},
  events: [],
  flags: [],
  giftHistory: [],
  gifts: 0,
  giftsLiked: 0,
  giftsLoved: 0,
});

/** AP that gives exactly `h` hearts. */
export const apFor = (h: number): number => (h <= 0 ? 0 : BALANCE.ap.thresholds[h - 1]);

export const ctxOf = (pack: GamePack, view: GameView, now = 1_700_000_000_000): { pack: GamePack; view: GameView; now: number; rng: () => number } => ({ pack, view, now, rng: rng(1) });

/** Marks every objective of a chapter done in the state's record, as `evaluateAll` would after ticking them. */
export function withDone(state: GameState, chapter: number, except: string[] = []): GameState {
  const def = CHAPTERS.find((c) => c.n === chapter);
  const done = { ...state.chapter.done };
  for (const o of def?.objectives ?? []) if (!o.dream && !except.includes(o.id)) done[o.id] = 'd0';
  return { ...state, chapter: { ...state.chapter, done } };
}

/** A played scenario's best-of record. */
export const mkRun = (over: Partial<RunRecord> = {}): RunRecord => ({ count: 1, complete: false, stars: 0, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [], ...over });
