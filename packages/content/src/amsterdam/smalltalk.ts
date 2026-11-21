// Amsterdam's shopkeepers know you (Dutch step 3), as Berlin's do: from the second visit they greet you as a regular (flag `regular`),
// and on some visits they make small talk about the season or the weekend (flag `talk_<topic>`, the flags the app sets for every city).
// You answer yes or no (a chip, or your own words), they reply and go back to the shop's own question. Everything stays with u.
import type { Scenario } from '../types';
import { L, S } from '../tokyo/dsl';
import { withShopTalk, type ShopTalk, type TalkTopic } from '../shoptalk';

export const AMSTERDAM_SHOP_TALK: Record<string, ShopTalk> = {
  ams_cafe: {
    regular: L('Hé, daar bent u weer! Goedemorgen! Wat mag het zijn?', 'Hey, there you are again! Good morning! What can I get you?', 'أهلًا، ها أنت مجددًا! صباح الخير! ماذا تريد؟'),
    hello: L('Goedemorgen!', 'Good morning!', 'صباح الخير!'),
    ask: L('Zo, wat mag het zijn?', 'So, what can I get you?', 'إذن، ماذا تريد؟'),
  },
  ams_kaas: {
    regular: L('Ah, u weer! Goedemiddag! Kan ik u helpen?', 'Ah, you again! Good afternoon! Can I help you?', 'آه، أنت مجددًا! مساء الخير! هل أستطيع مساعدتك؟'),
    hello: L('Goedemiddag!', 'Good afternoon!', 'مساء الخير!'),
    ask: L('Zo, waarmee kan ik u helpen?', 'So, how can I help you?', 'إذن، بماذا أستطيع مساعدتك؟'),
  },
  ams_markt: {
    regular: L('Hé, u weer! Verse stroopwafels! Hoeveel wilt u?', 'Hey, you again! Fresh stroopwafels! How many would you like?', 'أهلًا، أنت مجددًا! «ستروبفافل» طازجة! كم تريد؟'),
    hello: L('Goedemiddag!', 'Good afternoon!', 'مساء الخير!'),
    ask: L('Zo, hoeveel stroopwafels wilt u?', 'So, how many stroopwafels would you like?', 'إذن، كم «ستروبفافل» تريد؟'),
  },
  ams_snackbar: {
    regular: L('Hé, daar bent u weer! Zeg het maar!', 'Hey, there you are again! What will it be?', 'أهلًا، ها أنت مجددًا! تفضّل، ماذا تريد؟'),
    hello: L('Hallo!', 'Hi!', 'أهلًا!'),
    ask: L('Zo, zeg het maar!', 'So, what will it be?', 'إذن، تفضّل، ماذا تريد؟'),
  },
  ams_gvb: {
    regular: L('Goedendag! Fijn u weer te zien. Waarmee kan ik u helpen?', 'Good day! Nice to see you again. How can I help you?', 'نهارك سعيد! سعيدة برؤيتك مجددًا. بماذا أستطيع مساعدتك؟'),
    hello: L('Goedendag!', 'Good day!', 'نهارك سعيد!'),
    ask: L('Zo, waarmee kan ik u helpen?', 'So, how can I help you?', 'إذن، بماذا أستطيع مساعدتك؟'),
  },
};

const LIKE_YES = ['ja', 'heel erg', 'hou van', 'houd van', 'zeker', 'natuurlijk', 'leuk', 'super', 'heerlijk', 'mooi', 'prachtig', 'top'];
const LIKE_NO = ['nee', 'niet zo', 'niet echt', 'te warm', 'te heet', 'te koud', 'koud'];

/** the topics, by the flags' names (Tokyo's seasons and weekend; June, Tokyo's rainy season, is early summer in Amsterdam) */
export const AMSTERDAM_TALK_TOPICS: Record<string, TalkTopic> = {
  spring: {
    remark: L('Eindelijk lente! Houdt u van de lente?', 'Spring at last! Do you like spring?', 'أخيرًا الربيع! هل تحب الربيع؟'),
    yes: S('Ja, heel erg!', 'Yes, a lot!', 'نعم، كثيرًا!'),
    no: S('Niet zo erg.', 'Not so much.', 'ليس كثيرًا.'),
    yesReply: L('Ik ook!', 'Me too!', 'وأنا أيضًا!'),
    noReply: L('Ah, oké. Straks is het weer zomer!', 'Ah, okay. Soon it will be summer again!', 'آه، حسنًا. قريبًا سيأتي الصيف من جديد!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  rainy: {
    remark: L('De zomer komt eraan! Houdt u van de zomer?', 'Summer is coming! Do you like summer?', 'الصيف قادم! هل تحب الصيف؟'),
    yes: S('Ja, heel erg!', 'Yes, a lot!', 'نعم، كثيرًا!'),
    no: S('Niet zo erg.', 'Not so much.', 'ليس كثيرًا.'),
    yesReply: L('Ik ook!', 'Me too!', 'وأنا أيضًا!'),
    noReply: L('Ah, oké. Ieder zijn smaak!', 'Ah, okay. Each to their own!', 'آه، حسنًا. لكلٍّ ذوقه!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  summer: {
    remark: L('Warm vandaag, hè? Houdt u van de zomer?', 'Warm today, isn’t it? Do you like summer?', 'الجو حارّ اليوم، أليس كذلك؟ هل تحب الصيف؟'),
    yes: S('Ja, ik hou van de zomer!', 'Yes, I love summer!', 'نعم، أحب الصيف!'),
    no: S('Nee, het is me te warm.', 'No, it’s too hot for me.', 'لا، الجو حارّ جدًا بالنسبة لي.'),
    yesReply: L('Ik ook!', 'Me too!', 'وأنا أيضًا!'),
    noReply: L('Ja, het is echt warm vandaag!', 'Yes, it really is warm today!', 'نعم، الجو حارّ حقًا اليوم!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  autumn: {
    remark: L('Het wordt koud. Houdt u van de herfst?', 'It’s getting cold. Do you like autumn?', 'الجو يبرد. هل تحب الخريف؟'),
    yes: S('Ja, de herfst is mooi.', 'Yes, autumn is lovely.', 'نعم، الخريف جميل.'),
    no: S('Niet zo erg.', 'Not so much.', 'ليس كثيرًا.'),
    yesReply: L('Vind ik ook!', 'I think so too!', 'وأنا أرى ذلك أيضًا!'),
    noReply: L('Ah, oké. Neem dan een warme koffie, dat helpt!', 'Ah, okay. Have a hot coffee then, that helps!', 'آه، حسنًا. اشرب قهوة ساخنة إذن، فهي تساعد!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  winter: {
    remark: L('Brr, koud vandaag! Houdt u van de winter?', 'Brr, cold today! Do you like winter?', 'برر، الجو بارد اليوم! هل تحب الشتاء؟'),
    yes: S('Ja, ik hou van de winter.', 'Yes, I like winter.', 'نعم، أحب الشتاء.'),
    no: S('Nee, ik heb het koud.', 'No, I’m cold.', 'لا، أشعر بالبرد.'),
    yesReply: L('Leuk! Ik ook.', 'Nice! Me too.', 'جميل! وأنا أيضًا.'),
    noReply: L('Ja, het is echt koud vandaag!', 'Yes, it really is cold today!', 'نعم، الجو بارد حقًا اليوم!'),
    yesKeys: LIKE_YES,
    noKeys: LIKE_NO,
  },
  weekend_before: {
    remark: L('Bijna weekend! Heeft u al plannen?', 'It’s almost the weekend! Do you have plans yet?', 'عطلة نهاية الأسبوع قريبة! هل لديك خطط؟'),
    yes: S('Ja, ik zie vrienden.', 'Yes, I’m seeing friends.', 'نعم، سألتقي بأصدقاء.'),
    no: S('Nee, nog niet.', 'No, not yet.', 'لا، ليس بعد.'),
    yesReply: L('Leuk! Veel plezier!', 'Nice! Have fun!', 'جميل! استمتع!'),
    noReply: L('Lekker uitrusten dan!', 'Have a nice rest then!', 'إذن ارتح جيدًا!'),
    yesKeys: ['ja', 'zie', 'ga', 'bezoek', 'vrienden', 'familie'],
    noKeys: ['nee', 'nog niet', 'geen', 'niets', 'niks'],
  },
  weekend_now: {
    remark: L('Eindelijk weekend! Bent u vandaag vrij?', 'Weekend at last! Are you off today?', 'أخيرًا عطلة نهاية الأسبوع! هل أنت في إجازة اليوم؟'),
    yes: S('Ja, vandaag ben ik vrij.', 'Yes, I’m off today.', 'نعم، أنا في إجازة اليوم.'),
    no: S('Nee, ik moet werken.', 'No, I have to work.', 'لا، عليّ أن أعمل.'),
    yesReply: L('Heerlijk! Geniet ervan!', 'Wonderful! Enjoy it!', 'رائع! استمتع بها!'),
    noReply: L('O, jammer!', 'Oh, what a pity!', 'أوه، يا للأسف!'),
    yesKeys: ['ja', 'vrij'],
    noKeys: ['nee', 'werken', 'moet', 'werk'],
  },
  weekend_after: {
    remark: L('Hoe was uw weekend?', 'How was your weekend?', 'كيف كانت عطلة نهاية أسبوعك؟'),
    yes: S('Heel leuk, dank u!', 'Very nice, thank you!', 'جميلة جدًا، شكرًا!'),
    no: S('Gaat wel.', 'So-so.', 'عادية.'),
    yesReply: L('Wat fijn!', 'How lovely!', 'ما أجمل ذلك!'),
    noReply: L('Nou ja, het volgende wordt beter!', 'Oh well, the next one will be better!', 'حسنًا، القادمة ستكون أفضل!'),
    yesKeys: ['leuk', 'goed', 'fijn', 'super', 'top', 'heerlijk', 'gezellig', 'prima'],
    noKeys: ['gaat wel', 'niet zo', 'slecht', 'saai', 'matig'],
  },
};

/** An Amsterdam shop conversation with its regular's greeting and the small talk of every topic, all gated on the app's flags. */
export const withAmsterdamTalk = (sc: Scenario): Scenario => withShopTalk(sc, AMSTERDAM_SHOP_TALK, AMSTERDAM_TALK_TOPICS, ['niet', 'nee']);
