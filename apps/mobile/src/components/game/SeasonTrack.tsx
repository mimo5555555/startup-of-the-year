// The tiers of a season on two tracks (docs/GOEN.md "The season pass"): one row per tier with the season points it needs, what the free track
// gives and what the premium track gives, each marked claimed / reached / still to come; the premium cells are locked until the premium track is
// owned (the screen says its Goen price and links to the shrine). Nothing here is random: every reward is named.
import type { SeasonReward, SeasonView } from '@lw/game';
import { useT } from '../../hooks';
import { PACK } from '../../game/pack';
import type { StringKey } from '../../i18n';
import { Icon } from '../Icon';
import { Ltr } from './WalletPill';

type T = (k: StringKey, v?: Record<string, string | number>) => string;

/** A reward as one short line: Goen, or the named item / keepsake / title, or "a sticker". */
export function rewardText(t: T, lang: 'en' | 'ar', r: SeasonReward): string {
  switch (r.t) {
    case 'goen':
      return t('gn.season.reward.goen', { n: r.n });
    case 'item':
      return PACK.items.find((i) => i.id === r.id)?.name[lang] ?? t('gn.season.reward.item');
    case 'keepsake':
      return PACK.keepsakes?.[r.id]?.[lang] ?? t('gn.season.reward.keepsake');
    case 'title': {
      const name = PACK.titles.find((x) => x.id === r.id)?.name[lang];
      return name ? `${t('gn.season.reward.title')}: ${name}` : t('gn.season.reward.title');
    }
    default:
      return t('gn.season.reward.sticker');
  }
}

function Cell({ rewards, granted, reached, locked, track }: { rewards: SeasonReward[]; granted: boolean; reached: boolean; locked: boolean; track: 'free' | 'premium' }) {
  const { t, lang } = useT();
  const st = granted ? 'claimed' : locked ? 'locked' : reached ? 'reached' : 'todo';
  return (
    <div className={`gn-cell ${track} ${st}`} data-track={track} data-cell={st}>
      {rewards.length === 0 ? (
        <span className="muted">·</span>
      ) : (
        <ul>
          {rewards.map((r, i) => (
            <li key={i} dir="auto">
              <Ltr text={rewardText(t, lang, r)} />
            </li>
          ))}
        </ul>
      )}
      {granted && (
        <small className="gn-claimed">
          <Icon name="check" size={13} /> {t('gn.season.claimed')}
        </small>
      )}
      {locked && !granted && <Icon name="lock" size={14} className="gn-cell-lock" />}
    </div>
  );
}

export function SeasonTrack({ view }: { view: SeasonView }) {
  const { t } = useT();
  const top = view.tiers.reduce((m, x) => Math.max(m, x.sp), 1);
  return (
    <section className="gn-track" aria-label={t('gn.season.tiers')}>
      <div className="gn-track-head" aria-hidden="true">
        <span />
        <span>{t('gn.season.free')}</span>
        <span>
          {!view.premium && <Icon name="lock" size={12} />} {t('gn.season.premium')}
        </span>
      </div>
      <ol className="gn-tiers">
        {view.tiers.map((tier) => (
          <li key={tier.n} className={`gn-tier${tier.reached ? ' reached' : ''}`} data-tier={tier.n} data-reached={tier.reached ? 1 : 0}>
            <div className="gn-tier-n">
              <strong>
                <Ltr text={t('gn.season.tier', { n: tier.n })} />
              </strong>
              <small dir="ltr">{t('gn.season.needs', { n: tier.sp })}</small>
              <i className="gn-tier-bar" style={{ ['--p' as string]: `${Math.min(100, Math.round((view.sp / Math.max(1, tier.sp)) * 100))}%`, ['--w' as string]: `${Math.round((tier.sp / top) * 100)}%` }} />
            </div>
            <Cell track="free" rewards={tier.free.rewards} granted={tier.free.granted} reached={tier.reached} locked={false} />
            <Cell track="premium" rewards={tier.premium.rewards} granted={tier.premium.granted} reached={tier.reached} locked={!view.premium} />
          </li>
        ))}
      </ol>
    </section>
  );
}
