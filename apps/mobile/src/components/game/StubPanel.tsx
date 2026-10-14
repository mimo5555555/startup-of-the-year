import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { useStore } from '../../store';
import { useT } from '../../hooks';

/** The shell of the full-screen panels (a title and a back button over a scrolling body). The Culture screen is built on it; no screen is a placeholder any more. */
export function StubPanel({ title, children }: { title: string; children?: ReactNode }) {
  const { t, dir } = useT();
  const go = useStore((s) => s.go);
  return (
    <div className="panel" dir={dir}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{title}</h1>
        <span />
      </header>
      <div className="panel-body">{children}</div>
    </div>
  );
}
