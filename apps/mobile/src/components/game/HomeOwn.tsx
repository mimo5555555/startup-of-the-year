// The player's own room (Release 2 wave B2, docs/GAME_DESIGN.md §8.8, D12, D23): the dorm, and the Ono-sō flat once it is rented. It is the sibling of
// `HomeStage` for a friend's home and uses the same stage engine: 3D when the room loads, the panel fallback otherwise. No host and no genkan
// conversation (the flat's first entry plays the shoes/slippers steps, then files the visit that collects the culture card), the Furnish sheet
// (FurniturePlacer) with the slot markers in the 3D room, and the housewarming: a friend of the player stands in the room and the conversation
// `home_own_guest` is played with the learner as the host. Nothing here is saved: being inside is never persisted (a reload puts the player on
// the street); the furniture itself is `home.placed` in the game save.
import { useEffect, useRef, useState } from 'react';
import type { StageId, TokyoWorld } from '@lw/world';
import { parseSlotPick } from '@lw/world';
import { FURNITURE, GENKAN_FLAG, OWN_GUEST, OWN_ROOMS } from '@lw/content';
import { useT } from '../../hooks';
import type { StringKey } from '../../i18n';
import { useStore } from '../../store';
import { useUi } from '../../ui';
import { blip, haptic } from '../../services';
import { characterById, displayName } from '../../content';
import { dispatch, startConversation } from '../../game/bridge';
import { getGame } from '../../game/gameStore';
import { useGameState } from '../../game/hooks';
import { genkanPress, panelForced } from '../../game/homeLogic';
import { comfortInfo, firstEntry, pieceRows, worldPlaced } from '../../game/ownLogic';
import { useOwn } from '../../game/ownStore';
import { PACK } from '../../game/pack';
import { Icon } from '../Icon';
import { Joystick } from '../Joystick';
import { FurniturePlacer } from './FurniturePlacer';
import { GenkanButtons, type GenkanStep } from './GenkanButtons';
import { OwnPanel } from './HomeSlots';

/** The pause between standing in the room and the guest's first line (long enough to see the friend in the room). */
const GUEST_MS = 1200;

export function HomeOwn({ world }: { world: TokyoWorld | null }) {
  const { t, lang, dir } = useT();
  const room = useOwn((s) => s.room);
  const game = useGameState();
  const screen = useStore((s) => s.screen);
  const graphics = useStore((s) => s.settings.graphics);
  const convoId = useUi((s) => s.convo?.scenarioId ?? null);
  const [confirm, setConfirm] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** whether the housewarming flag was already up when the talk began (the toast is for the first one) */
  const flagBefore = useRef(false);
  const patch = useOwn.getState().patch;

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /** Out of the room: the street, the HUD and the stick come back. Safe to call twice (the world's own `exit` event calls it too). */
  const leave = () => {
    clearTimers();
    setConfirm(false);
    const r = useOwn.getState().room;
    world?.setMove(0, 0);
    if (r?.mode === '3d' && world?.currentStage()) {
      try {
        world.setStageState({ showSlots: false, slotFocus: null });
        world.exitStage();
      } catch (e) {
        console.warn('exitStage failed', e);
      }
    }
    useOwn.getState().end();
  };

  /** Leave: straight out, unless the housewarming was left half way (then one question: it pays only when it is finished). */
  const askLeave = () => {
    const r = useOwn.getState().room;
    if (r && r.phase === 'inside' && r.guest && !r.done && r.talkStarted) setConfirm(true);
    else leave();
  };

  /** the housewarming conversation, with the guest standing in the room */
  const startTalk = () => {
    const r = useOwn.getState().room;
    if (!r?.guest || useUi.getState().convo) return;
    setConfirm(false);
    world?.setMove(0, 0);
    flagBefore.current = getGame().chapter.flags.includes(OWN_GUEST.flag);
    patch({ phase: 'convo', done: false, furnish: false, talkStarted: true });
    startConversation({ scenarioId: OWN_GUEST.scenarioId, characterId: r.guest, ...(r.talk === 'real' ? { mode: 'real' as const } : {}) });
  };

  /** the first entry of a room is filed once (the flat's files the culture card `cc_trash`); a repeat changes nothing */
  const fileVisit = (tier: 'dorm' | 'ono') => dispatch({ t: 'visit', place: OWN_ROOMS[tier].visit });

  // ---- going in: 3D when the room loads, the panel otherwise ----
  const phase = room?.phase;
  useEffect(() => {
    const r = useOwn.getState().room;
    if (!r || r.phase !== 'enter') return;
    const g = getGame();
    // your own flat has a genkan too: the first time, the shoes come off (the dorm and a housewarming go straight in)
    const genkan = r.tier === 'ono' && !r.guest && firstEntry(g);
    // light graphics (the setting, or the world's own drop on a phone too slow for the street) means the panel, never a second WebGL scene
    const forced = panelForced(window.location.search) || graphics === 'low' || world?.getQuality() === 'low';
    let ok = false;
    if (world && !forced) {
      try {
        ok = world.enterStage(r.stage as StageId, {
          state: genkan ? {} : { shoesOff: true, slippersOn: true },
          placed: worldPlaced(g),
          ...(r.guest ? { guest: r.guest } : {}),
        });
      } catch (e) {
        console.warn('enterStage failed, panel fallback', e);
      }
    }
    world?.setMove(0, 0);
    patch({ mode: ok ? '3d' : 'panel', phase: genkan ? 'genkan' : 'inside', shoesOff: !genkan, slippersOn: !genkan });
    if (!genkan) fileVisit(r.tier);
    if (r.guest) later(() => useOwn.getState().room?.phase === 'inside' && startTalk(), GUEST_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, world]);

  // ---- the genkan of the flat ----
  function press(which: GenkanStep) {
    const r = useOwn.getState().room;
    if (!r || r.phase !== 'genkan') return;
    const { outcome, next } = genkanPress(r, which);
    if (outcome === 'noop') return;
    haptic(10);
    const st = useStore.getState();
    if (outcome === 'wrong') {
      blip('tap', st.settings.autoSpeak);
      st.say(t('ho.genkan.wrong'));
      return;
    }
    blip('good', st.settings.autoSpeak);
    patch({ shoesOff: next.shoesOff, slippersOn: next.slippersOn });
    if (r.mode === '3d') world?.setStageState({ shoesOff: next.shoesOff, slippersOn: next.slippersOn });
    if (outcome === 'shoes') return;
    dispatch({ t: 'flag', id: GENKAN_FLAG });
    fileVisit(r.tier);
    later(() => {
      if (useOwn.getState().room?.phase === 'genkan') patch({ phase: 'inside' });
    }, 500);
  }

  // ---- placing furniture ----
  const say = (key: StringKey, vars?: Record<string, string | number>, tone: 'good' | 'info' = 'info') => {
    const st = useStore.getState();
    st.say(t(key, vars), tone === 'good' ? 'good' : undefined);
  };
  const nameOf = (id: string) => PACK.items.find((i) => i.id === id)?.name[lang] ?? id;
  const slotName = (slot: string) => t(`ho.slot.${slot}` as StringKey);

  /** puts an owned piece in its slot; the room redraws from the new state (the effect below) */
  const putIn = (slot: string, itemId: string) => {
    const r = dispatch({ t: 'item_placed', slot, itemId });
    if (r.state.home.placed[slot] !== itemId) return false;
    haptic(14);
    blip('good', useStore.getState().settings.autoSpeak);
    say('ho.furnish.placed', { item: nameOf(itemId) }, 'good');
    return true;
  };

  /** a tap on a place (the list or the marker in the room): the picked piece goes there, a piece standing there is taken out, an empty place with one fitting piece fills */
  const tapSlot = (slot: string) => {
    const r = useOwn.getState().room;
    if (!r || !r.furnish) return;
    const g = getGame();
    const standing = g.home.placed[slot];
    if (r.pick) {
      const f = FURNITURE[r.pick];
      if (!f || f.slot !== slot) {
        blip('tap', useStore.getState().settings.autoSpeak);
        say('ho.furnish.wrong', { item: nameOf(r.pick), slot: f ? slotName(f.slot) : slotName(slot) });
        return;
      }
      if (putIn(slot, r.pick)) patch({ pick: null });
      return;
    }
    if (standing) {
      const out = dispatch({ t: 'item_placed', slot, itemId: null });
      if (slot in out.state.home.placed) return;
      haptic(10);
      blip('tap', useStore.getState().settings.autoSpeak);
      say('ho.furnish.removed', { item: nameOf(standing) });
      return;
    }
    const ready = pieceRows(PACK, g).find((p) => p.state === 'ready' && p.slot === slot);
    if (ready) putIn(slot, ready.id);
    else say('ho.furnish.hint');
  };

  const tapPiece = (id: string | null) => {
    haptic(8);
    blip('tap', useStore.getState().settings.autoSpeak);
    patch({ pick: id });
  };

  const openFurnish = () => {
    // the stick goes away with the footer: a thumb still on it (a second finger tapped Furnish) must not leave the player walking
    world?.setMove(0, 0);
    patch({ furnish: true, pick: null });
    blip('tap', useStore.getState().settings.autoSpeak);
  };
  const closeFurnish = () => patch({ furnish: false, pick: null });

  // ---- the world's events inside a room: the genkan by tap, the slot markers while furnishing, the door by tap or by walking into it ----
  const mode = room?.mode;
  const inRoom = !!room && room.phase !== 'enter';
  useEffect(() => {
    if (!world || !inRoom || mode !== '3d') return;
    return world.on((e) => {
      if (e.type === 'pick') {
        if (e.id === 'genkan:shoes') press('shoes');
        else if (e.id === 'genkan:slippers') press('slippers');
        else if (e.id === 'stage:exit') askLeave();
        else {
          const slot = parseSlotPick(e.id);
          if (slot) tapSlot(slot);
        }
      } else if (e.type === 'stage' && e.phase === 'leave') askLeave();
      else if (e.type === 'stage' && e.phase === 'exit') useOwn.getState().end();
    });
    // the handlers read the live stores and refs, so one subscription per visit is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, inRoom, mode]);

  // the room redraws live: a piece placed, taken out, delivered or sold changes `home.placed` and the stage follows
  const placedKey = JSON.stringify(worldPlaced(game));
  useEffect(() => {
    if (mode === '3d' && inRoom) world?.setStagePlaced(worldPlaced(getGame()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedKey, world, mode, inRoom]);

  // the slot markers: on while the Furnish sheet is open, the slot of the picked piece in pink
  const furnish = !!room?.furnish;
  const pick = room?.pick ?? null;
  useEffect(() => {
    if (mode !== '3d' || !inRoom) return;
    world?.setStageState({ showSlots: furnish, slotFocus: furnish && pick ? (FURNITURE[pick]?.slot ?? null) : null });
  }, [world, mode, inRoom, furnish, pick]);

  // ---- the conversation: while it is on the room is out of the way; when it ends we are back inside ----
  useEffect(() => {
    const r = useOwn.getState().room;
    if (!r || r.phase === 'enter') return;
    if (convoId) {
      if (convoId === OWN_GUEST.scenarioId) patch({ phase: 'convo' });
      else leave(); // something else took the player away (a next-goal button): do not leave them standing in a room
    } else if (r.phase === 'convo') patch({ phase: 'inside' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoId]);

  // the debrief opened: the housewarming is done (Leave needs no question) and the first one is celebrated
  useEffect(() => {
    const r = useOwn.getState().room;
    if (screen !== 'feedback' || !r?.guest) return;
    patch({ done: true });
    if (!flagBefore.current && getGame().chapter.flags.includes(OWN_GUEST.flag)) {
      flagBefore.current = true;
      useStore.getState().say(t('ho.guest.done'), 'good');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // the tab goes to the background with a finger on the stick: nothing keeps walking
  useEffect(() => {
    const stop = () => world?.setMove(0, 0);
    const onVis = () => document.visibilityState === 'hidden' && stop();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', stop);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', stop);
      clearTimers();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  if (!room || room.phase === 'enter') return null;
  const guest = room.guest ? (characterById(room.guest) ?? null) : null;
  const ui = screen === 'world' && !convoId;
  const roomName = t(`ho.room.${room.stage}` as StringKey);
  const c = comfortInfo(PACK, game);
  const hasPieces = pieceRows(PACK, game).some((p) => p.state !== 'placed');

  return (
    <>
      {room.mode === 'panel' && <OwnPanel stage={room.stage} state={game} guest={guest} talking={room.phase === 'convo'} />}
      {ui && (
        <div className="home-ui own-ui" dir={dir} data-own-phase={room.phase} data-own-mode={room.mode} data-own-stage={room.stage} data-own-tier={room.tier}>
          <div className="home-top">
            <button type="button" className="icon-btn glass home-leave-x" data-home="leave-x" aria-label={t('fv.genkan.leave')} onClick={askLeave}>
              <Icon name="x" size={22} />
            </button>
            <div className="chip glass home-room" data-own="room" aria-label={t('home.room', { room: roomName })}>
              <Icon name="home" size={16} />
              <span dir="auto">{roomName}</span>
            </div>
            <div className="chip glass home-found" data-own="comfort" data-comfort={c.value}>
              <Icon name="sparkle" size={14} />
              <span>{t('ho.comfort', { n: c.value, max: c.max })}</span>
            </div>
          </div>

          {confirm && (
            <div className="home-confirm glass-card" role="alertdialog" data-home="confirm" aria-label={t('home.leave.ask')}>
              <p>{t('home.leave.ask')}</p>
              <div className="home-confirm-btns">
                <button type="button" className="btn soft" data-home="stay" onClick={() => setConfirm(false)}>
                  {t('home.stay')}
                </button>
                <button type="button" className="btn primary" data-home="leave-anyway" onClick={leave}>
                  {t('fv.genkan.leave')}
                </button>
              </div>
            </div>
          )}

          {room.phase === 'genkan' && <GenkanButtons shoesOff={room.shoesOff} slippersOn={room.slippersOn} onPress={press} />}

          {room.phase === 'inside' && room.furnish && <FurniturePlacer pick={room.pick} onPick={tapPiece} onSlot={tapSlot} onClose={closeFurnish} />}

          {room.phase === 'inside' && !room.furnish && room.mode === '3d' && <p className="home-hint glass-card">{guest ? t('ho.room.guest', { name: displayName(guest, lang) }) : t('ho.room.hint')}</p>}

          {room.phase === 'inside' && !room.furnish && (
            <div className="home-foot">
              {room.mode === '3d' ? <Joystick onMove={(x, y) => world?.setMove(x, y)} /> : <span />}
              <div className="home-acts">
                {guest && !room.done && (
                  <button type="button" className="btn soft home-talk" data-home="talk" onClick={startTalk}>
                    <Icon name="message" size={20} />
                    {t('home.talk', { name: displayName(guest, lang) })}
                  </button>
                )}
                <button type="button" className={`btn ${hasPieces ? 'primary' : 'soft'} own-furnish`} data-own="furnish-open" onClick={openFurnish}>
                  <Icon name="flat" size={20} />
                  {t('ho.furnish')}
                </button>
                <button type="button" className={`btn ${room.done ? 'primary' : 'soft'} home-leave`} data-home="leave" onClick={askLeave}>
                  <Icon name="walk" size={20} />
                  {t('fv.genkan.leave')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
