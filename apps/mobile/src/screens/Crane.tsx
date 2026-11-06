// The crane game (ゲームセンター「ピコピコ」, docs/ROADMAP.md): opened by tapping a crane machine in the street. ◀ ▶ move the claw, つかむ！
// drops it; a prize under the claw may be caught (`craneDrop`), and `crane_play` uses one go and grants the prize. Goes are bought by talking
// to Shota (¥100 a go, in Japanese); with none left the screen says so and where to buy more.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { dispatch } from '../game/bridge';
import { clampClaw, CRANE_PRIZES, CRANE_STEP, craneDrop, useCrane, type CranePrize } from '../game/craneLogic';
import { useGame } from '../game/gameStore';
import { PACK } from '../game/pack';
import { useT } from '../hooks';
import { blip } from '../services';
import { useStore } from '../store';

type Phase = 'aim' | 'drop' | 'lift' | 'result';

function PrizeArt({ p, small = false }: { p: CranePrize; small?: boolean }) {
  return (
    <span className={`cr-prize cr-${p.kind}${small ? ' small' : ''}`} style={{ ['--body' as string]: p.body, ['--accent' as string]: p.accent }} aria-hidden="true">
      <i className="ear l" />
      <i className="ear r" />
      <i className="face" />
    </span>
  );
}

export function Crane() {
  const { t, dir, lang } = useT();
  const go = useStore((s) => s.go);
  const say = useStore((s) => s.say);
  const autoSpeak = useStore((s) => s.settings.autoSpeak);
  const plays = useGame((g) => g.arcade?.plays ?? 0);
  const won = useGame((g) => g.arcade?.won ?? 0);
  const assisted = useCrane((s) => s.assisted);
  const [claw, setClaw] = useState(0.5);
  const [phase, setPhase] = useState<Phase>('aim');
  const [caught, setCaught] = useState<{ prize: CranePrize | null; won: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
  // Shota's help lasts for the goes of that visit
  useEffect(() => {
    if (plays === 0 && phase === 'aim') useCrane.getState().setAssisted(false);
  }, [plays, phase]);

  const nameOf = (id: string) => {
    const item = PACK.items.find((i) => i.id === id);
    return item ? (lang === 'ar' ? item.name.ar : item.name.en) : id;
  };
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const move = (d: number) => {
    if (phase !== 'aim') return;
    setClaw((x) => clampClaw(x + d * CRANE_STEP));
    blip('tap', autoSpeak);
  };
  const drop = () => {
    if (phase !== 'aim' || plays < 1) return;
    const r = craneDrop(claw, assisted);
    setCaught(r);
    setPhase('drop');
    later(900, () => setPhase('lift'));
    later(1900, () => {
      dispatch({ t: 'crane_play', id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, won: r.won, ...(r.won && r.prize ? { prizeId: r.prize.id } : {}) });
      setPhase('result');
      blip(r.won ? 'level' : 'bad', autoSpeak);
      if (r.won && r.prize) say(t('cr.won', { name: nameOf(r.prize.id) }), 'good');
    });
  };
  const again = () => {
    setCaught(null);
    setPhase('aim');
  };

  const holding = caught?.won && caught.prize && (phase === 'lift' || phase === 'result');
  return (
    <div className="panel crane" dir={dir} data-screen="crane" data-phase={phase} data-plays={plays}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>
          {t('cr.title')}
          <small lang="ja">クレーンゲーム</small>
        </h1>
        <span className="cr-plays" dir="ltr" data-crane-plays>
          {t('cr.plays', { n: plays })}
        </span>
      </header>
      <div className="panel-body cr-body">
        {assisted && (
          <p className="cr-assist small" data-crane-assist dir="auto">
            {t('cr.assisted')}
          </p>
        )}
        <div className="cr-machine" dir="ltr">
          <div className="cr-rail" />
          <div className={`cr-claw ${phase}`} style={{ left: `${claw * 100}%` }} data-claw={claw.toFixed(2)}>
            <i className="cable" />
            <i className="head" />
            {holding && caught?.prize && (
              <span className="cr-held">
                <PrizeArt p={caught.prize} />
              </span>
            )}
          </div>
          <div className="cr-floor">
            {CRANE_PRIZES.map((p) => (
              <span key={p.id} className={`cr-slot${holding && caught?.prize?.id === p.id ? ' gone' : ''}${assisted ? ' near' : ''}`} style={{ left: `${p.x * 100}%` }} data-prize={p.id}>
                <PrizeArt p={p} />
              </span>
            ))}
          </div>
          <div className="cr-chute" aria-hidden="true" />
        </div>
        {phase === 'result' && caught && (
          <p className={`cr-result card ${caught.won ? 'won' : 'miss'}`} data-crane-result={caught.won ? 'won' : 'miss'} dir="auto">
            <strong lang="ja">{caught.won ? '取れた！' : 'おしい！'}</strong> {caught.won && caught.prize ? t('cr.wonLine', { name: nameOf(caught.prize.id) }) : t(caught.prize ? 'cr.slipped' : 'cr.missed')}
          </p>
        )}
        {plays === 0 && phase !== 'drop' && phase !== 'lift' && (
          <p className="card cr-none" data-crane-none dir="auto">
            {t('cr.none')}
          </p>
        )}
        <div className="cr-controls">
          <button type="button" className="btn soft cr-move" onClick={() => move(-1)} disabled={phase !== 'aim' || plays < 1} aria-label={t('cr.left')} data-crane-left>
            ◀ <small lang="ja">左</small>
          </button>
          {phase === 'result' && plays > 0 ? (
            <button type="button" className="btn primary cr-drop" onClick={again} data-crane-again>
              {t('cr.again')}
            </button>
          ) : (
            <button type="button" className="btn primary cr-drop" onClick={drop} disabled={phase !== 'aim' || plays < 1} data-crane-drop>
              <span lang="ja">つかむ！</span>
              <small>{t('cr.grab')}</small>
            </button>
          )}
          <button type="button" className="btn soft cr-move" onClick={() => move(1)} disabled={phase !== 'aim' || plays < 1} aria-label={t('cr.right')} data-crane-right>
            <small lang="ja">右</small> ▶
          </button>
        </div>
        <p className="muted small center" dir="auto">
          {t('cr.tally', { n: won })}
        </p>
      </div>
    </div>
  );
}
