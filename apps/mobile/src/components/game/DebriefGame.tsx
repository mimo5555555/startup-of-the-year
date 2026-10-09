// The game's additive blocks of the Feedback screen (docs/GAME_DESIGN.md §11.3, §2.5): stars, the pay lines (one line in the compact
// form of the first three conversations, the ledger rows after), the friends strip, Keep these with the hidden-line Say it,
// culture cards, objective ticks and the next-goal button. The rows come from the derived events of the settlement, so they equal
// the ledger. Conversation.finish() files a `DebriefData`; Feedback composes the blocks around its existing skeleton.
import { Fragment, useEffect, useState } from 'react';
import { create } from 'zustand';
import { LEXICON, SCENARIOS, tokenize, type Token } from '@lw/content';
import {
  BALANCE,
  estimatePay,
  hearts as heartsFor,
  yenFormat,
  type ConversationFacts,
  type DerivedEvent,
  type LoopSettlement,
  type NextGoal,
  type PayLine,
} from '@lw/game';
import { useT } from '../../hooks';
import { characterById, displayName } from '../../content';
import { dispatch, openScreen } from '../../game/bridge';
import { PACK } from '../../game/pack';
import { getGame, useGame } from '../../game/gameStore';
import { useDisclosure, useTracker } from '../../game/hooks';
import type { ConvoPurchase } from '../../game/convoHooks';
import { speakJa } from '../../services';
import { useStore, type ReportData } from '../../store';
import { useUi } from '../../ui';
import { EchoButton } from './EchoButton';
import { ReceiptSheet } from './ReceiptSheet';
import { StarsRow } from './StarsRow';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Portrait } from '../Portrait';

/** A line the debrief offers to keep (an assisted line or a corrected one) with its hidden-line Say it. */
export interface KeepLine {
  /** echo ledger / SRS key: the pocket line id when it is one, else `d:<text>` */
  id: string;
  written: string;
  tokens: Token[];
  plain: string;
  /** the line as markup (what the SRS phrase card is made from) */
  ja: string;
  meaning: { en: string; ar: string };
  /** an assisted line the app wrote (can be saved as a card); false for a corrected line of the learner's own */
  assisted: boolean;
}

/** What Conversation.finish() files for the Feedback screen. */
export interface DebriefData {
  /** the report this belongs to (identity: a stale one is ignored) */
  forReport: ReportData;
  facts: ConversationFacts;
  /** derived events of the purchases and of the settlement, in order */
  derived: DerivedEvent[];
  purchases: ConvoPurchase[];
  keep: KeepLine[];
}

export const useDebrief = create<{ data: DebriefData | null }>(() => ({ data: null }));
export const setDebrief = (data: DebriefData | null) => useDebrief.setState({ data });

/** The filed debrief when it belongs to this report. */
export function useDebriefFor(report: ReportData | null): DebriefData | null {
  const data = useDebrief((s) => s.data);
  return data && report && data.forReport === report ? data : null;
}

export const yen = (n: number) => yenFormat(n, PACK.currency);

/** A sentence with its amounts and percentages kept left-to-right Latin digits inside Arabic text (the sign stays with the number). */
export function Num({ text }: { text: string }) {
  return (
    <>
      {text.split(/([+−-]?¥?\d(?:[\d,.]*\d)?%?)/g).map((part, i) =>
        i % 2 ? (
          <bdi key={i} dir="ltr">
            {part}
          </bdi>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
const signed = (n: number) => `${n < 0 ? '−' : '+'}${yen(Math.abs(n))}`;

const settlementOf = (d: DebriefData): LoopSettlement | null => {
  const e = d.derived.find((x) => x.t === 'loop_settled');
  return e && e.t === 'loop_settled' ? e.settlement : null;
};

function payLabel(t: ReturnType<typeof useT>['t'], l: PayLine): string {
  switch (l.reason) {
    case 'lines':
      return t('debrief.pay.lines');
    case 'steps':
      return l.yen < 0 ? t('debrief.pay.stepsLess') : t('debrief.pay.steps');
    case 'prepared':
      return t('debrief.pay.prepared', { pct: Math.round((BALANCE.prepF - 1) * 100) });
    case 'real':
      return t('debrief.pay.real', { pct: Math.round((BALANCE.realF - 1) * 100) });
    case 'firstPhrase':
      return t('debrief.pay.firstPhrase');
    case 'star':
      return t('debrief.pay.star', { n: l.vars?.stars ?? '' });
    case 'repeat':
      return t('debrief.pay.repeat');
    case 'softCap':
      return t('debrief.pay.softCap');
    case 'echo':
      return t('debrief.echoPaid', { n: l.yen });
    case 'practiceOnly':
      return t('debrief.pay.practiceOnly');
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stars and pay (blocks 2 and 3)
// ---------------------------------------------------------------------------------------------------------------

/** Blocks 2 and 3: the stars with what each needed, then the pay (compact: one line; full: every row with its plain reason). */
export function DebriefPay({ data }: { data: DebriefData }) {
  const { t } = useT();
  const disclosure = useDisclosure();
  const wallet = useGame((s) => s.wallet.cash);
  const [receipt, setReceipt] = useState<ConvoPurchase | null>(null);
  const s = settlementOf(data);
  if (!s) return null;
  const compact = disclosure.compactDebrief;
  const rows = s.lines;
  const good = rows.filter((l) => l.yen > 0);
  const notes = rows.filter((l) => l.yen < 0 && (l.reason === 'repeat' || l.reason === 'softCap'));
  const practice = rows.find((l) => l.reason === 'practiceOnly');
  const reasons = practice ? [practice] : s.total > 0 ? [...good, ...notes] : notes.length ? notes : [{ reason: 'practiceOnly' as const, yen: 0 }];

  // the honest nudge: the same formula at r = 1, today's repeat factor and cap applied
  const next = (r: number) => estimatePay(PACK, getGame(), data.facts.scenarioId, r, data.facts.mode === 'real', { prepared: data.facts.prepared });
  const gain = s.stats.assisted > 0 ? next(1) - next(s.stats.r) : 0;

  return (
    <>
      <section className="card dbf-card">
        <h2 className="h2">{t('debrief.stars')}</h2>
        <StarsRow stars={s.stars} fresh={s.newStars.length} />
        {s.stars === 0 && <p className="muted small">{t('debrief.starsNone')}</p>}
      </section>

      <section className="card dbf-card" aria-label={t('debrief.yenTitle')}>
        <h2 className="h2">{t('debrief.yenTitle')}</h2>
        {compact ? (
          <p className="dbf-payline">
            <strong dir="ltr" className={s.total > 0 ? 'dbf-gain' : ''}>
              {s.total > 0 ? signed(s.total) : yen(0)}
            </strong>
            <span dir="auto">
              <Num text={[...new Set(reasons.map((l) => payLabel(t, l)))].join(' · ')} />
            </span>
          </p>
        ) : (
          <ul className="dbf-rows">
            {rows.map((l, i) => (
              <li key={i}>
                <span dir="auto">
                  <Num text={payLabel(t, l)} />
                </span>
                {l.reason !== 'practiceOnly' && (
                  <b dir="ltr" className={l.yen < 0 ? 'dbf-neg' : 'dbf-gain'}>
                    {signed(l.yen)}
                  </b>
                )}
              </li>
            ))}
            <li className="dbf-total">
              <span>{t('debrief.total')}</span>
              <b dir="ltr" className="dbf-gain">
                {signed(s.total)}
              </b>
            </li>
          </ul>
        )}
        {data.purchases.map((p) => (
          <div key={p.n} className="dbf-spent">
            <span dir="auto">
              <Num text={t('debrief.spent', { n: p.receipt.total.toLocaleString('en-US') })} />
            </span>
            <button className="btn soft sm" onClick={() => setReceipt(p)}>
              <Icon name="receipt" size={16} /> {t('debrief.receipt')}
            </button>
          </div>
        ))}
        <small className="muted" dir="auto">
          <Num text={t('debrief.wallet', { n: wallet.toLocaleString('en-US') })} />
        </small>
        {!compact && gain >= BALANCE.payRound && (
          <p className="dbf-nudge" dir="auto">
            <Icon name="bulb" size={16} /> <Num text={t('debrief.nudge', { n: gain.toLocaleString('en-US') })} />
          </p>
        )}
      </section>
      {receipt && <ReceiptSheet receipt={receipt.receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Friends strip (block 4)
// ---------------------------------------------------------------------------------------------------------------

/** Hearts gained with a friend in this conversation; only once the Friends entry has opened (§2.5). */
export function FriendsStrip({ data }: { data: DebriefData }) {
  const { t, lang } = useT();
  const disclosure = useDisclosure();
  const game = useGame();
  if (!disclosure.friendsStrip) return null;
  const ids = [...new Set(data.derived.flatMap((e) => (e.t === 'ap_gained' || e.t === 'hearts_changed' || e.t === 'gift_reacted' ? [e.friendId] : [])))];
  if (!ids.length) return null;
  return (
    <section className="card dbf-card">
      <h2 className="h2">{t('debrief.friends')}</h2>
      {ids.map((id) => {
        const c = characterById(id);
        if (!c) return null;
        // a gift's affinity is reported by its own event (4A): it counts here with the talk's
        const ap = data.derived.reduce((n, e) => ((e.t === 'ap_gained' || e.t === 'gift_reacted') && e.friendId === id ? n + e.ap : n), 0);
        const gift = data.derived.find((e) => e.t === 'gift_reacted' && e.friendId === id);
        const up = data.derived.find((e) => e.t === 'hearts_changed' && e.friendId === id && e.to > e.from);
        const now = heartsFor(game, id);
        return (
          <div key={id} className="dbf-friend">
            <Portrait spec={c.avatar} size={40} />
            <div>
              <strong dir="auto">{displayName(c, lang)}</strong>
              <span className="dbf-hearts" aria-label={`${now}/5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Icon key={i} name={i < now ? 'heartFilled' : 'heart'} size={18} />
                ))}
              </span>
              {gift && gift.t === 'gift_reacted' && (
                <small data-gift-reaction={gift.reaction} dir="auto">
                  {t(`social.react.${gift.reaction}` as const, { name: displayName(c, lang) })}
                </small>
              )}
              {up ? (
                <small className="dbf-gain" dir="auto">
                  {t('social.heartUp', { name: displayName(c, lang) })}
                </small>
              ) : (
                ap > 0 && (
                  <small className="muted" dir="auto">
                    <Num text={t('debrief.apGain', { n: ap })} />
                  </small>
                )
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Keep these (block 5)
// ---------------------------------------------------------------------------------------------------------------

/** Lines worth keeping, each with the hidden-line Say it. `onSave` / `saved` are the existing Save buttons of the Feedback screen. */
export function KeepThese({
  data,
  saved,
  onSave,
  onSaveAll,
}: {
  data: DebriefData;
  saved: Set<string>;
  onSave: (l: KeepLine) => void;
  onSaveAll: () => void;
}) {
  const { t, lang } = useT();
  const openWord = useUi((s) => s.openWord);
  const settings = useStore((s) => s.settings);
  const [paid, setPaid] = useState<Record<string, number>>({});
  if (!data.keep.length) return null;
  const onEcho = (l: KeepLine) => (r: { similarity: number; peeked: boolean }) => {
    const res = dispatch({ t: 'echo', sessionId: data.facts.sessionId, lineId: l.id, similarity: r.similarity, peeked: r.peeked, line: { ja: l.ja, en: l.meaning.en, ar: l.meaning.ar } });
    const got = res.derived.reduce((n, e) => (e.t === 'wallet_changed' && e.kind === 'echo' ? n + e.delta : n), 0);
    setPaid((p) => ({ ...p, [l.id]: got }));
  };
  return (
    <section className="card dbf-card">
      <div className="row-between">
        <h2 className="h2">{t('debrief.keep')}</h2>
        {data.keep.some((l) => l.assisted) && (
          <button className="btn soft sm" onClick={onSaveAll}>
            <Icon name="bookmark" size={16} /> {t('f.saveAll')}
          </button>
        )}
      </div>
      <p className="muted small" dir="auto">
        {t('debrief.keepSub')}
      </p>
      {data.keep.map((l) => (
        <div key={l.id} className="dbf-keep">
          <div className="dbf-keep-line">
            <div>
              <JaText tokens={l.tokens} furigana={settings.furigana} romaji={settings.romaji} size="md" onTap={(tk) => openWord({ token: tk, source: 'conversation' })} />
              <small dir="auto">{l.meaning[lang]}</small>
            </div>
            <button className="icon-btn ghost" onClick={() => speakJa(l.plain, { rate: 0.9 })} aria-label={t('common.listen')}>
              <Icon name="volume" size={18} />
            </button>
            {l.assisted && (
              <button className={`icon-btn ${saved.has(l.written) ? 'on' : 'ghost'}`} onClick={() => !saved.has(l.written) && onSave(l)} aria-label={t('common.save')}>
                <Icon name={saved.has(l.written) ? 'check' : 'bookmark'} size={18} />
              </button>
            )}
          </div>
          <EchoButton lineId={l.id} ja={l.ja} meaning={l.meaning} onDone={onEcho(l)} />
          {paid[l.id] > 0 && (
            <small className="dbf-gain" dir="auto">
              <Num text={t('debrief.echoPaid', { n: paid[l.id] })} />
            </small>
          )}
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Culture cards, objective ticks and the next goal (blocks 6 and 7)
// ---------------------------------------------------------------------------------------------------------------

const objectiveText = (id: string) => PACK.chapters.flatMap((c) => c.objectives).find((o) => o.id === id)?.text;
const dreamStepText = (dream: string, step: string) => PACK.dreams.find((d) => d.id === dream)?.steps.find((s) => s.id === step)?.text;

/** Block 6: culture cards unlocked by this conversation (shown after the debrief's own content, never mid-conversation), objective ticks. */
export function DebriefProgress({ data }: { data: DebriefData }) {
  const { t, lang } = useT();
  const settings = useStore((s) => s.settings);
  const disclosure = useDisclosure();
  const closeCulture = useUi((s) => s.closeCulture);
  const go = useStore((s) => s.go);
  // the debrief shows the card itself: the stamp book no longer needs to open on it
  useEffect(() => {
    closeCulture();
  }, [closeCulture]);

  const cards = [...new Set(data.derived.flatMap((e) => (e.t === 'culture_unlocked' ? [e.id] : [])))].flatMap((id) => PACK.culture.find((c) => c.id === id) ?? []);
  const ticks: Array<{ key: string; text: string }> = [];
  if (!disclosure.compactDebrief) {
    for (const e of data.derived) {
      if (e.t === 'objective_done') {
        const text = objectiveText(e.id);
        if (text) ticks.push({ key: `o:${e.id}`, text: `${t('debrief.objective')}: ${text[lang]}` });
      } else if (e.t === 'chapter_done') {
        ticks.push({ key: `c:${e.n}`, text: `${t('quests.chapterDone')} (${t('quests.chapter', { n: e.n })})` });
      } else if (e.t === 'dream_step_done') {
        const text = dreamStepText(e.dream, e.step);
        if (text) ticks.push({ key: `d:${e.dream}:${e.step}`, text: `${t('debrief.dreamStep')}: ${text[lang]}` });
      }
    }
  }
  return (
    <>
      {ticks.length > 0 && (
        <section className="card dbf-card">
          <ul className="dbf-ticks">
            {ticks.map((x) => (
              <li key={x.key} dir="auto">
                <Icon name="check" size={18} stroke={3} /> {x.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {cards.map((c) => {
        const tokens = tokenize(c.phrase.ja, LEXICON).tokens;
        return (
          <section key={c.id} className="card dbf-card dbf-culture">
            <small className="tag assisted">
              <Icon name="sparkle" size={12} /> {t('culture.new')}
            </small>
            <JaText tokens={tokens} furigana={settings.furigana} romaji={settings.romaji} size="lg" />
            <p dir="auto">{c.phrase[lang]}</p>
            <p className="muted small" dir="auto">
              {c.text[lang]}
            </p>
            <button className="btn soft sm" onClick={() => go('culture')}>
              <Icon name="book" size={16} /> {t('debrief.cultureOpen')}
            </button>
          </section>
        );
      })}
    </>
  );
}

/** What the next-goal button opens: the lesson, the Prepare screen of a scenario, or the city where the tracker points the way. */
function goTo(goal: NextGoal): void {
  const st = useStore.getState();
  if (goal.kind === 'lesson') {
    useStore.setState({ lessonId: goal.id });
    st.go('lesson');
    return;
  }
  const sc = goal.kind === 'practice' ? SCENARIOS.find((x) => x.id === goal.id) : undefined;
  if (sc) openScreen('prepare', { scenarioId: sc.id, characterId: sc.characterId });
  else st.go('world');
}

/** Block 7: the next best goal as the main button (§11.7); the existing Practise again and Back stay in the footer. */
export function NextGoalButton() {
  const { t, lang, dir } = useT();
  const goal = useTracker();
  if (!goal || goal.kind === 'wait') return goal ? <p className="muted small center" dir="auto">{goal.text[lang]}</p> : null;
  return (
    <section className="dbf-next">
      <small className="muted">{t('hud.nextUp')}</small>
      <button className="btn primary wide" onClick={() => goTo(goal)} dir="auto">
        <span>{goal.text[lang] || t('debrief.goOn')}</span> <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
      </button>
    </section>
  );
}
