# AI Elegance — Production Bible / Knowledge Layer Design

**Status:** Design + PASS 6–16 (legacy seeded fact remediation tool).  
**Date:** 2026-06-29  
**Context:** Builds on P0 remediation in `docs/ArchitectureAudit.md`: continuity is live, generation endpoints are protected, prompt assembly collision is resolved, and Scene now has a canonical type/mapper.

---

## Goal

The Production Bible / Knowledge Layer becomes the source of truth for creative memory across a project. It should let AI Elegance answer:

- Who or what exists in this universe?
- What facts are locked, tentative, contradicted, retired, or generated?
- Which scenes, shots, assets, timeline clips, and prompts depend on those facts?
- Who or what made a creative decision, when, and why?
- Which compact context should an AI model receive for a given task?

The design must preserve the existing workflow:

```text
Project -> Scene -> Shot -> Asset -> Timeline
```

The Knowledge Layer adds graph and provenance capability around that workflow; it should not replace the workflow in one risky rewrite.

---

## Current Creative Memory Audit

### Project Fields

Current memory:

- `creative_projects.synopsis`
- `treatment`
- `concept_notes`
- `genre`
- `tone`
- `themes`
- `workflow_mode`
- `target_length`
- `target_duration_seconds`
- `preferred_model_id`
- `director` JSON
- `continuity_memory`
- `continuity_last_issues`

What should move into the Production Bible:

- Stable world facts currently embedded in `synopsis`, `treatment`, and `concept_notes`
- Canonical rules extracted from `continuity_memory`
- Director rules that are stable enough to reference as decision/fact records
- AI-discovered project facts from script import, Guide, and continuity checks

What should remain on Project:

- Identity and workflow metadata: name, aspect ratio, goal, workflow mode, preferred model, target length/duration
- Human-facing story documents: synopsis, treatment, concept notes
- Transitional `director` JSON and `continuity_memory` until migrated
- `continuity_last_issues` as a latest-status display cache

Rationale: Project remains the production container and high-level editorial surface. The Bible stores reusable, attributable facts and relationships extracted from or linked to Project fields.

### Character Records

Current memory:

- `creative_characters.name`
- `role_description`
- `screen_share_percent`
- `voice_description`
- `appearance_description`
- `personality`
- `signature_details`
- `avoid_description`
- Portrait references through `project_assets.metadata.character_id`

What should move into the Production Bible:

- Character identity and aliases
- Appearance locks
- Wardrobe, props, powers, species, voice, personality, taboos
- Character relationships: parent/child, ally/enemy, same organization, owns prop, appears in scene/shot
- Character versions when a look or personality changes across time

What should remain on Character:

- Existing project-scoped cast row as the main UI/editor record
- Current editable fields as denormalized working fields during migration
- `screen_share_percent` as production planning metadata

Rationale: Characters already have the strongest entity shape. They should become or link to Bible entities rather than be duplicated into a parallel character system immediately.

### Scene Summaries

Current memory:

- `creative_scenes.heading`
- `summary`
- `body`
- Sort order

What should move into the Production Bible:

- Locations referenced by scene headings/bodies
- Time-of-day and timeline placement
- Events that happen in the scene
- Entities present in the scene
- Continuity facts introduced by the scene

What should remain on Scene:

- Ordered screenplay structure: heading, summary, body
- Scene remains the production unit for shot generation

Rationale: Scene is a narrative container. Extracted events and entities belong in the Bible, but the screenplay text remains on Scene.

### Shot Prompts

Current memory:

- `creative_shots.description`
- `shot_type`
- `camera_move`
- `duration_seconds`
- `image_prompt`
- `video_prompt`
- `negative_prompt`

What should move into the Production Bible:

- References to characters/locations/props present in a shot
- Generated prompt bundles and their dependency list
- Continuity assertions discovered during shot generation
- AI decisions that changed or repaired shot content

What should remain on Shot:

- Production unit fields: title, description, shot type, camera move, planned duration
- Transitional stored prompt fields while prompt assembly is being migrated
- Shot-level exclusions or overrides that are truly local to one shot

Rationale: Shot prompts should become generated views over canonical context, not the only place where creative facts live.

### Director Bible

Current memory:

- `creative_projects.director` JSON:
  - name
  - style
  - tone
  - camera preferences
  - lighting style
  - pacing

What should move into the Production Bible:

- Stable director rules as attributable creative decisions
- Style rules with scope: project, sequence, scene, shot, asset type
- Revisions of director rules

What should remain on Project:

- Current `director` JSON as the editable UI source in early phases
- A derived/current director snapshot for compatibility with existing prompt assembly

Rationale: Director is both a UI surface and a source of rules. The first phase should mirror it into Bible entries rather than replace it.

### Continuity Memory

Current memory:

- `creative_projects.continuity_memory` free text
- `continuity_last_issues` latest check result
- Continuity check `memoryAppend`

What should move into the Production Bible:

- Typed continuity facts
- Fact status: active, tentative, contradicted, retired
- Fact scope: project, act, scene, shot, character, location, prop
- Source attribution: user, Guide, continuity check, script import, generation job

What should remain on Project:

- `continuity_memory` as a backwards-compatible text projection while prompt builders still read it
- `continuity_last_issues` as a UI status cache

Rationale: Free text is useful for humans but weak for retrieval, dedupe, contradiction detection, and attribution.

### Asset Metadata

Current memory:

- `project_assets.kind`
- `title`
- `notes`
- `metadata` JSON with conventions:
  - `character_id`
  - `scene_id`
  - `shot_id`
  - `source`
  - `model_id`
  - prompt-related values
  - dimensions
  - featured flags

What should move into the Production Bible:

- Durable asset provenance
- Entity links for all generated/uploaded media
- Asset role: reference, approved frame, generated candidate, final clip, audio, script source
- Which facts/relationships the asset depicts or depends on

What should remain on Asset:

- File attachment and media-library display fields
- Existing metadata as compatibility and ingestion input

Rationale: Metadata is the current bridge. It should not be deleted, but important links should become queryable relationships.

### Timeline / localStorage

Current memory:

- `TimelineEditorDocument` in `localStorage` under `aie_timeline_editor_v2_<projectId>`
- Clips with optional `sceneId` and `shotId`
- Trim, track, source, duration, transitions

What should move into the Production Bible:

- Not the full editing document at first
- Clip-to-shot/scene/asset relationships once timeline is persisted server-side
- Timeline events that matter to continuity/story chronology

What should remain in Timeline:

- Editing state: clip positions, trims, transitions, track layout

Rationale: The timeline is an edit document, not the Bible. It should reference the Bible, and story-significant timeline events should be extractable from it later.

### Guide Chat / localStorage

Current memory:

- `GuideChatMessage[]` in `localStorage` under `aielegance-project-guide-<projectId>`
- Suggestions targeting project, director, and character fields
- User-approved patches applied to existing routes

What should move into the Production Bible:

- Approved suggestions as `decision` records
- Proposed but unapplied suggestions as optional draft/proposal records
- Guide-derived facts after approval

What should remain in Guide:

- Conversational transcript when persisted later
- Assistant reasoning and user dialogue, separate from canonical facts

Rationale: Chat is not source of truth. Approved decisions and extracted facts are.

---

## What Belongs in the Production Bible

Move or mirror the following over time:

- Canonical entities: characters, locations, props, creatures/species, organizations, technology, world rules
- Continuity facts and constraints
- Timeline/story events
- Scene and shot membership relationships
- Asset provenance and depiction links
- Director/style rules with scope
- AI and user decisions
- Prompt context bundles and dependency records

Do not move wholesale:

- Project workflow settings
- Full screenplay scene body
- Full shot list production fields
- Raw media files
- Timeline edit geometry
- Chat transcript as canonical truth

---

## Entity Model

### 1. `BibleEntity`

Canonical thing in the project universe.

Fields:

- `id`
- `owned_by`
- `project`
- `type`
  - `character`
  - `location`
  - `prop`
  - `creature`
  - `species`
  - `organization`
  - `technology`
  - `world_rule`
  - `event`
  - `style_rule`
  - `concept`
- `name`
- `slug`
- `aliases`
- `summary`
- `description`
- `status`
  - `active`
  - `draft`
  - `retired`
  - `contradicted`
- `confidence`
- `canonical_source`
- `created_by_actor`
- `created_by_source`
- `created`
- `updated`

Notes:

- Existing `creative_characters` should not be replaced immediately. A character entity can initially be linked one-to-one to a `creative_characters` row.
- `world_rule` and `style_rule` are entities because they need scope, attribution, and references.
- `event` can represent story chronology, production decisions, or continuity milestones depending on subtype.

### 2. `BibleFact`

Atomic claim about an entity or the project.

Examples:

- “Mara wears a red scarf after Scene 3.”
- “The East Wing is flooded.”
- “No humans exist in this animal-only story.”
- “The courier drone belongs to Orion Logistics.”

Fields:

- `id`
- `owned_by`
- `project`
- `entity` relation optional
- `fact_type`
  - `appearance`
  - `wardrobe`
  - `location_state`
  - `relationship`
  - `timeline`
  - `rule`
  - `style`
  - `negative_constraint`
  - `provenance`
- `statement`
- `structured_value` JSON
- `scope_type`
  - `project`
  - `sequence`
  - `scene`
  - `shot`
  - `asset`
  - `timeline`
- `scope_id`
- `status`
  - `active`
  - `tentative`
  - `contradicted`
  - `retired`
- `confidence`
- `source_type`
  - `user`
  - `script_import`
  - `guide`
  - `continuity_check`
  - `shot_generation`
  - `asset_generation`
  - `manual_edit`
- `source_id`
- `decision_id`
- `created`
- `updated`

Notes:

- Facts are finer-grained than entities.
- Facts can be retired without deleting history.
- Facts should be referenceable by prompts and continuity reports.

### 3. `BibleRelationship`

Typed edge between two entities or between an entity and an existing production object.

Fields:

- `id`
- `owned_by`
- `project`
- `from_type`
  - `bible_entity`
  - `project`
  - `scene`
  - `shot`
  - `asset`
  - `timeline_clip`
  - `generation_job`
- `from_id`
- `to_type`
- `to_id`
- `relationship_type`
- `role`
- `strength`
- `status`
- `source_type`
- `source_id`
- `decision_id`
- `created`
- `updated`

### 4. `CreativeDecision`

Attributable decision or change event.

Fields:

- `id`
- `owned_by`
- `project`
- `actor_type`
  - `user`
  - `ai`
  - `system`
- `actor_id`
- `source_type`
  - `guide`
  - `continuity_check`
  - `script_import`
  - `manual_edit`
  - `generation`
- `source_id`
- `target_type`
- `target_id`
- `field`
- `old_value`
- `new_value`
- `rationale`
- `status`
  - `proposed`
  - `approved`
  - `applied`
  - `rejected`
  - `reverted`
- `created`
- `applied_at`

Notes:

- This is not an audit log for every low-level save in phase one.
- It is the attribution layer for creative choices and AI-suggested changes.

### 5. `GenerationRecord`

Durable provenance for AI-generated outputs.

Fields:

- `id`
- `owned_by`
- `project`
- `kind`
  - `text`
  - `image`
  - `video`
  - `audio`
  - `shot_list`
  - `continuity_check`
- `provider`
- `model_id`
- `status`
- `prompt_bundle_id`
- `input_hash`
- `output_summary`
- `raw_output_asset`
- `scene`
- `shot`
- `asset`
- `decision_id`
- `created`
- `completed_at`

Notes:

- This can evolve from current in-memory job registries.
- It should link generated assets back to model, prompt bundle, scene/shot, and Bible dependencies.

### 6. `PromptBundle`

Snapshot of context used for an AI call.

Fields:

- `id`
- `owned_by`
- `project`
- `purpose`
  - `shot_generation`
  - `frame_generation`
  - `video_generation`
  - `continuity_check`
  - `guide`
  - `prompt_enhance`
- `scope_type`
- `scope_id`
- `rendered_prompt`
- `negative_prompt`
- `context_refs` JSON
- `included_fact_ids`
- `included_entity_ids`
- `included_relationship_ids`
- `token_estimate`
- `created`

Notes:

- Do not store prompt bundles for every tiny draft at first.
- Store them when they produce persisted assets, shots, or accepted decisions.

---

## Relationship Model

Use typed edges rather than duplicating names in prompt text.

Core relationship types:

| Type | Meaning | Examples |
|---|---|---|
| `appears_in` | Entity is present in scene/shot/asset | character -> shot, prop -> asset |
| `depicts` | Asset visually/audio depicts entity | image asset -> character |
| `references` | Object references fact/entity as context | prompt bundle -> fact |
| `owns` | Entity owns/uses another entity | character -> prop |
| `member_of` | Entity belongs to organization/species | character -> organization |
| `located_in` | Scene/event/entity occurs at location | scene -> location |
| `happens_before` | Timeline/story order | event -> event |
| `causes` | Event/fact causal link | event -> fact |
| `contradicts` | Fact conflicts with another fact | fact -> fact |
| `supersedes` | New fact/decision replaces old one | fact -> fact |
| `derived_from` | Entity/fact/asset came from source | fact -> script asset |
| `uses_style_rule` | Prompt/shot uses style rule | shot -> style_rule |
| `generated_from` | Asset produced by generation record | asset -> generation |
| `approved_for` | Asset is approved reference/final for target | asset -> shot/character |

Relationship direction should be consistent but queries must support both directions.

Rules:

- Prefer relationship rows for high-value edges: shot-character, asset-shot, asset-character, scene-location.
- Keep low-value text-only references as facts until they matter operationally.
- Never rely on display names as durable links once an entity exists.

---

## Suggested PocketBase Collections

### Phase 1 Collections

`production_bible_entities`

- `owned_by` relation users
- `project` relation creative_projects
- `type` select
- `name` text
- `slug` text
- `aliases` json
- `summary` text
- `description` text
- `status` select
- `confidence` number
- `canonical_source_type` text
- `canonical_source_id` text

`production_bible_facts`

- `owned_by`
- `project`
- `entity` relation production_bible_entities optional
- `fact_type` select/text
- `statement` text
- `structured_value` json
- `scope_type` select/text
- `scope_id` text
- `status` select
- `confidence` number
- `source_type` select/text
- `source_id` text
- `decision` relation creative_decisions optional

`production_bible_relationships`

- `owned_by`
- `project`
- `from_type` text
- `from_id` text
- `to_type` text
- `to_id` text
- `relationship_type` select/text
- `role` text
- `strength` number
- `status` select
- `source_type` text
- `source_id` text
- `decision` relation creative_decisions optional

`creative_decisions`

- `owned_by`
- `project`
- `actor_type`
- `actor_id`
- `source_type`
- `source_id`
- `target_type`
- `target_id`
- `field`
- `old_value`
- `new_value`
- `rationale`
- `status`
- `applied_at`

### Phase 2 Collections

`generation_records`

- Durable model/job provenance
- Can replace or complement in-memory registries

`prompt_bundles`

- Snapshot of rendered prompt and dependency refs
- Used for reproducibility and debugging

`guide_messages`

- Persisted guide transcript
- Not canonical by itself; approved suggestions generate decisions/facts

### Later Collections

`timeline_documents`

- Server-side timeline persistence

`timeline_clips`

- Optional normalized clip rows if collaborative editing needs queryable clips

`script_versions`

- Replace parallel script silos and preserve source revisions

---

## What Remains Where It Is

| Existing entity | Remains responsible for | Bible responsibility |
|---|---|---|
| Project | title, workflow, goal, aspect, synopsis/treatment, compatibility fields | extracted facts, rules, decisions |
| Character | cast editing UI, project-scoped character profile | identity graph, aliases, relationships, versioned facts |
| Scene | screenplay unit and shot-generation container | locations, events, entities present, scene facts |
| Shot | production unit, local staging/camera/duration | entity membership, prompt dependencies, continuity facts |
| Asset | file/media library | provenance, depictions, approvals, story links |
| Timeline | edit document | story-significant events and clip links |
| Guide chat | conversation UX | approved decisions/facts |

---

## Attribution and Versioning Needs

Every Bible write should answer:

- Who or what wrote this?
- Was it proposed, approved, applied, rejected, or inferred?
- What source text, AI response, asset, scene, shot, or user action caused it?
- What did it replace?
- Is it active, tentative, contradicted, or retired?

Minimum attribution fields:

- `source_type`
- `source_id`
- `actor_type`
- `actor_id`
- `decision_id`
- `confidence`
- `status`

Versioning strategy:

1. Use append-only `CreativeDecision` rows for meaningful creative edits.
2. Use `BibleFact.status = retired` plus `supersedes` relationships instead of deleting facts.
3. Keep current editable fields on Project/Character/Scene/Shot as the latest working view.
4. Add snapshots only when a generation or approval depends on them.

Do not version every keystroke. Version accepted creative state changes.

---

## Prompt Assembly Consumption

Current prompt assembly reads:

- Project director JSON
- Project continuity memory text
- Scene heading/summary
- Shot fields
- Character rows
- Asset portraits
- Shot/scene inferred cast membership

Target prompt assembly should use a Knowledge Context Loader:

```text
loadKnowledgeContext(projectId, scope)
  -> project snapshot
  -> scene/shot production fields
  -> relevant Bible entities
  -> relevant active facts
  -> relevant relationships
  -> approved asset references
  -> director/style rules
  -> exclusions and constraints
  -> attribution/debug refs
```

Context selection rules:

1. Always include direct scope facts: current shot, scene, selected character/entity.
2. Include project-wide active rules and director/style rules.
3. Include linked entities through relationships, not name matching.
4. Include compact summaries before full descriptions.
5. Include fact IDs internally for traceability; omit IDs from model-facing prose unless useful.
6. Render prompt text from structured refs at call time.
7. Do not store full director/cast/continuity blocks inside shot prompts as the only truth.

Prompt bundle example:

```json
{
  "purpose": "frame_generation",
  "scope_type": "shot",
  "scope_id": "shot_123",
  "included_entity_ids": ["char_mara", "loc_east_wing"],
  "included_fact_ids": ["fact_red_scarf", "fact_flooded_floor"],
  "included_relationship_ids": ["rel_mara_appears_shot_123"],
  "rendered_prompt": "..."
}
```

Migration bridge:

- Continue writing `image_prompt`, `video_prompt`, and `negative_prompt`.
- Begin storing `PromptBundle` only for persisted generations.
- Later, make stored prompts cached render outputs rather than editable primary truth.

---

## Continuity Write-Back

Current continuity behavior:

```text
checkShotsContinuity
  -> issues
  -> repaired shots
  -> memoryAppend
  -> persistContinuityCheckOnProject
```

Target behavior:

```text
checkShotsContinuity
  -> issues
  -> suggested shot repairs
  -> proposed Bible facts
  -> proposed relationship updates
  -> continuity decision records
  -> compatibility projection to continuity_memory
```

Write-back rules:

1. If continuity status is `skipped`, `failed`, or `unavailable`, do not write facts.
2. If status is `ran`, write:
   - issue records or latest issue summary
   - proposed facts with `source_type = continuity_check`
   - `confidence` and `status = tentative` unless auto-approval is explicitly safe
3. User-visible approvals should promote facts to `active`.
4. Contradictions should create `contradicts` relationships, not overwrite history.
5. Keep appending a readable projection to `continuity_memory` during migration.

First continuity fact extraction examples:

- Character wardrobe locks
- Location state changes
- Prop ownership/presence
- World-rule violations
- Scene-to-scene chronology facts

---

## Generated Assets Attachment

Generated images/videos/assets should attach to the Bible through three layers:

### 1. Existing `project_assets`

Continue storing:

- file
- kind
- title
- notes
- metadata

Required metadata during migration:

- `source`
- `model_id`
- `scene_id`
- `shot_id`
- `character_id` when applicable
- `prompt_bundle_id` when available
- `generation_record_id` when available

### 2. `GenerationRecord`

Store:

- model/provider
- status
- prompt bundle
- output asset
- scene/shot links
- error/result summary

### 3. Bible Relationships

Create relationships:

- asset `generated_from` generation record
- asset `depicts` character/location/prop
- asset `approved_for` shot or character when user marks it featured/approved
- prompt bundle `references` facts/entities/relationships

This avoids trying to infer all asset meaning from `metadata` forever.

---

## Migration Strategy

### Phase 0 — Keep Current Workflow Stable

No runtime behavior changes.

- Keep Project, Character, Scene, Shot, Asset, Timeline as-is.
- Keep `continuity_memory` and prompt fields.
- Do not require Bible records for generation.

### Phase 1 — Mirror Existing Memory Into Bible

Add collections and mappers.

Backfill:

- One `BibleEntity` per `creative_character`
- One entity/fact set for director rules
- Facts from `continuity_memory` as tentative text facts
- Relationships from existing asset metadata:
  - asset -> character
  - asset -> scene
  - asset -> shot

Keep existing UI unchanged.

### Phase 2 — Relationship-First Shot Context

Add explicit relations:

- shot -> character
- scene -> character
- scene -> location
- asset -> shot/character/location

Update prompt context loaders to prefer relationships over name matching, with fallback to current heuristics.

### Phase 3 — Continuity Facts and Approval

Continuity check writes proposed facts and relationships.

- Show proposed Bible updates in Scenes/Director/Guide.
- User approves or rejects.
- Approved facts update the compatibility `continuity_memory` projection.

### Phase 4 — Prompt Bundles and Generation Records

Persist prompt bundles and generation records for outputs.

- Images/videos attach to bundle and Bible refs.
- Debugging can answer “why did this model generate that?”
- Re-run generation from the same dependency set.

### Phase 5 — Guide and Timeline Persistence

Persist Guide messages and timeline documents.

- Approved Guide suggestions produce decisions/facts.
- Timeline clips link to assets/shots/scenes.
- Story-significant timeline events can become Bible facts.

### Phase 6 — Reduce Denormalized Prompt Text

Once prompt bundles and context loaders are reliable:

- Treat shot prompt fields as editable overrides/cache.
- Stop embedding full cast/director Bible into every stored prompt.
- Regenerate prompt cache from Bible dependencies when needed.

---

## Risks and Tradeoffs

### Risk: Over-modeling too early

The Bible could become a complex ontology before the product needs it.

Mitigation:

- Start with generic entities, facts, relationships, decisions.
- Use typed `type` and `relationship_type` fields before many specialized collections.
- Promote specialized structures only after repeated use.

### Risk: Prompt quality regression

Existing prompts work because they inline lots of context.

Mitigation:

- Keep current prompt fields during migration.
- Add Knowledge Context as an additional context source first.
- Store prompt bundles to compare before/after outputs.

### Risk: AI writes noisy or wrong facts

Continuity and Guide could pollute the Bible.

Mitigation:

- AI writes tentative/proposed facts by default.
- User approval promotes to active.
- Keep source/confidence/status visible.

### Risk: Duplicate facts

Script import, Guide, continuity, and manual edits may create near-duplicates.

Mitigation:

- Normalize entity names and aliases.
- Dedupe by entity + fact type + normalized statement.
- Use `supersedes` rather than overwrite.

### Risk: Migration confusion

Data may exist in both legacy fields and Bible records.

Mitigation:

- Define compatibility projections.
- Mark one source of truth per phase.
- Add verification scripts for backfill and projection consistency.

### Risk: PocketBase scaling

Fact/relationship rows can grow quickly.

Mitigation:

- Index by project, entity, scope, relationship type.
- Use pagination and scoped loaders.
- Avoid writing prompt bundles for every ephemeral draft.

---

## First Buildable Slice

The first slice should be deliberately narrow:

### Slice: Character and Asset Knowledge Mirror

Build:

1. `production_bible_entities`
2. `production_bible_relationships`
3. Mapper utilities
4. Backfill from existing `creative_characters`
5. Backfill from `project_assets.metadata.character_id`, `scene_id`, `shot_id`
6. Read-only Bible inspection panel or debug route
7. Verification script that checks:
   - every character has a Bible entity
   - featured character assets link to character entity
   - storyboard/video assets link to scene/shot when metadata exists

Do not yet:

- Change prompt generation behavior
- Change continuity write-back
- Replace character UI
- Replace asset metadata
- Persist Guide/timeline

Why this slice:

- Low risk: mirrors existing data.
- High leverage: creates reusable IDs and relationship queries.
- Provides immediate foundation for shot-character relationships and prompt context.

---

## Explicit Do Not Build Yet

Do not build these in the first implementation slice:

- Full ontology for every media type
- Per-shot fact extraction from all prompts
- Automatic AI fact approval
- Import-time continuity
- Decision audit for every field save
- Timeline server persistence
- Guide chat persistence
- Prompt bundle storage for every model call
- Replacement of `creative_characters`
- Replacement of `continuity_memory`
- Replacement of shot prompt fields
- Migration that rewrites all existing prompts
- A new UI that bypasses the existing project workflow

Do not make the Bible mandatory for existing project -> scene -> shot generation until read-only mirroring and fallbacks have shipped.

---

## Design Invariants

1. Existing entities remain valid.
2. Relationships beat duplicated names.
3. Facts are attributable.
4. AI writes are proposed or tentative until trusted.
5. Prompt text is a rendered view of context, not the permanent source of truth.
6. Assets know what they depict and how they were made.
7. Timeline and Guide are important memory surfaces, but not first-slice blockers.
8. Migration proceeds by mirroring, then preferring, then replacing.

---

## Open Questions

1. Should Bible entities be project-scoped only at first, or allow studio/global reuse immediately?
2. Should `creative_characters` become a specialized view over `BibleEntity`, or remain a separate production table indefinitely?
3. Which AI writes can be auto-approved safely, if any?
4. How much raw prompt text should be retained for privacy/cost/debugging?
5. Should facts support embeddings/search in PocketBase-adjacent storage later?
6. How should contradictions be surfaced to the user: Director tab, Scenes tab, Guide, or a dedicated Bible UI?

---

## Verification for Future Implementation

When implementation starts, add scripts that verify:

- Every project has zero or one current Bible root/index.
- Every `creative_character` maps to exactly one active character Bible entity.
- No asset with `metadata.character_id` lacks an entity relationship.
- No storyboard/video asset with `metadata.shot_id` lacks a shot relationship.
- Continuity facts preserve source attribution.
- Prompt bundles list dependency IDs.
- Legacy `continuity_memory` projection matches active continuity facts for migrated projects.

For now, this document is the design artifact only.

---

## PASS 6 Implementation Note (2026-06-29)

**Status:** Foundation slice shipped (backend/data layer only).

### Collections

Runtime collection names (shorter than the Phase 1 design names):

| Collection | Purpose |
|------------|---------|
| `bible_entities` | Canonical universe objects per project |
| `bible_facts` | Atomic attributable claims |
| `bible_relationships` | Typed edges between bible/production objects |

Provision with:

```bash
node scripts/setup-collections.js
```

All three collections use owner-scoped PocketBase rules (`owned_by = @request.auth.id`), `project` relation with cascade delete, and the same auth pattern as `creative_scenes`.

### Types

- `types/bible-entity.ts` — `BibleEntity`, `BibleEntityType`, `BibleEntityStatus`
- `types/bible-fact.ts` — `BibleFact`, fact/scope status enums
- `types/bible-relationship.ts` — `BibleRelationship`, endpoint types

PocketBase field `entity_type` maps to canonical `BibleEntity.type`.

### Server utilities

| Module | Role |
|--------|------|
| `server/utils/bible-entity-map.ts` | `pbRecordToBibleEntity`, `projectIdOnBibleEntityRow` |
| `server/utils/bible-fact-map.ts` | `pbRecordToBibleFact`, `projectIdOnBibleFactRow`, `entityIdOnBibleFactRow` |
| `server/utils/bible-relationship-map.ts` | `pbRecordToBibleRelationship`, `projectIdOnBibleRelationshipRow` |
| `server/utils/bible-project-access.ts` | `requireProjectOwner`, `requireOwnedProjectRow` |
| `server/utils/bible-validation.ts` | Entity type, name, fact statement, endpoint, projectId validation |
| `server/utils/bible-endpoint-access.ts` | `assertBibleEndpointInProject` for relationship endpoints |

### API routes

All routes are under `/api/projects/:id/bible/` and require a PocketBase user Bearer token.

| Resource | List | Create | Get | Update | Delete |
|----------|------|--------|-----|--------|--------|
| Entities | `GET …/entities` | `POST …/entities` | `GET …/entities/:entityId` | `PATCH …/entities/:entityId` | `DELETE …/entities/:entityId` |
| Facts | `GET …/facts?entityId=` | `POST …/facts` | `GET …/facts/:factId` | `PATCH …/facts/:factId` | `DELETE …/facts/:factId` |
| Relationships | `GET …/relationships?fromId=&toId=` | `POST …/relationships` | `GET …/relationships/:relationshipId` | `PATCH …/relationships/:relationshipId` | `DELETE …/relationships/:relationshipId` |

### Security model

1. `getPocketBaseUserIdFromRequest` — unauthenticated requests are rejected.
2. Project row loaded; `pbRecordOwnerId(project) === userId` or **403**.
3. Nested reads/writes load the target row; owner must match user.
4. `projectIdOn*Row(row) === route projectId` or **400**.
5. Facts with `entityId` verify the entity belongs to the same project.
6. Relationship endpoints of type `bible_entity`, `scene`, `shot`, `asset`, or `project` are verified in-project; `timeline_clip` / `generation_job` accept type/id format only (not persisted yet).

### Verification

```bash
node scripts/verify-production-bible.mjs
```

### Known limitations (PASS 6)

- No UI, prompt assembly changes, character/scene/shot backfill, or AI agents.
- No `CreativeDecision`, `GenerationRecord`, or `PromptBundle` collections.
- No slug uniqueness enforcement across a project.
- No embedding/search, contradiction engine, or automatic fact extraction.
- Relationship endpoint validation is best-effort for not-yet-persisted types (`timeline_clip`, `generation_job`).
- Design doc Phase 1 names (`production_bible_*`) differ from implemented `bible_*` names; treat this note as the runtime source of truth until a rename migration is intentional.

---

## PASS 7 Implementation Note (2026-06-29)

**Status:** Basic project-level UI shipped.

### Page and navigation

- Route: `/projects/:projectId/bible`
- Sidebar: **Tools → Production Bible** (alongside Project Guide)
- Page: `pages/projects/[projectId]/bible.vue`
- Panel: `components/project/ProductionBiblePanel.vue`
- API client: `composables/useProductionBible.ts`

### User flow

1. Open a signed-in cloud project → **Production Bible** in the Tools section.
2. **Entities** (left): grouped by type; **+ Add** creates a new entity.
3. Select an entity → edit name, type, status, summary, description; **Save** / **Delete**.
4. **Facts**: add statement (+ optional fact type); edit or delete inline.
5. **Relationships**: add outgoing or incoming edges; pick another bible entity from a dropdown or paste a scene/shot/asset id; edit type/role/status or delete.

### Empty states

- No entities yet — dashed panel with guidance to add universe objects.
- No facts yet — shown when a selected entity has no facts.
- No relationships yet — shown when the selected entity has no edges.
- No selection — prompts to select or create an entity.

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual smoke test (requires PocketBase collections from PASS 6):

1. Sign in, open a cloud project, go to **Production Bible**.
2. Create a `character` entity, save summary text.
3. Add a fact on that entity; confirm it persists after reload.
4. Add a relationship to another entity or paste a scene id; confirm list updates.

### Known limitations (PASS 7)

- No prompt assembly, cast/scene migration, or AI write-back.
- Relationship targets other than `bible_entity` require raw PocketBase ids (no scene/shot pickers).
- No slug/alias editor, structured fact values, or confidence/provenance fields in the UI.
- Deleting an entity does not cascade-delete its facts in PocketBase (facts may orphan until cleaned up).
- Not linked from Director tab or Guide suggestions yet.

---

## PASS 8 Implementation Note (2026-06-29)

**Status:** Manual project seed action shipped.

### Route

`POST /api/projects/:id/bible/seed`

Body: `{ dryRun?: boolean }` — when `true`, returns a preview without writing.

Response: `{ seed: BibleSeedResult }`

### Seeding rules

| Source | Creates |
|--------|---------|
| `creative_characters` | `character` entities + profile facts (appearance, role, personality, voice, signature, avoid) |
| `creative_scenes.heading` | `location` entities when slug line parses (`INT./EXT. LOCATION`) |
| `project_assets.metadata` | `prop` / `creature` / etc. only when `bible_entity_type` + `bible_entity_name` present |
| Character name in scene text | `appears_in` relationship → `scene` |
| `creative_shots` | `belongs_to` relationship → parent `scene` |
| `project_assets.metadata.character_id` | `depicts` relationship → character bible entity |
| `project_assets.metadata.scene_id` | `depicts` relationship → `scene` |

Provenance on seeded rows: `source_type: project_seed` or `creative_character`, `actor_type: system`, `actor_id: project_seed`.

**Default statuses (PASS 13):** entities and relationships → `tentative`; facts → `needs_review` (excluded from prompt context until approved via PASS 12 workflow).

### Duplicate prevention

- **Entities:** `project + entity_type + normalized name` — existing rows are never updated.
- **Facts:** `entity + normalized statement` — skipped if already present.
- **Relationships:** normalized `(fromType, fromId, toType, toId, relationshipType)` — skipped if already present.
- Re-running seed is safe; counts reflect only new rows.

### UI

**Seed from Project** on Production Bible page → preview modal → **Create entries** applies.

### Verification

```bash
node scripts/verify-production-bible.mjs
```

### Known limitations (PASS 8)

- Not automatic on project load; user must click seed.
- No prompt assembly or cast row backfill.
- Character `appears_in` scene uses name matching only (no small-cast fallback).
- Props/creatures only from explicit asset metadata fields, not inferred from shot copy.
- Does not seed shot-level character edges or location→scene relationships.
- Does not add facts when the character entity already existed (duplicate skip).

---

## PASS 9 Implementation Note (2026-06-29)

**Status:** Read-only Production Bible context for prompt assembly.

### Utility

`server/utils/resolve-productionBibleContext(pb, projectId, options)`

Returns `ProductionBibleResolvedContext` (`types/production-bible-context.ts`):

- `entities[]`, `facts[]`, `relationships[]` — each item includes `reason` and `priority`
- `debug` — considered/included counts, `inclusionLog`, `estimatedChars`, budgets

Options: `sceneId`, `shotId`, `characterIds`, `entityIds`, `maxItems` (default 24), `tokenBudget` (default 1400 chars).

### Context selection rules (priority order)

1. Explicit `entityIds` / `characterIds` → mapped bible entities
2. `appears_in` relationships for `sceneId`
3. Relationships touching `sceneId` or `shotId`
4. `shot belongs_to scene` edges
5. Location entity matching parsed scene heading slug
6. Project-level `world_rule` / `style_rule` entities
7. Project-scoped facts (confidence-weighted)
8. Facts linked to included entities (confidence-weighted)

Items are greedily included until `maxItems` or `tokenBudget` is reached. Retired/contradicted rows are excluded.

### Prompt formatting

`lib/format-production-bible-prompt-block.ts` — compact `PRODUCTION BIBLE REFERENCE` appendix from structured context.

`lib/unified-shot-prompt.ts` — optional `productionBible` on `UnifiedShotPromptContext`; appended after continuity memory when present. Does **not** change stored `image_prompt` on shots.

### Integration point (least risky)

**Project video panel prefill** (`server/utils/project-video-panel-prefill.ts`):

- Resolves bible context for `sceneId`, `shotId`, and project cast
- Passes `productionBible` into `buildFullVideoGenerationPrompt` at runtime only
- Returns `productionBibleContext` on `VideoGenerationPrefill` for debug (shown on Video generation tool)

Read-only debug API: `GET /api/projects/:id/bible/context?sceneId=&shotId=&characterIds=`

### Verification

```bash
node scripts/verify-production-bible.mjs
```

### Known limitations (PASS 9)

- Only wired into **video panel prefill** — storyboard frame generation (`/api/generate/image` from storyboard UI) unchanged
- Does not write bible rows; does not change continuity write-back
- Existing director/cast/continuity blocks remain; bible is an additive appendix
- Empty bible → no prompt change (fail-open if collections missing)
- Character↔scene inclusion depends on seeded `appears_in` relationships or explicit ids — not live name grep at resolve time
- Token budget is character-based estimate, not model tokenizer

---

## PASS 10 Implementation Note (2026-06-29)

**Status:** Read-only Production Bible context for storyboard frame / image generation.

### Integration point

**Project storyboard frame generation** (`pages/projects/[projectId]/storyboard.vue` → `generateFrame`):

1. Before building the prompt, calls `GET /api/projects/:id/bible/context` via `useProductionBible().loadContextForPrompt` (fail-open).
2. Passes `productionBible` into `resolveFrameGenerationPrompt` (same appendix path as PASS 9 video prefill).
3. Sends the assembled prompt to existing `POST /api/generate/image` — **response shape unchanged**.

Stored `shot.image_prompt` is **not** modified; bible context is runtime-only for each generate/regenerate click.

### Context options (per frame)

- `sceneId` — active storyboard scene
- `shotId` — panel being generated
- `characterIds` — shot-matched cast + full project cast (for entity mapping)

Same selection rules and budgets as PASS 9 (`maxItems: 20`, `tokenBudget: 1400`).

### Debug metadata

- `frameBibleDebug[shotId]` — human-readable label from `formatProductionBibleDebugLabel`
- Shown under empty-frame Generate and in Board details after generation

### Files changed

- `composables/useProductionBible.ts` — `loadContextForPrompt`
- `lib/format-production-bible-prompt-block.ts` — `formatProductionBibleDebugLabel`
- `pages/projects/[projectId]/storyboard.vue` — frame generation integration

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Seed bible → Storyboard → Generate on a panel → debug line shows counts; network prompt body includes `PRODUCTION BIBLE REFERENCE`.

### Known limitations (PASS 10)

- Video panel prefill (PASS 9) unchanged in behavior; storyboard is a separate integration path
- Character-creator and standalone `/api/generate/image` callers unaffected
- Requires seeded `appears_in` / `belongs_to` relationships for best scene/shot linkage
- Fail-open: missing bible data generates frames with legacy prompt only

---

## PASS 11 Implementation Note (2026-06-29)

**Status:** Continuity check findings write back to Production Bible as reviewable facts.

### Integration point

**Shot generation continuity** (`server/utils/execute-generate-shots.ts`):

After `persistContinuityCheckOnProject`, when `checkStatus === 'ran'` and `issues.length > 0`, calls `persistContinuityFindingsToBible` (fail-open, never blocks shot save).

### Write-back helper

| File | Role |
|------|------|
| `lib/continuity-bible-fact.ts` | Issue → statement normalization, dedupe key, entity resolution, status heuristic |
| `server/utils/persist-continuity-bible-facts.ts` | PocketBase create-only persistence with duplicate skip |

### Fact creation rules

| Field | Value |
|-------|--------|
| `fact_type` | `continuity` |
| `status` | `draft` (informational) or `needs_review` (contradiction/warning heuristics) |
| `source_type` | `continuity_check` |
| `source_id` | `sceneId` (shot generation path) or `shotId` when available |
| `statement` | Normalized human-readable issue text |
| `entity` | Set only when exactly one cast name matches issue text **and** a bible entity exists |
| `scope_type` / `scope_id` | `scene` + sceneId, or `shot` + shotId, else project-scoped |
| `actor_type` | `system` |
| `confidence` | `0.5` |

Never auto-approves (`active`). Never updates or overwrites user-authored or existing bible facts.

### Duplicate prevention

Dedupe key: `fact_type` + normalized `statement` + `source_id` within the project. Existing `continuity` facts with the same key are skipped (create-only).

### UI visibility

`components/project/ProductionBiblePanel.vue` — **Continuity findings** section at the top when any `fact_type === 'continuity'` or `source_type === 'continuity_check'` rows exist. Project-wide facts loaded on refresh; entity-linked findings link to the entity detail panel.

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Generate shots for a scene with continuity issues → open Production Bible → continuity findings appear as draft/needs_review → promote via entity fact editor if desired.

### Known limitations (PASS 11)

- Wired only from **execute-generate-shots** (scene shot generation); standalone analyze paths unchanged
- Entity attachment uses single cast-name match only — multi-character or location issues stay project-scoped
- Requires `bible_facts` collection and `draft` / `needs_review` status values (run `add-fields-to-collections.js` on existing PocketBase installs)
- Does not change prompt assembly, image/video generation, or cast/scene migration (review workflow added in PASS 12)

---

## PASS 12 Implementation Note (2026-06-29)

**Status:** Review workflow for AI-generated bible facts before they enter prompt context.

### Status rules

| Status | Prompt context (default) | Typical source |
|--------|------------------------|----------------|
| `active` | Included (preferred) | User-approved or user-authored |
| `tentative` | Included (lower priority boost) | Seeded / uncertain claims |
| `draft` | **Excluded** | Continuity write-back (informational) |
| `needs_review` | **Excluded** | Continuity write-back (warnings/contradictions) |
| `retired` | Excluded | User rejection |
| `contradicted` | Excluded | Manual flag |

User-authored facts created in the UI default to `active` immediately (`facts.post` sets `actor_type: user`). Continuity/system facts stay `draft` / `needs_review` until approved.

### UI changes

`components/project/ProductionBiblePanel.vue`:

- **Continuity findings** — Approve, Edit, Reject on pending facts; status badges (Draft, Needs Review, Approved / Active, Retired)
- **Entity facts** — same review actions on `draft` / `needs_review` rows; **Save & approve** while editing
- Reuses existing `PATCH /api/projects/:id/bible/facts/:factId` (no new routes)

`composables/useProductionBible.ts` — `approveFact` (→ `active`), `rejectFact` (→ `retired`)

### Context resolver changes

`lib/bible-fact-review.ts` — `isBibleFactTrustedForContext`, status labels/badge classes

`server/utils/resolve-production-bible-context.ts`:

- Includes `active` and `tentative` facts normally (`active` gets slight priority boost)
- Excludes `draft` and `needs_review` by default
- `includeReviewFacts: true` (or `?debugReview=true` on context API) includes pending review facts for debugging
- Debug payload adds `reviewFactsExcluded` and `excludedReviewFacts` (up to 20)

### Files changed

- `lib/bible-fact-review.ts` (new)
- `lib/format-production-bible-prompt-block.ts` — debug label shows excluded review count
- `types/production-bible-context.ts` — debug fields + `includeReviewFacts` option
- `server/utils/resolve-production-bible-context.ts`
- `server/api/projects/[id]/bible/context.get.ts`
- `server/api/projects/[id]/bible/facts.post.ts` — user provenance on manual create
- `composables/useProductionBible.ts`
- `components/project/ProductionBiblePanel.vue`

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual:

1. Generate shots with continuity issues → Production Bible shows pending findings
2. Approve one → regenerate storyboard/video frame → fact appears in prompt context debug
3. Reject one → excluded from context; shows Retired badge
4. `GET .../bible/context?debugReview=true` → pending facts may appear in resolved context

### Known limitations (PASS 12)

- Review workflow is facts-only; entity/relationship statuses unchanged
- No bulk approve/reject
- `tentative` seeded entities/relationships still enter prompt context; only **facts** require approval before canon
- Does not migrate existing rows; old facts keep their current status
- Generation and continuity check behavior unchanged

---

## PASS 13 Implementation Note (2026-06-29)

**Status:** Seeded bible rows default to review-safe statuses before entering prompt canon.

### New seed status rules

| Row type | Status on create | Prompt context (default) |
|----------|------------------|----------------------------|
| Entity | `tentative` | Included (entity summaries) |
| Fact | `needs_review` | **Excluded** until approved → `active` |
| Relationship | `tentative` | Included (scene/shot linkage) |

Manual user facts (`facts.post` from UI) remain `active` immediately with `actor_type: user`.

Constants: `lib/bible-seed-normalize.ts` — `BIBLE_SEED_ENTITY_STATUS`, `BIBLE_SEED_FACT_STATUS`, `BIBLE_SEED_RELATIONSHIP_STATUS`.

### Files changed

- `lib/bible-seed-normalize.ts` — seed status constants
- `server/utils/seed-production-bible.ts` — apply statuses on create + dry-run preview
- `types/bible-seed-result.ts` — `status` on created preview rows
- `components/project/ProductionBiblePanel.vue` — seed modal wording; unified **Facts pending review** queue (seed + continuity)
- `lib/bible-fact-review.ts` — `project_seed` treated as AI-originated

### UI wording

Seed preview modal labels counts as **tentative** / **needs review** and lists sample rows with status badges.

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Seed from Project → preview shows needs_review facts → apply → facts appear in **Facts pending review** → approve → included in storyboard/video bible debug.

### Known limitations (PASS 13)

- Does not migrate previously seeded `active` facts
- Tentative entities/relationships still influence context resolution without explicit approval
- Re-seed skips duplicate facts even if the existing row is still `needs_review`
- Seeding rules unchanged; only default statuses on new rows

---

## PASS 14 Implementation Note (2026-06-29)

**Status:** Consistent trust rules for facts, entities, and relationships in prompt context.

### Shared trust helpers (`lib/bible-trust.ts`)

| Helper | Rule |
|--------|------|
| `isBibleFactTrustedForContext` | `active` / `tentative` included; `draft` / `needs_review` excluded (unless debug); `retired` / `contradicted` excluded |
| `isBibleEntityTrustedForContext` | `active` / `tentative` included; `draft` / `retired` / `contradicted` excluded |
| `isBibleRelationshipTrustedForContext` | `active` / `tentative` included; `retired` / `contradicted` excluded |
| `bibleContextTrustPriorityBoost` | `active` rows rank slightly above `tentative` |
| `BIBLE_TENTATIVE_PROMPT_LABEL` | `[TENTATIVE — not approved canon]` prefix in prompts |

`lib/bible-fact-review.ts` re-exports fact helpers for backward compatibility.

### Resolver changes

`resolve-production-bible-context.ts` filters entities and relationships through trust helpers before candidacy. Context payloads now include `status` on entities and relationships.

### Prompt formatting

`format-production-bible-prompt-block.ts` prefixes tentative entities, facts, and relationships with `BIBLE_TENTATIVE_PROMPT_LABEL` and uses a provisional header when any tentative row is present.

### UI (minimal)

- Status badges on entity list, entity detail, and relationships (shared `bibleStatusBadgeClass`)
- **Approve** / **Retire** on tentative entities and relationships (no full review queue)
- `tentative` added to `BIBLE_ENTITY_STATUSES` + PocketBase schema migration

### Files changed

- `lib/bible-trust.ts` (new)
- `lib/bible-fact-review.ts` — re-exports
- `lib/format-production-bible-prompt-block.ts`
- `types/bible-entity.ts`, `types/production-bible-context.ts`
- `server/utils/resolve-production-bible-context.ts`
- `composables/useProductionBible.ts` — `approveEntity`, `retireEntity`, `approveRelationship`, `retireRelationship`
- `components/project/ProductionBiblePanel.vue`
- `scripts/setup-collections.js`, `scripts/add-fields-to-collections.js`

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Seed project → tentative entities/relationships in bible debug with `[TENTATIVE]` labels → approve entity → label removed on next generation.

### Known limitations (PASS 14)

- Tentative entities/relationships still enter context (labeled, not hidden) — only facts with `needs_review` are fully excluded
- No bulk approve for entities/relationships
- Entity `draft` status excluded from context but has no dedicated review queue
- Does not migrate existing `active` seeded rows from before PASS 13

---

## PASS 15 Implementation Note (2026-06-29)

**Status:** Stability audit and checkpoint before new Bible features.

### Stability audit summary

| Area | State |
|------|--------|
| **Collections & types** | `bible_entities`, `bible_facts`, `bible_relationships` + TS types/mappers (PASS 6) |
| **CRUD API** | 17 routes under `/api/projects/:id/bible/*`, all `requireProjectOwner` |
| **UI** | Production Bible page + panel: entities, facts, relationships, seed, review queues (PASS 7–8, 12–14) |
| **Prompt context** | Read-only resolver + formatter; storyboard + video prefill integrations (PASS 9–10) |
| **Continuity write-back** | `needs_review` / `draft` facts from continuity checks (PASS 11) |
| **Seed safety** | Seeded facts `needs_review`; entities/relationships `tentative` (PASS 13) |
| **Trust rules** | Unified `lib/bible-trust.ts` for facts, entities, relationships (PASS 14) |

### Bugs found and fixed (PASS 15)

1. **Resolver fact pick** — final pick loop now re-checks `isBibleFactTrustedForContext` (defensive parity with entity/relationship picks).
2. **Panel double fetch** — `refreshAll` / `refreshFacts` filter `projectFacts` client-side instead of a redundant per-entity API call.
3. **Stale UI copy** — panel subtitle updated to reflect storyboard/video prompt integration.
4. **`facts.post` default** — uses `defaultUserAuthoredFactStatus()` from trust helper for consistency.

### Duplicate / overlapping logic (documented, not removed)

- `lib/bible-fact-review.ts` — thin re-export shim over `lib/bible-trust.ts` (kept for PASS 12 import paths).
- `factStatusLabel` / `statusLabel` in panel — both wrap `bibleStatusDisplayLabel` (cosmetic duplication only).
- `isAiOriginatedBibleFact` — exported utility, not yet used in runtime paths (reserved for future auto-review rules).

### Security confirmation

All 17 Bible API handlers call `requireProjectOwner`. Row-level mutations on entities, facts, and relationships additionally use `requireOwnedProjectRow` where applicable. PocketBase list rules scope by `owned_by`.

### Prompt trust confirmation

| Status | Facts | Entities | Relationships |
|--------|-------|----------|---------------|
| `active` | Included | Included | Included |
| `tentative` | Included, labeled | Included, labeled | Included, labeled |
| `draft` | Excluded | Excluded | — |
| `needs_review` | Excluded | — | — |
| `retired` / `contradicted` | Excluded | Excluded | Excluded |

Seeded facts (`needs_review`) require **Approve** → `active` before prompt inclusion. Tentative entities/relationships appear with `[TENTATIVE — not approved canon]` prefix.

### Fail-open integrations

- `useProductionBible().loadContextForPrompt` — catches errors, returns `null`
- `project-video-panel-prefill.ts` — wraps `resolveProductionBibleContext` in try/catch, `productionBible = null`
- Storyboard uses composable fail-open path; generation continues without bible block

### Verification

```bash
node scripts/verify-production-bible.mjs
node scripts/verify-bible-trust-matrix.mjs
```

### Remaining risks

- Pre–PASS 13 seeded `active` facts remain trusted until manually retired
- Tentative entities/relationships still enter context (labeled, not hidden)
- No automated test against live PocketBase; verification is static + trust matrix smoke
- `includeReviewFacts` / `debugReview` only affects pending-review **filtering** in resolver candidacy; `needs_review` rows still never enter the prompt block (listed in `debug.excludedReviewFacts` instead)
- Cast table not linked to bible entities (by design) — see **PASS 17** for manual bridge

### Recommended next 3 passes

1. **PASS 26 — Generation observability backfill** — optional stamp for recent assets where bible context can be inferred.
2. **PASS 27 — Asset metadata audit export** — read-only export of observability + redaction status.
3. **PASS 28 — Bible review dashboard** — unified counts for pending facts, tentative items, and legacy leaks.

### Files changed (PASS 15)

- `server/utils/resolve-production-bible-context.ts` — defensive fact trust on pick
- `components/project/ProductionBiblePanel.vue` — fact load dedupe, subtitle fix
- `server/api/projects/[id]/bible/facts.post.ts` — default status helper
- `scripts/verify-bible-trust-matrix.mjs` (new)
- `scripts/verify-production-bible.mjs` — route security + fail-open + PASS 15 checks
- `docs/ProductionBibleDesign.md` — this note

---

## PASS 16 Implementation Note (2026-06-29)

**Status:** Manual tool to downgrade pre-PASS-13 active seeded facts to `needs_review`.

### Route

`POST /api/projects/:id/bible/remediate-seeded-facts`

Body: `{ dryRun?: boolean }` — defaults to **`dryRun: true`** (preview only). Send `{ dryRun: false }` to apply.

Response: `{ remediation: BibleSeedRemediationResult }`

### Matching rules

A fact is a legacy seed candidate when **all** of:

| Rule | Value |
|------|--------|
| `project` | Matches route project |
| `owned_by` | Matches authenticated project owner |
| `source_type` | `project_seed` |
| `status` | `active` |
| `actor_type` | `system` or empty |
| Excluded `fact_type` | `continuity` |
| Excluded `actor_type` | `user`, `ai` |
| Excluded `actor_id` | Project owner's user id (user-authored) |

### Safety rules

- **Dry-run default** — no writes unless `dryRun: false`
- **Apply** — only patches `status`: `active` → `needs_review`
- Never touches continuity facts, user-authored facts (`actor_type: user`), or non-`project_seed` rows
- Does not run on page load; user must click **Review legacy seeded facts**
- Confirmation required before apply

### UI

Production Bible panel — **Review legacy seeded facts** button (amber) visible when loaded facts match client-side criteria or after a dry-run finds candidates. Modal shows count, samples, and target status.

### Files changed

- `lib/legacy-seeded-fact-match.ts` — matching helper
- `server/utils/remediate-legacy-seeded-facts.ts` — dry-run + apply
- `server/api/projects/[id]/bible/remediate-seeded-facts.post.ts`
- `types/bible-seed-remediation-result.ts`
- `composables/useProductionBible.ts`
- `components/project/ProductionBiblePanel.vue`

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Seed project on pre-PASS-13 data (or manually set a `project_seed` fact to `active`) → button appears → preview → confirm apply → fact moves to **Facts pending review** and leaves prompt context.

### Known limitations (PASS 16)

- Facts approved before remediation but still `active` + `system` + `project_seed` provenance **cannot be distinguished** from unreviewed legacy rows — may be downgraded if user runs apply
- Does not remediate entities or relationships (facts only)
- No undo beyond manual re-approve
- Client-side button visibility depends on loaded `projectFacts`; run preview for authoritative server count

---

## PASS 17 Implementation Note (2026-06-29)

**Status:** Read-only bridge between `creative_characters` cast records and Production Bible character entities. Manual sync only — no automatic migration or cast overwrites.

### Route

`POST /api/projects/:id/bible/link-cast`

Body: `{ dryRun?: boolean }` — defaults to **`dryRun: true`** (preview only). Send `{ dryRun: false }` to apply.

Response: `{ link: BibleCastLinkResult }`

### Matching rules (priority order)

| Priority | Method | Confidence |
|----------|--------|------------|
| 1 | Entity `source_type: creative_character` + `source_id` | `explicit` |
| 2 | `represents` relationship (`bible_entity` → `creative_character`) | `relationship` |
| 3 | Normalized name match (single character entity) | `name` |
| 4 | Multiple entities share name | `ambiguous` (skipped on apply) |

Resolver `characterIds` uses the same bridge map; explicit links outrank name-only matches via `castBibleConfidencePriority`.

### Safety rules

- **Dry-run default** — no writes unless `dryRun: false`
- Never deletes or modifies `creative_characters` rows
- Never overwrites user-authored bible entities (`actor_type: user`)
- Never overwrites entity `source_id` when already linked to a different cast id
- Apply only patches missing `source_type`/`source_id` metadata and creates `represents` relationships
- New entities: `status: tentative`, `actor_id: cast_bridge`, summary from cast `role_description` only
- Does not run on page load; user clicks **Link Cast to Bible**

### UI

- Production Bible panel — **Link Cast to Bible** (sky) when cast records exist
- Modal: matched / linked / created / ambiguous / skipped counts with confidence badges
- Character entity detail — **Linked cast record** with profile link and confidence label

### Files changed

- `lib/bible-cast-bridge.ts` — resolve maps, confidence, safe-attach guard
- `server/utils/link-cast-to-bible.ts` — dry-run + apply sync
- `server/api/projects/[id]/bible/link-cast.post.ts`
- `types/bible-cast-link-result.ts`
- `types/bible-relationship.ts` — `creative_character` endpoint type
- `server/utils/bible-endpoint-access.ts` — validate cast endpoints
- `server/utils/resolve-production-bible-context.ts` — bridge-aware `characterIds`
- `composables/useProductionBible.ts`
- `components/project/ProductionBiblePanel.vue`

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Project with cast + bible characters → preview link → apply → entity shows linked cast; resolver debug shows `cast bridge (explicit|relationship|name)` reason for `characterIds`.

### Known limitations (PASS 17)

- Name-only links are fragile when cast and bible names diverge
- Ambiguous duplicates require manual entity merge or rename — sync skips them
- Bridge does not copy cast appearance/voice assets into bible facts (metadata link only)
- `represents` relationships are tentative until user approves entity/relationship
- No reverse sync (bible → cast); cast remains source of truth for performance assets

---

## PASS 18 Implementation Note (2026-06-29)

**Status:** Read-only Production Bible context expanded to remaining project-scoped visual generation paths.

### Entry point audit

| Path | Project context? | PASS 18 action |
|------|------------------|----------------|
| Storyboard frame `/api/generate/image` | Yes (`projectId`, scene, shot, cast) | Already wired (PASS 10) — unchanged |
| Video panel prefill → video prompt | Yes | Already wired (PASS 9) — unchanged |
| Video tool start-frame generate | Yes when opened from project | **Wired** via `VideoStartFramePicker` bible props |
| Character Creator `/api/generate/image` | Optional `?projectId=&characterId=` | **Wired** — client resolves bible via context API |
| `POST /api/generate-character` | Optional `projectId` in body | **Wired** — server resolves with ownership check |
| Standalone Character Creator (no project) | No | Skipped — no bible context |
| Standalone `/api/generate/image` (no project) | No | Skipped — prompt unchanged |
| Asset upload hubs (`AssetKindHub`) | N/A | No AI generation — out of scope |
| Music / script text generation | N/A | Out of scope (not visual continuity) |

### Context rules per path

**Character Creator (project-scoped)**

- Requires `projectId` query param (ownership enforced by context API)
- When `characterId` present, passes to resolver for PASS 17 cast bridge
- Includes `active` + `tentative` entities/facts/relationships per trust rules
- Appends bible block to image prompt client-side; shows debug label in header

**Video start-frame generation**

- When `bibleProjectId` prop set, loads context with scene/shot/characterIds from panel prefill
- Fail-open; debug line under starting-frame picker

**generate-character API**

- Optional `projectId` → `requireProjectOwner`
- Optional `characterId`, `entityIds`, `sceneId`, `shotId` forwarded to resolver
- `productionBibleDebug` on first result only (response shape preserved)

### Shared helpers

- `lib/production-bible-generation-context.ts` — append prompt + debug metadata
- `server/utils/resolve-production-bible-for-generation.ts` — fail-open server wrapper

### Files changed

- `lib/production-bible-generation-context.ts` (new)
- `server/utils/resolve-production-bible-for-generation.ts` (new)
- `pages/character-creator.vue`
- `components/video/VideoStartFramePicker.vue`
- `pages/tools/video-generation.vue`
- `server/api/generate-character.post.ts`
- `lib/video-generation-prefill.ts`
- `server/utils/project-video-panel-prefill.ts`
- `types/character-creator.ts`

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual:

1. Open Character Creator from cast profile (`?projectId=&characterId=`) → generate → header shows bible debug when context matches.
2. Open Video generation from storyboard panel → generate starting frame → picker shows bible debug line.
3. `POST /api/generate-character` with `projectId` + `characterId` → first result includes `productionBibleDebug`.

### Known limitations (PASS 18)

- Generic `/api/generate/image` body unchanged — bible assembly stays client-side for image routes
- Character Creator without `projectId` query has no bible context
- Debug metadata is informational only; not persisted on assets
- Start-frame bible uses panel prefill character list; may miss shot-specific cast if prefill stale
- `generate-character` debug only on first array element to preserve response shape

---

## PASS 19 Implementation Note (2026-06-29)

**Status:** Stability audit and cleanup of all Production Bible prompt integrations. No new generation features; no bible data or prompt wording changes beyond debug-label consistency.

### Prompt integration map

| Integration | When bible loads | Auth / ownership | Append path | Debug label | Persisted? |
|-------------|------------------|------------------|-------------|-------------|------------|
| Storyboard frame gen | Client: `loadContextForPrompt` | `GET …/bible/context` → `requireProjectOwner` | `resolveFrameGenerationPrompt` → `formatProductionBiblePromptBlock` | `productionBibleGenerationDebugLabel` per panel | **No** — runtime prompt to `/api/generate/image` only |
| Video panel prefill | Server: `resolveProductionBibleForGeneration` | Prefill route owner check | `buildFullVideoGenerationPrompt` → same formatter | `productionBibleContext` on prefill; video tool shows canonical label | **No** — prefill prompt is runtime; shot `video_prompt` unchanged |
| Video start-frame gen | Client: `loadContextForPrompt` when `bibleProjectId` set | Context API owner check | `appendProductionBibleToPrompt` before `/api/generate/image` | `productionBibleGenerationDebugLabel` under picker | **No** |
| Character Creator | Client: `loadContextForPrompt` when `?projectId=` | Context API owner check | `appendProductionBibleToPrompt` before `/api/generate/image` | `buildProductionBibleGenerationDebug` in header | **No** |
| `POST /api/generate-character` | Server: `resolveProductionBibleForGeneration` when `projectId` in body | `requireProjectOwner` | `appendProductionBibleToPrompt` | `productionBibleDebug` on first result | **No** |

### Shared rules (all integrations)

- **Trust:** `active` + `tentative` in context; `draft` / `needs_review` / `retired` / `contradicted` excluded (`lib/bible-trust.ts` + resolver re-check on pick)
- **Tentative labeling:** `[TENTATIVE — not approved canon]` prefix in prompt block
- **Budgets:** `maxItems: 20`, `tokenBudget: 1400` via `DEFAULT_PRODUCTION_BIBLE_GENERATION_OPTIONS`
- **Fail-open:** client `loadContextForPrompt` returns `null`; server `resolveProductionBibleForGeneration` catches errors
- **Cast bridge:** `characterIds` uses PASS 17 explicit links before name match (resolver)

### Bugs found / fixed

| Issue | Fix |
|-------|-----|
| Inconsistent debug strings across UIs | `productionBibleGenerationDebugLabel()` — single canonical formatter |
| Video tool hid debug when zero rows matched | Now shows `Production Bible: no matching context` when prefill context is empty |
| Video prefill duplicated inline try/catch | Uses `resolveProductionBibleForGeneration` |
| Mismatched token budgets (1200 / 1000 / 1400) | Unified to `PRODUCTION_BIBLE_GENERATION_*` constants |
| Storyboard imported debug helper from prompt-block directly | Uses generation-context module like other paths |

### Security confirmation

- All bible reads go through `requireProjectOwner` (context API, prefill, `generate-character` with `projectId`)
- Client paths only call bible when `projectId` is a valid PocketBase id from project workflow
- `/api/generate/image` unchanged — no project id in body; bible never added server-side there without future pass

### Runtime vs persisted

- `shot.image_prompt` / `shot.video_prompt` store user-authored production text only
- Bible appendix is assembled at generation time and sent to OpenRouter; not written back to shots, assets, or bible collections

### Files changed

- `lib/production-bible-generation-context.ts` — defaults, `productionBibleGenerationDebugLabel`, `mergeProductionBibleGenerationOptions`
- `server/utils/project-video-panel-prefill.ts` — fail-open resolver + shared options
- `pages/projects/[projectId]/storyboard.vue` — canonical debug + options
- `pages/tools/video-generation.vue` — canonical debug label
- `pages/character-creator.vue` — shared options
- `components/video/VideoStartFramePicker.vue` — shared options + canonical debug
- `server/api/generate-character.post.ts` — shared options
- `scripts/verify-production-bible.mjs` — PASS 19 checks

### Verification

```bash
node scripts/verify-production-bible.mjs
node scripts/verify-bible-trust-matrix.mjs
```

Manual: Generate storyboard frame + video from same panel → debug labels use same `Production Bible: N entities…` format; inspect saved shot — `image_prompt` has no `PRODUCTION BIBLE REFERENCE` block.

### Remaining risks

- Storyboard passes all cast `characterIds` (not shot-only) — may widen context vs minimal shot cast
- Client fail-open swallows errors without `failOpenReason` (server paths record reason)
- Video main prompt and start-frame prompt resolve bible independently — counts may differ slightly
- Resolver default when API omits budgets is 24 items (internal); generation paths always pass 20

### Recommended next 3 passes

1. **PASS 26 — Generation observability backfill** — optional stamp for recent assets where bible context can be inferred.
2. **PASS 27 — Asset metadata audit export** — read-only export of observability + redaction status.
3. **PASS 28 — Bible review dashboard** — unified counts for pending facts, tentative items, and legacy leaks.

---

## PASS 20 Implementation Note (2026-06-29)

**Status:** Bulk review UI for pending bible facts in the Production Bible panel. Uses existing `PATCH …/facts/:id` via `approveFact` / `rejectFact` — no trust rule or prompt changes.

### Bulk actions

| Action | Target | Status change | Confirmation |
|--------|--------|---------------|--------------|
| Approve selected | Checked visible rows | `draft` / `needs_review` → `active` | Yes |
| Reject selected | Checked visible rows | `draft` / `needs_review` → `retired` | Yes |
| Approve all visible | All rows matching filters | → `active` | Yes |
| Reject all visible | All rows matching filters | → `retired` | Yes |

Confirmation copy explains prompt inclusion (approve) or retirement (reject). Per-row Approve / Reject / Edit unchanged.

### Filters (pending queue)

| Filter | Values |
|--------|--------|
| Source | All / Seed / Continuity / Other |
| Fact type | All or any `BIBLE_FACT_TYPES` value |
| Scope | All / Entity-linked / Project-scoped |
| Search | Substring on statement, type, entity id, scope |

Filtered list drives checkboxes and “all visible” bulk actions. Approved/retired facts leave the queue immediately via `syncFactInLists` + `isBibleFactPendingReview`.

### Files changed

- `lib/bible-pending-fact-filters.ts` — filter helpers + source categorization
- `composables/useProductionBible.ts` — `approveFacts`, `rejectFacts` (sequential PATCH)
- `components/project/ProductionBiblePanel.vue` — filters, selection, bulk toolbar

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Seed project → open Production Bible → filter Seed → select subset → Approve selected → rows leave queue; Reject all visible on continuity filter → retired rows excluded from prompts.

### Known limitations (PASS 20)

- Bulk actions run sequential PATCH calls (no batch API) — large selections may be slow
- Entity-scoped pending facts on entity detail tab not bulk-enabled (top queue only)
- Tentative entities/relationships still reviewed one-by-one (facts only in this pass)
- Partial failure reports count only; does not retry failed ids automatically

---

## PASS 21 Implementation Note (2026-06-29)

**Status:** Read-only cast ↔ Bible ↔ asset visibility bridge. Optional manual `bible_entity_id` metadata link on explicit user action only. No generation, prompt assembly, or automatic Bible fact writes.

### Asset metadata audit

| Field | Typical source | Bridge usage |
|-------|----------------|--------------|
| `character_id` | Character portraits, voice clips, hub uploads | Primary cast match |
| `character_name` | Legacy / title-derived | Fallback cast match by name |
| `character_ids` | Storyboard frame saves | Cast match (array) |
| `scene_id` | Storyboard / video assets | Display tag when asset already linked |
| `shot_id` | Storyboard panels, video clips | Display tag when asset already linked |
| `panel_index` | Storyboard ordering | Not used for bridge (display elsewhere) |
| `prompt_used` | Portrait generation debug | Read-only; not used for linking |
| `bible_entity_id` | Manual link action (PASS 21) | Highest-priority explicit Bible link |
| `bible_entity_type` / `bible_entity_name` | Seed util only | Not used by asset bridge |

### Matching rules (priority)

1. **Direct Bible link** — `metadata.bible_entity_id` equals entity id → source `bible_entity_metadata`.
2. **Cast character link** — asset `character_id` / `character_ids` matches cast member linked to entity via PASS 17 bridge (relationship or name match, non-ambiguous) → source `cast_character_link`.
3. **Scene / shot tag** — when (1) or (2) applies and `scene_id` and/or `shot_id` present → additional badge `scene_shot` (does not link alone).

Resolution helpers: `lib/bible-cast-asset-bridge.ts` — `resolveAssetToCastCharacter`, `resolveAssetToBibleEntity`, `resolveBibleEntityRelatedAssets`, `countAssetsForCastCharacter`, `assetsLinkableToBibleEntity`.

### UI surfaces

| Surface | What is shown |
|---------|----------------|
| Production Bible entity detail | Related assets list with kind, link source badges, scene/shot labels, playback link |
| Production Bible (character entities) | Optional dropdown + “Link selected asset to this Bible entity” (PATCH metadata only, confirm dialog) |
| Cast character profile | Linked Bible entity (with confidence), project-wide asset count |

### Files changed

- `lib/bible-cast-asset-bridge.ts` — resolver helpers + link source labels
- `composables/useProductionBible.ts` — `loadProjectAssets`, `patchProjectAsset`
- `components/project/ProductionBiblePanel.vue` — related assets section + manual link
- `pages/projects/[projectId]/cast/[characterId].vue` — Bible link + asset count card

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Open Production Bible → select character entity with linked cast → confirm related portraits/voice appear with “Cast character link”. Use manual link on an unlinked cast asset → badge becomes “Direct Bible link”. Cast profile shows Bible entity name and asset count.

### Known limitations (PASS 21)

- Storyboard/video assets without cast metadata do not appear unless manually linked via `bible_entity_id`
- Manual link replaces full metadata object on PATCH — UI merges client-side; other writers must preserve fields
- Cast profile asset count loads all project assets (extra request); character GET still only returns `kind: character` for the gallery
- Non-character Bible entities only show assets with direct `bible_entity_id` (no cast bridge)
- `prompt_used` and other debug fields are not surfaced in Bible UI (by design)

---

## PASS 22 Implementation Note (2026-06-29)

**Status:** Structured generation provenance stamped into `project_assets.metadata.generation_observability` at save time. Read-only visibility in Production Bible related assets. No prompt, provider, Bible fact write, or asset-linking behavior changes.

### Observability shape (`metadata.generation_observability`)

| Field | Purpose |
|-------|---------|
| `projectId`, `sceneId`, `shotId`, `characterId`, `characterIds` | Scope when known at save |
| `generationPath` | e.g. `storyboard_frame`, `character_creator`, `video_generation`, `project_video_panel` |
| `model`, `provider` | Model id and provider label (`openrouter`) |
| `promptHash` | `djb2:` hash of prompt sent to provider — **not** full text |
| `bibleContextUsed` | Whether non-empty bible slice was included |
| `bibleEntityIds`, `bibleFactIds`, `bibleRelationshipIds` | Ids included in prompt context |
| `bibleEntityCount`, `bibleFactCount`, `bibleRelationshipCount` | Counts for UI |
| `bibleDebugLabel` | Canonical debug label (PASS 19) |
| `failOpenReason` | When bible resolve failed open |
| `createdAt` | ISO timestamp at stamp |

Helper: `lib/generation-observability.ts` — `buildGenerationObservability`, `readGenerationObservability`, `mergeGenerationObservabilityIntoMetadata`.

### Save points audited

| Path | Saves asset? | Stamped PASS 22? |
|------|----------------|------------------|
| Storyboard frame auto-save | Yes (`kind: storyboard`) | Yes |
| Character Creator cloud save | Yes (`kind: character`) | Yes |
| Video tools → project library | Yes (`kind: video`) | Yes |
| `POST /api/generate/image` | No (returns URL only) | N/A |
| `POST /api/generate-character` | No | N/A |
| Video start-frame picker | No (staged URL for video) | N/A |
| Manual cast/character uploads | Yes | No (not AI generation) |
| Music generation | Yes | Out of scope |

### UI visibility

Production Bible → entity detail → Related assets: one-line summary per asset — “Bible context used · N ent · N facts · N rel · {path}” (or “No Bible context”).

### Files changed

- `lib/generation-observability.ts` — shape + helpers
- `pages/projects/[projectId]/storyboard.vue` — stamp on frame save
- `pages/character-creator.vue` — stamp on cloud save
- `pages/tools/video-generation.vue` — stamp on video ingest
- `components/project/ProductionBiblePanel.vue` — related asset provenance line

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Generate storyboard frame with bible seeded → open Bible entity → related asset shows observability line. Save Character Creator portrait to project → same. Generate video from project panel with save enabled → video asset shows path + bible counts.

### Known limitations (PASS 22)

- Existing assets lack observability until re-generated and re-saved
- `assetId` inside the nested record is not back-filled after create (redundant on the asset row)
- Video start-frame generation does not persist observability (no project asset)
- Standalone video tool without project prefill may show `No Bible context`
- Prompt hash is djb2 hex — not cryptographic; for dedup/debug only
- Full `prompt_used` remains separate legacy field on character assets; observability does not duplicate it

---

## PASS 23 Implementation Note (2026-06-29)

**Status:** Audit and hardening of PASS 22 observability — no new features, no prompt/generation changes.

### Audit summary (save points)

| Save point | Metadata merge | Observability | Unrelated fields |
|------------|----------------|---------------|------------------|
| Storyboard `persistStoryboardAsset` | `...baseMetadata` then nested key | `GENERATION_PATH.STORYBOARD_FRAME` | `scene_id`, `shot_id`, `character_ids` preserved |
| Character Creator `confirmCloudSave` | `...baseMetadata` then nested key | `GENERATION_PATH.CHARACTER_CREATOR` | Legacy `prompt_used` stays **outside** observability blob |
| Video tool `saveVideoToProjectLibrary` | `...baseMetadata` then nested key | `GENERATION_PATH.PROJECT_VIDEO_PANEL` or `VIDEO_GENERATION` | `negative_prompt`, `dialogue_line` stay outside observability |

### Observability contract (enforced in code)

**Allowed inside `metadata.generation_observability`:** scope ids, `generationPath`, `model`, `provider`, `promptHash` (`djb2:` only), bible id arrays, counts, `bibleDebugLabel` (counts label, max 240 chars), `failOpenReason`, `createdAt`.

**Forbidden inside observability:** `prompt`, `prompt_used`, `negative_prompt`, `dialogue_line`, and other prompt-like keys (`GENERATION_OBSERVABILITY_FORBIDDEN_KEYS`). Records containing these keys are rejected on read.

**Never stored in observability:** full prompt text, bible fact statements, entity summaries.

**Merge rule:** `mergeGenerationObservabilityIntoMetadata` spreads existing metadata first, then sets only `generation_observability` — other top-level keys unchanged.

### Bugs found / fixed

| Issue | Fix |
|-------|-----|
| No runtime guard against prompt fields in observability blob | `observabilityRecordHasForbiddenPromptFields` + reject on read |
| `promptHash` could accept arbitrary long strings | `PROMPT_HASH_PATTERN` validation on sanitize |
| Inconsistent `generationPath` string literals | `GENERATION_PATH` constants + `GENERATION_PATH_LABELS` |
| UI ignored legacy assets; could have shown `prompt_used` | `formatAssetProvenanceLine` — legacy line without prompt text |
| Partial/corrupt observability could surface bad data | `sanitizeGenerationObservabilityRecord` on build, merge, and read |

### UI behavior (related assets)

| Case | Display |
|------|---------|
| Valid observability | Summary line (bible used / counts / path) |
| Missing observability, legacy `prompt_used` or `model` | “Legacy generated asset (no observability stamp)” — **no prompt text** |
| Missing observability, manual upload | No extra line |
| Bible not used | “No Bible context” in observability summary |
| Corrupt observability (forbidden keys) | Treated as missing; falls back to legacy line if applicable |

### Files changed

- `lib/generation-observability.ts` — sanitize, forbidden keys, path constants, `formatAssetProvenanceLine`
- `pages/projects/[projectId]/storyboard.vue` — `GENERATION_PATH` constant
- `pages/character-creator.vue` — `GENERATION_PATH` constant
- `pages/tools/video-generation.vue` — `GENERATION_PATH` constants
- `components/project/ProductionBiblePanel.vue` — `formatAssetProvenanceLine` UI
- `scripts/verify-production-bible.mjs` — PASS 23 leak guards

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Inspect saved asset metadata in PocketBase — `generation_observability` has `promptHash` only (no `prompt`). Related assets UI never shows `prompt_used` text.

### Remaining risks

- Legacy `prompt_used` on character assets (top-level metadata) still contains full prompt from pre-PASS 22/23 saves — outside observability contract; not shown in Bible UI
- Video metadata may still store `negative_prompt` / `dialogue_line` at top level (pre-existing, not observability)
- Corrupt observability rejected on read — asset may show legacy line only
- `djb2` hash is not cryptographic

### Recommended next 3 passes

1. **PASS 25 — Tentative entity/relationship bulk review** — extend PASS 20 bulk workflows to entities and relationships.
2. **PASS 26 — Generation observability backfill** — optional stamp for recent assets where bible context can be inferred.
3. **PASS 27 — Asset metadata audit export** — read-only CSV/JSON export of observability + redaction status per project.

---

## PASS 24 Implementation Note (2026-06-29)

**Status:** Manual legacy prompt metadata cleanup for project assets. Dry-run by default. Does not delete assets, change generation, or modify `generation_observability`.

### Metadata fields audited (top-level only)

| Key | Typical source |
|-----|----------------|
| `prompt_used` | Character Creator saves |
| `negative_prompt` | Video tool saves |
| `dialogue_line` | Video tool (spoken dialogue) |
| `ambient_sound_prompt` | Video tool |
| `prompt`, `image_prompt`, `video_prompt` | Rare / legacy |
| camelCase variants (`promptUsed`, `fullPrompt`, etc.) | Legacy |

Nested `metadata.generation_observability` is **never** scanned or modified.

### Redaction rules

| Before | After |
|--------|--------|
| Full string value | `[redacted]` marker |
| (when hash computable) | `{field}_hash` → `djb2:…` |
| Other metadata keys | Unchanged |
| `generation_observability` | Preserved byte-for-byte |
| Asset row | Updated via PATCH metadata only — not deleted |

Already-redacted values (`[redacted]`, bare `djb2:` hashes) are skipped.

### API

`POST /api/projects/:id/assets/redact-legacy-prompts` — `requireProjectOwner`.

Body: `{ dryRun?: boolean }` — **defaults to `true`**.

Response: `{ redaction: LegacyAssetPromptRedactionResult }` with `assetsAffected`, `fieldsFound`, `fieldCounts`, `samples`, `replacementDescription`, and after apply: `updatedCount`, `remainingLeakCount`, `observabilityPreservedCount`.

### UI

Production Bible toolbar → **Redact legacy prompt metadata** → dry-run preview modal → confirm → apply.

Confirmation: “This removes old full prompt text from asset metadata and keeps only hashes/markers.”

### Files changed

- `lib/legacy-asset-prompt-metadata.ts` — field audit + redact helpers
- `types/legacy-asset-prompt-redaction-result.ts`
- `server/utils/redact-legacy-asset-prompts.ts`
- `server/api/projects/[id]/assets/redact-legacy-prompts.post.ts`
- `composables/useProductionBible.ts` — `redactLegacyAssetPrompts`
- `components/project/ProductionBiblePanel.vue` — manual action + modal

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Dry-run on project with Character Creator assets → preview lists `prompt_used`. Apply → PocketBase metadata shows `[redacted]` + `prompt_used_hash`; `generation_observability` unchanged; `remainingLeakCount` is 0.

### Known limitations

- Does not run on page load or automatically after generation
- Character cast “locked portrait prompt” UI will show `[redacted]` after cleanup (by design)
- Notes field on assets is not scanned (may contain user prose unrelated to generation)
- Sequential per-asset PATCH — large libraries may be slow
- Skips asset if observability blob would change (safety guard)

---

## PASS 25 Implementation Note (2026-06-29)

**Status:** Bulk review UI for tentative bible entities and relationships in the Production Bible panel. Reuses existing `PATCH` entity/relationship routes via `approveEntity` / `retireEntity` / `approveRelationship` / `retireRelationship`. No prompt, seed, continuity, observability, or redaction changes.

### Tentative items queue

Includes rows where `status === 'tentative'`:

| Kind | Approve → | Retire → |
|------|-----------|----------|
| Entity | `active` | `retired` |
| Relationship | `active` | `retired` |

### Filters

| Filter | Values |
|--------|--------|
| Type | All / Entity / Relationship |
| Entity type | All or any `BIBLE_ENTITY_TYPES` value (entities only) |
| Relationship type | All or distinct types among tentative relationships |
| Search | Substring on title, detail, types, kind |

Filtered list drives checkboxes and “all visible” bulk actions.

### Bulk actions

| Action | Target | Confirmation |
|--------|--------|--------------|
| Approve selected | Checked visible rows | Yes — explains canonical prompt inclusion |
| Retire selected | Checked visible rows | Yes — explains exclusion from prompts |
| Approve all visible | All rows matching filters | Yes |
| Retire all visible | All rows matching filters | Yes |

Per-row Approve / Retire / Open (entities) unchanged on entity detail and relationship lists.

### Files changed

- `lib/bible-tentative-item-filters.ts` — build + filter helpers
- `composables/useProductionBible.ts` — `approveEntities`, `retireEntities`, `approveRelationships`, `retireRelationships`
- `components/project/ProductionBiblePanel.vue` — Tentative items section

### Verification

```bash
node scripts/verify-production-bible.mjs
```

Manual: Seed project → open Production Bible → Tentative items → filter Entity type → select subset → Approve selected → rows leave queue; Retire all visible on relationships filter → retired rows excluded from prompts.

### Known limitations (PASS 25)

- Bulk actions run sequential PATCH calls (no batch API)
- `draft` entities/relationships are not included (tentative only)
- Entity-scoped relationship editing still one-by-one on entity detail tab
- Partial failure reports counts only; does not retry failed ids

### Recommended next 3 passes

1. **PASS 26 — Generation observability backfill** — optional stamp for recent assets where bible context can be inferred.
2. **PASS 27 — Asset metadata audit export** — read-only export of observability + redaction status.
3. **PASS 28 — Bible review dashboard** — unified counts for pending facts, tentative items, and legacy prompt leaks.
