import type { IntentDef, Line, Scenario, Suggestion } from '../types';
import { L, S, say } from './dsl';
import { REGULARS } from './regulars';

// Small talk a shopkeeper starts (docs/ROADMAP.md, "better conversations", parts 2 and 3). On some return visits the app starts a shop
// conversation with the flag `talk_<topic>`: the season in Tokyo now (from the real date: spring, the rainy season, summer, autumn,
// winter), the weekend (Friday, the weekend itself, Monday), the park's festival (coming up, or on today) or the news of the town (a place
// the player has not tried yet). The opening node then says the shopkeeper's hello with a remark about the season and asks if you like it
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

export interface TalkTopic {
  /** the remark and the question, polite and plain (Kenji and Genzō speak plainly) */
  polite: Line;
  plain: Line;
  /** the yes and the no answer chips */
  yes: Suggestion;
  no: Suggestion;
  /** the shopkeeper's answer to a yes (default 「いいですね！」) and to a no, before the shop's own question */
  yesReply?: Line;
  noReply: Line;
  /** what counts as a yes and as a no in the player's own words (default: the seasons' keys) */
  yesKeys?: string[];
  noKeys?: string[];
  /** conversations that never raise this topic (the news of a place is not told at that place) */
  notIn?: string[];
}

export const SEASON_TALK: Record<Season, TalkTopic> = {
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

/**
 * The weekend, by the real weekday in Tokyo: on Friday what is coming (「明日は土曜日ですね。週末は出かけますか？」), on Saturday and Sunday the
 * day itself (「今日はお休みですか？」), on Monday how it was (「週末は楽しかったですか？」).
 */
export const WEEKEND_TALK: Record<'weekend_before' | 'weekend_now' | 'weekend_after', TalkTopic> = {
  weekend_before: {
    polite: L('明日|は|土曜日|です|ね。|週末|は|出かけます|か？', 'Tomorrow is Saturday. Are you going out at the weekend?', 'غدًا السبت. هل ستخرج في عطلة نهاية الأسبوع؟'),
    plain: L('明日|は|土曜日|だ|ね。|週末|は|出かける？', 'Tomorrow is Saturday. Going out at the weekend?', 'غدًا السبت. هل ستخرج في عطلة نهاية الأسبوع؟'),
    yes: S('はい、|出かけます！', 'Yes, I am going out!', 'نعم، سأخرج!'),
    no: S('家|で|ゆっくり|します。', 'I will relax at home.', 'سأرتاح في البيت.'),
    yesReply: L('いい|です|ね！|楽しんで|ください。', 'How nice! Have fun.', 'جميل! استمتع.'),
    noReply: L('それ|も|いい|です|ね。', 'That is nice too.', 'هذا جميل أيضًا.'),
    yesKeys: ['でかけます', '出かけます', 'いきます', '行きます', 'あそび', '遊び', 'はい'],
    noKeys: ['いえで', '家で', 'ゆっくり', 'いいえ', 'でかけません', '出かけません', 'べんきょう', '勉強', 'しごと', '仕事', 'バイト', 'まだ'],
  },
  weekend_now: {
    polite: L('いい|週末|です|ね。|今日|は|お休み|です|か？', 'A nice weekend. Is today your day off?', 'عطلة نهاية أسبوع جميلة. هل اليوم يوم إجازتك؟'),
    plain: L('いい|週末|だ|ね。|今日|は|休み？', 'A nice weekend. Day off today?', 'عطلة نهاية أسبوع جميلة. هل اليوم إجازة؟'),
    yes: S('はい、|休み|です！', 'Yes, it is my day off!', 'نعم، إنه يوم إجازتي!'),
    no: S('いいえ、|今日|も|勉強|です。', 'No, I am studying today too.', 'لا، أدرس اليوم أيضًا.'),
    yesReply: L('いい|です|ね！|ゆっくり|して|ください。', 'How nice! Take it easy.', 'جميل! ارتح.'),
    noReply: L('大変|です|ね。|がんばって|ください。', 'That is tough. Good luck.', 'هذا متعب. بالتوفيق.'),
    yesKeys: ['やすみです', '休みです', 'はい'],
    noKeys: ['いいえ', 'べんきょう', '勉強', 'しごと', '仕事', 'バイト', 'いそがしい', '忙しい', 'やすみじゃ', '休みじゃ'],
  },
  weekend_after: {
    polite: L('週末|は|楽しかった|です|か？', 'Did you have a good weekend?', 'هل كانت عطلة نهاية الأسبوع ممتعة؟'),
    plain: L('週末|は|楽しかった？', 'Good weekend?', 'هل كانت العطلة ممتعة؟'),
    yes: S('はい、|楽しかった|です！', 'Yes, it was fun!', 'نعم، كانت ممتعة!'),
    no: S('忙しかった|です。', 'It was busy.', 'كانت مزدحمة.'),
    yesReply: L('よかった|です|ね！', 'I am glad!', 'يسعدني ذلك!'),
    noReply: L('お疲れ様|です。|今週|も|がんばりましょう。', 'You must be tired. Let us do our best this week too.', 'يعطيك العافية. لنبذل جهدنا هذا الأسبوع أيضًا.'),
    yesKeys: ['たのしかった', '楽しかった', 'よかった', 'はい'],
    noKeys: ['いそがしかった', '忙しかった', 'まあまあ', 'つかれ', '疲れ', 'いいえ', 'あまり'],
  },
};

/** The park's festival: coming up (Chapter 7 before it opens, Free Walk between Saturdays), or on today. */
export const FESTIVAL_TALK: Record<'festival_soon' | 'festival_today', TalkTopic> = {
  festival_soon: {
    polite: L('もう|すぐ|公園|で|お祭り|が|あります|よ。|行きます|か？', 'There is a festival in the park soon. Are you going?', 'سيقام مهرجان في الحديقة قريبًا. هل ستذهب؟'),
    plain: L('もう|すぐ|公園|で|お祭り|が|ある|よ。|行く？', 'There is a festival in the park soon. Going?', 'سيقام مهرجان في الحديقة قريبًا. هل ستذهب؟'),
    yes: S('はい、|行きます！', 'Yes, I am going!', 'نعم، سأذهب!'),
    no: S('まだ|わかりません。', 'I do not know yet.', 'لا أعرف بعد.'),
    yesReply: L('いい|です|ね！|楽しみ|です|ね。', 'How nice! Something to look forward to.', 'جميل! شيء ننتظره بشوق.'),
    noReply: L('楽しい|です|よ。|ぜひ|来て|ください。', 'It is fun. Do come.', 'إنه ممتع. تعال بالتأكيد.'),
    yesKeys: ['いきます', '行きます', 'いきたい', '行きたい', 'たのしみ', '楽しみ', 'はい'],
    noKeys: ['まだ', 'わかりません', 'いいえ', 'いきません', '行きません', 'ちょっと'],
  },
  festival_today: {
    polite: L('今日|は|公園|で|お祭り|です|よ。|もう|行きました|か？', 'The festival is on in the park today. Have you been yet?', 'المهرجان في الحديقة اليوم. هل ذهبت بعد؟'),
    plain: L('今日|は|公園|で|お祭り|だ|よ。|もう|行った？', 'The festival is on in the park today. Been yet?', 'المهرجان في الحديقة اليوم. هل ذهبت بعد؟'),
    yes: S('はい、|行きました！', 'Yes, I have been!', 'نعم، ذهبت!'),
    no: S('これから|行きます。', 'I am going now.', 'سأذهب الآن.'),
    noReply: L('楽しんで|ください|ね。', 'Have fun.', 'استمتع.'),
    yesKeys: ['いきました', '行きました', 'はい'],
    noKeys: ['これから', 'まだ', 'いいえ', 'あとで', '後で'],
  },
};

const BEEN_YES = ['いきました', '行きました', 'やりました', 'はい'];
const BEEN_NO = ['まだ', 'いいえ', 'いってない', '行ってない', 'いっていません', '行っていません', 'やってない', 'やっていません'];
const BEEN_CHIPS = { yes: S('はい、|行きました！', 'Yes, I have been!', 'نعم، ذهبت!'), no: S('まだ|です。', 'Not yet.', 'ليس بعد.') };

/**
 * The news of the town: a place that is open to the player and that they have not tried yet (the app picks one; never at that place).
 * `shop` and `scenario` say which place it is: open when the shop is, tried once its conversation was played.
 */
export const NEWS_TALK: Record<'news_sento' | 'news_karaoke' | 'news_arcade' | 'news_hobby', TalkTopic & { shop: string; scenario: string }> = {
  news_sento: {
    shop: 'sento',
    scenario: 'sento_desk',
    notIn: ['sento_desk'],
    polite: L('銭湯|の|桜の湯、|もう|行きました|か？', 'Have you been to Sakura-no-yu, the public bath, yet?', 'هل ذهبت إلى ساكورا نو يو، الحمّام العام؟'),
    plain: L('銭湯|の|桜の湯、|もう|行った？', 'Been to Sakura-no-yu, the public bath, yet?', 'هل ذهبت إلى ساكورا نو يو، الحمّام العام؟'),
    ...BEEN_CHIPS,
    yesReply: L('いい|お湯|です|よ|ね！', 'The water is lovely, right!', 'الماء رائع، أليس كذلك!'),
    noReply: L('いい|お湯|です|よ。|ぜひ|行って|みて|ください。', 'The water is lovely. Do go and try it.', 'الماء رائع. اذهب وجرّبه.'),
    yesKeys: BEEN_YES,
    noKeys: BEEN_NO,
  },
  news_karaoke: {
    shop: 'karaoke',
    scenario: 'karaoke_desk',
    notIn: ['karaoke_desk'],
    polite: L('カラオケ|の|うたひろば、|もう|行きました|か？', 'Have you been to Uta Hiroba, the karaoke box, yet?', 'هل ذهبت إلى أوتا هيروبا، صالة الكاريوكي؟'),
    plain: L('カラオケ|の|うたひろば、|もう|行った？', 'Been to Uta Hiroba, the karaoke box, yet?', 'هل ذهبت إلى أوتا هيروبا، صالة الكاريوكي؟'),
    ...BEEN_CHIPS,
    yesReply: L('楽しい|です|よ|ね！', 'It is fun, right!', 'إنها ممتعة، أليس كذلك!'),
    noReply: L('友達|と|行く|と|楽しい|です|よ。|ぜひ|行って|みて|ください。', 'It is fun to go with a friend. Do go and try it.', 'الذهاب مع صديق ممتع. اذهب وجرّبها.'),
    yesKeys: BEEN_YES,
    noKeys: BEEN_NO,
  },
  news_arcade: {
    shop: 'arcade',
    scenario: 'arcade_crane',
    notIn: ['arcade_crane'],
    polite: L('ゲームセンター|の|クレーンゲーム、|もう|やりました|か？', 'Have you tried the crane game at the game centre yet?', 'هل جرّبت لعبة الرافعة في صالة الألعاب؟'),
    plain: L('ゲームセンター|の|クレーンゲーム、|もう|やった？', 'Tried the crane game at the game centre yet?', 'هل جرّبت لعبة الرافعة في صالة الألعاب؟'),
    yes: S('はい、|やりました！', 'Yes, I have!', 'نعم، جرّبتها!'),
    no: S('まだ|です。', 'Not yet.', 'ليس بعد.'),
    yesReply: L('楽しい|です|よ|ね！', 'It is fun, right!', 'إنها ممتعة، أليس كذلك!'),
    noReply: L('ぬいぐるみ|が|取れます|よ。|ぜひ|やって|みて|ください。', 'You can win a plush toy. Do give it a try.', 'يمكنك أن تربح دمية محشوة. جرّبها.'),
    yesKeys: BEEN_YES,
    noKeys: BEEN_NO,
  },
  news_hobby: {
    shop: 'hobby',
    scenario: 'hobby_figures',
    notIn: ['hobby_figures'],
    polite: L('フィギュア|の|お店、|ほしぞらホビー|は|もう|行きました|か？', 'Have you been to Hoshizora Hobby, the figure shop, yet?', 'هل ذهبت إلى هوشيزورا هوبي، متجر المجسّمات؟'),
    plain: L('フィギュア|の|お店、|ほしぞらホビー|は|もう|行った？', 'Been to Hoshizora Hobby, the figure shop, yet?', 'هل ذهبت إلى هوشيزورا هوبي، متجر المجسّمات؟'),
    ...BEEN_CHIPS,
    yesReply: L('かわいい|フィギュア|が|多い|です|よ|ね！', 'There are lots of cute figures, right!', 'فيه مجسّمات لطيفة كثيرة، أليس كذلك!'),
    noReply: L('かわいい|フィギュア|が|たくさん|あります|よ。|ぜひ|行って|みて|ください。', 'There are lots of cute figures. Do go and have a look.', 'فيه مجسّمات لطيفة كثيرة. اذهب وألقِ نظرة.'),
    yesKeys: BEEN_YES,
    noKeys: BEEN_NO,
  },
};

/** Every topic a shopkeeper may raise: topic id -> its lines (the flag is `talk_<id>`). */
export const TALK_TOPICS: Record<string, TalkTopic> = { ...SEASON_TALK, ...WEEKEND_TALK, ...FESTIVAL_TALK, ...NEWS_TALK };

/** The weekend topic of a real date in Tokyo: Friday before, Saturday and Sunday now, Monday after; null midweek. */
export function weekendAt(ms: number): keyof typeof WEEKEND_TALK | null {
  const day = new Date(ms + 9 * 3600 * 1000).getUTCDay();
  return day === 5 ? 'weekend_before' : day === 6 || day === 0 ? 'weekend_now' : day === 1 ? 'weekend_after' : null;
}

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

/**
 * Your name. On a visit with nothing else to say, a shopkeeper who does not know it yet asks (flag `ask_name`: 「いつもありがとうございます。
 * あのう、お名前は？」); 「{name}です。」 and 「{name}と申します。」 are the chips, and any line that gives a name is the answer (the game
 * keeps that this character knows it). From then on the same visit greets you by name (flag `named`: 「{name}さん！」 before the regular's
 * greeting). The name is the one thing the recorded voices cannot say: the device voice says that sentence, the rest stays recorded.
 */
const NAME_TALK = {
  ask: {
    polite: L('いつも|ありがとう|ございます。|あのう、|お名前|は？', 'Thank you for always coming. Um, may I ask your name?', 'شكرًا لأنك تأتي دائمًا. عفوًا، ما اسمك؟'),
    plain: L('いつも|ありがとう！|名前|は？', 'Thanks for always coming! What is your name?', 'شكرًا لأنك تأتي دائمًا! ما اسمك؟'),
  },
  chips: [S('{name}|です。', 'I am {name}.', 'أنا {name}.'), S('{name}|と|申します。', 'My name is {name}.', 'اسمي {name}.')],
  reply: {
    polite: L('{name}|さん|です|ね。|これから|も|よろしく|お願いします！', 'So you are {name}. I look forward to seeing you again!', 'إذن أنت {name}. أتطلّع لرؤيتك دائمًا!'),
    plain: L('{name}|さん|だ|ね。|これから|も|よろしく！', 'So you are {name}. Good to know you!', 'إذن أنت {name}. تشرّفنا!'),
  },
  hail: L('{name}|さん！', '{name}!', '{name}!'),
  keys: ['です', 'といいます', 'と言います', 'ともうします', 'と申します'],
};

/** The topics a conversation may raise: all of them but the news of its own place. */
export const topicsOf = (scenarioId: string): string[] => Object.keys(TALK_TOPICS).filter((id) => !TALK_TOPICS[id]!.notIn?.includes(scenarioId));

/** The opening node of a shop conversation with the small talk added (one say variant, two chips and two answers per topic). */
export function withSmallTalk(sc: Scenario): Scenario {
  const shop = SHOP_TALK[sc.id];
  const start = sc.nodes[sc.start];
  if (!shop || !start) return sc;
  const topics = topicsOf(sc.id).map((id) => ({ id, t: TALK_TOPICS[id]! }));
  const says = topics.map(({ id, t }) => say(join(shop.hello, shop.plain ? t.plain : t.polite), { flag: `talk_${id}` }));
  const chips: Suggestion[] = topics.flatMap(({ id, t }) => [t.yes, t.no].map((c) => ({ ...c, when: { flag: `talk_${id}` } })));
  const intents: IntentDef[] = topics.flatMap(({ id, t }): IntentDef[] => {
    const no = t.noKeys ?? NO_KEYS;
    const base = { when: { flag: `talk_${id}` }, unflag: `talk_${id}`, boost: ANSWER_BOOST, stay: true as const };
    return [
      { ...base, id: `talk_no_${id}`, any: no, reply: join(t.noReply, shop.ask) },
      { ...base, id: `talk_yes_${id}`, any: t.yesKeys ?? YES_KEYS, none: no, reply: join(t.yesReply ?? YES_REPLY, shop.ask) },
    ];
  });
  // your name: the question and its answer, then the greeting by name
  const regular = REGULARS[sc.id]?.regular;
  says.push(say(join(shop.hello, shop.plain ? NAME_TALK.ask.plain : NAME_TALK.ask.polite), { flag: 'ask_name' }));
  if (regular) says.push(say(join(NAME_TALK.hail, regular), { flag: 'named' }));
  chips.push(...NAME_TALK.chips.map((c) => ({ ...c, when: { flag: 'ask_name' } })));
  intents.push({
    id: 'tell_name',
    when: { flag: 'ask_name' },
    unflag: 'ask_name',
    capture: 'name',
    captureRequired: true,
    any: NAME_TALK.keys,
    // above a bare はい, below anything that names an item of the shop: 「二人です」 at the karaoke desk is still two people
    boost: 0.5,
    stay: true,
    reply: join(shop.plain ? NAME_TALK.reply.plain : NAME_TALK.reply.polite, shop.ask),
  });
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
