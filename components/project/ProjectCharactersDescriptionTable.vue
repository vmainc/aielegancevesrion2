<template>
  <div>
    <div v-if="loading" class="py-6">
      <FilmReelLoader
        size="sm"
        label="Loading characters"
        sub-label="Fetching cast from your screenplay analysis…"
      />
    </div>
    <p
      v-else-if="error"
      class="text-sm text-red-700"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-else>
      <div
        v-if="editable"
        class="flex flex-wrap items-center justify-between gap-2 mb-4"
      >
        <p class="text-xs text-gray-500">
          Add rows by hand or edit imported cast. Changes save to your project.
        </p>
        <button
          type="button"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          :disabled="busy || !!editingId || showAddRow"
          @click="openAddRow"
        >
          Add character
        </button>
      </div>

      <div
        v-if="showAddRow && editable"
        class="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4"
      >
        <h4 class="text-sm font-semibold text-gray-900 mb-3">
          New character
        </h4>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              v-model="addDraft.name"
              type="text"
              maxlength="200"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Character name"
              :disabled="busy"
            >
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              v-model="addDraft.roleDescription"
              rows="3"
              maxlength="10000"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Role, traits, arc…"
              :disabled="busy"
            />
          </div>
          <div class="max-w-[8rem]">
            <label class="block text-xs font-medium text-gray-600 mb-1">Screen share % (optional)</label>
            <input
              v-model="addDraft.screenShareStr"
              type="text"
              inputmode="decimal"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. 12.5"
              :disabled="busy"
            >
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
              :disabled="busy"
              @click="submitAdd"
            >
              Save
            </button>
            <button
              type="button"
              class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              :disabled="busy"
              @click="cancelAdd"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="characters.length || (editable && !characters.length)"
        class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      >
        <div class="px-4 sm:px-5 py-4 border-b border-gray-200 bg-gray-50/90">
          <h3 class="text-sm font-semibold text-gray-900">
            {{ heading }} ({{ characters.length }})
          </h3>
          <p v-if="subheading" class="text-xs text-gray-500 mt-0.5">
            {{ subheading }}
          </p>
        </div>
        <div
          v-if="!characters.length && editable"
          class="px-4 sm:px-5 py-6 text-sm text-gray-500 border-b border-gray-100"
        >
          No cast rows yet. Use <span class="font-medium text-gray-700">Add character</span> above or run script import on Overview.
        </div>
        <div v-if="characters.length" class="overflow-x-auto">
          <table
            class="w-full text-sm text-left border-collapse"
            :aria-label="ariaLabel"
          >
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
                <th
                  v-if="showChartSwatches"
                  scope="col"
                  class="w-12 px-3 sm:px-4 py-3 align-bottom text-center"
                >
                  <span class="sr-only">Chart color</span>
                </th>
                <th scope="col" class="px-4 sm:px-5 py-3 align-bottom w-[min(11rem,22%)]">
                  Name
                </th>
                <th scope="col" class="px-4 sm:px-5 py-3 align-bottom">
                  Description
                </th>
                <th
                  v-if="editable"
                  scope="col"
                  class="px-4 sm:px-5 py-3 align-bottom w-[min(7rem,18%)] text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="c in characters"
                :key="c.id"
                class="hover:bg-gray-50/70 transition-colors"
              >
                <template v-if="editable && editingId === c.id">
                  <td
                    v-if="showChartSwatches"
                    class="w-12 px-3 sm:px-4 py-3 align-middle"
                  >
                    <span
                      class="inline-block h-4 w-4 rounded-sm border border-gray-200 shadow-sm shrink-0 mx-auto"
                      :style="{ backgroundColor: swatchColorFor(c) }"
                      aria-hidden="true"
                    />
                  </td>
                  <td class="px-4 sm:px-5 py-3 align-top" colspan="2">
                    <div class="space-y-2 max-w-3xl">
                      <input
                        v-model="editDraft.name"
                        type="text"
                        maxlength="200"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold"
                        :disabled="busy"
                      >
                      <textarea
                        v-model="editDraft.roleDescription"
                        rows="4"
                        maxlength="10000"
                        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        :disabled="busy"
                      />
                      <div class="max-w-[10rem]">
                        <label class="block text-xs text-gray-500 mb-1">Screen share % (optional)</label>
                        <input
                          v-model="editDraft.screenShareStr"
                          type="text"
                          inputmode="decimal"
                          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          :disabled="busy"
                        >
                      </div>
                      <div class="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                          :disabled="busy"
                          @click="submitEdit(c.id)"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          class="px-3 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                          :disabled="busy"
                          @click="cancelEdit"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 sm:px-5 py-3 align-top text-right text-gray-400 text-xs">
                    —
                  </td>
                </template>
                <template v-else>
                  <td
                    v-if="showChartSwatches"
                    class="w-12 px-3 sm:px-4 py-3 align-middle text-center"
                  >
                    <span
                      class="inline-block h-4 w-4 rounded-sm border border-gray-200 shadow-sm shrink-0"
                      :style="{ backgroundColor: swatchColorFor(c) }"
                      :title="`Color in dialogue share chart (${c.name})`"
                    />
                  </td>
                  <td class="px-4 sm:px-5 py-3 align-top font-semibold text-gray-900">
                    {{ c.name }}
                  </td>
                  <td class="px-4 sm:px-5 py-3 align-top text-gray-700 leading-relaxed">
                    <span class="whitespace-pre-wrap break-words">{{ c.roleDescription || '—' }}</span>
                    <span
                      v-if="c.screenSharePercent != null"
                      class="block text-xs text-gray-400 mt-1"
                    >
                      Screen share: {{ c.screenSharePercent }}%
                    </span>
                  </td>
                  <td
                    v-if="editable"
                    class="px-4 sm:px-5 py-3 align-top text-right whitespace-nowrap"
                  >
                    <button
                      type="button"
                      class="text-xs font-medium text-primary hover:underline disabled:opacity-40 mr-3"
                      :disabled="busy || !!editingId || showAddRow"
                      @click="startEdit(c)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="text-xs font-medium text-red-700 hover:underline disabled:opacity-40"
                      :disabled="busy || !!editingId || showAddRow"
                      @click="requestDelete(c)"
                    >
                      Delete
                    </button>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p
        v-else-if="!editable"
        class="text-sm text-gray-500"
      >
        {{ emptyHint }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CreativeCharacter } from '~/types/creative-project'

const props = withDefaults(
  defineProps<{
    characters: CreativeCharacter[]
    loading?: boolean
    error?: string | null
    heading?: string
    subheading?: string
    emptyHint?: string
    ariaLabel?: string
    editable?: boolean
    busy?: boolean
    /** When true, first column shows the same color as the pie segment for this character. */
    showChartSwatches?: boolean
    /** Lowercase name → hex; from `buildCharacterPieModel` / `pieModelToSwatchRecord`. */
    chartColorByName?: Record<string, string>
  }>(),
  {
    loading: false,
    error: null,
    heading: 'Characters',
    subheading: '',
    emptyHint: 'No characters yet.',
    ariaLabel: 'Characters in this project',
    editable: false,
    busy: false,
    showChartSwatches: false,
    chartColorByName: undefined
  }
)

function swatchColorFor (c: CreativeCharacter): string {
  if (!props.showChartSwatches || !props.chartColorByName) return '#d1d5db'
  return props.chartColorByName[c.name.trim().toLowerCase()] ?? '#d1d5db'
}

const emit = defineEmits<{
  create: [payload: { name: string; roleDescription: string; screenSharePercent: number | null }]
  update: [id: string, payload: { name: string; roleDescription: string; screenSharePercent: number | null }]
  delete: [id: string]
}>()

const editingId = ref<string | null>(null)
const showAddRow = ref(false)

const addDraft = reactive({
  name: '',
  roleDescription: '',
  screenShareStr: ''
})

const editDraft = reactive({
  name: '',
  roleDescription: '',
  screenShareStr: ''
})

function parseShare (s: string): number | null {
  const t = s.trim()
  if (!t) return null
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, Math.round(n * 100) / 100))
}

function openAddRow () {
  addDraft.name = ''
  addDraft.roleDescription = ''
  addDraft.screenShareStr = ''
  showAddRow.value = true
  editingId.value = null
}

function cancelAdd () {
  showAddRow.value = false
}

function submitAdd () {
  const name = addDraft.name.trim()
  if (!name) return
  emit('create', {
    name,
    roleDescription: addDraft.roleDescription.trim(),
    screenSharePercent: parseShare(addDraft.screenShareStr)
  })
}

function startEdit (c: CreativeCharacter) {
  editingId.value = c.id
  showAddRow.value = false
  editDraft.name = c.name
  editDraft.roleDescription = c.roleDescription || ''
  editDraft.screenShareStr =
    c.screenSharePercent != null && Number.isFinite(c.screenSharePercent) ? String(c.screenSharePercent) : ''
}

function cancelEdit () {
  editingId.value = null
}

function submitEdit (id: string) {
  const name = editDraft.name.trim()
  if (!name) return
  emit('update', id, {
    name,
    roleDescription: editDraft.roleDescription.trim(),
    screenSharePercent: parseShare(editDraft.screenShareStr)
  })
}

function requestDelete (c: CreativeCharacter) {
  if (!globalThis.confirm(`Remove “${c.name}” from this project?`)) return
  emit('delete', c.id)
}

watch(
  () => props.characters,
  () => {
    editingId.value = null
    showAddRow.value = false
  }
)
</script>
