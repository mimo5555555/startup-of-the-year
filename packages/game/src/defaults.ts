// Empty slices of GameState, implemented by the contract so that every owner (and the lazy `state.friends[id] ?? emptyFriend(...)`
// pattern) builds the same shape. `createGameState`, `migrate`, `observeClock`, `applyTalk` and `applyShift` all use these.
import type { FriendState, JobState, PayState, RunRecord } from './types';

export const emptyFriend = (dayIndex: number): FriendState => ({
  ap: 0,
  met: false,
  apDay: dayIndex,
  apToday: 0,
  chatApToday: 0,
  unread: 0,
  threads: [],
  chatRecent: [],
  facts: {},
  learned: [],
  gold: [],
  callbacks: {},
  topicDay: {},
  events: [],
  flags: [],
  giftHistory: [],
  gifts: 0,
  giftsLiked: 0,
  giftsLoved: 0,
});

export const emptyRun = (): RunRecord => ({ count: 0, complete: false, stars: 0, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [] });

export const emptyJob = (): JobState => ({ shifts: 0, good: 0, perfect: 0, rank: 0, recent: [] });

/** `day` is the dayKey the counters belong to. */
export const emptyPay = (day: string): PayState => ({
  day,
  langToday: 0,
  firstPhraseToday: 0,
  echoToday: 0,
  echoSession: null,
  scenarioToday: {},
  lastPaid: {},
  shiftsToday: {},
  seenIntents: [],
  pointsToday: 0,
  perkToday: 0,
  haggleToday: [],
  perkFreeToday: [],
});
