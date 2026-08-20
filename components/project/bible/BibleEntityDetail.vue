<template>
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
      <section class="rounded-xl border border-gray-200 bg-studio-slate p-4 sm:p-5 mb-6 shadow-sm">
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
          <p class="text-xs font-semibold text-sky-900 uppercase tracking-wide mb-1">
            Character lookbook
          </p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="font-medium text-sky-900">{{ linkedCast.characterName }}</span>
            <span
              class="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded"
              :class="castLinkConfidenceClass(linkedCast.confidence)"
            >
              {{ linkedCast.confidenceLabel }}
            </span>
          </div>
          <p class="text-[11px] text-sky-800/80 mt-1">
            Plates, dossier, and voice are in the lookbook above.
          </p>
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
              class="rounded-md border border-violet-200/80 bg-studio-slate px-2.5 py-2 text-xs"
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
                  class="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-studio-slate"
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
        <section
          v-if="selectedEntity.type === 'location'"
          class="mb-4 rounded-lg border border-primary/25 bg-primary/5 px-3 py-3"
        >
          <h3 class="text-xs font-semibold text-primary uppercase tracking-wide mb-1">
            Set lock
          </h3>
          <p class="text-[12px] text-gray-600 leading-relaxed mb-3">
            Lock the <span class="font-medium text-gray-800">place</span> — architecture, materials, layout.
            Camera, lens, and blocking should still change so it photographs like a real location, not a copied still.
          </p>
          <div class="flex flex-wrap gap-2 mb-3">
            <img
              v-for="plate in setPlates"
              :key="plate.id"
              :src="assetPlaybackUrl(plate)"
              :alt="plate.title || 'Set plate'"
              class="h-20 w-28 rounded-md object-cover border border-gray-300 bg-gray-100"
            >
            <label
              class="h-20 w-28 rounded-md border border-dashed border-primary/50 bg-studio-slate flex flex-col items-center justify-center text-[11px] text-primary font-medium cursor-pointer hover:bg-primary/10"
              :class="setPlateUploading ? 'opacity-50 pointer-events-none' : ''"
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="sr-only"
                :disabled="setPlateUploading || mutating"
                @change="onSetPlateFile"
              >
              {{ setPlateUploading ? 'Uploading…' : 'Add plate' }}
            </label>
          </div>
          <p class="text-[11px] text-gray-500">
            Save the architecture notes below, then generate storyboard frames. The plate is a map of the room — not a camera to copy.
          </p>
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
            <span class="text-gray-600 text-xs">{{ selectedEntity.type === 'location' ? 'Look (one-line)' : 'Summary' }}</span>
            <textarea
              v-model="entityForm.summary"
              rows="2"
              :placeholder="selectedEntity.type === 'location' ? 'e.g. 1950s diner, always the same room' : ''"
              class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="text-gray-600 text-xs">{{ selectedEntity.type === 'location' ? 'Locked architecture (materials, layout, landmarks)' : 'Description' }}</span>
            <textarea
              v-model="entityForm.description"
              rows="4"
              :placeholder="selectedEntity.type === 'location' ? 'Checkerboard tile, chrome stool line, cracked red vinyl booths, neon OPEN in the window. Same walls and furniture every shot.' : ''"
              class="mt-0.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-y"
            />
          </label>
        </div>
      </section>

      <!-- Facts -->
      <section class="rounded-xl border border-gray-200 bg-studio-slate p-4 sm:p-5 mb-6 shadow-sm">
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
          <p>Add attributable claims — wardrobe, rules, chronology notes, and constraints.</p>
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
      <section class="rounded-xl border border-gray-200 bg-studio-slate p-4 sm:p-5 shadow-sm">
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
</template>

<script setup lang="ts">
import { BIBLE_ENTITY_TYPES, BIBLE_ENTITY_STATUSES, type BibleEntity, type BibleEntityType } from '~/types/bible-entity'
import { BIBLE_FACT_STATUSES, type BibleFact } from '~/types/bible-fact'
import {
  isBibleFactPendingReview,
  isTentativeBibleStatus
} from '~/lib/bible-trust'
import {
  assetBibleLinkSourceLabel,
  BIBLE_ASSET_ENTITY_METADATA_KEY,
  readAssetBridgeFields,
  type EntityRelatedAsset
} from '~/lib/bible-cast-asset-bridge'
import { formatAssetProvenanceLine } from '~/lib/generation-observability'
import { projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import { isSetPlateAsset } from '~/lib/set-lock'
import { uploadSetPlate } from '~/lib/upload-set-plate'
import {
  BIBLE_ENDPOINT_TYPES,
  BIBLE_RELATIONSHIP_STATUSES,
  type BibleRelationship
} from '~/types/bible-relationship'
import type { ProjectAsset } from '~/types/project-asset'

const entityForm = defineModel<{
  type: BibleEntityType
  name: string
  summary: string
  description: string
  status: string
}>('entityForm', { required: true })

const newFactForm = defineModel<{
  statement: string
  factType: string
  status: string
}>('newFactForm', { required: true })

const factEditForm = defineModel<{
  statement: string
  factType: string
  status: string
}>('factEditForm', { required: true })

const newRelForm = defineModel<{
  direction: 'outgoing' | 'incoming'
  otherType: string
  otherId: string
  relationshipType: string
  role: string
  status: string
}>('newRelForm', { required: true })

const relEditForm = defineModel<{
  relationshipType: string
  role: string
  status: string
}>('relEditForm', { required: true })

const assetLinkPickId = defineModel<string>('assetLinkPickId', { required: true })
const editingFactId = defineModel<string | null>('editingFactId', { required: true })
const editingRelId = defineModel<string | null>('editingRelId', { required: true })

const props = defineProps<{
  projectId: string
  entities: BibleEntity[]
  selectedEntity: BibleEntity | null
  selectedId: string | null
  mutating: boolean
  entityTypeLabels: Record<BibleEntityType, string>
  linkedCast: {
    characterId: string
    characterName: string
    confidence: string
    confidenceLabel: string
  } | null
  entityRelatedAssets: EntityRelatedAsset[]
  linkableAssetsForEntity: ProjectAsset[]
  facts: BibleFact[]
  entityRelationships: BibleRelationship[]
  statusLabel: (status: string) => string
  statusClass: (status: string) => string
  castLinkConfidenceClass: (confidence?: string) => string
  factStatusLabel: (status: string) => string
  factStatusClass: (status: string) => string
  onApproveEntity: () => void
  onRetireEntity: () => void
  onSaveEntity: () => void
  onDeleteEntity: () => void
  onLinkAssetToBibleEntity: () => void
  onCreateFact: () => void
  onSaveFact: (factId: string) => void
  onSaveAndApproveFact: (factId: string) => void
  onDeleteFact: (fact: BibleFact) => void
  onApproveFact: (fact: BibleFact) => void
  onRejectFact: (fact: BibleFact) => void
  startEditFact: (fact: BibleFact) => void
  onCreateRelationship: () => void
  onSaveRel: (relId: string) => void
  onApproveRel: (rel: BibleRelationship) => void
  onRetireRel: (rel: BibleRelationship) => void
  onDeleteRel: (rel: BibleRelationship) => void
  startEditRel: (rel: BibleRelationship) => void
  onRefreshAssets?: () => void | Promise<void>
}>()

const { getAuthToken } = useAuth()
const toast = useToast()
const setPlateUploading = ref(false)

const setPlates = computed(() =>
  props.entityRelatedAssets
    .map((row) => row.asset)
    .filter((a) => isSetPlateAsset(a) && a.fileUrl)
)

async function onSetPlateFile (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const entity = props.selectedEntity
  if (!file || !entity) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Sign in to upload a set plate.', 'warning')
    return
  }
  setPlateUploading.value = true
  try {
    await uploadSetPlate({
      projectId: props.projectId,
      entityId: entity.id,
      locationName: entityForm.value.name || entity.name,
      file,
      token
    })
    toast.showToast('Set plate saved. Storyboard frames will match this place, not this camera.', 'success')
    await props.onRefreshAssets?.()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Could not upload set plate'
    toast.showToast(msg, 'error')
  } finally {
    setPlateUploading.value = false
  }
}

function factNeedsReview (fact: BibleFact): boolean {
  return isBibleFactPendingReview(fact.status)
}

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

function relEndpointLabel (type: string, id: string): string {
  if (type === 'bible_entity') {
    const ent = props.entities.find((e) => e.id === id)
    return ent ? `${ent.name} (entity)` : `entity:${id.slice(0, 8)}…`
  }
  if (type === 'project') return 'This project'
  return `${type}:${id.slice(0, 12)}${id.length > 12 ? '…' : ''}`
}

function relSummary (r: BibleRelationship): string {
  const id = props.selectedId
  if (!id) return r.relationshipType
  const isFrom = r.fromType === 'bible_entity' && r.fromId === id
  const otherType = isFrom ? r.toType : r.fromType
  const otherId = isFrom ? r.toId : r.fromId
  const arrow = isFrom ? '→' : '←'
  return `${r.relationshipType} ${arrow} ${relEndpointLabel(otherType, otherId)}`
}
</script>
