import { useEffect, useMemo, useState } from 'react';
import { LEXICON, segmentFree, entryToToken, type Token } from '@lw/content';
import { previewIntervals, type Grade } from '@lw/core';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { useStore, dueCount, type VocabItem } from '../store';
import { useT } from '../hooks';
import { exampleFor, meaningOf } from '../content';
import { blip, speakJa } from '../services';
import type { StringKey } from '../i18n';
import { dispatch } from '../game/bridge';
import { recallMark, recallScore } from '../game/prepareLogic';
import { applyRespace, enforceGoalCaps, isParked, planReview, reviewEvent } from '../game/srsHooks';

/** The label of where a card came from: the four sources the game adds have their own keys (the v1 table has the other five). */
const SOURCE_KEYS: Record<VocabItem['source'], StringKey> = {
  sign: 'v.src.sign',
  conversation: 'v.src.conversation',
  lesson: 'v.src.lesson',
  phrase: 'v.src.phrase',
  starter: 'v.src.starter',
  goal: 'prep.src.goal',
  correction: 'prep.src.correction',
  prepare: 'prep.src.prepare',
  echo: 'prep.src.echo',
};

function tokensFor(item: VocabItem): Token[] {
  if (item.kind === 'word') {
    const e = LEXICON.get(item.s);
    if (e) return [entryToToken(e)];
  }
  return segmentFree(item.s, LEXICON);
}

function rng(seedStr: string) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

type Mode = 'recall' | 'produce' | 'cloze';

function modeFor(item: VocabItem): Mode {
  if (item.kind === 'word' && exampleFor(item.s) && item.card.reps % 3 === 2) return 'cloze';
  return item.card.reps % 2 === 0 ? 'recall' : 'produce';
}

export function Vocab() {
  const { t, dir } = useT();
  const vocab = useStore((s) => s.vocab);
  const go = useStore((s) => s.go);
  const [tab, setTab] = useState<'words' | 'review'>(dueCount(vocab) > 0 ? 'review' : 'words');
  const due = dueCount(vocab);
  // cards parked beyond the daily cap come back when the backlog is small (§11.5)
  useEffect(() => enforceGoalCaps(), []);

  return (
    <div className="panel" dir={dir}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.close')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('v.title')}</h1>
        <span className="pill">{t('v.count', { n: vocab.length })}</span>
      </header>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'review'} className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>
          {t('v.review')} {due > 0 && <span className="pill alert">{due}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'words'} className={tab === 'words' ? 'on' : ''} onClick={() => setTab('words')}>
          {t('v.words')}
        </button>
      </div>
      {tab === 'words' ? <WordList /> : <Review />}
    </div>
  );
}

function WordList() {
  const { t, lang } = useT();
  const vocab = useStore((s) => s.vocab);
  const settings = useStore((s) => s.settings);
  const remove = useStore((s) => s.removeWord);
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return vocab;
    return vocab.filter((v) => v.s.includes(k) || v.rom.toLowerCase().includes(k) || (v.meaning.en ?? '').toLowerCase().includes(k) || (v.meaning.ar ?? '').includes(k));
  }, [vocab, q]);

  if (vocab.length === 0) {
    return (
      <div className="panel-body">
        <p className="empty" dir="auto">
          {t('v.empty')}
        </p>
      </div>
    );
  }
  return (
    <div className="panel-body">
      <input className="field" id="vsearch" placeholder={t('v.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="wordlist">
        {items.map((v) => (
          <li key={v.id} className="word-row">
            <div className="word-info">
              <JaText tokens={tokensFor(v)} furigana={settings.furigana} romaji={settings.romaji} size="md" />
              <span dir="auto">{meaningOf(v.meaning, lang)}</span>
              <small>
                {t(SOURCE_KEYS[v.source])}
                {isParked(v) && ` · ${t('prep.parked')}`}
              </small>
            </div>
            <button className="icon-btn ghost" onClick={() => speakJa(v.s, { rate: 0.85 })} aria-label={t('common.listen')}>
              <Icon name="volume" size={18} />
            </button>
            <button className="icon-btn ghost" onClick={() => remove(v.id)} aria-label={t('v.remove')}>
              <Icon name="trash" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Review() {
  const { t, lang, dir } = useT();
  const vocab = useStore((s) => s.vocab);
  const settings = useStore((s) => s.settings);
  const review = useStore((s) => s.reviewWord);
  const profile = useStore((s) => s.profile);
  // up to BALANCE.srs.amnestyDue due cards in due order; past that, the "Quick sprint" of the weakest cards and the rest moved forward (§11.5)
  const [plan] = useState(() => planReview(vocab));
  const queue = plan.queue;
  useEffect(() => applyRespace(plan), [plan]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState('');
  const [typedState, setTypedState] = useState<null | 'ok' | 'near'>(null);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  const item = vocab.find((v) => v.id === queue[i]);
  const mode = item ? modeFor(item) : 'recall';
  const example = item && mode === 'cloze' ? exampleFor(item.s) : null;

  const options = useMemo(() => {
    if (!item || mode !== 'cloze') return [];
    const r = rng(item.id + item.card.reps);
    const pool = LEXICON.all().filter((e) => !e.g && e.s !== item.s && e.s.length <= 6 && !e.s.includes('-'));
    const picks = new Set<string>();
    while (picks.size < 3) picks.add(pool[Math.floor(r() * pool.length)].s);
    const all = [item.s, ...picks];
    return all.sort(() => r() - 0.5);
  }, [item, mode]);

  if (!item) {
    return (
      <div className="panel-body center-col">
        <div className="done-badge big">
          <Icon name="check" size={34} stroke={3} />
        </div>
        <h2>{done > 0 ? t('v.allDone') : t('v.noneDue')}</h2>
        <p className="muted">{done > 0 ? t('v.session', { n: done }) : t('v.noneDue.sub')}</p>
      </div>
    );
  }

  const rate = (g: Grade) => {
    // the check that g_review8 counts: the pick-the-answer mode, or a typed answer that matched (§11.5); read the card before it changes
    const ev = reviewEvent(item, mode === 'cloze' || typedState === 'ok');
    review(item.id, g);
    dispatch(ev);
    setTyped('');
    setTypedState(null);
    blip(g === 'again' ? 'bad' : 'good', settings.autoSpeak);
    setDone(done + 1);
    setI(i + 1);
    setRevealed(false);
    setPicked(null);
  };
  const intervals = previewIntervals(item.card);
  const meaning = meaningOf(item.meaning, lang);
  const prompt = mode === 'cloze' ? t('v.cloze') : mode === 'recall' ? t('v.recall') : t('v.produce');
  const front = mode === 'produce';

  return (
    <div className="panel-body review">
      {plan.sprint && (
        <p className="prep-sprint card" dir="auto">
          <strong>{t('prep.sprint.title')}</strong> {t('prep.sprint.sub', { n: queue.length })}
        </p>
      )}
      <div className="bar wide thin">
        <i style={{ width: `${Math.round((i / queue.length) * 100)}%` }} />
      </div>
      <p className="muted small center">{prompt}</p>

      <div className={`flash ${revealed ? 'open' : ''}`}>
        {mode === 'cloze' && example ? (
          <>
            <div className="cloze-line">
              <JaText tokens={clozeTokens(example.ja, item.s, picked)} furigana={false} romaji={false} size="xl" />
            </div>
            <p dir="auto" className="muted">
              {lang === 'ar' ? example.ar : example.en}
            </p>
            <div className="options">
              {options.map((o) => {
                const right = o === item.s;
                const state = picked ? (right ? 'right' : o === picked ? 'wrong' : '') : '';
                return (
                  <button
                    key={o}
                    className={`option ${state}`}
                    disabled={!!picked}
                    onClick={() => {
                      setPicked(o);
                      speakJa(example.ja, { rate: 0.9 });
                    }}
                  >
                    <JaText tokens={[entryToToken(LEXICON.get(o)!)]} furigana={settings.furigana} romaji={false} size="md" />
                  </button>
                );
              })}
            </div>
            {picked && (
              <div className="rate-row">
                <button className="btn primary wide" onClick={() => rate(picked === item.s ? 'good' : 'again')}>
                  {t('common.continue')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {front ? (
              <div className="flash-main" dir="auto">
                {meaning}
              </div>
            ) : (
              <div className="flash-main">
                <JaText tokens={tokensFor(item)} furigana={revealed && settings.furigana} romaji={revealed && settings.romaji} size="xl" />
                <button className="icon-btn ghost" onClick={() => speakJa(item.s, { rate: 0.85 })} aria-label={t('common.listen')}>
                  <Icon name="volume" size={22} />
                </button>
              </div>
            )}
            {revealed && (
              <div className="flash-back">
                {front ? (
                  <div className="flash-main">
                    <JaText tokens={tokensFor(item)} furigana={settings.furigana} romaji size="xl" />
                    <button className="icon-btn ghost" onClick={() => speakJa(item.s, { rate: 0.85 })} aria-label={t('common.listen')}>
                      <Icon name="volume" size={22} />
                    </button>
                  </div>
                ) : (
                  <div className="meaning" dir="auto">
                    {meaning}
                  </div>
                )}
              </div>
            )}
            {!revealed && front && (
              <form
                className="prep-form prep-review-type"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!typed.trim()) return;
                  if (recallScore(typed, item.s) >= recallMark(profile ?? { age: 'adults', level: 'A1' })) {
                    setTypedState('ok');
                    setRevealed(true);
                    speakJa(item.s, { rate: 0.9 });
                  } else setTypedState('near');
                }}
              >
                <input
                  className="say prep-input"
                  value={typed}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    setTypedState(null);
                  }}
                  placeholder={t('prep.review.type')}
                  aria-label={t('prep.review.type')}
                  dir="ltr"
                  lang="ja"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button className="send" type="submit" disabled={!typed.trim()} aria-label={t('prep.check')}>
                  <Icon name="check" size={20} />
                </button>
              </form>
            )}
            {!revealed && front && typedState === 'near' && (
              <p className="prep-verdict near" dir="auto" role="status">
                {t('prep.review.near')}
              </p>
            )}
            {revealed && typedState === 'ok' && (
              <p className="prep-verdict ok" dir="auto" role="status">
                {t('prep.right')}
              </p>
            )}
            {!revealed ? (
              <div className="rate-row">
                <button className="btn primary wide" onClick={() => { setRevealed(true); if (!front) speakJa(item.s, { rate: 0.9 }); }}>
                  {t('v.reveal')}
                </button>
              </div>
            ) : (
              <div className="rate-grid">
                {(['again', 'hard', 'good', 'easy'] as const).map((g) => (
                  <button key={g} className={`rate ${g}`} onClick={() => rate(g)}>
                    <strong>{t(`v.${g}` as 'v.again')}</strong>
                    <small>{intervals[g]}</small>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The example sentence with the target word blanked out (or filled in after answering). */
function clozeTokens(sentence: string, word: string, picked: string | null): Token[] {
  const idx = sentence.indexOf(word);
  if (idx < 0) return segmentFree(sentence, LEXICON);
  const before = segmentFree(sentence.slice(0, idx), LEXICON);
  const after = segmentFree(sentence.slice(idx + word.length), LEXICON);
  const mid: Token = picked ? entryToToken(LEXICON.get(word)!) : { s: '＿＿＿', rom: '', raw: true };
  return [...before, mid, ...after];
}
