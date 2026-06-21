<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Assets</h1>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl">
        Everything you upload or generate lives here—organized by type.
      </p>
    </div>

    <ul class="grid gap-4 sm:grid-cols-2 mb-10">
      <li v-for="card in cards" :key="card.to">
        <NuxtLink
          :to="card.to"
          class="block rounded-xl border border-gray-200 bg-white shadow-sm hover:border-primary/50 hover:bg-gray-50 transition-all p-6 h-full"
        >
          <h2 class="text-lg font-semibold text-gray-900 mb-2">{{ card.title }}</h2>
          <p class="text-sm text-gray-600 mb-4">{{ card.blurb }}</p>
          <span class="text-sm text-primary font-medium">Open →</span>
        </NuxtLink>
      </li>
    </ul>

    <ClientOnly>
      <div v-if="isAuthenticated" class="mb-10 rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6">
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Recent library items</h2>
        <p v-if="loadError" class="text-sm text-red-700">{{ loadError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-600">Loading…</p>
        <div v-else-if="projectGroups.length" class="space-y-4">
          <details
            v-for="g in projectGroups"
            :key="g.key"
            class="rounded-lg border border-gray-200 bg-white overflow-hidden group"
          >
            <summary
              class="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none px-4 py-3 bg-gray-50 flex flex-wrap items-center justify-between gap-2 hover:bg-gray-100/80"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="text-gray-400 text-xs shrink-0 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                >▶</span>
                <h3 class="text-sm font-semibold text-gray-900 truncate">{{ g.projectName }}</h3>
                <span class="text-xs text-gray-500">{{ g.items.length }} item{{ g.items.length === 1 ? '' : 's' }}</span>
              </div>
              <NuxtLink
                v-if="g.projectId"
                :to="`/projects/${g.projectId}/home`"
                class="shrink-0 text-sm text-primary font-medium hover:underline"
                @click.stop
              >
                Open project →
              </NuxtLink>
            </summary>
            <ul class="divide-y divide-gray-200">
              <li
                v-for="a in g.items"
                :key="a.id"
                class="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div class="min-w-0">
                  <span class="text-xs font-medium uppercase text-primary">{{ a.kind }}</span>
                  <p class="font-medium text-gray-900 truncate">{{ a.title }}</p>
                </div>
              </li>
            </ul>
          </details>
        </div>
        <p v-else class="text-sm text-gray-600">
          No assets saved yet. Create entries via the API or future UI from each workflow step.
        </p>
      </div>
      <template #fallback>
        <div class="mb-10 text-sm text-gray-500">Sign in to see your asset library.</div>
      </template>
    </ClientOnly>

    <div class="mt-10 pt-8 border-t border-gray-200">
      <p class="text-sm text-gray-500 mb-3">Assets are tied to projects.</p>
      <NuxtLink
        to="/projects"
        class="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80"
      >
        Go to Workflow
        <span class="ml-1" aria-hidden="true">→</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { groupProjectAssetsByProject } from '~/lib/project-asset-sort'
import type { ProjectAsset } from '~/types/project-asset'

const cards = [
  {
    to: '/assets/scripts',
    title: 'Scripts',
    blurb: 'Screenplays from Project → Overview and Script Wizard—one list, newest first, with project names and downloads.',
  },
  {
    to: '/assets/characters',
    title: 'Characters',
    blurb: 'Character sheets, portraits, and generated references.',
  },
  {
    to: '/assets/storyboards',
    title: 'Storyboards',
    blurb: 'Panels, shots, and board exports from your storyboard workflow.',
  },
  {
    to: '/assets/video',
    title: 'Video',
    blurb: 'Rendered clips, exports, and video outputs.',
  },
]

const { isAuthenticated, initAuth, getAuthToken } = useAuth()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])

const projectGroups = computed(() => groupProjectAssetsByProject(items.value))

async function loadAssets () {
  if (!import.meta.client) {
    loading.value = false
    return
  }
  // Ensure auth state is hydrated before reading the bearer token.
  await initAuth()
  if (!isAuthenticated.value) {
    loading.value = false
    items.value = []
    loadError.value = ''
    return
  }
  const token = getAuthToken()
  if (!token) {
    loading.value = false
    items.value = []
    loadError.value = 'Please sign in again to load your library items.'
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>('/api/assets/my', {
      headers: { Authorization: `Bearer ${token}` }
    })
    items.value = res.items ?? []
  } catch (e: unknown) {
    const status = e && typeof e === 'object' && 'statusCode' in e
      ? Number((e as { statusCode?: number }).statusCode)
      : NaN
    if (status === 401) {
      loadError.value = 'Session expired. Please sign in again.'
      items.value = []
      return
    }
    loadError.value =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message ?? 'Could not load assets')
        : 'Could not load assets'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadAssets()
})

watch(isAuthenticated, (v) => {
  if (v) loadAssets()
})

useHead({
  title: 'Assets',
})
</script>
