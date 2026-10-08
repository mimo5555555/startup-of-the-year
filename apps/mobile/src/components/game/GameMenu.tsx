import { levelProgress } from '@lw/core';
import { useT } from '../../hooks';
import { openScreen } from '../../game/bridge';
import { useDerivedFlags, useDisclosure, useGameState } from '../../game/hooks';
import { menuIds, type MenuId } from '../../game/worldSync';
import { dueCount, useStore } from '../../store';
import { Icon, type IconName } from '../Icon';

const ICON: Record<MenuId, IconName> = { quests: 'target', friends: 'heart', phone: 'phone', wallet: 'wallet', lessons: 'book', vocab: 'book', stats: 'chart', settings: 'sliders' };

/**
 * The world menu (§7.5). Two groups: the game's entries, then the three the app always had (Words, Progress, Settings), which keep
 * the `.menu` class and their order. When the phone icon has taken the level chip's place on the HUD, the level and streak sit on top.
 */
export function GameMenu({ showLevel, onClose, onLessons }: { showLevel: boolean; onClose: () => void; onLessons: () => void }) {
  const { t } = useT();
  const d = useDisclosure();
  const flags = useDerivedFlags();
  const game = useGameState();
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const vocab = useStore((s) => s.vocab);
  const go = useStore((s) => s.go);
  const due = dueCount(vocab);
  const unread = Object.values(game.friends).reduce((n, f) => n + (f.unread ?? 0), 0);
  const lvl = levelProgress(xp);
  const ids = menuIds({ friends: d.friends, phoneIcon: flags.hasPhone || d.phoneIcon });

  const label: Record<MenuId, string> = {
    quests: t('hud.quests'),
    friends: t('hud.friends'),
    phone: t('hud.phone'),
    wallet: t('hud.wallet'),
    lessons: t('hud.lessons'),
    vocab: t('w.words'),
    stats: t('w.progress'),
    settings: t('w.settings'),
  };
  const pick = (id: MenuId) => {
    onClose();
    if (id === 'quests') openScreen('quests', {});
    else if (id === 'phone') openScreen('phone', {});
    else if (id === 'lessons') onLessons();
    else go(id);
  };
  const row = (id: MenuId) => (
    <button key={id} data-menu={id} onClick={() => pick(id)}>
      <Icon name={ICON[id]} size={20} /> {label[id]}
      {id === 'vocab' && due > 0 && <span className="pill">{t('v.due', { n: due })}</span>}
      {id === 'phone' && unread > 0 && <span className="pill alert">{unread}</span>}
    </button>
  );

  return (
    <div className="hud-menu-wrap">
      <nav className="hud-menu glass-card" aria-label={t('w.menu')}>
        {showLevel && (
          <div className="hud-menu-level" aria-label={t('hud.level')}>
            <span>{t('w.level', { n: lvl.level })}</span>
            <span className="bar">
              <i style={{ width: `${Math.round(lvl.fraction * 100)}%` }} />
            </span>
            <span className="hud-menu-streak">
              <Icon name="flame" size={16} /> {streak.days}
            </span>
          </div>
        )}
        {ids.play.map(row)}
      </nav>
      <nav className="menu glass-card">{ids.study.map(row)}</nav>
    </div>
  );
}
