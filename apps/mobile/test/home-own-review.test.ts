// Review fixes for wave B2 (own room): regression tests for what the adversarial review found. One describe per bug.
import './_fakeStorage';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById } from '@lw/content';
import { createGameState, reduce, type GameState, type GameView, type InputEvent, type ReduceResult } from '@lw/game';
import { ConversationSession } from '@lw/engine';
import { createConvoGame } from '../src/game/convoHooks';
import { gameView } from '../src/game/selectors';
import { ar as STR_AR } from '../src/strings/home-own';
import { shownScenario } from '../src/game/ownLogic';
import { goodsOf, shelfFor } from '../src/game/worldSync';

const RENT = /rent|deposit|lease|contract|tenan|landlord|إيجار|ايجار|تأجير|وديعة|عقد|مستأجر/i;

describe('D28: a profile under 18 reads nothing about renting around the viewing (title, setup, steps)', () => {
  const sc = scenarioById('aiko_viewing')!;
  for (const age of ['kids', 'teens'] as const) {
    it(`${age}: the title and the setup are the tea-room visit`, () => {
      const shown = shownScenario(JP_PACK, age, sc);
      for (const l of ['en', 'ar'] as const) {
        expect(shown.title[l], `${age} title ${l}`).not.toMatch(RENT);
        expect(shown.setup[l], `${age} setup ${l}`).not.toMatch(RENT);
        expect(shown.title[l] + shown.setup[l]).not.toMatch(/Ono-sō|أونو/);
        for (const st of shown.steps) expect(st.text[l]).not.toMatch(RENT);
      }
      expect(shown.title.en).toContain('tea room');
    });
  }
  it('an adult keeps the viewing of the flat, and no other scenario changes', () => {
    expect(shownScenario(JP_PACK, 'adults', sc)).toBe(sc);
    const other = scenarioById('aiko_contract')!;
    expect(shownScenario(JP_PACK, 'kids', other)).toBe(other);
  });
  it('the base text never says that the minor variant exists (an adult reads the flat only)', () => {
    expect(sc.setup.en).not.toMatch(/under-18/);
    expect(sc.setup.ar).not.toMatch(/دون 18/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// the conversation over a real reducer
// ---------------------------------------------------------------------------------------------------------------

const NOW = new Date('2030-01-18T12:00:00').getTime();
const adults = { name: 'Sam', level: 'A1' as const, goal: 'travel', age: 'adults' as const, createdAt: '2030-01-15T00:00:00.000Z' };
const VIEW: GameView = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: adults as never });
const free = (cash = 100_000): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, chapter: { ...s.chapter, n: 9 }, wallet: { ...s.wallet, cash }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash } } };
};
function rig(scenarioId: string, state: GameState, sessionId = 's_rev') {
  let st = state;
  const events: InputEvent[] = [];
  const game = createConvoGame({
    pack: JP_PACK,
    scenarioId,
    sessionId,
    state: () => st,
    view: () => VIEW,
    commit: (ev): ReduceResult => {
      events.push(ev);
      const r = reduce(st, ev, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
      st = r.state;
      return r;
    },
  });
  return { game, events, get state() { return st; } };
}

describe('a piece that is paid for and on its way is quoted and refused like an owned one, with its own line', () => {
  const ordered = (): GameState => {
    const r = rig('fuku_home', free(), 's_first');
    expect(r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'saturday' }).ok).toBe(true);
    return r.state;
  };
  it('still has a price in the quote (no unresolved yen), and the second order charges nothing', () => {
    const before = ordered();
    const r = rig('fuku_home', before, 's_second');
    const v = r.game.hooks.vars({ furniture: 'futon', deliveryDay: 'tomorrow' }, {});
    expect(v.price).toBeDefined();
    expect(v.total).toBeDefined();
    expect(r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'tomorrow' }).ok).toBe(false);
    expect(r.events.filter((e) => e.t === 'purchase')).toHaveLength(0);
    expect(r.state.wallet.cash).toBe(before.wallet.cash);
    expect(r.state.deliveries).toHaveLength(1);
    expect(r.game.flags.on_its_way).toBe(true);
    expect(r.game.flags.owned_already).toBe(false);
  });
  it('Rin reads the price, then says it is on its way (never "…" for the yen)', () => {
    const r = rig('fuku_home', ordered(), 's_third');
    const session = new ConversationSession({ scenario: scenarioById('fuku_home')!, character: CHARACTERS.find((c) => c.id === 'rin')!, l1: 'en', profileName: 'Sam', topics: [], sessionId: 's_third', game: r.game.hooks, flags: r.game.flags });
    session.start();
    const say = (text: string) => session.submit({ text, mode: 'typed_ja' });
    const lines: string[] = [];
    for (const t of ['布団をください', 'これをください', '配送でお願いします', '土曜日にお願いします', '現金でお願いします']) {
      say(t);
      lines.push(session.turns[session.turns.length - 1].line.written);
    }
    expect(lines.slice(0, 4).join('')).not.toContain('…');
    expect(lines[4]).toContain('お届け');
    expect(lines[4]).toContain('予定');
  });
  it('a delivered piece keeps its own line: you already have it', () => {
    const r0 = rig('fuku_home', ordered(), 's_a');
    const arrived = reduce(r0.state, { t: 'day_observed', nowMs: NOW + 8 * 86_400_000 }, { pack: JP_PACK, now: NOW + 8 * 86_400_000, view: VIEW, rng: () => 0.5 }).state;
    const r = rig('fuku_home', arrived, 's_b');
    expect(r.game.hooks.charge({ furniture: 'futon', deliveryDay: 'tomorrow' }).ok).toBe(false);
    expect(r.game.flags.owned_already).toBe(true);
    expect(r.game.flags.on_its_way).toBe(false);
  });
});

describe('Arabic strings are neutral about the guest and the piece', () => {
  it('the invitation is not addressed to "him" (guests are friends of every gender)', () => {
    expect(STR_AR['ho.invite']).not.toContain('ادعُه');
  });
  it('the arrival toast does not guess the grammatical gender of the piece', () => {
    expect(STR_AR['ho.delivery.arrived']).toContain('قطعة الأثاث');
  });
});

describe('D28: the flat is not listed on the shelves of a profile under 18', () => {
  const floor = (age: 'kids' | 'teens' | 'adults') => JP_PACK.ageProfiles[age].ageFloor;
  it('Aiko\'s shelf lists the room for an adult only; the presents stay for everyone', () => {
    const all = goodsOf(JP_PACK, 'aiko');
    expect(all.some((g) => g.id === 'home_room_ono')).toBe(true);
    for (const age of ['kids', 'teens'] as const) {
      const ids = shelfFor(all, floor(age)).map((g) => g.id);
      expect(ids, age).not.toContain('home_room_ono');
      expect(ids, age).toContain('g_flower');
    }
    expect(shelfFor(all, floor('adults')).map((g) => g.id)).toContain('home_room_ono');
  });
  it('an age-gated thing on a shelf (the car) is still shown as "someday", as designed', () => {
    const cars = goodsOf(JP_PACK, 'motors');
    expect(shelfFor(cars, floor('kids')).map((g) => g.id)).toEqual(cars.map((g) => g.id));
  });
});
