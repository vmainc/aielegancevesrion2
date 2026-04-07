<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Step 4 of 5</span>
      · Characters from script import; attach reference art under Assets.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else-if="!canLoadCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Character breakdown and screen-share charts are available for cloud-saved projects after you sign in.
        Local-only projects keep using Assets for references.
      </div>
    </template>

    <template v-else>
      <div v-if="pending" class="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading characters…
      </div>
      <div
        v-else-if="loadError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        {{ loadError }}
      </div>
      <template v-else-if="characters.length">
        <div class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8 shadow-sm">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">
            Screen share (import estimate)
          </h2>
          <p class="text-sm text-gray-600 mb-6">
            From your last script import, Claude estimates how much each character drives dialogue and presence in the text.
          </p>
          <CharacterScreenSharePie v-if="pieSlices.length" :slices="pieSlices" />
          <p v-else class="text-sm text-gray-500">
            No percentage data yet — re-import the script, or add the
            <span class="font-mono text-xs">screen_share_percent</span>
            number field to <span class="font-mono text-xs">creative_characters</span>
            (e.g. <span class="font-mono text-xs">node scripts/add-fields-to-collections.js</span>).
          </p>
        </div>

        <div class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 mb-8">
          <h3 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
            Cast ({{ characters.length }})
          </h3>
          <ul class="space-y-5">
            <li
              v-for="c in characters"
              :key="c.id"
              class="border-b border-gray-200 last:border-0 last:pb-0 pb-5 last:mb-0"
            >
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
                <span class="font-semibold text-gray-900">{{ c.name }}</span>
                <span
                  v-if="c.screenSharePercent != null"
                  class="text-xs font-medium text-primary tabular-nums"
                >
                  {{ c.screenSharePercent.toFixed(1) }}% share
                </span>
              </div>
              <p class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {{ c.roleDescription || '—' }}
              </p>
            </li>
          </ul>
        </div>
      </template>
      <div
        v-else
        class="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 mb-8 text-center"
      >
        <h2 class="text-lg font-semibold text-gray-800 mb-2">No characters yet</h2>
        <p class="text-sm text-gray-500 mb-4">
          Import a screenplay into this project to auto-populate the cast, descriptions, and screen-share estimates.
        </p>
      </div>
    </template>

    <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-8">
      <h3 class="text-sm font-medium text-gray-700 mb-2">Project assets</h3>
      <p class="text-sm text-gray-500 mb-3">
        Character sheets, lookbooks, and exports live under Assets.
      </p>
      <NuxtLink
        :to="withProjectQuery('/assets/characters')"
        class="text-sm text-primary font-medium hover:underline"
      >
        Characters in Assets →
      </NuxtLink>
    </div>

    <div class="mt-10 pt-8 border-t border-gray-200">
      <NuxtLink
        :to="`/projects/${projectId}/scenes`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Scenes →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CreativeCharacter } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

const { activeProjectId, activeProject, withProjectQuery } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()

const projectId = activeProjectId

const characters = ref<CreativeCharacter[]>([])
const loadError = ref<string | null>(null)
const pending = ref(false)

const canLoadCloud = computed(
  () =>
    !!activeProject.value &&
    activeProject.value.source === 'pocketbase' &&
    PB_ID.test(projectId.value) &&
    isAuthenticated.value &&
    !!getAuthToken()
)

function buildPieSlices (list: CreativeCharacter[]): { label: string; percent: number; color: string }[] {
  const withPct = list
    .map(c => ({
      label: c.name,
      percent: c.screenSharePercent ?? 0
    }))
    .filter(s => s.percent > 0)

  if (!list.length) return []

  if (!withPct.length) {
    const eq = 100 / list.length
    return list.map((c, i) => ({
      label: c.name,
      percent: Math.round((i === list.length - 1 ? 100 - eq * (list.length - 1) : eq) * 10) / 10,
      color: ''
    }))
  }

  if (withPct.length <= 10) {
    return withPct.map(s => ({ ...s, color: '' }))
  }

  const sorted = [...withPct].sort((a, b) => b.percent - a.percent)
  const main: { label: string; percent: number; color: string }[] = []
  let other = 0
  const threshold = 2
  for (const s of sorted) {
    if (s.percent < threshold && sorted.length > 6) {
      other += s.percent
    } else {
      main.push({ ...s, color: '' })
    }
  }
  if (other > 0) {
    main.push({
      label: 'Other (smaller roles)',
      percent: Math.round(other * 10) / 10,
      color: ''
    })
  }
  return main
}

const pieSlices = computed(() => buildPieSlices(characters.value))

async function loadCharacters () {
  if (!canLoadCloud.value) return
  loadError.value = null
  pending.value = true
  try {
    const token = getAuthToken()
    const res = await $fetch<{ characters: CreativeCharacter[] }>(
      `/api/projects/${projectId.value}/characters`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    characters.value = res.characters || []
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load characters')
        : 'Could not load characters'
    loadError.value = msg
    characters.value = []
  } finally {
    pending.value = false
  }
}

watch(
  [canLoadCloud, projectId],
  ([ok]) => {
    if (ok) void loadCharacters()
    else {
      characters.value = []
      loadError.value = null
    }
  },
  { immediate: true }
)
</script>
