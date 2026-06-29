import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import type { BibleEntity, BibleEntityStatus, BibleEntityType } from '~/types/bible-entity'
import type { BibleFact, BibleFactStatus } from '~/types/bible-fact'
import type { BibleRelationship, BibleRelationshipStatus } from '~/types/bible-relationship'
import type { BibleSeedResult } from '~/types/bible-seed-result'
import type { BibleCastLinkResult } from '~/types/bible-cast-link-result'
import type { BibleSeedRemediationResult } from '~/types/bible-seed-remediation-result'
import type { LegacyAssetPromptRedactionResult } from '~/types/legacy-asset-prompt-redaction-result'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'
import type {
  ProductionBibleResolvedContext,
  ResolveProductionBibleContextOptions
} from '~/types/production-bible-context'

export type BibleEntityInput = {
  type: BibleEntityType
  name: string
  summary?: string
  description?: string
  status?: BibleEntityStatus
}

export type BibleFactInput = {
  entityId?: string
  statement: string
  factType?: string
  status?: BibleFactStatus
}

export type BibleFactReviewPatch = {
  statement?: string
  factType?: string
}

export type BibleRelationshipInput = {
  fromType: string
  fromId: string
  toType: string
  toId: string
  relationshipType: string
  role?: string
  status?: BibleRelationshipStatus
}

export function useProductionBible (projectId: Ref<string>) {
  const { getAuthToken } = useAuth()

  function headers () {
    return pocketBaseBearerHeaders(getAuthToken())
  }

  function apiBase () {
    return `/api/projects/${projectId.value}/bible`
  }

  async function loadEntities (): Promise<BibleEntity[]> {
    const res = await $fetch<{ entities: BibleEntity[] }>(`${apiBase()}/entities`, {
      headers: headers()
    })
    return res.entities
  }

  async function createEntity (input: BibleEntityInput): Promise<BibleEntity> {
    const res = await $fetch<{ entity: BibleEntity }>(`${apiBase()}/entities`, {
      method: 'POST',
      headers: headers(),
      body: {
        type: input.type,
        name: input.name,
        summary: input.summary || '',
        description: input.description || '',
        status: input.status || 'active'
      }
    })
    return res.entity
  }

  async function updateEntity (entityId: string, patch: Partial<BibleEntityInput>): Promise<BibleEntity> {
    const body: Record<string, unknown> = {}
    if (patch.type !== undefined) body.type = patch.type
    if (patch.name !== undefined) body.name = patch.name
    if (patch.summary !== undefined) body.summary = patch.summary
    if (patch.description !== undefined) body.description = patch.description
    if (patch.status !== undefined) body.status = patch.status
    const res = await $fetch<{ entity: BibleEntity }>(`${apiBase()}/entities/${entityId}`, {
      method: 'PATCH',
      headers: headers(),
      body
    })
    return res.entity
  }

  async function deleteEntity (entityId: string): Promise<void> {
    await $fetch(`${apiBase()}/entities/${entityId}`, {
      method: 'DELETE',
      headers: headers()
    })
  }

  async function loadFacts (entityId?: string): Promise<BibleFact[]> {
    const query = entityId ? `?entityId=${encodeURIComponent(entityId)}` : ''
    const res = await $fetch<{ facts: BibleFact[] }>(`${apiBase()}/facts${query}`, {
      headers: headers()
    })
    return res.facts
  }

  async function createFact (input: BibleFactInput): Promise<BibleFact> {
    const res = await $fetch<{ fact: BibleFact }>(`${apiBase()}/facts`, {
      method: 'POST',
      headers: headers(),
      body: {
        entityId: input.entityId,
        statement: input.statement,
        factType: input.factType || '',
        status: input.status || 'active'
      }
    })
    return res.fact
  }

  async function updateFact (factId: string, patch: Partial<BibleFactInput>): Promise<BibleFact> {
    const body: Record<string, unknown> = {}
    if (patch.statement !== undefined) body.statement = patch.statement
    if (patch.factType !== undefined) body.factType = patch.factType
    if (patch.status !== undefined) body.status = patch.status
    const res = await $fetch<{ fact: BibleFact }>(`${apiBase()}/facts/${factId}`, {
      method: 'PATCH',
      headers: headers(),
      body
    })
    return res.fact
  }

  async function approveFact (factId: string, patch?: BibleFactReviewPatch): Promise<BibleFact> {
    return updateFact(factId, {
      ...patch,
      status: 'active'
    })
  }

  async function rejectFact (factId: string): Promise<BibleFact> {
    return updateFact(factId, { status: 'retired' })
  }

  async function approveFacts (
    factIds: string[]
  ): Promise<{ updated: BibleFact[]; errors: Array<{ id: string; message: string }> }> {
    const updated: BibleFact[] = []
    const errors: Array<{ id: string; message: string }> = []
    for (const id of factIds) {
      try {
        updated.push(await approveFact(id))
      } catch (e: unknown) {
        errors.push({ id, message: formatApiFetchError(e) || 'Could not approve fact' })
      }
    }
    return { updated, errors }
  }

  async function rejectFacts (
    factIds: string[]
  ): Promise<{ updated: BibleFact[]; errors: Array<{ id: string; message: string }> }> {
    const updated: BibleFact[] = []
    const errors: Array<{ id: string; message: string }> = []
    for (const id of factIds) {
      try {
        updated.push(await rejectFact(id))
      } catch (e: unknown) {
        errors.push({ id, message: formatApiFetchError(e) || 'Could not reject fact' })
      }
    }
    return { updated, errors }
  }

  async function approveEntities (
    entityIds: string[]
  ): Promise<{ updated: BibleEntity[]; errors: Array<{ id: string; message: string }> }> {
    const updated: BibleEntity[] = []
    const errors: Array<{ id: string; message: string }> = []
    for (const id of entityIds) {
      try {
        updated.push(await approveEntity(id))
      } catch (e: unknown) {
        errors.push({ id, message: formatApiFetchError(e) || 'Could not approve entity' })
      }
    }
    return { updated, errors }
  }

  async function retireEntities (
    entityIds: string[]
  ): Promise<{ updated: BibleEntity[]; errors: Array<{ id: string; message: string }> }> {
    const updated: BibleEntity[] = []
    const errors: Array<{ id: string; message: string }> = []
    for (const id of entityIds) {
      try {
        updated.push(await retireEntity(id))
      } catch (e: unknown) {
        errors.push({ id, message: formatApiFetchError(e) || 'Could not retire entity' })
      }
    }
    return { updated, errors }
  }

  async function approveRelationships (
    relationshipIds: string[]
  ): Promise<{ updated: BibleRelationship[]; errors: Array<{ id: string; message: string }> }> {
    const updated: BibleRelationship[] = []
    const errors: Array<{ id: string; message: string }> = []
    for (const id of relationshipIds) {
      try {
        updated.push(await approveRelationship(id))
      } catch (e: unknown) {
        errors.push({ id, message: formatApiFetchError(e) || 'Could not approve relationship' })
      }
    }
    return { updated, errors }
  }

  async function retireRelationships (
    relationshipIds: string[]
  ): Promise<{ updated: BibleRelationship[]; errors: Array<{ id: string; message: string }> }> {
    const updated: BibleRelationship[] = []
    const errors: Array<{ id: string; message: string }> = []
    for (const id of relationshipIds) {
      try {
        updated.push(await retireRelationship(id))
      } catch (e: unknown) {
        errors.push({ id, message: formatApiFetchError(e) || 'Could not retire relationship' })
      }
    }
    return { updated, errors }
  }

  async function deleteFact (factId: string): Promise<void> {
    await $fetch(`${apiBase()}/facts/${factId}`, {
      method: 'DELETE',
      headers: headers()
    })
  }

  async function loadRelationships (): Promise<BibleRelationship[]> {
    const res = await $fetch<{ relationships: BibleRelationship[] }>(`${apiBase()}/relationships`, {
      headers: headers()
    })
    return res.relationships
  }

  async function createRelationship (input: BibleRelationshipInput): Promise<BibleRelationship> {
    const res = await $fetch<{ relationship: BibleRelationship }>(`${apiBase()}/relationships`, {
      method: 'POST',
      headers: headers(),
      body: input
    })
    return res.relationship
  }

  async function updateRelationship (
    relationshipId: string,
    patch: Partial<BibleRelationshipInput>
  ): Promise<BibleRelationship> {
    const res = await $fetch<{ relationship: BibleRelationship }>(
      `${apiBase()}/relationships/${relationshipId}`,
      {
        method: 'PATCH',
        headers: headers(),
        body: patch
      }
    )
    return res.relationship
  }

  async function deleteRelationship (relationshipId: string): Promise<void> {
    await $fetch(`${apiBase()}/relationships/${relationshipId}`, {
      method: 'DELETE',
      headers: headers()
    })
  }

  async function seedFromProject (dryRun = false): Promise<BibleSeedResult> {
    const res = await $fetch<{ seed: BibleSeedResult }>(`${apiBase()}/seed`, {
      method: 'POST',
      headers: headers(),
      body: { dryRun }
    })
    return res.seed
  }

  async function loadCastCharacters (): Promise<CreativeCharacter[]> {
    const res = await $fetch<{ characters: CreativeCharacter[] }>(
      `/api/projects/${projectId.value}/characters`,
      { headers: headers() }
    )
    return res.characters ?? []
  }

  async function linkCastToBible (dryRun = true): Promise<BibleCastLinkResult> {
    const res = await $fetch<{ link: BibleCastLinkResult }>(`${apiBase()}/link-cast`, {
      method: 'POST',
      headers: headers(),
      body: { dryRun }
    })
    return res.link
  }

  async function loadProjectAssets (): Promise<ProjectAsset[]> {
    const res = await $fetch<{ items: ProjectAsset[] }>(
      `/api/projects/${projectId.value}/assets`,
      { headers: headers() }
    )
    return res.items ?? []
  }

  async function patchProjectAsset (
    assetId: string,
    patch: { metadata?: Record<string, unknown> | null; title?: string; notes?: string }
  ): Promise<ProjectAsset> {
    const res = await $fetch<{ asset: ProjectAsset }>(
      `/api/projects/${projectId.value}/assets/${assetId}`,
      {
        method: 'PATCH',
        headers: headers(),
        body: patch
      }
    )
    return res.asset
  }

  async function remediateLegacySeededFacts (dryRun = true): Promise<BibleSeedRemediationResult> {
    const res = await $fetch<{ remediation: BibleSeedRemediationResult }>(
      `${apiBase()}/remediate-seeded-facts`,
      {
        method: 'POST',
        headers: headers(),
        body: { dryRun }
      }
    )
    return res.remediation
  }

  async function redactLegacyAssetPrompts (
    dryRun = true
  ): Promise<LegacyAssetPromptRedactionResult> {
    const res = await $fetch<{ redaction: LegacyAssetPromptRedactionResult }>(
      `/api/projects/${projectId.value}/assets/redact-legacy-prompts`,
      {
        method: 'POST',
        headers: headers(),
        body: { dryRun }
      }
    )
    return res.redaction
  }

  async function loadContextForPrompt (
    options: ResolveProductionBibleContextOptions
  ): Promise<ProductionBibleResolvedContext | null> {
    try {
      const query: Record<string, string> = {}
      if (options.sceneId) query.sceneId = options.sceneId
      if (options.shotId) query.shotId = options.shotId
      if (options.characterIds?.length) query.characterIds = options.characterIds.join(',')
      if (options.entityIds?.length) query.entityIds = options.entityIds.join(',')
      if (typeof options.maxItems === 'number') query.maxItems = String(options.maxItems)
      if (typeof options.tokenBudget === 'number') query.tokenBudget = String(options.tokenBudget)
      if (options.includeReviewFacts) query.includeReviewFacts = 'true'
      const res = await $fetch<{ context: ProductionBibleResolvedContext }>(`${apiBase()}/context`, {
        headers: headers(),
        query
      })
      return res.context ?? null
    } catch {
      return null
    }
  }

  async function approveEntity (entityId: string): Promise<BibleEntity> {
    return updateEntity(entityId, { status: 'active' })
  }

  async function retireEntity (entityId: string): Promise<BibleEntity> {
    return updateEntity(entityId, { status: 'retired' })
  }

  async function approveRelationship (relationshipId: string): Promise<BibleRelationship> {
    return updateRelationship(relationshipId, { status: 'active' })
  }

  async function retireRelationship (relationshipId: string): Promise<BibleRelationship> {
    return updateRelationship(relationshipId, { status: 'retired' })
  }

  return {
    loadEntities,
    createEntity,
    updateEntity,
    approveEntity,
    retireEntity,
    deleteEntity,
    loadFacts,
    createFact,
    updateFact,
    approveFact,
    approveFacts,
    rejectFact,
    rejectFacts,
    approveEntities,
    retireEntities,
    approveRelationships,
    retireRelationships,
    deleteFact,
    loadRelationships,
    createRelationship,
    updateRelationship,
    approveRelationship,
    retireRelationship,
    deleteRelationship,
    seedFromProject,
    loadCastCharacters,
    linkCastToBible,
    loadProjectAssets,
    patchProjectAsset,
    remediateLegacySeededFacts,
    redactLegacyAssetPrompts,
    loadContextForPrompt,
    formatApiFetchError
  }
}
