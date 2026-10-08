import { useEffect, useMemo } from 'react';
import { kanaToRomaji } from '@lw/core';
import { yenToJa, type Token } from '@lw/content';
import { BALANCE, formatHours, ownedQty, workHours, type NameGloss } from '@lw/game';
import { useT } from '../../hooks';
import { shopById, PACK } from '../../game/pack';
import { goodsOf } from '../../game/worldSync';
import { useGameState } from '../../game/hooks';
import { useStore } from '../../store';
import { useUi } from '../../ui';
import { lineTokens } from '../../content';
import { speakJa } from '../../services';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Ltr, yen } from './WalletPill';

/** A word-card token for a good's name (the name carries its own reading, so it need not be in the lexicon). */
function nameToken(n: NameGloss): Token {
  return { s: n.ja, r: n.reading && n.reading !== n.ja ? n.reading : undefined, rom: kanaToRomaji(n.reading ?? n.ja), gloss: { en: n.en, ar: n.ar } };
}

/**
 * The Goods sheet (§6.1): the shelves of a shop, read only. Names in Japanese (tap for the word card), meaning, the price in yen and
 * in Japanese words (tap to hear it), and the lock state. In window mode (a shop that is not open yet) it says nothing is for sale.
 * You still have to ask for things in the conversation: this sheet teaches the nouns and the numerals.
 */
export function GoodsSheet({ shopId, window: peek = false, onClose }: { shopId: string; window?: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const game = useGameState();
  const age = useStore((s) => s.profile?.age ?? 'adults');
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const openWord = useUi((s) => s.openWord);
  const shop = shopById(shopId);
  const goods = useMemo(() => goodsOf(PACK, shopId), [shopId]);
  const floor = PACK.ageProfiles[age]?.ageFloor ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim hud-scrim" onClick={onClose}>
      <div className="word-sheet hud-sheet hud-goods" role="dialog" aria-modal="true" aria-label={peek ? t('shop.window') : t('shop.goods')} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn ghost word-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={20} />
        </button>
        <header className="hud-sheet-head">
          <span className="hud-opt-ic big">
            <Icon name={peek ? 'eye' : 'bag'} size={24} />
          </span>
          <div>
            <h2 dir="auto">{peek ? t('shop.window') : t('shop.goods')}</h2>
            <p dir="auto">{shop ? shop.name[lang] : ''}</p>
          </div>
        </header>
        {peek && <p className="hud-note" dir="auto">{t('hud.windowNote')}</p>}
        <ul className="hud-goods-list">
          {goods.length === 0 && <li className="hud-note" dir="auto">{t('hud.noGoods')}</li>}
          {goods.map((g) => {
            const locked = g.ch > game.chapter.n;
            const young = g.ageMin !== undefined && floor < g.ageMin;
            const owned = g.kind === 'item' && g.once && ownedQty(game, g.id) > 0;
            const hours = workHours(g.price, PACK.economy);
            const missing = Math.max(0, g.price - game.wallet.cash);
            const ja = g.price >= 1 ? yenToJa(g.price) : null;
            return (
              <li key={g.id} className={`hud-good${locked || young ? ' locked' : ''}`}>
                <div className="hud-good-main">
                  <JaText tokens={[nameToken(g.name)]} furigana={furigana} romaji={romaji} size="md" onTap={(tok) => openWord({ token: tok, source: 'sign' })} />
                  <span className="hud-good-mean" dir="auto">
                    {g.name[lang]}
                  </span>
                  <span className="hud-good-state" dir="auto">
                    {young ? (
                      t('shop.someday')
                    ) : locked ? (
                      <>
                        <Icon name="lock" size={13} /> {t('quests.locked', { n: g.ch })}
                      </>
                    ) : owned ? (
                      <>
                        <Icon name="check" size={13} /> {t('shop.owned')}
                      </>
                    ) : missing > 0 ? (
                      <Ltr text={t('hud.moreYen', { n: missing.toLocaleString('en-US') })} />
                    ) : null}
                  </span>
                </div>
                <div className="hud-good-price">
                  <span className="hud-price">
                    <bdi dir="ltr">{yen(g.price)}</bdi>
                  </span>
                  {g.price > BALANCE.workHoursChipMin && (
                    <span className="hud-hours">
                      <Ltr text={t('hud.workHours', { n: formatHours(hours) })} />
                    </span>
                  )}
                  {ja && (
                    <button className="hud-say" onClick={() => speakJa(ja.markup.replaceAll('|', ''), { rate: 0.8 })} aria-label={t('hud.sayPrice')}>
                      <Icon name="volume" size={16} />
                      <JaText tokens={lineTokens(ja.markup)} furigana={furigana} romaji={romaji} size="sm" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <small className="hud-tax">{t('shop.taxIncluded')}</small>
        <button className="btn soft wide" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
}
