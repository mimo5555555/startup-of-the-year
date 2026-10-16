// The furniture placer (Release 2 wave B2, docs/GAME_DESIGN.md §8.8): the sheet over the own room. Tap an owned, delivered piece, then the place
// for it (the list below, or the teal marker in the 3D room); tap a placed piece to take it out again. Pieces on their way say when they come.
// The room redraws live (`world.setStagePlaced`, HomeOwn). Comfort is shown with the rule that opens the room to friends.
import { FURNITURE, OWN_GUEST } from '@lw/content';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { useGameState } from '../../game/hooks';
import { comfortInfo, pieceRows, slotRows, transitLine } from '../../game/ownLogic';
import { PACK } from '../../game/pack';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { SlotGrid } from './HomeSlots';
import { nameToken } from './GoodsSheet';

export interface FurniturePlacerProps {
  pick: string | null;
  onPick: (id: string | null) => void;
  onSlot: (slot: string) => void;
  onClose: () => void;
}

export function FurniturePlacer({ pick, onPick, onSlot, onClose }: FurniturePlacerProps) {
  const { t, lang } = useT();
  const state = useGameState();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const c = comfortInfo(PACK, state);
  const pieces = pieceRows(PACK, state).filter((p) => p.state !== 'placed');
  const picked = pick ? pieces.find((p) => p.id === pick) : undefined;
  const hasReady = pieces.some((p) => p.state === 'ready');
  const anyPlaced = slotRows(PACK, state).some((r) => r.piece);
  const hint = picked ? t('ho.furnish.hint.pick', { item: picked.name[lang] }) : hasReady ? t('ho.furnish.hint') : pieces.length === 0 ? t(anyPlaced ? 'ho.furnish.allPlaced' : 'ho.furnish.none') : null;
  return (
    <section className="own-sheet glass-card" data-own="furnish" role="dialog" aria-label={t('ho.furnish.title')}>
      <header className="own-sheet-head">
        <h2>{t('ho.furnish.title')}</h2>
        <button type="button" className="btn primary own-done" data-own="furnish-done" onClick={onClose}>
          {t('ho.furnish.close')}
        </button>
      </header>
      <p className="own-comfort" data-own="comfort-line" data-comfort={c.value}>
        <Icon name="sparkle" size={14} />
        <span dir="auto">
          <strong>{t('ho.comfort', { n: c.value, max: c.max })}</strong> · {c.open ? t('ho.comfort.ok') : t('ho.comfort.need', { n: OWN_GUEST.comfort })}
        </span>
      </p>
      {hint && (
        <p className="own-hint" data-own="hint" dir="auto">
          {hint}
        </p>
      )}
      {pieces.length > 0 && (
        <div className="own-pieces" data-own="pieces" aria-label={t('ho.furnish.pieces')}>
          {pieces.map((p) =>
            p.state === 'ready' ? (
              <button key={p.id} type="button" className={`own-piece${pick === p.id ? ' on' : ''}`} data-piece={p.id} data-state="ready" aria-pressed={pick === p.id} onClick={() => onPick(pick === p.id ? null : p.id)}>
                <JaText tokens={[nameToken(p.name)]} furigana={furigana} romaji={romaji} size="md" />
                <small dir="auto">{p.name[lang]}</small>
              </button>
            ) : (
              <div key={`${p.id}:${p.state}`} className="own-piece later" data-piece={p.id} data-state={p.state}>
                <span className="own-piece-name" dir="auto">
                  {p.name[lang]}
                </span>
                <small dir="auto">{p.state === 'transit' ? transitLine(t, p.due!, lang) : t('ho.furnish.flatOnly')}</small>
              </div>
            ),
          )}
        </div>
      )}
      <SlotGrid state={state} pick={pick && FURNITURE[pick] ? pick : null} onSlot={onSlot} />
    </section>
  );
}
