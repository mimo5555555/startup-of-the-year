// The stamp book and the card pop-up (docs/GAME_DESIGN.md §10): the pure rules, the real reducer unlocking and counting cards through the pack,
// and the screen rendered to static markup in English and Arabic.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CHARACTERS, JP_PACK } from '@lw/content';
import { BALANCE, createGameState, evalPred, reduce, type DerivedEvent, type GameState, type InputEvent, type UiEffect } from '@lw/game';
import { ctx1f, facts1f, view1f } from '../../../packages/game/test/fixtures-1f';
import { Culture } from '../src/screens/Culture';
import { useGame } from '../src/game/gameStore';
import { resetBridgeForTests } from '../src/game/bridge';
import { DEFERRED_CARDS, bookCounts, cardState, phraseParts, phraseTokens, sayTarget, shownCards, takeCultureFocus, setCultureFocus } from '../src/game/cultureLogic';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';
import { STRINGS } from '../src/i18n';

const NOW = Date.parse('2030-01-15T09:00:00Z');
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'casual', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const card = (id: string) => JP_PACK.culture.find((c) => c.id === id)!;

let state: GameState;
let derived: DerivedEvent[];
let effects: UiEffect[];
const send = (ev: InputEvent) => {
  const r = reduce(state, ev, ctx1f(JP_PACK, NOW, view1f()));
  state = r.state;
  derived = r.derived;
  effects = r.effects;
};
const unlocked = () => derived.flatMap((e) => (e.t === 'culture_unlocked' ? [e.id] : []));
const c24 = JP_PACK.chapters.find((c) => c.n === 2)!.objectives.find((o) => o.id === 'c2_4')!;

beforeEach(() => {
  state = createGameState(JP_PACK, NOW);
  derived = [];
  effects = [];
});

describe('the cards a stamp book lists', () => {
  it('hides the four cards that cannot be earned in this release until they are collected', () => {
    expect([...DEFERRED_CARDS].sort()).toEqual(['cc_matsuri', 'cc_rent', 'cc_shoesoff', 'cc_trash']);
    const shown = shownCards(JP_PACK, state, 'adults').map((c) => c.id);
    expect(shown).toHaveLength(19);
    for (const id of DEFERRED_CARDS) expect(shown).not.toContain(id);
    const got = { ...state, culture: { cc_matsuri: '2030-01-15' } } as GameState;
    expect(shownCards(JP_PACK, got, 'adults').map((c) => c.id)).toContain('cc_matsuri');
  });

  it('has a hint, in both languages, for every locked card it can show', () => {
    for (const c of shownCards(JP_PACK, state, 'adults')) {
      const key = `culture.hint.${c.id.slice(3)}`;
      for (const lang of ['en', 'ar'] as const) expect((STRINGS[lang] as Record<string, string>)[key], `${lang} ${key}`).toBeTruthy();
    }
  });

  it('counts what is collected and said', () => {
    expect(bookCounts(JP_PACK, state, 'adults')).toEqual({ have: 0, total: 19, said: 0, sayable: 7 });
    const s = { ...state, culture: { cc_bow: 'd', cc_konbini: 'd' }, stats: { ...state.stats, cultureSaid: ['cc_bow'] } } as GameState;
    expect(bookCounts(JP_PACK, s, 'adults')).toMatchObject({ have: 2, said: 1 });
    expect(cardState(card('cc_bow'), s)).toBe('said');
    expect(cardState(card('cc_konbini'), s)).toBe('seen');
    expect(cardState(card('cc_gift'), s)).toBe('locked');
  });

  it('says the first part of a two-part phrase, and fills the name', () => {
    expect(phraseParts(card('cc_itadakimasu').phrase.ja)).toEqual(['いただきます', 'ごちそうさまでした']);
    expect(sayTarget(card('cc_itadakimasu'))).toBe('いただきます');
    expect(sayTarget(card('cc_ic'))).toBe('チャージ|お願いします');
    expect(phraseTokens(card('cc_name'), 'ミオ')[0].map((t) => t.s).join('')).toBe('ミオさん');
    expect(phraseTokens(card('cc_refuse'), '')).toHaveLength(2);
  });

  it('remembers the card the pop-up asked the book to open on, once', () => {
    setCultureFocus('cc_bow');
    expect(takeCultureFocus()).toBe('cc_bow');
    expect(takeCultureFocus()).toBeNull();
  });
});

describe('collecting and saying cards through the real reducer', () => {
  it('unlocks cc_itadakimasu when the ramen is served, shows it once, and pays the cosmetic XP', () => {
    send({ t: 'conversation_done', facts: facts1f({ scenarioId: 'ramen', characterId: 'kenji', done: 3, total: 3 }) });
    expect(unlocked()).toContain('cc_itadakimasu');
    expect(effects).toContainEqual({ t: 'culture', id: 'cc_itadakimasu' });
    expect(effects).toContainEqual({ t: 'xp', amount: BALANCE.cultureXp, why: 'culture' });
    expect(state.culture.cc_itadakimasu).toBeDefined();
    send({ t: 'conversation_done', facts: facts1f({ sessionId: 's2', scenarioId: 'ramen', characterId: 'kenji' }) });
    expect(unlocked()).not.toContain('cc_itadakimasu');
  });

  it('makes c2_4 completable by two Say-its (cc_bow and cc_itadakimasu), each also making an SRS card', () => {
    const pred = c24.pred;
    expect(pred).toEqual({ k: 'culture_said', n: 2 });
    const done = () => evalPred(pred, state, { pack: JP_PACK, view: view1f() });
    // a card that is not collected yet cannot be said
    send({ t: 'culture_say', id: 'cc_itadakimasu', similarity: 1 });
    expect(state.stats.cultureSaid).toEqual([]);
    send({ t: 'conversation_done', facts: facts1f({ scenarioId: 'ramen', characterId: 'kenji' }) });
    send({ t: 'conversation_done', facts: facts1f({ sessionId: 's2', scenarioId: 'intro', characterId: 'hanako' }) });
    expect(state.culture.cc_bow).toBeDefined();
    // a near miss does not count
    send({ t: 'culture_say', id: 'cc_itadakimasu', similarity: 0.1 });
    expect(done()).toBe(false);
    send({ t: 'culture_say', id: 'cc_itadakimasu', similarity: 0.95 });
    expect(effects.some((e) => e.t === 'srsOps' && e.ops.some((o) => o.key === 'cc_itadakimasu' && o.op === 'add'))).toBe(true);
    expect(done()).toBe(false);
    send({ t: 'culture_say', id: 'cc_bow', similarity: 0.95 });
    expect(state.stats.cultureSaid.sort()).toEqual(['cc_bow', 'cc_itadakimasu']);
    expect(done()).toBe(true);
  });

  it('ignores the Say-it of a card without a phrase to say', () => {
    send({ t: 'conversation_done', facts: facts1f({ scenarioId: 'konbini' }) });
    expect(state.culture.cc_konbini).toBeDefined();
    send({ t: 'culture_say', id: 'cc_konbini', similarity: 1 });
    expect(state.stats.cultureSaid).toEqual([]);
  });
});

describe('the stamp book screen', () => {
  const setLang = (lang: 'en' | 'ar') => {
    useStore.setState({ uiLang: lang });
    Object.assign(useStore.getInitialState(), { uiLang: lang });
  };
  const sync = () => {
    Object.assign(useGame.getInitialState(), useGame.getState());
    Object.assign(useStore.getInitialState(), useStore.getState());
    Object.assign(useUi.getInitialState(), useUi.getState());
  };
  const text = (m: string) => m.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");

  beforeEach(() => {
    useStore.getState().reset();
    resetBridgeForTests();
    useGame.getState().resetGame();
    useStore.setState({ profile, ready: true });
    setLang('en');
    sync();
  });

  it('shows locked silhouettes with their hints and no dead cards, in both languages', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      sync();
      const out = renderToStaticMarkup(createElement(Culture));
      expect(out).toContain('data-culture-empty');
      expect((out.match(/data-state="locked"/g) ?? []).length).toBe(19);
      expect(text(out)).toContain((STRINGS[lang] as Record<string, string>)['culture.hint.irasshaimase']);
      expect(out).not.toMatch(/data-card="cc_(shoesoff|rent|trash|matsuri)"/);
      expect(text(out)).not.toMatch(/\bculture\.[a-z]+/);
    }
  });

  it('shows a collected card as a stamp with its phrase, and a said card as said', () => {
    const g = useGame.getState();
    useGame.setState({ culture: { cc_bow: '2030-01-15', cc_konbini: '2030-01-15' }, stats: { ...g.stats, cultureSaid: ['cc_bow'] } });
    sync();
    const out = renderToStaticMarkup(createElement(Culture));
    expect(out).toMatch(/data-card="cc_bow" data-state="said"/);
    expect(out).toMatch(/data-card="cc_konbini" data-state="seen"/);
    expect(out).toContain('よろしくお願いします');
    expect(text(out)).toContain('2 of 19');
  });
});
