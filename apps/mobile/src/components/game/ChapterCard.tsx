import type { ChapterDef, ChapterStatus } from '@lw/game';
import type { ReactNode } from 'react';
import { useT } from '../../hooks';
import { Icon } from '../Icon';
import { Ltr } from './WalletPill';

/** The Story tab's chapter header (§7.5): title in Japanese and the UI language, "2 of 4 goals", the reward; the objective rows are its children. */
export function ChapterCard({ def, status, children }: { def: ChapterDef; status: ChapterStatus; children?: ReactNode }) {
  const { t, lang } = useT();
  const fraction = status.total > 0 ? status.done / status.total : 0;
  return (
    <section className="card qst-chapter" data-chapter={def.n}>
      <header className="qst-chapter-head">
        <span className="qst-chapter-n">
          <Ltr text={t('quests.chapter', { n: def.n })} />
        </span>
        <h2 lang="ja" className="qst-chapter-ja">
          {def.title.ja}
        </h2>
        <p dir="auto">{def.title[lang]}</p>
      </header>
      <div className="qst-prog wide">
        <span className="qst-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(fraction * 100)}%` }} />
        </span>
        <span className="qst-count">
          <Ltr text={t('quests.goals', { done: status.done, total: status.total })} />
        </span>
      </div>
      {children}
      <p className="qst-reward muted small">
        <Icon name="coin" size={14} /> <Ltr text={t('quests.reward', { n: def.reward.toLocaleString('en-US') })} />
      </p>
    </section>
  );
}

/** A later chapter, teased by name behind a padlock ("Opens in Chapter 3"). */
export function ChapterTeaser({ def }: { def: ChapterDef }) {
  const { t, lang } = useT();
  return (
    <li className="qst-teaser" data-chapter={def.n}>
      <Icon name="lock" size={16} />
      <span className="qst-teaser-text">
        <strong lang="ja">{def.title.ja}</strong>
        <small dir="auto">{def.title[lang]}</small>
      </span>
      <small className="muted">
        <Ltr text={t('quests.locked', { n: def.n })} />
      </small>
    </li>
  );
}
