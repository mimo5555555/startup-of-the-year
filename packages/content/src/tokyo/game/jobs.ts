import type { CustomerTemplate, JobDef } from '@lw/game';
import { L } from '../dsl';

// Pack data: the part-time jobs (agent 4D, docs/GAME_DESIGN.md §9). Release 1 ships the konbini shift only (docs/RELEASE_1.md): the café
// and station jobs wait, and their interaction rows stay hidden until they are registered.
//
// Carts are menu ids of the konbini (`menu.ts`), so the shift screen shows the very goods and prices of the shop; the total of an order is
// the sum of the menu prices (take-out, tax included), computed by `generateShift`. Tiers: 1 one or two items of one kind, 2 two kinds,
// 3 the heat / no-bag flags, 4 (rank >= 2) the customer pays with a 1,000-yen note and wants the change said back.
//
// `thanks` are accepted staff phrases (markup, first = the phrase the tiles and chips teach). `tiles` are two distractor words for the
// tile builder of that phrase. Toggle ids are `heat` (温めて) and `nobag` (袋はいりません); a customer who names neither expects both off.

const K = (item: string): string => `konbini:${item}`;

/** Accepted staff phrases (§9.3): thanks, "sorry to keep you waiting", "certainly". The first is what the tiles teach. */
const THANKS = ['ありがとうございました|。|また|どうぞ|。', 'お待たせしました|。', 'かしこまりました|。'];
const THANKS_HEAT = ['お待たせしました|。|どうぞ|。', 'ありがとうございました|。', 'かしこまりました|。'];
const TILES_A = ['いらっしゃいませ', 'どういたしまして'];
const TILES_B = ['すみません', 'いただきます'];

const order = (items: Array<[string, number]>, toggles?: string[]): CustomerTemplate['task'] => ({
  kind: 'order',
  items: items.map(([menu, qty]) => ({ menu: K(menu), qty })),
  ...(toggles ? { toggles } : {}),
});

const ARCHETYPES: CustomerTemplate[] = [
  // ---- tier 1 ----
  {
    id: 'k_basic',
    tier: 1,
    minRank: 0,
    line: L('おにぎり|を|ふたつ|、|お願いします|。', 'Two rice balls, please.', 'كرتا أرز اثنتان من فضلك.'),
    task: order([['onigiri', 2]]),
    thanks: THANKS,
    tiles: TILES_A,
  },
  {
    id: 'k_water',
    tier: 1,
    minRank: 0,
    line: L('水|を|ひとつ|ください|。', 'One water, please.', 'ماء واحد من فضلك.'),
    task: order([['water', 1]]),
    thanks: THANKS,
    tiles: TILES_B,
  },
  {
    id: 'k_bento',
    tier: 1,
    minRank: 0,
    line: L('お弁当|を|ひとつ|ください|。', 'One boxed lunch, please.', 'وجبة غداء واحدة من فضلك.'),
    task: order([['bento', 1]]),
    thanks: THANKS,
    tiles: TILES_A,
  },
  {
    id: 'k_three',
    tier: 1,
    minRank: 0,
    line: L('おにぎり|を|みっつ|ください|。', 'Three rice balls, please.', 'ثلاث كرات أرز من فضلك.'),
    task: order([['onigiri', 3]]),
    thanks: THANKS,
    tiles: TILES_B,
  },
  // ---- tier 2 ----
  {
    id: 'k_two',
    tier: 2,
    minRank: 0,
    line: L('お茶|を|ひとつ|と|、|サンドイッチ|を|みっつ|ください|。', 'One tea and three sandwiches, please.', 'شاي واحد وثلاث ساندويتشات من فضلك.'),
    task: order([
      ['greenTea', 1],
      ['sandwich', 3],
    ]),
    thanks: THANKS,
    tiles: TILES_A,
  },
  {
    id: 'k_drinks',
    tier: 2,
    minRank: 0,
    line: L('ジュース|を|ふたつ|と|、|牛乳|を|ひとつ|ください|。', 'Two juices and one milk, please.', 'عصيران وحليب واحد من فضلك.'),
    task: order([
      ['juice', 2],
      ['milk', 1],
    ]),
    thanks: THANKS,
    tiles: TILES_B,
  },
  {
    id: 'k_sweet',
    tier: 2,
    minRank: 0,
    line: L('ケーキ|を|ひとつ|と|、|コーヒー|を|ひとつ|お願いします|。', 'One cake and one coffee, please.', 'كعكة واحدة وقهوة واحدة من فضلك.'),
    task: order([
      ['cake', 1],
      ['coffee', 1],
    ]),
    thanks: THANKS,
    tiles: TILES_A,
  },
  // ---- tier 3: the flags ----
  {
    id: 'k_heat',
    tier: 3,
    minRank: 0,
    line: L('お弁当|を|温めて|ください|。|袋|は|いりません|。', "Please heat the bento. I don't need a bag.", 'سخّن الوجبة من فضلك. لا أحتاج كيسًا.'),
    task: order([['bento', 1]], ['heat', 'nobag']),
    thanks: THANKS_HEAT,
    tiles: TILES_B,
  },
  {
    id: 'k_heat2',
    tier: 3,
    minRank: 0,
    line: L('お弁当|と|お茶|を|ください|。|お弁当|は|温めて|ください|。', 'A bento and a tea, please. Please heat the bento.', 'وجبة وشاي من فضلك. سخّن الوجبة من فضلك.'),
    task: order(
      [
        ['bento', 1],
        ['greenTea', 1],
      ],
      ['heat'],
    ),
    thanks: THANKS_HEAT,
    tiles: TILES_A,
  },
  {
    id: 'k_bag',
    tier: 3,
    minRank: 0,
    line: L('おにぎり|を|みっつ|ください|。|袋|は|いりません|。', "Three rice balls, please. I don't need a bag.", 'ثلاث كرات أرز من فضلك. لا أحتاج كيسًا.'),
    task: order([['onigiri', 3]], ['nobag']),
    thanks: THANKS,
    tiles: TILES_B,
  },
  // ---- tier 4 (rank 2 and up): a 1,000-yen note, say the change ----
  {
    id: 'k_change',
    tier: 4,
    minRank: 2,
    line: L('サンドイッチ|と|ジュース|を|ください|。|千|円|で|お願いします|。', 'A sandwich and a juice, please. By a 1,000-yen note.', 'ساندويتش وعصير من فضلك. بورقة الألف ين.'),
    task: order([
      ['sandwich', 1],
      ['juice', 1],
    ]),
    thanks: THANKS,
    tiles: TILES_A,
    change: { paid: 1000 },
  },
  {
    id: 'k_change2',
    tier: 4,
    minRank: 2,
    line: L('お弁当|と|水|を|ください|。|千|円|で|お願いします|。', 'A bento and a water, please. By a 1,000-yen note.', 'وجبة وماء من فضلك. بورقة الألف ين.'),
    task: order([
      ['bento', 1],
      ['water', 1],
    ]),
    thanks: THANKS,
    tiles: TILES_B,
    change: { paid: 1000 },
  },
];

/** Pack data: the part-time jobs. Wage and hours: docs/GAME_DESIGN.md §9.2 (the paid hours are a short "helping out" shift, `BALANCE.shift.hours`). */
export const JOBS: JobDef[] = [
  {
    id: 'job_konbini',
    place: 'konbini',
    boss: 'tanaka',
    name: { en: 'Konbini shift', ar: 'وردية الكونبيني' },
    wage: 1150,
    hours: 0.75,
    // the chapter that opens the job is Chapter 2 (`chapters.ts`); the intro conversation is the screen's own first step, so nothing else gates the row
    unlock: { k: 'all', of: [] },
    intro: 'job_konbini_intro',
    archetypes: ARCHETYPES,
    vocabTags: ['numbers', 'cafe'],
    bonus: { itemId: K('onigiri'), needsPerfect: true },
  },
];
