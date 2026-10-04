import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LEXICON, resolveLine, type Token } from '@lw/content';
import { normJa } from '@lw/core';
import {
  ConversationSession,
  explainSttError,
  classifyInput,
  evaluateSession,
  type ResolvedSuggestion,
  type SubmitInput,
  type SubmitResult,
  type Turn,
  type TranslationResult,
} from '@lw/engine';
import { useT, useWorld } from '../hooks';
import { useStore } from '../store';
import { requestAudioCheckFocus } from '../components/AudioCheck';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { characterById, displayName, scenarioForCharacter } from '../content';
import { blip, haptic, stt, tts } from '../services';
import type { StringKey } from '../i18n';
import { useUi } from '../ui';

interface Assist {
  l1Text: string;
  translation: TranslationResult | null;
  heard?: { text: string; score: number };
}

type MicState = { listening: boolean; msg?: string; fix?: boolean; lang: 'ja' | 'l1' };

function similarity(a: string, b: string): number {
  const x = normJa(a);
  const y = normJa(b);
  if (!x || !y) return 0;
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)] as number[]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[x.length][y.length] / Math.max(x.length, y.length);
}

export function Conversation({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const world = useWorld()!;
  const { t, lang, dir } = useT();
  const profile = useStore((s) => s.profile)!;
  const settings = useStore((s) => s.settings);
  const go = useStore((s) => s.go);
  const say = useStore((s) => s.say);
  const openWord = useUi((s) => s.openWord);

  const character = characterById(characterId)!;
  const scenario = scenarioForCharacter(characterId)!;
  const l1 = profile.l1;

  const session = useMemo(
    () => new ConversationSession({ scenario, character, l1, profileName: profile.name, topics: profile.topics }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'play' | 'ended'>('intro');
  const [input, setInput] = useState('');
  const [assist, setAssist] = useState<Assist | null>(null);
  const [showTr, setShowTr] = useState(settings.autoTranslate);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState<ResolvedSuggestion | null>(null);
  const [paused, setPaused] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [mic, setMic] = useState<MicState>({ listening: false, lang: profile.level === 'A1' ? 'l1' : 'ja' });
  const [noVoice, setNoVoice] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const speakToken = useRef(0);
  const speechGen = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const micSession = useRef<{ stop(): void; abort(): void } | null>(null);
  /** cancel speech and drop any follow-up line a pending speakTurn was about to say */
  const stopSpeech = () => {
    speechGen.current++;
    tts.cancel();
  };
  /** release the mic now (leaving, pausing, answering by tap): stop() would still deliver a late result */
  const dropMic = () => micSession.current?.abort();
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  // ---------- speaking ----------
  const speak = async (text: string, o: { slow?: boolean; talk?: boolean } = {}) => {
    const token = ++speakToken.current;
    const sp = character.speaking;
    setSpeaking(true);
    world.setSpeaker(characterId, true);
    const done = () => {
      if (speakToken.current === token) {
        setSpeaking(false);
        world.setSpeaker(characterId, false);
      }
    };
    if (!settings.autoSpeak && !o.talk) {
      // keep the character animated for a moment even when audio is off
      await new Promise((r) => later(() => r(null), Math.min(2600, 500 + text.length * 90)));
      done();
      return;
    }
    await tts.speak(text, { rate: sp.rate * (o.slow ? 0.58 : 1), pitch: sp.pitch, voice: sp.voice });
    if (tts.lastError()?.code === 'no-voice') setNoVoice(true); // checked after speaking: voices may only be reported by now
    done();
  };

  const speakTurn = async (turn: Turn, forceAudio = false) => {
    world.setEmotion(characterId, turn.emotion ?? 'neutral');
    const gen = speechGen.current;
    await speak(turn.line.plain, { talk: forceAudio });
    if (gen !== speechGen.current) return; // cancelled (left, replayed, answered): do not say the follow-up
    if (turn.followUp) await speak(turn.followUp.plain, { slow: true, talk: forceAudio });
  };

  // ---------- lifecycle ----------
  useEffect(() => {
    world.enterConversation(characterId);
    later(() => {
      const first = session.start();
      setVisible(session.turns.length);
      setPhase('play');
      force();
      void speakTurn(first);
    }, 1050);
    return () => {
      timers.current.forEach(clearTimeout);
      micSession.current?.abort();
      stopSpeech();
      world.setSpeaker(characterId, false);
      world.setPlayerTalking(false);
      world.exitConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [visible, typing, assist, hint, phase]);

  // keep the sheet above the on-screen keyboard (iOS leaves the layout viewport alone)
  useEffect(() => {
    const vv = window.visualViewport;
    const el = rootRef.current;
    if (!vv || !el) return;
    const update = () => el.style.setProperty('--kb', `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // ---------- sending ----------
  const afterSubmit = (result: SubmitResult) => {
    const idx = session.turns.indexOf(result.learner);
    setVisible(idx + 1);
    setHint(null);
    setAssist(null);
    force();
    setTyping(true);
    if (!result.learner.matched) blip('bad', settings.autoSpeak);
    later(() => {
      setTyping(false);
      setVisible(session.turns.length);
      force();
      if (result.stepsDone.length) {
        const names = result.stepsDone.map((id) => scenario.steps.find((s) => s.id === id)?.text[lang]).filter(Boolean);
        say(names.join(' · '), 'good');
        blip('good', settings.autoSpeak);
        haptic(18);
      }
      if (result.ended) setPhase('ended');
      void speakTurn(result.character);
    }, 650 + Math.random() * 450);
  };

  const busy = typing || phase !== 'play' || paused;

  const run = (inp: SubmitInput) => {
    if (busy || session.ended) return;
    stopSpeech();
    dropMic();
    afterSubmit(session.submit(inp));
  };

  const handleText = (raw: string, viaSpeech = false) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    const kind = classifyInput(text);
    if (kind.kind === 'ja') run({ text: kind.text, mode: viaSpeech ? 'speech_ja' : 'typed_ja' });
    else if (kind.kind === 'romaji') run({ text: kind.text, kana: kind.kana, mode: 'typed_romaji' });
    else {
      setHint(null);
      setAssist({ l1Text: kind.text, translation: kind.translation });
      if (kind.translation) {
        const line = resolveLine({ ja: kind.translation.ja, en: '', ar: '' }, LEXICON, kind.translation.vars);
        void tts.speak(line.plain, { rate: 0.9 });
      }
    }
  };

  const pick = (i: number) => {
    if (busy) return;
    stopSpeech();
    dropMic();
    afterSubmit(session.pickSuggestion(i));
  };

  // ---------- voice ----------
  const listen = (target: 'ja' | 'l1', onText: (text: string) => void) => {
    if (!stt.available()) {
      setMic((m) => ({ ...m, msg: t('audio.mic.err.unsupported'), fix: true }));
      return;
    }
    stopSpeech();
    const code = target === 'ja' ? 'ja-JP' : l1 === 'ar' ? 'ar-SA' : 'en-US';
    const s = stt.listen(code, (interim) => setInput(interim));
    micSession.current = s;
    setMic((m) => ({ ...m, listening: true, msg: t('c.mic.listening'), fix: false }));
    world.setPlayerTalking(true);
    const mine = () => micSession.current === s; // a newer listen() replaced this one: its handlers own the UI now
    s.result
      .then((r) => {
        if (!mine()) return;
        setMic((m) => ({ ...m, listening: false, msg: undefined }));
        onText(r.text);
      })
      .catch((e: unknown) => {
        if (!mine()) return;
        const id = explainSttError(e);
        const fix = id !== 'silent' && id !== 'cancelled' && id !== 'timeout' && id !== 'network';
        setMic((m) => ({ ...m, listening: false, msg: id === 'cancelled' ? undefined : t(`audio.mic.err.${id}` as StringKey), fix }));
        setInput('');
      })
      .finally(() => {
        if (!mine()) return;
        micSession.current = null;
        world.setPlayerTalking(false);
      });
  };

  const toggleMic = () => {
    if (mic.listening) {
      micSession.current?.stop();
      return;
    }
    if (busy) return;
    listen(mic.lang, (text) => handleText(text, mic.lang === 'ja'));
  };

  // ---------- helpers row ----------
  const lastChar = () => [...session.turns].reverse().find((x) => x.speaker === 'character' && x.kind !== 'fallback' && x.kind !== 'reaction') ?? session.turns[session.turns.length - 1];
  const replay = (slow: boolean) => {
    const turn = lastChar();
    if (!turn) return;
    stopSpeech();
    dropMic(); // the speaker would otherwise be heard as the player's answer
    void speak(turn.line.plain, { slow, talk: true });
  };
  const askHint = () => {
    if (busy) return;
    setHint(session.hint());
    force();
  };

  // ---------- finishing ----------
  const finish = () => {
    stopSpeech();
    const report = evaluateSession(session);
    const turns = session.turns.map((x) => ({ id: x.id, speaker: x.speaker, written: x.line.written, en: x.line.en, ar: x.line.ar, assisted: x.assisted, tokens: x.line.tokens }));
    useStore.getState().recordLoop({ scenarioId: scenario.id, report, turns });
    go('feedback');
    onClose();
  };

  const leave = () => {
    stopSpeech();
    onClose();
  };

  const shownTurns = session.turns.slice(0, visible);
  const lastTurn = session.turns[visible - 1];
  const suggestions = !busy && !assist && !session.ended ? session.suggestions() : [];
  const needsHelp = lastTurn?.speaker === 'character' && lastTurn.needsHelp;
  const prog = session.progress();
  const assistLine = assist?.translation ? resolveLine({ ja: assist.translation.ja, en: '', ar: '' }, LEXICON, assist.translation.vars) : null;

  const tapWord = (token: Token, example?: { ja: string; en: string; ar: string }) => openWord({ token, source: 'conversation', example });

  const turnTranslation = (turn: Turn) => (lang === 'ar' ? turn.line.ar : turn.line.en);

  return (
    <div className="convo" dir={dir} ref={rootRef}>
      <header className="convo-head glass-bar">
        <button className="icon-btn ghost" onClick={() => setConfirmLeave(true)} aria-label={t('c.leave')}>
          <Icon name="x" size={22} />
        </button>
        <div className="who">
          <Portrait spec={character.avatar} talking={speaking} size={42} />
          <div>
            <strong>{displayName(character, lang)}</strong>
            <small dir="auto">{character.job[lang]}</small>
          </div>
        </div>
        <button className="icon-btn ghost" onClick={() => { stopSpeech(); dropMic(); setPaused(true); world.setPaused(true); }} aria-label={t('c.pause')}>
          <Icon name="pause" size={20} />
        </button>
        <div className="goals" aria-label={t('c.goals')}>
          {scenario.steps.map((s) => {
            const done = session.stepsDone.has(s.id);
            return (
              <span key={s.id} className={`goal ${done ? 'done' : ''}`} dir="auto">
                <Icon name={done ? 'check' : 'target'} size={13} stroke={done ? 3 : 2} /> {s.text[lang]}
              </span>
            );
          })}
        </div>
      </header>

      <section className="sheet convo-sheet" aria-live="polite">
        <div className="messages" ref={listRef}>
          {phase === 'intro' && (
            <div className="setup" dir="auto">
              <strong>{scenario.title[lang]}</strong>
              <p>{scenario.setup[lang]}</p>
            </div>
          )}
          {shownTurns.map((turn) => {
            const isChar = turn.speaker === 'character';
            const trOpen = showTr || shown.has(turn.id);
            return (
              <div key={turn.id} className={`msg ${isChar ? 'char' : 'me'} ${turn.kind === 'fallback' ? 'fb' : ''}`}>
                {isChar && (
                  <span className="msg-av">
                    <Portrait spec={character.avatar} size={30} />
                  </span>
                )}
                <div className="bubble">
                  <JaText tokens={turn.line.tokens} furigana={settings.furigana} romaji={settings.romaji} size="lg" onTap={(tk) => tapWord(tk)} />
                  {turn.followUp && <JaText tokens={turn.followUp.tokens} furigana={settings.furigana} romaji={settings.romaji} size="lg" onTap={(tk) => tapWord(tk)} className="follow" />}
                  {isChar && trOpen && (
                    <div className="tr" dir="auto">
                      {turnTranslation(turn)}
                      {turn.followUp && <div>{lang === 'ar' ? turn.followUp.ar : turn.followUp.en}</div>}
                    </div>
                  )}
                  {!isChar && turn.assisted && turn.l1Text && (
                    <div className="tr" dir="auto">
                      {turn.l1Text}
                    </div>
                  )}
                  <div className="msg-meta">
                    {isChar && (
                      <>
                        <button className="mini" onClick={() => { stopSpeech(); dropMic(); void speak(turn.line.plain, { talk: true }); }} aria-label={t('c.replay')}>
                          <Icon name="volume" size={15} />
                        </button>
                        <button
                          className={`mini ${trOpen ? 'on' : ''}`}
                          onClick={() => setShown((s) => { const n = new Set(s); n.has(turn.id) ? n.delete(turn.id) : n.add(turn.id); return n; })}
                          aria-label={t('c.translate')}
                          aria-pressed={trOpen}
                        >
                          <Icon name="language" size={15} />
                        </button>
                      </>
                    )}
                    {!isChar && turn.assisted && (
                      <span className="tag assisted">
                        <Icon name="sparkle" size={12} /> {t('c.assisted')}
                      </span>
                    )}
                    {!isChar && !turn.matched && <span className="tag miss">{t('c.misheard')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {typing && (
            <div className="msg char">
              <span className="msg-av">
                <Portrait spec={character.avatar} size={30} />
              </span>
              <div className="bubble typing" aria-label="…">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}

          {assist && (
            <div className="assist">
              <div className="assist-said" dir="auto">
                <small>{t('c.assist.said')}</small>
                <span>{assist.l1Text}</span>
              </div>
              {assistLine ? (
                <>
                  <small className="assist-label">{t('c.assist.title')}</small>
                  <JaText tokens={assistLine.tokens} furigana={settings.furigana} romaji={settings.romaji || profile.level === 'A1'} size="xl" onTap={(tk) => tapWord(tk)} />
                  <p className="muted small">{t('c.assist.note')}</p>
                  {assist.heard && (
                    <p className={`heard ${assist.heard.score > 0.7 ? 'good' : ''}`} dir="auto">
                      {t('c.mic.heard', { text: assist.heard.text })} · {t('c.mic.match', { n: Math.round(assist.heard.score * 100) })}
                    </p>
                  )}
                  <div className="assist-actions">
                    <button className="btn soft" onClick={() => void tts.speak(assistLine.plain, { rate: 0.85 })}>
                      <Icon name="volume" size={18} /> {t('common.listen')}
                    </button>
                    {stt.available() && (
                      <button
                        className={`btn soft ${mic.listening ? 'rec' : ''}`}
                        onClick={() => (mic.listening ? micSession.current?.stop() : listen('ja', (text) => setAssist((a) => (a ? { ...a, heard: { text, score: similarity(text, assistLine.written) } } : a))))}
                      >
                        <Icon name="mic" size={18} /> {mic.listening ? t('c.mic.stop') : t('c.assist.sayIt')}
                      </button>
                    )}
                    <button
                      className="btn primary"
                      onClick={() => run({ text: assistLine.written, mode: 'assist', l1Text: assist.l1Text, translation: assist.translation! })}
                    >
                      {t('c.assist.send')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="nomatch" dir="auto">
                    {t('c.assist.nomatch')}
                  </p>
                  <div className="assist-actions">
                    <button className="btn soft" onClick={() => setAssist(null)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                </>
              )}
              {assistLine && (
                <button className="link-btn" onClick={() => setAssist(null)}>
                  {t('common.cancel')}
                </button>
              )}
            </div>
          )}

          {hint && !assist && (
            <div className="hint-card">
              <small>
                <Icon name="bulb" size={14} /> {t('c.hint')}
              </small>
              <JaText tokens={hint.tokens} furigana={settings.furigana} romaji={settings.romaji} size="lg" />
              <div className="tr" dir="auto">
                {lang === 'ar' ? hint.ar : hint.en}
              </div>
              <button className="btn primary sm" onClick={() => pick(0)}>
                <Icon name="send" size={16} /> {t('c.assist.send')}
              </button>
            </div>
          )}
          {needsHelp && !hint && !assist && <p className="stuck">{t('c.stuck')}</p>}
          {noVoice && <p className="stuck dim">{t('c.noJaVoice')}</p>}
        </div>

        {phase === 'ended' ? (
          <div className="done-card">
            <div className="done-badge">
              <Icon name="star" size={26} />
            </div>
            <div>
              <strong>{t('c.complete')}</strong>
              <small>{t('c.completeSub', { done: prog.done, total: prog.total })}</small>
            </div>
            <button className="btn primary" onClick={finish}>
              {t('c.seeFeedback')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
            </button>
          </div>
        ) : (
          <div className="dock">
            {suggestions.length > 0 && (
              <div className="suggest" role="list" aria-label={t('c.suggestions')}>
                {suggestions.map((sg, i) => (
                  <button key={i} className={`sg ${hint && i === 0 ? 'hinted' : ''}`} role="listitem" onClick={() => pick(i)}>
                    <JaText tokens={sg.tokens} furigana={false} romaji={false} size="md" />
                    <small dir="auto">{lang === 'ar' ? sg.ar : sg.en}</small>
                  </button>
                ))}
              </div>
            )}
            {!assist && (
            <div className="tools">
              <button className="tool" onClick={askHint} disabled={busy}>
                <Icon name="bulb" size={17} /> {t('c.hint')}
              </button>
              <button className={`tool ${showTr ? 'on' : ''}`} onClick={() => setShowTr(!showTr)} aria-pressed={showTr}>
                <Icon name="language" size={17} /> {t('c.translate')}
              </button>
              <button className="tool" onClick={() => replay(true)}>
                <span className="x06">0.6×</span> {t('c.slow')}
              </button>
              <button className="tool" onClick={() => replay(false)}>
                <Icon name="replay" size={17} /> {t('c.replay')}
              </button>
            </div>
            )}
            <form
              className="inputbar"
              onSubmit={(e) => {
                e.preventDefault();
                handleText(input);
              }}
            >
              <button type="button" className={`mic ${mic.listening ? 'rec' : ''}`} onClick={toggleMic} aria-label={mic.listening ? t('c.mic.stop') : t('c.mic')} aria-pressed={mic.listening}>
                <Icon name="mic" size={22} />
              </button>
              <input
                id="say"
                className="say"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('c.placeholder')}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                disabled={paused}
              />
              <button type="submit" className="send" disabled={!input.trim() || busy} aria-label={t('c.assist.send')}>
                <Icon name="send" size={20} />
              </button>
            </form>
            <div className={`mic-row ${mic.fix || (!mic.msg && !stt.available()) ? 'has-fix' : ''}`}>
              <button
                type="button"
                className="seg"
                onClick={() => setMic((m) => ({ ...m, lang: m.lang === 'ja' ? 'l1' : 'ja' }))}
                aria-label="Voice language"
              >
                <span className={mic.lang === 'l1' ? 'on' : ''}>{l1 === 'ar' ? 'العربية' : 'English'}</span>
                <span className={mic.lang === 'ja' ? 'on' : ''}>日本語</span>
              </button>
              {(mic.msg || !stt.available()) && <small className="mic-msg" dir="auto">{mic.msg ?? t('audio.mic.err.unsupported')}</small>}
              {(mic.fix || (!mic.msg && !stt.available())) && (
                <button type="button" className="mic-fix" onClick={() => { requestAudioCheckFocus(); go('settings'); }}>
                  {t('audio.mic.checkBtn')}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {paused && (
        <div className="scrim center" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>{t('c.paused')}</h3>
            <button className="btn primary wide" onClick={() => { setPaused(false); world.setPaused(false); }}>
              <Icon name="play" size={18} /> {t('c.resume')}
            </button>
            <button className="btn soft wide" onClick={() => { world.setPaused(false); setConfirmLeave(true); setPaused(false); }}>
              {t('c.leave')}
            </button>
          </div>
        </div>
      )}
      {confirmLeave && (
        <div className="scrim center" role="alertdialog" aria-modal="true">
          <div className="modal">
            <p dir="auto">{t('c.leaveAsk')}</p>
            <div className="row">
              <button className="btn soft" onClick={() => setConfirmLeave(false)}>
                {t('common.stay')}
              </button>
              <button className="btn danger" onClick={leave}>
                {t('common.leave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
