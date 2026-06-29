# AI Elegance — Vision

AI Elegance is not a video generator. It is an **AI Film Operating System**: a persistent creative environment where story, cast, shots, assets, and decisions live together and compound over time.

The product is built for **feature-scale work** — thousands of shots, dozens of characters, long production timelines — not one-off social clips.

---

## North Star

> **Every creative decision is remembered. Every asset knows where it belongs. Every AI call reads the whole film.**

A filmmaker should open a project months later and find the same world: the same Mara with the red scarf, the same director bible, the same shot that was approved in Act II. AI should reason about *this film*, not generic prompts.

---

## Architectural Principles

These principles govern every feature, schema change, and AI workflow.

### 1. Every object has persistent memory

Projects, characters, scenes, shots, and assets must store **durable state** — not ephemeral chat or browser-only context. Creative facts belong in the database with provenance (who/when/why), not in scattered prompt text.

**Today:** `creative_projects.continuity_memory`, character bibles, and `project_assets.metadata` are early forms of this.  
**Target:** A unified **creative memory** layer: append-only decision log + queryable facts per entity.

### 2. Every part of the application understands every other part

No siloed tools. Storyboard generation must read director bible + cast + scene structure. Video generation must read shot prompts + continuity + prior frames. The Project Guide must see the same context as shot generation.

**Mechanism:** Shared context builders (`project-guide-context`, `unified-shot-prompt`, `project-character-prompt-refs`) are the pattern — one source of truth, many consumers.

### 3. Characters exist once and are referenced everywhere

A character is a **canonical entity** (`creative_characters`), not a name copied into prompts. Portraits, voice samples, appearance locks, and avoid-lists attach to that entity. Shots **reference** characters; they do not redefine them.

**Rule:** Never duplicate character description in a shot when a relation or lookup can supply it at generation time.

### 4. Scenes are structured data, not just text

Scenes (`creative_scenes`) have `heading`, `summary`, and `body` — ordered by `sort_order`, parented to a project. Shots (`creative_shots`) hang off scenes with typed fields (`shot_type`, `camera_move`, `duration_seconds`, prompts).

**Target:** Richer scene models — location, time-of-day, cast present, emotional beat, continuity tags — without collapsing back to unstructured screenplay blobs.

### 5. Every generated asset automatically connects to the story

When a frame, clip, portrait, or audio file is created, it must link to **project + scene + shot + character** (as applicable) via relations or structured `metadata`. Orphan assets are technical debt.

**Today:** `project_assets` with `kind` and `metadata` (e.g. `character_id`).  
**Target:** First-class `shot_id` / `scene_id` relations and generation job records.

### 6. The software remembers creative decisions forever

Approvals, bible edits, continuity fixes, and guide suggestions that the user accepts are **events**, not throwaway UI state. The system should answer: “Why does Mara wear red?” → “Locked in continuity memory on 2026-03-12 via Project Guide.”

### 7. AI is a creative partner, not a prompt generator

AI proposes; the filmmaker approves. Structured suggestions (Project Guide), continuity review (Continuity Engine), and enrichment pipelines output **actionable updates** to the bible — not walls of text the user must manually copy.

---

## What We Are Building Toward

| Layer | Role |
|-------|------|
| **Story graph** | Project → scenes → shots → assets; characters as cross-cutting entities |
| **Creative bible** | Director preset + continuity memory + per-character locks |
| **Continuity Engine** | Validates and repairs consistency across shots at scale |
| **Director AI** | Project Guide + director bible + prompt assembly |
| **Production pipeline** | Storyboard frames → video → timeline, all context-aware |
| **Memory & provenance** | Decision log, generation history, model/version tracking |

---

## Anti-Patterns (Do Not Build)

- **Duplicate cast descriptions** in every shot row when character records exist
- **Browser-only memory** for decisions that should survive devices and time
- **One-off prompt builders** that bypass `unified-shot-prompt` / continuity helpers
- **Flat file dumps** without scene/shot linkage
- **Features optimized for 3-shot demos** that break at 300 shots (N+1 fetches, unbounded context, no pagination)

---

## Success Metrics

We know the OS is working when:

1. Regenerating shot 847 still matches character 3’s appearance from shot 12.
2. Importing a 120-page script produces structured scenes and cast without manual re-entry.
3. A new collaborator opens the project and understands creative rules without reading chat logs.
4. Asset library queries “all frames for Scene 14” or “all portraits for Character X” instantly.
5. AI suggestions are traceable to bible fields the user explicitly approved.

---

## Related Documents

- [Architecture.md](./Architecture.md) — system layers and module map
- [Database.md](./Database.md) — schema and relationship model
- [Roadmap.md](./Roadmap.md) — phased evolution from today to target
- [AIWorkflows.md](./AIWorkflows.md) — AI touchpoints across the pipeline
- [ContinuityEngine.md](./ContinuityEngine.md) — consistency subsystem
- [DirectorAI.md](./DirectorAI.md) — director bible and Project Guide
