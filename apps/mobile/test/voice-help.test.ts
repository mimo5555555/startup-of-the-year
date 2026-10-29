import { describe, expect, it } from 'vitest';
import type { AudioReport } from '@lw/engine';
import { STRINGS } from '../src/i18n';
import { inAppBrowser, sttErrorKey, voiceLine, voiceMissing } from '../src/voiceHelp';

// Voice guidance (Goen stage 1): in-app browsers from their user agents, the one line the Audio check and the first conversation show.
const UA = {
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 326.0.3.30.91 (iPhone14,5; iOS 17_4; en_US; en; scale=3.00; 1170x2532; 584543210)',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.002; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.105 Mobile Safari/537.36 Instagram 321.0.0.39.106 Android',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.38.108;FBBV/564431005;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.3;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/80]',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/121.0.6167.178 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/449.0.0.41.111;]',
  whatsapp: 'Mozilla/5.0 (Linux; Android 12; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.2.76',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.20.0',
  tiktok: 'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 trill_320304 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/32.3.4 ByteLocale/en BytedanceWebview/d8a21c6',
  googleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/309.0.621443655 Mobile/15E148 Safari/604.1',
  gmail: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0 Mobile Safari/537.36 Gmail',
  androidWebView: 'Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36',
  iosWkWebView: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
  firefoxIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/123.0 Mobile/15E148 Safari/605.1.15',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.105 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

type R = Pick<AudioReport, 'tts' | 'stt' | 'mic' | 'issues' | 'ios'>;
const report = (o: { stt?: boolean; ja?: number; tts?: boolean; mic?: AudioReport['mic']['permission']; ios?: boolean } = {}): R => ({
  ios: o.ios ?? false,
  tts: { available: o.tts ?? true, voicesReady: true, totalVoices: 4, jaVoices: Array.from({ length: o.ja ?? 1 }, (_, i) => ({ name: `Kyoko ${i}`, lang: 'ja-JP', local: true })) },
  stt: { available: o.stt ?? true },
  mic: { permission: o.mic ?? 'granted', devices: 1 },
  issues: [],
});

describe('in-app browser detection', () => {
  it('names Instagram, Facebook, WhatsApp, Line, TikTok, the Google app, Gmail and bare web views', () => {
    expect(inAppBrowser(UA.instagramIos)).toBe('instagram');
    expect(inAppBrowser(UA.instagramAndroid)).toBe('instagram');
    expect(inAppBrowser(UA.facebookIos)).toBe('facebook');
    expect(inAppBrowser(UA.facebookAndroid)).toBe('facebook');
    expect(inAppBrowser(UA.whatsapp)).toBe('whatsapp');
    expect(inAppBrowser(UA.line)).toBe('line');
    expect(inAppBrowser(UA.tiktok)).toBe('tiktok');
    expect(inAppBrowser(UA.googleApp)).toBe('google');
    expect(inAppBrowser(UA.gmail)).toBe('gmail');
    expect(inAppBrowser(UA.androidWebView)).toBe('webview');
    expect(inAppBrowser(UA.iosWkWebView)).toBe('webview');
  });

  it('leaves the real browsers alone (Safari, Chrome and Firefox on iOS, Chrome and Samsung on Android, desktop)', () => {
    for (const ua of [UA.safari, UA.chromeIos, UA.firefoxIos, UA.chromeAndroid, UA.samsung, UA.desktopChrome, '']) expect(inAppBrowser(ua), ua).toBeNull();
  });
});

describe('the one line of voice guidance', () => {
  it('an in-app browser without the mic or the voices: open the page in Safari / Chrome, with the copy-link button', () => {
    expect(voiceLine(UA.instagramIos, report({ stt: false }))).toEqual({ id: 'in-app', key: 'audio.inApp', copy: true });
    expect(voiceLine(UA.facebookAndroid, report({ ja: 0 }))?.id).toBe('in-app');
    expect(voiceLine(UA.tiktok, report({ mic: 'denied' }))?.id).toBe('in-app');
    // a recognition error says it too, before the report is in
    expect(voiceLine(UA.line, null, 'blocked')?.id).toBe('in-app');
  });

  it('an in-app browser where everything works shows nothing (no nagging)', () => {
    expect(voiceLine(UA.instagramAndroid, report())).toBeNull();
    expect(voiceMissing(report())).toBe(false);
  });

  it('iPhone Safari refusing recognition (service-not-allowed = blocked): turn on Siri & Dictation', () => {
    expect(voiceLine(UA.safari, report({ ios: true }), 'blocked')).toEqual({ id: 'siri', key: 'audio.mic.err.siri' });
    expect(sttErrorKey('blocked', UA.safari)).toBe('audio.mic.err.siri');
    // Android keeps the generic message; an in-app browser gets the open-in-browser line
    expect(sttErrorKey('blocked', UA.chromeAndroid)).toBe('audio.mic.err.blocked');
    expect(sttErrorKey('blocked', UA.instagramIos)).toBe('audio.inApp');
    expect(sttErrorKey('silent', UA.instagramIos)).toBe('audio.mic.err.silent');
  });

  it('no Japanese voice in a real browser: the steps for the OS', () => {
    expect(voiceLine(UA.safari, report({ ja: 0, ios: true }))).toEqual({ id: 'no-ja', key: 'audio.fix.noJa', extra: 'audio.fix.noJa.ios' });
    expect(voiceLine(UA.chromeAndroid, report({ ja: 0 }))?.extra).toBe('audio.fix.noJa.android');
    expect(voiceLine(UA.desktopChrome, report({ ja: 0 }))?.extra).toBe('audio.fix.noJa.windows');
    expect(voiceLine(UA.chromeAndroid, report())).toBeNull();
  });

  it('every key it names has English and Arabic, and the steps name the right settings', () => {
    for (const k of ['audio.inApp', 'audio.inApp.copy', 'audio.inApp.copied', 'audio.mic.err.siri']) {
      expect((STRINGS.en as Record<string, string>)[k], k).toBeTruthy();
      expect((STRINGS.ar as Record<string, string>)[k], k).toMatch(/[؀-ۿ]/);
    }
    expect(STRINGS.en['audio.inApp' as never]).toContain('Safari / Chrome');
    expect(STRINGS.en['audio.mic.err.siri' as never]).toContain('Siri & Dictation');
    expect(STRINGS.en['audio.fix.noJa.ios' as never]).toContain('Settings > Accessibility > Spoken Content > Voices > Japanese');
    expect(STRINGS.en['audio.fix.noJa.android' as never]).toMatch(/Text-to-speech.*Google.*Install voice data > Japanese/);
  });
});
