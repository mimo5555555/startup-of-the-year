// UI strings for the world HUD: wallet pill, tracker card, pace. Every key needs an English and an Arabic string; keys are prefixed 'hud.'.

export const en = {
  'hud.wallet': 'Wallet',
  'hud.ic': 'IC card',
  'hud.points': 'Points',
  'hud.workHours': '≈ {n} h of work',
  'hud.moreYen': '¥{n} to go',
  'hud.nextUp': 'Next goal',
  'hud.moreGoals': 'More goals',
  'hud.pace': 'About {n} days at your pace',
  'hud.softCap': 'Shops are quiet today. Extra practice still counts toward chapters.',
  'hud.cantListen': "I can't listen right now",
} as const;

export const ar: Record<keyof typeof en, string> = {
  'hud.wallet': 'المحفظة',
  'hud.ic': 'بطاقة IC',
  'hud.points': 'النقاط',
  'hud.workHours': '≈ {n} ساعة عمل',
  'hud.moreYen': 'بقي ¥{n}',
  'hud.nextUp': 'الهدف التالي',
  'hud.moreGoals': 'المزيد من الأهداف',
  'hud.pace': 'نحو {n} يومًا بوتيرتك',
  'hud.softCap': 'المتاجر هادئة اليوم. التدريب الإضافي ما زال يُحتسب للفصول.',
  'hud.cantListen': 'لا أستطيع الاستماع الآن',
};
