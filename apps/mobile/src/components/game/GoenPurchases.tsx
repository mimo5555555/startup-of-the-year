// Settings > Your purchases (docs/GOEN.md "Stage 2"): the recovery code (copy it, it brings bought Goen back on a new device), the bought
// Goen not spent yet, the purchases with their price (refunds marked), and Restore purchases with a code.
import { useEffect, useState } from 'react';
import { goenCode, paidLeft } from '@lw/game';
import { useT } from '../../hooks';
import { useGameState } from '../../game/hooks';
import { priceText, restore, syncWallet, usePay } from '../../game/goenPay';
import { useStore } from '../../store';
import { Ltr } from './WalletPill';

export function GoenPurchases() {
  const { t, dir, lang } = useT();
  const state = useGameState();
  const code = goenCode(state);
  const wallet = usePay((s) => s.wallet);
  const say = useStore((s) => s.say);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<'bad' | 'offline' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (code) void syncWallet();
  }, [code]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code ?? '');
      say(t('gp.code.copied'), 'good');
    } catch {
      /* the code is selectable on screen */
    }
  };
  const go = async () => {
    setBusy(true);
    const r = await restore(typed);
    setBusy(false);
    setNote(r === 'ok' ? null : r);
    if (r === 'ok') setTyped('');
  };

  return (
    <section className="group gp-purchases" data-goen-purchases dir={dir}>
      <h2 className="h2">{t('gp.code.title')}</h2>
      {code ? (
        <>
          <p className="small" dir="auto">
            {t('gp.code.save')}
          </p>
          <div className="gp-code-row">
            <code className="gp-code" dir="ltr" data-goen-code>
              {code}
            </code>
            <button type="button" className="btn soft sm" onClick={() => void copy()}>
              {t('gp.code.copy')}
            </button>
          </div>
          <p className="small muted">
            <Ltr text={t('gp.code.left', { n: paidLeft(state.goen) })} />
          </p>
          {wallet && wallet.credits.length > 0 && (
            <>
              <h3 className="h3">{t('gp.code.receipts')}</h3>
              <ul className="gp-receipts">
                {wallet.credits.map((c) => (
                  <li key={c.id} data-receipt={c.id}>
                    <span dir="ltr">{new Date(c.at).toISOString().slice(0, 10)}</span>
                    <span>
                      <Ltr text={t('gp.pack', { n: c.goen })} />
                    </span>
                    <span dir="ltr">{priceText(c.cents, c.currency, lang)}</span>
                    {wallet.refunded.includes(c.id) && <small className="muted">{t('gp.code.refunded')}</small>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="small muted" dir="auto">
          {t('gp.code.none')}
        </p>
      )}
      <details className="gp-restore" open={!code}>
        <summary>{t('gp.restore')}</summary>
        {code && <p className="small muted">{t('gp.restore.other')}</p>}
        <div className="gp-code-row">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('gp.restore.ph')} aria-label={t('gp.restore.ph')} autoComplete="off" autoCapitalize="characters" spellCheck={false} dir="ltr" data-restore-input />
          <button type="button" className="btn primary sm" disabled={busy || typed.trim().length < 12} onClick={() => void go()} data-restore-go>
            {t('gp.restore.go')}
          </button>
        </div>
        {note && (
          <p className="small warn-text" role="alert">
            {t(note === 'bad' ? 'gp.restore.bad' : 'gp.offline')}
          </p>
        )}
      </details>
      <p className="small muted" dir="auto">
        {t('gp.refund')}
      </p>
    </section>
  );
}
