import { useEffect, useMemo, useRef, useState } from 'react';
import { hasArabic, hasJapanese, hasKanji, hasLatin, romajiToHiragana, toKatakana } from '@lw/core';
import { LEXICON, fillGloss, speakableText, tokenize, type Vars } from '@lw/content';
import { JaText } from '../components/JaText';
import { Icon } from '../components/Icon';
import { Portrait } from '../components/Portrait';
import { DreamPicker } from '../components/game/DreamPicker';
import { characterById, displayName } from '../content';
import { completeBeat, dispatch } from '../game/bridge';
import { useGameState } from '../game/hooks';
import { beatById } from '../game/pack';
import { useT } from '../hooks';
import { tts } from '../services';
import { useStore } from '../store';
import { useUi } from '../ui';

/** Wraps a player-supplied name so a Latin name inside Arabic text keeps its place (Unicode first-strong isolate ... pop). */
const isolate = (s: string) => `⁨${s}⁩`;

/**
 * The katakana field's first value, from the name the player gave at onboarding (§2.1): a Latin name is converted by sound
 * ("Mio" -> ミオ), kana stays kana, anything else (Arabic script, kanji) is kept as typed. The player edits it; any script is accepted.
 */
export function prefillKana(name: string): string {
  const n = name.trim();
  if (!n) return '';
  if (hasJapanese(n)) return hasKanji(n) ? n : toKatakana(n);
  if (hasLatin(n) && !hasArabic(n)) {
    for (const spelling of [n, withFinalVowel(n)]) {
      const r = romajiToHiragana(spelling);
      if (r.ok && r.kana) return toKatakana(r.kana);
    }
  }
  return n;
}

/** Japanese has no final consonant but n: "Sam" is サム (sa-mu), "Matt" マット; the usual loan-word vowels. */
function withFinalVowel(n: string): string {
  const last = n.slice(-1).toLowerCase();
  if (!/[a-z]/.test(last) || /[aeiouyn]/.test(last)) return n;
  if (/(ch|sh|j)$/i.test(n)) return `${n}i`;
  return `${n}${/[td]/.test(last) ? 'o' : 'u'}`;
}

/**
 * The story beat screen (§7.2): Hanako-sensei (or whoever speaks) with their portrait, name and one line at a time over the world; a tap
 * goes on. A beat that `ask`s something ends with it: the katakana name (`me.nameKana`), the Dream picker, or a one-line diary entry.
 * The queue (`useUi.beats`) and `completeBeat(id)` are the shell's (2A); a beat the pack does not define is filed and dropped, never a dead end.
 */
export function StoryBeat() {
  const { t, lang, dir } = useT();
  const go = useStore((s) => s.go);
  const profile = useStore((s) => s.profile);
  const furigana = useStore((s) => s.settings.furigana);
  const romaji = useStore((s) => s.settings.romaji);
  const autoSpeak = useStore((s) => s.settings.autoSpeak);
  const game = useGameState();
  const id = useUi((s) => s.beats[0]);
  const beat = id ? beatById(id) : undefined;
  const [i, setI] = useState(0);
  const [asking, setAsking] = useState(false);
  const filed = useRef<string | null>(null);

  // a new beat starts from its first line
  useEffect(() => {
    setI(0);
    setAsking(false);
    filed.current = null;
  }, [id]);

  // nothing (left) to show: back to the world; a beat the pack does not know is filed so it cannot loop
  useEffect(() => {
    if (!id) go('world');
    else if (!beat && filed.current !== id) {
      filed.current = id;
      completeBeat(id);
    }
  }, [id, beat, go]);

  const name = game.me.nameKana || profile?.name || '';
  const line = beat?.lines[Math.min(i, (beat?.lines.length ?? 1) - 1)];
  const who = line ? characterById(line.who) : undefined;
  const view = useMemo(() => {
    if (!line) return null;
    const jaVars: Vars = { name: { ja: name, raw: true } };
    const glossVars: Vars = { name: { ja: isolate(profile?.name || name), raw: true } };
    const tokens = tokenize(line.line.ja, LEXICON, jaVars).tokens;
    return { tokens, spoken: line.line.tts ?? speakableText(tokens), en: fillGloss(line.line.en, glossVars, 'en'), ar: fillGloss(line.line.ar, glossVars, 'ar') };
  }, [line, name, profile?.name]);

  // the line is read aloud (a Japanese voice is optional: the text and the glosses carry everything)
  const say = (text: string) => {
    if (!who) return;
    void tts.speak(text, { rate: who.speaking.rate, pitch: who.speaking.pitch, voice: who.speaking.voice });
  };
  const spoken = view?.spoken;
  useEffect(() => {
    if (!asking && autoSpeak && spoken) say(spoken);
    return () => tts.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, i, asking, spoken, autoSpeak]);

  if (!id || !beat || !line || !view) return null;

  const finish = () => {
    if (filed.current === id) return;
    filed.current = id;
    completeBeat(id);
  };
  const advance = () => {
    if (i < beat.lines.length - 1) setI(i + 1);
    else if (beat.ask) setAsking(true);
    else finish();
  };

  if (asking && beat.ask === 'dream') {
    return (
      <div className="panel qst-beat-dream" dir={dir} data-beat={id} data-ask="dream">
        <DreamPicker
          onChoose={(dream) => {
            dispatch({ t: 'dream_chosen', id: dream });
            finish();
          }}
          onLater={finish}
        />
      </div>
    );
  }

  const speaker = who ? displayName(who, lang) : '';
  // `panel` keeps the shell's e2e helper (`skipBeats` presses the last primary button of a `.panel`) working; the look is `.qst-beat`
  return (
    <div className="panel qst-beat" dir={dir} data-beat={id} data-line={i} data-ask={asking ? beat.ask : undefined}>
      <div className="qst-beat-stage" aria-hidden="true">
        {who && <Portrait spec={who.avatar} size={170} talking={!asking} className="qst-beat-portrait" />}
      </div>
      {asking && beat.ask === 'nameKana' && <NameStep initial={prefillKana(profile?.name ?? '')} onDone={(kana) => (kana ? (dispatch({ t: 'profile_set', nameKana: kana }), finish()) : finish())} />}
      {asking && beat.ask === 'diary' && (
        <DiaryStep onDone={(ja) => (ja ? (dispatch({ t: 'diary_added', entry: { chapter: game.chapter.n, ja, assisted: false } }), finish()) : finish())} />
      )}
      {!asking && (
        // a tap anywhere on the card goes on; the Continue button is the same thing for a keyboard or a screen reader
        <div className="qst-beat-card" data-next="1" onClick={advance}>
          <span className="qst-beat-name">
            {who && <span lang="ja">{who.name.ja}</span>}
            <small dir="auto">{speaker}</small>
            <button
              type="button"
              className="icon-btn ghost qst-listen"
              aria-label={t('common.listen')}
              onClick={(e) => {
                e.stopPropagation();
                say(view.spoken);
              }}
            >
              <Icon name="volume" size={20} />
            </button>
          </span>
          <span className="qst-beat-ja">
            <JaText tokens={view.tokens} furigana={furigana} romaji={romaji} size="lg" />
          </span>
          <p className="qst-beat-gloss" dir="auto">
            {lang === 'ar' ? view.ar : view.en}
          </p>
          <span className="qst-beat-foot">
            <span className="qst-dots" aria-hidden="true">
              {beat.lines.map((_, n) => (
                <i key={n} className={n <= i ? 'on' : ''} />
              ))}
            </span>
            <button type="button" className="btn primary" data-continue="1">
              {t('common.continue')}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/** The katakana step of the opening beat: pre-filled, editable, any script accepted, skippable. */
function NameStep({ initial, onDone }: { initial: string; onDone: (kana: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState(initial);
  return (
    <form
      className="qst-beat-card ask"
      data-step="nameKana"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(value.trim());
      }}
    >
      <span className="qst-ask">
        <label className="label" htmlFor="qst-kana">
          {t('story.nameKana')}
        </label>
        <span className="qst-ask-row">
          <input
            id="qst-kana"
            className="field"
            lang="ja"
            dir="auto"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={24}
            value={value}
            placeholder={t('quests.nameKanaPlaceholder')}
            onChange={(e) => setValue(e.target.value)}
          />
        </span>
        <small className="muted">{t('quests.nameKanaHint')}</small>
        <span className="qst-ask-actions">
          <button type="submit" className="btn primary" data-save="1" disabled={!value.trim()}>
            {t('quests.nameKanaUse')}
          </button>
          <button type="button" className="btn soft" data-skip="1" onClick={() => onDone('')}>
            {t('quests.skip')}
          </button>
        </span>
      </span>
    </form>
  );
}

/** A closing beat's one-line diary entry (§7.2): typed in any language, or skipped. */
function DiaryStep({ onDone }: { onDone: (ja: string) => void }) {
  const { t } = useT();
  const [value, setValue] = useState('');
  return (
    <form
      className="qst-beat-card ask"
      data-step="diary"
      onSubmit={(e) => {
        e.preventDefault();
        onDone(value.trim());
      }}
    >
      <span className="qst-ask">
        <label className="label" htmlFor="qst-diary">
          {t('quests.diaryHint')}
        </label>
        <input id="qst-diary" className="field" dir="auto" maxLength={120} value={value} onChange={(e) => setValue(e.target.value)} />
        <span className="qst-ask-actions">
          <button type="submit" className="btn primary" disabled={!value.trim()}>
            {t('common.save')}
          </button>
          <button type="button" className="btn soft" onClick={() => onDone('')}>
            {t('quests.skip')}
          </button>
        </span>
      </span>
    </form>
  );
}
