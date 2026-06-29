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
