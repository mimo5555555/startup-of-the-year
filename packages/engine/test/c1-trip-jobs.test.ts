// Release 2 wave C1 (docs/GAME_DESIGN.md §6.5, §9.1): the conversation of the Hikarigaoka trip (trip_hikarigaoka, Kato) and the two job intros
// (jobintro_cafe with Yuki, jobintro_station with Sato). Every chip is understood at every node, each is completable by tapping alone, the typed
// language works in Japanese, romaji, English and Arabic, a wrong answer gets a gentle fallback, a purchase charges exactly once and running
// short of cash charges nothing and leaves a way out, and every pocket and phrasebook line of the module is language an intent accepts.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { TRIP_PHRASES } from '../../content/src/phrasebook/trip';
import { KATO_PRICES } from '../../content/src/tokyo/scenarios-story';

const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

/** Kato's counter with a purse: the one price of his shop, `charge` refuses what the purse cannot pay. */
function counter(cash: number) {
  const log = { charges: [] as Array<{ item: string; method: string }>, refused: 0 };
  const hooks: SessionGameHooks = {
    vars: () => ({ price: money(KATO_PRICES.souvenir!), total: money(KATO_PRICES.souvenir!) }),
    charge(slots) {
      if (cash < KATO_PRICES.souvenir!) {
        log.refused++;
        return { ok: false };
      }
      log.charges.push({ item: slots.giftItem ?? '', method: slots.payMethod ?? 'cash' });
      cash -= KATO_PRICES.souvenir!;
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

// ------------------------------------------------------------------------------------------------------------------------------------
// trip_hikarigaoka
// ------------------------------------------------------------------------------------------------------------------------------------

const TRIP = 'trip_hikarigaoka';
const tripModes: Array<[string, () => Partial<SessionOptions>]> = [
  ['without hooks', () => ({})],
  ['with hooks, plenty of cash', () => ({ game: counter(50000).hooks, flags: { priced: true } })],
  ['with hooks, almost no cash', () => ({ game: counter(100).hooks, flags: { priced: true } })],
];

describe('trip_hikarigaoka: every chip is understood', () => {
  for (const [label, mk] of tripModes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const { problems, visited } = walk(TRIP, l1, mk);
        expect(problems).toEqual([]);
        const nodes = new Set([...visited].map((k) => k.split('|')[0]));
        for (const n of ['start', 'town', 'reco', 'where', 'quote']) expect(nodes.has(n), n).toBe(true);
      });
    }
  }
}, WALK_TIMEOUT);

describe('trip_hikarigaoka: by tapping chips alone', () => {
  it('greet, ask what he recommends, buy the souvenir by IC card: every goal step done, one charge, the right item and method', () => {
    const c = counter(50000);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['電車', 'おすすめ']);
    expect(s.nodeId).toBe('reco');
    tap(s, ['お土産', 'ICカード']);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['ask', 'greet', 'pay', 'souvenir']);
    expect(s.summary().goalDone).toBe(4);
    expect(c.log.charges).toEqual([{ item: 'souvenir', method: 'ic' }]);
    expect(c.cash()).toBe(49000);
  });

  it('ask where the park is, then pay cash', () => {
    const c = counter(50000);
    const s = open(TRIP, 'ar', { game: c.hooks, flags: { priced: true } });
    tap(s, ['電車', '公園']);
    expect(s.nodeId).toBe('where');
    tap(s, ['お土産', '現金']);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual([{ item: 'souvenir', method: 'cash' }]);
  });

  it('too little money charges nothing, says so politely and leaves the way out (考えます / また来ます), the steps done so far kept', () => {
    const c = counter(100);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['電車', 'おすすめ', 'お土産', '現金']);
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(false);
    expect(c.log.charges).toEqual([]);
    expect(c.log.refused).toBe(1);
    expect(s.stepsDone.has('pay')).toBe(false);
    expect(s.stepsDone.has('souvenir')).toBe(true);
    tap(s, ['また']);
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([]);
    expect(c.cash()).toBe(100);
  });

  it('the polite way out at the first node and at the offer ends at leave with nothing charged', () => {
    const c = counter(50000);
    const a = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    tap(a, ['また来ます']);
    expect(a.nodeId).toBe('leave');
    const b = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    tap(b, ['おすすめ', '考えます']);
    expect(b.nodeId).toBe('leave');
    expect(c.log.charges).toEqual([]);
  });

  it('the visit needs no purchase: just looking keeps the offer open, and a quote asked for twice is not a charge', () => {
    const c = counter(50000);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['おすすめ']);
    tap(s, ['見ている']);
    expect(s.nodeId).toBe('reco');
    tap(s, ['お土産']);
    expect(s.nodeId).toBe('quote');
    say(s, 'いくらですか');
    expect(s.nodeId).toBe('quote');
    expect(c.log.charges).toEqual([]);
  });
});

describe('trip_hikarigaoka: typed language', () => {
  it('hiragana and kanji-free Japanese', () => {
    const c = counter(50000);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'はい、電車で来ました').learner.matched).toBe(true);
    expect(s.nodeId).toBe('town');
    expect(say(s, '公園はどこですか').learner.matched).toBe(true);
    expect(s.nodeId).toBe('where');
    expect(say(s, 'おみやげをください').learner.matched).toBe(true);
    expect(s.nodeId).toBe('quote');
    expect(say(s, '現金でお願いします').learner.matched).toBe(true);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual([{ item: 'souvenir', method: 'cash' }]);
  });

  it('romaji', () => {
    const c = counter(50000);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'hai densha de kimashita').learner.matched).toBe(true);
    expect(s.nodeId).toBe('town');
    expect(say(s, 'osusume wa nan desu ka').learner.matched).toBe(true);
    expect(s.nodeId).toBe('reco');
    expect(say(s, 'omiyage o kudasai').learner.matched).toBe(true);
    expect(s.nodeId).toBe('quote');
    expect(say(s, 'genkin de onegaishimasu').learner.matched).toBe(true);
    expect(s.nodeId).toBe('done');
  });

  it('English sentences the phrasebook knows', () => {
    const c = counter(50000);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'yes i came by train').learner.matched).toBe(true);
    expect(s.nodeId).toBe('town');
    expect(say(s, 'where is the park').learner.matched).toBe(true);
    expect(s.nodeId).toBe('where');
    expect(say(s, 'a souvenir please').learner.matched).toBe(true);
    expect(s.nodeId).toBe('quote');
    expect(say(s, 'by ic card').learner.matched).toBe(true);
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toEqual([{ item: 'souvenir', method: 'ic' }]);
  });

  it('Arabic sentences the phrasebook knows', () => {
    const c = counter(50000);
    const s = open(TRIP, 'ar', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'نعم جئت بالقطار').learner.matched).toBe(true);
    expect(s.nodeId).toBe('town');
    expect(say(s, 'ماذا تنصح').learner.matched).toBe(true);
    expect(s.nodeId).toBe('reco');
    expect(say(s, 'هدية تذكارية من فضلك').learner.matched).toBe(true);
    expect(s.nodeId).toBe('quote');
  });

  it('a credit card is refused politely (he takes cash or IC), nothing is charged, and cash then works', () => {
    const c = counter(50000);
    const s = open(TRIP, 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['おすすめ', 'お土産']);
    say(s, 'カードでお願いします');
    expect(s.nodeId).toBe('quote');
    expect(c.log.charges).toEqual([]);
    say(s, '現金でお願いします');
    expect(s.nodeId).toBe('done');
    expect(c.log.charges).toHaveLength(1);
  });

  it('naming a present of another shop (the shared giftItem slot) does not start a sale', () => {
    const s = open(TRIP, 'en', { game: counter(50000).hooks, flags: { priced: true } });
    tap(s, ['おすすめ']);
    say(s, 'マンガをください');
    expect(s.nodeId).not.toBe('quote');
    expect(s.ended).toBe(false);
  });

  it('an unrelated sentence gets a gentle fallback, never an error, and the chips stay', () => {
    const s = open(TRIP);
    const r = say(s, '天気がいいです');
    expect(r.character.line.written.length).toBeGreaterThan(0);
    expect(s.ended).toBe(false);
    expect(s.suggestions().length).toBeGreaterThanOrEqual(2);
  });

  it('without game hooks the fixed price (千円) is said and the scenario still completes', () => {
    const s = open(TRIP);
    tap(s, ['おすすめ', 'お土産']);
    expect(s.turns[s.turns.length - 1]!.line.written).toContain('千');
    tap(s, ['現金']);
    expect(s.nodeId).toBe('done');
  });
});

describe('trip_hikarigaoka: pockets and phrasebook', () => {
  const stages: Array<[string[], string]> = [
    [[], 'start'],
    [['電車'], 'town'],
    [['おすすめ'], 'reco'],
    [['公園'], 'where'],
    [['おすすめ', 'お土産'], 'quote'],
  ];
  const accepted = (id: string, text: string, plan: Array<[string[], string]>): boolean =>
    plan.some(([taps, node]) => {
      const s = open(id, 'en', { game: counter(50000).hooks, flags: { priced: true } });
      tap(s, taps);
      if (s.nodeId !== node) return false;
      const r = s.submit({ text, mode: 'typed_ja' });
      return r.learner.matched && r.character.kind !== 'fallback';
    });

  it('every pocket line is language an intent accepts at some node', () => {
    const ids = JP_PACK.scenarioMeta.find((m) => m.id === TRIP)!.pocket!;
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const id of ids) expect(accepted(TRIP, JP_PACK.pockets[id]!.line.ja.replace(/\|/g, ''), stages), id).toBe(true);
  });

  it('every trip phrasebook line is language the scenario accepts at some node', () => {
    for (const p of TRIP_PHRASES.filter((x) => x.id.startsWith('trip_'))) expect(accepted(TRIP, p.ja.replace(/\|/g, ''), stages), p.id).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------------------------------------------
// the two job intros
// ------------------------------------------------------------------------------------------------------------------------------------

interface Intro {
  id: string;
  /** chips to tap, in order, to complete it */
  path: string[];
  steps: string[];
  nodes: string[];
  /** typed in each script, node reached after each */
  typed: Array<{ text: string; node: string }>;
  /** a sentence that is wrong at the last step (the node stays) */
  wrong: { after: string[]; text: string };
}
const INTROS: Intro[] = [
  {
    id: 'jobintro_cafe',
    path: ['やります', 'いらっしゃいませ', 'お待たせしました'],
    steps: ['accept', 'greet', 'serve'],
    nodes: ['start', 'explain', 'accept', 'serve'],
    typed: [
      { text: 'はい、やります', node: 'accept' },
      { text: 'irasshaimase', node: 'serve' },
      { text: 'omatase shimashita', node: 'done' },
    ],
    wrong: { after: ['やります', 'いらっしゃいませ'], text: 'コーヒーをください' },
  },
  {
    id: 'jobintro_station',
    path: ['やります', '三番線', 'お気をつけて'],
    steps: ['accept', 'answer', 'wish'],
    nodes: ['start', 'explain', 'accept', 'wish'],
    typed: [
      { text: 'はい、やります', node: 'accept' },
      { text: 'sanbansen desu', node: 'wish' },
      { text: 'お気をつけて', node: 'done' },
    ],
    wrong: { after: ['やります'], text: '二番線です' },
  },
];

for (const intro of INTROS) {
  describe(`${intro.id}: every chip is understood`, () => {
    for (const l1 of ['en', 'ar'] as const) {
      it(`at every reachable node, ${l1}`, () => {
        const { problems, visited } = walk(intro.id, l1, () => ({}));
        expect(problems).toEqual([]);
        const seen = new Set([...visited].map((k) => k.split('|')[0]));
        for (const n of intro.nodes) expect(seen.has(n), n).toBe(true);
      });
    }
  });

  describe(`${intro.id}: playing it`, () => {
    it('by tapping chips alone: every goal step done and the conversation ends well', () => {
      const s = open(intro.id);
      tap(s, intro.path);
      expect(s.ended).toBe(true);
      expect(s.nodeId).toBe('done');
      expect([...s.stepsDone].sort()).toEqual([...intro.steps].sort());
      expect(s.summary().goalDone).toBe(3);
    });

    it('ask what the work is first, then accept', () => {
      const s = open(intro.id);
      tap(s, ['どんな']);
      expect(s.nodeId).toBe('explain');
      tap(s, intro.path);
      expect(s.nodeId).toBe('done');
    });

    it('the polite way out (また来ます / 考えます) ends at leave with no step done, and midway keeps the steps already done', () => {
      const a = open(intro.id);
      tap(a, ['また']);
      expect(a.nodeId).toBe('leave');
      expect(a.ended).toBe(true);
      expect(a.stepsDone.size).toBe(0);
      const b = open(intro.id);
      tap(b, ['どんな', '考えます']);
      expect(b.nodeId).toBe('leave');
      const c = open(intro.id);
      tap(c, [intro.path[0]!]);
      say(c, 'また来ます');
      expect(c.nodeId).toBe('leave');
      expect(c.stepsDone.has('accept')).toBe(true);
      expect(c.stepsDone.size).toBe(1);
    });

    it('hiragana, romaji and English/Arabic sentences the phrasebook knows are accepted', () => {
      const s = open(intro.id);
      for (const { text, node } of intro.typed) {
        expect(say(s, text).learner.matched, text).toBe(true);
        expect(s.nodeId, text).toBe(node);
      }
      const en = open(intro.id, 'en');
      expect(say(en, 'yes i will do it').learner.matched).toBe(true);
      const ar = open(intro.id, 'ar');
      expect(say(ar, 'نعم سأفعل').learner.matched).toBe(true);
      expect(ar.nodeId).toBe('accept');
    });

    it('a wrong answer at the last step gets a gentle fallback, the node stays and the chips stay', () => {
      const s = open(intro.id);
      tap(s, intro.wrong.after);
      const node = s.nodeId;
      const r = say(s, intro.wrong.text);
      expect(r.character.kind === 'fallback' || !r.learner.matched).toBe(true);
      expect(s.nodeId).toBe(node);
      expect(s.ended).toBe(false);
      expect(s.suggestions().length).toBeGreaterThanOrEqual(2);
    });

    it('an unrelated sentence gets a fallback, never an error', () => {
      const s = open(intro.id);
      const r = say(s, '天気がいいです');
      expect(r.character.line.written.length).toBeGreaterThan(0);
      expect(s.ended).toBe(false);
    });
  });

  describe(`${intro.id}: pockets and phrasebook`, () => {
    const stages: Array<[string[], string]> = [
      [[], 'start'],
      [[intro.path[0]!], 'accept'],
      [intro.path.slice(0, 2), intro.nodes[3]!],
    ];
    const accepted = (text: string): boolean =>
      stages.some(([taps, node]) => {
        const s = open(intro.id);
        tap(s, taps);
        if (s.nodeId !== node) return false;
        const r = s.submit({ text, mode: 'typed_ja' });
        return r.learner.matched && r.character.kind !== 'fallback';
      });

    it('every pocket line is language an intent accepts at some node, at most 2 are key lines', () => {
      const ids = JP_PACK.scenarioMeta.find((m) => m.id === intro.id)!.pocket!;
      expect(ids).toHaveLength(3);
      for (const id of ids) expect(accepted(JP_PACK.pockets[id]!.line.ja.replace(/\|/g, '')), id).toBe(true);
      expect(ids.filter((id) => JP_PACK.pockets[id]!.key).length).toBeLessThanOrEqual(2);
    });
  });
}

describe('the job intro phrasebook lines are language the intros accept', () => {
  it('job_omatase for the café, job_platform_three and job_okiotsukete for the station', () => {
    const cafe = open('jobintro_cafe');
    tap(cafe, ['やります', 'いらっしゃいませ']);
    expect(cafe.submit({ text: TRIP_PHRASES.find((p) => p.id === 'job_omatase')!.ja.replace(/\|/g, ''), mode: 'typed_ja' }).learner.matched).toBe(true);
    const st = open('jobintro_station');
    tap(st, ['やります']);
    expect(st.submit({ text: TRIP_PHRASES.find((p) => p.id === 'job_platform_three')!.ja.replace(/\|/g, ''), mode: 'typed_ja' }).learner.matched).toBe(true);
    expect(st.submit({ text: TRIP_PHRASES.find((p) => p.id === 'job_okiotsukete')!.ja.replace(/\|/g, ''), mode: 'typed_ja' }).learner.matched).toBe(true);
    expect(st.nodeId).toBe('done');
  });
});
