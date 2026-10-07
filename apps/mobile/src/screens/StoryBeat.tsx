import { useEffect } from 'react';
import { JaText } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { StubPanel } from '../components/game/StubPanel';
import { characterById, displayName, lineTokens } from '../content';
import { completeBeat } from '../game/bridge';
import { beatById } from '../game/pack';
import { useT } from '../hooks';
import { useStore } from '../store';
import { useUi } from '../ui';

// Placeholder route (2A): agent 2F replaces the body (the katakana name step, the dream picker for `ask`); the route, the queue
// (`useUi.beats`) and `completeBeat(id)` stay. This version plays the lines and files the beat, so the queue never gets stuck.
export function StoryBeat() {
  const { t, lang } = useT();
  const go = useStore((s) => s.go);
  const furigana = useStore((s) => s.settings.furigana);
  const id = useUi((s) => s.beats[0]);
  const beat = id ? beatById(id) : undefined;

  // nothing (left) to show: back to the world
  useEffect(() => {
    if (!id) go('world');
  }, [id, go]);

  if (!id) return null;
  return (
    <StubPanel title={t('common.continue')}>
      <div className="stack" style={{ display: 'grid', gap: 12 }}>
        {(beat?.lines ?? []).map((l, i) => {
          const who = characterById(l.who);
          return (
            <div className="card" key={i} style={{ display: 'grid', gap: 6 }}>
              <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                {who && <Portrait spec={who.avatar} size={40} />}
                {who && <strong>{displayName(who, lang)}</strong>}
              </div>
              <JaText tokens={lineTokens(l.line.ja)} furigana={furigana} romaji={false} />
              <span dir="auto">{l.line[lang]}</span>
            </div>
          );
        })}
        <button className="btn primary wide" onClick={() => completeBeat(id)}>
          {t('common.continue')}
        </button>
      </div>
    </StubPanel>
  );
}
