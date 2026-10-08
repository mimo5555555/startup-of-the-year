import type { ObjectiveRow as ObjectiveData } from '@lw/game';
import { characterById } from '../../content';
import { useT } from '../../hooks';
import { Icon } from '../Icon';
import { Portrait } from '../Portrait';
import { Ltr } from './WalletPill';

/**
 * One objective of the Story tab (§7.5): a tick, the text, "2/4" progress with a bar, the hint, and, after three attempts, Hanako's offer to
 * make it easier (D40). The row is a plain list item; `data-obj` / `data-easier` are the hooks of the e2e script.
 */
export function ObjectiveRow({ row, onEasier }: { row: ObjectiveData; onEasier?: (id: string) => void }) {
  const { t, lang } = useT();
  const hanako = characterById('hanako');
  const { done, total } = row.progress;
  const counting = !row.done && total > 1;

  return (
    <li className={`qst-obj${row.done ? ' done' : ''}`} data-obj={row.id} data-done={row.done ? '1' : '0'}>
      <span className="qst-tick" aria-hidden="true">
        {row.done && <Icon name="check" size={16} />}
      </span>
      <div className="qst-obj-body">
        <strong dir="auto">{row.text[lang]}</strong>
        <span className="qst-sr">{row.done ? t('common.done') : ''}</span>
        {counting && (
          <span className="qst-prog">
            <span className="qst-bar" aria-hidden="true">
              <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </span>
            <bdi dir="ltr" className="qst-count">
              {done}/{total}
            </bdi>
          </span>
        )}
        {!row.done && row.hint && (
          <small className="muted" dir="auto">
            {row.hint[lang]}
          </small>
        )}
        {!row.done && row.easier === 'accepted' && <span className="pill qst-eased">{t('quests.easierOn')}</span>}
        {!row.done && row.easier === 'offered' && onEasier && (
          <div className="qst-easier">
            {hanako && <Portrait spec={hanako.avatar} size={36} />}
            <span dir="auto">
              <Ltr text={t('quests.easierSay')} />
            </span>
            <button className="btn soft sm" data-easier={row.id} onClick={() => onEasier(row.id)}>
              {t('quests.easier')}
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
