import { describe, expect, it } from 'vitest';
import { LEXICON, resolveLine } from '@lw/content';
import { PHRASEBOOK } from '@lw/content';
import { classifyInput, norm, translatePhrase } from '../src';

function ja(text: string, from?: 'en' | 'ar') {
  const r = translatePhrase(text, from);
  if (!r) return null;
  return resolveLine({ ja: r.ja, en: '', ar: '' }, LEXICON, r.vars).written;
}

describe('English -> Japanese', () => {
  it.each([
    ['Hello', 'こんにちは。'],
    ["I'd like a coffee", 'コーヒーをください。'],
    ['Can I have a latte, please?', 'カフェラテをください。'],
    ['One green tea please', 'お茶をください。'],
    ['Where is the toilet?', 'トイレはどこですか？'],
    ["where's the water", '水はどこですか？'],
    ['Do you have onigiri?', 'おにぎりはありますか？'],
    ['What is the wifi password?', 'Wi-Fiのパスワードを教えてください。'],
    ["What's the Wi-Fi password", 'Wi-Fiのパスワードを教えてください。'],
    ['I want to go to Shibuya', '渋谷へ行きたいです。'],
    ['How do I get to Akihabara?', '秋葉原へ行きたいです。'],
    ['How much is it?', 'いくらですか？'],
    ['By card, please', 'カードでお願いします。'],
    ['No thanks, that is all', 'いいえ、大丈夫です。'],
    ["I don't understand", 'わかりません。'],
    ['Can you speak more slowly?', 'ゆっくりお願いします。'],
    ['The bill please', 'お会計をお願いします。'],
    ["It's delicious!", 'おいしいです！'],
    ['miso ramen please', 'みそラーメンをください。'],
    ['I like anime', 'アニメが好きです。'],
    ['I love photography', '写真が好きです。'],
    ['Thank you', 'ありがとうございます。'],
  ])('%s', (en, expected) => {
    expect(ja(en, 'en')).toBe(expected);
  });

  it('keeps the learner name with its original casing', () => {
    expect(ja('My name is John', 'en')).toBe('わたしはJohnです。');
    expect(ja("Hi, I'm Layla", 'en')).toBe('わたしはLaylaです。');
  });

  it('uses the country slot, falling back to the typed text for unknown countries', () => {
    expect(ja('I am from Egypt', 'en')).toBe('エジプトから来ました。');
    expect(ja('I am from the United States', 'en')).toBe('アメリカから来ました。');
    expect(ja('I am from Peru', 'en')).toBe('Peruから来ました。');
  });

  it('prefers a fixed phrase over a slot phrase ("I am fine" is not a name)', () => {
    expect(ja('I am fine', 'en')).toBe('元気です。');
  });

  it('joins several sentences', () => {
    expect(ja("Hello. I'd like a coffee, please.", 'en')).toBe('こんにちは。コーヒーをください。');
  });

  it('refuses things it does not know instead of guessing', () => {
    expect(translatePhrase('What is the capital of Mongolia', 'en')).toBeNull();
    expect(translatePhrase('xyzzy plugh', 'en')).toBeNull();
  });
});

describe('Arabic -> Japanese', () => {
  it.each([
    ['مرحبا', 'こんにちは。'],
    ['أريد قهوة', 'コーヒーをください。'],
    ['قهوة من فضلك', 'コーヒーをください。'],
    ['أين الحمام؟', 'トイレはどこですか？'],
    ['ما هي كلمة مرور الواي فاي؟', 'Wi-Fiのパスワードを教えてください。'],
    ['أريد الذهاب إلى شيبويا', '渋谷へ行きたいです。'],
    ['بكم هذا؟', 'いくらですか？'],
    ['بالبطاقة من فضلك', 'カードでお願いします。'],
    ['شكرا جزيلا', 'ありがとうございます。'],
    ['لا أفهم', 'わかりません。'],
    ['الحساب من فضلك', 'お会計をお願いします。'],
    ['أنا أحب الأنمي', 'アニメが好きです。'],
    ['أنا من مصر', 'エジプトから来ました。'],
    ['اسمي ليلى', 'わたしはليلىです。'.replace(/[يى]/g, (m) => m)],
  ])('%s', (ar, expected) => {
    expect(ja(ar, 'ar')).toBe(expected);
  });
});

describe('classifyInput', () => {
  it('routes by script', () => {
    expect(classifyInput('コーヒーをください').kind).toBe('ja');
    expect(classifyInput('أريد قهوة').kind).toBe('l1');
    expect(classifyInput("I'd like a coffee").kind).toBe('l1');
  });
  it('recognises romaji and converts it', () => {
    const r = classifyInput('arigatou gozaimasu');
    expect(r.kind).toBe('romaji');
    if (r.kind === 'romaji') expect(r.kana).toBe('ありがとうございます');
  });
  it('treats English that is not romaji as English even when not covered', () => {
    const r = classifyInput('I would like to learn about volcanoes');
    expect(r.kind).toBe('l1');
    if (r.kind === 'l1') expect(r.translation).toBeNull();
  });
});

describe('phrasebook hygiene', () => {
  it('never maps the same normalised sentence to two different phrases', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const p of PHRASEBOOK) {
      for (const lang of ['en', 'ar'] as const) {
        for (const raw of p[lang]) {
          const key = `${lang}:${norm(raw, lang)}`;
          const prev = seen.get(key);
          if (prev && prev !== p.id) clashes.push(`${key} -> ${prev} and ${p.id}`);
          seen.set(key, p.id);
        }
      }
    }
    expect(clashes).toEqual([]);
  });
});
