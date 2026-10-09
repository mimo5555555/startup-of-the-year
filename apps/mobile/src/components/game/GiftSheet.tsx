import { useEffect, useMemo, useState } from 'react';
import type { Character } from '@lw/content';
import type { FriendActions } from '@lw/game';
import { displayName } from '../../content';
import { giftChoices } from '../../game/friendsLogic';
import { useGameState } from '../../game/hooks';
import { PACK, shopById } from '../../game/pack';
import { useT } from '../../hooks';
import { Icon } from '../Icon';

/**
 * The gift sheet (§8.5): the presents the player bought and still has, one to pick, then "Hand it over" starts the hand-over
 * conversation (`give_gift`), where the player names the gift in Japanese. A gift must have been bought in a shop (vending-machine
 * drinks never are), so with nothing in the bag the sheet says where to buy one; a daily limit or a day with no talk is said in words.
 */
export function GiftSheet({ who, actions, onHandOver, onClose }: { who: Character; actions: FriendActions; onHandOver: (itemId: string) => void; onClose: () => void }) {
  const { t, lang } = useT();
  const game = useGameState();
  const name = displayName(who, lang);
  const choices = useMemo(() => giftChoices(PACK, game), [game]);
  const [sel, setSel] = useState<string | null>(null);
  const picked = choices.find((c) => c.itemId === sel) ? sel : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const daily = actions.giftNotes.includes('daily');
  const notes = [
    daily && t('social.noteDaily', { name }),
    !daily && actions.giftNotes.includes('noTalk') && t('social.noteNoTalk', { name }),
    !daily && actions.giftNotes.includes('capped') && t('social.noteCapped', { name }),
  ].filter(Boolean) as string[];

  return (
    <div className="scrim" onClick={onClose}>
      <div className="word-sheet frd-gift" role="dialog" aria-modal="true" aria-label={t('social.giftTitle', { name })} data-gift-sheet onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn ghost word-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <h2 className="frd-gift-title" dir="auto">
          <Icon name="gift" size={22} /> {t('social.giftTitle', { name })}
        </h2>
        {choices.length === 0 ? (
          <p className="muted" data-gift-empty dir="auto">
            {t('social.giftNone')}
          </p>
        ) : (
          <>
            <p className="muted" dir="auto">
              {t('social.giftPick')}
            </p>
            <ul className="frd-gift-list" role="radiogroup" aria-label={t('social.giftPick')}>
              {choices.map((c) => (
                <li key={c.itemId}>
                  <button
                    role="radio"
                    aria-checked={picked === c.itemId}
                    className={`frd-gift-item${picked === c.itemId ? ' on' : ''}`}
                    data-item={c.itemId}
                    onClick={() => setSel(c.itemId)}
                  >
                    <span className="frd-gift-name">
                      <strong lang="ja">{c.name.ja}</strong>
                      <small className="muted" dir="auto">
                        {c.name[lang]}
                        {c.shop && shopById(c.shop) ? ` · ${shopById(c.shop)!.name[lang]}` : ''}
                      </small>
                    </span>
                    <bdi dir="ltr" className="frd-qty">
                      ×{c.qty}
                    </bdi>
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted" dir="auto">
              {t('social.giftHow')}
            </p>
          </>
        )}
        {notes.map((n) => (
          <p key={n} className="frd-note" data-gift-note dir="auto">
            {n}
          </p>
        ))}
        {choices.length > 0 && (
          <button className="btn primary wide" data-act="hand-over" disabled={!picked || daily} onClick={() => picked && onHandOver(picked)}>
            {t('social.giftGo')}
          </button>
        )}
      </div>
    </div>
  );
}
