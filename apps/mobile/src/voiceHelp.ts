// Voice guidance (Goen stage 1, small): an app opened from a link inside Instagram, Facebook, WhatsApp, Line, TikTok or the Gmail / Google app
// runs in that app's web view, where the microphone, speech recognition and the device's Japanese voices are often missing. The Audio check and
// the first conversation then say so in one line ("Open this page in Safari / Chrome to use your voice") with a copy-link button; an iPhone that
// refuses recognition (`service-not-allowed`) is told to turn on Siri & Dictation; a device with no Japanese voice gets the per-OS steps.
// Pure functions over the user agent and the audio report, so they are testable without a browser; VoiceHint.tsx shows them.
import type { AudioReport, SttErrorId } from '@lw/engine';
import type { StringKey } from './i18n';

/** The in-app browsers we can tell apart; `webview` is a generic Android WebView (`; wv)`) or an iOS WKWebView that is not Safari. */
export type InAppId = 'instagram' | 'facebook' | 'whatsapp' | 'line' | 'tiktok' | 'gmail' | 'google' | 'webview';

const IOS = /iPhone|iPad|iPod/i;

/** Whether the user agent is an iPhone / iPad (an iPad that asks for the desktop site says Macintosh and has touch: `touch` covers it). */
export const isIosUa = (ua: string, touch = false): boolean => IOS.test(ua) || (touch && /Macintosh/i.test(ua));

/** The in-app browser this page runs in, from the user agent, or null for a real browser (Safari, Chrome, Firefox, Edge, Samsung...). */
export function inAppBrowser(ua: string): InAppId | null {
  if (!ua) return null;
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A|FBSV|\bMessenger/i.test(ua)) return 'facebook';
  if (/WhatsApp/i.test(ua)) return 'whatsapp';
  if (/\bLine\/\d/i.test(ua)) return 'line';
  if (/musical_ly|TikTok|BytedanceWebview|\btrill_/i.test(ua)) return 'tiktok';
  if (/\bGmail\b/i.test(ua)) return 'gmail';
  // the Google app: GSA on iOS; on Android it shows as a WebView (wv) with GSA in the UA
  if (/\bGSA\//.test(ua)) return 'google';
  if (/Android/i.test(ua) && /;\s*wv\)/.test(ua)) return 'webview';
  // iOS: every real browser (Safari, Chrome CriOS, Firefox FxiOS, Edge EdgiOS) still says Safari/ at the end; a bare WKWebView does not
  if (IOS.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return 'webview';
  return null;
}

/** What the voice needs that this device does not give it, from the audio report (null report: not checked yet). */
export function voiceMissing(report: Pick<AudioReport, 'tts' | 'stt' | 'mic' | 'issues'> | null, sttError?: SttErrorId | null): boolean {
  if (sttError && ['unsupported', 'denied', 'blocked', 'no-mic'].includes(sttError)) return true;
  if (!report) return false;
  if (!report.stt.available || !report.tts.available || report.tts.jaVoices.length === 0) return true;
  return report.mic.permission === 'denied' || report.issues.some((i) => i.id === 'no-mic' || i.id === 'mic-denied');
}

/** One line of guidance: its string key and, for the no-voice steps, the per-OS line under it. `copy` = show the copy-link button. */
export interface VoiceLine {
  id: 'in-app' | 'siri' | 'no-ja';
  key: StringKey;
  extra?: StringKey;
  copy?: boolean;
}

export type OsId = 'android' | 'ios' | 'windows' | 'mac' | 'other';

export function osOfUa(ua: string, ios: boolean): OsId {
  if (ios || IOS.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os/i.test(ua)) return 'mac';
  return 'other';
}

/**
 * The one line to show (or none): an in-app browser where the mic or the voices are missing comes first (opening the page in Safari / Chrome fixes
 * everything at once); else an iPhone whose recognition was refused (`service-not-allowed`, the engine's `blocked`) needs Siri & Dictation; else a
 * device with no Japanese voice gets the steps for its OS.
 */
export function voiceLine(ua: string, report: Pick<AudioReport, 'tts' | 'stt' | 'mic' | 'issues' | 'ios'> | null, sttError?: SttErrorId | null): VoiceLine | null {
  const inApp = inAppBrowser(ua);
  if (inApp && voiceMissing(report, sttError)) return { id: 'in-app', key: 'audio.inApp', copy: true };
  const ios = !!report?.ios || isIosUa(ua);
  if (ios && sttError === 'blocked') return { id: 'siri', key: 'audio.mic.err.siri' };
  if (report && report.tts.available && report.tts.jaVoices.length === 0) {
    const os = osOfUa(ua, !!report.ios);
    return { id: 'no-ja', key: 'audio.fix.noJa', extra: `audio.fix.noJa.${os}` as StringKey };
  }
  return null;
}

/** The message for a recognition error: the generic one, except an in-app browser (open in Safari / Chrome) and an iPhone's refusal (Siri & Dictation). */
export function sttErrorKey(id: SttErrorId, ua: string, touch = false): StringKey {
  if (inAppBrowser(ua) && ['unsupported', 'denied', 'blocked', 'no-mic'].includes(id)) return 'audio.inApp';
  if (id === 'blocked' && isIosUa(ua, touch)) return 'audio.mic.err.siri';
  return `audio.mic.err.${id}` as StringKey;
}

/** The browser's user agent ('' outside a browser). */
export const currentUa = (): string => (typeof navigator === 'undefined' ? '' : navigator.userAgent ?? '');
/** Whether this is a touch device (an iPad asking for the desktop site says Macintosh). */
export const touchDevice = (): boolean => typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 1;

/** Copies the page's address so it can be pasted into Safari / Chrome; false when the clipboard is not reachable (the caller then shows the link). */
export async function copyPageLink(href: string = typeof location === 'undefined' ? '' : location.href): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(href);
      return true;
    }
  } catch {
    /* fall through to the old way */
  }
  try {
    const box = document.createElement('textarea');
    box.value = href;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}
