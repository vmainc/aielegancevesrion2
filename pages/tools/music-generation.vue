<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <header class="mb-10">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Music generation
      </h1>
      <p class="mt-2 text-gray-600 text-sm sm:text-base max-w-2xl">
        Compose score beds and themes with Google Lyria via OpenRouter. Save to your project library and drop tracks on the timeline audio track.
      </p>
    </header>

    <div v-if="pending" class="text-sm text-gray-600 mb-6 animate-pulse">
      Loading models…
    </div>

    <div
      v-else-if="fetchError"
      class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-8"
    >
      Could not load models. Try again later.
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
          label="Composing music"
          sub-label="Lyria is generating your track — this can take a few minutes."
        />
        <p class="mt-6 text-center text-sm text-gray-600 max-w-md mx-auto">
          Keep this tab open while the model renders your score.
        </p>
      </div>

      <div
        v-else-if="uiPhase === 'complete'"
        class="space-y-8 mb-10"
      >
        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-5">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              Your track is ready
            </h2>
            <p class="text-sm text-gray-600 mt-1">
              Save to your project library, add to the timeline, or discard and try again.
            </p>
          </div>

          <div v-if="playbackUrl" class="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <audio
              :src="playbackSrc(playbackUrl)"
              controls
              class="w-full"
              preload="metadata"
            />
            <p v-if="transcript" class="mt-3 text-xs text-gray-600 whitespace-pre-wrap">
              {{ transcript }}
            </p>
          </div>

          <p v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {{ formError }}
          </p>

          <div class="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              :disabled="!playbackUrl || saving"
              @click="saveTrack"
            >
              {{ saving ? 'Saving…' : saveButtonLabel }}
            </button>
            <button
              type="button"
              class="px-5 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
              :disabled="discarding"
              @click="discardAndRetry"
            >
              {{ discarding ? 'Removing…' : 'Discard & try again' }}
            </button>
            <NuxtLink
              v-if="savedProjectId && addToTimeline"
              :to="`/projects/${savedProjectId}/timeline`"
              class="inline-flex items-center px-5 py-2.5 border border-primary/40 text-primary font-medium rounded-lg text-sm hover:bg-primary/5"
            >
              Open timeline
            </NuxtLink>
          </div>
        </section>
      </div>

      <form v-else class="space-y-8 mb-10" @submit.prevent="onSubmit">
        <section class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Score
          </h2>

          <div>
            <div class="flex justify-between items-center gap-2 mb-1.5">
              <label for="mg-prompt" class="text-sm font-medium text-gray-700">Prompt</label>
              <PromptEnhanceButton v-model="prompt" context="general" />
            </div>
            <textarea
              id="mg-prompt"
              v-model="prompt"
              rows="4"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Mood, instrumentation, tempo feel — e.g. tense orchestral underscore with low strings"
            />
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in stylePresets"
              :key="preset.label"
              type="button"
              class="px-3 py-1.5 text-xs rounded-full border border-gray-300 bg-white text-gray-700 hover:border-primary/50 hover:text-primary transition-colors"
              @click="applyPreset(preset)"
            >
              {{ preset.label }}
            </button>
          </div>

          <div>
            <label for="mg-model" class="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
            <select
              id="mg-model"
              v-model="selectedModelId"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
            >
              <option v-for="m in models" :key="m.id" :value="m.id">
                {{ m.name }} — {{ m.durationHint }} ({{ m.priceHint }})
              </option>
            </select>
            <p v-if="selectedModel?.description" class="mt-1.5 text-xs text-gray-500">
              {{ selectedModel.description }}
            </p>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <label class="inline-flex items-start gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                v-model="instrumental"
                type="checkbox"
                class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
              >
              <span>
                <span class="font-medium text-gray-900">Instrumental</span>
                <span class="block text-xs text-gray-500 mt-0.5">Recommended for film score beds</span>
              </span>
            </label>
            <div>
              <label for="mg-bpm" class="block text-sm font-medium text-gray-700 mb-1.5">BPM (optional)</label>
              <input
                id="mg-bpm"
                v-model.number="bpm"
                type="number"
                min="40"
                max="220"
                placeholder="e.g. 90"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
              >
            </div>
          </div>

          <div v-if="!instrumental">
            <label for="mg-lyrics" class="block text-sm font-medium text-gray-700 mb-1.5">Lyrics</label>
            <textarea
              id="mg-lyrics"
              v-model="lyrics"
              rows="3"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Lyrics for vocal tracks (Pro model works best for full songs)"
            />
          </div>
        </section>

        <section class="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Save to project
          </h2>

          <label class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
            <input
              v-model="saveToProject"
              type="checkbox"
              class="rounded border-gray-300 text-primary focus:ring-primary"
            >
            Save to project library after generation
          </label>

          <div v-if="saveToProject" class="space-y-3">
            <div class="flex flex-wrap gap-2 items-end">
              <div class="flex-1 min-w-[12rem]">
                <label for="mg-project" class="block text-sm font-medium text-gray-700 mb-1.5">Project</label>
                <select
                  id="mg-project"
                  v-model="selectedProjectId"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Select a project…</option>
                  <option v-for="p in pbProjects" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </select>
              </div>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-lg hover:bg-primary/5"
                @click="openCreateProjectModal"
              >
                + New project
              </button>
            </div>

            <label class="inline-flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
              <input
                v-model="addToTimeline"
                type="checkbox"
                class="rounded border-gray-300 text-primary focus:ring-primary"
                :disabled="!selectedProjectId"
              >
              Add to project timeline (audio track)
            </label>
          </div>
        </section>

        <p v-if="formError" class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {{ formError }}
        </p>

        <button
          type="submit"
          class="px-6 py-3 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          :disabled="generating || !prompt.trim()"
        >
          Generate music
        </button>
      </form>
    </template>

    <Teleport to="body">
      <div
        v-if="showCreateProject"
        class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mg-create-project-title"
        @click.self="closeCreateProjectModal"
      >
        <div
          class="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-6"
          @click.stop
        >
          <h2 id="mg-create-project-title" class="text-lg font-semibold text-gray-900 mb-1">
            New project
          </h2>
          <p class="text-sm text-gray-500 mb-4">
            Create a cloud project and select it for saving tracks.
          </p>
          <form class="space-y-4" @submit.prevent="submitCreateProject">
            <div>
              <label for="mg-new-project-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="mg-new-project-name"
                v-model="createProjectForm.name"
                type="text"
                maxlength="500"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
                placeholder="New project"
                autocomplete="off"
              >
            </div>
            <p v-if="createProjectError" class="text-sm text-red-600">{{ createProjectError }}</p>
            <div class="flex gap-2 justify-end pt-1">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                :disabled="creatingProject"
                @click="closeCreateProjectModal"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg disabled:opacity-50"
                :disabled="creatingProject"
              >
                {{ creatingProject ? 'Creating…' : 'Create & select' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ ssr: false })

import { appendAudioToProjectTimeline } from '~/lib/append-project-timeline-audio'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { MUSIC_STYLE_PRESETS } from '~/lib/music-generation-prompt'
import { DEFAULT_MUSIC_MODEL_ID } from '~/lib/music-generation-models'
import { appendPlaybackAccessToken } from '~/lib/project-asset-playback-url'
import { writeSessionWorkflow } from '~/lib/project-workflow-mode'
import {
  generateOpenRouterMusic,
  playbackUrlForProjectMusicAsset,
  saveMusicToProjectLibrary
} from '~/composables/useOpenRouterMusicGen'
import type { CreativeProject } from '~/types/creative-project'

const PB_ID = /^[a-z0-9]{15}$/

type MusicModel = {
  id: string
  name: string
  description?: string
  durationHint?: string
  priceHint?: string
}

type ApiPayload = {
  source?: string
  models?: MusicModel[]
  defaultModelId?: string
  notice?: string
}

type UiPhase = 'form' | 'generating' | 'complete'

const toast = useToast()
const { getAuthToken, initAuth } = useAuth()
const { projects, loadServerProjects, clientReady, registerImportedProject } = useCreativeProject()

const { data, pending, error: fetchError } = await useFetch<ApiPayload>('/api/openrouter/music-models')

const models = computed(() => data.value?.models ?? [])
const selectedModelId = ref(data.value?.defaultModelId || DEFAULT_MUSIC_MODEL_ID)
const selectedModel = computed(() => models.value.find(m => m.id === selectedModelId.value))

const prompt = ref('')
const instrumental = ref(true)
const lyrics = ref('')
const bpm = ref<number | null>(null)
const stylePresets = MUSIC_STYLE_PRESETS

const uiPhase = ref<UiPhase>('form')
const generating = ref(false)
const saving = ref(false)
const discarding = ref(false)
const formError = ref('')

const playbackUrl = ref('')
const resultModel = ref('')
const transcript = ref('')
const savedAssetId = ref('')
const savedProjectId = ref('')

const saveToProject = ref(true)
const addToTimeline = ref(true)
const selectedProjectId = ref('')

const showCreateProject = ref(false)
const creatingProject = ref(false)
const createProjectError = ref('')
const createProjectForm = reactive({ name: '' })

const pbProjects = computed(() =>
  projects.value.filter((p: CreativeProject) => PB_ID.test(p.id))
)

const saveButtonLabel = computed(() => {
  if (!saveToProject.value) return 'Done'
  return addToTimeline.value ? 'Save & add to timeline' : 'Save to project'
})

watch([pbProjects, clientReady], () => {
  if (!selectedProjectId.value && pbProjects.value.length) {
    selectedProjectId.value = pbProjects.value[0].id
  }
}, { immediate: true })

onMounted(async () => {
  await initAuth()
  await loadServerProjects()
})

function applyPreset (preset: (typeof stylePresets)[number]) {
  prompt.value = preset.text
}

function playbackSrc (url: string): string {
  return appendPlaybackAccessToken(url.trim(), getAuthToken())
}

function openCreateProjectModal () {
  createProjectForm.name = ''
  createProjectError.value = ''
  showCreateProject.value = true
}

function closeCreateProjectModal () {
  if (creatingProject.value) return
  showCreateProject.value = false
}

async function submitCreateProject () {
  createProjectError.value = ''
  const token = getAuthToken()
  if (!token) {
    createProjectError.value = 'Sign in to create a cloud project.'
    return
  }
  creatingProject.value = true
  try {
    const res = await $fetch<{ project: CreativeProject }>('/api/projects/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: createProjectForm.name.trim() || 'New project',
        aspectRatio: '16:9',
        goal: 'film',
        workflowMode: 'idea'
      }
    })
    writeSessionWorkflow(res.project.id, res.project.workflowMode || 'idea')
    registerImportedProject(res.project)
    selectedProjectId.value = res.project.id
    saveToProject.value = true
    showCreateProject.value = false
    toast.showToast(`“${res.project.name}” created and selected.`, 'success')
  } catch (e: unknown) {
    createProjectError.value = formatApiFetchError(e, 'Could not create project.')
  } finally {
    creatingProject.value = false
  }
}

async function onSubmit () {
  formError.value = ''
  if (!prompt.value.trim()) {
    formError.value = 'Enter a prompt describing the music you want.'
    return
  }
  if (saveToProject.value && !selectedProjectId.value) {
    formError.value = 'Select a project to save to, or turn off “Save to project library”.'
    return
  }

  generating.value = true
  uiPhase.value = 'generating'
  playbackUrl.value = ''
  transcript.value = ''
  savedAssetId.value = ''

  try {
    const out = await generateOpenRouterMusic({
      prompt: prompt.value,
      model: selectedModelId.value,
      instrumental: instrumental.value,
      lyrics: lyrics.value,
      bpm: bpm.value
    })
    playbackUrl.value = out.playbackUrl
    resultModel.value = out.model
    transcript.value = out.transcript || ''
    uiPhase.value = 'complete'
  } catch (e: unknown) {
    formError.value = formatApiFetchError(e, 'Music generation failed.')
    uiPhase.value = 'form'
  } finally {
    generating.value = false
  }
}

async function saveTrack () {
  formError.value = ''
  if (!playbackUrl.value) return

  if (!saveToProject.value) {
    uiPhase.value = 'form'
    playbackUrl.value = ''
    toast.showToast('Ready to generate another track.', 'success')
    return
  }

  const projectId = selectedProjectId.value.trim()
  if (!PB_ID.test(projectId)) {
    formError.value = 'Select a valid project.'
    return
  }

  const token = getAuthToken()
  if (!token) {
    formError.value = 'Sign in to save to a project.'
    return
  }

  saving.value = true
  try {
    const title = prompt.value.trim().slice(0, 80) || 'Generated music'
    const asset = await saveMusicToProjectLibrary({
      projectId,
      playbackUrl: playbackUrl.value,
      title,
      notes: `Lyria · ${resultModel.value || selectedModelId.value}`,
      metadata: {
        model: resultModel.value || selectedModelId.value,
        prompt: prompt.value.trim(),
        instrumental: instrumental.value
      },
      headers: { Authorization: `Bearer ${token}` }
    })

    if (!asset?.id) {
      throw new Error('Could not save track to project library.')
    }

    savedAssetId.value = asset.id
    savedProjectId.value = projectId

    let timelineUrl = playbackUrlForProjectMusicAsset(projectId, asset.id)
    timelineUrl = appendPlaybackAccessToken(timelineUrl, token)

    if (addToTimeline.value) {
      appendAudioToProjectTimeline(projectId, {
        url: timelineUrl,
        label: title,
        duration: selectedModelId.value.includes('pro') ? 120 : 30
      })
    }

    toast.showToast(
      addToTimeline.value ? 'Track saved and added to timeline.' : 'Track saved to project.',
      'success'
    )
    uiPhase.value = 'form'
    playbackUrl.value = ''
  } catch (e: unknown) {
    formError.value = formatApiFetchError(e, 'Could not save track.')
  } finally {
    saving.value = false
  }
}

function discardAndRetry () {
  discarding.value = true
  playbackUrl.value = ''
  transcript.value = ''
  formError.value = ''
  uiPhase.value = 'form'
  discarding.value = false
}

useHead({ title: 'Music generation' })
</script>
