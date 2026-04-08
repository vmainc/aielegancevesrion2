<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Cast list: name and Claude-written description. After you run director analysis and tweak the Director tab, use the button below so descriptions and dialogue-share % follow your <span class="font-medium text-gray-700">newest</span> synopsis, treatment, and director bible. The chart matches table swatches. Reference art lives under Assets.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else-if="!canLoadCloud">
      <div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 mb-6">
        Character breakdown and screen-share charts are available for account projects.
        Sign in and open a cloud project to load this data.
      </div>
    </template>

    <template v-else>
      <div
        v-if="pending"
        class="rounded-xl border border-primary/20 bg-primary/5 p-8"
      >
        <FilmReelLoader
          size="sm"
          label="Loading cast"
          sub-label="Fetching your project’s characters…"
        />
      </div>
      <div
        v-else-if="loadError"
        class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        {{ loadError }}
      </div>
      <template v-else>
        <div
          class="flex flex-wrap items-center justify-between gap-3 mb-4"
        >
          <p class="text-sm text-gray-600 max-w-xl">
            <span class="font-medium text-gray-800">Build / refresh cast from script (Claude)</span>
            uses your saved screenplay plus the project’s current synopsis, treatment, and Director-tab notes. If the table is empty it seeds names from the file, then writes a description and dialogue-share % for every row.
          </p>
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 shrink-0"
            :disabled="enrichingCast || characterMutating"
            @click="enrichCastFromScript"
          >
            {{ enrichingCast ? 'Working…' : 'Build / refresh cast from script' }}
          </button>
        </div>

        <div
          v-if="enrichingCast"
          class="rounded-xl border border-primary/20 bg-primary/5 p-6 mb-6"
        >
          <FilmReelLoader
            size="sm"
            label="Claude is reading your script"
            sub-label="Creating or updating cast rows, descriptions, and dialogue share for the chart…"
          />
        </div>

        <ProjectCharactersDescriptionTable
          class="mb-8"
          :characters="characters"
          :editable="true"
          :busy="characterMutating || enrichingCast"
          :show-chart-swatches="characters.length > 0"
          :chart-color-by-name="chartSwatchColors"
          heading="Characters"
          subheading="Square colors match the dialogue-share chart. Use the button above to pull names from the screenplay and have Claude describe each role."
          empty-hint="No characters yet. Click “Build / refresh cast from script” (needs a saved screenplay on Overview), or add a row manually."
          @create="onCreateCharacter"
          @update="onUpdateCharacter"
          @delete="onDeleteCharacter"
        />

        <div
          v-if="characters.length"
          class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 mb-8 shadow-sm"
        >
          <h2 class="text-lg font-semibold text-gray-900 mb-1">
            Dialogue share in the script
          </h2>
          <p class="text-sm text-gray-600 mb-6">
            Each slice is this character’s estimated share of <span class="font-medium text-gray-800">dialogue (and notable presence)</span> in the screenplay vs. the whole cast — same numbers as <span class="font-medium text-gray-800">Screen share %</span> in the table. Run <span class="font-medium text-gray-700">Build / refresh cast from script</span> to refresh from the screenplay; if the model returns flat numbers, we fall back to counting name mentions in the script excerpt so the pie isn’t all equal slices.
          </p>
          <CharacterScreenSharePie v-if="pieSlices.length" :slices="pieSlices" />
          <p v-else class="text-sm text-gray-500">
            No chart yet — add characters or run <span class="font-medium text-gray-700">Build / refresh cast from script</span>.
          </p>
        </div>
      </template>
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
import { onActivated } from 'vue'
import {
  buildCharacterPieModel,
  pieModelToSwatchRecord
} from '~/lib/character-screen-share-chart'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import type { CreativeCharacter } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

const route = useRoute()
const { activeProjectId, activeProject, withProjectQuery } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()

const projectId = activeProjectId

const characters = ref<CreativeCharacter[]>([])
const loadError = ref<string | null>(null)
const pending = ref(false)

const characterMutating = ref(false)
const enrichingCast = ref(false)

const canLoadCloud = computed(
  () =>
    !!activeProject.value &&
    PB_ID.test(projectId.value) &&
    isAuthenticated.value
)

const characterPieModel = computed(() => buildCharacterPieModel(characters.value))
const pieSlices = computed(() => characterPieModel.value.slices)
const chartSwatchColors = computed(() => pieModelToSwatchRecord(characterPieModel.value))

async function refreshCharactersList () {
  const token = getAuthToken()
  if (!canLoadCloud.value || !token) return
  try {
    const res = await $fetch<{ characters: CreativeCharacter[] }>(
      `/api/projects/${projectId.value}/characters`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    characters.value = res.characters || []
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not refresh characters'), 'error')
  }
}

async function loadCharacters () {
  if (!canLoadCloud.value) return
  const token = getAuthToken()
  if (!token) return
  loadError.value = null
  pending.value = true
  try {
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

async function enrichCastFromScript () {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  enrichingCast.value = true
  try {
    const res = await $fetch<{ updated: number; seeded?: number; characters: CreativeCharacter[] }>(
      `/api/projects/${id}/characters/enrich-from-script`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {},
        timeout: SCRIPT_WIZARD_UPLOAD_CLIENT_MS
      }
    )
    if (res.characters?.length) {
      characters.value = res.characters
    } else {
      await refreshCharactersList()
    }
    const bits: string[] = []
    if (res.seeded && res.seeded > 0) {
      bits.push(res.seeded === 1 ? 'Added 1 character from the screenplay' : `Added ${res.seeded} characters from the screenplay`)
    }
    bits.push(
      res.updated === 1 ? 'Claude updated 1 description & dialogue %' : `Claude updated ${res.updated} descriptions & dialogue %`
    )
    toast.showToast(bits.join(' · '), 'success')
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not build cast from script'), 'error')
  } finally {
    enrichingCast.value = false
  }
}

async function onCreateCharacter (payload: {
  name: string
  roleDescription: string
  screenSharePercent: number | null
}) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  characterMutating.value = true
  try {
    await $fetch(`/api/projects/${id}/characters`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: payload.name,
        roleDescription: payload.roleDescription,
        screenSharePercent: payload.screenSharePercent
      }
    })
    toast.showToast('Character added.', 'success')
    await refreshCharactersList()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not add character'), 'error')
  } finally {
    characterMutating.value = false
  }
}

async function onUpdateCharacter (
  characterId: string,
  payload: { name: string; roleDescription: string; screenSharePercent: number | null }
) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  characterMutating.value = true
  try {
    await $fetch(`/api/projects/${id}/characters/${characterId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: payload.name,
        roleDescription: payload.roleDescription,
        screenSharePercent: payload.screenSharePercent
      }
    })
    toast.showToast('Character updated.', 'success')
    await refreshCharactersList()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not update character'), 'error')
  } finally {
    characterMutating.value = false
  }
}

async function onDeleteCharacter (characterId: string) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  characterMutating.value = true
  try {
    await $fetch(`/api/projects/${id}/characters/${characterId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.showToast('Character removed.', 'success')
    await refreshCharactersList()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not delete character'), 'error')
  } finally {
    characterMutating.value = false
  }
}

watch(
  () => ({
    ok: canLoadCloud.value,
    pid: projectId.value,
    path: route.fullPath,
    updated: activeProject.value?.updatedAt ?? ''
  }),
  (cur) => {
    if (!cur.ok) {
      characters.value = []
      loadError.value = null
      return
    }
    void loadCharacters()
  },
  { immediate: true }
)

onActivated(() => {
  if (canLoadCloud.value) void loadCharacters()
})
</script>
