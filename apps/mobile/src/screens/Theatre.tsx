// The Mini-theatre (ミニシアター, from the menu): watch short episodes with the town's characters and sing the town's song. An episode plays
// line by line in each character's recorded voice while the subtitles light up word by word with the audio (timed by the recording's length,
// or estimated for the device voice); any word can be tapped for its card; furigana, romaji and the translation follow Settings and can be
// switched here; ⏸ pauses, ↺ replays the line, 0.75× slows it. Three questions follow; the result is filed (`media_done`). The song is an
// instrumental karaoke track made with the Web Audio API: each mora has its note, so its kana light exactly with the music.
import { useEffect, useMemo, useRef, useState } from 'react';
import { EPISODES, SONGS, type Episode, type Song } from '@lw/content';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { characterById, displayName, lineTokens } from '../content';
import { dispatch } from '../game/bridge';
import { useGameState } from '../game/hooks';
import { estimateSeconds, hz, litCount, openMedia, songTimeline, tokenStarts } from '../game/theatreLogic';
import { useT } from '../hooks';
import { blip, tts } from '../services';
import { useStore } from '../store';
import { useUi } from '../ui';

type View = { t: 'list' } | { t: 'episode'; ep: Episode } | { t: 'song'; song: Song };

export function Theatre() {
  const { t, dir, lang } = useT();
  const go = useStore((s) => s.go);
  const state = useGameState();
  const [view, setView] = useState<View>({ t: 'list' });
  const episodes = openMedia(EPISODES, state.chapter.n);
  const songs = openMedia(SONGS, state.chapter.n);
  const back = () => (view.t === 'list' ? go('world') : setView({ t: 'list' }));
  return (
    <div className="panel theatre" dir={dir} data-screen="theatre" data-view={view.t}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={back} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>
          {view.t === 'episode' ? view.ep.title[lang] : view.t === 'song' ? view.song.title[lang] : t('th.title')}
          <small lang="ja">{view.t === 'episode' ? view.ep.title.ja : view.t === 'song' ? view.song.title.ja : 'ミニシアター'}</small>
        </h1>
        <span />
      </header>
      <div className="panel-body th-body">
        {view.t === 'list' && (
          <>
            <p className="muted small" dir="auto">
              {t('th.sub')}
            </p>
            <h2 className="h2">{t('th.episodes')}</h2>
            <ul className="th-list">
              {episodes.map((ep) => (
                <li key={ep.id}>
                  <button
                    type="button"
                    className={`card th-card th-${ep.setting}`}
                    onClick={() => setView({ t: 'episode', ep })}
                    data-episode={ep.id}
                  >
                    <span className="th-thumb" aria-hidden="true">
                      <Icon name="play" size={22} />
                    </span>
                    <span>
                      <strong dir="auto">{ep.title[lang]}</strong>
                      <small lang="ja">{ep.title.ja}</small>
                    </span>
                    {state.media?.[ep.id] !== undefined && (
                      <span className="th-best" dir="ltr">
                        {state.media[ep.id]}/{ep.quiz.length}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <h2 className="h2">{t('th.songs')}</h2>
            <ul className="th-list">
              {songs.map((song) => (
                <li key={song.id}>
                  <button type="button" className="card th-card th-song" onClick={() => setView({ t: 'song', song })} data-song={song.id}>
                    <span className="th-thumb" aria-hidden="true">
                      <Icon name="volume" size={22} />
                    </span>
                    <span>
                      <strong dir="auto">{song.title[lang]}</strong>
                      <small lang="ja">{song.title.ja}</small>
                    </span>
                    {state.media?.[song.id] !== undefined && <span className="th-best">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {view.t === 'episode' && <EpisodePlayer ep={view.ep} onDone={() => setView({ t: 'list' })} />}
        {view.t === 'song' && <SongPlayer song={view.song} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// An episode
// ---------------------------------------------------------------------------------------------------------------

function EpisodePlayer({ ep, onDone }: { ep: Episode; onDone: () => void }) {
  const { t, lang } = useT();
  const settings = useStore((s) => s.settings);
  const openWord = useUi((s) => s.openWord);
  const [i, setI] = useState(0);
  const [lit, setLit] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [slow, setSlow] = useState(false);
  const [furigana, setFurigana] = useState(settings.furigana);
  const [romaji, setRomaji] = useState(settings.romaji);
  const [showTr, setShowTr] = useState(true);
  const [phase, setPhase] = useState<'watch' | 'quiz' | 'done'>('watch');
  const run = useRef(0);
  const tokens = useMemo(() => ep.lines.map((l) => lineTokens(l.line.ja)), [ep]);
  const line = ep.lines[i]!;

  useEffect(() => () => tts.cancel(), []);

  /** plays line `k`; when it ends the next one starts (unless paused) */
  const playLine = (k: number, chain = true) => {
    const id = ++run.current;
    const toks = tokens[k]!;
    const rate = slow ? 0.75 : 1;
    let starts = tokenStarts(toks, estimateSeconds(toks, rate));
    let t0 = 0;
    setI(k);
    setLit(0);
    setPlaying(true);
    const tick = () => {
      if (run.current !== id) return;
      setLit(litCount(starts, (performance.now() - t0) / 1000));
      requestAnimationFrame(tick);
    };
    const text = ep.lines[k]!.line.ja.replace(/\|/g, '');
    void tts
      .speak(text, {
        who: ep.lines[k]!.who,
        rate,
        onStart: () => {
          t0 = performance.now();
          requestAnimationFrame(tick);
        },
        onDuration: (sec) => {
          starts = tokenStarts(toks, sec);
        },
      })
      .finally(() => {
        if (run.current !== id) return;
        run.current++;
        setLit(toks.length);
        if (!chain) return setPlaying(false);
        window.setTimeout(() => {
          if (run.current !== id + 1) return;
          if (k + 1 < ep.lines.length) playLine(k + 1);
          else {
            setPlaying(false);
            setPhase('quiz');
          }
        }, 650);
      });
  };
  const pause = () => {
    run.current++;
    tts.cancel();
    setPlaying(false);
  };
  // the episode starts by itself
  useEffect(() => {
    playLine(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speaker = characterById(line.who);
  return (
    <div className="th-player" data-line={i}>
      <div className={`th-stage th-${ep.setting}`} aria-hidden="true">
        {ep.cast.map((id, k) => {
          const c = characterById(id);
          if (!c) return null;
          return (
            <span key={id} className={`th-actor ${k === 0 ? 'left' : 'right'}${playing && line.who === id ? ' talking' : ''}`}>
              <Portrait spec={c.avatar} size={96} />
            </span>
          );
        })}
      </div>
      {phase === 'watch' && (
        <>
          <section className="th-sub card" data-sub={i}>
            <small className="th-who" dir="auto">
              {speaker ? displayName(speaker, lang) : ''}
            </small>
            <JaText
              tokens={tokens[i]!}
              furigana={furigana}
              romaji={romaji}
              size="lg"
              lit={lit}
              onTap={(tk) =>
                openWord({
                  token: tk,
                  source: 'phrase',
                  example: {
                    ja: line.line.ja.replace(/\|/g, ''),
                    en: line.line.en,
                    ar: line.line.ar,
                  },
                })
              }
            />
            {showTr && (
              <p className="th-tr" dir="auto">
                {lang === 'ar' ? line.line.ar : line.line.en}
              </p>
            )}
          </section>
          <div className="th-controls">
            <span className="th-group">
              <button type="button" className="tool" onClick={() => (playing ? pause() : playLine(i))} data-th-play>
                <Icon name={playing ? 'pause' : 'play'} size={17} /> {playing ? t('th.pause') : t('th.play')}
              </button>
              <button type="button" className="tool" onClick={() => playLine(i, false)} data-th-replay>
                <Icon name="replay" size={17} /> {t('th.replay')}
              </button>
              <button type="button" className={`tool ${slow ? 'on' : ''}`} onClick={() => setSlow(!slow)} aria-pressed={slow} data-th-slow>
                <span className="x06">0.75×</span>
              </button>
            </span>
            <span className="th-group end">
              <button
                type="button"
                className={`tool ${furigana ? 'on' : ''}`}
                onClick={() => setFurigana(!furigana)}
                aria-pressed={furigana}
                aria-label={t('st.furigana')}
              >
                あ
              </button>
              <button
                type="button"
                className={`tool ${romaji ? 'on' : ''}`}
                onClick={() => setRomaji(!romaji)}
                aria-pressed={romaji}
                aria-label={t('st.romaji')}
              >
                Aa
              </button>
              <button
                type="button"
                className={`tool ${showTr ? 'on' : ''}`}
                onClick={() => setShowTr(!showTr)}
                aria-pressed={showTr}
                aria-label={t('st.autoTranslate')}
              >
                <Icon name="language" size={17} />
              </button>
            </span>
          </div>
          <div className="th-nav">
            <button type="button" className="btn soft" disabled={i === 0} onClick={() => playLine(i - 1, false)} data-th-prev>
              {t('th.prev')}
            </button>
            <span className="muted small" dir="ltr">
              {i + 1}/{ep.lines.length}
            </span>
            <button
              type="button"
              className="btn soft"
              onClick={() => (i + 1 < ep.lines.length ? playLine(i + 1, false) : (pause(), setPhase('quiz')))}
              data-th-next
            >
              {i + 1 < ep.lines.length ? t('th.next') : t('th.toQuiz')}
            </button>
          </div>
        </>
      )}
      {phase !== 'watch' && <Quiz ep={ep} onDone={onDone} />}
    </div>
  );
}

function Quiz({ ep, onDone }: { ep: Episode; onDone: () => void }) {
  const { t, lang } = useT();
  const autoSpeak = useStore((s) => s.settings.autoSpeak);
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(false);
  const filed = useRef(false);
  const item = ep.quiz[q]!;
  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    const ok = k === item.answer;
    if (ok) setRight((n) => n + 1);
    blip(ok ? 'good' : 'bad', autoSpeak);
  };
  const next = () => {
    if (q + 1 < ep.quiz.length) {
      setQ(q + 1);
      setPicked(null);
      return;
    }
    setDone(true);
    if (!filed.current) {
      filed.current = true;
      dispatch({ t: 'media_done', id: ep.id, right, total: ep.quiz.length });
    }
  };
  if (done)
    return (
      <section className="card center th-done" data-th-done data-right={right}>
        <span className="ears-score" dir="ltr">
          {right}/{ep.quiz.length}
        </span>
        <p dir="auto">{t(right === ep.quiz.length ? 'th.perfect' : 'th.good')}</p>
        <button type="button" className="btn primary wide" onClick={onDone}>
          {t('common.done')}
        </button>
      </section>
    );
  return (
    <section className="th-quiz" data-th-quiz={q}>
      <h2 className="h2" dir="auto">
        {item.q[lang]}
      </h2>
      <ul className="ears-options">
        {item.options.map((o, k) => {
          const st = picked === null ? '' : k === item.answer ? ' right' : k === picked ? ' wrong' : ' dim';
          return (
            <li key={k}>
              <button
                type="button"
                className={`card ears-opt${st}`}
                onClick={() => choose(k)}
                disabled={picked !== null}
                data-th-opt={k}
                data-right={k === item.answer ? 1 : 0}
                dir="auto"
              >
                {o[lang]}
              </button>
            </li>
          );
        })}
      </ul>
      {picked !== null && (
        <button type="button" className="btn primary wide" onClick={next} data-th-qnext>
          {q + 1 < ep.quiz.length ? t('ears.next') : t('ears.finish')}
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The song: an instrumental karaoke track (Web Audio), the kana lit note by note
// ---------------------------------------------------------------------------------------------------------------

function SongPlayer({ song }: { song: Song }) {
  const { t, lang } = useT();
  const settings = useStore((s) => s.settings);
  const timeline = useMemo(() => songTimeline(song), [song]);
  const [pos, setPos] = useState<{ line: number; mora: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [guide, setGuide] = useState(true);
  const ctxRef = useRef<AudioContext | null>(null);
  /** the guide melody's own volume: switching the guide on or off works while the song plays */
  const guideGain = useRef<GainNode | null>(null);
  const raf = useRef(0);
  const filed = useRef(false);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    guideGain.current = null;
    setPlaying(false);
  };
  useEffect(() => stop, []);
  const toggleGuide = () => {
    const on = !guide;
    setGuide(on);
    const g = guideGain.current;
    if (g && ctxRef.current) g.gain.setTargetAtTime(on ? 1 : 0, ctxRef.current.currentTime, 0.03);
  };

  const play = () => {
    stop();
    const AC = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    const ctx = AC ? new AC() : null;
    ctxRef.current = ctx;
    const t0 = (ctx?.currentTime ?? 0) + 0.15;
    if (ctx) {
      const master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      const melody = ctx.createGain();
      melody.gain.value = guide ? 1 : 0;
      melody.connect(master);
      guideGain.current = melody;
      const voice = (freq: number, at: number, dur: number, type: OscillatorType, peak: number, out: AudioNode = master) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(peak, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, at + Math.max(0.12, dur * 0.95));
        o.connect(g).connect(out);
        o.start(at);
        o.stop(at + dur + 0.05);
      };
      // the chords: root and fifth in the bass, a soft major / minor triad above (the song says which roots are minor)
      for (const c of timeline.chords) {
        const third = c.minor ? 3 : 4;
        voice(hz(c.root), t0 + c.at, c.dur, 'sine', 0.55);
        voice(hz(c.root + 7), t0 + c.at, c.dur, 'sine', 0.25);
        for (const step of [12, 12 + third, 19]) voice(hz(c.root + step), t0 + c.at, c.dur, 'triangle', 0.12);
      }
      // the guide melody, always scheduled, heard while the guide is on (off: the player sings it)
      for (const n of timeline.notes) voice(hz(n.midi), t0 + n.at, n.dur, 'triangle', 0.5, melody);
    }
    const start = performance.now();
    setPlaying(true);
    const tick = () => {
      const now = ctx ? ctx.currentTime - t0 : (performance.now() - start) / 1000 - 0.15;
      const cur = [...timeline.notes].reverse().find((n) => n.at <= now);
      setPos(cur ? { line: cur.line, mora: cur.mora } : null);
      if (now > timeline.seconds) {
        setPlaying(false);
        setPos(null);
        if (!filed.current) {
          filed.current = true;
          dispatch({ t: 'media_done', id: song.id, right: 0, total: 0 });
        }
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    blip('tap', settings.autoSpeak);
  };

  return (
    <div className="th-songplay" data-song-player={song.id} data-playing={playing ? 1 : 0}>
      <p className="muted small" dir="auto">
        {t('th.songSub')}
      </p>
      <div className="th-lyrics card">
        {song.lines.map((l, li) => {
          const active = pos?.line === li;
          return (
            <div key={li} className={`th-lyric${active ? ' active' : ''}`} data-lyric={li}>
              <JaText tokens={lineTokens(l.line.ja)} furigana={settings.furigana} romaji={false} size="md" />
              <span className="th-morae" lang="ja" dir="ltr">
                {l.morae.map((m, mi) => (
                  <span key={mi} className={`th-mora${active && pos && mi <= pos.mora ? ' sung' : ''}${active && pos?.mora === mi ? ' now' : ''}`}>
                    {m}
                  </span>
                ))}
              </span>
              <small className="th-tr" dir="auto">
                {lang === 'ar' ? l.line.ar : l.line.en}
              </small>
            </div>
          );
        })}
      </div>
      <div className="th-controls">
        <button type="button" className="btn primary" onClick={() => (playing ? stop() : play())} data-song-play>
          <Icon name={playing ? 'pause' : 'play'} size={18} /> {playing ? t('th.stop') : t('th.sing')}
        </button>
        <button type="button" className={`tool ${guide ? 'on' : ''}`} onClick={toggleGuide} aria-pressed={guide} data-song-guide>
          {t('th.guide')}
        </button>
      </div>
    </div>
  );
}
