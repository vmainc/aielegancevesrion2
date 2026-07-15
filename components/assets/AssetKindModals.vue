<template>
  <Teleport to="body">
    <div
      v-if="expandedImage"
      class="fixed inset-0 z-[110] bg-black/92 flex flex-col p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      :aria-label="expandedImage.title"
      @click.self="emit('close-image')"
    >
      <div class="max-w-6xl w-full mx-auto flex flex-col flex-1 min-h-0">
        <div class="flex justify-between items-center gap-3 mb-3 text-white shrink-0">
          <p class="text-sm font-medium truncate">
            {{ expandedImage.title }}
          </p>
          <div class="flex items-center gap-2 shrink-0">
            <a
              v-if="expandedImage.downloadUrl"
              :href="expandedImage.downloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
            >
              Download
            </a>
            <button
              type="button"
              class="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 border border-white/20"
              @click="emit('close-image')"
            >
              Close
            </button>
          </div>
        </div>
        <img
          :src="expandedImage.url"
          :alt="expandedImage.title"
          class="w-full flex-1 min-h-[40vh] max-h-[calc(100vh-5rem)] rounded-lg object-contain mx-auto"
        >
      </div>
    </div>

    <div
      v-if="expandedScript"
      class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      :aria-label="expandedScript.title"
      @click.self="emit('close-script')"
    >
      <div
        class="w-full max-w-3xl max-h-[min(92vh,48rem)] rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col overflow-hidden"
        @click.stop
      >
        <div class="flex justify-between items-start gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-gray-900 truncate">
              {{ expandedScript.title }}
            </h2>
            <p v-if="expandedScript.partial" class="text-xs text-amber-800 mt-1">
              Showing synopsis only — full screenplay text was not available for this entry.
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            @click="emit('close-script')"
          >
            Close
          </button>
        </div>
        <pre class="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{{ expandedScript.text }}</pre>
      </div>
    </div>

    <div
      v-if="openMove"
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-move-title"
      @click.self="emit('close-move')"
    >
      <div
        class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <h2 id="asset-move-title" class="text-lg font-semibold text-gray-900 mb-1">
          Move video clip
        </h2>
        <p v-if="moveTarget" class="text-sm text-gray-600 mb-4 truncate">
          {{ moveTarget.title }}
        </p>
        <p v-if="!moveDestinationProjects.length" class="text-sm text-amber-800 mb-4">
          Create another project first — there is nowhere to move this clip.
        </p>
        <form v-else class="space-y-4" @submit.prevent="emit('submit-move')">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="move-project">Destination project</label>
            <select
              id="move-project"
              :value="moveProjectId"
              required
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              @change="emit('update:moveProjectId', ($event.target as HTMLSelectElement).value)"
            >
              <option value="" disabled>Select project</option>
              <option
                v-for="p in moveDestinationProjects"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }}
              </option>
            </select>
          </div>
          <p class="text-xs text-gray-500">
            The file stays in your library — only the project folder changes.
          </p>
          <p v-if="moveError" class="text-sm text-red-700">{{ moveError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              :disabled="moving"
              @click="emit('close-move')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
              :disabled="moving"
            >
              {{ moving ? 'Moving…' : 'Move clip' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="openAdd"
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="modalTitleId"
      @click.self="emit('close-add')"
    >
      <div
        class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6 max-h-[90vh] overflow-y-auto"
        @click.stop
      >
        <h2 :id="modalTitleId" class="text-lg font-semibold text-gray-900 mb-4">
          Add {{ addButtonLabel }}
        </h2>
        <p v-if="!projects.length" class="text-sm text-amber-800 mb-4">
          You need at least one project saved to your account. Create or import a project first.
        </p>
        <form v-else class="space-y-4" @submit.prevent="emit('submit-add')">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-project">Project</label>
            <select
              id="asset-project"
              :value="addForm.projectId"
              required
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              @change="emit('update:addForm', { ...addForm, projectId: ($event.target as HTMLSelectElement).value })"
            >
              <option value="" disabled>Select project</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-title">Title</label>
            <input
              id="asset-title"
              :value="addForm.title"
              type="text"
              required
              maxlength="500"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm"
              placeholder="e.g. Draft v2, Reference sheet"
              @input="emit('update:addForm', { ...addForm, title: ($event.target as HTMLInputElement).value })"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1" for="asset-notes">Notes (optional)</label>
            <textarea
              id="asset-notes"
              :value="addForm.notes"
              rows="4"
              maxlength="20000"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm resize-y"
              placeholder="Description, links, or paste text…"
              @input="emit('update:addForm', { ...addForm, notes: ($event.target as HTMLTextAreaElement).value })"
            />
          </div>
          <p v-if="addError" class="text-sm text-red-700">{{ addError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              @click="emit('close-add')"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm disabled:opacity-50"
              :disabled="adding"
            >
              {{ adding ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CreativeProject } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

defineProps<{
  expandedImage: { url: string; title: string; downloadUrl: string } | null
  expandedScript: { title: string; text: string; partial?: boolean } | null
  openMove: boolean
  moveTarget: ProjectAsset | null
  moveProjectId: string
  moveDestinationProjects: CreativeProject[]
  moving: boolean
  moveError: string
  openAdd: boolean
  addButtonLabel: string
  modalTitleId: string
  projects: CreativeProject[]
  addForm: { projectId: string; title: string; notes: string }
  addError: string
  adding: boolean
}>()

const emit = defineEmits<{
  'close-image': []
  'close-script': []
  'close-move': []
  'submit-move': []
  'close-add': []
  'submit-add': []
  'update:moveProjectId': [value: string]
  'update:addForm': [value: { projectId: string; title: string; notes: string }]
}>()
</script>
