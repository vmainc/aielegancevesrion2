<script setup lang="ts">
import { BIBLE_ENTITY_TYPES, BIBLE_ENTITY_STATUSES, type BibleEntity, type BibleEntityType } from '~/types/bible-entity'
import { BIBLE_FACT_STATUSES, BIBLE_FACT_TYPES, type BibleFact } from '~/types/bible-fact'
import {
  bibleStatusBadgeClass,
  bibleStatusDisplayLabel,
  isBibleFactPendingReview,
  isTentativeBibleStatus
} from '~/lib/bible-trust'
import {
  castBibleConfidenceLabel,
  resolveBibleEntityToCastCharacter,
  buildCastBibleBridgeMaps
} from '~/lib/bible-cast-bridge'
import {
  assetBibleLinkSourceLabel,
  assetsLinkableToBibleEntity,
  BIBLE_ASSET_ENTITY_METADATA_KEY,
  readAssetBridgeFields,
  resolveBibleEntityRelatedAssets
} from '~/lib/bible-cast-asset-bridge'
import { formatAssetProvenanceLine } from '~/lib/generation-observability'
import { projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import {
  BIBLE_ENDPOINT_TYPES,
  BIBLE_RELATIONSHIP_STATUSES,
  type BibleRelationship,
  type BibleRelationshipStatus
} from '~/types/bible-relationship'
import type { BibleCastLinkResult } from '~/types/bible-cast-link-result'
import type { BibleSeedResult } from '~/types/bible-seed-result'
import type { BibleSeedRemediationResult } from '~/types/bible-seed-remediation-result'
import type { LegacyAssetPromptRedactionResult } from '~/types/legacy-asset-prompt-redaction-result'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'
import { isLegacySeededFactCandidate } from '~/lib/legacy-seeded-fact-match'
import {
  biblePendingFactSourceCategory,
  DEFAULT_BIBLE_PENDING_FACT_FILTERS,
  filterPendingReviewFacts,
  type BiblePendingFactFilters
} from '~/lib/bible-pending-fact-filters'
import {
  buildTentativeReviewItems,
  DEFAULT_BIBLE_TENTATIVE_ITEM_FILTERS,
  filterTentativeReviewItems,
  parseTentativeReviewItemKey,
  tentativeReviewItemKey,
  type BibleTentativeItemFilters,
  type BibleTentativeReviewItem
} from '~/lib/bible-tentative-item-filters'

const props = defineProps<{
  projectId: string
}>()

const { isAuthenticated, getAuthToken } = useAuth()
const { activeProject } = useCreativeProject()
const toast = useToast()

const PB_ID = /^[a-z0-9]{15}$/

const bible = useProductionBible(toRef(() => props.projectId))

const canUse = computed(
  () => !!activeProject.value && PB_ID.test(props.projectId) && isAuthenticated.value
)

const pending = ref(false)
const loadError = ref<string | null>(null)
const mutating = ref(false)
const seeding = ref(false)
const seedModalOpen = ref(false)
const seedPreview = ref<BibleSeedResult | null>(null)
const legacyRemediationModalOpen = ref(false)
const legacyRemediationPreview = ref<BibleSeedRemediationResult | null>(null)
const legacyRemediating = ref(false)
const legacyPromptRedactionModalOpen = ref(false)
const legacyPromptRedactionPreview = ref<LegacyAssetPromptRedactionResult | null>(null)
const legacyPromptRedacting = ref(false)
const castLinking = ref(false)
const castLinkModalOpen = ref(false)
const castLinkPreview = ref<BibleCastLinkResult | null>(null)

const entities = ref<BibleEntity[]>([])
const facts = ref<BibleFact[]>([])
const projectFacts = ref<BibleFact[]>([])
const relationships = ref<BibleRelationship[]>([])
const castCharacters = ref<CreativeCharacter[]>([])
const projectAssets = ref<ProjectAsset[]>([])
const assetLinkPickId = ref('')

const selectedId = ref<string | null>(null)
const showNewEntity = ref(false)

const entityTypeLabels: Record<BibleEntityType, string> = {
  character: 'Characters',
  location: 'Locations',
  prop: 'Props',
  creature: 'Creatures',
  species: 'Species',
  organization: 'Organizations',
  technology: 'Technology',
  world_rule: 'World rules',
  event: 'Events',
  style_rule: 'Style rules',
  concept: 'Concepts'
}

const entitiesByType = computed(() => {
  const groups = new Map<BibleEntityType, BibleEntity[]>()
  for (const t of BIBLE_ENTITY_TYPES) groups.set(t, [])
  for (const e of entities.value) {
    const list = groups.get(e.type) || []
    list.push(e)
    groups.set(e.type, list)
  }
  for (const [, list] of groups) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0)
})

const selectedEntity = computed(() =>
  entities.value.find((e) => e.id === selectedId.value) ?? null
)

const linkedCast = computed(() => {
  const e = selectedEntity.value
  if (!e || e.type !== 'character') return null
  const link = resolveBibleEntityToCastCharacter(
    e,
    castCharacters.value.map((c) => ({ id: c.id, name: c.name })),
    relationships.value
  )
  if (!link) return null
  const character = castCharacters.value.find((c) => c.id === link.characterId)
  return {
    characterId: link.characterId,
    characterName: character?.name || link.characterId,
    confidence: link.confidence,
    confidenceLabel: castBibleConfidenceLabel(link.confidence)
  }
})

const showCastLinkAction = computed(
  () => castCharacters.value.length > 0 || (castLinkPreview.value?.matchedCount ?? 0) > 0
)

const castBridgeMaps = computed(() =>
  buildCastBibleBridgeMaps(
    entities.value,
    castCharacters.value.map((c) => ({ id: c.id, name: c.name })),
    relationships.value
  )
)

const entityRelatedAssets = computed(() => {
  const e = selectedEntity.value
  if (!e) return []
  return resolveBibleEntityRelatedAssets(
    e,
    projectAssets.value,
    entities.value,
    castCharacters.value.map((c) => ({ id: c.id, name: c.name })),
    relationships.value,
    castBridgeMaps.value
  )
})

const linkableAssetsForEntity = computed(() => {
  const e = selectedEntity.value
  if (!e || e.type !== 'character' || !linkedCast.value) return []
  return assetsLinkableToBibleEntity(e, projectAssets.value, linkedCast.value.characterId)
})

function assetPlaybackUrl (asset: ProjectAsset): string {
  return projectAssetPlaybackSrc(
    {
      id: asset.id,
      projectId: asset.projectId || props.projectId,
      fileUrl: asset.fileUrl
    },
    getAuthToken()
  )
}

function assetSceneShotLabel (asset: ProjectAsset): string {
  const fields = readAssetBridgeFields(asset.metadata)
  const parts: string[] = []
  if (fields.sceneId) parts.push(`scene ${fields.sceneId.slice(0, 8)}…`)
  if (fields.shotId) parts.push(`shot ${fields.shotId.slice(0, 8)}…`)
  return parts.join(' · ')
}

function assetProvenanceLine (asset: ProjectAsset): string | null {
  const meta = asset.metadata && typeof asset.metadata === 'object'
    ? asset.metadata as Record<string, unknown>
    : null
  return formatAssetProvenanceLine(meta)
}

async function onLinkAssetToBibleEntity () {
  const entity = selectedEntity.value
  const assetId = assetLinkPickId.value.trim()
  if (!entity || !assetId) return
  if (
    !globalThis.confirm(
      `Add ${BIBLE_ASSET_ENTITY_METADATA_KEY} to this asset’s metadata? Existing metadata is preserved; only the Bible link field is set.`
    )
  ) {
    return
  }
  const asset = projectAssets.value.find((a) => a.id === assetId)
  if (!asset) return
  mutating.value = true
  try {
    const meta = {
      ...(asset.metadata && typeof asset.metadata === 'object' ? asset.metadata : {}),
      [BIBLE_ASSET_ENTITY_METADATA_KEY]: entity.id
    }
    const updated = await bible.patchProjectAsset(assetId, { metadata: meta })
    projectAssets.value = projectAssets.value.map((a) => (a.id === assetId ? updated : a))
    assetLinkPickId.value = ''
    toast.success('Asset metadata linked to this Bible entity')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not link asset')
  } finally {
    mutating.value = false
  }
}

const entityRelationships = computed(() => {
  const id = selectedId.value
  if (!id) return []
  return relationships.value.filter(
    (r) =>
      (r.fromType === 'bible_entity' && r.fromId === id) ||
      (r.toType === 'bible_entity' && r.toId === id)
  )
})

const factsPendingReview = computed(() =>
  projectFacts.value.filter((f) => isBibleFactPendingReview(f.status))
)

const pendingFactFilters = ref<BiblePendingFactFilters>({ ...DEFAULT_BIBLE_PENDING_FACT_FILTERS })
const selectedPendingFactIds = ref<Set<string>>(new Set())

const visiblePendingFacts = computed(() =>
  filterPendingReviewFacts(factsPendingReview.value, pendingFactFilters.value)
)

const selectedVisiblePendingCount = computed(() =>
  visiblePendingFacts.value.filter((f) => selectedPendingFactIds.value.has(f.id)).length
)

const allVisiblePendingSelected = computed(
  () =>
    visiblePendingFacts.value.length > 0 &&
    visiblePendingFacts.value.every((f) => selectedPendingFactIds.value.has(f.id))
)

watch(visiblePendingFacts, (list) => {
  const visible = new Set(list.map((f) => f.id))
  const next = new Set([...selectedPendingFactIds.value].filter((id) => visible.has(id)))
  if (next.size !== selectedPendingFactIds.value.size) {
    selectedPendingFactIds.value = next
  }
})

const legacySeededActiveFacts = computed(() =>
  projectFacts.value.filter(
    (f) =>
      f.projectId === props.projectId &&
      isLegacySeededFactCandidate(f, f.ownerId)
  )
)

const showLegacyRemediationAction = computed(
  () =>
    legacySeededActiveFacts.value.length > 0 ||
    (legacyRemediationPreview.value?.foundCount ?? 0) > 0
)

function factSourceLabel (fact: BibleFact): string {
  const category = biblePendingFactSourceCategory(fact)
  if (category === 'continuity') return 'Continuity'
  if (category === 'seed') return 'Seed'
  return 'Other'
}

function togglePendingFactSelection (factId: string) {
  const next = new Set(selectedPendingFactIds.value)
  if (next.has(factId)) next.delete(factId)
  else next.add(factId)
  selectedPendingFactIds.value = next
}

function toggleSelectAllVisiblePending () {
  if (allVisiblePendingSelected.value) {
    selectedPendingFactIds.value = new Set()
    return
  }
  selectedPendingFactIds.value = new Set(visiblePendingFacts.value.map((f) => f.id))
}

function confirmBulkFactAction (action: 'approve' | 'reject', count: number): boolean {
  if (count <= 0) return false
  const verb = action === 'approve' ? 'Approve' : 'Reject'
  const effect =
    action === 'approve'
      ? 'They will become active and may appear in generation prompts.'
      : 'They will be retired and excluded from prompt context.'
  return globalThis.confirm(`${verb} ${count} fact${count === 1 ? '' : 's'}? ${effect}`)
}

async function runBulkApproveFacts (factIds: string[]) {
  const ids = [...new Set(factIds)].filter(Boolean)
  if (!ids.length) return
  if (!confirmBulkFactAction('approve', ids.length)) return
  mutating.value = true
  try {
    const { updated, errors } = await bible.approveFacts(ids)
    for (const f of updated) syncFactInLists(f)
    selectedPendingFactIds.value = new Set()
    if (errors.length) {
      toast.error(`Approved ${updated.length}; ${errors.length} failed.`)
    } else {
      toast.success(`Approved ${updated.length} fact${updated.length === 1 ? '' : 's'}.`)
    }
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not approve facts')
  } finally {
    mutating.value = false
  }
}

async function runBulkRejectFacts (factIds: string[]) {
  const ids = [...new Set(factIds)].filter(Boolean)
  if (!ids.length) return
  if (!confirmBulkFactAction('reject', ids.length)) return
  mutating.value = true
  try {
    const { updated, errors } = await bible.rejectFacts(ids)
    for (const f of updated) {
      syncFactInLists(f)
      if (editingFactId.value === f.id) editingFactId.value = null
    }
    selectedPendingFactIds.value = new Set()
    if (errors.length) {
      toast.error(`Retired ${updated.length}; ${errors.length} failed.`)
    } else {
      toast.success(`Retired ${updated.length} fact${updated.length === 1 ? '' : 's'}.`)
    }
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not reject facts')
  } finally {
    mutating.value = false
  }
}

function onBulkApproveSelected () {
  const ids = visiblePendingFacts.value
    .filter((f) => selectedPendingFactIds.value.has(f.id))
    .map((f) => f.id)
  void runBulkApproveFacts(ids)
}

function onBulkRejectSelected () {
  const ids = visiblePendingFacts.value
    .filter((f) => selectedPendingFactIds.value.has(f.id))
    .map((f) => f.id)
  void runBulkRejectFacts(ids)
}

function onBulkApproveAllVisible () {
  void runBulkApproveFacts(visiblePendingFacts.value.map((f) => f.id))
}

function onBulkRejectAllVisible () {
  void runBulkRejectFacts(visiblePendingFacts.value.map((f) => f.id))
}

const tentativeReviewItems = computed(() =>
  buildTentativeReviewItems(entities.value, relationships.value)
)

const tentativeItemFilters = ref<BibleTentativeItemFilters>({ ...DEFAULT_BIBLE_TENTATIVE_ITEM_FILTERS })
const selectedTentativeItemKeys = ref<Set<string>>(new Set())

const visibleTentativeItems = computed(() =>
  filterTentativeReviewItems(tentativeReviewItems.value, tentativeItemFilters.value)
)

const tentativeRelationshipTypeOptions = computed(() => {
  const types = new Set<string>()
  for (const item of tentativeReviewItems.value) {
    if (item.kind === 'relationship' && item.relationshipType?.trim()) {
      types.add(item.relationshipType.trim())
    }
  }
  return [...types].sort((a, b) => a.localeCompare(b))
})

const selectedVisibleTentativeCount = computed(() =>
  visibleTentativeItems.value.filter((item) =>
    selectedTentativeItemKeys.value.has(tentativeReviewItemKey(item))
  ).length
)

const allVisibleTentativeSelected = computed(
  () =>
    visibleTentativeItems.value.length > 0 &&
    visibleTentativeItems.value.every((item) =>
      selectedTentativeItemKeys.value.has(tentativeReviewItemKey(item))
    )
)

watch(visibleTentativeItems, (list) => {
  const visible = new Set(list.map((item) => tentativeReviewItemKey(item)))
  const next = new Set([...selectedTentativeItemKeys.value].filter((key) => visible.has(key)))
  if (next.size !== selectedTentativeItemKeys.value.size) {
    selectedTentativeItemKeys.value = next
  }
})

function tentativeItemKindLabel (kind: BibleTentativeReviewItem['kind']): string {
  return kind === 'entity' ? 'Entity' : 'Relationship'
}

function toggleTentativeItemSelection (key: string) {
  const next = new Set(selectedTentativeItemKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedTentativeItemKeys.value = next
}

function toggleSelectAllVisibleTentative () {
  if (allVisibleTentativeSelected.value) {
    selectedTentativeItemKeys.value = new Set()
    return
  }
  selectedTentativeItemKeys.value = new Set(
    visibleTentativeItems.value.map((item) => tentativeReviewItemKey(item))
  )
}

function confirmBulkTentativeAction (action: 'approve' | 'retire', count: number): boolean {
  if (count <= 0) return false
  const verb = action === 'approve' ? 'Approve' : 'Retire'
  const effect =
    action === 'approve'
      ? 'They will become active and appear in generation prompts as canonical bible context (tentative labels removed).'
      : 'They will be retired and excluded from generation prompts.'
  return globalThis.confirm(`${verb} ${count} tentative item${count === 1 ? '' : 's'}? ${effect}`)
}

function splitTentativeItemKeys (keys: string[]) {
  const entityIds: string[] = []
  const relationshipIds: string[] = []
  for (const key of keys) {
    const parsed = parseTentativeReviewItemKey(key)
    if (!parsed) continue
    if (parsed.kind === 'entity') entityIds.push(parsed.id)
    else relationshipIds.push(parsed.id)
  }
  return { entityIds, relationshipIds }
}

function syncEntityInList (updated: BibleEntity) {
  entities.value = entities.value.map((x) => (x.id === updated.id ? updated : x))
  const sel = selectedEntity.value
  if (sel?.id === updated.id) syncEntityForm(updated)
}

function syncRelationshipInList (updated: BibleRelationship) {
  relationships.value = relationships.value.map((x) => (x.id === updated.id ? updated : x))
}

async function runBulkApproveTentativeItems (keys: string[]) {
  const unique = [...new Set(keys)].filter(Boolean)
  if (!unique.length) return
  if (!confirmBulkTentativeAction('approve', unique.length)) return
  const { entityIds, relationshipIds } = splitTentativeItemKeys(unique)
  mutating.value = true
  try {
    let updatedCount = 0
    let errorCount = 0
    if (entityIds.length) {
      const { updated, errors } = await bible.approveEntities(entityIds)
      for (const e of updated) syncEntityInList(e)
      updatedCount += updated.length
      errorCount += errors.length
    }
    if (relationshipIds.length) {
      const { updated, errors } = await bible.approveRelationships(relationshipIds)
      for (const r of updated) syncRelationshipInList(r)
      updatedCount += updated.length
      errorCount += errors.length
    }
    selectedTentativeItemKeys.value = new Set()
    if (errorCount) {
      toast.error(`Approved ${updatedCount}; ${errorCount} failed.`)
    } else {
      toast.success(`Approved ${updatedCount} tentative item${updatedCount === 1 ? '' : 's'}.`)
    }
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not approve tentative items')
  } finally {
    mutating.value = false
  }
}

async function runBulkRetireTentativeItems (keys: string[]) {
  const unique = [...new Set(keys)].filter(Boolean)
  if (!unique.length) return
  if (!confirmBulkTentativeAction('retire', unique.length)) return
  const { entityIds, relationshipIds } = splitTentativeItemKeys(unique)
  mutating.value = true
  try {
    let updatedCount = 0
    let errorCount = 0
    if (entityIds.length) {
      const { updated, errors } = await bible.retireEntities(entityIds)
      for (const e of updated) syncEntityInList(e)
      updatedCount += updated.length
      errorCount += errors.length
    }
    if (relationshipIds.length) {
      const { updated, errors } = await bible.retireRelationships(relationshipIds)
      for (const r of updated) syncRelationshipInList(r)
      updatedCount += updated.length
      errorCount += errors.length
    }
    selectedTentativeItemKeys.value = new Set()
    if (errorCount) {
      toast.error(`Retired ${updatedCount}; ${errorCount} failed.`)
    } else {
      toast.success(`Retired ${updatedCount} tentative item${updatedCount === 1 ? '' : 's'}.`)
    }
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not retire tentative items')
  } finally {
    mutating.value = false
  }
}

function onBulkApproveTentativeSelected () {
  const keys = visibleTentativeItems.value
    .filter((item) => selectedTentativeItemKeys.value.has(tentativeReviewItemKey(item)))
    .map((item) => tentativeReviewItemKey(item))
  void runBulkApproveTentativeItems(keys)
}

function onBulkRetireTentativeSelected () {
  const keys = visibleTentativeItems.value
    .filter((item) => selectedTentativeItemKeys.value.has(tentativeReviewItemKey(item)))
    .map((item) => tentativeReviewItemKey(item))
  void runBulkRetireTentativeItems(keys)
}

function onBulkApproveAllVisibleTentative () {
  void runBulkApproveTentativeItems(
    visibleTentativeItems.value.map((item) => tentativeReviewItemKey(item))
  )
}

function onBulkRetireAllVisibleTentative () {
  void runBulkRetireTentativeItems(
    visibleTentativeItems.value.map((item) => tentativeReviewItemKey(item))
  )
}

async function onApproveTentativeItem (item: BibleTentativeReviewItem) {
  mutating.value = true
  try {
    if (item.kind === 'entity') {
      const updated = await bible.approveEntity(item.id)
      syncEntityInList(updated)
    } else {
      const updated = await bible.approveRelationship(item.id)
      syncRelationshipInList(updated)
    }
    selectedTentativeItemKeys.value = new Set(
      [...selectedTentativeItemKeys.value].filter((k) => k !== tentativeReviewItemKey(item))
    )
    toast.success(`${tentativeItemKindLabel(item.kind)} approved`)
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not approve item')
  } finally {
    mutating.value = false
  }
}

async function onRetireTentativeItem (item: BibleTentativeReviewItem) {
  if (
    !globalThis.confirm(
      `Retire this tentative ${item.kind}? It will be excluded from generation prompts.`
    )
  ) {
    return
  }
  mutating.value = true
  try {
    if (item.kind === 'entity') {
      const updated = await bible.retireEntity(item.id)
      syncEntityInList(updated)
    } else {
      const updated = await bible.retireRelationship(item.id)
      syncRelationshipInList(updated)
    }
    selectedTentativeItemKeys.value = new Set(
      [...selectedTentativeItemKeys.value].filter((k) => k !== tentativeReviewItemKey(item))
    )
    toast.success(`${tentativeItemKindLabel(item.kind)} retired`)
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not retire item')
  } finally {
    mutating.value = false
  }
}

function openTentativeItemInPanel (item: BibleTentativeReviewItem) {
  if (item.kind === 'entity') {
    selectedId.value = item.id
  }
}

function entityLabelForFact (fact: BibleFact): string {
  if (!fact.entityId) return 'Project'
  return entities.value.find((e) => e.id === fact.entityId)?.name ?? 'Entity'
}

function factStatusLabel (status: string): string {
  return bibleStatusDisplayLabel(status)
}

function factStatusClass (status: string): string {
  return bibleStatusBadgeClass(status)
}

function statusLabel (status: string): string {
  return bibleStatusDisplayLabel(status)
}

function statusClass (status: string): string {
  return bibleStatusBadgeClass(status)
}

function factNeedsReview (fact: BibleFact): boolean {
  return isBibleFactPendingReview(fact.status)
}

function syncFactInLists (updated: BibleFact) {
  facts.value = facts.value.map((f) => (f.id === updated.id ? updated : f))
  projectFacts.value = projectFacts.value.map((f) => (f.id === updated.id ? updated : f))
}

const newEntityForm = ref({
  type: 'character' as BibleEntityType,
  name: '',
  summary: '',
  description: '',
  status: 'active' as const
})

const entityForm = ref({
  type: 'character' as BibleEntityType,
  name: '',
  summary: '',
  description: '',
  status: 'active' as const
})

const newFactForm = ref({
  statement: '',
  factType: '',
  status: 'active' as const
})

const editingFactId = ref<string | null>(null)
const factEditForm = ref({
  statement: '',
  factType: '',
  status: 'active' as const
})

const newRelForm = ref({
  direction: 'outgoing' as 'outgoing' | 'incoming',
  otherType: 'scene' as string,
  otherId: '',
  relationshipType: '',
  role: '',
  status: 'active' as const
})

const editingRelId = ref<string | null>(null)
const relEditForm = ref({
  relationshipType: '',
  role: '',
  status: 'active' as const
})

function syncEntityForm (e: BibleEntity) {
  entityForm.value = {
    type: e.type,
    name: e.name,
    summary: e.summary,
    description: e.description,
    status: e.status
  }
}

watch(selectedEntity, (e) => {
  editingFactId.value = null
  editingRelId.value = null
  if (e) syncEntityForm(e)
})

function applyEntityFactsFilter () {
  facts.value = selectedId.value
    ? projectFacts.value.filter((f) => f.entityId === selectedId.value)
    : []
}

async function refreshAll () {
  if (!canUse.value) return
  pending.value = true
  loadError.value = null
  try {
    const [ents, rels, allFacts, cast, assets] = await Promise.all([
      bible.loadEntities(),
      bible.loadRelationships(),
      bible.loadFacts(),
      bible.loadCastCharacters().catch(() => [] as CreativeCharacter[]),
      bible.loadProjectAssets().catch(() => [] as ProjectAsset[])
    ])
    entities.value = ents
    relationships.value = rels
    projectFacts.value = allFacts
    castCharacters.value = cast
    projectAssets.value = assets
    if (selectedId.value && !ents.some((e) => e.id === selectedId.value)) {
      selectedId.value = ents[0]?.id ?? null
    }
    applyEntityFactsFilter()
  } catch (e: unknown) {
    loadError.value = bible.formatApiFetchError(e) || 'Could not load Production Bible'
  } finally {
    pending.value = false
  }
}

async function refreshFacts () {
  if (!selectedId.value || !canUse.value) {
    facts.value = []
    return
  }
  if (!projectFacts.value.length) {
    projectFacts.value = await bible.loadFacts()
  }
  applyEntityFactsFilter()
}

watch(
  () => [props.projectId, canUse.value] as const,
  () => {
    selectedId.value = null
    void refreshAll()
  },
  { immediate: true }
)

watch(selectedId, () => {
  void refreshFacts()
})

function selectEntity (id: string) {
  selectedId.value = id
  showNewEntity.value = false
}

function openContinuityFinding (fact: BibleFact) {
  if (fact.entityId) {
    selectEntity(fact.entityId)
  }
}

async function onCreateEntity () {
  if (!newEntityForm.value.name.trim()) {
    toast.error('Name is required')
    return
  }
  mutating.value = true
  try {
    const created = await bible.createEntity(newEntityForm.value)
    entities.value = [...entities.value, created].sort((a, b) => a.name.localeCompare(b.name))
    selectedId.value = created.id
    showNewEntity.value = false
    newEntityForm.value = { type: 'character', name: '', summary: '', description: '', status: 'active' }
    toast.success('Entity created')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not create entity')
  } finally {
    mutating.value = false
  }
}

async function onSaveEntity () {
  const e = selectedEntity.value
  if (!e) return
  if (!entityForm.value.name.trim()) {
    toast.error('Name is required')
    return
  }
  mutating.value = true
  try {
    const updated = await bible.updateEntity(e.id, entityForm.value)
    entities.value = entities.value.map((x) => (x.id === updated.id ? updated : x))
    syncEntityForm(updated)
    toast.success('Entity saved')
  } catch (err: unknown) {
    toast.error(bible.formatApiFetchError(err) || 'Could not save entity')
  } finally {
    mutating.value = false
  }
}

async function onApproveEntity () {
  const e = selectedEntity.value
  if (!e) return
  mutating.value = true
  try {
    const updated = await bible.approveEntity(e.id)
    entities.value = entities.value.map((x) => (x.id === updated.id ? updated : x))
    syncEntityForm(updated)
    toast.success('Entity approved')
  } catch (err: unknown) {
    toast.error(bible.formatApiFetchError(err) || 'Could not approve entity')
  } finally {
    mutating.value = false
  }
}

async function onRetireEntity () {
  const e = selectedEntity.value
  if (!e) return
  if (!globalThis.confirm(`Retire “${e.name}”? It will be excluded from prompt context.`)) return
  mutating.value = true
  try {
    const updated = await bible.retireEntity(e.id)
    entities.value = entities.value.map((x) => (x.id === updated.id ? updated : x))
    syncEntityForm(updated)
    toast.success('Entity retired')
  } catch (err: unknown) {
    toast.error(bible.formatApiFetchError(err) || 'Could not retire entity')
  } finally {
    mutating.value = false
  }
}

async function onDeleteEntity () {
  const e = selectedEntity.value
  if (!e) return
  if (!globalThis.confirm(`Delete “${e.name}”? Facts and relationships may become orphaned.`)) return
  mutating.value = true
  try {
    await bible.deleteEntity(e.id)
    entities.value = entities.value.filter((x) => x.id !== e.id)
    relationships.value = relationships.value.filter(
      (r) =>
        !(r.fromType === 'bible_entity' && r.fromId === e.id) &&
        !(r.toType === 'bible_entity' && r.toId === e.id)
    )
    selectedId.value = entities.value[0]?.id ?? null
    toast.success('Entity deleted')
  } catch (err: unknown) {
    toast.error(bible.formatApiFetchError(err) || 'Could not delete entity')
  } finally {
    mutating.value = false
  }
}

async function onCreateFact () {
  if (!selectedId.value) return
  if (!newFactForm.value.statement.trim()) {
    toast.error('Fact statement is required')
    return
  }
  mutating.value = true
  try {
    const created = await bible.createFact({
      entityId: selectedId.value,
      ...newFactForm.value
    })
    facts.value = [created, ...facts.value]
    projectFacts.value = [created, ...projectFacts.value]
    newFactForm.value = { statement: '', factType: '', status: 'active' }
    toast.success('Fact added')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not add fact')
  } finally {
    mutating.value = false
  }
}

function startEditFact (f: BibleFact) {
  editingFactId.value = f.id
  factEditForm.value = {
    statement: f.statement,
    factType: f.factType,
    status: f.status
  }
}

async function onSaveFact (factId: string) {
  if (!factEditForm.value.statement.trim()) {
    toast.error('Fact statement is required')
    return
  }
  mutating.value = true
  try {
    const updated = await bible.updateFact(factId, factEditForm.value)
    syncFactInLists(updated)
    editingFactId.value = null
    toast.success('Fact saved')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not save fact')
  } finally {
    mutating.value = false
  }
}

async function onSaveAndApproveFact (factId: string) {
  if (!factEditForm.value.statement.trim()) {
    toast.error('Fact statement is required')
    return
  }
  mutating.value = true
  try {
    const updated = await bible.approveFact(factId, {
      statement: factEditForm.value.statement,
      factType: factEditForm.value.factType
    })
    syncFactInLists(updated)
    editingFactId.value = null
    toast.success('Fact approved')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not approve fact')
  } finally {
    mutating.value = false
  }
}

async function onApproveFact (fact: BibleFact) {
  mutating.value = true
  try {
    const updated = await bible.approveFact(fact.id)
    syncFactInLists(updated)
    toast.success('Fact approved')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not approve fact')
  } finally {
    mutating.value = false
  }
}

async function onRejectFact (fact: BibleFact) {
  if (!globalThis.confirm('Reject this fact? It will be retired and excluded from prompt context.')) return
  mutating.value = true
  try {
    const updated = await bible.rejectFact(fact.id)
    syncFactInLists(updated)
    if (editingFactId.value === fact.id) editingFactId.value = null
    toast.success('Fact retired')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not reject fact')
  } finally {
    mutating.value = false
  }
}

async function onDeleteFact (f: BibleFact) {
  if (!globalThis.confirm('Delete this fact?')) return
  mutating.value = true
  try {
    await bible.deleteFact(f.id)
    facts.value = facts.value.filter((x) => x.id !== f.id)
    projectFacts.value = projectFacts.value.filter((x) => x.id !== f.id)
    if (editingFactId.value === f.id) editingFactId.value = null
    toast.success('Fact deleted')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not delete fact')
  } finally {
    mutating.value = false
  }
}

function relEndpointLabel (type: string, id: string): string {
  if (type === 'bible_entity') {
    const ent = entities.value.find((e) => e.id === id)
    return ent ? `${ent.name} (entity)` : `entity:${id.slice(0, 8)}…`
  }
  if (type === 'project') return 'This project'
  return `${type}:${id.slice(0, 12)}${id.length > 12 ? '…' : ''}`
}

function relSummary (r: BibleRelationship): string {
  const id = selectedId.value
  if (!id) return r.relationshipType
  const isFrom = r.fromType === 'bible_entity' && r.fromId === id
  const otherType = isFrom ? r.toType : r.fromType
  const otherId = isFrom ? r.toId : r.fromId
  const arrow = isFrom ? '→' : '←'
  return `${r.relationshipType} ${arrow} ${relEndpointLabel(otherType, otherId)}`
}

async function onCreateRelationship () {
  const id = selectedId.value
  if (!id) return
  if (!newRelForm.value.relationshipType.trim()) {
    toast.error('Relationship type is required')
    return
  }
  if (!newRelForm.value.otherId.trim()) {
    toast.error('Other endpoint id is required')
    return
  }
  const payload =
    newRelForm.value.direction === 'outgoing'
      ? {
          fromType: 'bible_entity',
          fromId: id,
          toType: newRelForm.value.otherType,
          toId: newRelForm.value.otherId.trim(),
          relationshipType: newRelForm.value.relationshipType.trim(),
          role: newRelForm.value.role,
          status: newRelForm.value.status
        }
      : {
          fromType: newRelForm.value.otherType,
          fromId: newRelForm.value.otherId.trim(),
          toType: 'bible_entity',
          toId: id,
          relationshipType: newRelForm.value.relationshipType.trim(),
          role: newRelForm.value.role,
          status: newRelForm.value.status
        }
  mutating.value = true
  try {
    const created = await bible.createRelationship(payload)
    relationships.value = [created, ...relationships.value]
    newRelForm.value = {
      direction: 'outgoing',
      otherType: 'scene',
      otherId: '',
      relationshipType: '',
      role: '',
      status: 'active'
    }
    toast.success('Relationship added')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not add relationship')
  } finally {
    mutating.value = false
  }
}

function startEditRel (r: BibleRelationship) {
  editingRelId.value = r.id
  relEditForm.value = {
    relationshipType: r.relationshipType,
    role: r.role,
    status: r.status
  }
}

async function onSaveRel (relId: string) {
  mutating.value = true
  try {
    const updated = await bible.updateRelationship(relId, relEditForm.value)
    relationships.value = relationships.value.map((r) => (r.id === updated.id ? updated : r))
    editingRelId.value = null
    toast.success('Relationship saved')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not save relationship')
  } finally {
    mutating.value = false
  }
}

async function onApproveRel (r: BibleRelationship) {
  mutating.value = true
  try {
    const updated = await bible.approveRelationship(r.id)
    relationships.value = relationships.value.map((x) => (x.id === updated.id ? updated : x))
    toast.success('Relationship approved')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not approve relationship')
  } finally {
    mutating.value = false
  }
}

async function onRetireRel (r: BibleRelationship) {
  if (!globalThis.confirm('Retire this relationship? It will be excluded from prompt context.')) return
  mutating.value = true
  try {
    const updated = await bible.retireRelationship(r.id)
    relationships.value = relationships.value.map((x) => (x.id === updated.id ? updated : x))
    if (editingRelId.value === r.id) editingRelId.value = null
    toast.success('Relationship retired')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not retire relationship')
  } finally {
    mutating.value = false
  }
}

async function onDeleteRel (r: BibleRelationship) {
  if (!globalThis.confirm('Delete this relationship?')) return
  mutating.value = true
  try {
    await bible.deleteRelationship(r.id)
    relationships.value = relationships.value.filter((x) => x.id !== r.id)
    if (editingRelId.value === r.id) editingRelId.value = null
    toast.success('Relationship deleted')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not delete relationship')
  } finally {
    mutating.value = false
  }
}

async function previewSeed () {
  seeding.value = true
  try {
    seedPreview.value = await bible.seedFromProject(true)
    seedModalOpen.value = true
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not preview seed')
  } finally {
    seeding.value = false
  }
}

async function applySeed () {
  seeding.value = true
  try {
    const result = await bible.seedFromProject(false)
    seedPreview.value = result
    await refreshAll()
    toast.success('Production Bible seeded from project data')
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not seed Production Bible')
  } finally {
    seeding.value = false
  }
}

async function onSeedFromProject () {
  await previewSeed()
}

async function previewLegacyRemediation () {
  legacyRemediating.value = true
  try {
    legacyRemediationPreview.value = await bible.remediateLegacySeededFacts(true)
    legacyRemediationModalOpen.value = true
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not check legacy seeded facts')
  } finally {
    legacyRemediating.value = false
  }
}

async function applyLegacyRemediation () {
  if (
    !globalThis.confirm(
      'This moves old auto-seeded facts back into review so they do not affect prompts until approved. Continue?'
    )
  ) {
    return
  }
  legacyRemediating.value = true
  try {
    const result = await bible.remediateLegacySeededFacts(false)
    legacyRemediationPreview.value = result
    await refreshAll()
    toast.success(
      result.updatedCount
        ? `Moved ${result.updatedCount} legacy fact(s) to needs review`
        : 'No legacy facts were updated'
    )
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not remediate legacy seeded facts')
  } finally {
    legacyRemediating.value = false
  }
}

async function previewLegacyPromptRedaction () {
  legacyPromptRedacting.value = true
  try {
    legacyPromptRedactionPreview.value = await bible.redactLegacyAssetPrompts(true)
    legacyPromptRedactionModalOpen.value = true
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not preview legacy prompt redaction')
  } finally {
    legacyPromptRedacting.value = false
  }
}

async function applyLegacyPromptRedaction () {
  if (
    !globalThis.confirm(
      'This removes old full prompt text from asset metadata and keeps only hashes/markers. Continue?'
    )
  ) {
    return
  }
  legacyPromptRedacting.value = true
  try {
    const result = await bible.redactLegacyAssetPrompts(false)
    legacyPromptRedactionPreview.value = result
    await refreshAll()
    if (result.updatedCount) {
      toast.success(`Redacted legacy prompts on ${result.updatedCount} asset(s)`)
    } else {
      toast.success('No asset metadata was updated')
    }
    if (result.remainingLeakCount > 0) {
      toast.error(`${result.remainingLeakCount} asset(s) may still contain full prompt text`)
    }
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not redact legacy prompt metadata')
  } finally {
    legacyPromptRedacting.value = false
  }
}

async function previewCastLink () {
  castLinking.value = true
  try {
    castLinkPreview.value = await bible.linkCastToBible(true)
    castLinkModalOpen.value = true
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not preview cast links')
  } finally {
    castLinking.value = false
  }
}

async function applyCastLink () {
  if (
  !window.confirm(
    'This links cast records to Bible character entities using metadata and name matching. Existing user-authored entities are not overwritten. Continue?'
  )
  ) {
    return
  }
  castLinking.value = true
  try {
    const result = await bible.linkCastToBible(false)
    castLinkPreview.value = result
    await refreshAll()
    toast.success(
      result.createdCount || result.linkedCount
        ? `Linked cast: ${result.matchedCount} already linked, ${result.linkedCount} newly linked, ${result.createdCount} created`
        : 'No cast links were changed'
    )
  } catch (e: unknown) {
    toast.error(bible.formatApiFetchError(e) || 'Could not link cast to Production Bible')
  } finally {
    castLinking.value = false
  }
}

function castLinkConfidenceClass (confidence?: string): string {
  if (confidence === 'explicit' || confidence === 'relationship') {
    return 'bg-emerald-100 text-emerald-900'
  }
  if (confidence === 'name') return 'bg-sky-100 text-sky-900'
  if (confidence === 'ambiguous') return 'bg-amber-100 text-amber-900'
  return 'bg-gray-100 text-gray-700'
}
</script>

<template>
  <div class="max-w-6xl">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <p class="text-sm text-gray-500">
        <span class="text-primary font-medium">Production Bible</span>
        · Canonical entities, facts, and relationships. Approved facts and active rows inform storyboard and video prompts; tentative and pending rows are labeled or excluded.
      </p>
      <div class="flex flex-wrap gap-2 shrink-0">
        <button
          v-if="showCastLinkAction"
          type="button"
          class="px-3 py-2 text-xs font-semibold rounded-lg border border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100 disabled:opacity-50"
          :disabled="castLinking || mutating || pending"
          @click="previewCastLink"
        >
          {{ castLinking ? 'Working…' : 'Link Cast to Bible' }}
        </button>
        <button
          v-if="showLegacyRemediationAction"
          type="button"
          class="px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          :disabled="legacyRemediating || mutating || pending"
          @click="previewLegacyRemediation"
        >
          {{ legacyRemediating ? 'Working…' : 'Review legacy seeded facts' }}
        </button>
        <button
          v-if="canUse"
          type="button"
          class="px-3 py-2 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 text-rose-950 hover:bg-rose-100 disabled:opacity-50"
          :disabled="legacyPromptRedacting || mutating || pending"
          @click="previewLegacyPromptRedaction"
        >
          {{ legacyPromptRedacting ? 'Working…' : 'Redact legacy prompt metadata' }}
        </button>
        <button
          type="button"
          class="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          :disabled="seeding || mutating || pending"
          @click="onSeedFromProject"
        >
          {{ seeding ? 'Working…' : 'Seed from Project' }}
        </button>
      </div>
    </div>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use the Production Bible.
    </div>

    <div
      v-else-if="!canUse"
      class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
    >
      Sign in and open a cloud project to view and edit the Production Bible.
    </div>

    <template v-else>
      <div
        v-if="pending"
        class="rounded-xl border border-primary/20 bg-primary/5 p-8 mb-6"
      >
        <FilmReelLoader size="sm" label="Loading Production Bible" sub-label="Fetching entities…" />
      </div>

      <div
        v-else-if="loadError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 mb-6"
      >
        {{ loadError }}
        <button
          type="button"
          class="ml-3 text-red-800 underline font-medium"
          @click="refreshAll"
        >
          Retry
        </button>
      </div>

      <div
        v-else
        class="space-y-6"
      >
        <section
          v-if="factsPendingReview.length"
          class="rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <h2 class="text-base font-semibold text-amber-950">Facts pending review</h2>
              <p class="text-xs text-amber-900/80 mt-0.5">
                From seeding and continuity checks — approve to include in prompts, or reject to retire.
              </p>
            </div>
            <span class="text-xs font-medium text-amber-800 bg-amber-100 px-2 py-1 rounded">
              {{ factsPendingReview.length }} pending
              <template v-if="visiblePendingFacts.length !== factsPendingReview.length">
                · {{ visiblePendingFacts.length }} visible
              </template>
            </span>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
            <label class="block text-xs">
              <span class="text-amber-900/80 font-medium">Source</span>
              <select
                v-model="pendingFactFilters.source"
                class="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">All sources</option>
                <option value="seed">Seed</option>
                <option value="continuity">Continuity</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label class="block text-xs">
              <span class="text-amber-900/80 font-medium">Fact type</span>
              <select
                v-model="pendingFactFilters.factType"
                class="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">All types</option>
                <option
                  v-for="t in BIBLE_FACT_TYPES"
                  :key="t"
                  :value="t"
                >
                  {{ t }}
                </option>
              </select>
            </label>
            <label class="block text-xs">
              <span class="text-amber-900/80 font-medium">Scope</span>
              <select
                v-model="pendingFactFilters.scope"
                class="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">All scopes</option>
                <option value="entity">Entity-linked</option>
                <option value="project">Project-scoped</option>
              </select>
            </label>
            <label class="block text-xs sm:col-span-2 lg:col-span-1">
              <span class="text-amber-900/80 font-medium">Search</span>
              <input
                v-model="pendingFactFilters.search"
                type="search"
                placeholder="Statement, type…"
                class="mt-0.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm"
              >
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-amber-200/80">
            <label class="inline-flex items-center gap-1.5 text-xs font-medium text-amber-950 mr-1">
              <input
                type="checkbox"
                class="rounded border-amber-300 text-primary focus:ring-primary"
                :checked="allVisiblePendingSelected"
                :disabled="!visiblePendingFacts.length || mutating"
                @change="toggleSelectAllVisiblePending"
              >
              Select all visible
            </label>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              :disabled="mutating || selectedVisiblePendingCount === 0"
              @click="onBulkApproveSelected"
            >
              Approve selected{{ selectedVisiblePendingCount ? ` (${selectedVisiblePendingCount})` : '' }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-300 text-red-700 bg-white disabled:opacity-50"
              :disabled="mutating || selectedVisiblePendingCount === 0"
              @click="onBulkRejectSelected"
            >
              Reject selected{{ selectedVisiblePendingCount ? ` (${selectedVisiblePendingCount})` : '' }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-800 bg-white disabled:opacity-50"
              :disabled="mutating || !visiblePendingFacts.length"
              @click="onBulkApproveAllVisible"
            >
              Approve all visible ({{ visiblePendingFacts.length }})
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-white disabled:opacity-50"
              :disabled="mutating || !visiblePendingFacts.length"
              @click="onBulkRejectAllVisible"
            >
              Reject all visible ({{ visiblePendingFacts.length }})
            </button>
          </div>

          <p
            v-if="!visiblePendingFacts.length"
            class="text-sm text-amber-900/80 italic"
          >
            No pending facts match the current filters.
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="f in visiblePendingFacts"
              :key="f.id"
              class="rounded-lg border border-amber-200/80 bg-white px-3 py-2 text-sm"
            >
              <div class="flex flex-wrap items-start gap-2">
                <input
                  type="checkbox"
                  class="mt-1 rounded border-amber-300 text-primary focus:ring-primary shrink-0"
                  :checked="selectedPendingFactIds.has(f.id)"
                  :disabled="mutating"
                  @change="togglePendingFactSelection(f.id)"
                >
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <p class="text-gray-900 flex-1 min-w-0">{{ f.statement }}</p>
                    <span
                      class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                      :class="factStatusClass(f.status)"
                    >
                      {{ factStatusLabel(f.status) }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-600">
                    <span class="font-medium text-amber-900/90">{{ factSourceLabel(f) }}</span>
                    <span v-if="f.factType">{{ f.factType }}</span>
                    <span>{{ entityLabelForFact(f) }}</span>
                    <span v-if="f.scopeType && f.scopeId">{{ f.scopeType }} · {{ f.scopeId.slice(0, 8) }}…</span>
                    <button
                      type="button"
                      class="text-emerald-700 font-semibold hover:underline disabled:opacity-50"
                      :disabled="mutating"
                      @click="onApproveFact(f)"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="text-primary font-medium hover:underline disabled:opacity-50"
                      :disabled="mutating"
                      @click="startEditFact(f); openContinuityFinding(f)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="text-red-600 font-medium hover:underline disabled:opacity-50"
                      :disabled="mutating"
                      @click="onRejectFact(f)"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <section
          v-if="tentativeReviewItems.length"
          class="rounded-xl border border-sky-200 bg-sky-50/80 p-4 sm:p-5 shadow-sm"
        >
          <div class="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div>
              <h2 class="text-base font-semibold text-sky-950">Tentative items</h2>
              <p class="text-xs text-sky-900/80 mt-0.5">
                Seeded or linked entities and relationships — approve for canonical prompts, or retire to exclude.
              </p>
            </div>
            <span class="text-xs font-medium text-sky-800 bg-sky-100 px-2 py-1 rounded">
              {{ tentativeReviewItems.length }} tentative
              <template v-if="visibleTentativeItems.length !== tentativeReviewItems.length">
                · {{ visibleTentativeItems.length }} visible
              </template>
            </span>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-3">
            <label class="block text-xs">
              <span class="text-sky-900/80 font-medium">Type</span>
              <select
                v-model="tentativeItemFilters.kind"
                class="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">All</option>
                <option value="entity">Entity</option>
                <option value="relationship">Relationship</option>
              </select>
            </label>
            <label class="block text-xs">
              <span class="text-sky-900/80 font-medium">Entity type</span>
              <select
                v-model="tentativeItemFilters.entityType"
                class="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">All entity types</option>
                <option
                  v-for="t in BIBLE_ENTITY_TYPES"
                  :key="t"
                  :value="t"
                >
                  {{ entityTypeLabels[t] }}
                </option>
              </select>
            </label>
            <label class="block text-xs">
              <span class="text-sky-900/80 font-medium">Relationship type</span>
              <select
                v-model="tentativeItemFilters.relationshipType"
                class="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm"
              >
                <option value="all">All relationship types</option>
                <option
                  v-for="t in tentativeRelationshipTypeOptions"
                  :key="t"
                  :value="t"
                >
                  {{ t }}
                </option>
              </select>
            </label>
            <label class="block text-xs sm:col-span-2 lg:col-span-1">
              <span class="text-sky-900/80 font-medium">Search</span>
              <input
                v-model="tentativeItemFilters.search"
                type="search"
                placeholder="Name, type, relationship…"
                class="mt-0.5 w-full rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-sm"
              >
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-2 mb-3 pb-3 border-b border-sky-200/80">
            <label class="inline-flex items-center gap-1.5 text-xs font-medium text-sky-950 mr-1">
              <input
                type="checkbox"
                class="rounded border-sky-300 text-primary focus:ring-primary"
                :checked="allVisibleTentativeSelected"
                :disabled="!visibleTentativeItems.length || mutating"
                @change="toggleSelectAllVisibleTentative"
              >
              Select all visible
            </label>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              :disabled="mutating || selectedVisibleTentativeCount === 0"
              @click="onBulkApproveTentativeSelected"
            >
              Approve selected{{ selectedVisibleTentativeCount ? ` (${selectedVisibleTentativeCount})` : '' }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-300 text-red-700 bg-white disabled:opacity-50"
              :disabled="mutating || selectedVisibleTentativeCount === 0"
              @click="onBulkRetireTentativeSelected"
            >
              Retire selected{{ selectedVisibleTentativeCount ? ` (${selectedVisibleTentativeCount})` : '' }}
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-800 bg-white disabled:opacity-50"
              :disabled="mutating || !visibleTentativeItems.length"
              @click="onBulkApproveAllVisibleTentative"
            >
              Approve all visible ({{ visibleTentativeItems.length }})
            </button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-white disabled:opacity-50"
              :disabled="mutating || !visibleTentativeItems.length"
              @click="onBulkRetireAllVisibleTentative"
            >
              Retire all visible ({{ visibleTentativeItems.length }})
            </button>
          </div>

          <p
            v-if="!visibleTentativeItems.length"
            class="text-sm text-sky-900/80 italic"
          >
            No tentative items match the current filters.
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="item in visibleTentativeItems"
              :key="tentativeReviewItemKey(item)"
              class="rounded-lg border border-sky-200/80 bg-white px-3 py-2 text-sm"
            >
              <div class="flex flex-wrap items-start gap-2">
                <input
                  type="checkbox"
                  class="mt-1 rounded border-sky-300 text-primary focus:ring-primary shrink-0"
                  :checked="selectedTentativeItemKeys.has(tentativeReviewItemKey(item))"
                  :disabled="mutating"
                  @change="toggleTentativeItemSelection(tentativeReviewItemKey(item))"
                >
                <div class="flex-1 min-w-0">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <p class="text-gray-900 flex-1 min-w-0">{{ item.title }}</p>
                    <span
                      class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                      :class="statusClass(item.status)"
                    >
                      {{ statusLabel(item.status) }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-600">
                    <span class="font-medium text-sky-900/90">{{ tentativeItemKindLabel(item.kind) }}</span>
                    <span v-if="item.entityType">{{ item.entityType }}</span>
                    <span v-if="item.relationshipType">{{ item.relationshipType }}</span>
                    <span v-if="item.detail" class="text-gray-500">{{ item.detail }}</span>
                    <button
                      v-if="item.kind === 'entity'"
                      type="button"
                      class="text-primary font-medium hover:underline disabled:opacity-50"
                      :disabled="mutating"
                      @click="openTentativeItemInPanel(item)"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      class="text-emerald-700 font-semibold hover:underline disabled:opacity-50"
                      :disabled="mutating"
                      @click="onApproveTentativeItem(item)"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="text-red-600 font-medium hover:underline disabled:opacity-50"
                      :disabled="mutating"
                      @click="onRetireTentativeItem(item)"
                    >
                      Retire
                    </button>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <div class="flex flex-col lg:flex-row gap-6 min-h-[24rem]">
        <!-- Entity list -->
        <aside class="lg:w-64 shrink-0 space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-gray-900">Entities</h2>
            <button
              type="button"
              class="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              :disabled="mutating"
              @click="showNewEntity = !showNewEntity"
            >
              {{ showNewEntity ? 'Cancel' : '+ Add' }}
            </button>
          </div>

          <form
            v-if="showNewEntity"
            class="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm"
            @submit.prevent="onCreateEntity"
          >
            <label class="block">
              <span class="text-xs text-gray-600">Type</span>
              <select
                v-model="newEntityForm.type"
                class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option v-for="t in BIBLE_ENTITY_TYPES" :key="t" :value="t">
                  {{ entityTypeLabels[t] }}
                </option>
              </select>
            </label>
            <label class="block">
              <span class="text-xs text-gray-600">Name</span>
              <input
                v-model="newEntityForm.name"
                type="text"
                required
                class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
            </label>
            <button
              type="submit"
              class="w-full py-1.5 rounded bg-primary text-gray-950 text-xs font-semibold disabled:opacity-50"
              :disabled="mutating"
            >
              Create
            </button>
          </form>

          <div
            v-if="!entities.length"
            class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-xs text-gray-600"
          >
            <p class="font-medium text-gray-800 mb-1">No entities yet</p>
            <p>Add characters, locations, props, and other universe objects. They stay separate from the cast table until a future migration.</p>
          </div>

          <div v-else class="space-y-4">
            <div v-for="[type, list] in entitiesByType" :key="type">
              <p class="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
                {{ entityTypeLabels[type] }}
              </p>
              <ul class="space-y-0.5">
                <li v-for="e in list" :key="e.id">
                  <button
                    type="button"
                    class="w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors"
                    :class="selectedId === e.id
                      ? 'bg-primary/15 text-primary font-medium border border-primary/30'
                      : 'text-gray-800 hover:bg-gray-100'"
                    @click="selectEntity(e.id)"
                  >
                    {{ e.name }}
                    <span
                      v-if="e.status !== 'active'"
                      class="ml-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                      :class="statusClass(e.status)"
                    >{{ statusLabel(e.status) }}</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        <!-- Detail panel -->
        <div class="flex-1 min-w-0">
          <div
            v-if="!selectedEntity"
            class="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-sm text-gray-600"
          >
            <p class="font-medium text-gray-900 mb-1">Select an entity</p>
            <p v-if="entities.length">Choose an entity from the list to edit its profile, facts, and relationships.</p>
            <p v-else>Create your first entity to get started.</p>
          </div>

          <template v-else>
            <!-- Entity form -->
            <section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 mb-6 shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div class="flex flex-wrap items-center gap-2 min-w-0">
                  <h2 class="text-lg font-semibold text-gray-900">{{ selectedEntity.name }}</h2>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded shrink-0"
                    :class="statusClass(selectedEntity.status)"
                  >
                    {{ statusLabel(selectedEntity.status) }}
                  </span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <template v-if="isTentativeBibleStatus(selectedEntity.status)">
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                      :disabled="mutating"
                      @click="onApproveEntity"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      :disabled="mutating"
                      @click="onRetireEntity"
                    >
                      Retire
                    </button>
                  </template>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-gray-950 disabled:opacity-50"
                    :disabled="mutating"
                    @click="onSaveEntity"
                  >
                    Save entity
                  </button>
                  <button
                    type="button"
                    class="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    :disabled="mutating"
                    @click="onDeleteEntity"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div
                v-if="linkedCast"
                class="mb-4 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2.5 text-sm"
              >
                <p class="text-xs font-semibold text-sky-900 uppercase tracking-wide mb-1">Linked cast record</p>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <NuxtLink
                    :to="`/projects/${projectId}/cast/${linkedCast.characterId}`"
                    class="font-medium text-sky-900 hover:underline"
                  >
                    {{ linkedCast.characterName }}
                  </NuxtLink>
                  <span
                    class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                    :class="castLinkConfidenceClass(linkedCast.confidence)"
                  >
                    {{ linkedCast.confidenceLabel }}
                  </span>
                </div>
              </div>
              <section
                v-if="selectedEntity"
                class="mb-4 rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-3"
              >
                <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h3 class="text-xs font-semibold text-violet-950 uppercase tracking-wide">
                    Related assets
                  </h3>
                  <span class="text-[11px] text-violet-800">
                    {{ entityRelatedAssets.length }} linked
                  </span>
                </div>
                <p
                  v-if="!entityRelatedAssets.length"
                  class="text-xs text-violet-900/80"
                >
                  No project assets match this entity via Bible metadata or linked cast.
                </p>
                <ul
                  v-else
                  class="space-y-2 max-h-48 overflow-y-auto"
                >
                  <li
                    v-for="row in entityRelatedAssets"
                    :key="row.asset.id"
                    class="rounded-md border border-violet-200/80 bg-white px-2.5 py-2 text-xs"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="min-w-0">
                        <a
                          v-if="row.asset.fileUrl"
                          :href="assetPlaybackUrl(row.asset)"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="font-medium text-violet-900 hover:underline"
                        >
                          {{ row.asset.title || row.asset.kind }}
                        </a>
                        <span v-else class="font-medium text-gray-800">
                          {{ row.asset.title || row.asset.kind }}
                        </span>
                        <p class="text-[11px] text-gray-500 mt-0.5">
                          {{ row.asset.kind }}
                          <span v-if="assetSceneShotLabel(row.asset)"> · {{ assetSceneShotLabel(row.asset) }}</span>
                        </p>
                        <p
                          v-if="assetProvenanceLine(row.asset)"
                          class="text-[11px] text-violet-900/90 mt-1"
                        >
                          {{ assetProvenanceLine(row.asset) }}
                        </p>
                      </div>
                      <div class="flex flex-wrap gap-1 shrink-0">
                        <span
                          v-for="source in row.linkSources"
                          :key="source"
                          class="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-900"
                        >
                          {{ assetBibleLinkSourceLabel(source) }}
                        </span>
                      </div>
                    </div>
                  </li>
                </ul>
                <div
                  v-if="selectedEntity.type === 'character' && linkableAssetsForEntity.length"
                  class="mt-3 pt-3 border-t border-violet-200/80"
                >
                  <p class="text-[11px] text-violet-900/90 mb-2">
                    Optionally set <code class="text-[10px]">{{ BIBLE_ASSET_ENTITY_METADATA_KEY }}</code> on a cast asset (metadata only).
                  </p>
                  <div class="flex flex-wrap items-end gap-2">
                    <label class="block text-xs flex-1 min-w-[12rem]">
                      <span class="text-gray-600">Cast asset</span>
                      <select
                        v-model="assetLinkPickId"
                        class="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">Choose asset…</option>
                        <option
                          v-for="a in linkableAssetsForEntity"
                          :key="a.id"
                          :value="a.id"
                        >
                          {{ a.title || a.kind }} ({{ a.kind }})
                        </option>
                      </select>
                    </label>
                    <button
                      type="button"
                      class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-violet-700 text-white disabled:opacity-50"
                      :disabled="mutating || !assetLinkPickId"
                      @click="onLinkAssetToBibleEntity"
                    >
                      Link selected asset to this Bible entity
                    </button>
                  </div>
                </div>
              </section>
              <div class="grid gap-3 sm:grid-cols-2">
                <label class="block text-sm">
                  <span class="text-gray-600 text-xs">Type</span>
                  <select
                    v-model="entityForm.type"
                    class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option v-for="t in BIBLE_ENTITY_TYPES" :key="t" :value="t">
                      {{ entityTypeLabels[t] }}
                    </option>
                  </select>
                </label>
                <label class="block text-sm">
                  <span class="text-gray-600 text-xs">Status</span>
                  <select
                    v-model="entityForm.status"
                    class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option v-for="s in BIBLE_ENTITY_STATUSES" :key="s" :value="s">
                      {{ statusLabel(s) }}
                    </option>
                  </select>
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="text-gray-600 text-xs">Name</span>
                  <input
                    v-model="entityForm.name"
                    type="text"
                    class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="text-gray-600 text-xs">Summary</span>
                  <textarea
                    v-model="entityForm.summary"
                    rows="2"
                    class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                  />
                </label>
                <label class="block text-sm sm:col-span-2">
                  <span class="text-gray-600 text-xs">Description</span>
                  <textarea
                    v-model="entityForm.description"
                    rows="4"
                    class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
                  />
                </label>
              </div>
            </section>

            <!-- Facts -->
            <section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 mb-6 shadow-sm">
              <h3 class="text-base font-semibold text-gray-900 mb-1">Facts</h3>
              <p class="text-xs text-gray-500 mb-4">Atomic claims about this entity.</p>

              <form
                class="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4 space-y-2"
                @submit.prevent="onCreateFact"
              >
                <label class="block text-sm">
                  <span class="text-xs text-gray-600">Statement</span>
                  <textarea
                    v-model="newFactForm.statement"
                    rows="2"
                    placeholder="e.g. Wears a red scarf after Scene 3"
                    class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-y"
                  />
                </label>
                <div class="flex flex-wrap gap-2">
                  <input
                    v-model="newFactForm.factType"
                    type="text"
                    placeholder="Fact type (optional)"
                    class="flex-1 min-w-[8rem] rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                  <button
                    type="submit"
                    class="px-3 py-1.5 rounded bg-primary text-gray-950 text-xs font-semibold disabled:opacity-50"
                    :disabled="mutating"
                  >
                    Add fact
                  </button>
                </div>
              </form>

              <div
                v-if="!facts.length"
                class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600"
              >
                <p class="font-medium text-gray-800 mb-1">No facts yet</p>
                <p>Add attributable claims — wardrobe, rules, timeline notes, and constraints.</p>
              </div>

              <ul v-else class="space-y-2">
                <li
                  v-for="f in facts"
                  :key="f.id"
                  class="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <template v-if="editingFactId === f.id">
                    <textarea
                      v-model="factEditForm.statement"
                      rows="2"
                      class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2 resize-y"
                    />
                    <div class="flex flex-wrap gap-2 items-center">
                      <input
                        v-model="factEditForm.factType"
                        type="text"
                        class="flex-1 min-w-[6rem] rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                      <select
                        v-model="factEditForm.status"
                        class="rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option v-for="s in BIBLE_FACT_STATUSES" :key="s" :value="s">
                          {{ factStatusLabel(s) }}
                        </option>
                      </select>
                      <button
                        type="button"
                        class="text-xs font-semibold text-primary"
                        :disabled="mutating"
                        @click="onSaveFact(f.id)"
                      >
                        Save
                      </button>
                      <button
                        v-if="factNeedsReview(f)"
                        type="button"
                        class="text-xs font-semibold text-emerald-700"
                        :disabled="mutating"
                        @click="onSaveAndApproveFact(f.id)"
                      >
                        Save &amp; approve
                      </button>
                      <button
                        type="button"
                        class="text-xs text-gray-500"
                        @click="editingFactId = null"
                      >
                        Cancel
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <p class="text-gray-900 flex-1 min-w-0">{{ f.statement }}</p>
                      <span
                        class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                        :class="factStatusClass(f.status)"
                      >
                        {{ factStatusLabel(f.status) }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
                      <span v-if="f.factType">{{ f.factType }}</span>
                      <template v-if="factNeedsReview(f)">
                        <button
                          type="button"
                          class="text-emerald-700 font-semibold"
                          :disabled="mutating"
                          @click="onApproveFact(f)"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          class="text-primary font-medium"
                          @click="startEditFact(f)"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          class="text-red-600"
                          :disabled="mutating"
                          @click="onRejectFact(f)"
                        >
                          Reject
                        </button>
                      </template>
                      <template v-else>
                        <button
                          type="button"
                          class="text-primary font-medium"
                          @click="startEditFact(f)"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          class="text-red-600"
                          :disabled="mutating"
                          @click="onDeleteFact(f)"
                        >
                          Delete
                        </button>
                      </template>
                    </div>
                  </template>
                </li>
              </ul>
            </section>

            <!-- Relationships -->
            <section class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <h3 class="text-base font-semibold text-gray-900 mb-1">Relationships</h3>
              <p class="text-xs text-gray-500 mb-4">Edges involving this entity.</p>

              <form
                class="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4 space-y-2 text-sm"
                @submit.prevent="onCreateRelationship"
              >
                <div class="flex flex-wrap gap-2">
                  <select
                    v-model="newRelForm.direction"
                    class="rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="outgoing">This entity → other</option>
                    <option value="incoming">Other → this entity</option>
                  </select>
                  <select
                    v-model="newRelForm.otherType"
                    class="rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option v-for="t in BIBLE_ENDPOINT_TYPES" :key="t" :value="t">
                      {{ t }}
                    </option>
                  </select>
                  <select
                    v-if="newRelForm.otherType === 'bible_entity'"
                    v-model="newRelForm.otherId"
                    class="flex-1 min-w-[10rem] rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Select entity…</option>
                    <option
                      v-for="e in entities.filter(x => x.id !== selectedId)"
                      :key="e.id"
                      :value="e.id"
                    >
                      {{ e.name }}
                    </option>
                  </select>
                  <input
                    v-else
                    v-model="newRelForm.otherId"
                    type="text"
                    placeholder="Other id (scene, shot, asset…)"
                    class="flex-1 min-w-[10rem] rounded border border-gray-300 px-2 py-1.5 text-sm font-mono text-xs"
                  >
                </div>
                <div class="flex flex-wrap gap-2">
                  <input
                    v-model="newRelForm.relationshipType"
                    type="text"
                    placeholder="Relationship type (e.g. appears_in)"
                    class="flex-1 min-w-[10rem] rounded border border-gray-300 px-2 py-1.5 text-sm"
                  >
                  <button
                    type="submit"
                    class="px-3 py-1.5 rounded bg-primary text-gray-950 text-xs font-semibold disabled:opacity-50"
                    :disabled="mutating"
                  >
                    Add relationship
                  </button>
                </div>
              </form>

              <div
                v-if="!entityRelationships.length"
                class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600"
              >
                <p class="font-medium text-gray-800 mb-1">No relationships yet</p>
                <p>Link this entity to scenes, shots, assets, or other bible entities.</p>
              </div>

              <ul v-else class="space-y-2">
                <li
                  v-for="r in entityRelationships"
                  :key="r.id"
                  class="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <template v-if="editingRelId === r.id">
                    <input
                      v-model="relEditForm.relationshipType"
                      type="text"
                      class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2"
                    >
                    <input
                      v-model="relEditForm.role"
                      type="text"
                      placeholder="Role (optional)"
                      class="w-full rounded border border-gray-300 px-2 py-1.5 text-sm mb-2"
                    >
                    <div class="flex gap-2">
                      <select
                        v-model="relEditForm.status"
                        class="rounded border border-gray-300 px-2 py-1 text-xs"
                      >
                        <option v-for="s in BIBLE_RELATIONSHIP_STATUSES" :key="s" :value="s">
                          {{ statusLabel(s) }}
                        </option>
                      </select>
                      <button
                        type="button"
                        class="text-xs font-semibold text-primary"
                        :disabled="mutating"
                        @click="onSaveRel(r.id)"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        class="text-xs text-gray-500"
                        @click="editingRelId = null"
                      >
                        Cancel
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <p class="text-gray-900 font-medium flex-1 min-w-0">{{ relSummary(r) }}</p>
                      <span
                        class="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
                        :class="statusClass(r.status)"
                      >
                        {{ statusLabel(r.status) }}
                      </span>
                    </div>
                    <p v-if="r.role" class="text-xs text-gray-500 mt-0.5">{{ r.role }}</p>
                    <div class="flex flex-wrap gap-2 mt-1 text-xs">
                      <template v-if="isTentativeBibleStatus(r.status)">
                        <button
                          type="button"
                          class="text-emerald-700 font-semibold"
                          :disabled="mutating"
                          @click="onApproveRel(r)"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          class="text-red-600 font-medium"
                          :disabled="mutating"
                          @click="onRetireRel(r)"
                        >
                          Retire
                        </button>
                      </template>
                      <button
                        type="button"
                        class="text-primary font-medium"
                        @click="startEditRel(r)"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        class="text-red-600"
                        :disabled="mutating"
                        @click="onDeleteRel(r)"
                      >
                        Delete
                      </button>
                    </div>
                  </template>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </div>
      </div>
    </template>

    <div
      v-if="seedModalOpen && seedPreview"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="seed-modal-title"
      @click.self="seedModalOpen = false"
    >
      <div class="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
        <h2 id="seed-modal-title" class="text-lg font-semibold text-gray-900 mb-1">
          {{ seedPreview.dryRun ? 'Seed preview' : 'Seed complete' }}
        </h2>
        <p class="text-xs text-gray-500 mb-4">
          Existing bible entries are never overwritten. Duplicates are skipped.
          New entities and relationships are <strong>Tentative</strong>; facts are
          <strong>Needs Review</strong> until you approve them in the Production Bible.
        </p>

        <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Entities created (tentative)</dt>
            <dd class="font-semibold text-gray-900">{{ seedPreview.entitiesCreated }}</dd>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Entities skipped</dt>
            <dd class="font-semibold text-gray-900">{{ seedPreview.entitiesSkippedDuplicate }}</dd>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Facts created (needs review)</dt>
            <dd class="font-semibold text-gray-900">{{ seedPreview.factsCreated }}</dd>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Facts skipped</dt>
            <dd class="font-semibold text-gray-900">{{ seedPreview.factsSkippedDuplicate }}</dd>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Relationships created (tentative)</dt>
            <dd class="font-semibold text-gray-900">{{ seedPreview.relationshipsCreated }}</dd>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Relationships skipped</dt>
            <dd class="font-semibold text-gray-900">{{ seedPreview.relationshipsSkippedDuplicate }}</dd>
          </div>
        </dl>

        <div v-if="seedPreview.created.entities.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">New entities (tentative)</p>
          <ul class="text-xs text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
            <li v-for="(e, i) in seedPreview.created.entities.slice(0, 20)" :key="i">
              {{ e.type }}: {{ e.name }}
              <span class="text-sky-700">· {{ factStatusLabel(e.status) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="seedPreview.created.facts.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">New facts (needs review)</p>
          <ul class="text-xs text-gray-600 space-y-0.5 max-h-24 overflow-y-auto">
            <li v-for="(f, i) in seedPreview.created.facts.slice(0, 20)" :key="i">
              {{ f.entityName }}: {{ f.statement.slice(0, 80) }}{{ f.statement.length > 80 ? '…' : '' }}
              <span class="text-amber-800">· {{ factStatusLabel(f.status) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="seedPreview.created.relationships.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">New relationships (tentative)</p>
          <ul class="text-xs text-gray-600 space-y-0.5 max-h-20 overflow-y-auto">
            <li v-for="(r, i) in seedPreview.created.relationships.slice(0, 15)" :key="i">
              {{ r.summary }}
              <span class="text-sky-700">· {{ factStatusLabel(r.status) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="seedPreview.unsupported.length" class="mb-3">
          <p class="text-xs font-semibold text-amber-800 mb-1">Skipped / unsupported</p>
          <ul class="text-xs text-amber-900 space-y-0.5 max-h-20 overflow-y-auto">
            <li v-for="(msg, i) in seedPreview.unsupported.slice(0, 10)" :key="i">{{ msg }}</li>
          </ul>
        </div>

        <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            @click="seedModalOpen = false"
          >
            Close
          </button>
          <button
            v-if="seedPreview.dryRun"
            type="button"
            class="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-gray-950 disabled:opacity-50"
            :disabled="seeding"
            @click="applySeed"
          >
            {{ seeding ? 'Seeding…' : 'Create entries' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="legacyRemediationModalOpen && legacyRemediationPreview"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legacy-remediation-title"
      @click.self="legacyRemediationModalOpen = false"
    >
      <div class="w-full max-w-lg rounded-xl border border-amber-200 bg-white shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
        <h2 id="legacy-remediation-title" class="text-lg font-semibold text-gray-900 mb-1">
          {{ legacyRemediationPreview.dryRun ? 'Legacy seeded facts preview' : 'Legacy remediation complete' }}
        </h2>
        <p class="text-xs text-amber-900/90 mb-4">
          This moves old auto-seeded facts back into review so they do not affect prompts until approved.
          User-authored and continuity facts are not changed.
        </p>

        <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
          <div class="rounded-lg bg-amber-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Facts found</dt>
            <dd class="font-semibold text-gray-900">{{ legacyRemediationPreview.foundCount }}</dd>
          </div>
          <div class="rounded-lg bg-amber-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Target status</dt>
            <dd class="font-semibold text-gray-900">{{ factStatusLabel(legacyRemediationPreview.targetStatus) }}</dd>
          </div>
          <div v-if="!legacyRemediationPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Updated</dt>
            <dd class="font-semibold text-gray-900">{{ legacyRemediationPreview.updatedCount }}</dd>
          </div>
          <div v-if="!legacyRemediationPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Skipped</dt>
            <dd class="font-semibold text-gray-900">{{ legacyRemediationPreview.skippedCount }}</dd>
          </div>
        </dl>

        <div v-if="legacyRemediationPreview.samples.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">Sample facts</p>
          <ul class="text-xs text-gray-600 space-y-1 max-h-40 overflow-y-auto">
            <li v-for="s in legacyRemediationPreview.samples" :key="s.id">
              {{ s.statement }}
              <span class="text-amber-800">· {{ factStatusLabel(s.currentStatus) }} → {{ factStatusLabel(s.targetStatus) }}</span>
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            @click="legacyRemediationModalOpen = false"
          >
            Close
          </button>
          <button
            v-if="legacyRemediationPreview.dryRun && legacyRemediationPreview.foundCount > 0"
            type="button"
            class="px-4 py-2 text-sm font-semibold rounded-lg bg-amber-600 text-white disabled:opacity-50"
            :disabled="legacyRemediating"
            @click="applyLegacyRemediation"
          >
            {{ legacyRemediating ? 'Working…' : 'Move to needs review' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="legacyPromptRedactionModalOpen && legacyPromptRedactionPreview"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legacy-prompt-redaction-title"
      @click.self="legacyPromptRedactionModalOpen = false"
    >
      <div class="w-full max-w-lg rounded-xl border border-rose-200 bg-white shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
        <h2 id="legacy-prompt-redaction-title" class="text-lg font-semibold text-gray-900 mb-1">
          {{ legacyPromptRedactionPreview.dryRun ? 'Legacy prompt metadata preview' : 'Legacy prompt redaction complete' }}
        </h2>
        <p class="text-xs text-rose-900/90 mb-4">
          This removes old full prompt text from asset metadata and keeps only hashes/markers.
          <code class="text-[10px]">generation_observability</code> and other non-prompt fields are preserved. Assets are not deleted.
        </p>

        <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
          <div class="rounded-lg bg-rose-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Assets affected</dt>
            <dd class="font-semibold text-gray-900">{{ legacyPromptRedactionPreview.assetsAffected }}</dd>
          </div>
          <div class="rounded-lg bg-rose-50 px-3 py-2 col-span-2 sm:col-span-1">
            <dt class="text-gray-500 text-xs">Fields found</dt>
            <dd class="font-semibold text-gray-900 text-xs">
              {{ legacyPromptRedactionPreview.fieldsFound.length ? legacyPromptRedactionPreview.fieldsFound.join(', ') : '—' }}
            </dd>
          </div>
          <div v-if="!legacyPromptRedactionPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Updated</dt>
            <dd class="font-semibold text-gray-900">{{ legacyPromptRedactionPreview.updatedCount }}</dd>
          </div>
          <div v-if="!legacyPromptRedactionPreview.dryRun" class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Remaining leaks</dt>
            <dd class="font-semibold text-gray-900">{{ legacyPromptRedactionPreview.remainingLeakCount }}</dd>
          </div>
        </dl>

        <p class="text-xs text-gray-600 mb-3">
          {{ legacyPromptRedactionPreview.replacementDescription }}
        </p>

        <div v-if="legacyPromptRedactionPreview.samples.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">Sample assets</p>
          <ul class="text-xs text-gray-600 space-y-2 max-h-40 overflow-y-auto">
            <li
              v-for="s in legacyPromptRedactionPreview.samples"
              :key="s.assetId"
              class="rounded-md border border-gray-100 px-2 py-1.5"
            >
              <span class="font-medium text-gray-800">{{ s.title || s.kind }}</span>
              <span class="text-gray-400"> · {{ s.assetId.slice(0, 8) }}…</span>
              <p class="text-[11px] text-rose-900/80 mt-0.5">
                {{ s.fields.join(', ') }}
              </p>
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            @click="legacyPromptRedactionModalOpen = false"
          >
            Close
          </button>
          <button
            v-if="legacyPromptRedactionPreview.dryRun && legacyPromptRedactionPreview.assetsAffected > 0"
            type="button"
            class="px-4 py-2 text-sm font-semibold rounded-lg bg-rose-700 text-white disabled:opacity-50"
            :disabled="legacyPromptRedacting"
            @click="applyLegacyPromptRedaction"
          >
            {{ legacyPromptRedacting ? 'Working…' : 'Redact prompt metadata' }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="castLinkModalOpen && castLinkPreview"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cast-link-title"
      @click.self="castLinkModalOpen = false"
    >
      <div class="w-full max-w-lg rounded-xl border border-sky-200 bg-white shadow-xl p-5 sm:p-6 max-h-[85vh] overflow-y-auto">
        <h2 id="cast-link-title" class="text-lg font-semibold text-gray-900 mb-1">
          {{ castLinkPreview.dryRun ? 'Link cast preview' : 'Cast link complete' }}
        </h2>
        <p class="text-xs text-sky-900/90 mb-4">
          Links project cast records to Bible character entities. User-authored entities and conflicting links are skipped.
          New entities are created as tentative with metadata only — cast rows are never modified.
        </p>

        <dl class="grid grid-cols-2 gap-3 text-sm mb-4">
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Already linked</dt>
            <dd class="font-semibold text-gray-900">{{ castLinkPreview.matchedCount }}</dd>
          </div>
          <div class="rounded-lg bg-sky-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Newly linked</dt>
            <dd class="font-semibold text-gray-900">{{ castLinkPreview.linkedCount }}</dd>
          </div>
          <div class="rounded-lg bg-emerald-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Created</dt>
            <dd class="font-semibold text-gray-900">{{ castLinkPreview.createdCount }}</dd>
          </div>
          <div class="rounded-lg bg-amber-50 px-3 py-2">
            <dt class="text-gray-500 text-xs">Ambiguous</dt>
            <dd class="font-semibold text-gray-900">{{ castLinkPreview.ambiguousCount }}</dd>
          </div>
          <div class="rounded-lg bg-gray-50 px-3 py-2 col-span-2">
            <dt class="text-gray-500 text-xs">Skipped</dt>
            <dd class="font-semibold text-gray-900">{{ castLinkPreview.skippedCount }}</dd>
          </div>
        </dl>

        <div v-if="castLinkPreview.linked.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">Newly linked</p>
          <ul class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
            <li v-for="row in castLinkPreview.linked" :key="row.characterId">
              {{ row.characterName }} → {{ row.entityName }}
              <span
                v-if="row.confidence"
                class="ml-1 font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                :class="castLinkConfidenceClass(row.confidence)"
              >
                {{ castBibleConfidenceLabel(row.confidence) }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="castLinkPreview.created.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">Created entities</p>
          <ul class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
            <li v-for="row in castLinkPreview.created" :key="row.characterId">
              {{ row.characterName }}
            </li>
          </ul>
        </div>

        <div v-if="castLinkPreview.ambiguous.length" class="mb-3">
          <p class="text-xs font-semibold text-amber-800 mb-1">Ambiguous (manual review needed)</p>
          <ul class="text-xs text-amber-900 space-y-1 max-h-32 overflow-y-auto">
            <li v-for="row in castLinkPreview.ambiguous" :key="row.characterId">
              {{ row.characterName }} — {{ row.candidateEntityIds?.length || 0 }} bible entities share this name
            </li>
          </ul>
        </div>

        <div v-if="castLinkPreview.skipped.length" class="mb-3">
          <p class="text-xs font-semibold text-gray-700 mb-1">Skipped</p>
          <ul class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
            <li v-for="row in castLinkPreview.skipped" :key="row.characterId">
              {{ row.characterName }} — {{ row.reason }}
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            @click="castLinkModalOpen = false"
          >
            Close
          </button>
          <button
            v-if="castLinkPreview.dryRun && (castLinkPreview.linkedCount > 0 || castLinkPreview.createdCount > 0)"
            type="button"
            class="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 text-white disabled:opacity-50"
            :disabled="castLinking"
            @click="applyCastLink"
          >
            {{ castLinking ? 'Working…' : 'Apply links' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
