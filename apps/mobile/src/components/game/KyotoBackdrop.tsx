// The Kyoto Journey (Goen stage 1, docs/GOEN.md): a panel destination like Hikarigaoka (TripBackdrop), no 3D town. Behind each Kyoto conversation
// a CSS scene: the ryokan (shoji, tatami, the okami at the low table), the temple garden (pagoda, maples, raked gravel, the amulet counter) and the
// matcha café (noren, counter, a bowl and a sweet). The first scene after the Shinkansen ride opens with a two-second window of the train.
// Flat colours, the host drawn as a portrait over it, labels in the player's language.
import type { Character } from '@lw/content';
import { useT } from '../../hooks';
import { displayName } from '../../content';
import { Portrait } from '../Portrait';
import type { KyotoPlace } from '../../game/goenLogic';

export interface KyotoBackdropProps {
  place: KyotoPlace;
  /** the person the player talks to (the okami, the temple attendant, the café owner) */
  host?: Character;
  /** the ride at the start (only right after the Shinkansen) */
  ride?: boolean;
  /** the map screen uses the scene as a still picture under its own panel */
  still?: boolean;
}

const SIGN: Record<KyotoPlace, string> = { ryokan: '旅館', temple: 'お寺', matcha: '抹茶' };

/** The scene behind a Kyoto conversation. */
export function KyotoBackdrop({ place, host, ride = false, still = false }: KyotoBackdropProps) {
  const { t, lang } = useT();
  return (
    <div
      className={`kyo-scene kyo-${place}${still ? ' still' : ''}`}
      data-kyoto={place}
      role="img"
      aria-label={`${t(`gn.kyoto.scene.${place}` as const)}${host ? `, ${displayName(host, lang)}` : ''}`}
    >
      {place === 'ryokan' && (
        <div className="kyo-set" aria-hidden="true">
          <i className="kyo-shoji s1" />
          <i className="kyo-shoji s2" />
          <i className="kyo-tokonoma">
            <b className="kyo-scroll" />
            <b className="kyo-ikebana" />
          </i>
          <i className="kyo-tatami" />
          <i className="kyo-table" />
        </div>
      )}
      {place === 'temple' && (
        <div className="kyo-set" aria-hidden="true">
          <i className="kyo-hills" />
          <i className="kyo-pagoda">
            <b className="r1" />
            <b className="r2" />
            <b className="r3" />
          </i>
          <i className="kyo-maple m1" />
          <i className="kyo-maple m2" />
          <i className="kyo-maple m3" />
          <i className="kyo-gravel" />
          <i className="kyo-lantern" />
          <i className="kyo-counter" />
        </div>
      )}
      {place === 'matcha' && (
        <div className="kyo-set" aria-hidden="true">
          <i className="kyo-wall" />
          <i className="kyo-noren">
            <b lang="ja">抹</b>
            <b lang="ja">茶</b>
          </i>
          <i className="kyo-bar" />
          <i className="kyo-bowl" />
          <i className="kyo-wagashi" />
        </div>
      )}
      <span className="kyo-sign" lang="ja" aria-hidden="true">
        {SIGN[place]}
      </span>
      {host && (
        <span className="kyo-host" aria-hidden="true">
          <Portrait spec={host.avatar} size={104} />
        </span>
      )}
      {ride && (
        <div className="kyo-ride" data-kyoto-ride aria-hidden="true">
          <div className="kyo-window">
            <i className="kyo-fuji" />
            <span className="kyo-pass p1" />
            <span className="kyo-pass p2" />
          </div>
          <p>{t('gn.kyoto.riding')}</p>
        </div>
      )}
    </div>
  );
}
