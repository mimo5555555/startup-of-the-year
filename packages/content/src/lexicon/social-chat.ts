import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for phone chat (agent 4B-b, docs/GAME_DESIGN.md §8.7): the five P0 text templates. Keep surfaces unique across the whole lexicon (the content tests report clashes).

export const SOCIAL_CHAT_LEXICON: LexEntry[] = [
  // ---- chat_first: the new phone ----
  w('買った', 'かった', 'bought (plain)', 'اشتريت'),
  w('買いました', 'かいました', 'bought', 'اشتريت'),
  w('やったー', '', 'yay!', 'رائع!'),
  w('よかった', '', 'great / I am glad', 'رائع / يسعدني'),
  w('よかったです', '', 'I am glad', 'يسعدني ذلك'),
  w('黒い', 'くろい', 'black', 'أسود'),
  w('白い', 'しろい', 'white', 'أبيض'),
  w('青い', 'あおい', 'blue', 'أزرق'),
  w('赤い', 'あかい', 'red', 'أحمر'),
  w('こちらこそ', '', 'same to you / the pleasure is mine', 'وأنا أيضًا'),

  // ---- chat_greet: the plan for today ----
  w('おはよう', '', 'good morning (casual)', 'صباح الخير'),
  w('する', '', 'to do (plain)', 'يفعل'),
  w('いる', '', 'to be (there), plain', 'يكون (موجودًا)'),
  w('休みます', 'やすみます', 'rest / take a break', 'أرتاح'),
  w('ラーメン屋', 'ラーメンや', 'ramen shop', 'مطعم رامن'),

  // ---- chat_plan: meeting up ----
  w('会わない', 'あわない', 'meet? (plain, "shall we meet?")', 'نلتقي؟'),
  w('会いません', 'あいません', 'meet? (polite, "would you like to meet?")', 'هل نلتقي؟'),
  w('何時', 'なんじ', 'what time', 'أي ساعة'),
  w('三時', 'さんじ', "three o'clock", 'الساعة الثالثة'),
  w('じゃあ', '', 'well then', 'إذًا'),
  w('今度', 'こんど', 'next time', 'المرة القادمة'),
  w('そっか', '', 'I see', 'فهمت'),
  w('楽しみ', 'たのしみ', 'looking forward to it', 'أتطلع إليه'),
  w('うん', '', 'yes / uh-huh (casual)', 'نعم (عامية)'),
  w('わかった', '', 'got it (plain)', 'فهمت'),

  // ---- chat_food: lunch ----
  w('昼ごはん', 'ひるごはん', 'lunch', 'الغداء'),
  w('食べた', 'たべた', 'ate (plain)', 'أكلت'),
  w('食べました', 'たべました', 'ate', 'أكلت'),
  w('おいしかった', '', 'was delicious (plain)', 'كان لذيذًا'),
  w('おいしかったです', '', 'was delicious', 'كان لذيذًا'),
  w('教えて', 'おしえて', 'tell me / teach me', 'أخبرني'),
  w('寿司', 'すし', 'sushi', 'سوشي'),
  w('うどん', '', 'udon noodles', 'أودون'),
  w('カレー', '', 'curry', 'كاري'),
  w('パン', '', 'bread', 'خبز'),

  // ---- chat_miss: how are you? ----
  w('まあまあ', '', 'so-so', 'لا بأس'),
  w('疲れて', 'つかれて', 'tired', 'متعب'),
];
