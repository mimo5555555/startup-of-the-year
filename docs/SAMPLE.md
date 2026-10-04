# Language World — interactive sample (Tokyo / Japanese)

A playable vertical slice of the plan in [PLAN.md](./PLAN.md): walk around a 3D Tokyo district, talk to six
characters, say things in English or Arabic and have them turned into Japanese, get feedback, and review words.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173 (open it on a phone via the "Network" URL)
npm test               # 138 unit tests
npm run typecheck
npm run e2e            # drives the app in headless Chromium and saves screenshots (dev server must be running)
npm run build:artifact # single-file build in apps/mobile/dist-artifact/page.html
```

## What is real, and what stands in for the on-device AI

| Part | In this sample | In the full app (plan §3, Phase 2) |
|---|---|---|
| 3D city, characters, camera, controls, minimap | **Real** (Three.js, ~36 draw calls, ~42k triangles at start) | Same, plus interiors and more cities |
| Character dialogue | Scripted state machines (`packages/content/src/tokyo/scenarios.ts`) with intent matching | On-device LLM with the character prompt (plan §12.1) |
| "Say it your way" translation (English/Arabic → Japanese) | Hand-written phrasebook with slots and fuzzy matching (`phrasebook.ts`); says so when it cannot translate | On-device LLM or MT model (plan §12.2) |
| Feedback | Rule-based (particles, politeness, English words in Japanese sentences) | On-device LLM (plan §12.3) |
| Spaced repetition | **Real** FSRS (`ts-fsrs`) | Same |
| Speech output | Your browser's Japanese voice, if installed | OS voices / sherpa-onnx |
| Speech input | Browser speech recognition where available. **In Chrome this sends audio to Google, so it is a sample-only convenience and not local.** Typing always works | whisper.cpp on-device |
| Storage | `localStorage` (memory only if the browser blocks it) | SQLite on device |

Nothing is sent to any server by the app itself.

## Layout

```
packages/core      kana/romaji, FSRS wrapper, storage port, XP/streak/levels
packages/content   language pack: lexicon (EN+AR glosses), phrasebook, characters, scenarios, lesson, topics
packages/engine    ports and adapters: translator, dialogue session, rule feedback, speech
packages/world     Three.js district: batched geometry, avatars, NPCs, camera, input
apps/mobile        React UI (English + Arabic/RTL), zustand store, screens
tools/e2e          Playwright-driven walkthroughs
```

## Quality gates in place

- `content.test.ts`: every Japanese token must exist in the lexicon, every line has English and Arabic, every scenario graph is
  reachable, every goal step can be completed.
- `session.test.ts`: plays every scenario headlessly through typed Japanese, romaji, English, Arabic and suggestions, and
  **picks every suggestion at every node** to prove each one is understood.
- `translator.test.ts`: English and Arabic coverage, plus a check that no sentence maps to two different phrases.
- `tools/e2e`: the real UI, start to finish, in English and Arabic, and all five scenarios.

## Adding content

- **A scenario:** add nodes to `scenarios.ts` (lines are `token|token|…` markup resolved against `lexicon.ts`); run `npm run content:validate`.
- **A phrase the translator should know:** add a `P(...)` row to `phrasebook.ts` with English and Arabic wordings.
- **A language:** the pack shape (`types.ts`) is language-neutral; Japanese-specific pieces are the tokenizer, kana helpers and
  reading aids. This sample only ships Japanese; generalising the pack loader is Phase 3.

## Known limits

- Only Japanese A1–A2 content, six characters, five scenarios and one lesson.
- No interiors you can walk into (shops are open-front dioramas), no day/night, no multiplayer.
- The Capacitor shell and native engines (Phase 2) are not generated yet; this runs in the browser.
- Dev tooling reports `npm audit` advisories (vitest/esbuild); the shipped dependencies have none.
