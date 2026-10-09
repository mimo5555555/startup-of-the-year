import { useEffect } from 'react';
import type { Character, Gloss } from '@lw/content';
import { useT } from '../../hooks';
import { openScreen, startConversation } from '../../game/bridge';
import { type OptionRow, type Plan } from '../../game/worldSync';
import { displayName } from '../../content';
import { useStore } from '../../store';
import { Icon, type IconName } from '../Icon';
import { Portrait } from '../Portrait';

/** Carries out a plan that starts something (the plans for a sheet, `window`, are the caller's: it shows the Goods sheet). */
export function runPlan(plan: Plan): void {
  switch (plan.t) {
    case 'convo':
      startConversation({ scenarioId: plan.scenarioId, characterId: plan.characterId, ...(plan.startNode ? { startNode: plan.startNode } : {}) });
      break;
    case 'prepare':
      openScreen('prepare', { scenarioId: plan.scenarioId, characterId: plan.characterId });
      break;
    case 'lesson':
      useStore.setState({ lessonId: plan.lessonId });
      useStore.getState().go('lesson');
      break;
    case 'shift':
      openScreen('shift', { jobId: plan.jobId });
      break;
    case 'gift':
      // the gift hand-over lives on the Friends screen (slice 4A): it opens on this friend with the gift sheet up
      openScreen('friends', { friendId: plan.characterId, gift: true });
      break;
    case 'window':
      break;
  }
}

function iconOf(row: OptionRow): IconName {
  const { it } = row;
  switch (it.kind) {
    case 'lesson':
      return 'book';
    case 'shift':
      return 'briefcase';
    case 'gift':
      return 'gift';
    case 'trip':
      return 'train';
    case 'visit':
      return 'home';
    case 'window':
      return 'eye';
    default:
      return it.id.endsWith('_shop') ? 'bag' : it.id.endsWith('_hang') ? 'heart' : 'message';
  }
}

export interface InteractionSheetProps {
  /** the NPC; absent for a shop front (a closed shop has no one to talk to) */
  character?: Character;
  /** the shop front's name when there is no character */
  shopName?: Gloss;
  rows: OptionRow[];
  /** the shop is shut until this chapter: the sheet says 「まだ準備中です。」 */
  closedUntil?: number;
  /** adds "Look at the goods" next to the options (it is not counted as an option: §6.1) */
  hasGoods?: boolean;
  onPick: (row: OptionRow) => void;
  onGoods: () => void;
  onClose: () => void;
}

/** The Interaction sheet (§6.1): what this NPC offers right now. It opens only when there is more than one thing to do. */
export function InteractionSheet({ character, shopName, rows, closedUntil, hasGoods, onPick, onGoods, onClose }: InteractionSheetProps) {
  const { t, lang } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const firstOpen = rows.findIndex((r) => !r.lock);
  const lockText = (row: OptionRow): string => {
    const l = row.lock!;
    return 'ch' in l ? t('quests.locked', { n: l.ch }) : 'hearts' in l ? t('hud.needHearts', { n: l.hearts }) : t('social.notYet');
  };

  return (
    <div className="scrim hud-scrim" onClick={onClose}>
      <div className="word-sheet hud-sheet" role="dialog" aria-modal="true" aria-label={character ? displayName(character, lang) : shopName?.[lang]} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn ghost word-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <header className="hud-sheet-head">
          {character && <Portrait spec={character.avatar} size={52} />}
          <div>
            <h2 dir="auto">{character ? displayName(character, lang) : shopName?.[lang]}</h2>
            <p lang="ja">{character ? character.name.ja : ''}</p>
          </div>
        </header>

        {closedUntil !== undefined && (
          <div className="hud-closed" role="status">
            <p lang="ja" className="hud-closed-ja">
              まだ<ruby>準備中<rt>じゅんびちゅう</rt></ruby>です。
            </p>
            <p dir="auto">{t('hud.closedSay')}</p>
            <p className="hud-closed-ch" dir="auto">
              <Icon name="lock" size={14} /> {t('shop.opensIn', { n: closedUntil })}
            </p>
          </div>
        )}

        {rows.length > 0 && <p className="hud-choose">{t('hud.choose')}</p>}
        <div className="hud-opts">
          {rows.map((row, i) => (
            <button
              key={row.it.id}
              className={`hud-opt${i === firstOpen ? ' primary' : ''}${row.lock ? ' locked' : ''}`}
              aria-disabled={!!row.lock}
              data-opt={row.it.id}
              onClick={() => !row.lock && onPick(row)}
            >
              <span className="hud-opt-ic">
                <Icon name={row.lock ? 'lock' : iconOf(row)} size={20} />
              </span>
              <span className="hud-opt-text">
                <strong dir="auto">{row.it.label[lang]}</strong>
                {row.lock && <small dir="auto">{lockText(row)}</small>}
              </span>
            </button>
          ))}
          {hasGoods && (
            <button className="hud-opt alt" data-opt="goods" onClick={onGoods}>
              <span className="hud-opt-ic">
                <Icon name="bag" size={20} />
              </span>
              <span className="hud-opt-text">
                <strong>{t('shop.goods')}</strong>
              </span>
            </button>
          )}
        </div>
        <button className="btn soft wide" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
