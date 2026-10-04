# Language World — Game Design (Sakura-chō, Japan pack)

**Status:** authoritative design for the game expansion. It supersedes the three scratch designs (economy, story, learning) that fed it.
**Basis:** repository state on 2026-10-04 (`docs/PLAN.md`, `docs/SAMPLE.md`, plus the uncommitted *foundation refactor* in the working tree: per-feature lexicon/slots/phrasebook/scenario/character registries and per-feature `strings/*` modules).
**Audience:** 35 agent tasks in five sequential slices, at most 9 in parallel inside a slice (§15), then adversarial reviewers.
**Revision:** v2, after adversarial review (exploit, feasibility and motivation lenses). Every issue and its resolution is in the **Review log (§17)**; the reference pace model is `docs/economy-ref-sim.mjs`.
**Rule of this document:** every id, number and string a builder needs is here. Where a number is a tuning knob it is named (`BALANCE.*`) and lives in one file. Prices and Arabic text need a native/price QA pass before any public release (§16).

---

## 0. Decision log (conflicts between the three designs, resolved)

| # | Topic | Decision | One-line rationale |
|---|---|---|---|
| D1 | Where game logic lives | New pure package **`@lw/game`** (depends on `@lw/core` only). Engine keeps only the conversation hooks + turn classification. | One testable owner; no React/Three; reusable per country pack. |
| D2 | Persistence | A **separate zustand store `useGame` with `persist`**, key `lw.game.<packId>.v1`, own `version` + `migrate`. The existing hand-rolled `lw.v1.state` store is **left as is** (vocab, XP, streak, settings). | Zero migration risk for the working sample; disjoint files; honours "zustand persist". |
| D3 | Time model | An integer **`dayIndex`** (number of accepted day rollovers) plus `lastLocalDate`; ledger ids use `d<dayIndex>`. A later local date adds exactly **+1** however large the jump; an earlier date adds 0 and only re-anchors `lastLocalDate`. No "Day n" counter is shown, no Sleep button, no 20-hour windows (§14.5 `observeClock`). | Simpler for kids and seniors, matches the streak, and one wrong-clock event can never pin the game in the future. |
| D4 | Progress spine | **8 story chapters** (Story's arc) gated by **objectives + minimum active days** (Economy's day numbers). | One spine; objectives are verifiable language tasks. |
| D5 | Mastery Points and Rank ladder | **Cut both.** Chapter objectives (words known, independent lines, stars) already measure language. "Rank" shown to the player is derived from the chapter (A1 ch1-2, A2 ch3-6, A2+ ch7-8). | Fewer systems, one source of truth. |
| D6 | Credit per learner turn | Three classes: **I 1.00** (typed/spoken Japanese or romaji in the learner's own words, or a *recalled* prepared line; a thin one-keyword turn earns 0.60), **S 0.35** (tapped suggestion; Hint opened at that node; or typed/spoken text that copies any Japanese the app has shown), **T 0.25** ("say it your way" translation, or a copy of one). Learning's P/H classes cut. | Matches the simulated Economy numbers; needs `mode`, a per-conversation set of shown text and a similarity check (§3.2). |
| D7 | Echo (shadowing an assisted line) | A **separate bonus**: ¥20 per echoed line (max 2 per conversation, ¥100/day) + an SRS card, paid only for a **hidden-line recall** (the Japanese is hidden, the meaning is shown, the learner says or types it at similarity ≥ 0.60; *Peek* keeps the SRS card but forfeits the yen). Not a retroactive re-score. | Keeps pay settlement atomic before the debrief; rewards the best use of help and cannot be farmed by copying the screen. |
| D8 | Conversation pay | Economy's **`settleLoop`** (convex independence factor `F(r)=0.25+0.75r²`, goal factor, clean factor, **`dayFactor` [1, .35, .1, 0]**) plus Learning's *prepared* ×1.10 and *Real mode* ×1.25. The `gapFactor` was **removed** (it penalised daily habits). Story's stipend formula and Learning's composite Q are cut. | Only the Economy formula was balance-simulated; the repeat curve was retuned so the CI ratio is attainable (§4.6). |
| D9 | Stars | Economy's: ★1 goal complete, ★2 `r ≥ 0.60`, ★3 `r ≥ 0.80` + rule-accuracy ≥ 80 + 0 hints + no polite-request corrections. One-time yen ¥200/¥400/¥600. | Simple, explainable, finite pool. |
| D10 | Wallet | `cash` + `ic` (IC card balance) + `points` (P1). Integer yen. Idempotent ledger (last 200 entries) + processed-id set. Balances stored, ledger is the audit log. | IC card is core Japan culture; Learning's derived-balance checkpoint is over-engineered. |
| D11 | Prices | Economy's table (phone ¥24,800, bike ¥19,800 +¥600 registration, used kei car ¥198,000 drive-away). Story's and Learning's differing price lists dropped. | Prices are tied to work-hours of ¥1,150/h so other packs can rescale (§14). |
| D12 | Housing | **One flat**: a room at **Ono-sō**, move-in ¥60,000 (deposit ¥30,000 + first month ¥30,000), no rent afterwards, from **Aiko**. Share-house, 1K, estate agent and Mori-san cut. | Matches the user's "own a flat" goal with one building and one character. |
| D13 | New cast | **Aoi** (Hikari Denki), **Rin** (Fuku-Fuku clothes + second-hand), **Aiko** (tea house, gifts, flat), **Nakamura** (bike + car), plus trip-only **Kato** and scenery **Hina**. Economy's Hayashi, Mori, Takeda, Hanae, Ono-san, Rina and Story's Suzuki are folded in or cut. | 4 shopkeepers instead of 7; three double as friends. |
| D14 | New 3D | New **north-side open-front dioramas** (same `shopFrame` pattern as today): Fuku-Fuku (west gap), Hikari Denki (east gap), Nakamura Motors (east extension). Aiko = the **florist front restyled** as a street stall (south side). Four small door facades. No walk-in shops. | Reuses an existing, proven pattern; south fronts are solid boxes. |
| D15 | Hearts | **5 hearts** (Story) with AP thresholds `[30,80,150,240,350]`. Economy's 10 hearts and Learning's 100-FP hearts cut. | Maps onto an unlock ladder players can read at a glance. |
| D16 | Gift value | `base(price tier) × taste` (blend of Economy and Story): tiers 6/10/15/20 AP, taste love ×2 / like ×1.5 / neutral ×1 / dislike **0** (never negative); capped at 40% of the AP the friend still needs for the next heart; the hand-over must **name the item**; 1 AP-gift per friend per day; gifts must be bought in a conversation. | Price matters a little; cheap spam and a one-word hand-over cannot buy a friendship. |
| D17 | Phone | Buying the phone unlocks **Messages (friend chat) + Map pins** only. Online re-order, QR pay, console, camera cut. | Keeps "first purchase is face to face" and cuts four features. |
| D18 | Jobs | **3 jobs** (konbini Ch2, café Ch3, station Ch5), **5 customers per shift**, a dedicated **Shift screen** with structured tasks (not free conversation), Economy's wage/rank formula with **0.75 paid hours** so a shift pays about what a conversation pays per minute (D41). Ramen job cut. **No timers anywhere.** | Verifiable listening/number tasks; no pressure; accessible. |
| D19 | Daily goals | 3 per day, **¥100 each, +¥150 for all three, streak bonus ¥15 per streak day (max ¥150)**; 10 templates; a goal stays open for **two days** (§7.4). **Weekly goals, study allowance, omamori cut.** | Streak freezes already exist; weekly adds a system without a new behaviour; the two-day window removes daily-login pressure. |
| D20 | Dream goal | **7 dreams** (Story's ladders) mapped onto the Economy catalog. Steps pay **no yen** (the item is the prize); step 2 of every dream pays a small cosmetic milestone (§7.3). Picked in the world at **Chapter 1's closing beat** (a silent default from the onboarding goal until then), not in onboarding. | The user's "own a phone and a bike and a flat" is `fresh_start`; the onboarding file stays untouched; day 1 stays light (§2.5). |
| D21 | Prepare (Phrase Pocket) | **Kept, soft** (skippable; skipping loses the ×1.10). 3-4 pocket lines per scenario authored as data. **No pocket tray in the conversation** and no hard gate. | The pre-teach is the best learning idea; the conversation screen stays as the user likes it. |
| D22 | Difficulty modes | **Guided** (default) and **Real** (chips hidden, +25% yen only, unlocked after Ch1). Learning's "Standard" and the auto-coach EMA reduced to two debrief cards (§11). | One toggle instead of three modes. |
| D23 | Interiors | 4 procedural **stages** (dorm/own flat, Mio, Aiko, Kenji) in slice 5, with a **panel fallback** so the game never depends on them. Yuki's loft is a stretch. | Brief says 3-4 home layouts. |
| D24 | Culture cards | **23** (Story's 20 + `cc_bikereg`, `cc_shaken`, `cc_taxfree`). Quiz-for-yen cut. | Curiosity reward, no extra economy. |
| D25 | Engine seam | One interface `SessionGameHooks` (`vars`, `charge`, `intent`) + `SceneNode.econ/onShort`, `IntentDef.econ/remember`. Per-scenario game wiring lives in **pack data** (`ScenarioMeta`), not on `Scenario`. | Existing 5 scenarios keep working untouched until refit. |
| D26 | Numbers | `yenToJa(n)` emits lexicon tokens (irregular 三百/六百/八百/三千/八千 are entries); `parseJaNumber()` normalises digits/kanji/kana in typed and spoken input. | Prices are dynamic, so numbers are a first-class skill. |
| D27 | Clock tampering | `dayIndex` only ever increases by 1 per observed later date; an earlier date never reopens counters and never pins the clock in the future; one rollover per observed date. Honest play (dead battery, time-zone hop) costs at most one spurious day. | Local single-player: defend against accident, not editing. |
| D28 | Age rule | `ageMin: 18` on the flat and the cars; kids/teens see "someday". Dreams `flat`, `fresh_start`, `car` are not offered to them. | Content-rating decision; confirm with product owner. |
| D29 | Trips | **Panel destinations** (no 3D scene): one destination, Hikarigaoka, via station fare + a short conversation with Kato. | Gives the IC card/fare a purpose without a second district. |
| D30 | Points card, tax-free, negotiation | The points card is a **P1** branch in existing scenarios. Tax-free (免税) is a **learning-only** branch: the resident player is politely refused and no yen change hands (§4.1). Negotiation exists **only** at the car dealer (haggle ≤ min(6% of body price, ¥8,880), assisted gets 40%). | Culture value, small code, no discount exploit. |
| D31 | Streak | Unchanged (`core/progress.ts` freezes). Omamori, welcome-back trio and multi-day bridging cut; a **welcome-back Hanako beat** replaces them. | Fewer systems; no streak shame. |
| D32 | Friend memory | P1: four remembered facts (`hobby`, `favFood`, `purchase:phone`, `dream`) via `IntentDef.remember`. | Makes friends feel real at small cost. |
| D33 | Word tags | Tag registry in **pack data** (`wordTags.ts`), not a new `LexEntry` field. | Avoids touching the lexicon type/tests. |
| D34 | Target-language field name | `Line.ja` stays. A second language pack must rename it to `Line.t`; recorded as known debt (§16). | Not worth a repo-wide rename now. |
| D35 | Balance as a test | `packages/game/test/sim.test.ts` (vitest, run by `npm run economy:sim`) drives persona simulations through the real reducer and asserts the §4.6 windows; `docs/economy-ref-sim.mjs` is the plain-JS reference model those windows come from. | Balance regressions fail the build; no TypeScript-from-.mjs problem. |
| D36 | Unlock timing | A chapter's `opens`/`unlocks`, and every `gate: Cn` in the catalog, take effect when chapter n **becomes current** (chapter n−1 completed; Chapter 1 is current from the start). **Free Walk** is `chapter.n = 9` (Chapter 8 completed). A chapter's *reward* lists only yen, title, culture cards and beats. `validatePack` proves every objective is satisfiable with what is open at its chapter's start (§7.1). | Closes the "the reward unlocks the thing the chapter needs" deadlock. |
| D37 | Independence | The copy rule compares a typed/spoken turn with *everything the app has shown in that conversation* (chips, hint text, translation output, a whole NPC line); opening Hint at a node caps that turn at S; a recalled, production-checked pocket line counts as I (§3.2). | A translation or a hint can never be laundered into class I, while recall (the best learning behaviour) is rewarded. |
| D38 | Money vs story | Chapters open by language objectives. The one *saving* objective on the story path is the phone (c4_1); it is affordable on the day Chapter 4 opens for every simulated persona, and a one-time **catch-up stipend** from Hanako removes any wall after 7 active days (§7.1). | Honest about the one wall instead of claiming there is none. |
| D39 | Disclosure | The first-run HUD and debrief show only what the player can use yet; blocks unlock by chapter (§2.5). | Seniors, kids and nervous beginners. |
| D40 | Easier path | Every objective that needs "your own words" has an `easier` alternative after 3 attempts, and Prepare recall counts as own words. | A learner who leans on help is slowed, not blocked. |
| D41 | Shifts | 0.75 paid hours, tile credit 0.5, accuracy-based objective counting, ≤ 2 shifts a day; shifts are 6-11% of income, never the dominant source (§9, §4.6). | The first design let shifts out-earn conversations 3:1 per minute. |

---

## 1. Vision and pillars

**One line.** Walk a real-feeling Japanese neighbourhood and *live* in it: earn yen by communicating in Japanese, spend yen only by communicating in Japanese, and chase goals you chose (a phone, a bike, a flat, a car, friends who remember you).

**What stays exactly as it is** (the user likes it): the 3D look (toon shading, merged vertex-colour geometry), the walkable street, the conversation screen (bubbles, suggestions, "say it your way", hint, speaker/mic), the Feedback screen skeleton, FSRS vocabulary, EN + Arabic RTL. We extend *around* them (HUD, new screens, new buildings, new characters, new scenario data).

**Pillars**

1. **Language is the only door.** No buy button, no sell, no timers. Yen is earned by language tasks and spent inside conversations; chapters open by language objectives, not by money. The one saving goal on the story path is the phone in Chapter 4, sized to be affordable the day it opens (D38).
2. **Help is free; independence pays.** Tapping a suggestion or asking for a translation always works and never blocks your wallet or the shops, but pays about a third to a quarter of speaking it yourself. A few story objectives ask for lines in your own words; each has a scaffold (Prepare recall counts) and an easier alternative after three tries, so a learner who leans on help is slowed, never trapped (D40).
3. **Goals with a visible next step.** A story spine (8 chapters), a personal dream (7 choices) and three small daily goals, always on the HUD with *both* constraints shown (yen and language).
4. **Friends who remember you.** Hearts grow from conversation quality, fitting gifts and callbacks to what you told them; they unlock phone chat, hang-outs and home visits.
5. **Japan, specifically.** Tax-included prices, *irasshaimase*, the IC card, vending machines, ticket machines, bike registration, shoes off at the genkan, keigo with staff vs casual with friends, no tipping, no haggling (except with the car dealer's drive-away trap).
6. **Kind by construction.** No loot boxes, random rewards, timers, FOMO, streak shaming or loss of money/hearts. Every cap reduces *today's* earnings only.
7. **Typing and tapping are first-class.** Mic and speaker add practice and pay nothing extra; everything is completable without either.

**Player-facing fiction.** You are a language-programme student in **Sakura-chō (桜町)**, a fictional shōtengai neighbourhood. **Hanako-sensei** is your host-teacher and guarantor: she gives your first ¥3,000, a dorm bed and a "stipend" for practice. In one year (compressed to about five weeks for a 15-minute-a-day player) you will write a **Letter Home** in Japanese (Chapter 8), assembled from things you actually did.

---

## 2. Player journey

### 2.1 First 10 minutes (target: first spend and first visible reward before minute 12)

| Min | What happens | Systems touched |
|---|---|---|
| 0-2 | Existing onboarding (language, name, look, level, goal, age, topics). Nothing new. | onboarding unchanged |
| 2-3 | World loads. Hanako's **opening beat** (`b_ch1_open`, 4 short lines): "Welcome… this is your first money, ¥3,000… in a year you will write a letter in Japanese… first, let's do a greeting lesson." The wallet pill appears with **¥3,000**; the HUD shows only the wallet and the tracker (§2.5). She also asks how your name is written in katakana (pre-filled from your name, editable). No Dream picker yet. | beat, wallet, `me.nameKana` |
| 3-4 | HUD tracker shows Chapter 1 objective 1: *Finish Hanako's Greetings lesson* with a map pin (she is 8 m away). Existing lesson plays. | quests, lesson |
| 4-7 | Walk to the konbini. The sheet offers **Prepare** (3 lines: これをください / いくらですか / 袋はいりません; hear + say-or-pick, ~60 s) or Skip. Conversation runs on the unchanged screen; the price the clerk says is the real item price (¥160 onigiri). | prepare, quote/charge hooks |
| 7-9 | **Debrief** (the compact form for the first three conversations, §2.5): stars, **one** pay line with a plain reason (e.g. "your lines +¥…, all steps done, prepared +10%"), a *Keep these* card whose lines have a hidden-line **Say it** echo button, then culture card *cc_irasshaimase*. Wallet ¥3,xxx. | debrief, SRS, culture |
| 9-12 | Tracker points to the café: Prepare + order a coffee (existing `cafe`, 4 steps); the other Chapter 1 objectives (read 4 signs, save 5 words, say 3 new words yourself) tick on the way. Fuku-Fuku and the T-shirt come on day 2 (Chapter 2) so the first run stays light. | prepare, quote/charge hooks |

### 2.2 First day (~30 minutes)

Finish Chapter 1 (5 objectives: lesson, konbini, read 4 signs, save 5 words, say 3 new words yourself) → **¥2,500 chapter reward**, title 新入生, culture cards. Hanako's **closing beat** then asks 「{name}さんの夢(ゆめ)はなんですか？」 and opens the **Dream picker** (7 cards, default from the onboarding goal, "Decide later" allowed); `dream_swap` unlocks. Three **daily goals** appear that evening. The station (IC card ¥500 + first top-up ¥1,000) is the next suggestion; Fuku-Fuku opens with Chapter 2. Typical end-of-day wallet ≈ **¥7,300** after the IC card and top-up (the reference sim's day-1 median is ¥7,200 earned including the ¥2,500 reward, §4.6).

### 2.3 First week

- **Days 1-2 (Chapter 2):** café with ≥ 2 lines of your own, ramen shop (ticket machine panel, いただきます / ごちそうさま said by you), **first konbini shift** (Tanaka offers the job). Fuku-Fuku opens (T-shirt, the first owned item), Aiko's tea house opens (gift shop), and **window shopping** starts at Hikari Denki and Nakamura Motors: their goods sheets show prices read aloud in Japanese, so the phone and the bike are visible goals from day 2.
- **Days 2-7 (Chapter 3):** meet Mio in the park and reach ♥2 (she gives you a **paper note with her number** because you have no phone, and switches to casual speech); a second friend at ♥2; buy and give your first gift. The **dream tracker** shows "Phone ¥24,800: you have ¥X; opens in Chapter 4; ≈ N days at your pace". Streak freeze earned on day 7 (existing mechanic).
- **Around day 7 (casual 15 min/day):** Chapter 4 opens Hikari Denki; the phone is usually bought around day 9 and Chapter 4 completes around day 11 (the chats that finish it need the phone first). Mio texts within the day. This is the moment the loop clicks: language → yen → thing → friends.

### 2.4 Weeks 2-5 (arc)

Chapter 5 opens around day 11 (train trip to Hikarigaoka, the bike, usually owned around day 21); Chapter 6 completes around day 22, after which the flat at Ono-sō is purchasable (affordable around day 35 on the full `fresh_start` path); friends' homes at ♥4, festival speech (Ch7, day 25), Letter Home (Ch8, day 29), then Free Walk (the kei car is a 10-week goal for a casual player). Details: §7. Pacing numbers: §4.6.

---

### 2.5 Progressive disclosure (what the player sees, and when)

One new concept at a time; nothing below is a lock on the *game*, only on what is shown.

| Stage | HUD (max 4 elements on a 360 px screen) | Debrief | Everything else |
|---|---|---|---|
| Chapter 1, until the closing beat | wallet pill + tracker card (+ the existing level/streak chip, merged into one chip) | compact: scores, stars, **one** pay line, *Keep these*, culture card | no Dream chip, no minimap pins beyond the tracker target, no daily goals |
| After the Chapter 1 closing beat | + Dream chip (the picker has just been shown); daily goals appear under Quests → Today | + full ledger rows from the 4th conversation or Chapter 2, whichever is first | Real mode appears on the Prepare screen |
| Chapter 3 | + Friends entry on the menu | + Friends strip (hearts) | gift hand-over, small talk |
| Chapter 4, phone owned | + phone icon with unread badge | — | map pins |
| Any time | `HUD budget`: wallet, tracker, Dream chip, and one of {level/streak chip, phone icon}; the rest sits in the menu | | |

The first Fuku-Fuku visit is the full `fuku_clothes` scenario but from Chapter 2, never on day 1.

## 3. Core loop and scoring model

### 3.1 The loop

```
HUD tracker / next-best goal
   → PREPARE (3-4 pocket lines, ~60 s, skippable)        §11.1
   → WALK to the place (existing 3D world)
   → CONVERSE (existing conversation screen; Guided or Real)
   → DEBRIEF (stars, yen, hearts, "keep these", echo, culture card, next goal)
   → REWARD (yen/XP/hearts/stars/chapter objectives/dream step)
   → next goal
```
A session is one Prepare + one conversation + one debrief (6-12 min), optionally a 3-4 minute shift.

### 3.2 Classifying each learner turn (engine, `engine/scoring.ts`)

The engine keeps, per conversation, a **shown set**: every Japanese string the app has displayed to the learner so far: all suggestion chips offered at every node, the Hint text once it was opened, the Japanese returned by any "say it your way" translation, and each NPC line (whole line only, and only lines with ≥ 4 content tokens: a short repeat-back such as 「右ですね」 is ordinary conversation, not a copy). Strings are compared with `normJa` (NFKC, punctuation and fillers removed, kana folded).

`copyScore(turn, s) = max( 1 − lev(normJa(turn), normJa(s)) / max(len), tokenDice(turn, s) )`, with `tokenDice = 2·|A∩B| / (|A|+|B|)` over lexicon tokens. A turn **copies** `s` when `copyScore ≥ 0.80`. (The first design used 0.90 against visible chips only; one edit on a 9-character chip scores 0.89, so a one-character change escaped the rule.)

| Class | Rule (first match wins) | Credit `c` |
|---|---|---|
| unmatched | the character did not understand (fallback) | not counted (counts as a *fallback*) |
| `T` | `mode === 'assist'` (English/Arabic typed or spoken, then translated), **or** the turn copies a translation output | **0.25** |
| `S` | `mode === 'suggestion'`; **or** Hint was opened at this node before submitting; **or** the turn copies any other shown string (a chip, the hint, an NPC line) and is not a *recalled line* | **0.35** |
| `I` | everything else: `typed_ja`, `typed_romaji`, `speech_ja`, or a recalled line | **1.00** if the turn has ≥ 2 content tokens or `copyScore ≥ 0.50` to the matched intent's `ideal` line; otherwise **0.60** ("thin": a single keyword that happens to complete a step) |

A **recalled line** is a typed or spoken turn that matches a pocket line that is `ready` (production-checked from a hidden line in Prepare within the last 7 days, §11.1) or whose vocabulary card is in FSRS state `Review` with stability ≥ 3, where the learner did not tap a chip or open Hint at that node. It is class I even though a chip with the same words is on screen, because remembering the line is the skill being taught. Hint-then-type, translate-then-type and chip-then-retype are never recalled lines.

A learner turn is **substantive** if it is matched, its `normJa` text was not already said in this conversation, and (it contains ≥ 2 non-grammar tokens **or** it completed a goal step). Substantive turns enter `r`; **only class-I substantive turns** count toward `distinct`, the first-phrase pool, `say_new` and `minIndependent`. Spamming 「はい」 or one phrase therefore adds nothing and costs nothing. Six consecutive unmatched turns end the conversation gently ("try again later"), no payout, no penalty.

`r = Σc / N` over substantive matched turns (0 if none). Mic and keyboard are identical (`speech_ja` = `typed_ja`); the mic never pays extra. Golden tests: translate-then-copy-type pays no more than all-`S`; hint-then-type pays no more than all-`S`; a one-edit copy of a chip is class `S`; a recalled pocket line is class `I`; a one-keyword turn earns 0.60 (`assist-vs-solo`, §15.9).

### 3.3 Conversation pay (`payout.settleLoop`, all constants in `BALANCE`)

```
F(r)        = 0.25 + 0.75·r²
clean       = max(0.6, 1 − 0.08·min(fallbacks,5) − 0.04·min(hintUses,5))
goalFactor  = goalDone===goalTotal ? 1 : 0.5·goalDone/goalTotal      (0 if goalDone=0)
distinct    = min(8, number of distinct intentIds matched by class-I turns)
indepBonus  = 30 · distinct
dayFactor   = [1, 0.35, 0.10, 0][min(n,3)]            n = paid completions of THIS scenario today
prepF       = 1.10 if the scenario's pocket was 'ready' at start (§11.1), else 1
realF       = 1.25 if played in Real mode, else 1
pay         = round5( (base[band]·F(r) + indepBonus) · goalFactor · clean · dayFactor · prepF · realF )
base[band]  = { A1: 1500, A2: 2200, B1: 3000 }      (ScenarioMeta.pay === 'none' ⇒ 0)
```
There is **no `gapFactor`** (removed in v2: it paid a daily-habit player less than someone who skipped days). Only same-day repeats decay. Why `[1, .35, .1, 0]`: four plays of one scenario pay 1.45 of the 4.0 that four *different* scenarios pay (36%); at the seven plays of a 60-minute day the ratio is 21% (§4.6 CI assertion). Reference scale: 1,500 ≈ 11 onigiri; the phone is about 15 full A1 conversations.

Minimum: fewer substantive matched turns than the scenario has goal steps ⇒ pay 0 ("practice only", shown honestly).
`pay: 'none'` scenarios (friend chats, hang-outs, home visits, heart scenes, gift hand-overs, phone chat) pay **hearts, not yen** (§8).

**One-time mastery pay** (lifetime pools; this is what makes replay *rewarding* without grinding):
- **Stars per scenario** (`pay: 'full'` scenarios only): ★1 ¥200, ★2 ¥400, ★3 ¥600 (each paid once, ever; ≈ ¥1,200 per scenario).
- **First independent use of an intent** (`seenIntents`, key `scenarioId:intentId`, only class-I turns that are not copies of shown text): ¥20 each, **¥120/day cap**.
- **Echo bonus** (§11.3): ¥20 per hidden-line echo, max 2 per conversation, ¥100/day.

**Soft cap:** language yen today (loop + stars + first-phrase + echo + shifts) beyond **¥14,000** (a ≥ 90-minute day) pays ×0.25 (UI: "Shops are quiet today — extra practice still counts toward chapters"). Chapter rewards, daily goals and friend perks are outside the cap.

### 3.4 Stars

| Stars | Condition |
|---|---|
| ★ | all goal steps done (any help) |
| ★★ | ★ and `r ≥ 0.60` |
| ★★★ | ★★ and `r ≥ 0.80` and rule-accuracy ≥ 80 and `hintUses = 0` and no `naturalness` correction on a `request` turn |

Stars are best-of per scenario and never decrease. Stars unlock nothing by themselves; they feed objectives (`stars` predicate, Ch8), the car-upgrade gate, and one-time yen.

### 3.5 Worked examples (A1 scenario, 4 goal steps, 6 substantive turns, first play today, base 1,500; `distinct` counts class-I turns only)

| Player | Turn mix | r | F(r) | Pay | vs all-independent |
|---|---|---|---|---|---|
| All typed/spoken | IIIIII | 1.00 | 1.00 | **¥1,680** (1,500 + 30·6) | 100% |
| Mostly own words | IIIISS | 0.78 | 0.71 | ¥1,185 | 71% |
| Half and half | IIISSS | 0.68 | 0.59 | ¥980 | 58% |
| Mostly tapping | IISSSS | 0.57 | 0.49 | ¥795 | 47% |
| All tapped suggestions | SSSSSS | 0.35 | 0.34 | **¥515** | 31% |
| All translated | TTTTTT | 0.25 | 0.30 | ¥445 | 26% |
| All typed, prepared, Real mode | IIIIII | 1.00 | 1.00 | ¥2,310 (×1.10×1.25) | 138% |
| All typed but 2 fallbacks + 2 hints | | | | ¥1,275 (clean 0.76) | |
| Same scenario 4× in one day (IIIISS) | | | | ¥1,185, ¥415, ¥120, ¥0 = ¥1,720, not 4×1,185 | |
| Goal 2 of 4 steps, all typed (goalFactor 0.25) | IIIIII | 1.00 | 1.00 | ¥420 | |
| Translate-then-copy-type, or hint-then-type | (copies shown text) | ≤ 0.35 | ≤ 0.34 | no more than the all-`S` row | |

Echo example: the player tapped 3 suggestions (`S`), then pressed **Say it** on each in the debrief; the Japanese is hidden and the meaning shown, and the player said or typed it ≥ 0.60 similar → +¥40 (the first two lines; max 2 per conversation) and 3 SRS cards. Helped lines are turned into practice, not a loophole; peeking at the text keeps the card and forfeits the yen.

### 3.6 Hearts, XP and the rest of a conversation's outputs

- **XP** (cosmetic, level badge): existing `xpForLoop` unchanged.
- **Hearts** (AP, §8): friend scenes and `smalltalk` with a friend: `5·(goalDone/goalTotal ≥ 0.6) + round(4·share) + callbacks(≤6)`, cap 15 per talk; see §8.3.
- **Chapter objectives** and **dream steps** re-evaluate after every event (§7.1).
- **Culture card** unlocks after the debrief (never mid-conversation).
- **SRS cards** are created from Prepare and from the debrief (§11.5).

---

## 4. Economy

### 4.1 Money, wallet, tax

- **Currency:** JPY, integers, minor unit = 1 yen (`pack.currency = { code:'JPY', symbol:'¥', minorPerMajor:1, spoken:'円' }`). Wallet cap ¥9,999,999. Numerals stay Latin digits in both UI languages (as the existing glosses do); in Arabic layout numeric spans get `dir="ltr"`.
- **Wallet pockets** (`GameState.wallet`): `cash` (everything), `ic` (IC card balance; **cap ¥3,000 until Chapter 5 is current, ¥20,000 after**; loaded in ¥1,000 steps at the station or konbini; spendable at konbini, café, vending machines and the station only; **refundable** at the station: 払い戻し returns the balance as cash less a ¥220 handling fee, §5.4), `points` (P1; "Sakura Points", 1 point = ¥1, issued once by the konbini clerk, earn `floor(total·1%)`, daily earn cap ¥300, redeemable only where earned: konbini, Hikari Denki, Fuku-Fuku).
- **Start:** ¥3,000 cash (Hanako's opening beat). The IC deposit ¥500 is not refundable (the card stays yours); only its balance is.
- **What counts as "money".** `wallet atLeast`, the dream yen bar, `earn_total` and `totals` count **cash only**. IC top-ups and refunds are **transfers** (ledger kinds `topup`, `refund`: cash ↔ ic): they never touch `totals.earned/spent`, so loading the card can neither hide nor strand progress (the refund exists so a mistaken ¥20,000 top-up is not lost).
- **Price display:** every price is tax-included (税込) and shows a **work-hours chip** `≈ 21.6 h of work` for prices over ¥2,000 (price ÷ reference wage ¥1,150). This is the universal affordability yardstick and the rule that keeps other packs honest (§14.6).
- **Tax rules** (data in `pack.tax`): take-out food 8%, eat-in 10% (konbini eat-in corner and café): `eatIn = round(price / 1.08 · 1.10)` (¥450 → ¥458). Everything else 10%. **Tax-free (免税) is a learning-only branch** (P1): at Hikari Denki, Fuku-Fuku and Aiko's a learner who asks 「免税できますか？」 hears 「申し訳ありません、免税の対象外です。」 (*I'm sorry, you are not eligible for tax exemption*): the resident player is never eligible, so there is **no yen effect**, no profile flag and nothing to farm; the card `cc_taxfree` explains the visitor scheme. (Japan is changing the scheme, §16.2; packs for tourists can use `TaxRegime.touristRefund`.)
- **No selling, no refunds, no returns** (stated once in `cc_refuse`/`cc_taxfree`); no rent, hunger, energy, inflation, taxes on income, sales or time-limited offers.
- **Ledger:** every payout or charge is one `LedgerEntry { id, at, kind, delta, pocket, ref?, note? }` applied by a single pure reducer keyed by `id` (idempotent). `kind`: `loop | shift | goal | streak | chapter | star | phrase | echo | purchase | fare | topup | refund | gift | perk`. Ring buffer of the last 200 entries plus an id set of the last 300 processed ids, **and** `totals.earned/spent` with a running `checksum` per pocket (the sum of every delta ever applied). Balances are stored; the reconcile test asserts `cash + ic + points = startCash + totals.earned − totals.spent` against `totals` and `checksum`, never against the 200-entry ring.

### 4.2 Income (everything pays through §3.3, §7.4, §9, §7.2)

| Source | Formula lives in | Casual 15 min/day, share of days 1-30 |
|---|---|---|
| Conversations (loop pay) | §3.3 | 29% |
| Mastery pools (stars, first phrase, echo) | §3.3 | 11% |
| Shifts | §9 | 6% |
| Daily goals + streak | §7.4 | 16% (max ¥600 per day) |
| Chapter rewards | §7.2 | 38% (¥41,000 in total, paid once; the casual persona finishes Ch8 on day 29) |
| Friend perks (one-time scholarship etc.) | §8.9 | < 1% |

First-30-day income for the casual persona ≈ ¥107,000 (≈ ¥3,600/day); the other personas are in §4.6. Chapter rewards are one-time, so the **steady state** after day 30 is ≈ ¥3,800/day for the casual persona, of which **language yen is ≈ 85%** (¥3,200 against ≈ ¥600 for goals): independence matters most exactly when the player has chosen a long goal. Shifts stay at or under 15% of income for every persona (CI, §4.6).

### 4.3 Sinks

| Sink | Size | Why |
|---|---|---|
| Catalog (one-time things) | ¥1,211,910 total; ¥446,910 without the three premium items; ¥248,910 without premium + cars | aspiration and goals |
| Food and drink practice | ¥110-1,050 per item | the cost of practising in shops; cheap beside a conversation's pay (¥515-1,680) but a real choice for a nearly empty wallet |
| Fares + IC top-ups | ¥170-520 per trip; optional | numbers practice, not mandatory |
| Gifts | ¥160-3,300 each | the social sink and the motivation for hearts |
| Delivery ¥2,200, registration ¥600 | per purchase | culture-accurate friction |
| Lantern fund (`svc_lantern`, Aiko, ¥500 per lantern, unlimited, cosmetic: a named lantern on the festival strings and a counter in Free Walk) | repeatable | the one sink that never runs out; stays out of progression |
| Premium: `phone_pro` ¥128,000, `ebike` ¥89,000, `car_kei_good` ¥548,000 | far end | after these the catalog is done; the wallet then serves gifts and the lantern fund, and motivation shifts to ★3, hearts and new packs |

### 4.4 Spending rules

1. **Atomic purchase.** `charge` checks funds inside the reducer, writes inventory + ledger (`purchase:<sessionId>:<n>`), then the clerk says ありがとうございました. Leaving before `charge` costs nothing and earns nothing. Purchases made before abandoning stay; the loop pay does not (it commits only at the end node).
2. **Discount order**, each at most once per basket: friend perk → points redeemed → negotiation. **Routine discounts** (friend shop perks plus haggle) total at most **8% of body price** and friend shop perks are capped at ¥300/day. Points redemption is outside the cap (it is the player's own money back). **One-time heart perks** (§8.9: Aiko's −¥10,000 on the flat, Nakamura's −¥8,000 on a car, Hanako's ¥3,000 scholarship) are **exempt** from the 8% rule, apply once, and show on the receipt as `perk`. No discount ever depends on an onboarding choice or the profile goal.
3. **Negotiation** only at `motors_car`: `ask_total` is a listening trap (the dealer quotes the body price ¥148,000; the learner must ask for the 乗り出し価格 ¥198,000); `haggle` takes **min(6% of body price, ¥8,880)** off for an independent polite request (¥8,880 on both cars), 40% of that (¥3,552) if assisted. A haggle result is **per conversation and never stored**: walking away (「考えます」) discards it and the next visit starts at the list price; one attempt per item per day. Floor price of the used car with every discount: 198,000 − 8,880 (haggle) − 8,000 (Nakamura ♥5 perk) = **¥181,120**. Everywhere else the staff says 「定価です」 (fixed price), a culture lesson.
4. **Quantity:** ≤ 3 of a consumable per transaction; non-consumables are `once` (a second purchase: 「もう持っています」).
5. **Bulky goods** (futon, desk, bookshelf, kotatsu, TV) need **delivery ¥2,200** (one fee per purchase); small goods are `お持ち帰り`.
6. **Short of money** is a *scripted branch* (`SceneNode.onShort`), never an error: 「ちょっと足りないです…」 / clerk 「お客様、少し足りません」; the learner may pick a cheaper item or say 「また来ます。」 (taught polite refusal, `cc_refuse`). No penalty.
7. **Under 18:** `home_room_ono` and `car_*` are "someday" (listed, locked, no purchase).

### 4.5 Progression table (chapter gates open places, jobs and items *when the chapter becomes current*)

**Gate semantics (D36).** `Cn` anywhere in this document means *chapter n is current or later* (`chapter.n ≥ n`). `chapter.n = n` from the moment chapter n−1 is completed (Chapter 1 from the start); `chapter.n = 9` is **Free Walk** (`FW`, Chapter 8 completed). A chapter's **Opens** column takes effect at its **start**, so its own objectives can use it. The "Reward" lines of §7.2 list only yen, title, culture cards and beats (and *announce* what is already open). `validatePack` computes, for every objective of chapter n, the places, jobs, items, features and scenarios it needs, and fails unless every one has gate ≤ n.

`min days` = minimum number of *active days* (days with ≥ 1 meaningful action) before the chapter can complete. Objectives are in §7.2.

| Ch | Title | min days | Reward ¥ | Opens at the chapter's start (places / features) | Items open | Jobs |
|---|---|---|---|---|---|---|
| 1 | はじめまして First Hello | 1 | 2,500 | konbini, café, station (tickets, IC), vending machines, gift items at the konbini, culture cards, Prepare; the Dream picker appears at the closing beat | `ic_card`, all menu food | none |
| 2 | いらっしゃいませ Welcome! | 2 | 2,500 | ramen shop, **Fuku-Fuku** (basic outfits), **Aiko's tea house** (gifts), shifts, **window shopping** (goods sheets only) at Hikari Denki, Nakamura Motors and Ono-sō | `tee_basic`, `cap`, `hoodie`, `g_*` at Aiko's | `job_konbini` |
| 3 | ともだち First Friend | 4 | 3,000 | Friends screen, gift hand-over, small talk, Rin/Aiko/Nakamura hearts | `jeans`, `sneakers` | `job_cafe` |
| 4 | つながる Stay Connected | 7 | 4,000 | **Hikari Denki** counter service (Messages and Map pins unlock when the phone is *owned*) | `phone_used`, `phone_case`, `jacket_winter`, `yukata`, `g_music_cd` | |
| 5 | でかけよう Let's Go Out | 10 | 5,000 | **Nakamura Motors** (bikes), train trip to Hikarigaoka, Fuku-Fuku home goods, IC cap ¥20,000 | `bike_mamachari`, `bike_helmet`, `glasses_round`, `backpack`, `futon_set`, `desk_study`, `bookshelf`, `plant_pothos` | `job_station` |
| 6 | おじゃまします Visiting Homes | 14 | 6,000 | friend homes (♥4), **Ono-sō room**, `aiko_viewing`/`aiko_contract` | `home_room_ono`, `suit_set`, `kotatsu`, `rice_cooker`, `paper_lamp`, `tv_small` | |
| 7 | お祭り Festival | 19 | 8,000 | festival dressing, `matsuri_*`, car browse (`motors_car` shows body price only) | `ebike`, `phone_pro` | |
| 8 | 手紙 Letter Home | 25 | 10,000 | Letter Home | | |
| FW | Free Walk (`chapter.n = 9`) | n/a | n/a | everything stays open, daily goals continue, the `car` dream | `car_kei_used`, `car_kei_good` (also needs 6 scenarios ≥ ★★) | |

Chapter reward total **¥41,000**. A chapter completes on the day its last requirement is met (one completion per day maximum); the day gate (`minDays`) only delays *completion*, never what is open.

**Catch-up (Chapter 4 only).** If, after 7 active days in Chapter 4, every objective that does not need the phone (c4_4) is done and the player is still short of `phone_used`, Hanako gives a one-time stipend equal to the shortfall (max ¥12,000; ledger kind `perk`, beat `b_phone_fund`: 「学校(がっこう)から少(すこ)しだけ。がんばっていますね。」 *A little from the school. You've been working hard.* «قليل من المدرسة. تبذل جهدًا.»). It is the only yen the story ever hands over beyond chapter rewards, and it makes the one saving goal impossible to get stuck on.

### 4.6 Pace simulation (design check; re-asserted in CI)

Reference implementation: `docs/economy-ref-sim.mjs` (plain JS, seeded, `node docs/economy-ref-sim.mjs` prints every number below). Agent 1F ports it to `packages/game/test/sim.test.ts`, which drives the **real reducer** with the same personas; `npm run economy:sim` runs that test. v2 differs from the first model in four ways: chapters complete **event-driven** (the day the last requirement lands, one per day), a conversation costs its honest 6-8 minutes, shifts are scaled to conversation parity (D41), and gates use the §4.5 semantics (the first model released items when a chapter *completed*, which hid every money wall).

- **Skill** `p` (share of lines said independently or recalled) rises `0.15 → 0.87` as `p = 0.15 + 0.72(1 − e^(−minutes/300))`, `r = p + 0.35(1 − p)`. Tap-leaning: `p` 0.10 → 0.40, no echo, 1.3× objective sessions, easier alternatives and Prepare recall assumed.
- **A day** has `M` minutes (first day: casual 30, serious 40, light 15, grinder 90), 2 of them review. An objective conversation costs 6 min (A1) or 8 min (A2, Ch4+) including Prepare and debrief; a friend talk 3 min (+12 AP, +gift AP, ¥300); a phone chat 1.5 min (+4 AP); a shift 4 min. While a chapter still needs hearts the order is *talk, chat, objective conversation, shift*; otherwise *objective conversation, chat, talk, shift, free conversation*; after Chapter 8, *free conversation, talk, chat, shift*. Light plays 10 minutes on five days a week.
- **Requirements per chapter** (objective conversations, shifts, hearts, phone owned, chats from two friends, `minDays`) are the `CH` table in the reference file, derived from §7.2. Chats need the phone first, one thread per friend per day and friends at ♥2, so Chapter 4 completes at least a day after the phone.
- **Money:** §3.3 pay, one-time pools, §7.4 goals every active day, shifts §9, chapter rewards §4.5; practice spending ≈ ¥450 on half of the conversations; each dream is evaluated on a shadow wallet that buys only its own items.

Results (41 seeded runs, medians):

| Persona | Chapter completion day (Ch1…Ch8) | First-30-day income per day |
|---|---|---|
| Casual 15 min/day | 1, 2, 7, 11, 13, 22, 25, **29** | ¥3,600 |
| Light, 10 min on 5 days a week | 2, 6, 19, 23, 27, 58, 62, 68 | ¥1,450 |
| Serious 30 min/day | 1, 2, 4, 7, 10, 14, 19, **25** | ¥7,200 |
| Grinder 90 min/day | 1, 2, 4, 7, 10, 14, 19, **25** (the day gate binds) | ¥18,000 |
| Tap-leaning (p ≤ 0.4, Prepare recall, easier alternatives) | 1, 3, 8, 10, 13, 25, 29, **35** | ¥3,000 |

The casual player finishes Chapter 1 on day 1 (the ¥2,500 reward lands that evening), Chapter 3 on day 7 (so Chapter 4 opens and the phone becomes buyable that day), buys the phone on day 9 and completes Chapter 4 on day 11 (the four chats need the phone and a second ♥2 friend, which Chapter 3's objective c3_4 guarantees).

**First day on which each dream is affordable *and* unlocked** (the dream's own items only; remaining cost: phone ¥24,800, bike ¥19,800 + ¥600 registration, helmet ¥2,980, flat ¥60,000 move-in, three cheapest small goods ¥6,700 with no delivery, kei car ¥198,000 before perks):

| Dream | Light | **Casual** | Serious | Grinder | Tap-leaning |
|---|---|---|---|---|---|
| Phone | 20 | **9** | 5 | 4 | 9 |
| Phone + bike + helmet | 39 | **21** | 10 | 7 | 19 |
| `fresh_start`: phone, bike, flat, 3 goods | 74 | **35** | 21 | 10 | 40 |
| Phone + kei car (gate `FW`) | 123 | **72** | 35 | 25 | 110 |

Reading: for a 15-minute player the phone is about 1.3 weeks away, the bike 3 weeks, the flat 5 weeks and the kei car 10 weeks; a 30-minute player has the flat in 3 weeks. The grinder earns 5× the casual player, not 6×, and cannot own the car before day 25 because the car is gated on **Chapter 8 completed** (`FW`) and Chapter 8 has `minDays 25`; the first model contradicted this (it let a grinder with the cash buy the car on day 19). Tap-leaning players are never blocked by money (every item within 1.6× of the casual date) but are slower where objectives ask for their own words (Chapter 8 on day 35, not 29). A persona that *never* produces a line of its own is blocked at c1_5 by design, and the game says so honestly ("Try Prepare: say the lines from memory"). **Money and the story:** every persona can afford the phone within 3 days of Chapter 4 becoming current (casual: 2 days, light: 1). Remove the daily chest and the casual player waits 11 extra days for Chapter 4, which is why the catch-up stipend (§4.5) exists.

**CI assertions** (`packages/game/test/sim.test.ts`; windows are the model's medians ± a margin and are re-baselined deliberately, never silently):
- casual: Ch1 completes on day 1; phone owned ∈ [d7, d12] and Chapter 4 completes ≥ phone day + 1; phone + bike ∈ [d17, d25]; `fresh_start` ∈ [d30, d42]; phone + car ∈ [d60, d85]; Ch8 ∈ [d26, d33].
- light: Ch8 ≤ d80; tap-leaning: Ch8 ≤ casual + 10 days and every dream item ≤ 1.6× the casual date.
- grinder: car ≥ d25 (the `FW` gate); every persona buys the phone within 3 days of Chapter 4 opening; no wallet < 0; language yen per day ≤ 1.10 × soft cap.
- **Ratios** (60 min/day personas that play like the diversified persona until Chapter 8, then: repeat one scenario all day, or work shifts only): language yen on days 31-60 of the *repeat-one* persona ≤ 25% of the diversified one (measured 21%; four plays of one scenario alone would be 36%, seven plays 21%); the *shift-only* persona ≤ 20% (measured 11%); shifts ≤ 15% of the first-30-day income of every persona (measured 6-11%).
- tap-leaning and casual both finish Chapter 3 with two friends at ♥2, so the phone chats of Chapter 4 never wait on a friend.

Light players (10 minutes, five days a week) take 68 days, bound by objective workload rather than yen (chapter pacing is the knob, §16 R2). The `work` assumption (objective conversations per chapter) remains the weakest number.

### 4.7 Balance knobs (single file `packages/game/src/balance.ts`)

`BALANCE = { credit:{I:1,thinI:0.6,S:0.35,T:0.25}, copyScore:0.80, thinTokens:2, indep:{floor:0.25,span:0.75}, base:{A1:1500,A2:2200,B1:3000}, indepBonusPer:30, distinctMax:8, dayFactor:[1,.35,.1,0], prepF:1.10, readyDays:7, realF:1.25, clean:{fb:.08,hint:.04,floor:.6}, stars:{1:200,2:400,3:600}, firstPhrase:{pay:20,cap:120}, echo:{pay:20,perConv:2,cap:100}, softCap:14000, softCapFactor:.25, goals:{each:100,all:150,streakPer:15,streakMax:150,windowDays:2}, shift:{hours:0.75, rankMult:[1,1.08,1.16,1.24,1.32], promoteAt:[3,6,10,15], accuracy:0.6, trial:100, tile:0.5, chip:0.35, repeat:[1,.6,0], sameJobRepeat:[1,.5,0]}, ap:{caps…, giftCapFrac:0.4, giftNoTalk:0.5}, haggle:{pct:0.06, max:8880, assisted:0.4}, routineDiscountMax:0.08, catchUp:{afterActiveDays:7, max:12000}, startCash:3000, icCap:{early:3000, late:20000}, icRefundFee:220, walletCap:9999999 }`.
Sensitivity (reference sim, casual persona): +10% `base` ≈ −1 day to the flat and −5 days to the car; +10% shift wage ≈ −0.5 day; removing the daily chest ≈ +9 days to the flat and delays Chapter 4 by 11 days (the phone becomes a wall); raising chapter `min days` moves unlock dates only, not income.

---

## 5. Item catalog

Prices are tax-included (税込), approximate 2026 Japanese retail, to be price-QA'd. `once` = single ownership. Gate: `C#` = chapter # is **current or later** (§4.5, D36); `FW` = Free Walk (Chapter 8 completed). `18+` = hidden for kids/teens ("someday"). Readings in parentheses are kana for kanji forms; katakana words need none. Every item is bought through a conversation: sale routes in §5.6.

### 5.1 Menu (consumables; unlimited; slot option ids are the **existing** `item`/`flavor`/`place` slot ids so existing scenarios plug in)

| Shop | Slot option → price ¥ | New words (JA / EN / AR) |
|---|---|---|
| Konbini (Tanaka) | `onigiri` 160 · `water` 110 · `sandwich` 320 · `bento` 580 · `juice` 160 · `milk` 150 · `greenTea` 160 · `cake` 330 · `coffee` 130 (cup) | — (all exist) |
| Café (Yuki) | `coffee` 450 · `blackTea` 420 · `greenTea` 400 · `latte` 520 · `juice` 480 · `cake` 480 | — |
| Ramen (Kenji) | `shoyu` 900 · `miso` 950 · `tonkotsu` 1,050 · extras: 味玉 (あじたま) 150 · 大盛 (おおもり) 100 · 替え玉 (かえだま) 120 · 餃子 (ぎょうざ, 6) 380 | 味玉 / seasoned egg / بيضة متبّلة · 大盛 / large portion / حصة كبيرة · 替え玉 / extra noodles / نودلز إضافية · 餃子 / gyoza / جيوزا (فطائر محشوة) |
| Vending (4 machines) | `v_tea` お茶 150 · `v_coffee` 缶コーヒー (かんコーヒー) 150 · `v_water` 水 130 · `v_juice` ジュース 150 (each hot あたたかい / cold つめたい where it applies) | 缶コーヒー / canned coffee / قهوة معلّبة |
| Station | fares (§5.4), `ic_card` 500, top-up ¥1,000 steps | — |

Eat-in surcharge (konbini eat-in corner, café) per §4.1. Practice-spending average ≈ ¥450.

### 5.2 Catalog (things you own)

Columns: id · EN · JA (reading) · AR · ¥ · shop · effect · gate. `ava` = avatar patch (§5.5). `home(slot,c)` = home slot with comfort `c`.

| id | EN | JA (reading) | AR | ¥ | Shop | Effect | Gate |
|---|---|---|---|---|---|---|---|
| `ic_card` | IC card (¥500 deposit; load it separately) | ICカード (アイシーカード) | بطاقة IC للمواصلات (وديعة 500 ين) | 500 | station | feature `ic`: tap to ride and pay; balance cap ¥20,000; skips the ticket-machine step | C1 |
| `tee_basic` | T-shirt | Tシャツ | قميص تي شيرت | 1,990 | fukufuku | `ava` top, 6 free colours | C2 |
| `cap` | Baseball cap | 帽子 (ぼうし) | قبعة بيسبول | 2,490 | fukufuku | `ava` head `cap` | C2 |
| `hoodie` | Hoodie | パーカー | هودي (سترة بقلنسوة) | 4,990 | fukufuku | `ava` top, 6 colours | C2 |
| `jeans` | Jeans | ジーンズ | بنطال جينز | 5,990 | fukufuku | `ava` bottom | C3 |
| `sneakers` | Sneakers | スニーカー | حذاء رياضي | 7,990 | fukufuku | `ava` shoes, colour | C3 |
| `jacket_winter` | Winter down jacket + scarf | ダウンジャケット | سترة شتوية منفوخة مع وشاح | 12,900 | fukufuku | `ava` top + `scarf` | C4 |
| `yukata` | Summer festival yukata | 浴衣 (ゆかた) | يوكاتا (كيمونو صيفي خفيف) | 8,900 | fukufuku | `ava` outfit top+bottom; dream `festival` | C4 |
| `glasses_round` | Glasses | メガネ | نظارات | 9,900 | fukufuku | `ava` face `glasses` | C5 |
| `backpack` | Backpack | リュック | حقيبة ظهر | 6,900 | fukufuku | `ava` back `backpack`; konbini asks "bag?" less | C5 |
| `suit_set` | Business suit + tie | スーツ | بدلة رسمية مع ربطة عنق | 19,800 | fukufuku | `ava` top+bottom+`tie`; unlocks the formal-register line at Motors | C6 |
| `phone_used` | Refurbished smartphone | 中古スマホ (ちゅうこスマホ) | هاتف ذكي مجدّد | 24,800 | denki | feature `phone` (Messages, Map pins) | C4 |
| `phone_case` | Phone case | スマホケース | غلاف الهاتف | 1,980 | denki | cosmetic, colour pick | C4 |
| `phone_pro` | Latest flagship phone | 最新スマホ (さいしんスマホ) | أحدث هاتف رائد | 128,000 | denki | cosmetic gold frame on the HUD phone icon; Tanaka/Aoi boast hooks; 2% points | C7 |
| `tv_small` | 32-inch TV | テレビ | تلفزيون 32 بوصة | 24,800 | denki | `home(tv,2)`, bulky; "watch Japanese TV" listening snippet | C6 |
| `bike_mamachari` | Everyday bicycle (+¥600 registration) | ママチャリ | دراجة يومية (ماماتشاري) | 19,800 | motors | ride ×1.5 on streets, bike appears beside you; step 防犯登録 (name in katakana + address) | C5 |
| `bike_helmet` | Bicycle helmet | ヘルメット | خوذة الدراجة | 2,980 | motors | `ava` head `helmet`; required for the e-bike | C5 |
| `ebike` | Power-assist bicycle | 電動アシスト自転車 (でんどうアシストじてんしゃ) | دراجة كهربائية مساعدة | 89,000 | motors | ride ×1.8; replaces the bike mesh; needs the helmet | C7 |
| `car_kei_used` | Used kei car (drive-away price) | 中古の軽自動車 (ちゅうこのけいじどうしゃ) | سيارة كي مستعملة (السعر النهائي) | 198,000 (body 148,000 + fees 50,000) | motors | ride ×2.5; car parked at the east end; 18+ | FW |
| `car_kei_good` | Low-mileage kei car | 低走行の軽自動車 (ていそうこうのけいじどうしゃ) | سيارة كي قليلة المسافة | 548,000 (body 458,000 + fees 90,000) | motors | replaces the used car, colour pick, title; 18+ | FW + 6 scenarios ★★ |
| `home_room_ono` | Room at Ono-sō (move-in costs) | 小野荘の部屋 (おのそうのへや) | غرفة في عمارة أونو (تكاليف الانتقال) | 60,000 (deposit 敷金 30,000 + first month 30,000) | aiko | `homeTier: 'ono'`: 6-jō tatami room with 8 furniture slots; no rent afterwards; 18+ | C6 |
| `futon_set` | Futon set | 布団セット (ふとんセット) | طقم فوتون (فراش ياباني) | 8,000 | fukufuku | `home(bed,2)`, bulky | C5 |
| `desk_study` | Study desk | 勉強机 (べんきょうづくえ) | مكتب للدراسة | 6,000 | fukufuku | `home(desk,2)`, bulky; shows your saved-words wall | C5 |
| `bookshelf` | Bookshelf | 本棚 (ほんだな) | رف كتب | 4,500 | fukufuku | `home(shelf,1)`, bulky; displays gifts you received | C5 |
| `plant_pothos` | Pothos plant | 観葉植物 (かんようしょくぶつ) | نبتة زينة | 1,200 | fukufuku | `home(plant,1)` | C5 |
| `kotatsu` | Kotatsu table | こたつ | كوتاتسو (طاولة تدفئة) | 7,000 | fukufuku | `home(table,3)`, bulky; friend-visit hangout ×1.5 AP | C6 |
| `rice_cooker` | Rice cooker | 炊飯器 (すいはんき) | جهاز طهي الأرز | 3,500 | fukufuku | `home(kitchen,1)`; enables the Kenji/Aiko "cook together" line | C6 |
| `paper_lamp` | Paper lantern lamp | 和風ランプ (わふうランプ) | مصباح ورقي ياباني | 2,000 | fukufuku | `home(light,1)` | C6 |

Total of the 28 rows above: **¥1,211,910** (computed; asserted in `economy.test.ts`).

### 5.3 Gift items (sold in shops; any consumable food is also giftable)

| id | EN | JA (reading) | AR | ¥ | Shop | Tags |
|---|---|---|---|---|---|---|
| `g_choco` | Chocolate | チョコレート | شوكولاتة | 220 | konbini | sweet, snack |
| `g_manga` | Manga volume | マンガ（1巻） (いっかん) | مجلد مانغا واحد | 680 | konbini | media, anime |
| `g_game_card` | Game card | ゲームカード | بطاقة ألعاب | 1,000 | konbini | game, tech |
| `g_flower` | Small bouquet | 花束 (はなたば) | باقة زهور صغيرة | 1,500 | aiko | flower, nature |
| `g_wagashi` | Wagashi assortment | 和菓子の詰め合わせ (わがしのつめあわせ) | علبة حلويات يابانية (واغاشي) | 1,280 | aiko | sweet, tradition |
| `g_tea_set` | Tea set | お茶セット | طقم شاي | 1,500 | aiko | tea, tradition |
| `g_tenugui` | Tenugui hand towel | 手ぬぐい (てぬぐい) | منشفة تينوغوي | 1,100 | aiko | craft, tradition |
| `g_plush` | Plush toy | ぬいぐるみ | دمية محشوة | 800 | fukufuku | cute |
| `g_guitar_pick` | Guitar pick | ギターピック | ريشة غيتار | 300 | fukufuku | music |
| `g_music_cd` | Music CD | 音楽CD (おんがくシーディー) | أسطوانة موسيقى | 3,300 | denki | music |
| `g_carfresh` | Car air freshener | 車の芳香剤 (くるまのほうこうざい) | معطّر سيارة | 500 | motors | cars |
| `g_souvenir` | Souvenir (omiyage) | おみやげ | هدية تذكارية (أوميياغي) | 1,000 | trip only (Kato) | travel, sweet |

Food gifts reuse **konbini and café menu items bought in a conversation**, by tag: `onigiri` (food, snack), `cake` (sweet), `coffee` (drink, coffee), `bento` (food, meal), `greenTea` (drink, tea). **Vending-machine drinks are not giftable** (a panel purchase is not a conversation); every gift is bought by talking (§5.6). Gift tastes and AP: §8.5.

### 5.4 Services, fares, fees

- **IC fares from Sakura-chō station** (keyed by existing `place` slot options): `shibuya` 170 · `shinjuku` 190 (the sample's 百九十円) · `tokyoStation` 210 · `akihabara` 210 · `ueno` 230 · `asakusa` 260 · `airport` 520 (relabelled **Haneda Airport**) · new `hikarigaoka` 170 (fictional, trip target). A **paper ticket costs ¥10 more** than the IC fare (a simplification of the real rounding of paper fares to 10 yen; `cc_ic`). Sato's friend perk −10% (floor ¥10). **A trip's fare is charged both ways up front** (`TripPanel`, §6.5): the player needs cash or IC for 2 × the fare, so the return is prepaid and nobody is stranded or goes negative.
- **IC top-up:** ¥1,000 / 2,000 / 3,000 / 5,000 (slot `chargeAmount`), at the station or konbini; cap **¥3,000 until Chapter 5, then ¥20,000**. **Refund** (払い戻し, a real service) at the station returns the balance as cash less a ¥220 handling fee (needs a balance above ¥220); the card itself stays. Top-ups and refunds are transfers (§4.1).
- **Delivery** ¥2,200 (bulky); **bike registration** ¥600 (`防犯登録`, form step); **eat-in** surcharge per §4.1; **lantern fund** ¥500 per lantern at Aiko's (cosmetic, repeatable).
- **Move-in at Ono-sō:** 敷金 ¥30,000 + 前家賃 ¥30,000 = ¥60,000, no key money, no agent fee, no guarantor (Aiko is your guarantor); `cc_rent` explains the real-world extras.
- **Car:** body price vs 乗り出し価格 (drive-away) is the lesson; 車庫証明 (parking certificate, needed in many areas even for kei cars) is explained in `cc_shaken`.

### 5.5 Avatar patches (the world's `setPlayerSpec(spec)` already exists)

`AvatarSpec` fields: `skin, hair, top, bottom, shoes, accent, accessories[], height, stocky`. Existing accessories used: `cap`, `scarf`, `backpack`, `glasses`, `tie`, `beanie`. Mapping (the colour is a free pick from `JACKETS` for tops, `['#2f3a57','#5a6b8c','#3a3f50','#8a6f4a']` for bottoms, `['#ffffff','#2b2b36','#d8433f','#4f86f7']` for shoes):

| Item | Patch |
|---|---|
| `tee_basic`, `hoodie` | `top = colour` (hoodie also `accent = colour lightened`) |
| `jeans` | `bottom = '#35507a'` (colour pick) |
| `sneakers` | `shoes = colour` |
| `cap` | `accessories += 'cap'` |
| `jacket_winter` | `top = '#2f5ea8'`, `accessories += 'scarf'` |
| `yukata` | `top = bottom = '#3b4a8a'`, `accent = '#f4f4f4'`, shoes `'#8a5a3a'` |
| `glasses_round` | `accessories += 'glasses'` |
| `backpack` | `accessories += 'backpack'` |
| `suit_set` | `top = '#2b2f3a'`, `bottom = '#2b2f3a'`, `accessories += 'tie'` |
| `bike_helmet` | new accessory `helmet` (world adds a small dome mesh); falls back to `cap` look if absent |
| bike/car | `world.setRide(kind)` (kind: none, bike, ebike or car) mounts a prop and sets `world.setMoveMultiplier(1/1.5/1.8/2.5)` |

The wardrobe screen (`Wallet.tsx`) lets the player equip/unequip owned pieces; equipped state persists in `GameState.outfit` and is applied with `setPlayerSpec` on the world screen mount and on every change.

### 5.6 How every item is bought (sale routes)

Money is spent only in conversations, so every catalog, menu and gift item must be an option of a slot that a shop scenario accepts and must appear in that scenario's `ScenarioMeta.shop.itemMap`. `validatePack` (level 3) fails if any `ItemDef` or menu id has no route. Shop scenarios that sell goods besides their main item get a **`goods` node** (step `goods`, never a goal step): the intent `ask_goods` (「プレゼントを探しています」, 「ほかに何がありますか」) leads to a node where the learner picks from the shared slot `giftItem` (defined once in `slots/shop.ts`; each intent restricts the accepted options with `opts`).

| Shop (scenario) | Slot → options | Items |
|---|---|---|
| Konbini `konbini` | `item` (9 foods); `giftItem`: `choco`, `manga`, `gameCard` | menu; `g_choco`, `g_manga`, `g_game_card` |
| Café `cafe` | `item` (6) | menu |
| Ramen `ramen` + ticket panel | `flavor`, `ramenExtra` | menu, extras |
| Station `station_ic` | `chargeAmount`; intents `buy_card`, `refund` | `ic_card`, top-ups, refund |
| Hikari Denki `denki_phone` | `denkiItem`: `used`, `pro`, `case`, `tv`; `giftItem`: `musicCd` | `phone_used`, `phone_pro`, `phone_case`, `tv_small`, `g_music_cd` |
| Fuku-Fuku `fuku_clothes` | `clothes` (the 10 clothing items); `giftItem`: `plush`, `guitarPick` | clothing; `g_plush`, `g_guitar_pick` |
| Fuku-Fuku `fuku_home` | `furniture` (7 pieces) | `futon_set`, `desk_study`, `bookshelf`, `plant_pothos`, `kotatsu`, `rice_cooker`, `paper_lamp` |
| Aiko `aiko_tea` | `giftItem`: `flower`, `wagashi`, `teaSet`, `tenugui`, `lantern` | `g_flower`, `g_wagashi`, `g_tea_set`, `g_tenugui`, `svc_lantern` |
| Aiko `aiko_contract` | flow (no slot) | `home_room_ono` |
| Motors `motors_bike` | `bikeModel`: `mamachari`, `helmet`, `ebike`; `giftItem`: `carFresh` | `bike_mamachari`, `bike_helmet`, `ebike`, `g_carfresh` |
| Motors `motors_car` | `carModel`: `used`, `good` | `car_kei_used`, `car_kei_good` |
| Trip `trip_hikarigaoka` (Kato) | `giftItem`: `souvenir` | `g_souvenir` |

Gift ids in §8.5 may only name items in this table.

---

## 6. Shops and conversation shapes

### 6.1 Interaction model (one NPC, several things to do)

Today a character has one `scenarioId` and tapping *Talk* starts it. The game keeps that as the **primary** interaction and adds an **Interaction sheet** (bottom sheet over the world, only shown when > 1 option is available; otherwise Talk starts the primary directly, so the first minute is unchanged). Options are data (`pack.interactions[characterId]`), each with a gate predicate and a label (EN/AR).

| NPC (place) | Primary | Other interactions (gate) |
|---|---|---|
| `tanaka` (konbini) | `konbini` (buy) | Work a shift `job_konbini` (C2) · Small talk (♥1) · Give a gift (C3) |
| `yuki` (café) | `cafe` (buy) | Shift `job_cafe` (C3) · Small talk · Gift · Hang out `hang_yuki_jam` (♥3) |
| `sato` (station) | `station` (ask) | Buy/charge IC `station_ic` (C1) · Ask the way `sato_directions` (C3) · Take the train `trip_hikarigaoka` (C5) · Shift `job_station` (C5) · Small talk · Gift |
| `kenji` (ramen) | `ramen` (eat) | Small talk · Gift · Hang out `hang_kenji_cook` (♥3) · Visit home `home_kenji` (♥4) |
| `hanako` (school) | lessons (existing) | Lesson list (§11.6) · Small talk after a lesson · Gift |
| `mio` (park) | `park` (meet) | Small talk · Gift · Hang out `hang_mio_photo` (♥3) · Visit home `home_mio` (♥4) |
| `aoi` (denki, C4) | `denki_phone` | none (staff, no hearts) |
| `rin` (fukufuku) | `fuku_clothes` | `fuku_home` (C5) · Small talk · Gift |
| `aiko` (ono, C2) | `aiko_tea` | `aiko_viewing`, `aiko_contract` (C6) · Small talk · Gift · Hang out `hang_aiko_wagashi` (♥3) · Visit home `home_aiko` (♥4) |
| `nakamura` (motors, C5) | `motors_visit` (his one `Character.scenarioId`; after you have visited, Talk offers `motors_bike` first) | `motors_bike` · `motors_car` (browse C7, buy FW) · Small talk · Gift |
| `kato` (trip only) | `trip_hikarigaoka` | — |

A **closed** shop (chapter not reached) shows its 準備中 sign (world) and the sheet says 「まだ準備中です。」 with "Opens in Chapter N" (strings `quests.locked`). From Chapter 2 the sheet also offers **Look through the window** for Hikari Denki, Nakamura Motors and Ono-sō: the read-only Goods sheet below, prices read aloud in Japanese. It sells nothing, but the phone and the bike are visible goals long before they are buyable, and it teaches numerals. NPC badges: `new`/`done`/`lesson` (existing) plus new `locked`.

A read-only **Goods sheet** ("Look at the goods") is offered next to Talk in every shop: item names in Japanese (tap → word card), reading, English/Arabic, price chip, lock state. You still have to *ask* for things in the conversation; the sheet is the equivalent of reading the shelves and teaches nouns and numerals.

### 6.2 Common purchase skeleton (every shop uses it; each sets flags)

```
start (greeting: いらっしゃいませ)
 → browse / ask_have / recommend            [stay-nodes, existing intent patterns]
 → choose   (slot: item + variants)         step: find
 → quote    ({price}/{total} are Vars)      step: price   (also answerable by 「いくらですか」)
 → [flags: bag? heat? eat-in? points? delivery? register form? wrap? name?; tax-free is a learning-only question, never a flag]
 → confirm  (only if total ≥ 5,000: 「こちらでよろしいですか？」 with a free Cancel)
 → pay      (slot payMethod: cash|card|ic)  
 → done     (SceneNode.econ:'charge', onShort:'short'; end; step: pay; 「ありがとうございました」)
 short      (「ちょっと足りないです…」 / clerk「少し足りません」 → choose cheaper or leave)
 leave      (end, no purchase; teaches 「また来ます」/「考えます」)
 goods      (optional, any time after the greeting: 「プレゼントを探しています」 → pick from `giftItem`; §5.6)
 twist      (P1: one flag-gated variation per shop scenario, below)
```
Standard step ids: `find`, `price`, `pay` (+ shop-specific). Every scenario stays **completable by tapping suggestions only** (tests, §15), including `short` and `leave`.

**`complete` (in objectives such as `scenario … complete`) means *all goal steps are done, including `pay` where the scenario has one*.** Reaching `leave`, or `short` → `leave`, never completes a shop scenario, so "buy something at the konbini" cannot be satisfied without buying. A ¥0 wallet is never stuck: scenarios that pay loop yen without a purchase (`park`, `station` info, `sato_directions`, lessons) are open in Chapter 1, and the opening ¥3,000 covers the first konbini visit.

**Twists (replay variation, P1).** Each shop scenario authors one *twist*, a flag-gated variant that changes one line and sends the learner back a node: sold out (「すみません、それは品切(しなぎ)れです。」 → choose again), "hot is not available", "that size is out". The bridge sets `flags.twist` deterministically (`hash(dayIndex, scenarioId, playCount) % 3 === 0`, only from a scenario's second play). A twist never pays or costs anything, so a replay is a slightly different conversation, not a lottery.

**Authoring contract.** A purchase scenario ships (a) the `Scenario`, (b) a `ScenarioMeta` row in the pack binding it to a shop (`itemSlot`, `qtySlot`, `payStep`, `itemMap` from slot option ids to menu/catalog ids, fees), (c) its slots (module `slots/shop-*.ts`; slot names are unique across modules, so new slots are `denkiItem`, `carModel`, `colour`, `size`, `fit`, `clothes`, `furniture`, `giftItem` (shared by every shop's `goods` node), `bikeModel`, `purpose`, `payMethod`, `chargeAmount`, `delivery`, `deliveryDay`, `trip`; full list in §14.9), (d) pocket lines (§11.1).

**Engine hooks** (`SessionOptions.game`, all optional so existing scenarios run untouched):

```ts
interface SessionGameHooks {
  /** called on start and after every learner turn; returns Vars such as price, total, change, deposit, fare */
  vars(slotIds: Record<string, string>, flags: Record<string, boolean>): Vars;
  /** called when entering a node with econ:'charge'. If ok === false the engine enters node.onShort instead */
  charge(slotIds: Record<string, string>): { ok: boolean; vars?: Vars };
  /** called after an intent with `econ` matched. ok:false routes to intent.nextIfNo */
  intent?(kind: IntentEcon, ctx: { slotIds: Record<string, string>; assisted: boolean; number?: number }): { ok: boolean; vars?: Vars };
}
type IntentEcon = 'say_total' | 'ask_total' | 'haggle' | 'use_points' | 'ask_taxfree' | 'accept_delivery';
```
Type additions (content): `SceneNode.econ?: 'charge'`, `SceneNode.onShort?: string`, `IntentDef.econ?: IntentEcon`, `IntentDef.nextIfNo?: string`, `IntentDef.alsoSlots?: string[]` (extra slots filled opportunistically from the same utterance, e.g. 「コーヒーをふたつ」 fills `item` and `qty`; they never block the turn), `IntentDef.remember?: {fact: string; from: 'slot'|'capture'|'literal'; value?: string}`, `SayVariant.when` also accepts `{ flag: string }`, `SessionOptions.flags`, `SessionOptions.startNode`, `IntentHit.number?: number` (from `parseNumbers`, feeds `ctx.number` for `say_total`), `Accessory` gains `'helmet'`. **Input classification** (1C, `engine/input.ts`): a text that is only digits, or digits plus `円`/`えん`, is `kind:'ja'` after `parseNumbers` (so `60000` and `450円` reach `say_total` instead of the translator). **Graph rules** for the content tests: reachability follows `intent.next`, `intent.nextIfNo`, `SceneNode.onShort` and every `startNode` named in `ScenarioMeta`; a character may own several scenarios, so the tests check that `Character.scenarioId` is *a registered scenario of that character*, not equal to each scenario. `Vars` for prices use `yenToJa` markup (§14.4) with gloss `{en:'450 yen', ar:'450 ين'}`.

### 6.3 Shop specs

Each row: building / surface · scenarios · slots · items · what is new. "Key lines" give JA (reading) / EN / AR for the lines whose wording matters (greeting, price, short, thanks); everything else is authored by content agents in the same register.

#### Konbini (Tanaka) — existing building, `konbini` refit

- **Steps:** `find`, `bag`, `pay` (existing) + P1 `points`. **Slots:** `item` (existing 9), `qty` (ひとつ/ふたつ/みっつ, ≤ 3), `payMethod`.
- **New nodes:** `quote` (price per item × qty via `{total}`), `heat` (only for `bento`: 温めますか), `eatin` (P1: 店内で召し上がりますか → 458-style eat-in price), `points` (P1: ポイントカードはお持ちですか → issue card once), `goods` (choco, manga, game card; §5.6), `twist` (sold out), `short`, `leave`.
- **Key lines:** 「いらっしゃいませ。」 (irasshaimase) Welcome. «أهلًا بك.» · 「温めますか？」 (あたためますか) Shall I heat it? «هل أسخّنه؟» · 「{total}です。」 It's {total}. «المجموع {total}.» · 「あ、お客様、少し足りません。」 (あ、おきゃくさま、すこしたりません) Sorry, it's a little short. «عفوًا، المبلغ ناقص قليلًا.» · 「ポイントカードはお持ちですか？」 (ポイントカードはおもちですか) Do you have a point card? «هل لديك بطاقة نقاط؟»
- **Culture:** `cc_irasshaimase` (first shop), `cc_konbini` (complete), `cc_points` (3rd purchase), `cc_notip` (first payment).

#### Café (Yuki) — existing, `cafe` refit

- **Steps:** `order`, `temp`, `wifi`, `pay` (existing). **Slots:** `item` (6 incl. `cake`), `payMethod`; P1 `herethere` (ここで/持ち帰り, tax 10%/8%).
- **New:** price from the item, `cake` order intent, `twist` (hot not available), `short`, `leave`; P1 here/to-go; perk node for Yuki ♥4 stamp card.
- **Key lines:** 「全部で{total}です。現金ですか、カードですか？」 (ぜんぶで…です。げんきんですか、カードですか？) «المجموع {total}. نقدًا أم بالبطاقة؟» · IC accepted: 「ICカードでお願いします。」 (アイシーカードでおねがいします).

#### Ramen shop (Kenji) — existing; **ticket machine panel** (§6.5)

- **Steps:** `order`, `spice`/`firmness`, `bill` (existing). **Slots:** `flavor` (shoyu/miso/tonkotsu), `ramenExtra`, `payMethod`.
- **New:** price from flavor (+extras), 麺のかたさ (かため/ふつう/やわらかめ), 替え玉, 水はセルフ, `ごちそうさま` ritual (`cc_itadakimasu`), `start_ticket` entry node when the player arrives with a ticket from the panel (payment already done; practises firmness, extras, ごちそうさま).
- **Key lines:** 「麺のかたさはどうしますか？」 (めんのかたさはどうしますか) How firm do you want the noodles? «ما درجة صلابة النودلز؟» · 「替え玉もできますよ。」 (かえだまもできますよ) You can get extra noodles too. «يمكنك طلب نودلز إضافية أيضًا.»

#### Station (Sato) — existing `station` refit + new `station_ic`, `sato_directions`

- `station` (info, A1): `{fare}` Var from the `place` option (default 190); unchanged steps `dest`, `info`, `thanks`.
- `station_ic` (A1, C1; **new**): steps `want` (ICカードをください), `amount` (slot `chargeAmount`: 1,000/2,000/3,000/5,000, limited by the IC cap of §4.1), `pay`. Nodes: start, explain (¥500 deposit, culture), amount, quote (`{total}` = 500 + amount when buying, = amount when topping up), pay, done (**charge**: `cash → ic`), short, and an optional `refund` branch (「払い戻しをお願いします」: the IC balance returns as cash less ¥220, §5.4; never a goal step). Culture `cc_ic`.
- `sato_directions` (A1-A2, C3): asks the way to the exit/toilet/platform; he answers with 右/左/まっすぐ; 3 steps `ask`, `repeat` (the learner says the direction back), `thanks`. Counts for Ch5 `c5_2` with `minIndependent: 3`.
- **Key lines (Sato, slow, formal):** 「ICカードは便利ですよ。ピッと乗れます。」 (アイシーカードはべんりですよ。ピッとのれます。) An IC card is handy. You just beep and board. «بطاقة IC مريحة. تمرّرها وتصعد.» · 「おいくらチャージしますか？」 (おいくらチャージしますか) How much would you like to load? «كم تريد أن تشحن؟»

#### Vending machines — existing props, **panel only**

Tap one of the 4 machines (pick id `vending`) → `VendingPanel`: pick a drink by label and price (kanji + reading toggle), hot (red label, あたたかい) vs cold (blue, つめたい), pay with IC or coins. First time each drink: culture `cc_vending`, +2 XP, **no yen reward and no random "lucky" anything**. Teaches reading prices and drink words.

#### Hikari Denki (Aoi) — **new building**, `denki_phone` (A2, C4, `register: keigo`)

- **Steps:** `want`, `choose`, `price`, `name`, `pay`. **Slots:** `denkiItem` (`used`, `pro` [Ch7+, else 「まだ入荷していません」, flag `pro_locked`], `case`, `tv` [Ch6+, else 「まだ入荷していません」, flag `tv_locked`]), `colour` (黒/白/青/赤), `payMethod` (cash/card; no IC), `giftItem` (`musicCd`, via the `goods` node).
- **Nodes:** start, ask_want (「何をお探しでしょうか？」), models (the options with prices read aloud), compare (「どちらが安いですか？」 → comparatives 安い/高い), colour, quote, `taxfree` (P1, **learning-only**: 「免税できますか？」 → 「申し訳ありません、免税の対象外です。」, no yen effect), `points` (P1), `goods`, `twist`, name (「お名前をお願いします」 → the learner answers with the chip 「{nameKana}です」 or types a name in **any script**; `capture:'name'`), confirm (≥ ¥5,000, always for phones), pay → charge, done, short, leave.
- **Key lines:** 「いらっしゃいませ。何をお探しでしょうか？」 (…なにをおさがしでしょうか) Welcome. What are you looking for? «أهلًا بك. عمّ تبحث؟» · 「こちらは二万四千八百円です。税込です。」 (こちらはにまんよんせんはっぴゃくえんです。ぜいこみです。) This one is 24,800 yen, tax included. «هذا بسعر 24,800 ين شاملًا الضريبة.» · 「お支払いは現金ですか、カードですか？」 · 「ありがとうございました。またお越しください。」 (またおこしください) Thank you. Please come again. «شكرًا لك. تفضّل بزيارتنا مجددًا.» Learner: 「スマホがほしいのですが…」 (スマホがほしいのですが) I'd like a smartphone… «أريد هاتفًا ذكيًا…»
- **Culture:** `cc_tax` (first purchase), `cc_taxfree` (the learning-only branch), `cc_points`. **Pocket:** スマホがほしいのですが / どちらが安いですか / これをください / カードでお願いします.

#### Fuku-Fuku clothes + second-hand (Rin) — **new building**, `fuku_clothes` (A1-A2, C2) and `fuku_home` (A2, C5)

- `fuku_clothes` steps: `look` (〜を探しています), `size`, `colour`, `try` (試着していいですか → fitting-room beat: the avatar previews the item), `fit` (ちょうどいい/大きい/小さい), `pay`. **Slots:** `clothes` (the 10 clothing items), `size` (S/M/L), `colour`, `fit`, `payMethod`. Compliment node: 「似合いますよ。」 (にあいますよ) It suits you. «يليق بك.» (teaches 似合う). A `goods` node sells the plush and the guitar pick (§5.6). The purchased item appears on the avatar immediately (`setPlayerSpec`).
- `fuku_home` (second-hand furniture) steps: `choose`, `price`, `take` (持ち帰り or 配送 +¥2,200), `day` (いつ届きますか → 明日/あさって/土曜日), `pay`. **Slots:** `furniture` (7 pieces), `delivery`, `deliveryDay`. Placing furniture happens afterwards in the Home screen (`item_placed`).
- **Register:** staff-polite; Rin switches to casual at ♥2 via `flags.casual` (`SayVariant.when {flag:'casual'}`), which triggers `cc_keigo` the first time.
- **Key lines:** 「いらっしゃいませー。何かお探しですか？」 (なにかおさがしですか) «أهلًا بك. هل تبحث عن شيء؟» · 「試着できますよ。あちらへどうぞ。」 (しちゃくできますよ。あちらへどうぞ。) You can try it on. Over there, please. «يمكنك تجربته. تفضّل من هناك.» · 「配送は二千二百円です。」 (はいそうはにせんにひゃくえんです) Delivery is ¥2,200. «التوصيل بـ 2,200 ين.»

#### Ono Tea House 小野茶房 (Aiko) — restyled **florist front** (street stall), `aiko_tea`, `aiko_viewing`, `aiko_contract`

- `aiko_tea` (A1-A2, C2) steps: `greet`, `pick` (slot `giftItem`: `flower`, `wagashi`, `teaSet`, `tenugui`, `lantern` (the ¥500 lantern fund), or a drink/sweet to eat), `who` (誰にあげますか → friend name or あなたに; she recommends from that friend's tastes, P1), `wrap` (ラッピング、リボンの色 → slot `colour`), `pay`. Wrapping is free (ラッピング無料). Aiko speaks slowly, polite-soft, calls the player ちゃん/くん.
- `aiko_viewing` (A2, C6, at the Ono-sō door; **no heart requirement**, it sets `aiko_room_shown` itself): `shoes` (genkan beat), `ask1..3` (any 3 of: 何畳ですか / 日当たりはいいですか / 家賃はいくらですか [adult-only intent] / いつからありますか / 静かですか), `thanks`. For under-18 profiles the same scenario plays as a visit to **Aiko's tea room next door** (`flags.minor`: the rent intent is absent and nobody mentions renting), so objective c6_3 and the dream steps are unchanged and no child is asked about rent. Culture `cc_rent` (adult-only).
- `aiko_contract` (A2, C6, only after `aiko_viewing`; 18+): `decide` (ここにします), `deposit` (she says 敷金 三万円 + 前家賃 三万円; the learner must **say the total** 六万円 → `IntentDef.econ:'say_total'`), `sign` (the chip 「{nameKana}です」 or a name typed in any script), `pay` (charge ¥60,000), `keys` (「鍵です。どうぞ。」). Culture `cc_trash` follows on first entering the flat.
- **Key lines:** 「いらっしゃい。ゆっくり見てね。」 (いらっしゃい。ゆっくりみてね。) Welcome. Take your time. «أهلًا. خذ وقتك.» · 「だれに あげるの？」 → polite 「どなたにあげますか？」 Who is it for? «لمن هي؟» · 「喜んでくれるといいですね。」 (よろこんでくれるといいですね) I hope they'll be pleased. «آمل أن تُسعدهم.» · 「ここが あなたの 家ですよ。」 (ここがあなたのいえですよ) This is your home. «هذا هو بيتك.»

#### Nakamura Motors (Nakamura) — **new building**, `motors_visit`, `motors_bike`, `motors_car`

- `motors_visit` (A2, C5): `greet`, `ask_price` (自転車はいくらですか), `decline` (「ちょっと…」「考えます」) → `cc_refuse`. No purchase.
- `motors_bike` (A2, C5): steps `purpose` (slot `purpose`: 通学/買い物/散歩), `model` (ママチャリ; he suggests the helmet), `price`, `register` (防犯登録: the chip 「{nameKana}です」 or a name typed in any script, + 「住所は桜町です」), `pay` (charge 19,800 + 600). Slots `bikeModel` (`mamachari`, `helmet`, `ebike` Ch7+), `purpose`, `payMethod`, `giftItem` (`carFresh`, via the `goods` node).
- `motors_car` (B1, browse C7, buy FW, 18+, `register: keigo`): `look` (色, 年式, 走行距離), `ask_total` (**the trap**: he first says 本体価格 十四万八千円; the learner must ask 「乗り出しはいくらですか」 → ¥198,000), `haggle` (「もう少し安くなりませんか」, polite + reason; §4.4 rule 3), `confirm` (`say_total`), `sign`, `pay` (charge). Slots `carModel` (`used`, `good`), `payMethod`. Suit owned → extra praise line and ×1.0 haggle (no bonus; cosmetic).
- **Register:** sales keigo; plain with friends (♥3 `flags.casual`).
- **Key lines:** 「いらっしゃい。何をお探しですか？」 (なにをおさがしですか) «أهلًا. عمّ تبحث؟» · 「本体価格は十四万八千円です。」 (ほんたいかかくは じゅうよんまんはっせんえんです) The body price is 148,000 yen. «سعر الهيكل 148,000 ين.» · 「乗り出し価格は十九万八千円です。」 (のりだしかかくは じゅうきゅうまんはっせんえんです) The drive-away price is 198,000 yen. «السعر النهائي 198,000 ين.» · 「もう少し安くなりませんか。」 (もうすこしやすくなりませんか) Could it be a bit cheaper? «هل يمكن أن يكون أرخص قليلًا؟»

### 6.4 Placement in the existing district (verified against `layout.ts` / `city.ts`)

Existing north shops (front plane `FRONT_Z = −9`, depth into −z): konbini x −34..−22, café −18..−6, school −2..10, ramen 14.5..25.5, station 30..50. Gaps: west −46..−34 (12 m), −22..−18, −6..−2 (4 m), 10..14.5, 25.5..30 (4.5 m), and east 50..64 (14 m). South side: park x −34..10 (z 9.5..40), decorative fronts x 15..67.4 at front plane z = 9.7 (solid boxes: **an NPC cannot stand inside them**). `BOUNDS = {x −46..64, z −8.3..37.5}` so players never enter shops; shop interiors are open-front dioramas behind a counter (NPC at z ≈ −12.4, floor `y = 0.28`).

| Item | Placement (metres) | Notes |
|---|---|---|
| **Fuku-Fuku** building | `ShopDef {id:'fukufuku', cx:−40.4, w:11, d:9.5, h:5.6}` → x −45.9..−34.9 (0.9 m from the konbini). NPC `rin` at (−40.4, −12.4), `y 0.28`, face 0, radius 5.4. Counter + clothes racks + fitting-room curtain; hanging sign 「ふくふく」 with sub "clothes & second-hand" | uses `shopFrame` + `hangSign`; rack props are merged boxes |
| **Hikari Denki** building | `{id:'denki', cx:57.5, w:12, d:10, h:6.2}` → x 51.5..63.5 (1.5 m from the station). NPC `aoi` at (57.5, −12.5), `y 0.28`. Phone wall, TV wall, counter | **move the vending machine** from (51.4, −8.2) to (64.6, −8.2) |
| **Nakamura Motors** | **extend the district east:** `BOUNDS.x1 = 90`. `{id:'motors', cx:75.5, w:14, d:10, h:5.6}` → x 68.5..82.5. NPC `nakamura` at (71.0, −12.4), `y 0.28`. Two kei cars inside at (76.8, −14.2) and (80.4, −14.2), both lying along x: a dedicated **3.4 × 1.5 m kei mesh** (the street `carMesh` is 4.0 m and would overlap at this spacing; merged boxes + 4 cylinders each, collision boxes, 0.2 m apart), 3 bikes outside at x 66.2/67.0/67.8, z −7.4 | add lamps at x 70 and 84 (z −6, z 6), a pole at x 80, extend one walker route to x 86; ground, sidewalks and curbs already exist to x 170. **Traffic wraps at x ±130** (not 90 / −110, or cars pop in and out at the new edge) and the east skyline band moves to **x ≥ 110** (it stood at 100-114, past the new edge, and would put a tower at the street end) |
| **Aiko's stall** | restyle the **florist front** (`cx 35.3, w 7`, x 31.8..38.8): new sign 「小野茶房」 sub "ono sabō"; keep 3 flower pots at the sides; counter box (35.3, 8.3) w 4.6 d 0.9 h 0.95 (collider) with a striped awning at y 2.8; NPC `aiko` at (35.3, 9.15), **face π**, radius 5.0; upper-floor balcony + 「小野荘」 plate; `door:aiko` pick at (38.2, 1.2, 9.55) | the NPC stands on the sidewalk in front of the wall (z 9.7), not inside it; the utility pole at x = 32 moves to x = 30.5 (it stood inside the stall footprint x 31.8..38.8) |
| **Door facades** (4 small boxes) | `door:dorm` in the −6..−2 gap: box cx −4, w 3.6, d 3, h 4.2, sign 「寮」; `door:kenji` in the 25.5..30 gap: cx 27.7, w 3.6, d 4, h 6.4, stairs, sign 「住居」; `door:mio` flush against the north face of the existing alley block (collider centre (12, 15), z 9..21): box centre (12, 8.6) w 3.6 d 0.8 h 6.4, sign 「ミオ」, pick at (12, 1.2, 8.2); `door:aiko` above | pick ids `door:*`, active per §8.8; before that the tooltip says 「まだ入れません」 |
| **Ramen ticket machine** | prop at (15.6, −8.5) on the ramen front, pick `ramen_machine` | opens `TicketPanel` kind `ramen` |
| **Station ticket/charge machine** | reuse the existing `pickAt('ticket')` at (32.8, 1.0, −10.6) inside the hall (picks are ray-based up to 60 m and need no proximity), no new prop | opens `TicketPanel` kind `station` |
| **Spots** (invisible circles, event `spot`) | `spot:torii` (−12, 10.5, r 3) · `spot:pond` (−23, 28.5, r 4) · `spot:east_end` (88, 0, r 3) · `spot:west_end` (−44, 0, r 3) · `spot:station_plaza` (40, −6, r 4) | used by dream `bike` and `visit` objectives |
| **Festival dressing (Ch7)** | park: 6 stalls (box + awning + noodle-curtain 暖簾), 20 lanterns on strings, fireworks = 40 additive sprites bursting at the pond | toggled by `world.setFestival(true)`, which also applies a **dusk preset** (sky, fog, hemisphere and sun colours; the world has no day/night cycle, so the festival "night" is this one preset) |

World API additions (owned by the world seam agent, slice 1): `NPC_SPAWNS` +4, `SHOPS` +3, `BOUNDS.x1 = 90`, `DOORS`, `SPOTS` data in `layout.ts`; events `{type:'spot', id}`; `Badge` gains `'locked'`; `setShopOpen(shopId, open)` (toggles a 準備中 shutter plane); `setMoveMultiplier(n)`; `setRide(kind)`; `setFestival(on)` (with the dusk preset); **stages** (§8.8); `snapshot()` omits NPCs hidden by `setShopOpen(false)` (no minimap dots inside closed shops); `setMoveMultiplier(n)` makes movement integrate in sub-steps so one step never exceeds 0.25 m (colliders are 0.5 m thick; ride ×2.5 with the 0.05 s dt cap would otherwise move 0.8 m per frame and tunnel). **Performance budget:** the sample runs ~36 draw calls and ~42k triangles at start; the three new buildings together may add ≤ 16 draw calls and ≤ 16k triangles (merged `Batch` geometry, shared toon material, no per-prop meshes); each interior stage ≤ 12 draw calls. The minimap uses a 38 m radius, so the longer street needs no change; `MapRect`s are added for the three buildings.

### 6.5 Panels (menu-based, no NPC)

| Panel | Opens from | Flow | Rewards |
|---|---|---|---|
| `VendingPanel` | pick `vending` | choose drink (kanji/price/reading), hot or cold, pay IC/coin | culture `cc_vending`, +2 XP first time per drink; no yen |
| `TicketPanel kind:'ramen'` | pick `ramen_machine` | menu buttons with kanji + price; choose flavor/extras; coin/IC; produces a **ticket** (`tickets.ramen`), then talk to Kenji (`start_ticket`) | `cc_ticketmachine` |
| `TicketPanel kind:'station'` | pick `ticket` | fare map (kanji labels); choose destination; pay; produces a **paper ticket** (`tickets.station`) or, with an IC card, tap-in | `cc_ticketmachine`, `cc_trainmanner` on first ride |
| `TripPanel` | Sato's *Take the train* | needs cash or IC for 2 × the fare; 3-second train-window scene (CSS/canvas), arrive at Hikarigaoka backdrop, conversation `trip_hikarigaoka` with Kato (buy `g_souvenir`), return; the **round-trip fare is charged up front** (§5.4), so the return is prepaid | `visit trip:hikarigaoka`, `cc_ticketmachine`, `cc_trainmanner` |

All panels have a typed/tapped path only (no audio needed), full RTL, and the same price chip as shops.

### 6.6 Refit of the five existing scenarios (slice 2, one owner)

1. Replace hard-coded price words (`四百五十円`, `三百二十円`, `百九十円`, `九百円`) in `cafe`, `konbini`, `station`, `ramen` with `{total}`/`{price}`/`{fare}` Vars; keep the old lexicon entries (harmless).
2. Add `SceneNode.econ:'charge'` + `onShort` nodes (`short`, `leave`) to the four shop scenarios; add `payMethod` slot intents.
3. Existing `session.test.ts` (plays every scenario with every suggestion) must stay green and be extended to run with `game` hooks and (a) enough cash, (b) too little cash (reaches `short`, no purchase).
4. `park` is unchanged except it now emits `remember` facts (`name`, `country`, `hobby`) for Mio.
5. Add one `twist` variant per shop scenario (P1, §6.2) and the `goods` node where §5.6 lists `giftItem` options (konbini). Intents that objectives need are listed in `ScenarioMeta.requiredIntents`: `ramen:itadakimasu` (いただきます) and `ramen:gochisosama` (ごちそうさまでした), used by c2_4.

### 6.7 Worked example: `denki_phone` (node table; the pattern every shop scenario follows)

Conventions as in `scenarios.ts` (`L(ja, en, ar)`, `S(...)`, `node(...)`, `REPEAT_S`): every node has ≥ 2 suggestions, intent keyword lists in kana + kanji + romaji, and an `ideal` line on every `request` intent. `{item}`, `{colour}` come from slots; `{total}` from `SessionGameHooks.vars`.

| node | Aoi says (JA · EN · AR) | Suggestions (S) | Intents (keywords) → next |
|---|---|---|---|
| `start` | いらっしゃいませ。何(なに)をお探(さが)しでしょうか？ · Welcome. What are you looking for? · أهلًا بك. عمّ تبحث؟ | スマホがほしいのですが。 · 見(み)ているだけです。 · こんにちは。 | `want_phone` all[[スマホ, すまほ, 携帯, けいたい]] any[ほしい, 探して, 買いたい] → `models` (step `want`, `request`, ideal スマホがほしいのですが。); `just_looking` any[見ているだけ, みているだけ] `stay` reply 「ごゆっくりどうぞ。」 |
| `models` | こちらが中古(ちゅうこ)スマホです。{price}です。最新(さいしん)スマホもあります。 · This is the refurbished phone, {price}. We also have the latest model. · هذا هاتف مجدّد بسعر {price}. لدينا أيضًا أحدث طراز. (variant `when {flag:'pro_locked'}`: 最新スマホはまだ入荷(にゅうか)していません。 Not in stock yet.) | 中古スマホをください。 · どちらが安(やす)いですか？ · いくらですか？ | `choose_used` slot `denkiItem` opts[used] any[ください, これ, にします, ほしい] → `colour` (step `choose`, `request`); `choose_pro` slot opts[pro] → `colour` unless `pro_locked` → `no_stock`; `ask_cheaper` any[安い, やすい] `stay` reply 「中古スマホのほうが安いです。」; `ask_price` any[いくら] `stay` reply 「{price}です。税込(ぜいこみ)です。」 |
| `colour` | 色(いろ)はどうしますか？黒(くろ)、白(しろ)、青(あお)、赤(あか)があります。 · Which colour? We have black, white, blue and red. · أي لون؟ لدينا أسود وأبيض وأزرق وأحمر. | 黒(くろ)をお願いします。 · 青(あお)がいいです。 | `pick_colour` slot `colour` slotRequired → `quote` |
| `quote` | {colour}の{item}ですね。全部で{total}、税込です。 · The {colour} {item}: {total} in total, tax included. · {item} باللون {colour}: المجموع {total} شاملًا الضريبة. | カードでお願いします。 · 現金(げんきん)でお願いします。 · 少(すこ)し高(たか)いです。 | `pay_card` / `pay_cash` slot `payMethod` → `name` (step `price`); `too_dear` any[高い, たかい] `stay` reply 「申(もう)し訳(わけ)ありません。定価(ていか)です。」 (fixed price, `cc_refuse`); `later` any[また来ます, 考えます, かんがえます] → `leave` |
| `name` | お名前(なまえ)をお願いします。 · Your name, please. · اسمك من فضلك. | {nameKana}です。 · もう一度(いちど)お願いします。 | `say_name` `capture:'name'` (any script accepted; the chip carries the katakana name) → `confirm` (step `name`) |
| `confirm` | こちらでよろしいですか？ · Is this all right? · هل هذا مناسب؟ | はい、お願いします。 · いいえ、やめます。 | `yes` any[はい, お願い, いいです] → `done`; `no` any[いいえ, やめ, 考え] → `leave` |
| `done` (`end`, `econ:'charge'`, `onShort:'short'`, step `pay`) | ありがとうございました。またお越(こ)しください。 · Thank you very much. Please come again. · شكرًا جزيلًا. تفضّل بزيارتنا مجددًا. | — | — |
| `short` | 申(もう)し訳(わけ)ありません、少(すこ)し足(た)りません。 · I'm sorry, it's a little short. · آسفة، المبلغ ناقص قليلًا. | また来(き)ます。 · 考(かんが)えます。 · 安(やす)いのはありますか？ | `later` → `leave`; `cheaper` any[安いの, やすいの] → `models` |
| `leave` (`end`) | かしこまりました。またお待(ま)ちしております。 · Certainly. We look forward to seeing you again. · حسنًا. بانتظار زيارتك مجددًا. | — | — |

### 6.8 Scenario authoring checklist (the definition of done for every content agent)

1. Every Japanese token resolves in the lexicon (`LEXICON`) with EN + AR glosses; new words go in the agent's own lexicon module with a kana reading for every kanji entry; **no clashes** with other modules (same reading and meaning if a surface repeats).
2. Every `Line`, `Suggestion`, `GoalStep`, `title`, `setup` has English **and** Arabic; English without contractions, Arabic in the same register as existing scenarios.
3. Graph valid: start exists, every node reachable, every `end` node reachable, no dead intent targets; at least one path completes **every** goal step; shop scenarios also reach `short` and `leave`.
4. Every non-`end` node has ≥ 2 suggestions (one may be `REPEAT_S`); **picking every suggestion at every node is understood** (session test).
5. Slots: names unique across modules; every option has keys in ja/en/ar; closed slots for item lists; `payMethod` and `qty` reuse the shared slots defined once in `slots/shop.ts`.
6. Request intents carry `request: true` and an `ideal` line; polite/casual variants use `SayVariant.when {flag:'casual'}` where a friend switches.
7. `ScenarioMeta` row present (kind, band, register, pay, pocket ids, shop wiring); pocket lines exist and are matched by an intent (test).
8. Prices only through Vars (`{price}`, `{total}`, `{fare}`), never typed into a line, so the refit and other packs stay data-driven.
9. Respect age rules (`ageMin`) and keep content free of alcohol, gambling and romance.
10. Every item that §5.6 lists for this shop is reachable from a node (`goods` or the main flow) and listed in `itemMap`; `complete` means all goal steps including `pay` (§6.2); objectives' `requiredIntents` exist.
11. Shop scenarios author one `twist` variant (P1).
12. Name prompts accept any script and offer the `{nameKana}` chip; no line demands katakana.

---

## 7. Quests

### 7.1 The objective engine (pure predicates over saved state)

Events mutate state; **objectives are re-evaluated from state after every event**, so completion is idempotent and retroactive (if you already own a phone when "own a phone" appears, it completes at once with a toast) and tests can evaluate any save file.

```ts
type Pred =
  | { k: 'lesson'; id: string }
  | { k: 'scenario'; id: string; complete?: boolean; steps?: string[]; minIndependent?: number; minShare?: number; minStars?: 1|2|3 }   // best run so far; `complete` = ALL goal steps done incl. `pay` (§6.2); `steps` = these goal steps done in some run
  | { k: 'stars'; atLeast: 1|2|3; n: number }               // n distinct scenarios at >= atLeast
  | { k: 'own'; item?: string; category?: string }          // categories: phone, bicycle, car, flat, yukata
  | { k: 'purchases'; n: number; minPrice?: number }
  | { k: 'hearts'; friend: string; atLeast: number }
  | { k: 'hearts_count'; atLeast: number; n: number }       // n friends at >= atLeast hearts
  | { k: 'gift'; n: number; friend?: string; reaction?: 'liked'|'loved' }
  | { k: 'phone_chat'; n: number; friends?: number }
  | { k: 'hangout'; friend?: string; n?: number }
  | { k: 'visit'; place: string }                           // 'home:mio', 'home:*', 'spot:pond', 'trip:hikarigaoka'
  | { k: 'shift'; job?: string; n: number; minAcc?: number }   // counts only shifts with all 5 customers served and accuracy (ticks) ≥ minAcc (default 0.6); a trial-wage shift never counts
  | { k: 'earn_total'; yen: number } | { k: 'wallet'; atLeast: number }
  | { k: 'words_saved'; n: number }                         // vocab items with source !== 'starter' (the 5 starter words every profile owns do not count)
  | { k: 'words_known'; n: number; tag?: string }           // vocab items reviewed ≥ 1 time; tag from wordTags.ts
  | { k: 'say_new'; n: number }                             // distinct new words said (substantive, independent)
  | { k: 'discover'; n: number } | { k: 'culture'; n: number; id?: string }   // `culture` is a collection count; never a chapter gate
  | { k: 'culture_said'; n: number }                        // n distinct culture cards with say:true whose key phrase the learner said in a class-I turn or a hidden-line Say-it on the card
  | { k: 'said'; scenario: string; intent: string }         // an independent (class-I) substantive turn matched this intent at least once (`seenIntents` key `scenarioId:intentId`)
  | { k: 'srs_reviews'; n: number } | { k: 'item_placed'; n: number }
  | { k: 'flag'; id: string }                               // set by scripted beats / scenarios
  | { k: 'all'; of: Pred[] } | { k: 'any'; of: Pred[] };

interface Objective { id: string; pred: Pred; text: Gloss; hint?: Gloss; pin?: { place?: string; friend?: string }; dream?: true; easier?: { pred: Pred; afterTries: number } }
```
`new word` = a non-grammar lexicon entry in a substantive independent line whose surface is not in `counters.wordsSaid` (lifetime set). `words_known` counts vocabulary cards with ≥ 1 review. `wordTags.ts` (pack data, D33): tags `numbers`, `direction`, `transport`, `home`, `car`, `cafe`, each a list of surfaces (8-14 each).

**Rules.** A chapter is `current` until all its **non-dream** objectives are done *and* `activeDays ≥ minDays`; then it completes (reward, beat) and the next becomes current (one chapter completion per day maximum). **What a chapter opens takes effect when it becomes current** (§4.5, D36), so its own objectives can use it. The **dream slot** (★) shows the player's dream step for that chapter; it is **optional and never blocks** a chapter. Chapter 6 additionally needs `hearts_count ≥3 n:1` to *start* (someone must like you enough to invite you; otherwise the card says "Make a closer friend first"). **Money:** story objectives are language objectives with one exception, c4_1 (own a phone), a saving goal that is affordable on the day Chapter 4 opens for every simulated persona (§4.6) and backed by the catch-up stipend (§4.5). No other objective needs yen beyond a purchase inside its own scenario (c1_2).

**Waiting for days.** When every objective is done but `activeDays < minDays`, the Story tab and the tracker say 「できました！」 *Done! The next chapter opens after {n} more days of practice* (`quests.waitDays`) instead of an empty state, and `nextBestGoal` falls through to due reviews, the lowest-star scenario, an unspent gift, a `g_*` goal, a free-walk spot. A chapter's places are already open (they opened at its start), so a fast player is never idle; only the story beat waits.

**Easier alternative (D40).** An objective that needs "your own words" carries `easier: { pred, afterTries }`. After 3 attempts at its scenario (for `say_new` and `stars`: after 3 completed conversations in the chapter) without finishing it, the row offers *Make it easier* (Hanako: 「少(すこ)しやさしくしましょう。」 *Let's make it a bit easier.* «لنجعلها أسهل قليلًا.»). Accepting is free, permanent for that objective and never drops to zero own words: c1_5 `say_new n:3` → `n:2`; c2_1 `minIndependent:2` → `1`; c3_1 `4` → `2`; c5_2 `3` → `2`; c7_2 `3` → `2`; c7_3 `5` → `3`; c8_3 `n:12` → `n:8`. A learner who never produces a line of their own is blocked at c1_5 by design; the first scaffold is Prepare recall (§11.1), which counts as own words.

**Prerequisite validation.** `validatePack` derives `requires(pred)` for every objective (`shift job:X` → job X; `gift` → the gift hand-over; `phone_chat` → the phone and a ♥2 friend; `own item:X` → X's gate; `scenario S` → S's `ScenarioMeta.gate` and shop `openChapter`; `visit trip:*` → the trip interaction; `hearts F` → the friend's `unlockChapter`) and fails unless each is open at its chapter's start. This is the check that would have caught "Chapter 2's reward unlocks the shift Chapter 2 asks for". At level 4 a bot plays the chapter graph with only what is open at each chapter's start and must finish all eight, including the flat path with at most ♥1 for Aiko.

### 7.2 Story chapters (8)

`Reward` always includes the yen in §4.5, plus titles, culture cards and beats. **It never unlocks anything the same chapter's objectives need** (D36): places, jobs and features open when the chapter *starts* (§4.5), and a "(…opened when the chapter began)" note below only reminds the player. Beat lines are short A1-A2 (JA with readings / EN / AR); `{name}` = player name.

#### Chapter 1 — はじめまして · First Hello · أول لقاء (A1)
Gate: onboarding done. **Opening beat `b_ch1_open`** (school, Hanako): 

| who | JA (reading) | EN | AR |
|---|---|---|---|
| hanako | ようこそ、桜町(さくらちょう)へ。わたしは花子(はなこ)です。先生(せんせい)です。 | Welcome to Sakura-chō. I'm Hanako. I'm your teacher. | أهلًا بك في ساكورا-تشو. أنا هاناكو، معلّمتك. |
| hanako | これは最初(さいしょ)のお金(かね)です。三千円(さんぜんえん)です。 | This is your first money. It's 3,000 yen. | هذه أول نقودك. ثلاثة آلاف ين. |
| hanako | 一年後(いちねんご)、日本語(にほんご)で家族(かぞく)に手紙(てがみ)を書(か)きます。 | In a year, you will write a letter to your family in Japanese. | بعد عام ستكتب رسالة إلى أسرتك باليابانية. |
| hanako | まず、あいさつのレッスンをしましょう。 | First, let's do a greeting lesson. | أولًا، لنبدأ بدرس التحيات. |

(The wallet pill appears with ¥3,000. Hanako also asks for your name in katakana: pre-filled from your name, editable, stored as `me.nameKana`; it feeds the 「{nameKana}です」 chip of §6.7.)

| id | pred | EN | AR |
|---|---|---|---|
| c1_1 | `lesson greetings` | Finish Hanako-sensei's Greetings lesson | أنهِ درس التحيات مع المعلّمة هاناكو |
| c1_2 | `scenario konbini complete` | Buy something at the konbini (finish the conversation) | اشترِ شيئًا من الكونبيني (أكمل المحادثة) |
| c1_3 | `discover n:4` | Read 4 shop signs around town | اقرأ 4 لافتات متاجر في الحيّ |
| c1_4 | `words_saved n:5` | Save 5 words to your notebook (the 5 starter words do not count) | احفظ 5 كلمات في دفترك (كلمات البداية الخمس لا تُحتسب) |
| c1_5 | `say_new n:3` | Say 3 different new words yourself in conversations | انطق 3 كلمات جديدة مختلفة بنفسك في المحادثات |

Reward: ¥2,500, title `t_newcomer` 新入生(しんにゅうせい) Newcomer / وافد جديد, culture `cc_irasshaimase`, `cc_bow`. **Closing beat** (`b_ch1_close`): hanako 「よくできました。これからですね。」(よくできました。これからですね。) *Well done. This is only the start.* «أحسنت. هذه مجرد البداية.» then 「{name}さんの夢(ゆめ)は何ですか？」 *What is your dream, {name}?* «ما هو حلمك يا {name}؟», which opens the **Dream picker** (and unlocks `dream_swap`). The lexicon `quests` module registers the compound `何ですか` (なんですか): the lexicon allows one reading per surface and bare 何 is なに, so the line would otherwise show the wrong furigana.

#### Chapter 2 — いらっしゃいませ · Welcome! · أهلًا بك! (A1)
Opening (konbini, Tanaka): 「あの、アルバイト、しませんか？」*Um, would you like a part-time job?* «أمم، هل تودّ العمل بدوام جزئي؟» · 「レジ、お願いします。」*Please work the register.* «رجاءً، تولَّ الصندوق.»

| id | pred | EN | AR |
|---|---|---|---|
| c2_1 | `scenario cafe minIndependent:2` | Order at Sakura Café with at least 2 lines of your own | اطلب في مقهى ساكورا مع جملتين على الأقل من عندك |
| c2_2 | `scenario ramen complete` | Eat at Kenji's ramen shop and ask for the bill | تناول الطعام عند كينجي واطلب الحساب |
| c2_3 | `shift job:konbini n:1 minAcc:0.6` | Work your first konbini shift (all 5 customers) | اعمل أول وردية في الكونبيني (الزبائن الخمسة جميعهم) |
| c2_4 | `culture_said n:2` | Use 2 culture-card phrases yourself (for example いただきます at the ramen shop) | استخدم عبارتين من البطاقات الثقافية بنفسك (مثل «いただきます» عند كينجي) |
| c2_★ | dream step (gate 2) | | |

Reward: ¥2,500, culture `cc_notip`, `cc_konbini`, `cc_itadakimasu` (shifts, Fuku-Fuku and Aiko's tea house opened when the chapter began). Closing (Tanaka): 「おつかれさまでした。はい、今日(きょう)のお給料(きゅうりょう)です。」*Good work today. Here's today's pay.* «أحسنت اليوم. تفضّل، أجرك لهذا اليوم.»

#### Chapter 3 — ともだち · First Friend · أول صديق (A1)
Opening (park, Mio, plays when you first approach after Ch2): 「こんにちは！新入生(しんにゅうせい)？」*Hi! Are you a new student?* «مرحبًا! هل أنت طالب جديد؟» · 「友(とも)だちになりましょう！」*Let's be friends!* «لنصبح أصدقاء!»

| id | pred | EN | AR |
|---|---|---|---|
| c3_1 | `scenario park minIndependent:4` | Meet Mio: say your name, where you're from and your hobby (4+ lines of your own) | قابل ميو: قل اسمك وبلدك وهوايتك (4 جمل على الأقل من عندك) |
| c3_2 | `hearts mio ≥ 2` | Reach 2 hearts with Mio | اوصل إلى قلبين مع ميو |
| c3_3 | `gift n:1` | Give a gift to a friend (buy it first!) | قدّم هدية لصديق (اشترِها أولًا!) |
| c3_4 | `hearts_count ≥2 n:2` | Have two 2-heart friends (Mio and one more) | اجعل لك صديقين بقلبين (ميو وشخصًا آخر) |
| c3_★ | dream step (gate 3) | | |

**Mio ♥2 beat `b_mio_h2`** (the chapter's emotional moment; also sets friend flags `number_note`, `casual`, item `note_mio`, culture `cc_keigo`):

| who | JA (reading) | EN | AR |
|---|---|---|---|
| mio | 電話番号(でんわばんごう)を教(おし)えてください。 | Please tell me your phone number. | أخبرني رقم هاتفك من فضلك. |
| mio | あ、まだスマホがないですか？じゃあ、これ。 | Oh, you don't have a phone yet? Then, here. | آه، ليس لديك هاتف بعد؟ إذًا، تفضّل هذه. |
| mio | わたしの番号(ばんごう)です。メモを見(み)てください。 | It's my number. Look at the note. | هذا رقمي. انظر إلى المذكرة. |
| mio | 敬語(けいご)はやめよう！タメ口(ぐち)でいい？ | Let's drop the formal speech! Is casual OK? | لنترك الكلام الرسمي! هل نتكلم بصيغة عادية؟ |

Reward: ¥3,000, title `t_friend` 友(とも)だち Friend / صديق, culture `cc_gift`, `cc_name`, `cc_hanami` (the Friends screen, the gift hand-over and `job_cafe` opened when the chapter began). Closing (Mio): 「また明日(あした)ね！」*See you tomorrow!* «أراك غدًا!»

#### Chapter 4 — つながる · Stay Connected · ابقَ على تواصل (A1→A2, the one saving goal)
Opening (street, Tanaka with a phone): 「スマホがほしいですか？ヒカリ電機(でんき)はどうですか？」*Want a phone? How about Hikari Denki?* «هل تريد هاتفًا؟ ما رأيك بمتجر هيكاري دنكي؟» The HUD shows 「あと¥X」 ("¥X to go") and the hint "Conversations and shifts pay yen".

| id | pred | EN | AR |
|---|---|---|---|
| c4_1 | `own category:phone` | Buy your own phone at Hikari Denki | اشترِ هاتفك الخاص من متجر هيكاري دنكي |
| c4_2 | `phone_chat n:1` | Send your first message to a friend | أرسل أول رسالة إلى صديق |
| c4_3 | `phone_chat n:4 friends:2` | Chat 4 times with 2 different friends (one thread per friend per day) | تحدّث 4 مرات مع صديقين مختلفين (محادثة واحدة لكل صديق يوميًا) |
| c4_4 | `words_known n:25` | Know 25 words (reviewed at least once) | تعرّف على 25 كلمة (راجعتها مرة على الأقل) |
| c4_★ | dream step (gate 4) | | |

Phone-bought beat (Aoi): 「ありがとうございました。いい電話(でんわ)ですよ。」*Thank you very much. It's a good phone.* «شكرًا جزيلًا. هاتف جيد.» Mio's `chat_first` arrives within the day. c4_3 carries the hint *Make sure two friends are at 2 hearts* (Chapter 3's c3_4 already guarantees it) and a pin on the friend; threads are one per friend per day, so it takes at least two days. c4_1 is the story's one saving goal; if the player is still short after 7 active days the catch-up stipend closes the gap (§4.5). Reward: ¥4,000, title `t_connected` つながる Connected / متصل, culture `cc_tax`, `cc_vending`, `cc_points` (Messages and Map pins turn on the moment the phone is owned). Closing (Mio by text): 「来週(らいしゅう)、お祭(まつ)りがあるよ！」*There's a festival next week!* «سيقام مهرجان الأسبوع القادم!»

#### Chapter 5 — でかけよう · Let's Go Out · لنخرج (A2)
Opening (station, Sato): 「ICカードは便利(べんり)ですよ。ピッと乗(の)れます。」 · 「ひかりが丘(おか)まで行(い)きませんか？」*Won't you go as far as Hikarigaoka?* «ألا تذهب حتى هيكاريغاؤكا؟»

| id | pred | EN | AR |
|---|---|---|---|
| c5_1 | `visit trip:hikarigaoka` | Ride the train to Hikarigaoka and back | اركب القطار إلى هيكاريغاؤكا وعد |
| c5_2 | `scenario sato_directions minIndependent:3` | Ask Sato the way in Japanese (3+ lines of your own) | اسأل ساتو عن الطريق باليابانية (3 جمل على الأقل من عندك) |
| c5_3 | `shift job:station n:1 minAcc:0.6` | Work a shift at the station help desk | اعمل وردية في مكتب مساعدة المحطة |
| c5_4 | `scenario motors_visit complete` | Browse Nakamura Motors and politely say you'll think about it | تصفّح ورشة ناكامورا وقل بأدب إنك ستفكّر |
| c5_★ | dream step (gate 5) | | |

Reward: ¥5,000, title `t_traveller` 旅人(たびびと) Traveller / مسافر, culture `cc_ic`, `cc_trainmanner`, `cc_ticketmachine`, `cc_refuse` (`job_station`, Nakamura Motors and the trip opened when the chapter began). Closing (Hikarigaoka platform, Sato): 「ご乗車(じょうしゃ)ありがとうございました。」*Thank you for riding.* «شكرًا لركوبك القطار.»

#### Chapter 6 — おじゃまします · Visiting Homes · زيارة البيوت (A2)
Start gate: Chapter 5 done **and** one friend at ♥3. Opening (phone, or in person without one; Mio): 「うちに来(き)ませんか？」 · learner 「おじゃまします。」 · mio 「どうぞ、あがってください。」*Won't you come to my place? / Excuse me for intruding. / Please, come on up.* «ألا تأتي إلى بيتي؟ / عن إذنك. / تفضّل، ادخل.»

| id | pred | EN | AR |
|---|---|---|---|
| c6_1 | `hearts_count ≥4 n:1` | Get to 4 hearts with one friend (they'll invite you home) | اوصل إلى 4 قلوب مع صديق (سيدعوك إلى بيته) |
| c6_2 | `visit home:*` | Visit a friend's home with good manners (shoes, 「おじゃまします」, tea) | زر بيت صديق بأدب (الحذاء، «おじゃまします»، الشاي) |
| c6_3 | `scenario aiko_viewing complete` | Look at Aiko's room and ask 3 questions | شاهد غرفة أيكو واطرح 3 أسئلة |
| c6_4 | `shift n:5 minAcc:0.6` | Work 5 shifts in total (all customers served) | اعمل 5 ورديات في المجموع (خدمة جميع الزبائن) |
| c6_★ | dream step (gate 6) | | |

Under-18 profiles play c6_3 as the visit to Aiko's tea room next door (§6.3) and never see the rent card. Reward: ¥6,000, title `t_guest` お客(きゃく)さん Guest of honour / ضيف عزيز, Letter preview, culture `cc_shoesoff`, `cc_rent` (adults), `cc_trash`. Closing (Aiko): moved in → 「ここがあなたの家(いえ)ですよ。」*This is your home.* «هذا هو بيتك.»; else 「いつでもお茶(ちゃ)を飲(の)みに来(き)てくださいね。」*Come for tea any time.* «تعال لشرب الشاي في أي وقت.»

#### Chapter 7 — お祭り · Festival · المهرجان (A2)
The park turns into a festival (stalls, lanterns); friends at ≥ ♥2 come. Opening (Mio, Kenji, Hanako): 「土曜日(どようび)にお祭りがあります。いっしょに行(い)こう！」 · 「ラーメンの屋台(やたい)を出(だ)します！」 · 「みなさんの前(まえ)で、自己紹介(じこしょうかい)をしましょう。」*There's a festival on Saturday. Let's go together! / I'm opening a ramen stall! / Let's do a self-introduction in front of everyone.* «يوم السبت هناك مهرجان. لنذهب معًا! / سأفتح بسطة رامن! / لنقدّم أنفسنا أمام الجميع.»

| id | pred | EN | AR |
|---|---|---|---|
| c7_1 | `hearts_count ≥2 n:4` | Have 4 friends (2 hearts or more) come to the festival | اجعل 4 أصدقاء (قلبان فأكثر) يأتون إلى المهرجان |
| c7_2 | `scenario matsuri_stalls minIndependent:3` | Buy festival food at the stalls (3+ lines of your own) | اشترِ طعام المهرجان من البسطات (3 جمل على الأقل من عندك) |
| c7_3 | `scenario matsuri_speech minIndependent:5` | Give your self-introduction speech (5+ lines of your own) | ألقِ كلمة التعريف بنفسك (5 جمل على الأقل من عندك) |
| c7_4 | `culture_said n:6` | Use 6 culture-card phrases yourself so far | استخدم 6 عبارات من البطاقات الثقافية بنفسك حتى الآن |
| c7_★ | dream finale step (gate 7) | | |

`matsuri_speech` is the **capstone**: 5 prompted slots (name, country, hobby, what you like about Sakura-chō, thanks) assembled in order, **Real mode** (chips hidden); assists allowed but do not count toward `minIndependent`. Target speech: 「はじめまして。{name}です。{country}から来(き)ました。{hobby}が好(す)きです。桜町(さくらちょう)はとてもいい町(まち)です。ありがとうございました。」*Nice to meet you. I'm {name}. I came from {country}. I like {hobby}. Sakura-chō is a very nice town. Thank you.* «تشرفنا. أنا {name}. جئت من {country}. أحب {hobby}. ساكورا-تشو مدينة جميلة جدًا. شكرًا لكم.»
**No cliff:** in Chapter 6 Hanako offers a *try it without chips* beat (`b_real_try`: 「ヒントなしで、やってみましょう。」 *Let's try without hints.* «لنجرّب دون تلميحات.») that runs one shop scenario in Real mode (paid ×1.25 as usual), and the Prepare screen for `matsuri_speech` is a dedicated five-line speech rehearsal. A player who has never used Real mode may play the capstone **once in Guided mode** (chips visible, class-S lines count at half toward `minIndependent`, title unchanged).
Reward: ¥8,000, title `t_resident` 桜町(さくらちょう)の住人(じゅうにん) Resident of Sakura-chō / ساكن ساكورا-تشو, culture `cc_matsuri` (the Letter opens with Chapter 8). Closing (park at night, fireworks under the dusk preset): hanako 「みなさん、ありがとうございました。」*Thank you, everyone.* «شكرًا لكم جميعًا.»

#### Chapter 8 — 手紙 · Letter Home · رسالة إلى الأهل (A2, epilogue)

| id | pred | EN | AR |
|---|---|---|---|
| c8_1 | `flag letter_written` | Write your Letter Home (5 sentences; at least 3 of your own, not translated) | اكتب رسالتك إلى الأهل (5 جمل، 3 منها على الأقل من عندك دون ترجمة) |
| c8_2 | `words_known n:150` | Know 150 words | تعرّف على 150 كلمة |
| c8_3 | `stars atLeast:2 n:12` | Reach ★★ in 12 different conversations | احصل على ★★ في 12 محادثة مختلفة |
| c8_4 | `flag dream_epilogue` | Finish your dream, or choose a new one (the `car` dream opens at Free Walk, so it is never required) | أنهِ حلمك أو اختر حلمًا جديدًا (حلم السيارة يُفتح في المشي الحر فلا يُشترط) |

**Letter Home** (`screen:'letter'`): 5 sentence frames pre-filled from remembered facts (name, home country, a friend, a place, the dream or a purchase). Each is typed/spoken (independent), picked from 3 suggestions (assisted) or translated (assisted). Only the written Japanese is stored; **no audio is recorded**. A card is rendered and can be saved as an image (local download). Hanako reads it back (TTS): 「これがあなたの日本語(にほんご)です。すばらしい！」*This is your Japanese. Wonderful!* «هذه هي يابانيتك. رائع!»
Reward: ¥10,000, title `t_lives_in_ja` 日本語(にほんご)で暮(く)らす人(ひと) Someone who lives in Japanese / من يعيش باليابانية. **Free Walk** begins (`chapter.n = 9`): everything stays open, daily goals continue, the `car` dream and the car items open. Each chapter's closing beat also asks for a one-line **diary entry** (2 taps or a typed sentence) that is stored and replayed into the Letter.

### 7.3 Dream goals

Picked in the world **at Chapter 1's closing beat** (the default suggested from the onboarding goal is used silently until then: travel → `travel`, work → `phone_pal`, relocation → `flat`, casual → `festival`; kids/teens never see `flat`, `fresh_start` or `car`). Changeable any time (free) from the Dream chip; progress is **derived from state**, so nothing is lost when switching. `fresh_start` is available from the start (it is the user's own example; about five weeks for a casual player, §4.6); `car` opens at **Free Walk** (Chapter 8 completed). Finale reward = title + keepsake + a short beat with the friends involved; **no yen** (D20).

| id | JA (reading) | EN | AR | Horizon | Age |
|---|---|---|---|---|---|
| `phone_pal` | 友(とも)だちとスマホ | My own phone, friends in my pocket | هاتفي الخاص وأصدقائي في جيبي | short | all |
| `bike` | 自転車(じてんしゃ)でたんけん | Explore by bike | استكشف بالدراجة | short | all |
| `flat` | 自分(じぶん)の部屋(へや) | My own flat | شقتي الخاصة | long | 18+ |
| `festival` | ミオとお祭(まつ)り | Befriend Mio, go to the festival | صداقة ميو والذهاب إلى المهرجان | medium | all |
| `travel` | ICカードでたび | IC card and a first trip | بطاقة IC ورحلتي الأولى | short | all |
| `fresh_start` | 新(あたら)しい生活(せいかつ) | Fresh start: phone + bike + flat | بداية جديدة: هاتف ودراجة وشقة | long | 18+ |
| `car` | 自分(じぶん)の車(くるま) | My own (kei) car | سيارتي الخاصة (كي-كار) | epilogue | 18+ |

Ladders (`gate` = chapter in which the step becomes visible; titles in the right column):

| Dream | Steps (gate): pred → EN / AR | Title on finale |
|---|---|---|
| `phone_pal` | s1 (2) `words_known tag:numbers n:8` Learn 8 number words / تعلّم 8 كلمات أرقام · s2 (3) `hearts tanaka ≥1` Get to know Tanaka, the phone-and-games fan / تعرّف على تاناكا · s3 (4) `own category:phone` Buy your own phone / اشترِ هاتفك الخاص · s4 (4) `phone_chat n:3 friends:2` Chat with 2 different friends / تحدّث مع صديقين مختلفين · s5 (4) `hearts_count ≥2 n:3` Have three 2-heart friends / كوّن ثلاثة أصدقاء بقلبين | `t_dream_phone_pal` 連絡(れんらく)のたつじん Connector / متواصل ماهر |
| `bike` | s1 (2) `words_known tag:direction n:6` Learn 6 direction words / تعلّم 6 كلمات اتجاهات · s2 (3) `scenario sato_directions minIndependent:2` Ask Sato the way, in Japanese / اسأل ساتو عن الطريق باليابانية · s3 (5) `own category:bicycle` Buy and register your bike / اشترِ دراجتك وسجّلها · s4 (5) `own item:bike_helmet` Get a helmet / احصل على خوذة · s5 (5) `all(visit spot:pond, visit spot:torii)` Ride to the pond and the torii gate / اركب إلى البركة وبوابة توريي | `t_dream_bike` 自転車(じてんしゃ)たんけんか Bike explorer / مستكشف الدراجة |
| `flat` | s1 (2) `words_known tag:home n:8` Learn 8 home and room words / تعلّم 8 كلمات عن البيت · s2 (3) `hearts aiko ≥1` Get to know Aiko, the landlady / تعرّف على أيكو · s3 (6) `scenario aiko_viewing complete` See the room, ask good questions / شاهد الغرفة واطرح أسئلة جيدة · s4 (6) `own item:home_room_ono` Sign and pay the move-in cost / وقّع وادفع تكاليف الانتقال · s5 (6) `item_placed n:3` Furnish your room with 3 things / أثّث غرفتك بثلاث قطع | `t_dream_flat` 部屋(へや)のあるじ Master of my room / صاحب غرفتي |
| `festival` | s1 (2) `hearts mio ≥1` Say hello to Mio and learn her name / حيِّ ميو · s2 (3) `hearts mio ≥2` Become friends with Mio / كن صديقًا لميو · s3 (4) `own item:yukata` Buy a yukata with Rin's help / اشترِ يوكاتا بمساعدة رين · s4 (6) `hearts mio ≥4` Get to 4 hearts with Mio / اوصل إلى 4 قلوب مع ميو · s5 (7) `scenario matsuri_stalls minIndependent:3` Go to the festival stalls / اذهب إلى بسطات المهرجان | `t_dream_festival` 祭(まつ)りの仲間(なかま) Festival friend / رفيق المهرجان |
| `travel` | s1 (2) `words_known tag:transport n:8` Learn 8 train words / تعلّم 8 كلمات عن القطار · s2 (3) `own item:ic_card` Buy an IC card and load it / اشترِ بطاقة IC واشحنها · s3 (5) `visit trip:hikarigaoka` Take your first trip / قم برحلتك الأولى · s4 (5) `flag ticket_bought` Buy a paper ticket at a machine / اشترِ تذكرة ورقية من الآلة · s5 (5) `flag souvenir_given` Bring back a souvenir (omiyage) for a friend / أحضر هدية تذكارية لصديق | `t_dream_travel` 旅(たび)のはじまり First journey / الرحلة الأولى |
| `fresh_start` | s1 (4) `own category:phone` · s2 (5) `own category:bicycle` · s3 (6) `own item:home_room_ono` · s4 (6) `item_placed n:3` · s5 (6) `hearts_count ≥3 n:3` · s6 (7) `flag housewarming` Invite a friend to your flat / ادعُ صديقًا إلى شقتك | `t_dream_fresh_start` 新生活(しんせいかつ) Fresh Start / بداية جديدة |
| `car` | s1 (FW) `words_known tag:car n:8` · s2 (FW) `hearts nakamura ≥3` · s3 (FW) `wallet atLeast:198000` (cash only; shown as a savings jar) · s4 (FW) `own category:car` · s5 (FW) `flag first_drive` (ride-along beat) | `t_dream_car` ドライバー Driver / سائق |

**Dream tracker** (HUD chip + Quests tab): shows the next step, a progress ring (steps done/total), the **yen bar** `min(1, cash / remainingCost)` (cash only, §4.1) and the **language gate** ("opens in Chapter N, M objectives left"), and a pace estimate `eta = ceil(max(0, remainingCost − cash) / max(1, avgNetIncomeLast7Days))` → "≈ 12 days at your pace" (hidden until 3 days of data; shown as "more than 60 days" beyond that). `remainingCost` is the sum of the dream's unowned items **plus** bulky-item delivery and, for `item_placed n:3`, the three cheapest small goods (`fresh_start` therefore counts ¥111,900: phone, bike with registration, flat and ¥6,700 of goods). Both constraints always show, so the player learns that speaking is the lever.

**Milestone at step 2.** Finishing step 2 of any dream plays a one-line beat from the template `b_dream_step` (Hanako: 「いい調子(ちょうし)ですね。もうすこしです。」 *You're doing well. Almost there.* «تتقدم جيدًا. اقتربت.») and grants a cosmetic **dream sticker** `st_<dream>` (an HUD chip colour and a wardrobe accent). Every dream therefore pays something visible by day 5-10. Cosmetic only, no yen.

### 7.4 Daily goals (3 per day, 2 for kids)

Counters are kept per day for the last two days. A goal stays open for **two days** (the day it is generated and the next): an unfinished goal from yesterday shows as *From yesterday* and pays the same when finished (no penalty text; it quietly goes away after its second day). A goal's predicate counts from its own creation day. Goals use **substantive** lines (§3.2); `g_indep6` and `g_newphrase2` count class-I turns only.

| id | Slot | Today predicate | EN | AR | Requires |
|---|---|---|---|---|---|
| `g_conv2` | speak | 2 *different* conversations finished (≥ 50% steps) | Finish 2 different conversations | أنهِ محادثتين مختلفتين | — |
| `g_indep6` | speak | 6 substantive independent lines | Say 6 lines in your own words | قل 6 جمل بكلماتك أنت | — |
| `g_newphrase2` | speak | 2 intents you never used independently before | Use 2 new ways of saying things | استخدم طريقتين جديدتين للتعبير | — |
| `g_buy` | do | a completed `charge` | Buy something in Japanese | اشترِ شيئًا باللغة اليابانية | Ch1 |
| `g_shift` | do | a shift with accuracy ≥ 0.6 | Finish a shift | أنهِ وردية | a job unlocked |
| `g_friend` | do | talk with / chat with / give a gift to a friend | Spend time with a friend | اقضِ وقتًا مع صديق | Ch3 |
| `g_place` | do | complete conversations in 2 different places | Talk to people in 2 different places | تحدّث مع أشخاص في مكانين مختلفين | — |
| `g_review8` | review | 8 **due** cards (each with ≥ 1 earlier review) answered through a **check**: the Vocab screen's pick-the-answer mode or a typed answer; a self-rated flip does not count (fewer due → "all due"; none due → swapped for `g_newphrase2`) | Review 8 words that are due | راجع 8 كلمات مستحقة | ≥ 1 card |
| `g_lesson` | review | finish a lesson | Finish a lesson | أنهِ درسًا | — |
| `g_culture` | review | read 1 new culture card | Learn one new thing about Japan | تعلّم شيئًا جديدًا عن اليابان | a card not yet seen |

**Rewards:** ¥100 per goal, **+¥150 when all three are done** (each day's own trio), plus a **streak bonus** `¥15 · min(streakDays, 10)` paid once per day with the first goal done. Maximum ¥600/day (kids' 2-goal day: ¥450), about 16% of a casual player's income (§4.2). A broken streak never removes money (streak freezes are the existing mechanic), and because a goal stays open two days, a missed day forfeits nothing that day's goals could still earn tomorrow.
**Generation** (`daily.generate`, deterministic: `seed = hash(dayIndex + profile.createdAt)`): one template per slot, filtered by `requires`, excluding yesterday's template of that slot; **priority overrides**: review = `g_review8` if due ≥ 10; do = `g_shift` if a job is unlocked and no shift for 4 days; do = `g_friend` if friends are unlocked and none contacted for 3 days; speak = `g_conv2` if ≤ 1 conversation in the last 3 days. One free **swap** per day (another template of the same slot; never pays more). `g_conv2` and `g_buy` count completions whatever the help level (they pay less through §3.3 anyway); `g_indep6` and `g_newphrase2` are independent by definition.

### 7.5 HUD and Quests screen

- **HUD** (extends `WorldScreen`, not the conversation screen; shown progressively, §2.5): wallet pill; a **tracker card** (replaces today's "Next up" card, same look: portrait + title + walk-to button) showing the next best goal (§11.7) with a minimap pin; a **Dream chip** (ring + next step) after Chapter 1; a phone icon with unread badge after the phone is owned; at most 4 elements on a 360 px screen.
- **Quests screen** (`screen:'quests'`): tabs **Dream · Story · Today · Friends · Culture**. Story lists the current chapter's objectives with progress ("2/4 lines"), the *Make it easier* row when offered, the *Done! … more days* message when only `minDays` is left, and locked chapters teased by name; Today shows the 3 daily goals plus *From yesterday*; Friends shows hearts and the next unlock; Culture is the stamp book (a card's key phrase has a hidden-line **Say it**). Completion UX: tick + toast; chapter completion = reward card + beat; dream step = ring animation. Strings: `strings/quests.ts`, `strings/social.ts`, `strings/culture.ts` (EN + AR).

### 7.6 UI strings introduced by the game (canonical EN / AR; keys are prefixed by module)

| Key | EN | AR |
|---|---|---|
| `hud.wallet` | Wallet | المحفظة |
| `hud.ic` | IC card | بطاقة IC |
| `hud.points` | Points | النقاط |
| `hud.workHours` | ≈ {n} h of work | ≈ {n} ساعة عمل |
| `hud.moreYen` | ¥{n} to go | بقي ¥{n} |
| `hud.nextUp` | Next goal | الهدف التالي |
| `hud.moreGoals` | More goals | المزيد من الأهداف |
| `hud.pace` | About {n} days at your pace | نحو {n} يومًا بوتيرتك |
| `hud.softCap` | Shops are quiet today. Extra practice still counts toward chapters. | المتاجر هادئة اليوم. التدريب الإضافي ما زال يُحتسب للفصول. |
| `hud.cantListen` | I can't listen right now | لا أستطيع الاستماع الآن |
| `shop.taxIncluded` | tax included | شامل الضريبة |
| `shop.notEnough` | Not enough yen | الين لا يكفي |
| `shop.closed` | Not open yet | لم يُفتح بعد |
| `shop.opensIn` | Opens in Chapter {n} | يُفتح في الفصل {n} |
| `shop.someday` | Someday (18+) | يومًا ما (18+) |
| `shop.goods` | Look at the goods | تفقّد البضائع |
| `shop.delivery` | Delivery ¥{n} | التوصيل ¥{n} |
| `shop.owned` | You have this | لديك هذا |
| `shop.window` | Look through the window | انظر عبر النافذة |
| `receipt.subtotal` | 小計 · Subtotal | 小計 · المجموع الفرعي |
| `receipt.tax` | 消費税 · Tax | 消費税 · الضريبة |
| `receipt.total` | 合計 · Total | 合計 · الإجمالي |
| `receipt.paid` | お預かり · Paid | お預かり · المدفوع |
| `receipt.change` | お釣り · Change | お釣り · الباقي |
| `debrief.stars` | Stars | النجوم |
| `debrief.yenTitle` | Your pay | أجرك |
| `debrief.nudge` | Try the next one without a chip: about +¥{n} | جرّب التالي بلا اقتراحات: نحو +¥{n} |
| `debrief.keep` | Keep these | احتفظ بهذه |
| `debrief.sayIt` | Say it | قلها |
| `debrief.echoPaid` | Said it yourself: +¥{n} | قلتها بنفسك: +¥{n} |
| `prep.title` | Get ready | استعدّ |
| `prep.skip` | Skip (no +10% prepared bonus) | تخطَّ (بلا مكافأة الاستعداد 10%) |
| `prep.ready` | You're ready | كل شيء جاهز |
| `prep.mode.guided` | Guided | موجَّه |
| `prep.mode.real` | Real (no chips, +25%) | حقيقي (بلا اقتراحات، +25%) |
| `prep.recall` | Say it from memory | قلها من الذاكرة |
| `prep.peek` | Peek (no bonus for this line) | ألقِ نظرة (بلا مكافأة لهذه الجملة) |
| `prep.build` | Build it from the pieces | ابنِها من القطع |
| `dream.title` | Your dream | حلمك |
| `dream.pick` | What do you want to achieve here? | ماذا تريد أن تحقق هنا؟ |
| `dream.later` | Decide later | قرّر لاحقًا |
| `dream.change` | Change dream | غيّر الحلم |
| `dream.step` | Next step | الخطوة التالية |
| `dream.locked` | Opens in Chapter {n} | يُفتح في الفصل {n} |
| `dream.done` | Dream complete! | اكتمل الحلم! |
| `quests.tab.dream` / `.story` / `.today` / `.friends` / `.culture` | Dream · Story · Today · Friends · Culture | الحلم · القصة · اليوم · الأصدقاء · الثقافة |
| `quests.chapter` | Chapter {n} | الفصل {n} |
| `quests.chapterDone` | Chapter complete | اكتمل الفصل |
| `quests.trio` | All three done: +¥{n} | أنجزت الثلاثة: +¥{n} |
| `quests.swap` | Swap one goal | بدّل أحد الأهداف |
| `quests.locked` | Opens in Chapter {n} | يُفتح في الفصل {n} |
| `quests.waitDays` | Done! The next chapter opens after {n} more days of practice | أنجزت! يُفتح الفصل التالي بعد {n} أيام أخرى من التدريب |
| `quests.easier` | Make it easier | اجعلها أسهل |
| `quests.fromYesterday` | From yesterday | من الأمس |
| `quests.hintFriends` | Make sure two friends are at 2 hearts | تأكد أن صديقين وصلا إلى قلبين |
| `social.hearts` | Hearts | القلوب |
| `social.next` | Next at {n} hearts: {what} | عند {n} قلوب: {what} |
| `social.gift` | Give a gift | قدّم هدية |
| `social.card` | Friend card | بطاقة الصديق |
| `social.heartUp` | {name} likes you more now! | {name} يحبك أكثر الآن! |
| `social.notYet` | Not yet | ليس بعد |
| `phone.title` | Messages | الرسائل |
| `phone.voice` | Voice message (tap to listen) | رسالة صوتية (اضغط للاستماع) |
| `phone.reveal` | Show text | أظهر النص |
| `phone.unread` | {n} new | {n} جديدة |
| `jobs.start` | Start shift | ابدأ الوردية |
| `jobs.helping` | Helping out | مساعدة |
| `jobs.showText` | Show Japanese text (×0.7) | أظهر النص الياباني (×0.7) |
| `jobs.showTrans` | Show translation (×0.5) | أظهر الترجمة (×0.5) |
| `jobs.pay` | You earned ¥{n} | ربحت ¥{n} |
| `jobs.rest` | Enough for today. Come back tomorrow! | يكفي لهذا اليوم. عُد غدًا! |
| `home.shoesOff` | Take shoes off | اخلع الحذاء |
| `home.slippers` | Put on slippers | البس الخف |
| `culture.new` | New culture card | بطاقة ثقافية جديدة |
| `letter.title` | Letter Home | رسالة إلى الأهل |
| `story.nameKana` | Your name in katakana | اسمك بالكاتاكانا |
| `audio.consent` | On Chrome, voice recognition sends your audio to Google. Typing never leaves your device. Allow voice input? | في Chrome يرسل التعرّف على الصوت تسجيلك إلى Google. الكتابة لا تغادر جهازك أبدًا. هل تسمح بالإدخال الصوتي؟ |
| `audio.consentKids` | Voice input is off. A grown-up can turn it on in Settings. | الإدخال الصوتي متوقف. يمكن لشخص بالغ تفعيله من الإعدادات. |
| `audio.parentGate` | Grown-ups only: what is {a} + {b}? | للبالغين فقط: كم يساوي {a} + {b}؟ |
| `audio.listenOff` | I can't listen: show text, no penalty | لا أستطيع الاستماع: أظهر النص دون خصم |

Every key is added to both `en` and `ar` of its module (the existing `Record<keyof typeof en, string>` typing enforces parity); numerals stay Latin digits.

**Who owns which key prefix.** `t()` is typed by the union of all keys, so a key must exist the moment any file uses it: **1A pastes every key of this table, with EN and AR, into the module named here during slice 1**, and later agents only add keys inside their own module. `hud.*` → `strings/hud.ts` (2B); `shop.*`, `receipt.*` → `strings/wallet.ts` (2G); `debrief.*` → `debrief.ts` (2C); `prep.*` → `prepare.ts` (2E); `dream.*`, `quests.*` → `quests.ts` (2F); `social.*` → `social.ts` (4A); `phone.*` → `phone.ts` (4C); `jobs.*` → `jobs.ts` (4D); `home.*` → `home.ts` (5A); `culture.*` → `culture.ts` (4F); `letter.*`, `story.*` → `story.ts` (5C); `audio.*` → `audio.ts` (existing; 5D).

**Pick routing and pins (2B):** world `pick` ids are routed *game first*: `door:*`, `ramen_machine`, `ticket`, `vending` open their panel/sheet (the panel's first open grants the existing sign discovery and word card, so nothing is lost); every other id keeps today's sign-word-card behaviour. `MiniMap` accepts a *pin* (`{x,z}` or an NPC id) in addition to its current `target`, used by objective `pin`s, plan pins from chat and the dream tracker.

---

## 8. Friends

### 8.1 Roster (9 friends; ids are `Character.id`)

`register` = how the character speaks *to the player*; `casualAt` = hearts at which a friend switches to plain form (the feedback engine then treats casual speech with that friend as correct and stiff keigo as "distant, not wrong"; casual with staff is flagged, §11.4).

| id | JA (reading) / EN / AR | Age · job | Place | Topics | Register / casualAt | Appears | Depth |
|---|---|---|---|---|---|---|---|
| `mio` | ミオ / Mio / ميو | 19 · student | park | anime, photo, music | polite → casual ♥2 | start | facts, hang-out, home, ♥5 scene |
| `yuki` | ゆき / Yuki / يوكي | 24 · barista | café | music, art, food | polite → casual ♥3 | start | facts, hang-out, ♥4 beat, ♥5 beat |
| `tanaka` | 田中(たなか) / Tanaka / تاناكا | 31 · konbini clerk | konbini | gaming, tech, anime | polite always (models staff keigo) | start | facts, ♥4/♥5 beats |
| `sato` | 佐藤(さとう) / Sato / ساتو | 58 · station attendant | station | history, travel, culture | formal always, slow | start | facts, ♥4/♥5 beats |
| `kenji` | けんじ / Kenji / كينجي | 45 · ramen chef | ramen | food, sports, culture | polite → gruff casual ♥3 | start | facts, hang-out, home, ♥5 scene |
| `hanako` | 花子先生(はなこせんせい) / Hanako-sensei / المعلّمة هاناكو | 38 · teacher | school | books, culture, travel | polite always | start | facts, ♥4/♥5 beats |
| `aiko` | 小野愛子(おのあいこ) / Aiko Ono / أيكو أونو | 68 · tea-house owner, landlady | ono | culture, nature, family, food | polite-soft always (です/ます + ね/よ), calls you ちゃん/くん | Ch2 | facts, hang-out, home, ♥5 scene |
| `rin` | 高橋凜(たかはしりん) / Rin Takahashi / رين تاكاهاشي | 16 · student, works at Fuku-Fuku | fukufuku | fashion, gaming, social | polite to customers; casual with friends from ♥2 (like Mio) | C2 (shop), friend C3 | facts, ♥4/♥5 beats |
| `nakamura` | 中村大地(なかむらだいち) / Daichi Nakamura / داييتشي ناكامورا | 36 · mechanic, shop owner | motors | cars, sports, family | keigo when selling, plain with friends ♥3 | Ch5 | facts, ♥4/♥5 beats |

Staff-only (no hearts): `aoi` (Hikari Denki), `kato` (Hikarigaoka souvenir shop, trip only), `hina` (Kenji's daughter, scenery in his home).

### 8.2 New character data (`tokyo/characters-extra.ts`, same `Character` shape; avatar colours use the existing `AvatarSpec`)

```ts
{ id:'aiko', name:{ja:'小野 愛子', reading:'おの あいこ', en:'Aiko Ono', ar:'أيكو أونو'}, age:68,
  job:{en:'Tea-house owner and landlady', ar:'صاحبة بيت شاي ومؤجّرة'},
  bio:{en:'Runs the tea and sweets stall under her old apartment building. Slow, warm, and always has a snack for you.',
       ar:'تدير كشك الشاي والحلوى أسفل مبنى شققها القديم. هادئة ودافئة ولديها دائمًا وجبة خفيفة لك.'},
  personality:{en:'Gentle, patient', ar:'لطيفة وصبورة'}, interests:['culture','nature','family','food'],
  speaking:{rate:0.8, pitch:1.0, voice:'f'},
  avatar:{skin:'#efc7a8', hair:{style:'bun',color:'#b9b9c4'}, top:'#8a6f8e', bottom:'#4a4a55', shoes:'#5a4a44', accent:'#e7e2d6', accessories:['apron','glasses'], height:0.94},
  locationId:'ono', scenarioId:'aiko_tea' },
{ id:'rin', name:{ja:'高橋 凜', reading:'たかはし りん', en:'Rin Takahashi', ar:'رين تاكاهاشي'}, age:16,
  job:{en:'Student, works at her aunt\'s shop', ar:'طالبة، تعمل في متجر عمّتها'},
  bio:{en:'Sharp, funny, talks fast. Knows every second-hand bargain and every meme.',
       ar:'ذكية ومرحة وتتحدث بسرعة. تعرف كل صفقة مستعملة وكل ميم.'},
  personality:{en:'Quick, cheeky', ar:'سريعة البديهة ومشاكسة'}, interests:['fashion','gaming','social'],
  speaking:{rate:1.15, pitch:1.3, voice:'f'},
  avatar:{skin:'#f4d0b4', hair:{style:'short',color:'#7a2f3a'}, top:'#ee8fa6', bottom:'#2d3142', shoes:'#ffffff', accent:'#f4c542', accessories:['beanie']},
  locationId:'fukufuku', scenarioId:'fuku_clothes' },
{ id:'nakamura', name:{ja:'中村 大地', reading:'なかむら だいち', en:'Daichi Nakamura', ar:'داييتشي ناكامورا'}, age:36,
  job:{en:'Mechanic and owner of Nakamura Motors', ar:'ميكانيكي وصاحب ورشة ناكامورا'},
  bio:{en:'Grew up in his father\'s garage. Gruff voice, soft heart; treats customers like neighbours.',
       ar:'نشأ في ورشة أبيه. صوته خشن وقلبه رقيق ويعامل الزبائن كجيران.'},
  personality:{en:'Gruff, kind', ar:'خشن وطيب'}, interests:['cars','sports','family'],
  speaking:{rate:1.0, pitch:0.75, voice:'m'},
  avatar:{skin:'#e9c19c', hair:{style:'short',color:'#2a2220'}, top:'#2f5ea8', bottom:'#2f5ea8', shoes:'#1d1d24', accent:'#f4c542', accessories:['cap'], stocky:1.1},
  locationId:'motors', scenarioId:'motors_visit' },
{ id:'aoi', name:{ja:'鈴木 葵', reading:'すずき あおい', en:'Aoi Suzuki', ar:'أوي سوزوكي'}, age:24,
  job:{en:'Clerk at Hikari Denki', ar:'موظفة في متجر هيكاري دنكي'},
  bio:{en:'Loves gadgets and games. Speaks careful shop Japanese and explains prices very clearly.',
       ar:'تحب الأجهزة والألعاب. تتحدث يابانية المتاجر بعناية وتشرح الأسعار بوضوح شديد.'},
  personality:{en:'Careful, polite', ar:'دقيقة ومهذبة'}, interests:['tech','gaming','social'],
  speaking:{rate:1.0, pitch:1.2, voice:'f'},
  avatar:{skin:'#f3cdb0', hair:{style:'ponytail',color:'#2f2a44'}, top:'#1f5fbf', bottom:'#2d3142', shoes:'#ffffff', accent:'#ffd166', accessories:['glasses']},
  locationId:'denki', scenarioId:'denki_phone' },
{ id:'kato', name:{ja:'加藤', reading:'かとう', en:'Kato', ar:'كاتو'}, age:52,
  job:{en:'Souvenir shop owner, Hikarigaoka', ar:'صاحب متجر هدايا تذكارية في هيكاريغاؤكا'},
  bio:{en:'Sells sweets and keychains by the station and loves telling visitors about the neighbourhood.',
       ar:'يبيع الحلوى وميداليات المفاتيح بجوار المحطة ويحب إخبار الزوار عن الحيّ.'},
  personality:{en:'Chatty, welcoming', ar:'ثرثار ومضياف'}, interests:['travel','food','history'],
  speaking:{rate:1.0, pitch:0.9, voice:'m'},
  avatar:{skin:'#e9c19c', hair:{style:'short',color:'#4a4a55'}, top:'#7aa0c4', bottom:'#3a3f50', shoes:'#4a3f3a', accent:'#f4f4f4', accessories:['apron']},
  locationId:'hikarigaoka', scenarioId:'trip_hikarigaoka' },
{ id:'hina', name:{ja:'ひな', reading:'ひな', en:'Hina', ar:'هينا'}, age:7, /* only in home_kenji, simple A1 lines */
  job:{en:'Kenji\'s daughter', ar:'ابنة كينجي'}, bio:{en:'Seven years old and very curious.', ar:'عمرها سبع سنوات وفضولية جدًا.'},
  personality:{en:'Curious', ar:'فضولية'}, interests:['art','nature'], speaking:{rate:1.1, pitch:1.5, voice:'f'},
  avatar:{skin:'#f8dcc6', hair:{style:'ponytail',color:'#3a2b2a'}, top:'#f4c542', bottom:'#4f86f7', shoes:'#ffffff', accent:'#ee8fa6', accessories:[], height:0.62},
  locationId:'home_kenji' }
```
Game-side friend data (`FriendDef`, in the pack): `{ id, tier, register, casualAt, unlockChapter, home?, loves[], likesTags[], dislikes[], facts[3], perks[] }` (§8.4-8.9).

### 8.3 Hearts and affinity points (AP)

Hearts `h = number of thresholds ≤ ap` over `[30, 80, 150, 240, 350]` (0-5 hearts). AP never decreases, there is no decay, and absence only produces a friendly message.

| Source | AP | Cap |
|---|---|---|
| First conversation (`met`) | +20 once | — |
| **Talk** (a completed talk/shop/friend/small-talk scenario with that character) | `5` if ≥ 60% of steps + `round(4·share)` + callbacks (3 each, ≤ 6, **inside the 15**); `share = substantive independent / (independent + assisted)` | 15 per talk, **one counted talk per day** per friend |
| **Gift** (§8.5) | `tierAP × taste`, capped at 40% of the AP still needed for the next heart (max 30); ×0.5 for a bare or assisted hand-over; ×0.5 more on a day with no talk with that friend | 1 gift per friend per day |
| **Hang-out** (♥3+) | +25 if `share ≥ 0.5`, else +10 | 1 per 3 days |
| **Phone chat** (phone + ♥2+) | +4 (needs ≥ 2 substantive lines or a goal step) | 8 per day |
| **Heart events** (♥2 note, ♥4 beat, ♥5 scene) | fixed (+10) | — |
| 5 days away | none lost; `chat_miss` text 「元気？」 gives an easy +6 | — |

**Daily AP cap per friend: 60** (the sum of everything above; callbacks are already inside the talk's 15, and a callback in a phone chat is part of that chat's +4). Earliest possible ♥5 is day 6; realistic is 12-20 days. Heart-up moment: the friend's reaction (emotion + a line) on the Debrief "Friends" strip with a ♥ fill animation.

### 8.3a Small talk (`smalltalk_<id>`, the daily heart engine)

Small talk is the interaction a player repeats most, so it is specified, not merely "generated":

- **Shape** (shared by all friends; 4 nodes, 2-3 minutes, `pay:'none'`): `greet` (the friend greets you by name; at ♥2+ a callback may appear) → `topic` (the friend raises **one topic** and asks you something) → `follow` (a reaction to your answer, plus the **fact reveal** when one is due) → `close` (a farewell that points at tomorrow or a hang-out). Goal steps: `greet`, `answer`, `react`.
- **Topics.** Each friend has **6-8 eligible topics**: 2 *friend-specific* topics (from their facts and interests: Yuki's cat Mocha, Kenji's broth) plus 4-6 **shared topic templates** chosen by the friend's `interests` tags. 12 shared templates exist (`food`, `music`, `anime`, `games`, `travel`, `weather`, `weekend`, `family`, `town`, `study`, `fashion`, `sports`), each a friend line, 2 suggestion chips, keyword intents and a follow-up, parameterised by register (`SayVariant`) and a per-friend noun. About 12 shared and 18 friend-specific topics in total, authored once (4B-a).
- **No repeat.** A topic is not offered again within 5 days (`friends[id].topicDay`); the picker prefers the topic that carries a due fact reveal. A fact (§8.4) is revealed in the `follow` node of the first talk after the friend reaches the heart that unlocks it, and every friend has at least one `remember` callback that quotes something the player told them.
- **Never cut (§15.8):** topic variety, fact reveals and one callback per friend. Gift-taste variety is cut first.

### 8.4 Memory and callbacks (P1, makes friends feel real)

**They remember you.** `IntentDef.remember` stores facts in `friends[id].facts`: `name`, `country`, `hobby` (already captured by `park`), plus `favFood` (`chat_food`), `dream` (heart-to-heart), `purchase:phone`. Callback templates (the friend says it; any substantive matching reply = +3 AP, inside the talk's cap). Fact reveals and at least one callback per friend are **never cut** (§15.8):

| fact | JA (polite / casual) | EN | AR |
|---|---|---|---|
| `hobby` | {hobby}、最近(さいきん)どうですか？ / {hobby}、最近どう？ | How's {hobby} lately? | كيف حال {hobby} مؤخرًا؟ |
| `favFood` | {food}、また食(た)べましたか？ / {food}、また食べた？ | Did you eat {food} again? | هل أكلت {food} مرة أخرى؟ |
| `purchase:phone` | スマホ、使(つか)いやすいですか？ / スマホ、使いやすい？ | Is the phone easy to use? | هل الهاتف سهل الاستخدام؟ |
| `dream` | 夢(ゆめ)、がんばっていますか？ / 夢、がんばってる？ | Are you working on your dream? | هل تعمل على حلمك؟ |

**You remember them.** Each friend has 3 profile facts revealed at ♥1/♥2/♥3 (stored in `learned`, shown on the Friend card). Occasionally (≥ ♥2) a friend quizzes one: 「わたしのペットの名前(なまえ)、おぼえている？」 *Do you remember my pet's name?* «هل تتذكر اسم حيواني الأليف؟» Correct (typed, or chosen from 3 chips = assisted) = +3 AP and the fact gets a gold frame; wrong = no penalty.

| friend | id | ♥ | JA | EN | AR |
|---|---|---|---|---|---|
| mio | `likes_anime` | 1 | わたしはアニメが好(す)きです。 | I like anime. | أحب الأنمي. |
| mio | `photo_sakura` | 2 | 春(はる)に桜(さくら)の写真(しゃしん)をとります。 | In spring I take photos of cherry blossoms. | في الربيع ألتقط صورًا لأشجار الكرز. |
| mio | `lives_alone` | 3 | ひとりで住(す)んでいます。 | I live alone. | أعيش وحدي. |
| yuki | `guitar` | 1 | 週末(しゅうまつ)にギターを弾(ひ)きます。 | I play guitar on weekends. | أعزف الغيتار في عطلة نهاية الأسبوع. |
| yuki | `cat` | 2 | ねこがいます。名前(なまえ)はモカです。 | I have a cat. Her name is Mocha. | لدي قطة اسمها موكا. |
| yuki | `dream_live` | 3 | いつか、ライブをしたいです。 | Someday I want to do a live show. | أريد يومًا ما أن أقيم حفلًا حيًا. |
| tanaka | `games_night` | 1 | 毎晩(まいばん)ゲームをします。 | I play games every night. | ألعب كل ليلة. |
| tanaka | `sleepy` | 2 | 夜(よる)はちょっと眠(ねむ)いです。 | At night I get a little sleepy. | أشعر بالنعاس قليلًا في الليل. |
| tanaka | `dream_game` | 3 | ゲームの会社(かいしゃ)で働(はたら)きたいです。 | I want to work at a game company. | أريد أن أعمل في شركة ألعاب. |
| sato | `thirty_years` | 1 | 三十年(さんじゅうねん)、この駅(えき)で働(はたら)いています。 | I've worked at this station for 30 years. | أعمل في هذه المحطة منذ ثلاثين عامًا. |
| sato | `old_trains` | 2 | 古(ふる)い電車(でんしゃ)が好(す)きです。 | I like old trains. | أحب القطارات القديمة. |
| sato | `grandson` | 3 | 孫(まご)は五歳(ごさい)です。 | My grandson is five years old. | حفيدي عمره خمس سنوات. |
| kenji | `broth` | 1 | スープは十二時間(じゅうにじかん)煮(に)ます。 | I simmer the broth for 12 hours. | أغلي المرق اثنتي عشرة ساعة. |
| kenji | `baseball` | 2 | 野球(やきゅう)が大好(だいす)きです。 | I love baseball. | أحب البيسبول كثيرًا. |
| kenji | `daughter_hina` | 3 | 娘(むすめ)のひなは七歳(ななさい)です。 | My daughter Hina is seven. | ابنتي هينا عمرها سبع سنوات. |
| hanako | `teach_songs` | 1 | 歌(うた)で日本語(にほんご)を教(おし)えます。 | I teach Japanese with songs. | أعلّم اليابانية بالأغاني. |
| hanako | `calligraphy` | 2 | 書道(しょどう)が趣味(しゅみ)です。 | My hobby is calligraphy. | هوايتي الخط. |
| hanako | `letters` | 3 | 毎年(まいとし)、生徒(せいと)の手紙(てがみ)を読(よ)みます。 | Every year I read my students' letters. | أقرأ كل عام رسائل طلابي. |
| aiko | `shop_forty` | 1 | このお店(みせ)は四十年(よんじゅうねん)です。 | This shop is forty years old. | عمر هذا المتجر أربعون عامًا. |
| aiko | `garden_sakura` | 2 | 庭(にわ)に桜(さくら)があります。 | There is a cherry tree in the garden. | في الحديقة شجرة كرز. |
| aiko | `grandchildren` | 3 | 孫(まご)は大阪(おおさか)に住(す)んでいます。 | My grandchildren live in Osaka. | أحفادي يعيشون في أوساكا. |
| rin | `second_year` | 1 | 高校(こうこう)二年生(にねんせい)だよ。 | I'm a second-year high schooler. | أنا في الصف الثاني الثانوي. |
| rin | `saturdays` | 2 | 土曜日(どようび)はここでバイト。 | Saturdays I work here part-time. | أعمل هنا بدوام جزئي أيام السبت. |
| rin | `dream_shop` | 3 | 将来(しょうらい)、服(ふく)の店(みせ)をやりたい。 | In the future I want to run a clothes shop. | أريد في المستقبل أن أدير متجر ملابس. |
| nakamura | `fathers_shop` | 1 | この店(みせ)は父(ちち)の店だった。 | This shop was my father's. | كان هذا المتجر لأبي. |
| nakamura | `daughter_bike` | 2 | 娘(むすめ)は自転車(じてんしゃ)が好きだ。 | My daughter loves bikes. | ابنتي تحب الدراجات. |
| nakamura | `sunday_fishing` | 3 | 日曜日(にちようび)は川(かわ)で釣(つ)りをする。 | On Sundays I go fishing at the river. | أصطاد السمك عند النهر أيام الأحد. |

### 8.5 Gifts

**Mechanic.** Inventory (or the debrief strip) → *Give a gift* near a friend. The hand-over is the tiny scenario `give_gift` (kind `friend`, pays hearts): you say a sentence that **names the item**: 「{item}、どうぞ。」, 「{item}をあげます。」 or 「プレゼントです。{item}です。」 (the item noun plus どうぞ / プレゼント / あげます, so ≥ 2 content tokens). A bare 「どうぞ。」 or an assisted hand-over gives ×0.5 AP. The friend then reacts and any reply to the reaction completes the exchange. A friend never refuses; reactions are `loved / liked / neutral / disliked` (disliked is gentle: **0 AP**, never rude, never negative). Gifts must be **bought in a conversation** (§5.6): vending-machine drinks are not giftable, so friendship cannot be bought with yen and one word.

```
AP = min( tierAP(price) × taste , giftCap(heart) )       tierAP: < ¥500 → 6 · < ¥1,500 → 10 · < ¥3,000 → 15 · ≥ ¥3,000 → 20
taste: loved ×2.0 · liked ×1.5 · neutral ×1.0 · disliked → 0 AP (the friend still reacts kindly)
giftCap(h) = min(30, round(0.4 × AP needed for heart h+1)) = 12 / 20 / 28 / 30 / 30 at ♥0…♥4
× 0.5 for a bare or assisted hand-over · × 0.5 on a day with no talk with that friend · same item to the same friend within 7 days × 0.25

| reaction | JA polite (reading) | JA casual | EN | AR |
|---|---|---|---|---|
| loved | えっ、本当(ほんとう)ですか？うれしいです！ありがとうございます！ | えっ、ほんと？うれしい！ありがとう！ | Really? I'm so happy! Thank you! | حقًا؟ أنا سعيد جدًا! شكرًا! |
| liked | ありがとうございます。うれしいです。 | ありがとう！うれしい！ | Thank you. I'm happy. | شكرًا. أنا سعيد. |
| neutral | ありがとうございます。 | ありがとう。 | Thank you. | شكرًا. |
| disliked | あ…ありがとうございます。 | あ…ありがとう。 | Oh... thank you. | آه... شكرًا. |

**Arabic gender.** Arabic first- and second-person forms are gendered, so a shared line such as 「うれしい！」 cannot be neutral everywhere. Policy: UI strings (§7.6) are written gender-neutral where Arabic allows; NPC lines spoken by female characters (Mio, Yuki, Rin, Aiko, Aoi, Hanako, Hina) may carry an optional feminine Arabic variant `Gloss.arF` (the reaction table's «أنا سعيد» becomes «أنا سعيدة» for them), and `profile.arAddress: 'm'|'f'` (asked once in Settings, default masculine) selects how NPCs address the learner. Both are on the native-review list (§16.2); until `arF` is authored, the masculine form is the fallback.

Dislike humour lines: tanaka 「毎日(まいにち)見(み)ています…」 *I see these every day…* «أراها كل يوم...» · yuki 「うーん、コーヒーはお店(みせ)のがいいかな。」 *Hmm, I prefer café coffee.* «همم، أفضّل قهوة المقهى.» · rin 「おばあちゃんみたい(笑)」 *Like a grandma's gift (lol).* «كأنها هدية جدة (ههه).»

| friend | Loves (+×2) | Likes (tags, ×1.5) | Dislikes |
|---|---|---|---|
| mio | `g_manga`, `cake`, `g_souvenir` | sweet, cute, media, music | `coffee` |
| yuki | `g_guitar_pick`, `g_tea_set`, `cake` | sweet, music, flower | `coffee`, `g_game_card` |
| tanaka | `g_game_card`, `coffee`, `g_manga` | game, tech, sweet | `onigiri`, `bento` |
| sato | `g_tea_set`, `g_wagashi`, `g_souvenir` | travel, tea, tradition | `g_choco`, `g_game_card` |
| kenji | `g_tenugui`, `greenTea`, `coffee` | sports, food, drink | `g_flower`, `g_plush` |
| hanako | `g_tea_set`, `g_wagashi`, `g_flower` | tradition, flower, craft | `g_choco`, `g_game_card` |
| aiko | `g_souvenir`, `cake`, `g_music_cd` | craft, travel, sweet | `coffee`, `g_game_card` |
| rin | `g_plush`, `g_game_card`, `g_choco` | cute, media, sweet, drink | `g_tea_set`, `g_tenugui` |
| nakamura | `g_carfresh`, `coffee`, `bento` | cars, sports, food | `g_flower`, `g_plush` |

Tests: no item both loved and disliked by one friend; every id exists in §5 and has a sale route in §5.6; every gift is sold in a shop open by the chapter its first fan needs it (`g_carfresh` at Motors from C5, `g_music_cd` at Denki from C4, `g_souvenir` on the trip from C5).

### 8.6 What each heart unlocks (shown on the Friends tab as "Next at ♥n: …")

| ♥ | Name | Unlock |
|---|---|---|
| 0 | 初対面(しょたいめん) Stranger | base scenario; they call you `{name}さん` |
| 1 | 知(し)り合(あ)い Acquaintance | greets you by name; **Friend card** with fact 1; small talk |
| 2 | 友(とも)だち Friend | their **number** (a paper note if you have no phone, a text if you do); **phone chat**; casual switch for Mio and Rin (♥3 for Yuki/Kenji/Nakamura); fact 2 |
| 3 | 仲良(なかよ)し Close | **hang-out** (4 friends have scenarios); a one-time small gift from them; fact 3 |
| 4 | 親友(しんゆう) Best friend | **home visit** (Mio, Aiko, Kenji) or a **heart-to-heart** beat (the others: they share their `dream_*` fact and ask yours → stored as `facts.dream`); small perk |
| 5 | 大親友(だいしんゆう) Closest | **special scene** (Mio, Aiko, Kenji) or a one-card beat, keepsake, title, permanent perk |

### 8.7 Phone chat (the "visit friends" part a)

Text conversations reuse `ConversationSession` with `channel:'chat'`: the same bubble/suggestion/typing components inside a **phone frame** (no camera framing; `Conversation` skips `world.enterConversation`). Lines may be **text**, a **stamp** (sticker id) or a **voice message** (🔊; transcript hidden until tapped = a listening exercise; revealing it marks that exchange assisted, **unless the player has `listenPref:'off'` or AudioMode is `read-and-type`/`type-only`: then voice messages render as ordinary text bubbles with no penalty**, §12.3). Reply by typing Japanese/romaji, speaking (mic), tapping a suggestion (S), or typing English/Arabic (T). Sending a stamp is always allowed and is a 0-AP polite non-line.

**Cadence (no dark patterns):** after you own a phone, at most **one new thread per friend per day**, only for friends at ≥ ♥2, at most **3 unread**; no timers, no expiry, no push, no typing indicator pressure; ignoring a friend never lowers hearts. A finished thread gives +4 AP (cap 8/day) and counts for `phone_chat`. **Topic priority:** (1) pending story message (`chat_first`), (2) callback (`chat_callback`), (3) the friend's plan (`chat_plan`), (4) rotating generic template, avoiding the last 3 used. A plan accepted in chat sets a **map pin** on the friend's place (and offers their hang-out at ♥3+); no schedule system.

| id | Trigger | Friend opening (casual / polite) JA · EN · AR | Learner goal / sample replies | P |
|---|---|---|---|---|
| `chat_first` | phone bought | スマホ、買(か)った？やったー！ / スマホ、買いましたか？よかったです。 · *Did you buy a phone? Yay!* · «اشتريت هاتفًا؟ رائع!» | reply, say which phone/colour: はい、買いました！ 黒(くろ)いスマホです | P0 |
| `chat_greet` | daily | おはよう！今日(きょう)は何(なに)する？ / おはようございます。今日は何をしますか？ · *Morning! What are you doing today?* · «صباح الخير! ماذا ستفعل اليوم؟» | say a plan: 学校(がっこう)に行(い)きます · 買(か)い物(もの)をします | P0 |
| `chat_plan` | ♥2+ | 今日(きょう)、{place}で会(あ)わない？ / 今日、{place}で会いませんか？ · *Want to meet at {place} today?* · «هل نلتقي في {place} اليوم؟» | accept/decline/ask time (below) | P0 |
| `chat_food` | daily | 昼(ひる)ごはん、何(なに)食(た)べた？ · *What did you eat for lunch?* · «ماذا أكلت على الغداء؟» | say a food (stores `favFood`): ラーメンを食べました | P0 |
| `chat_miss` | away ≥ 5 days | 元気(げんき)？ / お元気(げんき)ですか？ · *How are you?* · «كيف حالك؟» | any reply (+6 AP): 元気です | P0 |
| `chat_voice` | ♥2+ | 🔊「駅(えき)の前(まえ)で三時(さんじ)に会(あ)おう」 · *Let's meet in front of the station at three.* · «لنلتقِ أمام المحطة في الثالثة.» | answer place + time: 三時、駅の前ですね | P1 |
| `chat_late` | plan active | ごめん、すこし遅(おく)れる！ · *Sorry, running a bit late!* · «آسف، سأتأخر قليلًا!» | reassure: 大丈夫(だいじょうぶ)です · 待(ま)っています | P1 |
| `chat_teach` | ♥3+ | 「ありがとう」は英語(えいご)で何(なに)？ · *What's "ありがとう" in English?* · «كيف تقول «ありがとう» بالإنجليزية؟» | **you teach them** (answer in your language; accepted without penalty) | P1 |
| `chat_callback` | a fact exists | per §8.4 | any substantive reply | P1 |
| `chat_invite_home` | flat owned | 今度(こんど)、{name}の家(いえ)に行(い)っていい？ · *Can I come to your place sometime?* · «هل يمكنني زيارة بيتك قريبًا؟» | say yes + when: もちろん！どうぞ | P1 |

`chat_teach` is deliberate: the learner becomes the expert for a moment (an emotional reward).

**Worked example `chat_plan` (Mio, casual, A1-A2):**

| node | friend says (JA · EN · AR) | suggestions (S) | intents → next |
|---|---|---|---|
| `start` | 今日(きょう)、公園(こうえん)で会(あ)わない？ · Want to meet at the park today? · هل نلتقي في الحديقة اليوم؟ | いいよ！ · ごめん、今日(きょう)はちょっと… · 何時(なんじ)に？ | `yes` [いいよ, いい, はい, 行く, 行きます] → `time`; `no_polite` [ごめん, ちょっと, すみません] → `decline_ok` (step `reply`); `ask_time` [何時, いつ] → `time` |
| `time` | じゃあ、三時(さんじ)ね！ · Then three o'clock! · إذًا، الساعة الثالثة! | うん、三時ね。 · 三時に行きます。 · もう一度 | `ok_time` [三時, さんじ, 3, わかった, うん, はい] → `done` (step `time`, flag `plan_mio`) |
| `decline_ok` | そっか、じゃあまた今度(こんど)ね！ · I see, another time then! · حسنًا، في مرة أخرى! | ありがとう。 · また今度ね。 | any → `end` (**a polite refusal is rewarded as a goal step**, culture `cc_refuse`) |
| `done` | 楽(たの)しみ！じゃあね！ · Can't wait! Bye! · أتطلع لذلك! إلى اللقاء! | またね！ | end |

### 8.8 Hang-outs and home visits

**Hang-outs** (♥3, 6-8 minutes, `pay:'none'`, +25 AP, one per 3 days; P1; four friends): 

| id | Place | Steps (goal) | Theme words | Reward |
|---|---|---|---|---|
| `hang_mio_photo` | park | pose for a photo → name 3 things you see → pick the best photo (こっちがいい) → thank | 桜, 空, 写真, きれい | keepsake photo |
| `hang_yuki_jam` | café after hours | choose a genre → say what music you like → compliment her playing (上手(じょうず)ですね) → request a song | 歌, 曲, 上手, 好き | café stamp card |
| `hang_kenji_cook` | ramen kitchen | name 3 ingredients → follow steps (切(き)る, 入(い)れる) → taste (もう少(すこ)し塩(しお)) → ごちそうさま | 材料, 塩, 味 | free 替え玉 once |
| `hang_aiko_wagashi` | tea house back room | count sweets (いくつ) → choose a shape/colour → say it is pretty/tasty → thank | 数, 色, 甘い | `g_wagashi` ×1 |

**Home visits** (♥4; three friends + your own room). A door marker on the building (`door:mio`, `door:kenji`, `door:aiko`; §6.4) is active only at ♥4 (before that: 「まだ入れません」). Entry is a **stage** (a procedural interior loaded on demand, `world.enterStage(id)`). Sequence: (1) **genkan interaction** in the stage: tap *shoes off* (the step up is 0.15 m), then *slippers* (wrong order → the host's gentle 「あっ、靴(くつ)を脱(ぬ)いでください！」); success sets `flags.genkan_ok` and culture `cc_shoesoff`; (2) the **`home_<id>` conversation** (6 steps below); (3) leave: stage exit returns the player to the door.

Shared scenario template `home_visit` (every home reuses it with one unique step): `enter` (おじゃまします) → `offer` (accept tea: いただきます) → `look` (compliment: いい部屋(へや)ですね, or ask about a prop) → `unique` → `leave` (おじゃましました。ありがとうございました。). Reward: +25 AP, `visit home:<id>`, culture cards, offer to save 10 words. `pay:'none'`, `register: polite`, A2.

| Home / stage id | Owner | Room (local metres, origin = room centre, +z = genkan side) | Props (JA label, tap = `discover` + word card) | Unique step | Keepsake |
|---|---|---|---|---|---|
| `mio_1r` (`home_mio`) | mio | 1R apartment 5.2 × 3.8; kitchenette, desk, folded futon, poster wall, window onto a cherry tree | くつ, つくえ, カメラ, ポスター, 本棚(ほんだな), 窓(まど) | ask about the poster/camera (anime/photo topic); she shows a photo she took of you | printed photo |
| `aiko_tatami` (`home_aiko`) | aiko | tatami 6-jō 3.6 × 4.5 above the tea shop; kotatsu, zabuton, shōji, tokonoma with a flower, teapot | たたみ, こたつ, ざぶとん, しょうじ, きゅうす, 花(はな) | sit at the kotatsu; she pours tea; she shows the room next door (sets the cosmetic flag `aiko_room_shown`; `aiko_viewing` does not depend on it) | tea cup |
| `kenji_flat` (`home_kenji`) | kenji | family flat 5.2 × 4.4 above the ramen shop; chabudai, rice cooker, family photos, baseball poster, a child's drawing; **Hina** | ちゃぶ台(だい), 炊飯器(すいはんき), 写真(しゃしん), 野球(やきゅう), 絵(え), ざぶとん | home-cooked dinner: いただきます, compliment, answer Hina's three questions (年(とし), どこから, 好(す)きな食(た)べ物(もの)) | Hina's drawing |
| `dorm` / `ono_flat` (**your own room**) | you | dorm 4.0 × 3.6 (bed, desk, window, shelf, plant: 4 slots) until you own `home_room_ono`, then the Aiko tatami layout **unfurnished** with 8 slots (`bed, desk, shelf, table, plant, kitchen, light, tv`) | your placed furniture | housewarming (`flag housewarming`): invite a friend ≥ ♥2 by `chat_invite_home`; scenario `home_own_guest` reverses roles (you say どうぞ、あがってください, offer slippers and tea, answer compliments) | — |

**Comfort** = base (dorm 1, flat 3) + Σ furniture comfort (§5.2), max 16; comfort ≥ 4 lets one friend visit. Placing furniture: tap an inventory item → a slot (`item_placed`). Stage budget: ≤ 12 draw calls each, merged vertex-colour geometry, 3 walls + floor + a cut-away front, hemisphere light + one warm point light, `camera.dist 4.4`. If a stage cannot load (or on devices flagged low-end) the **panel fallback** shows the host portrait over a CSS room backdrop with the two genkan buttons and the same conversation; the game never depends on the 3D interiors.

### 8.9 Heart-5 scenes, heart-4 beats and perks

Each `heart_<id>` is a 4-6 node scenario (`kind:'heart'`), plays once, sets `heart5_seen`, gives +10 AP (so there is nothing to replay), a keepsake, a title and one **permanent perk** (≤ 10%). Mio, Aiko and Kenji get full scenes (P1); the others get a one-card beat with the same data (key line, keepsake, title, perk). Friends without a home get at **♥4 a heart-to-heart beat** (generated `h4_<id>`: they tell you their `dream_*` fact, ask 「{name}の夢(ゆめ)は？」, you answer from 3 chips or freely; `facts.dream` is stored).

| friend | Scene | Key line (JA · EN · AR) | Keepsake | Title | Perk |
|---|---|---|---|---|---|
| mio | dusk photo under the cherry tree | {name}、会(あ)えてよかった。ずっと友(とも)だちだよ。 · {name}, I'm glad we met. We'll always be friends. · {name}، سعيدة بلقائك. سنبقى أصدقاء دائمًا. | framed photo | 親友(しんゆう)ミオ Mio's best friend / صديق ميو المقرّب | festival partner |
| yuki | she plays a song she wrote about your first day | この歌(うた)は{name}のために作(つく)りました。 · I wrote this song for you. · كتبت هذه الأغنية من أجلك. | sheet music | ファンNo.1 Number-one fan / المعجب الأول | café −10% |
| tanaka | break room, he shares his dream | 実(じつ)は、ゲームの会社(かいしゃ)で働(はたら)きたいんです。 · Actually, I want to work at a game company. · في الحقيقة، أريد أن أعمل في شركة ألعاب. | game cartridge | 常連(じょうれん)さん Regular / زبون دائم | konbini −10% |
| sato | quiet night platform, last train | この駅(えき)で三十年(さんじゅうねん)。{name}さんは大切(たいせつ)なお客(きゃく)さんです。 · Thirty years at this station. You are a valued guest. · ثلاثون عامًا في هذه المحطة. أنت ضيف عزيز. | old ticket | 駅(えき)の友(とも) Friend of the station / صديق المحطة | fares −10% |
| kenji | closes the shop and cooks the "secret bowl" | 今日(きょう)は特別(とくべつ)なラーメンを作(つく)る。食(た)べてくれ！ · Today I'm making a special ramen. Eat up! · اليوم سأصنع رامن خاصًا. كُل! | tenugui headband | ラーメン仲間(なかま) Ramen buddy / رفيق الرامن | ramen −10% |
| hanako | the empty classroom; her old notebook | {name}さん、あなたはもう生徒(せいと)だけではありません。友(とも)だちです。 · {name}, you are not just my student any more. You're my friend. · لم تعد مجرد طالب عندي. أنت صديق. | notebook | 先生(せんせい)の友(とも)だち Teacher's friend / صديق المعلّمة | one-time ¥3,000 scholarship |
| aiko | the garden cherry tree and her late husband's seat | ここは{name}のもうひとつの家(いえ)ですよ。 · This is another home for you. · هذا بيتك الثاني. | tea bowl | 桜町(さくらちょう)の孫(まご) Sakura-chō's grandchild / حفيد ساكورا-تشو | room move-in −¥10,000 if not yet moved, else a free `kotatsu` |
| rin | she gives you a rare item from the back room | {name}って、ほんといい友(とも)だち。これ、あげる。 · You're really a great friend. Here, this is for you. · أنت فعلًا صديق رائع. تفضّل، هذه لك. | vintage keychain | 最強(さいきょう)の友(とも) Ultimate friend / أقوى صديق | Fuku-Fuku −10% |
| nakamura | closing time, he fixes your bike for free and talks about his father | いつでもここに来(こ)い。タダで直(なお)すよ。 · Come by any time. I'll fix it for free. · تعال في أي وقت. سأصلحها مجانًا. | wrench | 仲間(なかま) Comrade / رفيق | one-time ¥8,000 off the kei car |

Perk rules: shop perks apply as friend perks (§4.4 rule 2, capped at ¥300/day in total); one-time perks (scholarship, move-in, car) are **exempt from the 8% routine-discount rule** (§4.4) and paid once. The car perk stacks with haggling (floor ¥181,120). ♥4 small perks: Tanaka konbini −5%; Yuki every 5th café drink free (once/day); Kenji one free 替え玉 per day; Sato fares −10%; Rin Fuku-Fuku −5%.

---

## 9. Jobs and shift mini-games

A shift is **you on the staff side of a counter**: the customer speaks first (TTS), you listen, act and answer. It trains the other half of the language (counters, prices, set phrases, keigo) and is each shop's "exam". Kids and teens see it labelled **お手伝い (helping out)**; pay is identical.

### 9.1 Rules

| Rule | Value |
|---|---|
| Jobs | `job_konbini` (Ch2, Tanaka), `job_cafe` (Ch3, Yuki), `job_station` (Ch5, Sato). Each is unlocked by a short intro scenario `jobintro_*` (a normal conversation with the boss, pays once). |
| Length | **5 customers** (≈ 3-4 minutes) |
| Timers | **None.** No patience bars, no countdowns. |
| Per customer | customer line plays (TTS; **text hidden by default**) → tasks (below) → tick → next. Unlimited free replays and a slow replay. |
| Assist | *Show Japanese text* → that customer's order-task credit ×0.7; *Show translation* → ×0.5 (the customer is marked assisted). **Waived** (no factor, no assisted flag) for a player's first two shifts at each job, and always when `listenPref:'off'` or AudioMode is `read-and-type` / `type-only` (no Japanese voice, no TTS, muted device, noisy bus, hearing difficulty); a one-tap *Can't listen right now* shows the text for the whole shift. Words from missed customers are offered as a 5-card drill afterwards (never a cost). |
| Input | tap, type or speak; the mic is optional and pays the same |
| Daily | shift 1 ×1.0; shift 2 ×0.6 (different job) / ×0.5 (same job); shift 3 not available (boss: 「今日(きょう)はもう大丈夫(だいじょうぶ)です。ゆっくり休(やす)んでください。」*That's enough for today. Please rest.* «يكفي لهذا اليوم. ارتح قليلًا.») |
| Counting | a shift counts for objectives (`shift`), rank promotion and `g_shift` only if **all 5 customers were served and accuracy (`ticks`) ≥ 0.6**; the *trial wage* never counts |
| Quit mid-shift | pays only if ≥ 2 customers served, then ×0.6; never counts toward objectives, ranks or `g_shift` |
| Variety | customers drawn without replacement from ≥ 4 archetypes per job with tier ≤ rank + 1; carts are random from the menu, **weighted toward the words that are due for review** in the player's vocabulary and the job's `vocabTags` (so shifts rehearse what the learner is learning, and totals differ every time); the same order never repeats within 3 shifts (seeded) |

### 9.2 Tasks, scoring and pay

Every customer has **3 scored tasks** (15 units per shift): `order` (comprehension: tap items and counts; a flag toggle such as *heat* or *no bag* counts as part of the order), `total` (production: say/type the total, or pick from 3 spoken totals), `thanks` (production: the staff phrase for the job: *ありがとうございました*, *お待たせしました*, a repeat-back, or a station phrase). Optional `greet` (いらっしゃいませ) gives +10% to that customer.

Production credit (`c`), aligned with the conversation classes of §3.2: typed or spoken **1.00** · built from shuffled **tiles** (tokens + 2 distractors) **0.50** · picked chip / pick-from-3 **0.35**.

```
ticks = correct task units (order weighted by textFactor) / 15          0..1   ("accuracy")
r     = mean c over the correct production tasks (total + thanks)
perf  = ticks · F(r)                                                    F as §3.3
shiftPay = round10( wage · hours · rankMult[rank] · perf · repeatMult )
trial wage: ticks < 0.6 and ≥ 2 customers served → ¥100 (never counts)
```

| Job | Where | Wage ¥/h | Paid hours | Rank-0 full-skill shift | Rank-4 | All-chips (c=.35, perfect listening) |
|---|---|---|---|---|---|---|
| `job_konbini` | konbini (register) | 1,150 | 0.75 | ¥860 | ¥1,140 | ¥290 |
| `job_cafe` | café (hall) | 1,200 | 0.75 | ¥900 | ¥1,190 | ¥310 |
| `job_station` | station (guide desk) | 1,400 | 0.75 | ¥1,050 | ¥1,390 | ¥360 |

Second shift the same day: konbini ¥520 (different job) or ¥430 (same job). Example: ticks 0.8, r 0.7 → perf 0.49 → ¥430. **Parity (D41):** a full-skill A1 conversation pays ¥1,680 in about 6 minutes (¥280/min) and a full-skill rank-0 konbini shift ¥860 in 4 minutes (¥215/min); at rank 4 the station shift pays ¥1,390 in 4 minutes (¥350/min) against ¥2,440 in 8 minutes (¥305/min) for a full-skill A2 conversation. Shifts are 6-11% of income, at most 15% (CI, §4.6). The "paid hours" are a short *お手伝い* shift, not a real hour: the first design paid 2-2.5 h, three times a conversation per minute.
**Ranks** (per job, promotion after "good" shifts, i.e. accuracy ≥ 0.6): rank 0 見習(みなら)い trainee / متدرّب → 1 一人前(いちにんまえ) full-fledged / متمكّن (3 good shifts) → 2 ベテラン veteran / محترف (6) → 3 エース ace / نجم (10) → 4 店長代理(てんちょうだいり) acting manager / نائب المدير (15); `rankMult = [1.00, 1.08, 1.16, 1.24, 1.32]`. Rank-up beat: 「一人前(いちにんまえ)になりました！時給(じきゅう)が上(あ)がります。」*You're a full-fledged worker now! Your wage goes up.* «أصبحت عاملًا متمكّنًا! سيرتفع أجرك.» A shift with accuracy < 0.6 never loses rank or money; the supervisor says 「だいじょうぶ。もう一度(いちど)やりましょう。」*It's okay. Let's try again.* «لا بأس. لنحاول مرة أخرى.» Bands (on accuracy): ≥ 0.9「完璧(かんぺき)です！」*Perfect!* «ممتاز!» · 0.7-0.89「いいですね！」*Nice!* «جميل!» · 0.6-0.69「もう少(すこ)し！」*A little more!* «قليلًا بعد!».

### 9.3 Customer data (`tokyo/game/jobs.ts`; every line is a `Line` that passes the lexicon test and has EN + AR)

```ts
interface JobDef { id:'job_konbini'|'job_cafe'|'job_station'; place:string; boss:string; name:Gloss; wage:number; hours:number;
  unlock:Pred; archetypes: CustomerTemplate[]; vocabTags:string[]; bonus:{ itemId:string; needsPerfect:true } }
interface CustomerTemplate { id:string; tier:1|2|3|4; minRank:0|1|2|3|4; line:Line;
  task: { kind:'order'; items:Array<{menu:string; qty:number}>; toggles?:string[] }
      | { kind:'platform'|'time'|'fare'|'direction'|'announce'; answer:unknown };
  thanks: string[] /* accepted staff phrases (any-match) */; tiles?: string[]; change?: { paid:number } }
```

| Job | Archetypes (tier) | Sample customer line (JA · EN · AR) | Task |
|---|---|---|---|
| konbini | `k_basic` (1) | おにぎりをふたつ、お願(ねが)いします。 · Two rice balls, please. · كرتا أرز اثنتان من فضلك. | items ×2 → total ¥320 |
| konbini | `k_two` (2) | お茶(ちゃ)をひとつと、サンドイッチをみっつください。 · One tea and three sandwiches, please. · شاي واحد وثلاث ساندويتشات من فضلك. | 2 items → ¥1,120 |
| konbini | `k_heat` (3) | お弁当(べんとう)を温(あたた)めてください。袋(ふくろ)はいりません。 · Please heat the bento. I don't need a bag. · سخّن الوجبة من فضلك. لا أحتاج كيسًا. | item + heat on + bag off |
| konbini | `k_change` (4, rank ≥ 2) | 千円(せんえん)でお願いします。 · By a 1,000-yen note, please. · بورقة الألف ين من فضلك. | + give change (お釣(つ)り) |
| café | `c_one` (1) | ホットのラテをひとつお願いします。 · One hot latte, please. · لاتيه ساخن واحد من فضلك. | ticket + repeat-back tiles 「ホットラテがひとつ、ですね。」 |
| café | `c_two` (2) | アイスコーヒーをふたつ。三番(さんばん)のテーブルです。 · Two iced coffees. Table 3. · قهوتان باردتان. الطاولة 3. | 2 drinks + table number |
| café | `c_change` (3) | ホットのラテと、やっぱりアイスでお願いします。 · A latte, actually iced please. · لاتيه، بل بارد من فضلك. | change of mind (last word wins) |
| café | `c_split` (4) | 別々(べつべつ)でお願いします。 · Separate bills, please. · فواتير منفصلة من فضلك. | two totals |
| station | `s_platform` (1) | ひかりが丘(おか)は何番線(なんばんせん)ですか？ · Which platform is Hikarigaoka? · أي رصيف لهيكاريغاؤكا؟ | tap platform on the board |
| station | `s_dir` (1) | トイレはどこですか？ · Where is the toilet? · أين الحمام؟ | drag an arrow on a mini map with 右(みぎ) / 左(ひだり) / まっすぐ |
| station | `s_time` (2) | 次(つぎ)の電車(でんしゃ)は何時(なんじ)ですか？ · What time is the next train? · متى القطار التالي؟ | read the timetable → pick the time |
| station | `s_fare` (3) | きっぷはいくらですか？ · How much is a ticket? · بكم التذكرة؟ | pick the fare from the table |
| station | `s_announce` (4, rank ≥ 2) | (TTS) まもなく二番線(にばんせん)に電車(でんしゃ)が参(まい)ります。 · A train is arriving shortly at platform 2. · سيصل القطار قريبًا إلى الرصيف 2. | which platform? |

Staff phrases accepted for `thanks`: ありがとうございました, お待(ま)たせしました, かしこまりました, 恐(おそ)れ入(い)りますが… (station, rank ≥ 3). Bonus for a perfect shift: konbini → a free `onigiri` (giftable to anyone except Tanaka) and culture `cc_points` on the third perfect shift; café → a free drink item and the word card コーヒー; station → `g_souvenir`-class postcard word card.

### 9.4 Screen and events

One `Shift.tsx` with four small widgets (item grid with icon + JA label, number-choice/total entry, phrase tiles, station board/map), reusing the existing `JaText`, `WordSheet`, `Portrait`, tts/stt services and RTL layout. Result card: accuracy, pay, 3 words to save, supervisor line. Events: `shift_done {jobId, accuracy, perf, customersServed, assistedCustomers, pay, rankBefore, rankAfter}`. Age defaults: kids and seniors get larger tap targets and the slower TTS rate (§11.9); shift length and pay do not change.

---

## 10. Japan culture cards (23)

**Rules.** A card unlocks **the first time its trigger happens** (never gated by a quiz), is shown after the conversation/event ends (not mid-conversation), and has 2-3 sentences plus one **key phrase**. Reading it gives +5 XP and a stamp in the Culture tab. **Cards are language, not trivia.** Eight cards carry `say:true` (the key phrase is something the learner says: `cc_bow`, `cc_itadakimasu`, `cc_gift`, `cc_keigo`, `cc_ic`, `cc_trainmanner`, `cc_refuse`, `cc_shoesoff`): they show a hidden-line **Say it** button, create an SRS phrase card (+1 day) and feed the `culture_said` predicate, which also counts the phrase when the learner says it in a class-I turn in a conversation. The other fifteen cards are an optional collection (`culture n:N` is a stamp count, never a chapter gate). `strings/culture.ts` holds the UI strings; card data lives in `tokyo/game/culture.ts` with `{ id, trigger, phrase:Line, text:Gloss, say?:true, adultOnly?:true }`. All Arabic needs a native pass before release.

| id | Trigger | Key phrase (JA · EN · AR) | Text EN | Text AR |
|---|---|---|---|---|
| `cc_irasshaimase` | first shop conversation starts | いらっしゃいませ · Welcome (to our shop) · أهلًا بك (في متجرنا) | Staff greet every customer the moment they walk in, often in a loud, rhythmic voice. You don't have to answer with words; a small nod is perfect. | يحيّي الموظفون كل زبون لحظة دخوله، وغالبًا بصوت عالٍ وإيقاعي. لا يلزمك الرد بالكلام، فإيماءة رأس صغيرة تكفي تمامًا. |
| `cc_bow` | first talk with Hanako | よろしくお願(ねが)いします · Nice to meet you / please treat me well · سُررت بلقائك / أرجو حسن التعامل | A bow is a greeting, a thank-you and an apology in one. In daily life a small, quick nod is enough; deeper bows show more respect. Don't worry about the exact angle. | الانحناء تحية وشكر واعتذار في آنٍ واحد. في الحياة اليومية تكفي إيماءة صغيرة سريعة، والانحناء الأعمق يدل على احترام أكبر. لا تقلق بشأن الزاوية بالضبط. |
| `cc_konbini` | finish `konbini` | 温(あたた)めますか？ · Shall I heat it? · هل أسخّنه؟ | A konbini is open 24 hours and sells far more than snacks: hot meals, ATMs, bill payment, parcels and printing. Staff often ask if you want your food heated. | الكونبيني مفتوح 24 ساعة ويبيع أكثر بكثير من الوجبات الخفيفة: وجبات ساخنة وصرّافات آلية ودفع فواتير وطرودًا وطباعة. كثيرًا ما يسألك الموظف إن كنت تريد تسخين طعامك. |
| `cc_notip` | first payment in café/ramen | ありがとうございました · Thank you very much (said by staff) · شكرًا جزيلًا (يقولها الموظف) | There is no tipping in Japan. Good service is the normal standard, not something you pay extra for, and leaving money can even confuse staff. At the register, put your money on the small tray. | لا توجد إكرامية في اليابان. الخدمة الجيدة هي المعيار المعتاد وليست شيئًا يُدفع عنه زيادة، وترك النقود قد يربك الموظفين. عند الصندوق ضع نقودك على الصينية الصغيرة. |
| `cc_itadakimasu` | first ramen served | いただきます / ごちそうさまでした · I gratefully receive / Thank you for the meal · أتقبّل بامتنان / شكرًا على الوجبة | Say いただきます before eating and ごちそうさまでした afterwards. Slurping noodles is normal: it cools them and shows you enjoy them. | قل いただきます قبل الأكل وごちそうさまでした بعده. شفط النودلز بصوت مسموع أمر طبيعي؛ فهو يبرّدها ويدل على استمتاعك. |
| `cc_vending` | first vending machine use | あたたかい / つめたい · warm / cold · دافئ / بارد | Millions of vending machines sell drinks, hot ones in winter. Hot cans have a red label, cold ones a blue label, and most cost about ¥130 to ¥170. Many accept IC cards. | ملايين آلات البيع تبيع المشروبات، ومنها الساخنة في الشتاء. للعلب الساخنة ملصق أحمر وللباردة ملصق أزرق، ومعظمها يكلّف نحو 130 إلى 170 ينًا. كثير منها يقبل بطاقات IC. |
| `cc_name` | finish `park` intro | {name}さん · Mr/Ms {name} · السيد/السيدة {name} | Add さん after other people's names, never your own. ちゃん is affectionate (friends, children), くん is for boys and juniors, and 先生 is for teachers. | أضف さん بعد أسماء الآخرين وليس اسمك أبدًا. ちゃん للمودّة (الأصدقاء والأطفال)، وくん للأولاد والأصغر سنًا، و先生 للمعلّمين. |
| `cc_gift` | first gift given | これ、どうぞ · Here, please take it · تفضّل، هذا لك | Give and receive gifts with both hands. Small gifts are best so nobody feels they owe you. おみやげ are souvenirs you bring back from trips for friends and colleagues. | قدّم الهدايا واستلمها بكلتا اليدين. الهدايا الصغيرة أفضل كي لا يشعر أحد بأنه مدين لك. الأوميياغي هدايا تذكارية تحضرها من رحلاتك للأصدقاء وزملاء العمل. |
| `cc_hanami` | first park visit after Ch3 | お花見(はなみ) · flower viewing · مشاهدة الأزهار | Hanami means picnicking under the cherry blossoms, usually from late March to early April. The blossoms last only about a week, which is part of their charm. | الهانامي هو التنزّه تحت أزهار الكرز، وعادةً من أواخر مارس إلى أوائل أبريل. تدوم الأزهار نحو أسبوع فقط، وهذا جزء من سحرها. |
| `cc_keigo` | first casual line from a friend (Mio ♥2, Rin) | タメ口(ぐち)でいい？ · Is casual speech OK? · هل يمكننا الكلام بصيغة عادية؟ | Japanese has levels of politeness. です/ます is the safe polite style; friends use the plain form. Let a friend switch first, or ask 「タメ口でいい？」. With staff, elders and teachers, stay polite. | للغة اليابانية مستويات من التهذيب. أسلوب です/ます هو الأسلوب المهذب الآمن، والأصدقاء يستخدمون الصيغة العادية. دع صديقك يبدأ بالتحول، أو اسأل «タメ口でいい؟». ابقَ مهذبًا مع الموظفين والكبار والمعلّمين. |
| `cc_points` | 3rd konbini purchase or 3rd perfect shift | ポイントカードはお持(も)ちですか？ · Do you have a point card? · هل لديك بطاقة نقاط؟ | Shops often ask if you have a point card. Receipts are normally handed over; if you need a formal one, ask for a 領収書 (ryōshūsho) with your name on it. | تسأل المتاجر غالبًا إن كانت لديك بطاقة نقاط. يُسلَّم الإيصال عادةً؛ وإن احتجت إلى إيصال رسمي فاطلب 領収書 (ryōshūsho) باسمك. |
| `cc_tax` | first Hikari Denki purchase | 税込(ぜいこみ) · tax included · شامل الضريبة | Prices are normally shown with tax included. Consumption tax is 10%, but take-away food and groceries are 8%; eating in is 10%. | تُعرض الأسعار عادةً شاملة الضريبة. ضريبة الاستهلاك 10%، لكن الطعام الجاهز للأخذ والبقالة 8%، أما تناول الطعام في المكان فبنسبة 10%. |
| `cc_taxfree` | asking about tax-free (the learning-only branch) | 免税(めんぜい)できますか？ · Can I buy tax-free? · هل يمكنني الشراء معفى من الضريبة؟ | Visitors can shop tax-free with their passport above a minimum spend (the scheme is changing, so check before you travel). Residents like you pay the tax, and staff will politely say you are not eligible: 「免税の対象外です」. | يمكن للزوار التسوق معفيين من الضريبة بجواز السفر فوق حدّ أدنى من الإنفاق (النظام يتغير فتحقّق قبل السفر). أما المقيمون مثلك فيدفعون الضريبة، وسيقول لك الموظف بلطف إنك غير مؤهل: «免税の対象外です». |
| `cc_ic` | finish `station_ic` | チャージお願(ねが)いします · Please top up my card · اشحن البطاقة من فضلك | IC cards such as Suica and PASMO work on trains, buses, in konbini and at vending machines. Charge them with cash at a machine, then just tap. A paper ticket costs a few yen more than the IC fare. | تعمل بطاقات IC مثل Suica وPASMO في القطارات والحافلات والكونبيني وآلات البيع. اشحنها بالنقود من الآلة ثم مرّرها فقط. وتكلّف التذكرة الورقية بضعة ينات أكثر من أجرة IC. |
| `cc_trainmanner` | first train ride | すみません、降(お)ります · Excuse me, I'm getting off · عفوًا، سأنزل | Trains are quiet. Put your phone on silent (マナーモード), avoid phone calls, take your backpack off, and keep priority seats for those who need them. | القطارات هادئة. اجعل هاتفك على الوضع الصامت (マナーモード)، وتجنّب المكالمات، وأنزل حقيبة ظهرك، واترك المقاعد المخصصة لمن يحتاجها. |
| `cc_ticketmachine` | first ticket-machine panel use | 券売機(けんばいき) · ticket machine · آلة التذاكر | Many ramen shops and stations use ticket machines: choose and pay first, then hand the ticket to the staff. Look for the button with a picture of the dish. | تستخدم محلات رامن كثيرة والمحطات آلات التذاكر: اختر وادفع أولًا ثم سلّم التذكرة للموظف. ابحث عن الزر الذي عليه صورة الطبق. |
| `cc_refuse` | `motors_visit` polite decline, or the first 「考えます」/「また来ます」 after `short` | ちょっと… / 考(かんが)えます · That's a bit… / I'll think about it · هذا صعب قليلًا... / سأفكّر | A direct "no" can sound harsh. Polite ways to decline are 「ちょっと…」 and 「考えます」. Shops accept this happily, and prices are fixed: there is no haggling (定価). | قد يبدو «لا» المباشرة قاسية. من طرق الرفض المهذبة «ちょっと…» و«考えます». المتاجر تتقبّل ذلك بصدر رحب، والأسعار ثابتة فلا توجد مساومة (定価). |
| `cc_bikereg` | first bike purchase (register step) | 防犯登録(ぼうはんとうろく) · bicycle registration · تسجيل الدراجة | A bicycle is registered at the shop where you buy it. The sticker links the bike to you, so the police can return it if it is lost or stolen. Helmets are recommended for everyone. | تُسجَّل الدراجة في المتجر الذي تشتريها منه. يربط الملصق الدراجة بك فتعيدها الشرطة إن فُقدت أو سُرقت. يُوصى بالخوذة للجميع. |
| `cc_shoesoff` | first home-visit genkan | おじゃまします · Excuse me for intruding (said as you enter) · عن إذنك (تُقال عند الدخول) | Take your shoes off in the genkan (entrance), step up, and put on slippers. Never wear slippers on tatami, and toilets often have their own pair. | اخلع حذاءك في الجنكان (المدخل)، ثم اصعد وارتدِ الخفّ. لا ترتدِ الخفّ على حصير التاتامي أبدًا، وكثيرًا ما يكون للمرحاض خفّ خاص به. |
| `cc_rent` | finish `aiko_viewing` (adult profiles only) | 敷金(しききん) · security deposit · وديعة التأمين | Renting often means a deposit (敷金), sometimes "key money" (礼金, a non-refundable thank-you to the landlord), an agent fee and a guarantor. Aiko keeps it simple: deposit and first month only. | غالبًا ما يعني الإيجار وديعة تأمين (敷金)، وأحيانًا «مال المفتاح» (礼金، شكر لا يُسترد للمالك)، إضافةً إلى رسوم الوسيط وكفيل. أيكو تبسّط الأمر: وديعة وأول شهر فقط. |
| `cc_shaken` | `motors_car`: the player asks for the drive-away price | 乗(の)り出(だ)し価格(かかく) · drive-away price · السعر النهائي | Cars are quoted two ways: the body price (本体価格) and the drive-away price (乗り出し価格), which adds fees and taxes. In many areas you also need a parking certificate (車庫証明), even for a kei car, and a regular inspection called shaken (車検). | تُعرض أسعار السيارات بطريقتين: سعر الهيكل (本体価格) والسعر النهائي (乗り出し価格) الذي يشمل الرسوم والضرائب. وفي مناطق كثيرة تحتاج أيضًا إلى شهادة موقف (車庫証明) حتى للسيارات الصغيرة (كي)، وإلى فحص دوري يسمى شاكن (車検). |
| `cc_matsuri` | enter the festival | お祭(まつ)り · festival · مهرجان | Matsuri are local festivals, often at shrines, with food stalls (屋台), yukata, portable shrines and, in summer, fireworks. Stalls usually take cash only. | الماتسوري مهرجانات محلية، غالبًا عند المعابد، فيها بسطات طعام (屋台) ويوكاتا ومعابد محمولة وألعاب نارية في الصيف. وتقبل البسطات النقد غالبًا فقط. |
| `cc_trash` | first entry into your flat or Aiko's home | ごみの日(ひ) · rubbish day · يوم النفايات | Rubbish is sorted (burnable, plastics, cans, bottles...) and collected on fixed days. Ask your landlord for the calendar and put it out only on the right morning. | تُفرز النفايات (قابلة للحرق، بلاستيك، علب، زجاجات...) وتُجمع في أيام محددة. اطلب التقويم من المالك وضعها في الصباح الصحيح فقط. |

Chapter-linked card sets (rewards in §7.2): Ch1 `cc_irasshaimase`, `cc_bow`; Ch2 `cc_notip`, `cc_konbini`, `cc_itadakimasu`; Ch3 `cc_gift`, `cc_name`, `cc_hanami`; Ch4 `cc_tax`, `cc_vending`, `cc_points`; Ch5 `cc_ic`, `cc_trainmanner`, `cc_ticketmachine`, `cc_refuse`; Ch6 `cc_shoesoff`, `cc_rent`, `cc_trash`; Ch7 `cc_matsuri`. A card whose trigger happens earlier unlocks earlier; the chapter list only guarantees it by then. Check: `culture_said n:6` (c7_4) is reachable before Ch7 completes (eight `say:true` cards unlock by Chapter 6), and `culture_said n:2` (c2_4) is reachable in Chapter 2 through `cc_bow` and `cc_itadakimasu`, whose Say-it buttons count even if the phrase has not come up in a conversation.

---

## 11. Learning integration (prepare → converse → debrief)

### 11.1 Prepare (the Phrase Pocket), soft and skippable

A **pocket** is 3-4 authored lines per scenario (`tokyo/game/pockets/`: `{ id, line:Line, note?:Gloss, key?:true }`, ≤ 2 key lines). Every pocket line must be matched by one of the scenario's intents (a test), so "say it" is language the scenario will actually accept. Pockets exist for every `pay:'full'` scenario, `park`, `sato_directions`, the job intros, and the shift jobs (as a warm-up).

Examples:

| Scenario | Pocket lines (JA · EN · AR) |
|---|---|
| `konbini` | これをください。· This one, please. · هذا من فضلك. ★ — いくらですか。· How much is it? · بكم هذا؟ ★ — 袋(ふくろ)はいりません。· I don't need a bag. · لا أحتاج كيسًا. — カードでお願(ねが)いします。· By card, please. · بالبطاقة من فضلك. |
| `cafe` | コーヒーをください。· A coffee, please. · قهوة من فضلك. ★ — ホットをお願いします。· Hot, please. · ساخن من فضلك. — Wi-Fiのパスワードを教(おし)えてください。· Could you tell me the Wi-Fi password? · هل يمكنك إخباري بكلمة مرور الواي فاي؟ — 現金(げんきん)でお願いします。· Cash, please. · نقدًا من فضلك. |
| `station_ic` | ICカードをください。· An IC card, please. · بطاقة IC من فضلك. ★ — 千円(せんえん)チャージをお願いします。· Please load 1,000 yen. · اشحن ألف ين من فضلك. ★ — いくらですか。 |
| `denki_phone` | スマホがほしいのですが。· I'd like a smartphone. · أريد هاتفًا ذكيًا. ★ — どちらが安(やす)いですか。· Which one is cheaper? · أيّهما أرخص؟ — これをください。 — カードでお願いします。 |

**Screen** (`Prepare.tsx`, shown from the Interaction sheet before a shop/shift/capstone; auto-skipped and replaced by a one-line "You're ready" when all lines are already `ready`): each line is a card with **Listen** (TTS 0.8× then 1.0×), the meaning in EN/AR and furigana/romaji per settings, in two steps:
1. **Study** (the Japanese is visible): listen, read, say it along. The line becomes `seen` and its SRS cards are created.
2. **Recall** (the Japanese is **hidden**; only the meaning and a replay button show): *Say it from memory* (mic), *type it* (kana, kanji or romaji, via `normMatch`), or *Build it from the pieces* (shuffled tiles with 2 distractors, every attempt free). Pass if `speechSimilarity(heard, target) ≥ 0.70` (0.60 for the A1 profile, 0.55 for kids) or the tiles are in order. *Peek* shows the text for that line (it stays `seen`; no recall pass).

The earlier *pick the meaning* and *pick the line* checks are only warm-ups: they reach `seen` but never `ready` (one in three, instantly retryable, they proved nothing, yet the first design let them buy a permanent ×1.10). Everything is retryable instantly; there is no failure state and no cost.

**States** (`GameState.prep[lineId] = { s:'seen'|'ready', at:dayIndex }`): `new → seen` (studied once) `→ ready` (passed a **recall** check, or the matching vocabulary card is already known: FSRS `state = Review` and `stability ≥ 3`). A `ready` stamp from a recall pass **expires after 7 days** (`BALANCE.readyDays`): it grants `prepF` and recalled-line credit (§3.2) only while fresh, so one lucky pass cannot pay ×1.10 for ever; a known FSRS card never expires. Pocket **ready** = all key lines `ready` and ≥ 60% of the rest. **Skip** is always one tap and only forfeits the **+10% (`prepF`)**; no hard gate anywhere (D21). The Guided/Real choice sits on the same screen.

### 11.2 Converse

The conversation screen is unchanged except: it can start any scenario of a character (`scenarioId`, `startNode`, `channel`), it receives the game hooks (§6.2), and in **Real mode** the suggestion chips are hidden (the hint button and "say it your way" remain; Hint-revealed and translated Japanese count as *shown text*, so copying it is class S or T, §3.2). It is mounted from a **store request** `useUi.convo = { scenarioId, startNode, channel, mode, characterId }` (owned by 2A) rather than from `WorldScreen` state, so Prepare, Phone, Shift, TripPanel and the home stages can all start a conversation; scenarios without a world spawn (`kato`, `hina`, chat threads) skip `world.enterConversation` and `useWorld` is optional. **Real** unlocks after Ch1 for scenarios flagged `real:true`, pays ×1.25 on yen only, and gives identical stars/objective credit. `matsuri_speech` is Real-mode by construction, with the Chapter 6 rehearsal and the one-time Guided fallback of §7.2. Speech rate follows the age profile.

### 11.3 Debrief (Feedback screen gains additive blocks)

For the first three conversations the Debrief is the compact form of §2.5 (blocks 1, 2, one pay line, 5 and the culture card); the other blocks appear as the HUD unlocks them. In order: (1) existing scores and corrections; (2) **Stars** with what each star needed; (3) **Wallet ledger** rows: each yen line with a plain reason ("Your lines +¥…", "All steps done", "Prepared +10%", "First time you said this +¥20"…), and a one-sentence honest nudge computed from the same formula ("Try the next one without a chip: about +¥…"); (4) **Friends strip** (hearts gained, heart-up animation); (5) **Keep these** (existing `phrasesLearned` plus up to 2 corrections) each with a hidden-line **Say it** echo button (the meaning is shown and the Japanese hidden, *Peek* forfeits the yen; mic or type, `similarity ≥ 0.60`; 0.50 beginner) that pays the §3.3 echo bonus and always creates an SRS card; (6) culture card / chapter objective ticks / dream step; (7) CTA **Next best goal** (§11.7) and the existing Practise again. No block pops up mid-conversation.

### 11.4 Register and feedback hooks

`SessionOptions.register` (`casual | polite | keigo`, from `ScenarioMeta.register`, overridden by the friend's `casual` flag) feeds the existing rule feedback: `casualWithStaff` (plain forms with staff: naturalness correction), `stiffWithFriend` (keigo with a friend who switched: noted as "distant, not wrong"), plus per-scenario `politeMarkers[]`/`casualMarkers[]`. Rules are conservative: when unsure, no correction. Speech turns with STT confidence < 0.8 produce **no corrections** (shown as "maybe" notes). Request turns without ください/お願い stay flagged as today (and gate ★★★).

### 11.5 SRS hooks (cards without chores)

| Trigger | Cards | `source` (extend the union with `'goal' \| 'correction'`) | First due |
|---|---|---|---|
| Prepare line seen | one phrase card + one word card per new lexicon word | `goal` | now + 1 day (so the queue is not flooded) |
| Sign read / object tapped | the word | `sign` | + 1 day |
| Debrief *keep these* / echo | phrase | `correction` / `conversation` | + 10 min |
| Lesson card | existing | `lesson` | existing |
| Culture card with `say:true` (hidden-line Say it) | the key phrase | `goal` | now + 1 day |

**Caps:** ≤ 8 new goal cards/day (kids 5, seniors 6); beyond that cards are `parked` (no due date) and released when the due backlog < 15. **Amnesty:** if due > 40, the review screen shows the 12 lowest-stability cards ("Quick sprint") and re-spaces the rest forward without counting lapses. **Use = review:** when a due card's word appears in a matched `I` turn, the app records an implicit `good` review once per card per day (class `S`/`T` never do). Review remains the existing Vocab screen; the daily goal `g_review8` counts only *due* cards that already have an earlier review and were answered through a check (the pick-the-answer mode or a typed answer), so Prepare's fresh cards and self-rated flips cannot farm it.

### 11.6 Lessons (Hanako; `lessons-extra.ts` + existing `greetings`)

| id | Unlocks | Cards (JA = EN = AR) |
|---|---|---|
| `numbers` | Ch1 (P0) | 一(いち)=1=1 · 十(じゅう)=10=10 · 百(ひゃく)=100=100 · 千(せん)=1,000=1,000 · 万(まん)=10,000=10,000 · 円(えん)=yen=ين · 三百(さんびゃく), 六百(ろっぴゃく), 八百(はっぴゃく), 三千(さんぜん), 八千(はっせん) = the irregular ones = الأرقام الشاذة · 四百五十円=450 yen=450 ين |
| `shopping` | Ch1 (P0) | これをください=This one, please=هذا من فضلك · いくらですか=How much is it?=بكم هذا؟ · 袋はいりません=No bag, thanks=لا أحتاج كيسًا · カードでお願いします=By card, please=بالبطاقة من فضلك · 温めてください=Please heat it=سخّنه من فضلك · レシートをお願いします=A receipt, please=الإيصال من فضلك |
| `polite_casual` | Ch3 (P1) | です/ます=polite=مهذب · だ/る=plain=عادي · ありがとうございます→ありがとう · いいですか→いい？ · 食べます→食べる · 「タメ口でいい？」=Is casual OK?=هل نتكلم بصيغة عادية؟ |
| `directions` | Ch3 (P1) | 右(みぎ)=right=يمين · 左(ひだり)=left=يسار · まっすぐ=straight=مباشرة · 曲(ま)がる=turn · 近(ちか)い=near=قريب · 遠(とお)い=far=بعيد |
| `home_manners` | Ch5 (P1) | おじゃまします=Excuse me for intruding=عن إذنك · どうぞあがってください=Please come in=تفضّل ادخل · いただきます=I gratefully receive=أتقبّل بامتنان · おじゃましました=Thank you for having me=شكرًا على الاستضافة · スリッパ=slippers=خفّ · 玄関(げんかん)=genkan=مدخل البيت |

Each lesson reuses the existing `Lesson` shape (cards + `sayCount`) and screen; completing one also gives XP and `g_lesson`.

### 11.7 Next best goal and catch-up

Deterministic priority (no scoring model): (1) an unfinished current-chapter objective that has a pin (nearest first); (2) the dream's next visible step; (3) an unfinished daily goal; (4) due reviews ≥ 10; (5) "Practise again" on the lowest-star scenario. The HUD tracker shows the first one and a "more goals" sheet shows the rest. **The tracker target is locked** once chosen: it changes only when it is done, dismissed or at a day boundary, never because the player walked closer to something else. When only `minDays` remains, the list falls through to (2)-(5) and the waiting message of §7.1. **Stuck rule:** 3 consecutive conversations with ≥ 3 fallbacks → the tracker offers a Hanako lesson first. **Welcome back** (away ≥ 4 days): no streak scolding; Hanako or the friend with most hearts sends a gentle message; the SRS amnesty (§11.5) applies automatically.

### 11.8 Adaptive support (two cards, not a system)

After a conversation: if the last 3 conversations had `r ≥ 0.75` the debrief offers "Want fewer chips? Real mode pays +25%" (accept → default to Real for that scenario); if the last 3 had `r < 0.35` and ≥ 2 fallbacks it offers "More help and a slower voice?" (accept → TTS rate × 0.85 and a Hanako lesson). Never silent, at most one change per 3 conversations; Settings can always override. Support defaults at onboarding: A1 profile shows 3 chips with translations and furigana on all kanji; A2 shows romaji off and translation tap-to-reveal.

### 11.9 Age groups (`AgeProfile`, one parameter table; no age branches in engine or world)

| Parameter | Kids (6-12) | Teens (13-17) | Adults (18-49) | Seniors (50+) |
|---|---|---|---|---|
| Daily goals | 2 | 3 | 3 | 3 |
| Pocket size | 3 lines | 4 | 3-4 | 3-4 |
| Timers | none anywhere (all ages; see D18) | | | |
| Text size / min tap target | 1.15× | 1.0× | 1.0× | 1.3× / 52 px |
| TTS default rate | 0.80 | 0.92 | 1.0 | 0.85 |
| Echo / say-it pass threshold | 0.55 | 0.60 | 0.70 | 0.60 |
| Hidden / "someday" items | flat, cars | flat, cars | none | none |
| Voice input default | **off**; turning it on needs an adult gate (`audio.parentGate`), and no consent card is ever shown to the child | consent card, once | consent card, once | consent card, once |
| Dreams offered | all except `flat`, `fresh_start`, `car` | same as kids | all | all |
| Wallet display | coin icons, amounts over ¥10,000 as words | full | full | full, larger |
| New goal cards/day | 5 | 8 | 8 | 6 |
| Adult-flagged topics | hidden | hidden | shown | shown |

---

## 12. Audio (mic and speaker)

### 12.1 Where each is used (all paths work without either)

| Surface | Speaker (`TtsPort`) | Mic (`SttPort`) | Typing / tapping equivalent |
|---|---|---|---|
| Conversation (existing) | NPC line auto-speaks at the profile rate; slow 0.58×; replay per bubble | answer by voice (ja-JP) and "say it your way" in your language (en-US / ar-SA) | type Japanese/romaji/L1; chips |
| Prepare | each pocket line 0.8× then 1.0× | **Say it** with similarity feedback | type it; pick meaning; pick line |
| Debrief echo | the helped line plays | **Say it** (≥ 0.60) | type it |
| Phone chat | tap a bubble to hear it; **voice messages** are TTS bubbles (text hidden until revealed) | dictation into the reply box, editable before sending | type, chips, stamps |
| Shifts | the customer speaks **and that is the puzzle** (text hidden); prices read from data | optional: say the total / repeat-back | tap items, tiles, pick totals; *Show text* is always available (a stated cost, waived when listening is off, §9.1) |
| Station/vending/ticket panels | optional readings of prices and announcements | none | tap |
| Festival speech, Letter Home | Hanako reads it back | speak your 5 lines (not stored) | type |
| Lessons (existing) | model audio | shadowing like Prepare | type/pick |

The mic and a Japanese voice give **no yen premium** (accessibility: deaf, shy, noisy rooms, no mic); they are rewarded with practice and the optional echo bonus. Objectives never require audio (`audio:'required'` does not exist in the schema).

### 12.2 Diagnostics and consent (builds on the existing `collectAudioReport`, `requestMicrophone`, `explainSttError`, `AudioCheck.tsx`, `strings/audio.ts`)

1. A derived **`AudioMode`**: `full-voice` (JA voice + STT + mic ok), `listen-and-type` (JA voice, no STT), `read-and-type` (no JA voice), `type-only`. Shown as a badge on Audio check and used by quests/daily goals to swap audio-flavoured templates.
2. **Privacy notice, one time, before the first recognition** (and in Audio check): "On Chrome, voice recognition in this sample sends your audio to Google. Typing never leaves your device. Allow voice input?" Stored as `audio.sttConsent: 'unset'|'allowed'|'declined'` in the game store; declined hides the mic button (`type-only`) and "never ask again" is remembered. **Kids (6-12): voice input is off by default and the card is never shown to the child**; enabling it needs an adult gate (a simple arithmetic question, `audio.parentGate`) and parent-facing wording ("This browser sends your child's voice to Google"). Teens and adults see the card once. Everything else in the app stays local.
3. Audio check gains a **say-こんにちは test** (4 s listen with transcript, confidence, latency), a slow-speed sample and a headphones tip; each `AudioIssue` already maps to a fix card per OS.
4. Persisted `audio` slice: `{ sttConsent, micPref:'auto'|'off', listenPref:'on'|'off', ttsRateScale, lastMode, lastCheckedAt }`; the full report is not persisted.

### 12.3 Degradation matrix (always say it plainly, once, with a "fix it" link)

| Situation | Behaviour |
|---|---|
| Chrome/Edge/Android, JA voice + mic | full voice after consent |
| Safari/iOS | STT may work with Dictation on; TTS needs the first-gesture unlock (existing); wait for `voicesReady()` before declaring "no Japanese voice" |
| Firefox / no `SpeechRecognition` | mic hidden; "Type instead; the game plays the same"; speaking tasks become "type it" |
| No Japanese voice | banner "You'll read instead of hear": listening tasks become reading tasks, shift customers show text (the ×0.7/×0.5 factors and assisted flags are **waived**), listening bonuses are cosmetic only, **never speak Japanese with an English voice** (`NullTts` only animates the mouth) |
| No TTS at all | same, plus no slow button |
| Listening not possible or not wanted (`listenPref:'off'`, AudioMode `read-and-type`/`type-only`, muted device, noisy bus, hearing difficulty) | every listening penalty and `assisted` flag is **waived**: shift customers show text at full credit, voice-message bubbles render as ordinary text, nothing is marked "revealed". A one-tap *Can't listen right now* (`hud.cantListen`) on the Shift and chat screens sets `listenPref` for the session. |
| Mic denied | explain once, offer a retry from Audio check, never nag in conversation |
| 3 consecutive unrecognised/low-confidence speech turns | inline "Type it instead?" keeping the draft |
| Offline (Chrome STT needs network) | `network` id → "Voice needs internet in this browser; typing works offline" |

### 12.4 Hearing prices and mis-hearing (engine: `speechNormalize.ts`, `speechScore.ts`)

1. `STT`: set `maxAlternatives = 3`; `SttResult` gains `alternatives?: Array<{text:string; confidence:number}>`; `ConversationSession.submit` tries every alternative against the node's intents and keeps the best `IntentHit` (display the first).
2. **Confidence policy:** ≥ 0.75 submit directly; 0.45-0.75 an inline chip row "I heard: 〈text〉 Yes / Edit / Try again" (no turn consumed until confirmed); < 0.45 treated as unmatched without counting a fallback.
3. **Normalisation pipeline** (extends `normMatch` in `engine/matching.ts`, owned by 1C, which calls 1G's `speechNormalize` and 1B's `parseJaNumber`): NFKC; strip fillers (えーと, あのー) and punctuation; **numbers unified**: Arabic digits, kanji numerals and kana numerals parse to an integer via `parseJaNumber` and re-render as the canonical kana, so "450円", "四百五十円" and "よんひゃくごじゅうえん" are the same token (critical for prices and shift totals; irregulars 300/600/800/3,000/8,000 are tested); katakana → hiragana; long-vowel equivalences (`ありがとー` = `ありがとう`); `を/お`, `づ/ず`, `ぢ/じ`; unknown kanji compare by character-level Levenshtein against both the written and reading forms.
4. `speechSimilarity(a,b) = 1 − levenshtein(norm(a), norm(b)) / max(len)`; "great" ≥ 0.85. Move the `similarity` function out of `Conversation.tsx` into the engine so Prepare, Debrief, shifts and the copy rule (§3.2) reuse it.
5. Corrections ignore speech turns with confidence < 0.8 (§11.4).

---

## 13. Anti-exploit (arithmetic, not policing)

Threat model: local single-player, no server, no real money. We defend against **accidental and cheap** farming; editing localStorage only hurts the editor. Every countermeasure **reduces today's earnings or credit**; none deletes progress or shames.

| # | Exploit | Prevention (all tested) |
|---|---|---|
| E1 | Replay one easy scenario all day | `dayFactor [1,.35,.1,0]` (a repeat-one persona earns ≤ 25% of the diversified one, §4.6), soft cap ¥14k ×0.25, finite star and first-phrase pools, objectives count *distinct* things |
| E2 | Spam 「はい」, one phrase, nonsense | substantive-turn rule (§3.2): duplicates and thin turns are ignored; pay needs ≥ #steps substantive turns; `distinct` counts different intents; `clean` penalises fallbacks/hints; 6 consecutive unmatched turns end the conversation (no payout, no penalty) |
| E3 | Tap suggestions only | credit 0.35 → `F≈0.34`; shops, wallet and items never need own words; earns ~⅓; story objectives that need own words have Prepare recall and `easier` alternatives (D40) |
| E4 | Type a translation request instead of speaking | credit 0.25; a copy of the translation is class T, never I; no first-phrase pay, never counts toward `say_new` or `minIndependent` |
| E5 | Copy a chip, a hint or a translation by typing it | `copyScore ≥ 0.80` against *everything shown* in the conversation = class S (T for a translation); Hint opened at a node caps that turn at S; a one-keyword turn earns 0.60; tests: translate-then-copy ≤ all-S, hint-then-type ≤ all-S, one-edit copy = S |
| E6 | Shift farming | ≤ 2 paid shifts/day (×1, ×0.6/0.5), 3rd unavailable; 0.75 paid hours; objectives need all 5 customers and accuracy ≥ 0.6; the ¥100 trial wage never counts; the shift-only persona earns ≤ 20% of the diversified one |
| E7 | Buy/sell loops | no selling, no refunds; consumables ≤ 3 per transaction; points ≤ 1% of spend, ¥300/day |
| E8 | Gift farming | 1 AP-gift per friend per day; the hand-over must name the item; gift AP ≤ 40% of the next heart gap and ×0.5 on a day with no talk; repeat item ×0.25 for 7 days; daily AP cap 60 per friend; only conversation-bought goods |
| E9 | Negotiation spam / assisted haggling | car dealer only, one attempt per item per day, ≤ min(6%, ¥8,880) of body price, never stored, assisted gets 40%; routine discounts ≤ 8% of body price |
| E10 | Reload / save-scum / double settle | every payout is a ledger entry with an idempotent id (`loop:<sessionId>`, `purchase:<sessionId>:<n>`, `goal:<day>:<id>`); `recordLoop` persists **before** showing the report; leaving pays nothing |
| E11 | Quit right after paying to skip debrief | the purchase commits at `charge` (goods are real); the loop pay commits only at the end node |
| E12 | Clock tampering | `dayIndex` +1 per observed later date (any jump = +1), earlier dates only re-anchor; chapter completion ≤ 1/day; `activeDays` counts days with real activity; e2e: a +400-day jump then a return gives exactly one extra rollover and reopens nothing |
| E13 | Skip the story with money | gates are chapters (language objectives + days); the one saving goal (the phone) is affordable when Chapter 4 opens and has a catch-up stipend; closed shops say 「まだ準備中です」 |
| E14 | Daily goals as a pure farm | goals need real activity thresholds; `g_review8` counts due, previously reviewed cards answered through a check; the chest is ≤ ¥600/day |
| E15 | Overflow / negative balance | integer yen, `wallet ≤ 9,999,999`; spend validated inside the reducer at `charge`; `short` is a scripted branch |
| E16 | Free travel for "visit" goals | fares are paid; no yen for movement; `g_place` counts distinct places |
| E17 | Typing digits instead of kanji in shifts | accepted and normalised (`parseJaNumber`): the learning check remains (the customer speaks, the learner must produce the number) |
| E18 | Review farming | the daily goal counts due cards only; FSRS reschedules them; no review pay |
| E19 | Hearts by spam chat | chat AP 8/day, 3 unread max, one counted talk per friend per day |
| E20 | Reach `ready` in Prepare by guessing | `ready` needs a hidden-line recall (say, type or tiles); pick-checks never reach it; the stamp expires after 7 days |
| E21 | Echo by copying the screen | the line is hidden; *Peek* forfeits the yen; ¥100/day cap |
| E22 | Strand or loop money through the IC card | cap ¥3,000 until Ch5; refund at the station; top-ups/refunds are transfers outside `totals` |
| E23 | A discount from onboarding choices | none exists: tax-free is a learning-only branch, perks are one-time and data-driven |

Ethics checklist (reviewers must verify): no timers, no random rewards or loot, no loss of money/hearts/rank by being away, streak bonus capped at ¥150, goals stay open two days, no ads or real money, no alcohol/tobacco/gambling items (the konbini menu is non-alcoholic), kids never see the flat/car as purchasable.

---

## 14. Country-pack architecture and the `@lw/game` package

### 14.1 Package graph (acyclic) and what is new

```
@lw/core      kana, FSRS, storage port, XP/streak          (unchanged except small exports)
   ▲
@lw/game      NEW. Pure TypeScript, no React/Three/DOM. Depends on @lw/core only.
              money, pricing, ledger, payout, objectives, daily, friends, inventory, shifts, integrity, reducer, persist, validate
   ▲                         ▲ (types only)
@lw/content  language + country-pack DATA          @lw/engine  conversation + scoring + speech normalise
   ▲
@lw/world    Tokyo district, buildings, stages     (no game import; emits plain events)
   ▲
apps/mobile  stores, bridge, screens
```
`@lw/game` receives a `GamePack` **as an argument** (dependency injection); it never imports Japanese data. `@lw/game` defines its own tiny structural `Gloss`/`Line`/`Cefr` types (compatible with content's by structure), so no cycle. Workspace wiring (agent 1A): root `tsconfig.json` `paths`, `vitest.config.ts` alias, `apps/mobile/package.json` dependency and Vite alias for `@lw/game`.

### 14.2 `GamePack` (data schema; the Japan pack lives in `packages/content/src/tokyo/game/`)

```ts
interface GamePack {
  schema: 1; id: 'jp'; language: 'ja'; district: 'tokyo';
  name: Gloss; currency: CurrencyDef; economy: EconomyDef; tax: TaxRegime; rules: PackRules; lang: LanguagePlugin;
  menu: MenuItem[];                       // consumables keyed by shop + slot option id
  items: ItemDef[];                       // §5.2/§5.3 catalog
  shops: ShopDef[]; fares: Record<string, number>;
  jobs: JobDef[]; chapters: ChapterDef[]; dreams: DreamDef[]; daily: DailyTemplate[]; beats: Record<string, Beat>;
  friends: FriendDef[]; interactions: Record<string, Interaction[]>;
  scenarioMeta: ScenarioMeta[]; pockets: Record<string, PocketLine>; wordTags: Record<string, string[]>;
  culture: CultureCard[]; titles: TitleDef[]; ageProfiles: Record<'kids'|'teens'|'adults'|'seniors', AgeProfile>; idAliases?: Record<string, string> /* renamed ids, §14.7 */;
}
interface CurrencyDef { code:string; symbol:string; minorPerMajor:1|100; symbolPlacement:'prefix'|'suffix'; groupSep:string; decimalSep:string; roundTo:number; spoken?:string }
interface EconomyDef  { refWage:number /* minor units: JP 1150 */; incomeScale:number /* refWage/1150 */; startCash:number; icCap?:number; walletCap:number; bigTicket:number }
interface TaxRegime   { inclusive:boolean; rates:Record<string,number>; eatInRate?:number; takeOutRate?:number; touristRefund?:{ min:number; needsPassport:boolean } }
interface PackRules   { negotiation: Record<string /*shopId*/, { maxPct:number; maxAmount:number; assistedShare:number }>; haggling:boolean; shoesOff:boolean; tipping:'none'|'small'|'expected'; pointsCard?:boolean; deliveryFee:number; registrationFee?:number }
interface ShopDef     { id:string; placeId:string; name:Gloss; openChapter:number; surface:'world'|'panel'; register:'polite'|'keigo'|'casual'; sells:string[] /* item/menu ids */ }
interface ItemDef     { id:string; name:Gloss & { ja:string; reading?:string }; price:number; cat:'transport'|'electronics'|'clothing'|'home'|'gift'; shop:string; gate:{ ch:number /* chapter.n >= ch; 9 = Free Walk (D36) */; ageMin?:number; stars?:{ n:number; atLeast:1|2|3 } }; fx:ItemEffect[]; tags:string[]; bulky?:boolean; once?:true }
type ItemEffect =
  | { t:'feature'; id:'phone'|'ic' } | { t:'ride'; mul:number; mesh:'bike'|'ebike'|'car' }
  | { t:'avatar'; patch:{ top?:string; bottom?:string; shoes?:string; accessory?:string; colours?:string[] } }
  | { t:'home'; slot:string; comfort:number } | { t:'homeTier'; tier:'ono' } | { t:'gift'; tags:string[] } | { t:'card'; id:string };
interface FriendDef   { id:string; tier:'A'|'B'; register:'casual'|'polite'|'keigo'; casualAt:0|1|2|3|99; unlockChapter:number;
                        home?:{ stage:string; door:string }; loves:string[]; likes:string[]; dislikes:string[]; facts:[string,string,string]; perks:PerkDef[] }
interface ScenarioMeta{ id:string; kind:'talk'|'shop'|'friend'|'chat'|'home'|'hangout'|'heart'|'trip'|'story'|'jobintro'; band:'A1'|'A2'|'B1';
                        register:'casual'|'polite'|'keigo'; pay:'full'|'none'; real?:boolean; pocket?:string[]; gate?:Pred; culture?:string[];
                        shop?:{ shopId:string; itemSlot:string; qtySlot?:string; payStep:string; itemMap:Record<string,string>; fees?:Array<{ id:string; amount:number; when?:string }> };
                        friendId?:string; capstone?:boolean; requiredIntents?:string[] /* ids objectives need, e.g. 'ramen:itadakimasu' */; twist?:boolean }
interface Interaction { id:string; label:Gloss; kind:'scenario'|'shift'|'gift'|'lesson'|'trip'|'visit'; scenarioId?:string; jobId?:string; gate?:Pred }
interface ChapterDef  { n:number; title:Gloss; minDays:number; reward:number; opens:Array<{ kind:'place'|'job'|'feature'|'shop'|'interaction'; id:string }> /* take effect when the chapter BECOMES CURRENT (D36) */; startGate?:Pred; objectives:Objective[]; beats:{ open:string; close:string }; catchUp?:{ afterActiveDays:number; item:string; maxYen:number } }
```

### 14.3 `LanguagePlugin` (the only per-language logic)

```ts
interface LanguagePlugin {
  readNumber(n: number): string;                          // ja: 2980 → 'にせんきゅうひゃくはちじゅう'
  priceMarkup(n: number, cur: CurrencyDef): { markup: string; reading: string; gloss: Gloss };   // ja: yenToJa
  parseNumbers(text: string): { text: string; numbers: number[] };   // digits | kanji | kana → ints
  speechNormalize(text: string): string;                  // kana folding etc.
  registerMarkers: Record<'casual'|'polite'|'keigo', { good: string[]; bad: string[] }>;
}
```

### 14.4 Japanese numbers and prices (`jp-language.ts` + `lexicon/numbers.ts`, agent 1B)

`yenToJa(n)` (1 ≤ n ≤ 9,999,999) returns markup of `|`-separated lexicon tokens, the reading and the gloss `{en:'24,800 yen', ar:'24,800 ين'}`; it is passed as a non-raw `Vars` value so it tokenises and ruby-annotates like any line. Rules: split into 万 groups; within a group emit `thousands, hundreds, tens, ones`; omit the digit 一 before 十/百/千 (but keep 一万); **irregular compounds are lexicon entries**: `三百 さんびゃく`, `六百 ろっぴゃく`, `八百 はっぴゃく`, `三千 さんぜん`, `八千 はっせん` (plus plain `一…九, 十, 百, 千, 万, 円`). Examples: 160 → `百|六|十|円` (ひゃくろくじゅうえん) — digit and unit stay separate tokens except the irregulars; 450 → `四|百|五|十|円`; 24,800 → `二|万|四|千|八|百|円` (にまんよんせんはっぴゃくえん, with 八百 as one token); 198,000 → `十|九|万|八|千|円`; 1,050 → `千|五|十|円`. `speakableText` reads numeric tokens by their reading (a regex over `[一-九十百千万円]`) so TTS pronounces rendaku correctly. `parseJaNumber(text)` accepts `450円`, `450`, `4,50`, `四百五十円`, `よんひゃくごじゅうえん`, mixed forms. **Tests:** a table of ≥ 80 prices from §5 round-trips (`parseJaNumber(reading(yenToJa(n))) === n`) and every token is in the lexicon.

### 14.5 `@lw/game` API (contract written by agent 1A in `types.ts` + `api.ts`; implemented by 1B-1F)

```ts
// ---- state (persisted; JSON-safe) ----
interface GameState {
  v: 1; packId: string;
  clock:  { dayIndex: number; lastLocalDate: string; lastSeenAt: number; activeDays: number; lastActiveDay: number };   // see observeClock below
  wallet: { cash: number; ic: number; points: number };
  totals: { earned: number; spent: number; checksum: { cash: number; ic: number; points: number } };   // cash-only money; transfers excluded (§4.1)
  ledger: LedgerEntry[]; seen: string[];                        // rings: 200 / 300
  pay: { day: string; langToday: number; firstPhraseToday: number; echoToday: number;
         scenarioToday: Record<string, number>; lastPaid: Record<string, string>; shiftsToday: Record<string, number>; seenIntents: string[] };
  runs: Record<string, { count: number; complete: boolean; stars: 0|1|2|3; bestIndependent: number; bestShare: number; bestR: number }>;   // per scenario, best-of
  stats: { purchases: number; spentOnPurchases: number; gifts: { n: number; liked: number; loved: number }; chats: { n: number; friends: Record<string, number> };
           hangouts: Record<string, number>; visits: string[]; spots: string[]; tickets: number; sayNew: number };
  owned: Record<string, { qty: number; day: string }>;
  outfit: { equipped: string[]; colours: Record<string, string> };
  home:   { tier: 'dorm'|'ono'; placed: Record<string, string> };
  tickets: { ramen?: { flavor: string }; station?: { place: string } };
  chapter: { n: number /* current chapter, 9 = Free Walk */; done: Record<string, string>; completed: number[] /* cache, re-derived from objectives on load */; flags: string[]; easier: string[] };
  dream:  { id: string | null; steps: Record<string, string>; done: boolean };
  daily:  { day: number; goals: DailyGoalState[]; carried: DailyGoalState[] /* yesterday's unfinished, §7.4 */; counters: Record<number, Record<string, number>> /* last 2 days */; swapUsed: boolean; allPaid: boolean; streakPaid: boolean; recent: string[] };
  friends: Record<string, FriendState>;                         // ap, met, talkDay, giftDay, apToday, hangoutDay, facts, learned, callbacks, flags, giftHistory
  jobs:   Record<string, { shifts: number; good: number; rank: number; lastDay?: string }>;
  prep:   Record<string, { s: 'seen'|'ready'; at: number }>;   // at = dayIndex; a recall `ready` expires after BALANCE.readyDays
  culture: Record<string, string>; titles: string[]; activeTitle: string | null;
  words:  { said: string[] }; diary: Array<{ chapter: number; ja: string; assisted: boolean }>;
  audio:  { sttConsent: 'unset'|'allowed'|'declined'; micPref: 'auto'|'off'; listenPref: 'on'|'off'; lastMode?: string };
  me:     { nameKana: string };
  flags:  { dev?: boolean; welcomeSeenDay?: number };
  seeded: boolean;  _extra?: Record<string, unknown>;   // seed-once marker; unknown ids/fields are kept, never dropped (§14.7)
}
type LedgerKind = 'loop'|'shift'|'goal'|'streak'|'chapter'|'star'|'phrase'|'echo'|'purchase'|'fare'|'topup'|'refund'|'gift'|'perk';
interface LedgerEntry { id: string; at: number; kind: LedgerKind; delta: number; pocket: 'cash'|'ic'|'points'; ref?: string; note?: string }

// ---- facts the engine hands over after a conversation (engine/scoring.ts builds it) ----
interface ConversationFacts {
  sessionId: string; scenarioId: string; characterId: string; mode: 'guided'|'real'; abandoned: boolean; durationSec: number;
  goalDone: number; goalTotal: number;
  turns: Array<{ id: number; cls: 'I'|'S'|'T'; credit: number; substantive: boolean; thin?: boolean; copied?: boolean; recalled?: boolean; hintOpened?: boolean; contentTokens: number; intentId?: string; stepIds: string[]; request?: boolean; norm: string; newWords: string[]; confidence?: number }>;
  fallbacks: number; hintUses: number; accuracy: number | null; requestsPolite: boolean; prepared: boolean;
  remembered: Record<string, string>;
}

// ---- events ----
type InputEvent =
  | { t:'conversation_done'; facts: ConversationFacts }
  | { t:'purchase'; sessionId: string; n: number; shopId: string; itemId: string; qty: number; total: number; method: 'cash'|'ic'|'card'; lines: QuoteLine[] }
  | { t:'gift_given'; friendId: string; itemId: string; sessionId: string; assistedHandover: boolean }
  | { t:'shift_done'; jobId: string; result: ShiftResult }
  | { t:'lesson_done'; id: string } | { t:'word_saved'; key: string } | { t:'sign_found'; id: string } | { t:'culture_seen'; id: string }
  | { t:'srs_review'; keys: string[]; due: number } | { t:'prepare_done'; scenarioId: string; ready: string[] } | { t:'echo'; sessionId: string; lineId: string; similarity: number }
  | { t:'visit'; place: string } | { t:'spot'; id: string } | { t:'ticket_bought'; kind: 'ramen'|'station' } | { t:'trip_done'; id: string }
  | { t:'item_placed'; slot: string; itemId: string | null } | { t:'outfit_changed'; equipped: string[]; colours: Record<string,string> }
  | { t:'phone_chat_done'; friendId: string; sessionId: string; facts: ConversationFacts } | { t:'flag'; id: string }
  | { t:'dream_chosen'; id: string | null } | { t:'day_observed'; nowMs: number } | { t:'audio_mode'; mode: string };
type DerivedEvent =
  | { t:'wallet_changed'; delta: number; balance: number; kind: LedgerKind } | { t:'hearts_changed'; friendId: string; from: number; to: number }
  | { t:'stars_changed'; scenarioId: string; from: number; to: number } | { t:'objective_done'; id: string } | { t:'chapter_done'; n: number }
  | { t:'dream_step_done'; dream: string; step: string } | { t:'dream_done'; dream: string } | { t:'goal_done'; id: string } | { t:'daily_done'; day: string }
  | { t:'culture_unlocked'; id: string } | { t:'title_earned'; id: string } | { t:'unlocked'; what: 'place'|'job'|'feature'|'dream'; id: string } | { t:'heart_event_ready'; friendId: string; level: number };
type UiEffect = { t:'toast'; key: string; vars?: Record<string, string|number> } | { t:'fanfare'; kind: 'purchase'|'chapter'|'dream'|'heart' }
              | { t:'culture'; id: string } | { t:'beat'; id: string } | { t:'srsOps'; ops: SrsOp[] } | { t:'celebrate'; payload: unknown };

// ---- the reducer (single entry point; deterministic given (state, event, ctx)) ----
interface ReduceCtx { pack: GamePack; now: number; view: GameView; rng: () => number }      // GameView = read-only data from the v1 store
interface GameView { vocab: { total: number; known: Set<string>; dueCount: number; reviewedKeys: Set<string> }; discovered: string[]; lessonsDone: string[];
                      streakDays: number; profile: { age: 'kids'|'teens'|'adults'|'seniors'; goal: string; level: 'A1'|'A2'; createdAt: string }; }
function reduce(state: GameState, ev: InputEvent, ctx: ReduceCtx): { state: GameState; derived: DerivedEvent[]; effects: UiEffect[] };
function createGameState(pack: GamePack, now: number): GameState;
```
Reducer pipeline: **integrity** (dedupe by id/sessionId, `observeClock`, rollover) → **economy** (ledger, `settleLoop`, purchases) → **friends** → **inventory** → **mastery** (stars, prepare readiness) → **srs bridge** (returns `srsOps` for the v1 store to apply) → **objectives/chapters/dreams** (queue-processes derived events, depth ≤ 4) → **daily** → **effects**. The remaining named types (`PerkDef`, `DailyGoalState`, `FriendState`, `QuoteLine`, `ShiftResult`, `SrsOp`, `Beat`, `DreamDef`, `DailyTemplate`, `TitleDef`, `AgeProfile`, `CultureCard`, `MenuItem`, `PocketLine`, `Pred`) are direct projections of the tables in §7-§11 and are written out by 1A. Pure helpers (all exported, all unit-tested): `quote`, `commitPurchase`, `settleLoop`, `payoutFactor`, `starsFor`, `yenFormat`, `evalPred`, `evaluateAll`, `generateDaily`, `applyTalk`, `applyGift`, `reactionFor`, `generateShift`, `scoreShift`, `shiftPay`, `observeClock`, `nextBestGoal`, `validatePack`, `validateState`, `migrate`.

**`observeClock(state, nowMs)`** (D3, D27). Let `d` be the local `YYYY-MM-DD` of `nowMs`. If `d === lastLocalDate`: nothing. If `d > lastLocalDate`: `dayIndex += 1` (**exactly one rollover, whatever the size of the jump**), run the rollover once (daily goals, counters, caps), set `lastLocalDate = d`. If `d < lastLocalDate`: set `lastLocalDate = d` and change nothing else. `activeDays` increments on the first meaningful action of a `dayIndex`. A dead-battery reset to 2030 therefore costs one spurious day, and the return to 2026 reopens nothing and does not pin the calendar (the first design used `max(today, stored)` and would have frozen daily goals, shift caps and every min-days gate until real time caught up). Tests: a +400-day jump then a return; a time-zone hop (−1 day then +1 day) grants at most one extra rollover; midnight with the app open; DST days.

**`validatePack(pack, { level, index? })`** checks pack-internal integrity only (`@lw/game` cannot import `@lw/content`). The optional `ContentIndex { scenarios, lexiconSurfaces, slots }` is injected by the content tests, which do the cross-checks (lexicon tokens with EN+AR, scenario ids and steps, slots, `requiredIntents`, sale routes). Levels tolerate unresolved ids until their level: 1 structure and ids, 2 slice-2 content, 3 catalog, sale routes (§5.6) and gates, 4 chapter graph with the bot and prerequisites (§7.1), 5 everything. 2B and 2F author the full `interactions`, `chapters` and `dreams` tables in slice 2 even though they name scenario ids that later slices build; the lower levels do not fail on those ids.

**Who dispatches:** the conversation screen (`conversation_done`, plus `purchase`/`gift_given` from `SessionGameHooks`), the world screen (`visit`, `spot`, `sign_found` via the existing `discover`), Prepare (`prepare_done`), Review/Lesson screens, Shift, Phone, panels, and the app shell (`day_observed` on mount, focus and `visibilitychange`). All go through one function `bridge.dispatch(event)` in the app. The app shell calls `bridge.init()` once after both stores have hydrated (§14.7), and conversations are requested through `useUi.convo` (§11.2).

### 14.6 Reusing the engine for another country pack

Everything country-specific is data in `packages/content/src/<country>/game/` plus a `LanguagePlugin`; formulas never change.
- **Price in work-hours.** Keep each goal item within ±20% of the Tokyo value measured in hours of the pack's `refWage`: phone 21.6 h, bicycle 17.2 h, helmet 2.6 h, room 52 h, used car 172 h, e-bike 77 h, ramen 0.8 h, onigiri 0.14 h. `incomeScale = refWage / 1150` multiplies every `BALANCE` amount, rounded to `roundTo` (so a €9/h pack gets a phone near €195, a bike near €155, a used small car near €1,550) and the §4.6 timetable holds unchanged.
- Wallet per pack (`lw.game.<packId>.v1`); no FX.
- What re-authors per pack (not code): shop steps and culture cards, friends and their registers (tú/usted, du/Sie), jobs and menu, chapter text, scenarios and pockets.

| Concept | Japan (this build) | Spain (example) | Germany (example) | Arab world (example) |
|---|---|---|---|---|
| currency | ¥, 0 decimals, 万 grouping | €, 2 decimals, "tres con cincuenta" | €, "drei Euro fünfzig", **Pfand** deposit rule | EGP/AED, **haggling** at the souq (`PackRules.haggling`, a counter-offer node) |
| shop greeting | いらっしゃいませ | ¡Hola, buenas! | Guten Tag (greet when entering) | السلام عليكم |
| tipping | none | small, rounding up | round up 5-10% | small |
| home entry | shoes off (`shoesOff:true`) | usually shoes on | often shoes off / Hausschuhe | shoes off |
| formality | です/ます ↔ plain | tú ↔ usted | du ↔ Sie | — |
| transit card | IC (Suica/PASMO) | Abono / Multi | Deutschlandticket | — |
| festival | 祭り, yukata | feria / fiesta de barrio | Weinfest / Weihnachtsmarkt | Ramadan market |

Known debt: `Line.ja` should become a language-neutral `Line.t` when the second language arrives (D34). The world package is Tokyo-specific this build; agent 1H introduces a `District` type (`{id, bounds, shops, npcSpawns, doors, spots, walkers, build(ctx)}`) with `TOKYO_DISTRICT` as the only implementation and `TokyoWorld({ district })` defaulting to it, so a second district is data plus a builder, not a fork.

### 14.7 Persistence, versioning, migration

- **Store:** `useGame = create(persist(...))` with `name: 'lw.game.jp.v1'`, `version: 1`, **`skipHydration: true`**, a custom `StateStorage` adapter over the existing `SafeLocalStore` (blocked storage degrades to memory), `partialize` = `GameState`, `migrate(persisted, from)`. The legacy store hydrates later inside a `useEffect` (`App.tsx`), so `bridge.init()` calls `useGame.persist.rehydrate()` **after** `useStore.hydrate()` has finished and then runs the seed below; nothing reads `GameView` before that. Writes are debounced (250 ms) **except** money, purchase and story events, which flush immediately (`flushNow()`), and both stores flush on `pagehide` and `visibilitychange: hidden` (E10: `recordLoop` persists before the report shows).
- **First run:** if `lw.game.jp.v1` is absent **or `seeded` is false**, `createGameState(pack)` seeds `friends[id].met` and `runs[id].stars` from the legacy `completed` map (now loaded; `count ≥ 1 → ★1`, `best ≥ 100 → ★2`, **no retroactive yen**), `chapter.n` at 1, wallet ¥3,000, and sets `seeded = true` in the same write, so the seed is idempotent. The legacy key `lw.v1.state` is never touched (vocab, XP, streak, settings, discovered, lessonsDone stay there; `GameView` reads them).
- **Unknown ids and renames:** a removed or renamed id is **never silently dropped**: renames go through `pack.idAliases`, anything else is kept under `_extra` (owned items included) and ignored by the reducer. `chapter.completed` is a cache re-derived from the objectives on load, so a pack edit cannot leave the two disagreeing. A `migrate` test freezes sample JSON fixtures per release (empty, typical, heavy, corrupt) and asserts `validateState`.
- **Reset:** Settings gets two buttons: *Reset game progress* (clears only `lw.game.jp.v1`, keeps vocabulary and XP) and the existing reset (`store.reset()`, which now also resets `useGame` so the two never disagree). Both ask for confirmation.
- **Corrupt state:** a recovery screen offers *Start fresh* (never a silent wipe) and *Download my data* (JSON file, the only "export", local).
- **Derived, never stored:** hearts (from AP), `words_known`, dream progress, available quests, `nextBestGoal`, inventory flags (`hasPhone`, `speedMult`…), due counts, audio mode, `payoutFactor` windows.

### 14.9 Registry of ids (so nothing is invented twice)

- **Places** (`Character.locationId`, `ShopDef.placeId`): existing `konbini, cafe, school, ramen, station, park`; new `fukufuku, denki, motors, ono, hikarigaoka, home_mio, home_aiko, home_kenji, dorm, flat`.
- **Shop ids** (items, perks, pricing): `konbini, cafe, ramen, station, vending, denki, fukufuku, aiko, motors`.
- **Characters:** existing `yuki, tanaka, sato, kenji, hanako, mio`; new `aiko, rin, nakamura, aoi, kato, hina`.
- **Stages:** `dorm, mio_1r, aiko_tatami, kenji_flat, ono_flat`. **Door picks:** `door:dorm, door:mio, door:kenji, door:aiko`. **Spot picks:** `spot:torii, spot:pond, spot:east_end, spot:west_end, spot:station_plaza`. **Other picks:** `vending, ticket, ramen_machine`.
- **Flags** (`chapter.flags` / `FriendState.flags`, set by beats, scenarios and events; `Pred {k:'flag'}` reads them): `letter_written, dream_epilogue, ticket_bought, souvenir_given, housewarming, first_drive, aiko_room_shown, genkan_ok, heart5_seen, number_note, casual, plan_<friendId>, pro_locked, tv_locked`. Session flags (`SessionOptions.flags`, read-only booleans for `SayVariant.when`): `casual` (the friend has switched), `pro_locked` / `tv_locked` (not yet in stock), `minor` (under-18 profile), `twist` (§6.2), `genkan_ok`, `prepared`.
- **Item categories** for `own category:`: `phone, bicycle, car, flat, yukata` (derived from `ItemDef.tags`).
- **Slots added by the game** (module `slots/shop.ts` unless noted; names are unique across modules): `payMethod`, `qty`, `chargeAmount`, `giftItem` (shared), `denkiItem`, `carModel`, `bikeModel`, `purpose`, `colour`, `size`, `fit`, `clothes`, `furniture`, `delivery`, `deliveryDay`, `trip`, `ramenExtra`; `place` (existing, `slots/base.ts`, owned by 2G) gains `hikarigaoka` and the Haneda label.
- **Stickers / services:** `st_<dream>` (7 dream stickers), `svc_lantern` (the lantern fund).
- **Culture ids:** the 23 `cc_*` ids in §10. **Title ids:** `t_newcomer, t_friend, t_connected, t_traveller, t_guest, t_resident, t_lives_in_ja`, `t_dream_<dream>` (7), one `t_heart_<friend>` per friend (9, §8.9).
- **Beat ids:** `b_ch<n>_open`, `b_ch<n>_close`, `b_mio_h2`, `b_phone_bought`, `b_rankup`, `b_heart_<friend>`, `b_h4_<friend>`, `b_dream_<dream>`, `b_dream_step`, `b_phone_fund`, `b_real_try`, `b_welcome_back`.
- **Ledger id formats:** `loop:<sessionId>`, `purchase:<sessionId>:<n>`, `goal:d<dayIndex>:<goalId>`, `streak:d<dayIndex>`, `chapter:<n>`, `star:<scenarioId>:<n>`, `phrase:<dayKey>:<k>`, `echo:<sessionId>:<lineId>`, `shift:<dayKey>:<jobId>:<n>`, `gift:<sessionId>`, `perk:<id>`.

### 14.8 What must be refactored first (findings from reading the current code)

| Finding in the current code | Required change | Owner |
|---|---|---|
| Lexicon, slots, phrasebook, scenarios, characters and lessons were single arrays | **Already split into registries in the working tree** (uncommitted: commit before slice 1). Slot names must stay unique across slot modules, so new shops add *new* slot names (`denkiItem`, `carModel`, `clothes`, `furniture`, `giftItem`, `bikeModel`, `purpose`, `payMethod`, `chargeAmount`, `trip`…), never extend `item`; `PLACES` has no `hikarigaoka` | done / 3C, 3D, 2G (and `slots/base.ts` for `hikarigaoka`: 2G) |
| `i18n.ts` was one big object | Already per-feature modules merged at runtime; add `hud`, `debrief`, `prepare`, `phone`, `home`, `story` | 1A |
| `store.ts` is a hand-rolled `SafeLocalStore('lw.v1.')` JSON save (not zustand `persist`) that hydrates in a `useEffect`; the `Screen` union is closed; `reset()` wipes everything; `VocabItem.source` has no `goal`/`correction` | add the separate `useGame` persist store with `skipHydration` + `bridge.init()` after `useStore.hydrate()` (§14.7), extend `Screen` and `source`, add *Reset game progress*, make `reset()` reset both | 2A |
| `scenarioForCharacter(id)` and `NPC_ORDER` (`apps/mobile/src/content.ts`) return/assume one scenario per character; `Character.scenarioId` is single | `pack.interactions` + the `useUi.convo` request + Interaction sheet; `content.ts` becomes multi-valued | 2B (`content.ts`), 2C |
| `Conversation.finish()` calls `evaluateSession` + `recordLoop` directly, always `world.enterConversation(characterId)`, and is mounted only from `WorldScreen` local state | route through `bridge.dispatch`; mount from `useUi.convo`; skip the world camera for `channel:'chat'` and for characters without a spawn (`kato`, `hina`) | 2A (request), 2C, 4C |
| Scenarios hard-code prices (`四百五十円`, `三百二十円`, `百九十円`, `九百円`); the konbini price ignores the item | Vars + hooks (§6.6) | 2D |
| `SayVariant.when` only supports `{slot, in}`; `ConversationSession` has no flags, hooks or `startNode`; `Turn` has no hint/substantive info; `IntentDef.slot` allows one slot; `classifyInput` treats a bare number as English; `matching.ts`, `input.ts`, `normalize.ts` have no owner | §6.2 additions (`alsoSlots`, `IntentHit.number`, digit input → `ja`); **1C owns `matching.ts`, `input.ts`, `normalize.ts`** and depends on 1B's `parseJaNumber` and 1G's `speechSimilarity` | 1C |
| `speakableText` speaks kanji numerals as written | speak numeric tokens by reading (rendaku) | 1B |
| `WebSpeechStt` uses `maxAlternatives = 1`; `SttResult` has no alternatives; `similarity` lives inside `Conversation.tsx` | n-best + shared `speechSimilarity` (§12.4) | 1G |
| `layout.ts` constants (`BOUNDS`, `SHOPS`, `NPC_SPAWNS`, `WALKERS`) are used directly by `world.ts` and `city.ts`; `buildCity()` is one ~1,100-line function; south fronts are solid boxes made in a loop; NPCs exist only for `NPC_SPAWNS`; one static collider set | `District`, `BuildCtx`, `buildings/` registry, `FRONT_OVERRIDES`, `Stage` (interiors swap colliders, bounds and camera limits) | 1H, 5A |
| `WorldScreen` derives "next up" from `NPC_ORDER`; `MiniMap` takes only an NPC id | tracker card from `nextBestGoal`; pins | 2B |
| The feedback report has no per-turn credit and `Turn` has no hint info | `ConversationFacts` built by `engine/scoring.ts` | 1C |
| `core/progress.ts` `touchStreak` defaults to `new Date()` | no behaviour change; the game passes the local date string where it needs a deterministic day | — |
| `content.test.ts` asserts `c.scenarioId === sc.id` for every scenario, and its reachability BFS follows only `intent.next` (so `onShort`, `nextIfNo` and `startNode` targets look unreachable) | rewrite both tests: a character's `scenarioId` must be *a registered scenario of that character*, and the BFS follows `next`, `nextIfNo`, `onShort` and every `startNode` in `ScenarioMeta`; add a guard test that a spawned NPC's scenario exists (else the spawn is skipped) | 1A |
| `components/Icon.tsx` is one shared switch; `components/MiniMap.tsx` takes one target; `world/avatar.ts` has no `helmet`; `world/textures.ts` `bubbleTexture` has no `'locked'`; `Accessory` has no `helmet`; `engine/index.ts` must export new modules | 1A pre-adds ~20 icons (coin, heart, phone, gift, train, bag…) and pre-exports every new engine module as a stub; `MiniMap` pins → 2B; `avatar.ts` helmet and `bubbleTexture('locked')` → 1H-a; `Accessory 'helmet'` → 1C | 1A, 2B, 1H-a, 1C |
| `world/city.ts` traffic wraps at x 90 / −110, the east skyline stands at x 100-114, a utility pole stands at (32, 8.4), movement has no sub-stepping, `snapshot()` lists hidden NPCs, the world has no night | §6.4 fixes (wrap ±130, skyline ≥ 110, pole to 30.5, sub-steps, snapshot filter, dusk preset) | 1H-b |

---

## 15. Implementation slicing

### 15.1 Working rules (35 agent tasks in five sequential slices, at most 9 in parallel inside a slice)

0. **Step 0, before any agent starts:** commit the foundation refactor. The working tree currently holds uncommitted registry files, `strings/*` modules, the audio slice and the empty stub files (`characters-extra.ts` and friends); agents branching from an inconsistent tree is the first thing that would go wrong.
1. **Contract first.** Agent 1A works in two steps: **1A-1** publishes `packages/game/src/{types,api,balance}.ts` and the workspace wiring (nobody else starts before this lands); **1A-2** creates every registry/stub file below. Every `api.ts` function gets a stub body that throws `new Error('not implemented')`, so the whole repo typechecks from the first minute. Nobody else edits a registry or `types.ts` without a written change request to the slice captain.
2. **One owner per file per slice.** The tables below are exhaustive. Files that two slices touch have a named owner *per slice* and slices run **sequentially**, so edits never overlap.
3. **Registry rule.** Any table several agents contribute to is a *folder with an `index.ts` that spreads named part files*; each part file has exactly one owner. 1A creates all `index.ts` files and empty part files, so adding content never edits a shared file.
4. **Tests are new files.** Each agent adds its own test files (`<area>.test.ts`). Only 1A edits `packages/content/test/content.test.ts` (generic invariants over registries, **including the rewritten character and graph tests of §14.8**) and only 2D edits `packages/engine/test/session.test.ts`.
5. **Styles are per-agent files** under `apps/mobile/src/styles/` pulled in by one index (`game.css`, created by 1A, imported once in `main.tsx`).
6. **Mount points.** 2A/2B/2C wire every integration point into the shared screens **once** (routes, HUD slots, hooks, bridge functions as stubs, the `useUi.convo` request). Later slices fill component and bridge-function bodies in their own files and never reopen `App.tsx`, `WorldScreen.tsx`, `Feedback.tsx`.
7. **Gate before merge** (slice captain): `npm run typecheck && npm test && npm run content:validate && npm run economy:sim`, then the slice's e2e. `economy:sim` is `vitest run packages/game/test/sim.test.ts` (a plain `.mjs` cannot import the TypeScript reducer: the packages export `src/index.ts` with extensionless imports and the repo has no tsx). The root `e2e` script gains `node tools/e2e/game.mjs` (created by 1F), a runner that executes every script in `tools/e2e/game/` in alphabetical order; each slice drops its own scripts into that folder and never edits the runner.
8. **Dev tools** (2A): hidden Settings toggle (tap the version 7×) with "+¥10,000", "complete current objective", "advance chapter", "advance day" for QA and for the e2e scripts; never shown by default.
9. **Strings.** `t()` is typed by the union of all keys, so **1A pastes every key of §7.6, with EN and AR, into the module that owns its prefix** (§7.6); later agents add keys only to their own module.
10. **Tolerant validation.** `validatePack({ level })` ignores unresolved ids until its level (§14.5). 2B and 2F therefore author the full `interactions`, `chapters` and `dreams` tables in slice 2 even though they name scenarios and items that later slices build; no later slice reopens those files.
11. **Order inside a slice.** Parallel does not mean independent. Slice 1: 1A-1 → 1A-2 → {1B, 1D, 1E, 1G, 1H-a} in parallel → 1C (needs 1B's `parseJaNumber` and 1G's `speechSimilarity`) → {1F (needs 1B-1E implemented), 1H-b (needs 1H-a)}. Slice 2: {2A, 2D} → 2G (needs 2D's `slots/shop.ts`) → {2B, 2C, 2E, 2F} (2E's pocket test needs 2D's refit scenarios; 2C embeds 2E's component through the stub 2A creates). Slices 3-5: the world agents and the content agents are independent; the captain runs the data agents (3E, 4F) last.

### 15.2 Registry and module inventory (created by 1A as stubs, filled by the owner)

| Folder / file | Parts (owner) |
|---|---|
| `content/src/lexicon/` | `core` (existing), `numbers` (1B), `shop` (2D), `station` (2G), `quests` (2F), `shop-denki`, `shop-fuku` (3C), `shop-aiko`, `shop-motors` (3D), `social` (4B-a), `social-chat` (4B-b), `social-friends` (4E-a), `social-hearts` (4E-b), `jobs` (4D), `culture` (4F) |
| `content/src/slots/` and `phrasebook/` | same names as the lexicon parts (`base` existing, edited by 2G for `place`; `numbers` n/a) |
| `content/src/tokyo/` scenarios | `scenarios.ts` (existing five; 2D), `scenarios-shops.ts` (2G: `station_ic`, `sato_directions`), `scenarios-denki.ts`, `scenarios-fuku.ts` (3C), `scenarios-aiko.ts`, `scenarios-motors.ts` (3D), `scenarios-social.ts` (4B-a), `scenarios-chat.ts` (4B-b), `scenarios-jobs.ts` (4D), `scenarios-friends.ts` (4E-a), `scenarios-hearts.ts` (4E-b), `scenarios-story.ts` (5C) |
| `content/src/tokyo/` characters, lessons | `characters-extra.ts` (1A, pasted from §8.2), `lessons-extra.ts` (4F) |
| `content/src/tokyo/game/` pack data | `index.ts` assembles `JP_PACK` from the parts below (1A, empty parts until they land); `economy` (1B: currency, economy, tax, rules, `ageProfiles`); `menu` (2D), `fares` (2G), `interactions` (2B, full table), `chapters`, `dreams`, `daily`, `wordTags` (2F, full tables), `items` (**2G seeds it with `ic_card` and the station services; 3E extends it**), `pockets/` index (1A) with `pockets-core` (2E), `pockets-denki-fuku` (3C), `pockets-aiko-motors` (3D), `pockets-social` (4B-a), `pockets-jobs` (4D); `meta/` index (1A) with `meta-core` (2D), `meta-station` (2G), `meta-denki-fuku` (3C), `meta-aiko-motors` (3D), `meta-social` (4B-a), `meta-chat` (4B-b), `meta-jobs` (4D), `meta-friends` (4E-a), `meta-hearts` (4E-b), `meta-story` (5C); `beats/` index (1A) with `beats-core` (2F), `beats-friends` (4E-a), `beats-hearts` (4E-b), `beats-story` (5C); `shops` (3E), `friends`, `gifts` (4A), `jobs` (4D), `culture` (4F), `jp-language` (1B) |
| `apps/mobile/src/strings/` (merged in `i18n.ts`, registered by 1A, **keys pasted by 1A**) | `core` (existing), `audio` (existing; 5D adds keys), `wallet` (2G, then 3F), `quests` (2F), `social` (4A), `jobs` (4D), `culture` (4F), **new modules** `hud` (2B), `debrief` (2C), `prepare` (2E), `phone` (4C), `home` (5A-1), `story` (5C); key prefixes: §7.6 |
| `apps/mobile/src/styles/` | `game.css` index (1A); `hud` (2B), `debrief` (2C), `prepare` (2E), `quests` (2F), `panels` (2G), `wallet` (3F), `friends` (4A), `phone` (4C), `shift` (4D), `culture` (4F), `home` (5A-1) |
| `apps/mobile/src/game/` | `worldSync.ts` (2B: shutters, NPC badges, locked state; then 3F: outfit, ride, speed), `srsHooks.ts` (2E), `avatarFx.ts` (3F), `ageProfile.ts` (5D), the rest of the folder (2A) |
| shared existing files | `components/Icon.tsx` (1A pre-adds all ~20 new icons so nobody edits it again), `components/MiniMap.tsx` and `content.ts` (2B), `engine/src/index.ts` (1A pre-exports every new engine module as a stub), `slots/base.ts` (2G) |

### 15.3 Slice 1 — Contracts, engine hooks, game core, world seam (9 agents; no gameplay UI)

| Agent | Task | Files owned |
|---|---|---|
| **1A** | Contract + scaffolding (1A-1 types/api/balance and wiring, then 1A-2 stubs): `@lw/game` package, workspace wiring, all registries and stub files (§15.2), **every §7.6 string key with EN+AR**, ~20 icons in `Icon.tsx`, engine stub exports, generic content invariants and the **rewritten character/graph tests** (§14.8) | `packages/game/{package.json,src/{index,types,api,balance}.ts}`, root `tsconfig.json`, `vitest.config.ts`, `apps/mobile/{package.json,vite.config.ts}`, all registry `index.ts` files in §15.2, `characters-extra.ts` pasted from §8.2 (with `nakamura.scenarioId = 'motors_visit'`), `content/src/index.ts`, `tokyo/game/index.ts`, `content/test/content.test.ts`, `apps/mobile/src/i18n.ts` + all `strings/*` stubs with their keys, `components/Icon.tsx`, `engine/src/index.ts`, `styles/game.css`, `main.tsx` (1 line) |
| **1B** | Money, ledger, pricing, Japanese numbers (`yenToJa`, `parseJaNumber`) | `game/src/{money,ledger,pricing}.ts`, `content/src/{lexicon/numbers.ts,tokyo/game/{jp-language,economy}.ts,markup.ts}`, tests `game/test/{money,ledger,pricing}.test.ts`, `content/test/numbers.test.ts` |
| **1C** | Engine hooks (`SessionGameHooks`, `startNode`, `flags`, `onShort`, `intent`, `alsoSlots`, `IntentHit.number`), `Turn` hint/substantive info, **turn classification with the shown set and copy rule (§3.2)**, input classification for numbers, `ConversationFacts`, `settleLoop`/stars/payout; `Accessory 'helmet'` | `engine/src/{dialogue,scoring,matching,input,normalize}.ts`, `content/src/types.ts`, `game/src/payout.ts`, tests `engine/test/{hooks,scoring,input}.test.ts`, `game/test/payout.test.ts` |
| **1D** | Objectives (incl. `easier`, `said`, `culture_said`, prerequisite derivation), chapters, dreams, daily goals (two-day window), `nextBestGoal` | `game/src/{objectives,daily,dreams}.ts` + tests |
| **1E** | Friends/AP/gifts (caps, hand-over rule), inventory/outfit/home slots, shifts (generation weighted to due words, accuracy, pay, ranks), integrity (`observeClock`, dedupe) | `game/src/{friends,inventory,shifts,integrity}.ts` + tests |
| **1F** | Reducer, persistence/migration (`skipHydration`, `seeded`, `_extra`), validation (`validatePack(pack, {level, index?})`), selectors, **economy simulator as `game/test/sim.test.ts` (ports `docs/economy-ref-sim.mjs`)**, the `tools/e2e/game.mjs` runner, root `package.json` scripts | `game/src/{reducer,persist,validate,selectors}.ts`, `tools/e2e/game.mjs`, root `package.json` scripts, tests `game/test/{reducer,persist,validate,sim}.test.ts` |
| **1G** | Speech normalisation, similarity, n-best STT, register-aware feedback | `engine/src/{speechNormalize,speechScore,speech,feedback}.ts`, tests `engine/test/{speechNormalize,speechScore,feedback-register}.test.ts` |
| **1H-a** | World data and small seams: all layout data from §6.4 (spawns, shops, doors, spots, `BOUNDS.x1 = 90`, vending move, lamps/poles, walker route, traffic wrap, skyline trim), `District`/`Stage` types, `Badge 'locked'` and `bubbleTexture('locked')`, the avatar `helmet` mesh, `spot` event data | `world/src/{layout,district,stage,textures,avatar}.ts`, test `world/test/layout.test.ts` |
| **1H-b** | World seam: `BuildCtx`, the `buildings/` registry and `FRONT_OVERRIDES` extracted from `city.ts`, `setShopOpen` (hides the NPC and the minimap dot), `setMoveMultiplier` with sub-steps, `setRide`, `setFestival` + dusk preset, `spot` events from `SPOTS`, NPC spawns that exist only if the building and the character are registered | `world/src/{world,city,buildctx,festival,index}.ts`, `world/src/buildings/index.ts` and **empty stubs** `buildings/{fukufuku,denki,motors,aiko,doors,props,rides}.ts` |

**Acceptance (slice 1):** `@lw/game` builds with zero React/DOM imports; contract types compile for every later agent; **existing tests stay green (the two rewritten content tests included) and the 5 existing scenarios behave identically without `game` hooks**; with hooks, a konbini scenario updates `{price}`/`{total}`, `charge` routes to `short` when cash is too low, and `settleLoop` reproduces the §3.5 table exactly (golden tests); property tests: wallet never negative, ledger idempotent (apply twice = once) and reconciling with `totals`/`checksum`, payout non-increasing in repeats and monotone in credit, hearts caps hold under 50 spam actions, `observeClock` cases of §14.5; the §3.2 golden tests (copy rule, hint cap, recalled line, thin turn); `economy:sim` meets the §4.6 windows; `yenToJa` round-trips ≥ 80 prices; the world boots with the 4 new NPC spawns skipped when their characters are absent and `layout.test.ts` proves no spawn lies inside a collider and the east extension has ground and bounds.

### 15.4 Slice 2 — Wallet, goals and the first full loop around the existing six NPCs (7 agents)

Order: {2A, 2D} first, then 2G, then {2B, 2C, 2E, 2F} (§15.1 rule 11).

| Agent | Task | Files owned |
|---|---|---|
| **2A** | App shell: `useGame` persist store, `bridge.init`/`dispatch`, `useUi.convo` request and the conversation host, selectors/hooks, `GameView`, routes + stub screens, **stub components** `EchoButton`, `PocketCard`, `ReceiptSheet`, `store.ts` hooks (`recordLoop` → `conversation_done`, `reset()` resets both stores, flush on `pagehide`), dev tools, welcome-back beat trigger, e2e `game-loop`, `clock` (+400-day jump then back), `migration` | `apps/mobile/src/game/{gameStore,bridge,selectors,pack,hooks}.ts`, `store.ts`, `ui.ts`, `App.tsx`, stub screens `screens/{Quests,Friends,Phone,Shift,Prepare,Wallet,Letter,Culture}.tsx`, `components/game/{EchoButton,PocketCard,ReceiptSheet}.tsx` (stubs), `screens/Settings.tsx` (dev toggle), `tools/e2e/game/{game-loop,clock,migration}.mjs` |
| **2B** | World HUD (progressive, §2.5): wallet pill, tracker card (locked target), dream chip, menu entries, **Interaction sheet**, Goods sheet (+ *Look through the window*), door/spot/vending/ticket pick routing, `content.ts` multi-valued, `MiniMap` pins, the full `interactions` table | `components/game/{WalletPill,TrackerCard,DreamChip,InteractionSheet,GoodsSheet,GameMenu}.tsx`, `components/MiniMap.tsx`, `content.ts`, `screens/WorldScreen.tsx`, `game/worldSync.ts`, `strings/hud.ts`, `styles/hud.css`, `tokyo/game/interactions.ts` |
| **2C** | Conversation takes the `useUi.convo` request + game hooks + Real mode; compact and full Debrief blocks (§2.5, §11.3); receipt sheet; e2e `assist-vs-solo` (§3.2 copy rule end to end), `broke` | `screens/{Conversation,Feedback}.tsx`, `components/game/{DebriefGame,PriceChip,StarsRow}.tsx` (and the bodies of the `ReceiptSheet` stub), `strings/debrief.ts`, `styles/debrief.css`, `tools/e2e/game/{assist-vs-solo,broke}.mjs` |
| **2D** | Price refit of `cafe`/`konbini`/`ramen`/`station` (+ `goods`, `twist`, `requiredIntents`, `itadakimasu`/`gochisosama` intents), menu prices, `short`/`leave` nodes, `payMethod`/`qty` slots, session tests with hooks | `content/src/tokyo/scenarios.ts`, `tokyo/game/{menu,meta/meta-core}.ts`, `lexicon/shop.ts`, `slots/shop.ts`, `phrasebook/shop.ts`, `engine/test/session.test.ts` |
| **2E** | Prepare screen with the **study → hidden-line recall** flow and `ready` expiry, pocket data for the five scenarios + `station_ic`, SRS hooks (cards from Prepare and culture phrases, implicit review, caps, amnesty), hidden-line echo, the checked review mode that `g_review8` counts | `screens/{Prepare,Vocab}.tsx`, `components/game/{SayIt}.tsx` (and the bodies of the `PocketCard`, `EchoButton` stubs), `game/srsHooks.ts`, `tokyo/game/pockets/pockets-core.ts`, `strings/prepare.ts`, `styles/prepare.css` |
| **2F** | Quests screen (waiting message, *Make it easier*, From yesterday), Dream picker + milestone stickers, daily goals UI, chapters/dreams/daily/wordTags data (all 8 chapters, full tables), beats ch1-2, **`StoryBeat.tsx`** (moved here from slice 5: slice 2's e2e needs the opening beat) with the katakana-name step (`me.nameKana`), lexicon `quests` (`何ですか`…) | `screens/{Quests,StoryBeat}.tsx`, `components/game/{DreamPicker,ObjectiveRow,DailyList,ChapterCard}.tsx`, `tokyo/game/{chapters,dreams,daily,wordTags}.ts`, `beats/beats-core.ts`, `lexicon/quests.ts`, `strings/quests.ts`, `styles/quests.css` |
| **2G** | Station/IC/vending/ticket panels, fares, `station_ic` (+ refund), `sato_directions`, **seeds `tokyo/game/items.ts` with `ic_card`**, `slots/base.ts` (`hikarigaoka`), wallet strings (incl. `shop.*`, `receipt.*`) | `screens/{VendingPanel,TicketPanel}.tsx`, `components/game/{FareMap,CoinTray}.tsx`, `tokyo/game/{fares,items,meta/meta-station}.ts`, `scenarios-shops.ts`, `lexicon/station.ts`, `slots/{station,base}.ts`, `phrasebook/station.ts`, `strings/wallet.ts`, `styles/panels.css` |

**Acceptance (slice 2) — the first loop works end-to-end, in English and Arabic RTL:** `tools/e2e/game/game-loop.mjs` drives a fresh profile: Hanako beat (real `StoryBeat`) → ¥3,000 → katakana name → Greetings lesson (objective ticks) → konbini Prepare (recall check) → buy onigiri → wallet decreases by exactly ¥160 and loop pay is credited → compact debrief with stars, one pay line, hidden-line echo → reload → state persisted → IC card + top-up at the station (`ic_card` from 2G) → vending panel → ramen ticket (the machine prop arrives in slice 3, so the script uses `world.simulatePick('ramen_machine')`) → short-of-cash branch → Chapter 1 completes (+¥2,500) → closing beat opens the Dream picker → Chapter 2 becomes current and Fuku-Fuku's shutter opens → daily goals tick. Screenshots at 360 px width in EN and AR (no horizontal scroll, `dir="rtl"`). `economy:sim` and persona tests green; no console errors.

### 15.5 Slice 3 — New places, shops and things you own (6 agents)

| Agent | Task | Files owned |
|---|---|---|
| **3A** | World: Fuku-Fuku and Hikari Denki buildings (sign, counter, racks, phone/TV wall, 準備中 shutter) | `world/src/buildings/{fukufuku,denki}.ts`, `world/test/buildings-a.test.ts` |
| **3B** | World: Nakamura Motors (garage, two 3.4 m kei cars, bikes), Aiko's stall (florist override), door facades, ramen machine and station front props, ride meshes (`bike`, `ebike`, `car`) in `buildings/rides.ts` | `world/src/buildings/{motors,aiko,doors,props,rides}.ts`, `world/test/buildings-b.test.ts` |
| **3C** | Scenarios `denki_phone`, `fuku_clothes`, `fuku_home` (+ slots `denkiItem`, `clothes`, `furniture`…, `goods` nodes, `twist`, lexicon, phrasebook, pockets, meta) | `scenarios-denki.ts`, `scenarios-fuku.ts`, modules `shop-denki`, `shop-fuku` in `lexicon/`, `slots/`, `phrasebook/`, `pockets-denki-fuku.ts`, `meta-denki-fuku.ts` |
| **3D** | Scenarios `aiko_tea`, `aiko_viewing` (minor variant), `aiko_contract`, `motors_visit`, `motors_bike`, `motors_car` (negotiation hooks, `say_total`) | `scenarios-aiko.ts`, `scenarios-motors.ts`, modules `shop-aiko`, `shop-motors` in `lexicon/`, `slots/`, `phrasebook/`, `pockets-aiko-motors.ts`, `meta-aiko-motors.ts` |
| **3E** | Catalog and shops data (extends `items.ts`), strict `validatePack(JP_PACK, {level:3})` test **including every sale route of §5.6**, price/total tests, goods sheet data | `tokyo/game/{items,shops}.ts`, tests `game/test/catalog.test.ts`, `content/test/game-pack.test.ts` |
| **3F** | Wallet/Inventory/Wardrobe/Home-slots screen, avatar patches, ride and speed wiring, e2e `shops` | `screens/Wallet.tsx`, `components/game/{Wardrobe,Inventory,HomeSlots,Receipts}.tsx`, `game/{avatarFx,worldSync}.ts`, `strings/wallet.ts`, `styles/wallet.css`, `tools/e2e/game/shops.mjs` |

**Acceptance (slice 3):** every new shop scenario is **completable by tapping suggestions only**, with enough cash and (separately) too little cash (`short` → `leave`, no purchase, no crash) — extends the "pick every suggestion" session test; **every item and menu id is reachable through a sale route** (§5.6); buying the T-shirt (Chapter 2) changes the avatar immediately; with the dev tool to Ch4, the phone purchase unlocks Messages (stub) and charges exactly ¥24,800; bike purchase sets speed ×1.5 and shows the bike; closed shops show 準備中 and the sheet explains when they open; **no NPC or counter inside a collider** (`layout.test`), world stays within **≤ 52 draw calls** and +16k triangles in the e2e probe (`renderer.info`), 60 fps target on the dev machine, minimap shows the three new buildings; `JP_PACK` passes `validatePack` (ids unique, gates ≤ 9, every objective's prerequisites open at its chapter's start, every price a multiple of 1).

### 15.6 Slice 4 — Friends, phone, jobs, culture (8 agents)

| Agent | Task | Files owned |
|---|---|---|
| **4A** | Friends screen (hearts, next unlock, Friend card, facts), gift hand-over UI, friend data, gift tastes, perks | `screens/Friends.tsx`, `components/game/{HeartBar,FriendCard,GiftSheet}.tsx`, `tokyo/game/{friends,gifts}.ts`, `strings/social.ts`, `styles/friends.css` |
| **4B-a** | Gifts and small talk: `give_gift`, the 12 shared + 18 friend-specific small-talk topics (§8.3a), `h4_<id>`, `remember` callbacks | `scenarios-social.ts`, module `social` in `lexicon/`, `slots/`, `phrasebook/`, `pockets-social.ts`, `meta-social.ts` |
| **4B-b** | Phone chat templates (P0 five, P1 five) | `scenarios-chat.ts`, module `social-chat` in `lexicon/`, `slots/`, `phrasebook/`, `meta-chat.ts` |
| **4C** | Phone: Messages (threads, unread, stamps, voice messages with the listening waiver, dictation), Map pins, phone frame; `Conversation` chat channel; e2e `friends-phone` | `screens/Phone.tsx`, `components/game/{PhoneFrame,Thread,StampPicker,MapList}.tsx`, `screens/Conversation.tsx` (ownership passes from 2C), `strings/phone.ts`, `styles/phone.css`, `tools/e2e/game/friends-phone.mjs` |
| **4D** | Jobs: Shift screen + widgets, job data, intro scenarios, ranks UI, e2e `shift` | `screens/Shift.tsx`, `components/game/shift/*`, `tokyo/game/jobs.ts`, `scenarios-jobs.ts`, module `jobs` in `lexicon/`, `slots/`, `phrasebook/`, `pockets-jobs.ts`, `meta-jobs.ts`, `strings/jobs.ts`, `styles/shift.css`, `tools/e2e/game/shift.mjs` |
| **4E-a** | Hang-outs (4), home-visit scenarios (3 + own guest), home beats | `scenarios-friends.ts`, module `social-friends` in `lexicon/`, `slots/`, `beats-friends.ts`, `meta-friends.ts` |
| **4E-b** | Heart scenes (3), heart beats (9) | `scenarios-hearts.ts`, module `social-hearts` in `lexicon/`, `slots/`, `beats-hearts.ts`, `meta-hearts.ts` |
| **4F** | Culture cards + stamp book (hidden-line Say it on `say:true` cards), 5 lessons, culture strings | `screens/Culture.tsx`, `components/game/CultureCard.tsx`, `tokyo/game/culture.ts`, `lexicon/culture.ts`, `lessons-extra.ts`, `strings/culture.ts`, `styles/culture.css` |

**Acceptance (slice 4):** gift flow end-to-end (buy at Aiko's → hand over naming the item → reaction → AP within caps); heart caps hold under a simulated spam of 50 conversations/gifts/chats in one day; no friend reaches ♥5 in fewer than 6 days; phone chat reachable with typing, romaji, English, Arabic and **every suggestion** (extends the session test), voice message reveals text as assisted unless listening is off; each shift completes by tapping only and its pay matches `shiftPay`; the third shift is refused politely; 23 culture cards present with EN+AR, `culture_said n:6` reachable before Ch7 completes; every lesson plays in the existing Lesson screen; AR RTL screenshots for Friends, Phone, Shift, Culture.

### 15.7 Slice 5 — Homes, story, polish (5 agents)

| Agent | Task | Files owned |
|---|---|---|
| **5A-1** | World interiors, part 1: the `Stage` engine (`enterStage/exitStage`, collider/bounds/camera swap), the dorm and own-flat stages, genkan interaction, home UI + **panel fallback**, furniture placement view, e2e `home` | `world/src/stages/{index,dorm,ono_flat}.ts`, `world/src/world.ts` (ownership passes from 1H-b), `components/game/{HomeStage,PanelFallback}.tsx`, `strings/home.ts`, `styles/home.css`, `tools/e2e/game/home.mjs` |
| **5A-2** | World interiors, part 2: the three friend stages (`mio_1r`, `aiko_tatami`, `kenji_flat`) | `world/src/stages/{mio_1r,aiko_tatami,kenji_flat}.ts` |
| **5B** | Festival dressing (stalls, lanterns, fireworks, dusk preset), Hikarigaoka trip panel and backdrop, free-walk mode flag | `world/src/festival.ts` (stub from 1H-b), `components/game/TripBackdrop.tsx`, `screens/TripPanel.tsx` |
| **5C** | Story: beats ch3-8, `matsuri_stalls`, `matsuri_speech` (rehearsal + Guided fallback), `trip_hikarigaoka`, Letter Home, diary prompts, titles | `scenarios-story.ts`, `beats-story.ts`, `meta-story.ts`, `screens/Letter.tsx`, `strings/story.ts` |
| **5D** | Audio and accessibility: consent card with the kids' adult gate, `listenPref` and *Can't listen right now*, Audio-check additions, `AudioMode` plumbing, age profiles, text scale, RTL audit, e2e `audio-fallbacks`, docs (`docs/SAMPLE.md`, README) | `screens/Settings.tsx` (from 2A), `components/AudioCheck.tsx`, `game/ageProfile.ts`, `tools/e2e/game/audio-fallbacks.mjs`, `docs/SAMPLE.md` |

**Acceptance (slice 5):** home visit completes in the 3D stage **and** in the panel fallback; genkan wrong-order gives the gentle line; furniture placed in the dorm/flat persists; chapters 3-8 are playable end to end with the dev tools (fast-forward) and **a fresh-profile smoke path**; `matsuri_speech` capstone requires Real mode (with the one-time Guided fallback); Letter Home renders, is saveable as an image, stores no audio; trip charges the round-trip fare up front; audio fallback e2e passes in the three modes (full voice with an injected fake `SpeechRecognition`, no recognition, English-only voices) and the kids profile shows no consent card; clock/migration e2e pass; docs updated; `economy:sim` windows still green; the full e2e (`npm run e2e`, including every `tools/e2e/game/*.mjs`) passes.

### 15.8 Cut order if time runs short (keep the loop whole)

1. `car` dream and `motors_car` (keep the browse). 2. Heart scenes (keep beats) and `hang_*` except Mio's. 3. Phone chat `chat_voice/late/teach/invite_home` and callbacks beyond **one per friend**. 4. Café and station jobs (keep konbini). 5. Stage interiors (keep panel fallback). 6. Letter Home → a 3-sentence diary replay. 7. Points card, tax-free branch, eat-in surcharge, here/to-go, scenario twists. 8. Real-mode coach cards. 9. Gift-taste variety (keep three loved items per friend).
**Never cut:** wallet + ledger, Prepare with the recall check, settleLoop with the assisted/independent gradient and the shown-set copy rule, Dream picker + tracker, progressive disclosure, chapters 1-4 with `easier` alternatives, gifts + hearts, **small-talk topic variety, fact reveals and one callback per friend**, phone purchase + chat, konbini shift, 12 of the 23 culture cards, the anti-exploit table, EN+AR for every string.

### 15.9 Test inventory (what "done" means, by area)

| Area | Tests (new files unless noted) |
|---|---|
| `@lw/game` properties | wallet never negative; ledger idempotent and reconciling with `totals`/`checksum` (never with the 200-entry ring); transfers never touch `totals`; `payoutFactor` non-increasing and in [0,1]; replacing a class with a higher credit never lowers pay; all-`T` never beats all-`S` never beats all-`I`; stars monotone; AP/day caps and the gift caps; hearts monotone; `quote` total = base + deltas, pure; routine discounts ≤ 8% and the haggle floor; `observeClock` (+400-day jump and return, time-zone hop, DST); daily generation deterministic, never references locked content, two-day window; shift score in [0,1], perfect beats random (seeded), a trial wage never counts; `migrate` fixtures (empty, typical, heavy, corrupt); seed idempotent; IC cap and refund |
| Golden numbers | the §3.5 table, §9.2 shift pay table, §4.6 simulation windows and ratios, `yenToJa` ≥ 80 prices, catalog total ¥1,211,910 |
| Engine | hooks: `vars` refresh after every turn, `charge` → `short`, `intent` outcomes (`say_total` with digit input, `haggle`), `startNode`, `flags`-gated `SayVariant`, `alsoSlots`; scoring classes incl. the 0.80 copy rule, shown-set (chip, hint, translation, NPC line), recalled line, thin turn; substantive/duplicate handling; 6-unmatched ending; speech normalisation table (numbers, kana folding), n-best selection, confidence buckets; register feedback rules |
| Content (extends `content.test.ts`) | tokens in lexicon with EN+AR; every line EN+AR; scenario graphs (following `next`, `nextIfNo`, `onShort`, `startNode`); characters own several scenarios; every suggestion understood at every node; shop scenarios completable with enough cash and with too little; `complete` needs `pay`; pockets matched by an intent; `ScenarioMeta` ↔ scenario ids/steps/slots/`requiredIntents`; slots unique; **every `ItemDef` and menu id has a sale route**; gifts: no item both loved and disliked; every item has a shop that opens by its gate chapter; objectives reference real ids; dream steps satisfiable; culture triggers exist; `culture_said n:6` reachable before Ch7 |
| Pack | `validatePack(JP_PACK)`: ids unique, prices ≥ 1, gates ≤ 9, `ageMin` honoured, every beat/line/card has EN+AR, **every objective's prerequisites open at its chapter's start**, quest graph acyclic and finishable by the level-4 bot (flat path with ≤ ♥1 for Aiko) |
| World | no spawn/counter inside a collider; bounds include the east extension; doors/spots inside bounds; traffic wrap, skyline and pole fixes; shutter toggles hide the NPC and its minimap dot; stage enter/exit restores the player; draw-call and triangle budgets in the e2e probe |
| App | store persistence round trip; debrief rows equal the ledger; wallet pill and tracker render in `ltr` and `rtl`; Interaction sheet appears only with > 1 option; the HUD never shows more than 4 elements at 360 px |
| E2E (`tools/e2e/game/`, captain in brackets) | `game-loop`, `clock`, `migration` (2A), `assist-vs-solo`, `broke` (2C), `shops` (3F), `friends-phone` (4C), `shift` (4D), `home` (5A-1), `audio-fallbacks` (5D); all assert no horizontal scroll at 360 px, `dir="rtl"` in Arabic, no console errors |

### 15.10 Lexicon scoping (≈ 170 new entries; each needs a kana reading where it has kanji, EN and AR; owners write their own module)

- **numbers (1B):** 一 二 三 四 五 六 七 八 九 十 百 千 万 円, composites 三百 六百 八百 三千 八千, 何円, 合計, お釣り, 税込
- **shop (2D):** 値段, 安い, 高い, 温める, お箸, ポイント, レシート, 領収書, 店内, 持ち帰り, 定価, 品切れ, ひとつ, ふたつ, みっつ, ホット/アイス (exist)
- **station (2G):** チャージ, 払い戻し, 残高, 入金, 改札, 券売機, 乗り換え, 右, 左, まっすぐ, 曲がる, 近い, 遠い, 次の電車, 時刻表
- **shop-denki (3C):** 中古, 最新, 色, 黒, 白, 青, 赤, 画面, 電池, 充電, 保証, ケース, お名前, 入荷, 免税 · **shop-fuku (3C):** 服, 帽子, メガネ, サイズ, 試着, 似合う, 大きい, 小さい, ちょうどいい, 家具, 布団, 机, 本棚, こたつ, 配送, 明日, あさって
- **shop-aiko (3D):** 茶房 (さぼう), 花, 花束, 和菓子, 手ぬぐい, ラッピング, 灯籠, リボン, 誰に, 喜ぶ, 畳, 何畳, 日当たり, 家賃, 敷金, 前家賃, 鍵, 契約, 玄関, 隣 · **shop-motors (3D):** 自転車, ママチャリ, ヘルメット, 防犯登録, 住所, 通学, 散歩, 軽自動車, 本体価格, 乗り出し価格, 走行距離, 年式, 安くなりませんか, 考えます
- **social (4B):** 友だち, 電話番号, メモ, どうぞ, プレゼント, うれしい, 好き, 一緒, 会う, 何時, 遅れる, 元気, 楽しみ, 英語 · **social-friends (4E):** おじゃまします, あがる, 靴, 脱ぐ, スリッパ, いい部屋, おじゃましました, ちゃぶ台, 炊飯器, 写真, 野球, 絵
- **jobs (4D):** アルバイト, お給料, 時給, レジ, ご注文, テーブル, 別々, 何番線, ご案内, お待たせしました, かしこまりました
- **quests (2F):** 何ですか (なんですか; bare 何 is なに), 最初, 手紙, 家族, 夢, 日記, お祭り, 屋台, 花火, 浴衣, 自己紹介, 皆さん, 土曜日, たこ焼き · **culture (4F):** 免税, マナーモード, 車検, 車庫証明, ごみの日
- Word tags (`wordTags.ts`, 2F): `numbers`, `direction`, `transport`, `home`, `car`, `cafe` (8-14 surfaces each).

---

## 16. Out of scope, and what could not be verified

### 16.1 Explicitly out of scope for this build

- A second country pack or district (only the architecture, §14.6).
- Native Capacitor shell, on-device LLM/MT/STT/TTS (the sample's scripted dialogue, phrasebook and Web Speech adapters remain the stand-ins).
- Walk-in shop interiors, day/night, weather and seasons (the festival is a scripted dressing).
- **Visiting other learners as friends** (needs sync; `FriendDef` could gain `kind:'learner'` later). Everything stays local; no server, accounts, ads or real money.
- Cut from the three designs: omamori, weekly goals, study allowance, share-house/1K/estate agent/Mori/Takeda/Hanae/Hayashi, ramen job, console/camera/photo mode, phone re-order and QR pay, birthdays, treating friends, Yuki's home, `hang_*` for 5 friends, full scenes for 6 friends (beats only), car fast-travel, party hosting, quiz-for-yen, auto-coach EMA, "pattern of the week", Voice-skill meter, timers of any kind.
- Pronunciation scoring (the sample only compares recognised text; do not imply otherwise).
- Trips other than Hikarigaoka; a real Tokyo map.
- Screen-reader audit (labels and focus order are built carefully but not audited).

### 16.2 Could not be verified (no real devices, native speakers or players in this session)

- **Prices and fees** are approximate 2026 retail and a plausible Japanese rental/car structure; a native/price QA pass is required (phone, car body/fees split, 敷金 amounts, IC fares and the paper-ticket rounding, Haneda's fare, 車庫証明 requirements by area).
- **Japanese naturalness** (keigo, casual speech, shop phrasing) and **all Arabic text** need native review; Arabic names are transliterations. The v2 review already fixed 茶房 (さぼう), 喜んでくれるといいですね, 新入生？, 免税の対象外です and おいくらチャージしますか; expect more. **Arabic grammatical gender** (§8.5) is a known gap: `Gloss.arF` and `profile.arAddress` are specified, not authored.
- **Balance feel.** The simulation (`docs/economy-ref-sim.mjs`) is a model of five personas; real playtests will move `BALANCE.base`, the shift wages and the chapter workload (`CH.sessions` in the reference file is the weakest number). The 15-minute player reaches the flat on day 35 and the car on day 72; whether that feels right is a playtest question.
- **Devices:** iOS Safari speech (TTS voices appear late; STT needs Dictation), Android voice data, low-end GPU performance (only a draw-call/triangle budget exists), touch ergonomics of the Interaction sheet and Shift widgets.
- **Browser STT privacy:** on Chrome recognition sends audio to Google; the consent card is the mitigation, not a local solution.
- **Tax-free:** Japan is changing its duty-free scheme (a refund-at-departure model has been announced for late 2026). The game only teaches the question and the polite refusal, but the `cc_taxfree` text must be re-checked before release.
- **Kids and voice:** whether an arithmetic adult gate is enough for a child profile (and what the store review wants) is a product/legal decision, not a design one.
- **Store review / content rating** (kids profile with purchases of fictional goods, no real money).

### 16.3 Open risks (ranked)

| # | Risk | Mitigation / owner |
|---|---|---|
| R1 | **Content volume** (~49 scenario objects, ~160 lexicon entries, pockets, 23 cards, all with AR) is the real cost; one weak scenario breaks a chapter objective | generators (`smalltalk`, `h4`, `chat`, `home_visit`), "pick every suggestion" tests, cut order §15.8, content agents own disjoint files |
| R2 | **Chapter workload vs play time**: light players (10 min, 5 days a week) take 68 days to Chapter 8 against 29 for the casual player | tune `CH.sessions` and objective sizes after playtests; dream tracker shows the language gate honestly; the `easier` alternatives and the waiting message exist so slow is never stuck |
| R3 | **Engine hook integration** touches `dialogue.ts` while content agents add scenarios | 1C lands first behind optional `SessionOptions.game`; existing scenarios unchanged until 2D |
| R4 | **World work** (3 buildings, stages, rides) may exceed the draw-call/frame budget on phones | merged `Batch` geometry, budget asserted in e2e, panel fallback for interiors, low-quality mode already exists |
| R5 | **Assist model tuning**: tap-leaning players reach every item within 1.6× of the casual date and Chapter 8 about a week later (day 35 vs 29); a persona that never speaks is blocked at c1_5 | intended gradient; chapters are never gated by money except the one phone saving goal (with a catch-up); Prepare recall and `easier` alternatives are the scaffold; knob `BALANCE.credit` |
| R6 | **Number skill** (prices, totals) is hard for beginners | pick-from-3 fallbacks, `say_total` only in 2 scenarios, vending/ticket panels as gentle practice |
| R7 | **Age policy** for the flat/car (under-18 "someday") is a product decision | `ageMin` is data; confirm with the owner |
| R8 | `Line.ja` naming blocks a clean second-language pack | accepted debt (D34) |
| R9 | **Parallel-agent collisions** on shared screens (`WorldScreen`, `Conversation`, `Feedback`) | mount-point rule (§15.1), sequential ownership per slice |
| R10 | **Persisted-state growth** (ledger, seen ids, history) in localStorage | ring buffers (200/300), arrays capped, `_extra` preserved, recovery/export screen |
| R11 | **The phone is the one saving goal** (c4_1): without the daily chest the casual player would wait 11 extra days | catch-up stipend after 7 active days (§4.5); CI asserts every persona can afford it within 3 days of Chapter 4 opening |
| R12 | **Arabic gender forms** are not authored (`arF`, `arAddress`) | native review; masculine fallback; policy in §8.5 |
| R13 | **35 agent tasks** is more than the ~20-30 the brief assumed | the slices are sequential, at most 9 run in parallel; 1H-b, 5A-2, 4E-b and 4B-b are the first to merge into their siblings if capacity is short |

---

## 17. Review log (v2, after adversarial review)

Sixty-seven issues were raised (X = exploit lens, F = feasibility, M = motivation); each was checked against this document and, where it named code, against the repository (`content.test.ts` lines 95-141, `classifyInput`, `store.ts`/`App.tsx` hydration, `city.ts` traffic wrap and skyline, `Accessory`, `bubbleTexture`, `content.ts`). All were confirmed; **67 fixed, 0 rejected**. Duplicates across lenses are resolved once and cross-referenced. The numbers in §3.5, §4.2, §4.5, §4.6, §7.3, §7.4 and §9.2 were recomputed with `docs/economy-ref-sim.mjs` (the first-model figures were not reproducible: its gates released items when a chapter *completed*, and a conversation was costed at 4 minutes).

| # | Issue | Verdict | Resolution (one line) |
|---|---|---|---|
| X1 | Chapter rewards "unlock" what the chapter needs | Fixed | D36 + §4.5: opens/unlocks take effect when the chapter becomes *current*; §7.2 rewards list only yen, title, cards, beats; `validatePack` checks prerequisites (§7.1) |
| X2 | `dayKey = max(today, stored)` pins the clock in the future | Fixed | D3/D27/§14.5: integer `dayIndex`, one rollover per later date (+1 for any jump), earlier dates only re-anchor; +400-day e2e |
| X3 | Pace table contradicts the rules (Ch4 timing, day-1 wallet, ¥/day, 19% share) | Fixed | §4.6 re-simulated event-driven; Ch1 on day 1, Ch4 = phone + 2 days; §2.2, §2.3, §4.2, §4.6 quote one set of numbers; c3_4 guarantees a second ♥2 friend |
| X4 | "Repeater ≤ 20%" unattainable | Fixed | `dayFactor [1,.35,.1,0]` chosen from the target ratio; assertion ≤ 25% at 60 min/day (measured 21%), 36% at four plays |
| X5 | Shifts dominate yen per minute, trial wage counts | Fixed | D41: 0.75 paid hours, parity per minute, ≤ 15% of income, shift-only persona ≤ 20%, accuracy + all-5-customers counting, trial ¥100 never counts |
| X6 | Independence loopholes (hint-then-type, one-edit copy, one keyword) | Fixed | §3.2 shown set, `copyScore ≥ 0.80`, Hint caps at S, thin turn 0.60, golden tests |
| X7 | Discount cap contradicted; tax-free from the onboarding goal | Fixed (variant) | §4.4: one-time perks exempt, haggle `min(6%, ¥8,880)` per conversation, floor ¥181,120; tax-free became learning-only (no discount at all) |
| X8 | Car gate semantics undefined | Fixed | `FW` (Chapter 8 completed) gates the cars; sim and validator use the same predicate; grinder car day 25 |
| X9 | Chapter 4 phone is a money wall vs "money never gates" | Fixed (variant) | D38: pillar softened, phone affordable at Ch4 opening in the sim, catch-up stipend after 7 active days |
| X10 | `aiko_viewing` secretly needs ♥4 | Fixed | flag is cosmetic; no heart gate; level-4 bot checks the flat path needs ≤ ♥1 |
| X11 | IC top-ups strand cash; predicates ambiguous | Fixed | cap ¥3,000 until Ch5, refund at the station, money = cash only, top-ups are transfers |
| X12 | Gift hand-over is one word; callbacks counted twice | Fixed | hand-over must name the item, gift AP capped at 40% of the heart gap, ×0.5 without a talk, callbacks inside the 15 |
| X13 | `gapFactor` punishes daily habits | Fixed | removed |
| X14 | §3.5 example ¥180 vs ¥185; "30 days" vs d34 | Fixed | §3.5 recomputed (¥420 at base 1,500); fiction line says "about five weeks" |
| X15 | Return fare undefined | Fixed | round trip charged up front (§5.4, §6.5) |
| X16 | Prepare ready by pick-from-3, echo by copying, `g_review8` by self-rating | Fixed | hidden-line recall, 7-day expiry, Peek forfeits echo, checked reviews only |
| X17 | `complete` undefined for shop scenarios | Fixed | §6.2: all goal steps including `pay`; Chapter 1 has non-purchase earners |
| X18 | Katakana name demanded, chip inserts the raw name | Fixed | `me.nameKana` set in the opening beat, any script accepted |
| X19 | ETA floors income; `fresh_start` cost omits furnishing | Fixed | real average, ¥111,900 including goods (§7.3) |
| X20 | No sink after the catalog; reconcile test uses the ring | Fixed | lantern fund; reconcile against `totals` + `checksum` |
| F1 | Content tests fail once characters own several scenarios | Fixed | 1A rewrites both tests (§14.8); nakamura primary = `motors_visit` |
| F2 | Slice-2 e2e needs files from later slices | Fixed | `StoryBeat` moved to 2F, `items.ts` seeded by 2G, ramen machine via `simulatePick` |
| F3 | Same as X1 | Fixed | see X1 |
| F4 | `economy-sim.mjs` cannot import TypeScript | Fixed | `sim.test.ts` under vitest; `economy:sim` runs it; the `.mjs` is a reference model only |
| F5 | `t()` keys scattered across parallel modules | Fixed | 1A pastes every §7.6 key into its module; prefix ownership table |
| F6 | Existing files with no owner | Fixed | §14.8 and §15.2 name an owner for each |
| F7 | Engine matching/input/normalize unowned | Fixed | 1C owns them; digit input, `IntentHit.number`, `alsoSlots` specified |
| F8 | Hidden intra-slice dependencies | Fixed | §15.1 rule 11 waves; 1A stubs throw; 2A creates component stubs |
| F9 | Catalog and gift items cannot be bought | Fixed | §5.6 sale routes, `goods` nodes, `denkiItem`/`carModel`; `validatePack` level 3 checks routes |
| F10 | Same as X9 | Fixed | see X9 |
| F11 | Persist rehydrates before the legacy store | Fixed | `skipHydration`, `bridge.init()`, `seeded`, flush on `pagehide` |
| F12 | Conversation can only start from `WorldScreen` | Fixed | `useUi.convo` request; no-NPC case |
| F13 | Agents too large | Fixed | split 1A (two steps), 1H, 4B, 4E, 5A; 35 tasks in total |
| F14 | Same as X10 | Fixed | see X10 |
| F15 | `words_saved` already satisfied by starter words | Fixed | excludes `source: 'starter'` |
| F16 | 何 reads なに | Fixed | compound `何ですか` in the `quests` lexicon |
| F17 | Awkward Japanese lines | Fixed | さぼう, 喜んでくれる…, 新入生？, 免税の対象外です, おいくらチャージ…, `{nameKana}` chip |
| F18 | Three thresholds for Rin | Fixed | casual from ♥2 everywhere |
| F19 | Fare parity, Haneda, 車庫証明, tax-free scheme, visitor fiction | Fixed | paper +¥10, Haneda label, "in many areas", tax-free learning-only and flagged for re-check |
| F20 | §3.5 ¥180 vs ¥185 | Fixed | see X14 |
| F21 | §4.2 vs §4.6 numbers; §2.3 timing | Fixed | one simulation, one set of numbers |
| F22 | Disliked gift −3 contradicts no-loss | Fixed | 0 AP, gentle reaction |
| F23 | World conflicts (a)-(g) | Fixed | §6.4: wrap ±130, skyline ≥ 110, sub-steps, pole moved, 3.4 m kei mesh, dusk preset, snapshot filter |
| F24 | `interactions`/`chapters` name future ids | Fixed | full tables in slice 2; `validatePack` levels tolerate unresolved ids |
| F25 | E2E names and owners differ | Fixed | one folder `tools/e2e/game/`, one runner, captains per script |
| F26 | `validatePack` cannot see content | Fixed | pack-internal checks + injected `ContentIndex` |
| F27 | Unknown ids dropped; `completed` stored | Fixed | `idAliases`, `_extra`, `completed` is a derived cache |
| F28 | Foundation uncommitted; spawns without scenarios | Fixed | Step 0 commit; guard test |
| M1 | Hint/translation text can be retyped as class I | Fixed | see X6 (shown set) |
| M2 | Pillar 1/E13 contradict c4_1 | Fixed | see X9 |
| M3 | Tap-only sim ignores independence objectives | Fixed | `easier` alternatives, Prepare recall counts, tap-leaning persona, honest statement for a never-speaking learner |
| M4 | Recall of a prepared line scores as S | Fixed | recalled lines are class I (§3.2); recall check hides the line |
| M5 | Shift economy and archetypes | Fixed | see X5; tile credit 0.5; due-word weighting; show-text waived for the first two shifts |
| M6 | Gifts buy friendship | Fixed | see X12; vending items not giftable |
| M7 | Small talk unspecified, callbacks cut early | Fixed | §8.3a spec; facts and one callback per friend are never cut |
| M8 | First ten minutes overloaded | Fixed | §2.5 disclosure table, dream picker at the closing beat, Fuku-Fuku in Chapter 2 |
| M9 | Slow, repetitive days 4-10 | Fixed | window shopping from Ch2, dream stickers at step 2, three dreams finish in Ch4-5, twists on replay |
| M10 | Culture objectives are passive | Fixed | `culture_said`, `say:true` cards with Say-it and SRS cards |
| M11 | No UX for waiting on `minDays` | Fixed | waiting message, fall-through goals, places open at chapter start |
| M12 | Listening penalised when hardware or situation forbids it | Fixed | `listenPref`, waived factors and flags, *Can't listen right now* |
| M13 | Voice consent shown to a child | Fixed | kids default off, adult gate, parent-facing wording |
| M14 | Daily goals are login pressure | Fixed | two-day window, chest ≤ ¥600 (~16%) |
| M15 | Internal numbers disagree | Fixed | see X3 |
| M16 | c4_3 hidden prerequisite; tracker flips | Fixed | c3_4 guarantees two ♥2 friends, hint and pin, locked tracker target |
| M17 | Capstone is a cliff | Fixed | Chapter 6 rehearsal beat, speech Prepare, one-time Guided fallback |
| M18 | Kids asked about rent | Fixed | minor variant of `aiko_viewing`; `cc_rent` adult-only |
| M19 | Arabic uses masculine forms for female speakers | Fixed (policy) | neutral UI strings, `Gloss.arF`, `profile.arAddress`; authoring is on the native-review list |

### 17.1 Decisions left for the product owner

1. **Pace.** The casual (15 min/day) player reaches the flat on day 35 and the car on day 72, the light player the flat on day 74; `BALANCE.base` and `CH.sessions` are the knobs. The first model's day 27 / day 43 were not reproducible.
2. **Phone catch-up.** The only yen the story hands out beyond chapter rewards (≤ ¥12,000, after 7 active days). Remove it if you prefer a pure saving goal; the CI assertion that every persona can afford the phone within 3 days of Chapter 4 opening is what makes it optional.
3. **Under-18 policy** for the flat, cars and the rent card (D28), and **kids' voice input** (off by default with an adult gate).
4. **Agent count.** 35 tasks against the brief's 20-30; merge 1H-b, 4B-b, 4E-b, 5A-2 into their siblings if parallel capacity is short.
5. **Native review** of every Japanese line and all Arabic (including the gender variants), and **price QA**; the tax-free card text must be re-checked against Japan's changing scheme.
6. **Scope additions of this revision** (all data, no new systems): window shopping, dream stickers, scenario twists, the lantern fund, the IC refund. Cut order §15.8 lists which go first.
