// The Shrine panel (桜町神社, docs/GOEN.md "Spending"): tapping the offering box at the park's torii (`shrine:box`) or "Visit the shrine" in the
// Wallet opens it. The Goen balance, today's free omikuji, the season, and the catalog; "Make a wish" goes back to the 3D shrine for the
// ritual (WishRitual). Opening it files the visit (`visit shrine`): the first one unlocks the shrine's culture card.
import { useEffect } from 'react';
import { activeSeason } from '@lw/game';
import { GoenCatalog } from '../components/game/GoenCatalog';
import { GoenPill } from '../components/game/GoenPill';
import { Omikuji } from '../components/game/Omikuji';
import { beginWish } from '../components/game/WishRitual';
import { openSeason } from './Season';
import { Icon } from '../components/Icon';
import { dispatch } from '../game/bridge';
import { PACK } from '../game/pack';
import { useT } from '../hooks';
import { useStore } from '../store';

/** "Goen packs: coming later" shows only in a dev build with the flag on (docs/GOEN.md principle 5): never a buy button in production. */
const ENV = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
export const GOEN_SHOP_PREVIEW = ENV.DEV === true && ENV.VITE_GOEN_SHOP_PREVIEW === '1';

export function Shrine() {
  const { t, dir, lang } = useT();
  const go = useStore((s) => s.go);
  useEffect(() => {
    dispatch({ t: 'visit', place: 'shrine' });
  }, []);
  const season = activeSeason(PACK, Date.now());
  return (
    <div className="panel gn-shrine" dir={dir} data-screen="shrine" data-shrine>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>
          {t('gn.shrine.title')}
          <small lang="ja">桜町神社</small>
        </h1>
        <span />
      </header>
      <div className="panel-body gn-body">
        <div className="gn-shrine-top">
          <GoenPill />
          <p className="muted small" dir="auto">
            {t('gn.shrine.sub')}
          </p>
        </div>
        <Omikuji />
        <button type="button" className="gn-season-link card" data-open="season" onClick={() => openSeason('shrine')}>
          <span className="gn-pic gn-pic-season_autumn_premium" aria-hidden="true">
            <Icon name="star" size={22} />
          </span>
          <span>
            <strong dir="auto">{season ? season.def.name[lang] : t('gn.shrine.season')}</strong>
            <small dir="auto">{season ? t('gn.shrine.seasonSub') : t('gn.season.soon')}</small>
          </span>
          <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={20} />
        </button>
        <h2 className="h2">{t('gn.shrine.wishes')}</h2>
        <GoenCatalog onWish={beginWish} />
        {GOEN_SHOP_PREVIEW && (
          <p className="muted small center" data-goen-preview dir="auto">
            {t('gn.shrine.preview')}
          </p>
        )}
      </div>
    </div>
  );
}
