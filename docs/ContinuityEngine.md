# AI Elegance — Continuity Engine

The Continuity Engine keeps a film **internally consistent** across shots, scenes, and generation passes. It is not a single service today — it is a **set of cooperating rules, prompts, and AI checks** that will consolidate into a first-class subsystem.

---

## Purpose

At feature scale, manual prompt editing breaks down. The engine ensures:

- Character appearance matches the cast bible
- Director style/tone/camera rules propagate to every frame
- Negatives prevent wrong species, humans in animal casts, watermarks, collages
- Creative facts accumulate in `continuity_memory` instead of being forgotten
- Shot lists are repaired before persistence when AI detects contradictions

---

## Architecture (Current)

```
                    ┌─────────────────────┐
                    │ continuity_memory   │
                    │ (project text)      │
                    └──────────┬──────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    ▼                          ▼                          ▼
┌─────────────┐      ┌─────────────────┐      ┌──────────────────┐
│ Director    │      │ Character       │      │ Shot prompts     │
│ bible JSON  │      │ bibles + avoid  │      │ image/video/neg  │
└──────┬──────┘      └────────┬────────┘      └────────┬─────────┘
       │                      │                        │
       └──────────────────────┼────────────────────────┘
                              ▼
                 ┌────────────────────────┐
                 │ unified-shot-prompt    │
                 │ storyboard-continuity  │
                 │ shot-character-        │
                 │   continuity           │
                 └────────────┬───────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ Frame / video      │          │ continuity-check │
    │ generation         │          │ -ai (batch)      │
    └──────────────────┘          └────────┬─────────┘
                                           │
                                           ▼
                              continuity_last_issues
                              memory append
```

---

## Layers

### 1. Production Bible (`continuity_memory`)

Free-form text on `creative_projects`. Stores durable facts:

- Wardrobe locks (“Mara always wears red scarf”)
- Geography (“Warehouse is east wing only”)
- Tone rules (“No comedy beats in Act II”)
- AI-appended lines from continuity check (`memoryAppend`)

**Writers:** User (Director page), Project Guide (approved suggestions), continuity check AI.

**Readers:** Shot generation, unified prompts, Project Guide context, continuity check.

### 2. Director Bible (`director` JSON)

Structured creative direction: `style`, `tone`, `camera_preferences`, `lighting_style`, `pacing`, `name`.

Formatted for prompts via `buildDirectorBibleBlock` / `formatDirectorForAiPrompt`.

Continuity check compares shot prompts against director fields.

### 3. Character Locks (`creative_characters`)

Per-character continuity fields:

| Field | Continuity role |
|-------|-----------------|
| `appearance_description` | Visual anchor |
| `signature_details` | Recurring props/tics |
| `avoid_description` | Merged into STRICT EXCLUSIONS |
| `personality` | Performance tone |
| `voice_description` | Audio/delivery (video policy) |

Portraits in `project_assets` provide vision reference — not a second bible.

### 4. Prompt Assembly (`lib/unified-shot-prompt.ts`)

`resolveFrameGenerationPrompt` / `resolveVideoGenerationPrompt` build production prompts:

1. Director bible block
2. Cast bible or per-shot character lock (`buildCharacterLockForShot`)
3. Scene context (title, summary)
4. Panel index (composition variety)
5. Continuity memory excerpt
6. Shot-specific staging
7. Negative prompt merge

**Detection:** `promptLooksUnified()` avoids double-wrapping already-unified prompts.

### 5. Cast Resolution (`lib/shot-character-continuity.ts`)

Determines which characters appear in a shot:

- Name matching in shot text (`castNameAppearsInText`)
- Scene summary fallback
- Small cast heuristic (≤6 → all characters in scope)
- Portrait URL collection for vision models

**Target:** Replace name grep with explicit `shot ↔ character` relations.

### 6. Negative Prompt System

| Source | Module |
|--------|--------|
| Standard storyboard negatives | `STANDARD_STORYBOARD_NEGATIVES` |
| Animal-only casts | `ANIMAL_ONLY_NEGATIVE_PROMPT` |
| Per-character avoid | `buildProjectNegativePrompt` |
| Shot-level | `creative_shots.negative_prompt` |
| Video-specific | `lib/video-negative-prompt.ts` |

Merged deduplicated via `mergeNegativePromptParts`.

### 7. AI Continuity Check (`server/utils/continuity-check-ai.ts`)

**Role:** Film continuity supervisor for a **batch of generated shots** in one scene.

**Input:**

```typescript
{
  shots: GeneratedShot[]
  continuityMemory: string
  director: ProjectDirector | null
  sceneTitle: string
  charactersSummary: string
}
```

**Output:**

```typescript
{
  issues: string[]           // human-readable bullets
  shots: GeneratedShot[]     // repaired list
  memoryAppend: string       // new facts for continuity_memory
}
```

**Rules (system prompt):**

- Return unchanged shots if already consistent
- Minimal fixes — adjust prompts/descriptions, not wholesale rewrites
- Preserve negative prompts (especially animal casts)
- Append only factual lines to memory

Runs during shot generation after `enrich-generated-shots`. Results surface in `continuity_last_issues` on the project.

---

## Continuity Invariants

These should hold for every generated frame and clip:

| Invariant | Enforcement |
|-----------|-------------|
| One panel per storyboard frame | `SINGLE_STORYBOARD_FRAME_DIRECTIVE` |
| Cast names canonicalized | `cast-name-convention.ts` |
| No duplicate bible blocks | `dedupeJoinBlocks` in unified prompt |
| Animal stories exclude humans | `isAnimalOnlyCast` + negatives |
| Character avoid lists honored | Per-character merge into exclusions |
| Director tone respected | Bible block + continuity check |

---

## User-Facing Surfaces

| Surface | Continuity feature |
|---------|-------------------|
| Director page | Edit `continuity_memory`, run checks, view `continuity_last_issues` |
| Characters | Appearance, avoid, signature fields |
| Storyboard | Unified prompts on generate; per-shot negatives |
| Video | Prefill from shot; video negatives |
| Project Guide | Discuss continuity; suggest `continuityMemory` updates |

---

## Continuity Engine v2 (Roadmap)

| Capability | Description |
|------------|-------------|
| **Fact graph** | Extract typed facts from memory + characters (wardrobe, location, time) |
| **Cross-scene validation** | Act-wide reports, not only per-scene batch |
| **Incremental check** | On single shot edit, validate neighbors only |
| **Issue → shot links** | `continuity_last_issues` references `shot_id` for one-click fix |
| **Approval queue** | Memory appends from AI require user accept |
| **Regression tests** | Golden prompts: given bible X + shot Y, assert prompt contains Z |

---

## Implementation Guidelines

**Do:**

- Add new continuity rules to `storyboard-continuity-prompts.ts` or `shot-character-continuity.ts`
- Thread `continuityMemory` through every new generation path
- Log issues to `continuity_last_issues` when running batch check

**Don't:**

- Embed character appearance only in shot rows without updating character entity
- Skip continuity check on large scene imports “for speed”
- Append unbounded memory without user visibility (show diff before save)

---

## Key Files

| Path | Role |
|------|------|
| `lib/unified-shot-prompt.ts` | Prompt assembly |
| `lib/storyboard-continuity-prompts.ts` | Bible blocks, negatives |
| `lib/shot-character-continuity.ts` | Cast-in-shot resolution |
| `lib/character-visual-description.ts` | Cast line formatting |
| `lib/video-negative-prompt.ts` | Video exclusions |
| `server/utils/continuity-check-ai.ts` | Batch AI supervisor |
| `server/utils/enrich-generated-shots.ts` | Post-process generated shots |
| `types/creative-project.ts` | `continuityMemory` types |

---

## Related Documents

- [DirectorAI.md](./DirectorAI.md)
- [AIWorkflows.md](./AIWorkflows.md)
- [Database.md](./Database.md)
- [Roadmap.md](./Roadmap.md) — Phase 3
