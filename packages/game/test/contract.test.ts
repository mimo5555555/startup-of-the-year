import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as game from '@lw/game';
import type { Gloss as ContentGloss, Line as ContentLine, Cefr as ContentCefr } from '@lw/content';

// The contract: every named helper exists with its final signature (arity) and owner. Owners replace a stub body in their own module;
// this test stays green because a function that no longer throws 'not implemented' is simply "implemented". A changed arity is a
// contract change and needs a written request (docs/GAME_DESIGN.md §15.1). `arity` counts every declared parameter; an owner may
// give a trailing optional one a default (`m: PayMethod = 'cash'`), which lowers `Function.length`, so `min` is the number of
// required parameters (defaults to `arity`). Owners may export extra helpers from their own module: only the names below are frozen.

const API: Record<string, { agent: string; arity: number; min?: number }> = {
  // money.ts, ledger.ts, pricing.ts
  yenFormat: { agent: '1B', arity: 2 },
  workHours: { agent: '1B', arity: 2 },
  scaleAmount: { agent: '1B', arity: 3 },
  walletLimits: { agent: '1B', arity: 2 },
  canAfford: { agent: '1B', arity: 3, min: 2 },
  applyLedger: { agent: '1B', arity: 3 },
  topUp: { agent: '1B', arity: 5 },
  refundIc: { agent: '1B', arity: 4 },
  reconcile: { agent: '1B', arity: 2 },
  menuPrice: { agent: '1B', arity: 3 },
  quote: { agent: '1B', arity: 4 },
  commitPurchase: { agent: '1B', arity: 3 },
  itemAvailability: { agent: '1B', arity: 4 },
  haggleLimit: { agent: '1B', arity: 4 },
  fareFor: { agent: '1B', arity: 4 },
  pointsEarn: { agent: '1B', arity: 3 },
  // payout.ts
  turnStats: { agent: '1C', arity: 1 },
  settleLoop: { agent: '1C', arity: 3 },
  payoutFactor: { agent: '1C', arity: 2 },
  applySettlement: { agent: '1C', arity: 4 },
  applyEcho: { agent: '1C', arity: 3 },
  starsFor: { agent: '1C', arity: 1 },
  estimatePay: { agent: '1C', arity: 5, min: 4 },
  // objectives.ts, daily.ts, dreams.ts
  evalPred: { agent: '1D', arity: 3 },
  predProgress: { agent: '1D', arity: 3 },
  evaluateAll: { agent: '1D', arity: 3, min: 2 },
  requires: { agent: '1D', arity: 2 },
  openChapter: { agent: '1D', arity: 3 },
  isOpen: { agent: '1D', arity: 4 },
  chapterStatus: { agent: '1D', arity: 3 },
  nextBestGoals: { agent: '1D', arity: 3 },
  nextBestGoal: { agent: '1D', arity: 4, min: 3 },
  generateDaily: { agent: '1D', arity: 3 },
  rolloverDaily: { agent: '1D', arity: 3 },
  swapDaily: { agent: '1D', arity: 4 },
  updateDaily: { agent: '1D', arity: 4 },
  availableDreams: { agent: '1D', arity: 3 },
  defaultDream: { agent: '1D', arity: 2 },
  remainingCost: { agent: '1D', arity: 3 },
  dreamProgress: { agent: '1D', arity: 3 },
  // friends.ts, inventory.ts, shifts.ts, integrity.ts
  heartsForAp: { agent: '1E', arity: 1 },
  applyTalk: { agent: '1E', arity: 5 },
  applyGift: { agent: '1E', arity: 3 },
  reactionFor: { agent: '1E', arity: 3 },
  giftCap: { agent: '1E', arity: 1 },
  giftAp: { agent: '1E', arity: 5 },
  friendActions: { agent: '1E', arity: 4 },
  queueThreads: { agent: '1E', arity: 4 },
  grantItem: { agent: '1E', arity: 5 },
  ownedQty: { agent: '1E', arity: 2 },
  ownsCategory: { agent: '1E', arity: 3 },
  applyOutfit: { agent: '1E', arity: 4 },
  placeItem: { agent: '1E', arity: 4 },
  comfort: { agent: '1E', arity: 2 },
  avatarPatch: { agent: '1E', arity: 2 },
  rideOf: { agent: '1E', arity: 2 },
  giftInfo: { agent: '1E', arity: 2 },
  generateShift: { agent: '1E', arity: 3 },
  applyShift: { agent: '1E', arity: 4 },
  scoreShift: { agent: '1E', arity: 1 },
  shiftPay: { agent: '1E', arity: 4 },
  shiftRepeatMult: { agent: '1E', arity: 2 },
  rankFor: { agent: '1E', arity: 1 },
  localDateString: { agent: '1E', arity: 1 },
  observeClock: { agent: '1E', arity: 2 },
  dedupe: { agent: '1E', arity: 2 },
  markActive: { agent: '1E', arity: 1 },
  // reducer.ts, persist.ts, validate.ts, selectors.ts
  reduce: { agent: '1F', arity: 3 },
  createGameState: { agent: '1F', arity: 2 },
  needsFlush: { agent: '1F', arity: 1 },
  migrate: { agent: '1F', arity: 3 },
  seedFromLegacy: { agent: '1F', arity: 3 },
  validatePack: { agent: '1F', arity: 2 },
  validateState: { agent: '1F', arity: 2 },
  hearts: { agent: '1F', arity: 2 },
  currentChapter: { agent: '1F', arity: 2 },
  derivedFlags: { agent: '1F', arity: 2 },
  disclosure: { agent: '1F', arity: 3 },
  lineReady: { agent: '1F', arity: 3 },
  pocketReady: { agent: '1F', arity: 4 },
  coachOffer: { agent: '1F', arity: 1 },
};

/** Implemented by the contract itself (pure builders and constants); they are exempt from the "throws not implemented" check. */
const IMPLEMENTED = ['dayKey', 'gameStorageKey', 'LEDGER_IDS', 'BALANCE', 'GAME_STORE_VERSION', 'emptyFriend', 'emptyRun', 'emptyJob', 'emptyPay', 'heartsForAp', 'hearts'];

const exportsOf = game as unknown as Record<string, unknown>;

describe('@lw/game contract', () => {
  it('exports every named helper as a function with its final arity', () => {
    for (const [name, spec] of Object.entries(API)) {
      expect(typeof exportsOf[name], name).toBe('function');
      const len = (exportsOf[name] as (...a: unknown[]) => unknown).length;
      expect(len, `${name} arity`).toBeLessThanOrEqual(spec.arity);
      expect(len, `${name} required parameters`).toBeGreaterThanOrEqual(spec.min ?? spec.arity);
    }
  });

  it('every unimplemented stub throws "not implemented: <name> (agent <owner>)"', () => {
    for (const [name, spec] of Object.entries(API)) {
      let err: unknown = null;
      try {
        (exportsOf[name] as (...a: unknown[]) => unknown)();
      } catch (e) {
        err = e;
      }
      const msg = err instanceof Error ? err.message : '';
      // An owner who has filled the body is free to fail differently on empty input (a TypeError) or return.
      if (msg.startsWith('not implemented')) expect(msg).toBe(`not implemented: ${name} (agent ${spec.agent})`);
      if (IMPLEMENTED.includes(name)) expect(msg.startsWith('not implemented'), name).toBe(false);
    }
  });

  it('BALANCE is deeply frozen', () => {
    const walk = (o: object, path: string) => {
      expect(Object.isFrozen(o), path).toBe(true);
      for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v, `${path}.${k}`);
    };
    walk(game.BALANCE, 'BALANCE');
    expect(() => {
      (game.BALANCE as unknown as { softCap: number }).softCap = 1;
    }).toThrow();
  });

  it('BALANCE carries the §4.7 headline numbers', () => {
    const B = game.BALANCE;
    expect(B.credit).toEqual({ I: 1, thinI: 0.6, S: 0.35, T: 0.25 });
    expect(B.base).toEqual({ A1: 1500, A2: 2200, B1: 3000 });
    expect([...B.dayFactor]).toEqual([1, 0.35, 0.1, 0]);
    expect(B.stars).toEqual({ 1: 200, 2: 400, 3: 600 });
    expect([...B.ap.thresholds]).toEqual([30, 80, 150, 240, 350]);
    expect(B.softCap).toBe(14000);
    expect(B.goals).toMatchObject({ each: 100, all: 150, streakPer: 15, streakMax: 150, windowDays: 2 });
    expect(B.shift).toMatchObject({ hours: 0.75, units: 15, customers: 5 });
    expect(B.startCash).toBe(3000);
    expect(B.icCap).toMatchObject({ early: 3000, late: 20000 });
    expect(B.walletCap).toBe(9999999);
    expect(B.haggle).toMatchObject({ pct: 0.06, max: 8880, assisted: 0.4 });
  });

  it('ledger id builders follow §14.9', () => {
    expect(game.dayKey(12)).toBe('d12');
    const L = game.LEDGER_IDS;
    expect(L.loop('s1')).toBe('loop:s1');
    expect(L.purchase('s1', 2)).toBe('purchase:s1:2');
    expect(L.goal(3, 'g_buy')).toBe('goal:d3:g_buy');
    expect(L.streak(3)).toBe('streak:d3');
    expect(L.chapter(4)).toBe('chapter:4');
    expect(L.star('konbini', 2)).toBe('star:konbini:2');
    expect(L.phrase('d3', 1)).toBe('phrase:d3:1');
    expect(L.echo('s1', 'l1')).toBe('echo:s1:l1');
    expect(L.shift('d3', 'job_konbini', 1)).toBe('shift:d3:job_konbini:1');
    expect(L.gift('s1')).toBe('gift:s1');
    expect(L.perk('phone_fund')).toBe('perk:phone_fund');
  });

  it('persists under lw.game.<packId>.v1', () => {
    expect(game.GAME_STORE_VERSION).toBe(1);
    expect(game.gameStorageKey('jp')).toBe('lw.game.jp.v1');
  });

  it('is pure: no React, DOM, Three or sibling-package imports in src', () => {
    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(dir + f, 'utf8');
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec.startsWith('.') || spec === '@lw/core', `${f} imports ${spec}`).toBe(true);
      }
      expect(/\b(document|window|localStorage|navigator)\./.test(src), `${f} touches the DOM`).toBe(false);
    }
  });

  it('Gloss / Line / Cefr are structurally compatible with @lw/content (both directions)', () => {
    const cg: ContentGloss = { en: 'a', ar: 'b' };
    const gg: game.Gloss = cg;
    const cg2: ContentGloss = gg;
    const cl: ContentLine = { ja: 'x', en: 'a', ar: 'b', tts: 't' };
    const gl: game.Line = cl;
    const cl2: ContentLine = gl;
    const cefr: game.Cefr = 'A1' as ContentCefr;
    const cefr2: ContentCefr = cefr;
    expect([cg2.en, cl2.ja, cefr2]).toEqual(['a', 'x', 'A1']);
  });
  it('the dependency graph stays acyclic: content, engine and world only ever `import type` from @lw/game', () => {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(dir + d.name + '/') : /\.(ts|tsx)$/.test(d.name) ? [dir + d.name] : []));
    for (const pkg of ['content', 'engine']) {
      for (const f of walk(`${root}${pkg}/src/`)) {
        const src = readFileSync(f, 'utf8');
        for (const m of src.matchAll(/^\s*(import|export)\s+(type\s+)?[^;]*?from\s+['"]@lw\/game['"]/gm)) {
          expect(m[2], `${f}: only \`import type\` may reach @lw/game`).toBe('type ');
        }
      }
    }
    for (const f of walk(`${root}world/src/`)) expect(/@lw\/game/.test(readFileSync(f, 'utf8')), `${f}: world has no game import`).toBe(false);
  });

  it('hearts are derived once: heartsForAp over BALANCE.ap.thresholds, and the selector delegates', () => {
    const th = [...game.BALANCE.ap.thresholds];
    expect([0, 29, 30, 79, 80, 149, 150, 239, 240, 349, 350, 9999].map(game.heartsForAp)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(th).toEqual([30, 80, 150, 240, 350]);
    const st = { friends: { mio: { ap: 85 } } } as unknown as game.GameState;
    expect(game.hearts(st, 'mio')).toBe(2);
    expect(game.hearts(st, 'nobody')).toBe(0);
  });

  it('the empty-slice builders are JSON-safe, independent copies of their types', () => {
    const f = game.emptyFriend(7);
    expect(f).toMatchObject({ ap: 0, met: false, apDay: 7, gifts: 0, giftsLiked: 0, giftsLoved: 0, unread: 0 });
    expect(game.emptyFriend(1).facts).not.toBe(f.facts);
    expect(game.emptyRun()).toEqual({ count: 0, complete: false, stars: 0, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [] });
    expect(game.emptyJob()).toEqual({ shifts: 0, good: 0, perfect: 0, rank: 0, recent: [] });
    const pay = game.emptyPay(game.dayKey(3));
    expect(pay.day).toBe('d3');
    for (const v of [f, pay, game.emptyRun(), game.emptyJob()]) expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });

  it('every money-moving path has an input event (compile-time: this table fails to build if one is removed)', () => {
    const ev: Record<string, game.InputEvent> = {
      purchase: { t: 'purchase', sessionId: 's', n: 1, shopId: 'konbini', itemId: 'konbini:onigiri', qty: 1, total: 160, method: 'cash', lines: [], eatIn: false },
      topup: { t: 'topup', id: 'p1', amount: 1000 },
      refund: { t: 'refund', id: 'p2' },
      fare: { t: 'fare', id: 'p3', place: 'shinjuku', method: 'ic', legs: 2 },
      ramenTicket: { t: 'ticket_bought', kind: 'ramen', flavor: 'miso' },
      stationTicket: { t: 'ticket_bought', kind: 'station', place: 'ueno' },
      profile: { t: 'profile_set', nameKana: 'アリ', audio: { listenPref: 'off' } },
      diary: { t: 'diary_added', entry: { chapter: 8, ja: 'x', assisted: false } },
      swap: { t: 'daily_swap', goalId: 'g_buy' },
      heart: { t: 'heart_event_done', friendId: 'mio', level: 2 },
      dev: { t: 'dev', cmd: 'cash', amount: 10000 },
      friendFlag: { t: 'flag', id: 'casual', friendId: 'mio' },
    };
    expect(Object.keys(ev)).toHaveLength(12);
    const p: game.PurchaseEvent = ev.purchase as game.PurchaseEvent;
    expect(p.itemId).toBe('konbini:onigiri');
  });
});
