// The Phrase Pocket summary for the interaction sheet in the world and for the debrief (docs/GAME_DESIGN.md §11.1): the scenario's
// lines with a status each (new, studied, ready), whether the +10% is on, and a button into the Prepare screen.
import { Fragment } from 'react';
import { scenarioById } from '@lw/content';
import { Icon } from '../Icon';
import { useT } from '../../hooks';
import { openScreen } from '../../game/bridge';
import { PACK } from '../../game/pack';
import { useGameState, useGameView } from '../../game/hooks';
import { pocketView, type LineStatus } from '../../game/prepareLogic';
import { meaningOf } from '../../content';

export interface PocketCardProps {
  scenarioId: string;
}

/** Text with its numbers kept left-to-right Latin digits inside Arabic (the same job as the debrief's `Num`, without importing the debrief). */
export function LtrNum({ text }: { text: string }) {
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

const STATUS_KEY = { new: 'prep.status.new', seen: 'prep.status.seen', ready: 'prep.status.ready' } as const;

/** A status is a word and a shape, never a colour alone. */
export function StatusMark({ status }: { status: LineStatus }) {
  const { t } = useT();
  return (
    <span className={`prep-status ${status}`}>
      {status === 'ready' ? <Icon name="check" size={14} stroke={3} /> : <i aria-hidden="true" />}
      {t(STATUS_KEY[status])}
    </span>
  );
}

export function PocketCard({ scenarioId }: PocketCardProps) {
  const { t, lang } = useT();
  const state = useGameState();
  const view = useGameView();
  const pocket = pocketView(PACK, state, view, scenarioId);
  const sc = scenarioById(scenarioId);
  if (!pocket || !sc) return null;
  const left = pocket.daysLeft;
  return (
    <section className="card prep-pocket" data-scenario={scenarioId} data-ready={pocket.ready ? 1 : 0}>
      <div className="row-between">
        <h2 className="h2">{t('prep.pocket.title')}</h2>
        {pocket.ready && (
          <span className="pill prep-ready-pill">
            <Icon name="check" size={14} stroke={3} /> {t('prep.ready')}
          </span>
        )}
      </div>
      <ul className="prep-pocket-lines">
        {pocket.lines.map((l) => (
          <li key={l.id}>
            <span className="prep-pocket-ja" lang="ja" dir="ltr">
              {l.line.line.ja.replaceAll('|', '')}
            </span>
            <small dir="auto">{meaningOf(l.line.line, lang)}</small>
            <StatusMark status={l.status} />
          </li>
        ))}
      </ul>
      {pocket.ready && Number.isFinite(left) && (
        <small className="muted" dir="auto">
          <LtrNum text={t('prep.ready.days', { n: left })} />
        </small>
      )}
      <button type="button" className="btn soft prep-btn" onClick={() => openScreen('prepare', { scenarioId, characterId: sc.characterId })}>
        <Icon name="book" size={18} /> {pocket.ready ? t('prep.review') : t('prep.pocket.open')}
      </button>
    </section>
  );
}
