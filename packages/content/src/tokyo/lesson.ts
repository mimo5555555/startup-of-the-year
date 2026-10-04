import type { Lesson, SignDef } from '../types';
import { EXTRA_LESSONS } from './lessons-extra';

export const GREETINGS: Lesson = {
  id: 'greetings',
  title: { en: 'Greetings', ar: 'التحيات' },
  intro: {
    en: 'Seven short words you will hear in every shop in Tokyo. Listen, repeat, then try the quick quiz.',
    ar: 'سبع كلمات قصيرة ستسمعها في كل متجر في طوكيو. استمع وكرر، ثم جرّب الاختبار السريع.',
  },
  sayCount: 3,
  cards: [
    { ja: 'おはようございます', en: 'Good morning', ar: 'صباح الخير', note: { en: 'Used until about 10 a.m.', ar: 'تُستخدم حتى العاشرة صباحًا تقريبًا.' } },
    { ja: 'こんにちは', en: 'Hello / Good afternoon', ar: 'مرحبًا / طاب يومك', note: { en: 'Your all-day hello. Written with は but pronounced "wa".', ar: 'تحيتك طوال اليوم. تُكتب بحرف は لكنها تُنطق «وا».' } },
    { ja: 'こんばんは', en: 'Good evening', ar: 'مساء الخير', note: { en: 'After the sun goes down.', ar: 'بعد غروب الشمس.' } },
    { ja: 'ありがとうございます', en: 'Thank you', ar: 'شكرًا جزيلًا', note: { en: 'Drop ございます with friends: ありがとう.', ar: 'احذف ございます مع الأصدقاء: ありがとう.' } },
    { ja: 'すみません', en: 'Excuse me / Sorry', ar: 'المعذرة / آسف', note: { en: 'Also the way to get a waiter’s attention.', ar: 'وهي أيضًا الطريقة لجذب انتباه النادل.' } },
    { ja: 'はい', en: 'Yes', ar: 'نعم' },
    { ja: 'いいえ', en: 'No', ar: 'لا' },
  ],
};

export const LESSONS: Lesson[] = [GREETINGS, ...EXTRA_LESSONS];
export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);

export const SIGNS: SignDef[] = [
  { id: 'konbini', lex: 'コンビニ' },
  { id: 'cafe', lex: 'カフェ' },
  { id: 'school', lex: '学校' },
  { id: 'ramen', lex: 'ラーメン' },
  { id: 'station', lex: '駅' },
  { id: 'park', lex: '公園' },
  { id: 'vending', lex: '自動販売機' },
  { id: 'sakura', lex: '桜' },
  { id: 'cat', lex: '猫' },
  { id: 'bicycle', lex: '自転車' },
  { id: 'signal', lex: '信号' },
  { id: 'exit', lex: '出口' },
  { id: 'entrance', lex: '入口' },
  { id: 'pond', lex: '池' },
  { id: 'torii', lex: '鳥居' },
  { id: 'lantern', lex: '提灯' },
  { id: 'bench', lex: 'ベンチ' },
  { id: 'post', lex: 'ポスト' },
  { id: 'ticket', lex: '券売機' },
  { id: 'bin', lex: 'ごみ箱' },
];
