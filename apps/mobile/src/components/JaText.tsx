import type { Token } from '@lw/content';

export interface Mark {
  start: number;
  end: number;
  kind: 'grammar' | 'vocabulary' | 'naturalness';
}

interface Props {
  tokens: Token[];
  furigana: boolean;
  romaji: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onTap?: (t: Token) => void;
  marks?: Mark[];
  className?: string;
}

/** Japanese text with optional furigana (above) and romaji (below). Words with a meaning are tappable. */
export function JaText({ tokens, furigana, romaji, size = 'md', onTap, marks, className = '' }: Props) {
  const anyRuby = furigana && tokens.some((t) => t.r);
  let offset = 0;
  return (
    <span className={`ja ja-${size} ${className}`} lang="ja" dir="ltr">
      {tokens.map((t, i) => {
        const start = offset;
        offset += t.s.length;
        const mark = marks?.find((m) => m.start < offset && m.end > start);
        const tappable = !!onTap && !t.punct && !t.raw && !!t.gloss;
        const body = (
          <>
            {anyRuby && <span className="rt">{furigana && t.r ? t.r : ' '}</span>}
            <span className="jp">{t.s}</span>
            {romaji && !t.punct && <span className="rm">{t.rom}</span>}
          </>
        );
        const cls = `tok${t.punct ? ' punct' : ''}${t.raw ? ' raw' : ''}${t.grammar ? ' gram' : ''}${mark ? ` mk mk-${mark.kind}` : ''}`;
        return tappable ? (
          <button key={i} type="button" className={`${cls} tap`} onClick={() => onTap!(t)}>
            {body}
          </button>
        ) : (
          <span key={i} className={cls}>
            {t.raw && /[؀-ۿ]/.test(t.s) ? <bdi>{body}</bdi> : body}
          </span>
        );
      })}
    </span>
  );
}
