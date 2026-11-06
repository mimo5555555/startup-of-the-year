// カラオケ「うたひろば」: who sings with you. Opens when a room was just paid for at Nanami's desk, or when the karaoke door is tapped with a
// room booked for today. Lists the friends you have met (hearts first); choosing one starts `karaoke_room` with that friend as the character
// (like the housewarming guest). "Later" keeps the booking for today: the door opens the sheet again.
import { useEffect } from 'react';
import { useT } from '../../hooks';
import { characterById, displayName } from '../../content';
import { startConversation } from '../../game/bridge';
import { useGameState } from '../../game/hooks';
import { useKaraoke } from '../../game/karaokeStore';
import { PACK } from '../../game/pack';
import { heartsOf } from '../../game/selectors';
import { Icon } from '../Icon';
import { Portrait } from '../Portrait';

export const KARAOKE_ROOM = 'karaoke_room';


/** The friends who can come: met, in the pack's friend order, the one with most hearts first. */
export function karaokeFriends(state: ReturnType<typeof useGameState>): string[] {
  return PACK.friends
    .map((f) => f.id)
    .filter((id) => state.friends[id]?.met && characterById(id))
    .sort((a, b) => heartsOf(state, b) - heartsOf(state, a));
}

export function KaraokeInvite() {
  const { t, lang } = useT();
  const open = useKaraoke((s) => s.open);
  const state = useGameState();
  // Escape closes it, like the other sheets of the street
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useKaraoke.getState().setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  const booked = state.karaoke?.booked === state.clock.dayIndex;
  const friends = karaokeFriends(state);
  const close = () => useKaraoke.getState().setOpen(false);
  const sing = (id: string) => {
    close();
    startConversation({ scenarioId: KARAOKE_ROOM, characterId: id });
  };
  return (
    <div className="scrim hud-scrim" onClick={close}>
      <div className="word-sheet hud-sheet" role="dialog" aria-modal="true" aria-label={t('kr.title')} onClick={(e) => e.stopPropagation()} data-karaoke-invite>
        <button className="icon-btn ghost word-close" onClick={close} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <header className="hud-sheet-head">
          <div>
            <h2 dir="auto">{t('kr.title')}</h2>
            <p lang="ja">だれと歌う？</p>
          </div>
        </header>
        {!booked ? (
          <p className="hud-choose" dir="auto">
            {t('kr.notBooked')}
          </p>
        ) : friends.length === 0 ? (
          <p className="hud-choose" dir="auto">
            {t('kr.noFriends')}
          </p>
        ) : (
          <>
            <p className="hud-choose" dir="auto">
              {t('kr.choose')}
            </p>
            <div className="hud-opts">
              {friends.map((id, i) => {
                const c = characterById(id)!;
                return (
                  <button key={id} className={`hud-opt${i === 0 ? ' primary' : ''}`} data-karaoke-friend={id} onClick={() => sing(id)}>
                    <Portrait spec={c.avatar} size={36} />
                    <span dir="auto">{displayName(c, lang)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <button type="button" className="btn soft wide" onClick={close} data-karaoke-later>
          {t('kr.later')}
        </button>
      </div>
    </div>
  );
}
