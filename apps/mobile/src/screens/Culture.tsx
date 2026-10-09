import { useState } from 'react';
import { StubPanel } from '../components/game/StubPanel';
import { CultureFace, CultureSay } from '../components/game/CultureCard';
import { Ltr } from '../components/game/WalletPill';
import { Icon } from '../components/Icon';
import { useGameState } from '../game/hooks';
import { PACK } from '../game/pack';
import { bookCounts, cardState, shownCards, takeCultureFocus } from '../game/cultureLogic';
import { useT } from '../hooks';
import { useStore } from '../store';
import type { StringKey } from '../i18n';

/**
 * The stamp book (docs/GAME_DESIGN.md §10): a grid of the culture cards. A collected card is a stamp with its key phrase; a card not found yet
 * is a silhouette with a hint on how to find it. A card opens to its text and, for `say:true` cards, the Say it. Cards that cannot be earned in
 * this release are not listed (see `DEFERRED_CARDS`).
 */
export function Culture() {
  const { t, lang } = useT();
  const game = useGameState();
  const age = useStore((s) => s.profile?.age);
  const [open, setOpen] = useState<string | null>(() => takeCultureFocus());
  const cards = shownCards(PACK, game, age);
  const counts = bookCounts(PACK, game, age);
  const card = open ? cards.find((c) => c.id === open && game.culture[c.id] !== undefined) : undefined;

  if (card) {
    return (
      <StubPanel title={t('quests.tab.culture')}>
        <div className="cul-detail" data-culture-detail={card.id}>
          <button type="button" className="prep-link cul-back" onClick={() => setOpen(null)}>
            <Icon name="chevL" size={16} /> {t('culture.back')}
          </button>
          <section className="card cul-card">
            <small className="tag assisted">
              <Icon name="sparkle" size={12} /> {t('culture.card')}
            </small>
            <CultureFace card={card} size="xl" />
          </section>
          {card.say && (
            <section className="card cul-card">
              <CultureSay key={card.id} card={card} />
            </section>
          )}
        </div>
      </StubPanel>
    );
  }

  return (
    <StubPanel title={t('quests.tab.culture')}>
      <div className="cul-book" data-culture-book>
        <div className="card cul-head">
          <p className="cul-count" data-culture-count>
            <Ltr text={t('culture.progress', { n: counts.have, total: counts.total })} />
          </p>
          <p className="cul-count sub" data-culture-said>
            <Ltr text={t('culture.said', { n: counts.said, total: counts.sayable })} />
          </p>
          <p className="muted small" dir="auto" {...(counts.have === 0 ? { 'data-culture-empty': true } : {})}>
            {counts.have === 0 ? t('culture.empty') : t('culture.intro')}
          </p>
        </div>
        <ul className="cul-grid">
          {cards.map((c) => {
            const state = cardState(c, game);
            const hint = t(`culture.hint.${c.id.slice(3)}` as StringKey);
            return (
              <li key={c.id}>
                {state === 'locked' ? (
                  <div className="cul-stamp locked" data-card={c.id} data-state="locked">
                    <span className="cul-q" aria-hidden="true">?</span>
                    <b dir="auto">{t('culture.locked')}</b>
                    <small dir="auto">{hint}</small>
                  </div>
                ) : (
                  <button type="button" className={`cul-stamp ${state}`} data-card={c.id} data-state={state} onClick={() => setOpen(c.id)}>
                    <span className="cul-ja" lang="ja" dir="ltr">
                      {c.phrase.ja.replace(/\{name\}\|?/g, '').replace(/\|/g, '')}
                    </span>
                    <small dir="auto">{c.phrase[lang].replace('{name}', '…')}</small>
                    {c.say && (
                      <span className={`tag cul-tag ${state === 'said' ? 'good' : 'assisted'}`}>
                        <Icon name={state === 'said' ? 'check' : 'mic'} size={12} /> {t(state === 'said' ? 'culture.saidTag' : 'culture.sayTag')}
                      </span>
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </StubPanel>
  );
}
