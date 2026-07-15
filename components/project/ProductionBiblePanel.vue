<script setup lang="ts">
import { BIBLE_ENTITY_TYPES, type BibleEntity, type BibleEntityType } from '~/types/bible-entity'
import { type BibleFact } from '~/types/bible-fact'
import {
  bibleStatusBadgeClass,
  bibleStatusDisplayLabel,
  isBibleFactPendingReview
} from '~/lib/bible-trust'
import {
  castBibleConfidenceLabel,
  resolveBibleEntityToCastCharacter,
  buildCastBibleBridgeMaps
} from '~/lib/bible-cast-bridge'
import {
  assetsLinkableToBibleEntity,
  BIBLE_ASSET_ENTITY_METADATA_KEY,
  resolveBibleEntityRelatedAssets
} from '~/lib/bible-cast-asset-bridge'
import {
  type BibleRelationship
} from '~/types/bible-relationship'
import type { BibleCastLinkResult } from '~/types/bible-cast-link-result'
import type { BibleSeedResult } from '~/types/bible-seed-result'
import type { BibleSeedRemediationResult } from '~/types/bible-seed-remediation-result'
import type { LegacyAssetPromptRedactionResult } from '~/types/legacy-asset-prompt-redaction-result'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'
import { isLegacySeededFactCandidate } from '~/lib/legacy-seeded-fact-match'
import BibleReviewQueues from '~/components/project/bible/BibleReviewQueues.vue'
import BibleEntityList from '~/components/project/bible/BibleEntityList.vue'
import BibleEntityDetail from '~/components/project/bible/BibleEntityDetail.vue'
import BibleAdminModals from '~/components/project/bible/BibleAdminModals.vue'

const props = defineProps<{
  projectId: string
}>()

const { isAuthenticated } = useAuth()
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

function syncEntityInList (updated: BibleEntity) {
  entities.value = entities.value.map((x) => (x.id === updated.id ? updated : x))
  const sel = selectedEntity.value
  if (sel?.id === updated.id) syncEntityForm(updated)
}

function syncRelationshipInList (updated: BibleRelationship) {
  relationships.value = relationships.value.map((x) => (x.id === updated.id ? updated : x))
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

const editingFactId = ref<string | null>(null)

function syncFactInLists (updated: BibleFact) {
  facts.value = facts.value.map((f) => (f.id === updated.id ? updated : f))
  projectFacts.value = projectFacts.value.map((f) => (f.id === updated.id ? updated : f))
}

const reviewQueues = useBibleReviewQueues({
  projectFacts,
  entities,
  relationships,
  mutating,
  editingFactId,
  bible,
  syncFactInLists,
  syncEntityInList,
  syncRelationshipInList,
  selectEntity: (id: string) => {
    selectedId.value = id
    showNewEntity.value = false
  }
})

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
        <BibleReviewQueues
          v-model:pending-fact-filters="reviewQueues.pendingFactFilters"
          v-model:tentative-item-filters="reviewQueues.tentativeItemFilters"
          :mutating="mutating"
          :facts-pending-review="reviewQueues.factsPendingReview"
          :visible-pending-facts="reviewQueues.visiblePendingFacts"
          :selected-pending-fact-ids="reviewQueues.selectedPendingFactIds"
          :selected-visible-pending-count="reviewQueues.selectedVisiblePendingCount"
          :all-visible-pending-selected="reviewQueues.allVisiblePendingSelected"
          :tentative-review-items="reviewQueues.tentativeReviewItems"
          :visible-tentative-items="reviewQueues.visibleTentativeItems"
          :selected-tentative-item-keys="reviewQueues.selectedTentativeItemKeys"
          :selected-visible-tentative-count="reviewQueues.selectedVisibleTentativeCount"
          :all-visible-tentative-selected="reviewQueues.allVisibleTentativeSelected"
          :tentative-relationship-type-options="reviewQueues.tentativeRelationshipTypeOptions"
          :fact-status-label="reviewQueues.factStatusLabel"
          :fact-status-class="reviewQueues.factStatusClass"
          :fact-source-label="reviewQueues.factSourceLabel"
          :entity-label-for-fact="reviewQueues.entityLabelForFact"
          :tentative-item-kind-label="reviewQueues.tentativeItemKindLabel"
          :toggle-pending-fact-selection="reviewQueues.togglePendingFactSelection"
          :toggle-select-all-visible-pending="reviewQueues.toggleSelectAllVisiblePending"
          :on-bulk-approve-selected="reviewQueues.onBulkApproveSelected"
          :on-bulk-reject-selected="reviewQueues.onBulkRejectSelected"
          :on-bulk-approve-all-visible="reviewQueues.onBulkApproveAllVisible"
          :on-bulk-reject-all-visible="reviewQueues.onBulkRejectAllVisible"
          :toggle-tentative-item-selection="reviewQueues.toggleTentativeItemSelection"
          :toggle-select-all-visible-tentative="reviewQueues.toggleSelectAllVisibleTentative"
          :on-bulk-approve-tentative-selected="reviewQueues.onBulkApproveTentativeSelected"
          :on-bulk-retire-tentative-selected="reviewQueues.onBulkRetireTentativeSelected"
          :on-bulk-approve-all-visible-tentative="reviewQueues.onBulkApproveAllVisibleTentative"
          :on-bulk-retire-all-visible-tentative="reviewQueues.onBulkRetireAllVisibleTentative"
          :on-approve-fact="reviewQueues.onApproveFact"
          :on-reject-fact="reviewQueues.onRejectFact"
          :on-approve-tentative-item="reviewQueues.onApproveTentativeItem"
          :on-retire-tentative-item="reviewQueues.onRetireTentativeItem"
          :open-tentative-item-in-panel="reviewQueues.openTentativeItemInPanel"
          :open-continuity-finding="reviewQueues.openContinuityFinding"
          :start-edit-fact="startEditFact"
        />

        <div class="flex flex-col lg:flex-row gap-6 min-h-[24rem]">
        <BibleEntityList
          :entities="entities"
          :entities-by-type="entitiesByType"
          :entity-type-labels="entityTypeLabels"
          :selected-id="selectedId"
          :show-new-entity="showNewEntity"
          :mutating="mutating"
          :new-entity-form="newEntityForm"
          :status-label="statusLabel"
          :status-class="statusClass"
          @toggle-new-entity="showNewEntity = !showNewEntity"
          @create-entity="onCreateEntity"
          @select-entity="selectEntity"
          @update:new-entity-form="newEntityForm = $event"
        />

        <BibleEntityDetail
          v-model:entity-form="entityForm"
          v-model:new-fact-form="newFactForm"
          v-model:fact-edit-form="factEditForm"
          v-model:new-rel-form="newRelForm"
          v-model:rel-edit-form="relEditForm"
          v-model:asset-link-pick-id="assetLinkPickId"
          v-model:editing-fact-id="editingFactId"
          v-model:editing-rel-id="editingRelId"
          :project-id="projectId"
          :entities="entities"
          :selected-entity="selectedEntity"
          :selected-id="selectedId"
          :mutating="mutating"
          :entity-type-labels="entityTypeLabels"
          :linked-cast="linkedCast"
          :entity-related-assets="entityRelatedAssets"
          :linkable-assets-for-entity="linkableAssetsForEntity"
          :facts="facts"
          :entity-relationships="entityRelationships"
          :status-label="statusLabel"
          :status-class="statusClass"
          :cast-link-confidence-class="castLinkConfidenceClass"
          :fact-status-label="factStatusLabel"
          :fact-status-class="factStatusClass"
          :on-approve-entity="onApproveEntity"
          :on-retire-entity="onRetireEntity"
          :on-save-entity="onSaveEntity"
          :on-delete-entity="onDeleteEntity"
          :on-link-asset-to-bible-entity="onLinkAssetToBibleEntity"
          :on-create-fact="onCreateFact"
          :on-save-fact="onSaveFact"
          :on-save-and-approve-fact="onSaveAndApproveFact"
          :on-delete-fact="onDeleteFact"
          :on-approve-fact="reviewQueues.onApproveFact"
          :on-reject-fact="reviewQueues.onRejectFact"
          :start-edit-fact="startEditFact"
          :on-create-relationship="onCreateRelationship"
          :on-save-rel="onSaveRel"
          :on-approve-rel="onApproveRel"
          :on-retire-rel="onRetireRel"
          :on-delete-rel="onDeleteRel"
          :start-edit-rel="startEditRel"
        />
      </div>
      </div>
    </template>

    <BibleAdminModals
      v-model:seed-modal-open="seedModalOpen"
      v-model:legacy-remediation-modal-open="legacyRemediationModalOpen"
      v-model:legacy-prompt-redaction-modal-open="legacyPromptRedactionModalOpen"
      v-model:cast-link-modal-open="castLinkModalOpen"
      :seed-preview="seedPreview"
      :seeding="seeding"
      :legacy-remediation-preview="legacyRemediationPreview"
      :legacy-remediating="legacyRemediating"
      :legacy-prompt-redaction-preview="legacyPromptRedactionPreview"
      :legacy-prompt-redacting="legacyPromptRedacting"
      :cast-link-preview="castLinkPreview"
      :cast-linking="castLinking"
      :fact-status-label="factStatusLabel"
      @apply-seed="applySeed"
      @apply-legacy-remediation="applyLegacyRemediation"
      @apply-legacy-prompt-redaction="applyLegacyPromptRedaction"
      @apply-cast-link="applyCastLink"
    />
  </div>
</template>
