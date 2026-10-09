import type { StringKey } from '../../i18n';
import { characterById, displayName } from '../../content';
import { approachPoint } from '../../game/worldSync';
import type { MapPinRow } from '../../game/phoneLogic';
import { useT } from '../../hooks';
import { Icon } from '../Icon';
import { Portrait } from '../Portrait';
import { HeartBar } from './HeartBar';

/** What the tracker points at, when it is a person the phone can also list (the goal's pin, §7.5). */
export interface GoalPin {
  friendId: string;
  title: string;
}

/**
 * Map pins (§8.7, D17): the places where the player's friends are, with a hearts line and, when they agreed to meet today, a "Plan
 * today" tag, and the tracker's goal first when it is a person. Walk there closes the phone and walks the player to them (the world
 * is underneath the phone). A pin the world cannot walk to has no button; with no pin at all the screen says why.
 */
export function MapList({ pins, goal, onWalk }: { pins: MapPinRow[]; goal: GoalPin | null; onWalk(friendId: string): void }) {
  const { t, lang } = useT();
  const row = (friendId: string, placeId: string | null, extra: { hearts?: number; plan?: boolean; heading?: string }) => {
    const who = characterById(friendId);
    if (!who) return null;
    const name = displayName(who, lang);
    const walkable = !!approachPoint(friendId);
    return (
      <li className={`ph-pin${extra.heading ? ' ph-pin-goal' : ''}`} key={`${extra.heading ?? 'f'}:${friendId}`} {...(extra.heading ? { 'data-goal-pin': friendId } : { 'data-pin': friendId })} data-plan={extra.plan ? '1' : '0'}>
        <Portrait spec={who.avatar} size={44} />
        <div className="ph-pin-text">
          <strong dir="auto">
            <Icon name="pin" size={15} /> {extra.heading ?? name}
          </strong>
          <small dir="auto">{[placeId ? t(`phone.place.${placeId}` as StringKey) : '', extra.heading ? name : ''].filter(Boolean).join(' · ')}</small>
          {extra.hearts !== undefined && <HeartBar hearts={extra.hearts} ap={0} floor={0} next={null} compact />}
          {extra.plan && <span className="ph-plan-tag">{t('phone.plan')}</span>}
        </div>
        {walkable && (
          <button className="btn soft ph-walk" data-act="walk" aria-label={t('phone.map.walkTo', { name })} onClick={() => onWalk(friendId)}>
            <Icon name="walk" size={18} /> {t('phone.map.walk')}
          </button>
        )}
      </li>
    );
  };

  const goalRow = goal ? row(goal.friendId, characterById(goal.friendId)?.locationId ?? null, { heading: goal.title }) : null;
  return (
    <div className="ph-map" data-map-list>
      {goalRow && (
        <>
          <h2 className="ph-h">{t('phone.map.goal')}</h2>
          <ul className="ph-pins">{goalRow}</ul>
        </>
      )}
      <h2 className="ph-h">{t('phone.map.friends')}</h2>
      {pins.length === 0 ? (
        <p className="ph-note" data-map-none>
          {t('phone.map.none')}
        </p>
      ) : (
        <ul className="ph-pins">{pins.map((p) => row(p.friendId, p.placeId, { hearts: p.hearts, plan: p.plan }))}</ul>
      )}
    </div>
  );
}
