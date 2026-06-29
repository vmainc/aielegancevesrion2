import type PocketBase from 'pocketbase'
import {
  LEGACY_ASSET_PROMPT_METADATA_KEYS,
  LEGACY_PROMPT_REDACTION_REPLACEMENT,
  metadataHasFullPromptLeak,
  redactLegacyPromptMetadata,
  scanLegacyPromptFields
} from '~/lib/legacy-asset-prompt-metadata'
import { GENERATION_OBSERVABILITY_METADATA_KEY } from '~/lib/generation-observability'
import { listProjectAssetsForProject } from '~/server/utils/list-project-assets-pb'
import { pbRecordToProjectAsset } from '~/server/utils/project-asset-map'
import type {
  LegacyAssetPromptRedactionResult,
  LegacyAssetPromptRedactionSample
} from '~/types/legacy-asset-prompt-redaction-result'

const SAMPLE_LIMIT = 20

function metaRecord (raw: Record<string, unknown>): Record<string, unknown> {
  const m = raw.metadata
  return m && typeof m === 'object' && !Array.isArray(m) ? (m as Record<string, unknown>) : {}
}

function buildSample (
  assetId: string,
  title: string,
  kind: string,
  fields: string[]
): LegacyAssetPromptRedactionSample {
  return {
    assetId,
    title: title.slice(0, 200),
    kind,
    fields,
    replacements: fields.map((f) => `${f} → [redacted]; ${f}_hash → djb2:…`)
  }
}

function observabilitySnapshot (metadata: Record<string, unknown>): string {
  const obs = metadata[GENERATION_OBSERVABILITY_METADATA_KEY]
  if (!obs || typeof obs !== 'object') return ''
  try {
    return JSON.stringify(obs)
  } catch {
    return ''
  }
}

/**
 * Dry-run or apply redaction of legacy full prompt text on project asset metadata.
 * Never deletes assets; never modifies `generation_observability`.
 */
export async function redactLegacyAssetPrompts (opts: {
  pb: PocketBase
  userId: string
  projectId: string
  dryRun?: boolean
}): Promise<LegacyAssetPromptRedactionResult> {
  const { pb, userId, projectId, dryRun = true } = opts

  const rows = await listProjectAssetsForProject(pb, projectId, userId)
  const candidates: Array<{
    id: string
    title: string
    kind: string
    metadata: Record<string, unknown>
    fields: string[]
    observabilityBefore: string
  }> = []

  const fieldCounts: Record<string, number> = {}
  for (const key of LEGACY_ASSET_PROMPT_METADATA_KEYS) {
    fieldCounts[key] = 0
  }

  for (const row of rows) {
    const raw = row as Record<string, unknown>
    let asset
    try {
      asset = pbRecordToProjectAsset(raw, pb)
    } catch {
      continue
    }
    const metadata = metaRecord(raw)
    const fields = scanLegacyPromptFields(metadata)
    if (!fields.length) continue
    for (const f of fields) {
      fieldCounts[f] = (fieldCounts[f] || 0) + 1
    }
    candidates.push({
      id: asset.id,
      title: asset.title || asset.kind,
      kind: asset.kind,
      metadata,
      fields: [...fields],
      observabilityBefore: observabilitySnapshot(metadata)
    })
  }

  const fieldsFound = LEGACY_ASSET_PROMPT_METADATA_KEYS.filter((k) => (fieldCounts[k] || 0) > 0)

  const result: LegacyAssetPromptRedactionResult = {
    dryRun,
    assetsAffected: candidates.length,
    fieldsFound: [...fieldsFound],
    fieldCounts,
    samples: candidates.slice(0, SAMPLE_LIMIT).map((c) =>
      buildSample(c.id, c.title, c.kind, c.fields)
    ),
    replacementDescription: LEGACY_PROMPT_REDACTION_REPLACEMENT,
    updatedCount: 0,
    skippedCount: 0,
    remainingLeakCount: candidates.length,
    observabilityPreservedCount: 0
  }

  if (dryRun || !candidates.length) return result

  let remainingLeakCount = 0
  let observabilityPreservedCount = 0

  for (const c of candidates) {
    const { metadata: redacted, fieldsRedacted } = redactLegacyPromptMetadata(c.metadata)
    if (!fieldsRedacted.length) {
      result.skippedCount++
      continue
    }
    const obsAfter = observabilitySnapshot(redacted)
    if (c.observabilityBefore && obsAfter !== c.observabilityBefore) {
      result.skippedCount++
      continue
    }
    if (c.observabilityBefore) observabilityPreservedCount++

    try {
      await pb.collection('project_assets').update(c.id, { metadata: redacted })
      result.updatedCount++
      if (metadataHasFullPromptLeak(redacted)) {
        remainingLeakCount++
      }
    } catch {
      result.skippedCount++
    }
  }

  result.remainingLeakCount = remainingLeakCount
  result.observabilityPreservedCount = observabilityPreservedCount
  return result
}
