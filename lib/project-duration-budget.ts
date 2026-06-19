import type { ProjectGoal, ProjectTargetLength } from '~/types/creative-project'
import { STORYBOARD_CLIP_SECONDS } from '~/lib/storyboard-video-duration'

export interface ProjectDurationBudget {
  /** User-facing total runtime cap. */
  totalSeconds: number
  /** Panels use 5s or 10s clips in storyboard/video. */
  clipSeconds: (typeof STORYBOARD_CLIP_SECONDS)[number]
  /** Max storyboard panels across the whole project. */
  maxPanelsTotal: number
  /** Cap how many scenes we import / auto-board. */
  maxScenesForImport: number
  /** Max panels to generate for a single scene. */
  maxShotsPerScene: number
  /** Minimum panels per scene when generating. */
  minShotsPerScene: number
}

const MIN_RUNTIME = 15
const MAX_RUNTIME = 60 * 60

export function clampTargetDurationSeconds (n: unknown): number | undefined {
  const x = Math.floor(Number(n))
  if (!Number.isFinite(x)) return undefined
  if (x < MIN_RUNTIME || x > MAX_RUNTIME) return undefined
  return x
}

/** Default runtime when user picks spot/social but no explicit seconds yet. */
export function defaultDurationSecondsForProject (opts: {
  goal?: ProjectGoal
  targetLength?: ProjectTargetLength
}): number | undefined {
  if (opts.targetLength === 'spot' || opts.goal === 'commercial') return 60
  if (opts.goal === 'social') return 90
  if (opts.targetLength === 'music_video') return 180
  return undefined
}

export function buildDurationBudgetFromSeconds (totalSeconds: number): ProjectDurationBudget {
  const total = clampTargetDurationSeconds(totalSeconds) || 90
  const clipSeconds: 5 | 10 = 5
  const maxPanelsTotal = Math.max(1, Math.floor(total / clipSeconds))
  const maxScenesForImport =
    total <= 45
      ? Math.min(2, Math.max(1, Math.ceil(maxPanelsTotal / 3)))
      : Math.min(14, Math.max(2, Math.ceil(maxPanelsTotal / 4)))
  const maxShotsPerScene = Math.min(maxPanelsTotal, Math.max(1, Math.ceil(maxPanelsTotal / maxScenesForImport)))
  const minShotsPerScene = 1
  return {
    totalSeconds: total,
    clipSeconds,
    maxPanelsTotal,
    maxScenesForImport,
    maxShotsPerScene,
    minShotsPerScene
  }
}

export function resolveProjectDurationBudget (project: {
  targetDurationSeconds?: number | null
  targetLength?: ProjectTargetLength
  goal?: ProjectGoal
}): ProjectDurationBudget | null {
  const explicit = clampTargetDurationSeconds(project.targetDurationSeconds)
  if (explicit) return buildDurationBudgetFromSeconds(explicit)
  const fallback = defaultDurationSecondsForProject({
    goal: project.goal,
    targetLength: project.targetLength
  })
  if (fallback) return buildDurationBudgetFromSeconds(fallback)
  return null
}

export function perSceneShotCap (
  budget: ProjectDurationBudget,
  sceneCount: number,
  sceneIndex: number
): { minShots: number; maxShots: number } {
  const n = Math.max(1, Math.floor(sceneCount))
  const idx = Math.max(0, Math.min(n - 1, Math.floor(sceneIndex)))
  const base = Math.floor(budget.maxPanelsTotal / n)
  const extra = budget.maxPanelsTotal % n
  const maxShots = Math.min(base + (idx < extra ? 1 : 0), budget.maxShotsPerScene)
  return {
    minShots: maxShots > 0 ? 1 : 0,
    maxShots: Math.max(0, maxShots)
  }
}

export function durationBudgetPromptBlock (
  budget: ProjectDurationBudget,
  sceneCap?: { minShots: number; maxShots: number }
): string {
  const minS = sceneCap?.minShots ?? budget.minShotsPerScene
  const maxS = sceneCap?.maxShots ?? budget.maxShotsPerScene
  const panelWord = minS === maxS ? `exactly ${maxS}` : `${minS}–${maxS}`
  return [
    `RUNTIME BUDGET (strict): Finished piece must be ~${budget.totalSeconds} seconds total.`,
    `Storyboard panels use only ${budget.clipSeconds}s clips (minimum clip length).`,
    `Across the ENTIRE project use at most ${budget.maxPanelsTotal} panels total (≈${budget.totalSeconds}s when played in order).`,
    `For THIS scene return ${panelWord} panel(s) — not one more.`,
    `Every panel MUST use duration_seconds ${budget.clipSeconds} unless one beat truly needs 10.`,
    'Trim story beats to fit — no filler, no extra characters, no epilogue beyond the budget.'
  ].join(' ')
}

/** Trim model output and assign clip lengths so this scene fits its panel cap. */
export function fitShotsToSceneCap<T extends { duration_seconds: number }> (
  shots: T[],
  maxShots: number,
  clipSeconds: (typeof STORYBOARD_CLIP_SECONDS)[number] = 5
): T[] {
  const cap = Math.max(1, Math.floor(maxShots))
  return shots.slice(0, cap).map(s => ({ ...s, duration_seconds: clipSeconds }))
}

/** Hard constraints for AI concept JSON (overview “Generate concepts”). */
export function conceptDurationGuidance (
  budget: ProjectDurationBudget,
  goal?: ProjectGoal
): string {
  const { totalSeconds: secs, maxPanelsTotal: panels, maxScenesForImport: scenes, clipSeconds } = budget

  if (secs <= 25) {
    return [
      `RUNTIME LAW (non-negotiable): ${secs} seconds total on screen — a MICRO spot, NOT a short film or series.`,
      `Storyboard math: at most ${panels} beats × ${clipSeconds}s panels (${secs}s total). Max ${scenes} scene(s).`,
      'FORBIDDEN: three-act structure, B-plots, “years later”, ensemble casts, episodic hooks, feature-length arcs.',
      'summary: 2–4 short sentences describing ONLY what we see/hear in order (single moment, gag, or micro-arc).',
      'logline: one brief sentence for that moment — not a franchise pitch.',
      'characters: 1–2 ALL CAPS names maximum (0–1 if purely visual).',
      'hook: what happens in the first second only.',
      'If the user asks for a long story, compress it to fit this runtime — do not expand.'
    ].join(' ')
  }

  if (secs <= 60) {
    return [
      `RUNTIME LAW: ${secs} seconds total (~${panels} panels at ${clipSeconds}s). Max ${scenes} scenes.`,
      'One simple linear chain: setup → turn → payoff. No subplots or montage of unrelated beats.',
      'summary: 2–4 sentences, only on-screen action. Not a treatment for a half-hour show.',
      'characters: 2–3 names maximum.',
      'hook: opening beat that fits a sub-minute spot.'
    ].join(' ')
  }

  if (secs <= 120) {
    return [
      `RUNTIME LAW: ${secs} seconds (~${panels} panels). Max ${scenes} scenes.`,
      'One clear problem and resolution; no act breaks beyond a single reversal.',
      'summary: 3–5 tight sentences. No B-story.',
      'characters: 2–4 maximum.',
      goal === 'commercial'
        ? 'Treat as a single ad spot — product/brand moment must land before time runs out.'
        : ''
    ]
      .filter(Boolean)
      .join(' ')
  }

  return [
    `RUNTIME LAW: finished piece ~${secs}s (~${panels} storyboard panels at ${clipSeconds}s).`,
    `Use at most ${scenes} scenes when produced.`,
    screenplayDurationGuidance(budget, goal),
    'summary: scale scope to the budget — do not outline a feature if runtime is under a few minutes.'
  ].join(' ')
}

export function screenplayDurationGuidance (budget: ProjectDurationBudget, goal?: ProjectGoal): string {
  const kind =
    goal === 'social'
      ? 'vertical social video'
      : goal === 'commercial'
        ? 'commercial spot'
        : 'short-form piece'
  const lines = [
    `Write a ${kind} screenplay that cuts to exactly ~${budget.totalSeconds} seconds on screen.`,
    `Plan ~${budget.maxPanelsTotal} storyboard beats at ${budget.clipSeconds}s each.`,
    `Use only ${budget.maxScenesForImport} scenes or fewer; keep action simple and locations minimal.`
  ]
  if (budget.totalSeconds <= 25) {
    lines.push(
      'This is a MICRO spot: one scene slug line block, 1–2 characters, minimal dialogue (or none).',
      'No montage, no “later”, no second location, no act headings — just the single beat.'
    )
  } else if (budget.totalSeconds <= 60) {
    lines.push(
      'Keep to one or two short scenes; every line must be shootable within the second budget.',
      'No filler dialogue; cut before you exceed the runtime.'
    )
  }
  return lines.join(' ')
}
