import { useEffect, useMemo, useRef, useState } from 'react';
import { TokyoWorld, NPC_SPAWNS } from '@lw/world';
import { CHARACTERS, SIGNS, SCENARIOS } from '@lw/content';
import { levelProgress } from '@lw/core';
import { WorldCtx, useT } from '../hooks';
import { dueCount, useStore } from '../store';
import { Icon } from '../components/Icon';
import { Joystick } from '../components/Joystick';
import { MiniMap } from '../components/MiniMap';
import { Portrait } from '../components/Portrait';
import { Conversation } from './Conversation';
import { NPC_ORDER, TOTAL_SIGNS, characterById, displayName, entryForSign, npcLabels, scenarioForCharacter, tokenOf } from '../content';
import { useUi } from '../ui';
import { blip, haptic } from '../services';

export function WorldScreen() {
  const { t, lang, dir } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [world, setWorld] = useState<TokyoWorld | null>(null);
  const [failed, setFailed] = useState(false);
  const [nearby, setNearby] = useState<string | null>(null);
  const [talkTo, setTalkTo] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  const screen = useStore((s) => s.screen);
  const xp = useStore((s) => s.xp);
  const streak = useStore((s) => s.streak);
  const vocab = useStore((s) => s.vocab);
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

  // ---- world events ----
  useEffect(() => {
    if (!world) return;
    return world.on((e) => {
      if (e.type === 'nearby') setNearby(e.id);
      else if (e.type === 'pick') {
        const entry = entryForSign(e.id);
        if (!entry) return;
        const fresh = discover(e.id);
        blip(fresh ? 'good' : 'tap', useStore.getState().settings.autoSpeak);
        haptic(12);
        openWord({ token: tokenOf(entry), source: 'sign' });
        if (fresh) say(t('sign.found', { n: 2 }), 'good');
      } else if (e.type === 'quality' && e.quality === 'low') say(t('w.lowFps'));
    });
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
  useEffect(() => {
    if (!world) return;
    for (const c of CHARACTERS) {
      if (c.lessonId) world.setNpcBadge(c.id, lessonsDone.includes(c.lessonId) ? 'done' : 'lesson');
      else if (c.scenarioId) world.setNpcBadge(c.id, completed[c.scenarioId] ? 'done' : 'new');
    }
  }, [world, completed, lessonsDone]);

  const talk = (id: string) => {
    const c = characterById(id);
    if (!c) return;
    setMenu(false);
    if (c.lessonId) {
      useStore.setState({ lessonId: c.lessonId });
      go('lesson');
      return;
    }
    setTalkTo(id);
  };

  // "practise again" from the feedback screen
  useEffect(() => {
    if (!world || !pendingTalk) return;
    world.teleportNear(pendingTalk);
    useStore.getState().setPendingTalk(null);
    setTalkTo(pendingTalk);
  }, [world, pendingTalk]);

  // E or Enter talks to whoever is closest
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key.toLowerCase() === 'e' || e.key === 'Enter') && nearby && !talkTo && screen === 'world' && (e.target as HTMLElement)?.tagName !== 'INPUT') talk(nearby);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const open = (screenName: 'vocab' | 'stats' | 'settings') => {
    setMenu(false);
    go(screenName);
  };

  const lvl = levelProgress(xp);
  const due = dueCount(vocab);

  // next suggestion: lesson first, then the first scenario not finished yet
  const nextId = useMemo(() => {
    for (const id of NPC_ORDER) {
      const c = characterById(id)!;
      if (c.lessonId ? !lessonsDone.includes(c.lessonId) : !completed[c.scenarioId!]) return id;
    }
    return null;
  }, [completed, lessonsDone]);
  const nextChar = nextId ? characterById(nextId) : null;
  const nextScenario = nextId ? scenarioForCharacter(nextId) : null;

  const walkToNext = () => {
    const spawn = NPC_SPAWNS.find((n) => n.id === nextId);
    if (!spawn || !world) return;
    const d = spawn.radius * 0.62;
    world.walkTo(spawn.x + Math.sin(spawn.face) * d, spawn.z + Math.cos(spawn.face) * d);
    blip('tap', settings.autoSpeak);
  };

  const nearChar = nearby ? characterById(nearby) : null;
  const inConvo = !!talkTo;
  const found = discovered.filter((d) => SIGNS.some((s) => s.id === d)).length;

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
                </div>
                {menu && (
                  <nav className="menu glass-card" aria-label={t('w.menu')}>
                    <button onClick={() => open('vocab')}>
                      <Icon name="book" size={20} /> {t('w.words')}
                      {due > 0 && <span className="pill">{t('v.due', { n: due })}</span>}
                    </button>
                    <button onClick={() => open('stats')}>
                      <Icon name="chart" size={20} /> {t('w.progress')}
                    </button>
                    <button onClick={() => open('settings')}>
                      <Icon name="sliders" size={20} /> {t('w.settings')}
                    </button>
                  </nav>
                )}
              </div>
              <div className="hud-right">
                <MiniMap world={world} target={nextId} />
                <div className="found glass chip" title={t('w.found', { n: found, total: TOTAL_SIGNS })}>
                  <Icon name="sparkle" size={14} /> {found}/{TOTAL_SIGNS}
                </div>
              </div>
            </div>

            {nextChar && nextScenario && !nearChar && (
              <button className="next-up glass-card" onClick={walkToNext}>
                <Portrait spec={nextChar.avatar} size={40} />
                <span className="next-text">
                  <small>{t('w.nextUp')}</small>
                  <strong>{displayName(nextChar, lang)}</strong>
                  <em dir="auto">{nextScenario.title[lang]}</em>
                </span>
                <span className="next-go">
                  <Icon name="walk" size={18} />
                </span>
              </button>
            )}
            {!nextChar && !nearChar && (
              <div className="next-up glass-card static">
                <span className="next-text">
                  <strong>{t('f.again')}</strong>
                </span>
              </div>
            )}
            {nextChar && !nextScenario && !nearChar && (
              <button className="next-up glass-card" onClick={walkToNext}>
                <Portrait spec={nextChar.avatar} size={40} />
                <span className="next-text">
                  <small>{t('w.nextUp')}</small>
                  <strong>{displayName(nextChar, lang)}</strong>
                  <em dir="auto">{t('l.title')}</em>
                </span>
                <span className="next-go">
                  <Icon name="walk" size={18} />
                </span>
              </button>
            )}

            <div className="hud-bottom">
              <Joystick onMove={(x, y) => world.setMove(x, y)} />
              {nearChar && (
                <button className="talk-btn" dir={dir} onClick={() => talk(nearChar.id)}>
                  <Portrait spec={nearChar.avatar} size={46} />
                  <span>
                    <small>{nearChar.lessonId ? t('w.lesson', { name: '' }).trim() : t('w.talk', { name: '' }).trim()}</small>
                    <strong>{displayName(nearChar, lang)}</strong>
                  </span>
                  <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={22} />
                </button>
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

        {world && talkTo && (
          <Conversation
            key={talkTo}
            characterId={talkTo}
            onClose={() => setTalkTo(null)}
          />
        )}
      </div>
    </WorldCtx.Provider>
  );
}

export { SCENARIOS };
