# ご縁 Goen — the premium currency (stage 1: earned free; stage 2: Goen packs with Stripe)

In Japan people toss a 5-yen coin (五円, *go-en*) into the shrine box because *go-en* also means ご縁, "a connection".
The game's second currency is **Goen**: you buy **connections** (new places, seasons, looks, charms), never fluency.

## Principles (never break these)

1. **Yen is earned only by speaking.** Goen never turns into yen, and yen never turns into Goen (stage 1). Goen can never buy a
   conversation pass, stars, chapter progress, objective ticks, hearts or AP.
2. **Everything bought with Goen is more Japanese to use.** A Journey is new conversations; a season is speaking challenges; a
   kimono is worn in the world; a charm protects a speaking streak.
3. **No paid randomness.** No loot boxes or gacha; every Goen item shows exactly what it is and what it costs.
4. **Kids and teens** (age profiles, D28): they earn and spend Goen like adults in stage 1 (it is free); stage 2's real-money
   purchases sit behind a parent gate and never show to them otherwise.
5. **No dead buy button.** Goen is always earned in play. Packs show only when the server is set up (stage 2, below); otherwise the
   Shrine says "Goen packs: coming soon".

## Earning (BALANCE.goen, `@lw/game`)

| Source | Goen | Rule |
|---|---|---|
| Chapter completed (1-8) | +25 | once per chapter (on the chapter's completion, not replayed by old saves) |
| All daily goals done | +5 | once per play day |
| 7-day speaking streak | +20 | each time the streak reaches a multiple of 7 |
| Capstone speech (`matsuri_speech`, Real mode, 5 own lines) | +30 | once |
| Letter Home written | +20 | once |
| Season free-track tiers | as listed in the season | once per tier |
| A Journey's final objective | +20 | once per Journey |

A steady player who finishes the story earns about 400 Goen plus about 20 a week from streaks: enough for the Kyoto Journey
(250) during the story and the season premium track (150) within a few weeks. The economy simulator gains a Goen window test.

## Spending: the Shrine (桜町神社) at the park's torii

The torii in the park (`spot:torii`, x −12, z 10.5) gains a small shrine: a haiden front with a saisen box (お賽銭箱), a bell rope and
an ema rack. Tapping the box (`shrine:box`) opens the **Shrine panel**: the Goen balance, the catalog (cards with picture, name in
JA/EN/AR, price, what it gives, owned/locked), and the **wish ritual** for a chosen item:

1. Toss the coin (the Goen is spent, ledger entry `goen:spend:<itemId>`), the coin sound.
2. 二礼二拍手一礼: bow, bow, clap, clap, bow (five taps in order; a wrong order gets a gentle hint from Hanako, never a penalty).
3. **Make your wish in Japanese** (the speaking moment): a short scenario `shrine_wish` whose line is
   「{wish}ますように。」 (e.g. 京都に行けますように / きれいになれますように / 毎日話せますように), typed or spoken; the chips show
   one model line (assisted). An own line earns nothing extra (it is a ritual, `pay:'none'`), but it counts toward `words.said`.
4. The item unlocks; a culture card on the first visit: **`cc_goen`** (why the 5-yen coin) and **`cc_sanpai`** (shrine manners:
   wash hands at the chōzuya, bow, clap, bow).

Free every day at the shrine: an **omikuji** (おみくじ) fortune slip that teaches one word due for review (大吉/吉/小吉 decide only
the wording; no item or currency is ever random).

## Stage-1 catalog (`GOEN_CATALOG`, `packages/content/src/tokyo/game/goen.ts`)

| id | kind | Goen | Gives |
|---|---|---|---|
| `journey_kyoto` | journey | 250 | The Kyoto Journey (below) |
| `season_autumn_premium` | season | 150 | The premium track of the autumn season |
| `kimono_momiji` | cosmetic | 120 | An autumn-leaf kimono (avatar outfit; worn like the yukata) |
| `room_momiji` | cosmetic | 60 | Autumn room decor set (a placeable piece for the flat or dorm, comfort +1) |
| `ride_sakura` | cosmetic | 50 | Sakura paint for the bike/e-bike |
| `omamori_streak` | charm | 30 | お守り: keeps the speaking streak alive for one missed day (hold at most 2; used automatically) |

## The Kyoto Journey (京都の旅, a content pack)

A panel trip like Hikarigaoka (no 3D town): a Shinkansen ticket at the station (round trip charged up front in **yen** earned by
speaking, ¥3,600 game price), then three conversations over CSS backdrops and a mini-objective set:

* `kyoto_ryokan` — check in at a ryokan with the okami (女将 Fujiwara-san): keigo (いらっしゃいませ、ご予約のお名前は…、お部屋は…),
  your name, nights, dinner time.
* `kyoto_temple` — at a temple: buy an omamori, ask for a goshuin stamp (御朱印), ask about the garden.
* `kyoto_matcha` — a matcha and wagashi café: order, compliment, ask for a recommendation (おすすめ).

Objectives (`journey_kyoto` set, shown on the Quests screen while the Journey is owned): travel there and back, check in with 3+
own lines, the temple, the café, buy a souvenir for a friend. Completion: +20 Goen, keepsake `kp_kyoto`, title `t_kyoto`.
Lexicon: about 40 new words (旅館, 予約, 泊, 御朱印, 抹茶, 庭, お寺, 新幹線…), EN + AR, readings.

## The season pass (季節), stage 1: 秋 Autumn (`season_autumn`)

`SEASONS` data: id, window (real calendar dates; autumn: 15 Oct – 15 Dec), season points (SP) earned by **speaking tasks**
(tracked from the season's start: e.g. 3 conversations with ★★ or more, say 10 autumn words in conversations, buy a seasonal sweet
at Aiko's (new autumn item), visit the shrine, give a gift, work a shift), 8 tiers on two tracks:

* **Free track**: Goen (+10 at tiers 2, 4, 6, 8), a keepsake, an autumn sticker.
* **Premium track** (unlocked with `season_autumn_premium`): the momiji scarf, an autumn room plant, a ride sticker, a title
  `t_momiji`, and the tier-8 keepsake.

The Season screen (from the Quests screen and the Shrine) shows tiers, tasks with progress, and what each track gives. Outside its
window the season shows "next season soon" and nothing is lost.

## Data and integrity

* `GameState.goen = { balance, earned: Record<reasonId, true>, ledger ring, owned: Record<itemId, dayKey>, charms, season: {...} }`
  (versioned through migrate; old saves get an empty Goen state and **no** retroactive grants except chapters already completed,
  which grant their +25 once on load so existing players are not penalised).
* Every earn and spend is an idempotent ledger entry; balance = sum of the ledger (checksum like the yen wallet).

## Stage 2: Goen packs (Stripe Checkout, no sign-in)

**Packs** (set on the server, `api/goen.ts` `PACKS`; the client never sends a price): 120 Goen $0.99 · 650 Goen $4.99 (+50 bonus) ·
1,400 Goen $9.99 (+200 bonus). Shown at the Shrine under the catalog ("Get more Goen") only when the server answers `enabled`.

**Server** (`api/goen.ts`, one Vercel function, no database: Stripe is the record):

* `GET /api/goen` → `{ enabled, test, packs }`.
* `checkout` → a Stripe Checkout Session (`mode: payment`, inline `price_data`, metadata `lw/goen/pack`). A first purchase uses
  `customer_creation: always`, so the account (a Stripe Customer) exists only once someone has paid.
* `claim` (back from Stripe with `?goen_session=cs_…`) → only for a paid session: the **recovery code** and the wallet.
* `wallet` (code) → paid checkouts (refunded or disputed ones listed apart), bought Goen spent, once-items to give back.
* `spend` (code, reports) → counts each report once (hash ring in the customer's metadata); bought Goen beyond what was paid is refused.

**Recovery code** = Crockford base32 of the customer id + 40 bits of HMAC (`GOEN_SECRET`, else derived from the Stripe key), in groups of
four. It proves the account without a lookup; it is shown in Settings > Your purchases (copy button) and typed into "Restore purchases"
on a new device. Anyone with the code can restore the purchases, as with a gift-card code; it cannot be revoked in this stage.

**In the game** (`@lw/game` `paidEvent`, `GoenState.paid`): bought Goen joins the one balance (`goen:buy:<checkout>` entries). A spend
uses **free Goen first**, then bought Goen; the bought part and the item are queued (`outbox`) and sent to the server. `goen_sync` is
idempotent: new paid checkouts add Goen, refunds take it back once (never below 0), bought Goen spent on another device is taken once (by
the running total), once-items bought there become owned here. The first account also queues the once-items already owned, so a restore
gives them back. Free Goen and items bought before the first purchase stay on the device (local-first, like the rest of the save).

**Younger players** (age profile under 18): a grown-up check (a multiplication) before Stripe's page. Bought Goen still never buys yen,
lessons, stars, chapters, objectives, hearts or AP.

**Setup**: in the Vercel project add `STRIPE_SECRET_KEY` (start with the `sk_test_…` key; test card 4242 4242 4242 4242) and redeploy;
optionally `GOEN_SECRET` (16+ random characters). No webhook and no Stripe products are needed. Going live = the live key (test-mode
codes do not open live accounts) + Stripe's own account activation. Refunds are made in the Stripe dashboard; the next sync takes the
Goen back.

**Not in this stage**: app-store payments (iOS/Android apps must use in-app purchase for digital goods), subscriptions, revoking a code,
email receipts beyond Stripe's own.
