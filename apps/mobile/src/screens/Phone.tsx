import { useEffect, useMemo, useState } from 'react';
import type { TokyoWorld } from '@lw/world';
import { BALANCE } from '@lw/game';
import { MapList, type GoalPin } from '../components/game/MapList';
import { PhoneFrame, type PhoneTab } from '../components/game/PhoneFrame';
import { Thread } from '../components/game/Thread';
import { Portrait } from '../components/Portrait';
import { characterById, displayName } from '../content';
import { startConversation } from '../game/bridge';
import { canMessage } from '../game/friendsLogic';
import { useGameState, useTracker } from '../game/hooks';
import { PACK } from '../game/pack';
import { chatFlags, mapPins, openerLine, runnableThreads, threadRows, totalUnread, type ThreadRow } from '../game/phoneLogic';
import { approachPoint, goalTarget } from '../game/worldSync';
import { useT } from '../hooks';
import { useStore } from '../store';
import { useUi } from '../ui';

/**
 * The phone (§8.7, D17): Messages (a row per friend with the threads waiting, then the friend's thread, whose Reply opens the text
 * conversation) and Map pins. Both turn on the moment a phone is owned; without one the screen says where to buy it. A thread is
 * answered in the ordinary conversation screen on the `chat` channel, laid over this screen, so leaving it lands back here.
 */
export function Phone() {
  const { t, lang } = useT();
  const go = useStore((s) => s.go);
  const game = useGameState();
  const goal = useTracker();
  const args = useUi((s) => s.args.phone);
  const rows = useMemo(() => threadRows(PACK, game), [game]);
  const [tab, setTab] = useState<PhoneTab>('messages');
  const [open, setOpen] = useState<string | null>(() => (args?.friendId && rows.some((r) => r.friendId === args.friendId) ? args.friendId : null));

  // the request is used up: coming back to the phone later opens the list
  useEffect(() => {
    // (an empty request from the HUD is left alone: replacing it would be a new object, and so another render)
    if (args?.friendId) useUi.getState().setArgs('phone', {});
  }, [args]);

  const unread = totalUnread(rows);
  const owned = canMessage(PACK, game);
  const openRow = open ? rows.find((r) => r.friendId === open) : undefined;
  const openWho = openRow ? characterById(openRow.friendId) : undefined;

  const reply = (friendId: string, template: string) => startConversation({ scenarioId: template, characterId: friendId, channel: 'chat' });
  const walk = (friendId: string) => {
    const p = approachPoint(friendId);
    const world = (window as unknown as { __world?: TokyoWorld }).__world;
    go('world');
    if (p && world) world.walkTo(p.x, p.z);
  };

  const target = goalTarget(goal);
  const goalPin: GoalPin | null = goal && target?.t === 'npc' && characterById(target.id) ? { friendId: target.id, title: goal.text[lang] } : null;

  if (!owned) {
    return (
      <PhoneFrame title={t('phone.title')} onBack={() => go('world')} backLabel={t('common.back')} tab="messages">
        <p className="ph-note" data-phone-locked>
          {t('phone.needsPhone')}
        </p>
      </PhoneFrame>
    );
  }

  if (openRow && openWho) {
    return (
      <PhoneFrame
        title={displayName(openWho, lang)}
        sub={t('phone.chatSub')}
        onBack={() => setOpen(null)}
        backLabel={t('phone.back')}
        tab="messages"
        onTab={(next) => {
          setOpen(null);
          setTab(next);
        }}
        unread={unread}
      >
        <Thread who={openWho} row={openRow} flags={chatFlags(PACK, game, openRow.friendId)} onReply={(template) => reply(openRow.friendId, template)} />
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame
      title={tab === 'map' ? t('phone.map.title') : t('phone.title')}
      onBack={() => go('world')}
      backLabel={t('common.back')}
      tab={tab}
      onTab={setTab}
      unread={unread}
    >
      {tab === 'map' ? (
        <MapList pins={mapPins(PACK, game)} goal={goalPin} onWalk={walk} />
      ) : (
        <ul className="ph-list" data-thread-list>
          {rows.map((r) => (
            <ThreadItem key={r.friendId} row={r} flags={chatFlags(PACK, game, r.friendId)} onOpen={() => setOpen(r.friendId)} />
          ))}
        </ul>
      )}
    </PhoneFrame>
  );
}

/** One row of the thread list: who, the first words of the oldest waiting message (or why there is none) and the unread badge. */
function ThreadItem({ row, flags, onOpen }: { row: ThreadRow; flags: Record<string, boolean>; onOpen(): void }) {
  const { t, lang } = useT();
  const who = characterById(row.friendId);
  if (!who) return null;
  const waiting = row.open ? runnableThreads(row) : [];
  const first = waiting[0] ? openerLine(waiting[0].template, flags) : undefined;
  const preview = first ? (
    <span className="ph-preview ja-preview" lang="ja" dir="ltr">
      {first.tokens.map((k) => k.s).join('')}
    </span>
  ) : (
    <span className="ph-preview muted">{row.open ? t('phone.noneWaiting') : t('phone.needHearts', { n: BALANCE.ap.chat.minHeart })}</span>
  );
  return (
    <li>
      <button className={`ph-row${waiting.length ? ' unread' : ''}`} data-friend-row={row.friendId} data-unread={waiting.length} onClick={onOpen}>
        <Portrait spec={who.avatar} size={48} />
        <span className="ph-row-text">
          <strong>{displayName(who, lang)}</strong>
          {preview}
        </span>
        {waiting.length > 0 && (
          <span className="ph-badge" aria-label={t('phone.unread', { n: waiting.length })}>
            {waiting.length}
          </span>
        )}
      </button>
    </li>
  );
}
