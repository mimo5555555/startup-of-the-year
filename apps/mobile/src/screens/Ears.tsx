// 耳トレ (mimi-tore), the daily ear training (from the Quests screen's Today tab): five recorded lines from the player's own conversations.
// Each round plays the line in the character's voice with the text hidden; "Play again" and "Slower" as often as wanted; then three meanings
// to choose from. After the choice the Japanese is shown (furigana and romaji as in Settings) with the meaning. The first finished session
// of a day is filed (`ears_done`: the g_ears daily goal); later ones the same day are practice.
import { useEffect, useMemo, useRef, useState } from 'react';
import { SCENARIOS } from '@lw/content';
import { JaText } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { Icon } from '../components/Icon';
import { characterById, displayName, lineTokens } from '../content';
import { dispatch } from '../game/bridge';
import { earPool, earRounds, EARS_ROUNDS, type EarRound } from '../game/earsLogic';
import { useGameState } from '../game/hooks';
import { useT } from '../hooks';
import { blip, tts } from '../services';
import { useStore } from '../store';

export function Ears() {
  const { t, dir, lang } = useT();
  const go = useStore((s) => s.go);
  const settings = useStore((s) => s.settings);
  const game = useGameState();
  const [ready, setReady] = useState(false);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const filed = useRef(false);
  const already = game.ears?.day === game.clock.dayIndex;

  useEffect(() => {
    let live = true;
    void tts.load().then(() => live && setReady(true));
    return () => {
      live = false;
      tts.cancel();
    };
  }, []);

  const rounds: EarRound[] = useMemo(() => {
    if (!ready) return [];
    const met = new Set(Object.keys(game.runs));
    const pool = earPool(SCENARIOS, met, (text, who) => tts.fileFor(text, who) !== null);
    return earRounds(pool, `ears:${game.clock.dayIndex}`);
    // the day's set is fixed once the recordings are known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, game.clock.dayIndex]);
  const round = rounds[i];

  const play = (slow = false) => {
    if (!round) return;
    setPlaying(true);
    void tts.speak(round.line.ja, { who: round.line.who, rate: slow ? 0.75 : 1, onEnd: () => setPlaying(false) }).finally(() => setPlaying(false));
  };
  // each new line plays by itself
  useEffect(() => {
    if (round && picked === null) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const choose = (k: number) => {
    if (picked !== null || !round) return;
    setPicked(k);
    const ok = round.options[k] === round.line;
    if (ok) setRight((n) => n + 1);
    blip(ok ? 'good' : 'bad', settings.autoSpeak);
  };
  const next = () => {
    if (i + 1 < rounds.length) {
      setI(i + 1);
      setPicked(null);
      return;
    }
    setDone(true);
    if (!filed.current) {
      filed.current = true;
      dispatch({ t: 'ears_done', right, total: rounds.length });
    }
  };

  const who = round ? characterById(round.line.who) : undefined;
  const meaning = (l: EarRound['line']) => (lang === 'ar' ? l.ar : l.en);

  return (
    <div className="panel ears" dir={dir} data-screen="ears" data-round={done ? 'done' : i + 1}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('quests')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>
          {t('ears.title')}
          <small lang="ja">耳トレ</small>
        </h1>
        <span className="ears-count" dir="ltr">
          {rounds.length ? `${Math.min(i + 1, rounds.length)}/${rounds.length}` : ''}
        </span>
      </header>
      <div className="panel-body ears-body">
        {!ready && <p className="muted center">{t('ears.loading')}</p>}
        {ready && rounds.length === 0 && (
          <p className="card center" data-ears-empty dir="auto">
            {t('ears.empty')}
          </p>
        )}
        {round && !done && (
          <>
            <p className="muted small" dir="auto">
              {t(i === 0 ? 'ears.intro' : 'ears.listen')}
            </p>
            <section className="card ears-stage">
              {who && (
                <span className="ears-who">
                  <Portrait spec={who.avatar} size={44} />
                  <strong dir="auto">{displayName(who, lang)}</strong>
                </span>
              )}
              <div className="ears-play">
                <button type="button" className={`btn primary ears-btn${playing ? ' on' : ''}`} onClick={() => play(false)} data-ears-play>
                  <Icon name="volume" size={20} /> {t('ears.again')}
                </button>
                <button type="button" className="btn soft" onClick={() => play(true)} data-ears-slow>
                  {t('ears.slower')}
                </button>
              </div>
              {picked !== null ? (
                <div className="ears-reveal" data-ears-reveal>
                  <JaText tokens={lineTokens(round.line.markup)} furigana={settings.furigana} romaji={settings.romaji} size="lg" />
                  <p dir="auto">{meaning(round.line)}</p>
                </div>
              ) : (
                <p className="ears-hidden muted" aria-hidden="true">
                  ？？？
                </p>
              )}
            </section>
            <h2 className="h2">{t('ears.q')}</h2>
            <ul className="ears-options">
              {round.options.map((o, k) => {
                const state = picked === null ? '' : o === round.line ? ' right' : k === picked ? ' wrong' : ' dim';
                return (
                  <li key={k}>
                    <button type="button" className={`card ears-opt${state}`} onClick={() => choose(k)} disabled={picked !== null} data-ears-opt={k} data-right={o === round.line ? 1 : 0} dir="auto">
                      {meaning(o)}
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked !== null && (
              <button type="button" className="btn primary wide" onClick={next} data-ears-next>
                {i + 1 < rounds.length ? t('ears.next') : t('ears.finish')}
              </button>
            )}
          </>
        )}
        {done && (
          <section className="card center ears-done" data-ears-done data-right={right}>
            <span className="ears-score" dir="ltr">
              {right}/{rounds.length}
            </span>
            <p dir="auto">{t(right === rounds.length ? 'ears.perfect' : right >= Math.ceil(rounds.length / 2) ? 'ears.good' : 'ears.keep')}</p>
            <p className="muted small" dir="auto">
              {t(already && !filed.current ? 'ears.practice' : 'ears.counted')}
            </p>
            <button type="button" className="btn primary wide" onClick={() => go('quests')}>
              {t('common.done')}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

/** The Today tab's door to the ear training: what it is, and whether today's session is done. */
export function EarsCard() {
  const { t, dir } = useT();
  const go = useStore((s) => s.go);
  const game = useGameState();
  const doneToday = game.ears?.day === game.clock.dayIndex;
  return (
    <button type="button" className="card ears-card" onClick={() => go('ears')} data-open="ears" data-done={doneToday ? 1 : 0} dir={dir}>
      <span className="ears-card-icon" aria-hidden="true">
        <Icon name={doneToday ? 'check' : 'volume'} size={22} />
      </span>
      <span>
        <strong>
          {t('ears.title')} <small lang="ja">耳トレ</small>
        </strong>
        <small dir="auto">{doneToday ? t('ears.cardDone', { n: game.ears.days }) : t('ears.cardSub', { n: EARS_ROUNDS })}</small>
      </span>
      <Icon name={dir === 'rtl' ? 'chevL' : 'chevR'} size={20} />
    </button>
  );
}
