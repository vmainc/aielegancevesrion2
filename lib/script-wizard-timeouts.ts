/**
 * Large PDFs / screenplays: parsing + two OpenRouter calls + PocketBase can exceed default
 * browser / Node HTTP defaults (often ~5 min). Keep these generous and aligned.
 */
/** Browser $fetch for POST /api/script-wizard/scripts (multipart + full server pipeline). */
export const SCRIPT_WIZARD_UPLOAD_CLIENT_MS = 30 * 60 * 1000 // 30 min

/** Follow-up AI steps: generate treatment or three-act breakdown (OpenRouter-heavy). */
export const SCRIPT_WIZARD_STEP_CLIENT_MS = 30 * 60 * 1000 // 30 min

/** OpenRouter chat completion for screenplay enrichment (large JSON). */
export const OPENROUTER_ENRICH_MS = 25 * 60 * 1000 // 25 min

/** OpenRouter second pass (three-act breakdown). */
export const OPENROUTER_THREE_ACT_MS = 20 * 60 * 1000 // 20 min

/** Node HTTP `server.requestTimeout` / `headersTimeout` for long uploads (dev + prod). */
export const NODE_HTTP_LONG_MS = 35 * 60 * 1000 // 35 min (must exceed client + work)
