<template>
  <div class="max-w-5xl">
    <p class="text-sm text-gray-500 mb-6">
      Jump to any workflow step.
    </p>

    <div
      v-if="!project"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from
      <NuxtLink to="/projects" class="font-medium text-primary hover:underline">Projects</NuxtLink>
      to see this dashboard.
    </div>

    <template v-else>
      <div
        v-if="loadingStats"
        class="rounded-xl border border-primary/20 bg-primary/5 p-8 mb-8"
      >
        <FilmReelLoader size="sm" label="Loading project" sub-label="Fetching cast, scenes, and boards…" />
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        <NuxtLink
          v-for="card in sectionCards"
          :key="card.path"
          :to="`/projects/${projectId}/${card.path}`"
          class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-primary/40 hover:bg-gray-50/80 transition-all group"
        >
          <div class="flex items-start justify-between gap-2 mb-3">
            <h2 class="text-base font-semibold text-gray-900 group-hover:text-primary transition-colors">
              {{ card.title }}
            </h2>
            <span
              class="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
              :class="card.statTone === 'ready'
                ? 'bg-primary/15 text-primary'
                : card.statTone === 'empty'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-amber-50 text-amber-800'"
            >
              {{ card.stat }}
            </span>
          </div>
          <p class="text-sm text-gray-600 mb-3 min-h-[2.5rem]">{{ card.blurb }}</p>
          <ul v-if="card.preview?.length" class="text-xs text-gray-500 space-y-1 border-t border-gray-100 pt-3">
            <li v-for="(line, i) in card.preview" :key="i" class="truncate">{{ line }}</li>
          </ul>
          <span class="inline-block mt-3 text-sm text-primary font-medium">Open →</span>
        </NuxtLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { isIdeaFirstWorkflowProject } from '~/lib/project-workflow'
import { displayProjectSynopsis } from '~/lib/format-stored-concept'
import type { CreativeCharacter } from '~/types/creative-project'
import type { CreativeSceneListItem } from '~/types/creative-scene'

const PB_ID = /^[a-z0-9]{15}$/

const { activeProject, activeProjectId } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()

const projectId = activeProjectId
const project = activeProject

const canLoadCloud = computed(() =>
  Boolean(projectId.value && PB_ID.test(projectId.value) && isAuthenticated.value)
)

const loadingStats = ref(false)
const loadError = ref('')
const characters = ref<CreativeCharacter[]>([])
const sceneRows = ref<CreativeSceneListItem[]>([])

const totalShots = computed(() =>
  sceneRows.value.reduce((n, s) => n + (s.shotCount || 0), 0)
)

const directorReady = computed(() => {
  const d = project.value?.director
  if (!d) return false
  return Boolean(
    d.name?.trim() ||
    d.style?.trim() ||
    d.tone?.trim() ||
    d.camera_preferences?.trim()
  )
})

const ideaFirst = computed(() => isIdeaFirstWorkflowProject(project.value))

const sectionCards = computed(() => {
  const cards: Array<{
    path: string
    title: string
    stat: string
    statTone: 'ready' | 'empty' | 'partial'
    blurb: string
    preview?: string[]
  }> = [
    {
      path: 'overview',
      title: 'Story',
      stat: displayProjectSynopsis(project.value || {}).trim() ? 'Draft' : 'Empty',
      statTone: displayProjectSynopsis(project.value || {}).trim() ? 'ready' : 'empty',
      blurb: ideaFirst.value
        ? 'Synopsis, concept notes, and idea workflow.'
        : 'Synopsis, treatment, and script import.'
    },
    {
      path: 'characters',
      title: 'Characters',
      stat: canLoadCloud.value
        ? characters.value.length
          ? `${characters.value.length} cast`
          : 'None yet'
        : '—',
      statTone: characters.value.length ? 'ready' : 'empty',
      blurb: 'Cast list, portraits, and dialogue share.',
      preview: characters.value.slice(0, 4).map(c => c.name)
    },
    {
      path: 'director',
      title: 'Director',
      stat: directorReady.value ? 'Ready' : 'Setup',
      statTone: directorReady.value ? 'ready' : 'partial',
      blurb: 'Visual bible — style, camera, pacing, continuity.'
    },
    {
      path: 'storyboard',
      title: 'Storyboard',
      stat: totalShots.value ? `${totalShots.value} panels` : 'None yet',
      statTone: totalShots.value ? 'ready' : 'empty',
      blurb: 'Panels, start/end frames, and Generate video when both frames are ready.'
    }
  ]

  return cards
})

async function loadDashboardStats () {
  loadError.value = ''
  characters.value = []
  sceneRows.value = []
  if (!canLoadCloud.value) return

  const id = projectId.value
  const token = getAuthToken()
  if (!token) return

  loadingStats.value = true
  try {
    const headers = { Authorization: `Bearer ${token}` }
    const [charRes, sceneRes] = await Promise.all([
      $fetch<{ characters?: CreativeCharacter[] }>(`/api/projects/${id}/characters`, { headers }),
      $fetch<{ scenes?: CreativeSceneListItem[] }>(`/api/projects/${id}/scenes`, { headers })
    ])
    characters.value = charRes.characters ?? []
    sceneRows.value = sceneRes.scenes ?? []
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Could not load project stats'
  } finally {
    loadingStats.value = false
  }
}

watch([canLoadCloud, projectId], () => {
  void loadDashboardStats()
}, { immediate: true })
</script>
