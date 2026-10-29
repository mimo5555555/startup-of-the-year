// The Kyoto Journey on the street side (Goen stage 1, docs/GOEN.md "The Kyoto Journey"): Sato's "Kyoto trip" row charges the Shinkansen round
// trip in yen ONCE, up front (`fare` place 'kyoto', legs 2; short of money nothing is charged and a toast says what it costs), then this panel
// covers the street: the Shinkansen window for two seconds, a small map of Kyoto with the ryokan, the temple and the matcha café (each one goes
// Prepare -> Conversation over its CSS backdrop and comes back here), the journey's objectives, and "Back to Sakura-chō" (`trip_done kyoto`).
import { useEffect } from 'react';
import { goenOwns, journeyView, type ObjectiveRow as ObjectiveData } from '@lw/game';
import { useT } from '../../hooks';
import { translate } from '../../i18n';
import { dispatch, openScreen } from '../../game/bridge';
import { getGame } from '../../game/gameStore';
import { useGameState, useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { KYOTO, KYOTO_STOPS, inKyoto, kyotoQuote, type KyotoPlace } from '../../game/goenLogic';
import { useKyoto } from '../../game/goenStore';
import { blip } from '../../services';
import { useStore } from '../../store';
import { Icon } from '../Icon';
import { KyotoBackdrop } from './KyotoBackdrop';
import { ObjectiveRow } from './ObjectiveRow';
import { Ltr } from './WalletPill';

// the amount stays left-to-right inside an Arabic sentence
const fmt = (n: number) => `⁦¥${n.toLocaleString('en-US')}⁩`;

/**
 * Sato's row: off to Kyoto. Charges the round trip once (a second tap, or a reload in Kyoto, never charges again); false when the player cannot
 * pay it (nothing is charged, the toast says the fare and what they have).
 */
export function beginKyoto(now: number = Date.now()): boolean {
  const st = useStore.getState();
  const g = getGame();
  if (!goenOwns(g, KYOTO.item)) return false;
  const k = useKyoto.getState();
  if (inKyoto(g, k.away)) return true;
  const q = kyotoQuote(PACK, g);
  if (!q.method) {
    // cash pays the paper fare and the card the IC fare: the sum of both pockets is never quoted as "what you have"
    const vars = { fare: fmt(q.paperTotal), icFare: fmt(q.icTotal), have: fmt(g.wallet.cash), ic: fmt(g.wallet.ic) };
    st.say(translate(st.uiLang, g.wallet.ic > 0 ? 'gn.kyoto.shortIc' : 'gn.kyoto.short', vars), 'info');
    return false;
  }
  const id = `trip:kyoto:${now.toString(36)}`;
  dispatch({ t: 'fare', id, place: KYOTO.place, method: q.method, legs: 2 });
  if (!inKyoto(getGame(), id)) return false;
  k.setAway(id);
  k.setRide(true);
  blip('good', st.settings.autoSpeak);
  st.say(translate(st.uiLang, 'gn.kyoto.paid', { fare: fmt(q.total) }), 'good');
  return true;
}

/** "Back to Sakura-chō": the ride back is filed (`trip_done kyoto`, the visit `trip:kyoto`) and the street is back, at the station. */
export function returnFromKyoto(): void {
  dispatch({ t: 'trip_done', id: KYOTO.place });
  useKyoto.getState().setAway(null);
  const world = (window as unknown as { __world?: { teleportNear(id: string): void } }).__world;
  world?.teleportNear('sato');
}

/** The journey's objectives as Story-tab rows (the Quests screen while the Journey is owned, and the Kyoto map). */
export function journeyRows(view: NonNullable<ReturnType<typeof journeyView>>): ObjectiveData[] {
  return view.rows.map((r) => ({ id: r.objective.id, text: r.objective.text, ...(r.objective.hint ? { hint: r.objective.hint } : {}), done: r.done, progress: r.progress, easier: 'none' }));
}

/** The Journey's card: its name, the objectives with progress, and the reward once complete. Nothing while it is not owned. */
export function JourneyCard({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useT();
  const state = useGameState();
  const view = useGameView();
  const jv = journeyView(PACK, state, view, KYOTO.journey);
  if (!jv || !jv.owned) return null;
  return (
    <section className={`card gn-journey${compact ? ' compact' : ''}`} data-journey={jv.def.id} data-complete={jv.complete ? 1 : 0}>
      <header>
        <Icon name="train" size={20} />
        <strong dir="auto">{jv.def.name[lang]}</strong>
        <span className="gn-ja" lang="ja">
          {jv.def.name.ja}
        </span>
      </header>
      <ul className="qst-list">
        {journeyRows(jv).map((row) => (
          <ObjectiveRow key={row.id} row={row} />
        ))}
      </ul>
      {jv.complete && (
        <p className="gn-journey-done" data-journey-done dir="auto">
          <Icon name="trophy" size={16} /> <strong>{t('gn.kyoto.done')}</strong>{' '}
          <Ltr text={t('gn.season.reward.goen', { n: jv.def.reward.goen })} />
        </p>
      )}
    </section>
  );
}

/** Whether a stop was played on this Journey (its conversation finished at least once). */
const played = (scenarioId: string): boolean => (getGame().runs[scenarioId]?.count ?? 0) > 0;

/** The Kyoto map over the street while the Journey is under way. */
export function KyotoPanel() {
  const { t, dir } = useT();
  // re-rendered on every game change: the ticks of the stops
  useGameState();
  const ride = useKyoto((s) => s.ride);
  const setRide = useKyoto((s) => s.setRide);
  useEffect(() => {
    if (!ride) return;
    const id = setTimeout(() => setRide(false), 2700);
    return () => clearTimeout(id);
  }, [ride, setRide]);
  const go = (place: KyotoPlace) => {
    const stop = KYOTO_STOPS.find((s) => s.place === place)!;
    openScreen('prepare', { scenarioId: stop.scenarioId, characterId: stop.characterId });
  };
  return (
    <div className="kyo-panel" dir={dir} data-kyoto-map role="dialog" aria-label={t('gn.kyoto.title')}>
      <KyotoBackdrop place="temple" still ride={ride} />
      <div className="kyo-sheet glass-card">
        <header className="kyo-head">
          <h2>
            {t('gn.kyoto.title')} <span lang="ja">京都</span>
          </h2>
          <small dir="auto">{t('gn.kyoto.pick')}</small>
        </header>
        <div className="kyo-map" dir="ltr" aria-label={t('gn.kyoto.pick')}>
          <i className="kyo-river" aria-hidden="true" />
          <i className="kyo-hill" aria-hidden="true" />
          <span className="kyo-station" aria-hidden="true">
            <Icon name="train" size={14} /> <span lang="ja">京都駅</span>
          </span>
          {KYOTO_STOPS.map((s) => {
            const done = played(s.scenarioId);
            return (
              <button
                key={s.place}
                type="button"
                className={`kyo-pin${done ? ' done' : ''}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                data-kyoto-stop={s.place}
                data-done={done ? 1 : 0}
                onClick={() => go(s.place)}
              >
                <span className="kyo-pin-dot" aria-hidden="true">
                  {done ? <Icon name="check" size={14} stroke={3} /> : <Icon name="pin" size={14} />}
                </span>
                <span className="kyo-pin-name" dir="auto">
                  {t(`gn.kyoto.place.${s.place}` as const)}
                </span>
              </button>
            );
          })}
        </div>
        <JourneyCard compact />
        <button type="button" className="btn soft wide kyo-back" data-kyoto-back onClick={returnFromKyoto}>
          <Icon name="train" size={18} /> {t('gn.kyoto.back')}
        </button>
      </div>
    </div>
  );
}
