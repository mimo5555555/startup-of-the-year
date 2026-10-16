# Release 2 — Visit, Dress, Celebrate

Release 1 (`docs/RELEASE_1.md`) ships chapters 1–4 and Free Walk. Release 2 adds the rest of the design in
three waves; each wave ends with a real-UI gate (English + Arabic) and an adversarial review, and the
release cap (`JP_PACK.release.lastChapter`) moves up only when the content behind a chapter exists.

## Wave A — Dress and gift (shops, no new engine)
* **Fuku-Fuku** (clothes shop, north street west gap): building, `fuku_clothes` conversation, clothes catalog
  (T-shirt, hoodie, jacket, cap, glasses, shoes) with visible avatar patches and a Wardrobe in the Wallet.
  Opens in Chapter 2 as designed (the shutter state already follows the chapter).
* **Aiko's tea house stall** (the florist front on the south side restyled): `aiko_tea` conversation (gift shop:
  wagashi, flowers, tenugui…), gift items with friend tastes; the chapter 3 gift hint can name Aiko again.
* Out of wave A: furniture (`fuku_home`), the flat (`aiko_viewing`, `aiko_contract`), yukata.

## Wave B — Visit
* Stage engine (walk-in interiors with a panel fallback), the dorm, Mio's and Kenji's homes, door facades,
  hang-outs and home-visit conversations (shoes off, おじゃまします), heart scenes as time allows.
* The flat (Ono-sō) and furniture placement; `fuku_home` furniture.
* **B1 (built): hang-outs and three friend homes.** Hang-outs with Mio, Yuki, Kenji and Aiko from ♥3, home visits to
  Mio, Aiko and Kenji from ♥4 (one hang-out or visit per friend per 3 days, +25 AP, no yen, keepsakes once). Aiko
  is the seventh friend of the pack (Chapter 2) because her gates could not open otherwise; from Chapter 3 her NPC
  tap opens the interaction sheet. The stage engine (`TokyoWorld.enterStage`), the rooms `mio_1r`, `aiko_tatami`,
  `kenji_flat`, the door facades (open at ♥4), the genkan (shoes, then slippers) and the panel fallback
  (`?panel=1`, low graphics, a stage that cannot load) are in; the e2e is `tools/e2e/game/home.mjs` (+ `stages.mjs`).
  The reducer checks the hearts too (a hang-out below ♥3 or a visit to a friend's home below ♥4 pays and files nothing).
  Heart-5 scenes are still to do (wave C).
* **B2 (built): the player's own room.** The dorm (4 places) and the Ono-sō flat (a 6-jo tatami room, 8 places;
  move-in ¥60,000 = deposit ¥30,000 + first month ¥30,000, adults only) are stages with door facades `door:dorm` /
  `door:flat` (one draw call each) and the panel fallback. `aiko_viewing` (a minor gets Aiko's tea room, nobody
  mentions rent) and `aiko_contract` (the learner says 六万円, signs, pays cash exactly once, the tier turns `ono`, the
  dorm door closes and the flat's opens). `fuku_home`: seven second-hand pieces from Rin (futon, desk, bookshelf,
  houseplant; kotatsu, rice cooker, lamp need the flat); a bulky piece may be delivered (+¥2,200, booked by wall-calendar
  day, owned and placeable only when it arrives, shown in the Wallet). Furnish sheet, comfort (base + placed pieces,
  dorm max 7, flat max 16; a kotatsu raises hang-out AP x1.5) and the housewarming (`home_own_guest`, a friend from ♥2,
  comfort ≥ 4, once per 3 days, flag `housewarming`). `cc_rent` and `cc_trash` are released; the flat and fresh-start
  dreams are offered. Release cap unchanged (Free Walk opens the chapter 5-6 pieces). E2E: `tools/e2e/game/home-own.mjs`
  (EN and `--ar`). Not built: inviting a friend from the phone chat (only from her Talk list), a tappable rent chip in
  the viewing (typed only), a delivery question for the Denki TV, selling furniture.

## Wave C — Story and places
* Chapters 5–8: the Hikarigaoka trip, café and station jobs, the festival and speech, Letter Home; raise the
  release cap; the four deferred culture cards unlock.
* **C1 (built): Chapters 5 and 6 are playable; the release cap is 6.** `JP_PACK.release.lastChapter = 6`: Chapter 4
  now continues into Chapter 5 (Mio's `b_ch4_close`, Sato's `b_ch5_open`), and completing Chapter 6 plays the epilogue
  (`b_release_epilogue`, new wording) and starts Free Walk. Chapter 5 "Let's Go Out": the Hikarigaoka trip from Sato's
  "Take the train" row (round-trip fare charged up front, once, exactly: ledger `fare:trip:<place>:<day>:<runs>`, IC
  card when it holds both legs, else paper tickets; short of money charges nothing), the talk with Kato over a CSS
  station backdrop (`TripBackdrop`, no 3D town; an optional omiyage `g_souvenir`), asking Sato the way, Sato's station
  job (`jobintro_station`, desk widgets: departure board, plan, timetable, fare table; the answer is then SAID), browsing
  Nakamura Motors politely. Chapter 6 "Visiting Homes": 4 hearts and a friend's home, `aiko_viewing`, 5 good shifts
  over konbini, café (`jobintro_cafe`, hot/iced, table, change of mind, split bill) and station; Hanako's
  `b_real_try` holds the first Real-capable shop talk of Chapter 6 and plays it once without chips. Rewards and
  culture cards as designed (only `cc_matsuri` stays deferred; title ids are granted, but `TITLES` is still empty and
  no screen shows titles, as in Release 1); the `travel` dream is offered (its last step is
  the souvenir). Motors and the bicycle open in Chapter 5; the cars, e-bike and flagship phone stay at Free Walk.
  Saves: a save in Chapter 4 continues into Chapter 5; a save already in Free Walk stays there (its `completed` cache
  re-derives as 1-6, no reward or beat replays). E2E: `tools/e2e/game/chapters56.mjs` (EN and `--ar`), `shift.mjs`
  (all three jobs), `release1.mjs` (Chapters 1-4, Motors in Chapter 5, then a dev fast-forward to Free Walk for the
  car). Not built (wave C2): Chapters 7-8, festival, Letter Home and its Chapter 6 preview line, heart-5 scenes, the
  Chapter 6 closing beats `b_ch6_close(_flat)` (the epilogue closes it in this release), `TITLES`/`b_rankup`, the
  rank-3 station phrase 恐れ入りますが, the diary prompt.

## Always
No dead ends (unbuilt things stay hidden), EN + AR, 360 px, usage-limit aware (two agents at a time).
