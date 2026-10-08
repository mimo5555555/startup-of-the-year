// Prepare, the Phrase Pocket (docs/GAME_DESIGN.md §11.1, D21): 3-4 lines of a scenario, studied (hear, read, say along) and then recalled
// with the Japanese hidden. Passing a recall makes the line `ready` for BALANCE.readyDays; a pocket with its key lines ready pays the
// x1.10 and counts those lines as recalled (class I) in the conversation. Skipping is one tap and only forfeits the bonus.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LEXICON, scenarioById, tokenize } from '@lw/content';
import { BALANCE, type PocketLine } from '@lw/game';
import { explainSttError } from '@lw/engine';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { LtrNum, StatusMark } from '../components/game/PocketCard';
import { SayIt } from '../components/game/SayIt';
import { useT } from '../hooks';
import { useStore } from '../store';
import { useUi } from '../ui';
import { characterById, displayName, meaningOf } from '../content';
import { blip, speakJa, stt } from '../services';
import type { StringKey } from '../i18n';
import { applySrsOps, dispatch, startConversation } from '../game/bridge';
import { getGame } from '../game/gameStore';
import { useDerivedFlags, useGameState, useGameView } from '../game/hooks';
import { PACK } from '../game/pack';
import { gameView } from '../game/selectors';
import { linesToRecall, plainOf, pocketView, recallMark, recallScoreSpoken, type PocketView } from '../game/prepareLogic';
import { enforceGoalCaps, pocketWordOps } from '../game/srsHooks';

type Stage = 'ready' | 'study' | 'recall' | 'done';
type Mode = 'guided' | 'real';

export function Prepare() {
  const { t, dir } = useT();
  const go = useStore((s) => s.go);
  const args = useUi((s) => s.args.prepare);
  const game = useGameState();
  const view = useGameView();
  const pocket = args ? pocketView(PACK, game, view, args.scenarioId) : null;

  // a route opened without a pocket (or a scenario without one) is never a dead end: the way back is right there
  if (!args || !pocket) {
    return (
      <div className="panel prep" dir={dir}>
        <header className="panel-head">
          <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
            <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
          </button>
          <h1>{t('prep.title')}</h1>
          <span />
        </header>
        <div className="panel-body prep-body">
          <p className="muted" dir="auto">
            {t('prep.empty')}
          </p>
          {args && (
            <button className="btn primary wide prep-btn" onClick={() => talk(args.scenarioId, args.characterId, args.mode ?? 'guided', go)}>
              {t('prep.start')}
            </button>
          )}
        </div>
      </div>
    );
  }
  return <PrepareBody key={args.scenarioId} scenarioId={args.scenarioId} characterId={args.characterId} initialMode={args.mode ?? 'guided'} pocket={pocket} />;
}

/** Leaves for the world and starts the conversation (the ramen shop's ticket waiting means it starts at the firmness question, as the sheet does). */
function talk(scenarioId: string, characterId: string, mode: Mode, go: (s: 'world') => void): void {
  const startNode = PACK.scenarioMeta.find((m) => m.id === scenarioId)?.startNode;
  const ticket = (getGame().tickets as Record<string, unknown>)[scenarioId];
  go('world');
  startConversation({ scenarioId, characterId, mode, ...(startNode && ticket ? { startNode } : {}) });
}

function PrepareBody({ scenarioId, characterId, initialMode, pocket }: { scenarioId: string; characterId: string; initialMode: Mode; pocket: PocketView }) {
  const { t, lang, dir } = useT();
  const go = useStore((s) => s.go);
  const profile = useStore((s) => s.profile)!;
  const flags = useDerivedFlags();
  const sc = scenarioById(scenarioId);
  const who = characterById(characterId);
  const meta = PACK.scenarioMeta.find((m) => m.id === scenarioId);
  const mark = recallMark(profile);

  const [stage, setStage] = useState<Stage>(pocket.ready ? 'ready' : 'study');
  const [mode, setMode] = useState<Mode>(initialMode);
  const [i, setI] = useState(0);
  const [queue, setQueue] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<Record<string, 'pass' | 'peek'>>({});

  // what happened on this visit, sent to the game in one `prepare_done` per step (and when the screen closes)
  const seen = useRef(new Set<string>());
  const ready = useRef(new Set<string>());
  const commit = () => {
    if (seen.current.size === 0 && ready.current.size === 0) return;
    const before = getGame().prep;
    const fresh = [...seen.current, ...ready.current].filter((id) => before[id] === undefined);
    const lines = [...new Set(fresh)].flatMap((id) => (PACK.pockets[id] ? [PACK.pockets[id]] : []));
    dispatch({ t: 'prepare_done', scenarioId, ready: [...ready.current], seen: [...seen.current] });
    // a word card for each new word of a new line, after the phrase cards the reducer asked for (they win the daily cap)
    if (lines.length) applySrsOps(pocketWordOps(lines));
    enforceGoalCaps();
    seen.current.clear();
    ready.current.clear();
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => () => commitRef.current(), []);

  const lines = pocket.lines;
  const line = lines[Math.min(i, lines.length - 1)];
  const realOffered = flags.realMode && meta?.real === true;

  const fresh = () => pocketView(PACK, getGame(), gameView(useStore.getState()), scenarioId) ?? pocket;
  const startRecall = () => {
    commit();
    const q = linesToRecall(fresh());
    setQueue(q);
    setOutcome({});
    setI(0);
    setStage(q.length ? 'recall' : 'done');
  };
  const finish = () => {
    commit();
    setStage('done');
  };
  const start = () => {
    commit();
    talk(scenarioId, characterId, realOffered ? mode : 'guided', go);
  };
  const back = () => {
    commit();
    go('world');
  };

  const title = sc?.title[lang] ?? '';
  const withWho = who ? `${title} · ${displayName(who, lang)}` : title;

  return (
    <div className="panel prep" dir={dir} data-stage={stage}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={back} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('prep.title')}</h1>
        {(stage === 'study' || stage === 'recall') && (
          <span className="pill prep-count">
            <LtrNum text={t('prep.progress', { n: Math.min(i + 1, stage === 'study' ? lines.length : queue.length), total: stage === 'study' ? lines.length : queue.length })} />
          </span>
        )}
      </header>

      <div className="panel-body prep-body">
        <p className="prep-for" dir="auto">
          {withWho}
        </p>
        {realOffered && <ModeToggle mode={mode} onChange={setMode} />}

        {stage === 'ready' && (
          <section className="card prep-card prep-ready" aria-live="polite">
            <h2 className="h2">
              <Icon name="check" size={20} stroke={3} /> {t('prep.ready')}
            </h2>
            <p dir="auto">
              <LtrNum text={t('prep.ready.sub')} />
            </p>
            {Number.isFinite(pocket.daysLeft) && (
              <small className="muted" dir="auto">
                <LtrNum text={t('prep.ready.days', { n: pocket.daysLeft })} />
              </small>
            )}
            <LineList pocket={pocket} />
          </section>
        )}

        {stage === 'study' && line && (
          <StudyCard
            key={line.id}
            line={line.line}
            status={line.status}
            total={lines.length}
            index={i}
          />
        )}

        {stage === 'recall' && queue[i] && PACK.pockets[queue[i]] && (
          <section className="card prep-card">
            <p className="muted small" dir="auto">
              {t('prep.recall.sub')}
            </p>
            <SayIt
              key={queue[i]}
              ja={PACK.pockets[queue[i]].line.ja}
              meaning={PACK.pockets[queue[i]].line}
              mark={mark}
              tiles={{ line: PACK.pockets[queue[i]], others: lines.map((l) => l.line) }}
              onPass={() => {
                ready.current.add(queue[i]);
                seen.current.add(queue[i]);
                setOutcome((o) => ({ ...o, [queue[i]]: 'pass' }));
              }}
              onPeek={() => {
                // Peek keeps the line studied and never ready
                seen.current.add(queue[i]);
                setOutcome((o) => ({ ...o, [queue[i]]: 'peek' }));
              }}
            />
          </section>
        )}

        {stage === 'done' && (
          <section className="card prep-card" aria-live="polite" data-ready={pocket.ready ? 1 : 0}>
            <h2 className="h2">{pocket.ready ? t('prep.ready') : t('prep.done.notYet.title')}</h2>
            <p dir="auto">
              <LtrNum text={pocket.ready ? t('prep.done.ready') : t('prep.done.notYet')} />
            </p>
            <LineList pocket={pocket} />
          </section>
        )}
      </div>

      <footer className="prep-foot">
        {stage === 'ready' && (
          <>
            <button className="btn primary wide prep-btn" onClick={start}>
              {t('prep.start')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
            </button>
            <button className="prep-link" onClick={() => setStage('study')}>
              {t('prep.review')}
            </button>
          </>
        )}
        {stage === 'study' && (
          <>
            <div className="prep-nav">
              {i > 0 && (
                <button className="btn soft prep-btn" onClick={() => setI(i - 1)}>
                  <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={18} /> {t('common.back')}
                </button>
              )}
              <button className="btn primary wide prep-btn" onClick={() => {
                  // a line counts as studied once the learner moves on from it
                  seen.current.add(line.id);
                  if (i + 1 < lines.length) setI(i + 1);
                  else startRecall();
                }}>
                {i + 1 < lines.length ? t('common.next') : t('prep.test')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
              </button>
            </div>
            <button className="prep-link" onClick={start}>
              {t('prep.skip')}
            </button>
          </>
        )}
        {stage === 'recall' && (
          <>
            <button
              className="btn primary wide prep-btn"
              disabled={!outcome[queue[i]]}
              onClick={() => {
                if (i + 1 < queue.length) setI(i + 1);
                else finish();
              }}
            >
              {i + 1 < queue.length ? t('common.next') : t('prep.finish')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
            </button>
            <button className="prep-link" onClick={start}>
              {t('prep.skip')}
            </button>
          </>
        )}
        {stage === 'done' && (
          <>
            <button className="btn primary wide prep-btn" onClick={start}>
              {t('prep.start')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
            </button>
            <button className="btn soft prep-btn" onClick={() => (pocket.ready ? (setI(0), setStage('study')) : startRecall())}>
              {t('prep.again')}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useT();
  return (
    <div className="prep-mode" role="radiogroup" aria-label={t('prep.mode')}>
      {(['guided', 'real'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} className={`prep-mode-btn ${mode === m ? 'on' : ''}`} onClick={() => onChange(m)}>
          <LtrNum text={t(m === 'guided' ? 'prep.mode.guided' : 'prep.mode.real')} />
        </button>
      ))}
    </div>
  );
}

function LineList({ pocket }: { pocket: PocketView }) {
  const { lang } = useT();
  return (
    <ul className="prep-pocket-lines">
      {pocket.lines.map((l) => (
        <li key={l.id}>
          <span className="prep-pocket-ja" lang="ja" dir="ltr">
            {plainOf(l.line.line.ja)}
          </span>
          <small dir="auto">{meaningOf(l.line.line, lang)}</small>
          <StatusMark status={l.status} />
        </li>
      ))}
    </ul>
  );
}

/** Step 1: the Japanese is visible. Hear it (slow, then normal), read it, say it along if there is a microphone. */
function StudyCard({ line, status, index, total }: { line: PocketLine; status: PocketView['lines'][number]['status']; index: number; total: number }) {
  const { t, lang } = useT();
  const settings = useStore((s) => s.settings);
  const tokens = useMemo(() => tokenize(line.line.ja, LEXICON).tokens, [line]);
  const plain = useMemo(() => plainOf(line.line.ja), [line]);
  const [heard, setHeard] = useState<{ text: string; score: number } | null>(null);
  const [listening, setListening] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const hear = () => {
    // slow first so the sounds are clear, then at speed (§11.1)
    void speakJa(plain, { rate: 0.8 })
      .then(() => speakJa(plain, { rate: 1 }))
      .catch(() => undefined);
  };
  useEffect(() => {
    if (settings.autoSpeak) hear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const along = () => {
    if (listening) return;
    setMsg(null);
    setHeard(null);
    setListening(true);
    stt
      .listen('ja-JP')
      .result.then((r) => {
        const score = recallScoreSpoken(r, plain);
        setHeard({ text: r.text, score });
        blip(score >= BALANCE.recallPass.beginner ? 'good' : 'tap', settings.autoSpeak);
      })
      .catch((e: unknown) => {
        const id = explainSttError(e);
        if (id !== 'cancelled') setMsg(t(`audio.mic.err.${id}` as StringKey));
      })
      .finally(() => setListening(false));
  };

  return (
    <article className="card prep-card" data-line={line.id} aria-label={`${index + 1}/${total}`}>
      {line.key && <span className="prep-key">{t('prep.key')}</span>}
      <JaText tokens={tokens} furigana={settings.furigana} romaji={settings.romaji} size="xl" />
      <p className="prep-meaning" dir="auto">
        {meaningOf(line.line, lang)}
      </p>
      {line.note && (
        <p className="muted small" dir="auto">
          {meaningOf(line.note, lang)}
        </p>
      )}
      <div className="prep-row">
        <button type="button" className="btn soft prep-btn" onClick={hear}>
          <Icon name="volume" size={18} /> {t('common.listen')}
        </button>
        {stt.available() && (
          <button type="button" className={`btn soft prep-btn ${listening ? 'rec' : ''}`} onClick={along}>
            <Icon name="mic" size={18} /> {t('prep.along')}
          </button>
        )}
      </div>
      {heard && (
        <small className="muted" dir="auto" role="status">
          <LtrNum text={`${t('c.mic.heard', { text: heard.text })} · ${t('c.mic.match', { n: Math.round(heard.score * 100) })}`} />
        </small>
      )}
      {msg && (
        <small className="muted" dir="auto" role="status">
          {msg}
        </small>
      )}
      <StatusMark status={status} />
    </article>
  );
}
