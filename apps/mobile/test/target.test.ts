// The language being learned (German step 3): read once at start from `lw.target`. Japanese by default, with every registry, the
// pack, the stores and the app's words as before; German switches all of them, keeps its own saves, and speaks of German and Berlin.
import './_fakeStorage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { putSaved, saved, wipeSaved } from './_fakeStorage';

afterEach(() => {
  wipeSaved();
  vi.resetModules();
});

describe('learning Japanese (the default)', () => {
  it('reads Tokyo’s registries, the Japanese pack and engine, the store prefix it always had', async () => {
    const t = await import('../src/target');
    const { JP_PACK, LEXICON } = await import('@lw/content');
    const { targetLanguage } = await import('@lw/engine');
    const { PACK } = await import('../src/game/pack');
    expect(t.TARGET).toBe('ja');
    expect(t.IS_GERMAN).toBe(false);
    expect(t.LEXICON).toBe(LEXICON);
    expect(t.STORE_PREFIX).toBe('lw.v1.');
    expect(t.TARGET_LOCALE).toBe('ja-JP');
    expect(t.scenarioById('konbini')).toBeDefined();
    expect(t.scenarioById('berlin_bakery')).toBeUndefined();
    expect(targetLanguage().id).toBe('ja');
    expect(PACK).toBe(JP_PACK);
    const { translate } = await import('../src/i18n');
    expect(translate('en', 'app.tagline')).toContain('Tokyo');
    expect(translate('en', 'quests.reward', { n: '2,500' })).toBe('Reward: ¥2,500');
  });
});

describe('learning German', () => {
  it('reads Berlin’s registries, the Berlin pack and the German engine, and saves under its own prefix', async () => {
    putSaved('lw.target', 'de');
    const t = await import('../src/target');
    const { BERLIN_PACK, DE_LEXICON } = await import('@lw/content');
    const { targetLanguage } = await import('@lw/engine');
    const { PACK } = await import('../src/game/pack');
    expect(t.TARGET).toBe('de');
    expect(t.LEXICON).toBe(DE_LEXICON);
    expect(t.STORE_PREFIX).toBe('lw.de.v1.');
    expect(t.TARGET_LOCALE).toBe('de-DE');
    expect(t.scenarioById('berlin_bakery')).toBeDefined();
    expect(t.scenarioById('konbini')).toBeUndefined();
    expect(t.CHARACTERS.map((c) => c.id)).toContain('jana');
    expect(t.segmentFree('zwei broetchen, bitte').map((x) => x.s)).toEqual(['zwei', 'broetchen', ',', 'bitte']);
    expect(targetLanguage().id).toBe('de');
    expect(PACK).toBe(BERLIN_PACK);
  });

  it('speaks of German and Berlin in the app’s own words, and writes amounts in euros', async () => {
    putSaved('lw.target', 'de');
    const { translate } = await import('../src/i18n');
    expect(translate('en', 'app.tagline')).toBe('Walk around Berlin. Talk to people. Learn German by using it.');
    expect(translate('en', 'audio.speaker.noVoice')).toBe('No German voice installed');
    expect(translate('ar', 'audio.speaker.noVoice')).toContain('ألماني');
    expect(translate('en', 'quests.reward', { n: '3,000' })).toBe('Reward: 30,00 €');
    expect(translate('en', 'quests.reward', { n: 123456 })).toBe('Reward: 1.234,56 €');
  });

  it('starts the German notebook with German greetings, and keeps the UI language picked before the restart', async () => {
    putSaved('lw.target', 'de');
    putSaved('lw.target.ui', 'ar');
    const { useStore } = await import('../src/store');
    expect(useStore.getState().uiLang).toBe('ar');
    useStore.getState().completeOnboarding({ name: 'Sam', l1: 'ar', level: 'A1', goal: 'travel', age: 'adults', topics: ['food', 'music', 'travel'], avatar: {} as never, createdAt: new Date().toISOString() });
    expect(useStore.getState().vocab.map((v) => v.s)).toEqual(['Hallo!', 'Guten Morgen!', 'Bitte.', 'Danke!', 'Tschüss!']);
  });

  it('a Berlin regular gets the regular’s flag and small talk Berlin has lines for, on every visit and any day of the year', async () => {
    putSaved('lw.target', 'de');
    const { regularFlags } = await import('../src/game/regulars');
    const { BERLIN_PACK, BERLIN_TALK_TOPICS } = await import('@lw/content');
    const { createGameState } = await import('@lw/game');
    const meta = BERLIN_PACK.scenarioMeta.find((m) => m.id === 'berlin_bakery')!;
    const base = createGameState(BERLIN_PACK, Date.UTC(2030, 0, 1));
    expect(regularFlags(BERLIN_PACK, base, meta)).toEqual({});
    for (let plays = 1; plays <= 12; plays++) {
      for (let day = 0; day < 365; day += 9) {
        const state = { ...base, runs: { berlin_bakery: { ...(base.runs.berlin_bakery ?? {}), count: plays } as never } };
        const flags = regularFlags(BERLIN_PACK, state, meta, Date.UTC(2030, 0, 1) + day * 86_400_000);
        expect(flags.regular, `${plays}`).toBe(true);
        for (const f of Object.keys(flags).filter((k) => k.startsWith('talk_'))) expect(BERLIN_TALK_TOPICS[f.slice(5)], f).toBeDefined();
      }
    }
  });

  it('keeps Tokyo’s lessons and Mini-theatre out of Berlin’s menu; Japanese keeps them', async () => {
    putSaved('lw.target', 'de');
    const de = await import('../src/game/worldSync');
    expect(de.menuIds({ friends: true, phoneIcon: false })).toEqual({ play: ['quests', 'friends', 'wallet'], study: ['vocab', 'stats', 'settings'] });
    wipeSaved();
    vi.resetModules();
    const ja = await import('../src/game/worldSync');
    expect(ja.menuIds({ friends: true, phoneIcon: false })).toEqual({ play: ['quests', 'friends', 'wallet', 'lessons'], study: ['vocab', 'theatre', 'stats', 'settings'] });
  });

  it('a choice saves the target and the UI language, then restarts', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    const t = await import('../src/target');
    t.chooseTarget('de', 'ar');
    expect(saved('lw.target')).toBe('de');
    expect(saved('lw.target.ui')).toBe('ar');
    expect(reload).toHaveBeenCalledTimes(1);
    t.chooseTarget('ja'); // the language already learned in this run: nothing to do
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe('learning Dutch', () => {
  it('reads Amsterdam’s registries, the Amsterdam pack and the Dutch engine, and saves under its own prefix', async () => {
    putSaved('lw.target', 'nl');
    const t = await import('../src/target');
    const { AMSTERDAM_PACK, AMSTERDAM_SIGNS, NL_LEXICON } = await import('@lw/content');
    const { targetLanguage } = await import('@lw/engine');
    const { PACK } = await import('../src/game/pack');
    expect(t.TARGET).toBe('nl');
    expect(t.IS_DUTCH).toBe(true);
    expect(t.IS_JAPANESE).toBe(false);
    expect(t.IS_GERMAN).toBe(false);
    expect(t.LEXICON).toBe(NL_LEXICON);
    expect(t.SIGNS).toBe(AMSTERDAM_SIGNS);
    expect(t.STORE_PREFIX).toBe('lw.nl.v1.');
    expect(t.TARGET_LOCALE).toBe('nl-NL');
    expect(t.VOICE_BASE).toBe('voice-nl/');
    expect(t.TARGET_OWN_NAME).toBe('Nederlands');
    expect(t.scenarioById('ams_cafe')).toBeDefined();
    expect(t.scenarioById('berlin_bakery')).toBeUndefined();
    expect(t.scenarioById('konbini')).toBeUndefined();
    expect(t.CHARACTERS.map((c) => c.id)).toContain('femke');
    expect(t.segmentFree('twee koffie, graag').map((x) => x.s)).toEqual(['twee', 'koffie', ',', 'graag']);
    expect(targetLanguage().id).toBe('nl');
    expect(PACK).toBe(AMSTERDAM_PACK);
  });

  it('speaks of Dutch and Amsterdam in the app’s own words, and writes amounts the Dutch way', async () => {
    putSaved('lw.target', 'nl');
    const { translate } = await import('../src/i18n');
    expect(translate('en', 'app.tagline')).toBe('Walk around Amsterdam. Talk to people. Learn Dutch by using it.');
    expect(translate('en', 'audio.speaker.noVoice')).toBe('No Dutch voice installed');
    expect(translate('ar', 'audio.speaker.noVoice')).toContain('هولندي');
    expect(translate('en', 'quests.reward', { n: '3,000' })).toBe('Reward: € 30,00');
    expect(translate('en', 'quests.reward', { n: 123456 })).toBe('Reward: € 1.234,56');
    // the pickers name every language in its own words, whatever is learned
    expect(translate('en', 'ob.learn.ja')).toBe('Japanese in Tokyo');
    expect(translate('en', 'ob.learn.nl')).toBe('Dutch in Amsterdam');
  });

  it('prices in conversations read the Dutch way, and a quoted price reads back as cents', async () => {
    putSaved('lw.target', 'nl');
    const { yenVar } = await import('../src/game/convoHooks');
    const v = yenVar(250);
    expect(v.gloss?.en).toBe('€2.50');
    expect(v.ja).toContain('2,50');
  });

  it('starts the Dutch notebook with Dutch greetings', async () => {
    putSaved('lw.target', 'nl');
    const { useStore } = await import('../src/store');
    useStore.getState().completeOnboarding({ name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: ['food', 'music', 'travel'], avatar: {} as never, createdAt: new Date().toISOString() });
    expect(useStore.getState().vocab.map((v) => v.s)).toEqual(['Hallo!', 'Goedemorgen!', 'Graag.', 'Dank u wel!', 'Doei!']);
    expect(saved('lw.v1.state')).toBeNull();
  });

  it('keeps Tokyo’s lessons and Mini-theatre out of Amsterdam’s menu, and offers all three languages', async () => {
    putSaved('lw.target', 'nl');
    const nl = await import('../src/game/worldSync');
    expect(nl.menuIds({ friends: true, phoneIcon: false })).toEqual({ play: ['quests', 'friends', 'wallet'], study: ['vocab', 'stats', 'settings'] });
    const t = await import('../src/target');
    expect(t.TARGETS).toEqual(['ja', 'de', 'nl']);
    expect(t.TARGET_NAMES).toEqual({ ja: '日本語', de: 'Deutsch', nl: 'Nederlands' });
  });
});
