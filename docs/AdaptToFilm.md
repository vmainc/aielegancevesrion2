# Adapt to Film

Turn source material (transcript, story, article, screenplay, etc.) into a structured film-development project:

**Source → Adaptation → Treatment → Scenes → Shots → Production Plan**

This phase prepares the project for later image, video, narration, music, and sound generation. It does **not** render a finished film.

## Routes

| Route | Purpose |
|-------|---------|
| `/adapt-to-film` | Create a new Adapt project from pasted/uploaded text |
| `/projects/:id/adapt` | Six-stage Adapt workspace inside a project |
| `/tools/speech-to-text` | **Turn Into a Film** on a completed transcript |

## User workflow

1. Paste source text on `/adapt-to-film` (or upload `.txt`), or finish Speech to Text and click **Turn Into a Film**.
2. Configure adaptation type, length, aspect ratio, visual style, narrative approach, and fidelity.
3. Generate a structured film treatment (versioned; approve before continuing).
4. Generate editable scenes with source excerpts and fidelity labels.
5. Generate shots for approved scenes (locked scenes/shots are protected).
6. Review the production plan checklist and summary; continue into Storyboard / Characters when ready.

## API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/adapt-to-film/create` | Create project + seed `adapt_to_film` state |
| GET | `/api/projects/:id/adapt` | Load adapt state + production summary |
| PATCH | `/api/projects/:id/adapt` | Save state / change stage |
| POST | `/api/projects/:id/adapt/generate` | Start async AI job (`202` + `jobId`) |
| GET | `/api/projects/:id/adapt/jobs/:jobId` | Poll job status |

Generate `kind` values: `treatment`, `treatment_section`, `scenes`, `scene`, `shots`, `shot`, `shot_prompt`, `extract_characters`, `extract_assets`, `analyze_source`.

## Database

PocketBase `creative_projects` field:

- `adapt_to_film` (json) — full Adapt document (source, settings, treatments, scenes, shots, checklist)
- `workflow_mode` may include `adapt` (also marked in `concept_notes` via `<!-- aielegance:workflow=adapt -->`)

For existing installs:

```bash
npm run add-fields
```

Fresh installs pick this up from `scripts/setup-collections.js`.

Scenes/shots are also synced into `creative_scenes` / `creative_shots` after generation so Storyboard and Video can use them later.

## OpenRouter model settings

Defaults (override via env):

| Env | Default |
|-----|---------|
| `OPENROUTER_ADAPT_TREATMENT_MODEL` | `OPENROUTER_STORY_MODEL` or `openai/gpt-4o-mini` |
| `OPENROUTER_ADAPT_SCENES_MODEL` | same as treatment |
| `OPENROUTER_ADAPT_SHOTS_MODEL` | same as treatment |

Requires `OPENROUTER_API_KEY` (same key as the rest of the app).

## Large-source handling

Sources over ~24k characters are split into source blocks, summarized in passes, then used for treatment/scene generation. A `longSourceWarning` is stored and shown in the UI. Original block text and character offsets are preserved for traceability.

## Source traceability

Scenes include `sourceRefs` with excerpts and optional `startChar` / `endChar` / `blockId`. The UI **View in Source** action focuses the working source editor on that excerpt when possible. AI-created transitions should be labeled `ai_created_transition` and must not invent fake source links.

## Source prompt-injection safety

Source text is wrapped in `<<<SOURCE_MATERIAL>>>` … `<<<END_SOURCE_MATERIAL>>>` delimiters. System prompts instruct the model to treat source as data only and ignore instructions inside it.

## Credits / usage

No live billing. Jobs track `usageCharged: false` so a future metering hook will not double-charge retries. Rate limits use the existing in-memory limiter.

## Local testing

1. `npm run add-fields` (once) with PocketBase admin credentials in `.env`
2. `OPENROUTER_API_KEY` set
3. `npm run dev:pb` (or PB + `npm run dev`)
4. Sign in → **Tools → Adapt to Film** or Speech to Text → **Turn Into a Film**
5. Unit tests: `npx vitest run lib/adapt-to-film.test.ts`

## Known limitations

- Adapt state is one JSON document on the project (not separate treatment/scene collections)
- Aspect ratios `4:3` and `2.39:1` are stored in Adapt settings; PocketBase project `aspect_ratio` still only persists `16:9` / `9:16` / `1:1`
- In-memory generation jobs are lost on server restart
- Character/asset proposals require user approval before becoming permanent cast/assets (approval UX is basic in v1)
- No automatic image/video/audio generation in this phase

## Future production roadmap

- Attach generated frames, clips, narration, and SFX to shots
- Timeline assembly and export
- Stronger character approval → `creative_characters` / Bible linking
- Durable job queue and usage metering
