import type { DailyTemplate } from '@lw/game';

// The 10 daily goal templates (docs/GAME_DESIGN.md §7.4, D19). One counter each (`DailyCounter`), read from the goal's own creation day.
// `requires` keeps a template away from a player who cannot do it yet: nothing here names a place, shop or friend that is still locked,
// and `kids: false` is not used (every template is fine for a child). The rules that pick a template (the priority overrides of
// `daily.generate`) name `g_review8`, `g_shift`, `g_friend`, `g_conv2` and `g_newphrase2`, so those ids must stay as they are.
// Rewards are not data here: BALANCE.goals pays ¥100 each, +¥150 for the trio and the streak bonus.

export const DAILY: DailyTemplate[] = [
  // speak
  { id: 'g_conv2', slot: 'speak', counter: 'conv_distinct', target: 2, text: { en: 'Finish 2 different conversations', ar: 'أنهِ محادثتين مختلفتين' } },
  { id: 'g_indep6', slot: 'speak', counter: 'indep_lines', target: 6, text: { en: 'Say 6 lines in your own words', ar: 'قل 6 جمل بكلماتك أنت' } },
  { id: 'g_newphrase2', slot: 'speak', counter: 'new_intents', target: 2, text: { en: 'Use 2 new ways of saying things', ar: 'استخدم طريقتين جديدتين للتعبير' } },
  // do
  { id: 'g_buy', slot: 'do', counter: 'purchase', target: 1, requires: { chapter: 1 }, text: { en: 'Buy something in Japanese', ar: 'اشترِ شيئًا باللغة اليابانية' } },
  { id: 'g_shift', slot: 'do', counter: 'shift_good', target: 1, requires: { job: true }, text: { en: 'Finish a shift', ar: 'أنهِ وردية' } },
  { id: 'g_friend', slot: 'do', counter: 'friend_contact', target: 1, requires: { chapter: 3, friends: true }, text: { en: 'Spend time with a friend', ar: 'اقضِ وقتًا مع صديق' } },
  { id: 'g_place', slot: 'do', counter: 'places_distinct', target: 2, text: { en: 'Talk to people in 2 different places', ar: 'تحدّث مع أشخاص في مكانين مختلفين' } },
  // review
  { id: 'g_review8', slot: 'review', counter: 'review_checked', target: 8, requires: { vocabCards: true }, text: { en: 'Review 8 words that are due', ar: 'راجع 8 كلمات مستحقة' } },
  { id: 'g_lesson', slot: 'review', counter: 'lesson', target: 1, text: { en: 'Finish a lesson', ar: 'أنهِ درسًا' } },
  { id: 'g_culture', slot: 'review', counter: 'culture_new', target: 1, requires: { unseenCulture: true }, text: { en: 'Learn one new thing about Japan', ar: 'تعلّم شيئًا جديدًا عن اليابان' } },
];
