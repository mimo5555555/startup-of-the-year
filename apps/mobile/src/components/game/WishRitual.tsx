// The wish ritual at the shrine (docs/GOEN.md "Spending"): a sheet over the 3D shrine, so the avatar's bows and claps are seen
// (`world.shrineRitual`). 1. toss the coin: the Goen is spent and the item is yours at once (`goen_spend`); 2. 二礼二拍手一礼 as five taps in
// order (a wrong one gets Hanako's gentle hint, never a penalty); 3. the wish in Japanese: the shrine_wish conversation through the normal
// Conversation path (one model chip; typed or spoken); 4. a short celebration with what to do with the new thing.
import { useEffect } from 'react';
import { canSpend } from '@lw/game';
import { useT, useWorld } from '../../hooks';
import { dispatch, startConversation } from '../../game/bridge';
import { useGameState, useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { RITUAL_ORDER, nextStepOf, ritualTap, type RitualTap } from '../../game/goenLogic';
import { useShrine } from '../../game/goenStore';
import { beginOwn } from '../../game/ownStore';
import { blip, haptic, speakJa } from '../../services';
import { useStore } from '../../store';
import { characterById } from '../../content';
import { Icon } from '../Icon';
import { Portrait } from '../Portrait';
import { Ltr } from './WalletPill';
import { openSeason } from '../../screens/Season';

/** The shrine_wish conversation: Hanako walks the player through the wish (handoff-game.md). */
export const WISH_SCENARIO = 'shrine_wish';
export const WISH_HOST = 'hanako';

const GLYPH: Record<RitualTap, string> = { bow: '礼', clap: '拍' };

/** Plays one step of the ritual on the 3D shrine (nothing when the world has no shrine, a room is on, or WebGL failed). */
function play(world: ReturnType<typeof useWorld>, step: 'coin' | 'bow' | 'clap' | 'bell' | 'done'): void {
  try {
    (world as unknown as { shrineRitual?: (s: string) => boolean } | null)?.shrineRitual?.(step);
  } catch {
    /* the ceremony works without the animation */
  }
}

export function WishRitual() {
  const { t, lang, dir } = useT();
  const world = useWorld();
  const ritual = useShrine((s) => s.ritual);
  const patch = useShrine((s) => s.patch);
  const end = useShrine((s) => s.end);
  const state = useGameState();
  const view = useGameView();
  const say = useStore((s) => s.say);
  const go = useStore((s) => s.go);
  const item = ritual ? PACK.goen?.catalog.find((c) => c.id === ritual.itemId) : undefined;
  const step = ritual?.step;

  // the celebration's shimmer over the hall
  useEffect(() => {
    if (step === 'done') play(world, 'done');
  }, [step, world]);

  if (!ritual || !item) return null;
  const name = item.name[lang];
  const owned = !!state.goen?.owned[item.id];

  const toss = () => {
    // the item is already yours (a reload or a second visit): the ceremony goes on without a second coin
    if (owned && item.kind !== 'charm') {
      patch({ step: 'taps' });
      return;
    }
    const can = canSpend(PACK, state, view, item.id, Date.now());
    if (!can.ok) {
      say(t('gn.ritual.short'), 'info');
      return;
    }
    const r = dispatch({ t: 'goen_spend', itemId: item.id, id: ritual.spendId });
    if (!r.derived.some((d) => d.t === 'goen_owned')) {
      say(t('gn.ritual.short'), 'info');
      return;
    }
    play(world, 'coin');
    blip('good', useStore.getState().settings.autoSpeak);
    haptic(14);
    // the bell rope after the coin, then the bows and claps
    setTimeout(() => play(world, 'bell'), 900);
    patch({ step: 'taps', done: 0, hint: null });
  };

  const tap = (what: RitualTap) => {
    const r = ritualTap(ritual.done, what);
    if (!r.ok) {
      patch({ hint: r.next });
      blip('tap', useStore.getState().settings.autoSpeak);
      return;
    }
    play(world, what);
    haptic(10);
    patch({ done: r.done, hint: null, step: r.done >= RITUAL_ORDER.length ? 'wish' : 'taps' });
  };

  const wish = () => {
    patch({ step: 'wish' });
    // the one model line is the item's wish (the scenario reads the request's item); typed or spoken, pay none
    startConversation({ scenarioId: WISH_SCENARIO, characterId: WISH_HOST, itemId: item.id });
  };

  const next = nextStepOf(PACK, item.itemId ?? item.id);
  const openNext = () => {
    end();
    if (next.open === 'wallet') go('wallet');
    else if (next.open === 'season') openSeason('world');
    else if (next.open === 'room') beginOwn();
  };
  const hanako = characterById(WISH_HOST);

  return (
    <section className="gn-ritual glass-card" dir={dir} role="dialog" aria-label={t('gn.ritual.title', { item: name })} data-ritual={item.id} data-step={ritual.step}>
      <header className="gn-ritual-head">
        <h2 dir="auto">{t('gn.ritual.title', { item: name })}</h2>
        {ritual.step !== 'done' && (
          <button type="button" className="btn soft gn-ritual-later" data-ritual-later onClick={end}>
            {t('gn.ritual.later')}
          </button>
        )}
      </header>

      {ritual.step === 'coin' && (
        <button type="button" className="btn primary wide gn-coin-btn" data-ritual-coin onClick={toss}>
          <span className="gn-coin" aria-hidden="true">
            <i />
          </span>
          <span>
            <strong>{t('gn.ritual.coin')}</strong>
            <small dir="auto">
              <Ltr text={t('gn.ritual.coinSub', { n: owned && item.kind !== 'charm' ? 0 : item.price })} />
            </small>
          </span>
        </button>
      )}

      {ritual.step === 'taps' && (
        <>
          <p className="gn-ritual-order" dir="auto">
            {t('gn.ritual.order')}
          </p>
          <ol className="gn-ritual-steps" dir="ltr" aria-label={t('gn.ritual.order')}>
            {RITUAL_ORDER.map((s, i) => (
              <li key={i} className={i < ritual.done ? 'on' : i === ritual.done ? 'now' : ''} lang="ja">
                {GLYPH[s]}
              </li>
            ))}
          </ol>
          {ritual.hint && (
            <div className="gn-hint" role="status" data-ritual-hint={ritual.hint}>
              {hanako && <Portrait spec={hanako.avatar} size={40} />}
              <p dir="auto">{t('gn.ritual.hint', { next: t(`gn.ritual.next.${ritual.hint}` as const) })}</p>
            </div>
          )}
          <div className="gn-ritual-taps">
            {(['bow', 'clap'] as const).map((k) => (
              <button key={k} type="button" className="btn soft gn-tap" data-ritual-tap={k} onClick={() => tap(k)}>
                <span className="gn-tap-ja" lang="ja" aria-hidden="true">
                  {k === 'bow' ? '礼' : '拍手'}
                </span>
                {t(k === 'bow' ? 'gn.ritual.bow' : 'gn.ritual.clap')}
              </button>
            ))}
          </div>
        </>
      )}

      {ritual.step === 'wish' && (
        <>
          <p className="gn-ritual-order" dir="auto">
            <strong>{t('gn.ritual.wish')}</strong> {t('gn.ritual.wishSub')}
          </p>
          <button type="button" className="gn-wish-line" lang="ja" dir="ltr" onClick={() => speakJa(item.wish.ja.replace(/\|/g, ''), { rate: 0.85 })}>
            <Icon name="volume" size={16} /> {item.wish.ja.replace(/\|/g, '')}
          </button>
          <button type="button" className="btn primary wide" data-ritual-wish onClick={wish}>
            <Icon name="mic" size={18} /> {t('gn.ritual.wishGo')}
          </button>
        </>
      )}

      {ritual.step === 'done' && (
        <div className="gn-done" data-ritual-done>
          <span className="gn-done-burst" aria-hidden="true">
            <Icon name="torii" size={30} />
          </span>
          <strong dir="auto">{t('gn.ritual.done')}</strong>
          <p dir="auto">{t('gn.ritual.unlocked', { item: name })}</p>
          <p className="muted small" dir="auto">
            {t(next.key)}
          </p>
          <div className="gn-done-row">
            {next.open && next.open !== 'station' && (
              <button type="button" className="btn soft" data-ritual-next={next.open} onClick={openNext}>
                {t('gn.next.open')}
              </button>
            )}
            <button type="button" className="btn primary" data-ritual-close onClick={end}>
              {t('gn.ritual.close')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** Shrine panel -> "Make a wish": back to the 3D shrine with the ritual sheet up (the world puts the player at the box). */
export function beginWish(itemId: string): void {
  useShrine.getState().start(itemId, `wish:${itemId}:${Date.now().toString(36)}`);
  useStore.getState().go('world');
}
