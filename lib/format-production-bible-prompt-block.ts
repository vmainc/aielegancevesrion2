import type { ProductionBibleResolvedContext } from '~/types/production-bible-context'
import { BIBLE_TENTATIVE_PROMPT_LABEL, isTentativeBibleStatus } from '~/lib/bible-trust'

function tentativePrefix (status: string): string {
  return isTentativeBibleStatus(status) ? `${BIBLE_TENTATIVE_PROMPT_LABEL} ` : ''
}

/** Render structured bible context as a compact prompt appendix (read-only). */
export function formatProductionBiblePromptBlock (ctx: ProductionBibleResolvedContext | null | undefined): string {
  if (!ctx) return ''
  const { entities, facts, relationships } = ctx
  if (!entities.length && !facts.length && !relationships.length) return ''

  const hasTentative =
    entities.some((e) => isTentativeBibleStatus(e.status)) ||
    facts.some((f) => isTentativeBibleStatus(f.status)) ||
    relationships.some((r) => isTentativeBibleStatus(r.status))

  const lines: string[] = [
    hasTentative
      ? 'PRODUCTION BIBLE REFERENCE (approved project memory — tentative items are provisional, not canon):'
      : 'PRODUCTION BIBLE REFERENCE (canonical project memory — do not contradict):'
  ]

  if (entities.length) {
    lines.push('ENTITIES:')
    for (const e of entities) {
      const summary = e.summary.trim()
      const tag = tentativePrefix(e.status)
      lines.push(
        summary
          ? `- ${tag}${e.name} (${e.type}): ${summary.slice(0, 260)}`
          : `- ${tag}${e.name} (${e.type})`
      )
    }
  }

  if (facts.length) {
    lines.push('FACTS:')
    for (const f of facts) {
      const who = f.entityName ? `${f.entityName}: ` : ''
      const tag = tentativePrefix(f.status)
      lines.push(`- ${tag}${who}${f.statement.slice(0, 300)}`)
    }
  }

  if (relationships.length) {
    lines.push('RELATIONSHIPS:')
    for (const r of relationships) {
      const tag = tentativePrefix(r.status)
      lines.push(`- ${tag}${r.summary.slice(0, 200)}`)
    }
  }

  return lines.join('\n').slice(0, 4000)
}

export function estimateProductionBibleContextChars (ctx: ProductionBibleResolvedContext): number {
  return formatProductionBiblePromptBlock(ctx).length
}

/** Short label for UI/debug when bible context is resolved for a prompt. */
export function formatProductionBibleDebugLabel (
  ctx: ProductionBibleResolvedContext | null | undefined
): string {
  if (!ctx) return 'Production Bible context unavailable'
  const d = ctx.debug
  if (!d.entitiesIncluded && !d.factsIncluded && !d.relationshipsIncluded) {
    const excluded = d.reviewFactsExcluded > 0 ? `; ${d.reviewFactsExcluded} review facts excluded` : ''
    return `Production Bible: no matching context${excluded}`
  }
  const reviewNote =
    d.reviewFactsExcluded > 0 ? `; ${d.reviewFactsExcluded} review facts excluded` : ''
  return `Production Bible: ${d.entitiesIncluded} entities, ${d.factsIncluded} facts, ${d.relationshipsIncluded} relationships (~${d.estimatedChars} chars)${reviewNote}`
}
