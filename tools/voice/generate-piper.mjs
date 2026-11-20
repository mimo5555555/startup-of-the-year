// Records every static line of Berlin (de) or Amsterdam (nl) with Piper into apps/mobile/public/voice-<lang>/<hash>.mp3 + manifest.json,
// the way generate.mjs records the Japanese ones with VOICEVOX. The lines come from tools/voice/lines-<lang>.ts, the voices from
// apps/mobile/src/voice/voices-<lang>.ts (a model, a pitch and a pace per character), the key from apps/mobile/src/voice/key.ts.
// Incremental and resumable: existing files are kept.
//   PIPER_PYTHON=<python with piper-tts> PIPER_MODELS=<dir with the .onnx models> node tools/voice/generate-piper.mjs <de|nl> [--dry] [--limit N]
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const LANG = args.find((a) => a === 'de' || a === 'nl');
if (!LANG) throw new Error('which language? node tools/voice/generate-piper.mjs <de|nl>');
const OUT = `${ROOT}apps/mobile/public/voice-${LANG}/`;
const WORK = process.env.PIPER_WORK ?? `${tmpdir()}/lw-voice-${LANG}/`;
const dry = args.includes('--dry');
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const p = (rel) => `${ROOT}${rel}`;

const vite = await createServer({
  configFile: false,
  root: ROOT,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: {
    alias: {
      '@lw/core': p('packages/core/src/index.ts'),
      '@lw/content': p('packages/content/src/index.ts'),
      '@lw/engine': p('packages/engine/src/index.ts'),
      '@lw/game': p('packages/game/src/index.ts'),
    },
  },
});
const linesMod = await vite.ssrLoadModule(`/tools/voice/lines-${LANG}.ts`);
const voicesMod = await vite.ssrLoadModule(`/apps/mobile/src/voice/voices-${LANG}.ts`);
const { voiceEntryKey, voiceTextKey } = await vite.ssrLoadModule('/apps/mobile/src/voice/key.ts');
const voiceLines = LANG === 'de' ? linesMod.voiceLinesDe : linesMod.voiceLinesNl;
const VOICES = LANG === 'de' ? voicesMod.DE_VOICES : voicesMod.NL_VOICES;
await vite.close();

// one job per (voice, text key); the voice's settings are part of the hash, so a new pitch or model records it again
const entries = {};
const jobs = new Map();
for (const l of voiceLines()) {
  if (!voiceTextKey(l.text)) continue;
  const v = VOICES[l.voice];
  const key = voiceEntryKey(l.voice, l.text);
  const hash = createHash('sha1').update(`${v.model}:${v.pitch}:${v.speed}:${key}`).digest('hex').slice(0, 12);
  if (!jobs.has(hash)) jobs.set(hash, { hash, voice: l.voice, say: l.say, ...v });
  if (!(key in entries)) entries[key] = hash;
}
const todo = [...jobs.values()].filter((j) => !existsSync(`${OUT}${j.hash}.mp3`)).slice(0, limit);
const byVoice = {};
for (const j of jobs.values()) byVoice[j.voice] = (byVoice[j.voice] ?? 0) + 1;
console.log(`lines ${jobs.size} (keys ${Object.keys(entries).length}), to record ${todo.length}`, JSON.stringify(byVoice));
if (dry) process.exit(0);

const PY = process.env.PIPER_PYTHON;
const MODELS = process.env.PIPER_MODELS;
if (!PY || !MODELS) throw new Error('set PIPER_PYTHON (a python with piper-tts) and PIPER_MODELS (the folder with the .onnx models)');
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });

// 1. Piper: every line to a WAV, each model loaded once
const batch = todo.map((j) => ({ model: j.model, text: j.say, speed: j.speed, wav: `${WORK}${j.hash}.wav` }));
writeFileSync(`${WORK}jobs.json`, JSON.stringify(batch));
const py = spawnSync(PY, [`${ROOT}tools/voice/piper_batch.py`, MODELS, `${WORK}jobs.json`], { stdio: 'inherit' });
if (py.status !== 0) throw new Error(`piper_batch exited ${py.status}`);

// 2. ffmpeg: the character's pitch (the sample rate shifted, the tempo kept), a little headroom, mono 22.05 kHz MP3
const rateOf = (wav) => readFileSync(wav).readUInt32LE(24);
const toMp3 = (j) =>
  new Promise((resolve, reject) => {
    const wav = `${WORK}${j.hash}.wav`;
    const sr = rateOf(wav);
    // 1 dB of headroom: Piper normalizes to full scale, and the pitch shift and the MP3 encoder would clip its peaks
    const pitch = j.pitch === 1 ? '' : `asetrate=${Math.round(sr * j.pitch)},aresample=22050,atempo=${(1 / j.pitch).toFixed(4)},`;
    const filter = `${pitch}volume=0.89`;
    const ff = spawn('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', filter, '-ac', '1', '-ar', '22050', '-b:a', '32k', '-f', 'mp3', `${OUT}${j.hash}.mp3.tmp`]);
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? (renameSync(`${OUT}${j.hash}.mp3.tmp`, `${OUT}${j.hash}.mp3`), resolve()) : reject(new Error(`ffmpeg ${code}`))));
  });
let failed = 0;
for (let i = 0; i < todo.length; i += 8) {
  const res = await Promise.allSettled(todo.slice(i, i + 8).map(toMp3));
  failed += res.filter((r) => r.status === 'rejected').length;
}

// 3. the manifest: only entries whose file exists
const voices = Object.fromEntries(Object.keys(VOICES).map((k, i) => [k, i]));
const have = Object.fromEntries(Object.entries(entries).filter(([, h]) => existsSync(`${OUT}${h}.mp3`)).sort(([a], [b]) => (a < b ? -1 : 1)));
writeFileSync(`${OUT}manifest.json.tmp`, JSON.stringify({ v: 1, voices, entries: have }));
renameSync(`${OUT}manifest.json.tmp`, `${OUT}manifest.json`);
const files = [...jobs.values()].filter((j) => existsSync(`${OUT}${j.hash}.mp3`));
const bytes = files.reduce((n, j) => n + statSync(`${OUT}${j.hash}.mp3`).size, 0);
console.log(`DONE ${LANG}: files ${files.length}, ${(bytes / 1048576).toFixed(1)} MB, manifest entries ${Object.keys(have).length}, failed ${failed}`);
