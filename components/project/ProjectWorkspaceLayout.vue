<template>
  <div v-if="loading" class="max-w-lg mx-auto px-4 py-16 text-center text-gray-600">
    Loading project…
  </div>

  <div v-else-if="!project" class="max-w-lg mx-auto px-4 py-16 text-center">
    <h1 class="text-xl font-semibold text-gray-900 mb-2">Project not found</h1>
    <p class="text-gray-600 text-sm mb-6">
      This link may be outdated or the project was removed from this browser.
    </p>
    <NuxtLink
      to="/projects"
      class="inline-flex items-center justify-center px-5 py-2.5 bg-primary text-gray-950 font-semibold rounded-lg hover:bg-primary/90 transition-colors"
    >
      Back to projects
    </NuxtLink>
  </div>

  <div v-else class="min-h-[calc(100vh-5rem)] flex flex-col lg:flex-row bg-gray-50">
    <!-- Mobile section tabs -->
    <div class="lg:hidden border-b border-gray-200 bg-white px-2 pt-3 pb-2 overflow-x-auto shadow-sm">
      <div class="flex gap-1 min-w-max">
        <NuxtLink
          v-for="item in sections"
          :key="item.path"
          :to="`/projects/${projectId}/${item.path}`"
          class="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
          :class="isActive(item.path)
            ? 'bg-primary text-gray-950'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </div>

    <!-- Desktop sidebar -->
    <aside class="hidden lg:flex w-56 flex-shrink-0 border-r border-gray-200 bg-white flex-col">
      <div class="p-4 border-b border-gray-200">
        <NuxtLink
          to="/projects"
          class="text-xs text-gray-500 hover:text-primary transition-colors mb-3 inline-flex items-center gap-1"
        >
          <span aria-hidden="true">←</span> All projects
        </NuxtLink>
        <p class="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Workflow</p>
        <ol class="space-y-1 text-xs text-gray-500">
          <li>1. Overview</li>
          <li>2. Director</li>
          <li>3. Story</li>
          <li>4. Characters</li>
          <li>5. Scenes</li>
          <li>6. Storyboard</li>
          <li>7. Video</li>
        </ol>
      </div>
      <nav class="flex-1 p-3 space-y-0.5">
        <NuxtLink
          v-for="item in sections"
          :key="item.path"
          :to="`/projects/${projectId}/${item.path}`"
          class="block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          :class="isActive(item.path)
            ? 'bg-primary/15 text-primary border border-primary/30'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col min-w-0 bg-white">
      <header class="border-b border-gray-200 bg-white px-4 sm:px-6 py-4 sm:py-5">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 class="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              {{ project.name }}
            </h1>
            <p class="text-sm text-gray-500 mt-1">
              {{ sectionSubtitle }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
              {{ project.aspectRatio }}
            </span>
            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200 capitalize">
              {{ goalLabel(project.goal) }}
            </span>
            <button
              type="button"
              class="ml-auto sm:ml-0 inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-primary hover:border-primary/40 hover:bg-gray-50 transition-colors"
              aria-label="Project settings"
              @click="settingsOpen = true"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <ProjectSettingsModal v-if="project" v-model:open="settingsOpen" :project="project" />

      <main class="flex-1 px-4 sm:px-6 py-6 sm:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreativeProject, ProjectGoal } from '~/types/creative-project'

withDefaults(
  defineProps<{
    project: CreativeProject | null
    projectId: string
    loading?: boolean
  }>(),
  { loading: false }
)

const settingsOpen = ref(false)
const route = useRoute()

const sections = [
  { path: 'overview', label: 'Overview' },
  { path: 'director', label: 'Director' },
  { path: 'story', label: 'Story' },
  { path: 'characters', label: 'Characters' },
  { path: 'scenes', label: 'Scenes' },
  { path: 'storyboard', label: 'Storyboard' },
  { path: 'video', label: 'Video' },
  { path: 'analysis', label: 'Analysis' }
] as const

const isActive = (path: string) => {
  const tail = route.path.split('/').pop() || ''
  return tail === path
}

const sectionSubtitle = computed(() => {
  const tail = route.path.split('/').pop() || ''
  const found = sections.find(s => s.path === tail)
  return found ? `${found.label} · project workspace` : 'Project workspace'
})

function goalLabel (g: ProjectGoal) {
  const map: Record<ProjectGoal, string> = {
    film: 'Film',
    social: 'Social',
    commercial: 'Commercial',
    other: 'Other'
  }
  return map[g] ?? g
}
</script>
