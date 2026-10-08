import { useEffect, useMemo, useRef, useState } from 'react';
import { TokyoWorld } from '@lw/world';
import { CHARACTERS, SIGNS, SCENARIOS } from '@lw/content';
import { levelProgress } from '@lw/core';
import { WorldCtx, useT } from '../hooks';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { Joystick } from '../components/Joystick';
import { MiniMap } from '../components/MiniMap';
import { Portrait } from '../components/Portrait';
import { DreamChip } from '../components/game/DreamChip';
import { GameMenu } from '../components/game/GameMenu';
import { GoodsSheet } from '../components/game/GoodsSheet';
import { InteractionSheet, runPlan } from '../components/game/InteractionSheet';
import { TrackerCard } from '../components/game/TrackerCard';
import { WalletPill } from '../components/game/WalletPill';
import { TicketPanel } from './TicketPanel';
import { VendingPanel } from './VendingPanel';
import { TOTAL_SIGNS, characterById, displayName, entryForSign, npcLabels, registeredLessonIds, registeredScenarioIds, tokenOf } from '../content';
import { useUi } from '../ui';
import { blip, haptic } from '../services';
import { dispatch, openScreen } from '../game/bridge';
import { useDisclosure, useGameState, useGameView, useTracker } from '../game/hooks';
import { PACK, shopById } from '../game/pack';
import {
  approachPoint,
  doorOpens,
  goalTarget,
  goodsShopOf,
  hudElements,
  interactionRows,
  keeperOf,
  legacyGoal,
  legacyPlan,
  needsSheet,
  openRows,
  pinOf,
  planFor,
  routePick,
  syncWorld,
  type InteractionEnv,
  type Plan,
  type PickRoute,
} from '../game/worldSync';

/** What the player is looking at over the world: the NPC's options, a shop front, or Hanako's lesson list. */
type Sheet = { kind: 'npc'; id: string; lessonsOnly?: boolean } | { kind: 'shop'; id: string };

export function WorldScreen() {
  const { t, lang, dir } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<TokyoWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const [nearby, setNearby] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [goods, setGoods] = useState<{ shopId: string; window: boolean } | null>(null);
  const [panel, setPanel] = useState<{ t: 'vending' } | { t: 'ticket'; kind: 'ramen' | 'station' } | null>(null);

  const screen = useStore((s) => s.screen);
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const completed = useStore((s) => s.completed);
  const lessonsDone = useStore((s) => s.lessonsDone);
  const discovered = useStore((s) => s.discovered);
  const settings = useStore((s) => s.settings);
  const pendingTalk = useStore((s) => s.pendingTalk);
  const go = useStore((s) => s.go);
  const discover = useStore((s) => s.discover);
  const say = useStore((s) => s.say);
  const updateSettings = useStore((s) => s.updateSettings);
  const openWord = useUi((s) => s.openWord);
  const inConvo = useUi((s) => !!s.convo);

  // ---- game state the HUD reads ----
  const game = useGameState();
  const view = useGameView();
  const disclosure = useDisclosure();
  const tracked = useTracker();
  const scenarios = useMemo(registeredScenarioIds, []);
  const lessons = useMemo(registeredLessonIds, []);
  const env: InteractionEnv = useMemo(() => ({ pack: PACK, state: game, view, scenarios, lessons }), [game, view, scenarios, lessons]);
  const envRef = useRef(env);
  envRef.current = env;
  const elements = hudElements(disclosure);
  const unread = Object.values(game.friends).reduce((n, f) => n + (f.unread ?? 0), 0);

  // ---- create the 3D world once ----
  useEffect(() => {
    let w: TokyoWorld | null = null;
    try {
      const mode = useStore.getState().settings.graphics;
      w = new TokyoWorld({
        canvas: canvasRef.current!,
        characters: CHARACTERS,
        playerSpec: useStore.getState().profile!.avatar,
        quality: mode === 'auto' ? 'auto' : mode,
        labels: npcLabels(useStore.getState().uiLang),
      });
      w.start();
      setWorld(w);
      (window as unknown as { __world?: TokyoWorld }).__world = w;
    } catch (e) {
      console.error('3D view failed', e);
      setFailed(true);
    }
    return () => {
      w?.dispose();
    };
  }, []);

  /** Carries out a plan; a window plan opens the read-only Goods sheet over the world. */
  const run = (plan: Plan) => {
    setSheet(null);
    setMenu(false);
    if (plan.t === 'window') setGoods({ shopId: plan.shopId, window: true });
    else runPlan(plan);
  };

  /** Panels, doors and shop fronts are routed game first (§7.6); returns whether the pick was taken. */
  const routePicked = (id: string, route: PickRoute): boolean => {
    if (!route) return false;
    const e = envRef.current;
    if (route.t === 'vending' || route.t === 'ticket') {
      // the panel's first open grants the sign discovery and its word card, so nothing of the old behaviour is lost
      const entry = entryForSign(id);
      if (entry && discover(id)) {
        blip('good', useStore.getState().settings.autoSpeak);
        haptic(12);
        openWord({ token: tokenOf(entry), source: 'sign' });
      }
      setPanel(route.t === 'vending' ? { t: 'vending' } : { t: 'ticket', kind: route.kind });
    } else if (route.t === 'door') {
      const row = route.friend ? interactionRows(e, route.friend).find((r) => r.it.kind === 'visit') : undefined;
      if (route.friend && row && doorOpens(e, route.friend)) run(planFor(e, row.it, route.friend));
      else say(t('hud.doorLocked'));
    } else {
      const shop = shopById(route.shopId);
      if (!shop) return false;
      if (e.state.chapter.n >= shop.openChapter) setGoods({ shopId: shop.id, window: false });
      else setSheet({ kind: 'shop', id: shop.id });
    }
    return true;
  };

  // ---- world events ----
  useEffect(() => {
    if (!world) return;
    return world.on((e) => {
      if (e.type === 'nearby') setNearby(e.id);
      else if (e.type === 'pick') {
        if (routePicked(e.id, routePick(e.id))) return;
        const entry = entryForSign(e.id);
        if (!entry) return;
        const fresh = discover(e.id);
        blip(fresh ? 'good' : 'tap', useStore.getState().settings.autoSpeak);
        haptic(12);
        openWord({ token: tokenOf(entry), source: 'sign' });
        if (fresh) say(t('sign.found', { n: 2 }), 'good');
      } else if (e.type === 'spot') {
        // `stats.spots` keeps the id without the world's prefix (objective `visit spot:pond`)
        dispatch({ t: 'spot', id: e.id.replace(/^spot:/, '') });
      } else if (e.type === 'quality' && e.quality === 'low') say(t('w.lowFps'));
    });
    // routePicked reads everything through refs and stable store actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, t, discover, openWord, say]);

  // keep the 3D scene in step with app state
  useEffect(() => {
    if (!world) return;
    world.setActive(screen === 'world');
  }, [world, screen]);
  useEffect(() => {
    world?.setDiscovered(discovered);
  }, [world, discovered]);
  useEffect(() => {
    world?.setNpcLabels(npcLabels(lang));
  }, [world, lang]);
  useEffect(() => {
    world?.setQualityMode(settings.graphics);
  }, [world, settings.graphics]);
  // shutters by chapter, NPC badges (lesson / new / done / locked), ride and speed
  useEffect(() => {
    if (world) syncWorld(world, env, { completed, lessonsDone });
  }, [world, env, completed, lessonsDone]);

  /** What Talk does: the one open option directly, or the sheet when there are several (§6.1). */
  const talk = (id: string) => {
    const c = characterById(id);
    if (!c) return;
    setMenu(false);
    const rows = interactionRows(env, id);
    const open = openRows(rows);
    if (needsSheet(rows) || (open.length === 0 && rows.length > 0)) {
      setSheet({ kind: 'npc', id });
      return;
    }
    if (open.length === 1) {
      run(planFor(env, open[0].it, id));
      return;
    }
    // no table for this character: what Talk always did
    const plan = legacyPlan(c);
    if (plan) run(plan);
  };

  // "practise again" from the feedback screen
  useEffect(() => {
    if (!world || !pendingTalk) return;
    world.teleportNear(pendingTalk);
    useStore.getState().setPendingTalk(null);
    const c = characterById(pendingTalk);
    const plan = c && legacyPlan(c);
    if (plan) run(plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, pendingTalk]);

  const busy = inConvo || !!sheet || !!goods || !!panel;
  // E or Enter talks to whoever is closest
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key.toLowerCase() === 'e' || e.key === 'Enter') && nearby && !busy && screen === 'world' && (e.target as HTMLElement)?.tagName !== 'INPUT') talk(nearby);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const lvl = levelProgress(xp);
  const due = view.vocab.dueCount;

  // the tracker: the pack's next best goal (locked until done), else the first unfinished stop of the original tour
  const goal = tracked ?? legacyGoal(completed, lessonsDone);
  const walkToNpc = (id: string) => {
    const p = approachPoint(id);
    if (p && world) world.walkTo(p.x, p.z);
  };
  const goToGoal = () => {
    const target = goalTarget(goal);
    blip('tap', settings.autoSpeak);
    if (target?.t === 'npc') walkToNpc(target.id);
    else if (target?.t === 'point') world?.walkTo(target.x, target.z);
    else if (target?.t === 'screen' && target.screen === 'vocab') go('vocab');
    else openScreen('quests', { tab: target?.t === 'screen' ? target.tab : undefined });
  };

  /** Menu > Lessons: the one lesson directly, Hanako's lesson list when there are several. */
  const talkLessons = () => {
    const rows = openRows(interactionRows(env, 'hanako').filter((r) => r.it.kind === 'lesson'));
    setMenu(false);
    if (rows.length === 1) run(planFor(env, rows[0].it, 'hanako'));
    else setSheet({ kind: 'npc', id: 'hanako', lessonsOnly: true });
  };

  const nearChar = nearby ? characterById(nearby) : null;
  const nearGoods = nearChar ? goodsShopOf(PACK, nearChar.id) : null;
  const found = discovered.filter((d) => SIGNS.some((s) => s.id === d)).length;

  // what the sheet shows
  const sheetChar = sheet?.kind === 'npc' ? characterById(sheet.id) : sheet ? characterById(keeperOf(sheet.id) ?? '') : undefined;
  const sheetShop = sheet?.kind === 'shop' ? shopById(sheet.id) : undefined;
  const sheetRows = !sheet
    ? []
    : sheet.kind === 'npc'
      ? interactionRows(env, sheet.id).filter((r) => !sheet.lessonsOnly || r.it.kind === 'lesson')
      : sheetChar
        ? interactionRows(env, sheetChar.id).filter((r) => r.it.kind === 'window')
        : [];

  return (
    <WorldCtx.Provider value={world}>
      <div className="world" dir={dir}>
        <canvas ref={canvasRef} className="world-canvas" />

        {failed && (
          <div className="world-error">
            <h2>{t('w.noWebgl')}</h2>
            <p>{t('w.noWebgl.sub')}</p>
          </div>
        )}

        {world && !inConvo && screen === 'world' && (
          <div className="hud">
            <div className="hud-top">
              <div className="hud-left">
                <div className="hud-row">
                  <button className="icon-btn glass" aria-label={t('w.menu')} aria-expanded={menu} onClick={() => setMenu(!menu)}>
                    <Icon name={menu ? 'x' : 'menu'} size={22} />
                    {due > 0 && !menu && <span className="dot-badge">{due}</span>}
                  </button>
                  {elements.includes('level') && (
                    <>
                      <div className="chip glass lvl" title={t('s.xp', { n: xp })}>
                        <span className="lvl-n">{t('w.level', { n: lvl.level })}</span>
                        <span className="bar">
                          <i style={{ width: `${Math.round(lvl.fraction * 100)}%` }} />
                        </span>
                      </div>
                      <div className={`chip glass flame ${streak.days > 0 ? 'on' : ''}`} title={t('s.streak')}>
                        <Icon name="flame" size={16} />
                        <span>{streak.days}</span>
                      </div>
                    </>
                  )}
                  {elements.includes('phone') && (
                    <button className="icon-btn glass hud-phone" aria-label={t('hud.phone')} onClick={() => openScreen('phone', {})}>
                      <Icon name="phone" size={22} />
                      {unread > 0 && <span className="dot-badge">{unread}</span>}
                    </button>
                  )}
                </div>
                <WalletPill />
                {elements.includes('dream') && <DreamChip />}
              </div>
              <div className="hud-right">
                <MiniMap world={world} pin={pinOf(goal)} />
                {elements.includes('found') && (
                  <div className="found glass chip" title={t('w.found', { n: found, total: TOTAL_SIGNS })}>
                    <Icon name="sparkle" size={14} /> {found}/{TOTAL_SIGNS}
                  </div>
                )}
              </div>
            </div>

            {menu && <GameMenu showLevel={!elements.includes('level')} onClose={() => setMenu(false)} onLessons={() => talkLessons()} />}

            {/* always on the HUD (§7.5): the old "next up" card hid itself next to an NPC, but the tracker is the one thing that must stay */}
            {goal && <TrackerCard goal={goal} onGo={goToGoal} />}
            {!goal && (
              <div className="next-up glass-card static">
                <span className="next-text">
                  <strong>{t('f.again')}</strong>
                </span>
              </div>
            )}

            <div className="hud-bottom">
              <Joystick onMove={(x, y) => world.setMove(x, y)} />
              {nearChar && (
                <div className="hud-talk">
                  {nearGoods && (
                    <button className="icon-btn glass hud-goods-btn" aria-label={t('shop.goods')} onClick={() => setGoods({ shopId: nearGoods, window: false })}>
                      <Icon name="bag" size={22} />
                    </button>
                  )}
                  <button className="talk-btn" dir={dir} onClick={() => talk(nearChar.id)}>
                    <Portrait spec={nearChar.avatar} size={46} />
                    <span>
                      <small>{nearChar.lessonId ? t('w.lesson', { name: '' }).trim() : t('w.talk', { name: '' }).trim()}</small>
                      <strong>{displayName(nearChar, lang)}</strong>
                    </span>
                    <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={22} />
                  </button>
                </div>
              )}
            </div>

            {!settings.seenTutorial && (
              <div className="tip glass-card" role="dialog">
                <h3>{t('w.tip.title')}</h3>
                <ul>
                  <li>{t('w.tip.walk')}</li>
                  <li>{t('w.tip.look')}</li>
                  <li>{t('w.tip.tap')}</li>
                  <li>{t('w.tip.talk')}</li>
                </ul>
                <button className="btn primary" onClick={() => updateSettings({ seenTutorial: true })}>
                  {t('w.tip.go')}
                </button>
              </div>
            )}
          </div>
        )}

        {world && !inConvo && screen === 'world' && sheet && (
          <InteractionSheet
            character={sheetChar && sheet.kind === 'npc' ? sheetChar : undefined}
            shopName={sheetShop?.name}
            rows={sheetRows}
            closedUntil={sheetShop && env.state.chapter.n < sheetShop.openChapter ? sheetShop.openChapter : undefined}
            hasGoods={sheet.kind === 'npc' && !sheet.lessonsOnly && !!goodsShopOf(PACK, sheet.id)}
            onPick={(row) => run(planFor(env, row.it, sheetChar?.id ?? ''))}
            onGoods={() => {
              const shopId = sheet.kind === 'npc' ? goodsShopOf(PACK, sheet.id) : null;
              setSheet(null);
              if (shopId) setGoods({ shopId, window: false });
            }}
            onClose={() => setSheet(null)}
          />
        )}
        {goods && screen === 'world' && <GoodsSheet shopId={goods.shopId} window={goods.window} onClose={() => setGoods(null)} />}
        {panel?.t === 'vending' && screen === 'world' && <VendingPanel onClose={() => setPanel(null)} />}
        {panel?.t === 'ticket' && screen === 'world' && <TicketPanel kind={panel.kind} onClose={() => setPanel(null)} />}
      </div>
    </WorldCtx.Provider>
  );
}

export { SCENARIOS };
