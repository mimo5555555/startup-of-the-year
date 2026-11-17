import { Fragment } from 'react';
import type { Token } from '@lw/content';
import { IS_GERMAN } from '../target';

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
  /** karaoke subtitles (the Mini-theatre): the first `lit` tokens are lit, the one being said is `lit - 1` */
  lit?: number;
}

/**
 * Target-language text: Japanese with optional furigana (above) and romaji (below); German as words with their spaces (no reading aids:
 * a German word is read as written). Words with a meaning are tappable.
 */
export function JaText({ tokens, furigana, romaji, size = 'md', onTap, marks, className = '', lit }: Props) {
  const anyRuby = !IS_GERMAN && furigana && tokens.some((t) => t.r);
  const showRomaji = romaji && !IS_GERMAN;
  let offset = 0;
  return (
    <span className={`ja ja-${size}${IS_GERMAN ? ' de' : ''} ${className}`} lang={IS_GERMAN ? 'de' : 'ja'} dir="ltr">
      {tokens.map((t, i) => {
        // a spaced word: the space counts in the text's character offsets (corrections mark spans of the written line)
        if (t.sp) offset += 1;
        const start = offset;
        offset += t.s.length;
        const mark = marks?.find((m) => m.start < offset && m.end > start);
        const tappable = !!onTap && !t.punct && !t.raw && !!t.gloss;
        const body = (
          <>
            {anyRuby && <span className="rt">{furigana && t.r ? t.r : ' '}</span>}
            <span className="jp">{t.s}</span>
            {showRomaji && !t.punct && <span className="rm">{t.rom}</span>}
          </>
        );
        const karaoke = lit === undefined ? '' : i < lit - 1 ? ' lit' : i === lit - 1 ? ' lit now' : ' unlit';
        const cls = `tok${t.punct ? ' punct' : ''}${t.raw ? ' raw' : ''}${t.grammar ? ' gram' : ''}${mark ? ` mk mk-${mark.kind}` : ''}${karaoke}`;
        const el = tappable ? (
          <button type="button" className={`${cls} tap`} onClick={() => onTap!(t)}>
            {body}
          </button>
        ) : (
          <span className={cls}>{t.raw && /[؀-ۿ]/.test(t.s) ? <bdi>{body}</bdi> : body}</span>
        );
        return (
          <Fragment key={i}>
            {t.sp ? ' ' : null}
            {el}
          </Fragment>
        );
      })}
    </span>
  );
}
