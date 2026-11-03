// Goen stage 2 at the shrine (docs/GOEN.md "Stage 2"): the three Goen packs with their real price (set by the server), the test-mode card
// line, and Stripe's secure page. Players under 18 (the age profile) first pass a grown-up check. Without the server the section says "coming
// soon": no dead buy button. Purchases (the recovery code, restore) are in Settings: GoenPurchases.
import { useEffect, useState } from 'react';
import { useT } from '../../hooks';
import { useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { buyPack, gateQuestion, loadShop, priceText, usePay } from '../../game/goenPay';
import { Icon } from '../Icon';
import { Ltr } from './WalletPill';

export function GoenPacks() {
  const { t, dir, lang } = useT();
  const { status, packs, test, busy } = usePay();
  const view = useGameView();
  const minor = (PACK.ageProfiles[view.profile.age]?.ageFloor ?? 18) < 18;
  const [gate, setGate] = useState<{ pack: string; a: number; b: number; answer: number } | null>(null);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);
  useEffect(() => void loadShop(), []);

  const start = (pack: string) => {
    if (minor) {
      setGate({ pack, ...gateQuestion() });
      setTyped('');
      setWrong(false);
    } else void buyPack(pack);
  };
  const check = () => {
    if (!gate) return;
    if (Number(typed.trim()) === gate.answer) {
      const pack = gate.pack;
      setGate(null);
      void buyPack(pack);
    } else setWrong(true);
  };

  return (
    <section className="gp-shop" data-goen-shop={status} dir={dir}>
      <h2 className="h2">{t('gp.title')}</h2>
      {status === 'loading' && <p className="muted small">{t('gp.loading')}</p>}
      {status === 'off' && (
        <p className="muted small center" data-goen-soon dir="auto">
          {t('gp.soon')}
        </p>
      )}
      {status === 'on' && (
        <>
          <p className="muted small" dir="auto">
            {t('gp.sub')}
          </p>
          <ul className="gp-packs">
            {packs.map((p) => (
              <li key={p.id} className="card gp-pack" data-pack={p.id}>
                <span className="gp-coin" aria-hidden="true">
                  <Icon name="star" size={20} />
                </span>
                <span className="gp-what">
                  <strong>
                    <Ltr text={t('gp.pack', { n: p.goen.toLocaleString('en') })} />
                  </strong>
                  {p.bonus > 0 && <small className="gp-bonus">{t('gp.bonus', { n: p.bonus })}</small>}
                </span>
                <button type="button" className="btn primary sm" disabled={busy} data-buy={p.id} onClick={() => start(p.id)}>
                  {t('gp.buy', { price: priceText(p.cents, p.currency, lang) })}
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small" dir="auto">
            {t('gp.secure')}
          </p>
          {test && (
            <p className="gp-test small" data-goen-test dir="auto">
              {t('gp.test')}
            </p>
          )}
        </>
      )}
      {gate && (
        <div className="scrim center" role="dialog" aria-modal="true" data-goen-gate>
          <div className="modal" dir={dir}>
            <h3>{t('gp.gate.title')}</h3>
            <p dir="auto">{t('gp.gate.body')}</p>
            <label className="gp-gate-q">
              <span>
                <Ltr text={t('gp.gate.q', { a: gate.a, b: gate.b })} />
              </span>
              <input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && check()} autoComplete="off" dir="ltr" />
            </label>
            {wrong && (
              <p className="small warn-text" role="alert">
                {t('gp.gate.wrong')}
              </p>
            )}
            <div className="row">
              <button type="button" className="btn soft" onClick={() => setGate(null)}>
                {t('gp.gate.cancel')}
              </button>
              <button type="button" className="btn primary" onClick={check} data-gate-ok>
                {t('gp.gate.ok')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
