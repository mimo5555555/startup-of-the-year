import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { FriendCard } from '../components/game/FriendCard';
import { GiftSheet } from '../components/game/GiftSheet';
import { characterById } from '../content';
import { openScreen, startConversation } from '../game/bridge';
import { canMessage, friendRows, smalltalkOf, talkStartsAtPrepare } from '../game/friendsLogic';
import { useGameState, useGameView } from '../game/hooks';
import { PACK, beatById } from '../game/pack';
import { useT } from '../hooks';
import { useStore } from '../store';
import { useUi } from '../ui';

/** The conversation that hands a present over (content/scenarios-social.ts). */
const GIVE_GIFT = 'give_gift';

/**
 * The Friends screen (§8.6; Release 1: Mio, Yuki, Tanaka, Kenji, Sato and Hanako). Each friend is a card that opens into the Friend
 * card: hearts and "Next at ♥n", the facts learned, the perks, and Talk (small talk), Gift (the gift sheet, then the hand-over
 * conversation) and Message (the Phone, only once it is owned). Talk and the hand-over leave for the world and start the conversation
 * there, as the street does. The screen opens on the friend the interaction sheet or the quest list named (`ScreenArgs.friends`).
 */
export function Friends() {
  const { t, dir } = useT();
  const go = useStore((s) => s.go);
  const game = useGameState();
  const view = useGameView();
  const args = useUi((s) => s.args.friends);
  const rows = useMemo(() => friendRows(PACK, game, view, (id) => !!beatById(id)), [game, view]);
  const [open, setOpen] = useState<string | null>(() => (args?.friendId && rows.some((r) => r.def.id === args.friendId) ? args.friendId : (rows[0]?.def.id ?? null)));
  const [giftFor, setGiftFor] = useState<string | null>(() => (args?.gift && args.friendId && rows.some((r) => r.def.id === args.friendId) ? args.friendId : null));

  // the request is used up: coming back to the screen later opens it plain
  useEffect(() => {
    if (args) useUi.getState().setArgs('friends', {});
  }, [args]);

  const messageOpen = canMessage(PACK, game);
  const giftRow = rows.find((r) => r.def.id === giftFor);

  const talk = (friendId: string) => {
    const scenarioId = smalltalkOf(friendId);
    if (talkStartsAtPrepare(PACK, game, view, scenarioId)) {
      openScreen('prepare', { scenarioId, characterId: friendId });
      return;
    }
    go('world');
    startConversation({ scenarioId, characterId: friendId });
  };
  const handOver = (friendId: string, itemId: string) => {
    setGiftFor(null);
    go('world');
    startConversation({ scenarioId: GIVE_GIFT, characterId: friendId, itemId });
  };
  const listen = (beat: string) => {
    useUi.getState().queueBeat(beat);
    go('world');
  };

  return (
    <div className="panel frd" dir={dir} data-screen="friends">
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('social.title')}</h1>
        <span />
      </header>
      <div className="panel-body frd-body-wrap">
        {rows.length === 0 ? (
          <p className="muted center" data-friends-none>
            {t('social.none')}
          </p>
        ) : (
          <ul className="frd-list">
            {rows.map((row) => {
              const who = characterById(row.def.id);
              if (!who) return null;
              return (
                <FriendCard
                  key={row.def.id}
                  row={row}
                  who={who}
                  open={open === row.def.id}
                  onToggle={() => setOpen(open === row.def.id ? null : row.def.id)}
                  messageOpen={messageOpen}
                  onTalk={() => talk(row.def.id)}
                  onGift={() => setGiftFor(row.def.id)}
                  onMessage={() => openScreen('phone', { friendId: row.def.id })}
                  onListen={listen}
                />
              );
            })}
          </ul>
        )}
      </div>
      {giftRow && characterById(giftRow.def.id) && (
        <GiftSheet who={characterById(giftRow.def.id)!} actions={giftRow.actions} onHandOver={(itemId) => handOver(giftRow.def.id, itemId)} onClose={() => setGiftFor(null)} />
      )}
    </div>
  );
}
