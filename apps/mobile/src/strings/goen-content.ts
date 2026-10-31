// Content-side strings of Goen stage 1 (docs/GOEN.md): the toasts @lw/game's Goen stage emits (`goen.toast.*`, reasons `goen.reason.*`) and
// the stamp book's hints for the two shrine culture cards. The Shrine, Season and Kyoto screens' own strings are `gn.*` in goen.ts.

export const en = {
  'goen.toast.earned': '+{n} Goen: {reason}',
  'goen.toast.charm': 'Your omamori kept the streak alive ({left} left)',
  'goen.toast.tier': 'Season tier {tier} reached',
  'goen.toast.task': 'Season task done',
  'goen.toast.journeyDone': 'Journey complete! +{n} Goen',
  'goen.reason.chapter': 'chapter completed',
  'goen.reason.daily': 'all daily goals',
  'goen.reason.streak': 'speaking streak',
  'goen.reason.capstone': 'your festival speech',
  'goen.reason.letter': 'your Letter Home',
  'goen.reason.season': 'season reward',
  'goen.reason.journey': 'journey complete',
  'goen.reason.spend': 'spent at the shrine',
  'culture.hint.goen': 'Visit the little shrine at the park torii.',
  'culture.hint.sanpai': 'Make a wish at the shrine, or look at its water basin.',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'goen.toast.earned': '+{n} غوإن: {reason}',
  'goen.toast.charm': 'حفظت التميمة سلسلتك (المتبقي {left})',
  'goen.toast.tier': 'بلغت المستوى {tier} من الموسم',
  'goen.toast.task': 'أُنجزت مهمة من الموسم',
  'goen.toast.journeyDone': 'اكتملت الرحلة! +{n} غوإن',
  'goen.reason.chapter': 'إنهاء فصل',
  'goen.reason.daily': 'كل أهداف اليوم',
  'goen.reason.streak': 'سلسلة التحدّث',
  'goen.reason.capstone': 'كلمتك في المهرجان',
  'goen.reason.letter': 'رسالتك إلى الأهل',
  'goen.reason.season': 'مكافأة الموسم',
  'goen.reason.journey': 'اكتمال الرحلة',
  'goen.reason.spend': 'أُنفق في المعبد',
  'culture.hint.goen': 'زر المعبد الصغير عند بوابة الحديقة.',
  'culture.hint.sanpai': 'تمنَّ أمنية في المعبد أو انظر إلى حوض الماء فيه.',
};
