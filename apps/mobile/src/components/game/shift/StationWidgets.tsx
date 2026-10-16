// The station widgets of the Shift screen (Release 2 wave C1, docs/GAME_DESIGN.md §9.4): the departure board (a platform to tap), the mini map
// (an arrow: 右 / 左 / まっすぐ), the timetable (read it, pick the time) and the fare table (pick the fare). Each one is a pick-then-confirm
// step like the item grid, so a slip of the thumb can be put right. State lives in `screens/Shift.tsx`; the rules in `stationLogic.ts`.
// The map is a physical plan: left stays left in Arabic too (the container is `dir="ltr"`), the Japanese and the numbers keep their direction.
import { LEXICON, tokenize } from '@lw/content';
import type { GamePack, ShiftCustomer } from '@lw/game';
import { Icon } from '../../Icon';
import { JaText } from '../../JaText';
import { useStore } from '../../../store';
import { useT } from '../../../hooks';
import { placeLabel } from '../FareMap';
import { yen } from '../panelLogic';
import { Ja } from './ShiftParts';
import { DIRS, DIR_JA, boardFor, deskKindOf, fareRowsFor, fmtTime, mapSpotsFor, minutesOf, timetableFor, type Dir } from './stationLogic';

/** What the player has tapped: a key to mark it and the value the rules judge. */
export interface DeskPick {
  key: string;
  value: string | number;
}

export interface DeskPadProps {
  customer: ShiftCustomer;
  pack: GamePack;
  picked: DeskPick | null;
  onPick(p: DeskPick): void;
  onConfirm(): void;
}

/** The widget for this customer's question, with its prompt and the confirm button. */
export function DeskPad({ customer, pack, picked, onPick, onConfirm }: DeskPadProps) {
  const { t } = useT();
  const kind = deskKindOf(customer);
  if (!kind) return null;
  return (
    <section className="sh-order sh-desk" aria-label={t('jobs.stepLook')} data-order data-desk={kind}>
      <p className="sh-prompt">{t(`jobs.desk.${kind}` as 'jobs.desk.platform')}</p>
      {(kind === 'platform' || kind === 'announce') && <PlatformBoard customer={customer} picked={picked} onPick={onPick} />}
      {kind === 'direction' && <MiniMap customer={customer} picked={picked} onPick={onPick} />}
      {kind === 'time' && <Timetable customer={customer} picked={picked} onPick={onPick} />}
      {kind === 'fare' && <FareTable customer={customer} pack={pack} picked={picked} onPick={onPick} />}
      <button type="button" className="btn primary wide sh-confirm" data-act="confirm-order" disabled={!picked} onClick={onConfirm}>
        {picked ? t('jobs.desk.confirm') : t('jobs.desk.pickFirst')}
      </button>
    </section>
  );
}

interface WidgetProps {
  customer: ShiftCustomer;
  picked: DeskPick | null;
  onPick(p: DeskPick): void;
}

/** The departure board: four platforms, each with the destination written over it. */
function PlatformBoard({ customer, picked, onPick }: WidgetProps) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const rows = boardFor(customer);
  return (
    <ul className="sh-board" data-board role="listbox" aria-label={t('jobs.desk.boardLabel')}>
      {rows.map((r) => {
        const label = placeLabel(r.dest, lang);
        const on = picked?.key === `p${r.n}`;
        return (
          <li key={r.n}>
            <button
              type="button"
              role="option"
              aria-selected={on}
              className={`sh-plat${on ? ' on' : ''}`}
              data-platform={r.n}
              onClick={() => onPick({ key: `p${r.n}`, value: r.n })}
            >
              <span className="sh-plat-n" dir="ltr">
                <b>{r.n}</b>
                <small>
                  <Ja markup="番線" size="sm" />
                </small>
              </span>
              <span className="sh-plat-dest">
                <JaText tokens={label.tokens} furigana={furigana} romaji={false} size="md" />
                <small>{label.name}</small>
              </span>
              <Icon name="train" size={20} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The plan of the station: you at the bottom, a crossing, and a place at each end; the one the customer asks for is where the answer points. */
function MiniMap({ customer, picked, onPick }: WidgetProps) {
  const { t } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const spots = mapSpotsFor(customer);
  return (
    <div className="sh-mapbox" data-map>
      {/* a plan: left stays left whatever the language */}
      <div className="sh-map" dir="ltr" role="img" aria-label={t('jobs.desk.mapLabel')}>
        <span className="sh-corr v" aria-hidden="true" />
        <span className="sh-corr h" aria-hidden="true" />
        <span className="sh-you">
          <Icon name="pin" size={18} /> {t('jobs.desk.you')}
        </span>
        {/* the three spots look alike: which one was asked is the listening (or reading) part */}
        {spots.map((s) => (
          <span key={s.dir} className={`sh-dest at-${s.dir}`} data-target={s.dir} data-asked={s.asked ? 'true' : undefined}>
            <JaText tokens={tokenize(s.ja, LEXICON).tokens} furigana={furigana} romaji={false} size="sm" />
          </span>
        ))}
      </div>
      <p className="sh-note" dir="auto" data-target-name>
        {t('jobs.desk.mapNote')}
      </p>
      <div className="sh-arrows" dir="ltr" role="radiogroup" aria-label={t('jobs.desk.arrows')}>
        {DIRS.map((d: Dir) => {
          const on = picked?.key === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={on}
              className={`sh-arrow${on ? ' on' : ''}`}
              data-dir={d}
              onClick={() => onPick({ key: d, value: d })}
            >
              <span className={`sh-arrow-ic ${d}`} aria-hidden="true">
                <Icon name="chevR" size={24} stroke={3} />
              </span>
              <Ja markup={DIR_JA[d]} size="md" />
              <small>{t(`jobs.dir.${d}` as 'jobs.dir.left')}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The timetable with the clock: the first train that has not left yet is the answer. */
function Timetable({ customer, picked, onPick }: WidgetProps) {
  const { t } = useT();
  const m = customer.task.kind === 'time' ? minutesOf(customer.task.answer) : null;
  if (m === null) return null;
  const tt = timetableFor(m);
  return (
    <div className="sh-timetable" data-timetable>
      <p className="sh-clock" dir="ltr" data-clock>
        <Ja markup="今" size="sm" /> <b>{fmtTime(tt.now)}</b>
        <small>{t('jobs.desk.now')}</small>
      </p>
      <ul className="sh-times" role="listbox" aria-label={t('jobs.desk.timeLabel')}>
        {tt.rows.map((r) => {
          const left = r < tt.now;
          const on = picked?.key === `t${r}`;
          return (
            <li key={r}>
              <button
                type="button"
                role="option"
                aria-selected={on}
                className={`sh-time${on ? ' on' : ''}${left ? ' left' : ''}`}
                data-time={fmtTime(r)}
                onClick={() => onPick({ key: `t${r}`, value: r })}
              >
                <b dir="ltr">{fmtTime(r)}</b>
                <small>{left ? t('jobs.desk.left') : t('jobs.desk.leaves')}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The fare table: a few destinations, each with the IC fare and the paper-ticket fare to tap. */
function FareTable({ customer, pack, picked, onPick }: WidgetProps & { pack: GamePack }) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const rows = fareRowsFor(pack, customer);
  return (
    <ul className="sh-fares" data-fares>
      {rows.map((r) => {
        const label = placeLabel(r.place, lang);
        return (
          <li key={r.place} className="sh-fare-row">
            <span className="sh-fare-dest">
              <JaText tokens={label.tokens} furigana={furigana} romaji={false} size="md" />
            </span>
            {(['ic', 'paper'] as const).map((kind) => {
              const key = `${r.place}:${kind}`;
              const on = picked?.key === key;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={on}
                  className={`sh-fare${on ? ' on' : ''}`}
                  data-fare={key}
                  onClick={() => onPick({ key, value: r[kind] })}
                >
                  <small>{kind === 'ic' ? 'IC' : t('jobs.desk.paper')}</small>
                  <b dir="ltr">{yen(r[kind])}</b>
                </button>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
