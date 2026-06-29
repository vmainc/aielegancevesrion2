import type PocketBase from 'pocketbase'
import type { ContinuityCheckStatus } from '~/lib/continuity-check-result'
import {
  continuityFailedMessage,
  continuityPassedMessage,
  continuitySkippedMessage,
  continuityUnavailableMessage
} from '~/lib/continuity-check-result'

const CONTINUITY_MEMORY_MAX = 50_000
const CONTINUITY_ISSUES_MAX = 20_000

export function formatContinuityLastIssues (issues: string[]): string {
  if (!issues.length) return ''
  return issues
    .map(i => `• ${i.trim()}`)
    .filter(i => i.length > 2)
    .join('\n')
    .slice(0, CONTINUITY_ISSUES_MAX)
}

export function appendContinuityMemory (
  existing: string,
  memoryAppend: string
): string {
  const base = existing.trim()
  const add = memoryAppend.trim()
  if (!add) return base
  return (base ? `${base}\n\n${add}` : add).slice(0, CONTINUITY_MEMORY_MAX)
}

function continuityLastIssuesText (opts: {
  status: ContinuityCheckStatus
  issues: string[]
  detail?: string
}): string {
  if (opts.status === 'skipped') {
    return `⚠ ${continuitySkippedMessage()}`
  }
  if (opts.status === 'failed') {
    return `⚠ ${continuityFailedMessage(opts.detail)}`
  }
  if (opts.status === 'unavailable') {
    return `⚠ ${continuityUnavailableMessage()}`
  }
  const formatted = formatContinuityLastIssues(opts.issues)
  if (formatted) return formatted
  return continuityPassedMessage(0)
}

/**
 * Persist continuity check output on the project bible fields.
 * Returns the merged continuity memory string (for downstream prompt assembly).
 */
export async function persistContinuityCheckOnProject (opts: {
  pb: PocketBase
  projectId: string
  existingMemory: string
  status: ContinuityCheckStatus
  issues: string[]
  memoryAppend: string
  detail?: string
}): Promise<{ continuityMemory: string; memoryUpdated: boolean }> {
  const { pb, projectId, existingMemory, status, issues, memoryAppend, detail } = opts

  const shouldAppendMemory = status === 'ran' && memoryAppend.trim().length > 0
  const continuityMemory = shouldAppendMemory
    ? appendContinuityMemory(existingMemory, memoryAppend)
    : existingMemory.trim()
  const memoryUpdated = shouldAppendMemory && continuityMemory !== existingMemory.trim()

  const patch: Record<string, string> = {
    continuity_last_issues: continuityLastIssuesText({ status, issues, detail }).slice(0, CONTINUITY_ISSUES_MAX)
  }
  if (memoryUpdated) {
    patch.continuity_memory = continuityMemory
  }

  await pb.collection('creative_projects').update(projectId, patch)

  return { continuityMemory, memoryUpdated }
}
