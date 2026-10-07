// A small hand-built pack and state for the friends / gifts / inventory / shifts / integrity tests (agent 1E). Ids follow the design
// document (§5, §8.5, §9.3); only what those modules read is filled in. Not the Japan pack: @lw/game never imports @lw/content.
import { BALANCE, emptyPay } from '@lw/game';
import type { AgeProfile, ConversationFacts, FriendDef, GamePack, GameState, ItemDef, JobDef, MenuItem, ReduceCtx, ScenarioMeta, ShopDef } from '@lw/game';

const g = (en: string) => ({ en, ar: en });
const name = (en: string) => ({ ...g(en), ja: en });
const line = (ja: string, en = ja) => ({ ja, en, ar: en });

const shop = (id: string, surface: 'world' | 'panel' = 'world'): ShopDef => ({ id, placeId: id, name: g(id), openChapter: 1, surface, register: 'polite', pay: ['cash'], sells: [] });

const menu = (shopId: string, option: string, price: number, tags: string[], ja = option): MenuItem => ({
  id: `${shopId}:${option}`,
  shop: shopId,
  slot: 'item',
  option,
  name: name(ja),
  price,
  taxClass: 'food',
  tags,
});

const gift = (id: string, price: number, tags: string[], shopId = 'aiko'): ItemDef => ({
  id,
  name: name(id),
  price,
  cat: 'gift',
  shop: shopId,
  gate: { ch: 1 },
  fx: [{ t: 'gift', tags }],
  tags,
});

const ITEMS: ItemDef[] = [
  { id: 'phone_used', name: name('phone'), price: 24800, cat: 'electronics', shop: 'denki', gate: { ch: 4 }, fx: [{ t: 'feature', id: 'phone' }], tags: ['phone'], once: true },
  { id: 'ic_card', name: name('ic'), price: 500, cat: 'service', shop: 'station', gate: { ch: 1 }, fx: [{ t: 'feature', id: 'ic' }], tags: ['ic'], once: true },
  {
    id: 'tee_basic',
    name: name('tee'),
    price: 1990,
    cat: 'clothing',
    shop: 'fukufuku',
    gate: { ch: 2 },
    fx: [{ t: 'avatar', patch: { colours: ['#d8433f', '#4f86f7', '#ffffff'], pick: 'top' } }],
    tags: [],
    once: true,
  },
  {
    id: 'hoodie',
    name: name('hoodie'),
    price: 4990,
    cat: 'clothing',
    shop: 'fukufuku',
    gate: { ch: 2 },
    fx: [{ t: 'avatar', patch: { colours: ['#d8433f', '#4f86f7'], pick: 'top', lightenAccent: true } }],
    tags: [],
    once: true,
  },
  { id: 'jeans', name: name('jeans'), price: 5990, cat: 'clothing', shop: 'fukufuku', gate: { ch: 3 }, fx: [{ t: 'avatar', patch: { bottom: '#35507a', colours: ['#2f3a57', '#5a6b8c'], pick: 'bottom' } }], tags: [], once: true },
  { id: 'sneakers', name: name('sneakers'), price: 7990, cat: 'clothing', shop: 'fukufuku', gate: { ch: 3 }, fx: [{ t: 'avatar', patch: { shoes: '#ffffff', colours: ['#ffffff', '#2b2b36'], pick: 'shoes' } }], tags: [], once: true },
  { id: 'cap', name: name('cap'), price: 2490, cat: 'clothing', shop: 'fukufuku', gate: { ch: 2 }, fx: [{ t: 'avatar', patch: { accessory: 'cap' } }], tags: [], once: true },
  { id: 'jacket_winter', name: name('jacket'), price: 12900, cat: 'clothing', shop: 'fukufuku', gate: { ch: 4 }, fx: [{ t: 'avatar', patch: { top: '#2f5ea8', accessory: 'scarf' } }], tags: [], once: true },
  {
    id: 'yukata',
    name: name('yukata'),
    price: 8900,
    cat: 'clothing',
    shop: 'fukufuku',
    gate: { ch: 4 },
    fx: [{ t: 'avatar', patch: { top: '#3b4a8a', bottom: '#3b4a8a', shoes: '#8a5a3a', accent: '#f4f4f4' } }],
    tags: ['yukata'],
    once: true,
  },
  { id: 'glasses_round', name: name('glasses'), price: 9900, cat: 'clothing', shop: 'fukufuku', gate: { ch: 5 }, fx: [{ t: 'avatar', patch: { accessory: 'glasses' } }], tags: [], once: true },
  { id: 'bike_mamachari', name: name('bike'), price: 19800, cat: 'transport', shop: 'motors', gate: { ch: 5 }, fx: [{ t: 'ride', mul: 1.5, mesh: 'bike' }], tags: ['bicycle'], once: true },
  { id: 'ebike', name: name('ebike'), price: 89000, cat: 'transport', shop: 'motors', gate: { ch: 7, needs: ['bike_helmet'] }, fx: [{ t: 'ride', mul: 1.8, mesh: 'ebike' }], tags: ['bicycle'], once: true },
  { id: 'car_kei_used', name: name('car'), price: 198000, cat: 'transport', shop: 'motors', gate: { ch: 9, ageMin: 18 }, fx: [{ t: 'ride', mul: 2.5, mesh: 'car' }], tags: ['car'], body: 148000, once: true },
  { id: 'home_room_ono', name: name('flat'), price: 60000, cat: 'service', shop: 'aiko', gate: { ch: 6, ageMin: 18 }, fx: [{ t: 'homeTier', tier: 'ono' }], tags: ['flat'], once: true },
  { id: 'futon_set', name: name('futon'), price: 8000, cat: 'home', shop: 'fukufuku', gate: { ch: 5 }, fx: [{ t: 'home', slot: 'bed', comfort: 2 }], tags: [], bulky: true, once: true },
  { id: 'desk_study', name: name('desk'), price: 6000, cat: 'home', shop: 'fukufuku', gate: { ch: 5 }, fx: [{ t: 'home', slot: 'desk', comfort: 2 }], tags: [], bulky: true, once: true },
  { id: 'plant_pothos', name: name('plant'), price: 1200, cat: 'home', shop: 'fukufuku', gate: { ch: 5 }, fx: [{ t: 'home', slot: 'plant', comfort: 1 }], tags: [], once: true },
  {
    id: 'kotatsu',
    name: name('kotatsu'),
    price: 7000,
    cat: 'home',
    shop: 'fukufuku',
    gate: { ch: 6 },
    fx: [{ t: 'home', slot: 'table', comfort: 3 }, { t: 'trait', id: 'hangout_mult', value: 1.5 }],
    tags: [],
    bulky: true,
    once: true,
  },
  { id: 'tv_small', name: name('tv'), price: 24800, cat: 'home', shop: 'denki', gate: { ch: 6 }, fx: [{ t: 'home', slot: 'tv', comfort: 2 }], tags: [], bulky: true, once: true },
  { id: 'phone_case', name: name('case'), price: 1980, cat: 'electronics', shop: 'denki', gate: { ch: 4 }, fx: [{ t: 'cosmetic', id: 'phone_case' }], tags: [], once: true },
  gift('g_choco', 220, ['sweet', 'snack'], 'konbini'),
  gift('g_manga', 680, ['media', 'anime'], 'konbini'),
  gift('g_game_card', 1000, ['game', 'tech'], 'konbini'),
  gift('g_wagashi', 1280, ['sweet', 'tradition']),
  gift('g_tea_set', 1500, ['tea', 'tradition']),
  gift('g_tenugui', 1100, ['craft', 'tradition']),
  gift('g_plush', 800, ['cute'], 'fukufuku'),
  gift('g_music_cd', 3300, ['music'], 'denki'),
];

const MENU: MenuItem[] = [
  menu('konbini', 'onigiri', 160, ['food', 'snack'], 'おにぎり'),
  menu('konbini', 'bento', 520, ['food', 'meal'], 'お弁当'),
  menu('konbini', 'sandwich', 300, ['food', 'snack'], 'サンドイッチ'),
  menu('konbini', 'tea', 150, ['drink', 'tea'], 'お茶'),
  menu('cafe', 'coffee', 450, ['drink', 'coffee'], 'コーヒー'),
  menu('cafe', 'cake', 480, ['sweet'], 'ケーキ'),
  menu('cafe', 'greenTea', 400, ['drink', 'tea'], '緑茶'),
  { ...menu('vending', 'greenTea', 130, ['drink', 'tea'], '緑茶'), giftable: true },
];

const FRIENDS: FriendDef[] = [
  {
    id: 'mio',
    tier: 'A',
    register: 'casual',
    casualAt: 2,
    unlockChapter: 1,
    home: { stage: 'mio_1r', door: 'door:mio' },
    loves: ['g_manga', 'cake', 'g_souvenir'],
    likes: ['sweet', 'cute', 'media', 'music'],
    dislikes: ['coffee'],
    facts: ['likes_anime', 'photo_sakura', 'lives_alone'],
    perks: [{ id: 'mio_festival', heart: 5, text: g('festival partner'), fx: { t: 'cosmetic', id: 'festival_partner' } }],
    events: [{ heart: 2, beat: 'b_mio_note' }, { heart: 4, scenario: 'home_mio' }, { heart: 5, scenario: 'heart_mio' }],
  },
  {
    id: 'yuki',
    tier: 'A',
    register: 'polite',
    casualAt: 3,
    unlockChapter: 3,
    loves: ['g_tea_set', 'cake'],
    likes: ['sweet', 'music', 'flower'],
    dislikes: ['coffee', 'g_game_card'],
    facts: ['guitar', 'cat', 'dream_live'],
    perks: [],
    events: [{ heart: 4, beat: 'h4_yuki' }],
  },
  {
    id: 'tanaka',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    loves: ['g_game_card', 'coffee', 'g_manga'],
    likes: ['game', 'tech', 'sweet'],
    dislikes: ['onigiri', 'bento'],
    facts: ['games_night', 'sleepy', 'dream_game'],
    perks: [{ id: 'tanaka_konbini5', heart: 4, text: g('konbini -5%'), fx: { t: 'shop_pct', shopId: 'konbini', pct: 0.05 } }],
  },
  {
    id: 'hanako',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    loves: ['g_tea_set', 'g_wagashi', 'g_flower'],
    likes: ['tradition', 'flower', 'craft'],
    dislikes: ['g_choco', 'g_game_card'],
    facts: ['teach_songs', 'calligraphy', 'letters'],
    perks: [
      { id: 'hanako_gift3', heart: 3, text: g('a small gift'), fx: { t: 'once_item', itemId: 'g_wagashi' } },
      { id: 'hanako_scholarship', heart: 5, text: g('scholarship'), fx: { t: 'once_cash', amount: 3000 } },
    ],
  },
];

const SCENARIOS: ScenarioMeta[] = [
  ...['chat_first', 'chat_greet', 'chat_plan', 'chat_food', 'chat_miss', 'chat_voice', 'chat_teach', 'chat_callback', 'chat_invite_home'].map(
    (id): ScenarioMeta => ({ id, kind: 'chat', band: 'A1', register: 'casual', pay: 'none' }),
  ),
  { id: 'hang_mio_photo', kind: 'hangout', band: 'A2', register: 'casual', pay: 'none', friendId: 'mio', heart: 3 },
  { id: 'home_mio', kind: 'home', band: 'A2', register: 'polite', pay: 'none', friendId: 'mio', heart: 4 },
  { id: 'heart_mio', kind: 'heart', band: 'A2', register: 'casual', pay: 'none', friendId: 'mio', heart: 5 },
  { id: 'h4_yuki', kind: 'heart', band: 'A2', register: 'polite', pay: 'none', friendId: 'yuki', heart: 4 },
];

const customer = (id: string, tier: 1 | 2 | 3 | 4, minRank: 0 | 1 | 2 | 3 | 4, ja: string, items: Array<{ menu: string; qty: number }>): JobDef['archetypes'][number] => ({
  id,
  tier,
  minRank,
  line: line(ja),
  task: { kind: 'order', items },
  thanks: ['ありがとうございました'],
});

const JOBS: JobDef[] = [
  {
    id: 'job_konbini',
    place: 'konbini',
    boss: 'tanaka',
    name: g('Konbini'),
    wage: 1150,
    hours: 0.75,
    unlock: { k: 'flag', id: 'job_konbini' },
    archetypes: [
      customer('k_basic', 1, 0, 'おにぎりをふたつ、お願(ねが)いします。', [{ menu: 'konbini:onigiri', qty: 2 }]),
      customer('k_two', 2, 0, 'お茶(ちゃ)をひとつと、サンドイッチをみっつください。', [{ menu: 'konbini:tea', qty: 1 }, { menu: 'konbini:sandwich', qty: 3 }]),
      customer('k_heat', 3, 0, 'お弁当(べんとう)を温(あたた)めてください。', [{ menu: 'konbini:bento', qty: 1 }]),
      customer('k_change', 4, 2, '千円(せんえん)でお願(ねが)いします。', [{ menu: 'konbini:bento', qty: 1 }]),
      customer('k_tea2', 2, 0, 'お茶(ちゃ)をふたつください。', [{ menu: 'konbini:tea', qty: 2 }]),
    ],
    vocabTags: ['food'],
    bonus: { itemId: 'konbini:onigiri', needsPerfect: true },
  },
];

const ageProfile = (ageFloor: number): AgeProfile => ({
  dailyGoals: 3,
  pocketLines: 4,
  textScale: 1,
  minTapPx: 44,
  ttsRate: 1,
  echoThreshold: 0.6,
  ageFloor,
  voiceDefault: 'consent',
  adultGate: false,
  walletStyle: 'full',
  newCardsPerDay: 0,
  adultTopics: true,
});

export function makePack(): GamePack {
  return {
    schema: 1,
    id: 'test',
    language: 'ja',
    district: 'test',
    name: g('Test'),
    currency: { code: 'JPY', symbol: '¥', minorPerMajor: 1, symbolPlacement: 'prefix', groupSep: ',', decimalSep: '.', roundTo: 1, spoken: '円' },
    economy: { refWage: 1150, incomeScale: 1, startCash: 3000, icCap: { early: 3000, late: 20000 }, walletCap: 9999999, bigTicket: 50000 },
    tax: { inclusive: true, rates: { standard: 0.1, food: 0.08 } },
    rules: { negotiation: {}, haggling: false, shoesOff: true, tipping: 'none', deliveryFee: 2200 },
    lang: {
      readNumber: (n) => String(n),
      priceMarkup: (n, cur) => ({ markup: String(n), reading: String(n), gloss: { en: `${n} ${cur.code}`, ar: `${n} ${cur.code}` } }),
      parseNumbers: (text) => ({ text, numbers: [] }),
      speechNormalize: (t) => t,
      registerMarkers: { casual: { good: [], bad: [] }, polite: { good: [], bad: [] }, keigo: { good: [], bad: [] } },
    },
    menu: MENU,
    items: ITEMS,
    shops: [shop('konbini'), shop('cafe'), shop('vending', 'panel'), shop('fukufuku'), shop('denki'), shop('aiko'), shop('motors'), shop('station', 'panel')],
    fares: {},
    jobs: JOBS,
    chapters: [],
    dreams: [],
    daily: [],
    beats: {},
    friends: FRIENDS,
    interactions: {},
    scenarioMeta: SCENARIOS,
    pockets: {},
    wordTags: { food: ['おにぎり', 'お弁当'] },
    culture: [],
    titles: [],
    ageProfiles: { kids: ageProfile(6), teens: ageProfile(13), adults: ageProfile(18), seniors: ageProfile(60) },
  };
}

/** A mid-game state on `dayIndex`, with a clean wallet and empty slices (what `createGameState` would build, written out here). */
export function makeState(dayIndex = 10): GameState {
  return {
    v: 1,
    packId: 'test',
    clock: { dayIndex, lastLocalDate: '2026-10-04', lastSeenAt: 0, activeDays: 0, lastActiveDay: -1 },
    wallet: { cash: BALANCE.startCash, ic: 0, points: 0 },
    totals: { earned: 0, spent: 0, checksum: { cash: BALANCE.startCash, ic: 0, points: 0 } },
    ledger: [],
    seen: [],
    pay: emptyPay(`d${dayIndex}`),
    runs: {},
    stats: { purchases: 0, spentOnPurchases: 0, gifts: { n: 0, liked: 0, loved: 0 }, chats: { n: 0, friends: {} }, hangouts: {}, visits: [], spots: [], tickets: 0, sayNew: 0, srsReviews: 0, cultureSaid: [], perksUsed: [], perkBuys: {} },
    owned: {},
    outfit: { equipped: [], colours: {} },
    home: { tier: 'dorm', placed: {} },
    tickets: {},
    chapter: { n: 5, done: {}, completed: [], flags: [], easier: [], tries: {}, began: { dayIndex: 0, activeDays: 0 } },
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

/** A small seeded generator (mulberry32) for the property tests; consecutive seeds give unrelated streams. */
export function lcg(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ctxOf(pack: GamePack, o: { now?: number; seed?: number } = {}): ReduceCtx {
  return {
    pack,
    now: o.now ?? 1_800_000_000_000,
    view: {
      vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
      discovered: [],
      lessonsDone: [],
      streakDays: 0,
      profile: { age: 'adults', goal: 'fresh_start', level: 'A1', createdAt: '2026-10-01' },
    },
    rng: lcg(o.seed ?? 1),
  };
}

/** Facts of a finished conversation: `ind` independent and `ass` assisted substantive turns, `done` of `total` goal steps. */
export function makeFacts(o: Partial<ConversationFacts> & { ind?: number; ass?: number; done?: number; total?: number } = {}): ConversationFacts {
  const { ind = 3, ass = 0, done = 3, total = 3, ...rest } = o;
  const turn = (id: number, cls: 'I' | 'S'): ConversationFacts['turns'][number] => ({
    id,
    cls,
    credit: cls === 'I' ? 1 : 0.35,
    substantive: true,
    contentTokens: 3,
    stepIds: [],
    norm: 'x',
    newWords: [],
  });
  return {
    sessionId: 's1',
    scenarioId: 'smalltalk_mio',
    characterId: 'mio',
    mode: 'guided',
    abandoned: false,
    durationSec: 120,
    goalDone: done,
    goalTotal: total,
    turns: [...Array.from({ length: ind }, (_, i) => turn(i, 'I')), ...Array.from({ length: ass }, (_, i) => turn(ind + i, 'S'))],
    fallbacks: 0,
    hintUses: 0,
    accuracy: null,
    requestsPolite: true,
    prepared: false,
    remembered: {},
    ...rest,
  };
}
