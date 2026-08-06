# AI Elegance — AI Workflows

How artificial intelligence participates across the filmmaking pipeline. AI is invoked through **structured jobs** with **assembled context** — never as isolated prompt boxes.

All server AI calls route through OpenRouter unless noted. API keys are server-side only.

---

## Design Rules

1. **Context before completion** — load project, director, cast, scenes before any model call
2. **Structured output** — prefer JSON with known keys; parse defensively (`extractJsonObject` pattern)
3. **Human approval** — AI proposes patches; user applies (Guide suggestions, continuity fixes)
4. **Shared prompt logic** — `lib/unified-shot-prompt.ts` and `lib/storyboard-continuity-prompts.ts` for generation
5. **Provenance** — store model id and prompts in `project_assets.metadata` when persisting outputs

---

## Workflow Map

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Concept /   │────►│ Script       │────►│ Scenes +    │
│ Idea        │     │ Import       │     │ Characters  │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
     ┌──────────────────────────────────────────┘
     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Shot list   │────►│ Continuity   │────►│ Storyboard  │
│ generation  │     │ check        │     │ frames      │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                                ▼
                                         ┌─────────────┐
                                         │ Video clips │
                                         └─────────────┘

        Project Guide ──► bible / character updates (any stage)
        Prompt enhance ──► field-level rewrites (director, shots)
        Adapt to Film ──► source → treatment → scenes → shots → production plan
```

---

## 1. Concept & Bootstrap

**Entry:** Idea workflow, concept generator, `bootstrap-project-from-concept`

| Step | Utility | Output |
|------|---------|--------|
| Screenplay from idea | `generate-screenplay-from-idea` | Parsed script text |
| Full import | `import-script-core` | Scenes, characters, project fields |
| Storyboard seed | `import-storyboard-seed` | Initial shot suggestions |

**Context:** Logline, genre, tone, target duration, optional director preset, character name list.

---

## 2. Script Import

**Entry:** `POST /api/projects/[id]/import-script`, script wizard

| Step | Utility | Output |
|------|---------|--------|
| Parse file | `parse-script-txt` | Structured parse |
| AI enrichment | `script-import-ai` | Scene headings, summaries, cast |
| Async job | `script-import-job-registry` | Progress polling |

**Context:** Raw screenplay, project goal, aspect ratio, duration budget.

Imported projects set treatment marker (`IMPORTED_SCRIPT_TREATMENT_MARKER`) and may skip the Script sidebar step.

---

## 3. Scene Analysis

**Entry:** `POST /api/projects/[id]/scenes/[sceneId]/analyze`

Enriches a single scene from screenplay body — beat summary, suggested shot count hints. Feeds storyboard generation.

---

## 4. Shot List Generation

**Entry:** `POST /api/generate-shots`, per-scene async jobs

| Component | Role |
|-----------|------|
| `generate-shots-ai` | LLM produces shot array (title, type, prompts, duration) |
| `enrich-generated-shots` | Merge director + cast into unified prompts |
| `continuity-check-ai` | Validate/repair shot list vs memory |
| `run-generate-shots-job` | Persist to `creative_shots` |

**Context per scene:**

- Scene heading + summary + body excerpt
- Full cast with visual bibles (`project-character-prompt-refs`)
- `director` JSON
- `continuity_memory`
- Project aspect ratio, target length

**Output shape:** `GeneratedShot` with `image_prompt`, `video_prompt`, `negative_prompt` — normalized by `normalizeShotsFromModelArray`.

Client polls `GET /api/generate-shots/jobs/[jobId]`.

---

## 5. Storyboard Frame Generation

**Entry:** Storyboard UI, `POST /api/generate/image`

**Prompt assembly:** `resolveFrameGenerationPrompt` in `lib/unified-shot-prompt.ts`

Blocks included when not already unified:

- `DIRECTOR BIBLE` — style, tone, camera, lighting, pacing
- `FULL CAST BIBLE` / per-shot character lock
- `STILL FRAME FOR THIS PANEL` — shot-specific staging
- `STRICT EXCLUSIONS` — merged negatives (standard + animal-only + per-character avoid)

**Vision references:** Character portrait URLs attached when cast appears in shot (`shot-character-continuity.ts`).

**Directive:** `SINGLE_STORYBOARD_FRAME_DIRECTIVE` — one panel, no collage.

---

## 6. Video Generation

**Entry:** Project video panel, `POST /api/generate/video`, tools page

| Component | Role |
|-----------|------|
| `project-video-panel-prefill` | Shot → form defaults |
| `video-generation-prefill` | Client-side prefill |
| `openrouter-generate-video` | Model-specific video API |
| `openrouter-video-job` | Async polling |
| `compress-image-for-video-seed` | Start frame preparation |

**Context:** Unified video prompt, negative prompt (`lib/video-negative-prompt.ts`), start frame from approved storyboard frame, audio policy (`video-generation-audio-policy`).

Persist outputs as `project_assets` kind `video` with shot/scene metadata.

---

## 7. Project Guide

**Entry:** `POST /api/projects/[id]/guide`, page `guide.vue`

| Component | Role |
|-----------|------|
| `loadProjectGuideContext` | Project + characters + scenes text |
| `buildProjectGuideSystemPrompt` | Instructions + allowed suggestion fields |
| `parseProjectGuideResponse` | JSON → reply + `GuideSuggestion[]` |

User approves suggestions → PATCH project, director, or character endpoints.

**Transitional:** Chat history in localStorage (`PROJECT_GUIDE_STORAGE_PREFIX`). Roadmap: PocketBase persistence.

---

## 8. Prompt Enhancement

**Entry:** `POST /api/prompt/enhance`, `PromptEnhanceButton` on director and shot fields

Field-level rewrite with context hint (`context: director`, field name). Does not auto-save — user keeps edit control.

---

## 9. Continuity Check (batch)

**Entry:** Part of shot generation pipeline; callable for re-check

See [ContinuityEngine.md](./ContinuityEngine.md).

---

## 10. Concept & Reference Analysis

| Feature | Utility |
|---------|---------|
| Concept generation | `generate-concept-ai` |
| Reference image analysis | `analyze-concept-reference-image` |

Used in early ideation before project bootstrap.

---

## Model Selection

- Project `preferred_model_id` when set
- Per-feature defaults in server utils (`openrouter-text-models`, video model list API)
- User can compare models in dedicated comparison workspace (landing page)

---

## Error Handling

- Missing OpenRouter key → graceful degrade (empty continuity check, guide error message)
- Parse failures → fallback plain-text reply; never silent data loss
- Job failures → surfaced in poll response with message

---

## Adding a New AI Workflow

Checklist:

1. Define **input context type** (mirror `ProjectGuideContext` or `UnifiedShotPromptContext`)
2. Implement **loader** in `server/utils/`
3. Use **structured JSON** output schema documented in system prompt
4. Map results to **existing entities** via mappers
5. Require **user approval** for bible mutations
6. Write **metadata** on any created asset
7. Add shared logic to `lib/` if client + server need it

---

## Related Documents

- [ContinuityEngine.md](./ContinuityEngine.md)
- [DirectorAI.md](./DirectorAI.md)
- [Architecture.md](./Architecture.md)
