import type PocketBase from 'pocketbase'
import { resolveProductionBibleContext } from '~/server/utils/resolve-production-bible-context'
import type {
  ProductionBibleResolvedContext,
  ResolveProductionBibleContextOptions
} from '~/types/production-bible-context'

/** Fail-open Production Bible resolver for generation paths (read-only). */
export async function resolveProductionBibleForGeneration (
  pb: PocketBase,
  projectId: string,
  options: ResolveProductionBibleContextOptions = {}
): Promise<{ context: ProductionBibleResolvedContext | null; failOpenReason?: string }> {
  if (!projectId.trim()) {
    return { context: null, failOpenReason: 'missing project id' }
  }
  try {
    const context = await resolveProductionBibleContext(pb, projectId, options)
    return { context }
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message?: string }).message || '')
        : e instanceof Error
          ? e.message
          : 'context unavailable'
    return { context: null, failOpenReason: msg.slice(0, 200) || 'context unavailable' }
  }
}
