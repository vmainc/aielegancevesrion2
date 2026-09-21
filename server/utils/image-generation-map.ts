import type {
  FilmControls,
  ImageGenerationCategory,
  ImageGenerationRecord,
  ImageGenerationStatus
} from '~/types/image-generation'
import { stagedGeneratedImagePublicPath } from '~/server/utils/image-generation-store'

const STATUSES = new Set<ImageGenerationStatus>(['queued', 'generating', 'complete', 'failed'])
const CATEGORIES = new Set<ImageGenerationCategory>([
  'characters',
  'locations',
  'storyboards',
  'props',
  'concept_art',
  'other'
])

function asString (v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

function asJsonObject (v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function parseStatus (v: unknown): ImageGenerationStatus {
  const s = asString(v) as ImageGenerationStatus
  return STATUSES.has(s) ? s : 'failed'
}

function parseCategory (v: unknown): ImageGenerationCategory {
  const s = asString(v) as ImageGenerationCategory
  return CATEGORIES.has(s) ? s : 'other'
}

function parseFileList (v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof v === 'string' && v) return [v]
  return []
}

function relationId (v: unknown): string | null {
  if (typeof v === 'string' && v) return v
  if (v && typeof v === 'object' && 'id' in v) return asString((v as { id: unknown }).id) || null
  return null
}

export function pbRecordToImageGeneration (
  record: Record<string, unknown>,
  options?: {
    pbFilesBase?: (record: Record<string, unknown>, filename: string) => string
  }
): ImageGenerationRecord {
  const id = asString(record.id)
  const files = parseFileList(record.output_images)
  const imageUrls: string[] = []

  if (options?.pbFilesBase && files.length) {
    for (const f of files) {
      try {
        imageUrls.push(options.pbFilesBase(record, f))
      } catch {
        /* skip */
      }
    }
  }

  // Prefer stable app media URLs when staged indices are recorded.
  const stagedCount =
    typeof record.image_count === 'number'
      ? record.image_count
      : typeof record.image_count === 'string'
        ? Number(record.image_count)
        : files.length || imageUrls.length
  if (!imageUrls.length && id && stagedCount > 0 && record.status === 'complete') {
    for (let i = 0; i < Math.min(16, stagedCount); i++) {
      imageUrls.push(stagedGeneratedImagePublicPath(id, i))
    }
  }

  const assetIdsRaw = record.asset_ids
  const assetIds = Array.isArray(assetIdsRaw)
    ? assetIdsRaw.filter((x): x is string => typeof x === 'string')
    : typeof assetIdsRaw === 'string' && assetIdsRaw
      ? [assetIdsRaw]
      : []

  return {
    id,
    userId: relationId(record.owned_by) || asString(record.owned_by),
    projectId: relationId(record.project),
    prompt: asString(record.prompt),
    finalPrompt: asString(record.final_prompt) || asString(record.prompt),
    model: asString(record.model),
    provider: asString(record.provider),
    status: parseStatus(record.status),
    aspectRatio: asString(record.aspect_ratio) || null,
    resolution: asString(record.resolution) || null,
    imageCount: Number.isFinite(Number(record.image_count)) ? Number(record.image_count) : imageUrls.length,
    category: parseCategory(record.category),
    generationSettings: asJsonObject(record.generation_settings),
    filmControls: asJsonObject(record.film_controls) as FilmControls | null,
    referenceImageCount: Number.isFinite(Number(record.reference_image_count))
      ? Number(record.reference_image_count)
      : 0,
    cost:
      typeof record.cost === 'number'
        ? record.cost
        : record.cost != null && Number.isFinite(Number(record.cost))
          ? Number(record.cost)
          : null,
    currency: asString(record.currency) || null,
    usage: asJsonObject(record.usage),
    errorMessage: asString(record.error_message) || null,
    durationMs:
      typeof record.duration_ms === 'number'
        ? record.duration_ms
        : record.duration_ms != null && Number.isFinite(Number(record.duration_ms))
          ? Number(record.duration_ms)
          : null,
    favorite: Boolean(record.favorite),
    imageUrls,
    assetIds,
    created: asString(record.created),
    updated: asString(record.updated)
  }
}
