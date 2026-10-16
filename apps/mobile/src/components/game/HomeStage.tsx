// The home visit (Release 2 wave B1, docs/GAME_DESIGN.md §6.4, §8.8): the ONE entry path for a friend's home, whether it started at the
// door in the street, at the "Visit home" row of the Talk list or at Prepare. It goes inside (the 3D room, or the panel fallback when
// the room cannot load, on the low-end setting and with ?panel=1), plays the genkan (shoes off, then slippers; the other order is
// answered gently, no penalty), starts the conversation, shows the props' word cards and leaves by the door. Nothing here is saved:
// being inside is never persisted, a reload puts the player on the street.
import { useEffect, useRef, useState } from 'react';
import type { StageId, TokyoWorld } from '@lw/world';
import { DOOR_LOCKED, GENKAN_FLAG, LEXICON, tokenize, type Line } from '@lw/content';
import { BALANCE } from '@lw/game';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { useUi } from '../../ui';
import { blip, haptic } from '../../services';
import { characterById, displayName, tokenOf } from '../../content';
import { applySrsOps, dispatch, startConversation } from '../../game/bridge';
import { getGame } from '../../game/gameStore';
import { isCasual } from '../../game/friendsLogic';
import { cooldownText, genkanLine, genkanPress, panelForced, propOfPick, propsFound } from '../../game/homeLogic';
import { useHome } from '../../game/homeStore';
import { PACK } from '../../game/pack';
import type { DoorStatus } from '../../game/worldSync';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Joystick } from '../Joystick';
import { Portrait } from '../Portrait';
import { GenkanButtons, type GenkanStep } from './GenkanButtons';
import { PanelBackdrop, PropChips } from './PanelFallback';

/** How long the host's line stays up, and the pause between the last step and the conversation (long enough to read "come on up"). */
const SAY_MS = 4800;
const START_MS = 1250;

interface Said {
  key: number;
  host: string;
  line: Line;
}

export function HomeStage({ world }: { world: TokyoWorld | null }) {
  const { t, lang, dir } = useT();
  const visit = useHome((s) => s.visit);
  const screen = useStore((s) => s.screen);
  const discovered = useStore((s) => s.discovered);
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const graphics = useStore((s) => s.settings.graphics);
  const convoId = useUi((s) => s.convo?.scenarioId ?? null);
  const [said, setSaid] = useState<Said | null>(null);
  const [confirm, setConfirm] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const patch = useHome.getState().patch;

  /** Out of the room: the street, the HUD and the stick come back. Safe to call twice (the world's own `exit` event calls it too). */
  const leave = () => {
    clearTimers();
    setSaid(null);
    setConfirm(false);
    const v = useHome.getState().visit;
    world?.setMove(0, 0);
    if (v?.mode === '3d' && world?.currentStage()) {
      try {
        world.exitStage();
      } catch (e) {
        console.warn('exitStage failed', e);
      }
    }
    useHome.getState().end();
  };

  /** Leave: straight out, unless the talk was left half way (then one question: the visit pays only when it is finished) */
  const askLeave = () => {
    const v = useHome.getState().visit;
    if (v && v.phase === 'inside' && !v.done) setConfirm(true);
    else leave();
  };

  /** the conversation of the home, from the genkan and again from the room (after leaving it half way) */
  const startTalk = () => {
    const cur = useHome.getState().visit;
    if (!cur || useUi.getState().convo) return;
    setConfirm(false);
    patch({ phase: 'convo', done: false });
    startConversation({ scenarioId: cur.def.scenarioId, characterId: cur.def.host, ...(cur.talk === 'real' ? { mode: 'real' as const } : {}) });
  };

  const sayHost = (host: string, line: Line | null) => {
    if (!line) return;
    setSaid({ key: Date.now(), host, line });
    timers.current.push(setTimeout(() => setSaid((s) => (s && s.line === line ? null : s)), SAY_MS));
  };

  // ---- going in: 3D when the room loads, the panel otherwise ----
  const phase = visit?.phase;
  useEffect(() => {
    const v = useHome.getState().visit;
    if (!v || v.phase !== 'enter') return;
    // light graphics (the setting, or the world's own drop on a phone too slow for the street) means the panel, never a second WebGL scene
    const forced = panelForced(window.location.search) || graphics === 'low' || world?.getQuality() === 'low';
    let ok = false;
    if (world && !forced) {
      try {
        ok = world.enterStage(v.def.stage as StageId);
      } catch (e) {
        console.warn('enterStage failed, panel fallback', e);
      }
    }
    world?.setMove(0, 0);
    patch({ mode: ok ? '3d' : 'panel', phase: 'genkan' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, world]);

  // ---- the world's events inside a room: the genkan and the props by tap, the door by tap or by walking into it ----
  const mode = visit?.mode;
  const inVisit = !!visit && visit.phase !== 'enter';
  useEffect(() => {
    if (!world || !inVisit || mode !== '3d') return;
    return world.on((e) => {
      if (e.type === 'pick') {
        if (e.id === 'genkan:shoes') press('shoes');
        else if (e.id === 'genkan:slippers') press('slippers');
        else if (e.id === 'stage:exit') askLeave();
        else tapProp(e.id);
      } else if (e.type === 'stage' && e.phase === 'leave') askLeave();
      else if (e.type === 'stage' && e.phase === 'exit') useHome.getState().end();
    });
    // the handlers read the live store and refs, so one subscription per visit is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, inVisit, mode]);

  // ---- the conversation: while it is on the room is out of the way; when it ends we are back inside ----
  useEffect(() => {
    const v = useHome.getState().visit;
    if (!v || v.phase === 'enter') return;
    if (convoId) {
      if (convoId === v.def.scenarioId) patch({ phase: 'convo' });
      else leave(); // something else took the player away (a next-goal button): do not leave them standing in a room
    } else if (v.phase === 'convo') patch({ phase: 'inside' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoId]);

  // the debrief opened: the visit's conversation is done (the room's Leave needs no question)
  useEffect(() => {
    if (screen === 'feedback' && useHome.getState().visit) patch({ done: true });
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

  // ---- the genkan ----
  function press(which: GenkanStep) {
    const v = useHome.getState().visit;
    if (!v || v.phase !== 'genkan') return;
    const { outcome, next } = genkanPress(v, which);
    if (outcome === 'noop') return;
    const host = v.def.host;
    const casual = isCasual(PACK, getGame(), host);
    haptic(10);
    if (outcome === 'wrong') {
      blip('tap', useStore.getState().settings.autoSpeak);
      sayHost(host, genkanLine(host, 'wrong', casual));
      return;
    }
    blip('good', useStore.getState().settings.autoSpeak);
    patch({ shoesOff: next.shoesOff, slippersOn: next.slippersOn });
    if (v.mode === '3d') world?.setStageState({ shoesOff: next.shoesOff, slippersOn: next.slippersOn });
    if (outcome === 'shoes') {
      sayHost(host, genkanLine(host, 'shoesOff', casual));
      return;
    }
    sayHost(host, genkanLine(host, 'ok', casual));
    // both steps done: the flag. The visit itself (stats.visits, the objective, the genkan culture card) is filed by the reducer when the talk is
    // finished, so entering the genkan alone never counts as a visit
    dispatch({ t: 'flag', id: GENKAN_FLAG });
    later(() => {
      const cur = useHome.getState().visit;
      if (!cur || cur.phase !== 'genkan') return;
      startTalk();
    }, START_MS);
  }

  // ---- the props ----
  function tapProp(pickId: string) {
    const v = useHome.getState().visit;
    const prop = propOfPick(pickId);
    if (!v || !prop || prop.home.scenarioId !== v.def.scenarioId || v.phase === 'convo' || useUi.getState().convo) return;
    const entry = LEXICON.get(prop.surface);
    if (!entry) return;
    const st = useStore.getState();
    const fresh = st.discover(pickId);
    if (fresh) {
      // a word found in a room is a word seen: it joins the review cards like a sign does
      applySrsOps([{ op: 'add', key: prop.surface, kind: 'word', source: 'sign', dueInMin: BALANCE.srs.signDueMin }]);
      st.say(t('sign.found', { n: 2 }), 'good');
    }
    blip(fresh ? 'good' : 'tap', st.settings.autoSpeak);
    haptic(12);
    useUi.getState().openWord({ token: tokenOf(entry), source: 'sign' });
  }

  if (!visit || visit.phase === 'enter') return null;
  const host = characterById(visit.def.host);
  if (!host) return null;
  const ui = screen === 'world' && !convoId;
  const room = t(`fv.room.${visit.def.stage}` as never);
  const found = propsFound(visit.def, discovered);
  const total = visit.def.props.length;
  const talking = said?.host === visit.def.host;

  return (
    <>
      {visit.mode === 'panel' && <PanelBackdrop home={visit.def} host={host} talking={talking} />}
      {ui && (
        <div className="home-ui" dir={dir} data-home-phase={visit.phase} data-home-mode={visit.mode} data-home-stage={visit.def.stage}>
          <div className="home-top">
            <button type="button" className="icon-btn glass home-leave-x" data-home="leave-x" aria-label={t('fv.genkan.leave')} onClick={askLeave}>
              <Icon name="x" size={22} />
            </button>
            <div className="chip glass home-room" aria-label={t('home.room', { room })}>
              <Icon name="home" size={16} />
              <span dir="auto">{room}</span>
            </div>
            {visit.phase === 'inside' && (
              <div className="chip glass home-found" data-home="found">
                <Icon name="sparkle" size={14} />
                <span>{t('fv.props.found', { found, total })}</span>
              </div>
            )}
          </div>

          {said && (
            <div className="home-say glass-card" role="status" key={said.key} aria-label={t('home.host.says', { name: displayName(host, lang) })} data-home="say">
              <Portrait spec={host.avatar} size={40} talking />
              <div className="home-say-text">
                <JaText tokens={tokenize(said.line.ja, LEXICON).tokens} furigana={furigana} romaji={romaji} size="md" />
                <p dir="auto">{said.line[lang]}</p>
              </div>
            </div>
          )}

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

          {visit.phase === 'genkan' && <GenkanButtons shoesOff={visit.shoesOff} slippersOn={visit.slippersOn} onPress={press} />}

          {visit.phase === 'inside' && visit.mode === 'panel' && <PropChips home={visit.def} discovered={discovered} onTap={tapProp} />}

          {visit.phase === 'inside' && visit.mode === '3d' && <p className="home-hint glass-card">{t('fv.props.hint')}</p>}

          {visit.phase === 'inside' && (
            <div className="home-foot">
              {visit.mode === '3d' ? <Joystick onMove={(x, y) => world?.setMove(x, y)} /> : <span />}
              <div className="home-acts">
                {!visit.done && (
                  <button type="button" className="btn soft home-talk" data-home="talk" onClick={startTalk}>
                    <Icon name="message" size={20} />
                    {t('home.talk', { name: displayName(host, lang) })}
                  </button>
                )}
                <button type="button" className={`btn ${visit.done ? 'primary' : 'soft'} home-leave`} data-home="leave" onClick={askLeave}>
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

/** Why a door did not open: a friend's door by hearts or by the 3 days, the player's own flat before it is rented, the dorm after moving out. */
export type DoorTipStatus = Exclude<DoorStatus, { t: 'open' } | { t: 'none' }> | { t: 'flat_closed' } | { t: 'dorm_moved' };

/** The Japanese line of a door tip (「また今度ね」 for the wait, 「もう入れません」 for the dorm left behind, 「まだ入れません」 otherwise). */
const tipJa = (status: DoorTipStatus): string => (status.t === 'wait' ? 'また|今度|ね。' : status.t === 'dorm_moved' ? 'もう|入れません。' : DOOR_LOCKED.ja);

/** What a tap on a door says when it does not open: the Japanese 「まだ入れません」 with the reason, or how long to wait. Tap to close. */
export function DoorTip({ status, name, onClose }: { status: DoorTipStatus; name: string; onClose: () => void }) {
  const { t } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = setTimeout(() => close.current(), 5200);
    return () => clearTimeout(id);
  }, [status]);
  const text =
    status.t === 'wait'
      ? cooldownText(t, status.days)
      : status.t === 'flat_closed'
        ? t('ho.door.flat')
        : status.t === 'dorm_moved'
          ? t('ho.door.dorm')
          : t('home.door.invite', { need: status.need, have: status.have, name });
  return (
    <button type="button" className="home-tip glass-card" role="status" data-home="door-tip" data-door-status={status.t} onClick={onClose}>
      <span className="home-tip-ja">
        <JaText tokens={tokenize(tipJa(status), LEXICON).tokens} furigana={furigana} romaji={romaji} size="md" />
      </span>
      <span className="home-tip-text" dir="auto">
        {text}
      </span>
    </button>
  );
}
