import { useEffect } from 'react';
import { useStore } from './store';
import { Onboarding } from './screens/Onboarding';
import { WorldScreen } from './screens/WorldScreen';
import { Feedback } from './screens/Feedback';
import { Vocab } from './screens/Vocab';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { Lesson } from './screens/Lesson';
import { Quests } from './screens/Quests';
import { Friends } from './screens/Friends';
import { Phone } from './screens/Phone';
import { Shift } from './screens/Shift';
import { Prepare } from './screens/Prepare';
import { Wallet } from './screens/Wallet';
import { Letter } from './screens/Letter';
import { Culture } from './screens/Culture';
import { StoryBeat } from './screens/StoryBeat';
import { WordSheet } from './components/WordSheet';
import { Toasts } from './components/Toasts';
import { dirOf } from './i18n';
import { watchFontsReady } from './fonts';
import { unlockOnFirstGesture } from './services';
import { init, observeDay } from './game/bridge';
import { BeatGate, ConversationHost } from './game/host';
import { CultureCardHost } from './components/game/CultureCard';
import { useGameReady } from './game/hooks';

export default function App() {
  const ready = useStore((s) => s.ready);
  const screen = useStore((s) => s.screen);
  const profile = useStore((s) => s.profile);
  const lang = useStore((s) => s.uiLang);
  const gameReady = useGameReady();

  useEffect(() => {
    // hydrates the v1 store, then the game store, then seeds (docs/GAME_DESIGN.md §14.7)
    void init();
    watchFontsReady();
    unlockOnFirstGesture();
  }, []);

  // the day is observed on mount (inside init), on focus and on visibilitychange (inside init); a profile created now needs it once too
  const playing = !!profile;
  useEffect(() => {
    if (ready && gameReady && playing) observeDay();
  }, [ready, gameReady, playing]);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dirOf(lang);
  }, [lang]);

  if (!ready || !gameReady) return null;

  return (
    <div className="app">
      {profile && <WorldScreen />}
      {screen === 'onboarding' && <Onboarding />}
      {screen === 'feedback' && <Feedback />}
      {screen === 'vocab' && <Vocab />}
      {screen === 'stats' && <Stats />}
      {screen === 'settings' && <Settings />}
      {screen === 'lesson' && <Lesson />}
      {screen === 'quests' && <Quests />}
      {screen === 'friends' && <Friends />}
      {screen === 'phone' && <Phone />}
      {screen === 'shift' && <Shift />}
      {screen === 'prepare' && <Prepare />}
      {screen === 'wallet' && <Wallet />}
      {screen === 'letter' && <Letter />}
      {screen === 'culture' && <Culture />}
      {screen === 'beat' && <StoryBeat />}
      <ConversationHost />
      <BeatGate />
      <CultureCardHost />
      <WordSheet />
      <Toasts />
    </div>
  );
}
