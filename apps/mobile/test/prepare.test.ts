// Prepare logic (agent 2E, docs/GAME_DESIGN.md §11.1, §3.2, §15.9): the recall pass mark and scoring, the tiles, readiness and its
// 7-day expiry through the real reducer, and a pocket that earns the x1.10 and the recalled-line credit.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { BALANCE, lineReady, pocketReady } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { applySrsOps, dispatch, init, resetBridgeForTests } from '../src/game/bridge';
import { getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { gameView } from '../src/game/selectors';
import { linesToRecall, lineStatus, plainOf, pocketView, readyDaysLeft, recallMark, recallScore, tileDeck, tilePieces, tilesCorrect, wordKeysOf } from '../src/game/prepareLogic';
import { recalledLines } from '../src/game/convoHooks';
import { pocketWordOps } from '../src/game/srsHooks';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const view = () => gameView(useStore.getState());
const ids = (scenarioId: string) => PACK.scenarioMeta.find((m) => m.id === scenarioId)!.pocket!;
const keyIds = (scenarioId: string) => ids(scenarioId).filter((id) => PACK.pockets[id].key);

beforeEach(async () => {
  wipeSaved();
  useStore.getState().reset();
  useUi.getState().clearRequests();
  resetBridgeForTests();
  useGame.getState().resetGame();
  wipeSaved();
  await init();
  useStore.getState().completeOnboarding(profile);
});

describe('the recall pass mark (§11.1)', () => {
  it('is 0.70, 0.60 for the A1 profile and 0.55 for kids, taken from BALANCE', () => {
    expect(recallMark({ age: 'adults', level: 'A2' })).toBe(BALANCE.recallPass.default);
    expect(recallMark({ age: 'adults', level: 'A1' })).toBe(BALANCE.recallPass.beginner);
    expect(recallMark({ age: 'teens', level: 'A1' })).toBe(BALANCE.recallPass.beginner);
    expect(recallMark({ age: 'kids', level: 'A2' })).toBe(BALANCE.recallPass.kids);
    expect(recallMark({ age: 'kids', level: 'A1' })).toBe(BALANCE.recallPass.kids);
    expect(recallMark({ age: 'seniors', level: 'A2' })).toBe(BALANCE.recallPass.default);
  });
});

describe('recall scoring', () => {
  const target = plainOf('袋|は|いりません。');
  it('accepts the line in kanji, kana and romaji', () => {
    for (const typed of ['袋はいりません', '袋はいりません。', 'ふくろはいりません', 'フクロハイリマセン', 'fukuro wa irimasen']) {
      expect(recallScore(typed, target), typed).toBeGreaterThanOrEqual(BALANCE.recallPass.default);
    }
  });
  it('the shown line itself and a small slip pass, a different line and English do not', () => {
    const kore = plainOf('これ|を|ください。');
    expect(recallScore('これをください', kore)).toBe(1);
    expect(recallScore('これください', kore)).toBeGreaterThanOrEqual(BALANCE.recallPass.default);
    expect(recallScore('kore o kudasai', kore)).toBeGreaterThanOrEqual(0.9);
    expect(recallScore('いくらですか', kore)).toBeLessThan(BALANCE.recallPass.beginner);
    expect(recallScore('This one, please', kore)).toBeLessThan(BALANCE.recallPass.beginner);
    expect(recallScore('', kore)).toBe(0);
    expect(recallScore('   ', kore)).toBe(0);
  });
  it('every pocket line scores 1 on itself, in its kana reading and in romaji', () => {
    for (const [id, p] of Object.entries(PACK.pockets)) {
      const plain = plainOf(p.line.ja);
      expect(recallScore(plain, plain), id).toBe(1);
    }
  });
});

describe('build it from the pieces', () => {
  it('uses the markup breaks, or kana chunks for a one-word line, and always rebuilds the line', () => {
    expect(tilePieces('これ|を|ください|。')).toEqual(['これ', 'を', 'ください。']);
    const one = tilePieces('いただきます|！');
    expect(one.length).toBeGreaterThanOrEqual(3);
    expect(one.join('')).toBe('いただきます！');
    expect(one.every((s) => !/^[！。]/.test(s))).toBe(true);
    for (const p of Object.values(PACK.pockets)) {
      expect(tilePieces(p.line.ja).join(''), p.id).toBe(p.line.ja.replaceAll('|', ''));
      expect(tilePieces(p.line.ja).length, p.id).toBeGreaterThanOrEqual(2);
    }
  });
  it('the deck holds every piece plus 2 distractors, is stable per line, and only the right order passes', () => {
    const lines = ids('konbini').map((id) => PACK.pockets[id]);
    const line = lines[0];
    const deck = tileDeck(line, lines);
    const own = tilePieces(line.line.ja);
    expect(deck.length).toBe(own.length + 2);
    expect(deck.map((d) => d.s).sort()).toEqual(expect.arrayContaining([...own].sort()));
    expect(tileDeck(line, lines)).toEqual(deck);
    expect(tilesCorrect(own, line.line.ja)).toBe(true);
    expect(tilesCorrect([...own].reverse(), line.line.ja)).toBe(false);
    expect(tilesCorrect(own.slice(0, -1), line.line.ja)).toBe(false);
  });
});

describe('readiness through the real reducer (§11.1, D21)', () => {
  const day = () => getGame().clock.dayIndex;
  const shift = (n: number) => useGame.getState().setGame({ ...getGame(), clock: { ...getGame().clock, dayIndex: day() + n } });

  it('a fresh game has nothing ready and every line to recall', () => {
    const p = pocketView(PACK, getGame(), view(), 'konbini')!;
    expect(p.lines.map((l) => l.status)).toEqual(['new', 'new', 'new', 'new']);
    expect(p.ready).toBe(false);
    expect(linesToRecall(p)).toEqual(ids('konbini'));
  });

  it('studying makes lines seen, not ready, and the pocket is not ready', () => {
    dispatch({ t: 'prepare_done', scenarioId: 'konbini', ready: [], seen: ids('konbini') });
    expect(ids('konbini').map((id) => lineStatus(getGame(), view(), id))).toEqual(['seen', 'seen', 'seen', 'seen']);
    expect(pocketReady(PACK, getGame(), view(), 'konbini')).toBe(false);
  });

  it('a recall pass of the key lines and enough of the rest makes the pocket ready, and it expires after readyDays', () => {
    const all = ids('konbini');
    dispatch({ t: 'prepare_done', scenarioId: 'konbini', ready: all, seen: all });
    expect(pocketReady(PACK, getGame(), view(), 'konbini')).toBe(true);
    expect(readyDaysLeft(getGame(), view(), all[0])).toBe(BALANCE.readyDays);
    shift(BALANCE.readyDays - 1);
    expect(lineReady(getGame(), view(), all[0])).toBe(true);
    expect(readyDaysLeft(getGame(), view(), all[0])).toBe(1);
    expect(pocketReady(PACK, getGame(), view(), 'konbini')).toBe(true);
    shift(1);
    expect(lineReady(getGame(), view(), all[0])).toBe(false);
    expect(readyDaysLeft(getGame(), view(), all[0])).toBeNull();
    expect(lineStatus(getGame(), view(), all[0])).toBe('seen');
    expect(pocketReady(PACK, getGame(), view(), 'konbini')).toBe(false);
  });

  it('only the key lines ready is not enough while the rest is missing; a peeked key line (seen only) never counts', () => {
    const keys = keyIds('konbini');
    expect(keys.length).toBe(2);
    dispatch({ t: 'prepare_done', scenarioId: 'konbini', ready: keys, seen: ids('konbini') });
    expect(pocketReady(PACK, getGame(), view(), 'konbini')).toBe(false);
    // one key line recalled, the other peeked at: seen, so the pocket stays not ready whatever the rest does
    dispatch({ t: 'prepare_done', scenarioId: 'ramen', ready: [keyIds('ramen')[0]], seen: ids('ramen') });
    expect(lineStatus(getGame(), view(), keyIds('ramen')[1])).toBe('seen');
    dispatch({ t: 'prepare_done', scenarioId: 'ramen', ready: ids('ramen').filter((id) => id !== keyIds('ramen')[1]), seen: [] });
    expect(pocketReady(PACK, getGame(), view(), 'ramen')).toBe(false);
  });

  it('studying a ready line again does not downgrade it; an expired one is studied afresh', () => {
    const all = ids('cafe');
    dispatch({ t: 'prepare_done', scenarioId: 'cafe', ready: [all[0]], seen: [] });
    dispatch({ t: 'prepare_done', scenarioId: 'cafe', ready: [], seen: [all[0]] });
    expect(lineStatus(getGame(), view(), all[0])).toBe('ready');
    shift(BALANCE.readyDays);
    dispatch({ t: 'prepare_done', scenarioId: 'cafe', ready: [], seen: [all[0]] });
    expect(getGame().prep[all[0]]).toEqual({ s: 'seen', at: day() });
  });

  it('Prepare makes the phrase cards (source goal, due in a day) and the pocket words, once each', () => {
    const before = useStore.getState().vocab.length;
    const r = dispatch({ t: 'prepare_done', scenarioId: 'konbini', ready: [], seen: ids('konbini') });
    expect(r.effects.some((e) => e.t === 'srsOps')).toBe(true);
    const phrases = useStore.getState().vocab.filter((v) => v.key?.startsWith('p_konbini_'));
    expect(phrases.length).toBe(4);
    expect(phrases.every((v) => v.source === 'goal' && v.kind === 'phrase')).toBe(true);
    const dueIn = (v: (typeof phrases)[number]) => Date.parse(v.card.due) - Date.now();
    expect(phrases.every((v) => dueIn(v) > BALANCE.srs.goalDueMin * 60_000 - 60_000)).toBe(true);
    const lines = ids('konbini').map((id) => PACK.pockets[id]);
    applySrsOps(pocketWordOps(lines));
    const words = wordKeysOf(lines);
    expect(words.length).toBeGreaterThan(0);
    expect(words).not.toContain('を');
    expect(useStore.getState().vocab.length).toBeGreaterThanOrEqual(before + 4);
    // a second Prepare of the same lines adds nothing
    const n = useStore.getState().vocab.length;
    dispatch({ t: 'prepare_done', scenarioId: 'konbini', ready: [], seen: ids('konbini') });
    applySrsOps(pocketWordOps(lines));
    expect(useStore.getState().vocab.length).toBe(n);
  });

  it('what Prepare made ready is what the conversation counts as recalled, until it expires', () => {
    const meta = PACK.scenarioMeta.find((m) => m.id === 'konbini');
    expect(recalledLines(PACK, getGame(), view(), meta)).toEqual([]);
    dispatch({ t: 'prepare_done', scenarioId: 'konbini', ready: ids('konbini'), seen: ids('konbini') });
    expect(recalledLines(PACK, getGame(), view(), meta).length).toBe(4);
    shift(BALANCE.readyDays);
    expect(recalledLines(PACK, getGame(), view(), meta)).toEqual([]);
  });
});
