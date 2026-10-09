// Culture cards (docs/GAME_DESIGN.md §10): the card face, the hidden-line Say it of a `say:true` card, and the pop-up that shows a card the
// moment it unlocks outside a debrief (the debrief shows its own cards and clears `useUi.culture`; the pop-up waits for the world).
import { useEffect, useMemo, useState } from 'react';
import { fillGloss, type Vars } from '@lw/content';
import { BALANCE, echoPassMark, type CultureCard as Card } from '@lw/game';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { SayIt } from './SayIt';
import { Ltr } from './WalletPill';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { useUi } from '../../ui';
import { speakJa } from '../../services';
import { dispatch } from '../../game/bridge';
import { useGameState, useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { plainOf } from '../../game/prepareLogic';
import { cardState, phraseParts, phraseTokens, sayTarget, setCultureFocus } from '../../game/cultureLogic';

/** Wraps a player-supplied name so a Latin name inside Arabic text keeps its place. */
const isolate = (s: string) => `⁨${s}⁩`;

/** The player's name for `{name}` in a phrase: katakana for the Japanese, as typed for the glosses. */
function useNames() {
  const game = useGameState();
  const profile = useStore((s) => s.profile);
  return { kana: game.me.nameKana || profile?.name || '', typed: profile?.name || game.me.nameKana || '' };
}

/** A card's phrase, its meaning and its text. */
export function CultureFace({ card, size = 'lg' }: { card: Card; size?: 'lg' | 'xl' }) {
  const { lang } = useT();
  const settings = useStore((s) => s.settings);
  const { kana, typed } = useNames();
  const parts = useMemo(() => phraseTokens(card, kana), [card, kana]);
  const vars: Vars = { name: { ja: isolate(typed), raw: true } };
  const meaning = fillGloss(card.phrase[lang], vars, lang);
  return (
    <div className="cul-face">
      <div className="cul-phrase">
        {parts.map((tokens, i) => (
          <span key={i} className="cul-part">
            {i > 0 && <span className="cul-slash" aria-hidden="true">/</span>}
            <JaText tokens={tokens} furigana={settings.furigana} romaji={settings.romaji} size={size} />
          </span>
        ))}
        <button
          type="button"
          className="cul-speak"
          aria-label={lang === 'ar' ? 'استمع' : 'Listen'}
          onClick={() => speakJa(phraseParts(card.phrase.ja).map((p) => plainOf(p.replace(/\{name\}/g, kana))).join('。'), { rate: 0.9 })}
        >
          <Icon name="volume" size={20} />
        </button>
      </div>
      <p className="cul-meaning" dir="auto">
        {meaning}
      </p>
      <p className="cul-text" dir="auto">
        {card.text[lang]}
      </p>
    </div>
  );
}

/** The Say it of a `say:true` card: hidden line, mic / type / tiles; a pass dispatches `culture_say` (objective `culture_said` + an SRS card). */
export function CultureSay({ card }: { card: Card }) {
  const { t } = useT();
  const game = useGameState();
  const view = useGameView();
  const [passed, setPassed] = useState(false);
  const said = cardState(card, game) === 'said';
  const target = sayTarget(card);
  const idx = phraseParts(card.phrase.ja).indexOf(target);
  const part = (s: string) => s.split(/\s+[/／]\s+/)[idx] ?? s;
  if (said && !passed) {
    return (
      <div className="cul-say done" data-said>
        <p className="cul-sayDone" dir="auto">
          <Icon name="check" size={18} stroke={3} /> {t('culture.sayDone')}
        </p>
      </div>
    );
  }
  return (
    <div className="cul-say" data-say={card.id}>
      <h3>{t('culture.sayTitle')}</h3>
      {!passed && (
        <p className="muted small" dir="auto">
          {t('culture.sayHint')}
        </p>
      )}
      <SayIt
        ja={target}
        meaning={{ en: part(card.phrase.en), ar: part(card.phrase.ar) }}
        mark={echoPassMark(PACK, view)}
        peekLabel={t('prep.peek.echo')}
        onPass={(similarity) => {
          setPassed(true);
          dispatch({ t: 'culture_say', id: card.id, similarity });
        }}
        onPeek={() => undefined}
      />
      {passed && (
        <p className="cul-sayDone" dir="auto" role="status">
          <Icon name="check" size={18} stroke={3} /> {t('culture.sayDone')}
        </p>
      )}
    </div>
  );
}

/**
 * The pop-up for a card that unlocked outside a debrief (a vending drink, a ride, a chapter reward...). Cards queue up; it shows only
 * over the world, never over a conversation or its debrief (the debrief closes `useUi.culture` itself and its own cards drop out here).
 */
export function CultureCardHost() {
  const { t } = useT();
  const go = useStore((s) => s.go);
  const screen = useStore((s) => s.screen);
  const convo = useUi((s) => s.convo);
  const closeCulture = useUi((s) => s.closeCulture);
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(
    () =>
      useUi.subscribe((s, prev) => {
        if (s.culture && s.culture !== prev.culture) setQueue((q) => (q.includes(s.culture!) ? q : [...q, s.culture!]));
        // the debrief shows its own cards and clears the request: nothing of this conversation is left to pop up
        else if (!s.culture && prev.culture && s.convo) setQueue([]);
      }),
    [],
  );

  const id = queue[0];
  const card = id ? PACK.culture.find((c) => c.id === id) : undefined;
  // an id the pack does not define is dropped (an empty pop-up would be a dead end)
  useEffect(() => {
    if (id && !card) setQueue((q) => q.slice(1));
  }, [id, card]);
  if (!card || screen !== 'world' || convo) return null;

  const next = () => {
    setQueue((q) => q.slice(1));
    closeCulture();
  };
  const openBook = (focus: boolean) => {
    setCultureFocus(focus ? card.id : null);
    setQueue([]);
    closeCulture();
    go('culture');
  };
  return (
    <div className="scrim center cul-scrim" role="dialog" aria-modal="true" aria-label={t('culture.new')}>
      <div className="modal cul-pop" data-culture-pop={card.id}>
        <div className="cul-pop-head">
          <small className="tag assisted">
            <Icon name="sparkle" size={12} /> {t('culture.new')}
          </small>
          <small className="tag cul-xp">
            <Ltr text={t('culture.xp', { n: BALANCE.cultureXp })} />
          </small>
        </div>
        <CultureFace card={card} />
        {queue.length > 1 && (
          <small className="muted" dir="auto">
            <Ltr text={t('culture.more', { n: queue.length - 1 })} />
          </small>
        )}
        <div className="cul-pop-actions">
          {card.say && (
            <button type="button" className="btn soft cul-btn" onClick={() => openBook(true)}>
              <Icon name="mic" size={18} /> {t('culture.sayTag')}
            </button>
          )}
          <button type="button" className="btn soft cul-btn" onClick={() => openBook(false)}>
            <Icon name="book" size={18} /> {t('culture.open')}
          </button>
          <button type="button" className="btn primary cul-btn" onClick={next}>
            {t('culture.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}

