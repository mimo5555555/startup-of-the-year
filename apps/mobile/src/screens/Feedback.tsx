import { useEffect } from 'react';
import { romajiText, segmentFree, LEXICON, type Token } from '@lw/content';
import { levelProgress } from '@lw/core';
import type { Correction } from '@lw/engine';
import { Icon } from '../components/Icon';
import { JaText, type Mark } from '../components/JaText';
import { Portrait } from '../components/Portrait';
import { DebriefPay, DebriefProgress, FriendsStrip, KeepThese, NextGoalButton, useDebriefFor } from '../components/game/DebriefGame';
import { useStore } from '../store';
import { useT } from '../hooks';
import { characterById, displayName } from '../content';
import { SCENARIOS } from '@lw/content';
import { blip, speakJa } from '../services';
import { useUi } from '../ui';

function Ring({ value, label, tone, note }: { value: number | null; label: string; tone: string; note?: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <div className={`ring ${tone}`}>
      <svg viewBox="0 0 80 80" width="84" height="84" role="img" aria-label={`${label}: ${value ?? '-'}`}>
        <circle cx="40" cy="40" r={r} className="ring-bg" />
        {value !== null && <circle cx="40" cy="40" r={r} className="ring-fg" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 40 40)" />}
        <text x="40" y="45" textAnchor="middle" className="ring-n">
          {value === null ? '–' : value}
        </text>
      </svg>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </div>
  );
}

export function Feedback() {
  const { t, lang, dir } = useT();
  const data = useStore((s) => s.report);
  const settings = useStore((s) => s.settings);
  const go = useStore((s) => s.go);
  const vocab = useStore((s) => s.vocab);
  const saveWord = useStore((s) => s.saveWord);
  const say = useStore((s) => s.say);
  const xpTotal = useStore((s) => s.xp);
  const openWord = useUi((s) => s.openWord);
  const debrief = useDebriefFor(data);

  useEffect(() => {
    if (data && data.levelAfter > data.levelBefore) blip('level', settings.autoSpeak);
    else blip('good', settings.autoSpeak);
  }, [data, settings.autoSpeak]);

  if (!data) {
    go('world');
    return null;
  }
  const { report, scenarioId, xp } = data;
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const character = characterById(scenario.characterId)!;
  const lp = levelProgress(xpTotal);
  const savedSet = new Set(vocab.map((v) => v.s));
  const catLabel = { grammar: t('f.cat.grammar'), vocabulary: t('f.cat.vocabulary'), naturalness: t('f.cat.naturalness') } as const;

  const saveLine = (written: string, tokens: Token[], meaning: { en: string; ar: string }) => {
    saveWord({ kind: 'phrase', s: written, rom: romajiText(tokens), meaning, source: 'phrase' });
  };
  const saveAll = () => {
    for (const l of report.phrasesLearned) if (!savedSet.has(l.written)) saveLine(l.written, l.tokens, { en: l.en, ar: l.ar });
    say(t('common.saved'), 'good');
  };

  /** A correction. A soft one (a register note: "distant, not wrong") or a "maybe heard wrong" one is a gentle note, not a mistake. */
  const fixCard = (c: Correction, i: number, maybe = false) => {
    const note = c.soft || maybe;
    return (
      <article key={i} className={`fix fix-${c.category} ${note ? 'dbf-note' : ''}`}>
        <span className="cat">{note ? t('debrief.note') : catLabel[c.category]}</span>
        <div className="fix-line">
          <JaText tokens={segmentFree(c.original, LEXICON)} furigana={false} romaji={false} size="md" className={note ? '' : 'wrong'} marks={note ? [] : [{ start: c.span[0], end: c.span[1], kind: c.category }]} />
        </div>
        <div className="fix-better">
          <small>{t('f.better')}</small>
          <div className="row-between">
            <JaText tokens={segmentFree(c.better, LEXICON)} furigana={settings.furigana} romaji={settings.romaji} size="md" onTap={(tk) => openWord({ token: tk, source: 'conversation' })} />
            <button className="icon-btn ghost" onClick={() => speakJa(c.better, { rate: 0.9 })} aria-label={t('common.listen')}>
              <Icon name="volume" size={18} />
            </button>
          </div>
        </div>
        <p dir="auto">{c.explanation[lang]}</p>
        {c.soft && <small className="muted">{t('debrief.softSub')}</small>}
      </article>
    );
  };

  return (
    <div className="panel feedback" dir={dir}>
      <header className="panel-head">
        <div className="who">
          <Portrait spec={character.avatar} size={44} />
          <div>
            <small>{scenario.title[lang]}</small>
            <h1>{t('f.title')}</h1>
          </div>
        </div>
      </header>

      <div className="panel-body">
        <section className="card reward">
          <div className="xp-big">
            <Icon name="star" size={22} /> {t('f.xp', { n: xp })}
          </div>
          {data.levelAfter > data.levelBefore && <div className="levelup">{t('f.levelUp', { n: data.levelAfter })}</div>}
          <div className="bar wide">
            <i style={{ width: `${Math.round(lp.fraction * 100)}%` }} />
          </div>
          <small className="muted">{t('f.stats', { ind: report.stats.independent, ass: report.stats.assisted })}</small>
        </section>

        <section className="rings">
          <Ring value={report.scores.goal} label={t('f.goal')} tone="goal" />
          <Ring value={report.scores.fluency} label={t('f.fluency')} tone="flu" />
          <Ring value={report.scores.accuracy} label={t('f.accuracy')} tone="acc" note={report.scores.accuracy === null ? t('f.accuracy.na') : undefined} />
        </section>

        <section className="card praise" dir="auto">
          <p>{report.praise[lang]}</p>
        </section>

        {debrief && (
          <>
            <DebriefPay data={debrief} />
            <FriendsStrip data={debrief} />
          </>
        )}

        <section>
          <h2 className="h2">{t('f.focus')}</h2>
          <ul className="focus">
            {report.focusNext.map((f, i) => (
              <li key={i} dir="auto">
                {f[lang]}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="h2">{t('f.corrections')}</h2>
          {report.corrections.length === 0 ? (
            <p className="muted">{t('f.none')}</p>
          ) : (
            report.corrections.map((c, i) => fixCard(c, i))
          )}
          <p className="muted small">{t('f.rule')}</p>
        </section>

        {report.maybe && report.maybe.length > 0 && (
          <section>
            <h2 className="h2">{t('debrief.maybeTitle')}</h2>
            <p className="muted small" dir="auto">
              {t('debrief.maybeSub')}
            </p>
            {report.maybe.map((c, i) => fixCard(c, i, true))}
          </section>
        )}

        {debrief ? (
          <KeepThese
            data={debrief}
            saved={savedSet}
            onSave={(l) => saveLine(l.written, l.tokens, l.meaning)}
            onSaveAll={() => {
              for (const l of debrief.keep) if (l.assisted && !savedSet.has(l.written)) saveLine(l.written, l.tokens, l.meaning);
              say(t('common.saved'), 'good');
            }}
          />
        ) : (
          report.phrasesLearned.length > 0 && (
          <section>
            <div className="row-between">
              <h2 className="h2">{t('f.learned')}</h2>
              <button className="btn soft sm" onClick={saveAll}>
                <Icon name="bookmark" size={16} /> {t('f.saveAll')}
              </button>
            </div>
            <p className="muted small">{t('f.learned.sub')}</p>
            {report.phrasesLearned.map((l, i) => (
              <div key={i} className="learned">
                <div>
                  <JaText tokens={l.tokens} furigana={settings.furigana} romaji={settings.romaji} size="md" onTap={(tk) => openWord({ token: tk, source: 'conversation' })} />
                  <small dir="auto">{lang === 'ar' ? l.ar : l.en}</small>
                </div>
                <button className="icon-btn ghost" onClick={() => speakJa(l.plain, { rate: 0.9 })} aria-label={t('common.listen')}>
                  <Icon name="volume" size={18} />
                </button>
                <button
                  className={`icon-btn ${savedSet.has(l.written) ? 'on' : 'ghost'}`}
                  onClick={() => (savedSet.has(l.written) ? undefined : saveLine(l.written, l.tokens, { en: l.en, ar: l.ar }))}
                  aria-label={t('common.save')}
                >
                  <Icon name={savedSet.has(l.written) ? 'check' : 'bookmark'} size={18} />
                </button>
              </div>
            ))}
          </section>
          )
        )}

        {debrief && (
          <>
            <DebriefProgress data={debrief} />
            <NextGoalButton />
          </>
        )}

        <section>
          <h2 className="h2">{t('f.transcript')}</h2>
          <div className="transcript">
            {data.turns.map((turn) => {
              const marks: Mark[] = report.corrections.filter((c) => c.turnId === turn.id).map((c) => ({ start: c.span[0], end: c.span[1], kind: c.category }));
              return (
                <div key={turn.id} className={`tline ${turn.speaker === 'character' ? 'char' : 'me'}`}>
                  <span className="who-tag">{turn.speaker === 'character' ? displayName(character, lang) : t('c.you')}</span>
                  <JaText tokens={turn.tokens} furigana={settings.furigana} romaji={false} size="md" marks={marks} onTap={(tk) => openWord({ token: tk, source: 'conversation' })} />
                  {turn.assisted && (
                    <span className="tag assisted">
                      <Icon name="sparkle" size={12} /> {t('c.assisted')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="panel-foot">
        <button
          className="btn soft"
          onClick={() => {
            if (debrief) {
              // the same scenario in the same mode, through the conversation request (the host mounts it over the city)
              go('world');
              useUi.getState().startConvo({ scenarioId, characterId: character.id, mode: debrief.facts.mode });
              return;
            }
            useStore.getState().setPendingTalk(character.id);
            go('world');
          }}
        >
          <Icon name="replay" size={18} /> {t('f.again')}
        </button>
        <button className="btn primary wide" onClick={() => go('world')}>
          <Icon name="home" size={18} /> {t('f.back')}
        </button>
      </footer>
    </div>
  );
}

