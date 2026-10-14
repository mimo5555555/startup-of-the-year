import type { Beat, BeatLine } from '@lw/game';

/**
 * Story beats of the chapters this release plays beyond the first two (docs/GAME_DESIGN.md §7.2): the opening and the closing of Chapter 3
 * (Mio, in the park) and the opening of Chapter 4 (Tanaka sends the player to the phone shop). Chapter 4 closes with the release epilogue
 * (`beats-core.ts`). The beats of chapters 5-8 return with those chapters. Every token is in the lexicon (`lexicon/quests.ts`).
 */
const L = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[]): Beat => ({ id, place, lines });

const B: Beat[] = [
  beat('b_ch3_open', 'park', [
    L('mio', 'こんにちは|！|わたし|は|ミオ|です|。', "Hello! I'm Mio.", 'مرحبًا! أنا ميو.'),
    L('mio', '友だち|に|なりましょう|！', "Let's be friends!", 'لنصبح أصدقاء!'),
  ]),
  beat('b_ch3_close', 'park', [L('mio', 'また|明日|ね|！', 'See you tomorrow!', 'أراك غدًا!')]),
  beat('b_ch4_open', 'konbini', [
    L('tanaka', 'スマホ|が|ほしい|です|か|？', 'Do you want a phone?', 'هل تريد هاتفًا؟'),
    L('tanaka', '電話|の|お店|は|どう|です|か|？', 'How about the phone shop, Hikari Denki?', 'ما رأيك بمتجر الهواتف، هيكاري دنكي؟'),
  ]),
];

/** Story beats for chapters 3-4: beat id -> beat. */
export const STORY_BEATS: Record<string, Beat> = Object.fromEntries(B.map((b) => [b.id, b]));
