<template>
  <aside class="lg:w-64 shrink-0 space-y-4">
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
              @click="emit('select-entity', e.id)"
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
</template>

<script setup lang="ts">
import { BIBLE_ENTITY_TYPES, type BibleEntity, type BibleEntityType } from '~/types/bible-entity'

const props = defineProps<{
  entities: BibleEntity[]
  entitiesByType: [BibleEntityType, BibleEntity[]][]
  entityTypeLabels: Record<BibleEntityType, string>
  selectedId: string | null
  showNewEntity: boolean
  mutating: boolean
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

function patchNewEntityForm (key: keyof typeof props.newEntityForm, value: string) {
  emit('update:new-entity-form', { ...props.newEntityForm, [key]: value })
}
</script>
