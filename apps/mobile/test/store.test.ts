import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS, scenarioById } from '@lw/content';
import { ConversationSession, evaluateSession } from '@lw/engine';
import { dueCount, useStore, type Profile } from '../src/store';

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
