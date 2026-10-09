# Release 1 — what ships, what waits

`docs/GAME_DESIGN.md` is the full design (35 build tasks). This file records the **cut** that makes a
complete, dead-end-free first release inside the available build budget. Where the two differ, this file wins.

## The promise of Release 1

Walk Sakura-chō, earn yen only by speaking Japanese, spend it by talking in shops (café, konbini, ramen,
station, **Hikari Denki for a phone, Nakamura Motors for a bike and a used kei car**), make friends who
remember you (small talk, gifts, **phone chat**), work a konbini shift, collect Japan culture cards, and
follow a four-chapter story that ends cleanly into **Free Walk**.

## IN

| Area | Included |
|---|---|
| Economy | wallet, IC card, points card branch, pay by independence (slices 1–2, done) |
| Shops | konbini, café, ramen, station/IC/vending/ticket (done); **Hikari Denki** (phone), **Nakamura Motors** (bicycle, helmet, e-bike, used kei car with drive-away fees and the one haggle node) |
| World | two new open-front buildings (Denki, Motors), ramen-machine and station-ticket props, bike/e-bike/kei-car ride meshes with speed boosts |
| Friends | the six existing characters (Mio, Yuki, Tanaka, Kenji, Sato, Hanako): hearts, small talk with fact reveals and one callback each, gifts bought at the konbini, the Mio ♥2 beat, **phone chat** (P0 templates) |
| Jobs | konbini shift only |
| Culture | all 23 cards, stamp book, say-it phrases |
| Story | **Chapters 1–4** (First Hello, Welcome!, First Friend, Stay Connected), then **Free Walk** |
| Learning loop | Prepare (study + recall), debrief, SRS hooks, Real mode, audio checks (done) |

## OUT (deferred; hidden, never a dead button)

Fuku-Fuku clothes and furniture, Aiko's tea house/stall and the flat, friends' home interiors and visits,
heart scenes and hang-outs, café and station jobs, Hikarigaoka trip, the festival, chapters 5–8 and the
Letter Home, the extra five lessons. Their interaction rows stay hidden until their scenarios register
(2B hides interactions whose target is not registered).

## The release cap (how the story ends without a dead end)

* `JP_PACK.release.lastChapter = 4` (data + the smallest generic support in `@lw/game`).
* Completing Chapter 4 plays a short "to be continued" epilogue beat from Hanako and starts **Free Walk**
  (`chapter.n = 9`): everything released stays open, daily goals continue, dreams continue.
* Nakamura Motors and the car items open at Free Walk in this release (in the full design they open in
  Chapters 5 and 8). The bike needs the helmet rule as designed.
* The Dream picker offers only dreams that are completable with released content; `validatePack` with the
  level-4 bot proves every released objective and every offered dream is completable.
* Chapter 2 needs the konbini shift (`c2_3`) and two spoken culture phrases (`c2_4`); Chapter 3 needs
  hearts, a gift and two friends at ♥2; Chapter 4 needs the phone, chats and 25 words.

## Known limits (not verifiable in the build environment)

Real-device speech and performance, native-speaker review of every Japanese and Arabic line, price QA,
balance feel from real players.
