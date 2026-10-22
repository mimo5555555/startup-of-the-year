// The capstone's Prepare (docs/GAME_DESIGN.md §7.2 Chapter 7, §11.1; Release 2 wave C2): a dedicated five-line rehearsal of the self-introduction
// on the festival stage. Each line has the player's own fact filled in (`speechRehearsal`: the name, the country and hobby Mio remembers; an
// example, marked so, when the save does not know it). The learner listens to the model line (TTS), then says it (recognition only, nothing is
// recorded) or types it; a line that matches gets its tick. The speech itself is Real mode; a player who has never used Real mode gets the
// one-time Guided run (`guidedFallbackOpen`), told plainly. The pocket lines of the scenario that a passed line contains are filed as ready.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LEXICON, SPEECH_LINES, scenarioById, speechRehearsal, tokenize, type SpeechSlot } from '@lw/content';
import { guidedFallbackOpen, objectiveRows, type GameState, type GameView } from '@lw/game';
import { explainSttError } from '@lw/engine';
import { Icon } from '../Icon';
import { JaText } from '../JaText';
import { Ltr } from './WalletPill';
import { useT } from '../../hooks';
import { useStore } from '../../store';
import { meaningOf } from '../../content';
import { blip, speakJa, stt } from '../../services';
import type { StringKey } from '../../i18n';
import { dispatch } from '../../game/bridge';
import { getGame } from '../../game/gameStore';
import { useGameState, useGameView } from '../../game/hooks';
import { PACK } from '../../game/pack';
import { ownFactScore, plainOf, recallMark, recallScore, recallScoreSpoken } from '../../game/prepareLogic';

/** The speech objective (c7_3) and how many own lines it asks for now (5, or 3 once the easier version is accepted). */
export const SPEECH_OBJECTIVE = 'c7_3';

export interface SpeechRehearsalProps {
  scenarioId: string;
  characterId: string;
  /** leaves for the world and starts the speech in this mode */
  onStart: (mode: 'guided' | 'real') => void;
  onBack: () => void;
}

export function SpeechRehearsal({ scenarioId, onStart, onBack }: SpeechRehearsalProps) {
  const { t, lang, dir } = useT();
  const profile = useStore((s) => s.profile)!;
  const game = useGameState();
  const lines = useMemo(() => speechRehearsal(PACK, getGame(), lang, profile.name), [lang, profile.name]);
  const [ok, setOk] = useState<Record<number, boolean>>({});
  const fallback = guidedFallbackOpen(PACK, game, scenarioId);
  const sc = scenarioById(scenarioId);
  const done = Object.values(ok).filter(Boolean).length;

  // the scenario's pocket lines: studied by opening the rehearsal, ready once a passed line contains them (one prepare_done when it closes)
  const pocket = useMemo(() => (PACK.scenarioMeta.find((m) => m.id === scenarioId)?.pocket ?? []).filter((id) => PACK.pockets[id]), [scenarioId]);
  const ready = useRef(new Set<string>());
  const commit = useRef(() => {});
  commit.current = () => {
    if (!pocket.length) return;
    dispatch({ t: 'prepare_done', scenarioId, ready: [...ready.current], seen: pocket });
    ready.current.clear();
  };
  useEffect(() => () => commit.current(), []);
  const passed = (i: number, plain: string) => {
    setOk((o) => ({ ...o, [i]: true }));
    for (const id of pocket) if (plain.includes(plainOf(PACK.pockets[id]!.line.ja).replace(/[。！？]$/, ''))) ready.current.add(id);
  };
  const start = (mode: 'guided' | 'real') => {
    commit.current();
    onStart(mode);
  };

  return (
    <div className="panel prep fest-reh" dir={dir} data-rehearsal="1" data-stage="rehearsal">
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={onBack} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('prep.title')}</h1>
        <span className={`pill prep-count${done === lines.length ? ' ok' : ''}`} data-ticks={done}>
          <Ltr text={t('fest.ticks', { n: done, total: lines.length })} />
        </span>
      </header>
      <div className="panel-body prep-body">
        <p className="prep-for" dir="auto">
          {sc?.title[lang]}
        </p>
        <h2 className="h2" dir="auto">
          {t('story.speechRehearsal')}
        </h2>
        <p className="muted small" dir="auto">
          {t('fest.rehearsalSub')}
        </p>
        <ol className="fest-lines">
          {lines.map((l, i) => (
            <RehearsalLine key={`${l.slot}:${i}`} n={i + 1} slot={l.slot} ja={l.line.ja} meaning={meaningOf(l.line, lang)} example={l.example} ok={!!ok[i]} onPass={(plain) => passed(i, plain)} />
          ))}
        </ol>
        <p className="card fest-real" dir="auto" data-real-note="1">
          <Icon name="sparkle" size={16} /> {t('story.speechReal')}
        </p>
        {fallback && (
          <p className="muted small" dir="auto" data-guided-note="1">
            {t('fest.guidedNote')}
          </p>
        )}
      </div>
      <footer className="prep-foot">
        <button className="btn primary wide prep-btn" data-start="real" onClick={() => start('real')}>
          {t('fest.goStage')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
        </button>
        {fallback && (
          <button className="btn soft prep-btn" data-start="guided" onClick={() => start('guided')}>
            <Ltr text={t('story.speechGuidedOnce')} />
          </button>
        )}
      </footer>
    </div>
  );
}

/** One line of the speech: listen, say or type, check. */
function RehearsalLine({ n, slot, ja, meaning, example, ok, onPass }: { n: number; slot: SpeechSlot; ja: string; meaning: string; example: boolean; ok: boolean; onPass: (plain: string) => void }) {
  const { t } = useT();
  const settings = useStore((s) => s.settings);
  const profile = useStore((s) => s.profile)!;
  const mark = recallMark(profile);
  const tokens = useMemo(() => tokenize(ja, LEXICON).tokens, [ja]);
  const plain = useMemo(() => plainOf(ja), [ja]);
  // an example line passes with the learner's own fact too: its fixed part after the fact (「から来ました。」)
  const tail = useMemo(() => (example ? plainOf(SPEECH_LINES.find((l) => l.slot === slot)?.line.ja.split('{x}')[1]?.replace(/^\|/, '') ?? '') : ''), [example, slot]);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<'ok' | 'again' | null>(ok ? 'ok' : null);
  const [listening, setListening] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const judge = (score: number) => {
    const good = score >= mark;
    setVerdict(good ? 'ok' : 'again');
    blip(good ? 'good' : 'tap', settings.autoSpeak);
    if (good) onPass(plain);
  };
  const say = () => {
    if (listening) return;
    setMsg(null);
    setListening(true);
    // recognition only: text comes back, no audio is recorded or kept
    stt
      .listen('ja-JP')
      .result.then((r) => {
        setTyped(r.text);
        judge(Math.max(recallScoreSpoken(r, plain), tail ? ownFactScore(r.text, tail) : 0));
      })
      .catch((e: unknown) => {
        const id = explainSttError(e);
        if (id !== 'cancelled') setMsg(t(`audio.mic.err.${id}` as StringKey));
      })
      .finally(() => setListening(false));
  };

  return (
    <li className={`card fest-line${verdict === 'ok' ? ' ok' : ''}`} data-line={n} data-slot={slot} data-plain={plain} data-ok={verdict === 'ok' ? 1 : 0}>
      <span className="fest-line-head">
        <span className="fest-n" aria-hidden="true">
          {verdict === 'ok' ? <Icon name="check" size={16} stroke={3} /> : n}
        </span>
        {example && <span className="pill fest-example">{t('story.rehearsalExample')}</span>}
        <button type="button" className="icon-btn ghost fest-listen" data-listen={n} aria-label={t('common.listen')} onClick={() => void speakJa(plain, { rate: 0.85 }).catch(() => undefined)}>
          <Icon name="volume" size={20} />
        </button>
      </span>
      <JaText tokens={tokens} furigana={settings.furigana} romaji={settings.romaji} size="md" />
      <small className="fest-meaning" dir="auto">
        {meaning}
      </small>
      <form
        className="fest-try"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) judge(Math.max(recallScore(typed, plain), tail ? ownFactScore(typed, tail) : 0));
        }}
      >
        <input
          className="field"
          lang="ja"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={80}
          value={typed}
          placeholder={t('letter.typePh')}
          aria-label={t('letter.typePh')}
          data-type={n}
          onChange={(e) => {
            setTyped(e.target.value);
            if (verdict === 'again') setVerdict(null);
          }}
        />
        {stt.available() && (
          <button type="button" className={`icon-btn soft${listening ? ' rec' : ''}`} data-speak={n} aria-label={t('letter.speak')} onClick={say}>
            <Icon name="mic" size={20} />
          </button>
        )}
        <button type="submit" className="btn soft sm" data-check={n} disabled={!typed.trim()}>
          {t('fest.check')}
        </button>
      </form>
      {verdict && (
        <small className={`fest-verdict ${verdict}`} role="status" dir="auto">
          {t(verdict === 'ok' ? 'fest.lineOk' : 'fest.lineAgain')}
        </small>
      )}
      {msg && (
        <small className="muted" role="status" dir="auto">
          {msg}
        </small>
      )}
    </li>
  );
}

/**
 * The capstone's line in the debrief: the learner's own lines in the best speech against what the objective asks (5, or 3 once eased), and
 * Hanako's easier version once it is offered (after three tries, D40). Nothing for any other scenario.
 */
export function capstoneTally(state: GameState, view: GameView, scenarioId: string): { own: number; need: number; easier: 'none' | 'offered' | 'accepted' } | null {
  if (!PACK.scenarioMeta.find((m) => m.id === scenarioId)?.capstone) return null;
  const run = state.runs[scenarioId];
  const row = objectiveRows(PACK, state, view).find((r) => r.id === SPEECH_OBJECTIVE);
  const eased = state.chapter.easier.includes(SPEECH_OBJECTIVE);
  const def = PACK.chapters.flatMap((c) => c.objectives).find((o) => o.id === SPEECH_OBJECTIVE);
  const pred = eased && def?.easier ? def.easier.pred : def?.pred;
  const need = pred && pred.k === 'scenario' ? (pred.minIndependent ?? 5) : 5;
  return { own: run?.bestIndependent ?? 0, need, easier: row?.easier ?? (eased ? 'accepted' : 'none') };
}

export function CapstoneNote({ scenarioId }: { scenarioId: string }) {
  const { t } = useT();
  const state = useGameState();
  const view = useGameView();
  const tally = capstoneTally(state, view, scenarioId);
  if (!tally) return null;
  const met = tally.own >= tally.need;
  return (
    <section className={`card fest-own${met ? ' ok' : ''}`} data-capstone="1" data-own={tally.own} data-need={tally.need}>
      <strong dir="auto">
        <Ltr text={met ? t('fest.ownDone', { need: tally.need }) : t('fest.own', { n: tally.own, need: tally.need })} />
      </strong>
      {tally.easier === 'offered' && (
        <span className="qst-easier">
          <small dir="auto">
            <Ltr text={t('quests.easierSay')} />
          </small>
          <button className="btn soft sm" data-easier={SPEECH_OBJECTIVE} onClick={() => dispatch({ t: 'easier_accept', objective: SPEECH_OBJECTIVE })}>
            {t('quests.easier')}
          </button>
        </span>
      )}
    </section>
  );
}
