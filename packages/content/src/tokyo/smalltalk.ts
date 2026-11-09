import type { IntentDef, Line, Scenario, Suggestion } from '../types';
import { L, S, say } from './dsl';

// Small talk a shopkeeper starts (docs/ROADMAP.md, "better conversations, part 2"). On some return visits the app starts a shop
// conversation with the flag `talk_<season>` (the season in Tokyo now, from the real date: spring, the rainy season, summer, autumn,
// winter). The opening node then says the shopkeeper's hello with a remark about the season and asks if you like it
// (「涼しくなりましたね。秋は好きですか？」), offers a yes chip and a no chip, understands either in your own words, answers warmly
// and goes back to the shop's own question (「いいですね！ご注文は？」). The answer turns the flag off: the chips go.
// `withSmallTalk` adds all of it to the opening node when the registry builds SCENARIOS.

export const SEASONS = ['spring', 'rainy', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/** The season in Tokyo on a real date: spring Mar–May, the rainy season (梅雨) in June, summer Jul–Aug, autumn Sep–Nov, winter Dec–Feb. */
export function seasonAt(ms: number): Season {
  const month = new Date(ms + 9 * 3600 * 1000).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month === 6) return 'rainy';
  if (month === 7 || month === 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

interface SeasonTalk {
  /** the remark and the question, polite and plain (Kenji and Genzō speak plainly) */
  polite: Line;
  plain: Line;
  /** the yes and the no answer chips */
  yes: Suggestion;
  no: Suggestion;
  /** the shopkeeper's answer to a no (before the shop's own question) */
  noReply: Line;
}

export const SEASON_TALK: Record<Season, SeasonTalk> = {
  spring: {
    polite: L('暖かく|なりました|ね。|桜、|見ました|か？', 'It has got warm. Have you seen the cherry blossoms?', 'صار الجو دافئًا. هل رأيت أزهار الكرز؟'),
    plain: L('暖かく|なった|ね。|桜、|見た？', 'It has got warm. Seen the cherry blossoms?', 'صار الجو دافئًا. هل رأيت أزهار الكرز؟'),
    yes: S('はい、|きれい|でした！', 'Yes, they were beautiful!', 'نعم، كانت جميلة!'),
    no: S('まだ|です。', 'Not yet.', 'ليس بعد.'),
    noReply: L('公園|の|桜|が|きれい|です|よ。', 'The cherry blossoms in the park are beautiful.', 'أزهار الكرز في الحديقة جميلة.'),
  },
  rainy: {
    polite: L('雨|が|多い|です|ね。|梅雨|です|から。|雨|は|好き|です|か？', 'Lots of rain these days. It is the rainy season. Do you like rain?', 'المطر كثير، أليس كذلك؟ إنه موسم الأمطار. هل تحب المطر؟'),
    plain: L('雨|が|多い|ね。|梅雨|だ|から。|雨|は|好き？', 'Lots of rain. It is the rainy season. Like rain?', 'المطر كثير. إنه موسم الأمطار. هل تحب المطر؟'),
    yes: S('はい、|雨|が|好き|です！', 'Yes, I like rain!', 'نعم، أحب المطر!'),
    no: S('雨|は|苦手|です。', 'I am not a fan of rain.', 'لا أحب المطر كثيرًا.'),
    noReply: L('わかります。|もう|すぐ|夏|です|よ。', 'I understand. Summer is coming soon.', 'أفهم. الصيف قادم قريبًا.'),
  },
  summer: {
    polite: L('今日|も|暑い|です|ね。|夏|は|好き|です|か？', 'Hot again today. Do you like summer?', 'حار اليوم أيضًا. هل تحب الصيف؟'),
    plain: L('今日|も|暑い|ね。|夏|は|好き？', 'Hot again today. Like summer?', 'حار اليوم أيضًا. هل تحب الصيف؟'),
    yes: S('はい、|夏|が|大好き|です！', 'Yes, I love summer!', 'نعم، أحب الصيف كثيرًا!'),
    no: S('暑い|の|は|苦手|です。', 'I am not good with the heat.', 'لا أتحمّل الحر.'),
    noReply: L('わかります。|水|を|たくさん|飲んで|ください|ね。', 'I understand. Drink plenty of water.', 'أفهم. اشرب الكثير من الماء.'),
  },
  autumn: {
    polite: L('涼しく|なりました|ね。|秋|は|好き|です|か？', 'It has got cooler. Do you like autumn?', 'صار الجو أبرد. هل تحب الخريف؟'),
    plain: L('涼しく|なった|ね。|秋|は|好き？', 'It has got cooler. Like autumn?', 'صار الجو أبرد. هل تحب الخريف؟'),
    yes: S('はい、|秋|が|好き|です！', 'Yes, I like autumn!', 'نعم، أحب الخريف!'),
    no: S('夏|の|方|が|好き|です。', 'I like summer better.', 'أفضّل الصيف.'),
    noReply: L('そう|です|か。|でも、|秋|は|食べ物|が|おいしい|です|よ。', 'I see. But the food is delicious in autumn.', 'فهمت. لكن الطعام لذيذ في الخريف.'),
  },
  winter: {
    polite: L('今日|は|寒い|です|ね。|冬|は|好き|です|か？', 'It is cold today. Do you like winter?', 'الجو بارد اليوم. هل تحب الشتاء؟'),
    plain: L('今日|は|寒い|ね。|冬|は|好き？', 'Cold today. Like winter?', 'الجو بارد اليوم. هل تحب الشتاء؟'),
    yes: S('はい、|冬|が|好き|です！', 'Yes, I like winter!', 'نعم، أحب الشتاء!'),
    no: S('寒い|の|は|苦手|です。', 'I am not good with the cold.', 'لا أتحمّل البرد.'),
    noReply: L('わかります。|風邪|を|ひかないで|ください|ね。', 'I understand. Do not catch a cold.', 'أفهم. لا تُصب بالزكام.'),
  },
};

interface ShopTalk {
  /** the shopkeeper's hello before the remark */
  hello: Line;
  /** back to business after the small talk: the shop's own question */
  ask: Line;
  /** speaks plainly (the remark's plain form) */
  plain?: true;
}

/** scenario id -> how its shopkeeper starts and ends the small talk (the festival stall and the talk after the bath have their own openers) */
export const SHOP_TALK: Record<string, ShopTalk> = {
  cafe: { hello: L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'), ask: L('ご注文|は？', 'What would you like?', 'ماذا تطلب؟') },
  konbini: { hello: L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'), ask: L('ごゆっくり|どうぞ。', 'Take your time.', 'خذ وقتك.') },
  ramen: { hello: L('いらっしゃい！', 'Welcome!', 'أهلًا!'), ask: L('何|に|します|か？', 'What will you have?', 'ماذا ستطلب؟'), plain: true },
  station_ic: { hello: L('こんにちは。', 'Hello.', 'مرحبًا.'), ask: L('どうしましたか？', 'How can I help?', 'كيف أساعدك؟') },
  karaoke_desk: { hello: L('いらっしゃいませ！', 'Welcome!', 'أهلًا بك!'), ask: L('何名様|です|か？', 'How many people?', 'كم عددكم؟') },
  arcade_crane: { hello: L('いらっしゃいませ！', 'Welcome!', 'أهلًا بك!'), ask: L('クレーンゲーム、|やります|か？', 'Will you play the crane game?', 'هل ستلعب لعبة الرافعة؟') },
  hobby_figures: { hello: L('いらっしゃいませ！', 'Welcome!', 'أهلًا بك!'), ask: L('今日|は|何|を|お探し|です|か？', 'What are you looking for today?', 'عمّ تبحث اليوم؟') },
  denki_phone: { hello: L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'), ask: L('何|を|お探し|でしょうか？', 'What are you looking for?', 'عمّ تبحث؟') },
  fuku_clothes: { hello: L('いらっしゃいませ！', 'Welcome!', 'أهلًا بك!'), ask: L('何|か|お探し|です|か？', 'Are you looking for something?', 'هل تبحث عن شيء؟') },
  fuku_home: { hello: L('いらっしゃいませ！', 'Welcome!', 'أهلًا بك!'), ask: L('何|か|お探し|です|か？', 'Are you looking for something?', 'هل تبحث عن شيء؟') },
  aiko_tea: { hello: L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'), ask: L('今日|も|プレゼント|です|か？', 'Is it a present today too?', 'هل هي هدية اليوم أيضًا؟') },
  motors_bike: { hello: L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'), ask: L('何|を|お探し|です|か？', 'What are you looking for?', 'عمّ تبحث؟') },
  motors_car: { hello: L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'), ask: L('軽自動車|を|お探し|です|か？', 'Are you looking for a kei car?', 'هل تبحث عن سيارة كي؟') },
  sento_desk: { hello: L('いらっしゃい！', 'Welcome!', 'أهلًا!'), ask: L('大人|一人|です|か？', 'One adult?', 'شخص بالغ واحد؟'), plain: true },
};

/** two lines said as one */
const join = (a: Line, b: Line): Line => L(`${a.ja}|${b.ja}`, `${a.en} ${b.en}`, `${a.ar} ${b.ar}`);
/** the small talk's answers win a close call over the shop's own intents (Daichi's own 「好き」, the 「ちょっと」 of a no-thanks) */
const ANSWER_BOOST = 3;
const YES_REPLY = L('いい|です|ね！', 'How nice!', 'جميل!');
const YES_KEYS = ['すきです', '好きです', 'だいすき', '大好き', 'きれいでした', 'きれい', 'みました', '見ました', 'たのしい', '楽しい', 'はい'];
const NO_KEYS = ['にがて', '苦手', 'すきじゃない', '好きじゃない', 'きらい', '嫌い', 'まだ', 'いいえ', 'あまり', 'のほうがすき', 'の方が好き', 'ほうがいい', '方がいい'];

/** The opening node of a shop conversation with the season's small talk added (one say variant, two chips and two answers per season). */
export function withSmallTalk(sc: Scenario): Scenario {
  const shop = SHOP_TALK[sc.id];
  const start = sc.nodes[sc.start];
  if (!shop || !start) return sc;
  const says = SEASONS.map((s) => say(join(shop.hello, shop.plain ? SEASON_TALK[s].plain : SEASON_TALK[s].polite), { flag: `talk_${s}` }));
  const chips: Suggestion[] = SEASONS.flatMap((s) => [SEASON_TALK[s].yes, SEASON_TALK[s].no].map((c) => ({ ...c, when: { flag: `talk_${s}` } })));
  const intents: IntentDef[] = SEASONS.flatMap((s): IntentDef[] => [
    { id: `talk_no_${s}`, when: { flag: `talk_${s}` }, unflag: `talk_${s}`, boost: ANSWER_BOOST, any: NO_KEYS, stay: true, reply: join(SEASON_TALK[s].noReply, shop.ask) },
    { id: `talk_yes_${s}`, when: { flag: `talk_${s}` }, unflag: `talk_${s}`, boost: ANSWER_BOOST, any: YES_KEYS, none: NO_KEYS, stay: true, reply: join(YES_REPLY, shop.ask) },
  ]);
  // after a remembered purchase (the first variant when `remembers` is on), before the regular's greeting and the usual one
  const head = start.say.filter((v) => v.when && 'flag' in v.when && v.when.flag === 'remembers');
  const rest = start.say.filter((v) => !head.includes(v));
  return {
    ...sc,
    nodes: {
      ...sc.nodes,
      [sc.start]: { ...start, say: [...head, ...says, ...rest], suggestions: [...chips, ...(start.suggestions ?? [])], intents: [...start.intents, ...intents] },
    },
  };
}
