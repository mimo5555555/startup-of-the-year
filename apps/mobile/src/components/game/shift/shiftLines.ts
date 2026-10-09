// The boss's lines on the Shift screen (docs/GAME_DESIGN.md §9.1-§9.2): refusal, feedback bands, retry and rank-up. Every line has Japanese, English
// and Arabic; the Japanese tokens live in `packages/content/src/lexicon/jobs.ts` (and the shared lexicon), so the screen shows them as tappable
// words with furigana like any other line.
import { L, type Line } from '@lw/content';

export const REFUSE: Line = L(
  '今日|は|もう|大丈夫|です|。|ゆっくり|休んで|ください|。',
  'That is enough for today. Please rest.',
  'يكفي لهذا اليوم. ارتح قليلًا.',
);
export const RETRY: Line = L('大丈夫|です|。|もう一度|やりましょう|。', "It's okay. Let's try again.", 'لا بأس. لنحاول مرة أخرى.');

export type Band = 'perfect' | 'nice' | 'almost' | 'retry';
export const BAND_LINES: Record<Band, Line> = {
  perfect: L('完璧|です|！', 'Perfect!', 'ممتاز!'),
  nice: L('いい|です|ね|！', 'Nice!', 'جميل!'),
  almost: L('もう少し|！', 'A little more!', 'قليلًا بعد!'),
  retry: RETRY,
};

/** Rank names (rank 0 trainee ... 4 acting manager): Japanese with reading, as on the result card. */
export const RANK_JA: Array<{ ja: string; reading: string }> = [
  { ja: '見習い', reading: 'みならい' },
  { ja: '一人前', reading: 'いちにんまえ' },
  { ja: 'ベテラン', reading: '' },
  { ja: 'エース', reading: '' },
  { ja: '店長代理', reading: 'てんちょうだいり' },
];

/** The rank-up line for reaching rank 1-4 (index = rank). */
export const RANK_UP: Array<Line | null> = [
  null,
  L(
    '一人前|に|なりました|！|時給|が|上がります|。',
    "You're a full-fledged worker now! Your wage goes up.",
    'أصبحت عاملًا متمكّنًا! سيرتفع أجرك.',
  ),
  L('ベテラン|に|なりました|！|時給|が|上がります|。', "You're a veteran now! Your wage goes up.", 'أصبحت محترفًا! سيرتفع أجرك.'),
  L('エース|に|なりました|！|時給|が|上がります|。', "You're an ace now! Your wage goes up.", 'أصبحت نجمًا! سيرتفع أجرك.'),
  L(
    '店長代理|に|なりました|！|時給|が|上がります|。',
    "You're the acting manager now! Your wage goes up.",
    'أصبحت نائب المدير! سيرتفع أجرك.',
  ),
];

export const WELCOME_JA = 'いらっしゃいませ';
