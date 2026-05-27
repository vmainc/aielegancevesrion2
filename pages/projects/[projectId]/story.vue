<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">{{ stepBadge || 'Step —' }}</span>
      · Script, treatment, and writing — separate from the Director bible tab.
    </p>

    <div
      v-if="!activeProject"
      class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      Open a project from the workflow to use this step.
    </div>

    <template v-else>
      <div class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 sm:p-6 mb-8">
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
          How long is this piece?
        </h2>
        <p class="text-sm text-gray-600 mb-4">
          Sets the scale for AI-generated script and treatment (e.g. a music video vs a short film vs a feature).
        </p>
        <label class="block text-sm font-medium text-gray-700 mb-2" for="target-length">Target length</label>
        <select
          id="target-length"
          v-model="lengthModel"
          :disabled="savingLength || !canPersist"
          class="w-full max-w-md px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary disabled:opacity-50"
          @change="onLengthChange"
        >
          <option
            v-for="opt in lengthOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }} — {{ opt.hint }}
          </option>
        </select>
        <p v-if="!canPersist" class="mt-2 text-xs text-amber-800">
          Sign in and open a cloud project to sync length to your account. Local-only projects still use this choice for display until you save online.
        </p>
        <div
          v-if="showStandaloneRuntimeField"
          class="mt-4 pt-4 border-t border-gray-200"
        >
          <label for="target-duration-sec" class="block text-sm font-medium text-gray-700 mb-1">
            Exact runtime (seconds)
          </label>
          <p class="text-xs text-gray-500 mb-2">
            Optional hard cap — storyboard panels and scenes stay within this total (e.g. 90).
          </p>
          <ClientOnly>
            <input
              id="target-duration-sec"
              v-model="targetDurationSeconds"
              type="number"
              min="15"
              max="3600"
              step="5"
              class="w-full max-w-[12rem] px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm"
              :disabled="savingLength || !canPersist"
              placeholder="90"
              @input="onTargetDurationInput"
              @change="onDurationSecondsChange"
            >
            <template #fallback>
              <div class="w-full max-w-[12rem] h-10 rounded-lg bg-gray-100 border border-gray-200" />
            </template>
          </ClientOnly>
        </div>
      </div>

      <StoryIdeaGeneratorPanel
        v-if="showStoryIdeaGenerator"
        ref="storyIdeaGeneratorRef"
        class="mb-8"
        :project-id="activeProject.id"
        :goal="activeProject.goal || 'film'"
        :aspect-ratio="activeProject.aspectRatio || '16:9'"
        heading="Generate story ideas"
        subheading="Describe your idea, set target runtime, compare AI models, then save one as your synopsis."
        apply-label="Use this story"
        @apply="onStoryIdeaApply"
      />

      <div
        class="rounded-xl border border-primary/25 bg-primary/5 p-5 sm:p-6 mb-8"
      >
        <h2 class="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
          Story synopsis
        </h2>
        <p class="text-xs text-gray-600 mb-3">
          Used when you generate script or treatment below. Edit on
          <NuxtLink :to="`/projects/${projectId}/overview`" class="text-primary font-medium hover:underline">Overview</NuxtLink>.
        </p>
        <div
          v-if="storySynopsisDisplay"
          class="text-sm text-gray-800 whitespace-pre-wrap max-h-[min(50vh,24rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 leading-relaxed"
        >
          {{ storySynopsisDisplay }}
        </div>
        <p v-else class="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          No synopsis yet. Add your idea on Overview (or import a script) before generating here.
        </p>
        <p v-if="lengthModel === 'music_video'" class="mt-3 text-xs text-gray-600">
          Music video: generated clips are video-only (no AI soundtrack). Add your track in the timeline.
        </p>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 mb-3">Treatment &amp; script</h2>
        <p class="text-sm text-gray-500 mb-4">
          Generate a prose treatment or a screenplay draft from the synopsis above, director notes, and target length.
          If you imported a script, the Treatment field already holds
          <span class="font-medium text-gray-700">comparable films</span> and
          <span class="font-medium text-gray-700">theme exploration</span> — you can read it below or run “Generate treatment” to replace it.
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="generateDisabled || generatingKind === 'script'"
            @click="runGenerate('script')"
          >
            {{ generatingKind === 'script' ? 'Generating…' : 'Generate script' }}
          </button>
          <button
            type="button"
            class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="generateDisabled || generatingKind === 'treatment'"
            @click="runGenerate('treatment')"
          >
            {{ generatingKind === 'treatment' ? 'Generating…' : 'Generate treatment' }}
          </button>
        </div>
        <p v-if="generateDisabled && activeProject" class="mt-3 text-sm text-amber-800">
          Cloud project required for AI generation. Sign in and open a project saved to your account.
        </p>
      </div>

      <div
        v-if="activeProject.treatment || activeProject.conceptNotes"
        class="mt-8 border-t border-gray-200 pt-6"
      >
        <h3 class="text-sm font-semibold text-gray-900 mb-2">Treatment &amp; working notes</h3>
        <template v-if="activeProject.treatment">
          <p class="text-xs text-gray-500 mb-2">
            {{
              projectStorySatisfiedByScriptImport(activeProject)
                ? 'Import analysis (comparable films + themes) — full text below'
                : 'Treatment preview'
            }}
          </p>
          <details v-if="activeProject.treatment.length > 360" class="mb-4 group">
            <summary class="cursor-pointer text-sm font-medium text-primary hover:underline">
              <span class="group-open:hidden">Show full treatment</span>
              <span class="hidden group-open:inline">Hide full treatment</span>
            </summary>
            <div
              class="mt-3 text-sm text-gray-800 whitespace-pre-wrap max-h-[min(75vh,36rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 leading-relaxed"
            >
              {{ activeProject.treatment }}
            </div>
          </details>
          <p
            v-else
            class="text-sm text-gray-700 whitespace-pre-wrap mb-4"
          >
            {{ activeProject.treatment }}
          </p>
        </template>
        <template v-if="activeProject.conceptNotes">
          <p class="text-xs text-gray-500 mb-1">Working script / notes (preview)</p>
          <p class="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap mb-2">{{ activeProject.conceptNotes.slice(0, 360) }}{{ activeProject.conceptNotes.length > 360 ? '…' : '' }}</p>
        </template>
      </div>
    </template>

    <div class="mt-10 pt-8 border-t border-gray-200 flex flex-wrap gap-4">
      <NuxtLink
        :to="`/projects/${projectId}/director`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Director
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/characters`"
        class="text-sm text-primary font-medium hover:underline"
      >
        Next: Characters →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatStoredConceptNotes, stripConceptMetadataMarkers } from '~/lib/format-stored-concept'
import { stripWorkflowMarker } from '~/lib/project-workflow-mode'
import { projectStorySatisfiedByScriptImport } from '~/lib/project-workflow'
import { TARGET_LENGTH_OPTIONS } from '~/lib/target-length'
import type { StoryIdeaApplyPayload } from '~/components/story/StoryIdeaGeneratorPanel.vue'
import type { CreativeProject, ProjectTargetLength } from '~/types/creative-project'

const { activeProjectId, activeProject, updateProject, registerImportedProject } = useCreativeProject()
const { stepBadge } = useProjectWorkflowStep()

watch(
  () => activeProject.value,
  (p) => {
    if (!import.meta.client || !p) return
    if (projectStorySatisfiedByScriptImport(p)) {
      const id = activeProjectId.value
      if (id) void navigateTo(`/projects/${id}/characters`, { replace: true })
    }
  },
  { immediate: true }
)
const { getAuthToken, isAuthenticated } = useAuth()
const toast = useToast()

const projectId = activeProjectId
const lengthOptions = TARGET_LENGTH_OPTIONS

const lengthModel = ref<ProjectTargetLength>('short')
const savingLength = ref(false)
const generatingKind = ref<'script' | 'treatment' | null>(null)
const storyIdeaGeneratorRef = ref<{ clearApplying: () => void; clearResults: () => void } | null>(null)

const PB_ID = /^[a-z0-9]{15}$/

const {
  targetDurationSeconds,
  onTargetDurationInput,
  persistTargetDuration
} = useProjectTargetDuration(projectId)

const scratchWorkflow = computed(
  () => activeProject.value?.workflowMode === 'scratch'
)

const showStoryIdeaGenerator = computed(
  () => scratchWorkflow.value && Boolean(activeProject.value?.id) && canPersist.value
)

/** Runtime field in “How long” block when idea generator is hidden (import workflow, etc.). */
const showStandaloneRuntimeField = computed(
  () =>
    !showStoryIdeaGenerator.value &&
    (lengthModel.value === 'spot' ||
      activeProject.value?.goal === 'social' ||
      activeProject.value?.goal === 'commercial')
)

const canPersist = computed(
  () => isAuthenticated.value && PB_ID.test(activeProject.value?.id || '')
)

const generateDisabled = computed(() => {
  const p = activeProject.value
  if (!p) return true
  if (!isAuthenticated.value) return true
  if (!PB_ID.test(p.id)) return true
  return false
})

const storySynopsisDisplay = computed(() => {
  const p = activeProject.value
  if (!p) return ''
  const syn = (p.synopsis || '').trim()
  if (syn) return syn
  const notes = stripConceptMetadataMarkers(stripWorkflowMarker(p.conceptNotes || '')).trim()
  return notes
})

watch(
  () => activeProject.value?.targetLength,
  (v) => {
    if (v && ['spot', 'short', 'music_video', 'episode', 'feature'].includes(v)) {
      lengthModel.value = v
    }
  },
  { immediate: true }
)

async function onDurationSecondsChange () {
  if (!canPersist.value) return
  savingLength.value = true
  const ok = await persistTargetDuration()
  savingLength.value = false
  if (ok) toast.showToast('Runtime saved.', 'success')
}

async function onStoryIdeaApply (payload: StoryIdeaApplyPayload) {
  const p = activeProject.value
  if (!p || !canPersist.value) {
    storyIdeaGeneratorRef.value?.clearApplying()
    return
  }
  const { item } = payload
  try {
    const conceptNotes = formatStoredConceptNotes({
      title: item.title,
      logline: item.logline,
      modelId: item.model,
      modelLabel: item.model,
      characters: item.characters
    })
    const synopsis = (item.summary || item.logline || '').trim()
    await updateProject(p.id, {
      name: item.title.slice(0, 500),
      synopsis,
      genre: item.genre || undefined,
      tone: item.tone || undefined,
      conceptNotes,
      goal: payload.goal,
      aspectRatio: payload.aspectRatio,
      ...(item.director ? { director: item.director } : {})
    })
    storyIdeaGeneratorRef.value?.clearResults()
    toast.showToast('Story saved — generate script or treatment below.', 'success')
  } catch {
    toast.showToast('Could not save story.', 'error')
  } finally {
    storyIdeaGeneratorRef.value?.clearApplying()
  }
}

async function onLengthChange () {
  const p = activeProject.value
  if (!p) return
  if (!canPersist.value) {
    await updateProject(p.id, { targetLength: lengthModel.value })
    return
  }
  savingLength.value = true
  try {
    await updateProject(p.id, { targetLength: lengthModel.value })
    toast.showToast('Target length saved.', 'success')
  } catch {
    toast.showToast('Could not save length.', 'error')
  } finally {
    savingLength.value = false
  }
}

async function runGenerate (kind: 'script' | 'treatment') {
  const p = activeProject.value
  const token = getAuthToken()
  if (!p || !token || !PB_ID.test(p.id)) {
    toast.showToast('Sign in with a cloud project to generate.', 'info')
    return
  }
  generatingKind.value = kind
  try {
    const res = await $fetch<{ project: CreativeProject }>('/api/projects/generate-story-text', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { projectId: p.id, kind }
    })
    toast.showToast(kind === 'script' ? 'Script draft saved to working notes.' : 'Treatment saved.', 'success')
    registerImportedProject(res.project)
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'data' in e
        ? String((e as { data?: { message?: string } }).data?.message || 'Generation failed')
        : 'Generation failed'
    toast.showToast(msg, 'error')
  } finally {
    generatingKind.value = null
  }
}
</script>
