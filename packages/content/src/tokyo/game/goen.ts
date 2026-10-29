import type { GoenItemDef, OmikujiFortune, SeasonDef } from '@lw/game';
import { L } from '../dsl';

// Goen (ご縁, docs/GOEN.md stage 1): the shrine catalog, the autumn season and the omikuji wording. Goen is earned free in play and spent at
// the shrine at the park's torii; every row shows exactly what it is and what it costs (no paid randomness). The looks are ordinary ItemDefs
// (items.ts, shop `shrine`, which sells nothing for yen) granted at the coin toss; the Journey is `journeys.ts`. Wish lines are the one model
// line of `shrine_wish` for the item (「{wish}ますように。」), lexicon markup.

/** The six stage-1 rows, in the order the Shrine panel shows them. */
export const GOEN_CATALOG: GoenItemDef[] = [
  {
    id: 'journey_kyoto',
    kind: 'journey',
    price: 250,
    ref: 'journey_kyoto',
    name: { ja: '京都の旅', reading: 'きょうとのたび', en: 'The Kyoto Journey', ar: 'رحلة كيوتو' },
    gives: {
      en: 'A Shinkansen trip to Kyoto: check in at a ryokan, visit a temple, a matcha café, and bring back a souvenir',
      ar: 'رحلة بالشينكانسن إلى كيوتو: نزل ريوكان ومعبد ومقهى ماتشا وهدية تذكارية لصديق',
    },
    wish: L('京都|に|行けます|ように。', 'I hope I can go to Kyoto.', 'أتمنى أن أذهب إلى كيوتو.'),
  },
  {
    id: 'season_autumn_premium',
    kind: 'season',
    price: 150,
    ref: 'season_autumn',
    name: { ja: '秋の季節・特別', reading: 'あきのきせつ・とくべつ', en: 'Autumn season: premium track', ar: 'موسم الخريف: المسار المميز' },
    gives: {
      en: 'The premium track of the autumn season: a momiji scarf, an autumn room plant, a ride sticker, a title and a keepsake',
      ar: 'المسار المميز لموسم الخريف: وشاح مومیجي ونبتة خريفية للغرفة وملصق للدراجة ولقب وتذكار',
    },
    wish: L('きれい|な|紅葉|が|見られます|ように。', 'I hope I can see beautiful autumn leaves.', 'أتمنى أن أرى أوراق الخريف الجميلة.'),
  },
  {
    id: 'kimono_momiji',
    kind: 'cosmetic',
    price: 120,
    name: { ja: '紅葉の着物', reading: 'もみじのきもの', en: 'Autumn-leaf kimono', ar: 'كيمونو أوراق الخريف' },
    gives: { en: 'A kimono with autumn leaves to wear in the world (like the yukata)', ar: 'كيمونو بأوراق الخريف ترتديه في العالم (مثل اليوكاتا)' },
    wish: L('きれい|に|なれます|ように。', 'I hope I can look beautiful.', 'أتمنى أن أبدو جميلًا.'),
  },
  {
    id: 'room_momiji',
    kind: 'cosmetic',
    price: 60,
    name: { ja: '紅葉の飾り', reading: 'もみじのかざり', en: 'Autumn room decor', ar: 'زينة الخريف للغرفة' },
    gives: { en: 'A momiji bonsai and a little gold screen for your room (comfort +1)', ar: 'بونساي مومیجي وستارة ذهبية صغيرة لغرفتك (راحة +1)' },
    wish: L('いい|部屋|に|なります|ように。', 'I hope it becomes a nice room.', 'أتمنى أن تصبح غرفة جميلة.'),
  },
  {
    id: 'ride_sakura',
    kind: 'cosmetic',
    price: 50,
    name: { ja: '桜のペイント', reading: 'さくらのペイント', en: 'Sakura paint for your bike', ar: 'طلاء ساكورا لدراجتك' },
    gives: { en: 'Cherry-blossom paint for the bicycle and the e-bike', ar: 'طلاء بأزهار الكرز للدراجة والدراجة الكهربائية' },
    wish: L('安全|に|走れます|ように。', 'I hope I can ride safely.', 'أتمنى أن أقود بأمان.'),
  },
  {
    id: 'omamori_streak',
    kind: 'charm',
    price: 30,
    name: { ja: 'お守り', reading: 'おまもり', en: 'Streak omamori', ar: 'تميمة السلسلة (أوماموري)' },
    gives: {
      en: 'Keeps your speaking streak alive for one missed day (hold at most 2; used by itself)',
      ar: 'تحفظ سلسلة تحدّثك يومًا واحدًا فاتك (تحمل اثنتين على الأكثر؛ تُستخدم تلقائيًا)',
    },
    wish: L('毎日|話せます|ように。', 'I hope I can speak every day.', 'أتمنى أن أتحدّث كل يوم.'),
  },
];

/** The free wish of `shrine_wish` (no item): two autumn model lines, so a visit to the shrine is speaking too. */
export const FREE_WISHES = [
  L('秋|の|紅葉|が|見られます|ように。', 'I hope I can see the autumn leaves.', 'أتمنى أن أرى أوراق الخريف.'),
  L('日本語|が|上手|に|なります|ように。', 'I hope my Japanese gets better.', 'أتمنى أن تتحسّن لغتي اليابانية.'),
];

/**
 * 秋 Autumn (docs/GOEN.md "The season pass"): 15 October to 15 December every year. Season points come from speaking tasks counted from the
 * season's start (each task once); eight tiers on two tracks. Free: +10 Goen at tiers 2, 4, 6 and 8, an autumn sticker, a pressed-maple
 * keepsake. Premium (`season_autumn_premium`): the momiji scarf, an autumn room plant, a ride sticker, the title t_momiji and the tier-8
 * keepsake. The tasks give 15 points, exactly the last tier.
 */
export const SEASON_AUTUMN: SeasonDef = {
  id: 'season_autumn',
  name: { ja: '秋', reading: 'あき', en: 'Autumn', ar: 'الخريف' },
  window: { from: '10-15', to: '12-15' },
  premiumItem: 'season_autumn_premium',
  tasks: [
    { id: 'au_stars', counter: 'conv_stars', min: 2, target: 3, sp: 2, text: { en: 'Finish 3 conversations with ★★ or more', ar: 'أنهِ 3 محادثات بنجمتين أو أكثر' } },
    { id: 'au_words', counter: 'season_words', target: 3, sp: 2, text: { en: 'Say 3 autumn words in conversations (秋, 紅葉, 栗…)', ar: 'قل 3 كلمات خريفية في المحادثات (秋، 紅葉، 栗…)' } },
    { id: 'au_kuri', counter: 'buy', ids: ['g_kuri_manju'], target: 1, sp: 1, text: { en: "Buy the autumn sweet (栗まんじゅう) at Aiko's", ar: 'اشترِ حلوى الخريف (栗まんじゅう) عند أيكو' } },
    { id: 'au_omikuji', counter: 'omikuji', target: 3, sp: 1, text: { en: 'Draw an omikuji at the shrine on 3 days', ar: 'اسحب أوميكوجي في المعبد في 3 أيام' } },
    { id: 'au_gift', counter: 'gift', target: 2, sp: 2, text: { en: 'Give 2 gifts, naming them in Japanese', ar: 'قدّم هديتين وسمِّهما باليابانية' } },
    { id: 'au_shift', counter: 'shift', target: 2, sp: 2, text: { en: 'Work 2 good shifts', ar: 'اعمل ورديتين جيدتين' } },
    { id: 'au_real', counter: 'real', target: 2, sp: 2, text: { en: 'Finish 2 conversations in Real mode', ar: 'أنهِ محادثتين في الوضع الحقيقي' } },
    { id: 'au_own', counter: 'own_lines', target: 40, sp: 3, text: { en: 'Say 40 lines of your own', ar: 'قل 40 جملة من كلامك' } },
  ],
  tiers: [
    { n: 1, sp: 1, free: [{ t: 'sticker', id: 'st_autumn' }], premium: [{ t: 'item', id: 'scarf_momiji' }] },
    { n: 2, sp: 3, free: [{ t: 'goen', n: 10 }], premium: [] },
    { n: 3, sp: 5, free: [{ t: 'keepsake', id: 'kp_maple' }], premium: [{ t: 'item', id: 'plant_momiji' }] },
    { n: 4, sp: 7, free: [{ t: 'goen', n: 10 }], premium: [] },
    { n: 5, sp: 9, free: [], premium: [{ t: 'sticker', id: 'st_ride_momiji' }] },
    { n: 6, sp: 11, free: [{ t: 'goen', n: 10 }], premium: [] },
    { n: 7, sp: 13, free: [], premium: [{ t: 'title', id: 't_momiji' }] },
    { n: 8, sp: 15, free: [{ t: 'goen', n: 10 }], premium: [{ t: 'keepsake', id: 'kp_autumn' }] },
  ],
  // lexicon surfaces a class-I turn may contain (the shrine's wishes, Aiko's chestnut sweet, the temple garden, the café's sweet)
  words: ['秋', '紅葉', '栗', '栗まんじゅう', '栗きんとん', '柿', 'お月見', '焼き芋', '涼しい', '落ち葉'],
};

export const SEASONS: SeasonDef[] = [SEASON_AUTUMN];

/** The omikuji's three wordings; `{word}` is the word due for review the reducer picked. Nothing random is ever an item or currency. */
export const OMIKUJI: OmikujiFortune[] = [
  {
    id: 'daikichi',
    name: { ja: '大吉', reading: 'だいきち', en: 'Great blessing', ar: 'بركة عظيمة' },
    line: L('大吉|です！|今日|の|言葉|は|{word}|です。', "Great blessing! Today's word is {word}.", 'بركة عظيمة! كلمة اليوم هي {word}.'),
    weight: 2,
  },
  {
    id: 'kichi',
    name: { ja: '吉', reading: 'きち', en: 'Blessing', ar: 'بركة' },
    line: L('吉|です。|今日|の|言葉|は|{word}|です。', "Blessing. Today's word is {word}.", 'بركة. كلمة اليوم هي {word}.'),
    weight: 5,
  },
  {
    id: 'shokichi',
    name: { ja: '小吉', reading: 'しょうきち', en: 'Small blessing', ar: 'بركة صغيرة' },
    line: L('小吉|です。|今日|の|言葉|は|{word}|です。', "Small blessing. Today's word is {word}.", 'بركة صغيرة. كلمة اليوم هي {word}.'),
    weight: 3,
  },
];
