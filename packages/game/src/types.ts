// The @lw/game contract (docs/GAME_DESIGN.md §14.2, §14.5 and the §7-§11 tables they project).
// Pure data: everything persisted is JSON-safe (no Set/Map/Date/undefined-as-value/functions); only `GameView`,
// `ContentIndex` and `ReduceCtx` carry non-JSON values, and those are never stored.
// @lw/game never imports @lw/content: Gloss/Line/Cefr below are structurally compatible with content's.
//
// Conventions every owner follows (so two agents never implement a field two ways):
// - Money is an integer in the pack's MINOR units (JP: yen; a 100-minor pack stores cents). Pack data (prices, wages, fares,
//   chapter rewards) is authored in those units and is never scaled; only BALANCE amounts pass through `scaleAmount`.
// - An `itemId` anywhere in state or events (purchase, gift_given, owned, giftInfo, reactionFor) is the UNIQUE id: `ItemDef.id`
//   or `MenuItem.id` ('<shopId>:<option>'). Gift tastes (`FriendDef.loves` / `dislikes`) may also name a bare `MenuItem.option`
//   ('coffee') so one entry covers every shop; `likes` are item tags.
// - Days are `dayIndex` integers (D3); a `DayKey` ('d<dayIndex>') is only used where a string key is needed.
// - Hearts are derived, never stored: `heartsForAp(ap)` (friends.ts) is the one implementation; everyone else calls it
//   (or the `hearts` selector, which delegates) and nobody reads BALANCE.ap.thresholds directly.

// ---------------------------------------------------------------------------------------------------------------
// Structural text types (compatible by structure with @lw/content's Gloss / Line / Cefr)
// ---------------------------------------------------------------------------------------------------------------

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
/** The bands a scenario or a pay table can have. */
export type Band = 'A1' | 'A2' | 'B1';

export interface Gloss {
  en: string;
  ar: string;
  /** optional feminine Arabic variant for female speakers (§8.5); falls back to `ar` */
  arF?: string;
}

/** Target-language text plus glosses: `ja` is markup (tokens separated by `|`), resolved by content against its lexicon. */
export interface Line {
  ja: string;
  en: string;
  ar: string;
  /** spoken form when it differs from the written text */
  tts?: string;
}

/** A name shown in the target language with its reading. */
export type NameGloss = Gloss & { ja: string; reading?: string };

export type AgeGroup = 'kids' | 'teens' | 'adults' | 'seniors';
export type Register = 'casual' | 'polite' | 'keigo';
export type Pocket = 'cash' | 'ic' | 'points';
export type PayMethod = 'cash' | 'ic' | 'card';

// ---------------------------------------------------------------------------------------------------------------
// §7.1 objectives
// ---------------------------------------------------------------------------------------------------------------

export type Pred =
  | { k: 'lesson'; id: string }
  /** best run so far; `complete` = ALL goal steps done incl. `pay` (§6.2); `steps` = these goal steps done in some run */
  | { k: 'scenario'; id: string; complete?: boolean; steps?: string[]; minIndependent?: number; minShare?: number; minStars?: 1 | 2 | 3 }
  /** n distinct scenarios at >= atLeast stars */
  | { k: 'stars'; atLeast: 1 | 2 | 3; n: number }
  /** categories: phone, bicycle, car, flat, yukata (derived from ItemDef.tags) */
  | { k: 'own'; item?: string; category?: string }
  /** purchases made in conversations (`stats.purchases`) */
  | { k: 'purchases'; n: number }
  | { k: 'hearts'; friend: string; atLeast: number }
  /** n friends at >= atLeast hearts */
  | { k: 'hearts_count'; atLeast: number; n: number }
  /** `liked` counts liked-or-loved gifts, `loved` only loved ones */
  | { k: 'gift'; n: number; friend?: string; reaction?: 'liked' | 'loved' }
  /** `stats.chats.n >= n` and, when `friends` is set, at least that many distinct friends with a chat (`stats.chats.friends`) */
  | { k: 'phone_chat'; n: number; friends?: number }
  | { k: 'hangout'; friend?: string; n?: number }
  /** 'home:mio', 'home:*', 'spot:pond', 'trip:hikarigaoka': `home:` / `trip:` entries read `stats.visits`, `spot:` reads `stats.spots`, a bare place id reads `stats.visits` */
  | { k: 'visit'; place: string }
  /** counts only shifts with all 5 customers served and ticks >= minAcc (default 0.6; only the default is stored per job); a trial-wage shift never counts */
  | { k: 'shift'; job?: string; n: number; minAcc?: number }
  | { k: 'earn_total'; yen: number }
  | { k: 'wallet'; atLeast: number }
  /** vocabulary items with source !== 'starter' */
  | { k: 'words_saved'; n: number }
  /** vocabulary items reviewed >= 1 time; `tag` from the pack's wordTags */
  | { k: 'words_known'; n: number; tag?: string }
  /** distinct new words said (substantive, independent) */
  | { k: 'say_new'; n: number }
  | { k: 'discover'; n: number }
  /** a collection count; never a chapter gate */
  | { k: 'culture'; n: number; id?: string }
  /** n distinct culture cards with say:true whose key phrase the learner said in a class-I turn or a hidden-line Say-it */
  | { k: 'culture_said'; n: number }
  /** an independent (class-I) substantive turn matched this intent at least once (`pay.seenIntents` key `scenarioId:intentId`) */
  | { k: 'said'; scenario: string; intent: string }
  | { k: 'srs_reviews'; n: number }
  | { k: 'item_placed'; n: number }
  /** set by scripted beats / scenarios (`chapter.flags`) */
  | { k: 'flag'; id: string }
  | { k: 'all'; of: Pred[] }
  | { k: 'any'; of: Pred[] };

export interface Objective {
  id: string;
  pred: Pred;
  text: Gloss;
  hint?: Gloss;
  pin?: { place?: string; friend?: string };
  /** the optional dream slot; never blocks a chapter */
  dream?: true;
  /** offered after `afterTries` attempts; accepting is free and permanent (D40) */
  easier?: { pred: Pred; afterTries: number };
}

/** What a predicate needs to be satisfiable (derived by `requires`, checked by validatePack level 4). */
export interface Requirement {
  kind: 'place' | 'job' | 'item' | 'feature' | 'scenario' | 'interaction' | 'friend' | 'shop';
  id: string;
  /** chapter at which it opens (chapter.n >= ch; 9 = Free Walk) */
  ch: number;
}

export interface PredProgress {
  done: number;
  total: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Pack data (§14.2)
// ---------------------------------------------------------------------------------------------------------------

export interface CurrencyDef {
  code: string;
  symbol: string;
  minorPerMajor: 1 | 100;
  symbolPlacement: 'prefix' | 'suffix';
  groupSep: string;
  decimalSep: string;
  roundTo: number;
  /** spoken unit, e.g. 円 */
  spoken?: string;
}

export interface EconomyDef {
  /** reference hourly wage in minor units (JP 1150); BALANCE.refWage is the JP reference it was priced against */
  refWage: number;
  /** refWage / 1150: multiplies every BALANCE yen amount */
  incomeScale: number;
  /** authoritative for the pack (BALANCE.startCash / walletCap / refWage are only the JP reference values that economy.ts copies) */
  startCash: number;
  /** IC card caps; `early` applies until chapter BALANCE.icCap.lateFrom is current, `late` after; absent = the pack has no IC card */
  icCap?: { early: number; late: number };
  walletCap: number;
  /** totals at or above this ask for a confirm node and are "big ticket" */
  bigTicket: number;
}

export interface TaxRegime {
  inclusive: boolean;
  /** class -> rate, e.g. { standard: 0.10, food: 0.08 } */
  rates: Record<string, number>;
  eatInRate?: number;
  takeOutRate?: number;
  touristRefund?: { min: number; needsPassport: boolean };
}

export interface PackRules {
  /** shopId -> negotiation limits (haggling only where listed); `items` narrows it to those item ids (absent = any item of the shop, §4.4 rule 3: only the cars at Motors) */
  negotiation: Record<string, { maxPct: number; maxAmount: number; assistedShare: number; items?: string[] }>;
  haggling: boolean;
  shoesOff: boolean;
  tipping: 'none' | 'small' | 'expected';
  pointsCard?: boolean;
  deliveryFee: number;
  registrationFee?: number;
}

export interface LanguagePlugin {
  /** ja: 2980 -> 'にせんきゅうひゃくはちじゅう' */
  readNumber(n: number): string;
  /** ja: yenToJa */
  priceMarkup(n: number, cur: CurrencyDef): { markup: string; reading: string; gloss: Gloss };
  /** digits | kanji | kana -> integers */
  parseNumbers(text: string): { text: string; numbers: number[] };
  /** kana folding etc. */
  speechNormalize(text: string): string;
  registerMarkers: Record<Register, { good: string[]; bad: string[] }>;
}

/** Shop ids of the JP pack (§15.2): konbini, cafe, ramen, station, vending, denki, fukufuku, aiko, motors. `PackRules.negotiation` and `MenuItem.shop` key on them; validatePack checks ids against pack data. */
export interface ShopDef {
  id: string;
  placeId: string;
  name: Gloss;
  openChapter: number;
  surface: 'world' | 'panel';
  register: Register;
  /** pockets the shop takes (Hikari Denki: cash and card, no IC) */
  pay: PayMethod[];
  /** the shop issues and redeems Sakura Points (konbini, Hikari Denki, Fuku-Fuku; §4.1) */
  points?: true;
  /** item and menu ids sold here */
  sells: string[];
}

/** A consumable keyed by shop and slot option id (§5.1). */
export interface MenuItem {
  /** unique: '<shopId>:<option>' */
  id: string;
  shop: string;
  /** the existing conversation slot and option id that selects it */
  slot: string;
  /** slot option id; gift tastes and `loves` lists refer to this (e.g. 'coffee', 'cake') */
  option: string;
  name: NameGloss;
  price: number;
  /** key into TaxRegime.rates; take-out food and groceries use the reduced class */
  taxClass: string;
  /** the eat-in surcharge applies (konbini eat-in corner, café) */
  eatInCapable?: boolean;
  /** gift tags (§8.5). A giftable consumable bought in a conversation goes into `owned` as gift stock. */
  tags: string[];
  giftable?: boolean;
}

/** Named perks an owned item switches on; owner modules read them by trait id (never by item id) so a pack can re-skin them. */
export type ItemTrait =
  /** value = Sakura Points earn rate replacing BALANCE.points.rate (flagship phone 0.02) */
  | 'points_rate'
  /** value = AP multiplier on a friend-visit hang-out (kotatsu 1.5) */
  | 'hangout_mult'
  /** the formal-register line at Motors (suit) */
  | 'formal_register'
  /** the "cook together" line at Kenji / Aiko (rice cooker) */
  | 'cook_together'
  /** the konbini asks "bag?" less (backpack) */
  | 'fewer_bags'
  /** the "watch Japanese TV" listening snippet (tv) */
  | 'tv_snippet'
  /** Tanaka / Aoi boast hooks (flagship phone) */
  | 'boast';

export type ItemEffect =
  | { t: 'feature'; id: 'phone' | 'ic' }
  | { t: 'ride'; mul: number; mesh: 'bike' | 'ebike' | 'car' }
  | {
      t: 'avatar';
      patch: {
        top?: string;
        bottom?: string;
        shoes?: string;
        accent?: string;
        /** one accessory (the simple case); `accessories` adds several (winter jacket: scarf, suit: tie) */
        accessory?: string;
        accessories?: string[];
        /** palette of the free colour pick (§5.5) */
        colours?: string[];
        /** which of top / bottom / shoes the picked colour replaces */
        pick?: 'top' | 'bottom' | 'shoes';
        /** the accent is the picked colour, lightened (hoodie) */
        lightenAccent?: true;
      };
    }
  | { t: 'home'; slot: string; comfort: number }
  | { t: 'homeTier'; tier: 'ono' }
  | { t: 'gift'; tags: string[] }
  | { t: 'card'; id: string }
  /** a cosmetic with a colour pick or a frame (phone case, flagship gold frame, car colour); no mechanical effect */
  | { t: 'cosmetic'; id: string }
  | { t: 'trait'; id: ItemTrait; value?: number };

export interface ItemDef {
  id: string;
  name: NameGloss;
  price: number;
  cat: 'transport' | 'electronics' | 'clothing' | 'home' | 'gift' | 'service';
  shop: string;
  gate: {
    /** chapter.n >= ch; 9 = Free Walk (D36) */
    ch: number;
    ageMin?: number;
    /** n distinct scenarios at >= atLeast stars */
    stars?: { n: number; atLeast: 1 | 2 | 3 };
    /** item ids that must be owned first (the e-bike needs the helmet) */
    needs?: string[];
  };
  fx: ItemEffect[];
  tags: string[];
  bulky?: boolean;
  /** the price without fees where it differs: the haggle and the 8% routine-discount cap use it (cars: body 148,000 of 198,000); absent = `price` */
  body?: number;
  /** Beat id played after buying it (the phone: `b_phone_bought`) */
  beat?: string;
  /** single ownership; absent for repeatables such as the lantern fund */
  once?: true;
}

export interface PerkDef {
  id: string;
  /** hearts needed */
  heart: number;
  text: Gloss;
  fx:
    /** routine % off at a shop (counts against the 8% rule and the yen/day cap) */
    | { t: 'shop_pct'; shopId: string; pct: number }
    /** one-time yen off one of `itemIds` (exempt from the 8% rule); `elseItem` is granted free when none applies */
    | { t: 'once_discount'; itemIds: string[]; amount: number; elseItem?: string }
    /** one-time cash (ledger kind 'perk') */
    | { t: 'once_cash'; amount: number }
    /** one-time free item (a ♥3 gift from the friend, a hang-out reward) */
    | { t: 'once_item'; itemId: string; qty?: number }
    /** a free item once per day, or every `every`th purchase of it */
    | { t: 'daily_free'; shopId: string; itemId: string; every?: number }
    /** festival partner and other cosmetic perks */
    | { t: 'cosmetic'; id: string };
}

export interface FriendDef {
  /** = Character.id */
  id: string;
  tier: 'A' | 'B';
  register: 'casual' | 'polite' | 'keigo';
  /** hearts at which the friend switches to plain speech; 99 = never */
  casualAt: 0 | 1 | 2 | 3 | 99;
  unlockChapter: number;
  home?: { stage: string; door: string };
  /** ItemDef ids, MenuItem ids or bare MenuItem options (see the conventions at the top) */
  loves: string[];
  /** item tags */
  likes: string[];
  /** same forms as `loves` */
  dislikes: string[];
  /** the three profile fact ids revealed at hearts 1/2/3 (§8.4) */
  facts: [string, string, string];
  /** the fact lines (JA / EN / AR), keyed by fact id */
  factLines?: Record<string, Line>;
  perks: PerkDef[];
  /** heart events: the beat and / or scenario that plays once when `heart` is reached (♥2 note, ♥4 beat or home visit, ♥5 scene); drives `heart_event_ready` */
  events?: Array<{ heart: number; beat?: string; scenario?: string }>;
}

export type ScenarioKind = 'talk' | 'shop' | 'friend' | 'chat' | 'home' | 'hangout' | 'heart' | 'trip' | 'story' | 'jobintro';

export interface ScenarioMeta {
  id: string;
  kind: ScenarioKind;
  band: Band;
  register: Register;
  /** 'none' scenarios pay hearts, not yen */
  pay: 'full' | 'none';
  /** can be played in Real mode */
  real?: boolean;
  /** pocket line ids (PocketLine.id) */
  pocket?: string[];
  gate?: Pred;
  culture?: string[];
  /** place id of the conversation (feeds `g_place` and the opening chapter of a scenario that has no shop) */
  place?: string;
  shop?: {
    shopId: string;
    /** the main item slot; absent for a flow with no slot (aiko_contract sells `fixedItem`) */
    itemSlot?: string;
    /** the single item a slot-less flow sells */
    fixedItem?: string;
    /** other slots whose options sell something (the shared `giftItem` goods node, `ramenExtra`) */
    extraSlots?: string[];
    qtySlot?: string;
    payStep: string;
    /** slot option id -> menu / catalog item id (for every slot named above) */
    itemMap: Record<string, string>;
    fees?: Array<{ id: string; amount: number; when?: string }>;
  };
  friendId?: string;
  /** the heart level a hang-out (3), home visit or heart scene (4, 5) belongs to */
  heart?: number;
  /** applied once, on the first completion: flags (`genkan_ok`, `heart5_seen`), keepsakes, items, culture, titles */
  effects?: BeatEffect[];
  capstone?: boolean;
  /** intent ids objectives need, e.g. 'ramen:itadakimasu' */
  requiredIntents?: string[];
  twist?: boolean;
  /** an entry node other than the scenario start (e.g. ramen 'start_ticket') */
  startNode?: string;
  /** the scenario is hidden below this age */
  ageMin?: number;
}

export interface Interaction {
  id: string;
  label: Gloss;
  kind: 'scenario' | 'shift' | 'gift' | 'lesson' | 'trip' | 'visit' | 'window';
  scenarioId?: string;
  jobId?: string;
  /** 'lesson': the Lesson id Hanako teaches */
  lessonId?: string;
  /** 'window': the read-only goods sheet of a shop that is not open yet */
  shopId?: string;
  /** chapter.n >= ch lists the option (D36; default 1). The tables of §6.1 name chapters (Shift C2, Gift C3, Train C5) and `Pred` has no chapter test. */
  ch?: number;
  gate?: Pred;
}

export interface ChapterOpen {
  kind: 'place' | 'job' | 'feature' | 'shop' | 'interaction';
  id: string;
}

export interface ChapterDef {
  /** 1-8 */
  n: number;
  title: NameGloss;
  minDays: number;
  reward: number;
  rewardTitle?: string;
  rewardCulture?: string[];
  /** take effect when the chapter BECOMES CURRENT (D36) */
  opens: ChapterOpen[];
  startGate?: Pred;
  objectives: Objective[];
  /** BeatDef ids */
  beats: { open: string; close: string };
  catchUp?: { afterActiveDays: number; item: string; maxYen: number };
}

export interface DreamStep {
  id: string;
  /** chapter in which the step becomes visible */
  gate: number;
  pred: Pred;
  text: Gloss;
}

export interface DreamDef {
  id: string;
  name: NameGloss;
  horizon: 'short' | 'medium' | 'long' | 'epilogue';
  /** hidden below this age (D28) */
  ageMin?: number;
  /** chapter.n needed before the dream is offered (the car dream: 9) */
  openChapter?: number;
  steps: DreamStep[];
  /** ItemDef ids that count toward the remaining cost */
  items: string[];
  /** cheapest small goods to count for an `item_placed` step */
  furnish?: number;
  /** TitleDef id awarded on the finale */
  title: string;
  /** Beat id played on the finale */
  beat: string;
  /** cosmetic dream sticker granted at step 2, e.g. 'st_phone_pal' */
  sticker: string;
  keepsake?: string;
  /** onboarding goals that default to this dream */
  defaultFor?: string[];
}

export type DailySlot = 'speak' | 'do' | 'review';

/**
 * The closed set of per-day counters (the reducer's `updateDaily` bumps them, the templates read them), one per §7.4 template:
 * conv_distinct (g_conv2) distinct scenarios finished at >= 50% of the steps; indep_lines (g_indep6) class-I substantive turns;
 * new_intents (g_newphrase2) first independent uses of an intent; purchase (g_buy) completed purchases; shift_good (g_shift)
 * good shifts; friend_contact (g_friend) talks, chats and gifts with a friend; places_distinct (g_place) distinct places with a
 * finished conversation; review_checked (g_review8) due cards answered through a check; lesson (g_lesson) lessons finished;
 * culture_new (g_culture) new culture cards read.
 */
export type DailyCounter =
  | 'conv_distinct'
  | 'indep_lines'
  | 'new_intents'
  | 'purchase'
  | 'shift_good'
  | 'friend_contact'
  | 'places_distinct'
  | 'review_checked'
  | 'lesson'
  | 'culture_new';

export interface DailyTemplate {
  id: string;
  slot: DailySlot;
  text: Gloss;
  /** which per-day counter the goal reads (DailyState.counters) */
  counter: DailyCounter;
  target: number;
  requires?: { chapter?: number; job?: boolean; friends?: boolean; vocabCards?: boolean; unseenCulture?: boolean };
  /** kids' 2-goal day may use it (default true) */
  kids?: boolean;
}

export interface BeatLine {
  /** Character.id */
  who: string;
  line: Line;
}

export type BeatEffect =
  /** a story flag (`chapter.flags`) */
  | { t: 'flag'; id: string }
  /** a flag of one friend (`friends[friend].flags`: `number_note`, `casual`) */
  | { t: 'friendFlag'; friend: string; id: string }
  /** grants an ItemDef or MenuItem id (a free `onigiri`, `g_wagashi`); a never-sold reward such as Mio's note is a `keepsake` instead */
  | { t: 'item'; id: string; qty?: number }
  /** a keepsake (framed photo, sheet music, Hina's drawing): never sold, listed in `GameState.keepsakes` */
  | { t: 'keepsake'; id: string }
  | { t: 'culture'; id: string }
  | { t: 'title'; id: string }
  | { t: 'sticker'; id: string };

export interface Beat {
  id: string;
  place?: string;
  lines: BeatLine[];
  effects?: BeatEffect[];
  /** the beat ends by asking for something (opens the dream picker, the katakana name field or the diary entry) */
  ask?: 'dream' | 'nameKana' | 'diary';
}

export type CultureOn =
  | 'shop_start' // first shop conversation starts
  | 'talk_start' // ids: character ids
  | 'scenario_done' // ids: scenario ids
  | 'payment' // first payment; ids: shop ids
  | 'served' // first dish served; ids: scenario ids
  | 'machine' // panel machine used; ids: 'vending' | 'ticket' | 'ramen_machine'
  | 'purchase' // ids: shop or item ids; n = nth purchase
  | 'intent' // ids: 'scenarioId:intentId'
  | 'gift_given'
  | 'casual_switch'
  | 'visit' // ids: place ids
  | 'ride'
  | 'festival'
  | 'perfect_shift'; // n = nth perfect shift

export interface CultureTrigger {
  on: CultureOn;
  ids?: string[];
  n?: number;
  /** only once chapter.n >= ch (cc_hanami: the first park visit after Chapter 3) */
  ch?: number;
}

export interface CultureCard {
  id: string;
  trigger: CultureTrigger;
  /** further ways to unlock it, the first to happen wins (cc_points: the 3rd konbini purchase or the 3rd perfect shift; cc_refuse) */
  also?: CultureTrigger[];
  phrase: Line;
  text: Gloss;
  /** the key phrase is something the learner says (hidden-line Say-it; feeds `culture_said`) */
  say?: true;
  adultOnly?: true;
}

export interface TitleDef {
  id: string;
  name: NameGloss;
  source: { kind: 'chapter'; n: number } | { kind: 'dream'; id: string } | { kind: 'heart'; friend: string };
}

export interface AgeProfile {
  dailyGoals: number;
  /** max pocket lines */
  pocketLines: number;
  textScale: number;
  minTapPx: number;
  ttsRate: number;
  /** echo / say-it pass mark on speechSimilarity */
  echoThreshold: number;
  /** lowest age in the group; compared with ItemDef.gate.ageMin / DreamDef.ageMin */
  ageFloor: number;
  voiceDefault: 'off' | 'consent';
  /** voice input needs an adult gate to turn on */
  adultGate: boolean;
  walletStyle: 'coins' | 'full';
  newCardsPerDay: number;
  adultTopics: boolean;
}

/** Phrase Pocket line (§11.1). `key` lines gate "ready"; at most 2 per pocket. */
export interface PocketLine {
  id: string;
  line: Line;
  note?: Gloss;
  key?: true;
}

// --- jobs and shifts (§9) ----------------------------------------------------------------------------------------

export type CustomerTask =
  | { kind: 'order'; items: Array<{ menu: string; qty: number }>; toggles?: string[] }
  | { kind: 'platform' | 'time' | 'fare' | 'direction' | 'announce'; answer: string | number };

export interface CustomerTemplate {
  id: string;
  tier: 1 | 2 | 3 | 4;
  minRank: 0 | 1 | 2 | 3 | 4;
  line: Line;
  task: CustomerTask;
  /** accepted staff phrases (any match) */
  thanks: string[];
  tiles?: string[];
  change?: { paid: number };
}

export interface JobDef {
  id: string;
  place: string;
  /** Character.id of the boss */
  boss: string;
  name: Gloss;
  /** wage per hour in minor units */
  wage: number;
  /** paid hours per shift (BALANCE.shift.hours unless a pack overrides) */
  hours: number;
  unlock: Pred;
  /** the intro scenario that unlocks the job and pays once */
  intro?: string;
  archetypes: CustomerTemplate[];
  /** wordTags ids that weight the cart toward due vocabulary */
  vocabTags: string[];
  bonus: { itemId: string; needsPerfect: true };
}

export type ShiftTaskKind = 'order' | 'total' | 'thanks' | 'greet';
export type ShiftInput = 'typed' | 'spoken' | 'tiles' | 'pick';
export type ShiftAssist = 'none' | 'text' | 'translation';

export interface ShiftTaskResult {
  kind: ShiftTaskKind;
  ok: boolean;
  /** how a production task (total, thanks) was answered */
  input?: ShiftInput;
}

export interface ShiftCustomerResult {
  templateId: string;
  served: boolean;
  /** what help the learner took on this customer */
  assist: ShiftAssist;
  tasks: ShiftTaskResult[];
}

/** Raw outcome of a played shift; `scoreShift` and `shiftPay` turn it into accuracy and yen. */
export interface ShiftResult {
  /** unique per shift (ledger idempotency) */
  id: string;
  jobId: string;
  customers: ShiftCustomerResult[];
  quit: boolean;
  durationSec: number;
  /** the first shifts at a job, or listening is off: assist factors do not apply (§9.1) */
  assistWaived: boolean;
}

export interface ShiftScore {
  served: number;
  /** correct task units (order weighted by assist) / units, 0..1 */
  ticks: number;
  /** mean production credit over the correct total + thanks tasks */
  r: number;
  perf: number;
  /** all customers served and ticks >= BALANCE.shift.accuracy, not quit: counts for objectives, ranks, g_shift */
  good: boolean;
  /** good and every task correct */
  perfect: boolean;
  /** ticks below the pass mark with >= 2 served: pays the trial wage, never counts */
  trial: boolean;
  /** the shift was quit early (copied from the result so `shiftPay` can pay 0 / x0.6) */
  quit: boolean;
  band: 'perfect' | 'nice' | 'almost' | 'retry';
}

export interface ShiftCustomer {
  templateId: string;
  line: Line;
  task: CustomerTask;
  thanks: string[];
  tiles?: string[];
  change?: { paid: number };
  /** the correct total in minor units for order customers */
  total?: number;
}

export interface ShiftPlan {
  jobId: string;
  seed: number;
  rank: number;
  customers: ShiftCustomer[];
}

// --- the pack -------------------------------------------------------------------------------------------------------

export interface GamePack {
  schema: 1;
  id: string;
  language: string;
  district: string;
  name: Gloss;
  currency: CurrencyDef;
  economy: EconomyDef;
  tax: TaxRegime;
  rules: PackRules;
  lang: LanguagePlugin;
  /** consumables keyed by shop + slot option id */
  menu: MenuItem[];
  /** §5.2 / §5.3 catalog */
  items: ItemDef[];
  shops: ShopDef[];
  fares: Record<string, number>;
  jobs: JobDef[];
  chapters: ChapterDef[];
  dreams: DreamDef[];
  daily: DailyTemplate[];
  beats: Record<string, Beat>;
  friends: FriendDef[];
  /** characterId -> interactions */
  interactions: Record<string, Interaction[]>;
  scenarioMeta: ScenarioMeta[];
  /** pocket line id -> line */
  pockets: Record<string, PocketLine>;
  /** tag -> surfaces (numbers, direction, transport, home, car, cafe) */
  wordTags: Record<string, string[]>;
  culture: CultureCard[];
  titles: TitleDef[];
  ageProfiles: Record<AgeGroup, AgeProfile>;
  /** renamed ids (old -> new), §14.7 */
  idAliases?: Record<string, string>;
  /** job rank names, index = rank (見習い trainee ... 店長代理 acting manager, §9.2) */
  ranks?: NameGloss[];
  /** keepsake id -> name (heart-5 gifts, home visits, dream finales); the ids owned are in `GameState.keepsakes` */
  keepsakes?: Record<string, NameGloss>;
}

// ---------------------------------------------------------------------------------------------------------------
// Persisted game state (§14.5). JSON-safe.
// ---------------------------------------------------------------------------------------------------------------

export type LedgerKind =
  | 'loop'
  | 'shift'
  | 'goal'
  | 'streak'
  | 'chapter'
  | 'star'
  | 'phrase'
  | 'echo'
  | 'purchase'
  | 'fare'
  | 'topup'
  | 'refund'
  | 'gift'
  | 'perk';

export interface LedgerEntry {
  /** idempotency key; formats in LEDGER_IDS (§14.9) */
  id: string;
  /** epoch ms */
  at: number;
  kind: LedgerKind;
  delta: number;
  pocket: Pocket;
  ref?: string;
  note?: string;
}

/** A day key is `d<dayIndex>`. */
export type DayKey = string;

export interface GameClock {
  /** number of accepted day rollovers (D3) */
  dayIndex: number;
  /** local YYYY-MM-DD last observed */
  lastLocalDate: string;
  lastSeenAt: number;
  /** days with >= 1 meaningful action */
  activeDays: number;
  /** dayIndex of the last active day; -1 = never */
  lastActiveDay: number;
}

export interface WalletState {
  cash: number;
  ic: number;
  points: number;
}

/**
 * `earned` / `spent` sum the non-transfer deltas of the cash and ic pockets (what `earn_total` and the dream bar read); points
 * and the topup / refund transfers never touch them. Invariants (`reconcile`): cash + ic = startCash + earned - spent, and
 * `wallet[p] === checksum[p]` for every pocket, because `checksum` starts at { cash: startCash, ic: 0, points: 0 } and adds each
 * APPLIED (post-clamp) delta.
 */
export interface TotalsState {
  earned: number;
  spent: number;
  /** running sum of every applied delta, per pocket, seeded with the start cash */
  checksum: WalletState;
}

export interface PayState {
  /** the day the `*Today` counters belong to; `observeClock` resets them to `emptyPay(dayKey(dayIndex))` on a rollover, and a reader that finds `day` stale treats every `*Today` as 0 */
  day: DayKey;
  /** language yen earned today (loop + stars + first-phrase + echo + shifts), for the soft cap */
  langToday: number;
  /** yen */
  firstPhraseToday: number;
  /** yen */
  echoToday: number;
  /** echo bonuses paid in the latest conversation (max BALANCE.echo.perConv) */
  echoSession: { sessionId: string; n: number } | null;
  /** scenarioId -> paid completions today */
  scenarioToday: Record<string, number>;
  /** scenarioId -> dayKey of the last paid completion */
  lastPaid: Record<string, DayKey>;
  /** jobId -> shifts paid today */
  shiftsToday: Record<string, number>;
  /** 'scenarioId:intentId' of every first independent use, lifetime */
  seenIntents: string[];
  /** points earned today (cap BALANCE.points.dailyCap) */
  pointsToday: number;
  /** friend shop-perk yen granted today (cap BALANCE.friendPerkDailyMax) */
  perkToday: number;
  /** 'shopId:itemId' haggle attempts today */
  haggleToday: string[];
  /** PerkDef ids of `daily_free` perks already used today */
  perkFreeToday: string[];
}

export interface RunRecord {
  count: number;
  complete: boolean;
  stars: 0 | 1 | 2 | 3;
  bestIndependent: number;
  bestShare: number;
  bestR: number;
  /** goal steps done in any run */
  steps: string[];
}

/** Single writers (never two): purchases / spentOnPurchases = commitPurchase (world-surface shops only: a panel purchase such as a vending drink is not a conversation purchase); gifts = applyGift; chats / hangouts = applyTalk; the rest = the reducer. */
export interface StatsState {
  purchases: number;
  spentOnPurchases: number;
  /** liked counts liked-or-loved, loved only loved */
  gifts: { n: number; liked: number; loved: number };
  chats: { n: number; friends: Record<string, number> };
  hangouts: Record<string, number>;
  /** `visit` event places plus 'home:<id>' and 'trip:<id>' entries (a `trip_done` adds 'trip:<id>'), distinct */
  visits: string[];
  /** spot ids from `spot` events ('pond'), distinct */
  spots: string[];
  tickets: number;
  sayNew: number;
  srsReviews: number;
  /** culture card ids whose key phrase the learner has said */
  cultureSaid: string[];
  /** PerkDef ids of one-time perks (`once_discount`, `once_cash`, `once_item`) already granted; the ledger's `seen` ring is too short to prove it */
  perksUsed: string[];
  /** PerkDef id of a `daily_free` perk with `every` -> qualifying purchases so far */
  perkBuys: Record<string, number>;
}

export interface OwnedEntry {
  qty: number;
  /** dayKey first acquired */
  day: DayKey;
}

export interface OutfitState {
  equipped: string[];
  colours: Record<string, string>;
}

export interface HomeState {
  tier: 'dorm' | 'ono';
  /** home slot -> item id */
  placed: Record<string, string>;
}

export interface TicketsState {
  ramen?: { flavor: string };
  station?: { place: string };
}

export interface ChapterState {
  /** current chapter; 9 = Free Walk */
  n: number;
  /** objective id -> dayKey completed */
  done: Record<string, DayKey>;
  /** cache, re-derived from the objectives on load */
  completed: number[];
  /** story flags (`Pred {k:'flag'}`): letter_written, dream_epilogue, ticket_bought, souvenir_given, housewarming, first_drive, aiko_room_shown, genkan_ok, heart5_seen, points_card, phone_fund... */
  flags: string[];
  /** objective ids whose easier alternative was accepted */
  easier: string[];
  /** objective id -> attempts, for `easier.afterTries` */
  tries: Record<string, number>;
  /** when the current chapter became current (catch-up and the one-completion-per-day rule) */
  began: { dayIndex: number; activeDays: number };
}

export interface DreamState {
  id: string | null;
  /** step id -> dayKey done */
  steps: Record<string, DayKey>;
  done: boolean;
}

export interface DailyGoalState {
  /** DailyTemplate.id */
  id: string;
  slot: DailySlot;
  counter: DailyCounter;
  target: number;
  /** dayIndex the goal was generated; its counter counts from here */
  day: number;
  done: boolean;
  paid: boolean;
}

export interface DailyState {
  /** dayIndex the trio was generated for */
  day: number;
  goals: DailyGoalState[];
  /** yesterday's unfinished goals, still open for their second day */
  carried: DailyGoalState[];
  /** dayIndex -> counter -> value, last 2 days */
  counters: Record<number, Partial<Record<DailyCounter, number>>>;
  /** dayIndex -> counter -> distinct keys seen (scenario ids, places...), for the `*_distinct` counters */
  sets: Record<number, Partial<Record<DailyCounter, string[]>>>;
  swapUsed: boolean;
  /** the all-three chest was paid for today's trio */
  allPaid: boolean;
  /** the streak bonus was paid today */
  streakPaid: boolean;
  /** recent template ids per slot to avoid repeats (yesterday's first) */
  recent: string[];
}

export interface FriendState {
  ap: number;
  met: boolean;
  /** dayIndex of the last counted talk; absent = never */
  talkDay?: number;
  /** dayIndex of the last AP gift */
  giftDay?: number;
  /** dayIndex of the last hang-out */
  hangoutDay?: number;
  /** dayIndex of the last contact of any kind (talk, chat, gift) */
  lastContactDay?: number;
  /** dayIndex the AP / chat counters below belong to */
  apDay: number;
  /** AP earned from every source on `apDay` (cap BALANCE.ap.dailyCap) */
  apToday: number;
  /** chat AP earned on `apDay` (cap BALANCE.ap.chat.dailyCap) */
  chatApToday: number;
  /** dayIndex of the last phone thread (one per friend per day) */
  chatDay?: number;
  /** unread phone threads waiting (max BALANCE.ap.chat.unreadMax); always `threads.length` */
  unread: number;
  /** the waiting threads, oldest first: which chat template (`chat_*` scenario id) and the dayIndex it arrived */
  threads: Array<{ template: string; day: number }>;
  /** chat templates used most recently, newest last (a rotating generic thread avoids the last 3) */
  chatRecent: string[];
  /** what the friend remembers about the player (IntentDef.remember): fact key -> value */
  facts: Record<string, string>;
  /** profile fact ids revealed to the player */
  learned: string[];
  /** profile fact ids the player recalled correctly (gold frame) */
  gold: string[];
  /** remembered-fact key -> dayIndex a callback last used it */
  callbacks: Record<string, number>;
  /** small-talk topic id -> dayIndex last offered (no repeat within 5 days) */
  topicDay: Record<string, number>;
  /** hearts whose heart event has been played */
  events: number[];
  flags: string[];
  /** gifts given, newest last; trimmed to what the 7-day repeat rule needs */
  giftHistory: Array<{ item: string; day: number }>;
  /** gifts given in total / liked-or-loved */
  gifts: number;
  /** liked-or-loved */
  giftsLiked: number;
  /** loved only (`Pred gift friend: reaction: 'loved'`) */
  giftsLoved: number;
}

export interface JobState {
  shifts: number;
  /** shifts that counted (all customers served, accuracy >= BALANCE.shift.accuracy) */
  good: number;
  perfect: number;
  rank: number;
  lastDay?: DayKey;
  /** order signatures of the last shifts, so an order never repeats within 3 shifts */
  recent: string[];
}

export interface PrepState {
  s: 'seen' | 'ready';
  /** dayIndex; a recall `ready` expires after BALANCE.readyDays */
  at: number;
}

export interface DiaryEntry {
  chapter: number;
  ja: string;
  assisted: boolean;
}

export interface AudioPrefs {
  sttConsent: 'unset' | 'allowed' | 'declined';
  micPref: 'auto' | 'off';
  listenPref: 'on' | 'off';
  /** multiplies the age profile's TTS rate (the "slower voice" coach card sets BALANCE.adaptive.helpTtsRate); absent = 1 */
  ttsRateScale?: number;
  lastMode?: string;
  /** epoch ms of the last Audio check */
  lastCheckedAt?: number;
}

/** One finished conversation as the coach cards and the stuck rule see it (§11.7, §11.8). */
export interface CoachRun {
  day: number;
  scenarioId: string;
  r: number;
  fallbacks: number;
}

export interface CoachState {
  /** the last BALANCE.coach.recent conversations, newest last */
  recent: CoachRun[];
  /** scenarios that default to Real mode (the accepted "fewer chips" card) */
  realFor: string[];
  /** conversations finished since a coach card was last accepted or dismissed (at most one change per BALANCE.adaptive.everyConvs) */
  sinceChange: number;
}

/** Cash net (earned - spent) of one dayIndex, for the dream tracker's pace estimate. */
export interface IncomeDay {
  day: number;
  net: number;
}

/** The finished Letter Home (§7.2): one entry per sentence frame. Only text is stored, never audio. */
export interface LetterSentence {
  ja: string;
  assisted: boolean;
}

export interface GameState {
  v: 1;
  packId: string;
  clock: GameClock;
  wallet: WalletState;
  totals: TotalsState;
  /** ring of the last BALANCE.ledger.entries entries */
  ledger: LedgerEntry[];
  /** ring of the last BALANCE.ledger.seen processed ids */
  seen: string[];
  pay: PayState;
  /** per scenario, best-of */
  runs: Record<string, RunRecord>;
  stats: StatsState;
  owned: Record<string, OwnedEntry>;
  outfit: OutfitState;
  home: HomeState;
  tickets: TicketsState;
  chapter: ChapterState;
  dream: DreamState;
  daily: DailyState;
  friends: Record<string, FriendState>;
  jobs: Record<string, JobState>;
  /** pocket line id -> readiness */
  prep: Record<string, PrepState>;
  /** culture card id -> dayKey unlocked */
  culture: Record<string, DayKey>;
  titles: string[];
  activeTitle: string | null;
  /** cosmetic dream stickers earned (`st_<dream>`, `DreamDef.sticker`) */
  stickers: string[];
  /** keepsake ids owned (`BeatEffect keepsake`, `DreamDef.keepsake`); names in `GamePack.keepsakes` */
  keepsakes: string[];
  /** ids of the beats already played (a beat plays once; `dreamUnlocked` is `beats` containing the Chapter 1 closing beat) */
  beats: string[];
  words: { said: string[] };
  diary: DiaryEntry[];
  /** the Letter Home sentences once written (empty before) */
  letter: LetterSentence[];
  /** last BALANCE.dream.etaWindowDays days, newest last */
  income: IncomeDay[];
  coach: CoachState;
  audio: AudioPrefs;
  me: { nameKana: string };
  flags: { dev?: boolean; welcomeSeenDay?: number };
  /** seed-once marker (§14.7) */
  seeded: boolean;
  /** unknown ids and fields are kept here, never dropped (§14.7) */
  _extra?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------------------------------------------
// Conversation facts, receipts, events
// ---------------------------------------------------------------------------------------------------------------

export type TurnClass = 'I' | 'S' | 'T';

export interface TurnFacts {
  id: number;
  cls: TurnClass;
  credit: number;
  substantive: boolean;
  thin?: boolean;
  copied?: boolean;
  recalled?: boolean;
  hintOpened?: boolean;
  contentTokens: number;
  intentId?: string;
  /** goal step ids this turn completed */
  stepIds: string[];
  /** a request turn (ください / お願い expected) */
  request?: boolean;
  /** normalised Japanese text (`normJa`) */
  norm: string;
  /** new words said in this turn (surfaces) */
  newWords: string[];
  /** every content-token surface in the turn (feeds the implicit "use = review" and the `culture_said` phrase match); absent = none */
  words?: string[];
  /** speech recognition confidence when the turn was spoken */
  confidence?: number;
}

/** What the engine hands over after a conversation (engine/scoring.ts builds it). */
export interface ConversationFacts {
  sessionId: string;
  scenarioId: string;
  characterId: string;
  mode: 'guided' | 'real';
  abandoned: boolean;
  durationSec: number;
  goalDone: number;
  goalTotal: number;
  turns: TurnFacts[];
  fallbacks: number;
  hintUses: number;
  /** rule accuracy 0..100, or null when there were no scored turns */
  accuracy: number | null;
  /** no `naturalness` correction on a request turn */
  requestsPolite: boolean;
  /** the scenario's pocket was ready at start */
  prepared: boolean;
  /** IntentDef.remember output: fact key -> value */
  remembered: Record<string, string>;
  /** the entry node the conversation started at (ramen 'start_ticket' consumes `tickets.ramen`); absent = the scenario start */
  startNode?: string;
  /** small talk: the topic id offered (feeds `FriendState.topicDay`) */
  topic?: string;
  /** profile fact ids the friend revealed in this talk (added to `FriendState.learned`) */
  revealed?: string[];
  /** remembered-fact keys a callback quoted and the player answered substantively (3 AP each, inside the talk cap) */
  callbacks?: string[];
  /** a "do you remember?" quiz: the fact id and whether the player recalled it (typed = correct; chosen from chips = `assisted`) */
  quiz?: { fact: string; correct: boolean; assisted?: boolean };
  /** story / friend flags the scenario raised (`plan_mio`, `genkan_ok`, `aiko_room_shown`, `ticket_bought`...); the reducer files them under `chapter.flags` or the friend's flags */
  flags?: string[];
}

/** One receipt row (§6.2): signed yen, negative for discounts. */
export interface QuoteLine {
  kind: 'item' | 'delivery' | 'fee' | 'discount' | 'points' | 'perk' | 'haggle';
  /** item or fee id, perk id... */
  ref?: string;
  label: Gloss;
  qty?: number;
  unit?: number;
  amount: number;
}

export interface SrsOp {
  op: 'add' | 'review';
  /** vocabulary key (word surface, or the pocket / line id for phrases) */
  key: string;
  kind?: 'word' | 'phrase';
  /** phrase cards carry their text */
  line?: Line;
  source?: 'goal' | 'correction' | 'conversation' | 'sign' | 'lesson';
  /** first due in minutes from now (add) */
  dueInMin?: number;
  /** implicit review grade: use = review, once per card per day (review) */
  grade?: 'good';
}

/**
 * Everything that can change a GameState goes through `reduce` as one of these; nothing writes state around the reducer
 * (the write-paths of the fields that have no domain event are `profile_set`, `diary_added`, `daily_swap`, `heart_event_done`, `dev`).
 * `reduce` runs `observeClock(state, ctx.now)` before every event; `day_observed` is the shell's "no other effect" request for it
 * and its `nowMs` is used instead of `ctx.now` for that event only.
 */
export type InputEvent =
  | { t: 'conversation_done'; facts: ConversationFacts }
  /**
   * `commitPurchase` re-quotes from (shopId, itemId, qty, method, eatIn, delivery, usePoints, haggle) and charges the RE-QUOTED total:
   * `total` and `lines` are what the player saw and are only compared (a mismatch is not an error, the re-quote wins). Panel
   * purchases (vending drinks, a ramen ticket, the IC card itself) use the same event with a panel-generated `sessionId`.
   */
  | {
      t: 'purchase';
      sessionId: string;
      n: number;
      shopId: string;
      itemId: string;
      qty: number;
      total: number;
      method: PayMethod;
      lines: QuoteLine[];
      eatIn?: boolean;
      delivery?: boolean;
      usePoints?: boolean;
      /** yen the haggle hook granted in this conversation */
      haggle?: number;
    }
  /** cash -> ic transfer (ledger `topup:<id>`); a station_ic card purchase is a `purchase` of 'ic_card' plus a `topup` of the loaded amount */
  | { t: 'topup'; id: string; amount: number }
  /** the whole ic balance back to cash less BALANCE.icRefundFee (ledger `refund:<id>`) */
  | { t: 'refund'; id: string }
  /** a train fare (ledger `fare:<id>`); `legs` 2 = the round trip of a trip, charged up front */
  | { t: 'fare'; id: string; place: string; method: PayMethod | 'paper'; legs?: 1 | 2 }
  /** `bare`: the hand-over did not name the item (「どうぞ」 alone); `assistedHandover`: it was tapped or translated; either halves the AP */
  | { t: 'gift_given'; friendId: string; itemId: string; sessionId: string; assistedHandover: boolean; bare?: boolean }
  | { t: 'shift_done'; jobId: string; result: ShiftResult }
  | { t: 'lesson_done'; id: string }
  | { t: 'word_saved'; key: string }
  | { t: 'sign_found'; id: string }
  | { t: 'culture_seen'; id: string }
  /** `keys` reviewed (feeds `srs_reviews`); `due` = how many of them were due, already had an earlier review and were answered through a check, not a self-rated flip (feeds `g_review8`) */
  | { t: 'srs_review'; keys: string[]; due: number }
  /** `ready` = pocket lines that passed a recall check this session; `seen` = lines studied (or only warmed up) this session */
  | { t: 'prepare_done'; scenarioId: string; ready: string[]; seen?: string[] }
  /** the hidden-line Say-it of a debrief line; `peeked` keeps the SRS card but forfeits the yen; `line` makes the phrase card for a line that is not a pocket line */
  | { t: 'echo'; sessionId: string; lineId: string; similarity: number; peeked?: boolean; line?: Line }
  /** the Say-it of a `say:true` culture card (feeds `culture_said`, makes the SRS phrase card) */
  | { t: 'culture_say'; id: string; similarity: number }
  /** a beat finished playing: files it in `beats`, applies its `effects`, and may follow with `dream_chosen` / `profile_set` / `diary_added` for its `ask` */
  | { t: 'beat_done'; id: string }
  /** the Letter Home was written (sets the `letter_written` flag; `diary` is separate) */
  | { t: 'letter_saved'; sentences: LetterSentence[] }
  /** the player accepted the `easier` alternative of an objective (free and permanent; `chapter.easier`) */
  | { t: 'easier_accept'; objective: string }
  /** a debrief coach card was answered: 'real' = default this scenario to Real mode, 'help' = slower voice, 'dismiss' = not now */
  | { t: 'coach_choice'; card: 'real' | 'help' | 'dismiss'; scenarioId?: string }
  | { t: 'visit'; place: string }
  | { t: 'spot'; id: string }
  /** records the produced ticket only (`tickets.*`, `stats.tickets`); the payment is the preceding `purchase` (ramen) or `fare` (station) event */
  | { t: 'ticket_bought'; kind: 'ramen'; flavor: string }
  | { t: 'ticket_bought'; kind: 'station'; place: string }
  | { t: 'trip_done'; id: string }
  | { t: 'item_placed'; slot: string; itemId: string | null }
  | { t: 'outfit_changed'; equipped: string[]; colours: Record<string, string> }
  | { t: 'phone_chat_done'; friendId: string; sessionId: string; facts: ConversationFacts }
  /** sets a story flag in `chapter.flags`, or in `friends[friendId].flags` when `friendId` is given */
  | { t: 'flag'; id: string; friendId?: string }
  | { t: 'dream_chosen'; id: string | null }
  | { t: 'day_observed'; nowMs: number }
  /** records `audio.lastMode` */
  | { t: 'audio_mode'; mode: string }
  /** the app's player-profile writes: the katakana name, the shown title, audio preferences, the dev toggle and the welcome-back marker */
  | { t: 'profile_set'; nameKana?: string; activeTitle?: string | null; audio?: Partial<AudioPrefs>; dev?: boolean; welcomeSeenDay?: number }
  | { t: 'diary_added'; entry: DiaryEntry }
  /** the once-a-day free swap (`swapDaily`) */
  | { t: 'daily_swap'; goalId: string }
  /** the friend's heart event for `level` was played (`FriendState.events`; awards BALANCE.ap.event once) */
  | { t: 'heart_event_done'; friendId: string; level: number }
  /** QA tools (Settings, 7 taps); ignored unless `flags.dev` */
  | { t: 'dev'; cmd: 'cash' | 'complete_objective' | 'advance_chapter' | 'advance_day'; amount?: number };

export type PurchaseEvent = Extract<InputEvent, { t: 'purchase' }>;

export type DerivedEvent =
  | { t: 'wallet_changed'; delta: number; balance: number; kind: LedgerKind }
  | { t: 'hearts_changed'; friendId: string; from: number; to: number }
  | { t: 'stars_changed'; scenarioId: string; from: number; to: number }
  | { t: 'objective_done'; id: string }
  | { t: 'chapter_done'; n: number }
  | { t: 'dream_step_done'; dream: string; step: string }
  | { t: 'dream_done'; dream: string }
  | { t: 'goal_done'; id: string }
  | { t: 'daily_done'; day: string }
  | { t: 'culture_unlocked'; id: string }
  | { t: 'title_earned'; id: string }
  | { t: 'unlocked'; what: 'place' | 'job' | 'feature' | 'shop' | 'interaction' | 'item' | 'dream'; id: string }
  | { t: 'heart_event_ready'; friendId: string; level: number }
  /** chapter n became current (its `opens` take effect, D36); its opening beat plays */
  | { t: 'chapter_started'; n: number }
  | { t: 'sticker_earned'; id: string }
  /** the whole conversation settlement, so the debrief rows equal the ledger (§11.3) */
  | { t: 'loop_settled'; sessionId: string; scenarioId: string; settlement: LoopSettlement }
  /** AP of one friend from one event, for the debrief friends strip */
  | { t: 'ap_gained'; friendId: string; ap: number; parts: ApResult['parts'] }
  | { t: 'gift_reacted'; friendId: string; itemId: string; reaction: GiftReaction; ap: number }
  /** the shift result card (§9.4); a rank-up is `rankAfter > rankBefore` */
  | { t: 'shift_settled'; jobId: string; score: ShiftScore; pay: number; rankBefore: number; rankAfter: number };

export type UiEffect =
  | { t: 'toast'; key: string; vars?: Record<string, string | number> }
  | { t: 'fanfare'; kind: 'purchase' | 'chapter' | 'dream' | 'heart' }
  | { t: 'culture'; id: string }
  | { t: 'beat'; id: string }
  | { t: 'srsOps'; ops: SrsOp[] }
  /** cosmetic XP for the v1 store's `addXp` (first vending drink, culture card, ...) */
  | { t: 'xp'; amount: number; why: string }
  | { t: 'celebrate'; payload: unknown };

/** Read-only data from the v1 store (vocabulary, streak, discovered, lessons, profile). Never persisted by @lw/game. */
export interface GameView {
  vocab: {
    /** items with source !== 'starter' (`words_saved`) */
    total: number;
    /** keys at FSRS state Review with stability >= BALANCE.knownStability (recalled lines) */
    known: Set<string>;
    dueCount: number;
    /** VocabItem.id of every card with >= 1 review (`words_known`) */
    reviewedKeys: Set<string>;
    /** VocabItem.s of the same cards, matched against `wordTags` */
    reviewedSurfaces: Set<string>;
  };
  discovered: string[];
  lessonsDone: string[];
  streakDays: number;
  profile: { age: AgeGroup; goal: string; level: 'A1' | 'A2'; createdAt: string; /** how Arabic NPC lines address the learner (§8.5); absent = 'm' */ arAddress?: 'm' | 'f' };
}

export interface ReduceCtx {
  pack: GamePack;
  /** epoch ms */
  now: number;
  view: GameView;
  /** deterministic when seeded by the caller (tests); Math.random in the app */
  rng: () => number;
}

export interface ReduceResult {
  state: GameState;
  derived: DerivedEvent[];
  effects: UiEffect[];
}

// ---------------------------------------------------------------------------------------------------------------
// Results of the pure helpers (api.ts)
// ---------------------------------------------------------------------------------------------------------------

export interface WalletLimits {
  cash: number;
  ic: number;
}

export interface LedgerResult {
  state: GameState;
  applied: boolean;
  reason?: 'duplicate' | 'insufficient' | 'capped';
}

export interface ReconcileReport {
  ok: boolean;
  /** startCash + earned - spent, against cash + ic (points reconcile through their checksum only) */
  expected: number;
  actual: number;
  /** per-pocket checksum mismatches */
  mismatches: Pocket[];
}

export type PurchaseBlock = 'unknown_item' | 'closed' | 'not_sold' | 'gate' | 'age' | 'stars' | 'needs' | 'owned' | 'qty' | 'funds' | 'ic_cap' | 'duplicate';

export interface QuoteRequest {
  shopId: string;
  itemId: string;
  qty?: number;
  eatIn?: boolean;
  method?: PayMethod;
  delivery?: boolean;
  /** redeem points (up to the total) */
  usePoints?: boolean;
  /** yen the haggle hook granted this conversation (never stored) */
  haggle?: number;
}

export interface Quote {
  shopId: string;
  itemId: string;
  qty: number;
  lines: QuoteLine[];
  /** pre-tax portion */
  subtotal: number;
  /** tax embedded in the (tax-included) prices; informational */
  tax: number;
  total: number;
  bulky: boolean;
  /** total >= EconomyDef.bigTicket: ask for a confirm node */
  confirm: boolean;
  /** price / refWage when the work-hours chip applies, else null */
  hours: number | null;
  /** the player could pay `total` with the requested method */
  canPay: boolean;
  block?: PurchaseBlock;
}

export interface PurchaseResult extends ReduceResult {
  ok: boolean;
  reason?: PurchaseBlock;
}

export type ItemAvailability = 'ok' | 'closed' | 'gate' | 'age' | 'stars' | 'needs' | 'owned';

export type PayReason = 'lines' | 'steps' | 'prepared' | 'real' | 'firstPhrase' | 'echo' | 'star' | 'softCap' | 'repeat' | 'practiceOnly';

/** One plain-reason yen row for the debrief ledger block (§11.3). */
export interface PayLine {
  reason: PayReason;
  yen: number;
  ledgerId?: string;
  vars?: Record<string, string | number>;
}

export interface TurnStats {
  /** substantive matched turns */
  n: number;
  /** r = sum(credit) / n over substantive matched turns */
  r: number;
  /** class-I substantive turns */
  independent: number;
  /** class-S/T substantive turns */
  assisted: number;
  /** independent / (independent + assisted), 0 when none */
  share: number;
  /** distinct intent ids matched by class-I substantive turns */
  distinct: string[];
}

export interface LoopSettlement {
  stats: TurnStats;
  F: number;
  clean: number;
  goalFactor: number;
  indepBonus: number;
  dayFactor: number;
  prepF: number;
  realF: number;
  base: number;
  /** loop pay before the soft cap */
  raw: number;
  /** loop pay after the soft cap, rounded; 0 for 'practice only' */
  loopPay: number;
  practiceOnly: boolean;
  softCapped: boolean;
  stars: 0 | 1 | 2 | 3;
  /** new stars above the stored best, with their one-time yen */
  newStars: Array<{ star: 1 | 2 | 3; yen: number }>;
  /** first independent uses of intents (keys 'scenarioId:intentId') that pay */
  firstPhrases: Array<{ key: string; yen: number }>;
  /** total yen this conversation adds to the wallet */
  total: number;
  lines: PayLine[];
}

export interface PayoutFactor {
  /** paid completions of this scenario today */
  plays: number;
  /** multiplier for the next completion */
  dayFactor: number;
  /** language yen still payable at full rate today */
  softCapLeft: number;
}

export interface ClockResult {
  state: GameState;
  /** a day rollover happened (exactly one, whatever the jump) */
  rolled: boolean;
}

export interface DedupeResult {
  state: GameState;
  /** false when the id was already processed */
  fresh: boolean;
}

export type TalkKind = 'talk' | 'chat' | 'hangout' | 'heart' | 'home';

export interface ApResult extends ReduceResult {
  /** AP actually added after caps */
  ap: number;
  /** per source, before the daily cap, for the debrief friends strip */
  parts: Array<{ source: 'met' | 'talk' | 'share' | 'callback' | 'chat' | 'hangout' | 'event' | 'quiz'; ap: number }>;
  hearts: { from: number; to: number };
}

export type GiftReaction = 'loved' | 'liked' | 'neutral' | 'disliked';

export interface GiftResult extends ReduceResult {
  reaction: GiftReaction;
  ap: number;
  hearts: { from: number; to: number };
}

export interface FriendActions {
  talk: boolean;
  gift: boolean;
  chat: boolean;
  hangout: boolean;
  home: boolean;
  /** why a gift AP would be reduced, for the hand-over UI */
  giftNotes: Array<'bare' | 'noTalk' | 'repeat' | 'capped' | 'daily'>;
}

/** The debrief coach card to show after a conversation (§11.8), if any. */
export type CoachOffer = 'real' | 'help' | null;

export interface AvatarPatch {
  top?: string;
  bottom?: string;
  shoes?: string;
  accent?: string;
  accessories: string[];
}

export interface RideState {
  mesh: 'none' | 'bike' | 'ebike' | 'car';
  mul: number;
}

export interface PlaceResult {
  state: GameState;
  ok: boolean;
  reason?: 'not_owned' | 'bad_slot' | 'no_flat';
}

export interface DreamProgress {
  dream: string;
  /** steps visible at the current chapter, with their state */
  steps: Array<{ id: string; done: boolean; visible: boolean }>;
  doneCount: number;
  total: number;
  nextStep: string | null;
  /** sum of the dream's unowned items plus bulky delivery and the cheapest small goods for an item_placed step */
  remainingCost: number;
  cash: number;
  /** min(1, cash / remainingCost); 1 when nothing is left to buy */
  yenBar: number;
  /** chapter in which the next purchase opens and the objectives still open until then */
  languageGate: { chapter: number; objectivesLeft: number };
  /** days at the player's pace, null until 3 days of data, 'many' beyond 60 */
  etaDays: number | 'many' | null;
}

export interface NextGoal {
  kind: 'objective' | 'dream' | 'daily' | 'review' | 'practice' | 'lesson' | 'wait';
  /** objective / step / goal / scenario / lesson id */
  id: string;
  text: Gloss;
  pin?: { place?: string; friend?: string };
  /** for 'wait': days of practice still needed */
  days?: number;
}

export interface ChapterStatus {
  n: number;
  /** objectives done / total (non-dream) */
  done: number;
  total: number;
  /** all objectives done but activeDays < minDays: "Done! The next chapter opens after {n} more days" */
  waitDays: number;
  /** a start gate (Chapter 6) is not met yet */
  gated: boolean;
}

export interface DerivedFlags {
  hasPhone: boolean;
  hasIc: boolean;
  ride: RideState;
  speedMult: number;
  homeTier: 'dorm' | 'ono';
  comfort: number;
  /** the dream picker has been shown (Chapter 1's closing beat is done) */
  dreamUnlocked: boolean;
  realMode: boolean;
}

/** What the HUD may show now (§2.5 progressive disclosure). */
export interface Disclosure {
  dreamChip: boolean;
  dailyGoals: boolean;
  friends: boolean;
  phoneIcon: boolean;
  mapPins: boolean;
  fullLedgerRows: boolean;
  friendsStrip: boolean;
  realMode: boolean;
  /** the compact debrief of the first three conversations */
  compactDebrief: boolean;
}

/** Legacy v1 store data the first-run seed reads (§14.7). */
export interface LegacySeed {
  completed: Record<string, { count: number; best: number }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------------------------

/** Injected by the content tests; @lw/game cannot see content (§14.5). */
export interface ContentIndex {
  scenarios: Record<string, { steps: string[]; intents: string[]; characterId?: string; slots?: string[] }>;
  /** every surface the lexicon resolves */
  lexiconSurfaces: ReadonlySet<string>;
  /** slot id -> option ids */
  slots: Record<string, string[]>;
  characters?: string[];
  lessons?: string[];
}

export type ValidationLevel = 1 | 2 | 3 | 4 | 5;

export interface ValidationIssue {
  /** the first level at which the issue is an error */
  level: ValidationLevel;
  severity: 'error' | 'warn';
  code: string;
  /** JSON-path-like location, e.g. 'chapters[3].objectives[1].pred' */
  path: string;
  message: string;
}
