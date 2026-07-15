# AI Elegance — Architecture

This document describes how the application is structured today and the patterns we extend as the Film OS grows.

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Nuxt 3, Vue 3, Tailwind CSS |
| API | Nitro server routes (`server/api/`) |
| Database | PocketBase (SQLite-backed, self-hosted) |
| AI | OpenRouter (chat, image, video models) |
| Auth | PocketBase `users` collection |

The browser talks to Nuxt (`:3000`). Server routes use a **superuser-authenticated** PocketBase client for privileged reads/writes. Collection API rules enforce per-user ownership via `owned_by`.

---

## High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Project Workspace                         │
│  home · story · director · characters · scenes · storyboard     │
│  · video · guide                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌───────────┐      ┌─────────────┐     ┌──────────────┐
   │ PocketBase │      │  lib/       │     │ server/      │
   │ collections│◄────│  shared     │────►│ utils + api  │
   └───────────┘      │  prompt &   │     │ AI jobs      │
                      │  continuity │     └──────┬───────┘
                      └─────────────┘            │
                                                 ▼
                                          ┌──────────────┐
                                          │  OpenRouter  │
                                          └──────────────┘
```

---

## Domain Model (Logical)

```
User
 └── CreativeProject
      ├── director (JSON bible)
      ├── continuity_memory, continuity_last_issues
      ├── CreativeScene[] (ordered)
      │    └── CreativeShot[] (ordered)
      ├── CreativeCharacter[]
      └── ProjectAsset[] (script, character, storyboard, video, other)
```

**Characters are project-scoped today.** The long-term model may introduce studio-level character libraries referenced by ID; until then, `creative_characters.project` is the canonical parent.

---

## Application Layers

### 1. Pages & workspace (`pages/projects/[projectId]/`)

`ProjectWorkspaceLayout.vue` drives the sidebar workflow:

| Step | Path | Purpose |
|------|------|---------|
| Overview | `home` | Project dashboard |
| Story | `overview` | Synopsis, treatment, concept, script import |
| Director | `director` | Director bible presets and continuity notes |
| Script | `story` | Screenplay editing (import workflow) |
| Characters | `characters` | Cast table + per-character profiles |
| Scenes | `scenes` | Structured scene list |
| Storyboard | `storyboard` | Shot boards, frame generation |
| Video | `video` | Clip generation from shots |
| Tool | `guide` | Project Guide (AI copilot) |

Workflow paths adapt by `workflow_mode` (`import` | `idea` | `generate`) — see `lib/project-workflow.ts`.

### 2. Shared libraries (`lib/`)

Pure TypeScript used on **client and server**. Critical modules:

| Module | Responsibility |
|--------|----------------|
| `unified-shot-prompt.ts` | Assembles production prompts from director + cast + shot + continuity |
| `storyboard-continuity-prompts.ts` | Cast bible blocks, negatives, animal-only rules |
| `shot-character-continuity.ts` | Resolve which characters appear in a shot; portrait collection |
| `character-visual-description.ts` | Format cast lines for image/video models |
| `project-guide.ts` | Guide chat types; client-side message storage (transitional) |
| `project-workflow.ts` | Workflow path resolution |

**Rule:** Prompt and continuity logic lives in `lib/`, not duplicated in Vue components or API handlers.

### 3. Server (`server/api/`, `server/utils/`)

- **CRUD** for projects, scenes, shots, characters, assets
- **AI orchestration** — script import, shot generation jobs, continuity check, guide replies, video generation
- **Mappers** — `creative-project-map`, `creative-character-map`, `creative-shot-map`, `project-asset-map` translate PocketBase records ↔ TypeScript types

Long-running work uses **job registries** (e.g. `generate-shots-job-registry`, `video-generation-job-registry`, `script-import-job-registry`) polled by the client.

### 4. Types (`types/`)

- `creative-project.ts` — `CreativeProject`, `CreativeCharacter`, `ProjectDirector`
- `creative-shot.ts` — `CreativeShot`

Types are the contract between UI, API, and AI pipelines.

### 5. Composables (`composables/`)

Vue state and hydration: `useCreativeProject`, `useProjectScenesHydration`, `useProjectCharacterRefs`, `useOpenRouterVideoGen`, etc.

---

## Context Assembly Pattern

Every AI feature should build context through a **single loader** per domain:

```
loadProjectGuideContext()     → project + characters + scenes text blocks
project-character-prompt-refs → cast + portrait assets for generation
UnifiedShotPromptContext      → director + continuity + cast + shot + scene
```

New features **add fields to these loaders**, not parallel context builders.

---

## Generation Pipeline (Simplified)

```
Script / concept
    → import-script-core / bootstrap-project-from-concept
    → creative_scenes + creative_characters
    → generate-shots (per scene, async job)
    → continuity-check-ai (optional repair + memory append)
    → creative_shots persisted
    → storyboard frame generation (unified-shot-prompt + portraits)
    → video generation (prefill from shot + start frame)
    → project_assets
```

Each stage reads upstream structured data. Downstream stages never invent cast or plot facts.

---

## Security & Multi-Tenancy

- All creative collections use `owned_by` → `users`
- API routes verify `pbRecordOwnerId` matches the authenticated user
- OpenRouter keys stay server-side (`server-env`)
- PocketBase admin credentials are server-only

---

## Scalability Considerations (Thousands of Shots)

| Concern | Current | Target |
|---------|---------|--------|
| Shot list loading | Per-scene fetch | Paginated / virtualized boards |
| AI context size | Truncated excerpts in guide | Hierarchical summaries + retrieval |
| Asset storage | PocketBase files + metadata | Object storage + indexed relations |
| Generation jobs | In-memory registries | Durable job table with retry |
| Continuity | Per-scene batch check | Incremental + cross-scene graph |

---

## Extension Points

When adding a feature, prefer:

1. **New fields on existing entities** over new parallel collections
2. **Relations** over duplicated strings
3. **`lib/` helpers** over inline prompt strings in Vue
4. **Structured AI JSON output** with user-approved patches (Guide pattern)
5. **Metadata schema conventions** on `project_assets` until formal relations exist

---

## Related Documents

- [Database.md](./Database.md)
- [AIWorkflows.md](./AIWorkflows.md)
- [ContinuityEngine.md](./ContinuityEngine.md)
- [DirectorAI.md](./DirectorAI.md)
- [Roadmap.md](./Roadmap.md)
