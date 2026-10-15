import type { IntentDef, Line, SayVariant, Scenario, SceneNode, Suggestion } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Hang-outs and home visits (Release 2 wave B1, docs/GAME_DESIGN.md §8.8). Everything here pays hearts and AP, never yen (`pay: 'none'`).
//
//  - four HANG-OUTS (♥3, 6-8 minutes, one per 3 days): hang_mio_photo (park), hang_yuki_jam (café after hours), hang_kenji_cook (ramen
//    kitchen), hang_aiko_wagashi (the tea house's back room);
//  - three HOME VISITS (♥4) on the shared `home_visit` template: enter (おじゃまします) -> offer (いただきます) -> look (いい部屋ですね, or ask
//    about a prop) -> the unique step of the home -> leave (おじゃましました。ありがとうございました。). The genkan (shoes off, then slippers) is NOT a
//    conversation node: the app plays it first and starts the scenario after `genkan_ok` (the host lines for it are in `game/homes.ts`).
//
// HOST CONTRACT (the only flag these scenarios read; without it every line is the polite, plain one, so they also run on their own):
//   casual   the friend speaks plain form (Mio from ♥2, Yuki and Kenji from ♥3: `FriendDef.casualAt`). Aiko is polite and soft at every heart.
// The learner always speaks polite or neutral form (a guest's register). Hina has no voice of her own (a scenario has one speaker): Kenji
// relays her three questions. Rewards (a keepsake, a cosmetic flag, the wagashi) are `ScenarioMeta.effects`, applied once on the first completion.

/** the plain line when the friend is `casual`, the polite one otherwise */
const reg = (plain: Line, polite: Line): SayVariant[] => [say(plain, { flag: 'casual' }), say(polite)];
const same = (l: Line): SayVariant[] => [say(l)];

const THANKS = ['ありがとう', 'たのしかった', 'うれしい', 'よかった'];

/** the listening node every hang-out and visit ends on */
const endNode = (say_: SayVariant[], chip: Suggestion = S('また|ね！', 'See you!', 'إلى اللقاء!')): SceneNode =>
  node({ id: 'end', emotion: 'happy', say: say_, end: true, suggestions: [chip], intents: [] });

// ---------------------------------------------------------------------------------------------------------------
// hang_mio_photo: a photo walk in the park (pose, name three things, pick the best photo, thank)
// ---------------------------------------------------------------------------------------------------------------

/** slot `seeThing`: what the learner sees in the park (the same slot is used for all three answers) */
const SEE_IDEAL = L('{seeThing}|が|見えます。', 'I see {seeThing}.', 'أرى {seeThing}.');
const seeThing = (next: string, step?: string): IntentDef => ({ id: 'thing', slot: 'seeThing', slotRequired: true, next, ...(step ? { step } : {}), ideal: SEE_IDEAL });
const seeChips = (a: string, aEn: string, aAr: string, b: string, bEn: string, bAr: string, c: string, cEn: string, cAr: string): Suggestion[] => [
  S(`${a}|が|見えます。`, `I see ${aEn}.`, `أرى ${aAr}.`),
  S(`${b}|が|見えます。`, `I see ${bEn}.`, `أرى ${bAr}.`),
  S(`${c}|が|見えます。`, `I see ${cEn}.`, `أرى ${cAr}.`),
];

export const HANG_MIO_PHOTO: Scenario = {
  id: 'hang_mio_photo',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Photo walk with Mio', ar: 'جولة تصوير مع ميو' },
  setup: {
    en: 'Mio wants to take your photo in the park. Pose for her, name three things you can see, pick the best photo and say thank you.',
    ar: 'تريد ميو أن تلتقط لك صورة في الحديقة. قف بوضعية للصورة، وسمِّ ثلاثة أشياء تراها، واختر أفضل صورة، ثم اشكرها.',
  },
  minutes: 7,
  steps: [
    { id: 'pose', text: { en: 'Pose for the photo', ar: 'قف بوضعية للصورة' } },
    { id: 'see', text: { en: 'Name three things you see', ar: 'سمِّ ثلاثة أشياء تراها' } },
    { id: 'pick', text: { en: 'Pick the best photo', ar: 'اختر أفضل صورة' } },
    { id: 'thank', text: { en: 'Say thank you', ar: 'قل شكرًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: reg(
        L('{name}、|写真|を|とる|よ！|ポーズ|を|して！', '{name}, I will take your photo! Strike a pose!', '{name}، سألتقط لك صورة! خذ وضعية!'),
        L('{name}|さん、|写真|を|とります|よ。|ポーズ|を|して|ください。', '{name}, I will take your photo. Please strike a pose.', '{name}، سألتقط لك صورة. من فضلك خذ وضعية.'),
      ),
      suggestions: [S('はい、|ポーズ|します。', 'Yes, I will pose.', 'نعم، سأقف بوضعية.'), S('ピース！', 'Peace sign!', 'علامة النصر!'), S('これ|で|いい|です|か？', 'Is this all right?', 'هل هذا مناسب؟')],
      intents: [
        { id: 'pose', any: ['ポーズ', 'ピース', 'これでいいですか', 'はい', 'いいですよ', 'おねがい'], next: 'see', step: 'pose', ideal: L('はい、|ポーズ|します。', 'Yes, I will pose.', 'نعم، سأقف بوضعية.') },
      ],
    }),
    node({
      id: 'see',
      emotion: 'happy',
      say: reg(
        L('いい|ね！|何|が|見える？|みっつ|教えて！', 'Nice! What can you see? Tell me three things!', 'جميل! ماذا ترى؟ أخبرني بثلاثة أشياء!'),
        L('いい|です|ね。|何|が|見えます|か？|みっつ|教えて|ください。', 'Nice. What can you see? Please tell me three things.', 'جميل. ماذا ترى؟ أخبرني بثلاثة أشياء من فضلك.'),
      ),
      suggestions: seeChips('桜', 'cherry blossoms', 'أشجار الكرز', '空', 'the sky', 'السماء', '花', 'flowers', 'الزهور'),
      intents: [seeThing('see2')],
    }),
    node({
      id: 'see2',
      emotion: 'happy',
      say: reg(
        L('{seeThing}、|いい|ね！|ほか|に|は？', '{seeThing}, nice! What else?', '{seeThing}، جميل! وماذا أيضًا؟'),
        L('{seeThing}|です|ね。|ほか|に|何|が|見えます|か？', '{seeThing}, I see. What else can you see?', '{seeThing}، حسنًا. وماذا ترى أيضًا؟'),
      ),
      suggestions: seeChips('猫', 'a cat', 'قطة', '鳥', 'a bird', 'طائرًا', '空', 'the sky', 'السماء'),
      intents: [seeThing('see3')],
    }),
    node({
      id: 'see3',
      emotion: 'excited',
      say: reg(
        L('{seeThing}、|いい|ね！|あと|ひとつ！', '{seeThing}, nice! One more!', '{seeThing}، جميل! واحد آخر!'),
        L('{seeThing}|です|ね。|あと|ひとつ|教えて|ください。', '{seeThing}, I see. Please tell me one more.', '{seeThing}، حسنًا. أخبرني بواحد آخر من فضلك.'),
      ),
      suggestions: seeChips('池', 'a pond', 'بركة', '花', 'flowers', 'الزهور', '桜', 'cherry blossoms', 'أشجار الكرز'),
      intents: [seeThing('pick', 'see')],
    }),
    node({
      id: 'pick',
      emotion: 'happy',
      say: reg(
        L('たくさん|見えた|ね！|写真|を|見て！|こっち|と|あっち、|どっち|が|いい？', 'You saw a lot! Look at the photos! This one or that one, which is better?', 'رأيت الكثير! انظر إلى الصور! هذه أم تلك، أيهما أفضل؟'),
        L('たくさん|見えました|ね。|写真|を|見て|ください。|こっち|と|あっち、|どっち|が|いい|です|か？', 'You saw a lot. Please look at the photos. This one or that one, which is better?', 'رأيت الكثير. انظر إلى الصور من فضلك. هذه أم تلك، أيهما أفضل؟'),
      ),
      suggestions: [S('こっち|が|いい|です。', 'This one is better.', 'هذه أفضل.'), S('あっち|が|いい|です。', 'That one is better.', 'تلك أفضل.'), S('どっち|も|いい|です。', 'Both are good.', 'كلتاهما جيدة.')],
      intents: [{ id: 'choose', any: ['こっち', 'あっち', 'どっち', 'これ', 'それ'], next: 'thanks', step: 'pick', ideal: L('こっち|が|いい|です。', 'This one is better.', 'هذه أفضل.') }],
    }),
    node({
      id: 'thanks',
      emotion: 'excited',
      say: reg(
        L('いい|ね！|わたし|も|それ|が|好き！|この|写真|を|あげる|ね。', 'Nice! I like that one too! I will give you this photo.', 'جميل! أنا أحبها أيضًا! سأعطيك هذه الصورة.'),
        L('いい|です|ね。|わたし|も|それ|が|好き|です。|この|写真|を|あげます|ね。', 'Nice. I like that one too. I will give you this photo.', 'جميل. أنا أحبها أيضًا. سأعطيك هذه الصورة.'),
      ),
      suggestions: [S('ありがとう！', 'Thank you!', 'شكرًا!'), S('ありがとう|ございます。|うれしい|です！', 'Thank you very much. I am happy!', 'شكرًا جزيلًا. أنا سعيد!'), S('今日|は|楽しかった|です。', 'I had fun today.', 'استمتعت اليوم.')],
      intents: [{ id: 'thank', any: THANKS, next: 'end', step: 'thank' }],
    }),
    endNode(reg(L('わたし|も|楽しかった！|また|ね！', 'I had fun too! See you!', 'استمتعت أنا أيضًا! إلى اللقاء!'), L('わたし|も|楽しかった|です。|また|ね。', 'I had fun too. See you.', 'استمتعت أنا أيضًا. إلى اللقاء.'))),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// hang_yuki_jam: after closing, Yuki plays (genre, what music you like, compliment her playing, request a song)
// ---------------------------------------------------------------------------------------------------------------

export const HANG_YUKI_JAM: Scenario = {
  id: 'hang_yuki_jam',
  locationId: 'cafe',
  characterId: 'yuki',
  level: 'A2',
  title: { en: 'Jam session with Yuki', ar: 'جلسة عزف مع يوكي' },
  setup: {
    en: 'The café is closed and Yuki picks up her guitar. Choose a genre, say what music you like, compliment her playing and ask for a song.',
    ar: 'أُغلق المقهى وأمسكت يوكي بغيتارها. اختر نوع الموسيقى، وقل ما تحب من الموسيقى، وامدح عزفها، واطلب أغنية.',
  },
  minutes: 7,
  steps: [
    { id: 'genre', text: { en: 'Choose a genre', ar: 'اختر نوع الموسيقى' } },
    { id: 'like', text: { en: 'Say what music you like', ar: 'قل ما تحب من الموسيقى' } },
    { id: 'praise', text: { en: 'Compliment her playing', ar: 'امدح عزفها' } },
    { id: 'request', text: { en: 'Request a song', ar: 'اطلب أغنية' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: reg(
        L('お店|は|もう|終わり|だ|よ。|ギター|を|弾く|ね。|ジャンル|は|何|が|いい？', 'The shop is closed now. I will play the guitar. Which genre do you want?', 'أُغلق المقهى الآن. سأعزف الغيتار. أي نوع من الموسيقى تريد؟'),
        L('お店|は|もう|終わり|です。|ギター|を|弾きます|ね。|ジャンル|は|何|が|いい|です|か？', 'The shop is closed now. I will play the guitar. Which genre do you want?', 'أُغلق المقهى الآن. سأعزف الغيتار. أي نوع من الموسيقى تريد؟'),
      ),
      suggestions: [S('ロック|が|いい|です。', 'Rock, please.', 'الروك من فضلك.'), S('ジャズ|が|いい|です。', 'Jazz, please.', 'الجاز من فضلك.'), S('ポップ|が|いい|です。', 'Pop, please.', 'البوب من فضلك.')],
      intents: [{ id: 'genre', slot: 'jamGenre', slotRequired: true, next: 'like', step: 'genre', ideal: L('{jamGenre}|が|いい|です。', '{jamGenre}, please.', '{jamGenre} من فضلك.') }],
    }),
    node({
      id: 'like',
      emotion: 'happy',
      say: reg(
        L('{jamGenre}、|いい|ね！|{name}|は|どんな|音楽|が|好き？', '{jamGenre}, nice! {name}, what kind of music do you like?', '{jamGenre}، جميل! {name}، ما نوع الموسيقى التي تحبها؟'),
        L('{jamGenre}|です|ね。|{name}|さん|は|どんな|音楽|が|好き|です|か？', '{jamGenre}, I see. {name}, what kind of music do you like?', '{jamGenre}، حسنًا. {name}، ما نوع الموسيقى التي تحبها؟'),
      ),
      suggestions: [S('日本|の|歌|が|好き|です。', 'I like Japanese songs.', 'أحب الأغاني اليابانية.'), S('いろいろ|聞きます。', 'I listen to all kinds.', 'أستمع إلى أنواع مختلفة.'), S('ギター|の|音楽|が|好き|です。', 'I like guitar music.', 'أحب موسيقى الغيتار.')],
      intents: [{ id: 'likes', any: ['すき', 'おんがく', 'うた', 'きき', 'ききます'], next: 'play', step: 'like' }],
    }),
    node({
      id: 'play',
      emotion: 'excited',
      say: reg(
        L('じゃあ、|弾く|よ。|…|どう？', 'Then I will play. ... How was it?', 'إذًا سأعزف. ... كيف كان؟'),
        L('では、|弾きます。|…|どう|でした|か？', 'Then I will play. ... How was it?', 'إذًا سأعزف. ... كيف كان؟'),
      ),
      suggestions: [S('上手|です|ね！', 'You play well!', 'تعزفين بمهارة!'), S('ギター|が|上手|です|ね。', 'You are good at the guitar.', 'أنتِ بارعة في الغيتار.'), S('すごい|です！', 'That is amazing!', 'هذا رائع!')],
      intents: [{ id: 'praise', any: ['じょうず', 'すごい', 'すてき', 'いいですね', 'きれい'], next: 'request', step: 'praise', ideal: L('上手|です|ね！', 'You play well!', 'تعزفين بمهارة!') }],
    }),
    node({
      id: 'request',
      emotion: 'happy',
      say: reg(
        L('ありがとう！|うれしい。|リクエスト|は|ある？', 'Thank you! I am happy. Do you have a request?', 'شكرًا! أنا سعيدة. هل لديك طلب؟'),
        L('ありがとう|ございます。|うれしい|です。|リクエスト|は|あります|か？', 'Thank you. I am happy. Do you have a request?', 'شكرًا. أنا سعيدة. هل لديك طلب؟'),
      ),
      suggestions: [S('桜|の|歌|を|お願いします。', 'The cherry blossom song, please.', 'أغنية أزهار الكرز من فضلك.'), S('もう|一|曲|お願いします。', 'One more song, please.', 'أغنية أخرى من فضلك.'), S('好きな|曲|を|弾いて|ください。', 'Please play a song you like.', 'اعزفي أغنية تحبينها من فضلك.')],
      intents: [{ id: 'request', any: ['おねがい', 'ひいて', 'ひいてください', 'きょく', 'うた', 'リクエスト'], request: true, next: 'end', step: 'request', ideal: L('もう|一|曲|お願いします。', 'One more song, please.', 'أغنية أخرى من فضلك.') }],
    }),
    endNode(
      reg(L('いい|よ！|じゃあ、|もう|一|曲。|…|楽しかった！|また|ね！', 'Sure! Then one more song. ... That was fun! See you!', 'حسنًا! إذًا أغنية أخرى. ... كان ممتعًا! إلى اللقاء!'), L('いい|です|よ。|では、|もう|一|曲。|…|楽しかった|です。|また|ね。', 'Sure. Then one more song. ... That was fun. See you.', 'حسنًا. إذًا أغنية أخرى. ... كان ممتعًا. إلى اللقاء.')),
    ),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// hang_kenji_cook: in the ramen kitchen (name three ingredients, follow the steps, taste, ごちそうさま)
// ---------------------------------------------------------------------------------------------------------------

const ING_IDEAL = L('{ingredient}|です。', 'It is {ingredient}.', 'إنه {ingredient}.');
const ingredient = (next: string, step?: string): IntentDef => ({ id: 'ingredient', slot: 'ingredient', slotRequired: true, next, ...(step ? { step } : {}), ideal: ING_IDEAL });
const ingChips = (a: string, aEn: string, aAr: string, b: string, bEn: string, bAr: string, c: string, cEn: string, cAr: string): Suggestion[] => [
  S(`${a}|です。`, `It is ${aEn}.`, `إنه ${aAr}.`),
  S(`${b}|です。`, `It is ${bEn}.`, `إنه ${bAr}.`),
  S(`${c}|です。`, `It is ${cEn}.`, `إنه ${cAr}.`),
];

export const HANG_KENJI_COOK: Scenario = {
  id: 'hang_kenji_cook',
  locationId: 'ramen',
  characterId: 'kenji',
  level: 'A2',
  title: { en: 'Cooking with Kenji', ar: 'الطبخ مع كينجي' },
  setup: {
    en: "Kenji lets you into the ramen kitchen. Name three ingredients, follow his steps, taste the soup (it may need a little more salt) and say ごちそうさまでした.",
    ar: 'يُدخلك كينجي إلى مطبخ الرامن. سمِّ ثلاث مكوّنات، واتبع خطواته، وتذوّق الحساء (قد يحتاج إلى قليل من الملح)، وقل ごちそうさまでした.',
  },
  minutes: 7,
  steps: [
    { id: 'ingredients', text: { en: 'Name three ingredients', ar: 'سمِّ ثلاث مكوّنات' } },
    { id: 'steps', text: { en: 'Follow the steps: cut and put in', ar: 'اتبع الخطوات: قطّع وأضف' } },
    { id: 'taste', text: { en: 'Taste the soup', ar: 'تذوّق الحساء' } },
    { id: 'thanks', text: { en: 'Say ごちそうさまでした', ar: 'قل ごちそうさまでした' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: reg(
        L('おう、|{name}！|今日|は|ラーメン|を|作る|ぞ。|材料|を|みっつ|教えて|くれ！', 'Hey, {name}! Today we make ramen. Tell me three ingredients!', 'مرحبًا يا {name}! اليوم نصنع الرامن. أخبرني بثلاث مكوّنات!'),
        L('{name}|さん、|今日|は|ラーメン|を|作ります。|材料|を|みっつ|教えて|ください。', '{name}, today we make ramen. Please tell me three ingredients.', '{name}، اليوم نصنع الرامن. أخبرني بثلاث مكوّنات من فضلك.'),
      ),
      suggestions: ingChips('ねぎ', 'green onion', 'البصل الأخضر', '卵', 'an egg', 'البيض', '麺', 'noodles', 'النودلز'),
      intents: [ingredient('ing2')],
    }),
    node({
      id: 'ing2',
      emotion: 'happy',
      say: reg(L('おう、|{ingredient}|だ|な。|次|は？', 'Yeah, {ingredient}. What is next?', 'نعم، {ingredient}. وما التالي؟'), L('{ingredient}|です|ね。|次|は|何|です|か？', '{ingredient}, I see. What is next?', '{ingredient}، حسنًا. وما التالي؟')),
      suggestions: ingChips('チャーシュー', 'chashu pork', 'لحم التشاشو', 'もやし', 'bean sprouts', 'براعم الفاصولياء', 'スープ', 'soup', 'الحساء'),
      intents: [ingredient('ing3')],
    }),
    node({
      id: 'ing3',
      emotion: 'happy',
      say: reg(L('{ingredient}|も|いい|ぞ。|あと|ひとつ！', '{ingredient} is good too. One more!', '{ingredient} جيد أيضًا. واحد آخر!'), L('{ingredient}|も|いい|です|ね。|あと|ひとつ|お願いします。', '{ingredient} is good too. One more, please.', '{ingredient} جيد أيضًا. واحد آخر من فضلك.')),
      suggestions: ingChips('ねぎ', 'green onion', 'البصل الأخضر', '麺', 'noodles', 'النودلز', '卵', 'an egg', 'البيض'),
      intents: [ingredient('steps', 'ingredients')],
    }),
    node({
      id: 'steps',
      emotion: 'excited',
      say: reg(
        L('よし！|まず|ねぎ|を|切れ。|それ|から、|スープ|に|入れろ！', 'Good! First cut the green onion. Then put it in the soup!', 'جيد! أولًا قطّع البصل الأخضر. ثم أضفه إلى الحساء!'),
        L('では、|まず|ねぎ|を|切って、|スープ|に|入れて|ください。', 'Then first cut the green onion and put it in the soup, please.', 'إذًا قطّع البصل الأخضر أولًا وأضفه إلى الحساء من فضلك.'),
      ),
      suggestions: [S('ねぎ|を|切って、|スープ|に|入れます。', 'I cut the green onion and put it in the soup.', 'أقطّع البصل الأخضر وأضعه في الحساء.'), S('ねぎ|を|切ります。', 'I cut the green onion.', 'أقطّع البصل الأخضر.'), S('スープ|に|入れます。', 'I put it in the soup.', 'أضعه في الحساء.')],
      intents: [{ id: 'cook', any: ['きって', 'きります', 'いれます', 'いれて', 'きる', 'いれる'], next: 'taste', step: 'steps' }],
    }),
    node({
      id: 'taste',
      emotion: 'happy',
      say: reg(
        L('できた！|食べて|みろ。|どう|だ？', 'Done! Try it. How is it?', 'انتهينا! جرّبه. كيف هو؟'),
        L('できました。|食べて|みて|ください。|どう|です|か？', 'It is done. Please try it. How is it?', 'انتهينا. جرّبه من فضلك. كيف هو؟'),
      ),
      suggestions: [S('もう|少し|塩|が|いい|です。', 'It needs a little more salt.', 'يحتاج إلى قليل من الملح.'), S('おいしい|です！', 'It is delicious!', 'إنه لذيذ!'), S('いただきます。', 'Itadakimasu.', 'إيتاداكيماس.')],
      intents: [
        { id: 'salt', any: ['しお', 'すこし', 'もうすこし'], next: 'finish', step: 'taste', ideal: L('もう|少し|塩|が|いい|です。', 'It needs a little more salt.', 'يحتاج إلى قليل من الملح.') },
        { id: 'tasty', any: ['おいしい', 'うまい', 'いただきます'], next: 'finish', step: 'taste' },
      ],
    }),
    node({
      id: 'finish',
      emotion: 'excited',
      say: reg(L('よし！|全部|食べろ。|うまい|ぞ！', 'Good! Eat it all. It is tasty!', 'جيد! كُله كله. إنه لذيذ!'), L('全部|食べて|ください|ね。|おいしい|です|よ。', 'Please eat it all. It is delicious.', 'كُله كله من فضلك. إنه لذيذ.')),
      suggestions: [S('ごちそうさまでした。', 'Gochisosama deshita.', 'غوتشيسوساما ديشيتا.'), S('おいしかった|です。|ごちそうさまでした。', 'It was delicious. Gochisosama deshita.', 'كان لذيذًا. غوتشيسوساما ديشيتا.'), S('ありがとう|ございました。', 'Thank you very much.', 'شكرًا جزيلًا.')],
      intents: [{ id: 'gochisosama', any: ['ごちそうさま', 'ありがとう', 'おいしかった'], next: 'end', step: 'thanks' }],
    }),
    endNode(reg(L('おう！|また|来い|よ。', 'Hey! Come again.', 'أهلًا! تعال مجددًا.'), L('また|来て|ください|ね。', 'Please come again.', 'تعال مجددًا من فضلك.'))),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// hang_aiko_wagashi: in the back room of the tea house (count the sweets, choose shape and colour, say it is pretty or tasty, thank)
// ---------------------------------------------------------------------------------------------------------------

export const HANG_AIKO_WAGASHI: Scenario = {
  id: 'hang_aiko_wagashi',
  locationId: 'ono',
  characterId: 'aiko',
  level: 'A1',
  title: { en: 'Making wagashi with Aiko', ar: 'صنع الواغاشي مع أيكو' },
  setup: {
    en: "Aiko invites you to the tea house's back room to make wagashi. Say how many to make, choose a shape and a colour, say it is pretty or tasty, and thank her.",
    ar: 'تدعوك أيكو إلى الغرفة الخلفية في بيت الشاي لصنع الواغاشي. قل كم قطعة تصنعان، واختر الشكل واللون، وقل إنها جميلة أو لذيذة، واشكرها.',
  },
  minutes: 6,
  steps: [
    { id: 'count', text: { en: 'Say how many to make', ar: 'قل كم قطعة تصنعان' } },
    { id: 'choose', text: { en: 'Choose a shape and a colour', ar: 'اختر الشكل واللون' } },
    { id: 'praise', text: { en: 'Say it is pretty or tasty', ar: 'قل إنها جميلة أو لذيذة' } },
    { id: 'thank', text: { en: 'Thank Aiko', ar: 'اشكر أيكو' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: same(L('ようこそ、|奥|の|部屋|へ。|今日|は|和菓子|を|作りましょう。|いくつ|作りましょう|か？', 'Welcome to the back room. Today let us make wagashi. How many shall we make?', 'أهلًا بك في الغرفة الخلفية. اليوم لنصنع الواغاشي. كم قطعة نصنع؟')),
      suggestions: [S('みっつ|作りましょう。', 'Let us make three.', 'لنصنع ثلاث قطع.'), S('ふたつ|作りましょう。', 'Let us make two.', 'لنصنع قطعتين.'), S('ひとつ|作りましょう。', 'Let us make one.', 'لنصنع قطعة واحدة.')],
      intents: [{ id: 'count', slot: 'sweetCount', slotRequired: true, next: 'shape', step: 'count', ideal: L('{sweetCount}|作りましょう。', 'Let us make {sweetCount}.', 'لنصنع {sweetCount}.') }],
    }),
    node({
      id: 'shape',
      emotion: 'happy',
      say: same(L('{sweetCount}|です|ね。|形|は|どう|しましょう|か？', '{sweetCount}, I see. What shape shall we make?', '{sweetCount}، حسنًا. ما الشكل الذي نصنعه؟')),
      suggestions: [S('丸|が|いい|です。', 'Round, please.', 'دائري من فضلك.'), S('四角|が|いい|です。', 'Square, please.', 'مربّع من فضلك.'), S('花|が|いい|です。', 'A flower, please.', 'على شكل زهرة من فضلك.')],
      intents: [{ id: 'shape', slot: 'wagashiShape', slotRequired: true, next: 'colour', ideal: L('{wagashiShape}|が|いい|です。', '{wagashiShape}, please.', '{wagashiShape} من فضلك.') }],
    }),
    node({
      id: 'colour',
      emotion: 'happy',
      say: same(L('いい|です|ね。|色|は|何|が|いい|です|か？', 'That is nice. Which colour would you like?', 'جميل. أي لون تريد؟')),
      suggestions: [S('ピンク|が|いい|です。', 'Pink, please.', 'وردي من فضلك.'), S('白|が|いい|です。', 'White, please.', 'أبيض من فضلك.'), S('赤|が|いい|です。', 'Red, please.', 'أحمر من فضلك.')],
      intents: [{ id: 'colour', slot: 'wrapColour', slotOptions: ['pink', 'white', 'red'], slotRequired: true, next: 'eat', step: 'choose', ideal: L('{wrapColour}|が|いい|です。', '{wrapColour}, please.', '{wrapColour} من فضلك.') }],
    }),
    node({
      id: 'eat',
      emotion: 'excited',
      say: same(L('できました。|{wrapColour}|の|お菓子|です|よ。|どうぞ、|食べて|みて|ください。', 'It is ready. It is a {wrapColour} sweet. Please try it.', 'أصبحت جاهزة. إنها حلوى بلون {wrapColour}. جرّبها من فضلك.')),
      suggestions: [S('きれい|です|ね！', 'It is pretty!', 'إنها جميلة!'), S('おいしい|です！', 'It is delicious!', 'إنها لذيذة!'), S('甘い|です|ね。', 'It is sweet.', 'إنها حلوة.')],
      intents: [{ id: 'praise', any: ['きれい', 'おいしい', 'あまい', 'すてき'], next: 'thanks', step: 'praise', ideal: L('きれい|です|ね！', 'It is pretty!', 'إنها جميلة!') }],
    }),
    node({
      id: 'thanks',
      emotion: 'happy',
      say: same(L('ふふ、|よかった。|これ|は|お土産|です。|持って|帰って|ください|ね。', 'Hehe, I am glad. This is a gift for you. Please take it home.', 'هههه، يسعدني ذلك. هذه هدية لك. خذها معك إلى البيت من فضلك.')),
      suggestions: [S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('今日|は|楽しかった|です。', 'I had fun today.', 'استمتعت اليوم.'), S('大切|に|食べます。', 'I will eat it with care.', 'سآكلها باهتمام.')],
      intents: [{ id: 'thanks', any: ['ありがとう', 'たのしかった', 'たいせつ', 'いただきます'], next: 'end', step: 'thank' }],
    }),
    endNode(same(L('こちら|こそ、|ありがとう|ございました。|また|いつでも|どうぞ。', 'Thank you too. Please come any time.', 'شكرًا لك أيضًا. تعال في أي وقت من فضلك.')), S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.')),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the home_visit template: enter -> offer -> look -> (unique) -> leave
// ---------------------------------------------------------------------------------------------------------------

export const HOME_STEPS = [
  { id: 'enter', text: { en: 'Say おじゃまします', ar: 'قل おじゃまします' } },
  { id: 'offer', text: { en: 'Accept the tea', ar: 'اقبل الشاي' } },
  { id: 'look', text: { en: 'Compliment the room or ask about something', ar: 'امدح الغرفة أو اسأل عن شيء' } },
  { id: 'unique', text: { en: 'Join in', ar: 'شارك' } },
  { id: 'leave', text: { en: 'Say おじゃましました', ar: 'قل おじゃましました' } },
];
const homeSteps = (unique: { en: string; ar: string }) => HOME_STEPS.map((s) => (s.id === 'unique' ? { id: s.id, text: unique } : s));

interface HomeSpec {
  id: string;
  locationId: string;
  characterId: string;
  title: Scenario['title'];
  setup: Scenario['setup'];
  uniqueStep: { en: string; ar: string };
  minutes: number;
  /** what the host says at the door, when offering tea, and when the learner looks around (`look`) */
  enter: SayVariant[];
  offer: SayVariant[];
  look: SayVariant[];
  /** the nodes of the unique step: the first is entered from `look`, the last leaves for `leave` */
  unique: SceneNode[];
  leave: SayVariant[];
  end: SayVariant[];
}

const ENTER_CHIPS = [S('おじゃまします。', 'Ojamashimasu (excuse me for coming in).', 'عن إذنك (أدخل بيتك).'), S('こんにちは。|おじゃまします。', 'Hello. Ojamashimasu.', 'مرحبًا. عن إذنك.'), REPEAT_S];
const OFFER_CHIPS = [S('いただきます。', 'Itadakimasu.', 'إيتاداكيماس.'), S('ありがとう|ございます。|いただきます。', 'Thank you. Itadakimasu.', 'شكرًا. إيتاداكيماس.'), S('はい、|お願いします。', 'Yes, please.', 'نعم، من فضلك.')];
const LOOK_CHIPS = [S('いい|部屋|です|ね。', 'This is a nice room.', 'إنها غرفة جميلة.'), S('きれい|な|部屋|です|ね。', 'This is a pretty room.', 'إنها غرفة نظيفة وجميلة.'), S('あれ|は|何|です|か？', 'What is that?', 'ما ذاك؟')];
const LEAVE_CHIPS = [S('おじゃましました。|ありがとう|ございました。', 'Ojamashimashita. Thank you very much.', 'عن إذنك (أغادر). شكرًا جزيلًا.'), S('今日|は|ありがとう|ございました。', 'Thank you for today.', 'شكرًا على اليوم.'), S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.')];

function homeVisit(h: HomeSpec): Scenario {
  const first = h.unique[0]!.id;
  return {
    id: h.id,
    locationId: h.locationId,
    characterId: h.characterId,
    level: 'A2',
    title: h.title,
    setup: h.setup,
    minutes: h.minutes,
    steps: homeSteps(h.uniqueStep),
    start: 'enter',
    nodes: asRecord([
      node({
        id: 'enter',
        emotion: 'happy',
        say: h.enter,
        suggestions: ENTER_CHIPS,
        intents: [{ id: 'ojama', any: ['おじゃま', 'おじゃまします'], next: 'offer', step: 'enter', ideal: L('おじゃまします。', 'Ojamashimasu.', 'عن إذنك.') }],
      }),
      node({
        id: 'offer',
        emotion: 'happy',
        say: h.offer,
        suggestions: OFFER_CHIPS,
        intents: [{ id: 'accept', any: ['いただきます', 'ありがとう', 'おねがい', 'はい'], next: 'look', step: 'offer', ideal: L('いただきます。', 'Itadakimasu.', 'إيتاداكيماس.') }],
      }),
      node({
        id: 'look',
        emotion: 'neutral',
        say: h.look,
        suggestions: LOOK_CHIPS,
        intents: [
          { id: 'compliment', all: [['へや'], ['いい', 'きれい', 'すてき', 'ひろい', 'あたたかい', 'すごい']], next: first, step: 'look', ideal: L('いい|部屋|です|ね。', 'This is a nice room.', 'إنها غرفة جميلة.') },
          { id: 'ask_prop', any: ['なに', 'あれ', 'これ', 'それ'], none: ['へや'], next: first, step: 'look' },
        ],
      }),
      ...h.unique,
      node({
        id: 'leave',
        emotion: 'neutral',
        say: h.leave,
        suggestions: LEAVE_CHIPS,
        intents: [{ id: 'bye', any: ['おじゃましました', 'ありがとう', 'またきます'], next: 'end', step: 'leave', ideal: L('おじゃましました。|ありがとう|ございました。', 'Ojamashimashita. Thank you very much.', 'عن إذنك (أغادر). شكرًا جزيلًا.') }],
      }),
      endNode(h.end),
    ]),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// the three homes
// ---------------------------------------------------------------------------------------------------------------

/** Mio's 1R: ask about the poster or the camera; she shows a photo she took of you. */
export const HOME_MIO: Scenario = homeVisit({
  id: 'home_mio',
  locationId: 'home_mio',
  characterId: 'mio',
  title: { en: "Visiting Mio's room", ar: 'زيارة غرفة ميو' },
  setup: {
    en: "Mio has invited you to her one-room flat. Take your shoes off at the genkan first. Then greet her, accept her tea, say something nice about the room, ask about her poster or camera, and say goodbye politely.",
    ar: 'دعتك ميو إلى شقتها الصغيرة. اخلع حذاءك عند الجنكان أولًا. ثم حيِّها، واقبل شايها، وقل شيئًا لطيفًا عن الغرفة، واسأل عن ملصقها أو كاميرتها، وودّعها بأدب.',
  },
  uniqueStep: { en: 'Ask about the poster or camera', ar: 'اسأل عن الملصق أو الكاميرا' },
  minutes: 7,
  enter: reg(L('いらっしゃい！|上がって、|上がって！', 'Welcome! Come in, come in!', 'أهلًا! تفضّل بالدخول!'), L('いらっしゃい。|どうぞ、|上がって|ください。', 'Welcome. Please come in.', 'أهلًا. تفضّل بالدخول من فضلك.')),
  offer: reg(L('お茶、|飲む？|どうぞ、|座って！', 'Want some tea? Please sit down!', 'هل تريد شايًا؟ تفضّل بالجلوس!'), L('お茶|を|どうぞ。|座って|ください。', 'Please have some tea. Please sit down.', 'تفضّل الشاي. تفضّل بالجلوس.')),
  look: reg(L('どう？|せまい|でしょ？', 'How is it? It is small, right?', 'ما رأيك؟ إنها صغيرة، أليس كذلك؟'), L('どう|です|か？|せまい|です|よ|ね。', 'How is it? It is small, is it not?', 'ما رأيك؟ إنها صغيرة، أليس كذلك؟')),
  unique: [
    node({
      id: 'poster',
      emotion: 'happy',
      say: reg(
        L('ありがとう！|あの|ポスター、|気になる？|カメラ|も|ある|よ。', 'Thank you! Are you curious about that poster? I have a camera too.', 'شكرًا! هل أثار ذلك الملصق فضولك؟ لدي كاميرا أيضًا.'),
        L('ありがとう|ございます。|あの|ポスター|が|気になります|か？|カメラ|も|あります|よ。', 'Thank you. Are you curious about that poster? I have a camera too.', 'شكرًا. هل أثار ذلك الملصق فضولك؟ لدي كاميرا أيضًا.'),
      ),
      suggestions: [S('その|ポスター|は|何|です|か？', 'What is that poster?', 'ما هذا الملصق؟'), S('その|カメラ|は|いい|です|ね。', 'That camera is nice.', 'هذه الكاميرا جميلة.'), S('カメラ|が|好き|です|か？', 'Do you like cameras?', 'هل تحبين الكاميرات؟')],
      intents: [{ id: 'ask_poster', any: ['ポスター', 'カメラ', 'なに', 'すき'], next: 'photo', ideal: L('その|ポスター|は|何|です|か？', 'What is that poster?', 'ما هذا الملصق؟') }],
    }),
    node({
      id: 'photo',
      emotion: 'excited',
      say: reg(
        L('これ？|好きな|アニメ|の|ポスター。|カメラ|で|いっぱい|とる|の。|あ、|そうだ！|{name}|の|写真、|見て！', 'This? It is a poster of my favourite anime. I take lots of photos with the camera. Oh, right! Look at the photo of {name}!', 'هذا؟ ملصق لأنمي المفضل لدي. ألتقط الكثير من الصور بالكاميرا. آه، صحيح! انظر إلى صورة {name}!'),
        L('これ|です|か？|好きな|アニメ|の|ポスター|です。|カメラ|で|いっぱい|とります。|あ、|そうだ！|{name}|さん|の|写真、|見て|ください。', 'This one? It is a poster of my favourite anime. I take lots of photos with the camera. Oh, right! Please look at the photo of {name}.', 'هذا؟ إنه ملصق لأنمي المفضل لدي. ألتقط الكثير من الصور بالكاميرا. آه، صحيح! انظر إلى صورة {name} من فضلك.'),
      ),
      suggestions: [S('わあ、|きれい|です|ね！', 'Wow, it is lovely!', 'رائع، إنها جميلة!'), S('ありがとう！|うれしい|です。', 'Thank you! I am happy.', 'شكرًا! أنا سعيد.'), S('すごい！|いい|写真|です|ね。', 'Amazing! It is a good photo.', 'مذهل! إنها صورة جيدة.')],
      intents: [{ id: 'photo_react', any: ['きれい', 'ありがとう', 'すごい', 'うれしい', 'いい'], next: 'leave', step: 'unique' }],
    }),
  ],
  leave: reg(L('もう|帰る？|また|来て|ね！', 'Going home already? Come again!', 'ستعود الآن؟ تعال مجددًا!'), L('もう|お帰り|です|か？|また|来て|ください|ね。', 'Going home already? Please come again.', 'ستعود الآن؟ تعال مجددًا من فضلك.')),
  end: reg(L('こちら|こそ、|ありがとう！|またね！', 'Thank you too! See you!', 'شكرًا لك أيضًا! إلى اللقاء!'), L('こちら|こそ、|ありがとう|ございました。|また|ね。', 'Thank you too. See you.', 'شكرًا لك أيضًا. إلى اللقاء.')),
});

/** Aiko's tatami room above the tea shop: sit at the kotatsu; she pours tea; she shows the room next door. */
export const HOME_AIKO: Scenario = homeVisit({
  id: 'home_aiko',
  locationId: 'home_aiko',
  characterId: 'aiko',
  title: { en: "Visiting Aiko's tatami room", ar: 'زيارة غرفة أيكو' },
  setup: {
    en: "Aiko has invited you to her tatami room above the tea shop. Take your shoes off at the genkan first. Then greet her, accept her tea, say something nice about the room, sit at the kotatsu, look at the room next door, and say goodbye politely.",
    ar: 'دعتك أيكو إلى غرفتها ذات الحصير فوق بيت الشاي. اخلع حذاءك عند الجنكان أولًا. ثم حيِّها، واقبل شايها، وقل شيئًا لطيفًا عن الغرفة، واجلس إلى الكوتاتسو، وانظر إلى الغرفة المجاورة، وودّعها بأدب.',
  },
  uniqueStep: { en: 'Sit at the kotatsu and see the next room', ar: 'اجلس إلى الكوتاتسو وانظر إلى الغرفة المجاورة' },
  minutes: 7,
  enter: same(L('いらっしゃい。|どうぞ、|お上がり|ください。', 'Welcome. Please come in.', 'أهلًا. تفضّل بالدخول من فضلك.')),
  offer: same(L('お茶|を|入れましょう|か。|どうぞ、|座って|ください。', 'Shall I pour some tea? Please sit down.', 'هل أصبّ لك بعض الشاي؟ تفضّل بالجلوس.')),
  look: same(L('古い|部屋|です|けど、|ゆっくり|して|ください|ね。', 'It is an old room, but please take your time.', 'إنها غرفة قديمة، لكن خذ وقتك من فضلك.')),
  unique: [
    node({
      id: 'kotatsu',
      emotion: 'happy',
      say: same(L('ありがとう|ございます。|さあ、|こたつ|に|どうぞ。|畳|の|上|では、|スリッパ|を|脱いで|ください|ね。|お茶|を|入れました|よ。', 'Thank you. Now, please come to the kotatsu. On the tatami, please take off your slippers. I have poured the tea.', 'شكرًا لك. تفضّل إلى الكوتاتسو. على الحصير من فضلك اخلع الخفّ. لقد صببت الشاي.')),
      suggestions: [S('はい、|脱ぎます。', 'Yes, I will take them off.', 'نعم، سأخلعهما.'), S('こたつ|は|あたたかい|です|ね。', 'The kotatsu is warm.', 'الكوتاتسو دافئ.'), S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.')],
      intents: [{ id: 'sit', any: ['ぬぎます', 'あたたか', 'あったか', 'ありがとう', 'はい', 'すわ'], next: 'room' }],
    }),
    node({
      id: 'room',
      emotion: 'happy',
      say: same(L('隣|の|部屋|も|見ます|か？|ここ|と|同じ、|畳|の|部屋|です。', 'Would you like to see the next room? It is a tatami room like this one.', 'هل تريد أن ترى الغرفة المجاورة؟ إنها غرفة حصير مثل هذه.')),
      suggestions: [S('はい、|見たい|です。', 'Yes, I would like to see it.', 'نعم، أريد أن أراها.'), S('見て|も|いい|です|か？', 'May I see it?', 'هل يمكنني رؤيتها؟'), S('広い|です|ね！', 'It is spacious!', 'إنها واسعة!')],
      intents: [{ id: 'see_room', any: ['みたい', 'みて', 'はい', 'いい', 'ひろい'], next: 'leave', step: 'unique' }],
    }),
  ],
  leave: same(L('もう|お帰り|です|か。|また|いつでも|どうぞ。', 'Are you leaving already? Please come any time.', 'هل ستغادر الآن؟ تعال في أي وقت من فضلك.')),
  end: same(L('こちら|こそ、|ありがとう|ございました。|また|ね。', 'Thank you too. See you.', 'شكرًا لك أيضًا. إلى اللقاء.')),
});

/** Kenji's flat above the ramen shop: home-cooked dinner (いただきます, compliment) and Hina's three questions (age, where from, favourite food). */
const FOOD_IDEAL = L('{chatfood}|が|好き|です。', 'I like {chatfood}.', 'أحب {chatfood}.');
export const HOME_KENJI: Scenario = homeVisit({
  id: 'home_kenji',
  locationId: 'home_kenji',
  characterId: 'kenji',
  title: { en: "Dinner at Kenji's flat", ar: 'العشاء في شقة كينجي' },
  setup: {
    en: "Kenji has invited you to dinner at his flat above the ramen shop. Take your shoes off at the genkan first. Then greet him, accept the tea, say something nice about the flat, say いただきます, praise the food and answer his daughter Hina's three questions.",
    ar: 'دعاك كينجي إلى العشاء في شقته فوق محل الرامن. اخلع حذاءك عند الجنكان أولًا. ثم حيِّه، واقبل الشاي، وقل شيئًا لطيفًا عن الشقة، وقل いただきます، وامدح الطعام، وأجب عن أسئلة ابنته هينا الثلاثة.',
  },
  uniqueStep: { en: 'Eat dinner and answer Hina', ar: 'تناول العشاء وأجب هينا' },
  minutes: 8,
  enter: reg(L('おう、|{name}！|よく|来た|な。|上がれ、|上がれ！', 'Hey, {name}! Good to see you. Come in, come in!', 'مرحبًا يا {name}! سعيد برؤيتك. تفضّل بالدخول!'), L('いらっしゃい。|どうぞ、|上がって|ください。', 'Welcome. Please come in.', 'أهلًا. تفضّل بالدخول من فضلك.')),
  offer: reg(L('まず|お茶|だ。|ざぶとん|に|座れ。', 'Tea first. Sit on the cushion.', 'الشاي أولًا. اجلس على الوسادة.'), L('まず|お茶|を|どうぞ。|ざぶとん|に|座って|ください。', 'Tea first, please. Please sit on the cushion.', 'الشاي أولًا من فضلك. تفضّل بالجلوس على الوسادة.')),
  look: reg(L('せまい|うち|だ|が、|ゆっくり|しろ。', 'It is a small home, but take your time.', 'إنه بيت صغير، لكن خذ وقتك.'), L('せまい|うち|です|が、|ゆっくり|して|ください。', 'It is a small home, but please take your time.', 'إنه بيت صغير، لكن خذ وقتك من فضلك.')),
  unique: [
    node({
      id: 'dinner',
      emotion: 'excited',
      say: reg(L('そう|か！|さあ、|晩ごはん|だ。|ひな、|できた|ぞ！|食べろ！', 'I see! Now, dinner. Hina, it is ready! Eat!', 'حسنًا! والآن العشاء. هينا، أصبح جاهزًا! كُلوا!'), L('そう|です|か。|さあ、|晩ごはん|です。|食べて|ください。', 'I see. Now, dinner. Please eat.', 'حسنًا. والآن العشاء. تفضّل بالأكل.')),
      suggestions: [S('いただきます！', 'Itadakimasu!', 'إيتاداكيماس!'), S('いただきます。|おいしそう|です。', 'Itadakimasu. It looks delicious.', 'إيتاداكيماس. يبدو لذيذًا.'), S('ありがとう|ございます。|いただきます。', 'Thank you. Itadakimasu.', 'شكرًا. إيتاداكيماس.')],
      intents: [{ id: 'itadakimasu', any: ['いただきます'], next: 'taste', ideal: L('いただきます。', 'Itadakimasu.', 'إيتاداكيماس.') }],
    }),
    node({
      id: 'taste',
      emotion: 'happy',
      say: reg(L('どう|だ？|うまい|か？', 'How is it? Is it good?', 'كيف هو؟ هل هو لذيذ؟'), L('どう|です|か？|おいしい|です|か？', 'How is it? Is it delicious?', 'كيف هو؟ هل هو لذيذ؟')),
      suggestions: [S('おいしい|です！', 'It is delicious!', 'إنه لذيذ!'), S('とても|おいしい|です。', 'It is very delicious.', 'إنه لذيذ جدًا.'), S('これ|は|おいしい|です|ね。', 'This is delicious.', 'هذا لذيذ.')],
      intents: [{ id: 'compliment_food', any: ['おいしい', 'うまい', 'すごい', 'いい'], next: 'q_age' }],
    }),
    node({
      id: 'q_age',
      emotion: 'happy',
      say: reg(L('そう|か！|ひな|が|聞き|たい|って。|{name}|は|何歳|だ？', 'Good! Hina wants to ask. How old are you, {name}?', 'جيد! تريد هينا أن تسأل. كم عمرك يا {name}؟'), L('そう|です|か。|ひな|が|聞き|たい|です|って。|何歳|です|か？', 'I see. Hina wants to ask. How old are you?', 'حسنًا. تريد هينا أن تسأل. كم عمرك؟')),
      suggestions: [S('二|十|五|歳|です。', 'I am 25 years old.', 'عمري خمسة وعشرون عامًا.'), S('三十|歳|です。', 'I am 30 years old.', 'عمري ثلاثون عامًا.'), S('十|八|歳|です。', 'I am 18 years old.', 'عمري ثمانية عشر عامًا.')],
      intents: [{ id: 'age', any: ['さい', 'ねん'], next: 'q_from', ideal: L('二|十|五|歳|です。', 'I am 25 years old.', 'عمري خمسة وعشرون عامًا.') }],
    }),
    node({
      id: 'q_from',
      emotion: 'happy',
      say: reg(L('へえ！|ひな|が|また|聞き|たい|って。|どこ|から|来た？', 'Oh! Hina wants to ask again. Where are you from?', 'آه! تريد هينا أن تسأل مرة أخرى. من أين أتيت؟'), L('そう|です|か。|ひな|が|また|聞き|たい|です|って。|どこ|から|来ました|か？', 'I see. Hina wants to ask again. Where are you from?', 'حسنًا. تريد هينا أن تسأل مرة أخرى. من أين أتيت؟')),
      suggestionsByL1: {
        en: [S('アメリカ|から|来ました。', 'I am from the United States.', 'أنا من الولايات المتحدة.'), S('エジプト|から|来ました。', 'I am from Egypt.', 'أنا من مصر.'), S('中国|から|来ました。', 'I am from China.', 'أنا من الصين.')],
        ar: [S('エジプト|から|来ました。', 'I am from Egypt.', 'أنا من مصر.'), S('アメリカ|から|来ました。', 'I am from the United States.', 'أنا من الولايات المتحدة.'), S('中国|から|来ました。', 'I am from China.', 'أنا من الصين.')],
      },
      intents: [{ id: 'from_country', slot: 'country', capture: 'country', slotRequired: true, next: 'q_food', ideal: L('{country}|から|来ました。', 'I am from {country}.', 'أنا من {country}.') }],
    }),
    node({
      id: 'q_food',
      emotion: 'excited',
      say: reg(L('ひな|は|カレー|が|好き！|って。|{name}|の|好きな|食べ物|は？', 'Hina likes curry! What is your favourite food, {name}?', 'هينا تحب الكاري! ما طعامك المفضل يا {name}؟'), L('ひな|は|カレー|が|好き|です|って。|好きな|食べ物|は|何|です|か？', 'Hina likes curry. What is your favourite food?', 'هينا تحب الكاري. ما طعامك المفضل؟')),
      suggestions: [S('ラーメン|が|好き|です。', 'I like ramen.', 'أحب الرامن.'), S('寿司|が|好き|です。', 'I like sushi.', 'أحب السوشي.'), S('カレー|が|好き|です。', 'I like curry.', 'أحب الكاري.')],
      intents: [
        { id: 'food', slot: 'chatfood', slotRequired: true, next: 'leave', step: 'unique', ideal: FOOD_IDEAL },
        { id: 'food_free', any: ['すき', 'たべもの'], next: 'leave', step: 'unique' },
      ],
    }),
  ],
  leave: reg(L('ひな|が|喜んだ|よ。|また|来い|よ！', 'Hina is happy. Come again!', 'هينا سعيدة. تعال مجددًا!'), L('ひな|が|喜びました。|また|来て|ください|ね。', 'Hina is happy. Please come again.', 'هينا سعيدة. تعال مجددًا من فضلك.')),
  end: reg(L('おう、|こちら|こそ|ありがとう！|またな！', 'Hey, thank you too! See you!', 'أهلًا، شكرًا لك أيضًا! إلى اللقاء!'), L('こちら|こそ、|ありがとう|ございました。|また|ね。', 'Thank you too. See you.', 'شكرًا لك أيضًا. إلى اللقاء.')),
});

export const HANGOUT_SCENARIOS: Scenario[] = [HANG_MIO_PHOTO, HANG_YUKI_JAM, HANG_KENJI_COOK, HANG_AIKO_WAGASHI];
export const HOME_SCENARIOS: Scenario[] = [HOME_MIO, HOME_AIKO, HOME_KENJI];

/** Scenarios for hang-outs and home visits (see docs/GAME_DESIGN.md §8.8). */
export const FRIENDS_SCENARIOS: Scenario[] = [...HANGOUT_SCENARIOS, ...HOME_SCENARIOS];
