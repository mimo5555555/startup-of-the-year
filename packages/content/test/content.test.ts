import { describe, expect, it } from 'vitest';
import { hasKanji, kanaToRomaji } from '@lw/core';
import {
  CHARACTERS,
  JP_PACK,
  LESSONS,
  TOPICS,
  scenarioById,
  LEXICON,
  LEXICON_ENTRIES,
  LEXICON_PARTS,
  SLOT_OWNERS,
  PHRASEBOOK,
  SCENARIOS,
  SIGNS,
  SLOTS,
  REACTIONS,
  tokenize,
  type Line,
  type Scenario,
} from '../src';
// Pure data module (no three.js): the spawn table the world reads. Imported by path so the content tests never load the renderer.
import { NPC_SPAWNS } from '../../world/src/layout';
import { CORE_POCKETS } from '../src/tokyo/game/pockets/pockets-core';
import { DENKI_FUKU_POCKETS } from '../src/tokyo/game/pockets/pockets-denki-fuku';
import { AIKO_MOTORS_POCKETS } from '../src/tokyo/game/pockets/pockets-aiko-motors';
import { SOCIAL_POCKETS } from '../src/tokyo/game/pockets/pockets-social';
import { JOBS_POCKETS } from '../src/tokyo/game/pockets/pockets-jobs';
import { CORE_META } from '../src/tokyo/game/meta/meta-core';
import { STATION_META } from '../src/tokyo/game/meta/meta-station';
import { DENKI_FUKU_META } from '../src/tokyo/game/meta/meta-denki-fuku';
import { AIKO_MOTORS_META } from '../src/tokyo/game/meta/meta-aiko-motors';
import { SOCIAL_META } from '../src/tokyo/game/meta/meta-social';
import { CHAT_META } from '../src/tokyo/game/meta/meta-chat';
import { JOBS_META } from '../src/tokyo/game/meta/meta-jobs';
import { FRIENDS_META } from '../src/tokyo/game/meta/meta-friends';
import { HEARTS_META } from '../src/tokyo/game/meta/meta-hearts';
import { STORY_META } from '../src/tokyo/game/meta/meta-story';
import { CORE_BEATS } from '../src/tokyo/game/beats/beats-core';
import { FRIENDS_BEATS } from '../src/tokyo/game/beats/beats-friends';
import { HEARTS_BEATS } from '../src/tokyo/game/beats/beats-hearts';
import { STORY_BEATS } from '../src/tokyo/game/beats/beats-story';

const VAR = /\{(\w+)\}/g;

/** Place ids (docs/GAME_DESIGN.md §14.9): `Character.locationId`, `Scenario.locationId`. */
const PLACE_IDS = new Set(['konbini', 'cafe', 'school', 'ramen', 'station', 'park', 'fukufuku', 'denki', 'motors', 'ono', 'hikarigaoka', 'home_mio', 'home_aiko', 'home_kenji', 'dorm', 'flat']);

/** Scenario ids that later slices build (docs/GAME_DESIGN.md §15.2). Until they are registered a character or a ScenarioMeta may name them
 * (the world skips the spawn; `validatePack` is tolerant until its level); once registered they are checked like any other scenario. */
const PLANNED_SCENARIO = /^(station_ic|sato_directions|denki_|fuku_|aiko_|motors_|give_gift|smalltalk_|h4_|chat_|hang_|home_|heart_|job_|shift_|matsuri_|trip_)/;
const isKnownScenario = (id: string) => !!scenarioById(id) || PLANNED_SCENARIO.test(id);

/** The optional graph fields the engine hooks add (docs/GAME_DESIGN.md §6.2); read structurally so this test compiles with or without them. */
const graphExt = (x: object) => x as { nextIfNo?: string; onShort?: string };

function markupVars(markup: string): string[] {
  return [...markup.matchAll(VAR)].map((m) => m[1]);
}

function checkMarkup(markup: string, where: string, errors: string[]) {
  // variables are resolved at run time; check the static tokens
  const stripped = markup
    .split('|')
    .filter((p) => !/^\{\w+\}$/.test(p))
    .join('|');
  const { missing } = tokenize(stripped, LEXICON);
  for (const m of missing) errors.push(`${where}: "${m}" is not in the lexicon`);
}

function allLines(sc: Scenario): Array<{ line: Line; where: string }> {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${sc.id}/${n.id}/say[${i}]` }));
    [...(n.suggestions ?? []), ...Object.values(n.suggestionsByL1 ?? {}).flat()].forEach((s, i) =>
      out.push({ line: s, where: `${sc.id}/${n.id}/suggestion[${i}]` }),
    );
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${sc.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${sc.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
}

describe('lexicon', () => {
  it('has a reading for every entry that contains kanji, and none that do not need one', () => {
    const bad = LEXICON_ENTRIES.filter((e) => hasKanji(e.s) && !e.r).map((e) => e.s);
    expect(bad).toEqual([]);
  });
  it('has English and Arabic glosses everywhere', () => {
    const bad = LEXICON_ENTRIES.filter((e) => !e.en.trim() || !e.ar.trim()).map((e) => e.s);
    expect(bad).toEqual([]);
  });
  it('gives sensible romaji for key words', () => {
    const rom = (s: string) => tokenize(s, LEXICON).tokens[0].rom;
    expect(rom('こんにちは')).toBe('konnichiwa');
    expect(rom('コーヒー')).toBe('kōhī');
    expect(rom('渋谷')).toBe('shibuya');
    expect(rom('は')).toBe('wa');
    expect(rom('を')).toBe('o');
    expect(kanaToRomaji('ありがとうございます')).toBe('arigatōgozaimasu');
  });
});

describe('scenarios', () => {
  it('only use dictionary words', () => {
    const errors: string[] = [];
    for (const sc of SCENARIOS) for (const { line, where } of allLines(sc)) checkMarkup(line.ja, where, errors);
    expect(errors).toEqual([]);
  });

  it('have complete English and Arabic for every line', () => {
    const errors: string[] = [];
    for (const sc of SCENARIOS) {
      for (const { line, where } of allLines(sc)) {
        if (!line.en.trim()) errors.push(`${where}: missing English`);
        if (!line.ar.trim()) errors.push(`${where}: missing Arabic`);
        if (/\p{Script=Han}|\p{Script=Hiragana}/u.test(line.en)) errors.push(`${where}: Japanese leaked into English`);
        // every {var} used in the Japanese must also be in the translations
        for (const v of markupVars(line.ja)) {
          if (!line.en.includes(`{${v}}`)) errors.push(`${where}: {${v}} missing from English`);
          if (!line.ar.includes(`{${v}}`)) errors.push(`${where}: {${v}} missing from Arabic`);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  it('form a valid graph: nodes exist, start exists, end nodes are reachable (following next, nextIfNo, onShort and every startNode)', () => {
    const errors: string[] = [];
    for (const sc of SCENARIOS) {
      if (!sc.nodes[sc.start]) errors.push(`${sc.id}: start node missing`);
      const stepIds = new Set(sc.steps.map((s) => s.id));
      // entry points: the start node plus every `startNode` the pack names for this scenario (e.g. ramen 'start_ticket')
      const roots = [sc.start];
      for (const m of JP_PACK.scenarioMeta) {
        if (m.id !== sc.id || !m.startNode) continue;
        if (!sc.nodes[m.startNode]) errors.push(`${sc.id}: startNode ${m.startNode} missing`);
        else roots.push(m.startNode);
      }
      const reachable = new Set<string>(roots.filter((r) => sc.nodes[r]));
      const queue = [...reachable];
      const follow = (from: string, how: string, to: string | undefined) => {
        if (!to) return;
        if (!sc.nodes[to]) errors.push(`${from}/${how}: unknown node ${to}`);
        else if (!reachable.has(to)) {
          reachable.add(to);
          queue.push(to);
        }
      };
      while (queue.length) {
        const n = sc.nodes[queue.pop()!];
        if (n.step && !stepIds.has(n.step)) errors.push(`${sc.id}/${n.id}: unknown step ${n.step}`);
        follow(`${sc.id}/${n.id}`, 'onShort', graphExt(n).onShort);
        for (const it of n.intents) {
          const where = `${sc.id}/${n.id}/${it.id}`;
          if (it.step && !stepIds.has(it.step)) errors.push(`${where}: unknown step ${it.step}`);
          follow(`${sc.id}/${n.id}`, `${it.id}.next`, it.next);
          follow(`${sc.id}/${n.id}`, `${it.id}.nextIfNo`, graphExt(it).nextIfNo);
          if (!it.next && !it.stay) errors.push(`${where}: intent has neither next nor stay`);
          if (it.stay && !it.reply) errors.push(`${where}: stay intent without reply`);
          if (it.slot && !SLOTS[it.slot]) errors.push(`${where}: unknown slot ${it.slot}`);
          for (const o of it.slotOptions ?? []) {
            if (!SLOTS[it.slot ?? '']?.some((x) => x.id === o)) errors.push(`${where}: unknown slot option ${o}`);
          }
        }
      }
      for (const id of Object.keys(sc.nodes)) if (!reachable.has(id)) errors.push(`${sc.id}: node ${id} is unreachable`);
      const ends = Object.values(sc.nodes).filter((n) => n.end);
      if (!ends.length) errors.push(`${sc.id}: no end node`);
      for (const n of Object.values(sc.nodes)) {
        if (!n.end && n.intents.length === 0) errors.push(`${sc.id}/${n.id}: dead end (no intents, not an end node)`);
        if (!n.end && !(n.suggestions?.length || n.suggestionsByL1)) errors.push(`${sc.id}/${n.id}: no suggestions for a node that waits for the learner`);
      }
      // every goal step is achievable
      for (const st of sc.steps) {
        const used = Object.values(sc.nodes).some((n) => n.step === st.id || n.intents.some((i) => i.step === st.id));
        if (!used) errors.push(`${sc.id}: step ${st.id} can never be completed`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('use characters and locations that exist', () => {
    for (const sc of SCENARIOS) {
      const c = CHARACTERS.find((x) => x.id === sc.characterId);
      expect(c, sc.id).toBeTruthy();
      expect(PLACE_IDS.has(sc.locationId), `${sc.id}: place ${sc.locationId}`).toBe(true);
    }
  });

  it('have a character whose default scenarioId is a registered scenario of that character (a character may own several)', () => {
    const errors: string[] = [];
    for (const c of CHARACTERS) {
      if (!c.scenarioId) continue;
      const sc = scenarioById(c.scenarioId);
      if (sc) {
        if (sc.characterId !== c.id) errors.push(`${c.id}: scenarioId ${c.scenarioId} belongs to ${sc.characterId}`);
      } else if (!isKnownScenario(c.scenarioId)) errors.push(`${c.id}: scenarioId ${c.scenarioId} is neither registered nor planned`);
    }
    expect(errors).toEqual([]);
    // the five original scenarios keep their one-to-one characters
    for (const id of ['cafe', 'konbini', 'station', 'ramen', 'park']) {
      expect(CHARACTERS.find((c) => c.scenarioId === id)?.id, id).toBe(scenarioById(id)!.characterId);
    }
  });
});

describe('world spawns', () => {
  // The world builds an NPC only when the character is registered and its scenario (or lesson) exists; otherwise the spawn is skipped
  // (docs/GAME_DESIGN.md §14.8, 1H-b). This pure-data guard mirrors that rule so a typo in layout.ts or a character id cannot ship silently.
  const spawnable = (sp: (typeof NPC_SPAWNS)[number]) => {
    const c = CHARACTERS.find((x) => x.id === sp.id);
    if (!c) return false;
    if (sp.kind === 'lesson') return !!c.lessonId && LESSONS.some((l) => l.id === c.lessonId);
    const sc = c.scenarioId ? scenarioById(c.scenarioId) : undefined;
    return !!sc && sc.characterId === c.id;
  };

  it('has unique spawn ids', () => {
    expect(new Set(NPC_SPAWNS.map((s) => s.id)).size).toBe(NPC_SPAWNS.length);
  });
  it('spawns the original six characters, each with a scenario or lesson that exists', () => {
    for (const id of ['tanaka', 'yuki', 'hanako', 'kenji', 'sato', 'mio']) {
      const sp = NPC_SPAWNS.find((s) => s.id === id);
      expect(sp, id).toBeTruthy();
      expect(spawnable(sp!), id).toBe(true);
    }
  });
  it('only skips a spawn whose character or scenario is still to come (never a typo)', () => {
    const skipped = NPC_SPAWNS.filter((s) => !spawnable(s));
    for (const sp of skipped) {
      const c = CHARACTERS.find((x) => x.id === sp.id);
      expect(c, `spawn ${sp.id}: no such character`).toBeTruthy();
      expect(c!.scenarioId && isKnownScenario(c!.scenarioId), `spawn ${sp.id}: scenario ${c!.scenarioId}`).toBeTruthy();
    }
  });
  it('registers the full cast of §14.9', () => {
    const ids = CHARACTERS.map((c) => c.id);
    for (const id of ['yuki', 'tanaka', 'sato', 'kenji', 'hanako', 'mio', 'aiko', 'rin', 'nakamura', 'aoi', 'kato', 'hina']) expect(ids, id).toContain(id);
  });
});

describe('phrasebook', () => {
  it('only produces Japanese the lexicon can display', () => {
    const errors: string[] = [];
    for (const p of PHRASEBOOK) checkMarkup(p.ja, `phrase ${p.id}`, errors);
    expect(errors).toEqual([]);
  });
  it('declares a slot whenever the Japanese or the patterns use one', () => {
    const errors: string[] = [];
    for (const p of PHRASEBOOK) {
      const jaVars = markupVars(p.ja);
      const enVars = new Set(p.en.flatMap(markupVars));
      const arVars = new Set(p.ar.flatMap(markupVars));
      if (jaVars.length > 1) errors.push(`${p.id}: more than one variable`);
      if (jaVars.length === 1) {
        if (p.slot !== jaVars[0]) errors.push(`${p.id}: slot should be ${jaVars[0]}`);
        if (p.en.some((s) => !s.includes(`{${jaVars[0]}}`))) errors.push(`${p.id}: an English pattern lacks the slot`);
        if (p.ar.some((s) => !s.includes(`{${jaVars[0]}}`))) errors.push(`${p.id}: an Arabic pattern lacks the slot`);
      } else if (enVars.size || arVars.size) errors.push(`${p.id}: patterns use a slot the Japanese does not`);
      if (p.slot && p.slot !== 'name' && !SLOTS[p.slot]) errors.push(`${p.id}: unknown slot ${p.slot}`);
      if (new Set(p.en).size !== p.en.length) errors.push(`${p.id}: duplicate English pattern`);
    }
    expect(errors).toEqual([]);
  });
  it('has unique ids', () => {
    const ids = PHRASEBOOK.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('slots, signs and lesson', () => {
  it('slot options have keys in all three scripts', () => {
    for (const [name, opts] of Object.entries(SLOTS)) {
      for (const o of opts) {
        expect(o.keys.ja.length, `${name}/${o.id}`).toBeGreaterThan(0);
        expect(o.keys.en.length, `${name}/${o.id}`).toBeGreaterThan(0);
        expect(o.keys.ar.length, `${name}/${o.id}`).toBeGreaterThan(0);
      }
      expect(new Set(opts.map((o) => o.id)).size).toBe(opts.length);
    }
  });
  it('signs exist in the lexicon', () => {
    for (const s of SIGNS) expect(LEXICON.has(s.lex), s.id).toBe(true);
  });
  it('lesson cards and reactions are displayable', () => {
    const errors: string[] = [];
    for (const l of LESSONS) {
      if (!l.title.en.trim() || !l.title.ar.trim() || !l.intro.en.trim() || !l.intro.ar.trim()) errors.push(`lesson ${l.id}: missing EN/AR title or intro`);
      for (const [i, c] of l.cards.entries()) {
        checkMarkup(c.ja, `lesson ${l.id} card ${i}`, errors);
        if (!c.en.trim() || !c.ar.trim()) errors.push(`lesson ${l.id} card ${i}: missing EN/AR`);
      }
    }
    for (const [k, l] of Object.entries(REACTIONS)) checkMarkup(l.ja, `reaction ${k}`, errors);
    expect(errors).toEqual([]);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
  });
  it('characters are complete', () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(CHARACTERS.length);
    const topics = new Set(TOPICS.map((t) => t.id));
    for (const c of CHARACTERS) {
      expect(c.name.en && c.name.ar && c.name.ja && c.name.reading, c.id).toBeTruthy();
      expect(c.job.en && c.job.ar && c.bio.en && c.bio.ar && c.personality.en && c.personality.ar, `${c.id}: EN+AR text`).toBeTruthy();
      expect(c.interests.length, c.id).toBeGreaterThanOrEqual(2);
      for (const t of c.interests) expect(topics.has(t), `${c.id}: topic ${t}`).toBe(true);
      expect(PLACE_IDS.has(c.locationId), `${c.id}: place ${c.locationId}`).toBe(true);
      expect(c.scenarioId || c.lessonId || c.id === 'hina', `${c.id}: nothing to talk about`).toBeTruthy();
      for (const col of [c.avatar.skin, c.avatar.hair.color, c.avatar.top, c.avatar.bottom, c.avatar.shoes, c.avatar.accent]) expect(col, c.id).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(CHARACTERS.find((c) => c.id === 'nakamura')?.scenarioId).toBe('motors_visit');
  });
});

describe('resolved lines', () => {
  it('capitalise a translation that starts with a filled-in word', async () => {
    const { resolveLine } = await import('../src');
    const l = resolveLine({ ja: '{item}|です|ね。', en: '{item}, got it.', ar: '{item}، حسنًا.' }, LEXICON, {
      item: { ja: 'コーヒー', gloss: { en: 'coffee', ar: 'قهوة' } },
    });
    expect(l.en).toBe('Coffee, got it.');
    expect(l.ar).toBe('قهوة، حسنًا.');
    expect(l.written).toBe('コーヒーですね。');
  });
});

describe('content modules', () => {
  it('no lexicon surface clashes between modules (different reading or meaning)', () => {
    const first = new Map<string, { mod: string; r?: string }>();
    const bad: string[] = [];
    for (const [mod, entries] of Object.entries(LEXICON_PARTS)) {
      for (const e of entries) {
        const prev = first.get(e.s);
        if (!prev) first.set(e.s, { mod, r: e.r });
        else if ((prev.r ?? '') !== (e.r ?? '')) bad.push(`${e.s}: ${prev.mod} reads ${prev.r ?? '-'}, ${mod} reads ${e.r ?? '-'}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('no duplicate surfaces inside one module', () => {
    const bad: string[] = [];
    for (const [mod, entries] of Object.entries(LEXICON_PARTS)) {
      const seen = new Set<string>();
      for (const e of entries) {
        if (seen.has(e.s)) bad.push(`${mod}: ${e.s}`);
        seen.add(e.s);
      }
    }
    expect(bad).toEqual([]);
  });
  it('every slot is defined by exactly one module', () => {
    const bad = Object.entries(SLOT_OWNERS).filter(([, mods]) => mods.length > 1).map(([n, m]) => `${n}: ${m.join(',')}`);
    expect(bad).toEqual([]);
  });
  it('registers every lexicon module of docs/GAME_DESIGN.md §15.2', () => {
    expect(Object.keys(LEXICON_PARTS).sort()).toEqual(
      ['core', 'numbers', 'shop', 'station', 'quests', 'shop-denki', 'shop-fuku', 'shop-aiko', 'shop-motors', 'social', 'social-chat', 'social-friends', 'social-hearts', 'jobs', 'culture'].sort(),
    );
  });
  it('scenario and character ids are unique', () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });
});

describe('game pack registries (JP_PACK)', () => {
  const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

  it('assembles every table of the GamePack contract', () => {
    expect(JP_PACK.schema).toBe(1);
    expect(JP_PACK.id).toBe('jp');
    for (const k of ['menu', 'items', 'shops', 'jobs', 'chapters', 'dreams', 'daily', 'friends', 'scenarioMeta', 'culture', 'titles'] as const) expect(Array.isArray(JP_PACK[k]), k).toBe(true);
    for (const k of ['fares', 'beats', 'interactions', 'pockets', 'wordTags', 'ageProfiles'] as const) expect(typeof JP_PACK[k], k).toBe('object');
    expect(Object.keys(JP_PACK.ageProfiles).sort()).toEqual(['adults', 'kids', 'seniors', 'teens']);
  });

  it('part files never define the same pocket line, beat or scenario meta twice', () => {
    const pockets = [CORE_POCKETS, DENKI_FUKU_POCKETS, AIKO_MOTORS_POCKETS, SOCIAL_POCKETS, JOBS_POCKETS].flatMap((p) => Object.keys(p));
    const beats = [CORE_BEATS, FRIENDS_BEATS, HEARTS_BEATS, STORY_BEATS].flatMap((p) => Object.keys(p));
    const metas = [CORE_META, STATION_META, DENKI_FUKU_META, AIKO_MOTORS_META, SOCIAL_META, CHAT_META, JOBS_META, FRIENDS_META, HEARTS_META, STORY_META].flatMap((p) => p.map((m) => m.id));
    expect(dupes(pockets)).toEqual([]);
    expect(dupes(beats)).toEqual([]);
    expect(dupes(metas)).toEqual([]);
    expect(Object.keys(JP_PACK.pockets).length).toBe(pockets.length);
    expect(Object.keys(JP_PACK.beats).length).toBe(beats.length);
    expect(JP_PACK.scenarioMeta.length).toBe(metas.length);
  });

  it('wires ScenarioMeta to scenarios: registered or planned ids, real start nodes and pay steps', () => {
    const errors: string[] = [];
    for (const m of JP_PACK.scenarioMeta) {
      const sc = scenarioById(m.id);
      if (!sc) {
        if (!isKnownScenario(m.id)) errors.push(`meta ${m.id}: no such scenario`);
        continue;
      }
      if (m.startNode && !sc.nodes[m.startNode]) errors.push(`meta ${m.id}: startNode ${m.startNode} missing`);
      if (m.shop && !sc.steps.some((st) => st.id === m.shop!.payStep)) errors.push(`meta ${m.id}: payStep ${m.shop.payStep} is not a step`);
      if (m.friendId && !CHARACTERS.some((c) => c.id === m.friendId)) errors.push(`meta ${m.id}: friend ${m.friendId} unknown`);
      if (m.place && !PLACE_IDS.has(m.place)) errors.push(`meta ${m.id}: place ${m.place} unknown`);
    }
    expect(errors).toEqual([]);
  });

  it('pocket lines are displayable Japanese with English and Arabic', () => {
    const errors: string[] = [];
    for (const [id, p] of Object.entries(JP_PACK.pockets)) {
      checkMarkup(p.line.ja, `pocket ${id}`, errors);
      if (!p.line.en.trim() || !p.line.ar.trim()) errors.push(`pocket ${id}: missing EN/AR`);
      if (p.id !== id) errors.push(`pocket ${id}: key differs from id ${p.id}`);
    }
    expect(errors).toEqual([]);
  });

  it('every friend, interaction table and meta names a registered character', () => {
    const ids = new Set(CHARACTERS.map((c) => c.id));
    for (const f of JP_PACK.friends) expect(ids.has(f.id), `friend ${f.id}`).toBe(true);
    for (const id of Object.keys(JP_PACK.interactions)) expect(ids.has(id), `interactions ${id}`).toBe(true);
    for (const j of JP_PACK.jobs) expect(ids.has(j.boss), `job ${j.id} boss`).toBe(true);
  });
});
