// Shared fixtures of the reducer, persistence and validation tests (agent 1F): a small synthetic pack that is VALID at every
// validation level (so each test can break exactly one thing), plus builders for events and conversation facts.
// It is not the Japan pack (authored in slices 2-4) and imports nothing from content.
import { createGameState } from '../src/reducer';
import type {
  Beat,
  ChapterDef,
  ConversationFacts,
  ContentIndex,
  CultureCard,
  FriendDef,
  GamePack,
  GameState,
  GameView,
  ItemDef,
  JobDef,
  MenuItem,
  PocketLine,
  ReduceCtx,
  ScenarioMeta,
  ShopDef,
  TitleDef,
  TurnFacts,
} from '../src/types';
import { CHAPTERS, DAILY, DREAMS } from './fixtures-quest';
import { ECON, JPY, RULES, TAX, rng } from './fixtures-money';

export { rng };

/** Local noon of day `n` after 2030-01-15: `localDateString` of it is a distinct, ordered date for every n, in any time zone and across DST. */
export const dayAt = (n: number): number => new Date(2030, 0, 15 + n, 12, 0, 0).getTime();
export const NOW = dayAt(0);

const g = (en: string) => ({ en, ar: `ar:${en}` });
const name = (en: string) => ({ ja: en, en, ar: `ar:${en}` });
const line = (ja: string, en = ja) => ({ ja, en, ar: `ar:${en}` });

const shop = (id: string, sells: string[], extra: Partial<ShopDef> = {}): ShopDef => ({ id, placeId: `place_${id}`, name: g(id), openChapter: 1, surface: 'world', register: 'polite', pay: ['cash', 'ic', 'card'], sells, ...extra });

const menu = (shopId: string, option: string, price: number, extra: Partial<MenuItem> = {}): MenuItem => ({
  id: `${shopId}:${option}`,
  shop: shopId,
  slot: 'item',
  option,
  name: name(option),
  price,
  taxClass: 'food',
  tags: [],
  ...extra,
});

const item = (id: string, price: number, shopId: string, ch: number, extra: Partial<ItemDef> = {}): ItemDef => ({ id, name: name(id), price, cat: 'electronics', shop: shopId, gate: { ch }, fx: [], tags: [], ...extra });
const gift = (id: string, price: number, tags: string[], shopId: string): ItemDef => item(id, price, shopId, shopId === 'aiko' ? 2 : 1, { cat: 'gift', fx: [{ t: 'gift', tags }], tags });

const MENU: MenuItem[] = [
  menu('konbini', 'onigiri', 160, { tags: ['food', 'snack'] }),
  menu('konbini', 'coffee', 450, { eatInCapable: true, tags: ['drink'] }),
  menu('cafe', 'cake', 480, { tags: ['sweet'] }),
  menu('vending', 'greenTea', 130, { tags: ['drink', 'tea'] }),
];

const ITEMS: ItemDef[] = [
  item('ic_card', 500, 'station', 1, { cat: 'service', fx: [{ t: 'feature', id: 'ic' }], tags: ['ic'], once: true }),
  item('phone_used', 24_800, 'denki', 4, { fx: [{ t: 'feature', id: 'phone' }], tags: ['phone'], once: true, beat: 'b_phone_bought' }),
  item('bike_mamachari', 19_800, 'motors', 5, { cat: 'transport', fx: [{ t: 'ride', mul: 1.5, mesh: 'bike' }], tags: ['bicycle'], once: true }),
  item('bike_helmet', 2_980, 'motors', 5, { cat: 'transport', once: true }),
  // gate 5 (the quest fixture's dream ladders ask for the flat at chapter 5; the real pack opens it at 6)
  item('home_room_ono', 60_000, 'aiko', 5, { cat: 'home', fx: [{ t: 'homeTier', tier: 'ono' }], tags: ['flat'], once: true, gate: { ch: 5, ageMin: 18 } }),
  item('yukata', 8_900, 'fuku', 4, { cat: 'clothing', fx: [{ t: 'avatar', patch: { top: '#3b4a8a', bottom: '#3b4a8a' } }], tags: ['yukata'], once: true }),
  item('futon_set', 12_800, 'fuku', 5, { cat: 'home', fx: [{ t: 'home', slot: 'bed', comfort: 2 }], bulky: true, once: true }),
  item('plant_pothos', 1_200, 'fuku', 5, { cat: 'home', fx: [{ t: 'home', slot: 'plant', comfort: 1 }], once: true }),
  item('car_kei_used', 198_000, 'motors', 9, { cat: 'transport', fx: [{ t: 'ride', mul: 2.5, mesh: 'car' }], tags: ['car'], once: true, body: 148_000, gate: { ch: 9, ageMin: 18 } }),
  gift('g_flower', 480, ['flower'], 'aiko'),
  gift('g_wagashi', 1_280, ['sweet', 'tradition'], 'aiko'),
  gift('g_manga', 680, ['media'], 'konbini'),
];

const SHOPS: ShopDef[] = [
  shop('konbini', ['konbini:onigiri', 'konbini:coffee', 'g_manga'], { points: true }),
  shop('cafe', ['cafe:cake']),
  shop('vending', ['vending:greenTea'], { surface: 'panel' }),
  shop('station', ['ic_card'], { surface: 'panel' }),
  shop('ramen', [], { openChapter: 2 }),
  shop('fuku', ['yukata', 'futon_set', 'plant_pothos'], { openChapter: 2 }),
  shop('aiko', ['g_flower', 'g_wagashi', 'home_room_ono'], { openChapter: 2 }),
  shop('denki', ['phone_used'], { openChapter: 4, pay: ['cash', 'card'], points: true }),
  shop('motors', ['bike_mamachari', 'bike_helmet', 'car_kei_used'], { openChapter: 5 }),
];

const FRIENDS: FriendDef[] = [
  {
    id: 'mio',
    tier: 'A',
    register: 'casual',
    casualAt: 2,
    unlockChapter: 1,
    home: { stage: 'mio_1r', door: 'door:mio' },
    loves: ['g_manga', 'cake'],
    likes: ['sweet', 'media'],
    dislikes: ['coffee'],
    facts: ['likes_anime', 'photo_sakura', 'lives_alone'],
    perks: [{ id: 'mio_festival', heart: 5, text: g('festival partner'), fx: { t: 'cosmetic', id: 'festival_partner' } }],
    events: [{ heart: 2, beat: 'b_mio_h2' }],
  },
  {
    id: 'tanaka',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    loves: ['coffee', 'g_manga'],
    likes: ['sweet'],
    dislikes: ['onigiri'],
    facts: ['games_night', 'sleepy', 'dream_game'],
    perks: [{ id: 'tanaka_konbini5', heart: 4, text: g('konbini -5%'), fx: { t: 'shop_pct', shopId: 'konbini', pct: 0.05 } }],
  },
  {
    id: 'aiko',
    tier: 'A',
    register: 'polite',
    casualAt: 3,
    unlockChapter: 2,
    home: { stage: 'aiko_tatami', door: 'door:aiko' },
    loves: ['g_wagashi'],
    likes: ['tradition', 'flower'],
    dislikes: [],
    facts: ['tea', 'garden', 'letters'],
    perks: [
      { id: 'aiko_deposit', heart: 3, text: g('deposit -10000'), fx: { t: 'once_discount', itemIds: ['home_room_ono'], amount: 10_000 } },
      { id: 'aiko_gift3', heart: 3, text: g('a small gift'), fx: { t: 'once_item', itemId: 'g_wagashi' } },
    ],
  },
  {
    id: 'hanako',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    loves: ['g_wagashi'],
    likes: ['tradition'],
    dislikes: [],
    facts: ['songs', 'calligraphy', 'letters'],
    perks: [{ id: 'hanako_scholarship', heart: 5, text: g('scholarship'), fx: { t: 'once_cash', amount: 3_000 } }],
  },
];

const JOBS: JobDef[] = [
  {
    id: 'job_konbini',
    place: 'place_konbini',
    boss: 'tanaka',
    name: g('Konbini'),
    wage: 1_150,
    hours: 0.75,
    unlock: { k: 'all', of: [] },
    archetypes: ['k_a', 'k_b', 'k_c', 'k_d'].map((id, i) => ({
      id,
      tier: 1 as const,
      minRank: 0 as const,
      line: line(`${id}をください。`),
      task: { kind: 'order' as const, items: [{ menu: i % 2 ? 'konbini:coffee' : 'konbini:onigiri', qty: 1 + (i % 3) }] },
      thanks: ['ありがとうございました'],
    })),
    vocabTags: ['food'],
    bonus: { itemId: 'konbini:onigiri', needsPerfect: true },
  },
];

const meta = (id: string, extra: Partial<ScenarioMeta> = {}): ScenarioMeta => ({ id, kind: 'talk', band: 'A1', register: 'polite', pay: 'full', ...extra });
const sells = (shopId: string, itemMap: Record<string, string>, extra: Partial<NonNullable<ScenarioMeta['shop']>> = {}): ScenarioMeta['shop'] => ({ shopId, itemSlot: 'item', payStep: 'pay', itemMap, ...extra });

const SCENARIOS: ScenarioMeta[] = [
  meta('konbini', { kind: 'shop', shop: sells('konbini', { onigiri: 'konbini:onigiri', coffee: 'konbini:coffee' }, { extraSlots: ['giftItem'] }), pocket: ['p_konbini_1', 'p_konbini_2', 'p_konbini_3'], place: 'place_konbini' }),
  meta('cafe', { kind: 'shop', shop: sells('cafe', { cake: 'cafe:cake' }), place: 'place_cafe' }),
  meta('ramen', { kind: 'shop', shop: sells('ramen', {}, { fixedItem: undefined }), place: 'place_ramen', startNode: 'start_ticket' }),
  meta('goods_konbini', { kind: 'shop', shop: sells('konbini', { manga: 'g_manga' }, { itemSlot: 'giftItem' }) }),
  meta('aiko_tea', { kind: 'shop', shop: sells('aiko', { flower: 'g_flower', wagashi: 'g_wagashi' }, { itemSlot: 'giftItem' }) }),
  meta('aiko_viewing', { band: 'A2', gate: { k: 'hearts', friend: 'aiko', atLeast: 1 }, friendId: 'aiko', place: 'place_aiko' }),
  meta('aiko_contract', { band: 'A2', gate: { k: 'scenario', id: 'aiko_viewing', complete: true }, shop: { shopId: 'aiko', fixedItem: 'home_room_ono', payStep: 'pay', itemMap: {} }, friendId: 'aiko' }),
  meta('denki_phone', { band: 'A2', shop: sells('denki', { used: 'phone_used' }) }),
  meta('fuku_home', { band: 'A2', shop: sells('fuku', { yukata: 'yukata', futon: 'futon_set', plant: 'plant_pothos' }) }),
  meta('motors_bike', { band: 'A2', shop: sells('motors', { bike: 'bike_mamachari', helmet: 'bike_helmet' }) }),
  meta('motors_car', { band: 'A2', shop: sells('motors', { car: 'car_kei_used' }) }),
  meta('park', { place: 'place_park', friendId: 'mio' }),
  meta('sato_directions', { place: 'place_station' }),
  meta('smalltalk_mio', { kind: 'friend', pay: 'none', friendId: 'mio', register: 'casual' }),
  meta('hang_mio', { kind: 'hangout', pay: 'none', friendId: 'mio', heart: 3, register: 'casual' }),
  meta('home_mio', { kind: 'home', pay: 'none', friendId: 'mio', heart: 4 }),
  meta('heart_mio', { kind: 'heart', pay: 'none', friendId: 'mio', heart: 5, register: 'casual', effects: [{ t: 'flag', id: 'heart5_seen' }] }),
  meta('trip_hikarigaoka', { kind: 'trip', pay: 'none' }),
  meta('chat_first', { kind: 'chat', pay: 'none', register: 'casual' }),
  meta('chat_greet', { kind: 'chat', pay: 'none', register: 'casual' }),
  meta('chat_food', { kind: 'chat', pay: 'none', register: 'casual' }),
  meta('chat_plan', { kind: 'chat', pay: 'none', register: 'casual' }),
  meta('chat_miss', { kind: 'chat', pay: 'none', register: 'casual' }),
];

const POCKETS: Record<string, PocketLine> = Object.fromEntries(
  [
    { id: 'p_konbini_1', line: line('これをください。', 'This one, please.'), key: true as const },
    { id: 'p_konbini_2', line: line('いくらですか。', 'How much is it?'), key: true as const },
    { id: 'p_konbini_3', line: line('袋はいりません。', 'No bag.') },
  ].map((p) => [p.id, p]),
);

const CULTURE: CultureCard[] = [
  { id: 'cc_irasshaimase', trigger: { on: 'shop_start' }, phrase: line('いらっしゃいませ'), text: g('Staff greet you.') },
  { id: 'cc_bow', trigger: { on: 'talk_start', ids: ['hanako'] }, phrase: line('よろしく|お願|い|します'), text: g('A bow.'), say: true },
  { id: 'cc_notip', trigger: { on: 'payment', ids: ['cafe'] }, phrase: line('ありがとうございました'), text: g('No tipping.') },
  { id: 'cc_konbini', trigger: { on: 'scenario_done', ids: ['konbini'] }, phrase: line('温|めますか'), text: g('Konbini.') },
  { id: 'cc_vending', trigger: { on: 'machine', ids: ['vending'] }, phrase: line('あたたかい'), text: g('Vending.') },
  { id: 'cc_points', trigger: { on: 'purchase', ids: ['konbini'], n: 3 }, also: [{ on: 'perfect_shift', n: 3 }], phrase: line('ポイントカード'), text: g('Points.') },
  { id: 'cc_gift', trigger: { on: 'gift_given' }, phrase: line('これ、どうぞ'), text: g('Gifts.'), say: true },
  { id: 'cc_keigo', trigger: { on: 'casual_switch' }, phrase: line('タメ口でいい？'), text: g('Keigo.'), say: true },
  { id: 'cc_trainmanner', trigger: { on: 'ride' }, phrase: line('降ります'), text: g('Train manners.') },
  { id: 'cc_adult', trigger: { on: 'visit', ids: ['home:aiko'] }, phrase: line('敷金'), text: g('Deposit.'), adultOnly: true },
  { id: 'cc_irasshaimase2', trigger: { on: 'intent', ids: ['konbini:greet'] }, phrase: line('はい'), text: g('Intent.') },
];

const TITLES: TitleDef[] = [
  { id: 't_newcomer', name: name('Newcomer'), source: { kind: 'chapter', n: 1 } },
  { id: 't_friend', name: name('Friend'), source: { kind: 'chapter', n: 3 } },
  ...DREAMS.map((d): TitleDef => ({ id: d.title, name: name(d.title), source: { kind: 'dream', id: d.id } })),
];

const BEAT_IDS = [
  ...CHAPTERS.flatMap((c) => [c.beats.open, c.beats.close]),
  ...DREAMS.map((d) => d.beat),
  'b_dream_step',
  'b_phone_fund',
  'b_welcome_back',
  'b_rankup',
  'b_phone_bought',
  'b_mio_h2',
];
const BEATS: Record<string, Beat> = Object.fromEntries(
  BEAT_IDS.map((id): [string, Beat] => [id, { id, lines: [{ who: 'hanako', line: line('こんにちは。', 'Hello.') }] }]),
);
BEATS.b_ch1_close = { ...BEATS.b_ch1_close!, effects: [{ t: 'flag', id: 'ch1_closed' }, { t: 'keepsake', id: 'k_first_hello' }, { t: 'sticker', id: 'st_first' }] };
BEATS.b_ch2_close = { ...BEATS.b_ch2_close!, effects: [{ t: 'item', id: 'g_flower', qty: 2 }, { t: 'title', id: 't_friend' }, { t: 'culture', id: 'cc_gift' }, { t: 'friendFlag', friend: 'mio', id: 'number_note' }] };

const ageProfile = (ageFloor: number, dailyGoals: number, adultTopics: boolean) =>
  ({
    dailyGoals,
    pocketLines: 4,
    textScale: 1,
    minTapPx: 44,
    ttsRate: 1,
    echoThreshold: 0.6,
    ageFloor,
    voiceDefault: 'consent',
    adultGate: false,
    walletStyle: 'full',
    newCardsPerDay: 8,
    adultTopics,
  }) as GamePack['ageProfiles']['adults'];

/** Chapters of the quest fixture, with the interactions they open named in the pack. */
const INTERACTIONS: GamePack['interactions'] = {
  tanaka: [{ id: 'int_konbini', label: g('Konbini'), kind: 'scenario', scenarioId: 'konbini' }],
  cafe: [{ id: 'int_cafe', label: g('Café'), kind: 'scenario', scenarioId: 'cafe' }],
  sato: [
    { id: 'int_trip_hikarigaoka', label: g('Trip to Hikarigaoka'), kind: 'trip', scenarioId: 'trip_hikarigaoka' },
    { id: 'int_visit_home', label: g('Visit a home'), kind: 'visit' },
    { id: 'int_lesson', label: g('Lesson'), kind: 'lesson' },
  ],
  mio: [{ id: 'int_park', label: g('Park'), kind: 'scenario', scenarioId: 'park' }],
};

const CHAPTERS_1F: ChapterDef[] = CHAPTERS.map((c) => (c.n === 5 ? { ...c, objectives: c.objectives.map((o) => (o.id === 'c5_1' ? { ...o, pred: { k: 'visit' as const, place: 'trip:hikarigaoka' } } : o)) } : c));

/** A pack that passes `validatePack` at every level (level 5 with no index). Tests break one thing at a time. */
export function pack1f(over: Partial<GamePack> = {}): GamePack {
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
    lang: {
      readNumber: (n) => String(n),
      priceMarkup: (n, cur) => ({ markup: String(n), reading: String(n), gloss: { en: `${n} ${cur.code}`, ar: `${n} ${cur.code}` } }),
      parseNumbers: (text) => ({ text, numbers: [] }),
      speechNormalize: (t) => t,
      registerMarkers: { casual: { good: [], bad: [] }, polite: { good: [], bad: [] }, keigo: { good: [], bad: [] } },
    },
    menu: MENU,
    items: ITEMS,
    shops: SHOPS,
    fares: { hikarigaoka: 170, shinjuku: 190 },
    jobs: JOBS,
    chapters: CHAPTERS_1F,
    dreams: DREAMS,
    daily: DAILY,
    beats: BEATS,
    friends: FRIENDS,
    interactions: INTERACTIONS,
    scenarioMeta: SCENARIOS,
    pockets: POCKETS,
    wordTags: { numbers: ['一', '二', '三', '四', '五'], direction: ['右', '左'], transport: ['駅', '電車'], home: ['部屋'], car: ['車'], food: ['おにぎり'] },
    culture: CULTURE,
    titles: TITLES,
    ageProfiles: { kids: ageProfile(6, 2, false), teens: ageProfile(13, 3, false), adults: ageProfile(18, 3, true), seniors: ageProfile(50, 3, true) },
    keepsakes: { k_first_hello: name('First hello') },
    ...over,
  };
}

/** A content index the valid pack agrees with (level 5 cross-checks). */
export function index1f(pack: GamePack = pack1f()): ContentIndex {
  const slots: Record<string, string[]> = {
    item: ['onigiri', 'coffee', 'cake', 'used', 'yukata', 'futon', 'plant', 'bike', 'helmet', 'car'],
    giftItem: ['manga', 'flower', 'wagashi'],
  };
  const surfaces = new Set<string>();
  const addTokens = (ja: string): void => ja.split('|').forEach((t) => t && surfaces.add(t));
  Object.values(pack.pockets).forEach((p) => addTokens(p.line.ja));
  pack.culture.forEach((c) => addTokens(c.phrase.ja));
  Object.values(pack.beats).forEach((b) => b.lines.forEach((l) => addTokens(l.line.ja)));
  const scenarios: ContentIndex['scenarios'] = Object.fromEntries(pack.scenarioMeta.map((m) => [m.id, { steps: ['greet', 'pay', 'say_total'], intents: ['greet', 'order', 'pay'] }]));
  return { scenarios, lexiconSurfaces: surfaces, slots, characters: ['hanako', 'mio', 'tanaka', 'aiko', 'sato', 'cafe'], lessons: ['greetings', 'ic'] };
}

export function view1f(over: { age?: GameView['profile']['age']; goal?: string; streakDays?: number; due?: number; known?: string[]; reviewed?: string[]; lessons?: string[]; discovered?: string[]; saved?: number } = {}): GameView {
  return {
    vocab: { total: over.saved ?? 0, known: new Set(over.known ?? []), dueCount: over.due ?? 0, reviewedKeys: new Set(over.reviewed ?? []), reviewedSurfaces: new Set() },
    discovered: over.discovered ?? [],
    lessonsDone: over.lessons ?? [],
    streakDays: over.streakDays ?? 0,
    profile: { age: over.age ?? 'adults', goal: over.goal ?? 'casual', level: 'A1', createdAt: '2030-01-01' },
  };
}

export function ctx1f(pack: GamePack = pack1f(), now: number = NOW, view: GameView = view1f(), seed = 1): ReduceCtx {
  return { pack, now, view, rng: rng(seed) };
}

/** A new game on day 0. */
export const fresh1f = (pack: GamePack = pack1f(), now: number = NOW): GameState => createGameState(pack, now);

/** A turn: class `cls` with the credit the class earns; `intent` and `words` are optional. */
export function turn(id: number, cls: 'I' | 'S' | 'T', extra: Partial<TurnFacts> = {}): TurnFacts {
  return { id, cls, credit: cls === 'I' ? 1 : cls === 'S' ? 0.35 : 0.25, substantive: true, contentTokens: 3, stepIds: [], norm: `t${id}`, newWords: [], ...extra };
}

/** Facts of a finished conversation: `ind` independent and `ass` assisted substantive turns, `done` of `total` goal steps. */
export function facts1f(o: Partial<ConversationFacts> & { ind?: number; ass?: number; done?: number; total?: number } = {}): ConversationFacts {
  const { ind = 3, ass = 0, done = 3, total = 3, ...rest } = o;
  const scenarioId = rest.scenarioId ?? 'konbini';
  return {
    sessionId: 's1',
    scenarioId,
    characterId: 'tanaka',
    mode: 'guided',
    abandoned: false,
    durationSec: 120,
    goalDone: done,
    goalTotal: total,
    turns: [...Array.from({ length: ind }, (_, i) => turn(i, 'I', { intentId: `i${i}`, newWords: [`w${scenarioId}${i}`] })), ...Array.from({ length: ass }, (_, i) => turn(ind + i, 'S'))],
    fallbacks: 0,
    hintUses: 0,
    accuracy: null,
    requestsPolite: true,
    prepared: false,
    remembered: {},
    ...rest,
  };
}
