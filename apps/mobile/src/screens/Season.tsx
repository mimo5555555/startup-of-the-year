// The Season screen (季節, docs/GOEN.md "The season pass"), from the Quests screen and the Shrine: the open season's speaking tasks with their
// progress, its season points, and the tiers on the free and premium tracks with what each gives and what was claimed. The premium track shows
// its Goen price and a way to the shrine while it is locked. Outside the window: "next season soon", and nothing earned is lost.
import { goenItem, seasonView } from '@lw/game';
import { SeasonTrack } from '../components/game/SeasonTrack';
import { GoenPill } from '../components/game/GoenPill';
import { Ltr } from '../components/game/WalletPill';
import { Icon } from '../components/Icon';
import { useGameState } from '../game/hooks';
import { PACK } from '../game/pack';
import { useT } from '../hooks';
import { useStore, type Screen } from '../store';

let backTo: Screen = 'world';
/** Opens the Season screen; its back button returns to `from` (the Quests screen or the Shrine). */
export function openSeason(from: Screen): void {
  backTo = from;
  useStore.getState().go('season' as Screen);
}

/** 'MM-DD' or 'YYYY-MM-DD' as "15 October" / "15 أكتوبر" (Latin digits in both languages). */
export function dayMonth(md: string, lang: 'en' | 'ar'): string {
  const [m, d] = md.slice(-5).split('-').map(Number);
  const date = new Date(Date.UTC(2026, (m ?? 1) - 1, d ?? 1, 12));
  return date.toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export function Season() {
  const { t, dir, lang } = useT();
  const go = useStore((s) => s.go);
  const state = useGameState();
  const view = seasonView(PACK, state, Date.now());
  const premiumItem = view ? goenItem(PACK, view.def.premiumItem) : undefined;
  const nextTier = view?.tiers.find((x) => !x.reached);
  return (
    <div className="panel gn-season" dir={dir} data-screen="season" data-season={view?.def.id ?? 'none'} data-active={view?.active ? 1 : 0}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go(backTo)} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{view ? view.def.name[lang] : t('gn.season.title')}</h1>
        <span />
      </header>
      <div className="panel-body gn-body">
        {!view && (
          <p className="card center" data-season-soon dir="auto">
            {t('gn.season.soon')}
          </p>
        )}
        {view && (
          <>
            <section className="card gn-season-top">
              <span className="gn-season-ja" lang="ja">
                {view.def.name.ja}
              </span>
              <small dir="auto">
                <Ltr text={t('gn.season.window', { from: dayMonth(view.def.window.from, lang), to: dayMonth(view.def.window.to, lang) })} />
              </small>
              {view.active ? (
                <div className="gn-sp" data-sp={view.sp}>
                  <strong>
                    <Ltr text={t('gn.season.points', { n: view.sp })} />
                  </strong>
                  {nextTier && (
                    <span className="gn-sp-bar" aria-hidden="true">
                      <i style={{ width: `${Math.min(100, Math.round((view.sp / Math.max(1, nextTier.sp)) * 100))}%` }} />
                    </span>
                  )}
                </div>
              ) : (
                <p className="gn-soon" data-season-soon dir="auto">
                  {t('gn.season.soon')}
                  {view.nextFrom && (
                    <>
                      {' '}
                      <bdi dir="auto">{dayMonth(view.nextFrom, lang)}</bdi>
                    </>
                  )}
                </p>
              )}
            </section>
            {view.active && !view.premium && premiumItem && (
              <section className="card gn-premium-lock" data-premium="locked">
                <Icon name="lock" size={18} />
                <p dir="auto">
                  <Ltr text={t('gn.season.locked', { n: premiumItem.price })} />
                </p>
                <button type="button" className="btn primary" data-open="shrine" onClick={() => go('shrine' as Screen)}>
                  {t('gn.season.toShrine')}
                </button>
              </section>
            )}
            {view.active && (
              <section>
                <h2 className="h2">{t('gn.season.tasks')}</h2>
                <ul className="gn-tasks card">
                  {view.tasks.map(({ task, count, done }) => (
                    <li key={task.id} className={`gn-task${done ? ' done' : ''}`} data-season-task={task.id} data-done={done ? 1 : 0}>
                      <span className="qst-tick" aria-hidden="true">
                        {done && <Icon name="check" size={16} />}
                      </span>
                      <div>
                        <strong dir="auto">{task.text[lang]}</strong>
                        <small dir="auto">
                          <Ltr text={`${t('gn.season.task', { done: count, total: task.target })} · ${t('gn.season.needs', { n: task.sp })}`} />
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <h2 className="h2">{t('gn.season.tiers')}</h2>
            <SeasonTrack view={view} />
            <GoenPill />
          </>
        )}
      </div>
    </div>
  );
}

/** The Quests screen's way in: the season's name and points, or "next season soon" (it never disappears: nothing is lost). */
export function SeasonLink({ from }: { from: Screen }) {
  const { t, dir, lang } = useT();
  const state = useGameState();
  const view = seasonView(PACK, state, Date.now());
  if (!view) return null;
  return (
    <button type="button" className="gn-season-link card" data-open="season" data-season-link={view.active ? 'open' : 'soon'} onClick={() => openSeason(from)}>
      <span className="gn-pic gn-pic-season_autumn_premium" aria-hidden="true">
        <Icon name="star" size={22} />
      </span>
      <span>
        <strong dir="auto">{view.def.name[lang]}</strong>
        <small dir="auto">{view.active ? <Ltr text={t('gn.season.points', { n: view.sp })} /> : t('gn.season.soon')}</small>
      </span>
      <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={20} />
    </button>
  );
}
