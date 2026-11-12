import type { Gloss, Line } from '../../types';
import { L } from '../dsl';

// The Mini-theatre (ミニシアター): short episodes with the town's characters and the town's song, all written for the game. An episode is
// watched, not played: each line is spoken in its character's recorded voice while the subtitles light up word by word in time with the
// audio; any word can be tapped (the word card), furigana / romaji / the translation can be switched, and three questions follow. The song is
// an instrumental karaoke track made in the browser: each mora of the lyrics has its note, so the lyrics light up exactly with the music.

export interface EpisodeLine {
  /** a character id (the recorded voice and the portrait), or 'narrator' */
  who: string;
  line: Line;
}

export interface QuizItem {
  q: Gloss;
  options: Gloss[];
  /** index of the right option */
  answer: number;
}

export type TheatreSetting = 'konbini' | 'ramen' | 'park' | 'arcade' | 'sento' | 'hobby' | 'station' | 'denki' | 'matsuri';

export interface Episode {
  id: string;
  title: Gloss & { ja: string };
  /** the backdrop the screen draws behind the characters */
  setting: TheatreSetting;
  /** the two characters on screen: the first on the left */
  cast: [string, string];
  /** the chapter from which it is listed */
  unlock: number;
  lines: EpisodeLine[];
  quiz: QuizItem[];
}

/** One sung line: the lyric (markup, for the kanji and the meaning), its kana split into morae, and each mora's note. */
export interface SongLine {
  line: Line;
  /** morae in singing order (っ and small kana are their own or joined as sung: しょ is one) */
  morae: string[];
  /** [midi note, beats] per mora */
  notes: Array<[number, number]>;
  /** the chord under each half of the line (root midi note) */
  chords: [number, number];
}

export interface Song {
  id: string;
  title: Gloss & { ja: string };
  bpm: number;
  unlock: number;
  /** pitch classes (0 = C … 11 = B) of the chord roots that are minor; absent = A only (the Am of C major) */
  minor?: number[];
  lines: SongLine[];
}

const G = (en: string, ar: string): Gloss => ({ en, ar });

export const EPISODES: Episode[] = [
  {
    id: 'ep_konbini',
    title: { ja: 'はじめてのコンビニ', en: 'The first konbini', ar: 'أول متجر صغير' },
    setting: 'konbini',
    cast: ['mio', 'tanaka'],
    unlock: 1,
    lines: [
      { who: 'tanaka', line: L('いらっしゃいませ！', 'Welcome!', 'أهلًا بك!') },
      { who: 'mio', line: L('すみません、|おにぎり|は|どこ|です|か？', 'Excuse me, where are the onigiri?', 'عذرًا، أين الأونيغيري؟') },
      { who: 'tanaka', line: L('おにぎり|は|あちら|です。', 'The onigiri are over there.', 'الأونيغيري هناك.') },
      { who: 'mio', line: L('ありがとうございます。|じゃあ、|これ|を|ください。', 'Thank you. Then I will have this one, please.', 'شكرًا. إذن، هذه من فضلك.') },
      { who: 'tanaka', line: L('百|五|十|円|です。|袋|は|いりますか？', 'That is 150 yen. Do you need a bag?', 'المبلغ 150 ين. هل تحتاجين كيسًا؟') },
      { who: 'mio', line: L('いいえ、|大丈夫|です。', 'No, I am fine.', 'لا، لا بأس.') },
      { who: 'tanaka', line: L('ありがとうございました！', 'Thank you very much!', 'شكرًا جزيلًا!') },
    ],
    quiz: [
      { q: G('Where are the onigiri?', 'أين الأونيغيري؟'), options: [G('Over there', 'هناك'), G('At the till', 'عند الصندوق'), G('Sold out', 'نفدت')], answer: 0 },
      { q: G('How much is it?', 'كم السعر؟'), options: [G('100 yen', '100 ين'), G('150 yen', '150 ين'), G('250 yen', '250 ين')], answer: 1 },
      { q: G('Does Mio want a bag?', 'هل تريد ميو كيسًا؟'), options: [G('Yes, two', 'نعم، اثنين'), G('Yes, one', 'نعم، واحدًا'), G('No, she is fine', 'لا، لا بأس')], answer: 2 },
    ],
  },
  {
    id: 'ep_ramen',
    title: { ja: 'ラーメンの秘密', en: 'The secret of the ramen', ar: 'سرّ الرامن' },
    setting: 'ramen',
    cast: ['yuki', 'kenji'],
    unlock: 2,
    lines: [
      { who: 'yuki', line: L('こんにちは！|今日|も|寒い|です|ね。', 'Hello! It is cold again today.', 'مرحبًا! الجو بارد اليوم أيضًا.') },
      { who: 'kenji', line: L('いらっしゃい！|ラーメン、|食べる|か？', 'Welcome! Having ramen?', 'أهلًا! هل ستأكلين رامن؟') },
      { who: 'yuki', line: L('はい、|しょうゆラーメン|を|ください。', 'Yes, a soy-sauce ramen, please.', 'نعم، رامن بصلصة الصويا من فضلك.') },
      { who: 'kenji', line: L('うち|の|スープ|は|十二時間|かかる|んだ。', 'Our soup takes twelve hours.', 'حساؤنا يستغرق اثنتي عشرة ساعة.') },
      { who: 'yuki', line: L('えっ、|十二時間|です|か？|すごい！', 'What, twelve hours? Amazing!', 'ماذا، اثنتا عشرة ساعة؟ مذهل!') },
      { who: 'kenji', line: L('それ|が、|おいしさ|の|秘密|だよ。', 'That is the secret of the taste.', 'هذا هو سرّ المذاق.') },
      { who: 'yuki', line: L('いただきます！|…おいしい！', 'Itadakimasu! ...Delicious!', 'إيتاداكيماس! ...لذيذ!') },
    ],
    quiz: [
      { q: G('What does Yuki order?', 'ماذا تطلب يوكي؟'), options: [G('Miso ramen', 'رامن بالميسو'), G('Soy-sauce ramen', 'رامن بصلصة الصويا'), G('Salt ramen', 'رامن بالملح')], answer: 1 },
      { q: G('How long does the soup take?', 'كم يستغرق الحساء؟'), options: [G('Two hours', 'ساعتين'), G('Twelve hours', 'اثنتي عشرة ساعة'), G('Two days', 'يومين')], answer: 1 },
      { q: G('What is the weather like?', 'كيف الطقس؟'), options: [G('Cold', 'بارد'), G('Hot', 'حار'), G('Rainy', 'ممطر')], answer: 0 },
    ],
  },
  {
    id: 'ep_crane',
    title: { ja: 'クレーンゲーム', en: 'The crane game', ar: 'لعبة الرافعة' },
    setting: 'arcade',
    cast: ['yuki', 'shota'],
    unlock: 2,
    lines: [
      { who: 'shota', line: L('いらっしゃいませ！|クレーンゲーム、|やります|か？', 'Welcome! Will you play the crane game?', 'أهلًا بك! هل ستلعبين لعبة الرافعة؟') },
      { who: 'yuki', line: L('はい！|あの|ぬいぐるみ|が|ほしい|です。', 'Yes! I want that plush toy.', 'نعم! أريد تلك الدمية المحشوة.') },
      { who: 'shota', line: L('一回|百|円|です。|がんばって|ください！', 'One go is 100 yen. Good luck!', 'المحاولة الواحدة بـ 100 ين. بالتوفيق!') },
      { who: 'yuki', line: L('あっ、|落ちました…。|もう一回！', 'Ah, it fell... One more go!', 'آه، سقطت... محاولة أخرى!') },
      { who: 'yuki', line: L('すみません、|取りやすく|して|もらえますか？', 'Excuse me, could you make it easier to get?', 'عذرًا، هل يمكنك جعلها أسهل في الإمساك؟') },
      { who: 'shota', line: L('いい|です|よ。|少し|動かします|ね。', 'Sure. I will move it a little.', 'بالتأكيد. سأحرّكها قليلًا.') },
      { who: 'yuki', line: L('やった！|取れました！|ありがとう|ございます！', 'Yes! I got it! Thank you!', 'رائع! أمسكتها! شكرًا جزيلًا!') },
    ],
    quiz: [
      { q: G('What does Yuki want?', 'ماذا تريد يوكي؟'), options: [G('A figure', 'مجسّمًا'), G('A plush toy', 'دمية محشوة'), G('A snack', 'وجبة خفيفة')], answer: 1 },
      { q: G('How much is one go?', 'كم سعر المحاولة الواحدة؟'), options: [G('100 yen', '100 ين'), G('200 yen', '200 ين'), G('500 yen', '500 ين')], answer: 0 },
      { q: G('How does Shota help?', 'كيف يساعدها شوتا؟'), options: [G('He gives her a free go', 'يعطيها محاولة مجانية'), G('He plays for her', 'يلعب بدلًا منها'), G('He moves the prize closer', 'يقرّب الجائزة')], answer: 2 },
    ],
  },
  {
    id: 'ep_hanami',
    title: { ja: '公園でお花見', en: 'Cherry blossoms in the park', ar: 'أزهار الكرز في الحديقة' },
    setting: 'park',
    cast: ['mio', 'hanako'],
    unlock: 3,
    lines: [
      { who: 'hanako', line: L('ミオ|さん、|桜|が|きれい|です|ね。', 'Mio, the cherry blossoms are beautiful.', 'ميو، أزهار الكرز جميلة.') },
      { who: 'mio', line: L('はい！|春|が|一番|好き|です。', 'Yes! Spring is my favourite.', 'نعم! الربيع هو المفضّل لديّ.') },
      { who: 'hanako', line: L('お弁当|を|持ってきました|よ。', 'I brought a bento.', 'أحضرتُ علبة غداء.') },
      { who: 'mio', line: L('わあ、|ありがとうございます！', 'Wow, thank you!', 'رائع، شكرًا!') },
      { who: 'hanako', line: L('桜|の|下|で|食べる|の|を|お花見|と|言います。', 'Eating under the cherry blossoms is called ohanami.', 'الأكل تحت أزهار الكرز يُسمّى أوهانامي.') },
      { who: 'mio', line: L('お花見、|楽しい|です|ね。|来年|も|来たい|です。', 'Ohanami is fun. I want to come next year too.', 'الأوهانامي ممتع. أريد أن آتي العام القادم أيضًا.') },
      { who: 'hanako', line: L('ええ、|また|一緒に|来ましょう。', 'Yes, let us come together again.', 'نعم، لنأتِ معًا مجددًا.') },
    ],
    quiz: [
      { q: G('What did Hanako bring?', 'ماذا أحضرت هاناكو؟'), options: [G('A bento', 'علبة غداء'), G('Tea', 'شايًا'), G('Flowers', 'زهورًا')], answer: 0 },
      { q: G('What is ohanami?', 'ما هو الأوهانامي؟'), options: [G('A spring festival dance', 'رقصة مهرجان الربيع'), G('Eating under the cherry blossoms', 'الأكل تحت أزهار الكرز'), G('A kind of sweet', 'نوع من الحلوى')], answer: 1 },
      { q: G("What is Mio's favourite season?", 'ما الفصل المفضّل لدى ميو؟'), options: [G('Autumn', 'الخريف'), G('Winter', 'الشتاء'), G('Spring', 'الربيع')], answer: 2 },
    ],
  },
  {
    id: 'ep_sento',
    title: { ja: 'はじめての銭湯', en: 'The first public bath', ar: 'أول حمّام عام' },
    setting: 'sento',
    cast: ['rin', 'genzo'],
    unlock: 3,
    lines: [
      { who: 'genzo', line: L('いらっしゃい！|銭湯|は|はじめて|です|か？', 'Welcome! Is this your first time at a public bath?', 'أهلًا! هل هذه أول مرة لك في حمّام عام؟') },
      { who: 'rin', line: L('はい、|はじめて|です。|大人|一人|お願いします。', 'Yes, it is my first time. One adult, please.', 'نعم، إنها أول مرة. شخص بالغ واحد من فضلك.') },
      { who: 'genzo', line: L('五|百|五|十|円|です。|入る|前|に、|かけ湯|を|して|ください|ね。', 'That is 550 yen. Before you get in, please pour hot water over yourself.', 'المبلغ 550 ينًا. قبل أن تدخلي، اسكبي الماء الساخن على جسمك.') },
      { who: 'rin', line: L('かけ湯|って|何|です|か？', 'What is kakeyu?', 'ما هو الكاكيو؟') },
      { who: 'genzo', line: L('お湯|を|体|に|かける|こと|です。|タオル|は|お湯|に|入れないで|ください。', 'It means pouring hot water over your body. Please keep the towel out of the bath.', 'يعني أن تسكبي الماء الساخن على جسمك. ولا تُدخلي المنشفة في ماء الحوض.') },
      { who: 'rin', line: L('はい、|わかりました！|…ああ、|いい|お湯|でした！', 'Yes, I understand! ...Ahh, that was a lovely bath!', 'نعم، فهمت! ...آه، كان حمّامًا رائعًا!') },
      { who: 'genzo', line: L('はは、|よかった。|お風呂|の|後|は、|コーヒー牛乳|が|一番|です|よ。', 'Ha ha, good. After a bath, coffee milk is the best.', 'ها ها، جيد. بعد الحمّام، الحليب بالقهوة هو الأفضل.') },
    ],
    quiz: [
      { q: G('Has Rin been to a public bath before?', 'هل ذهبت رين إلى حمّام عام من قبل؟'), options: [G('Yes, often', 'نعم، كثيرًا'), G('Once', 'مرة واحدة'), G('No, it is her first time', 'لا، إنها أول مرة')], answer: 2 },
      { q: G('How much is the bath?', 'كم سعر الحمّام؟'), options: [G('550 yen', '550 ينًا'), G('150 yen', '150 ينًا'), G('1,000 yen', '1,000 ين')], answer: 0 },
      { q: G('What must stay out of the water?', 'ما الذي يجب أن يبقى خارج الماء؟'), options: [G('Your hair', 'شعرك'), G('The towel', 'المنشفة'), G('Your hands', 'يداك')], answer: 1 },
    ],
  },
  {
    id: 'ep_figure',
    title: { ja: '田中さんのロボット', en: "Tanaka's robot", ar: 'روبوت تاناكا' },
    setting: 'hobby',
    cast: ['tanaka', 'daichi'],
    unlock: 4,
    lines: [
      { who: 'daichi', line: L('いらっしゃいませ！|ほしぞらホビー|へ|ようこそ。', 'Welcome! Welcome to Hoshizora Hobby.', 'أهلًا بك! مرحبًا بك في هوشيزورا هوبي.') },
      { who: 'tanaka', line: L('こんにちは。|ロボット|の|フィギュア|は|あります|か？', 'Hello. Do you have robot figures?', 'مرحبًا. هل عندكم مجسّمات روبوت؟') },
      { who: 'daichi', line: L('はい！|大きい|の|と|小さい|の|が|あります。|どちら|が|いい|です|か？', 'Yes! There is a big one and a small one. Which would you like?', 'نعم! يوجد كبير وصغير. أيّهما تفضّل؟') },
      { who: 'tanaka', line: L('大きい|の|は|いくら|です|か？', 'How much is the big one?', 'كم سعر الكبير؟') },
      { who: 'daichi', line: L('三千|六|百|円|です。|とても|人気|です|よ！', 'It is 3,600 yen. It is very popular!', 'إنه بـ 3,600 ين. إنه رائج جدًا!') },
      { who: 'tanaka', line: L('じゃあ、|大きい|の|を|ください。|ロボット|が|大好き|です！', 'Then the big one, please. I love robots!', 'إذن الكبير من فضلك. أحب الروبوتات كثيرًا!') },
      { who: 'daichi', line: L('ありがとう|ございます！|大事|に|して|ください|ね。', 'Thank you very much! Take good care of it.', 'شكرًا جزيلًا! اعتنِ به جيدًا.') },
    ],
    quiz: [
      { q: G('What is Tanaka looking for?', 'عمّ يبحث تاناكا؟'), options: [G('A robot figure', 'مجسّم روبوت'), G('A cat ninja', 'قط نينجا'), G('A display case', 'خزانة عرض')], answer: 0 },
      { q: G('How much is the big one?', 'كم سعر الكبير؟'), options: [G('1,200 yen', '1,200 ين'), G('3,600 yen', '3,600 ين'), G('4,800 yen', '4,800 ين')], answer: 1 },
      { q: G('Which one does he buy?', 'أيّهما يشتري؟'), options: [G('The small one', 'الصغير'), G('Both', 'كليهما'), G('The big one', 'الكبير')], answer: 2 },
    ],
  },
  {
    id: 'ep_station',
    title: { ja: '光が丘まで', en: 'To Hikarigaoka', ar: 'إلى هيكاريغاأوكا' },
    setting: 'station',
    cast: ['mio', 'sato'],
    unlock: 5,
    lines: [
      { who: 'sato', line: L('こんにちは。|どうしましたか？', 'Hello. How can I help?', 'مرحبًا. كيف أساعدك؟') },
      { who: 'mio', line: L('すみません、|光が丘|まで|行きたい|です。', 'Excuse me, I would like to go to Hikarigaoka.', 'عذرًا، أريد أن أذهب إلى هيكاريغاأوكا.') },
      { who: 'sato', line: L('光が丘|は|二番線|の|電車|です。|ICカード|は|あります|か？', 'For Hikarigaoka, take the train from platform 2. Do you have an IC card?', 'إلى هيكاريغاأوكا، القطار من الرصيف 2. هل معك بطاقة IC؟') },
      { who: 'mio', line: L('はい、|あります。|でも、|チャージ|したい|です。', 'Yes, I do. But I would like to top it up.', 'نعم، معي. لكنني أريد أن أشحنها.') },
      { who: 'sato', line: L('あちら|の|券売機|で|チャージ|できます|よ。', 'You can top it up at the ticket machine over there.', 'يمكنك شحنها في آلة التذاكر هناك.') },
      { who: 'mio', line: L('わかりました。|千|円|チャージ|します。', 'I see. I will put 1,000 yen on it.', 'فهمت. سأشحنها بـ 1,000 ين.') },
      { who: 'sato', line: L('電車|は|三分後|に|来ます。|気をつけて！', 'The train comes in three minutes. Take care!', 'القطار يأتي بعد ثلاث دقائق. انتبهي لنفسك!') },
    ],
    quiz: [
      { q: G('Where does Mio want to go?', 'إلى أين تريد ميو أن تذهب؟'), options: [G('The park', 'الحديقة'), G('Kyoto', 'كيوتو'), G('Hikarigaoka', 'هيكاريغاأوكا')], answer: 2 },
      { q: G('Which platform is it?', 'أي رصيف؟'), options: [G('Platform 1', 'الرصيف 1'), G('Platform 2', 'الرصيف 2'), G('Platform 3', 'الرصيف 3')], answer: 1 },
      { q: G('How much does she put on her card?', 'بكم تشحن بطاقتها؟'), options: [G('1,000 yen', '1,000 ين'), G('500 yen', '500 ين'), G('3,000 yen', '3,000 ين')], answer: 0 },
    ],
  },
  {
    id: 'ep_denki',
    title: { ja: 'ケンジさんのスマホ', en: "Kenji's smartphone", ar: 'هاتف كينجي' },
    setting: 'denki',
    cast: ['kenji', 'aoi'],
    unlock: 6,
    lines: [
      { who: 'aoi', line: L('いらっしゃいませ。|何|を|お探し|でしょうか？', 'Welcome. What are you looking for?', 'أهلًا بك. عمّ تبحث؟') },
      { who: 'kenji', line: L('スマホ|が|ほしい|んだ。|安い|の|は|ある？', 'I want a smartphone. Do you have a cheap one?', 'أريد هاتفًا ذكيًا. هل عندكم واحد رخيص؟') },
      { who: 'aoi', line: L('中古スマホ|は|いかが|です|か？|二|万|四|千|八百|円|です。', 'How about a used smartphone? It is 24,800 yen.', 'ما رأيك بهاتف مستعمل؟ سعره 24,800 ين.') },
      { who: 'kenji', line: L('いい|ね。|色|は|黒|が|いい。', 'Nice. I would like black.', 'جيد. أريد اللون الأسود.') },
      { who: 'aoi', line: L('黒|も|あります。|カード|でも|払えます|よ。', 'We have black too. You can also pay by card.', 'عندنا الأسود أيضًا. يمكنك الدفع بالبطاقة أيضًا.') },
      { who: 'kenji', line: L('じゃあ、|これ|を|ください。|現金|で|お願いします。', 'Then I will take this one. Cash, please.', 'إذن سآخذ هذا. نقدًا من فضلك.') },
      { who: 'aoi', line: L('ありがとう|ございます。|こちら|に|お名前|を|お願いします。', 'Thank you very much. Your name here, please.', 'شكرًا جزيلًا. اسمك هنا من فضلك.') },
    ],
    quiz: [
      { q: G('What is Kenji looking for?', 'عمّ يبحث كينجي؟'), options: [G('A smartphone', 'هاتف ذكي'), G('A TV', 'تلفزيون'), G('A camera', 'كاميرا')], answer: 0 },
      { q: G('How much is the used smartphone?', 'كم سعر الهاتف المستعمل؟'), options: [G('12,800 yen', '12,800 ين'), G('128,000 yen', '128,000 ين'), G('24,800 yen', '24,800 ين')], answer: 2 },
      { q: G('How does he pay?', 'كيف يدفع؟'), options: [G('By card', 'بالبطاقة'), G('In cash', 'نقدًا'), G('With his IC card', 'ببطاقة IC')], answer: 1 },
    ],
  },
  {
    id: 'ep_matsuri',
    title: { ja: 'お祭りの夜', en: 'The night of the festival', ar: 'ليلة المهرجان' },
    setting: 'matsuri',
    cast: ['mio', 'rin'],
    unlock: 7,
    lines: [
      { who: 'mio', line: L('リン|ちゃん、|こんばんは！|浴衣、|かわいい|ね！', 'Rin, good evening! Your yukata is cute!', 'رين، مساء الخير! اليوكاتا خاصتك لطيفة!') },
      { who: 'rin', line: L('ありがとう|ございます！|ミオ|さん|も|きれい|です。', 'Thank you! You look lovely too, Mio.', 'شكرًا! وأنتِ جميلة أيضًا يا ميو.') },
      { who: 'mio', line: L('お腹|が|すいた|ね。|たこ焼き、|食べよう！', 'I am hungry. Let us eat takoyaki!', 'أنا جائعة. لنأكل التاكوياكي!') },
      { who: 'rin', line: L('いい|です|ね！|わたし|は|焼きそば|が|食べたい|です。', 'Sounds good! I want to eat yakisoba.', 'فكرة جيدة! أنا أريد أن آكل الياكيسوبا.') },
      { who: 'mio', line: L('あ、|花火|が|始まる|よ！', 'Oh, the fireworks are starting!', 'أوه، الألعاب النارية ستبدأ!') },
      { who: 'rin', line: L('わあ、|きれい！|すごい|です|ね！', 'Wow, beautiful! Amazing!', 'واو، ما أجملها! مذهلة!') },
      { who: 'mio', line: L('来年|も|一緒に|来よう|ね。', 'Let us come together next year too.', 'لنأتِ معًا العام القادم أيضًا.') },
    ],
    quiz: [
      { q: G('What is Rin wearing?', 'ماذا ترتدي رين؟'), options: [G('A school uniform', 'زيًّا مدرسيًا'), G('A yukata', 'يوكاتا'), G('A jacket', 'سترة')], answer: 1 },
      { q: G('What does Rin want to eat?', 'ماذا تريد رين أن تأكل؟'), options: [G('Yakisoba', 'ياكيسوبا'), G('Takoyaki', 'تاكوياكي'), G('Shaved ice', 'ثلج مبشور')], answer: 0 },
      { q: G('What starts?', 'ماذا يبدأ؟'), options: [G('The rain', 'المطر'), G('The dance', 'الرقص'), G('The fireworks', 'الألعاب النارية')], answer: 2 },
    ],
  },
];

/**
 * 「桜通り」 (Sakura Street), the town's song (written for the game; it is also sung in the karaoke room). C major, 92 bpm; one note per mora,
 * an eighth (0.5 beat) unless longer; the chords under each half of a line are C, Am, F and G.
 */
export const SONGS: Song[] = [
  {
    id: 'song_sakura',
    title: { ja: '桜通り', en: 'Sakura Street', ar: 'شارع ساكورا' },
    bpm: 92,
    unlock: 1,
    lines: [
      {
        line: L('桜通り|で|会おう|よ', "Let's meet on Sakura Street", 'لنلتقِ في شارع ساكورا'),
        morae: ['さ', 'く', 'ら', 'ど', 'お', 'り', 'で', 'あ', 'お', 'う', 'よ'],
        notes: [[64, 0.5], [67, 0.5], [69, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [67, 1], [72, 0.5], [69, 0.5], [67, 0.5], [67, 2]],
        chords: [48, 45],
      },
      {
        line: L('春|の|風|が|吹いている', 'The spring wind is blowing', 'ريح الربيع تهبّ'),
        morae: ['は', 'る', 'の', 'か', 'ぜ', 'が', 'ふ', 'い', 'て', 'い', 'る'],
        notes: [[64, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [69, 0.5], [67, 1], [64, 0.5], [62, 0.5], [64, 0.5], [67, 0.5], [64, 2]],
        chords: [41, 43],
      },
      {
        line: L('明日|も|一緒に|笑おう|よ', "Let's laugh together tomorrow too", 'لنضحك معًا غدًا أيضًا'),
        morae: ['あ', 'し', 'た', 'も', 'い', 'っ', 'しょ', 'に', 'わ', 'ら', 'お', 'う', 'よ'],
        notes: [[69, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [67, 0.5], [67, 0.5], [69, 0.5], [72, 1], [74, 0.5], [72, 0.5], [69, 0.5], [67, 0.5], [69, 2]],
        chords: [45, 41],
      },
      {
        line: L('桜通り|で|また|会おう', "On Sakura Street, let's meet again", 'في شارع ساكورا، لنلتقِ مجددًا'),
        morae: ['さ', 'く', 'ら', 'ど', 'お', 'り', 'で', 'ま', 'た', 'あ', 'お', 'う'],
        notes: [[64, 0.5], [67, 0.5], [69, 0.5], [69, 0.5], [67, 0.5], [64, 0.5], [62, 1], [64, 0.5], [67, 0.5], [62, 0.5], [62, 0.5], [60, 3]],
        chords: [43, 48],
      },
    ],
  },
  /**
   * 「桜町の一年」 (A Year in Sakura Town), the seasons song (written for the game): G major, 104 bpm, one line per season. Its chords are
   * G, Em, C and D: the E root is the minor one (`minor: [4]`).
   */
  {
    id: 'song_seasons',
    title: { ja: '桜町の一年', en: 'A Year in Sakura Town', ar: 'عام في ساكورا ماتشي' },
    bpm: 104,
    unlock: 2,
    minor: [4],
    lines: [
      {
        line: L('春|は|桜|が|咲く|よ', 'In spring the cherry blossoms bloom', 'في الربيع تتفتّح أزهار الكرز'),
        morae: ['は', 'る', 'は', 'さ', 'く', 'ら', 'が', 'さ', 'く', 'よ'],
        notes: [[67, 0.5], [69, 0.5], [71, 1], [74, 0.5], [71, 0.5], [69, 0.5], [67, 1], [69, 0.5], [71, 0.5], [74, 2]],
        chords: [43, 40],
      },
      {
        line: L('夏|は|海|で|泳ごう', "In summer let's swim in the sea", 'في الصيف لنسبح في البحر'),
        morae: ['な', 'つ', 'は', 'う', 'み', 'で', 'お', 'よ', 'ご', 'う'],
        notes: [[76, 0.5], [74, 0.5], [71, 1], [69, 0.5], [71, 0.5], [74, 1], [71, 0.5], [69, 0.5], [67, 0.5], [69, 2]],
        chords: [48, 50],
      },
      {
        line: L('秋|は|もみじ|が|赤い|よ', 'In autumn the maple leaves are red', 'في الخريف تحمرّ أوراق القيقب'),
        morae: ['あ', 'き', 'は', 'も', 'み', 'じ', 'が', 'あ', 'か', 'い', 'よ'],
        notes: [[64, 0.5], [67, 0.5], [69, 1], [71, 0.5], [69, 0.5], [67, 0.5], [64, 1], [67, 0.5], [69, 0.5], [71, 0.5], [69, 2]],
        chords: [40, 48],
      },
      {
        line: L('冬|は|雪|が|降る|よ', 'In winter the snow falls', 'في الشتاء يتساقط الثلج'),
        morae: ['ふ', 'ゆ', 'は', 'ゆ', 'き', 'が', 'ふ', 'る', 'よ'],
        notes: [[74, 0.5], [71, 0.5], [69, 1], [71, 0.5], [69, 0.5], [67, 1], [69, 0.5], [71, 0.5], [67, 3]],
        chords: [50, 43],
      },
    ],
  },
  /**
   * 「わたしの一週間」 (My Week), the days of the week (written for the game): F major, 112 bpm. Its chords are F, Dm, B♭ and C: the D root
   * is the minor one (`minor: [2]`).
   */
  {
    id: 'song_week',
    title: { ja: 'わたしの一週間', en: 'My Week', ar: 'أسبوعي' },
    bpm: 112,
    unlock: 3,
    minor: [2],
    lines: [
      {
        line: L('月曜日、|火曜日、|水曜日', 'Monday, Tuesday, Wednesday', 'الاثنين، الثلاثاء، الأربعاء'),
        morae: ['げ', 'つ', 'よ', 'う', 'び', 'か', 'よ', 'う', 'び', 'す', 'い', 'よ', 'う', 'び'],
        notes: [[65, 0.5], [67, 0.5], [69, 0.5], [69, 0.5], [72, 1], [74, 0.5], [72, 0.5], [69, 0.5], [72, 1], [69, 0.5], [67, 0.5], [65, 0.5], [67, 0.5], [69, 2]],
        chords: [41, 50],
      },
      {
        line: L('木曜日、|金曜日', 'Thursday, Friday', 'الخميس، الجمعة'),
        morae: ['も', 'く', 'よ', 'う', 'び', 'き', 'ん', 'よ', 'う', 'び'],
        notes: [[70, 0.5], [70, 0.5], [72, 0.5], [74, 0.5], [72, 1], [69, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [67, 2]],
        chords: [46, 48],
      },
      {
        line: L('土曜日|は|友達|と', 'Saturday is with my friends', 'السبت مع أصدقائي'),
        morae: ['ど', 'よ', 'う', 'び', 'は', 'と', 'も', 'だ', 'ち', 'と'],
        notes: [[74, 0.5], [74, 0.5], [72, 0.5], [69, 1], [67, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [72, 0.5], [74, 2]],
        chords: [50, 46],
      },
      {
        line: L('日曜日|は|お休み', 'Sunday is a day off', 'الأحد يوم إجازة'),
        morae: ['に', 'ち', 'よ', 'う', 'び', 'は', 'お', 'や', 'す', 'み'],
        notes: [[72, 0.5], [72, 0.5], [69, 0.5], [67, 0.5], [69, 1], [67, 0.5], [65, 0.5], [67, 0.5], [69, 0.5], [65, 3]],
        chords: [48, 41],
      },
    ],
  },
];
