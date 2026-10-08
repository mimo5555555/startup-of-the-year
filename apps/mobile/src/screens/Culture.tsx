import { StubPanel } from '../components/game/StubPanel';
import { Ltr } from '../components/game/WalletPill';
import { useGameState } from '../game/hooks';
import { useT } from '../hooks';

// Placeholder route (2A): the owner of this screen (4F) replaces the body, the route and the back button stay. The Culture tab is shown from
// Chapter 1, so the screen behind its button must never be blank: until the cards are authored it says what will collect here.
export function Culture() {
  const { t } = useT();
  const game = useGameState();
  return (
    <StubPanel title={t('quests.tab.culture')}>
      <div className="card center" data-culture-empty>
        <p>
          <Ltr text={t('quests.cultureCount', { n: Object.keys(game.culture).length })} />
        </p>
        <p className="muted">{t('culture.empty')}</p>
      </div>
    </StubPanel>
  );
}
