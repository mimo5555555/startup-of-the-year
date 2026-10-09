import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { objectiveRows } from '@lw/game';
import { CHARACTERS } from '@lw/content';
import { ChapterCard, ChapterTeaser } from '../src/components/game/ChapterCard';
import { DailyList } from '../src/components/game/DailyList';
import { DreamPanel, DreamPicker } from '../src/components/game/DreamPicker';
import { ObjectiveRow } from '../src/components/game/ObjectiveRow';
import { resetBridgeForTests } from '../src/game/bridge';
import { useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { gameView } from '../src/game/selectors';
import { Culture } from '../src/screens/Culture';
import { Quests } from '../src/screens/Quests';
import { StoryBeat, prefillKana } from '../src/screens/StoryBeat';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';
import { STRINGS } from '../src/i18n';

// The quest screens rendered to static markup in both directions (no DOM needed; the stores are read as they are).
const profile: Profile = { name: 'Mio', l1: 'en', level: 'A1', goal: 'casual', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
/** React's server render reads a store's *initial* state, so every change is copied there too. */
const sync = () => {
  Object.assign(useGame.getInitialState(), useGame.getState());
  Object.assign(useStore.getInitialState(), useStore.getState());
  Object.assign(useUi.getInitialState(), useUi.getState());
};
const html = (el: ReactElement) => renderToStaticMarkup(el);
/** The visible text of markup: tags dropped, so a number wrapped for left-to-right does not split a sentence. */
const text = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");
const view = (over: Partial<Profile> = {}) => gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: { ...profile, ...over } });
const patch = (fn: (g: ReturnType<typeof useGame.getState>) => Partial<ReturnType<typeof useGame.getState>>) => {
  useGame.setState(fn(useGame.getState()));
  sync();
};

beforeEach(() => {
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useUi.setState({ beats: [], args: {} });
  useStore.setState({ profile, ready: true });
  setLang('en');
  sync();
});

describe('katakana step', () => {
  it('pre-fills a Latin name by sound, keeps kana and other scripts', () => {
    expect(prefillKana('Mio')).toBe('ミオ');
    expect(prefillKana('Sam')).toBe('サム');
    expect(prefillKana('Matt')).toBe('マット');
    expect(prefillKana('みお')).toBe('ミオ');
    expect(prefillKana('ミオ')).toBe('ミオ');
    expect(prefillKana('田中')).toBe('田中');
    expect(prefillKana('أحمد')).toBe('أحمد');
    expect(prefillKana('  ')).toBe('');
    // not Japanese sounds: kept as typed rather than mangled
    expect(prefillKana('Xq')).toBe('Xq');
  });
});

describe('objective rows', () => {
  const rows = () => objectiveRows(PACK, useGame.getState(), view());

  it('shows progress, the hint and no offer on a fresh chapter 1', () => {
    const out = html(createElement('ul', null, ...rows().map((r) => createElement(ObjectiveRow, { key: r.id, row: r }))));
    expect(out).toContain('data-obj="c1_1"');
    expect(out).toContain("Finish Hanako-sensei&#x27;s Greetings lesson");
    expect(out).toContain('0/4');
    expect(out).toContain('0/5');
    expect(out).not.toContain('data-easier');
  });

  it('offers Make it easier after three attempts and shows it as eased once accepted', () => {
    patch((g) => ({ chapter: { ...g.chapter, tries: { c1_5: 3 } } }));
    const offered = rows().find((r) => r.id === 'c1_5')!;
    expect(offered.easier).toBe('offered');
    const out = html(createElement(ObjectiveRow, { row: offered, onEasier: () => {} }));
    expect(out).toContain('data-easier="c1_5"');
    expect(out).toContain('Make it easier');
    expect(out).toContain("Let&#x27;s make it a bit easier.");
    patch((g) => ({ chapter: { ...g.chapter, easier: ['c1_5'] } }));
    const eased = rows().find((r) => r.id === 'c1_5')!;
    expect(eased.easier).toBe('accepted');
    expect(eased.progress.total).toBe(2);
    expect(html(createElement(ObjectiveRow, { row: eased, onEasier: () => {} }))).toContain('qst-eased');
  });

  it('ticks a done row and renders in Arabic with the numbers left-to-right', () => {
    setLang('ar');
    patch((g) => ({ chapter: { ...g.chapter, done: { c1_1: 'd0' } } }));
    const done = rows().find((r) => r.id === 'c1_1')!;
    const out = html(createElement(ObjectiveRow, { row: done }));
    expect(out).toContain('data-done="1"');
    expect(out).toContain('أنهِ درس التحيات');
    const open = html(createElement(ObjectiveRow, { row: rows().find((r) => r.id === 'c1_3')! }));
    expect(open).toMatch(/<bdi dir="ltr"[^>]*>0\/4<\/bdi>/);
  });
});

describe('chapter card and teasers', () => {
  it('names the chapter in Japanese and the UI language, with the goals and the reward', () => {
    const def = PACK.chapters[0];
    const out = html(createElement(ChapterCard, { def, status: { n: 1, done: 2, total: 5, waitDays: 0, gated: false } }));
    expect(out).toContain('はじめまして');
    expect(out).toContain('First Hello');
    expect(text(out)).toContain('2 of 5 goals');
    expect(out).toContain('2,500');
    setLang('ar');
    expect(html(createElement(ChapterCard, { def, status: { n: 1, done: 2, total: 5, waitDays: 0, gated: false } }))).toContain('أول لقاء');
  });

  it('teases a later chapter by name behind a padlock', () => {
    const out = html(createElement(ChapterTeaser, { def: PACK.chapters[2] }));
    expect(out).toContain('ともだち');
    expect(out).toContain('Opens in Chapter <bdi dir="ltr">3</bdi>');
  });
});

describe('daily goals', () => {
  it('lists today and From yesterday, the pay, and offers one swap', () => {
    const goal = (id: string, counter: never, day: number, done = false) => ({ id, slot: 'speak' as const, counter, target: 2, day, done, paid: done });
    patch((g) => ({
      clock: { ...g.clock, dayIndex: 4 },
      daily: { ...g.daily, day: 4, goals: [goal('g_conv2', 'conv_distinct' as never, 4), goal('g_lesson', 'lesson' as never, 4, true)], carried: [goal('g_place', 'places_distinct' as never, 3)], swapUsed: false },
    }));
    const state = useGame.getState();
    const out = html(createElement(DailyList, { state, streakDays: 3, onSwap: () => {} }));
    expect(out).toContain('data-goal="g_conv2"');
    expect(out).toContain('Finish 2 different conversations');
    expect(out).toContain('From yesterday');
    expect(out).toContain('data-carried="1"');
    expect(text(out)).toContain('+¥100 each');
    expect(text(out)).toContain('+¥150');
    // 3 streak days: ¥15 each
    expect(text(out)).toContain('+¥45');
    // the swap is offered on the goal that is not done, not on the finished one or yesterday's
    expect(out).toContain('data-swap="g_conv2"');
    expect(out).not.toContain('data-swap="g_lesson"');
    expect(out).not.toContain('data-swap="g_place"');
    patch((g) => ({ daily: { ...g.daily, swapUsed: true } }));
    expect(html(createElement(DailyList, { state: useGame.getState(), streakDays: 3, onSwap: () => {} }))).not.toContain('data-swap');
  });
});

describe('dream picker', () => {
  it('shows the three released dreams to an adult with the goal-matched one suggested, and the car shut until Free Walk', () => {
    const out = html(createElement(DreamPicker, { onChoose: () => {}, onLater: () => {} }));
    expect([...out.matchAll(/data-dream="(\w+)"/g)].map((m) => m[1])).toEqual(['phone_pal', 'bike', 'car']);
    // goal 'casual' -> the phone dream (the festival dream is not in Release 1)
    expect(out).toMatch(/data-dream="phone_pal"[^>]*>.*?Suggested for you/s);
    expect(out).toMatch(/data-dream="car"[^>]*disabled/);
    expect(out).toContain('Decide later');
    expect(out).toContain('Choose this dream');
    expect(out).toContain('What do you want to achieve here?');
  });

  it('never draws the car for a child (D28; the flat and the fresh start are not in Release 1)', () => {
    useStore.setState({ profile: { ...profile, age: 'kids', goal: 'relocation' } });
    sync();
    const out = html(createElement(DreamPicker, { onChoose: () => {} }));
    expect([...out.matchAll(/data-dream="(\w+)"/g)].map((m) => m[1])).toEqual(['phone_pal', 'bike']);
    expect(out).toMatch(/data-dream="phone_pal"[^>]*>.*?Suggested for you/s);
    expect(out).not.toContain('Decide later');
  });

  it('renders in Arabic', () => {
    setLang('ar');
    const out = html(createElement(DreamPicker, { onChoose: () => {}, onLater: () => {} }));
    expect(out).toContain('ماذا تريد أن تحقق هنا؟');
    expect(out).toContain('قرّر لاحقًا');
    expect(out).toContain('自転車でたんけん');
  });

  it('the Dream tab shows both constraints, the steps and the stickers', () => {
    patch((g) => ({ stickers: ['st_bike'] }));
    const dream = {
      dream: 'bike',
      steps: PACK.dreams.find((d) => d.id === 'bike')!.steps.map((s, i) => ({ id: s.id, done: i === 0, visible: s.gate <= 3 })),
      doneCount: 1,
      total: 5,
      nextStep: 'bike_2',
      remainingCost: 22_400,
      cash: 5_000,
      yenBar: 0.22,
      languageGate: { chapter: 5, objectivesLeft: 6 },
      etaDays: 'many' as const,
    };
    const out = html(createElement(DreamPanel, { progress: dream, stickers: ['st_bike'], onChange: () => {} }));
    expect(out).toContain('data-con="yen"');
    expect(out).toContain('data-con="language"');
    expect(text(out)).toContain('¥17,400 to go');
    expect(text(out)).toContain('Opens in Chapter 5 · Goals to finish first: 6');
    expect(text(out)).toContain('More than 60 days at your pace');
    expect(text(out)).toContain('Steps: 1 of 5');
    expect(out).toContain('data-stickers="1"');
    expect(out).toContain('data-change-dream');
    expect((out.match(/data-step=/g) ?? []).length).toBe(5);
    expect(out).toContain('data-done="1"');
  });
});

describe('story beat screen', () => {
  it('shows Hanako, her first line with readings and the gloss, and the Continue button', () => {
    useUi.setState({ beats: ['b_ch1_open'] });
    sync();
    const out = html(createElement(StoryBeat));
    expect(out).toContain('data-beat="b_ch1_open"');
    expect(out).toContain('花子先生');
    expect(out).toContain('ようこそ');
    expect(out).toContain('さくらちょう');
    expect(out).toContain("Welcome to Sakura-chō. I&#x27;m Hanako. I&#x27;m your teacher.");
    expect(out).toContain('data-continue');
    expect(out).toContain('Continue');
    // the opening beat is the shell's `panel` so the e2e helper that presses its last primary button still ends it
    expect(out).toContain('class="panel qst-beat"');
  });

  it('fills {name} with the katakana name and the plain name in the gloss', () => {
    patch((g) => ({ me: { ...g.me, nameKana: 'ミオ' } }));
    useUi.setState({ beats: ['b_ch1_close'] });
    sync();
    useStore.setState({ uiLang: 'en' });
    const out = html(createElement(StoryBeat));
    expect(out).toContain('よくできました');
    // the second line is a tap away: the first line is on screen now
    expect(out).toContain('data-line="0"');
  });

  it('draws nothing for an empty queue or a beat the pack does not know (the effects file it and go back to the world)', () => {
    expect(html(createElement(StoryBeat))).toBe('');
    useUi.setState({ beats: ['b_nope'] });
    sync();
    expect(html(createElement(StoryBeat))).toBe('');
  });
});

describe('Quests screen', () => {
  it('shows Story and Culture only before the closing beat, with the chapter and its objectives', () => {
    const out = html(createElement(Quests));
    expect([...out.matchAll(/role="tab"[^>]*data-tab="(\w+)"/g)].map((m) => m[1])).toEqual(['story', 'culture']);
    expect(out).toContain('data-chapter="1"');
    expect(out).toContain('data-obj="c1_5"');
    // Release 1 plays chapters 1-4: the teasers are chapters 2-4
    expect((out.match(/class="qst-teaser"/g) ?? []).length).toBe(3);
    expect(out).toContain('Coming up');
    expect(out).not.toContain('data-slot="dream"');
  });

  it('adds Dream and Today once the picker was shown, and opens on the tab it was asked for', () => {
    patch((g) => ({ beats: [...g.beats, 'b_ch1_close'] }));
    useUi.setState({ args: { quests: { tab: 'dream' } } });
    sync();
    const out = html(createElement(Quests));
    expect([...out.matchAll(/role="tab"[^>]*data-tab="(\w+)"/g)].map((m) => m[1])).toEqual(['dream', 'story', 'today', 'culture']);
    expect(out).toContain('data-tab="dream"');
    // no dream chosen yet: the picker, not the panel
    expect(out).toContain('data-picker="1"');
  });

  it('shows the waiting message when only the days are left', () => {
    patch((g) => ({ chapter: { ...g.chapter, done: { c1_1: 'd0', c1_2: 'd0', c1_3: 'd0', c1_4: 'd0', c1_5: 'd0' } } }));
    const g = useGame.getState();
    // Chapter 1 needs 1 active day: with none yet the wait shows
    expect(g.clock.activeDays).toBe(0);
    const out = html(createElement(Quests));
    expect(out).toContain('できました！');
    expect(out).toContain('The next chapter opens after');
  });

  it('renders in Arabic, right to left', () => {
    setLang('ar');
    const out = html(createElement(Quests));
    expect(out).toContain('dir="rtl"');
    expect(out).toContain('المهام');
    expect(out).toContain('القصة');
    expect(out).toContain('أول لقاء');
  });
});

describe('strings of the quests module', () => {
  it('has the toast keys the objective, daily and dream engines raise', () => {
    for (const key of ['quests.objectiveDone', 'quests.catchUp', 'quests.goalDone', 'quests.streak', 'quests.chapterDone', 'quests.trio', 'dream.stepDone', 'dream.done']) {
      expect(STRINGS.en[key as keyof typeof STRINGS.en], `en ${key}`).toBeTruthy();
      expect(STRINGS.ar[key as keyof typeof STRINGS.ar], `ar ${key}`).toMatch(/[؀-ۿ]/);
    }
  });
});

describe('the screen behind the Culture tab', () => {
  // the tab is offered from Chapter 1 and the cards are authored in a later slice: its button must not lead to a blank page
  it('says what will collect there, in both languages', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      const out = html(createElement(Culture));
      expect(out).toContain('data-culture-empty');
      expect(text(out)).toContain(STRINGS[lang]['culture.empty']);
      expect(text(out)).not.toMatch(/\bculture\.empty\b|quests\.cultureCount/);
    }
  });
});
