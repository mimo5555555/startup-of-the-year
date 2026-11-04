// The manners (所作, docs/ROADMAP.md) in a conversation: one small button per manner the player owns, under the suggestions. Tapping one makes
// the avatar do it and "arms" it for the next line the player says; Conversation.tsx judges that line (mannerFits) and files it.
import type { GoenItemDef } from '@lw/game';
import { useT } from '../../hooks';
import { Icon } from '../Icon';

export function MannerRow({ manners, armed, onArm, disabled }: { manners: GoenItemDef[]; armed: string | null; onArm: (m: GoenItemDef) => void; disabled?: boolean }) {
  const { t, lang } = useT();
  if (manners.length === 0) return null;
  return (
    <div className="manners" role="group" aria-label={t('mn.row')} data-manners>
      <span className="manners-label" aria-hidden="true">
        <Icon name="sparkle" size={14} />
      </span>
      {manners.map((m) => (
        <button key={m.id} type="button" className={`manner ${armed === m.id ? 'on' : ''}`} aria-pressed={armed === m.id} disabled={disabled} onClick={() => onArm(m)} data-manner={m.id}>
          <span lang="ja">{m.name.ja}</span>
          <small dir="auto">{m.name[lang]}</small>
        </button>
      ))}
    </div>
  );
}
