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
  const clipSeconds: 5 | 10 = total <= 50 ? 5 : 5
  const maxPanelsTotal = Math.max(3, Math.floor(total / clipSeconds))
  const maxScenesForImport = Math.min(14, Math.max(2, Math.ceil(maxPanelsTotal / 4)))
  const maxShotsPerScene = Math.min(12, Math.max(3, Math.ceil(maxPanelsTotal / maxScenesForImport)))
  const minShotsPerScene = Math.min(3, maxShotsPerScene)
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

export function durationBudgetPromptBlock (budget: ProjectDurationBudget): string {
  return [
    `RUNTIME BUDGET (strict): Finished piece must be ~${budget.totalSeconds} seconds total.`,
    `Storyboard panels use only ${budget.clipSeconds}s or 10s clips.`,
    `Across the ENTIRE project use at most ${budget.maxPanelsTotal} panels (≈${budget.totalSeconds}s).`,
    `For THIS scene use between ${budget.minShotsPerScene} and ${budget.maxShotsPerScene} panels.`,
    'Trim story beats to fit — no filler, no extra characters, no epilogue beyond the budget.'
  ].join(' ')
}

export function screenplayDurationGuidance (budget: ProjectDurationBudget, goal?: ProjectGoal): string {
  const kind =
    goal === 'social'
      ? 'vertical social video'
      : goal === 'commercial'
        ? 'commercial spot'
        : 'short-form piece'
  return [
    `Write a ${kind} screenplay that cuts to exactly ~${budget.totalSeconds} seconds on screen.`,
    `Plan ~${budget.maxPanelsTotal} storyboard beats at ${budget.clipSeconds}s each.`,
    `Use only ${budget.maxScenesForImport} scenes or fewer; keep action simple and locations minimal.`
  ].join(' ')
}
