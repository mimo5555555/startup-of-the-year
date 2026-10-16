// The Shift screen (agent 4D, docs/GAME_DESIGN.md §9): you on the staff side of the konbini counter. Five customers: listen (text hidden by
// default), take the order from the item grid, say the total, say thanks. No timer anywhere. The result is one `shift_done` event; the
// reducer pays it (`applyShift`), so what this screen shows is what the wallet got. Leaving mid-shift is a quit (paid x0.6 from 2 customers).
import { useEffect, useMemo, useRef, useState } from 'react';
import { scenarioById } from '@lw/content';
import { uid } from '@lw/core';
import {
  BALANCE,
  evalPred,
  generateShift,
  scoreShift,
  shiftAssistWaived,
  shiftPay,
  shiftRepeatMult,
  type DerivedEvent,
  type JobDef,
  type ShiftCustomer,
  type ShiftInput,
  type ShiftPlan,
  type ShiftResult,
} from '@lw/game';
import { Icon } from '../components/Icon';
import {
  AnswerBox,
  CustomerBubble,
  OrderPad,
  Steps,
  Verdict,
  sayMarkup,
  type AnswerSpec,
  type StepState,
} from '../components/game/shift/ShiftParts';
import { DeskPad, type DeskPick } from '../components/game/shift/StationWidgets';
import { deskAnswerOf, deskPhrase, deskPickOk, deskSaid, deskWrong, isDesk } from '../components/game/shift/stationLogic';
import { IntroGate, JobCard, QuitSheet, RefuseCard, ResultCard, type ResultData } from '../components/game/shift/ShiftCards';
import {
  NO_FLAGS,
  amountDistractors,
  amountSaid,
  assistOf,
  buildResult,
  changeOf,
  changePhrase,
  flagsFor,
  isSplit,
  splitTotals,
  thanksWrong,
  lowerInput,
  menuFor,
  newTrack,
  nearAmounts,
  orderCorrect,
  thanksSaid,
  totalPhrase,
  voiceOff,
  yenLtr,
  wantedOf,
  wordsFromShift,
  type Cart,
  type FlagId,
  type Flags,
  type Track,
} from '../components/game/shift/shiftLogic';
import { applySrsOps, dispatch, startConversation } from '../game/bridge';
import { getGame } from '../game/gameStore';
import { useGameState, useGameView } from '../game/hooks';
import { PACK } from '../game/pack';
import { characterById, displayName } from '../content';
import { useT } from '../hooks';
import { tts } from '../services';
import { useStore } from '../store';
import { useUi } from '../ui';

const JOB_DEFAULT = 'job_konbini';

type Stage = 'order' | 'total' | 'change' | 'thanks' | 'verdict' | 'done';

interface Verdict {
  detail?: string;
  markup?: string;
  gloss?: string;
  next: Stage;
}

interface Play {
  plan: ShiftPlan;
  i: number;
  tracks: Track[];
  stage: Stage;
  startedAt: number;
  cant: boolean;
  /** the first shifts at the job waive the assist factors (read before this shift is counted) */
  waived0: boolean;
  cart: Cart;
  flags: Flags;
  verdict: Verdict | null;
  /** the total answer held while the change (or the second bill of a split) is asked */
  totalPart: { ok: boolean; input: ShiftInput } | null;
  /** the café's table number, once tapped */
  table: number | null;
  /** the station widget's tap, before it is confirmed */
  pick: DeskPick | null;
}

type Phase = { t: 'card' } | { t: 'play'; play: Play } | { t: 'result'; data: ResultData };

const fmt = (n: number): string => n.toLocaleString('en-US');

export function Shift() {
  const { t } = useT();
  const go = useStore((s) => s.go);
  const args = useUi((s) => s.args.shift);
  const job = PACK.jobs.find((j) => j.id === (args?.jobId ?? JOB_DEFAULT));
  if (!job || job.archetypes.length === 0) {
    return (
      <Shell title={t('jobs.start')} onBack={() => go('world')}>
        <p data-unavailable>{t('jobs.unavailable')}</p>
      </Shell>
    );
  }
  return <ShiftJob key={job.id} job={job} />;
}

function ShiftJob({ job }: { job: JobDef }) {
  const { t, lang } = useT();
  const go = useStore((s) => s.go);
  const settings = useStore((s) => s.settings);
  const vocab = useStore((s) => s.vocab);
  const profile = useStore((s) => s.profile);
  const game = useGameState();
  const view = useGameView();
  const jobId = job.id;
  const [phase, setPhase] = useState<Phase>({ t: 'card' });
  const [quitting, setQuitting] = useState(false);
  const finished = useRef(false);
  const menu = useMemo(() => menuFor(PACK, job), [job]);

  // leaving the screen stops the customer's voice
  useEffect(() => () => tts.cancel(), []);

  const play = phase.t === 'play' ? phase.play : null;
  const noVoice = voiceOff(game.audio, settings.autoSpeak);
  const customerIdx = play?.i ?? -1;
  const stage = play?.stage;

  // the customer speaks when they step up to the counter
  useEffect(() => {
    if (!play || stage !== 'order' || noVoice || play.cant) return;
    const c = play.plan.customers[play.i];
    if (c) sayMarkup(c.line.ja);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerIdx, play ? 1 : 0]);

  const js = game.jobs[jobId];
  const rank = js?.rank ?? 0;
  const mult = shiftRepeatMult(game, jobId);
  const introNeeded =
    !!job.intro &&
    !!scenarioById(job.intro) &&
    !evalPred({ k: 'scenario', id: job.intro, complete: true }, game, {
      pack: PACK,
      view,
    });
  const age = profile?.age;
  const helping = age === 'kids' || age === 'teens';
  const big = age === 'kids' || age === 'seniors';

  const back = () => go('world');

  // ---------------- starting ----------------
  const dueSurfaces = (): string[] => {
    const now = Date.now();
    return vocab.filter((v) => v.kind === 'word' && new Date(v.card.due).getTime() <= now).map((v) => v.s);
  };
  const start = () => {
    const current = getGame();
    if (shiftRepeatMult(current, jobId) <= 0) return;
    finished.current = false;
    const state = current.jobs[jobId];
    const plan = generateShift(PACK, jobId, {
      rank: state?.rank ?? 0,
      seed: Math.floor(Math.random() * 0x7fffffff),
      dueWords: dueSurfaces(),
      recent: state?.recent ?? [],
    });
    const first = plan.customers[0];
    if (!first) return;
    setPhase({
      t: 'play',
      play: {
        plan,
        i: 0,
        tracks: [newTrack(first.templateId)],
        stage: 'order',
        startedAt: Date.now(),
        cant: false,
        waived0: shiftAssistWaived(current, jobId),
        cart: {},
        flags: NO_FLAGS,
        verdict: null,
        totalPart: null,
        table: null,
        pick: null,
      },
    });
  };

  // ---------------- finishing ----------------
  const settle = (p: Play, quit: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const waived = p.waived0 || noVoice || p.cant;
    const result: ShiftResult = buildResult({
      id: uid('sh'),
      jobId,
      tracks: p.tracks,
      quit,
      startedAt: p.startedAt,
      now: Date.now(),
      assistWaived: waived,
    });
    const local = scoreShift(result);
    let derived: DerivedEvent[] = [];
    if (local.served >= BALANCE.shift.quitMinServed || !quit) derived = dispatch({ t: 'shift_done', jobId, result }).derived;
    const settled = derived.find((d): d is Extract<DerivedEvent, { t: 'shift_settled' }> => d.t === 'shift_settled');
    const saved = (surface: string) => vocab.some((v) => v.s === surface || v.key === surface);
    const after = getGame();
    const next = shiftRepeatMult(after, jobId);
    const rankBefore = settled?.rankBefore ?? rank;
    setPhase({
      t: 'result',
      data: {
        score: settled?.score ?? local,
        pay: settled?.pay ?? 0,
        rankBefore,
        rankAfter: settled?.rankAfter ?? rankBefore,
        quit,
        assisted: p.tracks.filter((tr) => assistOf(tr) !== 'none').length,
        bonusItem: derived.some((d) => d.t === 'unlocked' && d.what === 'item' && d.id === job.bonus.itemId),
        bonusName: PACK.items.find((i) => i.id === job.bonus.itemId)?.name[lang] ?? PACK.menu.find((m) => m.id === job.bonus.itemId)?.name[lang] ?? '',
        words: wordsFromShift(p.plan.customers, p.tracks, menu, saved),
        savedWords: false,
        canAgain: next > 0,
        againMult: next,
      },
    });
  };

  const quitNow = () => {
    setQuitting(false);
    if (play) settle(play, true);
  };

  // ---------------- the quit preview ----------------
  const quitPreview = (): { served: number; pay: number } => {
    if (!play) return { served: 0, pay: 0 };
    const waived = play.waived0 || noVoice || play.cant;
    const r = buildResult({
      id: 'preview',
      jobId,
      tracks: play.tracks,
      quit: true,
      startedAt: play.startedAt,
      now: Date.now(),
      assistWaived: waived,
    });
    const score = scoreShift(r);
    return {
      served: score.served,
      pay: shiftPay(job, score, rank, mult, PACK),
    };
  };

  // ---------------- play steps ----------------
  const patch = (fn: (p: Play) => Play) => setPhase((cur) => (cur.t === 'play' ? { t: 'play', play: fn(cur.play) } : cur));
  const patchTrack = (p: Play, fn: (tr: Track) => Track): Play => ({
    ...p,
    tracks: p.tracks.map((tr, k) => (k === p.i ? fn(tr) : tr)),
  });

  const customer = play ? play.plan.customers[play.i]! : null;
  const track = play ? play.tracks[play.i]! : null;
  const want = customer ? wantedOf(customer, menu) : null;
  const flagIds = flagsFor(job.place);
  const isCafe = job.place === 'cafe';
  /** the correct answer of a desk customer, in words ("Platform 2", "10:20", "¥170", "Right") */
  const deskText = (c: ShiftCustomer): string => {
    const a = deskAnswerOf(c);
    if (!a) return '';
    if (a.kind === 'platform' || a.kind === 'announce') return t('jobs.ans.platform', { n: String(a.value) });
    if (a.kind === 'fare') return yenLtr(Number(a.value));
    if (a.kind === 'time') return String(a.value);
    return t(`jobs.dir.${a.value}` as 'jobs.dir.left');
  };
  const wantText = (): string => {
    if (!customer || !want) return '';
    if (isDesk(customer)) return deskText(customer);
    const names = Object.entries(want.cart).map(([id, q]) => {
      const m = menu.find((x) => x.id === id);
      return `${m ? m.name[lang === 'ar' ? 'ar' : 'en'] : id} ×${q}`;
    });
    if (want.flags.heat) names.push(t('jobs.heat'));
    if (want.flags.nobag) names.push(t('jobs.noBag'));
    if (want.flags.hot) names.push(t('jobs.hot'));
    if (want.flags.iced) names.push(t('jobs.iced'));
    if (want.table !== undefined) names.push(t('jobs.tableN', { n: want.table }));
    return names.join(' · ');
  };

  /** the amounts a counter customer owes: one total, then (change or a split bill) a second thing to say */
  const splitOf = (c: ShiftCustomer) => splitTotals(c, menu);
  const firstTotal = (c: ShiftCustomer): number => splitOf(c)?.[0] ?? c.total ?? 0;
  const secondOf = (c: ShiftCustomer): { kind: 'change' | 'split'; amount: number } | undefined => {
    const sp = splitOf(c);
    if (sp) return { kind: 'split', amount: sp[1] };
    const back_ = changeOf(c);
    return back_ !== undefined ? { kind: 'change', amount: back_ } : undefined;
  };
  const totalMarkup = (c: ShiftCustomer): { markup: string; gloss?: string } =>
    isDesk(c) ? { markup: deskPhrase(c) ?? '' } : { markup: totalPhrase(firstTotal(c)), gloss: `¥${fmt(firstTotal(c))}` };

  const confirmOrder = () =>
    patch((p) => {
      const c = p.plan.customers[p.i]!;
      const ok = orderCorrect(c, menu, p.cart, p.flags, p.table);
      const q = patchTrack(p, (tr) => ({ ...tr, order: ok }));
      return ok
        ? { ...q, stage: 'total' }
        : {
            ...q,
            stage: 'verdict',
            verdict: { detail: wantText(), next: 'total' },
          };
    });

  const confirmDesk = () =>
    patch((p) => {
      const c = p.plan.customers[p.i]!;
      const ok = !!p.pick && deskPickOk(c, p.pick.value);
      const q = patchTrack({ ...p, pick: null }, (tr) => ({ ...tr, order: ok }));
      return ok ? { ...q, stage: 'total' } : { ...q, stage: 'verdict', verdict: { detail: wantText(), next: 'total' } };
    });

  const answerTotal = (ok: boolean, input: ShiftInput) =>
    patch((p) => {
      const c = p.plan.customers[p.i]!;
      const second = secondOf(c);
      const right = totalMarkup(c);
      if (second) {
        const part = { ok, input };
        return ok
          ? { ...p, stage: 'change', totalPart: part }
          : {
              ...p,
              stage: 'verdict',
              totalPart: part,
              verdict: { ...right, next: 'change' },
            };
      }
      const q = patchTrack(p, (tr) => ({ ...tr, total: { ok, input } }));
      return ok ? { ...q, stage: 'thanks' } : { ...q, stage: 'verdict', verdict: { ...right, next: 'thanks' } };
    });

  const answerChange = (ok: boolean, input: ShiftInput) =>
    patch((p) => {
      const c = p.plan.customers[p.i]!;
      const part = p.totalPart ?? { ok: false, input };
      const q = patchTrack(p, (tr) => ({
        ...tr,
        total: { ok: part.ok && ok, input: lowerInput(part.input, input) },
      }));
      const second = secondOf(c)!;
      return ok
        ? { ...q, stage: 'thanks', totalPart: null }
        : {
            ...q,
            stage: 'verdict',
            totalPart: null,
            verdict: {
              markup: second.kind === 'split' ? totalPhrase(second.amount) : changePhrase(second.amount),
              gloss: `¥${fmt(second.amount)}`,
              next: 'thanks',
            },
          };
    });

  const answerThanks = (ok: boolean, input: ShiftInput) =>
    patch((p) => {
      const c = p.plan.customers[p.i]!;
      const q = patchTrack(p, (tr) => ({ ...tr, thanks: { ok, input } }));
      return ok
        ? { ...q, stage: 'done' }
        : {
            ...q,
            stage: 'verdict',
            verdict: { markup: c.thanks[0], next: 'done' },
          };
    });

  const nextCustomer = () => {
    if (!play) return;
    if (play.i >= play.plan.customers.length - 1) return settle(play, false);
    const n = play.i + 1;
    const c = play.plan.customers[n]!;
    patch((p) => ({
      ...p,
      i: n,
      tracks: [...p.tracks, newTrack(c.templateId)],
      stage: 'order',
      cart: {},
      flags: NO_FLAGS,
      verdict: null,
      totalPart: null,
      table: null,
      pick: null,
    }));
  };

  // ---------------- answer specs ----------------
  const spec: AnswerSpec | null = useMemo(() => {
    if (!play || !customer) return null;
    const seed = play.plan.seed + play.i * 31;
    const id = `${customer.templateId}:${play.i}:${play.stage}`;
    if (play.stage === 'total' && isDesk(customer)) {
      const dw = deskWrong(customer);
      const kind = customer.task.kind;
      return {
        id,
        right: deskPhrase(customer) ?? '',
        wrong: dw.wrong,
        distractors: dw.distractors,
        check: (text) => deskSaid(customer, text),
        placeholder: t(`jobs.deskPh.${kind}` as 'jobs.deskPh.platform'),
        prompt: t(`jobs.deskSay.${kind}` as 'jobs.deskSay.platform'),
        seed,
      };
    }
    if (play.stage === 'total') {
      const total = firstTotal(customer);
      const [a, b] = nearAmounts(total);
      return {
        id,
        right: totalPhrase(total),
        wrong: [totalPhrase(a), totalPhrase(b)],
        distractors: amountDistractors(total),
        check: (text) => amountSaid(text, total),
        placeholder: t('jobs.placeholderTotal'),
        prompt: isSplit(customer) ? t('jobs.splitFirst') : t('jobs.totalPrompt'),
        seed,
      };
    }
    if (play.stage === 'change') {
      const second = secondOf(customer);
      const back_ = second?.amount ?? 10;
      const [a, b] = nearAmounts(back_);
      return {
        id,
        right: second?.kind === 'split' ? totalPhrase(back_) : changePhrase(back_),
        wrong: second?.kind === 'split' ? [totalPhrase(a), totalPhrase(b)] : [changePhrase(a), changePhrase(b)],
        distractors: amountDistractors(back_),
        check: (text) => amountSaid(text, back_),
        placeholder: t('jobs.placeholderTotal'),
        prompt:
          second?.kind === 'split'
            ? t('jobs.splitSecond')
            : t('jobs.changePrompt', {
                paid: yenLtr(customer.change?.paid ?? 1000),
              }),
        seed,
      };
    }
    if (play.stage === 'thanks') {
      return {
        id,
        right: customer.thanks[0]!,
        wrong: thanksWrong(seed),
        distractors: customer.tiles ?? [],
        check: (text) => thanksSaid(text, customer.thanks),
        placeholder: t('jobs.placeholderThanks'),
        prompt: isCafe ? t('jobs.thanksPromptCafe') : isDesk(customer) ? t('jobs.thanksPromptDesk') : t('jobs.thanksPrompt'),
        seed,
      };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play?.plan, play?.i, play?.stage, lang]);

  const stepStates = (): Array<{
    id: string;
    label: string;
    state: StepState;
  }> => {
    if (!play || !track) return [];
    const order = play.stage === 'order' ? 'now' : track.order ? 'ok' : 'bad';
    const stateOf = (done: { ok: boolean } | undefined, now: boolean): StepState =>
      done ? (done.ok ? 'ok' : 'bad') : now ? 'now' : 'todo';
    const desk = customer ? isDesk(customer) : false;
    return [
      { id: 'order', label: desk ? t('jobs.stepLook') : t('jobs.stepOrder'), state: order as StepState },
      {
        id: 'total',
        label: desk ? t('jobs.stepSay') : t('jobs.stepTotal'),
        state: play.stage === 'change' ? 'now' : stateOf(track.total, play.stage === 'total'),
      },
      {
        id: 'thanks',
        label: t('jobs.stepThanks'),
        state: stateOf(track.thanks, play.stage === 'thanks'),
      },
    ];
  };

  const saveWords = () => {
    if (phase.t !== 'result') return;
    applySrsOps(
      phase.data.words.map((w) => ({
        op: 'add' as const,
        key: w.s,
        kind: 'word' as const,
        source: 'goal' as const,
        dueInMin: 0,
      })),
    );
    setPhase({ t: 'result', data: { ...phase.data, savedWords: true } });
  };

  // ---------------- render ----------------
  const title = job.name[lang];
  const boss = characterById(job.boss);
  const bossName = boss ? displayName(boss, lang) : '';
  const headerBack = play ? () => setQuitting(true) : back;

  if (phase.t === 'card') {
    return (
      <Shell title={title} onBack={back} big={big} data-phase="card">
        {mult <= 0 ? (
          <RefuseCard onBack={back} />
        ) : introNeeded ? (
          <IntroGate
            name={bossName}
            onBack={back}
            onTalk={() => {
              // the conversation is drawn over the world (Prepare does the same)
              go('world');
              startConversation({
                scenarioId: job.intro!,
                characterId: job.boss,
              });
            }}
          />
        ) : (
          <JobCard
            jobName={title}
            helping={helping}
            rank={rank}
            good={js?.good ?? 0}
            mult={mult}
            waivedShifts={shiftAssistWaived(game, jobId) && (js?.shifts ?? 0) < BALANCE.shift.assistWaivedShifts}
            how={job.place === 'cafe' ? 'jobs.howItWorksCafe' : job.place === 'station' ? 'jobs.howItWorksStation' : 'jobs.howItWorks'}
            wage={job.wage}
            onStart={start}
            onBack={back}
          />
        )}
      </Shell>
    );
  }

  if (phase.t === 'result') {
    return (
      <Shell title={title} onBack={back} big={big} data-phase="result">
        <ResultCard
          data={phase.data}
          onSaveWords={saveWords}
          onAgain={() => {
            finished.current = false;
            setPhase({ t: 'card' });
          }}
          onBack={back}
        />
      </Shell>
    );
  }

  const p = phase.play;
  const waivedNow = p.waived0 || noVoice || p.cant;
  const preview = quitting ? quitPreview() : { served: 0, pay: 0 };
  return (
    <Shell
      title={title}
      onBack={headerBack}
      big={big}
      data-phase="play"
      action={
        <button type="button" className="btn soft sm" data-act="quit" onClick={() => setQuitting(true)}>
          {t('jobs.quit')}
        </button>
      }
    >
      <div className="sh-play" data-stage={p.stage} data-customer-n={p.i + 1}>
        <Steps states={stepStates()} />
        <CustomerBubble
          customer={customer!}
          n={p.i + 1}
          total={p.plan.customers.length}
          track={track!}
          waived={waivedNow}
          textByDefault={noVoice}
          cant={p.cant}
          ordering={p.stage === 'order'}
          desk={isDesk(customer!)}
          onListen={(slow) => sayMarkup(customer!.line.ja, slow)}
          onAssist={(kind) =>
            patch((q) => patchTrack(q, (tr) => (kind === 'text' ? { ...tr, assistText: true } : { ...tr, assistTrans: true })))
          }
          onCant={() => patch((q) => ({ ...q, cant: true }))}
          onGreet={() => {
            sayMarkup('いらっしゃいませ');
            patch((q) => patchTrack(q, (tr) => ({ ...tr, greeted: true })));
          }}
        />
        {p.stage === 'order' && isDesk(customer!) && (
          <DeskPad customer={customer!} pack={PACK} picked={p.pick} onPick={(pick) => patch((q) => ({ ...q, pick }))} onConfirm={confirmDesk} />
        )}
        {p.stage === 'order' && !isDesk(customer!) && (
          <OrderPad
            menu={menu}
            cart={p.cart}
            flags={p.flags}
            flagIds={flagIds}
            {...(isCafe ? { table: p.table, onTable: (n: number | null) => patch((q) => ({ ...q, table: n })) } : {})}
            onAdd={(id) =>
              patch((q) => ({
                ...q,
                cart: { ...q.cart, [id]: (q.cart[id] ?? 0) + 1 },
              }))
            }
            onRemove={(id) =>
              patch((q) => {
                const cart = { ...q.cart };
                if ((cart[id] ?? 0) <= 1) delete cart[id];
                else cart[id]! -= 1;
                return { ...q, cart };
              })
            }
            onFlag={(f: FlagId) =>
              patch((q) => ({
                ...q,
                // hot and iced are one choice
                flags: { ...q.flags, [f]: !q.flags[f], ...(f === 'hot' && !q.flags.hot ? { iced: false } : f === 'iced' && !q.flags.iced ? { hot: false } : {}) },
              }))
            }
            onConfirm={confirmOrder}
          />
        )}
        {(p.stage === 'total' || p.stage === 'change') && spec && (
          <>
            {!isDesk(customer!) && (
              <RegisterStrip
                total={firstTotal(customer!)}
                paid={p.stage === 'change' ? customer!.change?.paid : undefined}
                wantText={wantText()}
                split={isSplit(customer!) ? splitOf(customer!) : undefined}
              />
            )}
            <AnswerBox key={spec.id} spec={spec} onDone={p.stage === 'total' ? answerTotal : answerChange} />
          </>
        )}
        {p.stage === 'thanks' && spec && <AnswerBox key={spec.id} spec={spec} onDone={answerThanks} />}
        {p.stage === 'verdict' && p.verdict && (
          <Verdict
            label={t('jobs.wrong')}
            markup={p.verdict.markup}
            detail={p.verdict.detail ? (isDesk(customer!) ? p.verdict.detail : `${t('jobs.orderWas')}: ${p.verdict.detail}`) : p.verdict.gloss}
            onContinue={() => patch((q) => ({ ...q, stage: q.verdict!.next, verdict: null }))}
            cta={t('common.continue')}
          />
        )}
        {p.stage === 'done' && (
          <section className="sh-done" data-done>
            <p className="sh-ok">
              <Icon name="check" size={20} stroke={3} /> {t('jobs.customerDone')}
            </p>
            <button type="button" className="btn primary wide" data-act="next-customer" onClick={nextCustomer}>
              {p.i >= p.plan.customers.length - 1 ? t('jobs.finish') : t('jobs.nextCustomer')}
            </button>
          </section>
        )}
      </div>
      {quitting && <QuitSheet served={preview.served} pay={preview.pay} onKeep={() => setQuitting(false)} onLeave={quitNow} />}
    </Shell>
  );
}

/** What the register shows while the player says the total: the order that was rung up (and the note, for change). */
function RegisterStrip({ total, paid, wantText, split }: { total: number; paid?: number; wantText: string; split?: [number, number] }) {
  const { t } = useT();
  return (
    <div className="sh-register" data-register>
      <span className="sh-reg-items">{wantText}</span>
      {split && (
        <span className="sh-reg-paid" data-split={split.join(',')}>
          {t('jobs.splitNote')}
        </span>
      )}
      {paid !== undefined && (
        <span className="sh-reg-paid" data-paid={paid}>
          {t('jobs.registerPaid', { total: yenLtr(total), paid: yenLtr(paid) })}
        </span>
      )}
    </div>
  );
}

function Shell({
  title,
  onBack,
  children,
  big,
  action,
  ...rest
}: {
  title: string;
  onBack(): void;
  children: React.ReactNode;
  big?: boolean;
  action?: React.ReactNode;
  'data-phase'?: string;
}) {
  const { t, dir } = useT();
  return (
    <div className={`panel shift${big ? ' sh-big' : ''}`} dir={dir} data-screen="shift" data-phase={rest['data-phase']}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={onBack} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{title}</h1>
        {action ?? <span />}
      </header>
      <div className="panel-body">{children}</div>
    </div>
  );
}
