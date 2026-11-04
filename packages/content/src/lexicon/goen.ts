import type { LexEntry } from '../types';
import { g, w } from './helpers';

// Lexicon entries for Goen stage 1 (docs/GOEN.md): the shrine and its wish ritual (shrine_wish, 「〜ますように」), the omikuji wording, the
// culture cards cc_goen and cc_sanpai, and the autumn season's words. Keep surfaces unique across the whole lexicon (the content tests report
// clashes); 日本語, 毎日, 部屋, 安全, 上手, きれい and いい live in other modules.

export const GOEN_LEXICON: LexEntry[] = [
  // ---- the wish ritual ----
  w('お願い', 'おねがい', 'a wish, a request', 'أمنية، طلب'),
  g('ように', 'so that; with 〜ます: "I hope…" (a wish)', 'لكي؛ مع 〜ます: «أتمنى…» (أمنية)', 'yō ni'),
  w('見られます', 'みられます', 'can see', 'يستطيع أن يرى'),
  w('行けます', 'いけます', 'can go', 'يستطيع أن يذهب'),
  w('なれます', '', 'can become', 'يستطيع أن يصبح'),
  w('走れます', 'はしれます', 'can ride, can run', 'يستطيع أن يقود، يستطيع أن يجري'),
  w('話せます', 'はなせます', 'can speak', 'يستطيع أن يتحدّث'),
  w('かないます', '', 'comes true', 'تتحقق'),
  w('ご縁', 'ごえん', 'a connection, a bond (go-en also sounds like "five yen")', 'صلة، رابطة (وتشبه «خمسة ين»)'),
  w('お守り', 'おまもり', 'omamori, a protective charm', 'أوماموري، تميمة'),
  w('二礼', 'にれい', 'two bows', 'انحناءتان'),
  w('二拍手', 'にはくしゅ', 'two claps', 'تصفيقتان'),
  w('一礼', 'いちれい', 'one bow', 'انحناءة واحدة'),
  // ---- the omikuji ----
  w('大吉', 'だいきち', 'great blessing (omikuji)', 'بركة عظيمة (أوميكوجي)'),
  w('吉', 'きち', 'blessing (omikuji)', 'بركة (أوميكوجي)'),
  w('小吉', 'しょうきち', 'small blessing (omikuji)', 'بركة صغيرة (أوميكوجي)'),
  // ---- autumn (the season's words) ----
  w('秋', 'あき', 'autumn', 'الخريف'),
  w('紅葉', 'こうよう', 'autumn leaves, red maple leaves', 'أوراق الخريف، أوراق القيقب الحمراء'),
  w('栗', 'くり', 'chestnut', 'كستناء'),
  w('栗まんじゅう', 'くりまんじゅう', 'chestnut manjū (a sweet bun)', 'مانجو الكستناء (كعكة حلوة)'),
  w('栗きんとん', 'くりきんとん', 'kuri kinton (sweet chestnut paste)', 'كوري كينتون (عجينة كستناء حلوة)'),
  w('柿', 'かき', 'persimmon', 'كاكا (برسيمون)'),
  w('お月見', 'おつきみ', 'moon viewing (in autumn)', 'تأمّل القمر (في الخريف)'),
  w('焼き芋', 'やきいも', 'roasted sweet potato', 'بطاطا حلوة مشوية'),
  w('涼しい', 'すずしい', 'cool (weather)', 'منعش، بارد قليلًا (الطقس)'),
  w('落ち葉', 'おちば', 'fallen leaves', 'أوراق متساقطة'),
  // ---- the manners (所作): their names and wishes ----
  w('お辞儀', 'おじぎ', 'a bow', 'انحناءة'),
  w('会釈', 'えしゃく', 'a light nod-bow', 'إيماءة انحناء خفيفة'),
  w('合掌', 'がっしょう', 'putting your hands together', 'ضمّ اليدين'),
  w('両手', 'りょうて', 'both hands', 'كلتا اليدين'),
  w('渡す', 'わたす', 'to hand over', 'يسلّم، يعطي'),
  w('手', 'て', 'a hand', 'يد'),
  w('振る', 'ふる', 'to wave, to shake', 'يلوّح، يهزّ'),
  w('気持ち', 'きもち', 'feelings', 'مشاعر'),
  w('会えます', 'あえます', 'can meet', 'أستطيع أن ألتقي'),
  w('伝わります', 'つたわります', 'comes across, is conveyed', 'يصل (المعنى أو الشعور)'),
  w('食べられます', 'たべられます', 'can eat', 'أستطيع أن آكل'),
  w('ご飯', 'ごはん', 'a meal, rice', 'وجبة، أرز'),
];
