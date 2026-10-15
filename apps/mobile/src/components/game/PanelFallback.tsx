// The panel fallback of a home (Release 2 wave B1): the host over a CSS room, the same two genkan buttons, the same props as tappable
// word chips. It is shown whenever the 3D room cannot load, on a low-end setting and with `?panel=1`; the conversation is the same one.
import type { Character } from '@lw/content';
import type { HomeDef } from '@lw/content';
import { LEXICON, PROP_WORDS, tokenize } from '@lw/content';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { displayName } from '../../content';
import { propPick } from '../../game/homeLogic';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Portrait } from '../Portrait';

/** The room behind the host: wall, floor, window and a rug in the home's colours (pure CSS; `data-room` picks the palette). */
export function PanelBackdrop({ home, host, talking = false }: { home: HomeDef; host: Character; talking?: boolean }) {
  const { t, lang } = useT();
  return (
    <div className="home-panel" data-room={home.stage} role="img" aria-label={`${t(`fv.room.${home.stage}` as never)}: ${displayName(host, lang)}`}>
      <div className="home-panel-window" aria-hidden="true" />
      <div className="home-panel-shelf" aria-hidden="true" />
      <div className="home-panel-floor" aria-hidden="true" />
      <div className="home-panel-host" aria-hidden="true">
        <Portrait spec={host.avatar} size={168} talking={talking} />
      </div>
    </div>
  );
}

export interface PropChipsProps {
  home: HomeDef;
  discovered: readonly string[];
  onTap: (pickId: string) => void;
}

/** The props of the room as chips: the word on the chip, a tick once its card has been seen. Tapping opens the same word card as the 3D prop. */
export function PropChips({ home, discovered, onTap }: PropChipsProps) {
  const { t } = useT();
  // the word on the chip follows the furigana and romaji settings (a room's kanji, 畳 or 急須, would be unreadable without them)
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  return (
    <div className="home-props" data-home="props">
      <p className="home-props-hint">{t('fv.props.hint')}</p>
      <div className="home-props-chips">
        {home.props.map((p) => {
          const id = propPick(home.stage, p);
          const entry = LEXICON.get(PROP_WORDS[p]);
          if (!entry) return null;
          const seen = discovered.includes(id);
          return (
            <button key={p} type="button" className={`chip home-chip${seen ? ' seen' : ''}`} data-prop={p} onClick={() => onTap(id)}>
              {seen && <Icon name="check" size={14} stroke={3} />}
              <JaText tokens={tokenize(entry.s, LEXICON).tokens} furigana={furigana} romaji={romaji} size="md" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
