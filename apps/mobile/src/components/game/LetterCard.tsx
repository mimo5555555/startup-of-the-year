// The finished Letter Home as a card (docs/GAME_DESIGN.md §7.2 Chapter 8): the header, the five sentences (and the diary lines added) with
// furigana and romaji as the settings say and the meaning in the UI language below each, the signature. The Letter screen shows it after
// saving, with Save as an image and Hanako's read-back; the ending beat shows it while Hanako reads it.
import { JaText } from '../JaText';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import type { LetterCardData } from '../../game/letterLogic';

export function LetterCard({ card, compact = false }: { card: LetterCardData; compact?: boolean }) {
  const { t } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  return (
    // a Japanese letter reads left to right in either UI language; each meaning line keeps its own direction (dir=auto)
    <article className={`ltr-card${compact ? ' compact' : ''}`} dir="ltr" data-letter-card="1" aria-label={t('letter.cardTitle')}>
      <p className="ltr-head">
        <JaText tokens={card.header.tokens} furigana={furigana} romaji={romaji} size={compact ? 'md' : 'lg'} />
        <small dir="auto">{card.header.gloss}</small>
      </p>
      <ol className="ltr-lines">
        {card.lines.map((l, i) => (
          <li key={i} data-sentence={i} data-assisted={l.assisted ? 1 : 0} data-diary={l.diary ? 1 : undefined}>
            <JaText tokens={l.tokens} furigana={furigana} romaji={romaji} size={compact ? 'sm' : 'md'} />
            {!compact && l.gloss && <small dir="auto">{l.gloss}</small>}
            {!compact && (
              <span className={`pill ltr-tag${l.assisted ? ' help' : ''}`}>{l.diary ? t('letter.diary') : t(l.assisted ? 'letter.assistedTag' : 'letter.ownTag')}</span>
            )}
          </li>
        ))}
      </ol>
      <p className="ltr-sign">
        <JaText tokens={card.sign.tokens} furigana={furigana} romaji={romaji} size={compact ? 'sm' : 'md'} />
        {!compact && <small dir="auto">{card.sign.gloss}</small>}
      </p>
    </article>
  );
}
