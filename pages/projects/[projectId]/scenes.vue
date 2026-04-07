<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Scenes</span>
      · On import, Claude reads your screenplay and breaks it into shootable scenes (slug, summary, script excerpt). Refine the board on the Storyboard tab — including image prompts per shot.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else-if="!canLoadCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Scene lists are stored with cloud projects. Sign in and open a project you imported or created online.
      </div>
    </template>

    <template v-else>
      <div v-if="pending" class="text-sm text-gray-500 py-6">Loading scenes…</div>
      <div
        v-else-if="loadError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        {{ loadError }}
      </div>
      <template v-else-if="scenes.length">
        <p class="text-sm text-gray-600 mb-4">
          {{ scenes.length }} scene(s). Expand a row to read the excerpt Claude (or the parser) stored for storyboarding.
        </p>
        <ul class="space-y-3">
          <li
            v-for="s in scenes"
            :key="s.id"
            class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors"
              @click="toggleExpand(s.id)"
            >
              <span class="text-xs font-mono text-primary tabular-nums mt-0.5 shrink-0">
                {{ s.sortOrder + 1 }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="font-semibold text-gray-900 block">{{ s.heading }}</span>
                <span class="text-sm text-gray-600 line-clamp-2 mt-0.5">{{ s.summary || '—' }}</span>
              </span>
              <span class="text-xs text-gray-400 shrink-0">{{ expandedId === s.id ? '▼' : '▶' }}</span>
            </button>
            <div
              v-if="expandedId === s.id"
              class="border-t border-gray-100 px-4 py-3 bg-gray-50/80 text-sm"
            >
              <p v-if="detailError" class="text-red-700 text-sm mb-2">{{ detailError }}</p>
              <div v-else-if="detailLoading" class="text-gray-500">Loading script excerpt…</div>
              <pre
                v-else
                class="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed max-h-[min(70vh,28rem)] overflow-y-auto"
              >{{ detailBody || '—' }}</pre>
              <NuxtLink
                :to="`/projects/${projectId}/storyboard`"
                class="inline-block mt-3 text-sm text-primary font-medium hover:underline"
              >
                Open Storyboard for this project →
              </NuxtLink>
            </div>
          </li>
        </ul>
      </template>
      <div v-else class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-600">
        No scenes yet. Import a script into this project to populate the scene list.
      </div>
    </template>

    <div class="mt-10 pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/characters`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Characters
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/storyboard`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Storyboard →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const PB_ID = /^[a-z0-9]{15}$/

type SceneListRow = {
  id: string
  sortOrder: number
  heading: string
  summary: string
  bodyLength: number
}

const { activeProjectId, activeProject } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()

const projectId = activeProjectId

const scenes = ref<SceneListRow[]>([])
const loadError = ref<string | null>(null)
const pending = ref(false)

const expandedId = ref<string | null>(null)
const detailBody = ref('')
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

const canLoadCloud = computed(
  () =>
    !!activeProject.value &&
    activeProject.value.source === 'pocketbase' &&
    PB_ID.test(projectId.value) &&
    isAuthenticated.value &&
    !!getAuthToken()
)

async function loadScenes () {
  if (!canLoadCloud.value) return
  loadError.value = null
  pending.value = true
  try {
    const res = await $fetch<{ scenes: SceneListRow[] }>(`/api/projects/${projectId.value}/scenes`, {
      headers: { Authorization: `Bearer ${getAuthToken()!}` }
    })
    scenes.value = res.scenes || []
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load scenes')
        : 'Could not load scenes'
    loadError.value = msg
    scenes.value = []
  } finally {
    pending.value = false
  }
}

async function toggleExpand (id: string) {
  if (expandedId.value === id) {
    expandedId.value = null
    detailBody.value = ''
    detailError.value = null
    return
  }
  expandedId.value = id
  detailBody.value = ''
  detailError.value = null
  detailLoading.value = true
  try {
    const res = await $fetch<{ scene: { body: string } }>(
      `/api/projects/${projectId.value}/scenes/${id}`,
      { headers: { Authorization: `Bearer ${getAuthToken()!}` } }
    )
    detailBody.value = res.scene?.body || ''
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load scene')
        : 'Could not load scene'
    detailError.value = msg
  } finally {
    detailLoading.value = false
  }
}

watch(
  [canLoadCloud, projectId],
  ([ok]) => {
    if (ok) void loadScenes()
    else {
      scenes.value = []
      loadError.value = null
      expandedId.value = null
    }
  },
  { immediate: true }
)
</script>
