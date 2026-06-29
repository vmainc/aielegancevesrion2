# AI Elegance — Director AI

Director AI is the creative intelligence layer that holds **taste, tone, and rules** for a project — and helps the filmmaker refine them over time. It combines the **Director Bible** (structured presets) with the **Project Guide** (conversational copilot).

AI Elegance treats the director not as a metadata tag but as a **persistent creative authority** that every generation path respects.

---

## Components

```
┌─────────────────────────────────────────────────────────┐
│                     Director AI                          │
├─────────────────────┬───────────────────────────────────┤
│  Director Bible     │  Project Guide                     │
│  (structured JSON)  │  (chat + suggestions)            │
│  director.vue       │  guide.vue                         │
├─────────────────────┴───────────────────────────────────┤
│  Prompt assembly · continuity check · shot enrichment    │
│  unified-shot-prompt · continuity-check-ai · guide-ai    │
└─────────────────────────────────────────────────────────┘
```

---

## Director Bible

### Data model

Stored on `creative_projects.director` as JSON:

```typescript
interface ProjectDirector {
  name: string
  style: string
  tone: string
  camera_preferences: string
  lighting_style: string
  pacing: string
}
```

TypeScript: `types/creative-project.ts`  
Parsing: `parseDirectorField` in `server/utils/creative-project-map.ts`

### UI (`pages/projects/[projectId]/director.vue`)

- **Presets** from `lib/director-presets.ts` — one-click starting points (documentary, noir, etc.)
- Editable fields with **Prompt enhance** for AI-assisted rewrites
- **Continuity memory** textarea — free-form production bible
- Continuity check triggers and last issues display

The Director step is early in workflow (`lib/project-workflow.ts`) so downstream generation inherits taste before cast and storyboard work.

### Prompt injection

`buildDirectorBibleBlock` emits a labeled block consumed by:

- `resolveFrameGenerationPrompt` / `resolveVideoGenerationPrompt`
- Shot list generation enrichment
- Continuity check AI (director summary in system context)
- Project Guide context (`formatDirectorForAiPrompt`)

Example block structure:

```
DIRECTOR BIBLE
Style: ...
Tone: ...
Camera: ...
Lighting: ...
Pacing: ...
```

**Invariant:** Any new image or video generation path must include director bible when `director` is set.

---

## Project Guide

### Role

The Guide is a **film pre-production copilot** embedded in the project. It:

1. Answers questions using loaded project context (story, cast, scenes)
2. Discusses continuity, motivation, tone, pacing
3. Proposes **structured updates** the user explicitly approves
4. Never silently mutates the database

### UI (`pages/projects/[projectId]/guide.vue`)

- Chat interface with starter prompts
- Suggestion cards per proposed field change
- Apply → PATCH `creative_projects`, `director` sub-fields, or `creative_characters`
- Requires cloud project (PocketBase); not available for local-only demos

### API

`POST /api/projects/[id]/guide`

**Pipeline:**

1. `loadProjectGuideContext` — project block, characters block, scenes block (truncated excerpts)
2. `buildProjectGuideSystemPrompt` — role, rules, allowed fields, JSON output format
3. OpenRouter chat completion
4. `parseProjectGuideResponse` — `{ reply, suggestions[] }`

### Allowed suggestion targets

| Target | Fields |
|--------|--------|
| `project` | `synopsis`, `treatment`, `conceptNotes`, `genre`, `tone`, `continuityMemory` |
| `director` | `style`, `tone`, `camera_preferences`, `lighting_style`, `pacing` |
| `character` | `roleDescription`, `appearanceDescription`, `personality`, `voiceDescription`, `signatureDetails`, `avoidDescription` |

Character suggestions must include `characterId` from context (or `characterName` for resolution).

### Suggestion shape

```typescript
type GuideSuggestion = {
  id: string
  target: 'project' | 'character' | 'director'
  field: string
  value: string        // full new field text
  label: string
  rationale: string
  characterId?: string
  characterName?: string
}
```

Labels mapped via `GUIDE_FIELD_LABELS` in `lib/project-guide.ts`.

### Chat persistence (current vs target)

| | Current | Target |
|---|---------|--------|
| Storage | `localStorage` (`PROJECT_GUIDE_STORAGE_PREFIX`) | PocketBase `guide_messages` |
| Limit | Last 80 messages | Full history + search |
| Sync | Per browser | Per user, per project |

---

## Director AI in Generation Pipelines

Director AI influence extends beyond the Guide chat:

| Pipeline | Director input |
|----------|----------------|
| Shot generation | Director JSON in LLM context; enriched into unified prompts |
| Continuity check | Director summary compared against shot prompts |
| Storyboard frames | `DIRECTOR BIBLE` block in image prompt |
| Video | Director-aware video prompt resolution |
| Prompt enhance | `context: director` on bible fields |

---

## Creative Partner Behaviors

Director AI should behave as a **partner**, not an autofill machine:

### Do

- Ground answers in loaded context; label creative leaps as suggestions
- Propose bible updates only when the user decides or asks
- Keep replies concise (2–6 paragraphs unless depth requested)
- Tie suggestions to rationale (“locks Mara's look for storyboard”)

### Don't

- Invent cast members not in context without marking as new character proposal
- Auto-apply suggestions without user click
- Replace the filmmaker's voice — refine and structure it
- Dump raw JSON in the conversational `reply` field

---

## Relationship to Continuity Engine

| Director AI | Continuity Engine |
|-------------|-------------------|
| Sets creative rules | Enforces rules across shots |
| `director` JSON + user intent | `continuity_memory` + character locks |
| Guide suggests bible edits | Check AI repairs shot lists |
| Subjective (“more melancholy”) | Objective (“scarf was red in shot 4”) |

Guide updates to `continuityMemory` feed directly into continuity check and unified prompts.

---

## Evolution: Unified Director AI

Roadmap consolidates Guide + continuity supervisor + proactive review:

1. **Single context graph** — same loader for Guide, shot gen, continuity
2. **Proactive notes** — “Scene 12 shots drift from noir preset” before user asks
3. **Shot-level suggestions** — Guide proposes prompt diffs on specific `shot_id`
4. **Decision audit** — every applied suggestion → `creative_decisions` log
5. **Director versioning** — snapshot director JSON before major AI rewrites

---

## Key Files

| Path | Role |
|------|------|
| `pages/projects/[projectId]/director.vue` | Bible UI |
| `pages/projects/[projectId]/guide.vue` | Guide chat UI |
| `lib/director-presets.ts` | Preset definitions |
| `lib/project-guide.ts` | Types, storage, field labels |
| `server/utils/project-guide-context.ts` | Context loader |
| `server/utils/project-guide-ai.ts` | System prompt + response parser |
| `server/api/projects/[id]/guide.post.ts` | API endpoint |
| `lib/unified-shot-prompt.ts` | Director block in generation |

---

## Related Documents

- [Vision.md](./Vision.md) — Principle 7: AI as creative partner
- [ContinuityEngine.md](./ContinuityEngine.md)
- [AIWorkflows.md](./AIWorkflows.md)
- [Database.md](./Database.md) — `director`, `continuity_memory` fields
