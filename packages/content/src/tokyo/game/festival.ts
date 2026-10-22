import type { GamePack, GameState } from '@lw/game';
// Type-only imports from @lw/game: content adds no runtime dependency on it.
import type { L1, Line } from '../../types';
import { letterFacts } from './letter';

// The festival of Chapter 7 (docs/GAME_DESIGN.md §7.2, §6.4 festival dressing; Release 2 wave C2): when the park is the festival, who comes, what
// the app starts there, and the speech rehearsal the Prepare screen shows for the capstone.
//
// FESTIVAL DAY RULE. The opening beat says the festival is "on Saturday". The game has no calendar of its own (a day is a play day, D3), so
// the smallest rule that can never deadlock is:
//   - Chapter 7: the park is the festival from the NEXT play day after Chapter 7 began (`clock.dayIndex > chapter.began.dayIndex`), every day
//     until the chapter is done, and on the very first day too when that day is a Saturday (local date). One day rollover always comes, and
//     Chapter 7's minDays (19) is already 5 active days above Chapter 6's (14), so the wait never delays a completion that minDays allows.
//   - Chapter 8 and Free Walk: the festival is back every Saturday (local date), for the stalls; the objectives no longer need it.
// The app (world.setFestival, the festival rows, the stall and stage picks) and the world learn it from `festivalOpen(state)`.

export const FESTIVAL = {
  chapter: 7,
  /** the park becomes the festival */
  place: 'park',
  /** what the app files when the player walks into the festival (`{ t: 'visit', place: 'festival' }`): unlocks `cc_matsuri` */
  visit: 'festival',
  /** friends at this many hearts or more come to the festival (c7_1 counts four of them) */
  guestHearts: 2,
  /** always there: Hanako is the MC on the stage, Kenji keeps his ramen stall */
  hosts: ['hanako', 'kenji'] as const,
  stallsScenario: 'matsuri_stalls',
  speechScenario: 'matsuri_speech',
  /** the Talk rows that are listed only while the festival is open (`interactions.ts`) */
  rows: ['kenji_stall', 'hanako_speech'] as const,
  /** Chapter 7's closing beat plays at night under the fireworks (`world.fireworks(true)` while it plays) */
  fireworksBeat: 'b_ch7_close',
} as const;

/** The Talk rows to hide while the festival is not open. */
export const FESTIVAL_ROWS: readonly string[] = FESTIVAL.rows;

/** Whether a local date (YYYY-MM-DD) is a Saturday. */
export function isSaturday(localDate: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate ?? '');
  if (!m) return false;
  return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)).getUTCDay() === 6;
}

/** The festival day rule (see the top of this file): whether the park is the festival now. */
export function festivalOpen(state: Pick<GameState, 'chapter' | 'clock'>): boolean {
  const n = state.chapter.n;
  if (n < FESTIVAL.chapter) return false;
  const saturday = isSaturday(state.clock.lastLocalDate);
  if (n === FESTIVAL.chapter) return saturday || state.clock.dayIndex > state.chapter.began.dayIndex;
  return saturday;
}

/**
 * Whether a state change brought the festival back (Chapter 8 and Free Walk: a new day that is a Saturday). The app says so in a toast, since
 * nothing else tells the player why the park turned to dusk (review of wave C2). Chapter 7's own festival needs no notice: its beats announce it.
 */
export const festivalReturned = (before: Pick<GameState, 'chapter' | 'clock'>, after: Pick<GameState, 'chapter' | 'clock'>): boolean =>
  after.chapter.n > FESTIVAL.chapter && festivalOpen(after) && !festivalOpen(before);

/**
 * Who stands at the festival: Hanako (the stage), then every friend at `FESTIVAL.guestHearts` or more, most hearts first (pack order on a tie).
 * `hearts` is the app's hearts selector per friend id (hearts are derived from AP in @lw/game). Kenji is at his stall whatever his hearts.
 */
export function festivalGuests(pack: Pick<GamePack, 'friends'>, hearts: (friendId: string) => number): string[] {
  const order = pack.friends.map((f) => f.id);
  const guests = order.filter((id) => id !== 'hanako' && hearts(id) >= FESTIVAL.guestHearts).sort((a, b) => hearts(b) - hearts(a) || order.indexOf(a) - order.indexOf(b));
  return ['hanako', ...guests];
}

// ---------------------------------------------------------------------------------------------------------------
// The speech (matsuri_speech): the five lines and their rehearsal
// ---------------------------------------------------------------------------------------------------------------

export type SpeechSlot = 'name' | 'country' | 'hobby' | 'town' | 'thanks';

/** The five lines of the target speech (§7.2), in order; `{x}` is the player's fact. */
export const SPEECH_LINES: Array<{ slot: SpeechSlot; line: Line }> = [
  { slot: 'name', line: { ja: 'はじめまして|。|{x}|です|。', en: "Nice to meet you. I'm {x}.", ar: 'تشرفنا. أنا {x}.' } },
  { slot: 'country', line: { ja: '{x}|から|来ました|。', en: 'I came from {x}.', ar: 'جئت من {x}.' } },
  { slot: 'hobby', line: { ja: '{x}|が|好き|です|。', en: 'I like {x}.', ar: 'أحب {x}.' } },
  { slot: 'town', line: { ja: '桜町|は|とても|いい|町|です|。', en: 'Sakura-chō is a very nice town.', ar: 'ساكورا-تشو مدينة جميلة جدًا.' } },
  { slot: 'thanks', line: { ja: 'ありがとうございました|。', en: 'Thank you very much.', ar: 'شكرًا جزيلًا.' } },
];

/** An example when the save does not know the fact yet (the rehearsal marks it `example: true`, so the learner says their own). */
const EXAMPLE: Record<'country' | 'hobby', Record<L1, { ja: string; en: string; ar: string }>> = {
  country: { en: { ja: 'アメリカ', en: 'the United States', ar: 'الولايات المتحدة' }, ar: { ja: 'エジプト', en: 'Egypt', ar: 'مصر' } },
  hobby: { en: { ja: '音楽', en: 'music', ar: 'الموسيقى' }, ar: { ja: '音楽', en: 'music', ar: 'الموسيقى' } },
};

/**
 * The Prepare screen's five-line rehearsal for the capstone: the speech with the player's facts filled in (the name of Chapter 1 or the profile,
 * the country and hobby Mio remembers from the park). A fact the save does not know is an example, marked `example: true`; with no name at all the
 * first line is 「はじめまして。」 alone.
 */
export function speechRehearsal(pack: Parameters<typeof letterFacts>[0], state: GameState, l1: L1, profileName = ''): Array<{ slot: SpeechSlot; line: Line; example: boolean }> {
  const facts = letterFacts(pack, state, profileName);
  return SPEECH_LINES.map(({ slot, line }) => {
    if (slot === 'name') {
      if (!facts.name.known) return { slot, line: { ja: 'はじめまして|。', en: 'Nice to meet you.', ar: 'تشرفنا.' }, example: false };
      return { slot, line: fillX(line, facts.name), example: false };
    }
    if (slot === 'country' || slot === 'hobby') {
      const f = facts[slot];
      return f.known ? { slot, line: fillX(line, f), example: false } : { slot, line: fillX(line, EXAMPLE[slot][l1]), example: true };
    }
    return { slot, line: { ...line }, example: false };
  });
}

/** The whole speech as one text (the debrief, the Letter's festival memory): the five rehearsal lines joined. */
export const speechText = (lines: Array<{ line: Line }>): string => lines.map((l) => l.line.ja.replace(/\|/g, '')).join('');

const fillX = (line: Line, f: { ja: string; en: string; ar: string }): Line => ({ ja: line.ja.replaceAll('{x}', f.ja), en: line.en.replaceAll('{x}', f.en), ar: line.ar.replaceAll('{x}', f.ar) });
