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

* **Manners (所作, shosa)** — five Goen catalog items at the shrine, learned through the wish ritual: お辞儀 deep bow (40), 会釈 light
  nod-bow (20), 手を振る goodbye wave (20), 両手で渡す give with both hands (40), 合掌 hands together for いただきます / ごちそうさま / 乾杯 (30).
  In a conversation the owned ones sit in a row under the suggestions: tapping one makes the avatar do it and arms it for the next line.
  A line that goes with it (a bow with ありがとうございます / すみません / よろしくお願いします, a wave with またね / じゃあね…) is good manners: with
  a met friend +4 affinity (BALANCE.ap.manner), once per friend per day; a line that does not fit gets a gentle hint naming one that does.
  Never required. Rules in `@lw/game` (`mannerFits`, `applyManner`, `manner_used`); tests: content/manners, e2e `manners.mjs` (EN/AR).

* **Figure display case** — フィギュアケース (¥3,500 at ほしぞらホビー, asked for by name, carried home) for the shelf spot of the dorm or the
  flat. The 3D case draws every figure owned on three lit shelves (the room's `placed` map carries them under `collection`). At the
  housewarming, a guest who sees figures in it says so (「あ、フィギュアがある！どこで買ったの？」, plain or polite form) and the host can answer
  「ほしぞらホビーで買いました」; the guest suggests going together next time. Tests: app home-own, world stages-own, e2e figures.mjs.

* **ゲームセンター「ピコピコ」, the game centre** — the south side's game front is now a lit arcade with two crane machines on the
  sidewalk and Shota (佐々木翔太) at the door. His conversation (`arcade_crane`) teaches 両替お願いします (change: a 1,000-yen note into ten
  百円玉, 十枚), 一回いくらですか, 三回お願いします, and the arcade custom 「取りやすくしてもらえますか」 (the staff move the prize closer; culture
  card `cc_crane`). Goes are ¥100 (menu `arcade:play`), counted by the game (`GameState.arcade`), not kept in the bag. Tapping a machine
  opens the crane game: ◀ 左 / 右 ▶ and つかむ！; a prize under the claw may be caught (wider reach and firmer grip after asking Shota);
  prizes are the plush toy and the three Cat Ninja figures (presents, and they stand in the display case). Rules: `crane_play` uses one go
  once per try. Tests: app crane, e2e `arcade.mjs` (EN/AR).

* **カラオケ「うたひろば」, the karaoke box** — the south side's hotel front is now a karaoke box (neon sign and microphone, lit room
  windows with singers, a price board) with Nanami (小林七海) at the door. `karaoke_desk` teaches 何名様ですか / 二人です, 一時間 / 二時間,
  paying first (先にお願いします), 三番のお部屋 (¥1,000 an hour or ¥1,800 for two, for two people: menu `karaoke:h1` / `karaoke:h2`;
  culture card `cc_karaoke`). The room is booked for the day (`GameState.karaoke`); the invite sheet lists the friends met and starts
  `karaoke_room` with the one chosen (who stands at the karaoke door for it): choose the song, order a drink from the room phone, 乾杯
  (the hands-together manner fits it), sing the chorus of the town's song 「桜通り」 by saying the lines (the friend sings the middle one),
  answer 上手だね, また来ましょう. Plain or polite by the friend's register; a counted talk for the friend. Opens with Chapter 3, once a
  friend has a heart. Tests: app crane (booking), e2e `karaoke.mjs` (EN/AR).

* **ミニシアター (Mini-theatre)**, learning by watching and singing (menu → Study). All content is written for the game (no clips from
  real shows or songs).
  * **Episodes**: short scenes with the town's cast, each line spoken in the character's recorded voice while the subtitle lights up
    word by word with the audio (timed from the recording's length, `SpeakOptions.onDuration`, or estimated by morae for the device
    voice). Pause, replay, 0.75×, furigana / romaji / translation toggles, any word tapped for its card, three questions after. はじめての
    コンビニ (Chapter 1), ラーメンの秘密 (Chapter 2), 公園でお花見 (Chapter 3).
  * **Song**: 「桜通り」 (the karaoke room's song) as an instrumental made in the browser (Web Audio chords and a guide melody that can be
    switched off mid-song); each mora has its note, so the kana light up exactly with the music.
  * Results are filed (`media_done`, the best score per episode, `GameState.media`) and an episode or song counts for the day's
    listening goal. Tests: content theatre (lexicon, quiz, morae = reading), app theatre (timing), e2e `theatre.mjs` (EN/AR).

* **銭湯「桜の湯」 (Sakura-no-yu), the public bath** — the south row extended east past the game centre (x 67.4..80.4): a one-storey bath
  under a brick chimney with ゆ (steam from its top), a curved karahafu gable over the door, the 男 (indigo) and 女 (crimson) noren, wooden
  lattice, paper lanterns, the shoe lockers and a bench with bottles of coffee milk. Genzō (松田源三, 74, the old owner, voice ちび式じい)
  stands in the doorway. Opens with Chapter 2.
  * `sento_desk` teaches 大人一人お願いします, renting a towel (タオルを借りたいです / 持っています), the bath manners (かけ湯 first, the towel
    out of the water; かけ湯って何ですか is answered) and paying: ¥550 for the bath, ¥100 for the towel (menu sento:adult / sento:rent, one
    payment), **cash only** (カードは使えますか → うちは現金だけなんです; nothing is charged).
  * After paying, the bath sheet comes up on the street: a painted Mount Fuji over the bath, steam, and the four steps (SENTO_STEPS:
    かけ湯をする, 体を洗う, お湯につかる, 体をふいてから出る) to put in order; each one placed is spoken and explained. さっぱり！ then starts
    `sento_after`: 「いいお湯でした」 and the after-bath bottle (コーヒー牛乳 / フルーツ牛乳 / 牛乳, ¥150), drunk with a hand on the hip.
  * Culture cards `cc_sento` (the manners, cash only) and `cc_yuagari` (いいお湯でした, a say-it card). Tapping the board teaches 銭湯, the
    chimney 煙突, the curtains のれん. Tests: engine sento (every chip, typed route, cash only, one charge), content sento (the steps), world
    buildings-sento (colliders, gaps, picks, chimney), e2e `sento.mjs` (EN/AR).

* **Shopkeepers who know you** (better conversations, part 1). A shop conversation played before starts with the flag `regular`: the
  shopkeeper greets a regular in their own voice (Tanaka 「いつもありがとうございます」, Kenji 「おっ、また来てくれたね！」, Sato 「また
  お会いしましたね」…) and understands 「また来ました」. On every other return visit (the 2nd, 4th…), when you bought something there, the
  flag `remembers` and the var {last} (that item, found in the ledger, as its slot option) make them ask about it: 「前回のおにぎり、どうでした
  か？」, Daichi 「前回の赤いねこ忍者、元気にしていますか？」, Aiko 「…喜んでもらえましたか？」, Nakamura 「…調子はどうですか？」. Two answer
  chips (good / so-so) show only then; an answer in your own words works too; the reply comes before you order and the chips go.
  * Engine: `Suggestion.when` and `IntentDef.when` (shown / matched only while a flag is on), `IntentDef.unflag`. Content:
    `tokyo/regulars.ts` adds all of it to the opening node of 17 shop conversations (`withRegulars`); `game/regulars.ts` finds the
    last purchase and sets the flags. The voices are recorded once per item ({last}).
  * **More ways to say each request**: an engine table of natural alternatives at the key steps (konbini, café, ramen, station, figure
    shop, bath) found and fixed: 〜がほしいです / 〜にします / 〜をもらえますか as an order, それをください, 袋なしでお願いします (was a yes),
    要りません, 以上です / これで全部です, 辛いのは苦手です, ラッピングはいりません (was a yes), 自分用です, 見てもいいですか, タオルは大丈夫です
    (rented a towel). Tests: engine regulars + phrasing, app regulars, e2e `regulars.mjs` (EN/AR).

## Next (Tokyo)

1. **Better conversations, part 2** — small talk a shopkeeper starts about the season or the weather, and more phrasing cases for the
   other shops (Hikari Denki, Fuku-Fuku, Nakamura Motors, Aiko's stall, the karaoke desk, the game centre).
2. **More for the Mini-theatre** — more episodes (one per new place: the bath, the figure shop, the game centre) and a second song.

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
