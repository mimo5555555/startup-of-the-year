import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, SCENARIOS, scenarioById, yenToJa, type L1, type Scenario, type Vars } from '@lw/content';
import { classifyInput, ConversationSession, evaluateSession, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

function open(id: string, l1: L1 = 'en', topics: string[] = [], name = 'Layla', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: name, topics, now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** Mirrors what the app does with whatever the learner types or says. */
function say(s: ConversationSession, text: string): SubmitResult {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

const written = (s: ConversationSession) => s.turns[s.turns.length - 1].line.written;

describe('cafe', () => {
  it('can be completed entirely in English via "say it your way"', () => {
    const s = open('cafe');
    expect(written(s)).toBe('いらっしゃいませ。ご注文は？');
    expect(say(s, 'Hello').character.kind).toBe('reaction');
    say(s, "I'd like a coffee");
    expect(s.nodeId).toBe('hot_or_iced');
    expect(written(s)).toBe('コーヒーですね。ホットですか、アイスですか？');
    say(s, 'Iced please');
    expect(s.nodeId).toBe('anything_else');
    say(s, "What's the wifi password?");
    expect(written(s)).toContain('sakura1234');
    say(s, 'Thank you');
    expect(s.nodeId).toBe('price');
    const last = say(s, 'By card please');
    expect(last.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['order', 'pay', 'temp', 'wifi']);
    expect(s.turns.filter((t) => t.speaker === 'learner').every((t) => t.assisted || t.intentId === 'greet')).toBe(true);
  });

  it('can be completed in Arabic', () => {
    const s = open('cafe', 'ar');
    say(s, 'أريد قهوة');
    say(s, 'بارد من فضلك');
    say(s, 'ما هي كلمة سر الواي فاي؟');
    say(s, 'شكرا جزيلا');
    expect(say(s, 'نقدا من فضلك').ended).toBe(true);
    expect(s.stepsDone.size).toBe(4);
  });

  it('accepts typed Japanese and romaji', () => {
    const s = open('cafe');
    say(s, 'kohi o kudasai');
    expect(s.nodeId).toBe('hot_or_iced');
    say(s, 'アイスでお願いします。');
    say(s, 'いいえ、大丈夫です。');
    expect(s.nodeId).toBe('price');
    expect(say(s, '現金でお願いします').ended).toBe(true);
    expect(s.stepsDone.has('wifi')).toBe(false);
  });

  it('handles reactions without losing its place', () => {
    const s = open('cafe');
    const thanks = say(s, 'ありがとう');
    expect(thanks.character.kind).toBe('reaction');
    expect(s.nodeId).toBe('start');
    const again = say(s, 'もう一度お願いします');
    expect(again.character.kind).toBe('repeat');
    expect(again.character.line.written).toBe('いらっしゃいませ。ご注文は？');
    const slow = say(s, 'ゆっくりお願いします');
    expect(slow.character.slow).toBe(true);
    expect(slow.character.followUp?.written).toBe('いらっしゃいませ。ご注文は？');
    expect(s.nodeId).toBe('start');
  });

  it('asks for help after two misunderstandings in a row', () => {
    const s = open('cafe');
    const a = s.submit({ text: 'ふがふが', mode: 'typed_ja' });
    expect(a.learner.matched).toBe(false);
    expect(a.character.kind).toBe('fallback');
    expect(a.character.needsHelp).toBe(false);
    const b = s.submit({ text: 'ほげほげ', mode: 'typed_ja' });
    expect(b.character.needsHelp).toBe(true);
    // a good answer resets the streak
    say(s, 'コーヒーをください');
    expect(s.fallbackStreak).toBe(0);
  });
});

describe('konbini', () => {
  it('finds an item, answers about the bag and pays', () => {
    const s = open('konbini');
    say(s, 'おにぎりはありますか？');
    expect(written(s)).toBe('おにぎりはあちらにあります。');
    say(s, 'これをください。');
    expect(s.nodeId).toBe('register');
    say(s, 'いいえ、大丈夫です。');
    expect(s.nodeId).toBe('payment_a');
    expect(say(s, 'カードでお願いします').ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['bag', 'find', 'pay']);
  });
  it('answers a side question without moving on', () => {
    const s = open('konbini');
    const r = say(s, 'Where is the toilet?');
    expect(r.character.line.written).toBe('トイレはあちらです。');
    expect(s.nodeId).toBe('start');
  });
  it('works in Arabic with a different item', () => {
    const s = open('konbini', 'ar');
    say(s, 'أين الماء؟');
    expect(written(s)).toBe('水はあちらにあります。');
    say(s, 'هذا من فضلك');
    say(s, 'نعم من فضلك');
    expect(s.nodeId).toBe('payment_b');
  });
});

describe('station', () => {
  it('asks the way and says thanks', () => {
    const s = open('station');
    say(s, 'I want to go to Shibuya');
    expect(written(s)).toBe('渋谷ですね。三番線の電車に乗ってください。');
    say(s, 'How much is it?');
    expect(written(s)).toBe('百九十円です。');
    expect(say(s, 'Thank you').ended).toBe(true);
    expect(s.stepsDone.size).toBe(3);
  });
  it('can start with the ticket machine question', () => {
    const s = open('station');
    say(s, 'Where can I buy a ticket?');
    expect(s.nodeId).toBe('ticket_answer');
    say(s, '新宿へ行きたいです');
    expect(written(s)).toContain('新宿');
  });
});

describe('ramen', () => {
  it('orders, tastes and pays', () => {
    const s = open('ramen');
    say(s, 'ラーメンをください');
    expect(s.nodeId).toBe('which_flavor');
    say(s, 'みそをください');
    expect(written(s)).toBe('みそラーメンですね。辛いのは大丈夫ですか？');
    say(s, '辛くないのがいいです');
    expect(s.nodeId).toBe('served_mild');
    say(s, 'いただきます！');
    expect(s.nodeId).toBe('tasting');
    say(s, 'おいしいです');
    expect(s.nodeId).toBe('bill_prompt');
    say(s, 'お会計をお願いします');
    expect(s.nodeId).toBe('price');
    expect(say(s, 'はい、どうぞ').ended).toBe(true);
    expect(s.stepsDone.size).toBe(4);
  });
  it('takes the recommendation route', () => {
    const s = open('ramen');
    say(s, 'What do you recommend?');
    expect(s.nodeId).toBe('rec');
    say(s, 'shoyu ramen please');
    expect(written(s)).toContain('しょうゆラーメン');
    say(s, "Yes, spicy is fine");
    expect(s.nodeId).toBe('served_hot');
  });
});

describe('park', () => {
  it('captures the spoken name, country and hobby', () => {
    const s = open('park', 'en', ['anime']);
    say(s, 'はじめまして。わたしはジョンです。');
    expect(written(s)).toBe('ジョンさん、はじめまして。わたしはミオです。どこから来ましたか？');
    say(s, 'エジプトから来ました');
    expect(written(s)).toBe('エジプトですか！いいですね。趣味は何ですか？');
    const r = say(s, 'アニメが好きです');
    expect(r.ended).toBe(true);
    expect(written(s)).toBe('わたしもアニメが大好きです！また話しましょう。');
    expect(s.stepsDone.size).toBe(3);
  });
  it('uses a different reply for other hobbies', () => {
    const s = open('park');
    say(s, 'わたしはレイラです');
    say(s, 'Italy');
    expect(s.nodeId).toBe('hobby_q');
  });
  it('keeps an unknown country as typed', () => {
    const s = open('park');
    say(s, 'わたしはレイラです');
    say(s, 'ペルーから来ました');
    expect(written(s)).toBe('ペルーですか！いいですね。趣味は何ですか？');
  });
  it('translates an English introduction including the name', () => {
    const s = open('park');
    say(s, "Hi, I'm Layla");
    expect(written(s)).toContain('Laylaさん');
  });
  it('builds hobby suggestions from the learner topics', () => {
    const s = open('park', 'en', ['music', 'gaming', 'photo']);
    say(s, 'わたしはレイラです');
    say(s, 'アメリカから来ました');
    const sug = s.suggestions().map((x) => x.written);
    expect(sug).toEqual(['音楽が好きです。', 'ゲームが好きです。', '写真が好きです。']);
  });
});

/** The scenarios the game refits with prices (docs/GAME_DESIGN.md §6.6); `park` has no price. */
const SHOP_SCENARIOS = ['cafe', 'konbini', 'ramen', 'station'];

/** §5.3 and §5.4 prices of what the catalog (3E) and the fares (2G) will carry; the menu itself comes from the pack. */
const GIFT_PRICE: Record<string, number> = { g_choco: 220, g_manga: 680, g_game_card: 1000 };
const FARE: Record<string, number> = { shibuya: 170, shinjuku: 190, tokyoStation: 210, akihabara: 210, ueno: 230, asakusa: 260, airport: 520 };
const QTY: Record<string, number> = { one: 1, two: 2, three: 3 };
const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};
/** The Japanese of a price as a line shows it. */
const yenText = (n: number) => yenToJa(n).markup.replace(/\|/g, '');

/**
 * What the app's bridge does with a shop scenario, in miniature: read `ScenarioMeta.shop`, price the basket (the item slot's option
 * times the qty slot, plus the option of every extra slot that holds a value), take the money from the pocket the `payMethod` slot
 * names (cash by default) and refuse when it is not there. `purchases` records what was bought.
 */
function shopEconomy(scenarioId: string, wallet: { cash: number; ic?: number }) {
  const meta = JP_PACK.scenarioMeta.find((m) => m.id === scenarioId);
  const w = { cash: wallet.cash, ic: wallet.ic ?? 0 };
  const log = { purchases: [] as Array<{ ids: string[]; total: number; method: string }>, charges: 0 };
  const unit = (id: string) => JP_PACK.menu.find((m) => m.id === id)?.price ?? GIFT_PRICE[id] ?? 0;
  const basket = (slots: Record<string, string>) => {
    const shop = meta?.shop;
    if (!shop) return null;
    const main = shop.itemSlot && slots[shop.itemSlot] ? shop.itemMap[slots[shop.itemSlot]] : undefined;
    const extras = (shop.extraSlots ?? []).map((x) => (slots[x] ? shop.itemMap[slots[x]] : undefined)).filter((x): x is string => !!x);
    if (!main && extras.length === 0) return null;
    const qty = QTY[slots[shop.qtySlot ?? ''] ?? 'one'] ?? 1;
    const ids = [...(main ? [main] : []), ...extras];
    const total = (main ? unit(main) * qty : 0) + extras.reduce((a, id) => a + unit(id), 0);
    return { ids, unit: unit(main ?? extras[0]), total };
  };
  const hooks: SessionGameHooks = {
    vars(slots) {
      const v: Vars = {};
      const b = basket(slots);
      if (b) {
        v.price = money(b.unit);
        v.total = money(b.total);
      }
      if (slots.place && FARE[slots.place]) v.fare = money(FARE[slots.place]);
      return v;
    },
    charge(slots) {
      log.charges++;
      const b = basket(slots);
      const method = slots.payMethod === 'ic' ? 'ic' : 'cash';
      if (!b || w[method] < b.total) return { ok: false };
      w[method] -= b.total;
      log.purchases.push({ ids: b.ids, total: b.total, method });
      return { ok: true };
    },
  };
  return { hooks, log, wallet: w };
}

/** Pick the first chip until the conversation ends (the most direct path; at `short` the first chip is the polite way out). */
function tapThrough(s: ConversationSession): void {
  let guard = 0;
  while (!s.ended && guard++ < 30) s.pickSuggestion(0);
}

/** Scenarios whose say-the-total chip needs the game's `total` Var (`SceneNode` chips resolve Vars only with hooks). */
const NEEDS_TOTAL = new Set(['motors_car']);
/** give_gift: the three hand-over chips name the item the host passes in as the Var `gift` (4B-a) */
const GIFT_HOOKS = () => ({ game: { vars: () => ({ gift: { ja: 'チョコレート', gloss: { en: 'chocolate', ar: 'شوكولاتة' } } }), charge: () => ({ ok: true }) } });

describe('every offered suggestion works', () => {
  // Pick every suggestion at every reachable node; the character must always understand it.
  function walk(sc: Scenario, l1: L1, mk: () => Partial<SessionOptions> = () => ({})) {
    const problems: string[] = [];
    const visited = new Set<string>();
    const replay = (path: number[]) => {
      const s = open(sc.id, l1, ['anime'], 'Layla', mk());
      for (const i of path) s.pickSuggestion(i);
      return s;
    };
    const visit = (path: number[]) => {
      const s = replay(path);
      const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
      if (visited.has(key) || s.ended) return;
      visited.add(key);
      const sugg = s.suggestions();
      if (!sugg.length) problems.push(`${sc.id}/${s.nodeId}: no suggestions`);
      sugg.forEach((sg, i) => {
        if (sg.tokens.some((t) => t.s === '…')) problems.push(`${sc.id}/${s.nodeId}/#${i}: unresolved variable`);
        if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${sc.id}/${s.nodeId}/#${i}: token without gloss`);
        const t = replay(path);
        const r = t.pickSuggestion(i);
        if (!r.learner.matched) problems.push(`${sc.id}/${s.nodeId}/#${i} "${sg.written}" was not understood`);
        else if (r.character.kind === 'fallback') problems.push(`${sc.id}/${s.nodeId}/#${i} "${sg.written}" got a fallback`);
        if (r.learner.matched && !r.ended) visit([...path, i]);
      });
    };
    visit([]);
    return { problems, nodes: visited.size };
  }

  for (const sc of SCENARIOS) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${sc.id} (${l1})`, () => {
        const { problems: all, nodes } = walk(sc, l1, sc.id === 'give_gift' ? GIFT_HOOKS : undefined);
        // a scenario that asks the learner to say the total shows it in a chip: without the game's hooks there is no number to show
        // (the Motors tests walk it with hooks)
        const problems = NEEDS_TOTAL.has(sc.id) ? all.filter((p) => !/\/(confirm|wrong_total)\/#\d+: unresolved variable$/.test(p)) : all;
        expect(problems).toEqual([]);
        expect(nodes).toBeGreaterThan(2);
      });
    }
  }

  // The same walk with the game's hooks: every line resolves its {price}/{total}/{fare}, every chip is understood, with plenty of
  // cash, with almost none (the `short` branch) and with the twist variants on.
  const hookWalks: Array<[string, { cash: number; ic: number }, Record<string, boolean>]> = [
    ['rich', { cash: 5000, ic: 3000 }, { priced: true }],
    ['twist', { cash: 5000, ic: 3000 }, { priced: true, twist: true }],
    ['broke', { cash: 50, ic: 0 }, { priced: true }],
  ];
  for (const sc of SCENARIOS.filter((x) => SHOP_SCENARIOS.includes(x.id))) {
    for (const [label, wallet, flags] of hookWalks) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${sc.id} with game hooks, ${label} (${l1})`, () => {
          const { problems, nodes } = walk(sc, l1, () => ({ game: shopEconomy(sc.id, wallet).hooks, flags: { ...flags } }));
          expect(problems).toEqual([]);
          expect(nodes).toBeGreaterThan(2);
        });
      }
    }
  }

  // the ticket route of the ramen shop (`ScenarioMeta.startNode`): the machine panel already took the money, nothing is charged
  for (const l1 of ['en', 'ar'] as const) {
    it(`ramen from start_ticket (${l1})`, () => {
      const sc = scenarioById('ramen')!;
      const { problems, nodes } = walk(sc, l1, () => ({ startNode: 'start_ticket', game: shopEconomy('ramen', { cash: 0 }).hooks, flags: { priced: true } }));
      expect(problems).toEqual([]);
      expect(nodes).toBeGreaterThan(2);
    });
  }

  it('can finish every scenario by suggestions alone, with every goal step done', () => {
    for (const sc of SCENARIOS) {
      const s = open(sc.id);
      let guard = 0;
      while (!s.ended && guard++ < 20) s.pickSuggestion(0);
      expect(s.ended, sc.id).toBe(true);
      // the first suggestion is always the most direct path
      expect(s.stepsDone.size, `${sc.id} steps`).toBeGreaterThanOrEqual(sc.steps.length - 1);
    }
  });
});

describe('feedback', () => {
  it('does not grade lines the app wrote and says so', () => {
    const s = open('cafe');
    say(s, "I'd like a coffee");
    say(s, 'Hot please');
    say(s, 'No thanks, that is all');
    say(s, 'By card please');
    const f = evaluateSession(s);
    expect(f.scores.accuracy).toBeNull();
    expect(f.scores.goal).toBe(75);
    expect(f.phrasesLearned.length).toBe(4);
    expect(f.corrections).toEqual([]);
    expect(f.focusNext.some((x) => x.en.includes('without a suggestion'))).toBe(true);
  });

  it('flags a bare noun, a wrong particle and an English word, each in its own category', () => {
    const s = open('cafe');
    s.submit({ text: 'コーヒー', mode: 'typed_ja' });
    s.submit({ text: 'ほっと', mode: 'typed_ja' });
    s.submit({ text: 'いいえ、大丈夫です', mode: 'typed_ja' });
    s.submit({ text: 'カードがください', mode: 'typed_ja' });
    const f = evaluateSession(s);
    const cats = f.corrections.map((c) => c.category);
    expect(cats).toContain('naturalness');
    const bare = f.corrections.find((c) => c.original === 'コーヒー');
    expect(bare?.better).toBe('コーヒーをください。');
  });

  it('catches が before ください', () => {
    const s = open('konbini');
    s.submit({ text: 'おにぎりはありますか', mode: 'typed_ja' });
    s.submit({ text: 'これがください', mode: 'typed_ja' });
    const f = evaluateSession(s);
    const c = f.corrections.find((x) => x.category === 'grammar');
    expect(c?.better).toBe('これをください');
    expect(c?.explanation.ar).toContain('を');
  });

  it('suggests the Japanese word when English slips into a Japanese sentence', () => {
    const s = open('cafe');
    s.submit({ text: 'coffee をください', mode: 'typed_ja' });
    const f = evaluateSession(s);
    const c = f.corrections.find((x) => x.category === 'vocabulary');
    expect(c?.better).toBe('コーヒーをください');
    expect(c?.span).toEqual([0, 6]);
  });

  it('is honest: a perfect run gets full marks, an empty one does not', () => {
    const good = open('cafe');
    for (const t of ['コーヒーをください。', 'ホットをください。', 'Wi-Fiのパスワードを教えてください。', 'ありがとうございます。', 'カードでお願いします。']) good.submit({ text: t, mode: 'typed_ja' });
    const f = evaluateSession(good);
    expect(f.scores.goal).toBe(100);
    expect(f.scores.accuracy).toBe(100);
    expect(f.praise.en).toContain('no mistakes');

    const quiet = open('cafe');
    const g = evaluateSession(quiet);
    expect(g.scores.goal).toBe(0);
    expect(g.praise.en).not.toContain('finished');
  });

  it('counts misunderstandings against fluency and accuracy', () => {
    const a = open('cafe');
    a.submit({ text: 'コーヒーをください。', mode: 'typed_ja' });
    const b = open('cafe');
    b.submit({ text: 'ふがふが', mode: 'typed_ja' });
    b.submit({ text: 'コーヒーをください。', mode: 'typed_ja' });
    expect(evaluateSession(b).scores.fluency).toBeLessThan(evaluateSession(a).scores.fluency);
    expect(evaluateSession(b).scores.accuracy!).toBeLessThan(evaluateSession(a).scores.accuracy!);
  });
});


describe('shop scenarios with game hooks (docs/GAME_DESIGN.md §6.2, §6.6)', () => {
  const rich = { cash: 5000, ic: 3000 };
  const start = (id: string, wallet = rich, flags: Record<string, boolean> = {}) => {
    const eco = shopEconomy(id, wallet);
    return { eco, s: open(id, 'en', [], 'Layla', { game: eco.hooks, flags: { priced: true, ...flags } }) };
  };

  describe('prices come from the hooks', () => {
    it('cafe: the total follows the drink that was ordered', () => {
      for (const [text, price] of [['コーヒーをください', 450], ['カフェラテをください', 520], ['お茶をください', 400], ['ジュースをください', 480], ['紅茶をください', 420]] as const) {
        const { s } = start('cafe');
        say(s, text);
        say(s, 'ホットをください');
        say(s, 'いいえ、大丈夫です');
        expect(s.nodeId, text).toBe('price');
        expect(written(s), text).toBe(`全部で${yenText(price)}です。現金ですか、カードですか？`);
      }
    });

    it('cafe: cake skips the temperature question and costs the cafe price', () => {
      const { s } = start('cafe');
      say(s, 'ケーキをください');
      expect(s.nodeId).toBe('anything_else');
      say(s, 'いくらですか');
      expect(written(s)).toContain(yenText(480));
    });

    it('konbini: asking the price of an item answers with that item, and a count multiplies the total', () => {
      const { s } = start('konbini');
      say(s, 'おにぎりはいくらですか');
      expect(s.nodeId).toBe('found_price');
      expect(written(s)).toBe(`${yenText(160)}です。`);
      say(s, 'ふたつください');
      expect(s.vars.qty.ja).toBe('ふたつ');
      expect(s.nodeId).toBe('register');
      expect(written(s)).toContain(yenText(320));
    });

    it('konbini: 「おにぎりをふたつください」 fills the item and the count from one sentence', () => {
      const { s } = start('konbini');
      say(s, 'おにぎりをふたつください');
      expect(s.nodeId).toBe('register');
      expect(written(s)).toContain(`${yenText(320)}です`);
    });

    it('konbini: each of the nine foods quotes its own price', () => {
      const JA: Record<string, string> = { onigiri: 'おにぎり', water: '水', sandwich: 'サンドイッチ', bento: 'お弁当', juice: 'ジュース', milk: '牛乳', greenTea: 'お茶', cake: 'ケーキ', coffee: 'コーヒー' };
      const menu = JP_PACK.menu.filter((m) => m.shop === 'konbini');
      expect(menu).toHaveLength(9);
      for (const m of menu) {
        const { s } = start('konbini');
        say(s, `${JA[m.option]}はいくらですか`);
        expect(s.nodeId, m.option).toBe('found_price');
        expect(written(s), m.option).toBe(`${yenText(m.price)}です。`);
      }
    });

    it('ramen: the bill is the bowl plus the extra, and updates when an extra is added', () => {
      const { s } = start('ramen');
      say(s, 'みそラーメンをください');
      say(s, 'はい、大丈夫です');
      say(s, 'いただきます');
      say(s, 'おいしいです');
      say(s, 'お会計をお願いします');
      expect(s.nodeId).toBe('price');
      expect(written(s)).toBe(`${yenText(950)}です。`);
      const t = start('ramen');
      say(t.s, 'みそラーメンをください');
      say(t.s, 'はい、大丈夫です');
      say(t.s, 'いただきます');
      say(t.s, 'おいしいです');
      say(t.s, '味玉をください');
      say(t.s, 'お会計をお願いします');
      expect(written(t.s)).toBe(`${yenText(950 + 150)}です。`);
    });

    it('station: the fare of the place that was asked for', () => {
      for (const [place, text, fare] of [['shibuya', '渋谷へ行きたいです', 170], ['shinjuku', '新宿へ行きたいです', 190], ['asakusa', '浅草へ行きたいです', 260], ['airport', '空港へ行きたいです', 520]] as const) {
        const { s } = start('station');
        say(s, text);
        expect(s.vars.place.ja, place).toBeTruthy();
        say(s, 'いくらですか？');
        expect(s.nodeId).toBe('price_answer');
        expect(written(s), place).toBe(`${yenText(fare)}です。`);
      }
    });

    it('a hook-driven price never reaches a line as the old fixed price', () => {
      const { s } = start('cafe');
      say(s, 'ケーキをください');
      say(s, 'いいえ、大丈夫です');
      expect(written(s)).not.toContain(yenText(450));
    });
  });

  describe('paying', () => {
    it('cafe: the purchase is charged once, at the end node, with the chosen pocket', () => {
      const { s, eco } = start('cafe');
      say(s, 'コーヒーをください');
      say(s, 'ホットをください');
      say(s, 'いいえ、大丈夫です');
      expect(eco.log.charges).toBe(0);
      const r = say(s, 'ICカードでお願いします');
      expect(r.ended).toBe(true);
      expect(s.nodeId).toBe('done');
      expect(eco.log.purchases).toEqual([{ ids: ['cafe:coffee'], total: 450, method: 'ic' }]);
      expect(eco.wallet).toEqual({ cash: 5000, ic: 2550 });
      expect(r.character.charged).toBe(true);
      expect(s.stepsDone.has('pay')).toBe(true);
    });

    it('a bare 「はい」 pays in cash', () => {
      const { s, eco } = start('konbini');
      say(s, 'おにぎりをください');
      say(s, 'いいえ、大丈夫です');
      expect(s.nodeId).toBe('payment_a');
      say(s, 'はい');
      expect(s.ended).toBe(true);
      expect(eco.log.purchases[0].method).toBe('cash');
      expect(eco.wallet.cash).toBe(4840);
    });

    it('konbini: a present from the goods node is bought at its own price', () => {
      const { s, eco } = start('konbini');
      say(s, 'プレゼントを探しています');
      expect(s.nodeId).toBe('goods');
      say(s, 'マンガをください');
      expect(s.nodeId).toBe('register');
      expect(written(s)).toContain(yenText(680));
      say(s, 'いいえ、大丈夫です');
      say(s, 'カードでお願いします');
      expect(eco.log.purchases).toEqual([{ ids: ['g_manga'], total: 680, method: 'cash' }]);
    });

    it('ramen: the bowl and the extra are one purchase on the bill', () => {
      const { s, eco } = start('ramen');
      say(s, 'とんこつラーメンをください');
      say(s, 'はい、大丈夫です');
      say(s, 'いただきます');
      say(s, 'おいしいです');
      say(s, '替え玉をください');
      expect(s.nodeId).toBe('bill_prompt');
      say(s, 'ごちそうさまでした');
      expect(s.nodeId).toBe('price');
      expect(written(s)).toBe(`${yenText(1170)}です。`);
      say(s, 'はい、どうぞ');
      expect(s.ended).toBe(true);
      expect(eco.log.purchases).toEqual([{ ids: ['ramen:tonkotsu', 'ramen:kaedama'], total: 1050 + 120, method: 'cash' }]);
    });
  });

  describe('too little money is a scripted branch, never an error', () => {
    it('charge routes to `short`: no purchase, no step, the conversation goes on', () => {
      for (const id of ['cafe', 'konbini', 'ramen']) {
        const { s, eco } = start(id, { cash: 100, ic: 0 });
        tapThrough(s);
        expect(s.nodeId, id).toBe('leave');
        expect(s.ended, id).toBe(true);
        expect(eco.log.purchases, id).toEqual([]);
        expect(eco.log.charges, id).toBeGreaterThan(0);
        expect(s.stepsDone.has(id === 'ramen' ? 'bill' : 'pay'), id).toBe(false);
      }
    });

    it('stops at `short` with an open conversation the learner can leave politely', () => {
      const { s } = start('cafe', { cash: 100, ic: 0 });
      say(s, 'コーヒーをください');
      say(s, 'ホットをください');
      say(s, 'いいえ、大丈夫です');
      const r = say(s, '現金でお願いします');
      expect(s.nodeId).toBe('short');
      expect(r.ended).toBe(false);
      expect(r.character.charged).toBeUndefined();
      expect(written(s)).toContain('足りません');
      expect(s.suggestions().length).toBeGreaterThanOrEqual(2);
      expect(say(s, 'また来ます').ended).toBe(true);
      expect(s.nodeId).toBe('leave');
    });

    it('cafe: asking for something cheaper and taking it works, and the cheaper drink can be bought', () => {
      const { s, eco } = start('cafe', { cash: 420, ic: 0 });
      say(s, 'コーヒーをください');
      say(s, 'ホットをください');
      say(s, 'いいえ、大丈夫です');
      say(s, 'はい');
      expect(s.nodeId).toBe('short');
      say(s, '安いのはありますか');
      expect(s.nodeId).toBe('cheaper');
      say(s, 'お茶をください');
      say(s, 'ホットをください');
      say(s, 'いいえ、大丈夫です');
      expect(written(s)).toContain(yenText(400));
      expect(say(s, 'はい').ended).toBe(true);
      expect(eco.log.purchases).toEqual([{ ids: ['cafe:greenTea'], total: 400, method: 'cash' }]);
    });

    it('konbini: the IC card has no money on it, so paying with it falls short', () => {
      const { s, eco } = start('konbini', { cash: 5000, ic: 0 });
      say(s, 'おにぎりをください');
      say(s, 'いいえ、大丈夫です');
      say(s, 'ICカードでお願いします');
      expect(s.nodeId).toBe('short');
      expect(eco.log.purchases).toEqual([]);
    });

    it('leaving before paying costs nothing, in every shop', () => {
      for (const [id, steps] of [['cafe', ['コーヒーをください', 'ホットをください', 'いいえ、大丈夫です']], ['konbini', ['おにぎりをください']], ['ramen', ['ラーメンをください']]] as const) {
        const { s, eco } = start(id);
        for (const t of steps) say(s, t);
        expect(say(s, 'また来ます').ended, id).toBe(true);
        expect(s.nodeId, id).toBe('leave');
        expect(eco.log.charges, id).toBe(0);
      }
    });
  });

  describe('every shop scenario can be finished by tapping suggestions alone', () => {
    it('with enough cash: the purchase is made and every goal step is done', () => {
      for (const id of ['cafe', 'konbini', 'ramen']) {
        const { s, eco } = start(id);
        tapThrough(s);
        expect(s.ended, id).toBe(true);
        expect(eco.log.purchases, id).toHaveLength(1);
        const sc = scenarioById(id)!;
        // chip 0 is the most direct path; the Wi-Fi question of the café is an optional side step (see the plain test above)
        const missing = sc.steps.map((x) => x.id).filter((x) => !s.stepsDone.has(x));
        expect(missing.filter((x) => x !== 'wifi' && x !== 'tasty' && x !== 'spice'), id).toEqual([]);
        expect(s.stepsDone.has(JP_PACK.scenarioMeta.find((m) => m.id === id)!.shop!.payStep), id).toBe(true);
      }
    });

    it('with too little cash: `short`, then a polite `leave`, no purchase and no pay step', () => {
      for (const id of ['cafe', 'konbini', 'ramen']) {
        const { s, eco } = start(id, { cash: 0, ic: 0 });
        tapThrough(s);
        expect(s.nodeId, id).toBe('leave');
        expect(eco.log.purchases, id).toEqual([]);
        expect(s.stepsDone.has(JP_PACK.scenarioMeta.find((m) => m.id === id)!.shop!.payStep), id).toBe(false);
        expect(s.turns.some((t) => t.speaker === 'character' && t.line.written.includes('足りません')), id).toBe(true);
      }
    });

    it('the station needs no money: it is information only', () => {
      const { s, eco } = start('station', { cash: 0, ic: 0 });
      tapThrough(s);
      expect(s.ended).toBe(true);
      expect(eco.log.charges).toBe(0);
      expect(s.stepsDone.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ramen: the ritual and the ticket route', () => {
    it('いただきます and ごちそうさま are intents of their own (ScenarioMeta.requiredIntents)', () => {
      const { s } = start('ramen');
      say(s, 'みそラーメンをください');
      say(s, 'はい、大丈夫です');
      say(s, 'いただきます！');
      say(s, 'おいしいです');
      say(s, 'ごちそうさまでした');
      const ids = s.turns.filter((t) => t.speaker === 'learner').map((t) => t.intentId);
      expect(ids).toContain('itadakimasu');
      expect(ids).toContain('gochisosama');
      for (const r of JP_PACK.scenarioMeta.find((m) => m.id === 'ramen')!.requiredIntents!) expect(ids).toContain(r.split(':')[1]);
    });

    it('start_ticket: firmness, ritual and thanks, with nothing charged', () => {
      const eco = shopEconomy('ramen', { cash: 0 });
      const s = open('ramen', 'en', [], 'Layla', { game: eco.hooks, flags: { priced: true }, startNode: 'start_ticket' });
      expect(s.nodeId).toBe('start_ticket');
      say(s, 'かためでお願いします');
      say(s, 'はい、大丈夫です');
      say(s, 'いただきます');
      say(s, 'おいしいです');
      expect(say(s, 'ごちそうさまでした').ended).toBe(true);
      expect(eco.log.charges).toBe(0);
      expect(eco.log.purchases).toEqual([]);
    });
  });

  describe('twist: a flag-gated variation that never costs or pays anything', () => {
    it('cafe: no hot drinks today, the drink comes iced, the price is unchanged', () => {
      const { s } = start('cafe', rich, { twist: true });
      say(s, 'コーヒーをください');
      expect(written(s)).toContain('ホットがありません');
      say(s, 'ホットをください');
      expect(written(s)).toContain('アイスですね');
      say(s, 'いいえ、大丈夫です');
      expect(written(s)).toBe(`全部で${yenText(450)}です。現金ですか、カードですか？`);
    });
    it('konbini and ramen change one line and go on', () => {
      const k = start('konbini', rich, { twist: true });
      say(k.s, 'おにぎりをください');
      say(k.s, 'いいえ、大丈夫です');
      expect(written(k.s)).toContain('ICカード');
      const r = start('ramen', rich, { twist: true });
      say(r.s, 'ラーメンをください');
      expect(written(r.s)).toContain('おすすめ');
    });
  });
});

describe('without game hooks the refitted scenarios keep their old fixed prices', () => {
  it('cafe 450, konbini 320, ramen 900, station 190: the same lines as before the refit', () => {
    const c = open('cafe');
    say(c, 'コーヒーをください');
    say(c, 'ホットをください');
    say(c, 'いいえ、大丈夫です');
    expect(written(c)).toBe('全部で四百五十円です。現金ですか、カードですか？');
    const k = open('konbini');
    say(k, 'おにぎりをください');
    expect(written(k)).toBe('ありがとうございます。三百二十円です。袋はいりますか？');
    const r = open('ramen');
    say(r, 'みそラーメンをください');
    say(r, 'はい、大丈夫です');
    say(r, 'いただきます');
    say(r, 'おいしいです');
    say(r, 'お会計をお願いします');
    expect(written(r)).toBe('九百円です。');
    const s = open('station');
    say(s, '新宿へ行きたいです');
    say(s, 'いくらですか');
    expect(written(s)).toBe('百九十円です。');
  });
  it('a hook without the priced flag also shows the old line (the app sets both together)', () => {
    const eco = shopEconomy('cafe', { cash: 5000 });
    const s = open('cafe', 'en', [], 'Layla', { game: eco.hooks });
    say(s, 'ケーキをください');
    say(s, 'いいえ、大丈夫です');
    expect(written(s)).toContain('四百五十円');
  });
  it('without hooks a purchase node ends the conversation and nothing is charged', () => {
    const s = open('cafe');
    tapThrough(s);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect(s.turns.at(-1)!.charged).toBeUndefined();
  });
});

describe('the shop phrasebook reaches the scenarios', () => {
  const drive = (id: string, to: string[], l1: L1 = 'en', extra: Partial<SessionOptions> = {}) => {
    const s = open(id, l1, [], 'Layla', { flags: { priced: true }, game: shopEconomy(id, { cash: 5000, ic: 3000 }).hooks, ...extra });
    for (const t of to) say(s, t);
    return s;
  };
  it('pay by IC card (English and Arabic)', () => {
    for (const [l1, text] of [['en', 'By IC card please'], ['en', 'I will pay with my IC card'], ['ar', 'ببطاقة المواصلات']] as const) {
      const s = drive('konbini', ['おにぎりをください', 'いいえ、大丈夫です'], l1);
      expect(s.nodeId).toBe('payment_a');
      say(s, text);
      expect(s.ended, text).toBe(true);
      expect(s.turns.filter((t) => t.speaker === 'learner').at(-1)!.intentId, text).toBe('pay_ic');
    }
  });
  it('how much is {item}, two please, no bag, a present, extras, firmness, cheaper, come again', () => {
    const k = drive('konbini', ['How much is the water?']);
    expect(k.nodeId).toBe('found_price');
    expect(written(k)).toBe(`${yenText(110)}です。`);
    say(k, 'Two please');
    expect(k.nodeId).toBe('register');
    expect(written(k)).toContain(yenText(220));
    say(k, 'I do not need a bag');
    expect(k.nodeId).toBe('payment_a');

    const g = drive('konbini', ['I am looking for a present']);
    expect(g.nodeId).toBe('goods');
    say(g, 'Chocolate please');
    expect(g.nodeId).toBe('register');
    expect(written(g)).toContain(yenText(220));
    expect(drive('konbini', ['I am looking for a gift']).nodeId).toBe('goods');
    expect(drive('konbini', ['أبحث عن هدية'], 'ar').nodeId).toBe('goods');

    const r = drive('ramen', ['Miso ramen please', 'Yes spicy is fine', 'Extra egg please', 'Extra noodles please']);
    expect(r.turns.filter((t) => t.speaker === 'learner').map((t) => t.intentId)).toEqual(['order_flavor', 'spicy_ok', 'add_extra', 'add_extra']);
    const t = drive('ramen', ['Firm please'], 'en', { startNode: 'start_ticket' });
    expect(t.nodeId).toBe('spicy_t');

    const c = drive('cafe', ['Latte please', 'Hot please', 'No thanks, that is all', 'Cash please'], 'en', { game: shopEconomy('cafe', { cash: 100 }).hooks });
    expect(c.nodeId).toBe('short');
    say(c, 'Do you have something cheaper?');
    expect(c.nodeId).toBe('cheaper');
    say(c, 'I will come again');
    expect(c.nodeId).toBe('leave');
    const d = drive('cafe', ['Latte please', 'Hot please', 'No thanks, that is all', 'I will think about it']);
    expect(d.nodeId).toBe('leave');
  });
});
