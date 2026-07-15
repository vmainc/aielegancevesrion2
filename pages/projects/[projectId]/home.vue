<template>
  <div class="max-w-5xl">
    <p class="text-sm text-gray-500 mb-6">
      Project overview — jump to any step or continue where you left off.
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
      <section class="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6 mb-8">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="min-w-0">
            <p v-if="project.genre || project.tone" class="text-xs text-gray-500 mb-2">
              <span v-if="project.genre" class="capitalize">{{ project.genre }}</span>
              <span v-if="project.genre && project.tone"> · </span>
              <span v-if="project.tone">{{ project.tone }}</span>
            </p>
            <p v-if="synopsisPreview" class="text-sm sm:text-base text-gray-700 leading-relaxed line-clamp-4">
              {{ synopsisPreview }}
            </p>
            <p v-else class="text-sm text-gray-500">
              No synopsis yet —
              <NuxtLink :to="storyPath" class="text-primary font-medium hover:underline">add your story</NuxtLink>
              to get started.
            </p>
          </div>
          <NuxtLink
            v-if="primaryAction"
            :to="primaryAction.to"
            class="shrink-0 inline-flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors"
          >
            {{ primaryAction.label }} →
          </NuxtLink>
        </div>
      </section>

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

      <section v-if="sceneRows.length" class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-base font-semibold text-gray-900">Scenes</h2>
          <NuxtLink
            :to="`/projects/${projectId}/scenes`"
            class="text-sm text-primary font-medium hover:underline"
          >
            View all ({{ sceneRows.length }})
          </NuxtLink>
        </div>
        <ul class="divide-y divide-gray-100">
          <li
            v-for="(s, idx) in sceneRows.slice(0, 6)"
            :key="s.id"
            class="px-5 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1"
          >
            <span class="text-xs font-medium text-gray-400 w-6">{{ idx + 1 }}.</span>
            <span class="text-sm font-medium text-gray-900 min-w-0 truncate">{{ s.heading || 'Untitled scene' }}</span>
            <span v-if="s.shotCount" class="text-xs text-gray-500">{{ s.shotCount }} panel{{ s.shotCount === 1 ? '' : 's' }}</span>
          </li>
        </ul>
        <p v-if="sceneRows.length > 6" class="px-5 py-3 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
          + {{ sceneRows.length - 6 }} more scene{{ sceneRows.length - 6 === 1 ? '' : 's' }}
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  isIdeaFirstWorkflowProject,
  projectStorySatisfiedByScriptImport
} from '~/lib/project-workflow'
import { stripConceptMetadataMarkers } from '~/lib/format-stored-concept'
import type { CreativeCharacter } from '~/types/creative-project'
import type { CreativeSceneListItem } from '~/types/creative-scene'

const PB_ID = /^[a-z0-9]{15}$/

const { activeProject, activeProjectId } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()

const projectId = activeProjectId
const project = activeProject

const storyPath = computed(() => `/projects/${projectId.value}/overview`)

const canLoadCloud = computed(() =>
  Boolean(projectId.value && PB_ID.test(projectId.value) && isAuthenticated.value)
)

const loadingStats = ref(false)
const loadError = ref('')
const characters = ref<CreativeCharacter[]>([])
const sceneRows = ref<CreativeSceneListItem[]>([])

const synopsisPreview = computed(() => {
  const raw = project.value?.synopsis?.trim() || ''
  if (!raw) return ''
  return stripConceptMetadataMarkers(raw).slice(0, 420)
})

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

const storySatisfied = computed(() => projectStorySatisfiedByScriptImport(project.value))
const ideaFirst = computed(() => isIdeaFirstWorkflowProject(project.value))

const primaryAction = computed((): { to: string; label: string } | null => {
  const pid = projectId.value
  if (!pid) return null
  const p = project.value
  if (!p?.synopsis?.trim()) {
    return { to: `/projects/${pid}/overview`, label: 'Start your story' }
  }
  if (!directorReady.value) {
    return { to: `/projects/${pid}/director`, label: 'Set up director' }
  }
  if (canLoadCloud.value && !characters.value.length) {
    return { to: `/projects/${pid}/characters`, label: 'Build cast' }
  }
  if (canLoadCloud.value && !sceneRows.value.length) {
    return { to: `/projects/${pid}/scenes`, label: 'Add scenes' }
  }
  if (canLoadCloud.value && totalShots.value === 0) {
    return { to: `/projects/${pid}/storyboard`, label: 'Open storyboard' }
  }
  return { to: `/projects/${pid}/storyboard`, label: 'Continue to storyboard' }
})

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
      stat: project.value?.synopsis?.trim() ? 'Draft' : 'Empty',
      statTone: project.value?.synopsis?.trim() ? 'ready' : 'empty',
      blurb: ideaFirst.value
        ? 'Synopsis, concept notes, and idea workflow.'
        : 'Synopsis, treatment, and script import.'
    },
    {
      path: 'director',
      title: 'Director',
      stat: directorReady.value ? 'Ready' : 'Setup',
      statTone: directorReady.value ? 'ready' : 'partial',
      blurb: 'Visual bible — style, camera, pacing, continuity.'
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
      path: 'scenes',
      title: 'Scenes',
      stat: canLoadCloud.value
        ? sceneRows.value.length
          ? `${sceneRows.value.length} scenes`
          : 'None yet'
        : '—',
      statTone: sceneRows.value.length ? 'ready' : 'empty',
      blurb: 'Scene list, script text, and per-scene analysis.',
      preview: sceneRows.value.slice(0, 3).map(s => s.heading || 'Untitled scene')
    },
    {
      path: 'storyboard',
      title: 'Storyboard',
      stat: totalShots.value ? `${totalShots.value} panels` : 'None yet',
      statTone: totalShots.value ? 'ready' : 'empty',
      blurb: 'Panels, frames, and shot prompts per scene.'
    },
    {
      path: 'video',
      title: 'Video',
      stat: 'Generate',
      statTone: 'partial',
      blurb: 'Generate clips from panels and manage renders.'
    }
  ]

  if (!storySatisfied.value && !ideaFirst.value) {
    cards.splice(1, 0, {
      path: 'story',
      title: 'Script',
      stat: project.value?.conceptNotes?.trim() ? 'Saved' : 'Empty',
      statTone: project.value?.conceptNotes?.trim() ? 'ready' : 'empty',
      blurb: 'Full screenplay and working notes.'
    })
  }

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
