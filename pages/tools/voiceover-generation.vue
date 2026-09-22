<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-8">
      <h1 class="font-display text-3xl sm:text-4xl text-ivory tracking-wide">
        Voiceover
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Generate spoken narration or dialogue for your film. This is separate from
        <NuxtLink to="/tools/music-generation" class="text-primary font-medium hover:underline">Music</NuxtLink>
        — enter the words to speak here, not a song prompt.
      </p>
    </header>

    <div v-if="pending" class="text-sm text-gray-600 mb-6 animate-pulse">
      Loading voices…
    </div>

    <div
      v-else-if="fetchError"
      class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-8"
    >
      Could not load voice models. Try again later.
    </div>

    <template v-else>
      <p
        v-if="data?.notice && uiPhase === 'form'"
        class="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700"
      >
        {{ data.notice }}
      </p>

      <div
        v-if="uiPhase === 'generating'"
        class="rounded-xl border border-primary/25 bg-primary/5 px-6 py-14 mb-10"
      >
        <FilmReelLoader
          size="lg"
          label="Recording voiceover…"
          :sub-label="selectedModel?.name || selectedModelId"
        />
        <p class="mt-6 text-center text-sm text-gray-600 max-w-md mx-auto">
          Keep this tab open while speech is synthesized.
        </p>
      </div>

      <div
        v-else-if="uiPhase === 'complete'"
        class="space-y-8 mb-10"
      >
        <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ clipSaved ? 'Voiceover saved to your project' : 'Your voiceover is ready' }}
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              <template v-if="clipSaved">
                Saved to
                <span class="font-medium text-gray-800">{{ savedProjectName || 'your project' }}</span>
                library.
              </template>
              <template v-else>
                Preview below, then save to a project or generate again.
              </template>
            </p>
          </div>

          <div v-if="playbackUrl" class="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <audio
              :src="playbackUrl"
              controls
              class="w-full"
              preload="metadata"
            />
            <p class="text-xs text-gray-600 whitespace-pre-wrap border-t border-gray-200 pt-3">
              {{ lastScript }}
            </p>
            <p v-if="lastDelivery" class="text-xs text-gray-500">
              Delivery: {{ lastDelivery }}
            </p>
          </div>

          <p v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {{ formError }}
          </p>

          <div class="flex flex-wrap gap-3 pt-2">
            <button
              v-if="!clipSaved"
              type="button"
              class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              :disabled="!playbackUrl || saving || !selectedProjectId"
              @click="saveClip"
            >
              {{ saving ? 'Saving…' : 'Save to project' }}
            </button>
            <button
              type="button"
              class="px-5 py-2.5 border border-gray-300 bg-studio-slate hover:bg-gray-50 text-gray-800 font-medium rounded-lg text-sm transition-colors"
              @click="resetToForm"
            >
              {{ clipSaved ? 'Generate another' : 'Edit & try again' }}
            </button>
          </div>
        </section>
      </div>

      <form
        v-else
        class="space-y-8 mb-10"
        @submit.prevent="onSubmit"
      >
        <section class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Script
          </h2>
          <p class="text-xs text-gray-500 -mt-2">
            The exact words the voice will speak. Not a music prompt — write dialogue or narration.
          </p>
          <div>
            <div class="flex justify-between items-center gap-2 mb-1.5">
              <label for="vo-script" class="text-sm font-medium text-gray-700">Spoken lines</label>
              <PromptEnhanceButton v-model="script" context="voiceover" />
            </div>
            <textarea
              id="vo-script"
              v-model="script"
              rows="6"
              required
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="In a world where neon never sleeps, one detective still believes in miracles…"
            />
            <p class="mt-1.5 text-xs text-gray-500 tabular-nums">{{ script.length.toLocaleString() }} characters</p>
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Delivery
          </h2>
          <p class="text-xs text-gray-500 -mt-2">
            Optional performance notes (tone, pace, emotion). These guide the voice — they are not sung as lyrics.
          </p>
          <div>
            <label for="vo-delivery" class="block text-sm font-medium text-gray-700 mb-1.5">
              How it should sound
            </label>
            <textarea
              id="vo-delivery"
              v-model="deliveryNotes"
              rows="3"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Warm documentary narrator, slight urgency, intimate — not theatrical"
            />
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <label for="vo-model" class="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
              <select
                id="vo-model"
                v-model="selectedModelId"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option v-for="m in models" :key="m.id" :value="m.id">
                  {{ m.name }} ({{ m.priceHint }})
                </option>
              </select>
              <p v-if="selectedModel?.description" class="mt-1.5 text-xs text-gray-500">
                {{ selectedModel.description }}
              </p>
            </div>
            <div>
              <label for="vo-voice" class="block text-sm font-medium text-gray-700 mb-1.5">Voice</label>
              <select
                id="vo-voice"
                v-model="selectedVoiceId"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
                <option v-for="v in voices" :key="v.id" :value="v.id">
                  {{ v.label }}
                </option>
              </select>
            </div>
          </div>

          <div v-if="selectedModel?.supportsSpeed" class="max-w-xs">
            <label for="vo-speed" class="block text-sm font-medium text-gray-700 mb-1.5">
              Speed ({{ speed.toFixed(2) }}×)
            </label>
            <input
              id="vo-speed"
              v-model.number="speed"
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              class="w-full"
            >
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Save to project
          </h2>
          <div>
            <label for="vo-project" class="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
            <select
              id="vo-project"
              v-model="selectedProjectId"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select a project…</option>
              <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
            <p class="mt-1.5 text-xs text-gray-500">
              Required to save the clip after generation. You can still preview without saving.
            </p>
          </div>
        </section>

        <p v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ formError }}
        </p>

        <button
          type="submit"
          class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          :disabled="generating || !script.trim()"
        >
          {{ generating ? 'Generating…' : 'Generate voiceover' }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  DEFAULT_VOICEOVER_MODEL_ID,
  defaultVoiceForModel,
  type VoiceoverModelOption
} from '~/lib/voiceover-generation-models'
import { pocketBaseBearerHeaders } from '~/lib/pocketbase-auth-headers'
import type { CreativeProject } from '~/types/creative-project'
import type { ProjectAsset } from '~/types/project-asset'

const PB_ID = /^[a-z0-9]{15}$/

type ApiPayload = {
  models?: VoiceoverModelOption[]
  defaultModelId?: string
  notice?: string
}

type UiPhase = 'form' | 'generating' | 'complete'

const toast = useToast()
const { getAuthToken, initAuth } = useAuth()
const { projects, loadServerProjects, clientReady } = useCreativeProject()

const { data, pending, error: fetchError } = await useFetch<ApiPayload>('/api/openrouter/voiceover-models')

const models = computed(() => data.value?.models ?? [])
const selectedModelId = ref(data.value?.defaultModelId || DEFAULT_VOICEOVER_MODEL_ID)
const selectedModel = computed(() => models.value.find((m) => m.id === selectedModelId.value))
const voices = computed(() => selectedModel.value?.voices ?? [])
const selectedVoiceId = ref(defaultVoiceForModel(selectedModelId.value))

watch(selectedModelId, (id) => {
  const ids = voices.value.map((v) => v.id)
  if (!ids.includes(selectedVoiceId.value)) {
    selectedVoiceId.value = defaultVoiceForModel(id)
  }
})

const script = ref('')
const deliveryNotes = ref('')
const speed = ref(1)

const uiPhase = ref<UiPhase>('form')
const generating = ref(false)
const saving = ref(false)
const formError = ref('')

const playbackUrl = ref('')
const resultId = ref('')
const lastScript = ref('')
const lastDelivery = ref('')
const lastModel = ref('')
const lastVoice = ref('')
const clipSaved = ref(false)
const savedProjectId = ref('')
const selectedProjectId = ref('')

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

const savedProjectName = computed(() =>
  pbProjects.value.find((p) => p.id === savedProjectId.value)?.name || ''
)

watch([pbProjects, clientReady], () => {
  if (!selectedProjectId.value && pbProjects.value.length) {
    selectedProjectId.value = pbProjects.value[0]!.id
  }
}, { immediate: true })

onMounted(async () => {
  await initAuth()
  await loadServerProjects()
})

function resetToForm () {
  uiPhase.value = 'form'
  formError.value = ''
  clipSaved.value = false
  playbackUrl.value = ''
  resultId.value = ''
}

async function onSubmit () {
  formError.value = ''
  const text = script.value.trim()
  if (!text) {
    formError.value = 'Enter the script — the words to speak.'
    return
  }
  generating.value = true
  uiPhase.value = 'generating'
  try {
    const res = await $fetch<{
      playbackUrl?: string
      resultId?: string
      model?: string
      voice?: string
      script?: string
      deliveryNotes?: string
    }>('/api/generate/voiceover', {
      method: 'POST',
      headers: pocketBaseBearerHeaders(getAuthToken()),
      body: {
        script: text,
        deliveryNotes: deliveryNotes.value.trim(),
        model: selectedModelId.value,
        voice: selectedVoiceId.value,
        speed: selectedModel.value?.supportsSpeed ? speed.value : undefined
      }
    })
    const url = (res.playbackUrl || '').trim()
    if (!url) throw new Error('No playback URL returned.')
    playbackUrl.value = url
    resultId.value = res.resultId || ''
    lastScript.value = res.script || text
    lastDelivery.value = res.deliveryNotes || deliveryNotes.value.trim()
    lastModel.value = res.model || selectedModelId.value
    lastVoice.value = res.voice || selectedVoiceId.value
    clipSaved.value = false
    savedProjectId.value = ''
    uiPhase.value = 'complete'
  } catch (e: unknown) {
    const msg =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Voiceover generation failed.'
    formError.value = msg
    uiPhase.value = 'form'
    toast.error(msg)
  } finally {
    generating.value = false
  }
}

async function saveClip () {
  formError.value = ''
  const pid = selectedProjectId.value.trim()
  if (!pid || !PB_ID.test(pid)) {
    formError.value = 'Choose a project to save into.'
    return
  }
  if (!playbackUrl.value) return
  saving.value = true
  try {
    const origin = window.location.origin
    const url = playbackUrl.value.startsWith('/')
      ? `${origin}${playbackUrl.value}`
      : playbackUrl.value
    const title =
      lastScript.value.trim().slice(0, 80) ||
      `Voiceover ${new Date().toISOString().slice(0, 10)}`
    const res = await $fetch<{ asset?: ProjectAsset }>(
      `/api/projects/${pid}/assets/ingest-from-url`,
      {
        method: 'POST',
        headers: {
          ...pocketBaseBearerHeaders(getAuthToken()),
          'Content-Type': 'application/json'
        },
        body: {
          url,
          kind: 'other',
          title,
          notes: lastDelivery.value || 'Generated voiceover',
          metadata: {
            source: 'voiceover_generation',
            media_type: 'audio',
            model: lastModel.value,
            voice: lastVoice.value,
            script: lastScript.value.slice(0, 4000),
            delivery_notes: lastDelivery.value.slice(0, 2000)
          }
        }
      }
    )
    if (!res.asset?.id) throw new Error('Server did not return a saved asset.')
    clipSaved.value = true
    savedProjectId.value = pid
    toast.success('Voiceover saved to your project.')
  } catch (e: unknown) {
    const msg =
      (e as { data?: { message?: string }; message?: string })?.data?.message ||
      (e as { message?: string })?.message ||
      'Could not save voiceover.'
    formError.value = msg
    toast.error(msg)
  } finally {
    saving.value = false
  }
}

useHead({ title: 'Voiceover' })
</script>
