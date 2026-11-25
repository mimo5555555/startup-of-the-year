import { Fragment, type ReactNode } from 'react';
import type { Token } from '@lw/content';
import { IS_JAPANESE, TARGET_HTML_LANG } from '../target';

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

/** opening marks that belong to the word after them: a line never ends on 「¡」, 「¿」, 「«」 or 「「」 */
const OPENING = /^[¿¡«„“‘([「『（]$/;

/**
 * Target-language text: Japanese with optional furigana (above) and romaji (below); German, Dutch and Spanish as words with their spaces
 * (no reading aids: a word is read as written). Words with a meaning are tappable. A tappable word is a button, which a line may break
 * before even right after an opening mark, so the mark and its word are kept together (`.glue`).
 */
export function JaText({ tokens, furigana, romaji, size = 'md', onTap, marks, className = '', lit }: Props) {
  const anyRuby = IS_JAPANESE && furigana && tokens.some((t) => t.r);
  const showRomaji = romaji && IS_JAPANESE;
  let offset = 0;
  const els = tokens.map((t, i) => {
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
    return tappable ? (
      <button type="button" className={`${cls} tap`} onClick={() => onTap!(t)}>
        {body}
      </button>
    ) : (
      <span className={cls}>{t.raw && /[؀-ۿ]/.test(t.s) ? <bdi>{body}</bdi> : body}</span>
    );
  });
  const out: ReactNode[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const glue = t.punct && OPENING.test(t.s) && i + 1 < tokens.length && !tokens[i + 1]!.sp;
    out.push(
      <Fragment key={i}>
        {t.sp ? ' ' : null}
        {glue ? (
          <span className="glue">
            {els[i]}
            {els[i + 1]}
          </span>
        ) : (
          els[i]
        )}
      </Fragment>,
    );
    if (glue) i++;
  }
  return (
    <span className={`ja ja-${size}${IS_JAPANESE ? '' : ' latin'} ${className}`} lang={TARGET_HTML_LANG} dir="ltr">
      {out}
    </span>
  );
}
