# Language World — Project Plan (draft for approval)

> **Status: plan only. No application code has been written yet.**
> Drafted 2026-10-04 on branch `claude/language-learning-app-bt05qe`.
> The existing repo contents (a static landing page) are left untouched; the app will live in new `apps/`, `packages/` and `tools/` folders.

---

## 0. TL;DR

- **Is it possible?** Yes — as a **local-first** app: after a one-time model download, the whole core loop (walk, talk, speak your own language and get it translated, feedback, vocabulary, spaced repetition) can run in airplane mode on a recent phone.
- **What is *not* possible to promise:** parity with a cloud-AI product at C1/C2 level in Arabic and Japanese, 20 truly distinct on-device voices per language, or "AAA" 3D art without an artist. Details in §4.
- **Recommended stack:** TypeScript, React UI, Three.js 3D world, Capacitor mobile shell, native on-device engines (whisper.cpp for speech-to-text, llama.cpp for the character brain, OS/sherpa-onnx for voices) behind swappable interfaces.
- **Recommended first build (Phases 0–1):** one hero city — **Tokyo / Japanese** — fully playable end to end, plus one tiny second language to prove "adding a language is a config change".
- **Biggest risk:** the native on-device AI plumbing. I can write it, but I cannot run it on a phone from my environment; it needs your device testing.

---

## 1. What LingoLooper does (research)

Sources are third-party listings and search summaries. **The official site and the app stores were blocked from my sandbox**, so I have not seen the real screens and cannot confirm UX details such as exactly how the "speak your language → get the target language" step looks.

| Reported feature | Notes |
|---|---|
| Voice-first conversation practice with AI avatars in a playful 3D world | Core loop |
| 1,000+ avatars with personalities and interests | Marketing claim |
| 20+ languages | Their scope; ours starts at 7 |
| Places: café, gym, office, park, neighborhood, hospital, downtown; extra cities (Istanbul, Moscow, Kyiv, Warsaw); a City Hall with officials | Location + city model |
| Suggested replies, instant translation and audio | The user also reports: you can ignore suggestions and speak/type in your own language and it translates |
| Automatic transcripts | |
| Feedback on vocabulary, grammar, style | |
| Adapts difficulty to your level | |
| Hands-free conversation (preview) with automatic turn-taking | |
| ~$9–15/month (early access) | |

**Unknown to me:** whether their AI is cloud-based. At 20+ languages it very likely is, which is how they get quality. We will not copy their name, art, characters or UI assets; this is an original product with the same *category* of experience.

---

## 2. Product vision: Learn → Practice → Use → Review, inside a living 3D world

LingoLooper's loop is "talk to an avatar". The idea you added — **walk around a real-feeling city, talk to people, take lessons, build a life there** — lets us make the whole learning journey spatial:

| Place in the city | What it is for |
|---|---|
| **Language school** (teacher NPC) | Short structured lessons: scripts (hiragana/katakana, Cyrillic, Arabic alphabet), grammar tips, pronunciation drills. Completing one unlocks related conversation goals. |
| **Everyday locations** (café, station, market, office, clinic, hotel, gym, park, city hall) | Goal-driven conversations with NPCs (the "loops"). |
| **Streets & signs** | Every sign/shop/object is labelled in the target language; tap to hear it and save it. Immersion for free. |
| **Your home** | Vocabulary hub, spaced-repetition review, stats, streak, avatar customisation. |
| **Culture spots** (shrine, museum, festival) | Short culture notes + conversations with higher personality. |
| **Friends' houses** (later, online) | Visit other learners, chat and practise together. |

**The signature mechanic — "say it your way":** at any point you can ignore the suggestions and speak or type in your mother tongue. The app (1) transcribes it, (2) translates it into natural, situation-appropriate target language, (3) shows it with reading aids and plays it, (4) asks you to **say it yourself** (shadowing), then the character replies. Assisted lines are tracked separately so they never count as your own errors (§10).

**Level adaptation:** characters constrain sentence length, vocabulary, grammar and speed to a *level card* per CEFR level (§9), and "recast" mistakes naturally instead of lecturing.

---

## 3. Feasibility: what can run 100% on-device

| Capability | Local approach | Quality risk | Fallback |
|---|---|---|---|
| Speech-to-text (your voice, L1 *or* L2) | **whisper.cpp** (MIT), multilingual, `base`/`small` quantised models; Silero VAD for turn-taking | Medium. Learner-accented Japanese/Arabic is noticeably worse than Spanish/German on small models; Egyptian/Levantine dialect is weakest | OS speech recognition (offline packs); larger Whisper tier on flagships; typed input always available |
| Character brain (dialogue) | **llama.cpp** (GGUF), small multilingual instruct model (candidates: Gemma 4 E2B/E4B, Qwen3 1.7B–4B). Grammar-constrained JSON output so small models stay reliable | **Highest.** Role-play at A1–B1 is feasible; C1/C2 nuance in ja/ar is limited. Per search results Gemma 4 E2B reaches roughly 30 tokens/s on an iPhone 16 Pro — untested by me | Optional user-enabled cloud model (off by default) behind the same interface |
| Translation (L1 ↔ L2, 42 directions) | Same on-device LLM with a dedicated translation prompt (no extra download). Optional dedicated MT model if the bake-off shows a win | Medium for short utterances; fine for es/de/nl/ru/en, weaker for ja/ar nuance | Dictionary + phrasebook for common phrases |
| Text-to-speech (character voices) | Tier 1: **OS voices** (no download, all 7 languages). Tier 2: **sherpa-onnx** running Piper/VITS or Kokoro voices for more consistent character voices | Medium. Arabic leans Modern Standard; Japanese needs Kokoro or OS voices; 20 characters will share ~3–6 base voices varied by pitch/speed | OS voices only |
| Furigana / romaji / diacritics / transliteration | Bundled dictionaries + rules (e.g. a MeCab-style Japanese analyser), no AI needed | Low | — |
| Spaced repetition | **FSRS** (open algorithm) in TypeScript | Low | — |
| Curriculum, lessons, vocab | **Pre-generated and reviewed at build time**, shipped as data (not generated live on the phone) | Needs native-speaker QA | — |

**Cost of "100% local":** a one-time download of roughly 3–5 GB (my estimate; the bake-off will fix real numbers), a recent phone (target ≥ 6 GB RAM, comfortable at 8 GB), heavier battery/thermals, and a turn latency of about 2–4 s (target, unmeasured) versus ~1 s on cloud.

**Recommendation — "local-first":** everything works offline; engines sit behind interfaces so a higher-quality cloud engine can be switched on later by choice, without rewriting the app. If you want *strictly* zero network, that is still possible; the engine interface is the same.

---

## 4. Honest limits and risks

1. **Quality ceiling.** On-device small LLMs make more mistakes than cloud models. We mitigate with constrained prompts, level cards, structured output, rule-based checks and an eval harness — but an A2 Arabic conversation will not match a cloud model, and C1/C2 will be noticeably weaker.
2. **Native plumbing can't be tested by me.** My environment can build and drive the web version in headless Chromium (screenshots, e2e tests). It cannot run an iPhone/Android build, and the sandbox could not reach Hugging Face to download model weights. Native engine work will be written carefully and then verified on your devices; expect iteration.
3. **Art.** I can produce a charming stylised low-poly world and characters in code (procedural geometry, CC0 asset kits, procedural animation) and a clean glTF pipeline so a 3D artist can drop in better assets later. I cannot match a studio's hand-made animation. Optional: AI-generated 2D portraits/concept art via the connected image tool (uses credits — I'll ask first).
4. **Content volume.** 7 languages × 6 levels (A1–C2) is large. I can generate and validate the data, but **native-speaker review is required** (especially Arabic dialect, Japanese naturalness, Russian stress).
5. **Voices.** "20+ characters per language" is achievable in personality and appearance; distinct *voices* will be fewer.
6. **Devices.** Older/low-RAM phones need a "Lite" tier (smaller models, OS voices) with lower quality.
7. **Scope.** This is a team-months project. One session realistically yields Phases 0–1 (§15) as a real working build; later phases proceed iteratively.

---

## 5. Architecture

### 5.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict), pnpm monorepo | One language across UI, engine, content tooling |
| UI | React + CSS variables; RTL-aware; i18n (English + Arabic first) | Mobile-first, accessible |
| 3D | Three.js via react-three-fiber | Mature, runs in WebView on phones and in Chromium for my testing |
| Mobile shell | **Capacitor** (iOS/Android) | Same rendering code on device and in browser, so what I verify in headless Chromium is close to what ships; native plugins only for AI engines |
| AI engines | Native plugins: whisper.cpp, llama.cpp, sherpa-onnx / OS TTS, Silero VAD. Web adapters (WebGPU/WASM) for desktop dev and PWA | Native for the big models on phones |
| Storage | SQLite (native) / IndexedDB (web) behind one repository interface | Offline, exportable |
| SRS | `ts-fsrs` (FSRS) | Better than SM-2, open |
| Validation | zod schemas for every content file | Adding a language can't silently break the app |
| Testing | Vitest, Playwright (screenshots + e2e), content linters, model eval harness | Quality gates in CI |

**Alternative considered — React Native/Expo:** more mature ready-made on-device ML bindings (`llama.rn`, `whisper.rn`), but both rendering and AI are native, so much more of the app is something I cannot verify here. **Unity/Godot:** best 3D, but I cannot run or screenshot them here and the content pipeline is heavy. Decision #1 in §16.

### 5.2 Module layout

```
apps/mobile/            React UI + Capacitor shell (iOS/Android projects)
packages/core/          types, FSRS, XP/streak, repositories, storage ports
packages/engine/        ports: STT, LLM, TTS, Translate, VAD
                        adapters: native, web (WebGPU/WASM), cloud (optional), mock/scripted (tests)
                        conversation orchestrator, prompt builder, JSON-schema output
packages/world/         Three.js: city loader, avatar rig, NPC system, camera, interaction
packages/content/       language packs (JSON) + zod schemas
tools/                  content generation, validation, CEFR vocab linter, eval harness, license register
docs/                   this plan, ADRs
```

### 5.3 The conversation pipeline

```
 mic ─► VAD ─► STT (whisper.cpp) ─► language-ID: L1 or L2?
                                      │ L2 → use as-is (graded as "independent")
                                      │ L1 → translate to L2 ("assisted") → show + TTS → "now say it"
                                      ▼
                 Conversation orchestrator (state machine)
                 ├─ prompt builder: character card + level card + memory + SRS words + topics
                 ├─ LLM (llama.cpp, grammar-constrained JSON, streaming)
                 ├─ sentence splitter ─► TTS ─► audio + amplitude ─► lip-sync / gestures
                 └─ lazy, parallel: suggestions · translate-line · hint
```

- **Latency tactics:** stream tokens, speak the first sentence while the rest generates, keep the main call small (reply + emotion + goal step only), compute suggestions/translation/hint in separate lazy calls, mask thinking with a gesture animation.
- **Rendering during inference:** the world is mostly static in conversation mode, so the renderer drops to 30 fps and lowers resolution while the LLM runs, to protect thermals.
- **Pause** freezes the pipeline and the world.

### 5.4 Model manager and device tiers

First-run flow: detect RAM/GPU → recommend a tier → Wi-Fi download with resume + checksum → storage screen (delete/replace models). Tiers (final numbers come from benchmarks): **Lite** (small Whisper, ~1–2B LLM, OS voices), **Standard**, **Plus**. A **model bake-off harness** scores candidate models per language/level (valid JSON, correct script, level-card compliance, goal progress) — model choice is an eval result, not a guess.

---

## 6. The 3D world

- **Art direction:** playful, stylised low-poly "toy city"; flat/toon shading with soft outlines; per-city palette and signage in the target language.
- **City = data + style pack:** each city is a layout JSON (streets, lots, locations, spawn points, NPC schedules) plus a style pack (architecture modules, props, palette). New cities reuse the modular kit — no bespoke modelling per city.
- **Interiors** load as separate light scenes on entry to keep memory low.
- **Controls:** virtual joystick + camera drag + tap-to-walk; contextual "Talk / Enter / Look" button.
- **Conversation mode:** camera eases to an over-the-shoulder framing; the character faces you; UI shows bubble, helper buttons and mic.
- **Characters:** one shared skeleton, modular parts (head, hair, outfit, accessories), ~5–8k triangles each, ~10 clips (idle, walk, talk ×3, wave, think, laugh, nod, culture-specific greeting such as a bow). Talking animation driven by TTS audio amplitude (visemes later).
- **Living city:** NPCs walk loops and keep schedules; those with something for you show an icon; they greet you by name and remember past chats.
- **Performance budget (proposed):** ≤ ~150 draw calls, ≤ ~200k visible triangles, texture atlases with KTX2 compression and meshopt, instancing for crowds/props, baked lighting; 30–60 fps on a mid-range phone.
- **Asset swap interface:** characters/buildings load as glTF from content packs, so an artist's assets can replace mine without code changes.

---

## 7. Languages and "adding a language is a config change"

Each language is a content pack, not code:

```
packages/content/languages/<code>/
  language.json     code, name, script, direction, varieties, STT locale, TTS voice map,
                    reading aids (furigana/romaji/diacritics/stress), tokenizer strategy
  levels/           level cards + syllabus per CEFR level
  cities/           layouts + style pack refs
  characters/       ≥ 20 character cards
  scenarios/        goal-driven scenarios per level
  lessons/          structured lessons
  vocab/            frequency-ranked word lists with readings, translations, examples
```

Special handling per language:

| Language | Needs |
|---|---|
| **Japanese** | Three scripts; furigana/romaji toggles; word segmentation for tap-to-save; politeness register (です/ます → keigo at B2+); JLPT N5–N1 mapping to CEFR |
| **Arabic** | RTL UI; **MSA vs spoken dialect** (decision #4); optional diacritics (tashkeel) and transliteration; root/pattern display for vocabulary; weakest STT/TTS coverage |
| **Russian** | Cyrillic; stress marks shown in learning mode; case endings highlighted |
| **German** | Noun gender colour-coding, cases, separable verbs, du/Sie register |
| **Dutch** | de/het, word order, je/u, Netherlands vs Flanders variety |
| **Spanish** | Spain vs Latin America (vosotros/ustedes, seseo); conjugation help |
| **English** | British/American; learners from ja/ar/ru etc. (pronunciation vs spelling) |

**Proposed cities (2 per language eventually):** Tokyo, Kyoto/Osaka · Madrid, Mexico City · Berlin, Vienna · Amsterdam, Antwerp · Moscow, St. Petersburg · Cairo + one of Amman/Dubai (decision #4) · London, New York.

**Proposed UI languages:** English + Arabic (RTL) first; others later via i18n files.
**Proposed mother tongues (v1):** the same 7; a further ~3 (e.g. French, Turkish, Mandarin) later — adding an L1 needs UI strings, STT quality, and translation/explanation quality checks.

---

## 8. Curriculum and levels (A1–C2)

- 6 levels × 7 languages = 42 level tracks. Each track: can-do goals, grammar inventory, target vocabulary, level card, scenarios, lessons.
- Rough cumulative vocabulary guide (industry rule of thumb, not a standard): A1 ~500, A2 ~1,000, B1 ~2,000, B2 ~4,000, C1 ~8,000, C2 ~16,000.
- **A1–B1:** structured — lessons + guided scenarios. **B2–C2:** conversation-heavy — registers, idioms, culture, debate, formal language; weakest on a small local model (see §4).
- **Generation pipeline (build time, not on the phone):** draft content with a strong model → schema validation → **CEFR vocabulary linter** (flags words above the level) → script/diacritic checks → native-speaker review → ship as data. A `content:validate` command gates CI.
- **Proposed per-language v1 targets:** 20–24 characters, 40–60 scenarios across levels, 30+ lessons for A1–B1.
- **Placement:** a 2-minute placement chat (adaptive; the same engine) or manual level pick.

---

## 9. Level cards and conversation design

**Level card** (per language × CEFR level), used by the prompt builder and the linter:

```json
{
  "level": "A2",
  "maxWordsPerReply": 12,
  "maxSentences": 2,
  "allowedGrammar": ["present", "past (regular)", "want to", "can"],
  "vocabListRef": "vocab/a2.json",
  "register": "polite-neutral",
  "speakingRate": 0.9,
  "scaffolding": { "showTranslation": "on-tap", "autoSuggestions": true }
}
```

**Helpers:** Hint (suggest what to say), Translate (last character line), Repeat slowly, Pause, Reading aids toggle (furigana/romaji/diacritics/stress), Suggestions (3 chips), and **Say-it-your-way** (§2).

**Goals:** each scenario has ordered goal steps (e.g. *order a coffee → ask for Wi-Fi password*) tracked by the orchestrator (step keywords + a lightweight LLM judge), producing the "goal completion" score.

**Memory:** after each loop the on-device LLM writes a ≤ 60-word summary + a few facts per character; stored and injected next time. Characters also recycle the learner's saved/due vocabulary.

**Topics:** onboarding asks for favourite topics; characters have interest tags; the engine steers conversation toward overlaps. Proposed 24 topics: food & cooking, travel, music, movies & TV, sports & fitness, gaming, tech & gadgets, fashion, art & design, books, nature & animals, health & wellness, business & careers, science, history, culture & traditions, cars & transport, photography, anime & manga, social media, family & relationships, shopping, environment, current affairs (adult-gated).

**Age groups (proposed 4):** kids 6–12, teens 13–17, adults 18–49, 50+. They set topic availability, content filtering, tone, default speaking rate and UI size.

---

## 10. Feedback, vocabulary, progress

**Feedback after each loop**
- Transcript with errors highlighted; corrections grouped **grammar / vocabulary / naturalness** (pronunciation scoring later), each with a short explanation (in the learner's mother tongue at A1–B1, optionally in simple target language later) and a more natural version.
- Scores: goal completion, fluency, accuracy; 1–2 focus points for next time. Encouraging but honest — no praise for mistakes.
- **Assisted vs independent:** lines the learner produced via suggestions or L1→L2 translation are labelled *assisted* and excluded from accuracy; they become "phrases you learned" and feed the vocabulary hub. The accuracy score is computed from independent lines only.
- Rule-based checks per language back up the LLM, and the report is labelled as AI-generated and possibly imperfect.

**Vocabulary hub:** tap any word in a transcript, sign, or lesson → translation, reading, example sentence, audio → saved. FSRS review: flashcards (recognition) and "use it in a sentence" (production). Due words are fed back into character prompts.

**Progress:** XP per loop, daily streak with limited freezes, level per language, unlocks (cities, characters, locations), stats page (minutes spoken, loops, words saved, common error types).

---

## 11. Data model

Content (languages, cities, locations, characters, scenarios, lessons) is **JSON in language packs**, referenced by id. User data is **SQLite/IndexedDB**:

```
profile(id, display_name, native_lang, ui_lang, age_group, topics_json, created_at)
learner_language(profile_id, lang, variety, level, goal, xp, streak_days, streak_freezes,
                 last_active_date, placement_done)                       PK(profile_id, lang)
model_install(id, kind[stt|llm|tts|mt], name, version, bytes, sha256, tier, installed_at)

loop(id, profile_id, lang, city_id, location_id, scenario_id, character_id, level,
     started_at, ended_at, duration_s, goal_status, xp_awarded, assisted_ratio)
turn(id, loop_id, idx, speaker[learner|character], text_target, text_l1,
     input_mode[speech_l2|speech_l1|typed_l2|typed_l1|suggestion], assisted, audio_ref,
     stt_confidence, created_at)
feedback(loop_id, scores_json{goal,fluency,accuracy}, focus_next_json, summary, model_version)
correction(id, loop_id, turn_id, span_start, span_end, category[grammar|vocabulary|naturalness],
           explanation, better, severity)

vocab_item(id, profile_id, lang, lemma, surface, reading, translation_l1, pos,
           example_target, example_l1, audio_ref, source_loop_id, source_turn_id, created_at)
review_card(id, vocab_item_id, card_type[recognition|production], due, stability, difficulty,
            reps, lapses, state, last_review)
review_log(id, card_id, rating, reviewed_at, elapsed_ms)

character_memory(profile_id, character_id, summary, facts_json, relationship_level, updated_at)
unlock(profile_id, lang, kind[city|location|character], content_id, unlocked_at)
daily_stat(profile_id, lang, date, seconds_spoken, loops, words_saved, xp)
error_stat(profile_id, lang, category, subtype, count)
```

**Character card (content):** `id, name, age, job, personality[], interests[], topicAffinities[], speakingSpeed, voice{engine,voiceId,pitch,rate}, avatar{kit params}, homeLocation, schedule[], minLevel, unlock`.
**Scenario (content):** `id, location, characterIds[], levelRange, setup, goalSteps[], targetVocab[], successCriteria, targetMinutes, topicTags[]`.

Accounts: a **local profile** (no sign-up needed). Optional online account only when social features arrive (§13). Progress is exportable/importable.

---

## 12. Prompt templates (drafts for on-device models)

Design rules for small models: short, one task per call, explicit level card, structured JSON via constrained decoding, no long instructions.

### 12.1 Character (main turn)

```
You are {{name}}, {{age}}, {{job}} in {{city}}. Personality: {{traits}}. Interests: {{interests}}.
Place: {{location}}. Situation: {{scenario_setup}}.
Speak ONLY {{target_language}} ({{variety}}). Never use another language in "say".

LEARNER LEVEL {{cefr}}:
- At most {{maxWordsPerReply}} words, {{maxSentences}} sentence(s).
- Only these grammar points: {{allowedGrammar}}. Register: {{register}}.
- Prefer these words: {{vocab_focus}}. Naturally reuse: {{review_words}}.
You remember: {{memory_summary}}. The learner likes: {{topics}}.
The learner's goal (do not reveal it): {{goal_steps}}. Help them reach it naturally.

RULES
1. Stay in character. Never explain grammar, never mention being an AI.
2. React to what the learner actually said. Ask at most one question.
3. If they make a mistake, answer naturally using the correct form (a recast). Do not point out the error.
4. If they seem stuck (very short, "?", silence), simplify and offer a choice question.
5. Keep content suitable for age group {{age_group}}; deflect inappropriate topics in character.

Conversation so far:
{{recent_turns}}

Reply as JSON: {"say": "...", "emotion": "neutral|happy|surprised|confused|sad|excited",
                "goal_step_done": <step id or null>, "end": false}
```

Separate lazy calls: **suggestions** (3 level-appropriate replies), **hint**, **translate-line**.

### 12.2 Say-it-your-way (L1 → L2)

```
Translate the learner's message from {{native_language}} into natural {{target_language}}
({{variety}}) for this situation: {{location}} talking to {{character_role}}.
Register: {{register}}. Keep it as simple as the meaning allows for level {{cefr}}.
Message: "{{l1_text}}"
JSON: {"target": "...", "reading": "<furigana/romaji/diacritics/transliteration if applicable>",
       "simpler": "<an even simpler alternative or null>", "back_translation": "..."}
```

### 12.3 Feedback (after the loop)

```
You review a {{target_language}} practice conversation for a {{cefr}} learner whose mother tongue is
{{native_language}}. Write all explanations in {{explanation_language}}.
Turns marked "assisted" were written by the app — do NOT correct them; list them under "phrases_learned".
Check only independent learner turns. Report at most 5 corrections, most important first.
Categories: grammar, vocabulary, naturalness. Each needs a short plain explanation and a more natural version.
Be encouraging but honest. Do not praise mistakes. If a turn is correct, say nothing about it.
Goal: {{goal}}. Transcript: {{turns_json}}
JSON: {"corrections":[{"turn":0,"span":[0,0],"category":"","explanation":"","better":"","severity":1}],
       "scores":{"goal":0-100,"fluency":0-100,"accuracy":0-100},
       "focus_next":["...","..."],"praise":"<specific, true>","phrases_learned":["..."]}
```

### 12.4 Memory summary (after the loop)
Summarise in ≤ 60 words what {{name}} learned about the learner and what they talked about; list ≤ 5 facts (name, job, hobbies) as JSON.

Every template is covered by the eval harness (golden cases per language and level).

---

## 13. Social / "visit your friends" (later, online module)

- Local-first stays the default; the social layer is a separate, optional online module.
- **Friend codes** (no phone/email needed); presence + visit via a small realtime backend; WebRTC for voice/text.
- **Live translation happens on each receiver's device** (their own model, their own languages) — private and no server AI cost.
- Visiting a friend = load their avatar + room config (tiny JSON) and sync position over a realtime channel.
- **Safety:** block/report, no unsolicited contact, parental consent and restricted features for under-13/under-16 per local law, age-group-matched discovery.
- Hooks we build now so it is not a rewrite: stable ids, avatar/room config as data, a "world instance" abstraction, event-style progress records.

---

## 14. Privacy, safety, licensing

- Audio and transcripts stay on the device by default; no analytics without opt-in; export/delete data in settings. Local-only is a real advantage if kids use it.
- Content filters per language and age group (word lists + prompt rules).
- **Licensing watchlist — verify with a legal check before any commercial release** (my recollection, not legal advice):
  - Whisper, llama.cpp, Silero VAD: permissive (MIT).
  - Gemma and some other open-weight LLMs ship under custom terms; Qwen models are mostly Apache-2.0 — confirm the exact version we ship.
  - **NLLB-200 weights are non-commercial (CC-BY-NC)** — avoid for a commercial product. OPUS-MT models are mostly CC-BY (attribution).
  - Piper/espeak-ng contain GPL components and voices carry individual licenses; OS voices avoid this.
  - Some popular frequency/vocabulary lists are non-commercial; we use permissively licensed sources and record each in `tools/licenses`.
  - 3D asset kits: prefer CC0 (e.g. Kenney, Quaternius); check any others individually. Fonts: Noto (OFL).

---

## 15. Roadmap

| Phase | Deliverable | "Done" means |
|---|---|---|
| **0 — Foundation** | Monorepo, TS strict, Vite + React + Three, Capacitor shell, zod content schemas, engine ports + mock/scripted adapters, storage adapters, i18n (en, ar/RTL), CI (typecheck, lint, unit, content-validate, Playwright) | CI green; a scripted conversation runs headless in a test |
| **1 — Tokyo vertical slice (browser-playable)** | Tokyo district (≈5 locations), 5–6 NPCs, walking, interaction, conversation mode, mic + typing, say-it-your-way, suggestions, hint/translate/slow/pause, furigana/romaji, feedback screen, vocab hub + FSRS, minimal XP/streak, onboarding (mother tongue, level, goal, topics, age group); plus a tiny second language (1 scenario) | Playwright plays a full loop with the scripted engine; screenshots reviewed; adding the second language needed **no code changes**; you try it on your phone browser |
| **2 — On-device engines** | Native whisper.cpp, llama.cpp (grammar-constrained), TTS (OS + sherpa-onnx), VAD plugins; model manager; benchmark + eval harness; thermal/latency policy | A full loop runs in airplane mode on your phone; latency + eval report per language recorded |
| **3 — Curriculum & languages** | Content pipeline + linter; all 7 languages × A1–C2: scenarios, characters, lessons, scripts; native-speaker review workflow | `content:validate` passes; reviewed sample per language |
| **4 — Progression** | Full XP/streak/freezes, unlocks, stats, placement chat | Unlock flow tested end to end |
| **5 — World expansion & polish** | More cities, art/audio/haptics pass, performance tuning | Frame-rate and memory budgets met on target devices |
| **6 — Social** | Friends, visiting, live-translated chat | Two devices chat across languages |

**Quality gates throughout:** schema validation, CEFR vocabulary linter, model eval harness, Playwright visual checks, performance budgets, license register.

---

## 16. Decisions needed from you

1. **Platform:** Capacitor + Three.js (recommended) · React Native/Expo · Unity/Godot.
2. **"100% local":** local-first with an optional cloud boost off by default (recommended) · strictly no network ever.
3. **First hero slice:** Tokyo/Japanese + a tiny second language to prove config-driven languages (recommended) · a different first city.
4. **Arabic target variety:** MSA + Egyptian dialect (Cairo) · MSA + Levantine · MSA only.
5. **Minimum phone:** ~8 GB RAM recommended, with a "Lite" tier for 6 GB.
6. **App name and art direction** (working title for now; stylised low-poly proposed).
7. **Proposals I'll use unless you object:** 4 age groups, 24 topics, v1 mother tongues = the 7 languages, UI English + Arabic.

## 17. What I can and cannot verify from my environment

| Can | Cannot |
|---|---|
| Build and run the web version; drive it with headless Chromium; screenshots; unit/e2e tests; content validators | Run on a real iPhone/Android; test native AI plugins; download model weights from Hugging Face (not reachable from the sandbox) |
| Write native plugin code and benchmarking tools | Judge native-level naturalness in Arabic/Japanese/Russian etc. without your reviewers |
| Reach npm for packages | See LingoLooper's own site/app (blocked) — screenshots or a screen recording from you would help me match the translate-assist flow |

---

### Sources

- [LingoLooper — App Store listing (via search summary)](https://apps.apple.com/us/app/lingolooper-ai-language-game/id1670913076)
- [LingoLooper — Google Play](https://play.google.com/store/apps/details?id=com.lumilabs.LingoLooper&hl=en_US)
- [LingoLooper — official site](https://www.lingolooper.com/)
- [Trendhunter on LingoLooper](https://www.trendhunter.com/trends/lingo-looper)
- [Toolify on LingoLooper](https://www.toolify.ai/tool/lingolooper)
- [Gemma 4 mobile deployment notes](https://gemma4-ai.com/blog/gemma4-mobile-deploy)
- [Local LLM comparison 2026: Gemma 4 on phones](https://aitoolranked.com/blog/local-llm-comparison-ollama-gemma-smartphones)
- [whisper-cpp-capacitor plugin](https://github.com/arusatech/whisper-cpp-capacitor)
- [Expo: on-device AI with React Native ExecuTorch](https://expo.dev/blog/how-to-run-ai-models-with-react-native-executorch)
- [NekoSpeak (offline TTS on Android: Kokoro/Piper)](https://github.com/siva-sub/NekoSpeak)
- [OPUS-MT / Bergamot offline translation](https://github.com/Helsinki-NLP/OPUS-MT-app)
