# Timeline Persistence Design

**PASS 26 — Timeline Persistence Design**  
**Status:** Design only. Do not build yet.

## Goal

Move the project timeline from browser-only `localStorage` into project-owned persistent data, while preserving the current editor behavior and avoiding changes to generation, export, Production Bible writes, or asset storage.

This pass is a design document only. It should guide a small implementation slice later.

## Current Timeline Audit

### Current storage

The timeline editor is currently browser-local only:

- Storage helper: `lib/timeline-editor/storage.ts`
- Storage key prefix: `aie_timeline_editor_v2_`
- Per-project key: `aie_timeline_editor_v2_<projectId>`
- Stored payload: `TimelineEditorDocument`

Current document shape:

```ts
interface TimelineEditorDocument {
  version: 2
  clips: TimelineEditorClip[]
  zoom: number
}
```

`saveTimelineToStorage()` writes the full document to `localStorage`. `loadTimelineFromStorage()` parses it through `parseEditorDocument()`.

There is no PocketBase persistence for timeline documents or clips today.

### Current localStorage behavior

`composables/useTimelineEditorState.ts` owns the reactive editor state:

- `clips`
- `zoom`
- `selectedClipId`
- `activeTool`
- `playhead`
- `isPlaying`

Every timeline mutation calls `persist()`, which writes the whole document back to `localStorage`.

External append flows do not call the editor state directly. They write to `localStorage` through append helpers, then notify the open editor through `useTimelineClipPushedState()`.

### Current clip shape

Defined in `types/timeline-editor.ts`:

```ts
interface TimelineEditorClip {
  id: string
  type: 'video' | 'audio'
  track: 'video' | 'audio'
  src: string
  label: string
  sourceStart: number
  sourceEnd: number
  timelineStart: number
  duration: number
  hasAudio?: boolean
  linkedVideoId?: string
  linkedAudioId?: string
  transitionIn: 'crossfade' | 'fade-in' | 'fade-out' | null
  transitionOut: 'crossfade' | 'fade-in' | 'fade-out' | null
  transitionDurationSec?: number
  sceneId?: string
  shotId?: string
}
```

The model is non-destructive. It stores trim points and timeline placement, not rendered media.

### Scene and shot references

`sceneId` and `shotId` are optional soft tags on clips. They are written by:

- Project video page when adding generated panel clips to timeline
- Project video library accordion
- Asset hub when adding a video asset with `metadata.scene_id` / `metadata.shot_id`
- Video generation handoff when launched from a project panel

They are not currently used by playback, export, ordering, continuity checks, or Production Bible. They are provenance tags only.

### Asset references

Clips currently store only `src`, a playback URL string. They do not store a durable `project_assets` id.

Playback resolves auth at runtime through `appendPlaybackAccessToken()`, so access tokens are not persisted in the timeline document. This is good and should be preserved.

The missing durable asset id is the main weakness: when a clip is added from a project asset, the timeline cannot reliably answer "which asset row is this?"

### Audio and music references

Audio clips share the same `TimelineEditorClip` shape:

- `type: 'audio'`
- `track: 'audio'`
- `src` URL
- `label`
- timing fields

Generated or library music is appended through `lib/append-project-timeline-audio.ts`. Like video, it stores URL-only references, not asset ids.

Linked video/audio pairs use:

- `linkedAudioId` on video clips
- `linkedVideoId` on companion audio clips

### Export and render behavior

Export is client-side only:

- Export helper: `lib/timeline-editor/export-video.ts`
- Trigger: `components/editor/TimelineEditor.vue`
- Uses live preview media elements, `canvas.captureStream(30)`, `AudioContext`, and `MediaRecorder`
- Outputs WebM download in-browser
- Does not create a `project_assets` row
- Does not create a render job
- Does not upload the export

This design does not change export/render behavior.

### Video generation handoff

Video and audio handoff currently writes directly to local timeline storage:

- `lib/append-project-timeline-video.ts`
- `lib/append-project-timeline-audio.ts`

Flow:

1. Load document from `localStorage`.
2. Append a new clip at the end of the relevant track.
3. Normalize track layout.
4. Save back to `localStorage`.
5. Set `useTimelineClipPushedState()` so an open editor reloads from storage.

Callers include:

- `pages/tools/video-generation.vue`
- `pages/projects/[projectId]/video.vue`
- `components/project/ProjectVideoSceneAccordion.vue`
- `components/assets/AssetKindHub.vue`
- `pages/tools/music-generation.vue`
- `components/assets/MusicAssetHub.vue`

The persistence migration should preserve this "append from elsewhere" behavior, but eventually route it through a project timeline API rather than directly mutating `localStorage`.

## What Must Become Persistent

### Timeline document

Persist one current edit document per project:

- document version
- zoom
- clips
- timeline-level metadata
- updated timestamp
- revision counter

The first build should support one canonical timeline per project. Multiple cuts/versions can be added later.

### Clips

Persist each clip's current v2 shape plus durable references:

- id
- type
- track
- label
- sourceStart
- sourceEnd
- timelineStart
- duration
- transitionIn
- transitionOut
- transitionDurationSec
- linkedVideoId
- linkedAudioId
- sceneId
- shotId
- assetId (new)
- source URL fallback

### Track and layer data

The current editor has two tracks only:

- video
- audio

`track` on each clip is enough for the first slice. Avoid introducing a full track collection until the editor supports named tracks, mute/solo, stacked video layers, or multiple audio lanes.

### Ordering

Ordering is implicit today:

- per-track sort by `timelineStart`
- clip geometry derived from timing fields

Keep that model. Do not add a separate order column in the first slice.

### Scene and shot references

Persist existing `sceneId` and `shotId` exactly as optional soft references.

Later, these can support:

- "show clips for this shot"
- timeline-to-storyboard consistency checks
- Production Bible relationships

Do not enforce referential integrity in the first slice. Rows may point at deleted scenes/shots.

### Asset references

Add `assetId` to the persisted clip model where known. Keep `src` as a fallback for old/local imports and external URLs.

Recommended source rules:

- If clip was added from `project_assets`, store `assetId`.
- Store `src` as a playback/source fallback, but resolve from `assetId` when possible.
- Never persist access-token-bearing URLs.
- If only a URL exists, persist it as `src` and mark the clip as URL-only.

### Audio, music, captions, dialogue

Persist audio clips using the same clip structure, with `assetId` where known.

Captions/dialogue are not currently part of the timeline clip model. If introduced later, prefer clip-level optional fields:

- `captionText`
- `dialogueText`
- `speakerCharacterId`

Do not add these fields in the first build unless the current editor starts editing them.

## Recommended PocketBase Schema

### Recommendation: one collection first

Use one collection: `project_timelines`.

This is the smallest safe schema because the editor already saves and loads the entire document as a unit. A separate `timeline_clips` collection would add complexity before there is server-side querying, collaboration, or per-clip permissions.

### Collection: `project_timelines`

Fields:

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation/users | Required owner |
| `project` | relation/creative_projects | Required, unique for first slice |
| `name` | text | Default: `Main timeline` |
| `status` | select | `active`, `archived` |
| `schema_version` | number | Start at `1` for PB payload schema |
| `editor_version` | number | Current editor document version, `2` |
| `revision` | number | Increment on successful save |
| `document` | json | Timeline document payload |
| `duration_seconds` | number | Cached duration for listing |
| `clip_count` | number | Cached count for listing |
| `last_saved_by` | relation/users | Optional; useful for collaboration later |
| `local_imported_at` | date | Set when migrated from localStorage |

Indexes:

- Unique index on `(owned_by, project, status='active')` if PocketBase supports the partial form.
- Otherwise enforce "one active timeline per project" in API code.
- Index `project`.
- Index `owned_by`.

PocketBase rules:

- List/view/create/update/delete only when `owned_by = @request.auth.id`.
- Server routes should still use admin PB plus explicit project ownership checks, matching current app patterns.

### Document JSON shape

Stored in `project_timelines.document`:

```ts
interface PersistedTimelineDocument {
  version: 2
  clips: PersistedTimelineClip[]
  zoom: number
  updatedAt: string
}

interface PersistedTimelineClip extends TimelineEditorClip {
  assetId?: string
  assetKind?: 'video' | 'other' | 'script' | 'character' | 'storyboard'
  sourceType?: 'project_asset' | 'external_url' | 'local_upload' | 'generated'
}
```

Do not store resolved playback tokens in `src`.

For `assetId` clips, the server or client should resolve the playback path from project/asset id when displaying. `src` remains a fallback.

### Versioning strategy

Use two version numbers:

- `editor_version`: matches `TimelineEditorDocument.version` (`2`)
- `schema_version`: version of the PB persistence wrapper (`1`)

Use `revision` for optimistic concurrency:

- Client loads timeline with `revision`.
- Save requests include `baseRevision`.
- Server rejects save with `409 Conflict` if base revision is stale.
- Client offers "reload cloud version" or "save as local backup / overwrite" UX.

### Why not multiple collections yet?

Avoid `timeline_clips` in the first slice because:

- Current editor mutates full clip arrays frequently.
- Undo/redo snapshots are document-level.
- No current server endpoint needs "query all clips for shot X".
- Per-clip writes increase conflict and transaction complexity.

Move to multiple collections later when there is:

- collaboration
- multiple timelines/cuts
- server render jobs
- timeline-to-shot querying at scale

## API Plan

All routes are project-owned and should follow existing ownership conventions:

- Validate PocketBase user token.
- Load project.
- Confirm project owner.
- Operate only on timelines for that project and user.

### Get timeline

`GET /api/projects/:id/timeline`

Returns:

```ts
{
  timeline: {
    id: string
    projectId: string
    name: string
    revision: number
    schemaVersion: 1
    editorVersion: 2
    document: PersistedTimelineDocument
    updated: string
  } | null,
  localStorageKey: string
}
```

If no cloud timeline exists, return `timeline: null` so the client can check localStorage and offer import.

### Save timeline

`PUT /api/projects/:id/timeline`

Body:

```ts
{
  baseRevision?: number
  document: PersistedTimelineDocument
  name?: string
}
```

Behavior:

- Create timeline if missing.
- Update if `baseRevision` matches current revision.
- Increment revision.
- Recompute `duration_seconds` and `clip_count`.
- Validate/sanitize clip payload with the same rules as `parseEditorDocument()`, plus asset reference validation where possible.

Conflict:

- Return `409` with current revision if base revision is stale.

### Update clip

`PATCH /api/projects/:id/timeline/clips/:clipId`

First slice can defer this and use whole-document save only.

When added later:

- Load current document.
- Patch the clip.
- Increment revision.
- Return updated timeline.

This route is useful for future append flows and collaborative edits, but not required for the first buildable slice.

### Delete clip

`DELETE /api/projects/:id/timeline/clips/:clipId`

First slice can defer this and use whole-document save only.

When added later:

- Remove clip and linked companion if requested.
- Do not delete assets.
- Increment revision.

### Append clip

`POST /api/projects/:id/timeline/clips`

Recommended for replacing direct localStorage handoff after basic cloud load/save works.

Body:

```ts
{
  assetId?: string
  src?: string
  label: string
  type: 'video' | 'audio'
  sceneId?: string
  shotId?: string
  duration?: number
}
```

Behavior:

- Append at end of matching track.
- If video has audio, create linked video/audio pair like current `createLinkedVideoAudioClipsFromUrl()`.
- Return appended clip ids and updated revision.

### Optional duplicate/version route

`POST /api/projects/:id/timeline/duplicate`

Defer until multiple timelines/cuts exist.

Possible future behavior:

- Archive existing active timeline.
- Create named duplicate.
- Or create a `project_timeline_versions` collection later.

## Relationship with Production Bible

Timeline clips should become durable project graph participants, but PASS 26 should not write Bible facts.

### Allowed in persistence phase

Timeline clips may reference:

- project
- scene
- shot
- project asset
- creative character in future caption/dialogue fields

These references are enough to support later Bible relationships such as:

- asset appears in shot
- clip uses asset
- clip belongs to scene
- timeline includes shot

### Not in this phase

Do not:

- write Bible facts
- create Bible relationships automatically
- alter Production Bible context resolution
- infer canon from timeline placement
- modify generation prompts

### Future bridge idea

After timeline persistence is stable, a future explicit review workflow could propose Bible relationships from timeline clips, similar to PASS 17/PASS 21 patterns:

- read timeline clips
- infer candidate relationships
- preview
- user confirms
- write tentative relationships

## Migration UX

### Detect local timeline

When the timeline page loads:

1. Fetch cloud timeline.
2. Check `localStorage` key `aie_timeline_editor_v2_<projectId>`.
3. Parse with `parseEditorDocument()`.
4. Compare cloud vs local:
   - cloud missing + local exists
   - both exist, local newer unknown
   - cloud exists + local empty

Because current local documents do not store `updatedAt`, initial migration cannot reliably compare timestamps. Treat any local document as user-owned data requiring an explicit choice.

### Preview import

Show a non-blocking banner or modal:

> "This browser has a local timeline for this project. Save it to the cloud so it is backed up and available on other devices."

Preview:

- clip count
- video clip count
- audio clip count
- estimated duration
- number of scene/shot-tagged clips
- number of URL-only clips

Do not auto-import.

### Save to cloud

User action: **Save local timeline to cloud**

Flow:

1. Send parsed local document to `PUT /api/projects/:id/timeline`.
2. Server creates the project timeline.
3. Client reloads from cloud.
4. Keep local backup.

### Keep local backup

After successful import:

- Do not delete the old localStorage key immediately.
- Write a marker key:
  - `aie_timeline_editor_v2_imported_<projectId>`
  - includes cloud timeline id/revision/import date
- Offer "Remove local backup" later.

This reduces data-loss risk during rollout.

### Conflict UX

If cloud timeline exists and local timeline also exists:

Options:

- Use cloud timeline
- Preview local backup
- Replace cloud with local backup (requires confirmation)
- Keep local backup only

Confirmation copy for replace:

> "This will replace the cloud timeline for this project with the timeline stored in this browser. Assets are not deleted."

## UI Plan

### Timeline page

Add status and migration affordances:

- "Saved to cloud" / "Local only" / "Unsaved changes" state
- Local timeline detected banner
- Import preview modal
- Conflict warning modal
- Manual "Save now" button once cloud persistence exists

### Editor behavior

Keep the editor mostly unchanged:

- It should still operate on `TimelineEditorDocument`.
- It should still autosave after edits.
- Replace the persistence adapter underneath:
  - current: localStorage
  - first cloud slice: cloud primary, local backup

### Handoff behavior

After cloud persistence is available:

- `appendVideoToProjectTimeline()` and `appendAudioToProjectTimeline()` should become async or gain cloud-aware variants.
- Prefer API append route over direct document save.
- Continue to update `useTimelineClipPushedState()` so open editor reloads.

To minimize churn, build an adapter:

```ts
interface TimelinePersistenceAdapter {
  load(projectId: string): Promise<TimelineEditorDocument | null>
  save(projectId: string, doc: TimelineEditorDocument, baseRevision?: number): Promise<{ revision: number }>
  append(projectId: string, clip: AppendClipInput): Promise<{ clipId: string; revision: number }>
}
```

## Risks and Tradeoffs

### Data loss

Risk: replacing localStorage behavior could overwrite the only copy of a user's timeline.

Mitigation:

- import preview
- explicit user action
- keep local backup after cloud import
- conflict handling through revision checks

### Conflicts across devices

Risk: two devices edit the same timeline.

Mitigation:

- `revision` optimistic concurrency
- reject stale saves
- UI choice to reload or overwrite
- later: per-clip operations or version history

### Oversized documents

Risk: a long film with many clips could make one JSON document large.

Mitigation:

- first slice is acceptable for current two-track editor
- compute and monitor document size
- set server payload limit expectations
- move to `timeline_clips` collection when clips become numerous or query-heavy

### Stale asset references

Risk: clips point at deleted or moved assets.

Mitigation:

- keep `src` fallback
- validate `assetId` on load where possible
- show missing media state in UI
- never delete clips automatically because an asset is missing

### URL-only clips

Risk: old clips have no asset id.

Mitigation:

- preserve `src`
- mark `sourceType: 'external_url'` or leave `assetId` empty
- optionally offer a later "link clip to asset" tool

### Offline/local use

Risk: cloud-first persistence breaks offline editing.

Mitigation:

- keep local backup writes
- queue save attempts when offline in a later pass
- show "local changes not synced" status

### Export remains browser-only

Risk: users may expect cloud timeline persistence to imply server rendering.

Mitigation:

- keep copy clear: "Timeline saved to cloud; export still downloads from this browser."
- server render is a separate future project.

## First Buildable Slice

The smallest safe implementation:

1. Add `project_timelines` collection in setup scripts.
2. Add mapper/type for persisted timeline row.
3. Add `GET /api/projects/:id/timeline`.
4. Add `PUT /api/projects/:id/timeline`.
5. Add a timeline persistence adapter that loads/saves cloud timeline but keeps localStorage backup.
6. On timeline page, detect local v2 timeline and offer import preview.
7. Keep append helpers localStorage-backed until the editor itself loads/saves cloud reliably.

Why this slice:

- It persists the primary document.
- It avoids per-clip API complexity.
- It protects local data.
- It does not disrupt generation handoff yet.

Second slice:

1. Add `POST /api/projects/:id/timeline/clips` append route.
2. Update video/music handoff helpers to append through API when authenticated.
3. Keep localStorage fallback for failure/offline.

Third slice:

1. Add conflict UI.
2. Add assetId-aware clip creation from asset hubs.
3. Add missing asset warnings.

## Do Not Build Yet

Do not implement this in PASS 26:

- Do not add PocketBase collections.
- Do not add API routes.
- Do not modify timeline editor persistence.
- Do not modify append helpers.
- Do not migrate any user data.
- Do not delete localStorage keys.
- Do not change export/render behavior.
- Do not write Production Bible facts or relationships.
- Do not add server-side rendering.
- Do not split clips into a separate collection yet.

This document is the design baseline for a later implementation pass.

---

## Timeline UX audit (PASS 28)

Honest assessment of the editor before cloud persistence — used to guide UX cleanup without a full redesign.

### What works

| Area | Notes |
|------|-------|
| Two-track model | Video + audio lanes are easy to understand |
| Non-destructive edits | Trim/split/remove do not delete project assets |
| Linked video/audio | Generated clips get paired tracks automatically |
| Undo/redo | Document-level history is reliable |
| Preview + scrub | Playhead scrubbing and dual-buffer video preview work |
| Export | Client WebM export produces a downloadable edit |
| Handoff | Video/music tools append clips via localStorage + reload signal |

### What is confusing

| Issue | Impact |
|-------|--------|
| "Saved in this browser" only | Users assume project data is cloud-backed |
| Dense toolbar | Fade ▾, Detach, Blend, Cut at playhead overlap visually |
| Razor vs Cut at playhead | Two ways to split; razor tool discovery is poor |
| Empty timeline | No guidance until footer hint text |
| Export label "Export video" | Implies server render; it is browser WebM only |
| Scene accordion below editor | Useful but visually disconnected from empty state |

### What is broken or unfinished

| Issue | Status |
|-------|--------|
| No cloud persistence (pre-PASS 28) | Addressed in PASS 28 |
| URL-only clip refs | No durable `assetId`; stale URLs possible |
| Blob URL audio uploads | `URL.createObjectURL` clips break after session |
| Append helpers bypass cloud | Still localStorage-only until PASS 29 |
| No missing-media warnings | Broken `src` fails silently in preview |
| `sceneId`/`shotId` unused after write | Provenance tags only |

### Useful data shape (keep)

- `TimelineEditorDocument` v2: `{ version, clips[], zoom }`
- Per-clip timing: `sourceStart`, `sourceEnd`, `timelineStart`, `duration`
- `linkedVideoId` / `linkedAudioId` pairs
- Optional `sceneId`, `shotId` soft tags
- Do **not** persist access tokens in `src`

### Do not preserve long-term

- Browser-only as sole source of truth
- Misleading "saved in browser" as primary status
- Blob URLs as permanent audio sources
- Toolbar clutter without labels (Fade hidden behind ▾ with no context)
- Expecting export to upload to project assets

### What the timeline editor should become (direction, not PASS 28 scope)

1. **Project-owned document** — cloud primary, local backup (PASS 28)
2. **Clear save status** — cloud/local/unsaved/error (PASS 28)
3. **Simpler edit modes** — select + razor; defer advanced transitions UI
4. **Durable clip refs** — `assetId` when known (PASS 29)
5. **Missing media state** — show broken clip badge (PASS 29+)
6. **Append through API** — video/music handoff writes cloud (PASS 29)
7. **Optional storyboard lens** — filter/highlight by scene/shot later

---

## PASS 28 Implementation Note (2026-06-29)

**Status:** Cloud persistence slice 1 — `project_timelines` collection, GET/PUT API, local fallback + import UX. No Bible writes, no append API yet, no version history.

### Collection: `project_timelines`

| Field | Purpose |
|-------|---------|
| `owned_by` | Owner |
| `project` | One active row per project (enforced in API) |
| `title` | Default `Main timeline` |
| `timeline_json` | Full v2 document JSON |
| `schema_version` | PB wrapper version (`1`) |
| `revision` | Optimistic concurrency |
| `source` | `editor` \| `local_import` \| `migration` |
| `imported_from_local` | Set on local import |
| `local_backup_key` | e.g. `aie_timeline_editor_v2_<projectId>` |

### API

- `GET /api/projects/:id/timeline` — cloud row or `null` + `localStorageKey`
- `PUT /api/projects/:id/timeline` — create/update; `409` on stale `baseRevision`

### Client behavior

1. Load cloud first
2. Fall back to localStorage if no cloud row
3. Import banner when local exists without cloud
4. Conflict banner when both exist (cloud loaded; option to replace)
5. Every edit → localStorage + debounced cloud PUT
6. Local import marker: `aie_timeline_editor_v2_imported_<projectId>`

### Files

- `types/project-timeline.ts`
- `lib/project-timeline-normalize.ts`
- `lib/timeline-editor/local-backup.ts`
- `server/utils/project-timeline-map.ts`
- `server/api/projects/[id]/timeline.get.ts`, `timeline.put.ts`
- `composables/useProjectTimeline.ts`
- `pages/projects/[projectId]/timeline.vue` — status + import UI
- `composables/useTimelineEditorState.ts` — `onAfterPersist` hook
- `components/editor/TimelineEditor.vue` — empty state, cloud status footer

### Verification

```bash
node scripts/verify-timeline-persistence.mjs
```

### Known limitations (PASS 28)

- ~~Append helpers still write localStorage only~~ — addressed in PASS 29
- ~~No `assetId` on new clips yet~~ — PASS 29 stores when known
- No offline save queue
- Revision conflict requires manual reload
- One timeline per project (no named cuts)

### Recommended next timeline pass (PASS 29)

~~`POST /api/projects/:id/timeline/clips` append route; route video/music handoff through API; store `assetId` on clips when known.~~ **Implemented — see PASS 29 below.**

---

## PASS 29 Implementation Note (2026-06-29)

**Status:** Cloud append handoff — `POST /api/projects/:id/timeline/clips`, async append helpers, assetId preservation, UI feedback. No editor redesign, no Bible writes.

### Handoff paths audited

| Path | File | Type |
|------|------|------|
| Video generation “add to timeline” | `pages/tools/video-generation.vue` | video |
| Music generation “add to timeline” | `pages/tools/music-generation.vue` | audio |
| Project video panel → timeline | `pages/projects/[projectId]/video.vue` | video (storyboard panel) |
| Scene accordion | `components/project/ProjectVideoSceneAccordion.vue` | video |
| Assets → Video hub | `components/assets/AssetKindHub.vue` | video |
| Assets → Music hub | `components/assets/MusicAssetHub.vue` | audio |

All previously called `appendVideoToProjectTimeline` / `appendAudioToProjectTimeline` which wrote **localStorage only**.

### API

`POST /api/projects/:id/timeline/clips`

Body: `{ baseRevision?, clips: TimelineClipAppendInput[] }`

- Loads or creates `project_timelines` row
- Appends via `appendClipsToDocument` (linked video+audio for video type)
- Increments revision
- Returns `{ timeline, appendedClipIds }`

### Client handoff flow

1. If `authHeaders` provided → cloud append first
2. On cloud success → sync full document to localStorage backup
3. On cloud failure → localStorage append only
4. Toast: **Added to cloud timeline** / **Added locally only** / **Cloud timeline unavailable**

### assetId preservation

- `ProjectTimelineClip.assetId` set when callers pass `assetId` (asset hubs, generation saves)
- `src` still stored as playback fallback
- Storyboard panel handoff may lack assetId (URL-only panel clip)

### Files

- `server/api/projects/[id]/timeline/clips.post.ts`
- `server/utils/append-project-timeline-clips.ts`
- `server/utils/project-timeline-store.ts`
- `lib/timeline-editor/append-to-document.ts`
- `lib/timeline-append-feedback.ts`
- `lib/append-project-timeline-video.ts`, `lib/append-project-timeline-audio.ts` (async)

### Known limitations (PASS 29)

- Editor debounced PUT may race with append POST (reload resolves)
- No server-side `assetId` → URL resolution when `src` omitted
- Blob URL audio uploads still not durable
- No missing-media warnings on load

### Recommended next timeline pass (PASS 30)

~~Missing-media UX: broken clip badges, resolve playback from `assetId` on load, optional link-clip-to-asset tool.~~ **Implemented — see PASS 30 below.**

---

## PASS 30 Implementation Note (2026-06-29)

**Status:** Timeline missing-media UX — clip reliability badges, runtime assetId playback resolve, repair action. No editor redesign, no Bible writes.

### Media reliability audit

| Topic | Finding |
|-------|---------|
| `clip.src` usage | Playback, export, and preview call `resolveSrc(clip.src)` |
| URL loading | Project assets use `/api/projects/:id/assets/:assetId/media` + access token |
| `assetId` | Stored since PASS 29; parsed on load from localStorage/cloud |
| Blob URLs | Created by in-editor audio file upload — break after reload |
| Missing `src` | Clips skipped by old parser; now load when `assetId` present |
| Stale `src` | External or token-stripped URLs may fail; recoverable when `assetId` set |

### Helpers (`lib/timeline-clip-media-reliability.ts`)

- `classifyTimelineClipMedia` → `cloud_asset` \| `url_only` \| `local_blob` \| `missing` \| `recoverable`
- `isBlobTimelineUrl`, `isMissingTimelineClipSrc`, `isDurableProjectAssetUrl`, `hasAssetIdBackedClip`
- `resolveTimelineClipPlaybackSrc` — runtime resolve from `assetId` (no auto-save)
- `buildRepairedClipSrc` — durable URL for explicit repair

### UI

- Per-clip badges on `TimelineClip.vue`
- Summary banner when any non-cloud issues exist
- Selected-clip panel with warning + **Repair clip media from asset**
- Repair updates `src` on linked clips sharing `assetId` and persists (local + cloud via existing hook)

### Runtime resolve (no auto-overwrite)

On load/playback, recoverable clips resolve playback from `assetId` + project asset list. Timeline document unchanged until user repairs or edits.

### Verification

```bash
node scripts/verify-timeline-persistence.mjs
```

### Known limitations (PASS 30)

- Repair requires asset still in project library
- URL-only clips without `assetId` cannot be auto-repaired
- Asset list loaded once per editor mount (not live-synced)
- Export still uses `resolveSrc`; missing blob clips fail at export time

### Recommended next timeline pass (PASS 31)

~~Offline cloud save queue for editor edits; reconcile on reconnect.~~ **Stability checkpoint — see PASS 31 below.**

---

## PASS 31 Implementation Note (2026-06-29)

**Status:** Stability audit of PASS 28–30. Bug fixes only — no new timeline features.

### Stability audit summary

| Area | Status |
|------|--------|
| Cloud load (GET) | Owner-secured; cloud-first on timeline page |
| Cloud save (PUT) | Debounced 1.5s; localStorage on every edit |
| localStorage backup | `saveTimelineToStorage` on all editor mutations + append sync |
| Append handoff | Cloud POST first; local sync from cloud document on success |
| assetId | Preserved in append, normalize, migrate, repair |
| Media badges | `classifyTimelineClipMedia` + per-clip UI badges |
| Repair scope | Linked video/audio pair only (not all clips sharing assetId) |
| Bible writes | None in timeline routes |

### Bugs found and fixed

1. **PUT could overwrite cloud without revision** — When client `revision` was 0 but a cloud row existed (e.g. after append while page had stale state), PUT skipped conflict check. **Fix:** server requires `baseRevision` on all updates; client sends revision when cloud is known.

2. **Stale revision after external append** — Open editor did not refresh cloud revision after handoff append. **Fix:** timeline page watches `timelineClipPushed`, cancels pending debounced PUT, refetches cloud.

3. **Repair affected unrelated clips** — `repairClipMedia` updated every clip with matching `assetId`. **Fix:** scope to selected clip + `linkedVideoId` / `linkedAudioId` only.

4. **409 left client revision stale** — **Fix:** `saveCloud` refetches cloud on 409 to resync revision in status UI.

### PUT vs POST append race analysis

| Scenario | Behavior |
|----------|----------|
| Append then debounced PUT | PUT sends stale `baseRevision` → **409** (safe) |
| PUT in flight + append | Append increments revision; PUT may 409 |
| Append while editor open | Page refetches revision; editor reloads local from push event |
| Pending PUT + append | Pending save cancelled on clip-push watch |

POST append does not require `baseRevision` (load-merge-save). PUT always requires matching revision when row exists.

### Remaining weak spots (UX)

- 409 requires manual page reload to merge editor state with cloud
- No offline save queue
- Open editor does not auto-merge cloud document after append (only localStorage reload)
- Blob audio clips still break after reload
- URL-only clips without `assetId` cannot be repaired
- Toolbar still dense; no track mute/solo

### Verification

```bash
node scripts/verify-timeline-persistence.mjs
node scripts/verify-production-bible.mjs
```

### Recommended next 5 passes

1. **PASS 35 — Observability backfill (manual)** — Stamp `generation_observability` on inferable assets.
2. **PASS 36 — Link clip to asset tool** — Attach `assetId` to URL-only timeline clips.
3. **PASS 37 — Prompt-stack consolidation (audit P1)** — Unify duplicate prompt builders.

---

## PASS 32 Implementation Note (2026-06-29)

**Status:** Conflict merge UX for cloud save 409 responses. No editor redesign, no offline queue.

### Prior 409 behavior (PASS 31)

- Generic error: “Reload the page to sync”
- Auto `fetchCloud()` with no user choice
- Editor state unchanged; user confused

### New behavior

On PUT **409**:

1. Apply server timeline revision from error payload
2. Set `conflictActive` + sync status **Conflict**
3. Cancel pending debounced saves
4. Show alert: **“Cloud timeline changed while you were editing.”**

### User actions

| Action | Behavior |
|--------|----------|
| **Reload cloud timeline** | `snapshotTimelineLocalBackup()` first; load cloud into editor; localStorage backup untouched; status → Synced |
| **Keep my local version** | Dismiss conflict; status → Local changes pending; no auto cloud save |
| **Save my version over cloud** | Confirm dialog; PUT with latest `baseRevision`; status → Synced on success |

### Sync status labels

| Status | When |
|--------|------|
| **Synced** | Cloud loaded, no conflict, no pending local-only changes |
| **Local changes pending** | User kept local after conflict, or local-only import dismissed |
| **Conflict** | Active 409 — choices required |
| **Local only** | No cloud timeline row |

### Files

- `lib/timeline-sync-status.ts`
- `lib/timeline-editor/local-backup.ts` — `snapshotTimelineLocalBackup`
- `composables/useProjectTimeline.ts` — conflict state + actions
- `pages/projects/[projectId]/timeline.vue` — conflict banner + status labels

### Known limitations (PASS 32)

- No diff preview between cloud and local documents
- Reload cloud does not auto-merge clip-level changes
- External append while editing may trigger conflict on next save (by design)
- Offline queue still not implemented

### Recommended next pass (PASS 33)

Offline cloud save queue for editor PUT when network unavailable.

---

## PASS 33 Implementation Note (2026-06-29)

**Status:** Offline / network-failure cloud save queue for timeline editor PUT. No append POST queue, no editor redesign.

### Queue record (`localStorage`)

Key: `aie_timeline_cloud_save_queue_<projectId>`

| Field | Purpose |
|-------|---------|
| `projectId` | Project scope |
| `document` | Timeline snapshot at queue time (coalesced on each edit) |
| `baseRevision` | Known cloud revision when queued |
| `queuedAt` | First queue timestamp |
| `lastAttemptAt` | Last flush attempt |
| `attemptCount` | Flush retry count |
| `lastError` | Last failure message |
| `status` | `pending` \| `flushing` \| `failed` |

### Queue when

- Browser offline (`navigator.onLine === false`)
- Network / fetch failure
- Server unavailable (500, 502, 503, 504)

### Do NOT queue when

- 401 / 403 auth errors
- 409 revision conflict (shows PASS 32 conflict UX)
- 400 / 422 validation errors

### Flush behavior

- Auto-flush on `window` `online` event
- Auto-flush on timeline page mount when queue exists
- Manual **Retry cloud sync**
- 409 during flush → conflict UX; queue retained until resolved
- Success → queue cleared

### UI

- Sync status **Queued for cloud sync**
- Pending count, attempt count, last error
- **Retry cloud sync** / **Clear queued save** (confirmed)

### Files

- `lib/timeline-editor/cloud-save-queue.ts`
- `lib/timeline-cloud-save-error.ts`
- `lib/timeline-sync-status.ts` — `queued` label
- `composables/useProjectTimeline.ts`
- `pages/projects/[projectId]/timeline.vue`

### Known limitations (PASS 33)

- Append POST (`/timeline/clips`) not queued separately — only editor PUT document
- One coalesced queue entry per project (latest snapshot)
- No background sync when timeline tab is closed (flush on next visit or reconnect while open)
- Auth errors require re-login; queue not auto-retried

### Recommended next pass (PASS 34)

Review dashboard reads timeline queue + media reliability via `countTimelineCloudSaveQueue` and `timelineMediaReliabilitySummary` (see `lib/project-review-dashboard.ts`). No timeline save behavior changed.

---

## PASS 34 cross-reference (review dashboard)

The project review dashboard (`/projects/:id/review`) surfaces read-only timeline status:

- Cloud timeline exists / local-only backup
- Queued cloud save (PASS 33 queue helper)
- Missing media, local blob, recoverable clip counts (PASS 30 media reliability)

No changes to timeline persistence or save flows.


