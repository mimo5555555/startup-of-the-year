import type { AgeGroup, Topic } from './types';

export const TOPICS: Topic[] = [
  { id: 'food', name: { en: 'Food & cooking', ar: 'الطعام والطبخ' }, hobby: 'cooking' },
  { id: 'travel', name: { en: 'Travel', ar: 'السفر' }, hobby: 'travel' },
  { id: 'music', name: { en: 'Music', ar: 'الموسيقى' }, hobby: 'music' },
  { id: 'movies', name: { en: 'Movies & TV', ar: 'الأفلام والتلفزيون' }, hobby: 'movies' },
  { id: 'sports', name: { en: 'Sports & fitness', ar: 'الرياضة واللياقة' }, hobby: 'sports' },
  { id: 'gaming', name: { en: 'Gaming', ar: 'الألعاب' }, hobby: 'games' },
  { id: 'tech', name: { en: 'Tech & gadgets', ar: 'التقنية والأجهزة' } },
  { id: 'fashion', name: { en: 'Fashion', ar: 'الموضة' } },
  { id: 'art', name: { en: 'Art & design', ar: 'الفن والتصميم' }, hobby: 'drawing' },
  { id: 'books', name: { en: 'Books', ar: 'الكتب' }, hobby: 'books' },
  { id: 'nature', name: { en: 'Nature & animals', ar: 'الطبيعة والحيوانات' } },
  { id: 'health', name: { en: 'Health & wellness', ar: 'الصحة والعافية' } },
  { id: 'business', name: { en: 'Business & careers', ar: 'الأعمال والمهن' } },
  { id: 'science', name: { en: 'Science', ar: 'العلوم' } },
  { id: 'history', name: { en: 'History', ar: 'التاريخ' } },
  { id: 'culture', name: { en: 'Culture & traditions', ar: 'الثقافة والتقاليد' } },
  { id: 'cars', name: { en: 'Cars & transport', ar: 'السيارات والمواصلات' } },
  { id: 'photo', name: { en: 'Photography', ar: 'التصوير' }, hobby: 'photo' },
  { id: 'anime', name: { en: 'Anime & manga', ar: 'الأنمي والمانغا' }, hobby: 'anime' },
  { id: 'social', name: { en: 'Social media', ar: 'وسائل التواصل' } },
  { id: 'family', name: { en: 'Family & relationships', ar: 'العائلة والعلاقات' } },
  { id: 'shopping', name: { en: 'Shopping', ar: 'التسوق' } },
  { id: 'environment', name: { en: 'Environment', ar: 'البيئة' } },
  { id: 'news', name: { en: 'Current affairs', ar: 'الأحداث الجارية' }, adult: true },
];

export const AGE_GROUPS: AgeGroup[] = [
  { id: 'kids', name: { en: 'Kids', ar: 'أطفال' }, range: '6–12' },
  { id: 'teens', name: { en: 'Teens', ar: 'مراهقون' }, range: '13–17' },
  { id: 'adults', name: { en: 'Adults', ar: 'بالغون' }, range: '18–49' },
  { id: 'seniors', name: { en: '50 and over', ar: '50 فما فوق' }, range: '50+' },
];

export interface GoalDef {
  id: 'travel' | 'work' | 'relocation' | 'casual';
  name: { en: string; ar: string };
  blurb: { en: string; ar: string };
}

export const GOALS: GoalDef[] = [
  { id: 'travel', name: { en: 'Travel', ar: 'السفر' }, blurb: { en: 'Order, ask directions, get around', ar: 'الطلب وسؤال الاتجاهات والتنقل' } },
  { id: 'work', name: { en: 'Work', ar: 'العمل' }, blurb: { en: 'Polite, professional Japanese', ar: 'يابانية مهذبة ومهنية' } },
  { id: 'relocation', name: { en: 'Moving there', ar: 'الانتقال للعيش' }, blurb: { en: 'Daily life, shops, neighbours', ar: 'الحياة اليومية والمتاجر والجيران' } },
  { id: 'casual', name: { en: 'Just for fun', ar: 'للمتعة' }, blurb: { en: 'Chat, make friends, enjoy it', ar: 'الدردشة وتكوين الصداقات' } },
];
