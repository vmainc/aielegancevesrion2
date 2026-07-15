# AI Elegance — Roadmap

Phased evolution from the current codebase toward a full **AI Film Operating System**. Phases are ordered by dependency: memory and relationships first, scale and intelligence second.

---

## Current State (Baseline)

What exists and works today:

- **Project workspace** with workflow steps: story → director → cast → scenes → storyboard → video
- **PocketBase schema** for projects, scenes, characters, shots, assets
- **Script import** → structured scenes + character rows
- **Concept bootstrap** → screenplay + storyboard seed (`bootstrap-project-from-concept`)
- **Director bible** (JSON on project) with presets
- **Character profiles** — appearance, personality, voice, signature, avoid lists
- **Unified shot prompts** — director + cast + continuity assembled at generation time
- **Continuity check** on generated shot lists (AI repair + memory append)
- **Project Guide** — context-aware chat with structured suggestion cards
- **Video generation** via OpenRouter with shot prefill and start frames

Known gaps:

- Guide chat history is **localStorage** (`lib/project-guide.ts`), not cloud-persistent
- Asset ↔ shot/scene links rely on **metadata conventions**, not formal relations
- `creative_scripts` (Script Wizard) is parallel to project screenplay flow
- Continuity is **scene-scoped**, not a global cross-scene graph
- No append-only **creative decision log**
- Shot `negative_prompt` may exist in app types but is not always in PocketBase schema

---

## Phase 1 — Persistent Memory Foundation

**Goal:** Nothing important lives only in the browser or inside a prompt string.

| Initiative | Description |
|------------|-------------|
| Guide persistence | Store guide messages + applied suggestions in PocketBase (per project) |
| Decision log | `creative_decisions` or JSON append on project: field, old/new value, source, timestamp |
| Asset linkage schema | Standard `metadata`: `shot_id`, `scene_id`, `character_id`, `generation_job_id` |
| Migrate continuity | Ensure `continuity_memory` updates always go through API with provenance |

**Exit criteria:** Open project on a new device; guide history and last 50 decisions are intact.

---

## Phase 2 — Canonical References

**Goal:** Characters and locations exist once; everything else points to them.

| Initiative | Description |
|------------|-------------|
| Shot ↔ character relations | Junction table or JSON relation array on `creative_shots` (not name grep) |
| Featured portrait contract | Single `featured_portrait_asset_id` on character (relation to `project_assets`) |
| Scene enrichment | Structured fields: `location`, `time_of_day`, `characters_present[]` |
| Deprecate prompt duplication | Shots store intent; appearance pulled from character at render time |

**Exit criteria:** Rename a character once; all shots resolve cast without manual prompt edits.

---

## Phase 3 — Continuity Engine v2

**Goal:** Consistency at feature scale, not just per-scene batch fixes.

| Initiative | Description |
|------------|-------------|
| Continuity graph | Index facts extracted from memory + characters + approved shots |
| Incremental check | On shot edit/generate, check only affected neighborhood |
| Cross-scene rules | Wardrobe state, time progression, geography |
| `continuity_last_issues` UI | Actionable fix suggestions linked to specific shots |
| Negative prompt centralization | `lib/video-negative-prompt.ts` + shared merge with storyboard negatives |

**Exit criteria:** Run continuity report across 200+ shots in under 30s; issues reference shot IDs.

---

## Phase 4 — Director AI Expansion

**Goal:** AI as ongoing creative partner across the whole workflow.

| Initiative | Description |
|------------|-------------|
| Guide → Director AI | Same brain suggests shot fixes, scene pacing notes, cast gaps |
| Proactive reviews | “Act II tone drift” notifications from bible + scene summaries |
| Multi-model compare | Side-by-side treatment/shot variants (existing comparison DNA) |
| Approval workflows | Suggestion → preview diff → apply patch (already started in Guide UI) |

**Exit criteria:** User can accept/reject AI bible changes with full audit trail.

---

## Phase 5 — Production Scale

**Goal:** Thousands of shots, teams, and long-running projects.

| Initiative | Description |
|------------|-------------|
| Paginated shot APIs | `?scene=&cursor=&limit=` |
| Virtualized storyboard UI | Render 50 visible panels, not 2000 DOM nodes |
| Durable job queue | PocketBase or external queue for generation jobs |
| Hierarchical AI context | Scene summaries → act summaries → project summary for LLM windows |
| Object storage | Large video files off SQLite; PocketBase holds pointers |
| Collaboration | Shared projects, roles (director, editor, viewer) |

**Exit criteria:** 1000-shot project remains usable in storyboard and video panels.

---

## Phase 6 — Film OS Platform

**Goal:** AI Elegance as the hub for an entire production.

| Initiative | Description |
|------------|-------------|
| Studio character library | Characters referenced across projects |
| External integrations | Export to edit suites (XML/EDL), DAM hooks |
| Versioned bibles | Director preset history, A/B creative directions |
| Quality gates | “No video until continuity clean for scene” rules |

---

## Principles for Prioritization

When choosing what to build next:

1. Does it **persist** creative state?
2. Does it **replace duplication** with a relation?
3. Does it help **another subsystem** understand the project?
4. Does it survive **10× shot count**?
5. Can it ship **incrementally** without a rewrite?

If the answer to 1–2 is no, defer until memory and references are stronger.

---

## Related Documents

- [Vision.md](./Vision.md)
- [Architecture.md](./Architecture.md)
- [Database.md](./Database.md)
- [ContinuityEngine.md](./ContinuityEngine.md)
- [DirectorAI.md](./DirectorAI.md)
