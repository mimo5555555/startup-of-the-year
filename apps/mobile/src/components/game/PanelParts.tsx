import { useEffect, type ReactNode } from 'react';
import { speakableText, type Token } from '@lw/content';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { useStore } from '../../store';
import { useT } from '../../hooks';
import { speakJa } from '../../services';
import { priceTokens, yen } from './panelLogic';

/** Japanese for the label or price of a machine, with the player's furigana and romaji settings. */
export function JaLabel({ tokens, size = 'md' }: { tokens: Token[]; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const settings = useStore((s) => s.settings);
  return <JaText tokens={tokens} furigana={settings.furigana} romaji={settings.romaji} size={size} />;
}

/** The speaker of a machine label: reads the Japanese aloud (slowly), whether or not auto-speak is on. */
export function SpeakButton({ tokens, label }: { tokens: Token[]; label: string }) {
  return (
    <button type="button" className="icon-btn ghost pn-speak" aria-label={label} onClick={() => speakJa(speakableText(tokens), { rate: 0.8 })}>
      <Icon name="volume" size={20} />
    </button>
  );
}

/** A price: the Japanese reading of the yen (百五十円) beside the figure, which stays left-to-right inside an Arabic layout. */
export function PriceTag({ amount, size = 'sm' }: { amount: number; size?: 'sm' | 'md' }) {
  return (
    <span className="pn-price">
      <JaLabel tokens={priceTokens(amount)} size={size} />
      <strong className="pn-num" dir="ltr">
        {yen(amount)}
      </strong>
    </span>
  );
}

export interface TileProps {
  tokens: Token[];
  gloss: string;
  price: number;
  on: boolean;
  onSelect(): void;
  /** the temperature bars under the name (vending: red for hot, blue for cold) */
  temps?: Array<'hot' | 'cold'>;
  size?: 'md' | 'lg';
  /** a data attribute for the e2e scripts */
  id: string;
}

/**
 * One button of a machine: the Japanese name big, its meaning, its price, and a speaker. The card is not itself a button (the speaker
 * is one, and a button cannot hold a button): the name, meaning and price are the choose button and the footer holds the speaker.
 */
export function Tile({ tokens, gloss, price, on, onSelect, temps, size = 'lg', id }: TileProps) {
  const { t } = useT();
  return (
    <li className={`pn-tile${on ? ' on' : ''}`} data-id={id}>
      <button type="button" className="pn-tile-main" aria-pressed={on} onClick={onSelect}>
        <JaLabel tokens={tokens} size={size} />
        <span className="pn-gloss">{gloss}</span>
        <PriceTag amount={price} />
      </button>
      <div className="pn-tile-foot">
        <span className="pn-temps" aria-hidden="true">
          {temps?.map((tp) => <i key={tp} className={tp} />)}
        </span>
        <SpeakButton tokens={tokens} label={`${t('panel.listen')}: ${gloss}`} />
      </div>
    </li>
  );
}

/** The yen the player holds, as the machine would show them: the wallet, and the card when there is one. */
export function WalletStrip({ cash, ic, hasIc }: { cash: number; ic: number; hasIc: boolean }) {
  const { t } = useT();
  return (
    <div className="pn-wallet" aria-label={t('hud.wallet')}>
      <span>
        <Icon name="wallet" size={18} /> {t('panel.cash')}{' '}
        <strong className="pn-num" dir="ltr">
          {yen(cash)}
        </strong>
      </span>
      {hasIc && (
        <span>
          <Icon name="card" size={18} /> {t('hud.ic')}{' '}
          <strong className="pn-num" dir="ltr">
            {yen(ic)}
          </strong>
        </span>
      )}
    </div>
  );
}

export interface PanelShellProps {
  kind: string;
  /** the Japanese name of the machine (自動販売機, 券売機) */
  ja: Token[];
  title: string;
  onClose(): void;
  children: ReactNode;
}

/**
 * The frame every machine panel shares: the scrim over the world, a bottom sheet with the machine's name in Japanese and in the UI
 * language, and a Close button that is always there. Escape and a tap on the scrim close it too.
 */
export function PanelShell({ kind, ja, title, onClose, children }: PanelShellProps) {
  const { t, dir } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="scrim pn-scrim" role="dialog" aria-modal="true" aria-label={title} data-kind={kind} data-panel={kind} onClick={onClose}>
      <div className="word-sheet pn-sheet" dir={dir} onClick={(e) => e.stopPropagation()}>
        <header className="pn-head">
          <div className="pn-title">
            <JaLabel tokens={ja} size="lg" />
            <h2>{title}</h2>
          </div>
          <SpeakButton tokens={ja} label={t('panel.listen')} />
          <button type="button" className="icon-btn ghost" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="x" size={22} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
