<template>
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
            class="mt-0.5 w-full rounded-lg border border-amber-200 bg-studio-slate px-2 py-1.5 text-sm"
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
            class="mt-0.5 w-full rounded-lg border border-amber-200 bg-studio-slate px-2 py-1.5 text-sm"
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
            class="mt-0.5 w-full rounded-lg border border-amber-200 bg-studio-slate px-2 py-1.5 text-sm"
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
            class="mt-0.5 w-full rounded-lg border border-amber-200 bg-studio-slate px-2 py-1.5 text-sm"
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
          class="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-300 text-red-700 bg-studio-slate disabled:opacity-50"
          :disabled="mutating || selectedVisiblePendingCount === 0"
          @click="onBulkRejectSelected"
        >
          Reject selected{{ selectedVisiblePendingCount ? ` (${selectedVisiblePendingCount})` : '' }}
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-800 bg-studio-slate disabled:opacity-50"
          :disabled="mutating || !visiblePendingFacts.length"
          @click="onBulkApproveAllVisible"
        >
          Approve all visible ({{ visiblePendingFacts.length }})
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-studio-slate disabled:opacity-50"
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
          class="rounded-lg border border-amber-200/80 bg-studio-slate px-3 py-2 text-sm"
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
            class="mt-0.5 w-full rounded-lg border border-sky-200 bg-studio-slate px-2 py-1.5 text-sm"
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
            class="mt-0.5 w-full rounded-lg border border-sky-200 bg-studio-slate px-2 py-1.5 text-sm"
          >
            <option value="all">All entity types</option>
            <option
              v-for="t in tentativeEntityTypeOptions"
              :key="t"
              :value="t"
            >
              {{ t }}
            </option>
          </select>
        </label>
        <label class="block text-xs">
          <span class="text-sky-900/80 font-medium">Relationship type</span>
          <select
            v-model="tentativeItemFilters.relationshipType"
            class="mt-0.5 w-full rounded-lg border border-sky-200 bg-studio-slate px-2 py-1.5 text-sm"
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
            class="mt-0.5 w-full rounded-lg border border-sky-200 bg-studio-slate px-2 py-1.5 text-sm"
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
          class="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-300 text-red-700 bg-studio-slate disabled:opacity-50"
          :disabled="mutating || selectedVisibleTentativeCount === 0"
          @click="onBulkRetireTentativeSelected"
        >
          Retire selected{{ selectedVisibleTentativeCount ? ` (${selectedVisibleTentativeCount})` : '' }}
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-800 bg-studio-slate disabled:opacity-50"
          :disabled="mutating || !visibleTentativeItems.length"
          @click="onBulkApproveAllVisibleTentative"
        >
          Approve all visible ({{ visibleTentativeItems.length }})
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-studio-slate disabled:opacity-50"
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
          class="rounded-lg border border-sky-200/80 bg-studio-slate px-3 py-2 text-sm"
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
                  :class="factStatusClass(item.status)"
                >
                  {{ factStatusLabel(item.status) }}
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
</template>

<script setup lang="ts">
import { BIBLE_FACT_TYPES, type BibleFact } from '~/types/bible-fact'
import type { BiblePendingFactFilters } from '~/lib/bible-pending-fact-filters'
import {
  tentativeReviewItemKey,
  type BibleTentativeItemFilters,
  type BibleTentativeReviewItem
} from '~/lib/bible-tentative-item-filters'

const pendingFactFilters = defineModel<BiblePendingFactFilters>('pendingFactFilters', { required: true })
const tentativeItemFilters = defineModel<BibleTentativeItemFilters>('tentativeItemFilters', { required: true })

const props = defineProps<{
  mutating: boolean
  factsPendingReview: BibleFact[]
  visiblePendingFacts: BibleFact[]
  selectedPendingFactIds: Set<string>
  selectedVisiblePendingCount: number
  allVisiblePendingSelected: boolean
  tentativeReviewItems: BibleTentativeReviewItem[]
  visibleTentativeItems: BibleTentativeReviewItem[]
  selectedTentativeItemKeys: Set<string>
  selectedVisibleTentativeCount: number
  allVisibleTentativeSelected: boolean
  tentativeRelationshipTypeOptions: string[]
  factStatusLabel: (status: string) => string
  factStatusClass: (status: string) => string
  factSourceLabel: (fact: BibleFact) => string
  entityLabelForFact: (fact: BibleFact) => string
  tentativeItemKindLabel: (kind: BibleTentativeReviewItem['kind']) => string
  togglePendingFactSelection: (factId: string) => void
  toggleSelectAllVisiblePending: () => void
  onBulkApproveSelected: () => void
  onBulkRejectSelected: () => void
  onBulkApproveAllVisible: () => void
  onBulkRejectAllVisible: () => void
  toggleTentativeItemSelection: (key: string) => void
  toggleSelectAllVisibleTentative: () => void
  onBulkApproveTentativeSelected: () => void
  onBulkRetireTentativeSelected: () => void
  onBulkApproveAllVisibleTentative: () => void
  onBulkRetireAllVisibleTentative: () => void
  onApproveFact: (fact: BibleFact) => void
  onRejectFact: (fact: BibleFact) => void
  onApproveTentativeItem: (item: BibleTentativeReviewItem) => void
  onRetireTentativeItem: (item: BibleTentativeReviewItem) => void
  openTentativeItemInPanel: (item: BibleTentativeReviewItem) => void
  openContinuityFinding: (fact: BibleFact) => void
  startEditFact: (fact: BibleFact) => void
}>()

const tentativeEntityTypeOptions = computed(() => {
  const types = new Set<string>()
  for (const item of props.tentativeReviewItems) {
    if (item.entityType?.trim()) types.add(item.entityType.trim())
  }
  return [...types].sort((a, b) => a.localeCompare(b))
})
</script>
