<template>
  <aside class="lg:w-80 shrink-0 space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-gray-900">Entities</h2>
      <button
        type="button"
        class="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
        :disabled="mutating"
        @click="emit('toggle-new-entity')"
      >
        {{ showNewEntity ? 'Cancel' : '+ Add' }}
      </button>
    </div>

    <form
      v-if="showNewEntity"
      class="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm"
      @submit.prevent="emit('create-entity')"
    >
      <label class="block">
        <span class="text-xs text-gray-600">Type</span>
        <select
          :value="newEntityForm.type"
          class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          @change="patchNewEntityForm('type', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="t in BIBLE_ENTITY_TYPES" :key="t" :value="t">
            {{ entityTypeLabels[t] }}
          </option>
        </select>
      </label>
      <label class="block">
        <span class="text-xs text-gray-600">Name</span>
        <input
          :value="newEntityForm.name"
          type="text"
          required
          class="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          @input="patchNewEntityForm('name', ($event.target as HTMLInputElement).value)"
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

    <div v-else class="rounded-lg border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
      <div
        v-for="[type, list] in entitiesByType"
        :key="type"
      >
        <button
          type="button"
          class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
          :aria-expanded="isOpen(type)"
          @click="toggleType(type)"
        >
          <span class="min-w-0 flex items-center gap-2">
            <span class="text-xs font-semibold text-gray-900 truncate">
              {{ entityTypeLabels[type] }}
            </span>
            <span class="shrink-0 text-[10px] font-medium tabular-nums text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {{ list.length }}
            </span>
          </span>
          <span
            class="shrink-0 text-gray-400 text-xs leading-none transition-transform duration-200"
            :class="isOpen(type) ? 'rotate-180' : ''"
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        <ul
          v-show="isOpen(type)"
          class="pb-1.5 px-1 space-y-0.5"
        >
          <li v-for="e in list" :key="e.id">
            <button
              type="button"
              class="w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors"
              :class="selectedId === e.id
                ? 'bg-primary/15 text-primary font-medium border border-primary/30'
                : 'text-gray-800 hover:bg-gray-100'"
              @click="emit('select-entity', e.id)"
            >
              {{ e.name }}
              <span
                v-if="e.status !== 'active'"
                class="ml-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                :class="statusClass(e.status)"
              >{{ statusLabel(e.status) }}</span>
            </button>
            <div
              v-if="selectedId === e.id && type === 'character' && castIdForEntity(e.id)"
              class="mx-1 mb-2 mt-1 rounded-lg border border-gray-200 bg-gray-50 p-2"
            >
              <CharacterLookbook
                :project-id="projectId"
                :character-id="castIdForEntity(e.id)"
                :name-hint="e.name"
                plates-only
                embedded
              />
            </div>
            <p
              v-else-if="selectedId === e.id && type === 'character' && !castIdForEntity(e.id)"
              class="mx-1 mb-2 mt-1 px-2 py-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg"
            >
              No linked cast record — run Link Cast to Bible to manage plates here.
            </p>
          </li>
        </ul>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { BIBLE_ENTITY_TYPES, type BibleEntity, type BibleEntityType } from '~/types/bible-entity'
import CharacterLookbook from '~/components/project/CharacterLookbook.vue'

const props = defineProps<{
  projectId: string
  entities: BibleEntity[]
  entitiesByType: [BibleEntityType, BibleEntity[]][]
  entityTypeLabels: Record<BibleEntityType, string>
  selectedId: string | null
  showNewEntity: boolean
  mutating: boolean
  /** Bible entity id → creative character id (for plate lookbook). */
  castIdByEntityId?: Record<string, string>
  newEntityForm: {
    type: BibleEntityType
    name: string
    summary: string
    description: string
    status: string
  }
  statusLabel: (status: string) => string
  statusClass: (status: string) => string
}>()

const emit = defineEmits<{
  'toggle-new-entity': []
  'create-entity': []
  'select-entity': [id: string]
  'update:new-entity-form': [form: typeof props.newEntityForm]
}>()

/** Types the user has manually collapsed (so we don't fight auto-open). */
const manuallyClosed = ref(new Set<BibleEntityType>())
/** Types the user has manually expanded beyond the default. */
const manuallyOpened = ref(new Set<BibleEntityType>())

const selectedType = computed(() => {
  if (!props.selectedId) return null
  return props.entities.find((e) => e.id === props.selectedId)?.type ?? null
})

function castIdForEntity (entityId: string): string {
  return (props.castIdByEntityId?.[entityId] || '').trim()
}

function isOpen (type: BibleEntityType): boolean {
  if (manuallyClosed.value.has(type)) return false
  if (manuallyOpened.value.has(type)) return true
  if (selectedType.value === type) return true
  const first = props.entitiesByType[0]?.[0]
  return first === type
}

function toggleType (type: BibleEntityType) {
  if (isOpen(type)) {
    manuallyOpened.value.delete(type)
    manuallyClosed.value.add(type)
  } else {
    manuallyClosed.value.delete(type)
    manuallyOpened.value.add(type)
  }
  manuallyOpened.value = new Set(manuallyOpened.value)
  manuallyClosed.value = new Set(manuallyClosed.value)
}

watch(selectedType, (type) => {
  if (!type) return
  manuallyClosed.value.delete(type)
  manuallyClosed.value = new Set(manuallyClosed.value)
})

function patchNewEntityForm (key: keyof typeof props.newEntityForm, value: string) {
  emit('update:new-entity-form', { ...props.newEntityForm, [key]: value })
}
</script>
