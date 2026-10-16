// Release 2 wave C1 (docs/RELEASE_2.md): Chapters 5 and 6 become playable. The data of the Hikarigaoka trip, the café and station jobs, the
// chapter beats, the Real-mode try, the culture cards and the cap, over the real pack. The conversations are played in
// packages/engine/test/c1-trip-jobs.test.ts; the release cap itself is in release.test.ts.
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  createGameState,
  evaluateAll,
  evalPred,
  fareFor,
  generateShift,
  ownedQty,
  reduce,
  scoreShift,
  shiftPay,
  validatePack,
  type ContentIndex,
  type CustomerTemplate,
  type GameState,
  type GameView,
  type Line,
  type ShiftResult,
} from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, SCENARIOS, SLOTS, scenarioById, tokenize, yenToJa } from '../src';
import { FARES } from '../src/tokyo/game/fares';
import { BEATS } from '../src/tokyo/game/beats';
import { REAL_TRY } from '../src/tokyo/game/beats/beats-story';
import { CULTURE } from '../src/tokyo/game/culture';
import { KATO_PRICES } from '../src/tokyo/scenarios-story';

const NOW = new Date(2030, 0, 15, 12).getTime();
const VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
};
const ctx = { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 };
const hasAr = (s: string) => /[؀-ۿ]/.test(s);
const resolves = (ja: string): string[] => tokenize(ja.replace(/\{\w+\}/g, ''), LEXICON).missing ?? [];
const noGap = (line: Line, where: string) => {
  const t = tokenize(line.ja.replace(/\{\w+\}/g, ''), LEXICON);
  expect(t.missing ?? [], `${where}: unknown words`).toEqual([]);
  expect(t.tokens.filter((x) => !x.punct && !x.raw && !x.gloss).map((x) => x.s), `${where}: tokens without a gloss`).toEqual([]);
  expect(line.en.trim() && hasAr(line.ar), `${where}: EN + AR`).toBeTruthy();
};
const job = (id: string) => JP_PACK.jobs.find((j) => j.id === id)!;
const menuOf = (ref: string) => JP_PACK.menu.find((m) => m.id === ref || (m.shop === 'cafe' && m.option === ref))!;
const totalOf = (c: CustomerTemplate): number => (c.task.kind === 'order' ? c.task.items.reduce((s, i) => s + menuOf(i.menu).price * i.qty, 0) : 0);
const said = (a: CustomerTemplate) => a.line.ja.replace(/\|/g, '');

// ---------------------------------------------------------------------------------------------------------------------------------
describe('job_cafe (Yuki, §9.3)', () => {
  const cafe = job('job_cafe');

  it('is Yuki\'s job at the café with the §9.2 wage, a short shift, and opens with Chapter 3', () => {
    expect(cafe).toMatchObject({ place: 'cafe', boss: 'yuki', wage: 1200, hours: BALANCE.shift.hours, intro: 'jobintro_cafe' });
    expect(cafe.name.en && hasAr(cafe.name.ar)).toBeTruthy();
    expect(JP_PACK.chapters[2]!.opens).toContainEqual({ kind: 'job', id: 'job_cafe' });
    expect(JP_PACK.friends.find((f) => f.id === 'yuki')).toBeTruthy();
    expect(JP_PACK.wordTags).toMatchObject({});
    for (const t of cafe.vocabTags) expect(JP_PACK.wordTags[t], t).toBeTruthy();
  });

  it('has the archetypes of §9.3 (c_one, c_two, c_change, c_split) and enough of each tier; tier 4 needs rank 2', () => {
    const ids = cafe.archetypes.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['c_one', 'c_two', 'c_change', 'c_split']) expect(ids, id).toContain(id);
    const tier = (n: number) => cafe.archetypes.filter((a) => a.tier === n);
    expect(tier(1).length).toBeGreaterThanOrEqual(BALANCE.shift.variety.archetypesMin);
    for (const n of [2, 3]) expect(tier(n).length, `tier ${n}`).toBeGreaterThanOrEqual(2);
    expect(tier(4).length).toBeGreaterThanOrEqual(2);
    for (const a of tier(4)) expect(a.minRank, a.id).toBe(2);
    expect(cafe.archetypes.find((a) => a.id === 'c_one')!.tier).toBe(1);
    expect(cafe.archetypes.find((a) => a.id === 'c_two')!.tier).toBe(2);
    expect(cafe.archetypes.find((a) => a.id === 'c_change')!.tier).toBe(3);
    expect(cafe.archetypes.find((a) => a.id === 'c_split')!.tier).toBe(4);
  });

  it('every cart is on the café menu, the line says what is ordered, and the toggles are the four the Shift screen knows', () => {
    for (const a of cafe.archetypes) {
      expect(a.task.kind, a.id).toBe('order');
      if (a.task.kind !== 'order') continue;
      const text = said(a);
      for (const i of a.task.items) {
        const m = menuOf(i.menu);
        expect(m, `${a.id}: ${i.menu}`).toBeTruthy();
        expect(m.shop).toBe('cafe');
        expect(i.qty).toBeGreaterThanOrEqual(1);
        expect(i.qty).toBeLessThanOrEqual(3);
        expect(text, `${a.id}: ${i.menu}`).toContain(m.name.ja);
      }
      const toggles = a.task.toggles ?? [];
      for (const t of toggles) expect(t, a.id).toMatch(/^(hot|iced|split|table:[1-6])$/);
      // hot and iced are one choice: a customer names at most one in the end (a change of mind leaves the last word)
      expect(toggles.filter((t) => t === 'hot' || t === 'iced').length, a.id).toBeLessThanOrEqual(1);
      if (toggles.includes('iced')) expect(text, a.id).toContain('アイス');
      if (toggles.includes('hot')) expect(text, a.id).toContain('ホット');
      for (const t of toggles.filter((x) => x.startsWith('table:'))) expect(text, a.id).toContain(`${yenNum(Number(t.slice(6)))}番`);
      if (toggles.includes('split')) expect(a.task.items, a.id).toHaveLength(2);
      if (a.change) {
        expect(a.change.paid, a.id).toBeGreaterThan(totalOf(a));
        expect(text, a.id).toContain('千円');
      }
      expect(totalOf(a) % 10, a.id).toBe(0);
      expect(a.thanks.length, a.id).toBeGreaterThanOrEqual(2);
      expect(a.tiles, a.id).toHaveLength(2);
    }
  });

  it('a change of mind leaves the LAST drink: the latte turned iced, the coffee turned black tea', () => {
    const c = (id: string) => cafe.archetypes.find((a) => a.id === id)!;
    expect(c('c_change').task).toMatchObject({ kind: 'order', items: [{ menu: 'cafe:latte', qty: 1 }], toggles: ['iced'] });
    expect(c('c_change2').task).toMatchObject({ kind: 'order', items: [{ menu: 'cafe:blackTea', qty: 1 }] });
    expect(said(c('c_change2'))).toMatch(/コーヒー.*紅茶/);
  });

  it('every customer line, staff phrase and tile is Japanese the lexicon can show, with English and Arabic; a repeat-back is the first staff phrase of c_one', () => {
    for (const a of cafe.archetypes) {
      noGap(a.line, a.id);
      for (const th of a.thanks) expect(resolves(th), `${a.id} thanks ${th}`).toEqual([]);
      for (const tile of a.tiles ?? []) expect(resolves(tile), `${a.id} tile ${tile}`).toEqual([]);
      noGap({ ja: `${yenToJa(totalOf(a)).markup}|です|。`, en: 'x', ar: 'ع' }, `${a.id} total`);
    }
    expect(cafe.archetypes.find((a) => a.id === 'c_one')!.thanks[0]).toBe('ホット|の|カフェラテ|が|ひとつ|です|ね|。');
  });

  it('the bonus is a free café coffee, a perfect shift only; the totals of a plan are the menu prices', () => {
    expect(cafe.bonus).toEqual({ itemId: 'cafe:coffee', needsPerfect: true });
    expect(menuOf('cafe:coffee')).toBeTruthy();
    for (const c of generateShift(JP_PACK, 'job_cafe', { rank: 4, seed: 9, dueWords: [], recent: [] }).customers) {
      expect(c.total).toBe(totalOf(cafe.archetypes.find((a) => a.id === c.templateId)!));
    }
  });
});

const yenNum = (n: number): string => ['', '一', '二', '三', '四', '五', '六'][n]!;

// ---------------------------------------------------------------------------------------------------------------------------------
describe('job_station (Sato, §9.3)', () => {
  const st = job('job_station');
  const t = (id: string) => st.archetypes.find((a) => a.id === id)!;

  it('is Sato\'s job at the station with the §9.2 wage and opens with Chapter 5', () => {
    expect(st).toMatchObject({ place: 'station', boss: 'sato', wage: 1400, hours: BALANCE.shift.hours, intro: 'jobintro_station' });
    expect(JP_PACK.chapters[4]!.opens).toContainEqual({ kind: 'job', id: 'job_station' });
    expect(JP_PACK.chapters[2]!.opens).not.toContainEqual({ kind: 'job', id: 'job_station' });
    expect(JP_PACK.friends.find((f) => f.id === 'sato')).toBeTruthy();
    for (const tag of st.vocabTags) expect(JP_PACK.wordTags[tag], tag).toBeTruthy();
  });

  it('has the archetypes of §9.3 (s_platform, s_dir, s_time, s_fare, s_announce) with their tiers, and tier 4 from rank 2', () => {
    expect(new Set(st.archetypes.map((a) => a.id)).size).toBe(st.archetypes.length);
    expect([t('s_platform').tier, t('s_dir').tier, t('s_time').tier, t('s_fare').tier, t('s_announce').tier]).toEqual([1, 1, 2, 3, 4]);
    expect(st.archetypes.filter((a) => a.tier === 1).length).toBeGreaterThanOrEqual(BALANCE.shift.variety.archetypesMin);
    for (const a of st.archetypes.filter((x) => x.tier === 4)) expect(a.minRank, a.id).toBe(2);
    expect(new Set(st.archetypes.map((a) => a.task.kind))).toEqual(new Set(['platform', 'direction', 'time', 'fare', 'announce']));
  });

  it('every answer is something the widgets can show: a platform 1-4, a direction, a clock time, a fare of the pack, the platform of the announcement', () => {
    for (const a of st.archetypes) {
      const k = a.task.kind;
      expect(k, a.id).not.toBe('order');
      if (a.task.kind === 'order') continue;
      const ans = a.task.answer;
      const text = said(a);
      if (k === 'platform' || k === 'announce') {
        expect([1, 2, 3, 4], a.id).toContain(ans);
        if (k === 'announce') expect(text, a.id).toContain(`${yenNum(Number(ans))}番線`);
      }
      if (k === 'direction') expect(['right', 'left', 'straight'], a.id).toContain(ans);
      if (k === 'time') expect(String(ans), a.id).toMatch(/^([01]?\d|2[0-3]):[0-5]\d$/);
      if (k === 'fare') {
        const entries = Object.entries(FARES).filter(([, v]) => v === (text.includes('切符') ? Number(ans) - BALANCE.fares.paperExtra : Number(ans)));
        expect(entries.length, `${a.id}: ${ans}`).toBeGreaterThan(0);
        // the destination the line names has exactly this fare
        const dest = SLOTS.place!.find((o) => text.includes(o.ja) || text.includes(o.keys.ja[0]!))?.id;
        expect(dest, a.id).toBeTruthy();
        expect(Number(ans), a.id).toBe(FARES[dest!]! + (text.includes('切符') ? BALANCE.fares.paperExtra : 0));
      }
    }
    // the platform of the Hikarigaoka customer is the trip's platform: one place, one number
    expect(t('s_platform')).toMatchObject({ task: { kind: 'platform', answer: 3 } });
    expect(said(t('s_platform'))).toContain('光が丘');
    expect(t('s_fare').task).toMatchObject({ kind: 'fare', answer: FARES.hikarigaoka });
    expect(t('s_fare2').task).toMatchObject({ kind: 'fare', answer: FARES.shinjuku! + BALANCE.fares.paperExtra });
  });

  it('every customer line, staff phrase and tile is Japanese the lexicon can show, with English and Arabic', () => {
    for (const a of st.archetypes) {
      noGap(a.line, a.id);
      expect(a.thanks[0], a.id).toBe('お気をつけて|。');
      for (const th of a.thanks) expect(resolves(th), `${a.id} thanks ${th}`).toEqual([]);
      for (const tile of a.tiles ?? []) expect(resolves(tile), `${a.id} tile ${tile}`).toEqual([]);
      expect(a.tiles, a.id).toHaveLength(2);
    }
  });

  it('what the desk SAYS back is Japanese the lexicon can show for every platform, direction, time and fare a customer can ask', () => {
    const num = (n: number) => yenToJa(n).markup.replace(/\|円$/, '');
    const gaps: string[] = [];
    const check = (markup: string, where: string) => {
      for (const m of resolves(markup)) gaps.push(`${where}: ${m}`);
    };
    for (const n of [1, 2, 3, 4]) check(`${num(n)}|番線|です|。`, `platform ${n}`);
    for (const d of ['右', 'まっすぐ', '左']) check(`${d}|です|。`, d);
    for (const a of st.archetypes) {
      if (a.task.kind === 'time') {
        const [h, m] = String(a.task.answer).split(':').map(Number);
        check(`${num(h!)}|時|${m ? `${num(m)}|分|` : ''}です|。`, `time ${a.task.answer}`);
      }
      if (a.task.kind === 'fare') check(`${yenToJa(Number(a.task.answer)).markup}|です|。`, `fare ${a.task.answer}`);
    }
    expect(gaps).toEqual([]);
  });

  it('the bonus is an omiyage (the gift Kato sells, which the hand-over can name), a perfect shift only', () => {
    expect(st.bonus).toEqual({ itemId: 'g_souvenir', needsPerfect: true });
    const it = JP_PACK.items.find((i) => i.id === 'g_souvenir')!;
    expect(it.cat).toBe('gift');
    expect(it.shop).toBe('kato');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the plans and the pay of the two new jobs (§9.1, §9.2)', () => {
  for (const id of ['job_cafe', 'job_station'] as const) {
    const j = job(id);
    const plan = (o: Partial<Parameters<typeof generateShift>[2]> = {}) => generateShift(JP_PACK, id, { rank: 0, seed: 1, dueWords: [], recent: [], ...o });

    it(`${id}: five customers, at least four different ones, tiers by rank, every archetype reachable at rank 4`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const p0 = plan({ seed });
        expect(p0.customers).toHaveLength(5);
        expect(new Set(p0.customers.map((c) => c.templateId)).size).toBeGreaterThanOrEqual(4);
        for (const c of p0.customers) expect(j.archetypes.find((a) => a.id === c.templateId)!.tier, `rank 0: ${c.templateId}`).toBeLessThanOrEqual(1);
        for (const c of plan({ seed, rank: 1 }).customers) expect(j.archetypes.find((a) => a.id === c.templateId)!.tier).toBeLessThanOrEqual(2);
        for (const c of plan({ seed, rank: 2 }).customers) expect(j.archetypes.find((a) => a.id === c.templateId)!.minRank).toBeLessThanOrEqual(2);
      }
      const seen = new Set(Array.from({ length: 80 }, (_, s) => plan({ seed: s + 1, rank: 4 }).customers.map((c) => c.templateId)).flat());
      expect(seen.size).toBe(j.archetypes.length);
    });

    it(`${id}: a seeded plan is stable and the same customers do not come back within three shifts`, () => {
      expect(plan({ seed: 5 })).toEqual(plan({ seed: 5 }));
      const first = plan({ rank: 4, seed: 11 }).customers.map((c) => c.templateId);
      const next = plan({ rank: 4, seed: 12, recent: first }).customers.map((c) => c.templateId);
      expect(next.filter((x) => first.includes(x)).length).toBeLessThanOrEqual(1);
    });
  }

  const result = (jobId: string, input: 'typed' | 'pick'): ShiftResult => ({
    id: 'r',
    jobId,
    quit: false,
    durationSec: 200,
    assistWaived: true,
    customers: Array.from({ length: 5 }, () => ({
      templateId: 'x',
      served: true,
      assist: 'none' as const,
      tasks: [
        { kind: 'order' as const, ok: true },
        { kind: 'total' as const, ok: true, input },
        { kind: 'thanks' as const, ok: true, input },
      ],
    })),
  });

  it('a full-skill rank-0 shift pays ¥900 at the café and ¥1,050 at the station, rank 4 ¥1,190 and ¥1,390, all chips ¥310 and ¥360 (the §9.2 table)', () => {
    const pay = (id: string, input: 'typed' | 'pick', rank = 0) => shiftPay(job(id), scoreShift(result(id, input)), rank, 1, JP_PACK);
    expect(pay('job_cafe', 'typed')).toBe(900);
    expect(pay('job_cafe', 'typed', 4)).toBe(1190);
    expect(pay('job_cafe', 'pick')).toBe(310);
    expect(pay('job_station', 'typed')).toBe(1050);
    expect(pay('job_station', 'typed', 4)).toBe(1390);
    expect(pay('job_station', 'pick')).toBe(360);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the interactions of Chapters 3, 5 and 6', () => {
  const rows = Object.values(JP_PACK.interactions).flat();
  const row = (id: string) => rows.find((r) => r.id === id)!;

  it('the café and station shift rows are in the released table now, with their jobs; the table lists them from the chapter that opens the job', () => {
    expect(row('yuki_shift')).toMatchObject({ kind: 'shift', jobId: 'job_cafe', ch: 3 });
    expect(row('sato_shift')).toMatchObject({ kind: 'shift', jobId: 'job_station', ch: 5 });
    expect(row('tanaka_shift')).toMatchObject({ kind: 'shift', jobId: 'job_konbini', ch: 2 });
    for (const r of rows.filter((x) => x.kind === 'shift')) expect(JP_PACK.jobs.some((j) => j.id === r.jobId), r.id).toBe(true);
  });

  it('the trip row (Sato) and the trip-only row (Kato) point at the registered trip scenario', () => {
    expect(row('trip_hikarigaoka')).toMatchObject({ kind: 'trip', scenarioId: 'trip_hikarigaoka', ch: 5 });
    expect(row('kato_trip')).toMatchObject({ kind: 'scenario', scenarioId: 'trip_hikarigaoka' });
    expect(scenarioById('trip_hikarigaoka')?.characterId).toBe('kato');
  });

  it('the chapter 5 and 6 opens name rows and places that exist, and no chapter opens the same thing twice', () => {
    const rowIds = new Set(rows.map((r) => r.id));
    const seen = new Map<string, number>();
    for (const c of JP_PACK.chapters) {
      for (const o of c.opens) {
        const key = `${o.kind}:${o.id}`;
        expect(seen.has(key), `${key} opens in chapter ${seen.get(key)} and ${c.n}`).toBe(false);
        seen.set(key, c.n);
        if (o.kind === 'interaction') expect(rowIds.has(o.id), `${c.n}: ${o.id}`).toBe(true);
        if (o.kind === 'job') expect(JP_PACK.jobs.some((j) => j.id === o.id), `${c.n}: ${o.id}`).toBe(true);
      }
    }
    // the trip, the station job and the garage open with Chapter 5, the visits and the viewing with Chapter 6
    for (const [n, ids] of [[5, ['trip_hikarigaoka', 'sato_shift', 'nakamura_visit', 'nakamura_bike']], [6, ['home_mio', 'home_aiko', 'home_kenji', 'aiko_viewing', 'aiko_contract']]] as const) {
      const opens = JP_PACK.chapters[n - 1]!.opens;
      for (const id of ids) expect(opens, `${n}: ${id}`).toContainEqual({ kind: 'interaction', id });
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('Chapters 5 and 6 as the design table has them (§7.2)', () => {
  const ch = (n: number) => JP_PACK.chapters[n - 1]!;

  it('Chapter 5: four objectives and the dream slot, with the easier alternative on the own-words one', () => {
    expect(ch(5)).toMatchObject({ n: 5, minDays: 10, reward: 5000, rewardTitle: 't_traveller' });
    expect(ch(5).objectives.map((o) => o.id)).toEqual(['c5_1', 'c5_2', 'c5_3', 'c5_4', 'c5_dream']);
    expect(ch(5).objectives[0]!.pred).toEqual({ k: 'visit', place: 'trip:hikarigaoka' });
    expect(ch(5).objectives[1]).toMatchObject({ pred: { k: 'scenario', id: 'sato_directions', minIndependent: 3 }, easier: { pred: { k: 'scenario', id: 'sato_directions', minIndependent: 2 }, afterTries: 3 } });
    expect(ch(5).objectives[2]!.pred).toEqual({ k: 'shift', job: 'job_station', n: 1, minAcc: 0.6 });
    expect(ch(5).objectives[3]!.pred).toEqual({ k: 'scenario', id: 'motors_visit', complete: true });
    expect(ch(5).rewardCulture).toEqual(['cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse']);
  });

  it('Chapter 6: starts at one friend with three hearts, four objectives, the reward and the guest title', () => {
    expect(ch(6)).toMatchObject({ n: 6, minDays: 14, reward: 6000, rewardTitle: 't_guest', startGate: { k: 'hearts_count', atLeast: 3, n: 1 } });
    expect(ch(6).objectives.map((o) => o.id)).toEqual(['c6_1', 'c6_2', 'c6_3', 'c6_4', 'c6_dream']);
    expect(ch(6).objectives[0]!.pred).toEqual({ k: 'hearts_count', atLeast: 4, n: 1 });
    expect(ch(6).objectives[1]!.pred).toEqual({ k: 'visit', place: 'home:*' });
    expect(ch(6).objectives[2]!.pred).toEqual({ k: 'scenario', id: 'aiko_viewing', complete: true });
    expect(ch(6).objectives[3]!.pred).toEqual({ k: 'shift', n: 5, minAcc: 0.6 });
    expect(ch(6).rewardCulture).toEqual(['cc_shoesoff', 'cc_rent', 'cc_trash']);
  });

  it('every objective has English and Arabic text; the chapters keep their minimum days in order; no objective needs a day after its own minimum', () => {
    for (const c of [ch(5), ch(6)]) for (const o of c.objectives) expect(o.text.en.trim() && hasAr(o.text.ar), o.id).toBeTruthy();
    expect(JP_PACK.chapters.map((c) => c.minDays)).toEqual([1, 2, 4, 7, 10, 14]);
    // the jobs the shift objectives count are open by the chapter that asks: konbini 2, café 3, station 5; c6_4 (5 shifts in total) can be met
    // by two shifts a day (BALANCE.shift.dailyMax) on three days, long before day 14
    expect(BALANCE.shift.dailyMax * Math.ceil(5 / BALANCE.shift.dailyMax)).toBeGreaterThanOrEqual(5);
    const opensAt = (kind: string, id: string) => JP_PACK.chapters.find((c) => c.opens.some((o) => o.kind === kind && o.id === id))!.n;
    expect([opensAt('job', 'job_konbini'), opensAt('job', 'job_cafe'), opensAt('job', 'job_station')]).toEqual([2, 3, 5]);
  });

  it('the bot level (validatePack 4) finishes every chapter with only what is open at its start, and every prerequisite of c5 and c6 is open', () => {
    const allNodes = (s: { nodes: Record<string, unknown> }) => Object.values(s.nodes) as Array<{ intents: Array<{ id: string }> }>;
    const index: ContentIndex = {
      scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: allNodes(s).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }])),
      lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
      slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
      characters: CHARACTERS.map((c) => c.id),
    };
    expect(validatePack(JP_PACK, { level: 4, index }).filter((i) => i.severity === 'error')).toEqual([]);
    // (the proof bites: without the trip scenario Chapter 5 cannot be finished)
    const noTrip = { ...JP_PACK, interactions: { ...JP_PACK.interactions, sato: JP_PACK.interactions.sato!.filter((r) => r.id !== 'trip_hikarigaoka'), kato: [] } };
    const codes = validatePack(noTrip, { level: 4, index }).map((i) => i.code);
    expect(codes.some((c) => c === 'bot_unreachable' || c === 'prereq_unmet' || c.startsWith('prereq') || c === 'dream_blocked')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the beats of Chapters 4-6 and the Real-mode try', () => {
  const ids = ['b_ch4_close', 'b_ch5_open', 'b_ch5_close', 'b_ch6_open', 'b_ch6_close', 'b_ch6_close_flat', 'b_real_try', 'b_release_epilogue'];
  const chars = new Set(CHARACTERS.map((c) => c.id));

  it('each exists, has lines by registered characters, and every line has Japanese, English and Arabic with only lexicon words, each piece on its own', () => {
    for (const id of ids) {
      const b = BEATS[id];
      expect(b, id).toBeDefined();
      expect(b!.lines.length, id).toBeGreaterThan(0);
      expect(b!.lines.length, id).toBeLessThanOrEqual(4);
      for (const [i, l] of b!.lines.entries()) {
        expect(chars.has(l.who), `${id}[${i}]: ${l.who}`).toBe(true);
        noGap(l.line, `${id}[${i}]`);
        // level 5 reads a beat piece by piece: punctuation stands alone between the bars
        for (const piece of l.line.ja.split('|')) expect(/^[。、！？]/.test(piece) && piece.length > 1, `${id}[${i}]: "${piece}" has punctuation glued to a word`).toBe(false);
      }
    }
  });

  it('Chapter 5 opens with Sato at the station (the IC card, then Hikarigaoka) and closes on the Hikarigaoka platform: 「ご乗車ありがとうございました」', () => {
    expect(BEATS.b_ch5_open!).toMatchObject({ place: 'station' });
    expect(BEATS.b_ch5_open!.lines.map((l) => l.who)).toEqual(['sato', 'sato']);
    expect(BEATS.b_ch5_open!.lines[1]!.line.ja.replace(/\|/g, '')).toBe('光が丘まで行きませんか？');
    expect(BEATS.b_ch5_close!.place).toBe('hikarigaoka');
    expect(BEATS.b_ch5_close!.lines[0]!.line.ja.replace(/\|/g, '')).toBe('ご乗車ありがとうございました。');
    expect(JP_PACK.chapters[4]!.beats).toEqual({ open: 'b_ch5_open', close: 'b_ch5_close' });
  });

  it('Chapter 6 opens with Mio\'s invitation; its designed closings (Aiko, with and without the rented room) are authored for the release that plays on', () => {
    expect(BEATS.b_ch6_open!.lines[0]!.who).toBe('mio');
    expect(BEATS.b_ch6_open!.lines[0]!.line.ja.replace(/\|/g, '')).toBe('うちに来ませんか？');
    expect(BEATS.b_ch6_close_flat!.lines[0]!.line.ja.replace(/\|/g, '')).toBe('ここがあなたの家ですよ。');
    expect(BEATS.b_ch6_close!.lines[0]!.line.ja.replace(/\|/g, '')).toBe('いつでもお茶を飲みに来てくださいね。');
    expect(JP_PACK.chapters[5]!.beats).toEqual({ open: 'b_ch6_open', close: 'b_release_epilogue' });
    // Chapter 4 keeps its own closing now (no festival promise: that is wave C2)
    expect(JP_PACK.chapters[3]!.beats.close).toBe('b_ch4_close');
    const ch4 = BEATS.b_ch4_close!.lines.map((l) => l.line.ja + l.line.en).join('');
    expect(ch4).not.toMatch(/祭|festival/i);
  });

  it('the epilogue is Hanako\'s "to be continued" for Chapter 6: it names the train and the friends\' homes, promises more and mentions nothing unbuilt', () => {
    const b = BEATS.b_release_epilogue!;
    expect(new Set(b.lines.map((l) => l.who))).toEqual(new Set(['hanako']));
    const ja = b.lines.map((l) => l.line.ja.replace(/\|/g, '')).join('');
    expect(ja).toContain('電車');
    expect(ja).toContain('友だちの家');
    expect(ja).toContain('これから');
    const en = b.lines.map((l) => l.line.en).join(' ').toLowerCase();
    for (const w of ['festival', 'letter', 'flat', 'car ']) expect(en, w).not.toContain(w);
    expect(b.ask).toBeUndefined();
    expect(b.effects ?? []).toEqual([]);
  });

  it('b_real_try is Hanako\'s 「ヒントなしで、やってみましょう。」, and REAL_TRY names a Real-mode shop scenario that exists, is hosted by that character and can run in Real mode', () => {
    const b = BEATS.b_real_try!;
    expect(b.lines.every((l) => l.who === 'hanako')).toBe(true);
    expect(b.lines[0]!.line.ja.replace(/\|/g, '')).toBe('ヒントなしで、やってみましょう。');
    expect(b.lines[0]!.line.en).toBe("Let's try without hints.");
    expect(b.lines[0]!.line.ar).toBe('لنجرّب دون تلميحات.');
    expect(b.effects).toEqual([{ t: 'flag', id: 'real_try_seen' }]);
    expect(REAL_TRY).toMatchObject({ beat: 'b_real_try', fromChapter: 6 });
    const sc = scenarioById(REAL_TRY.scenarioId)!;
    const meta = JP_PACK.scenarioMeta.find((m) => m.id === REAL_TRY.scenarioId)!;
    expect(sc.characterId).toBe(REAL_TRY.characterId);
    expect(meta.kind).toBe('shop');
    expect(meta.real).toBe(true);
    expect(meta.pay).toBe('full');
    // open since Chapter 1: the try can never be a closed door
    expect(JP_PACK.shops.find((s) => s.id === meta.shop!.shopId)!.openChapter).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('culture cards of Chapters 5 and 6', () => {
  it('only the festival card is still deferred; the genkan card is collectable with the home visits of Chapter 6', () => {
    expect(CULTURE.filter((c) => c.deferred).map((c) => c.id)).toEqual(['cc_matsuri']);
    expect(CULTURE.find((c) => c.id === 'cc_shoesoff')).toMatchObject({ say: true });
    expect(JP_PACK.culture.find((c) => c.id === 'cc_shoesoff')!.deferred).toBeUndefined();
  });

  it('every reward card of Chapters 5 and 6 exists, and the cards that play in them are triggered by things the chapters have', () => {
    const ids = new Set(CULTURE.map((c) => c.id));
    for (const n of [5, 6]) for (const id of JP_PACK.chapters[n - 1]!.rewardCulture ?? []) expect(ids.has(id), id).toBe(true);
    const card = (id: string) => CULTURE.find((c) => c.id === id)!;
    expect(card('cc_ic').trigger).toEqual({ on: 'scenario_done', ids: ['station_ic'] });
    expect(card('cc_trainmanner').trigger).toEqual({ on: 'ride' });
    expect(card('cc_ticketmachine').trigger).toMatchObject({ on: 'machine' });
    expect(card('cc_refuse').trigger).toMatchObject({ on: 'intent' });
    expect(card('cc_refuse').trigger.ids).toContain('trip_hikarigaoka:later');
    for (const r of card('cc_refuse').trigger.ids ?? []) {
      const [sid, iid] = r.split(':');
      expect(JSON.stringify(scenarioById(sid!)), r).toContain(`"id":"${iid}"`);
    }
    expect(card('cc_shoesoff').trigger).toMatchObject({ on: 'visit' });
  });

  it('a ride (the fare event of the trip) files cc_trainmanner; finishing the trip files the visit and the culture cards of the ride', () => {
    const s0 = chapterFive();
    const r = reduce(s0, { t: 'fare', id: 'trip1', place: 'hikarigaoka', method: 'paper', legs: 2 }, ctx);
    expect(r.state.culture.cc_trainmanner).toBeDefined();
    const done = reduce(r.state, { t: 'trip_done', id: 'hikarigaoka' }, ctx).state;
    expect(done.stats.visits).toContain('trip:hikarigaoka');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
function chapterFive(cash = 3000, ic = 0): GameState {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, wallet: { ...s.wallet, cash, ic }, clock: { ...s.clock, activeDays: 12 }, chapter: { ...s.chapter, n: 5, completed: [1, 2, 3, 4], began: { dayIndex: 0, activeDays: 12 } } };
}

describe('the Hikarigaoka trip over the real pack: the money', () => {
  const FARE = FARES.hikarigaoka!;

  const fareDelta = (r: ReturnType<typeof reduce>): number => r.derived.filter((d) => d.t === 'wallet_changed' && d.kind === 'fare').reduce((a, d) => a + (d.t === 'wallet_changed' ? d.delta : 0), 0);

  it('the round trip is charged exactly twice the fare, once, from the pocket named (paper, with the +¥10) and never twice for the same trip id', () => {
    const s0 = chapterFive();
    const a = reduce(s0, { t: 'fare', id: 'trip1', place: 'hikarigaoka', method: 'paper', legs: 2 }, ctx);
    expect(fareDelta(a)).toBe(-2 * (FARE + BALANCE.fares.paperExtra));
    // (a daily goal may pay a few yen for riding; the fare itself is exactly the quote)
    const again = reduce(a.state, { t: 'fare', id: 'trip1', place: 'hikarigaoka', method: 'paper', legs: 2 }, ctx);
    expect(fareDelta(again)).toBe(0);
    expect(again.state.wallet.cash).toBe(a.state.wallet.cash);
    // a reload replays the event: the ledger already has it
    expect(reduce(again.state, { t: 'fare', id: 'trip1', place: 'hikarigaoka', method: 'paper', legs: 2 }, ctx).state.wallet).toEqual(again.state.wallet);
  });

  it('an IC card pays 2 × ¥170 from the card, not from the cash', () => {
    const s0 = chapterFive(3000, 1000);
    const a = reduce(s0, { t: 'fare', id: 'trip2', place: 'hikarigaoka', method: 'ic', legs: 2 }, ctx);
    expect(fareDelta(a)).toBe(-2 * FARE);
    expect(s0.wallet.ic - a.state.wallet.ic).toBe(2 * FARE);
    expect(a.state.wallet.cash).toBeGreaterThanOrEqual(s0.wallet.cash);
  });

  it('a player short of the round trip is charged nothing (no half trip, nothing negative); the trip is affordable from the Chapter 5 wallet', () => {
    const poor = chapterFive(300, 0);
    const r = reduce(poor, { t: 'fare', id: 'trip3', place: 'hikarigaoka', method: 'paper', legs: 2 }, ctx);
    expect(r.state.wallet.cash).toBe(300);
    expect(r.state.wallet.ic).toBe(0);
    // the cheapest honest trip (IC) is 2 × 170 = 340; paper 2 × 180 = 360. Chapter 4's reward alone is 4,000 and the school's first money 3,000
    expect(2 * FARE).toBeLessThan(JP_PACK.chapters[3]!.reward);
    expect(2 * (FARE + BALANCE.fares.paperExtra)).toBeLessThan(3000);
  });

  it('the fare charged is the one quote (`fareFor`) the panel shows, for IC and for paper, both ways', () => {
    const s0 = chapterFive();
    for (const method of ['paper', 'ic'] as const) {
      const quote = fareFor(JP_PACK, s0, 'hikarigaoka', method);
      const s = method === 'ic' ? chapterFive(3000, 1000) : s0;
      expect(fareDelta(reduce(s, { t: 'fare', id: `q-${method}`, place: 'hikarigaoka', method, legs: 2 }, ctx))).toBe(-2 * quote);
    }
    expect(fareFor(JP_PACK, s0, 'hikarigaoka', 'paper') - fareFor(JP_PACK, s0, 'hikarigaoka', 'ic')).toBe(BALANCE.fares.paperExtra);
  });

  it('Kato\'s shop sells exactly one omiyage for ¥1,000: the charge equals the quote, once; a poor purse charges nothing', () => {
    expect(KATO_PRICES.souvenir).toBe(JP_PACK.items.find((i) => i.id === 'g_souvenir')!.price);
    const shop = JP_PACK.shops.find((s) => s.id === 'kato')!;
    expect(shop).toMatchObject({ placeId: 'hikarigaoka', surface: 'panel', openChapter: 5, pay: ['cash', 'ic'] });
    expect(shop.sells).toContain('g_souvenir');
    const meta = JP_PACK.scenarioMeta.find((m) => m.id === 'trip_hikarigaoka')!;
    expect(meta).toMatchObject({ kind: 'trip', pay: 'full', real: true, shop: { shopId: 'kato', itemSlot: 'giftItem', payStep: 'pay', itemMap: { souvenir: 'g_souvenir' } } });
    const buy = (s: GameState, n: number) => reduce(s, { t: 'purchase', sessionId: 'trip-s', n, shopId: 'kato', itemId: 'g_souvenir', qty: 1, total: 1000, method: 'cash', lines: [] }, ctx);
    const s0 = chapterFive(3000);
    const a = buy(s0, 1).state;
    expect(s0.wallet.cash - a.wallet.cash).toBe(KATO_PRICES.souvenir);
    expect(ownedQty(a, 'g_souvenir')).toBe(1);
    // the same sale again (a double tap, a reload) takes nothing more
    expect(buy(a, 1).state.wallet.cash).toBe(a.wallet.cash);
    // a purse with less than the price: nothing is charged and nothing is granted
    const poor = chapterFive(500);
    const p = buy(poor, 1).state;
    expect(p.wallet.cash).toBe(500);
    expect(ownedQty(p, 'g_souvenir')).toBe(0);
    // before Chapter 5 the shop is shut
    const early = { ...chapterFive(3000), chapter: { ...chapterFive().chapter, n: 4 } };
    expect(buy(early, 1).state.wallet.cash).toBe(3000);
  });

  it('trip_done files `trip:hikarigaoka` once, completes c5_1 at once and uses up the paper ticket', () => {
    const s0 = chapterFive();
    const withTicket = { ...s0, tickets: { ...s0.tickets, station: { place: 'hikarigaoka' } } };
    const a = reduce(withTicket, { t: 'trip_done', id: 'hikarigaoka' }, ctx).state;
    expect(a.stats.visits.filter((v) => v === 'trip:hikarigaoka')).toHaveLength(1);
    expect(a.tickets.station).toBeUndefined();
    expect(reduce(a, { t: 'trip_done', id: 'hikarigaoka' }, ctx).state.stats.visits.filter((v) => v === 'trip:hikarigaoka')).toHaveLength(1);
    expect(evalPred(JP_PACK.chapters[4]!.objectives[0]!.pred, a, ctx)).toBe(true);
    expect(evalPred(JP_PACK.chapters[4]!.objectives[0]!.pred, s0, ctx)).toBe(false);
  });

  it('the travel dream is offered and its steps are the ones the game can see (the souvenir step is the half the game raises: the omiyage bought on the trip)', () => {
    const travel = JP_PACK.dreams.find((d) => d.id === 'travel')!;
    expect(travel.steps.map((s) => s.id)).toEqual(['travel_1', 'travel_2', 'travel_3', 'travel_4', 'travel_5']);
    expect(travel.steps[2]!.pred).toEqual({ k: 'visit', place: 'trip:hikarigaoka' });
    expect(travel.steps[3]!.pred).toEqual({ k: 'flag', id: 'ticket_bought' });
    expect(travel.steps[4]!.pred).toEqual({ k: 'scenario', id: 'trip_hikarigaoka', steps: ['souvenir'] });
    expect(travel.defaultFor).toEqual(['travel']);
    expect(JP_PACK.dreams.find((d) => d.id === 'bike')!.defaultFor).toBeUndefined();
    for (const s of travel.steps) expect([2, 3, 5]).toContain(s.gate);
    expect(travel.steps[4]!.text.en.trim() && hasAr(travel.steps[4]!.text.ar)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the chapter flow over the real pack (evaluateAll)', () => {
  it('Chapter 4 now closes with Mio\'s congratulation, opens Chapter 5 (the trip, the station job, the garage) and nothing is announced twice', () => {
    const s0 = createGameState(JP_PACK, NOW);
    const def = JP_PACK.chapters[3]!;
    const done = Object.fromEntries(def.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd5']));
    const s: GameState = { ...s0, clock: { ...s0.clock, dayIndex: 12, activeDays: 12 }, chapter: { ...s0.chapter, n: 4, done, completed: [1, 2, 3], began: { dayIndex: 5, activeDays: 5 } } };
    const r = evaluateAll(s, ctx);
    expect(r.state.chapter.n).toBe(5);
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch4_close' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch5_open' });
    for (const [kind, id] of [['shop', 'motors'], ['place', 'hikarigaoka'], ['job', 'job_station'], ['interaction', 'trip_hikarigaoka'], ['interaction', 'sato_shift']] as const) {
      expect(r.derived.filter((d) => d.t === 'unlocked' && d.what === kind && d.id === id), `${kind} ${id}`).toHaveLength(1);
    }
    expect(r.derived.filter((d) => d.t === 'unlocked' && d.what === 'item' && d.id === 'bike_mamachari')).toHaveLength(1);
    // the dorm's furniture opens with Chapter 5 too
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'futon_set' });
    // the car and the e-bike wait for Free Walk
    expect(r.derived.some((d) => d.t === 'unlocked' && d.what === 'item' && d.id === 'car_kei_used')).toBe(false);
    expect(evaluateAll(r.state, ctx).derived).toEqual([]);
  });

  it('Chapter 6 begins once a friend is at three hearts, opens the homes and the viewing, and Free Walk follows its completion', () => {
    const base = createGameState(JP_PACK, NOW);
    const def5 = JP_PACK.chapters[4]!;
    const done5 = Object.fromEntries(def5.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd9']));
    const s5: GameState = { ...base, clock: { ...base.clock, dayIndex: 30, activeDays: 30 }, chapter: { ...base.chapter, n: 5, done: done5, completed: [1, 2, 3, 4], began: { dayIndex: 12, activeDays: 12 } } };
    const friendly: GameState = { ...s5, friends: { ...s5.friends, mio: { ...s5.friends.mio!, met: true, ap: 999 } } };
    const waits = evaluateAll(s5, ctx);
    expect(waits.state.chapter.n).toBe(5);
    const r = evaluateAll(friendly, ctx);
    expect(r.state.chapter.n).toBe(6);
    for (const [kind, id] of [['place', 'home_mio'], ['interaction', 'aiko_viewing'], ['interaction', 'home_kenji']] as const) expect(r.derived, `${kind} ${id}`).toContainEqual({ t: 'unlocked', what: kind, id });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch5_close' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch6_open' });
  });
});
