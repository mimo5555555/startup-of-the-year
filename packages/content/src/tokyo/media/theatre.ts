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

export type TheatreSetting = 'konbini' | 'ramen' | 'park';

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
];
