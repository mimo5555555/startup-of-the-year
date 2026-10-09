// The cards around the shift (agent 4D): the job card before it starts, the boss's refusal on the third shift of a day, the leave sheet and
// the result card with the wage, the rank and the words to keep.
import { useEffect } from 'react';
import type { Token } from '@lw/content';
import { BALANCE, type ShiftScore } from '@lw/game';
import { Icon } from '../../Icon';
import { JaText } from '../../JaText';
import { useStore } from '../../../store';
import { useT } from '../../../hooks';
import { useUi } from '../../../ui';
import { Ja, JaTappable } from './ShiftParts';
import { yenLtr } from './shiftLogic';
import { BAND_LINES, RANK_JA, RANK_UP, REFUSE, RETRY } from './shiftLines';

/** A boss line: Japanese (tappable words) with the translation under it. */
export function BossLine({ line }: { line: { ja: string; en: string; ar: string } }) {
  const { lang } = useT();
  return (
    <div className="sh-boss">
      <JaTappable markup={line.ja} size="lg" />
      <p className="sh-gloss-line" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {line[lang]}
      </p>
    </div>
  );
}

export const rankLabel = (t: ReturnType<typeof useT>['t'], rank: number) => t(`jobs.rank${Math.max(0, Math.min(4, rank))}` as 'jobs.rank0');

/** The rank as Japanese with its reading, and the UI-language name. */
export function RankName({ rank }: { rank: number }) {
  const { t } = useT();
  const r = RANK_JA[Math.max(0, Math.min(4, rank))]!;
  return (
    <span className="sh-rank">
      <Ja markup={r.ja} size="sm" /> <small>{rankLabel(t, rank)}</small>
    </span>
  );
}

export interface JobCardProps {
  jobName: string;
  helping: boolean;
  rank: number;
  good: number;
  /** the pay multiplier of this shift today (1, 0.6 or 0.5) */
  mult: number;
  waivedShifts: boolean;
  wage: number;
  onStart(): void;
  onBack(): void;
}

/** Before the shift: the rank, how it works, the day's multiplier and the Start button. */
export function JobCard({ jobName, helping, rank, good, mult, waivedShifts, wage, onStart, onBack }: JobCardProps) {
  const { t } = useT();
  const marks = BALANCE.shift.promoteAt;
  const next = marks[rank];
  return (
    <div className="sh-card" data-shift-card="job">
      <div className="sh-card-head">
        <span className="sh-job-icon" aria-hidden="true">
          <Icon name="briefcase" size={26} />
        </span>
        <div>
          <h2>{jobName}</h2>
          {helping && (
            <span className="pill" data-helping>
              <Ja markup="お手伝い" size="sm" /> {t('jobs.helping')}
            </span>
          )}
        </div>
      </div>
      <dl className="sh-facts">
        <div>
          <dt>{t('jobs.rankLabel')}</dt>
          <dd>
            <RankName rank={rank} />
          </dd>
        </div>
      </dl>
      <p className="sh-note" data-good={good}>
        {t('jobs.goodShifts', { n: good })}
      </p>
      <p className="sh-note">
        {next !== undefined
          ? t('jobs.nextRank', {
              n: Math.max(1, next - good),
              rank: rankLabel(t, rank + 1),
            })
          : t('jobs.topRank')}
      </p>
      <p>{t('jobs.howItWorks')}</p>
      {waivedShifts && <p className="sh-note">{t('jobs.firstFree')}</p>}
      {mult < 1 && (
        <p className="sh-note" data-mult={mult}>
          {t('jobs.repeatNote', { m: mult })}
        </p>
      )}
      <p className="sh-note" dir="ltr" data-wage={wage}>
        ¥{wage.toLocaleString('en-US')}/h
      </p>
      <button type="button" className="btn primary wide" data-act="start-shift" onClick={onStart}>
        {t('jobs.start')}
      </button>
      <button type="button" className="btn soft wide" onClick={onBack}>
        {t('jobs.backToStreet')}
      </button>
    </div>
  );
}

/** The boss wants a word before the first shift: starts the intro conversation. */
export function IntroGate({ onTalk, onBack }: { onTalk(): void; onBack(): void }) {
  const { t } = useT();
  return (
    <div className="sh-card" data-shift-card="intro">
      <h2>{t('jobs.introTitle')}</h2>
      <p>{t('jobs.introBody')}</p>
      <button type="button" className="btn primary wide" data-act="talk-boss" onClick={onTalk}>
        <Icon name="message" size={20} /> {t('jobs.introGo')}
      </button>
      <button type="button" className="btn soft wide" onClick={onBack}>
        {t('jobs.backToStreet')}
      </button>
    </div>
  );
}

/** The third shift of a day is not available: the boss says so politely. */
export function RefuseCard({ onBack }: { onBack(): void }) {
  const { t } = useT();
  return (
    <div className="sh-card" data-shift-card="refuse">
      <BossLine line={REFUSE} />
      <p className="sh-note">{t('jobs.rest')}</p>
      <button type="button" className="btn primary wide" data-act="back" onClick={onBack}>
        {t('jobs.backToStreet')}
      </button>
    </div>
  );
}

/** Leave the shift: says what is paid before the player decides. */
export function QuitSheet({ served, pay, onKeep, onLeave }: { served: number; pay: number; onKeep(): void; onLeave(): void }) {
  const { t, dir } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onKeep();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKeep]);
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={t('jobs.quitTitle')} data-sheet="quit" onClick={onKeep}>
      <div className="word-sheet sh-quit" dir={dir} onClick={(e) => e.stopPropagation()}>
        <h2>{t('jobs.quitTitle')}</h2>
        <p>
          {pay > 0
            ? t('jobs.quitPaid', {
                n: served,
                pay: yenLtr(pay),
              })
            : t('jobs.quitNone')}
        </p>
        <button type="button" className="btn primary wide" data-act="keep-working" onClick={onKeep}>
          {t('jobs.keepWorking')}
        </button>
        <button type="button" className="btn soft wide" data-act="leave-shift" onClick={onLeave}>
          {t('jobs.leave')}
        </button>
      </div>
    </div>
  );
}

export interface ResultData {
  score: ShiftScore;
  pay: number;
  rankBefore: number;
  rankAfter: number;
  quit: boolean;
  assisted: number;
  bonusItem: boolean;
  words: Token[];
  savedWords: boolean;
  canAgain: boolean;
  againMult: number;
}

/** After the shift: the boss's verdict, accuracy, wage, rank and the words worth keeping. */
export function ResultCard({
  data,
  onSaveWords,
  onAgain,
  onBack,
}: {
  data: ResultData;
  onSaveWords(): void;
  onAgain(): void;
  onBack(): void;
}) {
  const { t } = useT();
  const { score } = data;
  const rankUp = data.rankAfter > data.rankBefore;
  const band = BAND_LINES[score.band];
  const counted = score.good && !data.quit;
  return (
    <div className="sh-card sh-result" data-shift-card="result" data-band={score.band} data-pay={data.pay}>
      <h2>{data.quit ? t('jobs.resultQuit') : t('jobs.resultTitle')}</h2>
      {!data.quit && <BossLine line={band} />}
      <p className="sh-wage" data-wage-line>
        {data.pay > 0 ? t('jobs.pay', { n: yenLtr(data.pay) }) : t('jobs.noPay')}
      </p>
      <dl className="sh-facts">
        <div>
          <dt>{t('jobs.accuracy')}</dt>
          <dd dir="ltr" data-accuracy>
            {Math.round(score.ticks * 100)}%
          </dd>
        </div>
        <div>
          <dt>{t('jobs.served')}</dt>
          <dd dir="ltr">
            {score.served}/{BALANCE.shift.customers}
          </dd>
        </div>
        {data.assisted > 0 && (
          <div>
            <dt>{t('jobs.assisted')}</dt>
            <dd dir="ltr">{data.assisted}</dd>
          </div>
        )}
      </dl>
      {data.quit && <p className="sh-note">{t('jobs.quitNoCount')}</p>}
      {!data.quit && score.trial && <p className="sh-note">{t('jobs.trial')}</p>}
      {!data.quit && !score.good && !score.trial && <BossLine line={RETRY} />}
      {counted && <p className="sh-note">{t('jobs.counted')}</p>}
      {rankUp && RANK_UP[data.rankAfter] && (
        <div className="sh-rankup" data-rankup={data.rankAfter}>
          <strong>{t('jobs.rankUp', { rank: rankLabel(t, data.rankAfter) })}</strong>
          <BossLine line={RANK_UP[data.rankAfter]!} />
        </div>
      )}
      {data.bonusItem && (
        <p className="sh-bonus" data-bonus>
          {t('jobs.bonusItem')}
        </p>
      )}
      {data.words.length > 0 && (
        <div className="sh-words" data-words>
          <h3>{t('jobs.saveWords')}</h3>
          <div className="sh-word-row">
            {data.words.map((w) => (
              <button
                key={w.s}
                type="button"
                className="chip"
                onClick={() => useUi.getState().openWord({ token: w, source: 'conversation' })}
              >
                <WordChip token={w} />
              </button>
            ))}
          </div>
          <button type="button" className="btn soft wide" data-act="save-words" disabled={data.savedWords} onClick={onSaveWords}>
            {data.savedWords ? t('jobs.saved') : t('jobs.saveAll')}
          </button>
        </div>
      )}
      {data.canAgain && (
        <button type="button" className="btn soft wide" data-act="again" onClick={onAgain}>
          {data.againMult < 1 ? t('jobs.anotherMult', { m: data.againMult }) : t('jobs.another')}
        </button>
      )}
      <button type="button" className="btn primary wide" data-act="back" onClick={onBack}>
        {t('jobs.backToStreet')}
      </button>
    </div>
  );
}

function WordChip({ token }: { token: Token }) {
  const settings = useStore((s) => s.settings);
  const { lang } = useT();
  return (
    <span className="sh-word">
      <JaText tokens={[token]} furigana={settings.furigana} romaji={false} size="sm" />
      <small>{token.gloss?.[lang]}</small>
    </span>
  );
}
