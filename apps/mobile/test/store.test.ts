import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById } from '@lw/content';
import { ConversationSession, evaluateSession } from '@lw/engine';
import { dueCount, repairPersisted, useStore, type Profile } from '../src/store';

const profile: Profile = {
  name: 'Sam',
  l1: 'en',
  level: 'A1',
  goal: 'travel',
  age: 'adults',
  topics: ['food', 'music', 'anime'],
  avatar: CHARACTERS[0].avatar,
  createdAt: new Date().toISOString(),
};

function playCafe() {
  const scenario = scenarioById('cafe')!;
  const s = new ConversationSession({ scenario, character: CHARACTERS[0], l1: 'en', profileName: 'Sam', topics: [] });
  s.start();
  for (const t of ['コーヒーをください。', 'ホットをください。', 'いいえ、大丈夫です。', 'カードでお願いします。']) s.submit({ text: t, mode: 'typed_ja' });
  return s;
}

beforeEach(() => {
  useStore.getState().hydrate();
  useStore.getState().reset();
});

describe('store', () => {
  it('starts on onboarding and gives a new learner a starter pack that is due for review', () => {
    expect(useStore.getState().screen).toBe('onboarding');
    useStore.getState().completeOnboarding(profile);
    const s = useStore.getState();
    expect(s.screen).toBe('world');
    expect(s.vocab.length).toBe(5);
    expect(dueCount(s.vocab)).toBe(5);
    expect(s.uiLang).toBe('en');
  });

  it('saves a word once and reschedules it after review', () => {
    const st = useStore.getState();
    st.completeOnboarding(profile);
    const item = st.saveWord({ kind: 'word', s: '猫', r: 'ねこ', rom: 'neko', meaning: { en: 'cat', ar: 'قطة' }, source: 'sign' });
    expect(useStore.getState().saveWord({ kind: 'word', s: '猫', rom: 'neko', meaning: {}, source: 'sign' }).id).toBe(item.id);
    expect(useStore.getState().vocab.filter((v) => v.s === '猫')).toHaveLength(1);
    const before = useStore.getState().vocab.find((v) => v.id === item.id)!.card.due;
    useStore.getState().reviewWord(item.id, 'good');
    const after = useStore.getState().vocab.find((v) => v.id === item.id)!.card.due;
    expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('awards XP for a finished conversation, marks it complete, and starts a streak', () => {
    useStore.getState().completeOnboarding(profile);
    const report = evaluateSession(playCafe());
    const data = useStore.getState().recordLoop({ scenarioId: 'cafe', report, turns: [] });
    const s = useStore.getState();
    expect(data.xp).toBeGreaterThan(40);
    expect(s.xp).toBe(data.xp);
    expect(s.completed.cafe.count).toBe(1);
    expect(s.completed.cafe.best).toBe(report.scores.goal);
    expect(s.streak.days).toBe(1);
    expect(s.loops).toHaveLength(1);
  });

  it('counts a sign only once', () => {
    useStore.getState().completeOnboarding(profile);
    expect(useStore.getState().discover('cat')).toBe(true);
    expect(useStore.getState().discover('cat')).toBe(false);
    expect(useStore.getState().xp).toBe(2);
  });

  it('switching the app language also switches the mother tongue used for translation', () => {
    useStore.getState().completeOnboarding(profile);
    useStore.getState().setUiLang('ar');
    expect(useStore.getState().profile?.l1).toBe('ar');
  });

  it('reset clears everything', () => {
    useStore.getState().completeOnboarding(profile);
    useStore.getState().reset();
    const s = useStore.getState();
    expect(s.profile).toBeNull();
    expect(s.vocab).toHaveLength(0);
    expect(s.screen).toBe('onboarding');
  });
});

describe('a damaged legacy save is repaired, never trusted', () => {
  const persisted = () => {
    const s = useStore.getState();
    return { profile: s.profile, vocab: s.vocab, xp: s.xp, streak: s.streak, days: s.days, loops: s.loops, completed: s.completed, lessonsDone: s.lessonsDone, discovered: s.discovered, errors: s.errors, settings: s.settings, uiLang: s.uiLang };
  };

  it('a good save comes back as it was', () => {
    useStore.getState().completeOnboarding(profile);
    useStore.getState().discover('sakura');
    useStore.getState().completeLesson('greetings', 25);
    const good = JSON.parse(JSON.stringify(persisted()));
    expect(repairPersisted(good, persisted())).toEqual(good);
  });

  it('wrong types fall back to fresh values and unreadable items are dropped, so no screen reads a null list or a card without a due date', () => {
    useStore.getState().completeOnboarding(profile);
    const base = persisted();
    const word = base.vocab[0]!;
    const fixed = repairPersisted(
      {
        profile: 'x',
        vocab: [null, 5, { id: 'a', s: '' }, { ...word, card: undefined }, { ...word, id: word.id }, word],
        xp: -4,
        streak: null,
        days: [],
        loops: 'no',
        completed: { konbini: { count: 2, best: 90 }, broken: 3 },
        lessonsDone: null,
        discovered: ['a', 5, '', 'a'],
        errors: 3,
        settings: null,
        uiLang: 'fr',
      },
      base,
    );
    expect(fixed.profile).toBeNull();
    expect(fixed.vocab).toHaveLength(3);
    expect(new Set(fixed.vocab.map((v) => v.id)).size).toBe(3);
    for (const v of fixed.vocab) expect(Number.isFinite(Date.parse(v.card.due))).toBe(true);
    expect(fixed.xp).toBe(0);
    expect(fixed.streak).toEqual(base.streak);
    expect(fixed.days).toEqual({});
    expect(fixed.loops).toEqual([]);
    expect(fixed.completed).toEqual({ konbini: { count: 2, best: 90 } });
    expect(fixed.lessonsDone).toEqual([]);
    expect(fixed.discovered).toEqual(['a']);
    expect(fixed.errors).toEqual({});
    expect(fixed.settings).toEqual(base.settings);
    expect(fixed.uiLang).toBe(base.uiLang);
    expect(repairPersisted('not an object', base).vocab).toEqual([]);
  });
});
