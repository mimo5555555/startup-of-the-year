import { useEffect, useMemo, useState } from 'react';
import { objectiveRows } from '@lw/game';
import { ChapterCard, ChapterTeaser } from '../components/game/ChapterCard';
import { DailyList } from '../components/game/DailyList';
import { DreamPanel, DreamPicker } from '../components/game/DreamPicker';
import { ObjectiveRow } from '../components/game/ObjectiveRow';
import { Ltr } from '../components/game/WalletPill';
import { Icon } from '../components/Icon';
import { characterById, displayName } from '../content';
import { dispatch } from '../game/bridge';
import { useChapter, useDisclosure, useDream, useGameState, useGameView } from '../game/hooks';
import { PACK } from '../game/pack';
import { heartsOf } from '../game/selectors';
import { useT } from '../hooks';
import { useStore } from '../store';
import { useUi, type ScreenArgs } from '../ui';

type Tab = NonNullable<ScreenArgs['quests']['tab']>;

/** The hearts a friend can have (BALANCE.ap.thresholds has five). */
const HEART_SLOTS = [1, 2, 3, 4, 5];

/**
 * The Quests screen (§7.5): tabs Dream, Story, Today, Friends and Culture, shown as they are disclosed (§2.5). Story lists the current
 * chapter's objectives with progress, Hanako's *Make it easier* offer, the waiting message and the later chapters by name; Today holds the
 * daily goals and *From yesterday*; Dream is the tracker and the picker; Friends and Culture are doors to their own screens.
 */
export function Quests() {
  const { t, dir, lang } = useT();
  const go = useStore((s) => s.go);
  const game = useGameState();
  const view = useGameView();
  const disc = useDisclosure();
  const dream = useDream();
  const asked = useUi((s) => s.args.quests?.tab);

  const tabs = useMemo(
    () =>
      (
        [
          ['dream', disc.dreamChip],
          ['story', true],
          ['today', disc.dailyGoals],
          ['friends', disc.friends],
          ['culture', true],
        ] as Array<[Tab, boolean]>
      )
        .filter(([, shown]) => shown)
        .map(([id]) => id),
    [disc.dreamChip, disc.dailyGoals, disc.friends],
  );
  const [tab, setTab] = useState<Tab>(() => (asked && tabs.includes(asked) ? asked : 'story'));
  const [changing, setChanging] = useState(false);
  const here: Tab = tabs.includes(tab) ? tab : 'story';

  // Chapter 8's last goal: finishing the dream, or picking a new one, sets the `dream_epilogue` flag (the car dream is never required)
  const finished = !!dream && dream.total > 0 && dream.doneCount >= dream.total;
  const epilogue = game.chapter.flags.includes('dream_epilogue');
  useEffect(() => {
    if (game.chapter.n >= 8 && finished && !epilogue) dispatch({ t: 'flag', id: 'dream_epilogue' });
  }, [game.chapter.n, finished, epilogue]);

  const choose = (id: string) => {
    dispatch({ t: 'dream_chosen', id });
    if (game.chapter.n >= 8 && !epilogue) dispatch({ t: 'flag', id: 'dream_epilogue' });
    setChanging(false);
  };

  return (
    <div className="panel qst" dir={dir} data-screen="quests" data-tab={here}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('hud.quests')}</h1>
        <span />
      </header>
      <nav className="qst-tabs" role="tablist" aria-label={t('hud.quests')}>
        {tabs.map((id) => (
          <button key={id} role="tab" aria-selected={here === id} className={here === id ? 'on' : ''} data-tab={id} onClick={() => setTab(id)}>
            {t(`quests.tab.${id}` as const)}
          </button>
        ))}
      </nav>
      <div className="panel-body qst-body">
        {here === 'story' && <StoryTab />}
        {here === 'today' && <DailyList state={game} streakDays={view.streakDays} onSwap={(goalId) => dispatch({ t: 'daily_swap', goalId })} />}
        {here === 'dream' &&
          (dream && !changing ? (
            <DreamPanel progress={dream} stickers={game.stickers} onChange={() => setChanging(true)} />
          ) : (
            <DreamPicker current={dream?.dream} onChoose={choose} onLater={() => (dream ? setChanging(false) : setTab('story'))} />
          ))}
        {here === 'friends' && (
          <div className="stack" data-pane="friends">
            {PACK.friends.filter((f) => f.unlockChapter <= game.chapter.n).length === 0 ? (
              <p className="muted center">{t('quests.friendsNone')}</p>
            ) : (
              <ul className="qst-list card">
                {PACK.friends
                  .filter((f) => f.unlockChapter <= game.chapter.n)
                  .map((f) => {
                    const who = characterById(f.id);
                    const h = heartsOf(game, f.id);
                    return (
                      <li key={f.id} className="qst-friend">
                        <strong dir="auto">{who ? displayName(who, lang) : f.id}</strong>
                        <span className="qst-hearts" role="img" aria-label={`${t('social.hearts')}: ${h}`}>
                          {HEART_SLOTS.map((n) => (
                            <span key={n} className={n <= h ? 'on' : ''} aria-hidden="true">
                              {n <= h ? '♥' : '♡'}
                            </span>
                          ))}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
            <button className="btn soft" data-open="friends" onClick={() => go('friends')}>
              {t('quests.friendsOpen')}
            </button>
          </div>
        )}
        {here === 'culture' && (
          <div className="stack" data-pane="culture">
            <p className="card center">
              <Ltr text={t('quests.cultureCount', { n: Object.keys(game.culture).length })} />
            </p>
            <button className="btn soft" data-open="culture" onClick={() => go('culture')}>
              {t('quests.cultureOpen')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** The Story tab: the current chapter, its waiting message, the dream slot and the chapters still to come. */
function StoryTab() {
  const { t, lang } = useT();
  const game = useGameState();
  const view = useGameView();
  const disc = useDisclosure();
  const { def, status } = useChapter();
  const dream = useDream();
  const rows = useMemo(() => objectiveRows(PACK, game, view), [game, view]);

  if (!def) {
    return (
      <section className="card center" data-freewalk="1">
        <Icon name="trophy" size={28} />
        <p>{t('quests.freeWalk')}</p>
      </section>
    );
  }
  const dreamDef = dream ? PACK.dreams.find((d) => d.id === dream.dream) : undefined;
  const slot = dreamDef?.steps.filter((s) => s.gate === def.n) ?? [];
  const hasSlot = def.objectives.some((o) => o.dream);
  const later = PACK.chapters.filter((c) => c.n > def.n).sort((a, b) => a.n - b.n);
  const complete = status.total > 0 && status.done === status.total;

  return (
    <div className="stack" data-pane="story">
      <ChapterCard def={def} status={status}>
        <ul className="qst-list">
          {rows.map((row) => (
            <ObjectiveRow key={row.id} row={row} onEasier={(objective) => dispatch({ t: 'easier_accept', objective })} />
          ))}
        </ul>
        {hasSlot && disc.dreamChip && (
          <div className="qst-slot" data-slot="dream">
            <small className="label">{t('quests.dreamSlot')}</small>
            {!dream && <small className="muted">{t('quests.dreamNone')}</small>}
            {slot.length > 0 && (
              <ul className="qst-list">
                {slot.map((s) => {
                  const st = dream?.steps.find((x) => x.id === s.id);
                  return (
                    <li key={s.id} className={`qst-obj${st?.done ? ' done' : ''}`} data-step={s.id}>
                      <span className="qst-tick" aria-hidden="true">
                        {st?.done && <Icon name="check" size={16} />}
                      </span>
                      <div className="qst-obj-body">
                        <strong dir="auto">{s.text[lang]}</strong>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </ChapterCard>

      {complete && status.waitDays > 0 && (
        <section className="card qst-wait" data-wait={status.waitDays}>
          <strong lang="ja">できました！</strong>
          <span>
            <Ltr text={t('quests.waitDays', { n: status.waitDays })} />
          </span>
        </section>
      )}
      {status.gated && (
        <section className="card qst-wait" data-gated="1">
          <Icon name="lock" size={18} />
          <span>{t(def && PACK.chapters.find((c) => c.n === def.n + 1)?.startGate?.k === 'hearts_count' ? 'quests.gate.friend' : 'quests.gate.other')}</span>
        </section>
      )}

      {later.length > 0 && (
        <section>
          <h3 className="h2">{t('quests.comingUp')}</h3>
          <ul className="qst-list card">
            {later.map((c) => (
              <ChapterTeaser key={c.n} def={c} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
