// UI strings of the festival (Chapter 7, Release 2 wave C2, the app side): the speech rehearsal in Prepare and the capstone's debrief note. The
// content agent's `story-c2.ts` holds the Real-mode and one-time Guided labels. Every key needs an English and an Arabic string ('fest.').

export const en = {
  'fest.rehearsalSub': 'Listen, then say or type each line. Each line you get right is ticked. Nothing you say is recorded.',
  'fest.check': 'Check',
  'fest.lineOk': 'Well said!',
  'fest.lineAgain': 'Not quite. Listen and try again.',
  'fest.ticks': '{n} of {total} lines ready',
  'fest.goStage': 'Go on stage',
  'fest.guidedNote': 'You have not used Real mode yet, so this one time the speech may use chips. Chip lines count half.',
  'fest.own': 'Your own lines: {n} of {need}',
  'fest.ownDone': 'All {need} lines in your own words!',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'fest.rehearsalSub': 'استمع ثم قل كل جملة أو اكتبها. تُعلَّم كل جملة تصيبها. لا يُسجَّل شيء مما تقوله.',
  'fest.check': 'تحقّق',
  'fest.lineOk': 'أحسنت!',
  'fest.lineAgain': 'ليس تمامًا. استمع وحاول مرة أخرى.',
  'fest.ticks': '{n} من {total} جمل جاهزة',
  'fest.goStage': 'اصعد إلى المنصة',
  'fest.guidedNote': 'لم تستخدم الوضع الحقيقي بعد، لذا يمكن لكلمتك هذه المرة فقط أن تستخدم الاقتراحات. جمل الاقتراحات تُحتسب بالنصف.',
  'fest.own': 'جملك أنت: {n} من {need}',
  'fest.ownDone': 'الجمل الـ{need} كلها بكلماتك!',
};
