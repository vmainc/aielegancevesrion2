<template>
  <div class="max-w-4xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Cast list: name and AI-written look/feel prompt. Saving a character (or featuring a portrait) adds them to the Production Bible as approved canon. Click a name to open their lookbook in the Production Bible.
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
            <span class="font-medium text-gray-800">Build / refresh cast from script</span>
            uses your saved screenplay plus the project’s current synopsis, treatment, and Director-tab notes. If the table is empty it seeds names from the file, then writes a visual look/feel prompt and dialogue-share % for every row.
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
            label="AI is reading your script"
            sub-label="Creating or updating cast rows, look/feel prompts, and dialogue share for the chart…"
          />
        </div>

        <ProjectCharactersDescriptionTable
          class="mb-8"
          :characters="displayCharacters"
          :editable="true"
          :busy="characterMutating || enrichingCast || !!uploadingPortraitCharacterId"
          :uploading-portrait-character-id="uploadingPortraitCharacterId"
          :show-chart-swatches="displayCharacters.length > 0"
          :chart-color-by-name="chartSwatchColors"
          :show-character-creator-link="true"
          :project-id-for-creator-link="projectId"
          :portrait-url-by-character-id="portraitUrlByCharacterId"
          :portrait-notes-by-character-id="portraitNotesByCharacterId"
          :portrait-prompt-used-by-character-id="portraitPromptUsedByCharacterId"
          :show-portraits="true"
          heading="Characters"
          subheading="Click a name to open the full character profile. Click the image square to upload a photo. Square colors match the dialogue-share chart."
          empty-hint="No characters yet. Click “Build / refresh cast from script” (needs a saved screenplay on Overview), or add a row manually."
          @create="onCreateCharacter"
          @update="onUpdateCharacter"
          @delete="onDeleteCharacter"
          @upload-portrait="onUploadPortrait"
        />

        <div
          v-if="displayCharacters.length"
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

    <div class="mt-10 pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Director
      </NuxtLink>
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
import { isCharacterPortraitAsset } from '~/lib/character-voice-assets'
import { parseCharacterTurnaroundView } from '~/lib/character-turnaround-views'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { projectAssetPlaybackSrc } from '~/lib/project-asset-playback-url'
import { SCRIPT_WIZARD_UPLOAD_CLIENT_MS } from '~/lib/script-wizard-timeouts'
import { uploadCharacterPortrait } from '~/lib/upload-character-portrait'
import type { CreativeCharacter } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

const route = useRoute()
const { activeProjectId, activeProject, withProjectQuery } = useCreativeProject()
const { getAuthToken, isAuthenticated } = useAuth()
const { stepBadge } = useProjectWorkflowStep()
const toast = useToast()

const projectId = activeProjectId

const characters = ref<CreativeCharacter[]>([])
const characterAssets = ref<ProjectAsset[]>([])
const loadError = ref<string | null>(null)
const pending = ref(false)

const characterMutating = ref(false)
const enrichingCast = ref(false)
const uploadingPortraitCharacterId = ref<string | null>(null)

const canLoadCloud = computed(
  () =>
    !!activeProject.value &&
    PB_ID.test(projectId.value) &&
    isAuthenticated.value
)

const displayCharacters = computed<CreativeCharacter[]>(() => {
  const normalized = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  const hasPortrait = (id: string) => Boolean(portraitUrlByCharacterId.value[id])
  const map = new Map<string, CreativeCharacter>()
  for (const c of characters.value) {
    const key = normalized(c.name || '')
    if (!key) continue
    const prev = map.get(key)
    if (!prev) {
      map.set(key, c)
      continue
    }
    const prevScore = (hasPortrait(prev.id) ? 1000 : 0) + (prev.screenSharePercent ?? 0)
    const nextScore = (hasPortrait(c.id) ? 1000 : 0) + (c.screenSharePercent ?? 0)
    if (nextScore >= prevScore) map.set(key, c)
  }
  return [...map.values()]
})
const characterPieModel = computed(() => buildCharacterPieModel(displayCharacters.value))
const pieSlices = computed(() => characterPieModel.value.slices)
const chartSwatchColors = computed(() => pieModelToSwatchRecord(characterPieModel.value))

type PortraitPick = {
  url: string
  assetId: string
  projectId: string
  notes: string
  promptUsed: string
  ts: string
  featured: boolean
  isFront: boolean
}

function promptUsedFromAssetMeta (metadata: Record<string, unknown> | null): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const v = (metadata as { prompt_used?: unknown }).prompt_used
  return typeof v === 'string' ? v.trim() : ''
}

function pickPortrait (prev: PortraitPick | undefined, next: PortraitPick): PortraitPick {
  if (!prev) return next
  if (next.isFront && !prev.isFront) return next
  if (next.isFront === prev.isFront && next.featured && !prev.featured) return next
  if (next.isFront === prev.isFront && next.featured === prev.featured && next.ts > prev.ts) return next
  return prev
}

/** Front (or featured) portrait file + Character Creator fields per character row. */
const characterPortraitFieldsById = computed<Record<string, { url: string; notes: string; promptUsed: string }>>(() => {
  const byCharacterId: Record<string, PortraitPick> = {}
  const byCharacterName: Record<string, PortraitPick> = {}
  const byTitleGuess: Record<string, PortraitPick> = {}
  const normalize = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')
  for (const a of characterAssets.value) {
    if (!a.fileUrl) continue
    const meta = a.metadata || {}
    if (!isCharacterPortraitAsset(meta as Record<string, unknown>)) continue
    const cid = typeof meta.character_id === 'string' ? meta.character_id.trim() : ''
    const cname = typeof meta.character_name === 'string' ? normalize(meta.character_name) : ''
    const ts = a.updated || a.created || ''
    const featured = meta && typeof meta === 'object' && meta.featured === true
    const label =
      typeof (meta as { expression_label?: unknown }).expression_label === 'string'
        ? String((meta as { expression_label?: string }).expression_label)
        : typeof (meta as { emotion?: unknown }).emotion === 'string'
          ? String((meta as { emotion?: string }).emotion)
          : ''
    const isFront = parseCharacterTurnaroundView(label) === 'front' || featured === true
    const pick: PortraitPick = {
      url: a.fileUrl,
      assetId: a.id,
      projectId: a.projectId,
      notes: (a.notes || '').trim(),
      promptUsed: promptUsedFromAssetMeta(meta as Record<string, unknown> | null),
      ts,
      featured,
      isFront
    }
    if (cid) {
      byCharacterId[cid] = pickPortrait(byCharacterId[cid], pick)
    }
    if (cname) {
      byCharacterName[cname] = pickPortrait(byCharacterName[cname], pick)
    }
    const title = normalize(a.title || '')
    if (title) {
      const candidates = characters.value
        .map(c => normalize(c.name))
        .filter(Boolean)
      for (const n of candidates) {
        if (title.includes(n)) {
          byTitleGuess[n] = pickPortrait(byTitleGuess[n], pick)
        }
      }
    }
  }
  const out: Record<string, { url: string; notes: string; promptUsed: string }> = {}
  const token = getAuthToken()
  const playbackUrl = (pick: PortraitPick) =>
    projectAssetPlaybackSrc(
      { id: pick.assetId, projectId: pick.projectId, fileUrl: pick.url },
      token
    )
  for (const c of characters.value) {
    const hitById = byCharacterId[c.id]
    if (hitById?.url) {
      out[c.id] = {
        url: playbackUrl(hitById),
        notes: hitById.notes,
        promptUsed: hitById.promptUsed
      }
      continue
    }
    const normName = normalize(c.name)
    const hitByName = byCharacterName[normName]
    if (hitByName?.url) {
      out[c.id] = {
        url: playbackUrl(hitByName),
        notes: hitByName.notes,
        promptUsed: hitByName.promptUsed
      }
    } else if (byTitleGuess[normName]?.url) {
      const g = byTitleGuess[normName]
      out[c.id] = { url: playbackUrl(g), notes: g.notes, promptUsed: g.promptUsed }
    }
  }
  return out
})

const portraitUrlByCharacterId = computed<Record<string, string>>(() =>
  Object.fromEntries(
    Object.entries(characterPortraitFieldsById.value).map(([id, v]) => [id, v.url])
  )
)

const portraitNotesByCharacterId = computed<Record<string, string>>(() =>
  Object.fromEntries(
    Object.entries(characterPortraitFieldsById.value).map(([id, v]) => [id, v.notes])
  )
)

const portraitPromptUsedByCharacterId = computed<Record<string, string>>(() =>
  Object.fromEntries(
    Object.entries(characterPortraitFieldsById.value).map(([id, v]) => [id, v.promptUsed])
  )
)

async function refreshCharactersList () {
  const token = getAuthToken()
  if (!canLoadCloud.value || !token) return
  try {
    const res = await $fetch<{ characters: CreativeCharacter[] }>(
      `/api/projects/${projectId.value}/characters`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    characters.value = res.characters || []
    await loadCharacterAssets()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not refresh characters'), 'error')
  }
}

async function loadCharacterAssets () {
  const token = getAuthToken()
  if (!canLoadCloud.value || !token) return
  try {
    const res = await $fetch<{ items: ProjectAsset[] }>(
      `/api/projects/${projectId.value}/assets?kind=character`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    characterAssets.value = res.items || []
  } catch {
    characterAssets.value = []
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
    await loadCharacterAssets()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Could not load characters')
        : 'Could not load characters'
    loadError.value = msg
    characters.value = []
    characterAssets.value = []
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
    const res = await $fetch<{ updated: number; seeded?: number; warning?: string; characters: CreativeCharacter[] }>(
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
      res.updated === 1 ? 'Updated 1 look/feel prompt & dialogue %' : `Updated ${res.updated} look/feel prompts & dialogue %`
    )
    toast.showToast(bits.join(' · '), 'success')
    if (res.warning) {
      toast.showToast(res.warning, 'warning')
    }
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

async function onUploadPortrait (payload: { characterId: string; file: File }) {
  const id = projectId.value
  const token = getAuthToken()
  if (!id || !token) return
  const character = characters.value.find(c => c.id === payload.characterId)
  if (!character) return
  uploadingPortraitCharacterId.value = payload.characterId
  try {
    await uploadCharacterPortrait({
      projectId: id,
      characterId: character.id,
      characterName: character.name,
      roleDescription: character.roleDescription,
      file: payload.file,
      token
    })
    toast.showToast(`Photo saved for ${character.name}.`, 'success')
    await loadCharacterAssets()
  } catch (e: unknown) {
    toast.showToast(formatApiFetchError(e, 'Could not upload photo'), 'error')
  } finally {
    uploadingPortraitCharacterId.value = null
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
