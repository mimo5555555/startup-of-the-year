import { useMemo, useState } from 'react';
import { LEXICON, lessonById, romajiText, tokenize } from '@lw/content';
import { normJa, romajiAsKana } from '@lw/core';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { useStore } from '../store';
import { useT } from '../hooks';
import { characterById } from '../content';
import { lessonFinished } from '../game/bridge';
import { blip, speakJa, stt } from '../services';

type Stage = 'intro' | 'cards' | 'quiz' | 'say' | 'done';

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

export function Lesson() {
  const { t, lang, dir } = useT();
  const lessonId = useStore((s) => s.lessonId)!;
  const go = useStore((s) => s.go);
  const settings = useStore((s) => s.settings);
  const saveWord = useStore((s) => s.saveWord);
  const completeLesson = useStore((s) => s.completeLesson);
  const lesson = lessonById(lessonId)!;
  const teacher = characterById('hanako')!;

  const cards = useMemo(
    () =>
      lesson.cards.map((c) => {
        const tokens = tokenize(c.ja, LEXICON).tokens;
        return { ...c, tokens, rom: romajiText(tokens), meaning: lang === 'ar' ? c.ar : c.en, note: c.note?.[lang] };
      }),
    [lesson, lang],
  );

  const [stage, setStage] = useState<Stage>('intro');
  const [i, setI] = useState(0);
  const quiz = useMemo(() => shuffle(cards).slice(0, 5), [cards]);
  const sayItems = useMemo(() => shuffle(cards).slice(0, lesson.sayCount), [cards, lesson.sayCount]);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [verdict, setVerdict] = useState<null | 'right' | 'almost'>(null);
  const [listening, setListening] = useState(false);

  const options = useMemo(() => {
    const q = quiz[i];
    if (!q) return [];
    return shuffle([q, ...shuffle(cards.filter((c) => c.ja !== q.ja)).slice(0, 3)]);
  }, [quiz, i, cards]);

  const start = (s: Stage) => {
    setStage(s);
    setI(0);
    setPicked(null);
    setVerdict(null);
    setTyped('');
    blip('tap', settings.autoSpeak);
    if (s === 'cards') speakJa(cards[0].ja, { rate: 0.85 });
    if (s === 'quiz') speakJa(quiz[0].ja, { rate: 0.85 });
  };

  const finish = () => {
    for (const c of cards) saveWord({ kind: 'phrase', s: c.ja, rom: c.rom, meaning: { en: c.en, ar: c.ar }, source: 'lesson' });
    completeLesson(lessonId, 25 + score * 3);
    // a replay is not a new lesson for the v1 store, but it still counts for today's goal
    lessonFinished(lessonId);
    blip('level', settings.autoSpeak);
    setStage('done');
  };

  const total = stage === 'cards' ? cards.length : stage === 'quiz' ? quiz.length : sayItems.length;

  const check = (text: string) => {
    const target = sayItems[i];
    const kana = romajiAsKana(text) ?? text;
    const ok = normJa(kana) === normJa(target.ja);
    setVerdict(ok ? 'right' : 'almost');
    if (ok) {
      setScore((s) => s + 1);
      blip('good', settings.autoSpeak);
    } else blip('bad', settings.autoSpeak);
  };

  const mic = () => {
    if (!stt.available()) return;
    setListening(true);
    stt
      .listen('ja-JP')
      .result.then((r) => {
        setTyped(r.text);
        check(r.text);
      })
      .catch(() => undefined)
      .finally(() => setListening(false));
  };

  return (
    <div className="panel lesson" dir={dir}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.close')}>
          <Icon name="x" size={22} />
        </button>
        <h1>{lesson.title[lang]}</h1>
        {(stage === 'cards' || stage === 'quiz' || stage === 'say') && (
          <span className="pill">{t('l.card', { n: Math.min(i + 1, total), total })}</span>
        )}
      </header>

      <div className="panel-body">
        {stage === 'intro' && (
          <div className="center-col">
            <Portrait spec={teacher.avatar} size={120} />
            <h2>{teacher.name.ja}</h2>
            <p className="lead" dir="auto">
              {lesson.intro[lang]}
            </p>
            <button className="btn primary wide" onClick={() => start('cards')}>
              {t('l.start')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
            </button>
          </div>
        )}

        {stage === 'cards' && (
          <div className="lesson-card" key={i}>
            <JaText tokens={cards[i].tokens} furigana={settings.furigana} romaji size="xl" />
            <div className="meaning" dir="auto">
              {cards[i].meaning}
            </div>
            {cards[i].note && (
              <p className="note" dir="auto">
                {cards[i].note}
              </p>
            )}
            <button className="btn soft" onClick={() => speakJa(cards[i].ja, { rate: 0.8 })}>
              <Icon name="volume" size={18} /> {t('common.listen')}
            </button>
          </div>
        )}

        {stage === 'quiz' && quiz[i] && (
          <div className="lesson-card" key={i}>
            <p className="muted">{t('l.quizQ')}</p>
            <JaText tokens={quiz[i].tokens} furigana={settings.furigana} romaji={false} size="xl" />
            <button className="btn soft" onClick={() => speakJa(quiz[i].ja, { rate: 0.8 })}>
              <Icon name="volume" size={18} /> {t('common.listen')}
            </button>
            <div className="options col">
              {options.map((o) => {
                const right = o.ja === quiz[i].ja;
                const state = picked ? (right ? 'right' : o.ja === picked ? 'wrong' : '') : '';
                return (
                  <button
                    key={o.ja}
                    className={`option ${state}`}
                    disabled={!!picked}
                    dir="auto"
                    onClick={() => {
                      setPicked(o.ja);
                      if (right) {
                        setScore((s) => s + 1);
                        blip('good', settings.autoSpeak);
                      } else blip('bad', settings.autoSpeak);
                    }}
                  >
                    {o.meaning}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {stage === 'say' && sayItems[i] && (
          <div className="lesson-card" key={i}>
            <p className="muted">{t('l.sayPrompt')}</p>
            <div className="meaning" dir="auto">
              {sayItems[i].meaning}
            </div>
            <JaText tokens={sayItems[i].tokens} furigana={false} romaji size="lg" className="dim-text" />
            <form
              className="inputbar"
              onSubmit={(e) => {
                e.preventDefault();
                if (!verdict && typed.trim()) check(typed);
              }}
            >
              {stt.available() && (
                <button type="button" className={`mic ${listening ? 'rec' : ''}`} onClick={mic} aria-label={t('c.mic')}>
                  <Icon name="mic" size={22} />
                </button>
              )}
              <input id="lesson-say" className="say" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="こんにちは / konnichiwa" autoComplete="off" autoCapitalize="off" disabled={!!verdict} />
              <button className="send" type="submit" disabled={!typed.trim() || !!verdict} aria-label={t('l.check')}>
                <Icon name="check" size={20} />
              </button>
            </form>
            {verdict && (
              <p className={`verdict ${verdict}`} dir="auto">
                {verdict === 'right' ? t('l.right') : t('l.almost', { answer: sayItems[i].ja })}
              </p>
            )}
          </div>
        )}

        {stage === 'done' && (
          <div className="center-col">
            <div className="done-badge big">
              <Icon name="star" size={34} />
            </div>
            <h2>{t('l.done')}</h2>
            <p className="lead" dir="auto">
              {t('l.doneSub')}
            </p>
            <p className="pill">{t('f.xp', { n: 25 + score * 3 })}</p>
            <button className="btn primary wide" onClick={() => go('world')}>
              <Icon name="home" size={18} /> {t('f.back')}
            </button>
          </div>
        )}
      </div>

      {(stage === 'cards' || stage === 'quiz' || stage === 'say') && (
        <footer className="panel-foot">
          <span />
          <button
            className="btn primary wide"
            disabled={(stage === 'quiz' && !picked) || (stage === 'say' && !verdict && false)}
            onClick={() => {
              const last = i + 1 >= total;
              if (stage === 'cards') {
                if (last) return start('quiz');
                setI(i + 1);
                speakJa(cards[i + 1].ja, { rate: 0.85 });
              } else if (stage === 'quiz') {
                if (last) return start('say');
                setI(i + 1);
                setPicked(null);
                speakJa(quiz[i + 1].ja, { rate: 0.85 });
              } else {
                if (last) return finish();
                setI(i + 1);
                setTyped('');
                setVerdict(null);
              }
            }}
          >
            {t('common.next')} <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={18} />
          </button>
        </footer>
      )}
    </div>
  );
}
