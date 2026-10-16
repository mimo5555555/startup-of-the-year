// The Hikarigaoka trip (Release 2 wave C1, docs/GAME_DESIGN.md §6.5, D29): a panel destination, no 3D town. While the trip conversation with Kato
// runs, this CSS scene is the background: a short train-window ride (about two seconds, nothing to tap), then the station square of Hikarigaoka
// with its sign, the platform and Kato's souvenir stall. Same look as the room backdrops of a home visit (`PanelFallback`): flat colours, the host
// drawn as a portrait over it, labels in the player's language.
import { useStore } from '../../store';
import { useT } from '../../hooks';
import { displayName } from '../../content';
import type { Character } from '@lw/content';
import { JaText } from '../JaText';
import { Portrait } from '../Portrait';
import { placeLabel } from './FareMap';

export interface TripBackdropProps {
  /** the person at the stall (Kato) */
  host: Character;
  /** the ride at the start is skipped (reduced motion, or a trip that is already under way) */
  noRide?: boolean;
}

/** The scene behind the trip conversation: sky, town, the station sign, the platform and the stall with its keeper. */
export function TripBackdrop({ host, noRide = false }: TripBackdropProps) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const place = placeLabel('hikarigaoka', lang);
  return (
    <div className="trip-scene" data-trip="hikarigaoka" role="img" aria-label={`${t('trip.scene')}: ${place.name}, ${displayName(host, lang)}`}>
      <div className="trip-sky" aria-hidden="true">
        <i className="trip-cloud c1" />
        <i className="trip-cloud c2" />
      </div>
      <div className="trip-town" aria-hidden="true">
        <i className="b b1" />
        <i className="b b2" />
        <i className="b b3" />
        <i className="b b4" />
        <i className="b b5" />
      </div>
      <div className="trip-sign" data-trip-sign>
        <span className="trip-sign-ja" dir="ltr">
          <JaText tokens={place.tokens} furigana={furigana} romaji={false} size="md" />
          <span lang="ja">駅</span>
        </span>
        <small dir="auto">{place.name}</small>
      </div>
      <div className="trip-stall" aria-hidden="true">
        <span className="trip-awning" lang="ja">
          おみやげ
        </span>
        <span className="trip-counter" />
        <span className="trip-host">
          <Portrait spec={host.avatar} size={112} />
        </span>
      </div>
      <div className="trip-platform" aria-hidden="true">
        <i className="trip-line" />
      </div>
      {!noRide && (
        <div className="trip-ride" data-trip-ride aria-hidden="true">
          <div className="trip-window">
            <span className="trip-pass p1" />
            <span className="trip-pass p2" />
            <span className="trip-pass p3" />
          </div>
          <p>{t('trip.riding')}</p>
        </div>
      )}
    </div>
  );
}
