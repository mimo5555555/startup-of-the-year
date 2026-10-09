import type { FriendDef, Line, PerkDef } from '@lw/game';
import { TASTES } from './gifts';

/**
 * Pack data: the six friends of Release 1 (docs/RELEASE_1.md; docs/GAME_DESIGN.md §8.1, §8.4, §8.6, §8.9). Mio, Yuki, Tanaka, Kenji,
 * Sato and Hanako are in the street from the start (`unlockChapter: 1`); the Friends screen, small talk and gifts open with Chapter 3
 * through the `opens` and the interaction rows, not through this table. Aiko, Rin and Nakamura are not in this release.
 *
 * - `casualAt`: the heart at which the friend switches to plain form (§8.1). Mio's ♥2 beat (`b_mio_h2`) asks for it in words and sets
 *   the `casual` flag; the hearts rule makes the same switch for anyone who got to ♥2 another way. Yuki and Kenji switch at ♥3.
 *   Tanaka, Hanako (polite) and Sato (formal) never do (99): they model staff keigo.
 * - `facts`: the three profile facts revealed at ♥1 / ♥2 / ♥3 (§8.4), with their sentence in `factLines` (the same sentences the
 *   small-talk scenarios say when they reveal them).
 * - `events`: heart events. Only the ♥2 beat of Mio exists in this release; the ♥4 beats, ♥5 scenes and home visits are deferred.
 * - `perks`: the small ♥4 perks and the ♥5 perks of §8.9 that the released shops can honour. A routine shop discount is at most
 *   BALANCE.routineDiscountMax (8%) in total, so the design's -10% at ♥5 is written as the ♥4 share plus the rest up to the cap. The
 *   ♥3 "small gift from them" (§8.6) is a one-time free item. The perks of ♥4 and ♥5 are earned by hearts alone here: the scenes the
 *   design attaches them to are deferred, the hearts are not.
 */

const L = (ja: string, en: string, ar: string): Line => ({ ja, en, ar });

/** a one-time small present from the friend at ♥3 (§8.6) */
const present = (friend: string, itemId: string, en: string, ar: string): PerkDef => ({
  id: `${friend}_gift3`,
  heart: 3,
  text: { en, ar },
  fx: { t: 'once_item', itemId },
});

export const FRIENDS: FriendDef[] = [
  {
    id: 'mio',
    tier: 'A',
    register: 'polite',
    casualAt: 2,
    unlockChapter: 1,
    ...TASTES.mio!,
    facts: ['likes_anime', 'photo_sakura', 'lives_alone'],
    factLines: {
      likes_anime: L('わたし|は|アニメ|が|好き|です。', 'I like anime.', 'أحب الأنمي.'),
      photo_sakura: L('春|に|桜|の|写真|を|とります。', 'In spring I take photos of cherry blossoms.', 'في الربيع ألتقط صورًا لأشجار الكرز.'),
      lives_alone: L('ひとり|で|住んで|います。', 'I live alone.', 'أعيش وحدي.'),
    },
    perks: [
      present('mio', 'konbini:cake', 'Mio gives you a cake', 'تعطيك ميو كعكة'),
      { id: 'mio_festival', heart: 5, text: { en: 'Festival partner', ar: 'شريكة المهرجان' }, fx: { t: 'cosmetic', id: 'festival_partner' } },
    ],
    events: [{ heart: 2, beat: 'b_mio_h2' }],
  },
  {
    id: 'yuki',
    tier: 'B',
    register: 'polite',
    casualAt: 3,
    unlockChapter: 1,
    ...TASTES.yuki!,
    facts: ['guitar', 'cat', 'dream_live'],
    factLines: {
      guitar: L('週末|に|ギター|を|弾きます。', 'I play guitar on weekends.', 'أعزف الغيتار في عطلة نهاية الأسبوع.'),
      cat: L('ねこ|が|います。|名前|は|モカ|です。', 'I have a cat. Her name is Mocha.', 'لدي قطة اسمها موكا.'),
      dream_live: L('いつか、|ライブ|を|したい|です。', 'Someday I want to do a live show.', 'أريد يومًا ما أن أقيم حفلًا حيًا.'),
    },
    perks: [
      present('yuki', 'cafe:blackTea', 'Yuki gives you a black tea', 'تعطيك يوكي شايًا أسود'),
      { id: 'yuki_coffee', heart: 4, text: { en: 'Every 5th coffee at the café is free', ar: 'كل خامس قهوة في المقهى مجانية' }, fx: { t: 'daily_free', shopId: 'cafe', itemId: 'coffee', every: 5 } },
      { id: 'yuki_cafe', heart: 5, text: { en: 'Café -8%', ar: 'خصم 8% في المقهى' }, fx: { t: 'shop_pct', shopId: 'cafe', pct: 0.08 } },
    ],
  },
  {
    id: 'tanaka',
    tier: 'B',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    ...TASTES.tanaka!,
    facts: ['games_night', 'sleepy', 'dream_game'],
    factLines: {
      games_night: L('毎晩|ゲーム|を|します。', 'I play games every night.', 'ألعب كل ليلة.'),
      sleepy: L('夜|は|ちょっと|眠い|です。', 'At night I get a little sleepy.', 'أشعر بالنعاس قليلًا في الليل.'),
      dream_game: L('ゲーム|の|会社|で|働き|たい|です。', 'I want to work at a game company.', 'أريد أن أعمل في شركة ألعاب.'),
    },
    perks: [
      present('tanaka', 'konbini:coffee', 'Tanaka gives you a coffee', 'يعطيك تاناكا قهوة'),
      { id: 'tanaka_konbini4', heart: 4, text: { en: 'Konbini -5%', ar: 'خصم 5% في الكونبيني' }, fx: { t: 'shop_pct', shopId: 'konbini', pct: 0.05 } },
      { id: 'tanaka_konbini5', heart: 5, text: { en: 'Konbini -8% in all', ar: 'خصم 8% في الكونبيني إجمالًا' }, fx: { t: 'shop_pct', shopId: 'konbini', pct: 0.03 } },
    ],
  },
  {
    id: 'sato',
    tier: 'B',
    register: 'keigo',
    casualAt: 99,
    unlockChapter: 1,
    ...TASTES.sato!,
    facts: ['thirty_years', 'old_trains', 'grandson'],
    factLines: {
      thirty_years: L('三十|年、|この|駅|で|働いて|います。', "I've worked at this station for 30 years.", 'أعمل في هذه المحطة منذ ثلاثين عامًا.'),
      old_trains: L('古い|電車|が|好き|です。', 'I like old trains.', 'أحب القطارات القديمة.'),
      grandson: L('孫|は|五|歳|です。', 'My grandson is five years old.', 'حفيدي عمره خمس سنوات.'),
    },
    perks: [
      present('sato', 'konbini:greenTea', 'Sato gives you a green tea', 'يعطيك ساتو شايًا أخضر'),
      { id: 'sato_fares4', heart: 4, text: { en: 'Fares -5%', ar: 'خصم 5% على أجرة القطار' }, fx: { t: 'shop_pct', shopId: 'station', pct: 0.05 } },
      { id: 'sato_fares5', heart: 5, text: { en: 'Fares -8% in all', ar: 'خصم 8% على أجرة القطار إجمالًا' }, fx: { t: 'shop_pct', shopId: 'station', pct: 0.03 } },
    ],
  },
  {
    id: 'kenji',
    tier: 'A',
    register: 'polite',
    casualAt: 3,
    unlockChapter: 1,
    ...TASTES.kenji!,
    facts: ['broth', 'baseball', 'daughter_hina'],
    factLines: {
      broth: L('スープ|は|十二|時間|煮ます。', 'I simmer the broth for 12 hours.', 'أغلي المرق اثنتي عشرة ساعة.'),
      baseball: L('野球|が|大好き|です。', 'I love baseball.', 'أحب البيسبول كثيرًا.'),
      daughter_hina: L('娘|の|ひな|は|七|歳|です。', 'My daughter Hina is seven.', 'ابنتي هينا عمرها سبع سنوات.'),
    },
    perks: [
      present('kenji', 'konbini:onigiri', 'Kenji gives you a rice ball', 'يعطيك كينجي أونيغيري'),
      { id: 'kenji_kaedama', heart: 4, text: { en: 'One free extra-noodles refill a day', ar: 'نودلز إضافية مجانية مرة كل يوم' }, fx: { t: 'daily_free', shopId: 'ramen', itemId: 'kaedama' } },
      { id: 'kenji_ramen', heart: 5, text: { en: 'Ramen -8%', ar: 'خصم 8% على الرامن' }, fx: { t: 'shop_pct', shopId: 'ramen', pct: 0.08 } },
    ],
  },
  {
    id: 'hanako',
    tier: 'B',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    ...TASTES.hanako!,
    facts: ['teach_songs', 'calligraphy', 'letters'],
    factLines: {
      teach_songs: L('歌|で|日本語|を|教えます。', 'I teach Japanese with songs.', 'أعلّم اليابانية بالأغاني.'),
      calligraphy: L('書道|が|趣味|です。', 'My hobby is calligraphy.', 'هوايتي الخط.'),
      letters: L('毎年、|生徒|の|手紙|を|読みます。', "Every year I read my students' letters.", 'أقرأ كل عام رسائل طلابي.'),
    },
    perks: [
      present('hanako', 'cafe:greenTea', 'Hanako gives you a green tea', 'تعطيك هاناكو شايًا أخضر'),
      { id: 'hanako_scholarship', heart: 5, text: { en: 'A one-time ¥3,000 scholarship', ar: 'منحة دراسية لمرة واحدة بقيمة 3,000 ين' }, fx: { t: 'once_cash', amount: 3000 } },
    ],
  },
];
