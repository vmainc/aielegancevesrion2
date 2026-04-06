<template>
  <div class="max-w-3xl">
    <p class="text-sm text-gray-500 mb-6">
      <span class="text-primary font-medium">Step 2 of 5</span>
      · Creative bible and continuity — separate from story drafting.
    </p>

    <h2 class="text-lg font-semibold text-gray-900 mb-3">Director bible</h2>
    <p class="text-sm text-gray-500 mb-4">
      Used for shot generation and future tools. Pick a preset, then refine.
    </p>
    <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6 mb-8 space-y-4">
      <div>
        <label for="dir-preset" class="block text-sm text-gray-600 mb-1">Preset</label>
        <select
          id="dir-preset"
          v-model="selectedPresetId"
          class="w-full max-w-md px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
          @change="onPresetChange"
        >
          <option
            v-for="p in DIRECTOR_PRESETS"
            :key="p.id"
            :value="p.id"
          >
            {{ p.label }}
          </option>
        </select>
      </div>
      <div>
        <label for="dir-name" class="block text-sm text-gray-600 mb-1">Name</label>
        <input
          id="dir-name"
          v-model="directorForm.name"
          type="text"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary"
          placeholder="e.g. Documentary vérité"
        >
      </div>
      <div>
        <div class="flex justify-between items-center gap-2 mb-1">
          <label for="dir-style" class="text-sm text-gray-600">Style</label>
          <PromptEnhanceButton v-model="directorForm.style" context="director" field-hint="Style" />
        </div>
        <textarea
          id="dir-style"
          v-model="directorForm.style"
          rows="2"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>
      <div>
        <div class="flex justify-between items-center gap-2 mb-1">
          <label for="dir-tone" class="text-sm text-gray-600">Tone</label>
          <PromptEnhanceButton v-model="directorForm.tone" context="director" field-hint="Tone" />
        </div>
        <textarea
          id="dir-tone"
          v-model="directorForm.tone"
          rows="2"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>
      <div>
        <div class="flex justify-between items-center gap-2 mb-1">
          <label for="dir-cam" class="text-sm text-gray-600">Camera preferences</label>
          <PromptEnhanceButton v-model="directorForm.camera_preferences" context="director" field-hint="Camera preferences" />
        </div>
        <textarea
          id="dir-cam"
          v-model="directorForm.camera_preferences"
          rows="2"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>
      <div>
        <div class="flex justify-between items-center gap-2 mb-1">
          <label for="dir-light" class="text-sm text-gray-600">Lighting style</label>
          <PromptEnhanceButton v-model="directorForm.lighting_style" context="director" field-hint="Lighting style" />
        </div>
        <textarea
          id="dir-light"
          v-model="directorForm.lighting_style"
          rows="2"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>
      <div>
        <div class="flex justify-between items-center gap-2 mb-1">
          <label for="dir-pace" class="text-sm text-gray-600">Pacing</label>
          <PromptEnhanceButton v-model="directorForm.pacing" context="director" field-hint="Pacing" />
        </div>
        <textarea
          id="dir-pace"
          v-model="directorForm.pacing"
          rows="2"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
        />
      </div>
      <div>
        <div class="flex justify-between items-start gap-2 mb-1">
          <label for="continuity-mem" class="text-sm text-gray-600">Continuity memory</label>
          <PromptEnhanceButton v-model="continuityMemLocal" context="continuity" field-hint="Continuity memory" />
        </div>
        <p class="text-xs text-gray-600 mb-2">Character traits, key events, tone rules. AI may append notes after shot generation.</p>
        <textarea
          id="continuity-mem"
          v-model="continuityMemLocal"
          rows="5"
          class="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
          placeholder="e.g. Leo has a scar over left brow. The diner is always at night in rain."
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="px-4 py-2 bg-primary hover:bg-primary/90 text-gray-950 font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          :disabled="savingDirector"
          @click="saveDirectorBlock"
        >
          {{ savingDirector ? 'Saving…' : 'Save director & continuity' }}
        </button>
      </div>
    </div>

    <h2 class="text-lg font-semibold text-gray-900 mb-3">Continuity warnings</h2>
    <p class="text-sm text-gray-500 mb-4">
      Output from the last shot-generation continuity pass (Claude via OpenRouter). Cleared when you remove text below.
    </p>
    <div class="rounded-xl border border-gray-200 bg-gray-100 p-5 mb-8">
      <p
        v-if="!(project?.continuityLastIssues || '').trim()"
        class="text-sm text-gray-500"
      >
        No report yet — generate shots on the Storyboard tab to run a continuity check.
      </p>
      <pre
        v-else
        class="text-sm text-amber-900 whitespace-pre-wrap font-sans leading-relaxed"
      >{{ project?.continuityLastIssues }}</pre>
      <button
        v-if="(project?.continuityLastIssues || '').trim()"
        type="button"
        class="mt-4 text-sm text-gray-600 hover:text-gray-800 underline"
        @click="clearContinuityWarnings"
      >
        Clear warnings
      </button>
    </div>

    <div class="flex flex-wrap gap-3 pt-2">
      <NuxtLink
        :to="`/projects/${projectId}/overview`"
        class="text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        ← Overview
      </NuxtLink>
      <NuxtLink
        :to="`/projects/${projectId}/story`"
        class="px-4 py-2 border border-primary/40 text-primary hover:bg-primary/10 rounded-lg text-sm font-medium transition-colors inline-flex items-center"
      >
        Continue to Story →
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DIRECTOR_PRESETS, defaultDirector, presetToDirector } from '~/lib/director-presets'
import type { ProjectDirector } from '~/types/creative-project'

const { activeProject, activeProjectId, updateProject } = useCreativeProject()
const toast = useToast()

const projectId = activeProjectId
const project = activeProject

const continuityMemLocal = ref('')
const directorForm = reactive<ProjectDirector>(defaultDirector())
const selectedPresetId = ref('custom')
const savingDirector = ref(false)

watch(project, (p) => {
  if (!p) return
  continuityMemLocal.value = p.continuityMemory ?? ''
  Object.assign(directorForm, defaultDirector(), p.director ?? {})
  selectedPresetId.value = 'custom'
}, { immediate: true })

function onPresetChange () {
  Object.assign(directorForm, presetToDirector(selectedPresetId.value))
}

async function saveDirectorBlock () {
  const id = projectId.value
  if (!id) return
  savingDirector.value = true
  try {
    await updateProject(id, {
      director: { ...directorForm },
      continuityMemory: continuityMemLocal.value
    })
    toast.showToast('Director & continuity saved.', 'success')
  } catch {
    toast.showToast('Save failed.', 'error')
  } finally {
    savingDirector.value = false
  }
}

async function clearContinuityWarnings () {
  const id = projectId.value
  if (!id) return
  try {
    await updateProject(id, { continuityLastIssues: '' })
    toast.showToast('Warnings cleared.', 'info')
  } catch {
    toast.showToast('Could not clear.', 'error')
  }
}
</script>
