import { useState } from 'react';
import { BALANCE } from '@lw/game';
import type { Character } from '@lw/content';
import { displayName } from '../../content';
import { openerLine, runnableThreads, type ThreadRow } from '../../game/phoneLogic';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { useUi } from '../../ui';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Portrait } from '../Portrait';
import { HeartBar } from './HeartBar';

/**
 * One friend's thread (§8.7): who they are, and the messages that wait for a reply as incoming bubbles, each with a Reply button that
 * opens the text conversation. Nothing waiting says so in words (a friend sends one message a day and there is no hurry); a friend
 * below the heart where messages start says which heart that is. There is no history to scroll: a finished thread has done its job.
 */
export function Thread({ who, row, flags, onReply }: { who: Character; row: ThreadRow; flags: Record<string, boolean>; onReply(template: string): void }) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const autoTranslate = useStore((s) => s.settings.autoTranslate);
  const openWord = useUi((s) => s.openWord);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const name = displayName(who, lang);
  const threads = row.open ? runnableThreads(row) : [];

  return (
    <section className="ph-thread" data-thread-friend={row.friendId} data-waiting={threads.length}>
      <div className="ph-contact">
        <Portrait spec={who.avatar} size={52} />
        <div className="ph-contact-text">
          <strong>{name}</strong>
          <small dir="auto">{who.job[lang]}</small>
          <HeartBar hearts={row.hearts} ap={0} floor={0} next={null} compact />
        </div>
      </div>

      {!row.open && (
        <p className="ph-note" data-thread-locked>
          {t('phone.threadLocked', { n: BALANCE.ap.chat.minHeart, name })}
        </p>
      )}
      {row.open && threads.length === 0 && (
        <p className="ph-note" data-thread-empty>
          {t('phone.threadEmpty', { name })}
        </p>
      )}

      {threads.map((th) => {
        const opener = openerLine(th.template, flags);
        if (!opener) return null;
        const open = autoTranslate || shown.has(th.template);
        return (
          <article className="ph-incoming" key={th.template} data-thread={th.template}>
            <div className="ph-bubble">
              <JaText tokens={opener.tokens} furigana={furigana} romaji={romaji} size="lg" onTap={(token) => openWord({ token, source: 'conversation' })} />
              {open && (
                <div className="tr" dir="auto">
                  {lang === 'ar' ? opener.line.ar : opener.line.en}
                </div>
              )}
              <div className="ph-bubble-tools">
                <button
                  className={`mini${open ? ' on' : ''}`}
                  aria-label={t('c.translate')}
                  aria-pressed={open}
                  onClick={() =>
                    setShown((s) => {
                      const n = new Set(s);
                      if (n.has(th.template)) n.delete(th.template);
                      else n.add(th.template);
                      return n;
                    })
                  }
                >
                  <Icon name="language" size={15} />
                </button>
              </div>
            </div>
            <button className="btn primary ph-reply" data-act="reply" onClick={() => onReply(th.template)}>
              <Icon name="send" size={18} /> {t('phone.reply')}
            </button>
          </article>
        );
      })}
      {threads.length > 0 && <p className="ph-hint muted small">{t('phone.threadHint')}</p>}
    </section>
  );
}
