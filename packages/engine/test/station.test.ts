// station_ic and sato_directions (agent 2G, docs/GAME_DESIGN.md §6.3, §6.8): every chip is understood at every node, with and without
// game hooks and with enough cash and too little, each scenario can be finished by tapping chips alone, every pocket line and every
// phrasebook line of the station module is language one of its intents accepts. The real hooks (icHooks, with the reducer behind them)
// are tested in apps/mobile/test/panels.test.ts; the stub here prices nothing but answers the same three questions.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, SLOTS, scenarioById, tokenize, LEXICON, plainText, yenToJa, type L1, type Scenario, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, matchNodeIntent, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { STATION_IC_POCKETS, STATION_POCKETS } from '../../content/src/tokyo/game/pockets/pockets-station';
import { STATION_PHRASES } from '../../content/src/phrasebook/station';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'Layla', topics: [], now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** A counter with a purse: cash buys the card (500) and loads it; the card holds `cap`; a refund needs a balance above the fee. */
function counter(cash: number, opts: { ic?: number; cap?: number; hasCard?: boolean } = {}) {
  const log = { charges: [] as string[], refused: 0 };
  const state = { cash, ic: opts.ic ?? 0, card: opts.hasCard ?? false };
  const cap = opts.cap ?? 3000;
  const amountOf = (s: Record<string, string>) => Number(s.chargeAmount ?? 0);
  const hooks: SessionGameHooks = {
    vars(slots) {
      const v: Vars = { price: money(500), limit: money(cap), fee: money(220), balance: money(Math.max(1, state.ic)) };
      const a = amountOf(slots);
      if (a) v.total = money(a + (state.card ? 0 : 500));
      return v;
    },
    intent: (_kind, ctx) => ({ ok: amountOf(ctx.slotIds) <= cap - state.ic }),
    charge(slots) {
      if (slots.icService === 'refund') {
        if (state.ic <= 220) return { ok: false };
        log.charges.push('refund');
        state.cash += state.ic - 220;
        state.ic = 0;
        return { ok: true };
      }
      const a = amountOf(slots);
      const need = a + (state.card ? 0 : 500);
      if (!a || state.cash < need || a > cap - state.ic) {
        log.refused++;
        return { ok: false };
      }
      log.charges.push(state.card ? 'topup' : 'card+topup');
      state.cash -= need;
      state.ic += a;
      state.card = true;
      return { ok: true };
    },
  };
  return { hooks, log, state };
}

/** Picks every suggestion at every reachable node; the character must always understand it (the session test of §15.9). */
function walk(sc: Scenario, l1: L1, mk: () => Partial<SessionOptions> = () => ({})) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(sc.id, l1, mk());
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
      if (r.character.line.tokens.some((tk) => tk.s === '…')) problems.push(`${sc.id}/${s.nodeId}/#${i}: Sato's answer has an unresolved variable`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: visited.size };
}

/** Taps the first chip until the conversation ends. */
function tapThrough(s: ConversationSession): void {
  let guard = 0;
  while (!s.ended && guard++ < 30) s.pickSuggestion(0);
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

describe('station_ic and sato_directions: every chip is understood', () => {
  const modes: Array<[string, () => Partial<SessionOptions>]> = [
    ['without hooks', () => ({})],
    ['with hooks, plenty of cash', () => ({ game: counter(5000).hooks, flags: { priced: true } })],
    ['with hooks, a full card (the cap node)', () => ({ game: counter(5000, { ic: 2500, hasCard: true }).hooks, flags: { priced: true } })],
    ['with hooks, almost no cash (the short node)', () => ({ game: counter(100).hooks, flags: { priced: true } })],
  ];
  for (const id of ['station_ic', 'sato_directions']) {
    for (const [label, mk] of modes) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${id} ${label} (${l1})`, () => {
          const { problems, nodes } = walk(scenarioById(id)!, l1, mk);
          expect(problems).toEqual([]);
          expect(nodes).toBeGreaterThan(2);
        });
      }
    }
  }
});

describe('station_ic by tapping chips alone', () => {
  it('buys the card and loads it: want, amount and pay are done, the charge ran once', () => {
    const c = counter(3000);
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    tapThrough(s);
    expect([...s.stepsDone].sort()).toEqual(['amount', 'pay', 'want']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual(['card+topup']);
    expect(c.state).toEqual({ cash: 3000 - 500 - 1000, ic: 1000, card: true });
  });

  it('the explanation names the deposit and the total includes it', () => {
    const c = counter(3000);
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(0); // an IC card, please
    expect(s.nodeId).toBe('explain');
    expect(written(s)).toContain(yenToJa(500).markup.replace(/\|/g, ''));
    s.pickSuggestion(0); // I understand
    s.pickSuggestion(0); // 1,000 yen
    expect(s.nodeId).toBe('quote');
    expect(written(s)).toContain(`${yenToJa(1500).markup.replace(/\|/g, '')}です`);
  });

  it('a player who has the card is quoted the top-up alone', () => {
    const c = counter(3000, { hasCard: true });
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(1); // top up
    expect(s.nodeId).toBe('amount');
    s.pickSuggestion(1); // 2,000 yen
    expect(written(s)).toContain(`${yenToJa(2000).markup.replace(/\|/g, '')}です`);
    s.pickSuggestion(0); // cash, please
    expect(s.ended).toBe(true);
    expect(c.state.cash).toBe(1000);
    expect(c.state.ic).toBe(2000);
  });

  it('typed Japanese and romaji work at the same nodes', () => {
    const c = counter(3000, { hasCard: true });
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    expect(s.submit({ text: '千円チャージをお願いします', mode: 'typed_ja' }).learner.matched).toBe(true);
    expect(s.nodeId).toBe('amount');
    expect(s.submit({ text: '二千円お願いします', mode: 'typed_ja' }).learner.matched).toBe(true);
    expect(s.nodeId).toBe('quote');
    expect(s.vars.chargeAmount.ja).toBe('二|千|円');
    expect(s.submit({ text: '現金でお願いします', mode: 'typed_ja' }).ended).toBe(true);
    expect(c.state.ic).toBe(2000);
  });

  it('too little cash: the charge refuses, Sato says so, nothing is taken and the way out is the taught polite refusal', () => {
    const c = counter(300);
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(0);
    s.pickSuggestion(0);
    s.pickSuggestion(0);
    s.pickSuggestion(0); // cash, please: 1,500 needed
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(false);
    expect(s.stepsDone.has('pay')).toBe(false);
    expect(c.log.charges).toEqual([]);
    expect(c.state).toEqual({ cash: 300, ic: 0, card: false });
    expect(s.suggestions()[0].written).toBe('また来ます。');
    s.pickSuggestion(0);
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['amount', 'want'].sort());
  });

  it('a top-up the card cannot hold sends the learner to the cap node, not to the quote', () => {
    const c = counter(5000, { ic: 2500, hasCard: true });
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(1); // top up
    s.pickSuggestion(0); // 1,000 yen: 2,500 + 1,000 > 3,000
    expect(s.nodeId).toBe('over');
    expect(written(s)).toContain(yenToJa(3000).markup.replace(/\|/g, ''));
    expect(s.stepsDone.has('amount')).toBe(false);
    expect(c.log.charges).toEqual([]);
    // a smaller amount fits? 2,500 + 1,000 does not; the way out is the polite refusal
    s.pickSuggestion(0);
    expect(s.nodeId).toBe('leave');
  });

  it('the refund branch pays the balance back and is never a goal step', () => {
    const c = counter(1000, { ic: 1500, hasCard: true });
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(2); // a refund, please
    expect(s.nodeId).toBe('refund_ask');
    expect(written(s)).toContain(yenToJa(1500).markup.replace(/\|/g, ''));
    expect(written(s)).toContain(yenToJa(220).markup.replace(/\|/g, ''));
    s.pickSuggestion(0); // please
    expect(s.nodeId).toBe('refund_done');
    expect(s.ended).toBe(true);
    expect(s.stepsDone.size).toBe(0);
    expect(c.log.charges).toEqual(['refund']);
    expect(c.state.cash).toBe(1000 + 1500 - 220);
    expect(c.state.ic).toBe(0);
  });

  it('a refund of nothing is refused politely (an empty card has no balance above the fee)', () => {
    const c = counter(1000, { ic: 100, hasCard: true });
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(2);
    s.pickSuggestion(0);
    expect(s.nodeId).toBe('refund_none');
    expect(s.ended).toBe(false);
    s.pickSuggestion(0);
    expect(s.nodeId).toBe('leave');
    expect(c.state.ic).toBe(100);
  });

  it('without hooks nothing is charged and the fixed wording shows (a session that does not set flags.priced)', () => {
    const s = open('station_ic');
    s.pickSuggestion(0);
    expect(written(s)).toContain('五百円');
    s.pickSuggestion(0);
    s.pickSuggestion(0);
    expect(written(s)).toContain('千円');
    s.pickSuggestion(0);
    expect(s.ended).toBe(true);
    expect(s.stepsDone.has('pay')).toBe(true);
  });

  it('paying with the card or the IC card at the counter gets a gentle cash-only answer', () => {
    const c = counter(3000, { hasCard: true });
    const s = open('station_ic', 'en', { game: c.hooks, flags: { priced: true } });
    s.pickSuggestion(1);
    s.pickSuggestion(0);
    const r = s.submit({ text: 'カードでお願いします', mode: 'typed_ja' });
    expect(r.learner.matched).toBe(true);
    expect(s.nodeId).toBe('quote');
    expect(written(s)).toContain('現金だけ');
  });
});

describe('sato_directions by tapping chips alone', () => {
  it('asks, says the direction back and thanks: ask, repeat and thanks are done', () => {
    const s = open('sato_directions');
    tapThrough(s);
    expect([...s.stepsDone].sort()).toEqual(['ask', 'repeat', 'thanks']);
    expect(s.ended).toBe(true);
  });

  it('each place has its direction, and the right word is the one that counts', () => {
    const cases: Array<[string, string, string, string]> = [
      ['出口はどこですか', '右', '左', 'dir_right'],
      ['トイレはどこですか', '左', '右', 'dir_left'],
      ['ホームはどこですか', 'まっすぐ', '右', 'dir_straight'],
      ['改札はどこですか', 'まっすぐ', '左', 'dir_straight'],
      ['券売機はどこですか', '右', 'まっすぐ', 'dir_right'],
    ];
    for (const [ask, right, wrong, node] of cases) {
      const s = open('sato_directions');
      expect(s.submit({ text: ask, mode: 'typed_ja' }).learner.matched, ask).toBe(true);
      expect(s.nodeId, ask).toBe(node);
      expect(written(s), ask).toContain(right);
      // a wrong direction is corrected in place, and earns nothing
      const bad = s.submit({ text: `${wrong}ですね`, mode: 'typed_ja' });
      expect(bad.learner.matched, ask).toBe(true);
      expect(s.nodeId, ask).toBe(node);
      expect(s.stepsDone.has('repeat'), ask).toBe(false);
      expect(written(s), ask).toContain(right);
      // the right one moves on
      s.submit({ text: `${right}ですね`, mode: 'typed_ja' });
      expect(s.nodeId, ask).toBe('ok');
      expect(s.stepsDone.has('repeat'), ask).toBe(true);
    }
  });

  it('works in English and Arabic via "say it your way"', () => {
    for (const [text, l1] of [['Where is the toilet?', 'en'], ['أين الحمام؟', 'ar']] as const) {
      const s = open('sato_directions', l1);
      expect(say(s, text).learner.matched, text).toBe(true);
      expect(s.nodeId, text).toBe('dir_left');
      expect(say(s, l1 === 'en' ? 'On the left' : 'على اليسار').learner.matched, text).toBe(true);
      expect(s.nodeId, text).toBe('ok');
    }
  });

  it('station_ic: a request in English or Arabic gets the same service', () => {
    for (const [text, node, l1] of [['A refund please', 'refund_ask', 'en'], ['Please top up my card', 'amount', 'en'], ['اشحن البطاقة من فضلك', 'amount', 'ar'], ['An IC card please', 'explain', 'en']] as const) {
      const s = open('station_ic', l1, { game: counter(3000, { ic: 1500, hasCard: true }).hooks, flags: { priced: true } });
      expect(say(s, text).learner.matched, text).toBe(true);
      expect(s.nodeId, text).toBe(node);
    }
  });
});

describe('the language of the station module is language its scenarios accept', () => {
  const scenarios = ['station_ic', 'sato_directions'].map((id) => scenarioById(id)!);
  const accepted = (text: string): boolean => scenarios.some((sc) => Object.values(sc.nodes).some((n) => !n.end && matchNodeIntent(n, text) !== null));
  const written2 = (markup: string) => plainText(tokenize(markup, LEXICON).tokens);

  it('every pocket line (sato_directions, and the proposal for station_ic) is matched by an intent', () => {
    const bad = Object.values({ ...STATION_POCKETS, ...STATION_IC_POCKETS })
      .filter((p) => !accepted(written2(p.line.ja)))
      .map((p) => p.id);
    expect(bad).toEqual([]);
  });

  it('every pocket line has the English and the Arabic and is spelled with lexicon words', () => {
    for (const p of Object.values({ ...STATION_POCKETS, ...STATION_IC_POCKETS })) {
      expect(p.line.en.trim() && p.line.ar.trim(), p.id).toBeTruthy();
      expect(tokenize(p.line.ja, LEXICON).missing, p.id).toEqual([]);
    }
  });

  it('ScenarioMeta names exactly those pocket lines', () => {
    const named = JP_PACK.scenarioMeta.filter((m) => m.id === 'station_ic' || m.id === 'sato_directions').flatMap((m) => m.pocket ?? []);
    expect(named.sort()).toEqual(Object.keys({ ...STATION_POCKETS, ...STATION_IC_POCKETS }).sort());
  });

  it('every phrasebook line of the module is accepted at some node (the translator only offers Japanese the scenario understands)', () => {
    const bad = STATION_PHRASES.filter((p) => !p.ja.includes('{') && !accepted(written2(p.ja))).map((p) => p.id);
    // わかりました belongs to the explain and refund nodes: it is accepted there
    expect(bad).toEqual([]);
  });

  it('the new slots are the ones the scenarios use, each option with keys in three scripts', () => {
    for (const name of ['icService', 'stationSpot', 'direction']) {
      expect(SLOTS[name], name).toBeTruthy();
      for (const o of SLOTS[name]) expect(o.keys.ja.length && o.keys.en.length && o.keys.ar.length, `${name}/${o.id}`).toBeTruthy();
    }
    expect(SLOTS.icService.map((o) => o.id)).toEqual(['card', 'charge', 'refund']);
    expect(SLOTS.direction.map((o) => o.id)).toEqual(['right', 'left', 'straight']);
  });
});
