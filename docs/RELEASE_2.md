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
* **C2 (built): Chapters 7 and 8 are playable; the release cap is 8 and the story ends.** `JP_PACK.release.lastChapter = 8`:
  Chapter 8's own closing `b_ch8_close` (Hanako holds the Letter and reads it: これがあなたの日本語です。すばらしい！) is the ending and
  starts Free Walk (`chapter.n` 9); `b_release_epilogue` stays in the pack for a lower cap only. Chapter 6 now closes with `b_ch6_close`,
  or `b_ch6_close_flat` once the Ono-sō room is rented (`ChapterDef.beats.closeIf`, the smallest generic support in `@lw/game`), both
  ending with Hanako's Letter preview line (also on the Chapter 6 card); Chapter 4's closing promises the festival again. Chapter 7
  "Festival": the festival-day rule (`festivalOpen`: from the next play day after Chapter 7 began, or a Saturday by the local date;
  in Chapter 8 and Free Walk every Saturday, for the stalls) turns the park into the festival at dusk (`world.setFestival`: six
  stalls with noren, the yagura stage and its 桜町まつり banner, merged lantern strings, fireworks; built once, off restores the day
  look exactly), with Hanako on the stage, Kenji at his ramen stall and every friend at ♥2 or more. `matsuri_stalls` (Kenji, cash
  only: yakisoba ¥500, takoyaki ¥600, kakigori ¥300, ringo-ame ¥400; a card gets "cash only" and no charge) from any stall;
  `matsuri_speech`, the capstone, from the stage: Prepare is a five-line rehearsal with the player's facts (listen, type or say, a
  tick per line), the speech runs in Real mode, and a player who never used Real mode may play it once in Guided mode (class-S
  lines count half, said on screen); `culture_said n:6`; `cc_matsuri` (no deferred culture card is left); ¥8,000 and `t_resident`;
  the closing beat plays at the stage under the fireworks. Chapter 8 "Letter Home": Hanako's "Write your Letter Home" row opens
  `screen:'letter'`: five frames pre-filled from remembered facts (name, country, a friend, a place, the dream or a purchase), each
  typed or spoken (own) or picked from three ideas or translated (assisted); it is finished with five sentences, three of them own
  (`letter_written`); only the written Japanese is stored (`letter_saved`), the microphone is used for recognition only and no audio
  is recorded; the card can be saved as a PNG (a local download, no network) and Hanako reads it back by TTS; `words_known 150`,
  ★★ in 12 conversations and `dream_epilogue` (choosing a dream, the same one included, or a finished dream); ¥10,000 and
  `t_lives_in_ja`. The closing beats of Chapters 2-7 ask for a one-line diary entry (two taps, assisted, or a typed line, own) that
  the Letter can add under its five sentences. The festival dream is offered (the yukata at Fuku-Fuku from Chapter 4; the casual
  goal's default); the e-bike and the flagship phone open in Chapter 7, the cars and the car dream at Free Walk. Saves: a save mid
  Chapter 6 continues into Chapter 7; a save already in Free Walk stays there (its `completed` re-derives as 1-8 and no closing beat
  replays: the pending-beat rule now needs the chapter's objectives done). E2E: `tools/e2e/game/chapters78.mjs` (EN and `--ar`;
  spies prove no MediaRecorder, getUserMedia or audio blob and no network request on the image save); `chapters56.mjs` ends with
  Chapter 6's closing and Chapter 7, `release1.mjs` fast-forwards through Chapter 8 to Free Walk. Render: the dressing is 4 meshes
  + the fireworks points, 6.1k triangles. Not built: heart-5 scenes, `TITLES`/`b_rankup`, the rank-3 station phrase 恐れ入りますが,
  the body-price car browse (`nakamura_car`, Free Walk).

## Release 2 complete

The whole designed story plays in Release 2: Chapters 1-8 (arrival, the konbini job, friends, the phone, the Hikarigaoka trip,
café and station jobs and home visits, the festival and the speech capstone, the Letter Home), then Free Walk. On top of
Release 1 it adds Fuku-Fuku clothes and Aiko's gifts (A), hang-outs and three friend homes on the stage engine (B1), the
player's own room, the flat contract and furniture (B2), Chapters 5-6 with the trip and two new jobs (C1) and Chapters 7-8 with the
festival, the Letter and the diary (C2). All 23 culture cards can be earned and all seven dreams can be finished (the level-4
bot of `validatePack` proves it). Each wave ends with a gate in the real UI (English and Arabic, 360 px) and an adversarial
review. Deferred to a later release: heart-5 scenes,
titles on screen (`TITLES`, `b_rankup`), the rank-3 station phrase, the body-price car browse, phone-chat invitations home and
selling furniture.

## Always
No dead ends (unbuilt things stay hidden), EN + AR, 360 px, usage-limit aware (two agents at a time).
