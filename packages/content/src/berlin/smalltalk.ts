// Berlin's shopkeepers know you (German step 4): from the second visit they greet you as a regular (flag `regular`), and on some visits
// they make small talk about the season or the weekend (flag `talk_<topic>`, the same flags the app sets for Tokyo's shops). You answer
// yes or no (a chip, or your own words), they reply and go back to the shop's own question. Everything stays with Sie. The mechanics
// are shared with Amsterdam (../shoptalk.ts).
import type { Scenario } from '../types';
import { L, S } from '../tokyo/dsl';
import { withShopTalk, type ShopTalk, type TalkTopic } from '../shoptalk';

export const BERLIN_SHOP_TALK: Record<string, ShopTalk> = {
  berlin_bakery: {
    regular: L('Ah, Sie schon wieder! Guten Morgen! Was darf es sein?', 'Ah, you again! Good morning! What can I get you?', 'آه، أنت مجددًا! صباح الخير! ماذا تريد؟'),
    hello: L('Guten Morgen!', 'Good morning!', 'صباح الخير!'),
    ask: L('So, was darf es sein?', 'So, what can I get you?', 'إذن، ماذا تريد؟'),
  },
  berlin_spaeti: {
    regular: L('Na, wieder da? Was möchten Sie?', 'Well, back again? What would you like?', 'ها قد عدت؟ ماذا تريد؟'),
    hello: L('Hallo!', 'Hi!', 'أهلًا!'),
    ask: L('So, was möchten Sie?', 'So, what would you like?', 'إذن، ماذا تريد؟'),
  },
  berlin_doener: {
    regular: L('Hallo! Schön, Sie wieder zu sehen! Was darf es sein?', 'Hi! Nice to see you again! What can I get you?', 'أهلًا! سعيد برؤيتك مجددًا! ماذا تريد؟'),
    hello: L('Hallo!', 'Hi!', 'أهلًا!'),
    ask: L('So, was darf es sein?', 'So, what can I get you?', 'إذن، ماذا تريد؟'),
  },
  berlin_ubahn: {
    regular: L('Guten Tag! Schön, Sie wieder zu sehen. Wie kann ich Ihnen helfen?', 'Good afternoon! Nice to see you again. How can I help you?', 'مساء الخير! سعيدة برؤيتك مجددًا. كيف أستطيع مساعدتك؟'),
    hello: L('Guten Tag!', 'Good afternoon!', 'مساء الخير!'),
    ask: L('So, wie kann ich Ihnen helfen?', 'So, how can I help you?', 'إذن، كيف أستطيع مساعدتك؟'),
  },
  berlin_apotheke: {
    regular: L('Guten Tag! Schön, Sie wiederzusehen. Was kann ich für Sie tun?', 'Good afternoon! Nice to see you again. What can I do for you?', 'مساء الخير! سعيدة برؤيتك مجددًا. ماذا أستطيع أن أفعل لك؟'),
    hello: L('Guten Tag!', 'Good afternoon!', 'مساء الخير!'),
    ask: L('So, was kann ich für Sie tun?', 'So, what can I do for you?', 'إذن، ماذا أستطيع أن أفعل لك؟'),
  },
  berlin_kneipe: {
    regular: L('Ah, unser Stammgast! Guten Abend! Was darf es sein?', 'Ah, our regular! Good evening! What can I get you?', 'آه، زبوننا الدائم! مساء الخير! ماذا تشرب؟'),
    hello: L('Guten Abend!', 'Good evening!', 'مساء الخير!'),
    ask: L('So, was darf es sein?', 'So, what can I get you?', 'إذن، ماذا تشرب؟'),
  },
  berlin_flohmarkt: {
    regular: L('Ah, Sie sind wieder da! Schauen Sie ruhig.', 'Ah, you are back! Have a look around.', 'آه، عدت! تفضّل وانظر براحتك.'),
    hello: L('Hallo!', 'Hello!', 'أهلًا!'),
    ask: L('So, schauen Sie ruhig.', 'So, have a look around.', 'إذن، انظر براحتك.'),
  },
};

const LIKE_YES = ['ja', 'sehr', 'mag', 'liebe', 'schon', 'klar', 'toll', 'super', 'herrlich'];
const LIKE_NO = ['nein', 'nicht so', 'nicht sehr', 'mag nicht', 'zu heiss', 'zu kalt', 'kalt'];

/** the topics, by the flags' names (Tokyo's seasons and weekend; June, Tokyo's rainy season, is early summer in Berlin) */
export const BERLIN_TALK_TOPICS: Record<string, TalkTopic> = {
  spring: {
    remark: L('Endlich Frühling! Mögen Sie den Frühling?', 'Spring at last! Do you like spring?', 'أخيرًا الربيع! هل تحب الربيع؟'),
    yes: S('Ja, sehr!', 'Yes, a lot!', 'نعم، كثيرًا!'),
    no: S('Nicht so sehr.', 'Not so much.', 'ليس كثيرًا.'),
    yesReply: L('Ich auch!', 'Me too!', 'وأنا أيضًا!'),
    noReply: L('Ach so. Bald ist ja Sommer!', 'I see. Well, summer is coming soon!', 'فهمت. الصيف قادم قريبًا على أي حال!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  rainy: {
    remark: L('Der Sommer kommt! Mögen Sie den Sommer?', 'Summer is coming! Do you like summer?', 'الصيف قادم! هل تحب الصيف؟'),
    yes: S('Ja, sehr!', 'Yes, a lot!', 'نعم، كثيرًا!'),
    no: S('Nicht so sehr.', 'Not so much.', 'ليس كثيرًا.'),
    yesReply: L('Ich auch!', 'Me too!', 'وأنا أيضًا!'),
    noReply: L('Ach so. Jeder mag etwas anderes!', 'I see. Everyone likes something different!', 'فهمت. لكلٍّ ذوقه!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  summer: {
    remark: L('Heiß heute, oder? Mögen Sie den Sommer?', 'Hot today, isn’t it? Do you like summer?', 'حارّ اليوم، أليس كذلك؟ هل تحب الصيف؟'),
    yes: S('Ja, ich liebe den Sommer!', 'Yes, I love summer!', 'نعم، أحب الصيف!'),
    no: S('Nein, es ist mir zu heiß.', 'No, it’s too hot for me.', 'لا، الجو حارّ جدًا بالنسبة لي.'),
    yesReply: L('Ich auch!', 'Me too!', 'وأنا أيضًا!'),
    noReply: L('Ja, heute ist es wirklich heiß!', 'Yes, it really is hot today!', 'نعم، الجو حارّ حقًا اليوم!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  autumn: {
    remark: L('Es wird kalt. Mögen Sie den Herbst?', 'It’s getting cold. Do you like autumn?', 'الجو يبرد. هل تحب الخريف؟'),
    yes: S('Ja, der Herbst ist schön.', 'Yes, autumn is lovely.', 'نعم، الخريف جميل.'),
    no: S('Nicht so sehr.', 'Not so much.', 'ليس كثيرًا.'),
    yesReply: L('Finde ich auch!', 'I think so too!', 'وأنا أرى ذلك أيضًا!'),
    noReply: L('Ach so. Dann trinken Sie einen Kaffee, der hilft!', 'I see. Have a coffee then, that helps!', 'فهمت. اشرب قهوة إذن، فهي تساعد!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  winter: {
    remark: L('Brr, kalt heute! Mögen Sie den Winter?', 'Brr, cold today! Do you like winter?', 'برر، الجو بارد اليوم! هل تحب الشتاء؟'),
    yes: S('Ja, ich mag den Winter.', 'Yes, I like winter.', 'نعم، أحب الشتاء.'),
    no: S('Nein, mir ist zu kalt.', 'No, I’m too cold.', 'لا، أشعر ببرد شديد.'),
    yesReply: L('Schön! Ich mag ihn auch.', 'Nice! I like it too.', 'جميل! وأنا أحبه أيضًا.'),
    noReply: L('Ja, heute ist es wirklich kalt!', 'Yes, it really is cold today!', 'نعم، الجو بارد حقًا اليوم!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  weekend_before: {
    remark: L('Bald ist Wochenende! Haben Sie schon Pläne?', 'It’s almost the weekend! Do you have plans yet?', 'عطلة نهاية الأسبوع قريبة! هل لديك خطط؟'),
    yes: S('Ja, ich treffe Freunde.', 'Yes, I’m meeting friends.', 'نعم، سألتقي بأصدقاء.'),
    no: S('Nein, noch nicht.', 'No, not yet.', 'لا، ليس بعد.'),
    yesReply: L('Schön! Viel Spaß!', 'Nice! Have fun!', 'جميل! استمتع!'),
    noReply: L('Dann ruhen Sie sich aus!', 'Then get some rest!', 'إذن ارتح قليلًا!'),
    yesKeys: ['ja', 'treffe', 'fahre', 'gehe', 'besuche', 'plane'],
    noKeys: ['nein', 'noch nicht', 'keine', 'nichts'],
  },
  weekend_now: {
    remark: L('Endlich Wochenende! Haben Sie heute frei?', 'Weekend at last! Are you off today?', 'أخيرًا عطلة نهاية الأسبوع! هل أنت في إجازة اليوم؟'),
    yes: S('Ja, heute habe ich frei.', 'Yes, I’m off today.', 'نعم، أنا في إجازة اليوم.'),
    no: S('Nein, ich muss arbeiten.', 'No, I have to work.', 'لا، عليّ أن أعمل.'),
    yesReply: L('Herrlich! Genießen Sie den Tag!', 'Wonderful! Enjoy the day!', 'رائع! استمتع بيومك!'),
    noReply: L('Oh, schade!', 'Oh, what a pity!', 'أوه، يا للأسف!'),
    yesKeys: ['ja', 'habe frei', 'frei'],
    noKeys: ['nein', 'arbeiten', 'muss', 'arbeite'],
  },
  weekend_after: {
    remark: L('Wie war Ihr Wochenende?', 'How was your weekend?', 'كيف كانت عطلة نهاية أسبوعك؟'),
    yes: S('Sehr schön, danke!', 'Very nice, thanks!', 'جميلة جدًا، شكرًا!'),
    no: S('Na ja, es ging so.', 'Well, so-so.', 'حسنًا، عادية.'),
    yesReply: L('Das freut mich!', 'I’m glad!', 'يسعدني ذلك!'),
    noReply: L('Na ja, das nächste wird besser!', 'Well, the next one will be better!', 'حسنًا، القادمة ستكون أفضل!'),
    yesKeys: ['schon', 'sehr gut', 'gut', 'toll', 'super', 'herrlich'],
    noKeys: ['ging so', 'nicht so', 'schlecht', 'naja', 'na ja', 'langweilig'],
  },
};

/** A Berlin shop conversation with its regular's greeting and the small talk of every topic, all gated on the app's flags. */
export const withBerlinTalk = (sc: Scenario): Scenario => withShopTalk(sc, BERLIN_SHOP_TALK, BERLIN_TALK_TOPICS, ['nicht', 'nein']);
