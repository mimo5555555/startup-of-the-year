// Wave C1 review: regression tests for defects found in the café and station Shift widgets.
import './_fakeStorage';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { JP_PACK } from '@lw/content';
import type { ShiftCustomer } from '@lw/game';
import { DeskPad } from '../src/components/game/shift/StationWidgets';
import { DIRS, dirOf, mapSpotsFor, targetIn } from '../src/components/game/shift/stationLogic';

const station = JP_PACK.jobs.find((j) => j.id === 'job_station')!;
const asCustomer = (a: (typeof station.archetypes)[number]): ShiftCustomer => ({ templateId: a.id, line: a.line, task: a.task, thanks: a.thanks, tiles: a.tiles });
const dirCustomers = station.archetypes.filter((a) => a.task.kind === 'direction').map(asCustomer);
const noop = () => {};

describe('the mini map does not give the answer away', () => {
  it('has the direction customers of every way', () => {
    expect(new Set(dirCustomers.map((c) => (c.task.kind === 'direction' ? dirOf(c.task.answer) : null)))).toEqual(new Set(DIRS));
  });

  // regression: the plan marked ONE place, the one asked for, so the right arrow could be tapped without understanding the question
  it('shows three different places, one at each end; the asked one where the answer points', () => {
    for (const c of dirCustomers) {
      const spots = mapSpotsFor(c);
      expect(spots.map((s) => s.dir).sort(), c.templateId).toEqual([...DIRS].sort());
      expect(new Set(spots.map((s) => s.ja)).size, c.templateId).toBe(3);
      const asked = spots.filter((s) => s.asked);
      expect(asked.length).toBe(1);
      expect(asked[0]!.ja).toBe(targetIn(c.line.ja));
      expect(asked[0]!.dir).toBe(c.task.kind === 'direction' ? dirOf(c.task.answer) : null);
      // the same customer always sees the same plan
      expect(mapSpotsFor(c)).toEqual(spots);
    }
  });

  it('お手洗い is the toilet: the plan never shows トイレ beside it', () => {
    const c: ShiftCustomer = { ...dirCustomers[0]!, templateId: 'zz', line: { ja: 'お手洗い|は|どこ|です|か？', en: '', ar: '' } };
    expect(mapSpotsFor(c).map((s) => s.ja)).not.toContain('トイレ');
  });

  it('renders three look-alike spots on the plan', () => {
    for (const c of dirCustomers) {
      const out = renderToStaticMarkup(createElement(DeskPad, { customer: c, pack: JP_PACK, picked: null, onPick: noop, onConfirm: noop }));
      const spots = out.match(/class="sh-dest at-[a-z]+"/g) ?? [];
      expect(spots.length, c.templateId).toBe(3);
    }
  });
});

// ---- the answer box's example text and the correction card ------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { STRINGS } from '../src/i18n';
import { deskSaid } from '../src/components/game/shift/stationLogic';
import { amountSaid, changeOf, menuFor, splitTotals } from '../src/components/game/shift/shiftLogic';

const examples = (key: string): string[] =>
  (['en', 'ar'] as const).flatMap((l) => ((STRINGS[l] as Record<string, string>)[key] ?? '').split(/,? or |,? أو |, /).map((x) => x.trim()).filter(Boolean));

describe('the placeholder of the answer box never shows a customer the answer', () => {
  // regression: '9:58 or 九時五十八分', '170 or 百七十円', '2 or 二番線です', '右 or みぎ' and the konbini's '320 or 三百二十円' were the answers of
  // s_time, s_fare, s_announce, s_dir and k_basic, written in the box the player was asked to fill
  it('station desk: no example is any customer\'s answer', () => {
    for (const a of station.archetypes) {
      const c = asCustomer(a);
      // the way: the example names all three ways, so it points nowhere (one alone, 右, was the answer of s_dir)
      const key = `jobs.deskPh.${a.task.kind}`;
      const ex = a.task.kind === 'direction' ? (['en', 'ar'] as const).map((l) => (STRINGS[l] as Record<string, string>)[key]!) : examples(key);
      expect(ex.length, a.id).toBeGreaterThan(0);
      for (const x of ex) expect(deskSaid(c, x), `${a.id}: ${x}`).toBe(false);
    }
  });

  it('konbini and café: the total example is never a total, a change or a split bill', () => {
    const ex = examples('jobs.placeholderTotal');
    expect(ex.length).toBeGreaterThan(0);
    for (const job of JP_PACK.jobs.filter((j) => j.place !== 'station')) {
      const menu = menuFor(JP_PACK, job);
      for (const a of job.archetypes) {
        if (a.task.kind !== 'order') continue;
        const total = a.task.items.reduce((s, i) => s + (menu.find((m) => m.id === i.menu || m.option === i.menu)?.price ?? 0) * i.qty, 0);
        const c: ShiftCustomer = { templateId: a.id, line: a.line, task: a.task, thanks: a.thanks, tiles: a.tiles, change: a.change, total };
        const owed = [total, changeOf(c), ...(splitTotals(c, menu) ?? [])].filter((n): n is number => typeof n === 'number');
        for (const n of owed) for (const x of ex) expect(amountSaid(x, n), `${a.id}: ${x} vs ${n}`).toBe(false);
      }
    }
  });

  // regression: a wrong tap at the desk read "It was / It was: 9:58"
  it('the desk correction names the answer once', () => {
    const src = readFileSync(new URL('../src/screens/Shift.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/t\('jobs\.answerWas'\) : t\('jobs\.orderWas'\)/);
  });
});

describe('the order grid in Arabic and the café tables at 360 px', () => {
  const css = readFileSync(new URL('../src/styles/shift.css', import.meta.url), 'utf8');
  // regression: the count badge is dir="ltr", so its inline start stayed on the left in Arabic, under the remove button (inline end = left)
  it('the count badge moves to the right in Arabic', () => {
    expect(css).toMatch(/\[dir='rtl'\] \.sh-qty \{\s*inset-inline-start: auto;\s*right: -4px;/);
  });
  // regression: beside the label, table 6 wrapped alone onto a second row
  it('the table label takes its own line', () => {
    expect(css).toMatch(/\.sh-tables-label \{[^}]*flex-basis: 100%;/);
  });
});
