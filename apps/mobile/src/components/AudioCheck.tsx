import { useCallback, useEffect, useRef, useState } from 'react';
import { explainSttError, type AudioIssueId, type AudioReport, type MicFailure, type SttErrorId, type SttSession, type TtsErrorCode } from '@lw/engine';
import { Icon } from './Icon';
import { audio } from '../services';
import { useT } from '../hooks';
import type { StringKey } from '../i18n';

/** Id of the Settings section that holds the check, so other screens can link to it. */
export const AUDIO_CHECK_ID = 'audio-check';

let pendingFocus = false;
/** Call before store.go('settings'): Settings scrolls to the audio check on arrival. */
export const requestAudioCheckFocus = () => {
  pendingFocus = true;
};
export const takeAudioCheckFocus = () => {
  const v = pendingFocus;
  pendingFocus = false;
  return v;
};

type Tone = 'ok' | 'warn' | 'bad';
type Os = 'android' | 'ios' | 'windows' | 'mac' | 'other';

const osOf = (ios: boolean): Os => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (ios) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os/i.test(ua)) return 'mac';
  return 'other';
};

const MIC_FAIL: MicFailure[] = ['denied', 'no-device', 'insecure', 'blocked', 'unknown'];
const SPK_ERR: TtsErrorCode[] = ['unavailable', 'no-voice', 'not-allowed', 'synthesis-failed', 'timeout'];

function Status({ tone }: { tone: Tone }) {
  return (
    <span className={`au-ico ${tone}`} aria-hidden="true">
      {tone === 'ok' ? <Icon name="check" size={16} stroke={3} /> : tone === 'bad' ? <Icon name="x" size={16} stroke={3} /> : <b>!</b>}
    </span>
  );
}

type SpkState = { phase: 'idle' | 'playing' | 'done'; msg?: string; ok?: boolean };
type MicTest = { phase: 'idle' | 'listening' | 'done' | 'error'; interim: string; text: string; confidence: number; err?: SttErrorId };

export function AudioCheck() {
  const { t, dir } = useT();
  const [report, setReport] = useState<AudioReport | null>(null);
  const [checking, setChecking] = useState(true);
  const [spk, setSpk] = useState<SpkState>({ phase: 'idle' });
  const [allow, setAllow] = useState<{ busy: boolean; msg?: string; ok?: boolean }>({ busy: false });
  const [mic, setMic] = useState<MicTest>({ phase: 'idle', interim: '', text: '', confidence: 0 });
  const session = useRef<SttSession | null>(null);
  const alive = useRef(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await audio.report();
      if (alive.current) setReport(r);
    } catch {
      /* keep the previous report */
    } finally {
      if (alive.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void check();
    return () => {
      alive.current = false;
      session.current?.abort();
      audio.tts.cancel();
    };
  }, [check]);

  const testSpeaker = async () => {
    if (spk.phase === 'playing') return;
    setSpk({ phase: 'playing' });
    let r;
    try {
      r = await audio.speakSample();
    } catch {
      r = { audible: false, voice: null, error: { code: 'synthesis-failed' as TtsErrorCode } };
    }
    if (!alive.current) return;
    if (r.error) {
      const code = (SPK_ERR as string[]).includes(r.error.code) ? r.error.code : 'synthesis-failed';
      setSpk({ phase: 'done', ok: false, msg: t(`audio.spk.err.${code}` as StringKey) });
    } else if (!r.audible) {
      setSpk({ phase: 'done', ok: false, msg: t('audio.spk.silent') });
    } else {
      setSpk({ phase: 'done', ok: true, msg: r.voice ? t('audio.spk.ok', { voice: r.voice }) : t('audio.spk.okNoName') });
    }
    void check();
  };

  const allowMic = async () => {
    if (allow.busy) return;
    setAllow({ busy: true });
    const r = await audio.requestMic();
    if (!alive.current) return;
    if (r.ok) setAllow({ busy: false, ok: true, msg: t('audio.mic.allowedOk') });
    else setAllow({ busy: false, ok: false, msg: t(`audio.mic.fail.${(MIC_FAIL as string[]).includes(r.reason) ? r.reason : 'unknown'}` as StringKey) });
    void check();
  };

  const testMic = () => {
    if (mic.phase === 'listening') {
      session.current?.stop();
      return;
    }
    if (!audio.stt.available()) {
      setMic({ phase: 'error', interim: '', text: '', confidence: 0, err: 'unsupported' });
      return;
    }
    audio.tts.cancel();
    setMic({ phase: 'listening', interim: '', text: '', confidence: 0 });
    const s = audio.stt.listen('ja-JP', (interim) => alive.current && setMic((m) => (m.phase === 'listening' ? { ...m, interim } : m)));
    session.current = s;
    s.result
      .then((r) => alive.current && setMic({ phase: 'done', interim: '', text: r.text, confidence: r.confidence }))
      .catch((e: unknown) => {
        if (!alive.current) return;
        setMic({ phase: 'error', interim: '', text: '', confidence: 0, err: explainSttError(e) });
      })
      .finally(() => {
        if (session.current === s) session.current = null;
        void check();
      });
  };

  // ---------- derived view ----------
  const issues = new Set<AudioIssueId>(report?.issues.map((i) => i.id));
  const R = report;
  const ja = R?.tts.jaVoices ?? [];
  const rows: { key: string; label: StringKey; tone: Tone; value: string }[] = [];
  if (R) {
    const spkTone: Tone = !R.tts.available || issues.has('no-ja-voice') ? 'bad' : 'ok';
    rows.push({
      key: 'speaker',
      label: 'audio.row.speaker',
      tone: spkTone,
      value: t(!R.tts.available ? 'audio.speaker.none' : issues.has('no-ja-voice') ? 'audio.speaker.noVoice' : 'audio.speaker.ready'),
    });
    const shown = ja.slice(0, 3).map((v) => `${v.name} (${v.lang})`);
    rows.push({
      key: 'voices',
      label: 'audio.row.voices',
      tone: ja.length ? 'ok' : 'bad',
      value: ja.length ? shown.join(', ') + (ja.length > 3 ? ` ${t('audio.voices.more', { n: ja.length - 3 })}` : '') : t('audio.voices.none'),
    });
    const p = R.mic.permission;
    rows.push({
      key: 'mic',
      label: 'audio.row.mic',
      tone: issues.has('no-mic') ? 'bad' : p === 'granted' ? 'ok' : p === 'denied' ? 'bad' : 'warn',
      value: t(issues.has('no-mic') ? 'audio.mic.none' : p === 'granted' ? 'audio.mic.granted' : p === 'denied' ? 'audio.mic.denied' : p === 'prompt' ? 'audio.mic.prompt' : 'audio.mic.unknown'),
    });
    rows.push({ key: 'stt', label: 'audio.row.stt', tone: R.stt.available ? 'ok' : 'warn', value: t(R.stt.available ? 'audio.stt.yes' : 'audio.stt.no') });
    rows.push({ key: 'secure', label: 'audio.row.secure', tone: R.secureContext ? 'ok' : 'bad', value: t(R.secureContext ? 'audio.secure.yes' : 'audio.secure.no') });
    rows.push({ key: 'embedded', label: 'audio.row.embedded', tone: R.embedded ? 'warn' : 'ok', value: t(R.embedded ? 'audio.embedded.yes' : 'audio.embedded.no') });
  }

  const os = osOf(!!R?.ios);
  const fixes: { id: AudioIssueId; tone: Tone; text: string; extra?: string }[] = (R?.issues ?? []).map((i) => {
    const tone: Tone = i.severity === 'blocker' ? 'bad' : 'warn';
    switch (i.id) {
      case 'insecure':
        return { id: i.id, tone, text: t('audio.fix.insecure') };
      case 'embedded':
        return { id: i.id, tone, text: t('audio.fix.embedded') };
      case 'no-tts':
        return { id: i.id, tone, text: t('audio.fix.noTts') };
      case 'no-ja-voice':
        return { id: i.id, tone, text: t('audio.fix.noJa'), extra: t(`audio.fix.noJa.${os}` as StringKey) };
      case 'no-stt':
        return { id: i.id, tone, text: t(R?.browser === 'firefox' ? 'audio.fix.noStt.firefox' : 'audio.fix.noStt') };
      case 'mic-denied':
        return { id: i.id, tone, text: t('audio.fix.micDenied') };
      case 'mic-prompt':
        return { id: i.id, tone, text: t('audio.fix.micPrompt') };
      case 'no-mic':
        return { id: i.id, tone, text: t('audio.fix.noMic') };
      default:
        return { id: i.id, tone, text: t('audio.fix.iosGesture') };
    }
  });
  const blockers = fixes.filter((f) => f.tone === 'bad');
  const rest = fixes.filter((f) => f.tone !== 'bad');
  const ordered = [...blockers, ...rest];

  const confPct = Math.round(mic.confidence * 100);

  return (
    <div className="card au" dir={dir}>
      <h3 className="au-title">
        <Icon name="mic" size={20} /> {t('audio.title')}
      </h3>
      <p className="muted small au-sub" dir="auto">
        {t('audio.sub')}
      </p>

      <ul className={`au-rows ${checking ? 'busy' : ''}`} aria-busy={checking} aria-label={t('audio.title')}>
        {R
          ? rows.map((r) => (
              <li key={r.key} className="au-row">
                <Status tone={r.tone} />
                <span className="au-text">
                  <small>{t(r.label)}</small>
                  <strong dir="auto">{r.value}</strong>
                </span>
              </li>
            ))
          : Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="au-row skel">
                <span className="au-ico" aria-hidden="true" />
                <span className="au-text">
                  <small>{i === 0 ? t('audio.checking') : ' '}</small>
                  <strong>&nbsp;</strong>
                </span>
              </li>
            ))}
      </ul>

      <div className="au-fix" aria-live="polite">
        {R && (
          <>
            <h4>{t('audio.fix.heading')}</h4>
            {ordered.length === 0 ? (
              <p className="au-ok" dir="auto">
                {t('audio.fix.allGood')}
              </p>
            ) : (
              <ul>
                {ordered.map((f) => (
                  <li key={f.id} className={f.tone}>
                    <Status tone={f.tone} />
                    <span dir="auto">
                      {f.text}
                      {f.extra && <em>{f.extra}</em>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="au-actions">
        <button type="button" className="btn soft" onClick={testSpeaker} disabled={spk.phase === 'playing'}>
          <Icon name="volume" size={18} /> {spk.phase === 'playing' ? t('audio.btn.speaking') : t('audio.btn.testSpeaker')}
        </button>
        <button type="button" className="btn soft" onClick={allowMic} disabled={allow.busy}>
          <Icon name="lock" size={18} /> {allow.busy ? t('audio.btn.working') : t('audio.btn.allowMic')}
        </button>
        <button type="button" className={`btn soft ${mic.phase === 'listening' ? 'rec' : ''}`} onClick={testMic} aria-pressed={mic.phase === 'listening'}>
          <Icon name="mic" size={18} />{' '}
          {mic.phase === 'listening' ? t('audio.btn.stopMic') : mic.phase === 'done' || mic.phase === 'error' ? t('audio.btn.retryMic') : t('audio.btn.testMic')}
        </button>
        <button type="button" className="btn soft" onClick={() => void check()} disabled={checking}>
          <Icon name="replay" size={18} /> {t('audio.recheck')}
        </button>
      </div>

      <div className="au-out" aria-live="polite">
        <p className={`au-line ${spk.phase === 'done' ? (spk.ok ? 'good' : 'bad') : ''}`} dir="auto" data-testid="au-speaker">
          {spk.phase === 'playing' ? t('audio.spk.playing') : spk.msg ?? t('audio.spk.hint')}
        </p>
        <p className={`au-line ${allow.msg ? (allow.ok ? 'good' : 'bad') : 'hide'}`} dir="auto" data-testid="au-allow">
          {allow.msg ?? ' '}
        </p>
        <div className={`au-line au-mictest ${mic.phase === 'error' ? 'bad' : mic.phase === 'done' ? 'good' : ''}`} data-testid="au-mic">
          {mic.phase === 'idle' && <span dir="auto">{t('audio.mic.sayPrompt')}</span>}
          {mic.phase === 'listening' && (
            <>
              <span dir="auto">{t('audio.mic.listening')}</span>
              <q lang="ja" dir="auto" className="au-heard">
                {mic.interim || ' '}
              </q>
            </>
          )}
          {mic.phase === 'done' && (
            <>
              <span>{t('audio.mic.heard')}</span>
              <q lang="ja" dir="auto" className="au-heard">
                {mic.text}
              </q>
              <small>{mic.confidence > 0 ? t('audio.mic.confidence', { n: confPct }) : t('audio.mic.noConfidence')}</small>
            </>
          )}
          {mic.phase === 'error' && <span dir="auto">{t(`audio.mic.err.${mic.err ?? 'unknown'}` as StringKey)}</span>}
        </div>
      </div>
    </div>
  );
}
