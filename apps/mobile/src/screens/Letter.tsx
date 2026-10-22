// The Letter Home (docs/GAME_DESIGN.md §7.2 Chapter 8, `screen:'letter'`; Release 2 wave C2). Five sentence frames, each pre-filled from something
// the game remembers (`letterFrames`). The learner writes each one: typed or spoken it is their own (independent), picked from the frame's three
// ideas or translated it is assisted and marked so. At least three of the five must be their own to finish. Only the written Japanese is stored
// (`letter_saved`): the microphone is used for recognition only and no audio is ever recorded or kept. The finished Letter is a card (furigana and
// romaji per the settings, the meaning below) that can be saved as an image (a local download) and that Hanako reads back by TTS. The diary lines
// of the earlier closing beats can be added under the five sentences.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LETTER_FRAMES, LETTER_HANAKO, LETTER_RULE, LEXICON, letterDiary, letterFrames, resolveLine, type Gloss, type Line } from '@lw/content';
import type { DiaryEntry } from '@lw/game';
import { explainSttError, translatePhrase } from '@lw/engine';
import { Icon } from '../components/Icon';
import { JaText } from '../components/JaText';
import { LetterCard } from '../components/game/LetterCard';
import { Ltr } from '../components/game/WalletPill';
import { characterById } from '../content';
import { dispatch } from '../game/bridge';
import { useGameState } from '../game/hooks';
import { PACK } from '../game/pack';
import { bareJa, cardOf, diaryGloss, draftsFromSaved, freeTokens, letterSentences, readBackText, saveCardImage, sentenceOf, tallyOf, typedJapanese, type LetterDraft } from '../game/letterLogic';
import { useT } from '../hooks';
import type { StringKey } from '../i18n';
import { stt, tts } from '../services';
import { useStore } from '../store';

type FrameView = ReturnType<typeof letterFrames>[number];

/** The gloss of a sentence the frame offered (a picked idea, or the pre-filled start left as it was). */
function glossOf(ja: string, frame: FrameView | undefined): Gloss | undefined {
  if (!frame) return undefined;
  const hit = [...frame.suggestions, frame.starter].find((l) => bareJa(l.ja) === ja);
  return hit ? { en: hit.en, ar: hit.ar } : undefined;
}

export function Letter() {
  const { t, lang, dir } = useT();
  const go = useStore((s) => s.go);
  const profile = useStore((s) => s.profile);
  const game = useGameState();
  const frames = useMemo(() => letterFrames(PACK, game, profile?.name ?? ''), [game, profile?.name]);
  const written = game.chapter.flags.includes('letter_written') && game.letter.length >= LETTER_RULE.sentences;
  const [editing, setEditing] = useState(!written);
  const [drafts, setDrafts] = useState<Array<LetterDraft | null>>(() =>
    game.letter.length ? draftsFromSaved(LETTER_FRAMES.map((f) => f.id), game.letter) : LETTER_FRAMES.map(() => null),
  );
  const diary = useMemo(() => letterDiary(game), [game]);
  const [extras, setExtras] = useState<DiaryEntry[]>(() => game.letter.slice(LETTER_RULE.sentences).flatMap((s) => diary.filter((d) => d.ja === s.ja).slice(0, 1)));
  const [toast, setToast] = useState<string | null>(null);
  const tally = tallyOf(drafts);

  // nothing to write before Chapter 8 (a stray route): back to the street, never an empty screen
  useEffect(() => {
    if (game.chapter.n < 8) go('world');
  }, [game.chapter.n, go]);
  useEffect(() => () => tts.cancel(), []);

  const name = game.me.nameKana || profile?.name || '';
  const saved = game.letter;
  const card = useMemo(() => {
    const ss = editing ? letterSentences(drafts, extras) : saved;
    const glosses = ss.map((s, i) => (i < LETTER_RULE.sentences ? (drafts[i]?.gloss ?? glossOf(s.ja, frames[i])) : diaryGloss(s.ja)));
    const nExtras = Math.max(0, ss.length - LETTER_RULE.sentences);
    return cardOf(ss, glosses, name, lang, nExtras, profile?.name);
  }, [editing, drafts, extras, saved, frames, name, lang, profile?.name]);

  if (game.chapter.n < 8) return null;

  const finish = () => {
    if (!tally.complete) return;
    dispatch({ t: 'letter_saved', sentences: letterSentences(drafts, extras) });
    setEditing(false);
    setToast(t('letter.done'));
  };
  const hanako = characterById('hanako');
  const readBack = () => {
    const voice = hanako ? { rate: hanako.speaking.rate, pitch: hanako.speaking.pitch, voice: hanako.speaking.voice } : {};
    tts.cancel();
    void tts
      .speak(readBackText(card), voice)
      .then(() => tts.speak(bareJa(LETTER_HANAKO.ja), voice))
      .catch(() => undefined);
  };
  const saveImage = async () => {
    const ok = await saveCardImage(card, { lang, romaji: useStore.getState().settings.romaji, title: t('letter.cardTitle') });
    if (ok) setToast(t('letter.imageSaved'));
  };

  return (
    <div className="panel ltr" dir={dir} data-screen="letter" data-editing={editing ? 1 : 0}>
      <header className="panel-head">
        <button className="icon-btn ghost" onClick={() => go('world')} aria-label={t('common.back')}>
          <Icon name={dir === 'rtl' ? 'chevR' : 'chevL'} size={22} />
        </button>
        <h1>{t('letter.title')}</h1>
        <span />
      </header>

      <div className="panel-body ltr-body">
        {editing ? (
          <>
            <p className={`pill ltr-count${tally.own >= tally.need ? ' ok' : ''}`} data-own={tally.own} role="status">
              <Ltr text={t('letter.own', { n: tally.own, need: tally.need })} />
            </p>
            <p className="ltr-intro" dir="auto">
              {t('letter.intro')}
            </p>
            <p className="ltr-noaudio muted small" dir="auto" data-no-audio="1">
              <Icon name="mic" size={14} /> {t('letter.noAudio')}
            </p>
            {frames.map((f, i) => (
              <FrameCard
                key={f.id}
                n={i + 1}
                frame={f}
                draft={drafts[i] ?? null}
                onDraft={(d) => setDrafts((all) => all.map((x, k) => (k === i ? d : x)))}
              />
            ))}
            {diary.length > 0 && (
              <section className="card ltr-diary" data-diary-list="1">
                <h2 className="h2">{t('letter.diary')}</h2>
                <ul>
                  {diary.map((d, k) => {
                    const on = extras.some((e) => e.chapter === d.chapter && e.ja === d.ja);
                    return (
                      <li key={`${d.chapter}:${k}`}>
                        <span lang="ja" dir="ltr">
                          {d.ja}
                        </span>
                        <button
                          type="button"
                          className={`btn sm ${on ? 'primary' : 'soft'}`}
                          data-diary-add={k}
                          aria-pressed={on}
                          onClick={() => setExtras((xs) => (on ? xs.filter((e) => !(e.chapter === d.chapter && e.ja === d.ja)) : [...xs, d].slice(0, 7)))}
                        >
                          {on ? t('letter.diaryAdded') : t('letter.diaryAdd')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            {!tally.complete && (
              <p className="muted small center" dir="auto" data-need="1">
                <Ltr text={t('letter.needMore', { need: LETTER_RULE.minOwn })} />
              </p>
            )}
          </>
        ) : (
          <>
            {toast && (
              <p className="ltr-toast" role="status" dir="auto">
                <Icon name="check" size={16} /> {toast}
              </p>
            )}
            <LetterCard card={card} />
          </>
        )}
      </div>

      <footer className="panel-foot ltr-foot">
        {editing ? (
          <button type="button" className="btn primary wide" data-finish="1" disabled={!tally.complete} onClick={finish}>
            {t('letter.finish')}
          </button>
        ) : (
          <>
            <button type="button" className="btn primary" data-read="1" onClick={readBack}>
              <Icon name="volume" size={18} /> {t('letter.readBack')}
            </button>
            <button type="button" className="btn soft" data-save-image="1" onClick={() => void saveImage()}>
              {t('letter.saveImage')}
            </button>
            <button type="button" className="btn soft" data-edit="1" onClick={() => (setToast(null), setEditing(true))}>
              {t('letter.edit')}
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

/**
 * One sentence of the Letter. Open: the field holds the frame's pre-filled start; the learner completes it (typed, romaji is read as kana) or
 * says it (recognition only), or asks for three ideas or a translation (assisted). Written: the sentence with its tag and Change.
 */
function FrameCard({ n, frame, draft, onDraft }: { n: number; frame: FrameView; draft: LetterDraft | null; onDraft: (d: LetterDraft | null) => void }) {
  const { t, lang } = useT();
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const starter = bareJa(frame.starter.ja);
  const [value, setValue] = useState(draft?.ja ?? starter);
  const [spoken, setSpoken] = useState<string | null>(null);
  const [ideas, setIdeas] = useState(false);
  const [tr, setTr] = useState<string | null>(null);
  const [msg, setMsg] = useState<StringKey | null>(null);
  const [listening, setListening] = useState(false);
  const shown = useRef<string[]>([starter]);
  const ideaTokens = useMemo(() => frame.suggestions.map((s) => resolveLine(s, LEXICON)), [frame]);

  const commit = (ja: string, how: LetterDraft['how'], gloss?: Gloss) => {
    onDraft({ frameId: frame.id, ja, how, shown: [...shown.current], ...(gloss ? { gloss } : {}) });
    setIdeas(false);
    setTr(null);
    setMsg(null);
  };
  const use = () => {
    const ja = typedJapanese(value);
    if (!ja) return setMsg('letter.needJa');
    commit(ja, spoken !== null && spoken === value ? 'spoken' : 'typed');
  };
  const say = () => {
    if (listening) return;
    setMsg(null);
    setListening(true);
    // recognition only: the recogniser hands back text, nothing is recorded or kept
    stt
      .listen('ja-JP')
      .result.then((r) => {
        const text = r.text.trim();
        if (!text) return;
        setValue(text);
        setSpoken(text);
      })
      .catch((e: unknown) => {
        const id = explainSttError(e);
        if (id !== 'cancelled') setMsg(`audio.mic.err.${id}` as StringKey);
      })
      .finally(() => setListening(false));
  };
  const translate = () => {
    const text = (tr ?? '').trim();
    if (!text) return;
    const hit = translatePhrase(text, lang);
    if (!hit) return setMsg('letter.translateNone');
    const ja = resolveLine({ ja: hit.ja, en: '', ar: '' }, LEXICON, hit.vars).written;
    if (!ja) return setMsg('letter.translateNone');
    commit(ja, 'translated', { en: lang === 'en' ? text : '', ar: lang === 'ar' ? text : '' });
  };

  const sentence = draft ? sentenceOf(draft) : null;
  return (
    <section className={`card ltr-frame${draft ? ' done' : ''}`} data-frame={frame.id} data-n={n} data-assisted={sentence ? (sentence.assisted ? 1 : 0) : undefined}>
      <header className="ltr-frame-head">
        <small className="label">
          <Ltr text={t('letter.frameN', { n, total: LETTER_RULE.sentences })} />
        </small>
        {sentence && <span className={`pill ltr-tag${sentence.assisted ? ' help' : ''}`}>{t(sentence.assisted ? 'letter.assistedTag' : 'letter.ownTag')}</span>}
      </header>
      <strong className="ltr-prompt" dir="auto">
        {frame.prompt[lang]}
      </strong>
      {draft ? (
        <>
          <JaText tokens={freeTokens(draft.ja)} furigana={furigana} romaji={romaji} size="md" />
          <span className="ltr-row">
            <button type="button" className="btn soft sm" data-change="1" onClick={() => (setValue(draft.ja), setSpoken(null), onDraft(null))}>
              {t('letter.change')}
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="ltr-field">
            <input
              className="field"
              lang="ja"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={120}
              value={value}
              placeholder={t('letter.typePh')}
              aria-label={t('letter.typePh')}
              data-type="1"
              onChange={(e) => {
                setValue(e.target.value);
                setMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') use();
              }}
            />
            {stt.available() && (
              <button type="button" className={`icon-btn soft ltr-mic${listening ? ' rec' : ''}`} data-speak="1" aria-label={t('letter.speak')} onClick={say}>
                <Icon name="mic" size={20} />
              </button>
            )}
          </span>
          <button type="button" className="btn primary" data-use="1" onClick={use} disabled={!value.trim()}>
            {t('letter.use')}
          </button>
          <span className="ltr-row">
            <button
              type="button"
              className="btn soft sm"
              data-ideas="1"
              aria-expanded={ideas}
              onClick={() => {
                // the ideas are on screen now: typing one of them out is a copy, not the learner's own (§3.2)
                shown.current = [...new Set([...shown.current, ...ideaTokens.map((x) => x.written)])];
                setIdeas(!ideas);
              }}
            >
              {t('letter.suggest')}
            </button>
            <button type="button" className="btn soft sm" data-translate="1" aria-expanded={tr !== null} onClick={() => setTr(tr === null ? '' : null)}>
              {t('letter.translate')}
            </button>
          </span>
          {ideas && (
            <ul className="ltr-ideas" data-ideas-list="1">
              {frame.suggestions.map((s: Line, k) => (
                <li key={k}>
                  <button type="button" className="ltr-idea" data-idea={k} onClick={() => commit(ideaTokens[k]!.written, 'picked', { en: s.en, ar: s.ar })}>
                    <JaText tokens={ideaTokens[k]!.tokens} furigana={furigana} romaji={false} size="sm" />
                    <small dir="auto">{s[lang]}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {tr !== null && (
            <span className="ltr-field" data-translate-box="1">
              <input
                className="field"
                dir="auto"
                maxLength={120}
                value={tr}
                placeholder={t(lang === 'ar' ? 'letter.translatePhAr' : 'letter.translatePh')}
                aria-label={t(lang === 'ar' ? 'letter.translatePhAr' : 'letter.translatePh')}
                onChange={(e) => setTr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') translate();
                }}
              />
              <button type="button" className="btn soft sm" data-translate-go="1" onClick={translate} disabled={!tr.trim()}>
                {t('letter.translateGo')}
              </button>
            </span>
          )}
        </>
      )}
      {msg && (
        <small className="muted" role="status" dir="auto">
          {t(msg)}
        </small>
      )}
    </section>
  );
}
