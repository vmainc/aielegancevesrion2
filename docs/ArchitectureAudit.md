# AI Elegance — Architecture Audit

**Date:** 2026-06-29  
**Scope:** Complete read of `server/` (77 API routes, 64 utils), `lib/` (65 files), `composables/` (15), `types/` (7), `pages/`, and `components/`.  
**Status:** Findings only. No implementation proposed. This is a diagnostic baseline for prioritizing the [Roadmap](./Roadmap.md).

---

## How to read this document

- **Part I** — module-by-module audit (purpose, strengths, weaknesses, duplication, missing relationships, scalability).
- **Part II** — answers to the seven domain questions.
- **Part III** — consolidated technical-debt register, ranked.

Claims below are grounded in specific files; representative paths are cited inline.

---

# Part I — Module Audit

## 1. Data layer (PocketBase + mappers)

**Purpose.** PocketBase is the system of record: `creative_projects`, `creative_scenes`, `creative_characters`, `creative_shots`, `project_assets`, plus `creative_scripts` (Script Wizard). Server routes use an **admin-authenticated** PB client and re-check ownership in code.

**Strengths.**
- Clear parent/child cascade: project → scenes → shots, project → characters/assets.
- Per-entity mappers isolate PB record shape from TS types (`creative-project-map.ts`, `creative-character-map.ts`, `creative-shot-map.ts`, `project-asset-map.ts`).
- Owner-scoped API rules exist on all creative collections.

**Weaknesses.**
- **No scene mapper.** Scenes are read as raw `Record<string, unknown>` everywhere (`scene.heading`, `scene.summary`, `scene.body`) — the one core entity with no typed boundary.
- **Field-name drift is tolerated, not fixed.** `creative-shot-map.ts` dual-reads `sort_order`/`sortOrder`, `shot_type`/`shotType`, `image_prompt`/`imagePrompt`, etc.; `persist-scene-shots.ts` even retries a create with the alternate casing on validation failure. This means two write conventions exist in production data.
- **Owner field ambiguity.** `pb-record-owner.ts` reads `owned_by ?? owner ?? user`; call sites cast to three different shapes (`{owner,user}`, `{owned_by}`). Schema says `owned_by`; legacy rows may differ.
- **Repeated ad-hoc parsing.** "relation may be string-or-object", "metadata may be string-or-object", "director may be string-or-object" are each re-implemented in 3–4 places rather than centralized.

**Duplicate functionality.** Relation-id extraction reducer duplicated across shot map, character map, asset map, `list-project-assets-pb.ts`. Metadata JSON parsing duplicated in `project-asset-map.ts`, `creative-script-map.ts`, `import-script-core.ts`, `project-character-prompt-refs.ts`.

**Missing relationships.** `creative_shots` ↔ `creative_characters` (no junction; resolved by name grep). Asset ↔ scene/shot/character (lives in free-form `metadata`). Scene ↔ characters-present. Script asset ↔ project version history.

**Scalability concerns.** SQLite single-file; large video blobs in PB file storage; no shot pagination; JSON `metadata` is not indexable for "all assets for shot X" at scale.

---

## 2. Prompt assembly & continuity (`lib/`)

**Purpose.** Turn structured story data (director bible + cast bibles + scene + shot + continuity memory) into production prompts for image and video models.

**Strengths.**
- `lib/unified-shot-prompt.ts` is a genuinely good idea: one builder producing labeled blocks (`DIRECTOR BIBLE`, `FULL CAST BIBLE`, `STILL FRAME FOR THIS PANEL`, `STRICT EXCLUSIONS`), with `promptLooksUnified()` to avoid double-wrapping.
- Negative-prompt system handles real edge cases (animal-only casts, per-character avoid lists).
- Cast-name canonicalization (`cast-name-convention.ts`) is shared.

**Weaknesses — this is the most tangled area of the codebase.**
- **Two parallel prompt stacks.** `lib/unified-shot-prompt.ts` AND `lib/shot-character-continuity.ts` (`buildFullVideoGenerationPrompt`, `buildStoryboardFramePrompt`, `buildCastBibleBlock`, `buildContinuityPromptBlock`) both assemble director+cast+continuity, split along image-vs-video lines.
- **A real name collision:** `resolveVideoGenerationPrompt` is exported from **both** `lib/unified-shot-prompt.ts` (line 206) and `lib/video-generation-audio-policy.ts` (line 96) with different signatures.
- **Prompts are built twice for shots.** `generate-shots-ai.ts` instructs the model to produce long prompts, then `enrich-generated-shots.ts` overwrites them via `applyUnifiedPromptsToShot` — and that enrichment is invoked in two places (`generate-shots-ai.ts` and `execute-generate-shots.ts`).
- **Four director-bible formatters:** `formatDirectorForAiPrompt` (project map), `formatDirectorForPrompt` (shot-character-continuity), `buildDirectorBibleBlock` (storyboard-continuity-prompts), plus inline blocks in `generate-shots-ai.ts` and `continuity-check-ai.ts`.
- **Three+ negative-prompt builders:** `storyboard-continuity-prompts.ts` (image), `video-negative-prompt.ts` (video, partly `@deprecated`), `server/utils/openrouter-video-negative.ts` (provider passthrough), plus inline animal rules in `generate-shots-ai.ts`.

**Duplicate functionality.** See above — director formatting (×5), negative prompts (×4), cast-bible blocks (×2), cast-in-shot resolution (`findCharactersInShot` client vs `castMembersInShot` server).

**Missing relationships.** Prompt logic depends on resolving "which characters are in this shot," but there is no stored answer — it is recomputed by string matching every time.

**Scalability concerns.** Each prompt bakes the **full** cast/director bible into stored shot text (see §Database). Recomputing cast membership by regex for thousands of shots is O(shots × cast) on every render/generate.

---

## 3. AI orchestration (`server/utils/`, `server/api/generate*`, jobs)

**Purpose.** Drive OpenRouter for concept, script import, scene breakdown, shot generation, continuity, guide, image/video/music.

**Strengths.**
- Async jobs decouple long generations from requests (`generate-shots`, `script-import`, `video-generation`, `music`).
- `buildOpenRouterChatCompletionBody` is shared.
- Script-import AI is sophisticated (fence/`<thinking>` stripping, mention-based screen-share).

**Weaknesses.**
- **All four job registries are in-memory `Map`s in module scope** — lost on restart, not shared across processes/instances, fire-and-forget `void runX()`. This is fine for one node, fragile for production scale or multi-instance.
- **The Continuity Engine's core is dead code.** `continuity-check-ai.ts` (`checkShotsContinuity`) is fully implemented but **never imported** outside docs. `execute-generate-shots.ts` returns a hardcoded `continuity: { issueCount: 0, memoryUpdated: false }` and never runs the check. The AI-generated `continuity_memory_append` is therefore never persisted.
- **Five separate JSON-from-AI extractors** (`generate-shots-ai`, `continuity-check-ai`, `generate-concept-ai`, `project-guide-ai`, `script-import-ai`) each re-implement "parse, else slice braces."
- **OpenRouter fetch boilerplate** (headers, AbortController, `choices[0].message.content`) copy-pasted across 6+ call sites.
- **~30-line ownership + scene-belongs-to-project + missing-collection preamble** duplicated across `execute-generate-shots`, `analyze-project-scene`, `import-script-core` (×5), `bootstrap-project-from-concept`, `project-video-panel-prefill`, `project-guide-context`.

**Duplicate functionality.** Cast/portrait resolution implemented at least 4× server-side (`loadCastMembersForContinuity`, `loadProjectCharacterRefs`, `listProjectCastNames`, plus client `findCharactersInShot`). Heuristic character-name filtering split across `parse-script-txt.ts` and `lib/screenplay-character-filter.ts`.

**Missing relationships.** Generation jobs are not persisted records, so a finished clip has no durable link to the job, model, prompt, or shot beyond best-effort `metadata`.

**Scalability concerns.** In-memory registries + admin-only PB connection (every call funnels through one cached admin auth). Unbounded AI context (full bibles inlined) will hit token limits well before "thousands of shots."

---

## 4. Auth & multi-tenancy

**Purpose.** Tie all data to a user; prevent cross-tenant access.

**Strengths.** Canonical pattern is consistent for CRUD: validate PB JWT → admin client → `pbRecordOwnerId(record) !== userId → 403`.

**Weaknesses.**
- **No auth on `generate/image.post.ts`, `generate/video.post.ts`, `generate-character.post.ts`.** Anyone hitting these spends OpenRouter credits.
- **Video job has no user binding:** `generate/video/status.get.ts` takes a job by `?jobId=` only; registry entry has no `userId`.
- **Music auth is optional** (`.catch(() => null)`), status route doesn't enforce it.
- **`reorder.patch.ts`** checks project ownership but not the shots' owner.
- **`prompt/enhance.post.ts`** checks ownership only opportunistically inside a try/catch (failure silently downgrades the model, doesn't block).

**Scalability concerns.** Because the server uses the admin connection, PB collection rules are bypassed and every new route must remember to re-check ownership — a standing footgun as route count grows.

---

## 5. Frontend workspace (`pages/projects/[projectId]/`)

**Purpose.** Guide the user through story → director → cast → scenes → storyboard → video → timeline.

**Strengths.** Coherent sidebar workflow; `home.vue` dashboard; deep-link hydration via `useCreativeProject`.

**Weaknesses.**
- **Confusing label swap:** sidebar maps `overview` → "Story" and `story` → "Script" (`ProjectWorkspaceLayout.vue` `sectionLabels`). Recurs across files.
- **`overview.vue` is ~1,675 lines** combining concept generation, idea analysis, script import, and director analysis behind mutually-exclusive `v-if` branches (including a dead `v-if="false"` block).
- **`guide` and `cast/[characterId]` are off the numbered workflow** — guide is a "Tools" item; cast pages are reachable only via deep links. `workflowStepOf` returns null for guide.
- **Step labels rendered inconsistently** (scenes/storyboard hardcode labels instead of `stepBadge`).

**Duplicate functionality.** Portrait-resolution logic implemented 3× (`characters.vue`, `useProjectCharacterRefs.ts`, `cast/[characterId].vue`), each with its own id/name/featured/timestamp tie-break. Image compression (`maybeCompressImageBlob`/`blobToDataUrl`/`canvasToBlob`) duplicated across `character-creator.vue`, `storyboard.vue`, `cast/[characterId].vue`.

**Missing relationships.** Storyboard cast chips are name-matched, not stored edges. Video step leaves the workspace entirely (deep-links to `/tools/video-generation`) and returns by query param.

---

## 6. Standalone tools vs in-project (`pages/tools/*`, `character-creator`, `assets/*`)

**Purpose.** Provide tool-first entry points (video gen, music, script wizard, storyboard builder, character creator) alongside the project workflow.

**Weaknesses / duplication.**
- **Script workflow exists twice:** Script Wizard (`creative_scripts` + hidden "library project") vs in-project import (`creative_projects` + script assets). Both produce synopsis/treatment/three-act/comparable-films. Comparable films render in **three** places.
- **Character creation exists 2–3×:** `character-creator.vue`, `characters.vue`, `cast/[characterId].vue` all generate + save portraits and re-implement resolve-or-create-by-name; `AssetKindHub.vue` has a third copy of resolve-or-create + upload.
- **Hidden "library projects"** back both Script Wizard and Storyboard Builder, producing semi-orphaned data outside the normal project list until "Open as project."

**Missing relationships / disconnection.**
- Standalone video/music saves land in the asset library with `source: 'standalone_*_tool'` and **no `scene_id`/`shot_id`** — never linked to a storyboard panel.
- Character Creator "Save on this device" writes `localStorage` (`aielegance-character-library`) with no graph link.
- No music step in the workflow; tracks reach a film only by manual timeline placement.

---

## 7. Timeline editor (`lib/timeline-editor/*`, `types/timeline-editor.ts`)

**Purpose.** Non-destructive assembly NLE (clips, trims, transitions, audio track).

**Strengths.** Clean document model (`TimelineEditorDocument`, `TimelineEditorClip`), geometry/history/blend/export modules separated.

**Weaknesses — most disconnected subsystem.**
- **The entire edit document lives only in `localStorage`** (`aie_timeline_editor_v2_<id>`, `lib/timeline-editor/storage.ts`). Nothing persists to PocketBase.
- Clips carry **optional** `sceneId`/`shotId` tags (soft links), but the timeline itself is not a story-graph entity.
- Moving an asset to another project (`/api/assets/:id/move`) explicitly does **not** update placed clips; removing a clip doesn't touch assets.

**Missing relationships.** Timeline ↔ project (only via localStorage key). Clip ↔ shot (optional tag, not enforced). No server-side render record.

**Scalability concerns.** A feature film's cut cannot live in browser localStorage; no collaboration, no device portability, no backup.

---

## 8. Composables & client state

**Purpose.** Hydrate and cache project/character/scene state for Vue.

**Strengths.** `useCreativeProject` cleanly distinguishes `source: 'local'` vs `'pocketbase'`.

**Weaknesses.**
- **Browser-only persistence of meaningful state:** guest projects (`aielegance-creative-projects`), Project Guide chat (`PROJECT_GUIDE_STORAGE_PREFIX`, last 80 msgs), timeline docs, character device-library, and a workflow-mode session overlay all live client-side.
- **Workflow mode stored 2–3 ways** (PB `workflow_mode`, session overlay, derived from `conceptNotes`); **target duration stored 2 ways** (PB `target_duration_seconds`, parsed from concept notes markers).
- Five distinct "character" shapes in flight (`CreativeCharacter`, `ProjectCharacterRef`, `CastMemberForContinuity`, `CharacterVisualPromptInput`, anonymous cast member) with `roleDescription`↔`traitsRoleVisual` renamed across boundaries.

---

# Part II — Domain Questions

## 1. What is the current domain model?

```
User (PB auth)
 └── CreativeProject
      ├── director: ProjectDirector            (JSON blob, not an entity)
      ├── continuity_memory / last_issues      (free text)
      ├── synopsis / treatment / concept_notes (free text)
      ├── workflow_mode / target_length / duration
      ├── CreativeScene[]   (sort_order; heading/summary/body — UNTYPED on server)
      │     └── CreativeShot[] (sort_order; type/move/duration; image/video/negative prompts)
      ├── CreativeCharacter[] (name + appearance/personality/voice/signature/avoid + screen_share)
      └── ProjectAsset[] (kind: script|character|storyboard|video|other; metadata JSON)

Parallel / loosely attached:
 • CreativeScript (Script Wizard; optional project link)
 • TimelineEditorDocument (localStorage only; clips soft-tag scene/shot)
 • Character device-library, Guide chat (localStorage)
```

It is a **tree (project → scenes → shots)** with characters and assets as side-children. Cross-cutting relationships (shot↔character, asset↔shot) are **implied by text/metadata, not modeled as edges**. The model is structured at the top, denormalized-to-text at the leaves.

## 2. What objects currently exist?

**First-class PB collections:** `creative_projects`, `creative_scenes`, `creative_characters`, `creative_shots`, `project_assets`, `creative_scripts`, `users`.

**Implicit/embedded objects (not collections):** Director bible (JSON on project), continuity memory (text), generation jobs (in-memory Maps), timeline document (localStorage), guide conversation (localStorage), staged media (file stores under `.data/`), character device-library (localStorage), comparable films (transient).

## 3. Which objects should become first-class entities?

Ranked by leverage against the Vision principles (not implementation — just identification):

1. **Scene** — already a collection but has no server type/mapper and lacks structured fields (location, time-of-day, characters-present). It is the weakest "structured" entity.
2. **Shot↔Character relationship** — currently inferred by name grep; the single highest-value missing entity (a junction).
3. **Generation job / asset provenance** — jobs are ephemeral; a durable record would give every asset a traceable origin (model, prompt, shot).
4. **Timeline / cut** — must leave localStorage to be a film artifact.
5. **Creative decision / bible-edit log** — needed for "remember decisions forever" and Guide audit.
6. **Director bible** — promote from JSON blob toward a versioned entity (enables history/A-B).
7. **Continuity fact** — extract typed facts from `continuity_memory` so checks can target them.

## 4. What data is duplicated?

**In stored data:**
- **Cast appearance + director bible baked into every shot's prompt text** (denormalization of the worst kind — editing a character does not update existing shot prompts).
- **Workflow mode** (3 representations) and **target duration** (2 representations).
- **Comparable films** surfaced/stored in 3 UI paths.
- **Script content** can exist as both a `creative_scripts` row and project script assets.
- **Snake/camel field variants** coexist in shot rows due to dual-write tolerance.

**In code (logic duplication):**
- JSON-from-AI extractor (×5), director formatter (×5), negative-prompt builder (×4), cast/portrait resolver (×4), prompt-assembly stacks (×2 + collision), ownership preamble (×7+), OpenRouter fetch boilerplate (×6+), image-compression helpers (×3), portrait-resolution (×3).

## 5. What relationships are missing?

| Missing edge | Today's substitute | Cost |
|---|---|---|
| Shot ↔ Character | name matching in shot text | recomputed constantly; breaks on rename |
| Asset ↔ Shot/Scene/Character | free-form `metadata` JSON, matched by name | orphan assets; not queryable at scale |
| Scene ↔ Characters-present | none | AI re-derives every time |
| Timeline clip ↔ Shot | optional `shotId` tag in localStorage | not enforced, not persisted |
| Generation job ↔ Asset/Shot | ephemeral in-memory | no provenance after restart |
| Decision/edit ↔ Entity | none | no audit; "why is the scarf red?" unanswerable |
| Script version ↔ Project | parallel `creative_scripts` silo | divergent story source of truth |
| Character (studio) ↔ Projects | project-scoped only | no reuse across films |

## 6. What parts of the application feel disconnected?

- **Timeline editor** — localStorage-only; the cut is invisible to the rest of the system.
- **Standalone tools** (video, music, script wizard, storyboard builder, character creator) — produce data that is orphaned or only re-linked by name/metadata; some use hidden "library projects."
- **Project Guide** — reads rich context and proposes good suggestions, but is **off the numbered workflow**, stores chat in localStorage, and only writes via the user manually applying suggestions.
- **Continuity Engine** — documented and partly built, but the AI check is **dead code**; memory is written only by manual edits.
- **Music** — no workflow step; reaches a film only by manual timeline placement.
- **Cast profile pages** — not in any sidebar; reachable only by deep link.

## 7. What technical debt should be addressed before building new features?

See the ranked register in Part III. The headline items: collapse the duplicate prompt stacks (incl. the export collision), give scenes a real type/mapper, replace name-grep shot↔character matching with a stored relationship, move timeline + guide chat out of localStorage, wire up (or remove) the dead continuity check, add auth to the open generation endpoints, and replace in-memory job registries with durable records.

---

# Part III — Technical-Debt Register (ranked)

Ranked by **risk × blast-radius** for future feature work. P0 = address before building substantial new features.

### P0 — Foundational / correctness

1. **Dead Continuity Engine.** `checkShotsContinuity` never called; `execute-generate-shots` hardcodes a clean result; AI memory-append never persisted. Either wire it in or delete it — but the docs claim a capability that does not run. (`server/utils/continuity-check-ai.ts`, `execute-generate-shots.ts`)
2. **Unauthenticated generation endpoints.** `generate/image`, `generate/video`, `generate-character` have no user check → uncontrolled OpenRouter spend.
3. **Prompt-stack duplication + name collision.** Two `resolveVideoGenerationPrompt` exports; two parallel builders; prompts built twice. High bug surface; any prompt change must be made in multiple places. (`lib/unified-shot-prompt.ts`, `lib/shot-character-continuity.ts`, `lib/video-generation-audio-policy.ts`)
4. **No scene type/mapper.** The core structural entity is passed around as untyped `Record<string, unknown>`.

### P1 — Relationship & persistence gaps

5. **Shot↔Character by name grep.** Replace inference with a stored relation before shot counts grow.
6. **Asset↔story links in free-form metadata.** Standardize and/or relationalize `shot_id`/`scene_id`/`character_id`.
7. **Timeline + Guide chat in localStorage.** Both are meaningful creative state that should survive device/time.
8. **In-memory job registries.** Not durable, not multi-instance safe; OpenRouter keys held in memory per job.
9. **Redundant state representations.** Workflow mode (×3), target duration (×2) — pick one source of truth.

### P2 — Consistency & maintainability

10. **Duplicated logic:** JSON extractor (×5), director formatter (×5), negative-prompt builder (×4), cast resolver (×4), ownership preamble (×7+), OpenRouter fetch (×6+), image compression (×3), portrait resolution (×3).
11. **Owner-field ambiguity** (`owned_by`/`owner`/`user`) and snake/camel shot dual-write — clean the data convention.
12. **Auth inconsistencies** on reorder, music, prompt-enhance, video job binding.
13. **Admin-connection-bypasses-rules** pattern forces manual ownership checks on every route.

### P3 — UX / structural clarity

14. **`overview.vue` ~1,675 lines** with a dead `v-if="false"` branch — split by workflow mode.
15. **Label swap** (`overview`="Story", `story`="Script") — confusing across the codebase.
16. **Standalone-vs-in-project duplication** (script, character, storyboard) and **hidden "library projects."**
17. **Off-workflow surfaces** (Guide, cast profiles) lack navigation coherence.

---

## Cross-references

- Principles & target state: [Vision.md](./Vision.md)
- Current structure: [Architecture.md](./Architecture.md)
- Schema detail: [Database.md](./Database.md)
- AI touchpoints: [AIWorkflows.md](./AIWorkflows.md)
- Continuity subsystem: [ContinuityEngine.md](./ContinuityEngine.md)
- Director AI: [DirectorAI.md](./DirectorAI.md)
- Phasing: [Roadmap.md](./Roadmap.md) — this audit reorders some priorities (e.g. P0 #1–#4 precede new features)

---

## P0 Remediation Completed (2026-06-29)

The four P0 blockers identified above have been addressed. This section records what changed and how to verify it.

### 1. Continuity Engine is now live

**Problem:** `checkShotsContinuity` was implemented but never called; `execute-generate-shots` returned a hardcoded clean result.

**Files changed:**
- `server/utils/execute-generate-shots.ts` — wires continuity into the pipeline
- `server/utils/persist-continuity-results.ts` — **new** helper for `continuity_memory` / `continuity_last_issues`
- `server/utils/continuity-check-ai.ts` — structured logging on start/complete/skip

**New flow:**

```
generateShotsWithAi (raw model JSON)
  → checkShotsContinuity (AI supervisor; may repair shots + propose memory append)
  → persistContinuityCheckOnProject (writes issues + memory to creative_projects)
  → enrichGeneratedShotsForContinuity (single unified-prompt pass)
  → replaceSceneShots
```

**Logging:** Search server logs for `[execute-generate-shots] continuity check` and `[continuity-check-ai]`.

**Note:** `import-storyboard-seed.ts` still skips continuity for import speed (documented); it now calls enrich explicitly after raw generation.

### 2. Prompt assembly collision resolved

**Problem:** Two different functions named `resolveVideoGenerationPrompt`; shot prompts enriched twice (in `generate-shots-ai` and again in `execute-generate-shots`).

**Difference between the two exports:**

| Function | Module | Purpose |
|----------|--------|---------|
| `resolveVideoGenerationPrompt(shot, ctx)` | `lib/unified-shot-prompt.ts` | Assembles production still + motion from shot + director + cast |
| `resolveVideoGenerationUserPrompt(opts)` | `lib/video-generation-audio-policy.ts` | Merges user-typed dialogue/ambient lines into a form prompt before API call |

**Files changed:**
- `lib/video-generation-audio-policy.ts` — renamed to `resolveVideoGenerationUserPrompt`; deprecated alias kept
- `pages/tools/video-generation.vue` — uses new name
- `server/utils/generate-shots-ai.ts` — removed `enrichGeneratedShotsForContinuity` (enrich runs once downstream)
- `server/utils/import-storyboard-seed.ts` — explicit single enrich after raw generation

### 3. Generation endpoints require authentication

**Problem:** `generate/image`, `generate/video`, and `generate-character` accepted unauthenticated requests.

**Files changed:**
- `server/api/generate/image.post.ts`
- `server/api/generate/video.post.ts`
- `server/api/generate-character.post.ts`
- `server/api/generate/video/status.get.ts` — requires session; verifies job `userId`
- `server/utils/video-generation-job-registry.ts` — stores `userId` per job

**New flow:** All generation routes call `getPocketBaseUserIdFromRequest` (same pattern as project CRUD). Video poll returns 403 if job belongs to another user.

### 4. Canonical Scene type and mapper

**Problem:** Scenes were the only core entity without a typed mapper.

**Files changed:**
- `types/creative-scene.ts` — **new** `CreativeScene` interface
- `server/utils/creative-scene-map.ts` — **new** `pbRecordToCreativeScene`, `projectIdOnSceneRow`
- `server/api/projects/[id]/scenes.get.ts`
- `server/api/projects/[id]/scenes/[sceneId].get.ts`
- `server/utils/execute-generate-shots.ts`
- `server/utils/analyze-project-scene.ts`
- `server/utils/project-guide-context.ts`

### 4B. Scene type cleanup (client aliases)

**Problem:** After PASS 4, client pages still duplicated scene list shapes as local `SceneRow` / `SceneListRow` types.

**Files changed:**
- `pages/projects/[projectId]/scenes.vue`
- `pages/projects/[projectId]/storyboard.vue`
- `pages/projects/[projectId]/video.vue`
- `pages/projects/[projectId]/home.vue`
- `pages/tools/storyboard-builder.vue`
- `composables/useProjectScenesHydration.ts`
- `lib/project-scene-groups.ts` — documented intentional `ProjectSceneRow` / `SceneMeta` grouping types
- `tsconfig.json` — root config so `nuxi typecheck` can find project TS settings

**Replaced with:** `CreativeSceneListItem` from `types/creative-scene.ts` (matches `GET /api/projects/:id/scenes` list payload).

**Intentionally remain:**
- `ProjectSceneRow` / `SceneMeta` / `SceneMetaMap` in `lib/project-scene-groups.ts` — timeline/video grouping projections, not API rows
- `ParsedScene`, `StoryboardSeedScene`, `InferredImportScene` — import/parser pipeline shapes, not persisted scene entities
- Asset/timeline `metadata.scene_id` and clip `sceneId` — unchanged in PASS 4B

**Typecheck note:** `nuxi typecheck` requires Nuxt-generated TypeScript config plus a root `tsconfig.json`. This repo now includes `tsconfig.json` extending `.nuxt/tsconfig.json`. Run:

```bash
npm run postinstall   # generates .nuxt/tsconfig.json via nuxi prepare
npx nuxi typecheck
```

Without `postinstall` first, `.nuxt/` is missing and typecheck fails. Without root `tsconfig.json`, it fails with `Cannot find matching tsconfig.json`.

As of PASS 4B, typecheck **runs** after the above but may still report pre-existing project errors (e.g. missing `@types/node`, PocketBase `RecordModel` casts). Scene alias cleanup is verified primarily via `scripts/verify-scene-type.mjs`.

### Verification

Run the static check scripts:

```bash
node scripts/verify-scene-type.mjs
node scripts/verify-p0-remediation.mjs
```

Manual smoke tests:
1. Sign in → generate shots for a scene → confirm server logs show continuity check; `continuity_last_issues` updates on project.
2. Call `POST /api/generate/image` without `Authorization` → expect 401.
3. Start video job → poll status without token → expect 401; with wrong user's token → expect 403.

### P0 status

| Item | Status |
|------|--------|
| Dead Continuity Engine | **Fixed** |
| Unauthenticated generation endpoints | **Fixed** |
| Prompt-stack collision + double enrich | **Fixed** |
| No scene type/mapper | **Fixed** |

P1+ items from the debt register remain open.

