/** Continuity supervisor outcome — shared client + server. */

export type ContinuityCheckStatus = 'ran' | 'skipped' | 'failed' | 'unavailable'

export type ContinuityCheckSummary = {
  status: ContinuityCheckStatus
  issueCount: number
  memoryUpdated: boolean
  /** User-facing explanation (always set). */
  message: string
  /** Present when status is `ran` and issues were found. */
  issues?: string[]
}

export function continuityPassedMessage (issueCount: number): string {
  if (issueCount > 0) {
    return `Continuity check found ${issueCount} issue${issueCount === 1 ? '' : 's'} — see details below.`
  }
  return 'Continuity check passed — no issues found.'
}

export function continuitySkippedMessage (): string {
  return 'Continuity check skipped — OpenRouter is not configured. Panels were saved without an AI continuity review.'
}

export function continuityFailedMessage (detail?: string): string {
  const tail = detail?.trim()
  return tail
    ? `Continuity check failed (${tail}). Panels were saved without AI review.`
    : 'Continuity check failed — OpenRouter returned an error. Panels were saved without AI review.'
}

export function continuityUnavailableMessage (): string {
  return 'Continuity check could not read the AI response. Panels were saved without AI review.'
}

export function summaryFromContinuityCheck (opts: {
  status: ContinuityCheckStatus
  issues: string[]
  memoryUpdated: boolean
  detail?: string
}): ContinuityCheckSummary {
  const issueCount = opts.status === 'ran' ? opts.issues.length : 0
  let message: string
  switch (opts.status) {
    case 'skipped':
      message = continuitySkippedMessage()
      break
    case 'failed':
      message = continuityFailedMessage(opts.detail)
      break
    case 'unavailable':
      message = continuityUnavailableMessage()
      break
    default:
      message = continuityPassedMessage(issueCount)
  }
  return {
    status: opts.status,
    issueCount,
    memoryUpdated: opts.status === 'ran' ? opts.memoryUpdated : false,
    message,
    ...(opts.status === 'ran' && issueCount > 0 ? { issues: opts.issues } : {})
  }
}
