// The widgets of the Shift screen (agent 4D, docs/GAME_DESIGN.md §9.4): the customer's line with its assists, the item grid, the answer box
// (type / tiles / pick) and the verdict strip. State lives in `screens/Shift.tsx`; the rules in `shiftLogic.ts`.
import { useMemo, useRef, useState } from 'react';
import { LEXICON, speakableText, tokenize, type Token } from '@lw/content';
import type { MenuItem, ShiftCustomer, ShiftInput } from '@lw/game';
import { Icon } from '../../Icon';
import { JaText } from '../../JaText';
import { JaLabel } from '../PanelParts';
import { yen } from '../panelLogic';
import { useT } from '../../../hooks';
import { speakJa, stt } from '../../../services';
import { useStore } from '../../../store';
import { useUi } from '../../../ui';
import {
  HELP_CAP,
  MAX_QTY,
  inputFor,
  piecesOf,
  seeded,
  shuffled,
  tilePool,
  tilesCorrect,
  type AnswerMode,
  type Cart,
  type Flags,
  type Track,
} from './shiftLogic';

const tokensOf = (markup: string): Token[] => tokenize(markup, LEXICON).tokens;

/** Japanese markup as words with the player's furigana and romaji settings. */
export function Ja({ markup, size = 'md' }: { markup: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const tokens = useMemo(() => tokensOf(markup), [markup]);
  return <JaLabel tokens={tokens} size={size} />;
}

/** Japanese markup whose words open the word sheet when tapped (the customer's line and the corrections). */
export function JaTappable({ markup, size = 'md' }: { markup: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const settings = useStore((s) => s.settings);
  const tokens = useMemo(() => tokensOf(markup), [markup]);
  return (
    <JaText
      tokens={tokens}
      furigana={settings.furigana}
      romaji={settings.romaji}
      size={size}
      onTap={(token) => useUi.getState().openWord({ token, source: 'conversation' })}
    />
  );
}

/** Reads a markup sentence aloud, slowly or at the normal pace. */
export function sayMarkup(markup: string, slow = false): void {
  void speakJa(speakableText(tokensOf(markup)), { rate: slow ? 0.55 : 0.9 });
}

// ---------------------------------------------------------------------------------------------------------------
// The step strip and the customer
// ---------------------------------------------------------------------------------------------------------------

export type StepState = 'todo' | 'now' | 'ok' | 'bad';

export function Steps({ states }: { states: Array<{ id: string; label: string; state: StepState }> }) {
  return (
    <ol className="sh-steps" aria-label="steps">
      {states.map((s) => (
        <li
          key={s.id}
          className={`sh-step ${s.state}`}
          data-step={s.id}
          data-state={s.state}
          aria-current={s.state === 'now' ? 'step' : undefined}
        >
          <span className="sh-step-dot" aria-hidden="true">
            {s.state === 'ok' ? (
              <Icon name="check" size={14} stroke={3} />
            ) : s.state === 'bad' ? (
              <Icon name="x" size={14} stroke={3} />
            ) : null}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export interface BubbleProps {
  customer: ShiftCustomer;
  n: number;
  total: number;
  track: Track;
  /** assist factors do not apply: the buttons carry no penalty */
  waived: boolean;
  /** there is no Japanese voice (or the player said so): the text is shown from the start */
  textByDefault: boolean;
  cant: boolean;
  onListen(slow: boolean): void;
  onAssist(kind: 'text' | 'translation'): void;
  onCant(): void;
  onGreet(): void;
  /** the order is being taken: the greeting and the assists matter only now (they touch the order credit) */
  ordering: boolean;
}

/** The customer: the line is heard (text hidden by default), with replays, the two assists and the one-tap "can't listen right now". */
export function CustomerBubble({
  customer,
  n,
  total,
  track,
  waived,
  textByDefault,
  cant,
  onListen,
  onAssist,
  onCant,
  onGreet,
  ordering,
}: BubbleProps) {
  const { t, lang } = useT();
  const showJa = textByDefault || cant || track.assistText;
  const showTrans = track.assistTrans;
  return (
    <section className="sh-customer" data-customer={customer.templateId} aria-label={t('jobs.customerN', { n, total })}>
      <header className="sh-customer-head">
        <span className="sh-badge">
          <Icon name="bag" size={16} /> {t('jobs.customerN', { n: String(n), total: String(total) })}
        </span>
        <span className="sh-dots" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i < n - 1 ? 'done' : i === n - 1 ? 'now' : ''} />
          ))}
        </span>
      </header>
      <div className="sh-bubble" data-shown={showJa ? 'ja' : 'hidden'}>
        {showJa ? (
          <div className="sh-line" data-line>
            <JaTappable markup={customer.line.ja} size="lg" />
          </div>
        ) : (
          <p className="sh-hidden" data-hidden>
            <Icon name="volume" size={22} /> {t('jobs.hiddenLine')}
          </p>
        )}
        {showTrans && (
          <p className="sh-trans" dir={lang === 'ar' ? 'rtl' : 'ltr'} data-trans>
            {customer.line[lang]}
          </p>
        )}
      </div>
      <div className="sh-row">
        <button type="button" className="btn soft sm" data-act="listen" onClick={() => onListen(false)}>
          <Icon name="volume" size={18} /> {t('jobs.listen')}
        </button>
        <button type="button" className="btn soft sm" data-act="slow" onClick={() => onListen(true)}>
          <Icon name="replay" size={18} /> {t('jobs.slow')}
        </button>
        {ordering && (
          <button
            type="button"
            className={`btn soft sm${track.greeted ? ' sh-on' : ''}`}
            data-act="greet"
            aria-pressed={track.greeted}
            disabled={track.greeted}
            onClick={onGreet}
          >
            <Icon name={track.greeted ? 'check' : 'message'} size={18} /> {track.greeted ? t('jobs.greeted') : t('jobs.greet')}
          </button>
        )}
      </div>
      {ordering && (
        <div className="sh-assist">
          <button type="button" className="btn soft sm" data-act="show-text" disabled={showJa} onClick={() => onAssist('text')}>
            <Icon name="eye" size={18} /> {waived ? t('jobs.showTextFree') : t('jobs.showText')}
          </button>
          <button type="button" className="btn soft sm" data-act="show-trans" disabled={showTrans} onClick={() => onAssist('translation')}>
            <Icon name="language" size={18} /> {waived ? t('jobs.showTransFree') : t('jobs.showTrans')}
          </button>
          {!textByDefault &&
            (cant ? (
              <small className="sh-note" role="status">
                {t('jobs.cantListenOn')}
              </small>
            ) : (
              <button type="button" className="btn soft sm" data-act="cant-listen" onClick={onCant}>
                {t('jobs.cantListen')}
              </button>
            ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The order: the item grid
// ---------------------------------------------------------------------------------------------------------------

export interface OrderPadProps {
  menu: MenuItem[];
  cart: Cart;
  flags: Flags;
  onAdd(id: string): void;
  onRemove(id: string): void;
  onFlag(f: keyof Flags): void;
  onConfirm(): void;
}

/** Every good of the shop with its Japanese name and price: tap to add one, the minus takes one back; two flags (heat, no bag). */
export function OrderPad({ menu, cart, flags, onAdd, onRemove, onFlag, onConfirm }: OrderPadProps) {
  const { t, lang } = useT();
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  return (
    <section className="sh-order" aria-label={t('jobs.stepOrder')} data-order>
      <p className="sh-prompt">{t('jobs.orderPrompt')}</p>
      <ul className="sh-grid">
        {menu.map((m) => {
          const qty = cart[m.id] ?? 0;
          const name = m.name[lang === 'ar' ? 'ar' : 'en'];
          return (
            <li key={m.id} className={`sh-item${qty > 0 ? ' on' : ''}`} data-item={m.option}>
              <button
                type="button"
                className="sh-item-main"
                aria-label={t('jobs.add', { name })}
                onClick={() => onAdd(m.id)}
                disabled={qty >= MAX_QTY}
              >
                <Ja markup={m.name.ja} size="sm" />
                <span className="sh-gloss">{name}</span>
                <strong className="sh-price" dir="ltr">
                  {yen(m.price)}
                </strong>
              </button>
              {qty > 0 && (
                <>
                  <span className="sh-qty" dir="ltr" data-qty={qty}>
                    ×{qty}
                  </span>
                  <button
                    type="button"
                    className="sh-minus"
                    aria-label={t('jobs.remove', { name })}
                    data-remove={m.option}
                    onClick={() => onRemove(m.id)}
                  >
                    <Icon name="x" size={14} stroke={3} />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <div className="sh-flags">
        <button
          type="button"
          className={`sh-flag${flags.heat ? ' on' : ''}`}
          aria-pressed={flags.heat}
          data-flag="heat"
          onClick={() => onFlag('heat')}
        >
          <Ja markup="温めて" size="sm" /> <span>{t('jobs.heat')}</span>
        </button>
        <button
          type="button"
          className={`sh-flag${flags.nobag ? ' on' : ''}`}
          aria-pressed={flags.nobag}
          data-flag="nobag"
          onClick={() => onFlag('nobag')}
        >
          <Ja markup="袋" size="sm" /> <span>{t('jobs.noBag')}</span>
        </button>
      </div>
      <button type="button" className="btn primary wide sh-confirm" data-act="confirm-order" disabled={count === 0} onClick={onConfirm}>
        {count === 0 ? t('jobs.cartEmpty') : t('jobs.confirmOrder')}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The answer box: type or speak, tiles, pick from three
// ---------------------------------------------------------------------------------------------------------------

export interface AnswerSpec {
  /** resets the box when it changes (customer + stage) */
  id: string;
  /** the right sentence (markup): what the tiles build and the chips offer */
  right: string;
  /** two wrong sentences (markup) for the chips */
  wrong: string[];
  /** two wrong words for the tile pool */
  distractors: string[];
  /** whether a typed or spoken text is right */
  check(text: string): boolean;
  placeholder: string;
  prompt: string;
  seed: number;
}

export function AnswerBox({ spec, onDone }: { spec: AnswerSpec; onDone(ok: boolean, input: ShiftInput): void }) {
  const { t } = useT();
  const [mode, setMode] = useState<AnswerMode>('type');
  const [cap, setCap] = useState<ShiftInput | null>(null);
  const [text, setText] = useState('');
  const [placed, setPlaced] = useState<number[]>([]);
  const [triesLeft, setTriesLeft] = useState(1);
  const [msg, setMsg] = useState('');
  const [listening, setListening] = useState(false);
  const session = useRef<{ stop(): void; abort(): void } | null>(null);

  const pool = useMemo(() => tilePool(spec.right, spec.distractors, seeded(spec.seed)), [spec.right, spec.distractors, spec.seed]);
  const choices = useMemo(
    () => shuffled([spec.right, ...spec.wrong.slice(0, 2)], seeded(spec.seed + 7)),
    [spec.right, spec.wrong, spec.seed],
  );

  const help = (m: 'tiles' | 'pick') => {
    setMode(m);
    setCap((c) => (c && (c === 'pick' || m === 'tiles') ? c : HELP_CAP[m]));
    setMsg('');
  };
  const submitText = (value: string, spoken: boolean) => {
    const v = value.trim();
    if (!v) return;
    if (spec.check(v)) return onDone(true, inputFor('type', spoken, cap));
    if (triesLeft > 0) {
      setTriesLeft(triesLeft - 1);
      setMsg(t('jobs.retryTyped'));
      return;
    }
    onDone(false, inputFor('type', spoken, cap));
  };
  const listen = () => {
    if (listening) return session.current?.stop();
    if (!stt.available()) return setMsg(t('audio.mic.err.unsupported'));
    const s = stt.listen('ja-JP', (interim) => setText(interim));
    session.current = s;
    setListening(true);
    s.result
      .then((r) => {
        setText(r.text);
        submitText(r.text, true);
      })
      .catch(() => setMsg(''))
      .finally(() => {
        session.current = null;
        setListening(false);
      });
  };

  const done = placed.map((i) => pool[i]!);
  return (
    <section className="sh-answer" data-answer={spec.id} data-mode={mode}>
      <p className="sh-prompt">{spec.prompt}</p>
      {mode === 'type' && (
        <form
          className="sh-type"
          onSubmit={(e) => {
            e.preventDefault();
            submitText(text, false);
          }}
        >
          <input
            id="sh-say"
            className="sh-input"
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setMsg('');
            }}
            placeholder={spec.placeholder}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            dir="ltr"
            lang="ja"
            aria-label={spec.prompt}
          />
          <button
            type="button"
            className="icon-btn ghost sh-mic"
            data-act="mic"
            aria-label={listening ? t('jobs.micListening') : t('jobs.mic')}
            onClick={listen}
          >
            <Icon name="mic" size={22} />
          </button>
          <button type="submit" className="btn primary" data-act="say" disabled={!text.trim()}>
            {t('jobs.say')}
          </button>
        </form>
      )}
      {mode === 'tiles' && (
        <div className="sh-tiles" data-tiles>
          <p className="sh-hint">{t('jobs.tilesHint')}</p>
          <div className="sh-slots" aria-live="polite" data-slots>
            {done.length === 0 && <span className="sh-slot-empty">…</span>}
            {placed.map((i, k) => (
              <button
                key={`${i}-${k}`}
                type="button"
                className="sh-tile placed"
                data-tile={pool[i]}
                onClick={() => setPlaced(placed.filter((_, j) => j !== k))}
              >
                <Ja markup={pool[i]!} size="md" />
              </button>
            ))}
          </div>
          <div className="sh-pool">
            {pool.map((p, i) => (
              <button
                key={i}
                type="button"
                className="sh-tile"
                data-tile={p}
                disabled={placed.includes(i)}
                onClick={() => setPlaced([...placed, i])}
              >
                <Ja markup={p} size="md" />
              </button>
            ))}
          </div>
          <div className="sh-row">
            <button type="button" className="btn soft sm" onClick={() => setPlaced([])} disabled={placed.length === 0}>
              {t('jobs.clear')}
            </button>
            <button
              type="button"
              className="btn primary wide"
              data-act="check"
              disabled={placed.length === 0}
              onClick={() => onDone(tilesCorrect(done, spec.right), inputFor('tiles', false, cap))}
            >
              {t('jobs.check')}
            </button>
          </div>
        </div>
      )}
      {mode === 'pick' && (
        <ul className="sh-choices" data-choices>
          {choices.map((c) => (
            <li key={c}>
              <button
                type="button"
                className="sh-choice"
                data-choice={c === spec.right ? 'right' : 'wrong'}
                onClick={() => onDone(c === spec.right, inputFor('pick', false, cap))}
              >
                <Ja markup={c} size="md" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p className="sh-msg" role="status">
          {msg}
        </p>
      )}
      <div className="sh-help">
        {mode !== 'type' && (
          <button type="button" className="btn soft sm" data-act="help-type" onClick={() => setMode('type')}>
            <Icon name="keyboard" size={18} /> {t('jobs.say')}
          </button>
        )}
        {mode !== 'tiles' && (
          <button type="button" className="btn soft sm" data-act="help-tiles" onClick={() => help('tiles')}>
            {t('jobs.helpTiles')}
          </button>
        )}
        {mode !== 'pick' && (
          <button type="button" className="btn soft sm" data-act="help-pick" onClick={() => help('pick')}>
            {t('jobs.helpPick')}
          </button>
        )}
      </div>
      {cap && <small className="sh-note">{t('jobs.helpNote')}</small>}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The verdict on a wrong answer
// ---------------------------------------------------------------------------------------------------------------

export function Verdict({
  label,
  markup,
  gloss,
  detail,
  onContinue,
  cta,
}: {
  label: string;
  markup?: string;
  gloss?: string;
  detail?: string;
  onContinue(): void;
  cta: string;
}) {
  const { t } = useT();
  return (
    <section className="sh-verdict" role="status" data-verdict="wrong">
      <h3>{label}</h3>
      {(markup || detail) && (
        <div className="sh-correct">
          <span className="sh-correct-label">{t('jobs.answerWas')}</span>
          {markup && (
            <div className="sh-correct-ja">
              <JaTappable markup={markup} size="lg" />
              <button type="button" className="icon-btn ghost" aria-label={t('jobs.listen')} onClick={() => sayMarkup(markup, true)}>
                <Icon name="volume" size={20} />
              </button>
            </div>
          )}
          {gloss && <p className="sh-gloss-line">{gloss}</p>}
          {detail && (
            <p className="sh-detail" dir="ltr">
              {detail}
            </p>
          )}
        </div>
      )}
      <button type="button" className="btn primary wide" data-act="continue" onClick={onContinue}>
        {cta}
      </button>
    </section>
  );
}

export { piecesOf };
