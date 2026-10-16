// The slots of the player's own room as a list, and the panel fallback of the room (Release 2 wave B2): a CSS room with the placed furniture as
// word chips and the guest over it. The list is the 360-px-friendly twin of the 3D slot markers: both do the same thing on a tap.
import { FURNITURE, type Character } from '@lw/content';
import type { GamePack, GameState } from '@lw/game';
import { useT } from '../../hooks';
import type { StringKey } from '../../i18n';
import { useStore } from '../../store';
import { useUi } from '../../ui';
import { displayName } from '../../content';
import { pieceRows, slotRows } from '../../game/ownLogic';
import { PACK } from '../../game/pack';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Portrait } from '../Portrait';
import { nameToken } from './GoodsSheet';

/** The places of the room, one button each: what stands there (tap to take it out) or that it is empty (tap to put the picked piece there). */
export function SlotGrid({ pack = PACK, state, pick, onSlot }: { pack?: GamePack; state: GameState; pick: string | null; onSlot: (slot: string) => void }) {
  const { t, lang } = useT();
  const wanted = pick ? FURNITURE[pick]?.slot : null;
  return (
    <div className="own-slots" data-own="slots">
      {slotRows(pack, state).map(({ slot, piece }) => {
        const target = wanted === slot;
        return (
          <button
            key={slot}
            type="button"
            className={`own-slot${piece ? ' filled' : ''}${target ? ' target' : ''}`}
            data-slot={slot}
            data-slot-piece={piece?.id ?? ''}
            data-target={target ? 'true' : undefined}
            onClick={() => onSlot(slot)}
          >
            <span className="own-slot-name">{t(`ho.slot.${slot}` as StringKey)}</span>
            <span className="own-slot-what" dir="auto">
              {piece ? piece.name[lang] : target ? t('ho.furnish.placeHere') : t('ho.furnish.empty')}
            </span>
            {piece && <Icon name="x" size={14} />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The room behind the buttons when the 3D room cannot load (a low-end setting, `?panel=1`, no WebGL): wall, floor and window in the room's colours,
 * the guest over it, and every placed piece as a chip whose tap opens the word card (the 3D room has no furniture picks; this is the panel's way to
 * learn the names).
 */
export function OwnPanel({ stage, state, guest, talking = false }: { stage: string; state: GameState; guest: Character | null; talking?: boolean }) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const openWord = useUi((s) => s.openWord);
  const placed = pieceRows(PACK, state).filter((p) => p.state === 'placed');
  return (
    <div className="home-panel own-panel" data-room={stage} data-own="panel" role="img" aria-label={guest ? t('ho.room.guest', { name: displayName(guest, lang) }) : t('ho.room.hint')}>
      <div className="home-panel-window" aria-hidden="true" />
      <div className="home-panel-shelf" aria-hidden="true" />
      <div className="home-panel-floor" aria-hidden="true" />
      {guest && (
        <div className="home-panel-host" aria-hidden="true">
          <Portrait spec={guest.avatar} size={168} talking={talking} />
        </div>
      )}
      <div className="own-things" data-own="things">
        {placed.length === 0 && <span className="own-things-empty">{t('ho.room.empty')}</span>}
        {placed.map((p) => (
          <button key={p.id} type="button" className="chip own-thing" data-thing={p.id} onClick={() => openWord({ token: nameToken(p.name), source: 'sign' })}>
            <JaText tokens={[nameToken(p.name)]} furigana={furigana} romaji={romaji} size="md" />
          </button>
        ))}
      </div>
    </div>
  );
}
