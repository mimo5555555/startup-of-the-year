import { SIGNS } from '@lw/content';
import { levelProgress, localDate, xpForLevel } from '@lw/core';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { useStore } from '../store';
import { useT } from '../hooks';
import { entryForSign, tokenOf } from '../content';

function lastDays(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(localDate(d));
  }
  return out;
}

export function Stats() {
  const { t, lang, dir } = useT();
  const go = useStore((s) => s.go);
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const days = useStore((s) => s.days);
  const vocab = useStore((s) => s.vocab);
  const errors = useStore((s) => s.errors);
  const discovered = useStore((s) => s.discovered);
  const settings = useStore((s) => s.settings);

  const lp = levelProgress(xp);
  const totalSec = Object.values(days).reduce((n, d) => n + d.seconds, 0);
  const totalLoops = Object.values(days).reduce((n, d) => n + d.loops, 0);
  const week = lastDays(7);
  const mins = week.map((d) => Math.round(((days[d]?.seconds ?? 0) / 60) * 10) / 10);
  const top = Math.max(5, Math.ceil(Math.max(...mins) / 5) * 5);
  const catLabel: Record<string, string> = { grammar: t('f.cat.grammar'), vocabulary: t('f.cat.vocabulary'), naturalness: t('f.cat.naturalness') };
  const errTotal = Object.values(errors).reduce((a, b) => a + b, 0);
  const wd = new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { weekday: 'short' });

  const W = 320;
  const H = 150;
  const padL = 26;
  const padB = 24;
  const bw = (W - padL - 8) / 7;

  return (
    <div className="panel" dir={dir}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.close')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('s.title')}</h1>
        <span />
      </header>
      <div className="panel-body">
        <section className="card level-card">
          <div className="level-n">{lp.level}</div>
          <div className="grow">
            <strong>{t('w.level', { n: lp.level })}</strong>
            <div className="bar wide">
              <i style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
            </div>
            <small className="muted">{t('s.toNext', { n: xpForLevel(lp.level + 1) - xp, next: lp.level + 1 })}</small>
          </div>
        </section>

        <section className="tiles">
          <div className="tile">
            <strong>{Math.round(totalSec / 60)}</strong>
            <span>{t('s.minutes')}</span>
          </div>
          <div className="tile">
            <strong>{totalLoops}</strong>
            <span>{t('s.loops')}</span>
          </div>
          <div className="tile">
            <strong>{vocab.length}</strong>
            <span>{t('s.words')}</span>
          </div>
          <div className="tile">
            <strong>
              {streak.days}
              <Icon name="flame" size={16} />
            </strong>
            <span>{t('s.streak')}</span>
            <small>{t('s.freezes')}: {streak.freezes}</small>
          </div>
        </section>

        <section>
          <h2 className="h2">{t('s.week')}</h2>
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={t('s.week')}>
            {[0, top / 2, top].map((v) => {
              const y = H - padB - (v / top) * (H - padB - 8);
              return (
                <g key={v}>
                  <line x1={padL} x2={W - 4} y1={y} y2={y} className="grid" />
                  <text x={padL - 6} y={y + 3.5} textAnchor="end" className="axis">
                    {v}
                  </text>
                </g>
              );
            })}
            {mins.map((m, i) => {
              const h = (m / top) * (H - padB - 8);
              const x = padL + i * bw + bw * 0.18;
              const isToday = i === mins.length - 1;
              return (
                <g key={week[i]}>
                  <rect x={x} y={H - padB - h} width={bw * 0.64} height={Math.max(h, m > 0 ? 2 : 0)} rx="4" className={isToday ? 'bar-today' : 'bar-day'} />
                  <text x={x + bw * 0.32} y={H - 7} textAnchor="middle" className="axis">
                    {wd.format(new Date(week[i] + 'T12:00:00'))}
                  </text>
                  {m > 0 && (
                    <text x={x + bw * 0.32} y={H - padB - h - 5} textAnchor="middle" className="axis val">
                      {m}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="muted small">{t('common.min')}</p>
        </section>

        <section>
          <h2 className="h2">{t('s.errors')}</h2>
          {errTotal === 0 ? (
            <p className="muted">{t('s.errors.none')}</p>
          ) : (
            <ul className="hbars">
              {Object.entries(errors)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k}>
                    <span>{catLabel[k] ?? k}</span>
                    <div className="hbar">
                      <i style={{ width: `${Math.round((v / errTotal) * 100)}%` }} />
                    </div>
                    <b>{v}</b>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="h2">
            {t('s.found')} <span className="pill">{discovered.filter((d) => SIGNS.some((s) => s.id === d)).length}/{SIGNS.length}</span>
          </h2>
          <div className="found-grid">
            {SIGNS.map((s) => {
              const ok = discovered.includes(s.id);
              const e = entryForSign(s.id)!;
              return (
                <div key={s.id} className={`found-cell ${ok ? 'ok' : ''}`}>
                  {ok ? <JaText tokens={[tokenOf(e)]} furigana={settings.furigana} romaji={false} size="sm" /> : <Icon name="lock" size={16} />}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
