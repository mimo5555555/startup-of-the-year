import { useEffect, useReducer, useRef, useState } from 'react';
import { LEXICON, resolveLine, scenarioById, segmentFree, speakableText, type Token } from '@lw/content';
import { uid } from '@lw/core';
import {
  ConversationSession,
  alternativesOf,
  bestAlternativeScore,
  classifyInput,
  confidenceBucket,
  evaluateSession,
  explainSttError,
  type FeedbackOptions,
  type ResolvedSuggestion,
  type SttResult,
  type SubmitInput,
  type SubmitResult,
  type Turn,
  type TranslationResult,
} from '@lw/engine';
import { BALANCE, hearts as heartsOf } from '@lw/game';
import { useT, useWorld } from '../hooks';
import { useStore } from '../store';
import { requestAudioCheckFocus } from '../components/AudioCheck';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { PriceChip } from '../components/game/PriceChip';
import { ReceiptSheet } from '../components/game/ReceiptSheet';
import { setDebrief, type KeepLine } from '../components/game/DebriefGame';
import { characterById, displayName, scenarioForCharacter } from '../content';
import { dispatch } from '../game/bridge';
import { createConvoGame } from '../game/convoHooks';
import { getGame } from '../game/gameStore';
import { PACK } from '../game/pack';
import { gameView } from '../game/selectors';
import { blip, haptic, stt, tts } from '../services';
import type { StringKey } from '../i18n';
import { useUi } from '../ui';

interface Assist {
  l1Text: string;
  translation: TranslationResult | null;
  heard?: { text: string; score: number };
}

/** consecutive spoken lines that were not taken before the keyboard is offered (§12.2) */
const LOW_STREAK_MAX = 3;

type MicState = { listening: boolean; msg?: string; fix?: boolean; lang: 'ja' | 'l1' };

export function Conversation({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const world = useWorld();
  const { t, lang, dir } = useT();
  const profile = useStore((s) => s.profile)!;
  const settings = useStore((s) => s.settings);
  const go = useStore((s) => s.go);
  const say = useStore((s) => s.say);
  const openWord = useUi((s) => s.openWord);

  const character = characterById(characterId)!;
  const l1 = profile.l1;

  // everything the session needs is decided once, when the conversation opens: the request (scenario, mode, entry node), the
  // economy hooks and the session itself (docs/GAME_DESIGN.md §11.2)
  const [setup] = useState(() => {
    const c = useUi.getState().convo;
    const req = c && c.characterId === characterId ? c : null;
    const scenario = (req && scenarioById(req.scenarioId)) || scenarioForCharacter(characterId)!;
    const sessionId = uid('s_');
    const state = getGame();
    const game = createConvoGame({ pack: PACK, scenarioId: scenario.id, sessionId, state: getGame, view: () => gameView(useStore.getState()), commit: dispatch });
    const meta = game.meta;
    // Real mode only where the scenario allows it; the ramen shop starts after the ticket machine when a ticket is held
    const mode: 'guided' | 'real' = req?.mode === 'real' && meta?.real ? 'real' : 'guided';
    const startNode = req?.startNode ?? (meta?.startNode && state.tickets.ramen && scenario.id === 'ramen' ? meta.startNode : undefined);
    const friendDef = meta?.friendId ? PACK.friends.find((f) => f.id === meta.friendId) : undefined;
    // a friend who has switched to plain speech makes casual forms correct, and stiff ones merely distant (§11.4)
    const casual = !!friendDef && (heartsOf(state, friendDef.id) >= friendDef.casualAt || (state.friends[friendDef.id]?.flags ?? []).includes('casual'));
    const feedback: FeedbackOptions = { register: casual ? 'casual' : meta?.register, friend: !!meta?.friendId, markers: PACK.lang.registerMarkers, speechPolicy: BALANCE.speech };
    const session = new ConversationSession({
      scenario,
      character,
      l1,
      profileName: profile.name,
      topics: profile.topics,
      sessionId,
      game: game.hooks,
      flags: game.flags,
      startNode,
      recalled: game.recalled,
      policy: BALANCE,
    });
    // the 3D camera only follows a face-to-face talk with someone standing in the street (phone chats and trips have no spawn)
    const onStage = req?.channel !== 'chat' && !!world?.npcPosition(characterId);
    return { scenario, session, game, mode, feedback, onStage, startNode };
  });
  const { scenario, session, game, mode, feedback, onStage } = setup;
  const real = mode === 'real';

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
  /** a spoken line the recogniser was only half sure of, waiting for "Yes / Edit / Try again" (§12.4) */
  const [heard, setHeard] = useState<SttResult | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  /** the numbers the clerk said, by the turn that said them (the price chip under the bubble) */
  const quoted = useRef(new Map<number, { amount: number; fare: boolean }>());
  /** consecutive spoken lines that were not taken straight away (low confidence): after three the draft moves to the keyboard */
  const lowStreak = useRef(0);
  const finished = useRef(false);

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
    world?.setSpeaker(characterId, true);
    const done = () => {
      if (speakToken.current === token) {
        setSpeaking(false);
        world?.setSpeaker(characterId, false);
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
    world?.setEmotion(characterId, turn.emotion ?? 'neutral');
    const gen = speechGen.current;
    await speak(turn.line.plain, { talk: forceAudio });
    if (gen !== speechGen.current) return; // cancelled (left, replayed, answered): do not say the follow-up
    if (turn.followUp) await speak(turn.followUp.plain, { slow: true, talk: forceAudio });
  };

  // ---------- lifecycle ----------
  useEffect(() => {
    if (onStage && world) {
      // started from Prepare, a trip or "practise again": walk up to them first
      if (world.nearby !== characterId) world.teleportNear(characterId);
      world.enterConversation(characterId);
    }
    later(() => {
      const first = session.start();
      noteQuote(first);
      setVisible(session.turns.length);
      setPhase('play');
      force();
      void speakTurn(first);
    }, onStage ? 1050 : 350);
    return () => {
      timers.current.forEach(clearTimeout);
      micSession.current?.abort();
      stopSpeech();
      world?.setSpeaker(characterId, false);
      world?.setPlayerTalking(false);
      if (onStage) world?.exitConversation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [visible, typing, assist, hint, heard, phase]);

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
  /** remembers the number a clerk's line quoted (price, total or fare) for the chip under its bubble */
  const noteQuote = (turn: Turn) => {
    if (turn.speaker !== 'character' || turn.kind !== 'say') return;
    const text = session.node.say.map((v) => v.line.ja).join(' ');
    const kind = (['total', 'price', 'fare'] as const).find((k) => text.includes(`{${k}}`));
    const amount = kind && game.amounts()[kind];
    if (kind && amount !== undefined) quoted.current.set(turn.id, { amount, fare: kind === 'fare' });
  };

  const afterSubmit = (result: SubmitResult) => {
    const idx = session.turns.indexOf(result.learner);
    setVisible(idx + 1);
    setHint(null);
    setAssist(null);
    setHeard(null);
    noteQuote(result.character);
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

  /** `speech`: the recogniser's result when the text was spoken in Japanese (confidence and n-best go to the engine) */
  const handleText = (raw: string, speech?: SttResult) => {
    const text = raw.trim();
    if (!text || busy) return;
    setInput('');
    setHeard(null);
    const kind = classifyInput(text);
    if (kind.kind === 'ja') run(speech ? { text: kind.text, mode: 'speech_ja', confidence: speech.confidence, alternatives: speech.alternatives } : { text: kind.text, mode: 'typed_ja' });
    else if (kind.kind === 'romaji') run({ text: kind.text, kana: kind.kana, mode: 'typed_romaji' });
    else {
      setHint(null);
      setAssist({ l1Text: kind.text, translation: kind.translation });
      if (kind.translation) {
        const line = resolveLine({ ja: kind.translation.ja, en: '', ar: '' }, LEXICON, kind.translation.vars);
        // the preview is on screen now: typing it instead of sending it is a copy of a translation (class T, §3.2)
        session.noteShown('translations', line.written);
        void tts.speak(line.plain, { rate: 0.9 });
      }
    }
  };

  /** Spoken Japanese by confidence (§12.4): >= 0.75 goes straight in, 0.45-0.75 asks "I heard ...", below that no turn is used and no fallback counted. */
  const handleSpeech = (r: SttResult) => {
    const bucket = confidenceBucket(r.confidence, BALANCE.speech);
    if (bucket === 'direct') {
      lowStreak.current = 0;
      handleText(r.text, r);
      return;
    }
    setInput('');
    // only a line the recogniser could not use counts toward "Type it instead?"; one it half-heard is the learner's to confirm
    if (bucket === 'confirm') {
      setHeard(r);
      return;
    }
    offerTyping(r.text, true);
  };

  /** Counts a spoken line that was not taken; the third in a row moves the last thing heard to the keyboard (§12.2). */
  const offerTyping = (text: string, explain = false) => {
    if (++lowStreak.current < LOW_STREAK_MAX) {
      if (explain) setMic((m) => ({ ...m, msg: t('debrief.speechLow'), fix: false }));
      return;
    }
    setMic((m) => ({ ...m, msg: t('debrief.speechType'), fix: false }));
    setInput(text.trim());
    document.getElementById('say')?.focus();
  };

  const pick = (i: number) => {
    if (busy) return;
    stopSpeech();
    dropMic();
    afterSubmit(session.pickSuggestion(i));
  };

  // ---------- voice ----------
  const listen = (target: 'ja' | 'l1', onResult: (r: SttResult) => void) => {
    if (!stt.available()) {
      setMic((m) => ({ ...m, msg: t('audio.mic.err.unsupported'), fix: true }));
      return;
    }
    stopSpeech();
    const code = target === 'ja' ? 'ja-JP' : l1 === 'ar' ? 'ar-SA' : 'en-US';
    const s = stt.listen(code, (interim) => setInput(interim));
    micSession.current = s;
    setMic((m) => ({ ...m, listening: true, msg: t('c.mic.listening'), fix: false }));
    world?.setPlayerTalking(true);
    const mine = () => micSession.current === s; // a newer listen() replaced this one: its handlers own the UI now
    s.result
      .then((r) => {
        if (!mine()) return;
        setMic((m) => ({ ...m, listening: false, msg: undefined }));
        onResult(r);
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
        world?.setPlayerTalking(false);
      });
  };

  const toggleMic = () => {
    if (mic.listening) {
      micSession.current?.stop();
      return;
    }
    if (busy) return;
    setHeard(null);
    const lang = mic.lang;
    listen(lang, (r) => (lang === 'ja' ? handleSpeech(r) : handleText(r.text)));
  };

  const confirmHeard = () => {
    if (!heard) return;
    lowStreak.current = 0;
    handleText(heard.text, heard);
  };
  const editHeard = () => {
    if (!heard) return;
    lowStreak.current = 0;
    setInput(heard.text.trim());
    setHeard(null);
    document.getElementById('say')?.focus();
  };
  const retryHeard = () => {
    const last = heard;
    setHeard(null);
    if (last) offerTyping(last.text);
    if (!last || lowStreak.current < LOW_STREAK_MAX) toggleMic();
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
  /** Lines the debrief offers to keep: what the app wrote for the learner, and up to two corrected lines (§11.3 block 5). */
  const keepLines = (report: ReturnType<typeof evaluateSession>): KeepLine[] => {
    const pocket = (game.meta?.pocket ?? []).flatMap((id) => {
      const l = PACK.pockets[id]?.line;
      return l && !l.ja.includes('{') ? [{ id, written: l.ja.replace(/\|/g, '') }] : [];
    });
    const out: KeepLine[] = [];
    const add = (written: string, tokens: Token[], meaning: { en: string; ar: string }, assisted: boolean) => {
      const id = pocket.find((p) => p.written === written)?.id ?? `d:${written}`;
      if (!meaning.en && !meaning.ar) return; // the meaning is what stays on screen while the Japanese is hidden
      if (out.some((l) => l.id === id)) return;
      out.push({ id, written, tokens, plain: speakableText(tokens), ja: tokens.map((x) => x.s).join('|'), meaning, assisted });
    };
    for (const l of report.phrasesLearned) {
      // a tapped suggestion carries its meaning in the learner's language on the turn
      const said = l.en || l.ar ? null : session.turns.find((x) => x.speaker === 'learner' && x.line.written === l.written)?.l1Text;
      add(l.written, l.tokens, said ? { en: said, ar: said } : { en: l.en, ar: l.ar }, true);
    }
    for (const c of report.corrections.filter((x) => !x.soft).slice(0, 2)) {
      const ideal = session.turns.find((x) => x.id === c.turnId)?.ideal;
      if (ideal) add(c.better, segmentFree(c.better, LEXICON), { en: ideal.en, ar: ideal.ar }, false);
    }
    return out;
  };

  /**
   * Settles the conversation: the v1 bookkeeping first (it flushes), then `conversation_done` through the bridge so the debrief's
   * rows come from the derived events (the ledger), then the report shows (E10: leaving pays nothing, this pays once).
   */
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    stopSpeech();
    const report = evaluateSession(session, feedback);
    const facts = session.facts({ mode, prepared: game.prepared, feedback });
    const turns = session.turns.map((x) => ({ id: x.id, speaker: x.speaker, written: x.line.written, en: x.line.en, ar: x.line.ar, assisted: x.assisted, tokens: x.line.tokens }));
    const data = useStore.getState().recordLoop({ scenarioId: scenario.id, report, turns });
    let derived = game.derived;
    try {
      derived = [...derived, ...dispatch({ t: 'conversation_done', facts }).derived];
    } catch (e) {
      // the report still shows: the debrief just has no game rows
      console.error('conversation_done failed', e);
    }
    setDebrief({ forReport: data, facts, derived, purchases: game.purchases, keep: keepLines(report) });
    go('feedback');
    onClose();
  };

  const leave = () => {
    stopSpeech();
    onClose();
  };

  const shownTurns = session.turns.slice(0, visible);
  const lastTurn = session.turns[visible - 1];
  // Real mode never shows the chips (and never marks them shown: only the Hint text is, §11.2)
  const suggestions = !real && !busy && !assist && !heard && !session.ended ? session.suggestions() : [];
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
            <strong>
              {displayName(character, lang)}
              {real && <span className="dbf-tag">{t('debrief.realTag')}</span>}
            </strong>
            <small dir="auto">{character.job[lang]}</small>
          </div>
        </div>
        <button className="icon-btn ghost" onClick={() => { stopSpeech(); dropMic(); setPaused(true); world?.setPaused(true); }} aria-label={t('c.pause')}>
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
                  {isChar && quoted.current.has(turn.id) && <PriceChip amount={quoted.current.get(turn.id)!.amount} fare={quoted.current.get(turn.id)!.fare} />}
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
                        onClick={() => (mic.listening ? micSession.current?.stop() : listen('ja', (r) => setAssist((a) => (a ? { ...a, heard: { text: r.text, score: bestAlternativeScore(alternativesOf(r), assistLine.written) } } : a))))}
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
          {heard && !assist && (
            <div className="assist dbf-heard">
              <div className="assist-said" dir="auto">
                <small>{t('debrief.heard')}</small>
                <span lang="ja">{heard.text}</span>
              </div>
              <div className="assist-actions">
                <button className="btn primary" onClick={confirmHeard}>
                  {t('debrief.yes')}
                </button>
                <button className="btn soft" onClick={editHeard}>
                  {t('debrief.edit')}
                </button>
                <button className="btn soft" onClick={retryHeard}>
                  <Icon name="mic" size={16} /> {t('debrief.tryAgain')}
                </button>
              </div>
            </div>
          )}
          {needsHelp && !hint && !assist && !heard && <p className="stuck">{real ? t('debrief.stuckReal') : t('c.stuck')}</p>}
          {noVoice && <p className="stuck dim">{t('c.noJaVoice')}</p>}
        </div>

        {phase === 'ended' ? (
          <div className="done-card">
            <div className="done-badge">
              <Icon name="star" size={26} />
            </div>
            <div>
              {session.endedBy === 'unmatched' ? (
                <>
                  <strong dir="auto">{t('debrief.tryLater')}</strong>
                  <small dir="auto">{t('debrief.tryLaterSub')}</small>
                </>
              ) : (
                <>
                  <strong>{prog.done >= prog.total ? t('c.complete') : t('debrief.over')}</strong>
                  <small>{t('c.completeSub', { done: prog.done, total: prog.total })}</small>
                </>
              )}
            </div>
            {game.purchases.length > 0 && (
              <button className="btn soft sm" onClick={() => setReceiptOpen(true)}>
                <Icon name="receipt" size={16} /> {t('debrief.receipt')}
              </button>
            )}
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

      {receiptOpen && game.purchases.length > 0 && <ReceiptSheet receipt={game.purchases[game.purchases.length - 1].receipt} onClose={() => setReceiptOpen(false)} />}
      {paused && (
        <div className="scrim center" role="dialog" aria-modal="true">
          <div className="modal">
            <h3>{t('c.paused')}</h3>
            <button className="btn primary wide" onClick={() => { setPaused(false); world?.setPaused(false); }}>
              <Icon name="play" size={18} /> {t('c.resume')}
            </button>
            <button className="btn soft wide" onClick={() => { world?.setPaused(false); setConfirmLeave(true); setPaused(false); }}>
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
