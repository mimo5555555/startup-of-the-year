// Shopkeepers who know you (tokyo/regulars.ts): with `regular` every shop opens with its regular's greeting and understands 「また来ました」;
// with `remembers` and {last} it asks about the last purchase, shows the two answer chips, understands them (and answers in your own
// words), replies and stays, and the chips and the answer go once answered; the conversation then goes on as before. Without the flags
// nothing changes: the usual greeting, no answer chips, and an answer to a question nobody asked is not taken as one.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, REGULARS, SLOTS, scenarioById, type L1, type Vars } from '@lw/content';
import { ConversationSession, type SessionGameHooks, type Turn } from '../src';

/** the opening line of each session */
const first = new WeakMap<ConversationSession, Turn>();

function open(id: string, flags: Record<string, boolean>, last?: Vars[string], l1: L1 = 'en'): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  const game: SessionGameHooks | undefined = last ? { vars: () => ({ last }), charge: () => ({ ok: false }) } : undefined;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], now: () => (t += 4000), flags: { ...flags }, ...(game ? { game } : {}) });
  first.set(s, s.start());
  return s;
}

/** A real item this shop sells, as the app passes it: the first option of the conversation's item slot. */
function lastOf(id: string): Vars[string] | undefined {
  const meta = JP_PACK.scenarioMeta.find((m) => m.id === id);
  const opt = meta?.shop?.itemSlot ? SLOTS[meta.shop.itemSlot]?.find((o) => meta.shop!.itemMap[o.id]) : undefined;
  return opt ? { ja: opt.ja, gloss: opt.gloss } : undefined;
}

const firstLine = (s: ConversationSession) => first.get(s)!;
const written = (s: ConversationSession) => s.suggestions().map((x) => x.written);

describe('a regular is greeted as one', () => {
  for (const id of Object.keys(REGULARS)) {
    it(`${id}: the regular's greeting, and 「また来ました」 is understood`, () => {
      const plain = open(id, {});
      const s = open(id, { regular: true });
      const greet = firstLine(s).line.written;
      expect(greet).not.toBe(firstLine(plain).line.written);
      expect(greet.replace(/\s/g, '')).toBe(REGULARS[id]!.regular.ja.replace(/\|/g, ''));
      const r = s.submit({ text: 'また来ました！', mode: 'typed_ja' });
      expect(r.learner.matched, id).toBe(true);
      expect(r.learner.intentId).toBe('back_again');
      expect(s.nodeId).toBe(scenarioById(id)!.start);
    });
  }
});

describe('a shopkeeper who remembers asks about the last purchase', () => {
  const remembering = Object.entries(REGULARS).filter(([, r]) => r.remembers);
  it('covers the shops that sell things you keep or eat', () => {
    expect(remembering.map(([id]) => id).sort()).toEqual(['aiko_tea', 'cafe', 'denki_phone', 'fuku_clothes', 'fuku_home', 'hobby_figures', 'konbini', 'motors_bike', 'motors_car', 'ramen'].sort());
  });
  for (const [id, r] of remembering) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${id} (${l1}): the question names {last}; the good chip is understood, replied to, and the chips go; the usual chips still work`, () => {
        const last = lastOf(id)!;
        expect(last, id).toBeDefined();
        const s = open(id, { regular: true, remembers: true }, last, l1);
        const q = firstLine(s).line;
        expect(q.written).toContain(last.ja.replace(/\|/g, ''));
        expect(q.tokens.some((t) => t.s === '…' && !t.punct)).toBe(false);
        const chips = written(s);
        const good = r.chips![0].ja.replace(/\|/g, '');
        expect(chips[0]).toBe(good);
        expect(chips[1]).toBe(r.chips![1].ja.replace(/\|/g, ''));
        const res = s.pickSuggestion(0);
        expect(res.learner.intentId).toBe('last_good');
        expect(res.character.line.written.replace(/\s/g, '')).toBe(r.good!.ja.replace(/\|/g, ''));
        expect(s.nodeId).toBe(scenarioById(id)!.start);
        // answered: the answer chips are gone, the shop's own chips are back on top
        const after = written(s);
        expect(after).not.toContain(good);
        expect(after[0]).toBe(scenarioById(id)!.nodes[scenarioById(id)!.start].suggestions!.find((x) => !x.when)!.ja.replace(/\|/g, ''));
        // and the conversation goes on with the shop's own first chip
        const next = s.pickSuggestion(0);
        expect(next.learner.matched, `${id}: the usual first chip after the answer`).toBe(true);
        expect(next.character.kind).not.toBe('fallback');
      });
    }
    it(`${id}: a so-so answer gets its own reply; an answer in your own words is understood`, () => {
      const last = lastOf(id)!;
      const meh = open(id, { regular: true, remembers: true }, last).pickSuggestion(1);
      expect(meh.learner.intentId).toBe('last_meh');
      expect(meh.character.line.written.replace(/\s/g, '')).toBe(r.meh!.ja.replace(/\|/g, ''));
      const own = open(id, { regular: true, remembers: true }, last).submit({ text: 'とても気に入っています！', mode: 'typed_ja' });
      expect(own.learner.intentId).toBe('last_good');
    });
  }
});

describe('without the flags nothing changes', () => {
  for (const id of Object.keys(REGULARS)) {
    it(`${id}: the usual greeting, no answer chips, no answer taken`, () => {
      const s = open(id, {});
      const start = scenarioById(id)!.nodes[scenarioById(id)!.start];
      expect(firstLine(s).line.written.replace(/\s/g, '')).toBe(start.say[start.say.length - 1].line.ja.replace(/\|/g, '').replace(/\{\w+\}/g, (m) => m));
      expect(written(s)).toEqual(start.suggestions!.filter((x) => !x.when).map((x) => x.ja.replace(/\|/g, '')));
      const r = s.submit({ text: 'とても気に入っています！', mode: 'typed_ja' });
      expect(r.learner.intentId === 'last_good' || r.learner.intentId === 'back_again').toBe(false);
    });
  }
});
