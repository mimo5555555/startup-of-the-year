// UI strings for wallet, prices, shops and inventory. Every key needs an English and an Arabic string; keys are prefixed 'shop.', 'receipt.' and 'wallet.'.

export const en = {
  'shop.taxIncluded': 'tax included',
  'shop.notEnough': 'Not enough yen',
  'shop.closed': 'Not open yet',
  'shop.opensIn': 'Opens in Chapter {n}',
  'shop.someday': 'Someday (18+)',
  'shop.goods': 'Look at the goods',
  'shop.delivery': 'Delivery ¥{n}',
  'shop.owned': 'You have this',
  'shop.window': 'Look through the window',
  'receipt.subtotal': '小計 · Subtotal',
  'receipt.tax': '消費税 · Tax',
  'receipt.total': '合計 · Total',
  'receipt.paid': 'お預かり · Paid',
  'receipt.change': 'お釣り · Change',
} as const;

export const ar: Record<keyof typeof en, string> = {
  'shop.taxIncluded': 'شامل الضريبة',
  'shop.notEnough': 'الين لا يكفي',
  'shop.closed': 'لم يُفتح بعد',
  'shop.opensIn': 'يُفتح في الفصل {n}',
  'shop.someday': 'يومًا ما (18+)',
  'shop.goods': 'تفقّد البضائع',
  'shop.delivery': 'التوصيل ¥{n}',
  'shop.owned': 'لديك هذا',
  'shop.window': 'انظر عبر النافذة',
  'receipt.subtotal': '小計 · المجموع الفرعي',
  'receipt.tax': '消費税 · الضريبة',
  'receipt.total': '合計 · الإجمالي',
  'receipt.paid': 'お預かり · المدفوع',
  'receipt.change': 'お釣り · الباقي',
};
