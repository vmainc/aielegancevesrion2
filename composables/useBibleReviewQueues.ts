import type { Ref } from 'vue'
import { BIBLE_FACT_TYPES } from '~/types/bible-fact'
import type { BibleEntity } from '~/types/bible-entity'
import type { BibleFact } from '~/types/bible-fact'
import type { BibleRelationship } from '~/types/bible-relationship'
import { biblePendingFactSourceCategory, DEFAULT_BIBLE_PENDING_FACT_FILTERS, filterPendingReviewFacts, type BiblePendingFactFilters } from '~/lib/bible-pending-fact-filters'
import {
  buildTentativeReviewItems,
  DEFAULT_BIBLE_TENTATIVE_ITEM_FILTERS,
  filterTentativeReviewItems,
  parseTentativeReviewItemKey,
  tentativeReviewItemKey,
  type BibleTentativeItemFilters,
  type BibleTentativeReviewItem
} from '~/lib/bible-tentative-item-filters'
import { bibleStatusBadgeClass, bibleStatusDisplayLabel, isBibleFactPendingReview } from '~/lib/bible-trust'
import type { useProductionBible } from '~/composables/useProductionBible'

type BibleApi = ReturnType<typeof useProductionBible>

export function useBibleReviewQueues (options: {
  projectFacts: Ref<BibleFact[]>
  entities: Ref<BibleEntity[]>
  relationships: Ref<BibleRelationship[]>
  mutating: Ref<boolean>
  editingFactId: Ref<string | null>
  bible: BibleApi
  syncFactInLists: (fact: BibleFact) => void
  syncEntityInList: (entity: BibleEntity) => void
  syncRelationshipInList: (relationship: BibleRelationship) => void
  selectEntity: (id: string) => void
}) {
  const toast = useToast()

  const factsPendingReview = computed(() =>
    options.projectFacts.value.filter((f) => isBibleFactPendingReview(f.status))
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

  const tentativeReviewItems = computed(() =>
    buildTentativeReviewItems(options.entities.value, options.relationships.value)
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

  function entityLabelForFact (fact: BibleFact): string {
    if (!fact.entityId) return 'Project'
    return options.entities.value.find((e) => e.id === fact.entityId)?.name ?? 'Entity'
  }

  function factSourceLabel (fact: BibleFact): string {
    const category = biblePendingFactSourceCategory(fact)
    if (category === 'continuity') return 'Continuity'
    if (category === 'seed') return 'Seed'
    return 'Other'
  }

  function factStatusLabel (status: string): string {
    return bibleStatusDisplayLabel(status)
  }

  function factStatusClass (status: string): string {
    return bibleStatusBadgeClass(status)
  }

  function tentativeItemKindLabel (kind: BibleTentativeReviewItem['kind']): string {
    return kind === 'entity' ? 'Entity' : 'Relationship'
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

  function confirmBulkFactAction (action: 'approve' | 'reject', count: number): boolean {
    if (count <= 0) return false
    const verb = action === 'approve' ? 'Approve' : 'Reject'
    const effect =
      action === 'approve'
        ? 'They will become active and may appear in generation prompts.'
        : 'They will be retired and excluded from prompt context.'
    return globalThis.confirm(`${verb} ${count} fact${count === 1 ? '' : 's'}? ${effect}`)
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

  async function runBulkApproveFacts (factIds: string[]) {
    const ids = [...new Set(factIds)].filter(Boolean)
    if (!ids.length) return
    if (!confirmBulkFactAction('approve', ids.length)) return
    options.mutating.value = true
    try {
      const { updated, errors } = await options.bible.approveFacts(ids)
      for (const f of updated) options.syncFactInLists(f)
      selectedPendingFactIds.value = new Set()
      if (errors.length) {
        toast.error(`Approved ${updated.length}; ${errors.length} failed.`)
      } else {
        toast.success(`Approved ${updated.length} fact${updated.length === 1 ? '' : 's'}.`)
      }
    } catch (e: unknown) {
      toast.error(options.bible.formatApiFetchError(e) || 'Could not approve facts')
    } finally {
      options.mutating.value = false
    }
  }

  async function runBulkRejectFacts (factIds: string[]) {
    const ids = [...new Set(factIds)].filter(Boolean)
    if (!ids.length) return
    if (!confirmBulkFactAction('reject', ids.length)) return
    options.mutating.value = true
    try {
      const { updated, errors } = await options.bible.rejectFacts(ids)
      for (const f of updated) {
        options.syncFactInLists(f)
        if (options.editingFactId.value === f.id) options.editingFactId.value = null
      }
      selectedPendingFactIds.value = new Set()
      if (errors.length) {
        toast.error(`Retired ${updated.length}; ${errors.length} failed.`)
      } else {
        toast.success(`Retired ${updated.length} fact${updated.length === 1 ? '' : 's'}.`)
      }
    } catch (e: unknown) {
      toast.error(options.bible.formatApiFetchError(e) || 'Could not reject facts')
    } finally {
      options.mutating.value = false
    }
  }

  async function runBulkApproveTentativeItems (keys: string[]) {
    const unique = [...new Set(keys)].filter(Boolean)
    if (!unique.length) return
    if (!confirmBulkTentativeAction('approve', unique.length)) return
    const { entityIds, relationshipIds } = splitTentativeItemKeys(unique)
    options.mutating.value = true
    try {
      let updatedCount = 0
      let errorCount = 0
      if (entityIds.length) {
        const { updated, errors } = await options.bible.approveEntities(entityIds)
        for (const e of updated) options.syncEntityInList(e)
        updatedCount += updated.length
        errorCount += errors.length
      }
      if (relationshipIds.length) {
        const { updated, errors } = await options.bible.approveRelationships(relationshipIds)
        for (const r of updated) options.syncRelationshipInList(r)
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
      toast.error(options.bible.formatApiFetchError(e) || 'Could not approve tentative items')
    } finally {
      options.mutating.value = false
    }
  }

  async function runBulkRetireTentativeItems (keys: string[]) {
    const unique = [...new Set(keys)].filter(Boolean)
    if (!unique.length) return
    if (!confirmBulkTentativeAction('retire', unique.length)) return
    const { entityIds, relationshipIds } = splitTentativeItemKeys(unique)
    options.mutating.value = true
    try {
      let updatedCount = 0
      let errorCount = 0
      if (entityIds.length) {
        const { updated, errors } = await options.bible.retireEntities(entityIds)
        for (const e of updated) options.syncEntityInList(e)
        updatedCount += updated.length
        errorCount += errors.length
      }
      if (relationshipIds.length) {
        const { updated, errors } = await options.bible.retireRelationships(relationshipIds)
        for (const r of updated) options.syncRelationshipInList(r)
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
      toast.error(options.bible.formatApiFetchError(e) || 'Could not retire tentative items')
    } finally {
      options.mutating.value = false
    }
  }

  async function onApproveFact (fact: BibleFact) {
    options.mutating.value = true
    try {
      const updated = await options.bible.approveFact(fact.id)
      options.syncFactInLists(updated)
      toast.success('Fact approved')
    } catch (e: unknown) {
      toast.error(options.bible.formatApiFetchError(e) || 'Could not approve fact')
    } finally {
      options.mutating.value = false
    }
  }

  async function onRejectFact (fact: BibleFact) {
    if (!globalThis.confirm('Reject this fact? It will be retired and excluded from prompt context.')) return
    options.mutating.value = true
    try {
      const updated = await options.bible.rejectFact(fact.id)
      options.syncFactInLists(updated)
      if (options.editingFactId.value === fact.id) options.editingFactId.value = null
      toast.success('Fact retired')
    } catch (e: unknown) {
      toast.error(options.bible.formatApiFetchError(e) || 'Could not reject fact')
    } finally {
      options.mutating.value = false
    }
  }

  async function onApproveTentativeItem (item: BibleTentativeReviewItem) {
    options.mutating.value = true
    try {
      if (item.kind === 'entity') {
        const updated = await options.bible.approveEntity(item.id)
        options.syncEntityInList(updated)
      } else {
        const updated = await options.bible.approveRelationship(item.id)
        options.syncRelationshipInList(updated)
      }
      selectedTentativeItemKeys.value = new Set(
        [...selectedTentativeItemKeys.value].filter((k) => k !== tentativeReviewItemKey(item))
      )
      toast.success(`${tentativeItemKindLabel(item.kind)} approved`)
    } catch (e: unknown) {
      toast.error(options.bible.formatApiFetchError(e) || 'Could not approve item')
    } finally {
      options.mutating.value = false
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
    options.mutating.value = true
    try {
      if (item.kind === 'entity') {
        const updated = await options.bible.retireEntity(item.id)
        options.syncEntityInList(updated)
      } else {
        const updated = await options.bible.retireRelationship(item.id)
        options.syncRelationshipInList(updated)
      }
      selectedTentativeItemKeys.value = new Set(
        [...selectedTentativeItemKeys.value].filter((k) => k !== tentativeReviewItemKey(item))
      )
      toast.success(`${tentativeItemKindLabel(item.kind)} retired`)
    } catch (e: unknown) {
      toast.error(options.bible.formatApiFetchError(e) || 'Could not retire item')
    } finally {
      options.mutating.value = false
    }
  }

  return {
    BIBLE_FACT_TYPES,
    factsPendingReview,
    pendingFactFilters,
    selectedPendingFactIds,
    visiblePendingFacts,
    selectedVisiblePendingCount,
    allVisiblePendingSelected,
    tentativeReviewItems,
    tentativeItemFilters,
    selectedTentativeItemKeys,
    visibleTentativeItems,
    tentativeRelationshipTypeOptions,
    selectedVisibleTentativeCount,
    allVisibleTentativeSelected,
    entityLabelForFact,
    factSourceLabel,
    factStatusLabel,
    factStatusClass,
    tentativeItemKindLabel,
    togglePendingFactSelection,
    toggleSelectAllVisiblePending,
    toggleTentativeItemSelection,
    toggleSelectAllVisibleTentative,
    onBulkApproveSelected: () => {
      const ids = visiblePendingFacts.value
        .filter((f) => selectedPendingFactIds.value.has(f.id))
        .map((f) => f.id)
      void runBulkApproveFacts(ids)
    },
    onBulkRejectSelected: () => {
      const ids = visiblePendingFacts.value
        .filter((f) => selectedPendingFactIds.value.has(f.id))
        .map((f) => f.id)
      void runBulkRejectFacts(ids)
    },
    onBulkApproveAllVisible: () => void runBulkApproveFacts(visiblePendingFacts.value.map((f) => f.id)),
    onBulkRejectAllVisible: () => void runBulkRejectFacts(visiblePendingFacts.value.map((f) => f.id)),
    onBulkApproveTentativeSelected: () => {
      const keys = visibleTentativeItems.value
        .filter((item) => selectedTentativeItemKeys.value.has(tentativeReviewItemKey(item)))
        .map((item) => tentativeReviewItemKey(item))
      void runBulkApproveTentativeItems(keys)
    },
    onBulkRetireTentativeSelected: () => {
      const keys = visibleTentativeItems.value
        .filter((item) => selectedTentativeItemKeys.value.has(tentativeReviewItemKey(item)))
        .map((item) => tentativeReviewItemKey(item))
      void runBulkRetireTentativeItems(keys)
    },
    onBulkApproveAllVisibleTentative: () =>
      void runBulkApproveTentativeItems(
        visibleTentativeItems.value.map((item) => tentativeReviewItemKey(item))
      ),
    onBulkRetireAllVisibleTentative: () =>
      void runBulkRetireTentativeItems(
        visibleTentativeItems.value.map((item) => tentativeReviewItemKey(item))
      ),
    onApproveFact,
    onRejectFact,
    onApproveTentativeItem,
    onRetireTentativeItem,
    openTentativeItemInPanel: (item: BibleTentativeReviewItem) => {
      if (item.kind === 'entity') options.selectEntity(item.id)
    },
    openContinuityFinding: (fact: BibleFact) => {
      if (fact.entityId) options.selectEntity(fact.entityId)
    }
  }
}
