import { LEXICON, SLOTS, tokenize, type Token } from '@lw/content';
import { JaText } from '../JaText';
import { useStore } from '../../store';
import { useT } from '../../hooks';
import { yen, type FareStop } from './panelLogic';

export interface FareMapProps {
  stops: FareStop[];
  selected: string | null;
  onSelect(place: string): void;
  /** which fare the labels under the stops show: the IC fare, or the paper-ticket fare */
  show?: 'ic' | 'paper';
}

/** The place slot is the one list of destination names (kanji, reading, meanings); a place it does not know falls back to its id. */
export function placeLabel(place: string, lang: 'en' | 'ar'): { tokens: Token[]; name: string } {
  const opt = SLOTS.place?.find((o) => o.id === place);
  if (!opt) return { tokens: [{ s: place, rom: place, raw: true }], name: place };
  return { tokens: tokenize(opt.ja, LEXICON).tokens, name: opt.gloss[lang] };
}

/**
 * The fare map of a ticket machine (docs/GAME_DESIGN.md §6.5): Sakura-chō at the start of two lines, every destination as a button with
 * its kanji name and its fare under it. Tap one to choose it. The start sits at the inline start, so in Arabic the whole map mirrors
 * (the stops use logical offsets); the Japanese and the numbers keep their own direction.
 */
export function FareMap({ stops, selected, onSelect, show = 'ic' }: FareMapProps) {
  const { t, lang } = useT();
  const settings = useStore((s) => s.settings);
  return (
    <div className="pn-map" role="group" aria-label={t('panel.ticket.fareMap')}>
      <span className="pn-lane l0" aria-hidden="true" />
      <span className="pn-lane l1" aria-hidden="true" />
      <span className="pn-spine" aria-hidden="true" />
      <span className="pn-origin">{t('panel.ticket.here')}</span>
      {stops.map((s) => {
        const label = placeLabel(s.place, lang);
        const fare = show === 'paper' ? s.paper : s.ic;
        const on = s.place === selected;
        return (
          <button
            key={s.place}
            type="button"
            className={`pn-stop l${s.lane}${on ? ' on' : ''}`}
            style={{ insetInlineStart: `${s.x}%` }}
            aria-pressed={on}
            aria-label={`${label.name}, ${yen(fare)}`}
            onClick={() => onSelect(s.place)}
          >
            <span className="pn-stop-name">
              <JaText tokens={label.tokens} furigana={settings.furigana} romaji={false} size="sm" />
            </span>
            <span className="pn-stop-dot" aria-hidden="true" />
            <span className="pn-stop-fare pn-num" dir="ltr">
              {yen(fare)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
