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
  B2 still to do: the dorm and Ono-sō stages, furniture placement, `aiko_viewing`/`aiko_contract`, `fuku_home`,
  `home_own_guest`, heart-5 scenes.

## Wave C — Story and places
* Chapters 5–8: the Hikarigaoka trip, café and station jobs, the festival and speech, Letter Home; raise the
  release cap; the four deferred culture cards unlock.

## Always
No dead ends (unbuilt things stay hidden), EN + AR, 360 px, usage-limit aware (two agents at a time).
