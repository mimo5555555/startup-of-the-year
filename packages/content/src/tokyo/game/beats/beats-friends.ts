import type { Beat, BeatLine } from '@lw/game';

/**
 * Story beats of the friends (4A): the beats a heart event plays (`FriendDef.events`). Release 1 has one, Mio's ♥2 beat, the emotional
 * moment of Chapter 3 (docs/GAME_DESIGN.md §7.2): she asks for the player's number, hands over hers on a paper note when there is no phone
 * yet, and asks to drop the formal speech. The app queues the beat when the friend reaches the heart (`heart_event_ready`) and files
 * `heart_event_done` when it ends (+10 AP once). The lines use only words of `lexicon/social-friends.ts`.
 */
const L = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });

/** Story beats for home beats (4E-a) and Mio's heart-2 beat (4A): beat id -> beat. */
export const FRIENDS_BEATS: Record<string, Beat> = {
  b_mio_h2: {
    id: 'b_mio_h2',
    place: 'park',
    lines: [
      L('mio', '電話番号|を|教えて|ください|。', 'Please tell me your phone number.', 'أخبرني رقم هاتفك من فضلك.'),
      L('mio', 'あ|、|まだ|スマホ|が|ない|です|か|？|じゃあ|、|これ|。', "Oh, you don't have a phone yet? Then, here.", 'آه، ليس لديك هاتف بعد؟ إذًا، تفضّل هذه.'),
      L('mio', 'わたし|の|番号|です|。|メモ|を|見て|ください|。', "It's my number. Look at the note.", 'هذا رقمي. انظر إلى المذكرة.'),
      L('mio', '敬語|は|やめよう|！|タメ口|で|いい|？', "Let's drop the formal speech! Is casual OK?", 'لنترك الكلام الرسمي! هل نتكلم بصيغة عادية؟'),
    ],
    // the paper note is a keepsake (never sold); `casual` flips Mio to plain form for the conversations and the feedback (§11.4)
    effects: [
      { t: 'friendFlag', friend: 'mio', id: 'number_note' },
      { t: 'friendFlag', friend: 'mio', id: 'casual' },
      { t: 'keepsake', id: 'note_mio' },
      { t: 'culture', id: 'cc_keigo' },
    ],
  },
};
