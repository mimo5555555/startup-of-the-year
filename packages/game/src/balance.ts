// The single home of every tuning constant (docs/GAME_DESIGN.md §4.7). Formulas live in the owner modules and read
// only from here; a pack scales yen amounts with `EconomyDef.incomeScale` (§14.6), so nothing here is hard-coded
// into a formula. Re-baselining a number is a deliberate edit to this file plus the CI windows of §4.6.
//
// Units: the keys below are in REFERENCE yen and are read through `scaleAmount(x, pack.economy, pack.currency)` (1B) wherever they
// become a payout, a price or a cap: base, indepBonusPer, stars, firstPhrase.pay/cap, echo.pay/cap, softCap, icTopups,
// icRefundFee, workHoursChipMin, points.dailyCap, haggle.max, friendPerkDailyMax, catchUp.max, goals.each/all/streakPer/streakMax,
// ap.giftTiers[].lt, shift.trial. Fractions, counts, days and multipliers are never scaled. startCash, walletCap, refWage and icCap are the JP values
// that `tokyo/game/economy.ts` copies into `EconomyDef`; the pack's `EconomyDef` is authoritative and formulas read it, not these.
// Pack data (item prices, wages, fares, chapter rewards) is already in the pack's units and is not scaled.

type DeepReadonly<T> = T extends readonly (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

function deepFreeze<T extends object>(o: T): DeepReadonly<T> {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v as object);
  return Object.freeze(o) as DeepReadonly<T>;
}

export const BALANCE = deepFreeze({
  // --- §3.2 turn classification: credit per learner turn ---------------------------------------------------------
  credit: { I: 1, thinI: 0.6, S: 0.35, T: 0.25 },
  /** a turn copies a shown string when copyScore >= this */
  copyScore: 0.8,
  /** class I needs >= this many content tokens, or `thinIdeal` similarity to the intent's ideal line, else it is "thin" (0.6) */
  thinTokens: 2,
  thinIdeal: 0.5,
  /** a substantive turn has >= this many non-grammar tokens or completed a goal step */
  substantiveTokens: 2,
  /** an NPC line only enters the shown set when it has >= this many content tokens */
  shownNpcTokens: 4,
  /** consecutive unmatched turns that end a conversation gently (no payout, no penalty) */
  unmatchedEnd: 6,
  /** a vocabulary card counts as a known (recalled) line at FSRS state Review and stability >= this */
  knownStability: 3,

  // --- §3.3 conversation pay (payout.settleLoop) ---------------------------------------------------------------
  /** F(r) = floor + span * r^2 */
  indep: { floor: 0.25, span: 0.75 },
  base: { A1: 1500, A2: 2200, B1: 3000 },
  indepBonusPer: 30,
  distinctMax: 8,
  /** index = min(paid completions of THIS scenario today, 3) */
  dayFactor: [1, 0.35, 0.1, 0],
  prepF: 1.1,
  realF: 1.25,
  /** clean = max(floor, 1 - fb * min(fallbacks, fbMax) - hint * min(hintUses, hintMax)) */
  clean: { fb: 0.08, hint: 0.04, floor: 0.6, fbMax: 5, hintMax: 5 },
  /** goalFactor with some but not all goal steps done = partial * done / total */
  goalPartial: 0.5,
  /** pay is rounded to this many yen */
  payRound: 5,
  /** Real mode (chips hidden) is offered from this chapter on (D22: after Chapter 1) */
  realFromChapter: 2,

  // --- §3.4 stars (best-of per scenario, never decrease) --------------------------------------------------------
  /** one-time yen per star, paid once ever */
  stars: { 1: 200, 2: 400, 3: 600 },
  starRule: { r2: 0.6, r3: 0.8, accuracy: 80, maxHints: 0 },

  // --- §3.3 one-time mastery pools and the soft cap --------------------------------------------------------------
  firstPhrase: { pay: 20, cap: 120 },
  /** echo: hidden-line recall of an assisted line; `similarity` is the pass mark (0.50 for beginners, §11.3) */
  echo: { pay: 20, perConv: 2, cap: 100, similarity: 0.6, similarityBeginner: 0.5 },
  /** language yen today beyond softCap pays x softCapFactor (loop + stars + first-phrase + echo + shifts) */
  softCap: 14000,
  softCapFactor: 0.25,

  // --- §4.1 wallet, IC card, points, ledger --------------------------------------------------------------------
  startCash: 3000,
  walletCap: 9999999,
  /** IC balance cap: `early` until chapter `lateFrom` is current, `late` after */
  icCap: { early: 3000, late: 20000, lateFrom: 5 },
  icRefundFee: 220,
  icTopups: [1000, 2000, 3000, 5000],
  /** reference wage the whole catalog is priced against (price / refWage = the "work-hours chip") */
  refWage: 1150,
  /** show the work-hours chip for prices over this */
  workHoursChipMin: 2000,
  points: { rate: 0.01, dailyCap: 300 },
  ledger: { entries: 200, seen: 300 },

  // --- §4.4 spending rules ----------------------------------------------------------------------------------------
  maxQty: 3,
  /** haggle takes min(pct of body price, max) off for an independent polite request; `assisted` of that when assisted */
  haggle: { pct: 0.06, max: 8880, assisted: 0.4, attemptsPerItemPerDay: 1 },
  /** routine discounts (friend shop perks + haggle) total at most this share of the body price */
  routineDiscountMax: 0.08,
  /** friend shop perks give at most this many yen per day in total */
  friendPerkDailyMax: 300,

  // --- §4.5 catch-up stipend (Chapter 4 only) ---------------------------------------------------------------------
  catchUp: { afterActiveDays: 7, max: 12000 },

  // --- §7.4 daily goals ---------------------------------------------------------------------------------------------
  /** `convFrac`: the share of a conversation's goal steps that counts it as finished (g_conv2, g_place) */
  goals: { each: 100, all: 150, streakPer: 15, streakMax: 150, streakDaysMax: 10, windowDays: 2, perDay: 3, swapsPerDay: 1, convFrac: 0.5 },
  /** deterministic priority overrides when generating a day's trio */
  goalPriority: { reviewDue: 10, shiftIdleDays: 4, friendIdleDays: 3, convRecentDays: 3, convRecentMax: 1 },

  // --- §8.3 hearts and affinity points (AP) ------------------------------------------------------------------------
  ap: {
    /** hearts = number of thresholds <= ap (0-5) */
    thresholds: [30, 80, 150, 240, 350],
    met: 20,
    /** a counted talk: base if >= stepFrac of the steps are done + round(shareMax * share) + callbacks (each, <= callbackMax), cap per talk */
    talk: { base: 5, stepFrac: 0.6, shareMax: 4, callbackEach: 3, callbackMax: 6, cap: 15, perDay: 1 },
    hangout: { good: 25, low: 10, shareMin: 0.5, minHeart: 3, everyDays: 3 },
    chat: { ap: 4, dailyCap: 8, minSubstantive: 2, minHeart: 2, unreadMax: 3, missAp: 6, missDays: 5, threadsPerDay: 1 },
    event: 10,
    /** every source together, per friend per day */
    dailyCap: 60,
    /** a remembered-fact quiz answered correctly */
    quiz: 3,
    /** gifts (§8.5): AP = min(tierAP(price) * taste, giftCap(heart)); tier = first row with price < lt, else `giftTierTop` */
    giftTiers: [
      { lt: 500, ap: 6 },
      { lt: 1500, ap: 10 },
      { lt: 3000, ap: 15 },
    ],
    giftTierTop: 20,
    giftTaste: { loved: 2, liked: 1.5, neutral: 1, disliked: 0 },
    /** the cap is giftCapFrac of the AP still needed for the next heart, at most giftCapMax */
    giftCapFrac: 0.4,
    giftCapMax: 30,
    /** x for a bare or assisted hand-over */
    giftBare: 0.5,
    /** x on a day with no talk with that friend */
    giftNoTalk: 0.5,
    /** x when the same item went to the same friend within `days` */
    giftRepeat: { days: 7, mult: 0.25 },
    giftsPerDay: 1,
  },

  // --- §9 jobs and shifts (§4.6 D41: shifts are 6-11% of income) ---------------------------------------------------
  shift: {
    /** paid hours per shift (a short "helping out" shift, not a real hour) */
    hours: 0.75,
    rankMult: [1, 1.08, 1.16, 1.24, 1.32],
    /** good shifts needed to reach rank 1..4 */
    promoteAt: [3, 6, 10, 15],
    /** accuracy (ticks) needed for a shift to count and for a "good" shift */
    accuracy: 0.6,
    /** trial wage when ticks < accuracy and >= trialMinServed customers were served (never counts) */
    trial: 100,
    trialMinServed: 2,
    /** production credit by input: typed or spoken = credit.I; tiles; picked chip */
    tile: 0.5,
    chip: 0.35,
    customers: 5,
    tasksPerCustomer: 3,
    /** scored units per shift = customers * tasksPerCustomer */
    units: 15,
    /** order-task credit when the Japanese text / the translation was shown */
    assistText: 0.7,
    assistTranslation: 0.5,
    /** the first N shifts at each job waive the assist factors */
    assistWaivedShifts: 2,
    greetBonus: 0.1,
    /** quitting mid-shift pays only if >= quitMinServed customers were served, then x quitMult */
    quitMinServed: 2,
    quitMult: 0.6,
    /** index = shifts already paid today (0 = none, shift 3 is unavailable) */
    repeat: [1, 0.6, 0],
    sameJobRepeat: [1, 0.5, 0],
    dailyMax: 2,
    payRound: 10,
    /** variety: archetypes drawn without replacement with tier <= rank + tierAboveRank; an order never repeats within noRepeatShifts */
    variety: { archetypesMin: 4, tierAboveRank: 1, noRepeatShifts: 3 },
    /** feedback bands on accuracy */
    bands: { perfect: 0.9, nice: 0.7, almost: 0.6 },
  },

  // --- §11.1 Prepare (the Phrase Pocket) ---------------------------------------------------------------------------
  /** a recall `ready` stamp expires after this many days (a known FSRS card never expires) */
  readyDays: 7,
  /** recall pass mark on speechSimilarity; the age profile's echoThreshold overrides for kids/seniors */
  recallPass: { default: 0.7, beginner: 0.6, kids: 0.55 },
  /** a pocket is ready when all key lines are ready and >= restFrac of the rest */
  pocketReadyRest: 0.6,

  // --- §11.5 SRS hooks ------------------------------------------------------------------------------------------------
  srs: { goalDueMin: 1440, signDueMin: 1440, echoDueMin: 10, parkReleaseBelowDue: 15, amnestyDue: 40, sprint: 12 },

  // --- §11.7-§11.8 next best goal, adaptive support ------------------------------------------------------------------
  nextGoal: { reviewDue: 10, stuckConvs: 3, stuckFallbacks: 3, awayDays: 4 },
  adaptive: { realOfferConvs: 3, realOfferR: 0.75, helpOfferR: 0.35, helpOfferFallbacks: 2, helpTtsRate: 0.85, everyConvs: 3 },

  // --- §7.3 dreams (tracker pace estimate) ----------------------------------------------------------------------------
  /** pace = mean `state.income[].net` over the last `etaWindowDays` days; the estimate shows from `etaMinDays` days of data */
  dream: { etaMinDays: 3, etaMaxDays: 60, etaWindowDays: 7, milestoneStep: 2 },
  /** conversations kept in `state.coach.recent` (the coach cards need 3, the stuck rule 3) */
  coach: { recent: 5 },

  // --- §10 culture ------------------------------------------------------------------------------------------------------
  cultureXp: 5,
  /** first use of each vending drink (§6.5) */
  vendingXp: 2,

  // --- §5.4 fares, §8.8 home comfort ----------------------------------------------------------------------------------
  /** a paper ticket costs `paperExtra` more than the IC fare; a friend fare perk never takes a fare below `perkFloor`; a trip charges `tripLegs` fares up front */
  fares: { paperExtra: 10, perkFloor: 10, tripLegs: 2 },
  /** comfort = base[tier] + furniture comfort, at most `max`; a friend can visit from `visitMin` */
  comfort: { base: { dorm: 1, ono: 3 }, max: 16, visitMin: 4 },

  // --- §12.4 speech recognition policy (engine/speechScore.ts, feedback.ts) ---------------------------------------------
  /** `maxAlternatives` asked of the recogniser; `directConfidence` and up submits at once, `confirmConfidence` up to it asks "I heard ...?", below that is
   *  unmatched without a fallback; speech under `correctionConfidence` earns no corrections (a "maybe" note); `great` is a "great" similarity */
  speech: { maxAlternatives: 3, directConfidence: 0.75, confirmConfidence: 0.45, correctionConfidence: 0.8, great: 0.85 },

  // --- §4.5 Free Walk is chapter.n = 9 (D36) ------------------------------------------------------------------------------
  freeWalkChapter: 9,
  chapters: 8,
});

export type Balance = typeof BALANCE;
