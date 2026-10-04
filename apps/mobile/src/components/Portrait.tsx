import type { AvatarSpec } from '@lw/content';

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Flat portrait drawn from the same spec as the 3D avatar, with a talking state for the mouth. */
export function Portrait({ spec, talking = false, size = 56, className = '' }: { spec: AvatarSpec; talking?: boolean; size?: number; className?: string }) {
  const hair = spec.hair.color;
  const hairDark = shade(hair, 0.8);
  const skin = spec.skin;
  const style = spec.hair.style;
  const acc = new Set(spec.accessories);
  return (
    <svg className={`portrait ${talking ? 'talking' : ''} ${className}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-hidden="true">
      {/* hair behind the head */}
      {style === 'long' && <path d="M22 44c-2 24 2 42 6 46h44c4-4 8-22 6-46z" fill={hair} />}
      {style === 'bob' && <path d="M21 42c-1 20 3 32 8 36h42c5-4 9-16 8-36-6-24-52-24-58 0z" fill={hair} />}
      {style === 'ponytail' && <path d="M70 34c14 2 18 14 14 30-2 6-6 10-8 10 2-6 2-12-2-18z" fill={hair} />}
      {style === 'bun' && <circle cx="50" cy="12" r="11" fill={hair} />}
      {/* shoulders and neck */}
      <path d="M8 100c2-20 14-28 42-28s40 8 42 28z" fill={spec.top} />
      {acc.has('apron') && <path d="M32 100 36 80h28l4 20z" fill={spec.accent} />}
      {acc.has('tie') && <path d="M47 76h6l2 16-5 4-5-4z" fill={spec.accent} />}
      {acc.has('scarf') && <path d="M30 72q20 12 40 0l2 8q-22 14-44 0z" fill={spec.accent} />}
      {acc.has('camera') && (
        <>
          <path d="M34 74 42 92M66 74 58 92" stroke="#d86b6b" strokeWidth="2.4" />
          <rect x="40" y="88" width="20" height="11" rx="2" fill="#2c2c36" />
          <circle cx="50" cy="93.5" r="3.6" fill="#15151b" />
        </>
      )}
      <rect x="43" y="62" width="14" height="14" rx="5" fill={shade(skin, 0.9)} />
      {/* head */}
      <ellipse cx="50" cy="46" rx="25" ry="26" fill={skin} />
      <ellipse cx="25.5" cy="48" rx="3.4" ry="5" fill={shade(skin, 0.92)} />
      <ellipse cx="74.5" cy="48" rx="3.4" ry="5" fill={shade(skin, 0.92)} />
      {/* hair on top */}
      {style !== 'bald' && (
        <>
          <path d="M24 46C22 22 36 14 50 14s28 8 26 32c-3-12-10-18-26-18S27 34 24 46z" fill={hair} />
          <path d="M28 38c8-2 14-8 18-14 4 7 14 12 26 14-2-14-10-22-22-22S30 24 28 38z" fill={hair} />
          {style === 'short' && <path d="M24 44c-1 8 1 12 3 14l1-14zM76 44c1 8-1 12-3 14l-1-14z" fill={hairDark} />}
          {style === 'spiky' && <path d="M26 30 30 12l10 12 8-16 8 16 10-12 4 18z" fill={hair} />}
        </>
      )}
      {acc.has('cap') && (
        <>
          <path d="M22 36C22 14 78 14 78 36z" fill={spec.top} />
          <rect x="20" y="34" width="60" height="5" rx="2" fill={spec.accent} />
          <path d="M34 36h46c4 0 6 3 4 5H34z" fill={shade(spec.top, 0.8)} />
        </>
      )}
      {acc.has('headband') && <path d="M24 34c10-6 42-6 52 0v6c-10-6-42-6-52 0z" fill={spec.accent} />}
      {acc.has('beanie') && <path d="M22 38C22 12 78 12 78 38z" fill={spec.accent} />}
      {/* face */}
      <g className="eyes">
        <ellipse cx="39.5" cy="49" rx="3.6" ry="4.6" fill="#2a2230" />
        <ellipse cx="60.5" cy="49" rx="3.6" ry="4.6" fill="#2a2230" />
        <circle cx="41" cy="47.2" r="1.3" fill="#fff" />
        <circle cx="62" cy="47.2" r="1.3" fill="#fff" />
      </g>
      <ellipse cx="32" cy="58" rx="4.6" ry="2.6" fill="#ff9fa8" opacity=".65" />
      <ellipse cx="68" cy="58" rx="4.6" ry="2.6" fill="#ff9fa8" opacity=".65" />
      {acc.has('mask') ? <rect x="34" y="55" width="32" height="14" rx="5" fill="#f3f3f6" /> : <ellipse className="mouth" cx="50" cy="62" rx="4.6" ry="2.2" fill="#8a3b45" />}
      {acc.has('glasses') && (
        <g fill="none" stroke="#2b2b36" strokeWidth="1.8">
          <circle cx="39.5" cy="49" r="8" />
          <circle cx="60.5" cy="49" r="8" />
          <path d="M47.5 48.5h5" />
        </g>
      )}
    </svg>
  );
}
