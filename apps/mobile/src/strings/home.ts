// UI strings for homes and the genkan. Every key needs an English and an Arabic string; keys are prefixed 'home.'.
// The room names, the genkan hint and the reward lines are `fv.*` (strings/friends-visit.ts, content's words for the same feature).

export const en = {
  'home.shoesOff': 'Take shoes off',
  'home.slippers': 'Put on slippers',
  'home.step': 'Step {n}',
  'home.done': 'Done',
  'home.cooldown1': 'You hung out recently. Come back tomorrow.',
  'home.cooldown2': 'You hung out recently. Come back in 2 days.',
  'home.door.invite': 'Friends invite you home at {need} hearts. You have {have} with {name}.',
  'home.host.says': '{name} says',
  'home.room': 'Inside {room}',
  'home.reward.title': 'Keepsakes',
  'home.talk': 'Talk to {name}',
  'home.leave.ask': "The visit is not finished. Leave anyway?",
  'home.stay': 'Stay',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'home.shoesOff': 'اخلع الحذاء',
  'home.slippers': 'البس الخف',
  'home.step': 'الخطوة {n}',
  'home.done': 'تم',
  'home.cooldown1': 'قضيتما وقتًا معًا مؤخرًا. عُد غدًا.',
  'home.cooldown2': 'قضيتما وقتًا معًا مؤخرًا. عُد بعد يومين.',
  'home.door.invite': 'يدعوك الأصدقاء إلى بيوتهم عند {need} قلوب. لديك {have} مع {name}.',
  'home.host.says': 'يقول {name}',
  'home.room': 'داخل {room}',
  'home.reward.title': 'تذكارات',
  'home.talk': 'تحدّث مع {name}',
  'home.leave.ask': 'الزيارة لم تنتهِ بعد. هل تغادر؟',
  'home.stay': 'ابقَ',
};
