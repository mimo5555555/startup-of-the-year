// Goen stage 1 (docs/GOEN.md): the shrine's wish (shrine_wish, every entry node) and the Kyoto Journey's three conversations (kyoto_ryokan,
// kyoto_temple, kyoto_matcha). Every chip is understood at every node, each is completable by tapping alone, the typed language works in
// Japanese, romaji, English and Arabic, the bill is charged once with the right items, and running short charges nothing.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById, yenToJa, type L1, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { KYOTO_PRICES } from '../../content/src/tokyo/game/journeys';

const money = (n: number): Vars[string] => ({ ja: yenToJa(n).markup, gloss: yenToJa(n).gloss });
const PRICE: Record<string, number> = { kenko: KYOTO_PRICES.omamori, gakugyo: KYOTO_PRICES.omamori, kotsu: KYOTO_PRICES.omamori, goshuin: KYOTO_PRICES.goshuin, set: KYOTO_PRICES.set, usucha: KYOTO_PRICES.usucha, yatsuhashi: KYOTO_PRICES.yatsuhashi };

/** A till: the bill is the main slot plus the extra slot; `charge` refuses what the purse cannot pay. */
function till(cash: number, main: string, extra: string) {
  const log = { charges: [] as string[][], refused: 0 };
  const bill = (slots: Record<string, string>) => [slots[main], slots[extra]].filter((x): x is string => !!x);
  const total = (slots: Record<string, string>) => bill(slots).reduce((a, id) => a + (PRICE[id] ?? 0), 0);
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (total(slots) > 0 ? { total: money(total(slots)) } : {}),
    charge(slots) {
      if (cash < total(slots)) {
        log.refused++;
        return { ok: false };
      }
      cash -= total(slots);
      log.charges.push(bill(slots));
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

/** Picks every suggestion at every reachable node: always understood, never a fallback, every token glossed. */
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
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, visited };
}

const WISH_NODES = ['start', ...(JP_PACK.goen?.catalog ?? []).map((c) => `wish_${c.id}`)];

describe('shrine_wish', () => {
  it('every entry node: the chips are understood; the item node shows its own wish as the one model line', () => {
    for (const node of WISH_NODES) {
      for (const l1 of ['en', 'ar'] as const) expect(walk('shrine_wish', l1, () => ({ startNode: node })).problems, `${node} ${l1}`).toEqual([]);
    }
    const s = open('shrine_wish', 'en', { startNode: 'wish_journey_kyoto' });
    expect(s.suggestions().map((x) => x.written)[0]).toBe('京都に行けますように。');
    tap(s, ['京都']);
    expect(s.ended).toBe(true);
    expect(s.summary().goalDone).toBe(1);
  });

  it('a typed or spoken wish in Japanese, romaji, English or Arabic is a wish; anything else is gently not', () => {
    for (const [l1, text] of [
      ['en', '毎日日本語を話せますように。'],
      ['en', 'mainichi hanasemasu youni'],
      ['en', 'I hope I can go to Kyoto'],
      ['ar', 'أتمنى أن أذهب إلى كيوتو'],
      ['en', 'I hope my Japanese gets better'],
    ] as const) {
      const s = open('shrine_wish', l1, { startNode: 'wish_omamori_streak' });
      say(s, text);
      expect(s.ended, text).toBe(true);
    }
    const s = open('shrine_wish', 'en', { startNode: 'wish_kimono_momiji' });
    const r = say(s, 'こんにちは');
    expect(s.ended).toBe(false);
    expect(r.character.kind).not.toBe('end');
  });
});

describe('the Kyoto conversations: every chip is understood', () => {
  const modes = (main: string, extra: string): Array<[string, () => Partial<SessionOptions>]> => [
    ['without hooks', () => ({})],
    ['plenty of cash', () => ({ game: till(50_000, main, extra).hooks, flags: { priced: true } })],
    ['almost no cash', () => ({ game: till(100, main, extra).hooks, flags: { priced: true } })],
  ];
  const cases: Array<[string, string, string]> = [
    ['kyoto_ryokan', '', ''],
    ['kyoto_temple', 'omamori', 'goshuin'],
    ['kyoto_matcha', 'matcha', 'giftItem'],
  ];
  for (const [id, main, extra] of cases) {
    for (const [label, mk] of id === 'kyoto_ryokan' ? modes(main, extra).slice(0, 1) : modes(main, extra)) {
      it(`${id}, ${label}`, () => {
        for (const l1 of ['en', 'ar'] as const) expect(walk(id, l1, mk).problems, l1).toEqual([]);
      });
    }
  }
}, 60_000);

describe('the Kyoto conversations by tapping and by typing', () => {
  it('kyoto_ryokan: tap-only checks in with every step; typed JA / romaji / EN / AR do too', () => {
    const s = open('kyoto_ryokan');
    tap(s, ['予約', '二泊', '七時', 'お世話']);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['dinner', 'greet', 'nights', 'thanks']);
    for (const [l1, lines] of [
      ['en', ['予約したレイラです。', '一泊です。', '六時でお願いします。', 'よろしくお願いします。']],
      ['en', ['reira to moushimasu', 'nihaku desu', 'shichiji de onegaishimasu', 'arigatou gozaimasu']],
      ['en', ['I have a reservation under Leila', 'one night', 'at six please', 'thank you I am in your care']],
      ['ar', ['لدي حجز باسم ليلى', 'ليلة واحدة', 'في السابعة من فضلك', 'شكرا أنا في رعايتكم']],
    ] as const) {
      const t = open('kyoto_ryokan', l1);
      for (const line of lines) say(t, line);
      expect(t.ended, lines.join(' / ')).toBe(true);
      expect(t.summary().goalDone, lines.join(' / ')).toBe(4);
    }
  });

  it('kyoto_temple: garden, omamori, goshuin and pay in cash: one charge of both; short of cash charges nothing; typed EN / AR / romaji work', () => {
    const c = till(50_000, 'omamori', 'goshuin');
    const s = open('kyoto_temple', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['庭', 'お守り', '学業', '御朱印', '現金']);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['garden', 'goshuin', 'omamori', 'pay']);
    expect(c.log.charges).toEqual([['gakugyo', 'goshuin']]);
    expect(c.cash()).toBe(50_000 - KYOTO_PRICES.omamori - KYOTO_PRICES.goshuin);
    const poor = till(100, 'omamori', 'goshuin');
    const p = open('kyoto_temple', 'en', { game: poor.hooks, flags: { priced: true } });
    tap(p, ['お守り', '健康', '御朱印', '現金']);
    expect(p.nodeId).toBe('short');
    expect(poor.log.charges).toEqual([]);
    tap(p, ['考えます']);
    expect(p.ended).toBe(true);
    for (const [l1, lines] of [
      ['en', ['where is the temple garden', 'an omamori please', 'safe travel', 'a goshuin please', 'cash please']],
      ['ar', ['أين حديقة المعبد', 'تميمة من فضلك', 'الصحة', 'غوشوين من فضلك', 'نقدا من فضلك']],
      ['en', ['niwa wa doko desu ka', 'omamori wo kudasai', 'kenkou no omamori wo kudasai', 'goshuin wo onegaishimasu', 'genkin de onegaishimasu']],
    ] as const) {
      const t = open('kyoto_temple', l1);
      for (const line of lines) say(t, line);
      expect(t.ended, lines.join(' / ')).toBe(true);
      expect(t.summary().goalDone, lines.join(' / ')).toBe(4);
    }
  });

  it('kyoto_matcha: order, compliment, ask the recommendation, buy the souvenir, pay by IC: one charge of both; typed EN / AR / romaji work', () => {
    const c = till(50_000, 'matcha', 'giftItem');
    const s = open('kyoto_matcha', 'en', { game: c.hooks, flags: { priced: true } });
    tap(s, ['抹茶セット', 'おいしい', 'お土産', '八ツ橋', 'ICカード']);
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['compliment', 'order', 'pay', 'reco']);
    expect(c.log.charges).toEqual([['set', 'yatsuhashi']]);
    for (const [l1, lines] of [
      ['en', ['the matcha set please', 'it is very tasty', 'what souvenir do you recommend', 'yatsuhashi please', 'cash please']],
      ['ar', ['طقم الماتشا من فضلك', 'طيب جدا', 'أي هدية تذكارية تنصحين بها', 'ياتسوهاشي من فضلك', 'نقدا من فضلك']],
      ['en', ['matcha wo kudasai', 'oishii desu', 'osusume no omiyage wa nan desu ka', 'yatsuhashi wo kudasai', 'genkin de onegaishimasu']],
    ] as const) {
      const t = open('kyoto_matcha', l1);
      for (const line of lines) say(t, line);
      expect(t.ended, lines.join(' / ')).toBe(true);
      expect(t.summary().goalDone, lines.join(' / ')).toBe(4);
    }
  });

  it('every pocket line of the four scenarios is language an intent accepts', () => {
    for (const m of JP_PACK.scenarioMeta.filter((x) => x.id === 'shrine_wish' || x.id.startsWith('kyoto_'))) {
      for (const pid of m.pocket ?? []) {
        const line = JP_PACK.pockets[pid]!.line.ja.replace(/\|/g, '');
        const sc = scenarioById(m.id)!;
        const ok = Object.keys(sc.nodes).some((n) => {
          const s = open(m.id, 'en', { startNode: n });
          if (s.ended) return false;
          const r = s.submit({ text: line, mode: 'typed_ja' });
          return r.learner.matched && r.character.kind !== 'fallback';
        });
        expect(ok, `${pid}: ${line}`).toBe(true);
      }
    }
  });
});
