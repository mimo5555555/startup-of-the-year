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

* **Small talk about the season** (better conversations, part 2). The return visits now take turns: the shopkeeper remembers your last
  purchase (2nd, 5th… visit), makes small talk (3rd, 6th…; also the 2nd when there is nothing to remember), or simply greets a regular
  (4th, 7th…). The small talk follows the season in Tokyo on the real date (`seasonAt`: spring, the June rainy season 梅雨, summer,
  autumn, winter): the shopkeeper's hello, a remark and 「〜は好きですか？」 (「涼しくなりましたね。秋は好きですか？」; Kenji and Genzō in plain
  form), a yes chip that names the season (「はい、秋が好きです！」) and a no chip (「夏の方が好きです」, 「寒いのは苦手です」), both understood
  in your own words; a warm reply (いいですね！ / わかります。風邪をひかないでくださいね) that leads back to the shop's own question. 14 shops
  (`tokyo/smalltalk.ts`, `withSmallTalk`). Engine: `IntentDef.boost`, so the answer to the question just asked wins a close call over the
  shop's own intents (Daichi's 「好き」) while a real order still wins.
  * **Phrasing, the other shops**: the table grew to 94 cases (karaoke, the game centre, Aiko's stall, Hikari Denki, Fuku-Fuku, Nakamura
    Motors); fixed 「一回いくらですか？」 (it bought a go instead of asking the price) and 「包まなくていいです」.
  * Tests: engine smalltalk (every shop × every season, EN/AR), app regulars (the visit rotation, the season on the real date in Tokyo),
    e2e `regulars.mjs` (four visits, EN/AR).

* **More for the Mini-theatre**: three episodes for the new places, each on its own backdrop, and a second song.
  * クレーンゲーム (Chapter 2, the game centre: Yuki and Shota; ほしいです, もう一回, 取りやすくしてもらえますか, やった！取れました！),
    はじめての銭湯 (Chapter 3, the bath: Rin and Genzō; はじめてです, かけ湯って何ですか, いいお湯でした) and 田中さんのロボット (Chapter 4, the
    figure shop: Tanaka and Daichi; 大きいのと小さいの, いくらですか, 大好きです). Seven lines and three questions each, recorded voices.
  * 「桜町の一年」 (A Year in Sakura Town, from Chapter 2): one line per season (春は桜が咲くよ / 夏は海で泳ごう / 秋はもみじが赤いよ / 冬は雪
    が降るよ) in G major at 104 bpm. A song now names its minor chords (`Song.minor`, pitch classes; default A for the first song's
    C major), so the accompaniment plays Em here.
  * Tests: content theatre (six episodes in opening order, both songs' morae), app theatre (the minor chords of each song), e2e
    `theatre.mjs` (Chapter 4: the full list, the bath episode, the seasons song; EN/AR).

* **More small talk, and your name** (better conversations, part 3).
  * Topics (`TALK_TOPICS`, flag `talk_<topic>`): besides the season, **the weekend** by the real weekday in Tokyo (Friday 「明日は土曜日です
    ね。週末は出かけますか？」, Saturday and Sunday 「今日はお休みですか？」, Monday 「週末は楽しかったですか？」), **the festival** from
    Chapter 7 (「もうすぐ公園でお祭りがありますよ。行きますか？」, or on the day 「今日は公園でお祭りですよ。もう行きましたか？」) and **the news
    of the town**: a place open to you that you have not tried yet (the bath, the karaoke box, the game centre, the figure shop:
    「銭湯の桜の湯、もう行きましたか？」 → 「まだです」 → 「いいお湯ですよ。ぜひ行ってみてください。」), never told at that place. Each topic
    has its own yes / no chips, keys for answers in your own words and replies. `talkTopics` orders them (news, festival, weekend, season)
    and the small-talk visits go through them one after another.
  * **Your name**: on the visit with nothing else to say (the 4th, 7th…) a shopkeeper who does not know your name asks once (「いつも
    ありがとうございます。あのう、お名前は？」; chips 「{name}です。」 / 「{name}と申します。」; any line that gives a name is the answer:
    `IntentDef.captureRequired`), says it back (「{name}さんですね。これからもよろしくお願いします！」) and the game keeps who knows it
    (`GameState.named`, event `name_told`). From then on that visit greets you by name (「{name}さん！いつもありがとうございます。」).
  * **Voice**: a name cannot be recorded, so a line with it used to fall back whole to the device voice. The player now plays such a line
    sentence by sentence (`splitSentences`): the character's own recording for every sentence but the one with the name, which the device
    voice says (left out on a device with no Japanese voice). Only lines where every unrecorded sentence holds the player's name are
    split: a price line stays whole. The generator records the name-free sentences of every line whose only variable is {name}.
  * Tests: engine smalltalk (every shop × every topic, both answers, own words; the name asked, told, said back, never mistaken for an
    order), app regulars (which topic when; the name flags; `name_told`), app voice (sentence playback), e2e `regulars.mjs` (seven
    visits, EN/AR).

* **Mini-theatre, later chapters**: nine episodes and three songs in all.
  * 光が丘まで (Chapter 5, the station: Mio and Sato; 〜まで行きたいです, 二番線, チャージしたいです, 三分後に来ます), ケンジさんのスマホ
    (Chapter 6, Hikari Denki: Kenji in plain form and Aoi in polite form; 安いのはある？, 二万四千八百円, カードでも払えますよ, 現金で) and
    お祭りの夜 (Chapter 7, the festival: Mio and Rin; 浴衣、かわいいね, お腹がすいた, 食べよう / 食べたいです, 花火が始まるよ). Seven lines
    and three questions each, recorded voices, a backdrop each (the platform, the shop's wall of screens, the night with lanterns).
  * 「わたしの一週間」 (My Week, from Chapter 3): the seven days of the week (月曜日、火曜日、水曜日 / 木曜日、金曜日 / 土曜日は友達と /
    日曜日はお休み) in F major at 112 bpm, with D minor (`minor: [2]`).
  * Tests: content theatre (nine episodes in opening order, three songs), app theatre (the week song's chords), e2e `theatre.mjs`
    (Chapter 7: the full list, the bath and festival episodes, the week song; EN/AR).

* **居酒屋「なごみ」 (Nagomi), the izakaya** (Chapter 6) — the south row's west end restyled: a warm doorway under a red noren, red
  lanterns, a lit lattice window, the 居酒屋なごみ board and a chalk menu board on the sidewalk. Misaki (中島美咲, 27, the server, voice
  小夜/SAYO) stands at the door. `izakaya_dinner` is an evening with a friend:
  * 二人です → the table and the drinks for two (ウーロン茶 / オレンジジュース を二つください; 生ビール only for an adult profile: a younger
    player is told 「お酒は二十歳からです。ソフトドリンクはいかがですか？」, the chip and the answer are flag-gated `adult` / `minor`) → the
    お通し arrives unasked (「お通しって何ですか？」 → a small dish, ¥300 a person) → a dish to share (焼き鳥 / 枝豆 / 唐揚げ) → 乾杯 → 「すみ
    ません！お会計お願いします」 → 「全部で千九百八十円です。お会計はご一緒でよろしいですか？」 → 「一緒で」 (you pay it all) or 「割り勘で」
    / 「別々に払えますか？」 (you pay your half: 「お一人様九百九十円です」) → cash or card.
  * Game: a **split bill** (`QuoteRequest.split` / `PurchaseEvent.split`, 2..4 ways): the last step of the quote takes the friends'
    shares off what is left after every discount, as a receipt line of its own (`split`); the player pays one share, the odd yen
    included. A **cover charge** (`ScenarioMeta.shop.cover`): the お通し rides on every order of the conversation, two of them. The
    conversation's `billSplit` slot ('half') asks for the split.
  * Culture cards `cc_otoshi` (the お通し is the table charge, not a mistake) and `cc_warikan` (割り勘, a say-it card; 別々に; おごる).
    Tapping the board teaches 居酒屋. The regular's greeting and the small talk include the izakaya.
  * Tests: game pricing (the split: shares, order after discounts, rounding, bounds, a split that pays when the whole would not),
    engine izakaya (every chip as adult and minor, typed routes, together vs split charged once, the beer gate, the prices), world
    buildings-izakaya, e2e `izakaya.mjs` (EN/AR: exactly ¥990).

- **German step 1: the language layer** (done)
  * Engine: a `TargetLanguage` (`@lw/engine` matching.ts) holds what the engine reads text with: the dictionary, the slots, the
    reactions, the global intents (slow, repeat, thanks, …), the matching forms and how a key is found in a sentence, numbers, a name
    or a country in a sentence, and whether a line is in the language at all. Japanese (`JA`) is the default and is what every
    session used before, unchanged; a session takes `language` (or `setTargetLanguage` for all of them). Scoring, speech tokens and
    feedback go through the session's language; the Japanese grammar notes run for Japanese only.
  * Text: markup with spaces and no Japanese in it (German) is split into words that keep their spaces (`Token.sp`); `plainText`,
    `speakableText` and `readingText` put them back; a dictionary word is found whatever its letter case (「Ich」, a typed
    「brötchen」); `segmentWords` reads typed German word by word. Japanese lines tokenize exactly as before.
  * German (`@lw/core` german.ts, `@lw/engine` german.ts): matching with and without umlauts (Brötchen = Broetchen = brotchen),
    keys from the start of a word (「ein」 in 「eine」, never in 「kein」), fillers dropped; German numbers both ways
    (einundzwanzig, zweihundertfünfzig) and prices (「2,50 €」 = 「zwei Euro fünfzig」); 「Ich heiße / Ich bin / Mein Name ist …」;
    「Ich komme aus …」; German vs English/Arabic typed input; global intents (langsam, wie bitte, danke, tschüss, …); feedback
    for **du with staff** (with the Sie form: 「Kannst du …?」 → 「Können Sie …?」) and a soft note for Sie with a friend.
  * Berlin seed content (`@lw/content` berlin/): a German dictionary, slots (bakery items, drinks, quantity, cash or card), Jana
    Krüger and her **Bäckerei Krüger** conversation: rolls (or Berlin's Schrippen), a Brezel, a croissant or Berlin's Pfannkuchen,
    a coffee for here or to go, 「Das macht 3,40 €. Bar oder mit Karte?」, and with `cashOnly` 「Tut mir leid, wir nehmen nur
    Bargeld.」 It runs through the real engine in tests; it is not in the app yet.
  * Tests: core german (forms, numbers 0..2500 both ways, prices, names, countries), content berlin (every word in the dictionary,
    spacing, case), engine berlin-bakery (every chip at every node with and without hooks and cash-only, EN/AR; typed routes with
    and without umlauts; the total; global intents; German vs English; Sie/du; Japanese unchanged beside it).

- **German step 2: the Berlin pack** (done)
  * The street, in German (`@lw/content` berlin/): Murat's **Späti** (Club-Mate, water, an Apfelschorle; 「Was ist Pfand?」 → the
    bottle deposit explained), Emre's **Döner** stand (a Döner, a Dürüm or a Falafel; 「Mit allem? Und scharf?」 → with everything,
    without onions, not spicy; here or to go), Sabine's **BVG counter** (a single ticket for Berlin AB, a day ticket or a short trip,
    explained when asked; 「Den Fahrschein vor der Fahrt entwerten!」), Greta's stall at the **Mauerpark flea market** (a lamp, a
    record, a jacket, a camera or a second-hand bike, said back with its article: 「Ah, das Fahrrad!」; the game's haggle, an offer
    in euros, cash only), beside Jana's bakery. A shared way to pay: card or cash, and a cash-only shop refuses the card kindly.
  * Three friends who say du from the first word: **Lena** (the WG kitchen: your name in any form, where you are from, listed or
    not, what you like doing, said back), **Kofi** (the courtyard: neighbours, a name, a bike or not), **Jonas** (a Sprach-Tandem in
    Neukölln: a name, how long you have been learning, the next meeting).
  * `BERLIN_PACK`: euro and cents (`minorPerMajor: 100`, 「2,50 €」), German VAT (19 %, 7 % for food and transport), the German
    `LanguagePlugin` (numbers in words, prices written and said, numbers said in cents, Sie/du markers), the menus of the five shops
    and a second-hand bike, three friends with tastes and a perk each, Chapters 1–3 (*Willkommen in Berlin*, *Mein Kiez*, *Sonntag
    im Mauerpark*) with their beats, then Free Walk; two dreams (a bike, friends), titles, eight Berlin culture cards (Schrippe, Pfand,
    Sie/du, Mit allem, entwerten, Bargeld, Sonntagsruhe, Tandem), daily goals. It validates at level 5 like `JP_PACK`
    (`ContentIndex.unknownWords` lets a spaced language check its own words). German lines are checked word by word: an unknown
    Latin word in German is a missing word (`Lexicon` `latin`), never raw text.
  * Tests: content berlin and berlin-pack (every word in the dictionary, slot keys unique, the pack at level 5, the menu, cents,
    the German plugin, the game's quote and haggle limit), engine berlin-street (every chip of the eight conversations at every node,
    with and without hooks and cash-only, EN/AR; a typed route in each shop with its charge; the friends' name, country and hobby;
    Sie with a friend).

- **German step 3: Berlin in the app** (done)
  * One switch (`apps/mobile/src/target.ts`): the language being learned is read once at start from `lw.target` (Japanese by
    default). The pack (`JP_PACK` / `BERLIN_PACK`), the dictionary, the scenarios, the characters, the slots, the signs, the free-text
    splitter and the engine's `TargetLanguage` follow it; the app reads them through it instead of `@lw/content`. Each language keeps
    its own saves (`lw.v1.` and the game save as before for Japanese; `lw.de.v1.` and `lw.game.de.v1` for German), so switching
    never touches the other's progress. Choosing saves the choice and restarts the app.
  * Onboarding asks **What do you want to learn?** (日本語 · Japanese in Tokyo / Deutsch · German in Berlin) under the UI language;
    German restarts into a German onboarding with the UI language kept. Settings can switch either way. The German notebook starts
    with five German greetings.
  * German on screen: words with their spaces and no furigana or romaji (`JaText`), names said once, the device's German voice
    (`WebSpeechTts({ locale })`; German has no recordings yet), `de-DE` recognition everywhere the app listens, the mic toggle
    `Deutsch`, prices as German writes them (「3,40 €」) in lines and chips, numbers said in euros taken in cents by the game, a euro
    coin, and the app's own words name German and Berlin (and amounts written as yen read in euros).
  * The Berlin street in 3D (`@lw/world` berlin.ts, a `District` with its own city): the open fronts of Bäckerei Krüger, the Späti,
    Döner am Kotti and the BVG counter under Altbau; the WG's door, the courtyard gate and Café Tandem across the street; Mauerpark
    with the flea market stalls and a graffiti wall; linden trees, old street lamps, the Litfaß column, the blue U, bike stands. Each
    of the eight characters stands at their place; a shop not open yet is shuttered as in Tokyo.
  * Tests: app target (both languages: registries, pack, engine, store prefix, words, euros, starters, the choice), world berlin
    (every site built, every character reachable, the player's start, nothing of Tokyo's), e2e `berlin.mjs` (EN/AR: German picked in
    onboarding, the restart, Lena typed, the bakery typed with 「Das macht 3,40 €」 and exactly €3.40, back to Japanese with its save
    untouched). Japanese e2e runs are unchanged.

- **German step 4: Berlin polish** (done, but for the recordings)
  * Berlin's HUD keeps Tokyo's own things out: no lessons or Mini-theatre in the menu, no Goen or dorm room in the wallet, no furigana
    or romaji switches, no VOICEVOX credits; the microphone's example is 「Hallo」, and the learn picker always names both languages.
  * Fourteen things to tap and read on the Berlin street (`BERLIN_SIGNS`): the four shop signs, the U-Bahn's U, the Litfaß column, a
    linden, a street lamp, Kofi's bike, Café Tandem, the Mauerpark sign, the Wall, the zebra crossing, the orange bin.
  * Regulars and small talk in German (`berlin/smalltalk.ts`), on the flags the app already sets for a shop's return visits: the
    regular's greeting per shop, and season and weekend small talk (with Sie) with yes and no chips, answers in your own words, a reply
    and back to the shop's question; an order still works while it is on.
  * German voices: `tools/voice/lines-de.ts` collects the 712 Berlin lines (prices read in words, letters spelled),
    `generate-piper.mjs de` (then `generate-de.mjs`) + `piper_batch.py` record them with Piper and two CC0 voices (Thorsten-Voice, Kerstin), a pitch and a pace per
    character and 1 dB of headroom, into `public/voice-de/` (4.2 MB; played like the Japanese recordings, credited in Settings). All
    712 recorded and checked by measure (no silence, no clipping, 5–15 characters a second); a line with a price or the player's name
    keeps the device voice for that sentence. The Berlin e2e asserts the recordings play.

- **The izakaya's age check (年齢確認)** (done): an adult profile (from eighteen) who orders beer is asked 「失礼ですが、二十歳以上ですか？」;
  「はい、二十歳以上です」 brings the beer, 「いいえ、未成年です」 or a change of mind a soft drink, charged at its price (drinking is from
  twenty in Japan). Younger profiles never see the beer, as before. New words 以上, 失礼, 未成年; the lines are recorded.

- **Dutch step 1: Amsterdam in Dutch** (done)
  * Dutch text (`@lw/core` dutch.ts): matching with and without accents (één = een, café = cafe), ĳ as y for a learner's typing,
    keys from the start of a word (「een」 never in 「geen」), Dutch numbers both ways (eenentwintig, tweeëntwintig; the article een is no
    number, één is), prices the Dutch way (「€ 2,50」 = 「twee euro vijftig」), 「Ik heet / Ik ben / Mijn naam is …」, 「Ik kom uit …」.
  * The engine's `NL` target language (`@lw/engine` dutch.ts): Dutch vs English/Arabic input, global intents (langzaam, nog een keer,
    dank u, doei, hoi, …), feedback for **je with staff** (with the u form: 「Kun je …?」 → 「Kunt u …?」) and a soft note for u with a
    friend; the German Sie/du rules and the Dutch ones share one pair of rule makers.
  * Amsterdam in Dutch (`@lw/content` amsterdam/), polite u with the staff: Café De Gracht (koffie verkeerd, appeltaart met
    slagroom), Kaashandel Bakker (taste first, young or old Gouda, a half pond or a pound), the stroopwafel stall at the Albert Cuyp
    market, the snack bar (「Zeg het maar!」, a patatje met, what a frikandel is), the GVB desk (an hour or a day; card only, and 「in- en
    uitchecken」); pinnen or contant, and card-only places (`pinOnly`) refuse cash kindly. Three friends who say je: Sanne on her
    houseboat, Daan and his bike, Noor at the language café.
  * Tests: core dutch, content amsterdam (every word in the dictionary, slot keys), engine amsterdam (every chip of the eight
    conversations, EN/AR, with and without hooks and card-only; a typed route in each shop with its charge; the friends; Dutch vs
    English; je/u notes).

- **Dutch step 2: Amsterdam in the app** (done)
  * The Amsterdam pack (`@lw/content` amsterdam/game): the euro the Dutch way (「€ 2,50」, `CurrencyDef.symbolSpace`), BTW included
    (21 %, 9 % on food and transport), the Dutch language plugin (numbers read and parsed, prices in words, u/je), the menu of the five
    places, three friends, chapters 1–3 with their beats, two dreams (a tin of stroopwafels to take home; three friends), titles, daily
    tasks and nine culture cards (gezellig, pinnen, in- en uitchecken, koffie verkeerd, proeven, stroopwafels, patatje met, the bike,
    je and u).
  * The app's third language, **Nederlands · Dutch in Amsterdam**, in onboarding and Settings. `apps/mobile/src/target.ts` holds one
    setup per language (engine, locale, store prefix `lw.nl.v1.`, voice folder, registries); the screens ask "is it Japanese?" instead of
    "is it German?". The app's words say Dutch and Amsterdam, amounts read 「€ 30,00」, the notebook starts with Hallo, Goedemorgen,
    Graag, Dank u wel, Doei; speech in and out is nl-NL.
  * An Amsterdam canal in 3D (`@lw/world` amsterdam.ts): Café De Gracht, Kaashandel Bakker, Snackbar Mo and the GVB under narrow canal
    houses (stepped, neck and cornice gables, hoist beams); the brick street with tram tracks, the red bike path, the quay with elms,
    lamps, bike racks and Daan's bike; the canal with houseboats (Sanne's), a little open boat passing under the bridge, the south quay
    with the language café (Noor); the Albert Cuyp market stalls (Jesse). The water is crossed only on the bridge. Sixteen things to tap
    and read (`AMSTERDAM_SIGNS`).
  * Closed shops outside Tokyo no longer show 準備中: Berlin's shutters say 「Geschlossen」, Amsterdam's 「Gesloten」, and the shop
    sheet says it in the language learned.
  * Dutch voices: all 509 Amsterdam lines recorded with Piper (`tools/voice/generate-piper.mjs nl`, the German recorder made
    language-neutral), three CC0 voices with a pitch and a pace per character: Pim and Ronnie (Netherlands Dutch) for the men and the
    narrator, whose lines are the learner's models; Nathalie for the four women. Checked by measure: none silent or clipped, 6.6–12.8
    characters a second on full sentences; the voices' sex measured with pYIN against Berlin's two known voices.
  * Tests: the canal (sites, spawns in reach, the water crossed on the bridge, every sign a Dutch word), the pack (prices, euro, the
    shops), the app's Dutch switch, and an e2e in the real UI, EN and AR (`tools/e2e/game/amsterdam.mjs`: Sanne, a café order charged
    exactly € 8,30, recordings playing, back to Japanese with its save untouched).

- **Dutch step 3: Amsterdam's regulars and small talk** (done): as Berlin's, on the flags the app already sets. From the second visit
  the shopkeepers greet a regular (「Hé, daar bent u weer!」, 「Ah, u weer!」); on some visits they talk about the season or the weekend
  (「Eindelijk lente! Houdt u van de lente?」, 「Hoe was uw weekend?」), answered with a chip or in your own words, then back to the
  shop's question. Everything stays with u. The mechanics are now shared by both cities (`@lw/content` shoptalk.ts, `withShopTalk`);
  40 new words; 167 more lines recorded (676 Dutch recordings, all checked). Tests: every shop and topic through the engine (chips and
  own words, an order still an order), the app's flags have Dutch lines on any day of the year, the voice lines, and the e2e (a
  small-talk visit and a regular's return at Femke's, EN and AR).

- **German step 5: Berlin Chapters 4–6** (done): the story runs to Chapter 6 (*Gute Freunde*, *Ausgehen*, *Angekommen*), whose
  closing is the new ending before Free Walk.
  * The friends after the first meeting (`@lw/content` berlin/social.ts, hangouts.ts): a chat of the day with Lena, Kofi and Jonas
    (`smalltalk_<friend>`, nine topics each, three their own; a fact revealed after the reaction; the greeting quoting a remembered
    hobby, favourite food or the dream; the food and the sport remembered from your words), a German hand-over of a present
    (`give_gift`), and a hang-out at three hearts (Sunday cake with Lena, a flat tyre with Kofi, *Mensch ärgere dich nicht* with Jonas).
    Gifts were broken outside Tokyo (the app started Tokyo's Japanese hand-over); the app now names gifts and callbacks from the slots
    of the language learned.
  * Three places, each with a front on the street: the Apotheke (Ch 4: say what hurts, the remedy, 「Gute Besserung!」), the Kneipe
    「Zum Eck」 (Ch 5: a drink, beer only for an adult, a Bulette, 「Prost!」, 「Zahlen, bitte!」, cash only) and the Bürgeramt (Ch 6: the
    Anmeldung, appointment, papers, address). Their people (Frau Weber, Uwe, Herr Krause) greet regulars and make small talk like the
    rest of the street. Six culture cards (Apotheke, Kaffee und Kuchen, board games, Prost, Trinkgeld, Anmeldung), three titles.
  * The app now sets `cashOnly` / `pinOnly` from the shop's payment methods: the conversations refused the wrong method kindly, but the
    flags were never set, so a card at a cash-only stall was turned down at the till as if the money were short.
  * 610 more German lines recorded (1,321 in all), the new people with voices of their own, the hand-over in each friend's voice.
  * Tests: every chat topic, the gift, the hang-outs and the three places through the engine (every chip EN/AR, typed routes, charges,
    beer only for adults, cash only), the app's friend planner in German, the street (spawns, fronts, signs), the pack at level 5, and
    an e2e in the real UI (`tools/e2e/game/berlin-chapters.mjs`: a chat with Lena, the Apotheke, the Kneipe refusing a card, the
    Anmeldung).

- **Dutch step 4: Amsterdam Chapters 4–6** (done): the story runs to Chapter 6 (*Goede vrienden*, *Uitgaan*, *Thuis in Amsterdam*),
  whose closing is the new ending before Free Walk, as in Berlin.
  * The chat of the day and the hand-over of a present are now one builder for every city (`@lw/content` friendtalk.ts:
    `buildSmalltalk`, `buildGiveGift`); Berlin's are rebuilt on it unchanged, Amsterdam's are content only (amsterdam/social.ts). Sanne,
    Daan and Noor chat in Dutch with je (nine topics each, three their own: drawing with Sanne, your favourite spot in the city with
    Daan, an Arabic word for Noor), reveal a fact after the reaction and greet you with your hobby or favourite food. The gift sheet
    finds things to give now that the Dutch `giftItem` / `giftFood` slots exist.
  * Hang-outs at three hearts (amsterdam/hangouts.ts): pancakes on Sanne's houseboat, a bike ride through the Vondelpark with Daan
    (hand signals), the birthday of Noor's mother (the circle of guests, congratulate everyone).
  * Three places, each with a front on the north side of the canal (amsterdam/places.ts): the drogist (Ch 4, Mirjam: say what's wrong,
    the remedy, 「Beterschap!」), the brown café ’t Hoekje (Ch 5, Joop: a drink, beer only for an adult, bitterballen, 「Proost!」,
    「Mag ik afrekenen?」, cards only) and the gemeente (Ch 6, Ilse: the inschrijving, appointment, passport and rental contract,
    address, floor, the BSN by post). They greet regulars and make small talk like the rest of the street. Six culture cards (the
    drogist, pancakes, cycling rules, the Dutch birthday circle, the brown café, registering), three titles.
  * 183 new words; 561 more Dutch lines recorded (1,236 in all, all checked), Mirjam, Joop and Ilse with voices of their own, the
    hand-over in each friend's voice.
  * Tests: every chat topic, the gift, the hang-outs and the three places through the engine (every chip EN/AR, typed routes, charges,
    beer only for adults, cards only), the street (spawns, fronts, signs, labels), the pack at level 5, the voice lines, and an e2e in
    the real UI (`tools/e2e/game/amsterdam-chapters.mjs`: a chat with Sanne, the drogist, ’t Hoekje refusing cash, the inschrijving;
    EN and AR).
- **Jobs in Berlin and Amsterdam** (done): the Shift screen works in every language being learned, and Murat's Späti and Femke's café
  hire the player from Chapter 2.
  * The shift's language is one table per language (`@lw/content` shifttalk.ts, `SHIFT_TALK`): how a total and the change are said
    (「Das macht 3,80 €.」, 「Sie bekommen 1,20 € zurück.」; 「Dat is dan € 7,50.」, 「U krijgt € 2,70 terug.」), how a typed or spoken
    amount (digits or words) and thanks (any letter case, umlauts typed or not) are checked, the tiles (a German or Dutch price is one
    tile, two near amounts the wrong ones), the wrong chips, the welcome, the example in the answer box (never anyone's answer), the
    boss's lines and the ranks (Neuling … rechte Hand; nieuweling … rechterhand). Japanese is the konbini's word for word. Money shows
    in the pack's currency (13,90 €/h, € 14,40/h); a job with tables gets the table picker whatever its place.
  * Murat's offer (berlin/jobs.ts): Sie, then 「Wir duzen uns hier, okay?」, then 「Hallo!」 and 「Danke schön! Schönen Abend noch!」.
    Thirteen customers (berlin/game/jobs.ts): one kind, two kinds, a customer who changes their mind, a 5/10/20-euro note and the
    change; every price includes the Pfand. A Cola joined the Späti (its conversation, the goods, the gift sheet).
  * Femke's offer (amsterdam/jobs.ts): u, then 「Zeg maar je, hoor!」. Fourteen guests (amsterdam/game/jobs.ts): one kind, two kinds,
    the table, separate bills (「We betalen apart」: two totals) and notes.
  * Chapter 2 opens each job and asks for a first shift; the daily goals include a shift. The minimum wage of each country (the pack's
    reference wage). A job's boss can be a shopkeeper now (the pack check asked for a friend).
  * The number readers: 「ein(en) Euro fünfzig」 and 「een euro vijftig」 are 1,50 (they read 50 euros), 「€ 10,40」 is 10,40 (it read
    1 and 0,40), and a point groups thousands (1.234,56).
  * 63 new words; 139 more lines recorded (68 German, 71 Dutch): the customers in a woman's and a man's voice, the staff's sentences.
  * Tests: every customer's cart, totals, change and bills heard back in digits, words and the staff's own sentence; the thanks; the
    tiles; the dictionary; the pack at level 5; the voice lines; and an e2e in the real UI (`tools/e2e/game/jobs-eu.mjs [--nl]`: the
    boss's offer, a shift answered in digits, words, a sentence and tiles, shifts at rank 4 until notes and split bills came up, the
    boss's refusal of a third shift; EN and AR in both cities).

- **Spanish step 1: Madrid in Spanish** (done): the fourth language, chosen over Russian (Latin script, so the German and Dutch
  pipeline carries over), in Lavapiés.
  * Spanish text (`@lw/core` spanish.ts): matching with and without accents and ñ (café = cafe, España = espana), ll as y and v as b
    for a learner's spelling, keys from the start of a word (「un」 never in 「algún」). Numbers are phrases in Spanish, read and written
    both ways (treinta y cinco, ciento uno, dos mil quinientos, veintiún euros; the articles un and una alone are no number, uno is).
    A price is one number however it is said: 「tres euros con cincuenta」, 「tres euros cincuenta」, 「tres con cincuenta」, 「tres
    cincuenta」, 「3,50 €」. 「Me llamo / Soy / Mi nombre es …」 (never 「soy estudiante」 or 「soy de …」), 「Soy de …」, 「Vengo de …」.
  * The engine's `ES` target language (`@lw/engine` spanish.ts): Spanish vs English/Arabic input, global intents (más despacio, otra
    vez, gracias, hasta luego, hola, perdona, …). Feedback the Madrid way: tú is normal in bars and with young staff, so tú gets only a
    soft note, and only where usted is expected (an older shopkeeper, the Metro office), with the usted form (「¿Tienes …?」 →
    「¿Tiene …?」); usted with a friend a soft one, its verb rewritten too (「¿Puede usted …?」 → 「¿Puedes …?」). Only forms that can
    only be tú count, since Spanish drops the pronoun.
  * Madrid in Spanish (`@lw/content` madrid/): Bar El Rincón (Lola says tú: 「¿Qué te pongo?」, a café con leche and a tostada con
    tomate; a plain café is a café con leche, a café solo is not), the panadería (Carmen says usted: a barra, what a napolitana is,
    magdalenas), the fruit stall at the mercado (a kilo of oranges in one breath, or the fruit first and 「¿Cuánto le pongo?」; priced
    by the half kilo), the churrería (churros or porras, what porras are, a chocolate to dip them in) and the Metro (a single ticket or
    ten journeys, 「valide en los tornos」); con tarjeta or en efectivo, and cash-only stalls (`cashOnly`) refuse the card kindly.
    Three friends who say tú: Lucía your flatmate, Javi from the third floor (「¿Eres del Madrid o del Atleti?」), Nadia at the
    language exchange, who practises Arabic. 「¡Mucho gusto!」 throughout, so nothing has to guess the player's gender.
  * The tokenizer splits ¿ ¡ « » off Latin-script words.
  * Tests: core spanish (every number 0–3000 and every price read back), content madrid (every word in the dictionary, ¿ ¡, accents),
    engine madrid (every chip of the eight conversations with and without the game's hooks, cash only, EN and AR; a typed route through
    each shop with its charge; the friends; Spanish vs English; tú and usted).
- **Spanish step 2: Madrid in the app** (done): Spanish is the fourth language to learn, and Madrid is playable from onboarding to the
  end of Chapter 3.
  * The Madrid game pack (`@lw/content` madrid/game/): euros at the Spanish minimum wage (start with 30,00 €; prices shown 4,30 € with
    IVA included, 21 % and 10 %), 20 things on the menus of five shops (the bar and the panadería from Chapter 1, the churrería and the
    Metro from Chapter 2, the mercado from Chapter 3), a gift to buy (a tin of olive oil at the fruit stall: 「¿Algo más? Tengo un aceite
    de oliva buenísimo.」), three friends with their facts and perks, Chapters 1–3 (「Hola, Madrid」, 「Mi barrio」, 「Sábado de
    mercado」) with Lola's, Carmen's and Lucía's beats, two dreams (a gift, the friends), five titles, ten culture cards (dos besos,
    「¿Qué te pongo?」, tips, ordering at the barra, churros, the Metro, 「¿Quién es el último?」, football, tú and usted, Spanish
    hours) and the daily goals. It passes the pack check at level 5.
  * The app: Español in onboarding (Lola, Lucía and Rafa on the welcome), the target switch and Settings (its own saves, `lw.es.v1.`),
    the notebook's first five, the Shift screen's Spanish table (「Son 4,30 €.」, 「Le devuelvo 0,70 €.」; aprendiz … mano derecha)
    ready for a Madrid job.
  * A Lavapiés street in 3D (`@lw/world` madrid.ts): five-storey buildings with balconies, shutters and cornices, Bar El Rincón, the
    panadería, the churrería, the Metro's red diamond, the mercado; across the street Lucía's portal and the language exchange's
    terraza; a plaza with a fountain, trees, benches and lamps where Javi waits. 17 Spanish signs (Calle del Ave María, Cerrado …).
  * Recorded Spanish voices: 584 lines with Piper's two voices from Spain, davefx (a man, CC0: the narrator, Andrés, Rafa) and the
    Sharvard corpus (a man and a woman, CC BY 3.0, credited in Settings: Lola, Carmen, Marisa, Lucía, Nadia, Javi and the customers),
    each character set apart by pitch and pace; prices read in Spanish words. The voice tool now picks a speaker of a model with
    several, and a limiter keeps every line under 0 dB. All 584 checked (pace, loudness, no clipping).
  * 89 new words (331 in all).
  * Tests: the pack at level 5 (every chapter step reachable, every word in the dictionary), the street (spawns, fronts, signs, the
    plaza), the target (Spanish setup), the voice lines, and an e2e in the real UI (`tools/e2e/game/madrid.mjs`: onboarding in
    Español, Lucía, the bar charging exactly 4,30 €, the panadería 1,50 €, Chapter 2 with Javi and the churrería 5,00 €, Settings back
    to Japanese; EN and AR).

- **Spanish step 3: Madrid's regulars, small talk and friends** (done): the shopkeepers know you and the friends have something to say
  on any day.
  * Regulars and small talk (`@lw/content` madrid/smalltalk.ts, on the shared `withShopTalk` and the flags the app already sets): from
    the second visit Lola greets a regular (「¡Hola! ¡Otra vez por aquí! ¿Qué te pongo hoy?」), Carmen (「¡Qué alegría verle otra vez!」),
    Andrés, Rafa and Marisa too; on some visits they talk about the season or the weekend, answered with a chip or in your own words,
    then back to the shop's question. Each shop keeps its register: Lola and Rafa ask with tú (「¿Te gusta el verano?」, 「¿Tienes
    planes?」), Carmen, Andrés and Marisa with usted (「¿Le gusta el verano?」, 「¡Que lo pase bien!」). June is the start of Madrid's
    heat, summer is 「muy fuerte」.
  * The friends' chats and a present (madrid/social.ts, on the shared `buildSmalltalk` / `buildGiveGift`): Lucía, Javi and Nadia have a
    chat of the day once you have met them (Small talk on the Interaction sheet: the weather, the weekend, food, music, travel, your
    Spanish, sport, films, and one topic of their own: Seville for Lucía, an instrument for Javi, an Arabic word for Nadia). They quote a
    remembered hobby (「¿Todavía te gusta el cine?」), favourite food (「¿Has comido paella esta semana?」) or your dream, and reveal their
    facts after their reaction. Gift (from Chapter 3) now opens a hand-over in Spanish (「¡Tengo una lata de aceite para ti!」): Madrid
    offered it in step 2 without one. Everything the street sells can be named as a present; the hobbies read with their articles
    (la música, el deporte, el cine).
  * Spanish matching: a key of one or two letters is a whole word, so 「no」 is never heard in 「esta noche」 or 「nos vemos」, nor 「sí」 in
    「siempre」.
  * 104 new words (435 in all); 434 more Spanish lines recorded (1,018 in all, all checked): the regulars' small talk in each
    shopkeeper's voice, the friends' chats, the hand-over in each friend's voice.
  * Tests: every shop and topic through the engine (tú and usted, chips and own words, an order still an order, the walk of every chip
    for a regular), every chat topic of every friend from where the app enters it (EN and AR), the callbacks and remembered facts, the
    hand-over (by item, by food, bare; a zumo de naranja is not oranges), the app's flags on any day of the year, the gift sheet, the
    voice lines, and the e2e (`tools/e2e/game/madrid.mjs`: small talk and a regular's return at Lola's, Lucía's chat, Andrés's olive oil
    at the mercado given to Lucía; EN and AR).

- **Spanish step 4: Madrid Chapters 4–6** (done): the story runs to Chapter 6 (*Buenos amigos*, *De tapas*, *Mi casa en Madrid*), whose
  closing is the new ending before Free Walk, as in Berlin and Amsterdam.
  * Hang-outs at three hearts (madrid/hangouts.ts): Sunday's tortilla de patatas with Lucía (peel, the great question 「¿con cebolla o
    sin cebolla?」, each answer with its own line, flip it with the plate, taste), the Atleti match with Javi at Lola's bar (a soft drink,
    「¡Gol!」, groaning at the referee), and a walk in the Retiro with Nadia (the lake, asking a stranger for a photo with usted, an ice
    cream, what you like about Madrid).
  * Three places on the north side (madrid/places.ts): the farmacia (Ch 4, Pilar, usted: 「Me duele la garganta」, the remedy for each
    complaint, how often to take it, 「¡Que se mejore!」; medicines at 4 % IVA), Taberna El Farolillo (Ch 5, Manolo, tú: a caña only for an
    adult, a mosto or a soft drink for anyone, the free tapa, a ración of bravas or croquetas, 「¡Salud!」, 「¿Me cobras?」) and the
    citizens' office of the Ayuntamiento (Ch 6, Concha, usted: the padrón with cita previa, passport and rental contract, the address
    with its floor and door, the certificate). The farmacia and the taberna greet regulars and make small talk like the rest of the
    street (the taberna with tú). Their fronts: the green cross, the taberna's blue-and-white tiles, Madrid's crimson flag with seven
    stars at the kerb; five new signs to read. Six culture cards (the farmacia, the tortilla debate, football at the bar, the Retiro,
    tapas, the padrón), three titles that guess no gender (Buena gente, Alma de la fiesta, Gato de Madrid).
  * Opening marks stay with their word: a tappable word is a button, which a line could break before, so 「¡dale」 could end a line on
    「¡」. An opening mark (¡ ¿ « „ “ ‘ ( [ and Japanese 「 『 （) and the word after it are now kept together, in every language.
  * 150 new words (585 in all); 343 more Spanish lines recorded (1,360 in all, all checked), Pilar, Manolo and Concha with voices of
    their own.
  * Tests: the three places through the engine (every chip EN/AR with and without the game's hooks, an adult and a younger player, a
    regular with small talk; typed routes with their exact charges; the caña only for an adult; tú to the pharmacist gets the usted
    note), the hang-outs (every chip, typed routes, both onion answers, usted with a stranger gets no note), the pack at level 5, the
    street (fronts, spawns, signs), the voice lines, and an e2e in the real UI (`tools/e2e/game/madrid-chapters.mjs`: the farmacia 6,50 €,
    Lucía's tortilla, the taberna 7,50 € in cash, the padrón; EN and AR).

## Next

1. **Spanish step 5: a job in Madrid** (Rafa's churrería or Lola's bar), with the Shift screen's Spanish table (「Son 4,30 €.」,
   「Le devuelvo 0,70 €.」, aprendiz … mano derecha) and its customers in a woman's and a man's voice.
2. **Listen to the voices** and adjust a character's pitch or pace in `voices-de.ts` / `voices-nl.ts` / `voices-es.ts` where needed
   (re-run `PIPER_PYTHON=… PIPER_MODELS=… node tools/voice/generate-piper.mjs <de|nl|es>`). Nathalie was trained on Flemish speech: if
   her accent jars in Amsterdam, a Netherlands-Dutch woman's voice from Piper's MLS model (CC BY 4.0, needs a credit) can replace it.

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
behind it (done: the `TargetLanguage`, with German beside it and a bakery conversation), (2) the German plugin and a small Berlin pack (one street, 5 shops, 3 friends, chapters 1–3), (3) a language picker in
onboarding, (4) voices, then (5) Dutch in Amsterdam the same way (done: Dutch steps 1–2).
