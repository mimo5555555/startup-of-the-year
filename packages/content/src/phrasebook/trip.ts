import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases of Release 2 wave C1: the Hikarigaoka trip (`trip_hikarigaoka` with Kato) and the café and station job intros. English is written without contractions; ids must be unique across modules. */
export const TRIP_PHRASES: PhraseEntry[] = [
  P(
    'trip_came_by_train',
    'はい、|電車|で|来ました。',
    ['yes i came by train', 'i came by train', 'yes by train', 'by train', 'yes i came on the train', 'i took the train', 'yes i took the train', 'i came by the train'],
    ['نعم جئت بالقطار', 'جئت بالقطار', 'بالقطار', 'نعم بالقطار', 'نعم ركبت القطار', 'ركبت القطار'],
  ),
  P(
    'trip_where_park',
    '公園|は|どこ|です|か？',
    ['where is the park', 'where is the park please', 'where is a park', 'is there a park', 'where can i find the park'],
    ['اين الحديقة', 'أين الحديقة', 'اين المنتزه', 'أين المنتزه', 'اين اجد الحديقة', 'أين أجد الحديقة'],
  ),
  P(
    'trip_souvenir_please',
    'お土産|を|ください。',
    ['a souvenir please', 'souvenir please', 'i would like a souvenir', 'i want a souvenir', 'an omiyage please', 'omiyage please', 'a souvenir', 'i will take a souvenir', 'can i have a souvenir'],
    ['هدية تذكارية من فضلك', 'اريد هدية تذكارية', 'أريد هدية تذكارية', 'هدية تذكارية', 'اوميياغي من فضلك', 'أوميياغي من فضلك', 'تذكار من فضلك'],
  ),
  P(
    'trip_just_looking',
    '見ている|だけ|です。',
    ['i am just looking', 'just looking', 'i am only looking', 'only looking', 'i am looking around', 'just browsing', 'i am just browsing'],
    ['انا اتفرج فقط', 'أنا أتفرج فقط', 'اتفرج فقط', 'أتفرج فقط', 'فقط انظر', 'أنظر فقط'],
  ),
  // the job intros of the café and the station help desk
  P(
    'job_omatase',
    'お待たせしました。',
    ['sorry to keep you waiting', 'sorry for the wait', 'thank you for waiting', 'sorry for keeping you waiting', 'sorry i kept you waiting', 'omatase shimashita'],
    ['اسف على الانتظار', 'آسف على الانتظار', 'اسف لانتظارك', 'آسف لانتظارك', 'شكرا على انتظارك', 'عذرا على الانتظار'],
  ),
  P(
    'job_platform_three',
    '三番線|です。',
    ['it is platform 3', 'platform 3', 'platform three', 'it is platform three', 'it is on platform 3', 'it is on platform three', 'it is track 3', 'track 3'],
    ['انه الرصيف 3', 'إنه الرصيف 3', 'الرصيف 3', 'الرصيف الثالث', 'انه الرصيف الثالث', 'إنه الرصيف الثالث'],
  ),
  P(
    'job_okiotsukete',
    'お気をつけて。',
    ['please take care', 'take care of yourself', 'have a safe journey', 'safe travels', 'have a good trip', 'okiotsukete'],
    ['رحلة سعيدة', 'رحلة امنة', 'رحلة آمنة', 'في امان الله', 'في أمان الله'],
  ),
];
