// Pack and state validation (agent 1F, docs/GAME_DESIGN.md §14.5, §15.9).
import { BALANCE } from './balance';
import { HOME_SLOTS } from './inventory';
import { reconcile } from './ledger';
import { walletLimits } from './money';
import { deriveCompleted, openChapter, prerequisiteIssues } from './objectives';
import type { BeatEffect, ContentIndex, GamePack, GameState, GameView, Gloss, Pred, ValidationIssue, ValidationLevel } from './types';

const ID_RE = /^[A-Za-z0-9_][A-Za-z0-9_:.\-]*$/;
const COUNTERS: readonly string[] = ['conv_distinct', 'indep_lines', 'new_intents', 'purchase', 'shift_good', 'friend_contact', 'places_distinct', 'review_checked', 'lesson', 'culture_new'];
const SLOTS: readonly string[] = ['speak', 'do', 'review'];
const CULTURE_ON: readonly string[] = ['shop_start', 'talk_start', 'scenario_done', 'payment', 'served', 'machine', 'purchase', 'intent', 'gift_given', 'casual_switch', 'visit', 'ride', 'festival', 'perfect_shift'];
const AGES = ['kids', 'teens', 'adults', 'seniors'] as const;
const NONE_PAY_KINDS: readonly string[] = ['chat', 'hangout', 'home', 'heart'];
/** The beats the engine plays by name, not through a chapter or a dream (§14.9). */
const STANDING_BEATS = ['b_dream_step', 'b_phone_fund', 'b_welcome_back', 'b_rankup'] as const;
/** The flat path may need at most this many hearts with its landlady (§7.1 level-4 bot). */
const FLAT_PATH_MAX_HEART = 1;

type Out = ValidationIssue[];
const add = (out: Out, level: ValidationLevel, code: string, path: string, message: string, severity: 'error' | 'warn' = 'error'): void => {
  out.push({ level, severity, code, path, message });
};

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isGloss = (g: unknown): g is Gloss => !!g && typeof g === 'object' && typeof (g as Gloss).en === 'string' && (g as Gloss).en.trim() !== '' && typeof (g as Gloss).ar === 'string' && (g as Gloss).ar.trim() !== '';

/** Reports a duplicate or malformed id of one table. */
function checkIds(out: Out, level: ValidationLevel, table: string, ids: string[]): void {
  const seen = new Set<string>();
  ids.forEach((id, i) => {
    if (typeof id !== 'string' || !ID_RE.test(id)) add(out, level, 'id_format', `${table}[${i}].id`, `"${String(id)}" is not a valid id`);
    else if (seen.has(id)) add(out, level, 'id_duplicate', `${table}[${i}].id`, `id "${id}" appears twice in ${table}`);
    seen.add(id);
  });
}

function gloss(out: Out, level: ValidationLevel, path: string, g: unknown): void {
  if (!isGloss(g)) add(out, level, 'gloss_missing', path, 'needs a non-empty EN and AR text');
}

// ---------------------------------------------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------------------------------------------

/** Structural check of a predicate: known kind, positive counts, sensible ranges. */
function predShape(out: Out, level: ValidationLevel, path: string, p: Pred): void {
  const pos = (n: unknown, what: string): void => {
    if (!isInt(n) || n < 1) add(out, level, 'pred_range', path, `${p.k}: ${what} must be a positive whole number`);
  };
  switch (p.k) {
    case 'lesson':
    case 'flag':
      if (!p.id) add(out, level, 'pred_field', path, `${p.k}: id is empty`);
      break;
    case 'scenario':
      if (!p.id) add(out, level, 'pred_field', path, 'scenario: id is empty');
      if (p.minStars !== undefined && ![1, 2, 3].includes(p.minStars)) add(out, level, 'pred_range', path, 'scenario: minStars is 1, 2 or 3');
      if (p.minShare !== undefined && !(p.minShare > 0 && p.minShare <= 1)) add(out, level, 'pred_range', path, 'scenario: minShare is in (0, 1]');
      if (p.minIndependent !== undefined) pos(p.minIndependent, 'minIndependent');
      break;
    case 'stars':
      pos(p.n, 'n');
      if (![1, 2, 3].includes(p.atLeast)) add(out, level, 'pred_range', path, 'stars: atLeast is 1, 2 or 3');
      break;
    case 'own':
      if (!p.item && !p.category) add(out, level, 'pred_field', path, 'own: needs an item or a category');
      break;
    case 'purchases':
    case 'words_saved':
    case 'words_known':
    case 'say_new':
    case 'discover':
    case 'culture':
    case 'culture_said':
    case 'srs_reviews':
    case 'item_placed':
    case 'phone_chat':
    case 'shift':
    case 'gift':
      pos(p.n, 'n');
      break;
    case 'hearts':
      if (!p.friend) add(out, level, 'pred_field', path, 'hearts: friend is empty');
      if (!isInt(p.atLeast) || p.atLeast < 1 || p.atLeast > BALANCE.ap.thresholds.length) add(out, level, 'pred_range', path, `hearts: atLeast is 1-${BALANCE.ap.thresholds.length}`);
      break;
    case 'hearts_count':
      pos(p.n, 'n');
      if (!isInt(p.atLeast) || p.atLeast < 1 || p.atLeast > BALANCE.ap.thresholds.length) add(out, level, 'pred_range', path, `hearts_count: atLeast is 1-${BALANCE.ap.thresholds.length}`);
      break;
    case 'hangout':
      if (p.n !== undefined) pos(p.n, 'n');
      break;
    case 'visit':
      if (!p.place) add(out, level, 'pred_field', path, 'visit: place is empty');
      break;
    case 'earn_total':
      pos(p.yen, 'yen');
      break;
    case 'wallet':
      pos(p.atLeast, 'atLeast');
      break;
    case 'said':
      if (!p.scenario || !p.intent) add(out, level, 'pred_field', path, 'said: scenario and intent are needed');
      break;
    case 'all':
    case 'any':
      p.of.forEach((q, i) => predShape(out, level, `${path}.of[${i}]`, q));
      break;
    default: {
      const never: never = p;
      add(out, level, 'pred_unknown', path, `unknown predicate ${JSON.stringify(never)}`);
    }
  }
}

/** Calls `fn` on a predicate and every predicate inside it. */
function walkPred(p: Pred, fn: (q: Pred) => void): void {
  fn(p);
  if (p.k === 'all' || p.k === 'any') for (const q of p.of) walkPred(q, fn);
}

/** Every predicate of the pack with its path: objectives (and their easier alternative), start gates, dream steps, job unlocks, interaction and scenario gates. */
function allPreds(pack: GamePack): Array<{ path: string; pred: Pred; level: ValidationLevel }> {
  const list: Array<{ path: string; pred: Pred; level: ValidationLevel }> = [];
  pack.chapters.forEach((c, ci) => {
    c.objectives.forEach((o, oi) => {
      list.push({ path: `chapters[${ci}].objectives[${oi}].pred`, pred: o.pred, level: 2 });
      if (o.easier) list.push({ path: `chapters[${ci}].objectives[${oi}].easier.pred`, pred: o.easier.pred, level: 2 });
    });
    if (c.startGate) list.push({ path: `chapters[${ci}].startGate`, pred: c.startGate, level: 2 });
  });
  pack.dreams.forEach((d, di) => d.steps.forEach((s, si) => list.push({ path: `dreams[${di}].steps[${si}].pred`, pred: s.pred, level: 2 })));
  pack.jobs.forEach((j, ji) => list.push({ path: `jobs[${ji}].unlock`, pred: j.unlock, level: 3 }));
  Object.entries(pack.interactions).forEach(([who, l]) => l.forEach((i, ii) => i.gate && list.push({ path: `interactions.${who}[${ii}].gate`, pred: i.gate, level: 2 })));
  pack.scenarioMeta.forEach((m, mi) => m.gate && list.push({ path: `scenarioMeta[${mi}].gate`, pred: m.gate, level: 3 }));
  return list;
}

// ---------------------------------------------------------------------------------------------------------------
// Level 1: structure and ids
// ---------------------------------------------------------------------------------------------------------------

function level1(pack: GamePack, out: Out): void {
  if (pack.schema !== 1) add(out, 1, 'schema', 'schema', `schema must be 1, found ${String(pack.schema)}`);
  for (const k of ['id', 'language', 'district'] as const) if (typeof pack[k] !== 'string' || !pack[k]) add(out, 1, 'field_empty', k, `${k} must be a non-empty string`);
  gloss(out, 1, 'name', pack.name);

  const cur = pack.currency;
  if (![1, 100].includes(cur.minorPerMajor)) add(out, 1, 'currency', 'currency.minorPerMajor', 'minorPerMajor is 1 or 100');
  if (!isInt(cur.roundTo) || cur.roundTo < 1) add(out, 1, 'currency', 'currency.roundTo', 'roundTo is a whole number of at least 1');
  if (!cur.code || !cur.symbol) add(out, 1, 'currency', 'currency', 'code and symbol are needed');

  const e = pack.economy;
  if (!(e.refWage > 0)) add(out, 1, 'economy', 'economy.refWage', 'refWage must be positive');
  if (!(e.incomeScale > 0)) add(out, 1, 'economy', 'economy.incomeScale', 'incomeScale must be positive');
  else if (e.refWage > 0 && Math.abs(e.incomeScale - e.refWage / BALANCE.refWage) > 0.01 * e.incomeScale) {
    add(out, 1, 'economy_scale', 'economy.incomeScale', `incomeScale ${e.incomeScale} is not refWage / ${BALANCE.refWage}`, 'warn');
  }
  if (!isInt(e.startCash) || e.startCash < 0) add(out, 1, 'economy', 'economy.startCash', 'startCash is a whole number, 0 or more');
  if (!isInt(e.walletCap) || e.walletCap < e.startCash) add(out, 1, 'economy', 'economy.walletCap', 'walletCap is a whole number at least startCash');
  if (!isInt(e.bigTicket) || e.bigTicket < 0) add(out, 1, 'economy', 'economy.bigTicket', 'bigTicket is a whole number, 0 or more');
  if (e.icCap && !(isInt(e.icCap.early) && isInt(e.icCap.late) && e.icCap.early >= 0 && e.icCap.early <= e.icCap.late && e.icCap.late <= e.walletCap)) {
    add(out, 1, 'economy', 'economy.icCap', 'icCap needs whole numbers with 0 <= early <= late <= walletCap');
  }
  for (const [k, rate] of Object.entries(pack.tax.rates)) if (!(rate >= 0 && rate < 1)) add(out, 1, 'tax', `tax.rates.${k}`, 'a tax rate is in [0, 1)');
  if (!isInt(pack.rules.deliveryFee) || pack.rules.deliveryFee < 0) add(out, 1, 'rules', 'rules.deliveryFee', 'deliveryFee is a whole number, 0 or more');
  if (pack.rules.registrationFee !== undefined && (!isInt(pack.rules.registrationFee) || pack.rules.registrationFee < 0)) add(out, 1, 'rules', 'rules.registrationFee', 'registrationFee is a whole number, 0 or more');
  for (const [shop, n] of Object.entries(pack.rules.negotiation)) {
    if (!(n.maxPct > 0 && n.maxPct < 1) || !(n.maxAmount > 0) || !(n.assistedShare >= 0 && n.assistedShare <= 1)) add(out, 1, 'rules', `rules.negotiation.${shop}`, 'maxPct in (0,1), maxAmount > 0, assistedShare in [0,1]');
    // the catalog is filled by later slices; once it has entries, a negotiable id must be one of this shop's items
    if (n.items && (!Array.isArray(n.items) || (pack.items.length > 0 && n.items.some((id) => pack.items.find((i) => i.id === id)?.shop !== shop)))) {
      add(out, 1, 'rules', `rules.negotiation.${shop}.items`, 'items lists item ids sold by that shop');
    }
  }
  for (const age of AGES) {
    const a = pack.ageProfiles[age];
    if (!a) add(out, 1, 'age_profile', `ageProfiles.${age}`, 'every age group needs a profile');
    else if (!isInt(a.ageFloor) || a.ageFloor < 0 || !isInt(a.dailyGoals) || a.dailyGoals < 1) add(out, 1, 'age_profile', `ageProfiles.${age}`, 'ageFloor and dailyGoals are whole numbers');
  }

  checkIds(out, 1, 'menu', pack.menu.map((m) => m.id));
  checkIds(out, 1, 'items', pack.items.map((i) => i.id));
  checkIds(out, 1, 'shops', pack.shops.map((s) => s.id));
  checkIds(out, 1, 'jobs', pack.jobs.map((j) => j.id));
  checkIds(out, 1, 'chapters', pack.chapters.map((c) => `c${c.n}`));
  checkIds(out, 1, 'dreams', pack.dreams.map((d) => d.id));
  checkIds(out, 1, 'daily', pack.daily.map((d) => d.id));
  checkIds(out, 1, 'friends', pack.friends.map((f) => f.id));
  checkIds(out, 1, 'culture', pack.culture.map((c) => c.id));
  checkIds(out, 1, 'titles', pack.titles.map((t) => t.id));
  checkIds(out, 1, 'scenarioMeta', pack.scenarioMeta.map((m) => m.id));
  checkIds(out, 1, 'interactions', Object.values(pack.interactions).flat().map((i) => i.id));
  const menuIds = new Set(pack.menu.map((m) => m.id));
  pack.items.forEach((i, ix) => menuIds.has(i.id) && add(out, 1, 'id_duplicate', `items[${ix}].id`, `item id "${i.id}" is also a menu id`));
  for (const [id, b] of Object.entries(pack.beats)) if (b.id !== id) add(out, 1, 'id_mismatch', `beats.${id}.id`, `beat key "${id}" and its id "${b.id}" differ`);
  for (const [id, p] of Object.entries(pack.pockets)) if (p.id !== id) add(out, 1, 'id_mismatch', `pockets.${id}.id`, `pocket key "${id}" and its id "${p.id}" differ`);
  pack.menu.forEach((m, i) => m.id !== `${m.shop}:${m.option}` && add(out, 1, 'id_mismatch', `menu[${i}].id`, `menu id "${m.id}" must be "${m.shop}:${m.option}"`));

  pack.items.forEach((i, ix) => {
    if (!isInt(i.price) || i.price < 1) add(out, 1, 'price', `items[${ix}].price`, `price of ${i.id} must be a whole number of at least 1`);
    if (i.body !== undefined && (!isInt(i.body) || i.body < 1 || i.body > i.price)) add(out, 1, 'price', `items[${ix}].body`, `body price of ${i.id} must be a whole number between 1 and the price`);
    if (!isInt(i.gate.ch) || i.gate.ch < 1 || i.gate.ch > BALANCE.freeWalkChapter) add(out, 1, 'gate_range', `items[${ix}].gate.ch`, `gate chapter of ${i.id} is 1-${BALANCE.freeWalkChapter}`);
    if (i.gate.ageMin !== undefined && (!isInt(i.gate.ageMin) || i.gate.ageMin < 0)) add(out, 1, 'gate_range', `items[${ix}].gate.ageMin`, `ageMin of ${i.id} is a whole number`);
  });
  pack.menu.forEach((m, i) => (!isInt(m.price) || m.price < 1) && add(out, 1, 'price', `menu[${i}].price`, `price of ${m.id} must be a whole number of at least 1`));
  Object.entries(pack.fares).forEach(([place, fare]) => (!isInt(fare) || fare < 1) && add(out, 1, 'price', `fares.${place}`, `fare to ${place} must be a whole number of at least 1`));
  pack.jobs.forEach((j, i) => {
    if (!isInt(j.wage) || j.wage < 1) add(out, 1, 'price', `jobs[${i}].wage`, `wage of ${j.id} must be a whole number of at least 1`);
    if (!(j.hours > 0)) add(out, 1, 'job', `jobs[${i}].hours`, `hours of ${j.id} must be positive`);
  });
  pack.chapters.forEach((c, i) => {
    if (!isInt(c.reward) || c.reward < 0) add(out, 1, 'price', `chapters[${i}].reward`, `reward of chapter ${c.n} must be a whole number, 0 or more`);
    if (!isInt(c.minDays) || c.minDays < 0) add(out, 1, 'chapter', `chapters[${i}].minDays`, `minDays of chapter ${c.n} must be a whole number, 0 or more`);
  });
  pack.friends.forEach((f, i) => {
    if (!isInt(f.unlockChapter) || f.unlockChapter < 1 || f.unlockChapter > BALANCE.freeWalkChapter) add(out, 1, 'gate_range', `friends[${i}].unlockChapter`, `unlock chapter of ${f.id} is 1-${BALANCE.freeWalkChapter}`);
    if (![0, 1, 2, 3, 99].includes(f.casualAt)) add(out, 1, 'friend', `friends[${i}].casualAt`, `casualAt of ${f.id} is 0, 1, 2, 3 or 99`);
    if (!Array.isArray(f.facts) || f.facts.length !== 3) add(out, 1, 'friend', `friends[${i}].facts`, `${f.id} needs exactly three profile facts`);
  });

  // renames: no cycle, no id renamed twice in a chain longer than the migration follows
  for (const [from, to] of Object.entries(pack.idAliases ?? {})) {
    let cur = to;
    const seen = new Set([from]);
    while (pack.idAliases?.[cur] !== undefined && !seen.has(cur)) {
      seen.add(cur);
      cur = pack.idAliases[cur]!;
    }
    if (cur === from || seen.has(cur)) add(out, 1, 'alias_cycle', `idAliases.${from}`, `the rename of "${from}" leads back to itself`);
    if (seen.size > 6) add(out, 1, 'alias_chain', `idAliases.${from}`, `the rename of "${from}" is a chain longer than 6`, 'warn');
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Level 2: slice-2 content (chapters, dreams, daily, interactions) and texts
// ---------------------------------------------------------------------------------------------------------------

function level2(pack: GamePack, out: Out): void {
  if (pack.chapters.length === 0) add(out, 2, 'chapters_empty', 'chapters', 'the pack has no chapters');
  const ns = pack.chapters.map((c) => c.n).sort((a, b) => a - b);
  ns.forEach((n, i) => n !== i + 1 && add(out, 2, 'chapter_numbers', 'chapters', `chapter numbers must run 1..${ns.length} without a gap (found ${n} at position ${i + 1})`));
  if (ns.length > BALANCE.chapters) add(out, 2, 'chapter_numbers', 'chapters', `at most ${BALANCE.chapters} chapters (Free Walk is ${BALANCE.freeWalkChapter})`);

  const objectiveIds = new Set<string>();
  const sorted = [...pack.chapters].sort((a, b) => a.n - b.n);
  sorted.forEach((c, i) => {
    const base = `chapters[${pack.chapters.indexOf(c)}]`;
    gloss(out, 2, `${base}.title`, c.title);
    if (!c.beats?.open || !c.beats?.close) add(out, 2, 'chapter_beats', `${base}.beats`, `chapter ${c.n} needs an open and a close beat id`);
    if (c.objectives.filter((o) => !o.dream).length === 0) add(out, 2, 'chapter_objectives', `${base}.objectives`, `chapter ${c.n} has no story objective`);
    if (i > 0 && c.minDays < sorted[i - 1]!.minDays) add(out, 2, 'chapter_days', `${base}.minDays`, `minDays of chapter ${c.n} is below chapter ${sorted[i - 1]!.n}'s`, 'warn');
    c.objectives.forEach((o, oi) => {
      const path = `${base}.objectives[${oi}]`;
      if (!ID_RE.test(o.id ?? '')) add(out, 2, 'id_format', `${path}.id`, `"${String(o.id)}" is not a valid id`);
      else if (objectiveIds.has(o.id)) add(out, 2, 'id_duplicate', `${path}.id`, `objective id "${o.id}" appears twice in the pack`);
      objectiveIds.add(o.id);
      if (!o.dream) gloss(out, 2, `${path}.text`, o.text);
      if (o.hint) gloss(out, 2, `${path}.hint`, o.hint);
      if (o.easier && (!isInt(o.easier.afterTries) || o.easier.afterTries < 1)) add(out, 2, 'easier', `${path}.easier.afterTries`, 'afterTries is a whole number of at least 1');
    });
    c.opens.forEach((o, oi) => !['place', 'job', 'feature', 'shop', 'interaction'].includes(o.kind) && add(out, 2, 'opens_kind', `${base}.opens[${oi}]`, `unknown kind "${o.kind}"`));
  });

  if (pack.dreams.length === 0) add(out, 2, 'dreams_empty', 'dreams', 'the pack has no dreams');
  const stepIds = new Set<string>();
  pack.dreams.forEach((d, di) => {
    gloss(out, 2, `dreams[${di}].name`, d.name);
    if (d.steps.length === 0) add(out, 2, 'dream_steps', `dreams[${di}].steps`, `dream ${d.id} has no steps`);
    if (!d.title || !d.beat || !d.sticker) add(out, 2, 'dream_rewards', `dreams[${di}]`, `dream ${d.id} needs a title, a beat and a sticker`);
    d.steps.forEach((s, si) => {
      const path = `dreams[${di}].steps[${si}]`;
      // `dream.steps` is keyed by step id alone, so an id must be unique across every dream
      if (stepIds.has(s.id)) add(out, 2, 'id_duplicate', `${path}.id`, `dream step id "${s.id}" appears twice in the pack`);
      stepIds.add(s.id);
      gloss(out, 2, `${path}.text`, s.text);
      if (!isInt(s.gate) || s.gate < 1 || s.gate > BALANCE.freeWalkChapter) add(out, 2, 'gate_range', `${path}.gate`, `gate of step ${s.id} is 1-${BALANCE.freeWalkChapter}`);
    });
  });

  if (pack.daily.length === 0) add(out, 2, 'daily_empty', 'daily', 'the pack has no daily goal templates');
  pack.daily.forEach((t, i) => {
    gloss(out, 2, `daily[${i}].text`, t.text);
    if (!SLOTS.includes(t.slot)) add(out, 2, 'daily_slot', `daily[${i}].slot`, `slot "${t.slot}" is speak, do or review`);
    if (!COUNTERS.includes(t.counter)) add(out, 2, 'daily_counter', `daily[${i}].counter`, `counter "${t.counter}" is not one of the ten day counters`);
    if (!isInt(t.target) || t.target < 1) add(out, 2, 'daily_target', `daily[${i}].target`, 'target is a whole number of at least 1');
  });
  for (const slot of SLOTS) if (pack.daily.length > 0 && !pack.daily.some((t) => t.slot === slot)) add(out, 2, 'daily_slot', 'daily', `no template for the "${slot}" slot`);

  const interactions = Object.entries(pack.interactions);
  if (interactions.length === 0) add(out, 2, 'interactions_empty', 'interactions', 'the pack has no interactions');
  interactions.forEach(([who, list]) =>
    list.forEach((i, ii) => {
      const path = `interactions.${who}[${ii}]`;
      gloss(out, 2, `${path}.label`, i.label);
      if (i.kind === 'scenario' && !i.scenarioId) add(out, 2, 'interaction_field', path, `${i.id}: a scenario interaction needs a scenarioId`);
      if (i.kind === 'shift' && !i.jobId) add(out, 2, 'interaction_field', path, `${i.id}: a shift interaction needs a jobId`);
      if (i.kind === 'window' && !i.shopId) add(out, 2, 'interaction_field', path, `${i.id}: a window interaction needs a shopId`);
    }),
  );

  for (const p of allPreds(pack)) walkPred(p.pred, (q) => predShape(out, 2, p.path, q));

  // texts: every name, line and card has EN + AR
  pack.shops.forEach((s, i) => gloss(out, 2, `shops[${i}].name`, s.name));
  pack.items.forEach((x, i) => gloss(out, 2, `items[${i}].name`, x.name));
  pack.menu.forEach((x, i) => gloss(out, 2, `menu[${i}].name`, x.name));
  pack.jobs.forEach((j, i) => gloss(out, 2, `jobs[${i}].name`, j.name));
  pack.culture.forEach((c, i) => {
    gloss(out, 2, `culture[${i}].text`, c.text);
    if (!c.phrase?.ja || !c.phrase.en || !c.phrase.ar) add(out, 2, 'gloss_missing', `culture[${i}].phrase`, 'a key phrase needs JA, EN and AR');
  });
  pack.titles.forEach((t, i) => gloss(out, 2, `titles[${i}].name`, t.name));
  for (const [id, b] of Object.entries(pack.beats)) {
    if (b.lines.length === 0) add(out, 2, 'beat_lines', `beats.${id}.lines`, `beat ${id} has no lines`);
    b.lines.forEach((l, i) => (!l.line?.ja || !l.line.en || !l.line.ar) && add(out, 2, 'gloss_missing', `beats.${id}.lines[${i}]`, 'a beat line needs JA, EN and AR'));
  }
  for (const [id, p] of Object.entries(pack.pockets)) if (!p.line?.ja || !p.line.en || !p.line.ar) add(out, 2, 'gloss_missing', `pockets.${id}.line`, 'a pocket line needs JA, EN and AR');
  pack.friends.forEach((f, i) => f.perks.forEach((p, pi) => gloss(out, 2, `friends[${i}].perks[${pi}].text`, p.text)));
  Object.entries(pack.wordTags).forEach(([tag, surfaces]) => surfaces.length === 0 && add(out, 2, 'word_tag', `wordTags.${tag}`, `tag ${tag} lists no word`));
}

// ---------------------------------------------------------------------------------------------------------------
// Level 3: catalog, sale routes, gates
// ---------------------------------------------------------------------------------------------------------------

/** Item and menu ids a scenario sells (the item map of its main slot, extra slots and the fixed item). */
function sold(pack: GamePack): Map<string, string[]> {
  const bySale = new Map<string, string[]>();
  for (const m of pack.scenarioMeta) {
    if (!m.shop) continue;
    const ids = [...Object.values(m.shop.itemMap), ...(m.shop.fixedItem ? [m.shop.fixedItem] : [])];
    for (const id of ids) bySale.set(id, [...(bySale.get(id) ?? []), m.id]);
  }
  return bySale;
}

/** Item ids granted for free (heart and chapter rewards, scenario effects, shift bonuses): they need no sale route. */
function granted(pack: GamePack): Set<string> {
  const ids = new Set<string>();
  const fromEffects = (fx: BeatEffect[] | undefined): void => fx?.forEach((e) => e.t === 'item' && ids.add(e.id));
  Object.values(pack.beats).forEach((b) => fromEffects(b.effects));
  pack.scenarioMeta.forEach((m) => fromEffects(m.effects));
  pack.jobs.forEach((j) => ids.add(j.bonus.itemId));
  for (const f of pack.friends) {
    for (const p of f.perks) {
      if (p.fx.t === 'once_item') ids.add(p.fx.itemId);
      if (p.fx.t === 'once_discount' && p.fx.elseItem) ids.add(p.fx.elseItem);
    }
  }
  return ids;
}

function level3(pack: GamePack, out: Out): void {
  const itemIds = new Set(pack.items.map((i) => i.id));
  const menuIds = new Set(pack.menu.map((m) => m.id));
  const menuOptions = new Set(pack.menu.map((m) => m.option));
  const shops = new Map(pack.shops.map((s) => [s.id, s]));
  const known = (id: string): boolean => itemIds.has(id) || menuIds.has(id);
  const knownOrOption = (id: string): boolean => known(id) || menuOptions.has(id);

  if (pack.items.length === 0) add(out, 3, 'items_empty', 'items', 'the pack has no items');
  if (pack.shops.length === 0) add(out, 3, 'shops_empty', 'shops', 'the pack has no shops');

  // shops and the things they sell
  pack.shops.forEach((s, i) => {
    if (!s.placeId) add(out, 3, 'shop', `shops[${i}].placeId`, `shop ${s.id} has no place`);
    if (!isInt(s.openChapter) || s.openChapter < 1 || s.openChapter > BALANCE.freeWalkChapter) add(out, 3, 'gate_range', `shops[${i}].openChapter`, `open chapter of ${s.id} is 1-${BALANCE.freeWalkChapter}`);
    s.sells.forEach((id, k) => !knownOrOption(id) && add(out, 3, 'sells_unknown', `shops[${i}].sells[${k}]`, `shop ${s.id} sells "${id}", which is neither an item nor a menu id`));
    if (s.points && !pack.rules.pointsCard) add(out, 3, 'points', `shops[${i}].points`, `shop ${s.id} issues points but the pack has no points card`, 'warn');
  });
  const stocked = (shopId: string, id: string, option?: string): boolean => {
    const sells = shops.get(shopId)?.sells ?? [];
    return sells.includes(id) || (option !== undefined && sells.includes(option));
  };
  pack.items.forEach((it, i) => {
    const shop = shops.get(it.shop);
    if (!shop) return void add(out, 3, 'item_shop', `items[${i}].shop`, `item ${it.id} is sold by unknown shop "${it.shop}"`);
    if (!stocked(it.shop, it.id)) add(out, 3, 'not_sold', `items[${i}]`, `shop ${it.shop} does not list item ${it.id} in \`sells\``);
    // "every item has a shop that opens by its gate chapter" (§15.9)
    if (shop.openChapter > it.gate.ch) add(out, 3, 'shop_after_item', `items[${i}].gate.ch`, `item ${it.id} opens in chapter ${it.gate.ch}, but shop ${it.shop} opens in chapter ${shop.openChapter}`);
    // D28: kids never see the flat or a car as purchasable
    if ((it.tags.includes('flat') || it.tags.includes('car')) && (it.gate.ageMin ?? 0) < 18) add(out, 3, 'age_rule', `items[${i}].gate.ageMin`, `item ${it.id} (flat or car) needs ageMin 18 (D28)`);
    (it.gate.needs ?? []).forEach((n, k) => !itemIds.has(n) && add(out, 3, 'needs_unknown', `items[${i}].gate.needs[${k}]`, `item ${it.id} needs unknown item "${n}"`));
    it.fx.forEach((fx, k) => {
      const path = `items[${i}].fx[${k}]`;
      if (fx.t === 'ride' && !(fx.mul > 0)) add(out, 3, 'item_fx', path, 'a ride multiplier must be positive');
      if (fx.t === 'home' && !(HOME_SLOTS.ono as readonly string[]).includes(fx.slot)) add(out, 3, 'item_fx', path, `home slot "${fx.slot}" is not one of ${HOME_SLOTS.ono.join(', ')}`);
      if (fx.t === 'home' && !(fx.comfort >= 0)) add(out, 3, 'item_fx', path, 'comfort must be 0 or more');
    });
  });
  pack.menu.forEach((m, i) => {
    if (!shops.has(m.shop)) add(out, 3, 'item_shop', `menu[${i}].shop`, `menu item ${m.id} belongs to unknown shop "${m.shop}"`);
    else if (!stocked(m.shop, m.id, m.option)) add(out, 3, 'not_sold', `menu[${i}]`, `shop ${m.shop} does not list ${m.id} in \`sells\``);
    if (!(m.taxClass in pack.tax.rates)) add(out, 3, 'tax_class', `menu[${i}].taxClass`, `tax class "${m.taxClass}" is not in the pack's tax rates`);
  });
  // needs graph: acyclic
  const needs = new Map(pack.items.map((i) => [i.id, i.gate.needs ?? []]));
  for (const id of needs.keys()) {
    const stack = [id];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      for (const n of needs.get(cur) ?? []) {
        if (n === id) add(out, 3, 'needs_cycle', `items.${id}`, `item ${id} needs itself through ${cur}`);
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
  }

  // sale routes (§5.6): every item and menu id is sold in a conversation, sold at a panel, or granted
  const routes = sold(pack);
  const free = granted(pack);
  const panel = (shopId: string): boolean => shops.get(shopId)?.surface === 'panel';
  pack.items.forEach((it, i) => {
    if (!panel(it.shop) && !routes.has(it.id) && !free.has(it.id)) add(out, 3, 'no_sale_route', `items[${i}]`, `item ${it.id} is sold by no scenario's item map and is not granted`);
  });
  pack.menu.forEach((m, i) => {
    if (!panel(m.shop) && !routes.has(m.id) && !free.has(m.id)) add(out, 3, 'no_sale_route', `menu[${i}]`, `menu item ${m.id} is sold by no scenario's item map and is not granted`);
  });
  pack.scenarioMeta.forEach((m, i) => {
    if (!m.shop) return;
    const path = `scenarioMeta[${i}].shop`;
    if (!shops.has(m.shop.shopId)) add(out, 3, 'meta_shop', `${path}.shopId`, `${m.id} sells at unknown shop "${m.shop.shopId}"`);
    if (!m.shop.payStep) add(out, 3, 'meta_shop', `${path}.payStep`, `${m.id} has no pay step`);
    if (!m.shop.itemSlot && !m.shop.fixedItem) add(out, 3, 'meta_shop', path, `${m.id} needs an item slot or a fixed item`);
    for (const [option, id] of [...Object.entries(m.shop.itemMap), ...(m.shop.fixedItem ? [['fixed', m.shop.fixedItem] as [string, string]] : [])]) {
      if (!known(id)) {
        add(out, 3, 'itemmap_unknown', `${path}.itemMap.${option}`, `${m.id} maps "${option}" to unknown item "${id}"`);
        continue;
      }
      const owner = pack.items.find((x) => x.id === id)?.shop ?? pack.menu.find((x) => x.id === id)?.shop;
      if (owner && owner !== m.shop.shopId) add(out, 3, 'itemmap_wrong_shop', `${path}.itemMap.${option}`, `${m.id} sells at ${m.shop.shopId} but "${id}" belongs to ${owner}`);
    }
  });

  // friends: tastes and perks
  const perkIds = new Set<string>();
  pack.friends.forEach((f, i) => {
    for (const id of f.loves) if (f.dislikes.includes(id)) add(out, 3, 'taste', `friends[${i}]`, `${f.id} both loves and dislikes "${id}"`);
    for (const k of ['loves', 'dislikes'] as const) f[k].forEach((id, ki) => !knownOrOption(id) && add(out, 3, 'taste_unknown', `friends[${i}].${k}[${ki}]`, `${f.id} ${k} unknown item "${id}"`, 'warn'));
    f.perks.forEach((p, pi) => {
      const path = `friends[${i}].perks[${pi}]`;
      if (perkIds.has(p.id)) add(out, 3, 'id_duplicate', `${path}.id`, `perk id "${p.id}" appears twice`);
      perkIds.add(p.id);
      if (!isInt(p.heart) || p.heart < 1 || p.heart > BALANCE.ap.thresholds.length) add(out, 3, 'perk', `${path}.heart`, 'a perk needs 1-5 hearts');
      switch (p.fx.t) {
        case 'shop_pct':
          if (!shops.has(p.fx.shopId)) add(out, 3, 'perk', path, `perk ${p.id} names unknown shop "${p.fx.shopId}"`);
          if (!(p.fx.pct > 0 && p.fx.pct <= BALANCE.routineDiscountMax)) add(out, 3, 'perk', path, `perk ${p.id}: a routine discount is at most ${BALANCE.routineDiscountMax * 100}% (§4.4)`);
          break;
        case 'once_discount': {
          const fx = p.fx;
          fx.itemIds.forEach((id) => !itemIds.has(id) && add(out, 3, 'perk', path, `perk ${p.id} discounts unknown item "${id}"`));
          if (fx.elseItem && !known(fx.elseItem)) add(out, 3, 'perk', path, `perk ${p.id} grants unknown item "${fx.elseItem}"`);
          if (!(fx.amount > 0)) add(out, 3, 'perk', path, `perk ${p.id}: a discount must be positive`);
          break;
        }
        case 'once_cash':
          if (!(p.fx.amount > 0)) add(out, 3, 'perk', path, `perk ${p.id}: the cash must be positive`);
          break;
        case 'once_item':
          if (!known(p.fx.itemId)) add(out, 3, 'perk', path, `perk ${p.id} grants unknown item "${p.fx.itemId}"`);
          break;
        case 'daily_free':
          if (!shops.has(p.fx.shopId) || !knownOrOption(p.fx.itemId)) add(out, 3, 'perk', path, `perk ${p.id} names an unknown shop or item`);
          break;
        default:
          break;
      }
    });
  });

  // jobs
  pack.jobs.forEach((j, i) => {
    if (!pack.friends.some((f) => f.id === j.boss)) add(out, 3, 'job', `jobs[${i}].boss`, `job ${j.id} has boss "${j.boss}", who is not a friend`, 'warn');
    if (!known(j.bonus.itemId)) add(out, 3, 'job', `jobs[${i}].bonus.itemId`, `job ${j.id} grants unknown item "${j.bonus.itemId}"`);
    j.archetypes.forEach((a, ai) => {
      if (a.task.kind === 'order') a.task.items.forEach((it, k) => !(menuIds.has(it.menu) || menuOptions.has(it.menu)) && add(out, 3, 'job', `jobs[${i}].archetypes[${ai}].task.items[${k}]`, `customer ${a.id} orders unknown menu item "${it.menu}"`));
      if (a.thanks.length === 0) add(out, 3, 'job', `jobs[${i}].archetypes[${ai}].thanks`, `customer ${a.id} accepts no staff phrase`);
    });
  });

  // scenarios
  const pocketUse = new Map<string, number>();
  pack.scenarioMeta.forEach((m, i) => {
    const path = `scenarioMeta[${i}]`;
    if (m.friendId && !pack.friends.some((f) => f.id === m.friendId)) add(out, 3, 'meta_friend', `${path}.friendId`, `${m.id} names unknown friend "${m.friendId}"`);
    if (NONE_PAY_KINDS.includes(m.kind) && m.pay !== 'none') add(out, 3, 'meta_pay', `${path}.pay`, `${m.id} (${m.kind}) pays hearts, not yen: pay should be 'none'`, 'warn');
    for (const id of m.culture ?? []) if (pack.culture.length > 0 && !pack.culture.some((c) => c.id === id)) add(out, 3, 'meta_culture', `${path}.culture`, `${m.id} names unknown culture card "${id}"`);
    for (const id of m.pocket ?? []) {
      if (Object.keys(pack.pockets).length > 0 && !pack.pockets[id]) add(out, 3, 'meta_pocket', `${path}.pocket`, `${m.id} names unknown pocket line "${id}"`);
      pocketUse.set(id, (pocketUse.get(id) ?? 0) + 1);
    }
    const keys = (m.pocket ?? []).filter((id) => pack.pockets[id]?.key).length;
    if (keys > 2) add(out, 3, 'pocket_keys', `${path}.pocket`, `${m.id}'s pocket has ${keys} key lines (at most 2)`);
    for (const fx of m.effects ?? []) if (fx.t === 'item' && !known(fx.id)) add(out, 3, 'meta_effect', `${path}.effects`, `${m.id} grants unknown item "${fx.id}"`);
    (m.requiredIntents ?? []).forEach((r) => !/^[^:]+:[^:]+$/.test(r) && add(out, 3, 'required_intent', `${path}.requiredIntents`, `"${r}" must be scenarioId:intentId`));
  });

  pack.culture.forEach((c, i) => {
    for (const [k, t] of [['trigger', c.trigger], ...(c.also ?? []).map((a, ai) => [`also[${ai}]`, a] as const)] as const) {
      if (!CULTURE_ON.includes(t.on)) add(out, 3, 'culture_trigger', `culture[${i}].${k}.on`, `unknown trigger "${t.on}"`);
    }
  });
  pack.titles.forEach((t, i) => {
    if (t.source.kind === 'heart' && !pack.friends.some((f) => f.id === (t.source as { friend: string }).friend)) add(out, 3, 'title', `titles[${i}].source`, `title ${t.id} names unknown friend`);
    if (t.source.kind === 'dream' && !pack.dreams.some((d) => d.id === (t.source as { id: string }).id)) add(out, 3, 'title', `titles[${i}].source`, `title ${t.id} names unknown dream`);
  });
  pack.dreams.forEach((d, i) => d.items.forEach((id, k) => !itemIds.has(id) && add(out, 3, 'dream_item', `dreams[${i}].items[${k}]`, `dream ${d.id} counts unknown item "${id}"`)));
  pack.chapters.forEach((c, i) => {
    if (c.catchUp && !itemIds.has(c.catchUp.item)) add(out, 3, 'catch_up', `chapters[${i}].catchUp.item`, `the catch-up of chapter ${c.n} names unknown item "${c.catchUp.item}"`);
    // `ChapterDef.opens` shop entries and `ShopDef.openChapter` are two statements of one fact
    for (const o of c.opens) if (o.kind === 'shop' && shops.has(o.id) && shops.get(o.id)!.openChapter !== c.n) add(out, 3, 'shop_open_mismatch', `chapters[${i}].opens`, `chapter ${c.n} opens shop ${o.id}, which opens in chapter ${shops.get(o.id)!.openChapter}`);
  });
  for (const [who, list] of Object.entries(pack.interactions)) {
    list.forEach((it, ii) => {
      const path = `interactions.${who}[${ii}]`;
      if (it.jobId && !pack.jobs.some((j) => j.id === it.jobId)) add(out, 3, 'interaction_ref', path, `${it.id} names unknown job "${it.jobId}"`);
      if (it.shopId && !shops.has(it.shopId)) add(out, 3, 'interaction_ref', path, `${it.id} names unknown shop "${it.shopId}"`);
    });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Level 4: the chapter graph, prerequisites, the bot
// ---------------------------------------------------------------------------------------------------------------

/** Scenario ids a predicate names. */
function scenariosIn(p: Pred): string[] {
  const ids: string[] = [];
  walkPred(p, (q) => {
    if (q.k === 'scenario') ids.push(q.id);
    if (q.k === 'said') ids.push(q.scenario);
  });
  return ids;
}

/** The most hearts a predicate asks for, per friend. */
function heartsIn(p: Pred): Record<string, number> {
  const out: Record<string, number> = {};
  walkPred(p, (q) => {
    if (q.k === 'hearts') out[q.friend] = Math.max(out[q.friend] ?? 0, q.atLeast);
  });
  return out;
}

function level4(pack: GamePack, out: Out): void {
  out.push(...prerequisiteIssues(pack));

  // scenario gates are acyclic: a scenario cannot (indirectly) wait for itself
  const gateOf = new Map(pack.scenarioMeta.map((m) => [m.id, m.gate ? scenariosIn(m.gate) : []]));
  for (const id of gateOf.keys()) {
    const stack = [...(gateOf.get(id) ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur === id) {
        add(out, 4, 'gate_cycle', `scenarioMeta.${id}.gate`, `scenario ${id} waits for itself through its gate`);
        break;
      }
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(gateOf.get(cur) ?? []));
    }
  }

  // the flat path: everything between the landlady's first hello and the contract needs at most heart 1 with her
  const routes = sold(pack);
  for (const it of pack.items.filter((i) => i.tags.includes('flat'))) {
    const need: Record<string, number> = {};
    const stack = [...(routes.get(it.id) ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const sid = stack.pop()!;
      if (seen.has(sid)) continue;
      seen.add(sid);
      const gate = pack.scenarioMeta.find((m) => m.id === sid)?.gate;
      if (!gate) continue;
      for (const [f, h] of Object.entries(heartsIn(gate))) need[f] = Math.max(need[f] ?? 0, h);
      stack.push(...scenariosIn(gate));
    }
    for (const [f, h] of Object.entries(need)) if (h > FLAT_PATH_MAX_HEART) add(out, 4, 'flat_path_heart', `items.${it.id}`, `the way to ${it.id} needs ${h} hearts with ${f} (at most ${FLAT_PATH_MAX_HEART})`);
  }

  // the bot: chapters in order, only what is open at each chapter's start
  const sortedChapters = [...pack.chapters].sort((a, b) => a.n - b.n);
  for (const c of sortedChapters) {
    const problems: string[] = [];
    c.objectives.forEach((o) => {
      if (o.dream) return;
      for (const why of unreachable(pack, o.pred, c.n)) problems.push(`${o.id}: ${why}`);
    });
    if (c.startGate) for (const why of unreachable(pack, c.startGate, c.n - 1)) problems.push(`start gate: ${why}`);
    if (problems.length > 0) {
      problems.forEach((p) => add(out, 4, 'bot_unreachable', `chapters[${pack.chapters.indexOf(c)}]`, `chapter ${c.n}: ${p}`));
      add(out, 4, 'bot_blocked', `chapters[${pack.chapters.indexOf(c)}]`, `the bot cannot finish chapter ${c.n}, so chapters ${c.n + 1}-${sortedChapters.length} are unreachable`);
      break;
    }
  }
}

/** Reasons a predicate cannot be met by a player with what is open at chapter `ch` (empty = reachable). Money is the simulator's job, not the bot's. */
function unreachable(pack: GamePack, p: Pred, ch: number): string[] {
  const why: string[] = [];
  const friendsOpen = pack.friends.filter((f) => f.unlockChapter <= ch);
  const phoneAt = pack.items.filter((i) => i.fx.some((f) => f.t === 'feature' && f.id === 'phone')).reduce((m, i) => Math.min(m, i.gate.ch), Number.POSITIVE_INFINITY);
  switch (p.k) {
    case 'scenario': {
      const meta = pack.scenarioMeta.find((m) => m.id === p.id);
      if (!meta) why.push(`scenario ${p.id} is not in the pack`);
      break;
    }
    case 'said':
      if (!pack.scenarioMeta.some((m) => m.id === p.scenario)) why.push(`scenario ${p.scenario} is not in the pack`);
      break;
    case 'stars': {
      const n = pack.scenarioMeta.filter((m) => m.pay === 'full' && openChapter(pack, 'scenario', m.id) <= ch).length;
      if (n < p.n) why.push(`${p.n} scenarios at ${p.atLeast} stars, but only ${n} pay scenarios are open`);
      break;
    }
    case 'hearts': {
      const f = pack.friends.find((x) => x.id === p.friend);
      if (!f) why.push(`friend ${p.friend} is not in the pack`);
      else if (f.unlockChapter > ch) why.push(`friend ${p.friend} appears in chapter ${f.unlockChapter}`);
      break;
    }
    case 'hearts_count':
      if (friendsOpen.length < p.n) why.push(`${p.n} friends at ${p.atLeast} hearts, but only ${friendsOpen.length} friends are open`);
      break;
    case 'gift': {
      const giftable = pack.items.some((i) => i.cat === 'gift' && i.gate.ch <= ch) || pack.menu.some((m) => m.giftable || pack.shops.find((s) => s.id === m.shop)?.surface === 'world');
      if (!giftable) why.push('no giftable item is open');
      break;
    }
    case 'phone_chat':
      if (phoneAt > ch) why.push(`the phone opens in chapter ${Number.isFinite(phoneAt) ? phoneAt : 'never'}`);
      if (p.friends !== undefined && friendsOpen.length < p.friends) why.push(`chats with ${p.friends} friends, but only ${friendsOpen.length} are open`);
      break;
    case 'hangout': {
      const hang = pack.scenarioMeta.filter((m) => m.kind === 'hangout' && (!p.friend || m.friendId === p.friend));
      if (hang.length === 0) why.push('no hang-out scenario');
      break;
    }
    case 'shift': {
      const job = p.job ? pack.jobs.find((j) => j.id === p.job) : pack.jobs[0];
      if (!job) why.push(p.job ? `job ${p.job} is not in the pack` : 'the pack has no job');
      break;
    }
    case 'wallet':
      if (p.atLeast > pack.economy.walletCap) why.push(`a wallet of ${p.atLeast} is above the cap ${pack.economy.walletCap}`);
      break;
    case 'words_known': {
      if (p.tag) {
        const have = pack.wordTags[p.tag]?.length ?? 0;
        if (have < p.n) why.push(`${p.n} words tagged "${p.tag}", but the tag lists ${have}`);
      }
      break;
    }
    case 'culture_said': {
      const say = pack.culture.filter((c) => c.say).length;
      if (say < p.n) why.push(`${p.n} said culture phrases, but only ${say} cards have a key phrase to say`);
      break;
    }
    case 'culture':
      if (pack.culture.length < (p.id ? 1 : p.n)) why.push('not enough culture cards');
      break;
    case 'item_placed': {
      const slots = HOME_SLOTS.ono.length;
      if (p.n > slots) why.push(`${p.n} placed items, but a flat has ${slots} slots`);
      break;
    }
    case 'all':
      p.of.forEach((q) => why.push(...unreachable(pack, q, ch)));
      break;
    case 'any': {
      const each = p.of.map((q) => unreachable(pack, q, ch));
      if (each.length > 0 && each.every((w) => w.length > 0)) why.push(`no alternative is reachable (${each.map((w) => w[0]).join('; ')})`);
      break;
    }
    default:
      break;
  }
  return why;
}

// ---------------------------------------------------------------------------------------------------------------
// Level 5: everything, with the injected content index
// ---------------------------------------------------------------------------------------------------------------

function level5(pack: GamePack, out: Out, index?: ContentIndex): void {
  // beats named by chapters, dreams and items exist (chapters 3-8 are authored in a later slice, hence level 5)
  const beat = (id: string, path: string, what: string): void => {
    if (id && !pack.beats[id]) add(out, 5, 'beat_missing', path, `${what} names beat "${id}", which the pack does not define`);
  };
  pack.chapters.forEach((c, i) => {
    beat(c.beats.open, `chapters[${i}].beats.open`, `chapter ${c.n}`);
    beat(c.beats.close, `chapters[${i}].beats.close`, `chapter ${c.n}`);
  });
  pack.dreams.forEach((d, i) => beat(d.beat, `dreams[${i}].beat`, `dream ${d.id}`));
  pack.items.forEach((it, i) => it.beat && beat(it.beat, `items[${i}].beat`, `item ${it.id}`));
  STANDING_BEATS.forEach((id) => pack.chapters.length > 0 && beat(id, `beats.${id}`, 'the engine'));
  // titles and keepsakes the story hands out are defined
  const titleIds = new Set(pack.titles.map((t) => t.id));
  pack.chapters.forEach((c, i) => c.rewardTitle && !titleIds.has(c.rewardTitle) && add(out, 5, 'title_missing', `chapters[${i}].rewardTitle`, `chapter ${c.n} awards unknown title "${c.rewardTitle}"`));
  pack.dreams.forEach((d, i) => !titleIds.has(d.title) && add(out, 5, 'title_missing', `dreams[${i}].title`, `dream ${d.id} awards unknown title "${d.title}"`));
  const cardIds = new Set(pack.culture.map((c) => c.id));
  pack.chapters.forEach((c, i) => c.rewardCulture?.forEach((id) => !cardIds.has(id) && add(out, 5, 'culture_missing', `chapters[${i}].rewardCulture`, `chapter ${c.n} awards unknown card "${id}"`)));

  if (!index) return;
  const scen = (id: string, path: string, what: string): void => {
    if (!index.scenarios[id]) add(out, 5, 'index_scenario', path, `${what} names scenario "${id}", which content does not register`);
  };
  pack.scenarioMeta.forEach((m, i) => {
    const path = `scenarioMeta[${i}]`;
    scen(m.id, `${path}.id`, 'ScenarioMeta');
    const sc = index.scenarios[m.id];
    if (!sc) return;
    if (m.shop) {
      const slots: string[] = [m.shop.itemSlot, m.shop.qtySlot, ...(m.shop.extraSlots ?? [])].filter((x): x is string => !!x);
      for (const slot of slots) if (!index.slots[slot]) add(out, 5, 'index_slot', `${path}.shop`, `${m.id} uses slot "${slot}", which content does not define`);
      if (m.shop.itemSlot && index.slots[m.shop.itemSlot]) {
        for (const option of Object.keys(m.shop.itemMap)) if (!index.slots[m.shop.itemSlot]!.includes(option) && !(m.shop.extraSlots ?? []).some((s) => index.slots[s]?.includes(option))) {
          add(out, 5, 'index_option', `${path}.shop.itemMap.${option}`, `${m.id} maps option "${option}", which slot ${m.shop.itemSlot} does not offer`);
        }
      }
      if (sc.steps.length > 0 && !sc.steps.includes(m.shop.payStep)) add(out, 5, 'index_step', `${path}.shop.payStep`, `${m.id} pay step "${m.shop.payStep}" is not a goal step`);
    }
    for (const r of m.requiredIntents ?? []) {
      const [sid, intent] = r.split(':');
      const target = sid ? index.scenarios[sid] : undefined;
      if (!target) add(out, 5, 'index_scenario', `${path}.requiredIntents`, `${m.id} requires an intent of unknown scenario "${sid}"`);
      else if (intent && !target.intents.includes(intent)) add(out, 5, 'index_intent', `${path}.requiredIntents`, `${m.id} requires intent "${intent}", which ${sid} does not define`);
    }
  });
  Object.entries(pack.interactions).forEach(([who, list]) =>
    list.forEach((it, ii) => it.scenarioId && scen(it.scenarioId, `interactions.${who}[${ii}].scenarioId`, `interaction ${it.id}`)),
  );
  for (const { path, pred } of allPreds(pack)) {
    walkPred(pred, (q) => {
      if (q.k === 'scenario') {
        scen(q.id, path, 'a predicate');
        const sc = index.scenarios[q.id];
        for (const st of q.steps ?? []) if (sc && !sc.steps.includes(st)) add(out, 5, 'index_step', path, `step "${st}" is not a goal step of ${q.id}`);
      }
      if (q.k === 'said') {
        scen(q.scenario, path, 'a predicate');
        const sc = index.scenarios[q.scenario];
        if (sc && !sc.intents.includes(q.intent)) add(out, 5, 'index_intent', path, `intent "${q.intent}" is not defined by ${q.scenario}`);
      }
      if (q.k === 'lesson' && index.lessons && !index.lessons.includes(q.id)) add(out, 5, 'index_lesson', path, `lesson "${q.id}" is not registered`);
    });
  }
  pack.culture.forEach((c, i) => {
    for (const t of [c.trigger, ...(c.also ?? [])]) {
      if (t.on === 'scenario_done' || t.on === 'served') for (const id of t.ids ?? []) scen(id, `culture[${i}].trigger`, `card ${c.id}`);
      if (t.on === 'intent') {
        for (const r of t.ids ?? []) {
          const [sid, intent] = r.split(':');
          const target = sid ? index.scenarios[sid] : undefined;
          if (!target || (intent && !target.intents.includes(intent))) add(out, 5, 'index_intent', `culture[${i}].trigger`, `card ${c.id} waits for "${r}", which content does not define`);
        }
      }
    }
  });
  if (index.characters) {
    const chars = new Set(index.characters);
    pack.friends.forEach((f, i) => !chars.has(f.id) && add(out, 5, 'index_character', `friends[${i}].id`, `friend ${f.id} is not a registered character`));
    Object.keys(pack.interactions).forEach((c) => !chars.has(c) && add(out, 5, 'index_character', `interactions.${c}`, `interactions of "${c}", who is not a registered character`));
    Object.values(pack.beats).forEach((b) => b.lines.forEach((l, i) => !chars.has(l.who) && add(out, 5, 'index_character', `beats.${b.id}.lines[${i}]`, `beat ${b.id} is spoken by unregistered "${l.who}"`)));
  }
  // every pocket line and culture phrase is made of words the lexicon knows
  const tokensOf = (ja: string): string[] => ja.split('|').filter((t) => t && !/^\{\w+\}$/.test(t) && !/^[。、！？!?,.「」『』…・（）()]+$/.test(t));
  const lexicon = (line: { ja: string }, path: string, what: string): void => {
    for (const t of tokensOf(line.ja)) if (!index.lexiconSurfaces.has(t)) add(out, 5, 'index_lexicon', path, `${what} uses "${t}", which the lexicon does not know`);
  };
  Object.values(pack.pockets).forEach((p) => lexicon(p.line, `pockets.${p.id}.line`, `pocket line ${p.id}`));
  pack.culture.forEach((c, i) => lexicon(c.phrase, `culture[${i}].phrase`, `card ${c.id}`));
  Object.values(pack.beats).forEach((b) => b.lines.forEach((l, i) => lexicon(l.line, `beats.${b.id}.lines[${i}]`, `beat ${b.id}`)));
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------------------------

/**
 * Pack-internal integrity (§14.5): level 1 structure and ids, 2 slice-2 content, 3 catalog / sale routes / gates, 4 chapter graph with
 * prerequisites (§7.1), 5 everything. Issues whose level is above `level` are not reported. `index` (injected by the content tests)
 * enables the cross-checks against scenarios, lexicon and slots.
 * Sale routes: an item or menu id needs a `ScenarioMeta.shop.itemMap` entry (main, `extraSlots` or `fixedItem`) unless its shop has
 * `surface: 'panel'` (vending, ticket machines); heart / chapter rewards (`BeatEffect`, `PerkDef once_item`) are granted, not sold.
 * Level 4 includes the prerequisite check (every objective satisfiable with what is open at its chapter's start), acyclic scenario
 * gates and the bot, which plays the chapters in order and must reach the end, the flat path with at most one heart for its landlady.
 */
export function validatePack(pack: GamePack, opts: { level: ValidationLevel; index?: ContentIndex }): ValidationIssue[] {
  const out: Out = [];
  level1(pack, out);
  level2(pack, out);
  level3(pack, out);
  level4(pack, out);
  level5(pack, out, opts.index);
  // unresolved ids and predicate requirements are only reported once their level is asked for
  return out.filter((i) => i.level <= opts.level);
}

// ---------------------------------------------------------------------------------------------------------------
// validateState
// ---------------------------------------------------------------------------------------------------------------

const NO_VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: '', level: 'A1', createdAt: '' },
};

/** Invariants of a saved state: wallet >= 0 and within caps, reconcile against totals, ids known to the pack or kept in `_extra`, chapter cache consistent. */
export function validateState(state: GameState, pack: GamePack): ValidationIssue[] {
  const out: Out = [];
  const bad = (code: string, path: string, message: string): void => add(out, 1, code, path, message);
  if (state.v !== 1) bad('version', 'v', `state version must be 1, found ${String(state.v)}`);
  if (state.packId !== pack.id) bad('pack', 'packId', `the state belongs to pack "${state.packId}", not "${pack.id}"`);

  // clock
  const c = state.clock;
  if (!isInt(c.dayIndex) || c.dayIndex < 0) bad('clock', 'clock.dayIndex', 'dayIndex is a whole number, 0 or more');
  if (!isInt(c.activeDays) || c.activeDays < 0 || c.activeDays > c.dayIndex + 1) bad('clock', 'clock.activeDays', 'activeDays is between 0 and dayIndex + 1');
  if (!isInt(c.lastActiveDay) || c.lastActiveDay < -1 || c.lastActiveDay > c.dayIndex) bad('clock', 'clock.lastActiveDay', 'lastActiveDay is between -1 and dayIndex');
  if (c.lastLocalDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(c.lastLocalDate)) bad('clock', 'clock.lastLocalDate', 'lastLocalDate is YYYY-MM-DD');

  // wallet and totals
  const lim = walletLimits(state, pack);
  for (const p of ['cash', 'ic', 'points'] as const) {
    const v = state.wallet[p];
    if (!isInt(v) || v < 0) bad('wallet', `wallet.${p}`, `${p} must be a whole number, 0 or more`);
    const cap = p === 'ic' ? lim.ic : lim.cash;
    if (v > cap) bad('wallet_cap', `wallet.${p}`, `${p} ${v} is above its cap ${cap}`);
  }
  const rec = reconcile(state, pack.economy.startCash);
  if (!rec.ok) bad('reconcile', 'totals', `cash + ic is ${rec.actual}, totals say ${rec.expected}${rec.mismatches.length ? `; checksum differs for ${rec.mismatches.join(', ')}` : ''}`);
  if (state.totals.earned < 0 || state.totals.spent < 0) bad('totals', 'totals', 'earned and spent are 0 or more');
  if (state.ledger.length > BALANCE.ledger.entries) bad('ring', 'ledger', `the ledger ring holds at most ${BALANCE.ledger.entries} entries`);
  if (state.seen.length > BALANCE.ledger.seen) bad('ring', 'seen', `the seen ring holds at most ${BALANCE.ledger.seen} ids`);
  const ids = new Set<string>();
  state.ledger.forEach((e, i) => {
    if (ids.has(e.id)) bad('ledger_duplicate', `ledger[${i}]`, `entry id "${e.id}" appears twice`);
    ids.add(e.id);
    if (!isInt(e.delta)) bad('ledger', `ledger[${i}].delta`, 'a delta is a whole number');
  });

  // ids the pack knows (or `_extra` keeps)
  const known = (label: string, keys: string[], registry: Set<string>, path: string): void => {
    if (registry.size === 0) return;
    for (const k of keys) if (!registry.has(k)) bad('unknown_id', path, `${label} "${k}" is not in the pack (it belongs under _extra)`);
  };
  const itemIds = new Set([...pack.items.map((i) => i.id), ...pack.menu.map((m) => m.id)]);
  known('item', Object.keys(state.owned), itemIds, 'owned');
  for (const [id, e] of Object.entries(state.owned)) {
    if (!isInt(e.qty) || e.qty < 1) bad('owned_qty', `owned.${id}`, 'a quantity is a whole number of at least 1');
    if (pack.items.find((i) => i.id === id)?.once && e.qty > 1) bad('owned_once', `owned.${id}`, `${id} is single-ownership`);
  }
  known('scenario', Object.keys(state.runs), new Set(pack.scenarioMeta.map((m) => m.id)), 'runs');
  for (const [id, r] of Object.entries(state.runs)) if (![0, 1, 2, 3].includes(r.stars)) bad('stars', `runs.${id}.stars`, 'stars are 0-3');
  known('friend', Object.keys(state.friends), new Set(pack.friends.map((f) => f.id)), 'friends');
  for (const [id, f] of Object.entries(state.friends)) {
    if (!isInt(f.ap) || f.ap < 0) bad('friend', `friends.${id}.ap`, 'AP is a whole number, 0 or more');
    if (f.unread !== f.threads.length || f.threads.length > BALANCE.ap.chat.unreadMax) bad('friend', `friends.${id}.unread`, `unread must equal the ${f.threads.length} waiting threads and be at most ${BALANCE.ap.chat.unreadMax}`);
  }
  known('job', Object.keys(state.jobs), new Set(pack.jobs.map((j) => j.id)), 'jobs');
  known('culture card', Object.keys(state.culture), new Set(pack.culture.map((x) => x.id)), 'culture');
  known('title', state.titles, new Set(pack.titles.map((t) => t.id)), 'titles');
  known('pocket line', Object.keys(state.prep), new Set(Object.keys(pack.pockets)), 'prep');
  if (state.activeTitle !== null && !state.titles.includes(state.activeTitle)) bad('title', 'activeTitle', 'the shown title must be one the player has');
  if (state.dream.id !== null && pack.dreams.length > 0 && !pack.dreams.some((d) => d.id === state.dream.id)) bad('unknown_id', 'dream.id', `dream "${state.dream.id}" is not in the pack`);
  known('dream step', Object.keys(state.dream.steps), new Set(pack.dreams.flatMap((d) => d.steps.map((s) => s.id))), 'dream.steps');

  // chapter
  const lastChapter = pack.chapters.reduce((m, x) => Math.max(m, x.n), 0);
  if (!isInt(state.chapter.n) || state.chapter.n < 1 || state.chapter.n > BALANCE.freeWalkChapter || (lastChapter > 0 && state.chapter.n > lastChapter && state.chapter.n !== BALANCE.freeWalkChapter)) {
    bad('chapter', 'chapter.n', `the current chapter is 1-${lastChapter || BALANCE.chapters} or Free Walk (${BALANCE.freeWalkChapter})`);
  }
  const objectiveIds = new Set(pack.chapters.flatMap((x) => x.objectives.map((o) => o.id)));
  known('objective', Object.keys(state.chapter.done), objectiveIds, 'chapter.done');
  known('objective', state.chapter.easier, objectiveIds, 'chapter.easier');
  if (pack.chapters.length > 0) {
    const want = deriveCompleted(pack, state, NO_VIEW);
    const have = [...state.chapter.completed].sort((a, b) => a - b);
    if (want.length !== have.length || want.some((n, i) => n !== have[i])) bad('completed_cache', 'chapter.completed', `the completed cache is [${have}], re-derived [${want}]`);
  }

  // home, outfit
  for (const [slot, id] of Object.entries(state.home.placed)) if ((state.owned[id]?.qty ?? 0) < 1) bad('home', `home.placed.${slot}`, `"${id}" is placed but not owned`);
  for (const id of state.outfit.equipped) if ((state.owned[id]?.qty ?? 0) < 1) bad('outfit', 'outfit.equipped', `"${id}" is worn but not owned`);
  if (state.home.tier === 'ono' && !pack.items.some((i) => i.fx.some((f) => f.t === 'homeTier') && (state.owned[i.id]?.qty ?? 0) > 0)) bad('home', 'home.tier', 'the flat tier needs the flat to be owned');

  // counters
  const s = state.stats;
  for (const [k, v] of Object.entries({ purchases: s.purchases, spentOnPurchases: s.spentOnPurchases, tickets: s.tickets, sayNew: s.sayNew, srsReviews: s.srsReviews })) if (!isInt(v) || v < 0) bad('stats', `stats.${k}`, `${k} is a whole number, 0 or more`);
  if (state.income.length > BALANCE.dream.etaWindowDays) bad('ring', 'income', `income keeps at most ${BALANCE.dream.etaWindowDays} days`);
  if (state.coach.recent.length > BALANCE.coach.recent) bad('ring', 'coach.recent', `the coach keeps at most ${BALANCE.coach.recent} conversations`);
  for (const [id, j] of Object.entries(state.jobs)) if (j.rank < 0 || j.rank >= BALANCE.shift.rankMult.length) bad('job', `jobs.${id}.rank`, 'rank is 0-4');
  return out;
}

