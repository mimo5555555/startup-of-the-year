// The two things App mounts for the game shell: the conversation host (`useUi.convo`, §11.2) and the beat gate.
import { useEffect } from 'react';
import type { TokyoWorld } from '@lw/world';
import { WorldCtx } from '../hooks';
import { Conversation } from '../screens/Conversation';
import { useStore } from '../store';
import { useUi } from '../ui';

/** WorldScreen publishes its world here (`window.__world`); a conversation that starts from another screen reuses it. */
const currentWorld = (): TokyoWorld | null => (window as unknown as { __world?: TokyoWorld }).__world ?? null;

/**
 * Mounts the conversation a `useUi.convo` request asks for, from anywhere. Agent 2C's Conversation reads the request itself
 * (scenario, channel, mode, startNode); the world is optional for chat threads and characters without a spawn.
 */
export function ConversationHost() {
  const convo = useUi((s) => s.convo);
  const end = useUi((s) => s.endConvo);
  if (!convo) return null;
  return (
    <WorldCtx.Provider value={currentWorld()}>
      <Conversation key={`${convo.scenarioId}:${convo.startNode ?? ''}`} characterId={convo.characterId} onClose={end} />
    </WorldCtx.Provider>
  );
}

/**
 * Shows queued story beats once the player is back in the world: never over a conversation or its debrief (a beat that a
 * settled conversation caused waits for the Feedback screen to close), and the StoryBeat route plays them one after another.
 */
export function BeatGate() {
  const queued = useUi((s) => s.beats.length > 0);
  const convo = useUi((s) => s.convo);
  const screen = useStore((s) => s.screen);
  const pendingTalk = useStore((s) => s.pendingTalk);
  const hasProfile = useStore((s) => !!s.profile);
  useEffect(() => {
    if (!(queued && screen === 'world' && !convo && !pendingTalk && hasProfile)) return;
    // a word card that is still open (the sign that finished the chapter) would sit on top of the beat and swallow its taps
    useUi.getState().closeWord();
    useStore.getState().go('beat');
  }, [queued, screen, convo, pendingTalk, hasProfile]);
  return null;
}
