<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Location bible: look, architecture, and establishing plates. Upload or generate set plates here — then pick a location when generating images with cast.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else-if="!canLoadCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Locations are available for account projects. Sign in and open a cloud project to load this list.
      </div>
    </template>

    <template v-else>
      <div
        v-if="loading"
        class="rounded-xl border border-primary/20 bg-primary/5 p-8"
      >
        <FilmReelLoader
          size="sm"
          label="Loading locations"
          sub-label="Fetching bible places and set plates…"
        />
      </div>
      <div
        v-else-if="loadError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        {{ loadError }}
      </div>
      <template v-else>
        <div class="flex flex-wrap items-end gap-3 mb-6">
          <div class="flex-1 min-w-[12rem]">
            <label for="loc-new-name" class="block text-xs font-medium text-gray-600 mb-1">
              Add location
            </label>
            <input
              id="loc-new-name"
              v-model="newName"
              type="text"
              maxlength="200"
              class="w-full rounded-lg border border-gray-300 bg-studio-slate px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="e.g. Claude’s Trailer"
              :disabled="busy"
              @keydown.enter.prevent="createLocation"
            >
          </div>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
            :disabled="busy || !newName.trim()"
            @click="createLocation"
          >
            {{ creating ? 'Adding…' : 'Add' }}
          </button>
          <NuxtLink
            :to="`/projects/${projectId}/bible`"
            class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
          >
            Open Production Bible
          </NuxtLink>
        </div>

        <p
          v-if="!refs.length"
          class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-600 text-center"
        >
          No locations yet. Seed from Production Bible (Sync / Seed from Project) or add one above.
        </p>

        <ul v-else class="space-y-3">
          <li
            v-for="loc in refs"
            :key="loc.id"
            class="rounded-xl border border-gray-200 bg-studio-slate p-4 shadow-sm"
          >
            <div class="flex flex-wrap gap-4">
              <div
                class="relative w-20 h-28 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200"
              >
                <img
                  v-if="loc.featuredPlateUrl"
                  :src="loc.featuredPlateUrl"
                  :alt="loc.name"
                  class="absolute inset-0 w-full h-full object-cover"
                >
                <div
                  v-else
                  class="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-wide text-gray-400 px-1 text-center"
                >
                  No plate
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <NuxtLink
                      :to="biblePath(loc.id)"
                      class="text-base font-semibold text-gray-900 hover:text-primary"
                    >
                      {{ loc.name }}
                    </NuxtLink>
                    <p class="text-xs text-gray-500 mt-0.5">
                      {{ loc.plateUrls.length }}
                      plate{{ loc.plateUrls.length === 1 ? '' : 's' }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <label
                      class="cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                      :class="uploadingId === loc.id ? 'opacity-50 pointer-events-none' : ''"
                    >
                      {{ uploadingId === loc.id ? 'Uploading…' : 'Upload plate' }}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        class="sr-only"
                        :disabled="busy"
                        @change="onUploadPlate(loc, $event)"
                      >
                    </label>
                    <NuxtLink
                      :to="generatePath(loc)"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover"
                    >
                      Generate plate
                    </NuxtLink>
                    <NuxtLink
                      :to="biblePath(loc.id)"
                      class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                    >
                      Edit
                    </NuxtLink>
                  </div>
                </div>
                <p
                  v-if="loc.summary"
                  class="mt-2 text-sm text-gray-600 line-clamp-2"
                >
                  {{ loc.summary }}
                </p>
                <p
                  v-else-if="loc.architecture"
                  class="mt-2 text-sm text-gray-600 line-clamp-2"
                >
                  {{ loc.architecture }}
                </p>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { projectBibleEntityPath } from '~/lib/project-bible-paths'
import { workflowStepOf } from '~/lib/project-workflow'
import { uploadSetPlate } from '~/lib/upload-set-plate'
import type { ProjectLocationRef } from '~/composables/useProjectLocationRefs'

const PB_ID = /^[a-z0-9]{15}$/

const { activeProject, activeProjectId } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()
const toast = useToast()

const projectId = activeProjectId
const { refs, loading, loadError, reload } = useProjectLocationRefs(projectId)

const canLoadCloud = computed(() =>
  Boolean(projectId.value && PB_ID.test(projectId.value) && isAuthenticated.value)
)

const stepBadge = computed(() => {
  const step = workflowStepOf('locations', activeProject.value)
  return step ? `Step ${step.current} of ${step.total}` : ''
})

const newName = ref('')
const creating = ref(false)
const uploadingId = ref('')
const busy = computed(() => creating.value || !!uploadingId.value)

const bible = useProductionBible(projectId)

function biblePath (entityId: string) {
  return projectBibleEntityPath(projectId.value, entityId)
}

function generatePath (loc: ProjectLocationRef) {
  const q = new URLSearchParams({
    projectId: projectId.value,
    category: 'locations',
    locationId: loc.id,
    prompt: `Establishing plate of ${loc.name}: photoreal practical location, full environment, even lighting, no people in frame.${loc.summary ? ` Look: ${loc.summary}` : ''}${loc.architecture ? ` Architecture: ${loc.architecture}` : ''}`
  })
  return `/tools/image-generation?${q.toString()}`
}

async function createLocation () {
  const name = newName.value.trim()
  if (!name || !canLoadCloud.value || creating.value) return
  creating.value = true
  try {
    await bible.createEntity({ type: 'location', name })
    newName.value = ''
    toast.showToast(`Added ${name}`, 'success')
    await reload()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not add location'), 'error')
  } finally {
    creating.value = false
  }
}

async function onUploadPlate (loc: ProjectLocationRef, ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const token = getAuthToken()
  if (!token) {
    toast.showToast('Sign in to upload', 'error')
    return
  }
  uploadingId.value = loc.id
  try {
    await uploadSetPlate({
      projectId: projectId.value,
      entityId: loc.id,
      locationName: loc.name,
      file,
      token
    })
    toast.showToast('Set plate uploaded', 'success')
    await reload()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not upload plate'), 'error')
  } finally {
    uploadingId.value = ''
  }
}
</script>
