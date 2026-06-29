# Today Checkpoint — 2026-06-29

**PASS 27 — Architecture Checkpoint Snapshot**  
**Updated:** PASS 28 — Timeline cloud persistence slice 1  
**Purpose:** Single source of truth for what exists in the repo after today's Production Bible evolution (PASS 17–25), observability/redaction hardening (PASS 22–24), tentative bulk review (PASS 25), and timeline persistence design (PASS 26). Use this doc before starting new work to avoid drift.

**Docs reviewed for this checkpoint:**

- [`docs/ArchitectureAudit.md`](./ArchitectureAudit.md) — baseline audit + P0 remediation record
- [`docs/ProductionBibleDesign.md`](./ProductionBibleDesign.md) — design + PASS 6–25 implementation notes
- [`docs/TimelinePersistenceDesign.md`](./TimelinePersistenceDesign.md) — PASS 26 design only (no runtime)

**No runtime code was changed for PASS 27.**

---

## What Was Built (Runtime)

### Production Bible core (PASS 6–16, prior context)

| Area | Status |
|------|--------|
| PocketBase collections | `bible_entities`, `bible_facts`, `bible_relationships` |
| CRUD + seed APIs | Project-owner secured under `/api/projects/:id/bible/*` |
| Context resolver | `resolveProductionBibleContext` — scene/shot/character scoped |
| Prompt injection | `formatProductionBiblePromptBlock` via `unified-shot-prompt` / generation helpers |
| Continuity write-back | Draft/needs_review facts from continuity checks (never overwrites existing) |
| Trust + review | Status badges, pending review queue, approve/reject facts |
| Legacy seed remediation | Dry-run tool for pre-PASS-13 active seeded facts → `needs_review` |

### PASS 17 — Bible ↔ Cast bridge

- `lib/bible-cast-bridge.ts`, `POST …/bible/link-cast`
- UI: Link Cast to Bible modal, linked cast on character entities
- Resolver prefers explicit cast↔entity relationships

### PASS 18 — Generation context coverage

- Bible context on: storyboard frames, video prefill, character creator, start-frame picker, `generate-character` API
- `resolveProductionBibleForGeneration` (fail-open server path)

### PASS 19 — Generation context stability

- `DEFAULT_PRODUCTION_BIBLE_GENERATION_OPTIONS` (20 items / 1400 chars)
- `productionBibleGenerationDebugLabel()` canonical debug string
- Storyboard bible block is **runtime-only** (not persisted to `shot.image_prompt`)

### PASS 20 — Bulk fact review

- `lib/bible-pending-fact-filters.ts`
- Pending facts queue: filters, checkboxes, approve/reject selected + all visible
- Sequential PATCH via existing fact routes

### PASS 21 — Cast asset bridge

- `lib/bible-cast-asset-bridge.ts`
- Related assets on Bible entity detail (read-only)
- Optional manual `bible_entity_id` metadata link on user action
- Cast profile: linked Bible entity + asset count

### PASS 22 — Generation observability

- `lib/generation-observability.ts`
- `metadata.generation_observability` stamped at save on: storyboard frames, character creator cloud save, video tool project save
- Production Bible related-assets provenance line

### PASS 23 — Observability stability

- `sanitizeGenerationObservabilityRecord`, forbidden prompt keys, `GENERATION_PATH` constants
- `formatAssetProvenanceLine` — legacy assets without leaking `prompt_used`
- Read-time rejection of corrupt observability blobs

### PASS 24 — Legacy prompt metadata redaction

- `lib/legacy-asset-prompt-metadata.ts`
- `POST /api/projects/:id/assets/redact-legacy-prompts` (dry-run default)
- UI: Redact legacy prompt metadata (Production Bible toolbar)

### PASS 25 — Tentative entity/relationship bulk review

- `lib/bible-tentative-item-filters.ts`
- Production Bible **Tentative items** section: filters, bulk approve/retire
- Composable: `approveEntities`, `retireEntities`, `approveRelationships`, `retireRelationships`

### PASS 28 — Timeline cloud persistence (slice 1)

- `project_timelines` PocketBase collection
- `GET/PUT /api/projects/:id/timeline` (owner-secured, revision conflict `409`)
- Cloud-first load, localStorage fallback + backup on every edit
- Import/save-to-cloud prompt for local-only timelines
- Status UI: cloud loaded, local backup, last saved, save errors
- Empty state + minor toolbar copy cleanup

### PASS 29 — Timeline cloud append handoff

- `POST /api/projects/:id/timeline/clips` — append clips, create timeline if missing
- Async `appendVideoToProjectTimeline` / `appendAudioToProjectTimeline` — cloud first, localStorage backup
- `assetId` preserved on clips when callers provide it
- Toast feedback: cloud / local only / unavailable

### PASS 30 — Timeline missing-media UX

- Clip badges: Cloud asset, URL only, Local blob, Missing media, Recoverable
- Runtime playback resolve from `assetId` (no auto-save)
- **Repair clip media from asset** — explicit persist when asset URL available
- Project assets loaded for classification + repair

### PASS 31 — Timeline persistence stability checkpoint

- Audited PASS 28–30; fixed PUT revision overwrite, stale revision after append, broad repair scope
- `cancelPendingCloudSave` + refetch on external clip push
- PUT requires `baseRevision` when cloud row exists; 409 triggers revision resync

### PASS 32 — Timeline conflict merge UX

- Visible **Conflict** state on cloud save 409
- Actions: Reload cloud / Keep local / Save my version over cloud (confirmed)
- Sync labels: Synced, Local changes pending, Conflict, Local only
- `snapshotTimelineLocalBackup` before cloud reload

### PASS 33 — Offline cloud save queue

- Queue editor PUT on offline / network / 5xx failures
- No queue on 401/403/409/validation
- Auto-flush on reconnect + manual retry/clear
- Sync label **Queued for cloud sync**

### PASS 34 — Project review dashboard

- Read-only Tools page: `/projects/:id/review`
- Counts: Bible pending/tentative, timeline sync/media, asset observability/legacy, generation provenance
- Links to Bible, timeline, Assets — no new review actions on dashboard

---

## What Was Built (Design Only)

### PASS 26 — Timeline persistence design

- [`docs/TimelinePersistenceDesign.md`](./TimelinePersistenceDesign.md) — original design (PASS 28 implemented the first slice)

### PASS 27 — This checkpoint

- [`docs/TodayCheckpoint.md`](./TodayCheckpoint.md)

---

## What Was Intentionally Not Built

| Item | Reason |
|------|--------|
| Timeline append API / cloud handoff | **PASS 29 implemented** |
| Timeline conflict merge UX | **PASS 32 implemented** |
| Offline cloud save queue | **PASS 33 implemented** — editor PUT only; append POST not queued |
| Bible review dashboard | **PASS 34 implemented** — read-only counts; no dashboard actions |
| Server-side timeline render / export upload | Out of scope; export stays browser WebM |
| Automatic Bible fact writes from timeline/clips | Future explicit review workflow only |
| Observability backfill for old assets | No inference/write without user confirm |
| Asset metadata audit export UI | Deferred (was PASS 27 in older roadmap numbering) |
| Batch PATCH APIs for bulk review | Sequential PATCH only |
| `timeline_clips` separate collection | Document-first slice preferred |
| Continuity engine redesign | P0 wired; audit debt elsewhere remains |
| Prompt-stack consolidation | Audit item; not part of Bible passes |
| Shot↔character junction table | Audit recommendation; not implemented |
| Writing `prompt_used` into `generation_observability` | Prompt hash only |

---

## Current Production Bible Capabilities

### Data model

- **Entities** — 12 types, statuses: `active`, `tentative`, `draft`, `retired`, `contradicted`
- **Facts** — typed statements, entity-linked or project-scoped; statuses include `draft`, `needs_review`, `active`, `retired`
- **Relationships** — typed edges between bible entities and creative endpoints (`scene`, `shot`, `creative_character`, etc.)

### UI (`/projects/:id/bible`)

| Surface | Capability |
|---------|------------|
| Entity CRUD | Per-type lists, detail edit, approve/retire one-by-one |
| Facts pending review | Filters + bulk approve/reject (PASS 20) |
| Tentative items | Entities + relationships bulk approve/retire (PASS 25) |
| Seed from project | Preview + create tentative entities/needs_review facts |
| Link Cast to Bible | Dry-run preview + apply (PASS 17) |
| Related assets | Read-only bridge + optional manual `bible_entity_id` link (PASS 21) |
| Legacy tools | Review legacy seeded facts; redact legacy prompt metadata (PASS 16, 24) |
| Continuity findings | Project-wide pending continuity facts |

### APIs (representative)

- `GET/POST/PATCH/DELETE` … `/bible/entities`, `/facts`, `/relationships`
- `GET` … `/bible/context` — resolved prompt context (owner-checked)
- `POST` … `/bible/seed`, `/link-cast`, `/remediate-seeded-facts`
- `POST` … `/assets/redact-legacy-prompts`

---

## Current Prompt Context Behavior

### Resolution

- Server: `resolveProductionBibleContext` / `resolveProductionBibleForGeneration`
- Options: `sceneId`, `shotId`, `characterIds`, `entityIds`, `maxItems` (default 20 in generation paths), `tokenBudget` (default 1400)
- **Fail-open:** missing bible data does not block generation; debug label explains unavailability

### Trust rules (what enters prompts)

| Row kind | In prompt by default |
|----------|----------------------|
| Facts `active` | Yes |
| Facts `draft` / `needs_review` | No (unless `includeReviewFacts` debug) |
| Facts `retired` / `contradicted` | No |
| Entities `active` | Yes |
| Entities `tentative` | Yes, labeled provisional |
| Entities `retired` / `contradicted` | No |
| Relationships `active` | Yes |
| Relationships `tentative` | Yes, labeled provisional |

### Generation paths with bible block

| Path | Bible appended | Persisted to shot/asset prompt fields |
|------|----------------|--------------------------------------|
| Storyboard frame generate | Yes (runtime) | No — shot `image_prompt` unchanged |
| Video panel prefill / tools | Yes | N/A |
| Character creator | Yes | N/A |
| Video start-frame picker | Yes | N/A |
| `POST /api/generate-character` | Yes when `projectId` | Returns `productionBibleDebug` on first result only |

### Debug

- Canonical label: `productionBibleGenerationDebugLabel()`
- Storyboard UI shows per-frame bible debug line
- Video tools show prefill bible debug line

---

## Current Asset Provenance Behavior

### Cast ↔ Bible ↔ assets (PASS 21)

- **Read:** `lib/bible-cast-asset-bridge.ts` resolves asset → cast, asset → entity, entity → related assets
- **Matching:** `bible_entity_id` metadata → cast bridge (PASS 17) → scene/shot tags (display only)
- **Manual only:** PATCH asset metadata to set `bible_entity_id` (user confirm)

### Generation observability (PASS 22–23)

- Stored at `metadata.generation_observability` on saved generated assets
- Contains: `promptHash` (djb2), bible id arrays, counts, `bibleDebugLabel`, `generationPath`, scope ids
- **Never** stores full prompt text in observability blob
- UI: provenance line on related assets; legacy line without exposing `prompt_used`

### Legacy prompt redaction (PASS 24)

- Top-level `prompt_used`, `negative_prompt`, `dialogue_line`, etc. can be manually redacted to `[redacted]` + `*_hash`
- Does not touch `generation_observability` or delete assets

---

## Current Review / Trust System

```
Seed / continuity → draft | needs_review | tentative
                           ↓
              User review (single or bulk)
                           ↓
                    active  |  retired
                           ↓
              Included in prompts (with tentative labels where applicable)
```

| Queue | Bulk actions | Single-row actions |
|-------|--------------|-------------------|
| Pending facts | Approve/reject selected + all visible | Approve, reject, edit on row |
| Tentative entities/relationships | Approve/retire selected + all visible | Approve, retire on row + entity detail |
| Legacy seeded facts (active) | Remediate preview → move to needs_review | N/A |

Scripts: `verify-production-bible.mjs`, `verify-bible-trust-matrix.mjs`

---

## Current Timeline Persistence Status

| Aspect | Current state |
|--------|----------------|
| Cloud storage | `project_timelines` — one JSON document per project |
| API | `GET/PUT /api/projects/:id/timeline`, `POST …/timeline/clips` |
| Local backup | `aie_timeline_editor_v2_<projectId>` — still written on every edit |
| Load order | Cloud first → localStorage fallback |
| Import UX | Banner to save local timeline to cloud (explicit action) |
| Append handoff | Cloud POST first → sync local backup; local fallback on failure |
| Export | Client WebM download; not saved to project |
| Bible | No timeline → Bible writes |

See [`docs/TimelinePersistenceDesign.md`](./TimelinePersistenceDesign.md) PASS 28 UX audit + implementation note.

---

## Known Risks (Carry Forward)

From audit + today's passes:

1. **Timeline local-only** — data loss on browser clear; no cross-device sync ([ArchitectureAudit §7](./ArchitectureAudit.md))
2. **Prompt-stack duplication** — two builders, duplicate `resolveVideoGenerationPrompt` export ([ArchitectureAudit §2](./ArchitectureAudit.md))
3. **Shot↔character by name grep** — no stored junction
4. **Legacy `prompt_used` on character assets** — still in top-level metadata until user runs PASS 24 redaction
5. **Bulk review sequential PATCH** — slow on large selections; partial failure not retried
6. **Stale asset URLs** — timeline clips and observability lack durable `assetId` until timeline PASS implementation
7. **In-memory generation job registries** — lost on server restart
8. **Oversized timeline JSON** — future risk when cloud-persisted (PASS 26 mitigation: revision + monitor size)
9. **Observability only on new saves** — old assets lack `generation_observability` until re-saved

---

## Verification Results (2026-06-29)

Run from repo root:

```bash
node scripts/verify-production-bible.mjs
node scripts/verify-bible-trust-matrix.mjs
node scripts/verify-prompt-assembly.mjs
node scripts/verify-continuity-engine.mjs
node scripts/verify-generation-auth.mjs
node scripts/verify-p0-remediation.mjs
node scripts/verify-scene-type.mjs
node scripts/verify-timeline-persistence.mjs
```

| Script | Result |
|--------|--------|
| `verify-production-bible.mjs` | **378 checks, 0 failed** |
| `verify-bible-trust-matrix.mjs` | **17 checks, 0 failed** |
| `verify-prompt-assembly.mjs` | **11 checks, 0 failed** |
| `verify-continuity-engine.mjs` | **15 checks, 0 failed** |
| `verify-generation-auth.mjs` | **15 checks, 0 failed** |
| `verify-p0-remediation.mjs` | **17 checks, 0 failed** |
| `verify-scene-type.mjs` | **37 checks, 0 failed** |
| `verify-timeline-persistence.mjs` | **114 checks, 0 failed** (PASS 28–33) |
| **Total** | **604 checks, 0 failed** |

### PASS 32 manual verification (conflict UX)

1. Open timeline on two tabs (or trigger stale revision via append in another tab).
2. Edit in tab A; save or wait for debounced PUT with stale `baseRevision` → **409**.
3. Confirm status shows **Conflict** and banner: “Cloud timeline changed while you were editing.”
4. **Reload cloud timeline** — editor shows cloud doc; `aie_timeline_editor_v2_conflict_backup_<projectId>` holds pre-reload local.
5. **Keep my local version** — conflict clears; status **Local changes pending**; “Local changes not synced…” message; no auto cloud save on edit.
6. **Save my version over cloud** — confirm dialog; cloud updated with latest revision; status **Synced**.

### PASS 33 manual verification (offline queue)

1. Open timeline; edit while DevTools → Network → Offline (or stop PocketBase).
2. Confirm status **Queued for cloud sync**, pending count, last error.
3. Re-enable network → auto-flush or click **Retry cloud sync** → **Synced**, queue cleared.
4. Trigger 409 during flush (stale revision) → conflict UX, queue retained.
5. **Clear queued save** → confirm; localStorage editor backup unchanged.
6. Auth error (401) → not queued; error shown inline.

### PASS 34 manual verification (review dashboard)

1. Open **Tools → Review Dashboard** for a cloud project.
2. Confirm Bible counts match Production Bible panel (pending facts, tentative items).
3. Confirm timeline rows reflect cloud/local/queue/media reliability state.
4. Confirm asset observability and legacy prompt counts match sample assets.
5. Click navigation links — Bible, timeline, Assets open correctly; dashboard performs no writes.

---

---

## Key Files (Quick Index)

| Domain | Paths |
|--------|-------|
| Bible trust/review | `lib/bible-trust.ts`, `lib/bible-fact-review.ts`, `lib/bible-pending-fact-filters.ts`, `lib/bible-tentative-item-filters.ts` |
| Cast bridge | `lib/bible-cast-bridge.ts`, `server/utils/link-cast-to-bible.ts` |
| Asset bridge | `lib/bible-cast-asset-bridge.ts` |
| Generation context | `lib/production-bible-generation-context.ts`, `server/utils/resolve-production-bible-context.ts` |
| Observability | `lib/generation-observability.ts` |
| Prompt redaction | `lib/legacy-asset-prompt-metadata.ts`, `server/utils/redact-legacy-asset-prompts.ts` |
| Bible UI | `components/project/ProductionBiblePanel.vue`, `composables/useProductionBible.ts` |
| Timeline (cloud + local) | `types/project-timeline.ts`, `composables/useProjectTimeline.ts`, `lib/timeline-sync-status.ts`, `lib/timeline-editor/cloud-save-queue.ts`, `server/api/projects/[id]/timeline.*` |
| Review dashboard | `lib/project-review-dashboard.ts`, `pages/projects/[projectId]/review.vue` |
| Timeline editor | `lib/timeline-editor/*`, `composables/useTimelineEditorState.ts` |
| Verification | `scripts/verify-production-bible.mjs` (+ siblings above) |

---

## Recommended Next 5 Passes

1. **PASS 35 — Observability backfill (manual)** — Stamp inferable `generation_observability`.

2. **PASS 36 — Link clip to asset tool** — Attach `assetId` to URL-only clips.

3. **PASS 37 — Prompt-stack consolidation (audit P1)** — Unify duplicate prompt builders.

4. **PASS 38 — Timeline append offline queue** — Optional POST clip queue if needed.

5. **PASS 39 — Review dashboard actions** — Inline approve/redact from dashboard (optional).

---

## Drift Prevention Rules

When adding features, check against this checkpoint:

1. **Do not** persist bible blocks into `shot.image_prompt` or asset prompt fields without an explicit pass.
2. **Do not** auto-write Bible facts from generation, timeline, or asset saves.
3. **Do not** store full prompts in `generation_observability` or new metadata keys.
4. **Do not** change trust rules without updating `verify-bible-trust-matrix.mjs`.
5. **Do not** implement timeline cloud save without migration UX from PASS 26/28.
6. **Do** run `npm run setup-db` after deploy when `project_timelines` is new.
7. **Do** add verification checks to `verify-timeline-persistence.mjs` for timeline surfaces.
8. **Do** add verification checks to `verify-production-bible.mjs` for new Bible surfaces.
9. **Do** update this checkpoint doc after major pass completions.

---

*Checkpoint generated PASS 27. Repo state is the authority; if code and docs disagree, fix docs or code before shipping.*
