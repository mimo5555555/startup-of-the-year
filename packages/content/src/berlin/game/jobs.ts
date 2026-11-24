// Pack data: Berlin's part-time job (jobs for Berlin, docs/GAME_DESIGN.md §9): the evening till at Murat's Späti, opened by Chapter 2.
// Carts are the Späti's menu ids, so the shift screen shows its very drinks and prices; every price includes the Pfand (the bottle
// deposit), as it does when you buy there. Tiers: 1 one kind, 2 two kinds, 3 the customer changes their mind (listen to the end),
// 4 (rank 2 and up) the customer pays with a note and you say the change. Totals are said as 「Das macht 3,80 €.」, the change as
// 「Sie bekommen 1,20 € zurück.」 (`DE_SHIFT_TALK`). `thanks` are accepted staff phrases (the first is what the tiles teach); `tiles`
// are two wrong words for the tile builder of that phrase.
import type { CustomerTemplate, JobDef } from '@lw/game';
import { L } from '../../tokyo/dsl';

const order = (items: Array<[string, number]>): CustomerTemplate['task'] => ({ kind: 'order', items: items.map(([menu, qty]) => ({ menu: `spaeti:${menu}`, qty })) });

/** the evening's thanks, and the daytime one (both accept any thanks or a nice wish) */
const THANKS_EVENING = ['Danke schön! Schönen Abend noch!', 'Vielen Dank!', 'Danke!', 'Schönen Abend noch!', 'Schönen Tag noch!'];
const THANKS_DAY = ['Bitte schön! Schönen Tag noch!', 'Danke schön!', 'Vielen Dank!', 'Danke!', 'Schönen Tag noch!', 'Schönen Abend noch!'];
const TILES_A = ['Hallo', 'Morgen'];
const TILES_B = ['Guten', 'Appetit'];

const SPAETI_CUSTOMERS: CustomerTemplate[] = [
  // ---- tier 1: one kind ----
  { id: 'sp_mate', tier: 1, minRank: 0, line: L('Eine Club-Mate, bitte.', 'A Club-Mate, please.', 'كلوب ماتيه واحدة من فضلك.'), task: order([['clubmate', 1]]), thanks: THANKS_EVENING, tiles: TILES_A },
  { id: 'sp_wasser', tier: 1, minRank: 0, line: L('Zwei Wasser, bitte.', 'Two waters, please.', 'زجاجتا ماء من فضلك.'), task: order([['wasser', 2]]), thanks: THANKS_DAY, tiles: TILES_B },
  { id: 'sp_cola', tier: 1, minRank: 0, line: L('Eine Cola, bitte.', 'A cola, please.', 'كولا واحدة من فضلك.'), task: order([['cola', 1]]), thanks: THANKS_EVENING, tiles: TILES_B },
  {
    id: 'sp_schorle',
    tier: 1,
    minRank: 0,
    line: L('Drei Apfelschorlen, bitte.', 'Three apple spritzers, please.', 'ثلاث زجاجات عصير تفاح بالصودا من فضلك.'),
    task: order([['schorle', 3]]),
    thanks: THANKS_DAY,
    tiles: TILES_A,
  },
  // ---- tier 2: two kinds ----
  { id: 'sp_two', tier: 2, minRank: 0, line: L('Eine Cola und ein Wasser, bitte.', 'A cola and a water, please.', 'كولا وماء من فضلك.'), task: order([['cola', 1], ['wasser', 1]]), thanks: THANKS_EVENING, tiles: TILES_A },
  {
    id: 'sp_two_b',
    tier: 2,
    minRank: 0,
    line: L('Zwei Club-Mate und eine Apfelschorle, bitte.', 'Two Club-Mates and an apple spritzer, please.', 'كلوب ماتيه اثنتان وعصير تفاح بالصودا من فضلك.'),
    task: order([['clubmate', 2], ['schorle', 1]]),
    thanks: THANKS_DAY,
    tiles: TILES_B,
  },
  {
    id: 'sp_two_c',
    tier: 2,
    minRank: 0,
    line: L('Ich nehme ein Wasser und zwei Colas.', 'I’ll take a water and two colas.', 'سآخذ ماءً واثنتين من الكولا.'),
    task: order([['wasser', 1], ['cola', 2]]),
    thanks: THANKS_EVENING,
    tiles: TILES_B,
  },
  // ---- tier 3: the customer changes their mind (what counts is what they say last) ----
  {
    id: 'sp_mind',
    tier: 3,
    minRank: 0,
    line: L('Eine Cola, bitte. Ach nein, lieber eine Club-Mate!', 'A cola, please. Oh no, a Club-Mate instead!', 'كولا من فضلك. لا، بل كلوب ماتيه!'),
    task: order([['clubmate', 1]]),
    thanks: THANKS_EVENING,
    tiles: TILES_A,
  },
  { id: 'sp_mind_b', tier: 3, minRank: 0, line: L('Drei Wasser, bitte. Nein, nur zwei!', 'Three waters, please. No, just two!', 'ثلاث زجاجات ماء من فضلك. لا، اثنتان فقط!'), task: order([['wasser', 2]]), thanks: THANKS_DAY, tiles: TILES_B },
  {
    id: 'sp_mind_c',
    tier: 3,
    minRank: 0,
    line: L('Zwei Apfelschorlen und eine Cola. Nein, zwei Colas!', 'Two apple spritzers and a cola. No, two colas!', 'عصيرا تفاح بالصودا وكولا. لا، كولا اثنتان!'),
    task: order([['schorle', 2], ['cola', 2]]),
    thanks: THANKS_EVENING,
    tiles: TILES_A,
  },
  // ---- tier 4 (rank 2 and up): a note, and the change said back ----
  {
    id: 'sp_note',
    tier: 4,
    minRank: 2,
    line: L('Eine Club-Mate und eine Cola, bitte. Hier sind fünf Euro.', 'A Club-Mate and a cola, please. Here are five euros.', 'كلوب ماتيه وكولا من فضلك. تفضّل خمسة يورو.'),
    task: order([['clubmate', 1], ['cola', 1]]),
    thanks: THANKS_EVENING,
    tiles: TILES_B,
    change: { paid: 500 },
  },
  {
    id: 'sp_note_b',
    tier: 4,
    minRank: 2,
    line: L('Drei Club-Mate, bitte. Ich habe nur einen Zehner.', 'Three Club-Mates, please. I only have a ten-euro note.', 'ثلاث زجاجات كلوب ماتيه من فضلك. ليس معي إلا ورقة العشرة يورو.'),
    task: order([['clubmate', 3]]),
    thanks: THANKS_DAY,
    tiles: TILES_A,
    change: { paid: 1000 },
  },
  {
    id: 'sp_note_c',
    tier: 4,
    minRank: 2,
    line: L('Zwei Wasser und zwei Apfelschorlen. Geht ein Zwanziger?', 'Two waters and two apple spritzers. Is a twenty all right?', 'زجاجتا ماء وعصيرا تفاح بالصودا. هل تصلح ورقة العشرين؟'),
    task: order([['wasser', 2], ['schorle', 2]]),
    thanks: THANKS_EVENING,
    tiles: TILES_B,
    change: { paid: 2000 },
  },
];

/** Berlin's job: wage and hours as Tokyo's (§9.2), at the German minimum wage (the pack's reference wage) */
export const DE_JOBS: JobDef[] = [
  {
    id: 'job_spaeti',
    place: 'berlin_spaeti',
    boss: 'murat',
    name: { en: 'Späti shift', ar: 'وردية في «الشبيتي»' },
    wage: 1390,
    hours: 0.75,
    // opened by Chapter 2 (`story.ts`); the intro conversation is the screen's own first step
    unlock: { k: 'all', of: [] },
    intro: 'jobintro_spaeti',
    archetypes: SPAETI_CUSTOMERS,
    vocabTags: ['numbers'],
    // a cold Club-Mate on the house
    bonus: { itemId: 'spaeti:clubmate', needsPerfect: true },
  },
];
