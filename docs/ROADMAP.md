# Roadmap: social items, the city, conversations, more languages

The owner's direction (November 2026): buyable social attributes that improve the game, a shop that sells anime figures for money earned in the
game, a bigger city with better conversations, and the same game for German, Dutch and other languages. Decisions taken:

| Question | Decision |
|---|---|
| What are "social attributes"? | **Gestures and manners**: Japanese social moves the avatar learns (a deep bow, a wave, a gift presented with both hands, 乾杯), bought with Goen; using the right one with the right phrase in a conversation raises friendship more. Real etiquette, not a stat. |
| Figures: how are they paid for? | **Yen, by asking** in Japanese. Original characters only (no real anime brands). |
| Second language | **German in Berlin** first, then Dutch in Amsterdam. |
| Order | **Tokyo features first**, then the language engine and Berlin. |

## Done

* **ほしぞらホビー (Hoshizora Hobby)**, the figure shop: the street extended east (walkable edge x 90 → 106), a night-sky shop past Nakamura Motors
  with glass cases, a box wall, posters, a turning limited figure under a dome and a cat-ninja mascot outside. Daichi (星野大地), a cheerful
  collector, sells an original line: ねこ忍者 (Cat Ninja) red / blue / white ¥1,800, ロボット big ¥3,600 / small ¥1,200, the limited きつね侍
  (Fox Samurai) ¥4,800. Opens with Chapter 2.
  * The conversation (`hobby_figures`) teaches asking by look — 「赤いのをください」, 「小さいのをください」 — comparing (どちらが人気ですか),
    限定 / 残り一つ, and gift wrapping (プレゼント用, ラッピング; free, as in most Japanese shops).
  * The figures are presents: the gift hand-over names them; Mio loves the white Cat Ninja, Tanaka the big robot, and both like `anime`.
  * Tests: content (prices = scenario, sale route), world layout, e2e `figures.mjs` (EN/AR: chips and typed, exact charge).

## Next (Tokyo)

1. **Gestures and manners (所作, shosa)** — a new Goen catalog section ("Manners") and a small 3D emote set on the avatar:
   お辞儀 (deep bow), 会釈 (light bow), 手を振る (wave), 両手で渡す (present a gift with both hands), 乾杯 (toast), いただきます (hands together).
   Each one is learned with its phrase (a short practice like the wish ritual) and then offered in conversations where it fits (a gesture
   chip next to the suggestions). Using the right gesture with the right line: +1 heart once per day with that friend; a wrong one gets a
   gentle correction (the culture card). Never required to finish anything.
2. **Figure shelf at home** — a placeable shelf (Fuku-Fuku's furniture) that shows the figures owned in the room; friends who visit comment
   on the collection (new home-visit lines).
3. **City growth** — the south side of the new east block (a game centre / arcade with a crane game for yen, a karaoke box for a song
   conversation with friends), and a side street with a sentō (public bath) for the manners set.
4. **Better conversations** — a pass over every shop scenario: more ways to say each request (synonyms in intents), small talk the
   clerk starts when you come back ("また来てくれたんですね"), remembered choices (Daichi asks how the red ninja is doing), and the
   recorded voice for the new lines (VOICEVOX run; Daichi needs a young male voice).

## Other languages (German in Berlin first)

The game is built as country packs (docs/GAME_DESIGN.md §14): `@lw/game` takes a `GamePack` and never imports Japanese data. What is still
Japanese-specific and has to become a language plugin:

| Part | Japanese today | German needs |
|---|---|---|
| Script and reading aids | kana / romaji conversion, furigana, kana-folded matching | none of those; case and umlaut folding (ä/ae, ß/ss), compound-word splitting for matching |
| Politeness register | polite / keigo / casual | **Sie** vs **du** (the same mechanic: shop staff Sie, friends du after a heart level) |
| Numbers and money | 円, kanji numbers read aloud | euro and cents (`minorPerMajor: 100`), "drei Euro fünfzig" |
| Recorded voices | VOICEVOX (Japanese only) | an open-source German TTS with a free licence (e.g. Piper voices), generated the same way into `public/voice/` |
| Speech recognition | browser `ja-JP` | browser `de-DE` |
| City | Tokyo street, 3D | a Berlin Kiez: Späti, Bäckerei, U-Bahn, Döner stand, flat share (WG), a Flohmarkt |
| Culture cards | 23 Japan cards | Berlin cards: Pfand (bottle deposit), Sonntagsruhe, Mülltrennung, "Mahlzeit", cash culture |

Order of work: (1) a `LanguagePlugin` seam in `@lw/engine` and `@lw/core` (normalise, tokenise, number reading) with the Japanese one moved
behind it, (2) the German plugin and a small Berlin pack (one street, 5 shops, 3 friends, chapters 1–3), (3) a language picker in
onboarding, (4) voices, then (5) Dutch in Amsterdam the same way.
