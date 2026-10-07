import { StubPanel } from '../components/game/StubPanel';
import { useT } from '../hooks';

// Placeholder route (2A): the owner of this screen replaces the body, the route and the back button stay.
export function Friends() {
  const { t } = useT();
  return <StubPanel title={t('quests.tab.friends')} />;
}
