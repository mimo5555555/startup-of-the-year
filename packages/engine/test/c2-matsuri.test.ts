// Release 2 wave C2 (docs/GAME_DESIGN.md §7.2 Chapter 7): the festival conversations. matsuri_stalls (Kenji's stall row): every chip is understood
// at every node, it is completable by tapping alone, typed Japanese, romaji, English and Arabic work, the stalls take cash only (a card is a kind
// "cash only", never a charge), one purchase charges exactly once and running short charges nothing. matsuri_speech (the capstone): the five
// slots in order, and in Real mode (the learner types; no chip is ever shown) all five lines are class I, a Hint makes its line class S.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, buildConversationFacts, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { MATSURI_PHRASES } from '../../content/src/phrasebook/matsuri';
import { MATSURI_PRICES } from '../../content/src/tokyo/scenarios-story';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

/** Kenji's stall with a purse: the price of the picked food, `charge` refuses what the purse cannot pay and records the method. */
function stall(cash: number) {
  const log = { charges: [] as Array<{ item: string; method: string }>, refused: 0 };
  let picked = 'takoyaki';
  const hooks: SessionGameHooks = {
    vars: (slots) => {
      picked = slots?.yatai ?? picked;
      const yen = MATSURI_PRICES[picked] ?? 0;
      return { price: money(yen), total: money(yen) };
    },
    charge(slots) {
      const yen = MATSURI_PRICES[slots.yatai ?? ''] ?? 0;
      if (cash < yen) {
        log.refused++;
        return { ok: false };
      }
      log.charges.push({ item: slots.yatai ?? '', method: slots.payMethod ?? 'cash' });
      cash -= yen;
      return { ok: true };
    },
  };
  return { hooks, log, cash: () => cash };
}

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
};

function tap(s: ConversationSession, parts: string[]): void {
  for (const part of parts) {
    const i = s.suggestions().findIndex((x) => x.written.includes(part));
    if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
    s.pickSuggestion(i);
  }
}

/** Picks every suggestion at every reachable node; the character must always understand it and answer with displayable Japanese. */
function walk(id: string, l1: L1, mk: () => Partial<SessionOptions>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(id, l1, mk());
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    const sugg = s.suggestions();
    if (sugg.length < 2) problems.push(`${s.nodeId}: fewer than 2 suggestions`);
    sugg.forEach((sg, i) => {
      if (sg.tokens.some((t) => t.s === '…' && !t.punct)) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i} "${sg.written}": the answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, visited };
}

const WALK_TIMEOUT = 60000;
const STALLS = 'matsuri_stalls';
const SPEECH = 'matsuri_speech';

// ------------------------------------------------------------------------------------------------------------------------------------
describe('matsuri_stalls: every chip is understood', () => {
  const modes: Array<[string, () => Partial<SessionOptions>]> = [
    ['without hooks', () => ({})],
    ['with hooks, plenty of cash', () => ({ game: stall(50000).hooks, flags: { priced: true } })],
    ['with hooks, almost no cash', () => ({ game: stall(100).hooks, flags: { priced: true } })],
  ];
  for (const [label, mk] of modes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const { problems, visited } = walk(STALLS, l1, mk);
        expect(problems).toEqual([]);
        const nodes = new Set([...visited].map((k) => k.split('|')[0]));
        // with almost no cash the till leads to `short` (nothing charged) instead of `served`
        for (const n of ['start', 'menu', 'reco', 'quote', label.includes('no cash') ? 'short' : 'served']) expect(nodes.has(n), n).toBe(true);
      });
    }
  }
}, WALK_TIMEOUT);

describe('matsuri_stalls: tapping, cash only, one charge', () => {
  it('enjoying, yakisoba, here you go, thanks: every goal step, one cash charge of the right food', () => {
    const c = stall(50000);
    const s = open(STALLS, 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['楽しい', '焼きそば', 'どうぞ']);
    expect(s.nodeId).toBe('served');
    tap(s, ['いただきます']);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['greet', 'order', 'pay', 'thanks']);
    expect(c.log.charges).toEqual([{ item: 'yakisoba', method: 'cash' }]);
    expect(c.cash()).toBe(50000 - MATSURI_PRICES.yakisoba!);
  });

  it('a card is not taken: Kenji says cash only, nothing is charged, and cash then pays once', () => {
    const c = stall(50000);
    const s = open(STALLS, 'ar', { game: c.hooks, flags: { priced: true } });
    tap(s, ['たこ焼き']);
    expect(s.nodeId).toBe('quote');
    tap(s, ['カード']);
    expect(s.nodeId).toBe('quote');
    expect(c.log.charges).toEqual([]);
    say(s, 'ICカードでお願いします');
    expect(s.nodeId).toBe('quote');
    expect(c.log.charges).toEqual([]);
    tap(s, ['現金']);
    expect(s.nodeId).toBe('served');
    expect(c.log.charges).toEqual([{ item: 'takoyaki', method: 'cash' }]);
  });

  it('too little cash charges nothing and leaves the polite way out', () => {
    const c = stall(100);
    const s = open(STALLS, 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['楽しい', 'かき氷', 'どうぞ']);
    expect(s.nodeId).toBe('short');
    expect(c.log.charges).toEqual([]);
    expect(s.stepsDone.has('pay')).toBe(false);
    tap(s, ['また']);
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect(c.cash()).toBe(100);
  });

  it('the recommendation leads to takoyaki; the fixed-price fallback names the right price without hooks', () => {
    const s = open(STALLS, 'en');
    tap(s, ['おすすめ']);
    expect(s.nodeId).toBe('reco');
    const r = s.pickSuggestion(s.suggestions().findIndex((x) => x.written.includes('たこ焼き')));
    expect(r.character.line.written).toContain(yenToJa(MATSURI_PRICES.takoyaki!).markup.replace(/\|/g, ''));
  });
});

describe('matsuri_stalls: typed language (3+ lines of your own)', () => {
  const play = (lines: string[], l1: L1 = 'en') => {
    const c = stall(50000);
    const s = open(STALLS, l1, { game: c.hooks, flags: { priced: true } });
    for (const l of lines) expect(say(s, l).learner.matched, l).toBe(true);
    return { s, c };
  };
  it('Japanese: four lines of the learner\'s own, all class I', () => {
    const { s, c } = play(['はい、とても楽しいです', 'りんご飴をください', '現金でお願いします', 'ありがとうございます']);
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([{ item: 'ringoame', method: 'cash' }]);
    expect(s.summary().independentTurns).toBe(4);
  });
  it('romaji', () => {
    const { s, c } = play(['hai tanoshii desu', 'takoyaki wo kudasai', 'hai douzo', 'itadakimasu']);
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([{ item: 'takoyaki', method: 'cash' }]);
  });
  it('English and Arabic go through the phrasebook (assisted)', () => {
    const en = play(['yakisoba please', 'cash please', 'thank you']);
    expect(en.s.ended).toBe(true);
    expect(en.c.log.charges).toEqual([{ item: 'yakisoba', method: 'cash' }]);
    const ar = play(['تاكوياكي من فضلك', 'نقدا من فضلك', 'شكرا'], 'ar');
    expect(ar.s.ended).toBe(true);
    expect(ar.c.log.charges).toEqual([{ item: 'takoyaki', method: 'cash' }]);
  });
  it('a wrong answer gets the gentle fallback and the stall stays where it was', () => {
    const c = stall(50000);
    const s = open(STALLS, 'en', { game: c.hooks, flags: { priced: true } });
    const r = say(s, '電車');
    expect(r.character.kind).toBe('fallback');
    expect(s.nodeId).toBe('start');
  });
});

// ------------------------------------------------------------------------------------------------------------------------------------
describe('matsuri_speech: the capstone', () => {
  for (const l1 of ['en', 'ar'] as const) {
    it(`every chip is understood (the one-time Guided fallback and the rehearsal), ${l1}`, () => {
      const { problems, visited } = walk(SPEECH, l1, () => ({}));
      expect(problems).toEqual([]);
      const nodes = new Set([...visited].map((k) => k.split('|')[0]));
      for (const n of ['start', 'country', 'hobby', 'town', 'thanks']) expect(nodes.has(n), n).toBe(true);
    }, WALK_TIMEOUT);
  }

  it('Real mode: the five slots typed in order, assembled into the target speech, all five lines class I and substantive', () => {
    const s = open(SPEECH, 'en');
    for (const l of ['はじめまして。レイラです。', 'エジプトから来ました。', '音楽が好きです。', '桜町はとてもいい町です。', 'ありがとうございました。']) expect(say(s, l).learner.matched, l).toBe(true);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['country', 'hobby', 'name', 'thanks', 'town']);
    const facts = buildConversationFacts(s, { mode: 'real', prepared: false });
    expect(facts.turns.filter((t) => t.cls === 'I' && t.substantive)).toHaveLength(5);
  });

  it('a Hint (Real mode keeps it) makes that line class S: it does not count toward minIndependent', () => {
    const s = open(SPEECH, 'en');
    say(s, 'はじめまして。レイラです。');
    const h = s.hint()!;
    const hinted = say(s, h.written);
    expect(hinted.learner.matched).toBe(true);
    expect(hinted.learner.hintOpened).toBe(true);
    for (const l of ['音楽が好きです。', '桜町が大好きです。', 'ありがとうございました。']) say(s, l);
    expect(s.ended).toBe(true);
    const cls = buildConversationFacts(s, { mode: 'real', prepared: false }).turns.map((t) => t.cls);
    expect(cls).toEqual(['I', 'S', 'I', 'I', 'I']);
  });

  it('romaji, and a bare はじめまして asks for the name instead of skipping the slot', () => {
    const s = open(SPEECH, 'en');
    const r = say(s, 'はじめまして');
    expect(s.nodeId).toBe('start');
    expect(r.character.line.written).toContain('名前');
    for (const l of ['reira desu', 'amerika kara kimashita', 'anime ga suki desu', 'sakurachou wa totemo ii machi desu', 'arigatou gozaimashita']) expect(say(s, l).learner.matched, l).toBe(true);
    expect(s.ended).toBe(true);
  });

  it('the learner\'s own country and hobby when they are not listed (review: サッカー, ダンス, 読書 stayed on 「もう一度」 for ever)', () => {
    for (const lines of [
      ['山田です。', 'インドネシアから来ました。', 'サッカーが好きです。', '桜町が大好きです。', 'ありがとうございました。'],
      ['samu desu', 'pakisutan kara kimashita', 'dansu ga suki desu', 'sakurachou wa totemo ii machi desu', 'arigatou gozaimashita'],
      ['わたしはアフメドです。', 'ブラジルから来ました。', '趣味は読書です。', 'いい町です。', '皆さん、ありがとうございました。'],
    ]) {
      const s = open(SPEECH, 'en');
      for (const l of lines) expect(say(s, l).learner.matched, l).toBe(true);
      expect(s.ended, lines[2]).toBe(true);
      expect(buildConversationFacts(s, { mode: 'real', prepared: false }).turns.filter((t) => t.cls === 'I' && t.substantive)).toHaveLength(5);
    }
    // romaji is the learner's own Japanese, never a translation (review: 'arigatou gozaimashita' was an English key of the jobs phrasebook)
    for (const r of ['arigatou gozaimashita', 'irasshaimase', 'omatase shimashita', 'itadakimasu', 'Itadakimasu.', 'Arigatou gozaimashita.']) expect(classifyInput(r).kind, r).toBe('romaji');
    // a listed hobby is still the slot's; the town is not a hobby
    const s = open(SPEECH, 'en');
    say(s, 'レイラです。');
    say(s, 'エジプトから来ました。');
    expect(say(s, '桜町が好きです。').learner.matched).toBe(false);
    expect(say(s, '音楽が好きです。').learner.intentId).toBe('hobby');
  });

  it('English and Arabic are assisted lines (translation): understood, never independent', () => {
    const s = open(SPEECH, 'ar');
    for (const l of ['انا ليلى', 'جئت من مصر', 'أحب الموسيقى', 'ساكورا تشو مدينة جميلة جدا', 'شكرا جزيلا']) expect(say(s, l).learner.matched, l).toBe(true);
    expect(s.ended).toBe(true);
    expect(buildConversationFacts(s, { mode: 'real', prepared: false }).turns.map((t) => t.cls)).toEqual(['T', 'T', 'T', 'T', 'T']);
  });
});

describe('the festival phrasebook', () => {
  it('every entry is language one of the two festival scenarios accepts somewhere', () => {
    for (const p of MATSURI_PHRASES) {
      const ja = p.ja.replace(/\|/g, '');
      const ok = [STALLS, SPEECH].some((id) => {
        const scenario = scenarioById(id)!;
        return Object.values(scenario.nodes).filter((n) => !n.end).map((n) => n.id).some((n) => {
          const s = open(id, 'en', { startNode: n });
          const text = ja.replace('{name}', 'レイラ').replace('{yatai}', 'たこ焼き').replace('{country}', 'エジプト');
          return s.submit({ text, mode: 'typed_ja' }).learner.matched;
        });
      });
      expect(ok, p.id).toBe(true);
    }
  });
});
