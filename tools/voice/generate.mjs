// Records every static Japanese line of the app with VOICEVOX into apps/mobile/public/voice/<hash>.mp3 + manifest.json.
// The lines come from tools/voice/lines.ts (the content package's own data), the key from apps/mobile/src/voice/key.ts.
// Incremental and resumable: existing files are kept, the manifest is rewritten as it goes.
//   node tools/voice/generate.mjs [--dry] [--limit N] [--jobs N]      (VOICEVOX engine at $VOICEVOX_URL, default http://127.0.0.1:50021)
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = `${ROOT}apps/mobile/public/voice/`;
const ENGINE = process.env.VOICEVOX_URL ?? 'http://127.0.0.1:50021';
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const jobsN = args.includes('--jobs') ? Number(args[args.indexOf('--jobs') + 1]) : 4;
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const p = (rel) => `${ROOT}${rel}`;

// load the TypeScript modules through vite (same aliases as vitest)
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
const { voiceLines } = await vite.ssrLoadModule('/tools/voice/lines.ts');
const { voiceEntryKey, voiceTextKey } = await vite.ssrLoadModule('/apps/mobile/src/voice/key.ts');
const { VOICE_SPEAKERS } = await vite.ssrLoadModule('/apps/mobile/src/voice/voices.ts');
await vite.close();

// one job per (voice, text key); every alias key points at the same file
const entries = {};
const jobs = new Map();
for (const l of voiceLines()) {
  const key = voiceEntryKey(l.voice, l.text);
  if (!voiceTextKey(l.text)) continue;
  // the speaker id is part of the hash, so giving a character another voice records it again
  const hash = createHash('sha1').update(`${VOICE_SPEAKERS[l.voice].id}:${key}`).digest('hex').slice(0, 12);
  if (!jobs.has(hash)) jobs.set(hash, { hash, voice: l.voice, text: l.text });
  for (const t of [l.text, ...l.alias]) {
    const k = voiceEntryKey(l.voice, t);
    if (voiceTextKey(t) && !(k in entries)) entries[k] = hash;
  }
}
const todo = [...jobs.values()].filter((j) => !existsSync(`${OUT}${j.hash}.mp3`)).slice(0, limit);
const byVoice = {};
for (const j of jobs.values()) byVoice[j.voice] = (byVoice[j.voice] ?? 0) + 1;
console.log(`lines ${jobs.size} (keys ${Object.keys(entries).length}), to record ${todo.length}`, JSON.stringify(byVoice));
if (dry) process.exit(0);

mkdirSync(OUT, { recursive: true });
const voices = Object.fromEntries(Object.entries(VOICE_SPEAKERS).map(([k, v]) => [k, v.id]));
const writeManifest = () => {
  // only entries whose file exists, so a half-done run never points at a missing file
  const have = Object.fromEntries(Object.entries(entries).filter(([, h]) => existsSync(`${OUT}${h}.mp3`)).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(`${OUT}manifest.json.tmp`, JSON.stringify({ v: 1, voices, entries: have }));
  renameSync(`${OUT}manifest.json.tmp`, `${OUT}manifest.json`);
};

const post = async (path, body) => {
  const r = await fetch(`${ENGINE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r;
};
const toMp3 = (wav, file) =>
  new Promise((resolve, reject) => {
    const ff = spawn('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-i', 'pipe:0', '-ac', '1', '-ar', '22050', '-b:a', '32k', '-f', 'mp3', `${file}.tmp`]);
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? (renameSync(`${file}.tmp`, file), resolve()) : reject(new Error(`ffmpeg ${code}`))));
    ff.stdin.end(wav);
  });

async function record(j) {
  const speaker = VOICE_SPEAKERS[j.voice].id;
  const q = await (await post(`/audio_query?speaker=${speaker}&text=${encodeURIComponent(j.text)}`)).json();
  q.outputStereo = false;
  q.prePhonemeLength = 0.05;
  q.postPhonemeLength = 0.1;
  const wav = Buffer.from(await (await post(`/synthesis?speaker=${speaker}`, q)).arrayBuffer());
  await toMp3(wav, `${OUT}${j.hash}.mp3`);
}

// readings VOICEVOX would guess wrong (桜町 is Sakura-chō, not Sakura-machi): added to the engine's user dictionary once
const DICT = [{ surface: '桜町', pronunciation: 'サクラチョウ', accent_type: 3 }];
const dict = Object.values(await (await fetch(`${ENGINE}/user_dict`)).json()).map((w) => w.surface);
for (const w of DICT) {
  if (dict.some((s) => s.normalize('NFKC') === w.surface)) continue;
  const qs = new URLSearchParams({ surface: w.surface, pronunciation: w.pronunciation, accent_type: String(w.accent_type), word_type: 'PROPER_NOUN' });
  await post(`/user_dict_word?${qs}`);
}

// record in voice order (a speaker's model loads on its first line), a few at a time (one request does not fill the CPU engine)
todo.sort((a, b) => (a.voice < b.voice ? -1 : a.voice > b.voice ? 1 : 0));
const t0 = Date.now();
let done = 0;
let failed = 0;
let next = 0;
async function worker() {
  while (next < todo.length) {
    const j = todo[next++];
    try {
      await record(j);
    } catch (e) {
      failed++;
      console.log(`FAIL ${j.voice} ${j.text}: ${e.message}`);
    }
    done++;
    if (done % 25 === 0 || done === todo.length) {
      writeManifest();
      const rate = done / ((Date.now() - t0) / 1000);
      console.log(`${done}/${todo.length} (${failed} failed) ${rate.toFixed(2)}/s, ~${Math.round((todo.length - done) / rate / 60)} min left`);
    }
  }
}
await Promise.all(Array.from({ length: jobsN }, worker));
writeManifest();
const files = [...jobs.values()].filter((j) => existsSync(`${OUT}${j.hash}.mp3`));
const bytes = files.reduce((n, j) => n + statSync(`${OUT}${j.hash}.mp3`).size, 0);
console.log(`DONE files ${files.length}, ${(bytes / 1048576).toFixed(1)} MB, manifest entries ${Object.keys(JSON.parse(readFileSync(`${OUT}manifest.json`, 'utf8')).entries).length}, failed ${failed}`);
