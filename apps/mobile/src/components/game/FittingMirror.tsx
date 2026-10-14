import type { AvatarSpec } from '@lw/content';
import { useT } from '../../hooks';

// The fitting-room mirror of a clothes shop conversation (docs/GAME_DESIGN.md §6.3): a small full-length figure of the player drawn from the same
// AvatarSpec as the 3D avatar, wearing the piece being tried on. The 3D stage frames the clerk over the player's shoulder, so the player's own
// body is not in view; the mirror shows the whole outfit (a bust would hide the trousers and the shoes). Decorative: the conversation says it all.

/** Mixes a #rrggbb colour toward black (k < 1) or white (k > 1) for the figure's shading. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.max(0, Math.min(255, Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1))));
  };
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

const INK = '#2b2b36';

/** The figure alone (testable without the card around it). */
export function Figure({ spec }: { spec: AvatarSpec }) {
  const acc = new Set<string>(spec.accessories);
  const hair = spec.hair.color;
  const bald = spec.hair.style === 'bald';
  return (
    <svg className="fit-figure" viewBox="0 0 60 112" role="img" aria-hidden="true" focusable="false">
      {acc.has('backpack') && <rect x="13" y="40" width="34" height="30" rx="6" fill={shade(spec.accent, 0.75)} />}
      {/* legs and shoes */}
      <rect x="20" y="68" width="9.5" height="30" rx="3" fill={spec.bottom} />
      <rect x="30.5" y="68" width="9.5" height="30" rx="3" fill={spec.bottom} />
      <rect x="17.5" y="96" width="13" height="7" rx="3.5" fill={spec.shoes} stroke={shade(spec.shoes, 0.8)} strokeWidth="0.8" />
      <rect x="29.5" y="96" width="13" height="7" rx="3.5" fill={spec.shoes} stroke={shade(spec.shoes, 0.8)} strokeWidth="0.8" />
      {/* arms, hands and body */}
      <rect x="8" y="42" width="8" height="26" rx="4" fill={spec.top} />
      <rect x="44" y="42" width="8" height="26" rx="4" fill={spec.top} />
      <circle cx="12" cy="70" r="4" fill={spec.skin} />
      <circle cx="48" cy="70" r="4" fill={spec.skin} />
      <rect x="15" y="39" width="30" height="33" rx="8" fill={spec.top} />
      <rect x="15" y="64" width="30" height="8" rx="3" fill={spec.bottom} />
      {acc.has('tie') && <path d="M28 44h4l2 18-4 3-4-3z" fill={spec.accent} />}
      {acc.has('scarf') && (
        <>
          <rect x="19" y="38" width="22" height="6" rx="3" fill={spec.accent} />
          <rect x="33" y="42" width="6" height="14" rx="2" fill={spec.accent} />
        </>
      )}
      {/* head */}
      <rect x="26" y="33" width="8" height="7" rx="2" fill={shade(spec.skin, 0.9)} />
      <circle cx="30" cy="24" r="13" fill={spec.skin} />
      {!bald && <path d="M16.5 24C16 10 44 10 43.5 24c-3-7-8-9-13.5-9s-10.5 2-13.5 9z" fill={hair} />}
      <circle cx="25.5" cy="26" r="1.5" fill={INK} />
      <circle cx="34.5" cy="26" r="1.5" fill={INK} />
      <path d="M27 31q3 2.5 6 0" fill="none" stroke="#8a3b45" strokeWidth="1.2" strokeLinecap="round" />
      {acc.has('glasses') && (
        <g fill="none" stroke={INK} strokeWidth="1.2">
          <circle cx="25.5" cy="26" r="4.2" />
          <circle cx="34.5" cy="26" r="4.2" />
          <path d="M29.7 26h.6" />
        </g>
      )}
      {acc.has('cap') && (
        <>
          <path d="M16.5 22C16 6 44 6 43.5 22z" fill={spec.top} />
          <rect x="16" y="20.5" width="28" height="3" rx="1.5" fill={spec.accent} />
          <rect x="22" y="21" width="30" height="3" rx="1.5" fill={shade(spec.top, 0.8)} />
        </>
      )}
      {acc.has('beanie') && <path d="M16.5 22C16 6 44 6 43.5 22z" fill={spec.accent} />}
      {acc.has('helmet') && (
        <>
          <path d="M15.5 23C15 4 45 4 44.5 23z" fill={spec.accent} />
          <rect x="15" y="20.5" width="30" height="3" rx="1.5" fill={shade(spec.accent, 0.78)} />
        </>
      )}
    </svg>
  );
}

/** The mirror card shown over the 3D stage while a piece is on: a figure in a frame with the shop's "Fitting room" label. */
export function FittingMirror({ spec }: { spec: AvatarSpec }) {
  const { t } = useT();
  return (
    <figure className="fit-mirror" data-fitting aria-label={t('shop.fittingRoom')}>
      <Figure spec={spec} />
      <figcaption dir="auto">{t('shop.fittingRoom')}</figcaption>
    </figure>
  );
}
