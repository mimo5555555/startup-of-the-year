import { BALANCE, dailyGoalProgress, scaleAmount, type DailyGoalState, type DailyState, type GameState } from '@lw/game';
import { useT } from '../../hooks';
import { PACK } from '../../game/pack';
import { Icon } from '../Icon';
import { Ltr } from './WalletPill';

const money = (base: number): number => scaleAmount(base, PACK.economy, PACK.currency);

/** One daily goal: tick, text, "1/2" with a bar and the swap button (the one free swap of the day). */
function Goal({ goal, state, swap }: { goal: DailyGoalState; state: GameState; swap?: () => void }) {
  const { t, lang } = useT();
  const tpl = PACK.daily.find((d) => d.id === goal.id);
  const { done, total } = dailyGoalProgress(state, goal);
  return (
    <li className={`qst-obj${goal.done ? ' done' : ''}`} data-goal={goal.id} data-done={goal.done ? '1' : '0'}>
      <span className="qst-tick" aria-hidden="true">
        {goal.done && <Icon name="check" size={16} />}
      </span>
      <div className="qst-obj-body">
        <strong dir="auto">{tpl?.text[lang] ?? goal.id}</strong>
        {!goal.done && total > 1 && (
          <span className="qst-prog">
            <span className="qst-bar" aria-hidden="true">
              <i style={{ width: `${Math.round((done / total) * 100)}%` }} />
            </span>
            <bdi dir="ltr" className="qst-count">
              {done}/{total}
            </bdi>
          </span>
        )}
      </div>
      {swap && (
        <button className="icon-btn qst-swap" data-swap={goal.id} onClick={swap} aria-label={t('quests.swap')} title={t('quests.swap')}>
          <Icon name="replay" size={20} />
        </button>
      )}
    </li>
  );
}

/**
 * The Today tab (§7.4): today's goals, then "From yesterday" (a goal stays open for two days and pays the same), what they pay, and the one
 * free swap. No penalty text: a goal that ran out quietly goes away.
 */
export function DailyList({ state, streakDays, onSwap }: { state: GameState; streakDays: number; onSwap: (goalId: string) => void }) {
  const { t } = useT();
  const d: DailyState = state.daily;
  const open = d.goals.filter((g) => !g.done).length;
  const canSwap = !d.swapUsed;
  // the streak bonus rides on the first goal done today (¥15 a streak day, at most 10 days; BALANCE.goals)
  const streak = money(Math.min(BALANCE.goals.streakPer * Math.min(streakDays, BALANCE.goals.streakDaysMax), BALANCE.goals.streakMax));
  return (
    <div className="qst-daily stack">
      <section className="card">
        <ul className="qst-list">
          {d.goals.map((g) => (
            <Goal key={`${g.day}:${g.id}`} goal={g} state={state} swap={canSwap && !g.done ? () => onSwap(g.id) : undefined} />
          ))}
        </ul>
        <div className="qst-pay muted small">
          <span>
            <Ltr text={t('quests.each', { n: money(BALANCE.goals.each) })} />
          </span>
          <span data-trio={d.allPaid ? '1' : '0'}>
            <Ltr text={d.allPaid && d.goals.length === 3 ? t('quests.trio', { n: money(BALANCE.goals.all) }) : t('quests.trioGoal', { n: money(BALANCE.goals.all) })} />
          </span>
        </div>
        {streak > 0 && (
          <p className="muted small" data-streak={streak}>
            <Ltr text={t('quests.streakBonus', { n: streak })} />
          </p>
        )}
        {d.swapUsed && open > 0 && <p className="muted small">{t('quests.swapDone')}</p>}
      </section>
      {d.carried.length > 0 && (
        <section className="card" data-carried="1">
          <h3 className="h2">{t('quests.fromYesterday')}</h3>
          <ul className="qst-list">
            {d.carried.map((g) => (
              <Goal key={`${g.day}:${g.id}`} goal={g} state={state} />
            ))}
          </ul>
        </section>
      )}
      {d.goals.length === 0 && d.carried.length === 0 && <p className="muted center">{t('quests.dailyNone')}</p>}
    </div>
  );
}
