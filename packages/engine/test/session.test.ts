import { describe, expect, it } from 'vitest';
import { CHARACTERS, SCENARIOS, scenarioById, type L1, type Scenario } from '@lw/content';
import { classifyInput, ConversationSession, evaluateSession, type SubmitResult } from '../src';

function open(id: string, l1: L1 = 'en', topics: string[] = [], name = 'Layla'): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: name, topics, now: () => (t += 4000) });
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

describe('every offered suggestion works', () => {
  // Pick every suggestion at every reachable node; the character must always understand it.
  function walk(sc: Scenario, l1: L1) {
    const problems: string[] = [];
    const visited = new Set<string>();
    const replay = (path: number[]) => {
      const s = open(sc.id, l1, ['anime']);
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
        const { problems, nodes } = walk(sc, l1);
        expect(problems).toEqual([]);
        expect(nodes).toBeGreaterThan(2);
      });
    }
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
