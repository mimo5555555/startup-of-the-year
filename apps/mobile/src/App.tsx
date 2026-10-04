import { useEffect } from 'react';
import { useStore } from './store';
import { Onboarding } from './screens/Onboarding';
import { WorldScreen } from './screens/WorldScreen';
import { Feedback } from './screens/Feedback';
import { Vocab } from './screens/Vocab';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';
import { Lesson } from './screens/Lesson';
import { WordSheet } from './components/WordSheet';
import { Toasts } from './components/Toasts';
import { dirOf } from './i18n';
import { watchFontsReady } from './fonts';
import { unlockOnFirstGesture } from './services';

export default function App() {
  const ready = useStore((s) => s.ready);
  const screen = useStore((s) => s.screen);
  const profile = useStore((s) => s.profile);
  const lang = useStore((s) => s.uiLang);

  useEffect(() => {
    useStore.getState().hydrate();
    watchFontsReady();
    unlockOnFirstGesture();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = dirOf(lang);
  }, [lang]);

  if (!ready) return null;

  return (
    <div className="app">
      {profile && <WorldScreen />}
      {screen === 'onboarding' && <Onboarding />}
      {screen === 'feedback' && <Feedback />}
      {screen === 'vocab' && <Vocab />}
      {screen === 'stats' && <Stats />}
      {screen === 'settings' && <Settings />}
      {screen === 'lesson' && <Lesson />}
      <WordSheet />
      <Toasts />
    </div>
  );
}
