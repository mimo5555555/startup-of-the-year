// Pack data: Amsterdam's part-time job (jobs for Amsterdam, docs/GAME_DESIGN.md §9): the counter of Café De Gracht with Femke, opened by
// Chapter 2. Carts are the café's menu ids (its coffee, tea, hot chocolate and apple pie), so the shift screen shows its very goods and
// prices. Tiers: 1 one kind, 2 two kinds, 3 the guests name their table, 4 (rank 2 and up) separate bills (「We betalen apart」, very Dutch:
// two totals) or a note and the change. Totals are said as 「Dat is dan € 7,50.」, the change as 「U krijgt € 2,70 terug.」
// (`NL_SHIFT_TALK`). `thanks` are accepted staff phrases (the first is what the tiles teach); `tiles` are two wrong words for its tiles.
import type { CustomerTemplate, JobDef } from '@lw/game';
import { L } from '../../tokyo/dsl';

const order = (items: Array<[string, number]>, toggles?: string[]): CustomerTemplate['task'] => ({
  kind: 'order',
  items: items.map(([menu, qty]) => ({ menu: `cafe:${menu}`, qty })),
  ...(toggles ? { toggles } : {}),
});

/** a guest who pays and goes, and one who is served (both accept any thanks or a nice wish) */
const THANKS_BYE = ['Dank u wel! Fijne dag nog!', 'Dank u wel!', 'Dank je wel!', 'Bedankt!', 'Fijne dag nog!', 'Fijne dag!'];
const THANKS_SERVED = ['Alstublieft! Geniet ervan!', 'Alstublieft!', 'Dank u wel!', 'Dank je wel!', 'Bedankt!', 'Geniet ervan!'];
const TILES_A = ['Hallo', 'Sorry'];
const TILES_B = ['Goedemorgen', 'graag'];

const CAFE_GUESTS: CustomerTemplate[] = [
  // ---- tier 1: one kind ----
  { id: 'cf_koffie', tier: 1, minRank: 0, line: L('Een koffie, graag.', 'A coffee, please.', 'قهوة واحدة من فضلك.'), task: order([['koffie', 1]]), thanks: THANKS_BYE, tiles: TILES_A },
  { id: 'cf_thee', tier: 1, minRank: 0, line: L('Twee thee, alstublieft.', 'Two teas, please.', 'كوبا شاي من فضلك.'), task: order([['thee', 2]]), thanks: THANKS_SERVED, tiles: TILES_B },
  {
    id: 'cf_verkeerd',
    tier: 1,
    minRank: 0,
    line: L('Mag ik een koffie verkeerd?', 'Can I have a koffie verkeerd (a milky coffee)?', 'هل يمكنني الحصول على قهوة بالحليب؟'),
    task: order([['verkeerd', 1]]),
    thanks: THANKS_BYE,
    tiles: TILES_B,
  },
  { id: 'cf_taart', tier: 1, minRank: 0, line: L('Een stuk appeltaart, graag.', 'A piece of apple pie, please.', 'قطعة من فطيرة التفاح من فضلك.'), task: order([['appeltaart', 1]]), thanks: THANKS_SERVED, tiles: TILES_A },
  // ---- tier 2: two kinds ----
  {
    id: 'cf_two',
    tier: 2,
    minRank: 0,
    line: L('Een koffie en een stuk appeltaart, graag.', 'A coffee and a piece of apple pie, please.', 'قهوة وقطعة من فطيرة التفاح من فضلك.'),
    task: order([['koffie', 1], ['appeltaart', 1]]),
    thanks: THANKS_SERVED,
    tiles: TILES_A,
  },
  {
    id: 'cf_two_b',
    tier: 2,
    minRank: 0,
    line: L('Twee koffie verkeerd en een thee, alstublieft.', 'Two milky coffees and a tea, please.', 'قهوتان بالحليب وشاي من فضلك.'),
    task: order([['verkeerd', 2], ['thee', 1]]),
    thanks: THANKS_BYE,
    tiles: TILES_B,
  },
  {
    id: 'cf_two_c',
    tier: 2,
    minRank: 0,
    line: L('Doe maar een chocolademelk en twee koffie.', 'I’ll have a hot chocolate and two coffees.', 'سآخذ شوكولاتة ساخنة وقهوتين.'),
    task: order([['chocomel', 1], ['koffie', 2]]),
    thanks: THANKS_SERVED,
    tiles: TILES_B,
  },
  // ---- tier 3: the table ----
  {
    id: 'cf_table',
    tier: 3,
    minRank: 0,
    line: L('Wij zitten aan tafel vier. Twee thee, graag.', 'We’re at table four. Two teas, please.', 'نحن على الطاولة أربعة. كوبا شاي من فضلك.'),
    task: order([['thee', 2]], ['table:4']),
    thanks: THANKS_SERVED,
    tiles: TILES_A,
  },
  {
    id: 'cf_table_b',
    tier: 3,
    minRank: 0,
    line: L('Een chocolademelk voor tafel twee, alstublieft.', 'A hot chocolate for table two, please.', 'شوكولاتة ساخنة للطاولة اثنين من فضلك.'),
    task: order([['chocomel', 1]], ['table:2']),
    thanks: THANKS_SERVED,
    tiles: TILES_B,
  },
  {
    id: 'cf_table_c',
    tier: 3,
    minRank: 0,
    line: L('Tafel zes: drie koffie en een stuk appeltaart, graag.', 'Table six: three coffees and a piece of apple pie, please.', 'الطاولة ستة: ثلاث قهوات وقطعة من فطيرة التفاح من فضلك.'),
    task: order([['koffie', 3], ['appeltaart', 1]], ['table:6']),
    thanks: THANKS_SERVED,
    tiles: TILES_A,
  },
  // ---- tier 4 (rank 2 and up): separate bills, or a note and the change ----
  {
    id: 'cf_split',
    tier: 4,
    minRank: 2,
    line: L('Een koffie en een thee, graag. We betalen apart.', 'A coffee and a tea, please. We’ll pay separately.', 'قهوة وشاي من فضلك. سندفع كلٌّ على حدة.'),
    task: order([['koffie', 1], ['thee', 1]], ['split']),
    thanks: THANKS_BYE,
    tiles: TILES_B,
  },
  {
    id: 'cf_split_b',
    tier: 4,
    minRank: 2,
    line: L('Een koffie verkeerd en een stuk appeltaart. Apart betalen, graag.', 'A milky coffee and a piece of apple pie. Separate bills, please.', 'قهوة بالحليب وقطعة من فطيرة التفاح. فواتير منفصلة من فضلك.'),
    task: order([['verkeerd', 1], ['appeltaart', 1]], ['split']),
    thanks: THANKS_BYE,
    tiles: TILES_A,
  },
  {
    id: 'cf_note',
    tier: 4,
    minRank: 2,
    line: L('Twee chocolademelk, alstublieft. Ik heb alleen een briefje van twintig.', 'Two hot chocolates, please. I only have a twenty-euro note.', 'كوبا شوكولاتة ساخنة من فضلك. ليس معي إلا ورقة العشرين يورو.'),
    task: order([['chocomel', 2]]),
    thanks: THANKS_SERVED,
    tiles: TILES_B,
    change: { paid: 2000 },
  },
  {
    id: 'cf_note_b',
    tier: 4,
    minRank: 2,
    line: L('Een thee en een stuk appeltaart. Hier is tien euro.', 'A tea and a piece of apple pie. Here’s ten euros.', 'شاي وقطعة من فطيرة التفاح. تفضّل عشرة يورو.'),
    task: order([['thee', 1], ['appeltaart', 1]]),
    thanks: THANKS_BYE,
    tiles: TILES_A,
    change: { paid: 1000 },
  },
];

/** Amsterdam's job: wage and hours as Tokyo's (§9.2), at the Dutch minimum wage (the pack's reference wage) */
export const NL_JOBS: JobDef[] = [
  {
    id: 'job_ams_cafe',
    place: 'ams_cafe',
    boss: 'femke',
    name: { en: 'Café shift', ar: 'وردية المقهى' },
    wage: 1440,
    hours: 0.75,
    // opened by Chapter 2 (`story.ts`); the intro conversation is the screen's own first step
    unlock: { k: 'all', of: [] },
    intro: 'jobintro_ams_cafe',
    archetypes: CAFE_GUESTS,
    vocabTags: ['numbers'],
    // a slice of Femke's apple pie, which she bakes every morning
    bonus: { itemId: 'cafe:appeltaart', needsPerfect: true },
  },
];
