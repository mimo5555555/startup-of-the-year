import type { CustomerTemplate, JobDef } from '@lw/game';
import { L } from '../dsl';
import { FARES, TRIP_HIKARIGAOKA } from './fares';

// Pack data: the part-time jobs (agent 4D, docs/GAME_DESIGN.md §9). Release 1 shipped the konbini shift only; Release 2 wave C1 adds the café
// (Yuki, Chapter 3) and the station help desk (Sato, Chapter 5), so their `yuki_shift` / `sato_shift` rows show (`tokyo/game/index.ts` keeps a
// shift row only while its job exists).
//
// Carts are menu ids of the konbini (`menu.ts`), so the shift screen shows the very goods and prices of the shop; the total of an order is
// the sum of the menu prices (take-out, tax included), computed by `generateShift`. Tiers: 1 one or two items of one kind, 2 two kinds,
// 3 the heat / no-bag flags, 4 (rank >= 2) the customer pays with a 1,000-yen note and wants the change said back.
//
// `thanks` are accepted staff phrases (markup, first = the phrase the tiles and chips teach). `tiles` are two distractor words for the
// tile builder of that phrase. Toggle ids are `heat` (温めて) and `nobag` (袋はいりません); a customer who names neither expects both off.

const K = (item: string): string => `konbini:${item}`;
const C = (item: string): string => `cafe:${item}`;

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
const cafeOrder = (items: Array<[string, number]>, toggles?: string[]): CustomerTemplate['task'] => ({
  kind: 'order',
  items: items.map(([menu, qty]) => ({ menu: C(menu), qty })),
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

// ---------------------------------------------------------------------------------------------------------------
// The café (Yuki, Chapter 3, §9.3): the same order grid as the konbini over the café's own menu (`cafe:*`), plus the switches `hot` / `iced`, a
// table number (`table:3`) and, for a customer who wants separate bills, `split` (two totals: the first item line, then the rest). The task
// kinds are all `order`; what the Shift screen's café widgets need beyond the konbini ones is exactly those four toggles.
// ---------------------------------------------------------------------------------------------------------------

/** Staff phrases of the café: "sorry to keep you waiting" (what the tiles teach), "certainly", "thank you". */
const THANKS_CAFE = ['お待たせしました|。', 'かしこまりました|。', 'ありがとうございました|。|また|どうぞ|。'];
/** A repeat-back of the order is the best staff phrase of all (§9.3 `c_one`): it comes first, so the tiles teach it. */
const repeatBack = (what: string): string[] => [`${what}|です|ね|。`, ...THANKS_CAFE];

const CAFE_ARCHETYPES: CustomerTemplate[] = [
  // ---- tier 1 ----
  {
    id: 'c_one',
    tier: 1,
    minRank: 0,
    line: L('ホット|の|カフェラテ|を|ひとつ|お願いします|。', 'One hot café latte, please.', 'كافيه لاتيه ساخن واحد من فضلك.'),
    task: cafeOrder([['latte', 1]], ['hot']),
    thanks: repeatBack('ホット|の|カフェラテ|が|ひとつ'),
    tiles: TILES_A,
  },
  {
    id: 'c_tea',
    tier: 1,
    minRank: 0,
    line: L('紅茶|を|ひとつ|ください|。|ホット|で|お願いします|。', 'One black tea, please. Hot, please.', 'شاي أسود واحد من فضلك. ساخن من فضلك.'),
    task: cafeOrder([['blackTea', 1]], ['hot']),
    thanks: THANKS_CAFE,
    tiles: TILES_B,
  },
  {
    id: 'c_cake',
    tier: 1,
    minRank: 0,
    line: L('ケーキ|を|ふたつ|ください|。', 'Two cakes, please.', 'كعكتان من فضلك.'),
    task: cafeOrder([['cake', 2]]),
    thanks: THANKS_CAFE,
    tiles: TILES_A,
  },
  {
    id: 'c_juice',
    tier: 1,
    minRank: 0,
    line: L('ジュース|を|みっつ|お願いします|。', 'Three juices, please.', 'ثلاثة عصائر من فضلك.'),
    task: cafeOrder([['juice', 3]]),
    thanks: THANKS_CAFE,
    tiles: TILES_B,
  },
  // ---- tier 2: two drinks and a table number ----
  {
    id: 'c_two',
    tier: 2,
    minRank: 0,
    line: L('アイス|コーヒー|を|ふたつ|お願いします|。|三番|の|テーブル|です|。', 'Two iced coffees, please. Table 3.', 'قهوتان باردتان من فضلك. الطاولة 3.'),
    task: cafeOrder([['coffee', 2]], ['iced', 'table:3']),
    thanks: THANKS_CAFE,
    tiles: TILES_A,
  },
  {
    id: 'c_table',
    tier: 2,
    minRank: 0,
    line: L('二番|の|テーブル|です|。|ホット|の|コーヒー|を|みっつ|お願いします|。', 'Table 2. Three hot coffees, please.', 'الطاولة 2. ثلاث قهوات ساخنة من فضلك.'),
    task: cafeOrder([['coffee', 3]], ['hot', 'table:2']),
    thanks: THANKS_CAFE,
    tiles: TILES_B,
  },
  {
    id: 'c_sweet',
    tier: 2,
    minRank: 0,
    line: L('お茶|を|ひとつ|と|、|ケーキ|を|ふたつ|ください|。', 'One green tea and two cakes, please.', 'شاي أخضر واحد وكعكتان من فضلك.'),
    task: cafeOrder([
      ['greenTea', 1],
      ['cake', 2],
    ]),
    thanks: THANKS_CAFE,
    tiles: TILES_A,
  },
  // ---- tier 3: a change of mind (the last word wins) ----
  {
    id: 'c_change',
    tier: 3,
    minRank: 0,
    line: L('ホット|の|カフェラテ|を|お願いします|。|あ、|やっぱり|アイス|で|お願いします|。', 'A hot café latte, please. Oh, actually, iced, please.', 'كافيه لاتيه ساخن من فضلك. آه، بل بارد من فضلك.'),
    task: cafeOrder([['latte', 1]], ['iced']),
    thanks: THANKS_CAFE,
    tiles: TILES_B,
  },
  {
    id: 'c_change2',
    tier: 3,
    minRank: 0,
    line: L('コーヒー|を|ひとつ|お願いします|。|やっぱり|紅茶|に|します|。', 'One coffee, please. Actually, I will have black tea.', 'قهوة واحدة من فضلك. بل سآخذ شايًا أسود.'),
    task: cafeOrder([['blackTea', 1]]),
    thanks: THANKS_CAFE,
    tiles: TILES_A,
  },
  // ---- tier 4 (rank 2 and up): separate bills; a 1,000-yen note ----
  {
    id: 'c_split',
    tier: 4,
    minRank: 2,
    line: L('コーヒー|を|ひとつ|と|、|ケーキ|を|ひとつ|ください|。|別々|で|お願いします|。', 'One coffee and one cake, please. Separate bills, please.', 'قهوة واحدة وكعكة واحدة من فضلك. فواتير منفصلة من فضلك.'),
    task: cafeOrder(
      [
        ['coffee', 1],
        ['cake', 1],
      ],
      ['split'],
    ),
    thanks: THANKS_CAFE,
    tiles: TILES_B,
  },
  {
    id: 'c_note',
    tier: 4,
    minRank: 2,
    line: L('カフェラテ|を|ひとつ|ください|。|千|円|で|お願いします|。', 'One café latte, please. By a 1,000-yen note.', 'كافيه لاتيه واحد من فضلك. بورقة الألف ين.'),
    task: cafeOrder([['latte', 1]]),
    thanks: THANKS_CAFE,
    tiles: TILES_A,
    change: { paid: 1000 },
  },
];

// ---------------------------------------------------------------------------------------------------------------
// The station help desk (Sato, Chapter 5, §9.3). Desk customers have no cart: the customer asks and the player answers from the board, the map,
// the timetable or the fare table (`task` = `{ kind, answer }`):
//   platform  answer = the platform NUMBER (3)           widget: the departure board, tap or say 「三番線です」
//   direction answer = 'right' | 'left' | 'straight'     widget: the mini map with 右 / 左 / まっすぐ
//   time      answer = the departure as 'H:MM' ('9:58')  widget: the timetable, say 「九時五十八分です」
//   fare      answer = the fare in yen (the IC fare, or the paper fare when the line says 切符)  widget: the fare table
//   announce  answer = the platform NUMBER; the line is the station announcement (TTS), "which platform?"
// The destinations and fares are the pack's (`fares.ts`), so the desk can never quote a price the machine does not charge.
// ---------------------------------------------------------------------------------------------------------------

/** What a paper ticket adds to the IC fare (`BALANCE.fares.paperExtra`; asserted equal in the tests: content never imports @lw/game at runtime). */
const PAPER_EXTRA = 10;
/** Staff phrases of the desk: a send-off (what the tiles teach), "sorry to keep you waiting", "certainly", "thank you". */
const THANKS_STATION = ['お気をつけて|。', 'お待たせしました|。', 'かしこまりました|。', 'ありがとうございました|。'];

const STATION_ARCHETYPES: CustomerTemplate[] = [
  // ---- tier 1: a platform on the board; a way on the map ----
  {
    id: 's_platform',
    tier: 1,
    minRank: 0,
    line: L('光が丘|は|何番線|です|か？', 'Which platform is Hikarigaoka?', 'أي رصيف لهيكاريغاؤكا؟'),
    task: { kind: 'platform', answer: TRIP_HIKARIGAOKA.platform },
    thanks: THANKS_STATION,
    tiles: TILES_A,
  },
  {
    id: 's_platform2',
    tier: 1,
    minRank: 0,
    line: L('渋谷|は|何番線|です|か？', 'Which platform is Shibuya?', 'أي رصيف لشيبويا؟'),
    task: { kind: 'platform', answer: 1 },
    thanks: THANKS_STATION,
    tiles: TILES_B,
  },
  {
    id: 's_dir',
    tier: 1,
    minRank: 0,
    line: L('トイレ|は|どこ|です|か？', 'Where is the toilet?', 'أين الحمام؟'),
    task: { kind: 'direction', answer: 'right' },
    thanks: THANKS_STATION,
    tiles: TILES_A,
  },
  {
    id: 's_dir2',
    tier: 1,
    minRank: 0,
    line: L('出口|は|どこ|です|か？', 'Where is the exit?', 'أين المخرج؟'),
    task: { kind: 'direction', answer: 'left' },
    thanks: THANKS_STATION,
    tiles: TILES_B,
  },
  // ---- tier 2: straight on; the timetable ----
  {
    id: 's_dir3',
    tier: 2,
    minRank: 0,
    line: L('券売機|は|どこ|です|か？', 'Where is the ticket machine?', 'أين آلة التذاكر؟'),
    task: { kind: 'direction', answer: 'straight' },
    thanks: THANKS_STATION,
    tiles: TILES_A,
  },
  {
    id: 's_time',
    tier: 2,
    minRank: 0,
    line: L('次|の|電車|は|何時|です|か？', 'What time is the next train?', 'متى القطار التالي؟'),
    task: { kind: 'time', answer: '9:58' },
    thanks: THANKS_STATION,
    tiles: TILES_B,
  },
  {
    id: 's_time2',
    tier: 2,
    minRank: 0,
    line: L('光が丘|へ|行く|電車|は|何時|です|か？', 'What time is the train to Hikarigaoka?', 'متى القطار المتجه إلى هيكاريغاؤكا؟'),
    task: { kind: 'time', answer: '14:25' },
    thanks: THANKS_STATION,
    tiles: TILES_A,
  },
  // ---- tier 3: the fare table (IC, then paper) ----
  {
    id: 's_fare',
    tier: 3,
    minRank: 0,
    line: L('光が丘|まで|ICカード|で|いくら|です|か？', 'How much is it to Hikarigaoka by IC card?', 'بكم إلى هيكاريغاؤكا ببطاقة IC؟'),
    task: { kind: 'fare', answer: FARES.hikarigaoka! },
    thanks: THANKS_STATION,
    tiles: TILES_B,
  },
  {
    id: 's_fare2',
    tier: 3,
    minRank: 0,
    line: L('新宿|まで|切符|は|いくら|です|か？', 'How much is a ticket to Shinjuku?', 'بكم تذكرة إلى شينجوكو؟'),
    task: { kind: 'fare', answer: FARES.shinjuku! + PAPER_EXTRA },
    thanks: THANKS_STATION,
    tiles: TILES_A,
  },
  // ---- tier 4 (rank 2 and up): the announcement, heard only (the text stays hidden unless the player asks) ----
  {
    id: 's_announce',
    tier: 4,
    minRank: 2,
    line: L('まもなく|二番線|に|電車|が|参ります|。', 'A train is arriving shortly at platform 2.', 'سيصل القطار قريبًا إلى الرصيف 2.'),
    task: { kind: 'announce', answer: 2 },
    thanks: THANKS_STATION,
    tiles: TILES_B,
  },
  {
    id: 's_announce2',
    tier: 4,
    minRank: 2,
    line: L('まもなく|四番線|に|電車|が|参ります|。', 'A train is arriving shortly at platform 4.', 'سيصل القطار قريبًا إلى الرصيف 4.'),
    task: { kind: 'announce', answer: 4 },
    thanks: THANKS_STATION,
    tiles: TILES_A,
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
  {
    id: 'job_cafe',
    place: 'cafe',
    boss: 'yuki',
    name: { en: 'Café shift', ar: 'وردية المقهى' },
    wage: 1200,
    hours: 0.75,
    // opened by Chapter 3 (`chapters.ts`); the intro conversation is the screen's own first step
    unlock: { k: 'all', of: [] },
    intro: 'jobintro_cafe',
    archetypes: CAFE_ARCHETYPES,
    vocabTags: ['numbers', 'cafe'],
    // a free drink; the word card コーヒー is the shift result's "words to keep" (the screen offers it, `wordsFromShift`)
    bonus: { itemId: C('coffee'), needsPerfect: true },
  },
  {
    id: 'job_station',
    place: 'station',
    boss: 'sato',
    name: { en: 'Station help desk', ar: 'مكتب مساعدة المحطة' },
    wage: 1400,
    hours: 0.75,
    // opened by Chapter 5 (`chapters.ts`)
    unlock: { k: 'all', of: [] },
    intro: 'jobintro_station',
    archetypes: STATION_ARCHETYPES,
    vocabTags: ['direction', 'transport', 'numbers'],
    // an omiyage for a friend (§9.3 "g_souvenir-class"): the gift item Kato sells, handed over with its ordinary hand-over word
    bonus: { itemId: TRIP_HIKARIGAOKA.souvenir, needsPerfect: true },
  },
];
