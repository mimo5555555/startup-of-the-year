import { StubPanel } from '../components/game/StubPanel';
import { useChapter } from '../game/hooks';
import { useT } from '../hooks';

// Placeholder route (2A): agent 2F replaces the body (tabs Dream, Story, Today, Friends, Culture); the route and the back button stay.
export function Quests() {
  const { t } = useT();
  const { status } = useChapter();
  return <StubPanel title={t('quests.chapter', { n: status.n })} />;
}
