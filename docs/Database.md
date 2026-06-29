# AI Elegance — Database

PocketBase is the system of record for creative data. This document describes collections, relationships, field semantics, and the evolution toward a fully relational Film OS schema.

Setup: `npm run setup-db` → `scripts/setup-collections.js`  
Migrations for existing installs: `scripts/add-fields-to-collections.js`

---

## Entity Relationship Overview

```
users
  │
  ├── creative_projects ─────┬── creative_scenes ─── creative_shots
  │                          ├── creative_characters
  │                          └── project_assets
  │
  └── creative_scripts (Script Wizard library, optional project link)
```

**Cascade deletes:** Deleting a `creative_projects` row cascades to its scenes, characters, shots, and assets.

---

## Collections

### `users` (built-in)

Authentication via email/password. Optional `name`. All creative rows reference `owned_by` → `users`.

---

### `creative_projects`

The root entity for a film.

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation → users | Required; drives API rules |
| `name` | text | Display title |
| `aspect_ratio` | select | `16:9`, `9:16`, `1:1` |
| `goal` | select | `film`, `social`, `commercial`, `other` |
| `workflow_mode` | select | `import`, `idea`, `generate`, `scratch` |
| `preferred_model_id` | text | Default OpenRouter model |
| `target_length` | select | `spot`, `short`, `music_video`, `episode`, `feature` |
| `target_duration_seconds` | number | 15–3600; drives scene/shot scale |
| `synopsis` | text | Logline / short summary |
| `treatment` | text | Long-form story document |
| `concept_notes` | text | Idea workflow notes |
| `genre` | text | |
| `tone` | text | Project-level tone |
| `themes` | json | String array |
| `source_filename` | text | Original import filename |
| `director` | json | `ProjectDirector` — see [DirectorAI.md](./DirectorAI.md) |
| `continuity_memory` | text | Free-form production bible (AI + user) |
| `continuity_last_issues` | text | Last continuity check output (UI) |

**TypeScript mirror:** `types/creative-project.ts` → `CreativeProject`, `ProjectDirector`

---

### `creative_scenes`

Structured screenplay scenes — not a single blob.

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation → users | |
| `project` | relation → creative_projects | Cascade delete |
| `sort_order` | number | Scene order in film |
| `heading` | text | e.g. `INT. WAREHOUSE - NIGHT` |
| `summary` | text | Beat summary for AI context |
| `body` | text | Scene screenplay content |

**Future fields (planned):** `location`, `time_of_day`, `characters_present` (relations or JSON IDs)

---

### `creative_characters`

Canonical cast members — **one row per character per project**.

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation → users | |
| `project` | relation → creative_projects | Cascade delete |
| `name` | text | Canonical display name |
| `role_description` | text | Role / legacy visual prompt |
| `screen_share_percent` | number | 0–100 dialogue/presence estimate |
| `voice_description` | text | Voice bible (not TTS config) |
| `appearance_description` | text | Locked visual anchor |
| `personality` | text | Performance continuity |
| `signature_details` | text | Props, tics, recurring details |
| `avoid_description` | text | Per-character negative / never show |

**Assets:** Featured portraits live in `project_assets` with `metadata.character_id` (and `kind: character`). See `server/utils/project-character-prompt-refs.ts`.

**Rule:** Do not copy `appearance_description` into every shot. Resolve at prompt build time.

---

### `creative_shots`

Storyboard / production units within a scene.

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation → users | |
| `project` | relation → creative_projects | Optional but recommended |
| `scene` | relation → creative_scenes | Required; cascade delete |
| `sort_order` | number | Order within scene |
| `title` | text | Shot label |
| `description` | text | Action / staging |
| `shot_type` | text | e.g. close-up, wide |
| `camera_move` | text | e.g. dolly in, static |
| `duration_seconds` | number | Planned duration |
| `image_prompt` | text | Frame generation prompt (often unified) |
| `video_prompt` | text | Motion / video prompt |
| `negative_prompt` | text | App-level; add to schema via migration if missing |

**TypeScript mirror:** `types/creative-shot.ts` → `CreativeShot`

**Future:** `character_ids` relation array; `approved_frame_asset_id`; `generation_history` json

---

### `project_assets`

Per-project media library.

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation → users | |
| `project` | relation → creative_projects | Optional (standalone script assets) |
| `kind` | select | `script`, `character`, `storyboard`, `video`, `other` |
| `title` | text | |
| `notes` | text | |
| `metadata` | json | **Linkage and generation provenance** |
| `sort_order` | number | |
| `file` | file | Optional attachment |

#### Metadata conventions (use consistently)

```json
{
  "character_id": "pb_character_record_id",
  "scene_id": "pb_scene_record_id",
  "shot_id": "pb_shot_record_id",
  "source": "storyboard_frame | video_generation | upload",
  "model_id": "openrouter/model",
  "prompt_hash": "optional dedup key",
  "width": 1920,
  "height": 1080
}
```

Every upload and generation should populate relevant IDs so assets are queryable by story position.

---

### `creative_scripts` (Script Wizard)

Standalone script library for the Script Wizard tool — parallel to project-embedded screenplay.

| Field | Type | Notes |
|-------|------|-------|
| `owned_by` | relation → users | |
| `status` | select | `draft`, `in_progress`, `final` |
| `script_text` | text | |
| `comparable_titles` | json | |
| `file` | file | |

**Long-term:** Promote to project-attached script versions rather than a separate silo.

---

## API Rules Pattern

Creative collections use owner-scoped rules:

```
list/view/create/update/delete:
  @request.auth.id != "" && owned_by = @request.auth.id
```

Server routes additionally verify ownership before mutating.

---

## Mappers

| File | Role |
|------|------|
| `server/utils/creative-project-map.ts` | PB ↔ `CreativeProject`, director JSON |
| `server/utils/creative-character-map.ts` | PB ↔ `CreativeCharacter` |
| `server/utils/creative-shot-map.ts` | PB ↔ `CreativeShot` |
| `server/utils/project-asset-map.ts` | PB ↔ asset DTO + metadata parse |

Always map through these — do not ad-hoc field names in UI.

---

## Planned Collections (Roadmap)

| Collection | Purpose |
|------------|---------|
| `creative_decisions` | Append-only audit: entity, field, old, new, actor, source |
| `guide_messages` | Project Guide chat persistence |
| `generation_jobs` | Durable shot/frame/video job state |
| `shot_characters` | Junction: shot ↔ character with role in frame |

Prefer **junction tables** over duplicating names in `image_prompt`.

---

## Indexing & Query Patterns

| Query | Filter |
|-------|--------|
| All scenes in project | `project = "{id}"` sort `sort_order` |
| All shots in scene | `scene = "{id}"` sort `sort_order` |
| All characters in project | `project = "{id}"` sort `name` |
| Assets for character | `project = "{id}"` + metadata filter client-side or indexed JSON |
| Assets for shot | `metadata.shot_id` |

At scale, add PocketBase indexes and paginate shot lists per scene.

---

## Local vs Cloud Projects

`useCreativeProject` supports `source: 'local'` (localStorage demo projects) and `source: 'pocketbase'`. **Film OS features** (Guide, import, generation) require cloud projects. Local is for offline demos only.

---

## Related Documents

- [Architecture.md](./Architecture.md)
- [Roadmap.md](./Roadmap.md) — Phase 1–2 schema work
- [COLLECTIONS_SETUP.md](../COLLECTIONS_SETUP.md) — operational setup guide
