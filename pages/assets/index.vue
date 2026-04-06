<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Assets</h1>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl">
        Everything you upload or generate lives here—organized by type. Entries are stored in PocketBase per
        project (<code class="text-xs bg-gray-100 px-1 py-0.5 rounded">project_assets</code>).
      </p>
    </div>

    <ClientOnly>
      <div v-if="isAuthenticated" class="mb-10 rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6">
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Recent library items</h2>
        <p v-if="loadError" class="text-sm text-red-700">{{ loadError }}</p>
        <p v-else-if="loading" class="text-sm text-gray-600">Loading…</p>
        <ul v-else-if="recentItems.length" class="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white overflow-hidden">
          <li
            v-for="a in recentItems"
            :key="a.id"
            class="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <div class="min-w-0">
              <span class="text-xs font-medium uppercase text-primary">{{ a.kind }}</span>
              <p class="font-medium text-gray-900 truncate">{{ a.title }}</p>
              <p v-if="a.projectName" class="text-xs text-gray-500 truncate">Project: {{ a.projectName }}</p>
            </div>
            <NuxtLink
              v-if="a.projectId"
              :to="`/projects/${a.projectId}/overview`"
              class="shrink-0 text-sm text-primary font-medium hover:underline"
            >
              Open project →
            </NuxtLink>
          </li>
        </ul>
        <p v-else class="text-sm text-gray-600">
          No assets saved yet. Create entries via the API or future UI from each workflow step.
        </p>
      </div>
      <template #fallback>
        <div class="mb-10 text-sm text-gray-500">Sign in to see your asset library.</div>
      </template>
    </ClientOnly>

    <ul class="grid gap-4 sm:grid-cols-2">
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
import type { ProjectAsset } from '~/types/project-asset'

const cards = [
  {
    to: '/assets/scripts',
    title: 'Scripts',
    blurb: 'Imported and working script files, drafts, and text tied to your projects.',
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

const { isAuthenticated, initAuth } = useAuth()
const pb = usePocketBase()

const loading = ref(true)
const loadError = ref('')
const items = ref<ProjectAsset[]>([])

const recentItems = computed(() => items.value.slice(0, 12))

async function loadAssets () {
  if (!import.meta.client || !isAuthenticated.value) {
    loading.value = false
    return
  }
  const token = pb.authStore.token
  if (!token) {
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    await initAuth()
    const res = await $fetch<{ items: ProjectAsset[] }>('/api/assets/my', {
      headers: { Authorization: `Bearer ${token}` }
    })
    items.value = res.items ?? []
  } catch (e) {
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
