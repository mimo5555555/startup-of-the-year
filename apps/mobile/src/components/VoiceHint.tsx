// The one line of voice guidance (voiceHelp.ts) in the Audio check and the first conversation: "Open this page in Safari / Chrome to use your
// voice" with a copy-link button inside an in-app browser, Siri & Dictation on an iPhone that refuses recognition, or the steps to install a
// Japanese voice. Nothing when the voice works.
import { useEffect, useState } from 'react';
import type { AudioReport, SttErrorId } from '@lw/engine';
import { useT } from '../hooks';
import { audio } from '../services';
import { copyPageLink, currentUa, voiceLine } from '../voiceHelp';
import { Icon } from './Icon';

// one report for the whole session: the first conversation and the Audio check share it (collecting waits for the voices to load)
let shared: Promise<AudioReport | null> | null = null;
const sharedReport = (): Promise<AudioReport | null> => (shared ??= audio.report().catch(() => null));

/** The audio report, collected once (the Audio check passes its own, fresher one). */
export function useSharedReport(given?: AudioReport | null): AudioReport | null {
  const [report, setReport] = useState<AudioReport | null>(given ?? null);
  useEffect(() => {
    if (given !== undefined) {
      setReport(given);
      return;
    }
    let alive = true;
    void sharedReport().then((r) => alive && setReport(r));
    return () => {
      alive = false;
    };
  }, [given]);
  return report;
}

export interface VoiceHintProps {
  /** the Audio check's report; absent = collect it once */
  report?: AudioReport | null;
  /** the last recognition error, if any */
  sttError?: SttErrorId | null;
  /** where it shows (a class for the layout) */
  where: 'check' | 'convo';
  /** tests: the user agent */
  ua?: string;
}

export function VoiceHint({ report, sttError, where, ua }: VoiceHintProps) {
  const { t } = useT();
  const r = useSharedReport(report);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const line = voiceLine(ua ?? currentUa(), r, sttError);
  if (!line) return null;
  return (
    <div className={`voice-hint ${where}`} role="note" data-voice-hint={line.id}>
      <Icon name={line.id === 'no-ja' ? 'volume' : 'mic'} size={18} />
      <p dir="auto">
        <strong>{t(line.key)}</strong>
        {line.extra && <em>{t(line.extra)}</em>}
        {copied === 'fail' && (
          <bdi className="voice-hint-url" dir="ltr">
            {typeof location === 'undefined' ? '' : location.href}
          </bdi>
        )}
      </p>
      {line.copy && (
        <button type="button" className="btn soft voice-hint-copy" data-copy-link onClick={() => void copyPageLink().then((ok) => setCopied(ok ? 'ok' : 'fail'))}>
          <Icon name={copied === 'ok' ? 'check' : 'copy'} size={16} /> {copied === 'ok' ? t('audio.inApp.copied') : t('audio.inApp.copy')}
        </button>
      )}
    </div>
  );
}
