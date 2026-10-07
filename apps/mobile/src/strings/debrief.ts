// UI strings for the debrief: stars, pay lines, echo. Every key needs an English and an Arabic string; keys are prefixed 'debrief.'.

export const en = {
  'debrief.stars': 'Stars',
  'debrief.yenTitle': 'Your pay',
  'debrief.nudge': 'Try the next one without a chip: about +¥{n}',
  'debrief.keep': 'Keep these',
  'debrief.sayIt': 'Say it',
  'debrief.echoPaid': 'Said it yourself: +¥{n}',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'debrief.stars': 'النجوم',
  'debrief.yenTitle': 'أجرك',
  'debrief.nudge': 'جرّب التالي بلا اقتراحات: نحو +¥{n}',
  'debrief.keep': 'احتفظ بهذه',
  'debrief.sayIt': 'قلها',
  'debrief.echoPaid': 'قلتها بنفسك: +¥{n}',
};
