// The konbini job (agent 4D, docs/GAME_DESIGN.md §9): the customers of `job_konbini`, the intro scenario with Tanaka and its meta, pocket
// lines, phrasebook and lexicon, and what the shift plan and the pay do with the real pack (the §9.2 figures). The intro is played in
// packages/engine/test/jobs-intro.test.ts.
import { describe, expect, it } from 'vitest';
import { BALANCE, generateShift, scoreShift, shiftPay, validatePack, type CustomerTemplate, type ShiftResult } from '@lw/game';
import type { IntentDef, Line } from '../src';
import { CHARACTERS, JP_PACK, LEXICON, PHRASEBOOK, scenarioById, tokenize, yenToJa } from '../src';
import { JOBS } from '../src/tokyo/game/jobs';
import { JOBS_META } from '../src/tokyo/game/meta/meta-jobs';
import { JOBS_POCKETS } from '../src/tokyo/game/pockets/pockets-jobs';
import { JOBS_PHRASES } from '../src/phrasebook/jobs';

const job = JP_PACK.jobs.find((j) => j.id === 'job_konbini')!;
const menu = JP_PACK.menu;
const menuOf = (ref: string) => menu.find((m) => m.id === ref || (m.shop === 'konbini' && m.option === ref))!;
const totalOf = (c: CustomerTemplate): number => (c.task.kind === 'order' ? c.task.items.reduce((s, i) => s + menuOf(i.menu).price * i.qty, 0) : 0);
const resolves = (ja: string): string[] => tokenize(ja, LEXICON).missing ?? [];
const noGap = (line: Line, where: string) => {
  const t = tokenize(line.ja, LEXICON);
  expect(t.missing ?? [], `${where}: unknown words`).toEqual([]);
  expect(t.tokens.filter((x) => !x.punct && !x.raw && !x.gloss).map((x) => x.s), `${where}: tokens without a gloss`).toEqual([]);
  expect(line.en.trim() && line.ar.trim(), `${where}: EN + AR`).toBeTruthy();
};

describe('job_konbini: pack data', () => {
  it('is the only job of Release 1, run by Tanaka at the konbini with the §9.2 wage', () => {
    expect(JOBS.map((j) => j.id)).toEqual(['job_konbini']);
    expect(job.boss).toBe('tanaka');
    expect(job.place).toBe('konbini');
    expect(job.wage).toBe(1150);
    expect(job.hours).toBe(BALANCE.shift.hours);
    expect(job.intro).toBe('job_konbini_intro');
    expect(job.bonus).toEqual({ itemId: 'konbini:onigiri', needsPerfect: true });
    expect(job.name.en && job.name.ar).toBeTruthy();
  });

  it('has several archetypes per tier, tier 4 from rank 2, and every cart is on the real konbini menu', () => {
    const byTier = (n: number) => job.archetypes.filter((a) => a.tier === n);
    for (const n of [1, 2, 3]) expect(byTier(n).length, `tier ${n}`).toBeGreaterThanOrEqual(3);
    expect(byTier(4).length).toBeGreaterThanOrEqual(2);
    expect(byTier(1).length).toBeGreaterThanOrEqual(BALANCE.shift.variety.archetypesMin);
    for (const a of byTier(4)) expect(a.minRank).toBe(2);
    expect(new Set(job.archetypes.map((a) => a.id)).size).toBe(job.archetypes.length);
    for (const a of job.archetypes) {
      expect(a.task.kind, a.id).toBe('order');
      if (a.task.kind !== 'order') continue;
      for (const i of a.task.items) {
        const m = menuOf(i.menu);
        expect(m, `${a.id}: ${i.menu}`).toBeTruthy();
        expect(m.shop).toBe('konbini');
        expect(i.qty).toBeGreaterThanOrEqual(1);
        expect(i.qty).toBeLessThanOrEqual(3);
      }
      for (const tg of a.task.toggles ?? []) expect(['heat', 'nobag']).toContain(tg);
      expect(a.thanks.length, `${a.id}: staff phrases`).toBeGreaterThanOrEqual(1);
      expect(a.tiles?.length, `${a.id}: two distractor tiles`).toBe(2);
    }
  });

  it('the tier-1 carts total what the design says and a change customer always gets change back', () => {
    const t = (id: string) => totalOf(job.archetypes.find((a) => a.id === id)!);
    expect(t('k_basic')).toBe(320);
    expect(t('k_two')).toBe(1120);
    for (const a of job.archetypes.filter((x) => x.change)) expect(a.change!.paid, a.id).toBeGreaterThan(totalOf(a));
    for (const a of job.archetypes) expect(totalOf(a) % 10, a.id).toBe(0);
  });

  it('every customer line, staff phrase and tile is Japanese the lexicon can show, with English and Arabic', () => {
    for (const a of job.archetypes) {
      noGap(a.line, a.id);
      for (const th of a.thanks) expect(resolves(th), `${a.id} thanks ${th}`).toEqual([]);
      for (const tile of a.tiles ?? []) expect(resolves(tile), `${a.id} tile ${tile}`).toEqual([]);
      // the order is stated in the line: every ordered item's name is said
      if (a.task.kind === 'order') {
        const said = a.line.ja.replace(/\|/g, '');
        for (const i of a.task.items) expect(said, `${a.id}: ${i.menu}`).toContain(menuOf(i.menu).name.ja);
        if (a.task.toggles?.includes('heat')) expect(said).toContain('温めて');
        if (a.task.toggles?.includes('nobag')) expect(said).toContain('袋');
        if (a.change) expect(said).toContain('千円');
      }
    }
    // a total and a change can always be said with the lexicon (the numeral tokens are the shared ones)
    for (const a of job.archetypes) {
      noGap({ ja: `${yenToJa(totalOf(a)).markup}|です|。`, en: 'x', ar: 'x' }, `${a.id} total`);
      if (a.change) noGap({ ja: `お釣り|は|${yenToJa(a.change.paid - totalOf(a)).markup}|です|。`, en: 'x', ar: 'x' }, `${a.id} change`);
    }
  });

  it('the pack passes validatePack at level 3 for everything this module owns', () => {
    // (the café and station rows name jobs that are out of Release 1: the app hides them, so only issues about this job count)
    const mine = validatePack(JP_PACK, { level: 3 }).filter((i) => i.severity === 'error' && (i.path.startsWith('jobs[') || /job_konbini/.test(i.message)));
    expect(mine).toEqual([]);
  });
});

describe('job_konbini: the plan and the pay with the real pack (§9.1, §9.2)', () => {
  const plan = (o: Partial<Parameters<typeof generateShift>[2]> = {}) => generateShift(JP_PACK, 'job_konbini', { rank: 0, seed: 1, dueWords: [], recent: [], ...o });

  it('draws five customers, at least four different ones, by rank: no flags before rank 2 gives tier 3, no note before rank 3', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const p0 = plan({ seed });
      expect(p0.customers).toHaveLength(5);
      expect(new Set(p0.customers.map((c) => c.templateId)).size).toBeGreaterThanOrEqual(4);
      for (const c of p0.customers) expect(job.archetypes.find((a) => a.id === c.templateId)!.tier, `rank 0: ${c.templateId}`).toBeLessThanOrEqual(1);
      const p3 = plan({ seed, rank: 3 });
      for (const c of p3.customers) expect(c.total, c.templateId).toBeGreaterThan(0);
      for (const c of plan({ seed, rank: 1 }).customers) expect(job.archetypes.find((a) => a.id === c.templateId)!.tier).toBeLessThanOrEqual(2);
      for (const c of plan({ seed, rank: 2 }).customers) expect(job.archetypes.find((a) => a.id === c.templateId)!.minRank).toBeLessThanOrEqual(2);
    }
    const seen = new Set(Array.from({ length: 60 }, (_, s) => plan({ seed: s + 1, rank: 4 }).customers.map((c) => c.templateId)).flat());
    expect(seen.size, 'every archetype is reachable at rank 4').toBe(job.archetypes.length);
  });

  it('the totals of a plan are the menu prices of the cart (take-out, tax included)', () => {
    for (const c of plan({ rank: 4, seed: 9 }).customers) {
      const a = job.archetypes.find((x) => x.id === c.templateId)!;
      expect(c.total).toBe(totalOf(a));
    }
  });

  it('a seeded plan is stable and the same orders do not come back within three shifts', () => {
    expect(plan({ seed: 5 })).toEqual(plan({ seed: 5 }));
    const first = plan({ rank: 4, seed: 11 }).customers.map((c) => c.templateId);
    const next = plan({ rank: 4, seed: 12, recent: first }).customers.map((c) => c.templateId);
    expect(next.filter((id) => first.includes(id)).length, 'avoids the recent ones while there are others').toBeLessThanOrEqual(1);
  });

  const result = (input: 'typed' | 'tiles' | 'pick', rightTasks = 15): ShiftResult => ({
    id: 'r',
    jobId: 'job_konbini',
    quit: false,
    durationSec: 200,
    assistWaived: true,
    customers: Array.from({ length: 5 }, (_, i) => ({
      templateId: 'k_basic',
      served: true,
      assist: 'none' as const,
      tasks: [
        { kind: 'order' as const, ok: i * 3 < rightTasks },
        { kind: 'total' as const, ok: true, input },
        { kind: 'thanks' as const, ok: true, input },
      ],
    })),
  });
  it('a full-skill rank-0 shift pays ¥860, rank 4 ¥1,140, all chips ¥290 (the §9.2 table)', () => {
    const pay = (r: ShiftResult, rank = 0) => shiftPay(job, scoreShift(r), rank, 1, JP_PACK);
    expect(pay(result('typed'))).toBe(860);
    expect(pay(result('typed'), 4)).toBe(1140);
    expect(pay(result('pick'))).toBe(290);
    expect(pay(result('typed')) * 0.5, 'the second shift of a day at the same job').toBe(430);
    expect(shiftPay(job, scoreShift(result('typed')), 0, 0.5, JP_PACK)).toBe(430);
  });
});

describe('job_konbini_intro: scenario, meta, pocket, phrasebook', () => {
  const sc = scenarioById('job_konbini_intro')!;

  it('is Tanaka at the konbini, A1, three goal steps', () => {
    expect(sc.characterId).toBe('tanaka');
    expect(sc.locationId).toBe('konbini');
    expect(sc.level).toBe('A1');
    expect(sc.steps.map((s) => s.id)).toEqual(['accept', 'greet', 'thanks']);
    expect(CHARACTERS.find((c) => c.id === 'tanaka')).toBeTruthy();
    expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar).toBeTruthy();
    for (const s of sc.steps) expect(s.text.en && s.text.ar).toBeTruthy();
  });

  it('has a valid graph: every target exists, every node is reachable, the ends exist', () => {
    const seen = new Set([sc.start]);
    const queue = [sc.start];
    while (queue.length) {
      const n = sc.nodes[queue.shift()!]!;
      for (const t of n.intents.flatMap((i: IntentDef) => [i.next, i.nextIfNo]).filter(Boolean) as string[]) {
        expect(sc.nodes[t], `${n.id} -> ${t}`).toBeTruthy();
        if (!seen.has(t)) {
          seen.add(t);
          queue.push(t);
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(sc.nodes).sort());
    expect(sc.nodes.done!.end).toBe(true);
    expect(sc.nodes.leave!.end).toBe(true);
  });

  it('every line, chip, reply and model answer is displayable and has English and Arabic', () => {
    for (const n of Object.values(sc.nodes)) {
      n.say.forEach((v, i) => noGap(v.line, `${n.id}/say[${i}]`));
      (n.suggestions ?? []).forEach((s, i) => noGap(s, `${n.id}/chip[${i}]`));
      for (const it of n.intents) {
        if (it.reply) noGap(it.reply, `${n.id}/${it.id}/reply`);
        if (it.ideal) noGap(it.ideal, `${n.id}/${it.id}/ideal`);
      }
    }
  });

  it('is wired as a jobintro meta with a pocket whose lines exist', () => {
    expect(JOBS_META).toHaveLength(1);
    const m = JP_PACK.scenarioMeta.find((x) => x.id === 'job_konbini_intro')!;
    expect(m).toBe(JOBS_META[0]);
    expect(m.kind).toBe('jobintro');
    expect(m.pay).toBe('full');
    for (const id of m.pocket ?? []) {
      expect(JP_PACK.pockets[id], id).toBeTruthy();
      noGap(JP_PACK.pockets[id]!.line, id);
    }
    expect(Object.keys(JOBS_POCKETS)).toEqual(m.pocket);
    expect(Object.values(JOBS_POCKETS).filter((p) => p.key).length).toBeLessThanOrEqual(2);
  });

  it('its phrasebook entries are Japanese the lexicon shows, with English and Arabic patterns', () => {
    expect(JOBS_PHRASES.length).toBeGreaterThanOrEqual(4);
    for (const p of JOBS_PHRASES) {
      expect(resolves(p.ja), p.id).toEqual([]);
      expect(p.en.length && p.ar.length, p.id).toBeTruthy();
      expect(PHRASEBOOK.find((x) => x.id === p.id), p.id).toBe(p);
    }
  });
});
