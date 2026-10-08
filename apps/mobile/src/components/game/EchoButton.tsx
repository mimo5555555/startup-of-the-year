// The hidden-line Say it of a debrief line (docs/GAME_DESIGN.md D7, §11.3): the meaning is shown, the Japanese hidden; the learner
// says or types it and the debrief pays the ¥20 echo bonus through the `echo` event. Peek keeps the SRS card but forfeits the yen.
// The reducer decides the pay (caps, once per line); this component only reports the outcome.
import { useState } from 'react';
import { echoPassMark } from '@lw/game';
import { Icon } from '../Icon';
import { SayIt } from './SayIt';
import { useT } from '../../hooks';
import { PACK } from '../../game/pack';
import { useGameView } from '../../game/hooks';

export interface EchoButtonProps {
  /** the line's id: a pocket line id, or the debrief line's id (`echo:<sessionId>:<lineId>` in the ledger) */
  lineId: string;
  /** the Japanese markup of the line (hidden until Peek) */
  ja: string;
  /** the meaning shown instead, EN and AR */
  meaning: { en: string; ar: string };
  onDone: (r: { similarity: number; peeked: boolean }) => void;
}

type Phase = 'idle' | 'open' | 'said' | 'peeked';

export function EchoButton({ lineId, ja, meaning, onDone }: EchoButtonProps) {
  const { t } = useT();
  const view = useGameView();
  const [phase, setPhase] = useState<Phase>('idle');
  // one outcome per line: after a pass or a Peek the buttons stay as they are (the ledger would ignore a second try anyway)
  if (phase === 'idle') {
    return (
      <button type="button" className="btn soft prep-btn prep-echo-open" data-line={lineId} onClick={() => setPhase('open')}>
        <Icon name="mic" size={18} /> {t('debrief.sayIt')}
      </button>
    );
  }
  return (
    <div className="prep-echo" data-line={lineId} data-phase={phase}>
      <SayIt
        ja={ja}
        meaning={meaning}
        mark={echoPassMark(PACK, view)}
        peekLabel={t('prep.peek.echo')}
        onPass={(similarity) => {
          setPhase('said');
          onDone({ similarity, peeked: false });
        }}
        onPeek={() => {
          setPhase('peeked');
          onDone({ similarity: 0, peeked: true });
        }}
      />
    </div>
  );
}
