import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for Aiko's tea house (`aiko_tea`; docs/GAME_DESIGN.md §6.3, §15.10 "shop-aiko"). Keep surfaces unique across the whole lexicon (the content tests report clashes).
// ミオ and あなた are in the core module, 花子 in the quests module, お茶 in core, 現金 and おすすめ in core, 少し in the shop module, the colours 赤 白 青 in the Denki module,
// 税込 and 全部 in the numbers / Fuku-Fuku modules. The flat (aiko_viewing, aiko_contract) is not in this wave.

export const SHOP_AIKO_LEXICON: LexEntry[] = [
  // ---- the presents (slot `giftItem`) ----
  w('お花', 'おはな', 'flowers', 'زهور'),
  w('和菓子', 'わがし', 'wagashi (Japanese sweets)', 'واغاشي (حلويات يابانية)'),
  w('お茶セット', 'おちゃセット', 'tea set', 'طقم شاي'),
  w('手ぬぐい', 'てぬぐい', 'tenugui (hand towel)', 'تينوغوي (منشفة يد)'),

  // ---- who it is for (slot `giftFriend`): the friends' names as the learner meets them ----
  w('ゆき', '', 'Yuki (a name)', 'يوكي (اسم)'),
  w('田中', 'たなか', 'Tanaka (a name)', 'تاناكا (اسم)'),
  w('佐藤', 'さとう', 'Sato (a name)', 'ساتو (اسم)'),
  w('けんじ', '', 'Kenji (a name)', 'كينجي (اسم)'),
  w('自分', 'じぶん', 'myself', 'نفسي'),
  w('どなた', '', 'who (polite)', 'من (بأدب)'),

  // ---- wrapping ----
  w('ラッピング', '', 'gift wrapping', 'تغليف الهدايا'),
  w('無料', 'むりょう', 'free of charge', 'مجاني'),
  w('リボン', '', 'ribbon', 'شريط'),
  w('ピンク', '', 'pink', 'وردي'),

  // ---- shop talk ----
  w('喜びます', 'よろこびます', 'will be pleased', 'سيُسَرّ'),
  w('喜んで', 'よろこんで', 'being pleased (te-form)', 'مسرورًا'),
  w('楽しんで', 'たのしんで', 'enjoying (te-form)', 'مستمتعًا'),
  w('ごめんなさい', '', 'I am sorry', 'آسفة'),
  w('あら', '', 'oh (soft surprise)', 'آه'),
  w('くれる', '', 'to do for me / for us (casual)', 'يفعل من أجلي'),
  w('来て', 'きて', 'come (te-form)', 'تعال'),
  w('ほか', '', 'other / else', 'آخر'),
  w('きっと', '', 'surely', 'بالتأكيد'),
  w('あと', '', 'only (so much) left', 'المتبقّي'),
  w('いりません', '', 'I do not need it', 'لا أحتاجه'),
];

void g;
