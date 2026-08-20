<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8">
      <h1 class="font-display text-3xl sm:text-4xl text-ivory tracking-wide mb-2">Adapt to Film</h1>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl">
        Turn a transcript, story, or article into a film treatment → scenes → shots → production plan.
      </p>
      <p class="mt-3 text-sm text-gray-500">
        Have audio instead?
        <NuxtLink to="/tools/speech-to-text" class="text-primary font-medium hover:underline">
          Speech to Text
        </NuxtLink>
      </p>
    </div>

    <form class="space-y-6" @submit.prevent="onSubmit">
      <section class="rounded-xl border border-gray-200 bg-studio-slate p-5 sm:p-6 space-y-4">
        <div>
          <label for="adapt-project-title" class="block text-sm font-medium text-gray-700 mb-1.5">
            Project title
          </label>
          <input
            id="adapt-project-title"
            v-model="projectTitle"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
            placeholder="Working title for the film project"
            autocomplete="off"
          >
        </div>

        <div>
          <label for="adapt-source-title" class="block text-sm font-medium text-gray-700 mb-1.5">
            Source title
          </label>
          <input
            id="adapt-source-title"
            v-model="sourceTitle"
            type="text"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
            placeholder="Title of the source material"
            autocomplete="off"
          >
        </div>

        <div>
          <label for="adapt-source-type" class="block text-sm font-medium text-gray-700 mb-1.5">
            Source type
          </label>
          <select
            id="adapt-source-type"
            v-model="sourceType"
            class="w-full sm:w-72 px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
          >
            <option
              v-for="opt in ADAPT_SOURCE_TYPES"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div>
          <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <label for="adapt-source-text" class="text-sm font-medium text-gray-700">
              Source text
            </label>
            <span class="text-xs text-gray-500">
              {{ wordCount.toLocaleString() }} words · {{ charCount.toLocaleString() }} characters
            </span>
          </div>
          <textarea
            id="adapt-source-text"
            v-model="sourceText"
            rows="14"
            class="w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary resize-y min-h-[14rem] leading-relaxed"
            placeholder="Paste transcript, story, article, or concept notes…"
          />
          <div class="mt-2 flex flex-wrap items-center gap-3">
            <label class="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <span class="font-medium text-primary">Upload .txt</span>
              <input
                type="file"
                accept=".txt,text/plain"
                class="sr-only"
                @change="onTxtUpload"
              >
            </label>
            <span v-if="uploadedFilename" class="text-xs text-gray-500 truncate max-w-[14rem]">
              {{ uploadedFilename }}
            </span>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="adapt-author" class="block text-sm font-medium text-gray-700 mb-1.5">
              Author <span class="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="adapt-author"
              v-model="sourceAuthor"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
              autocomplete="off"
            >
          </div>
          <div>
            <label for="adapt-date" class="block text-sm font-medium text-gray-700 mb-1.5">
              Date <span class="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id="adapt-date"
              v-model="sourceDate"
              type="text"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. 1943 or March 2024"
              autocomplete="off"
            >
          </div>
        </div>

        <div>
          <label for="adapt-notes" class="block text-sm font-medium text-gray-700 mb-1.5">
            Notes <span class="font-normal text-gray-500">(optional)</span>
          </label>
          <textarea
            id="adapt-notes"
            v-model="sourceNotes"
            rows="3"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 bg-studio-slate text-gray-900 text-sm focus:outline-none focus:border-primary resize-y"
            placeholder="Rights notes, context, or adaptation goals…"
          />
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          class="px-5 py-2.5 rounded-lg bg-primary text-gray-950 text-sm font-semibold hover:bg-primary/90 disabled:opacity-45 disabled:cursor-not-allowed"
          :disabled="submitting"
        >
          {{ submitting ? 'Creating…' : 'Create Film Project' }}
        </button>
        <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import {
  ADAPT_SOURCE_TYPES,
  countWords,
  validateAdaptSourceText
} from '~/lib/adapt-to-film'
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import { writeSessionWorkflow } from '~/lib/project-workflow-mode'
import type { AdaptSourceType } from '~/types/adapt-to-film'
import type { CreativeProject } from '~/types/creative-project'

definePageMeta({ ssr: false })

const { getAuthToken } = useAuth()
const { registerImportedProject } = useCreativeProject()
const toast = useToast()

const projectTitle = ref('')
const sourceTitle = ref('')
const sourceType = ref<AdaptSourceType>('transcript')
const sourceText = ref('')
const sourceAuthor = ref('')
const sourceDate = ref('')
const sourceNotes = ref('')
const uploadedFilename = ref('')
const formError = ref('')
const submitting = ref(false)

const wordCount = computed(() => countWords(sourceText.value))
const charCount = computed(() => sourceText.value.length)

function onTxtUpload (ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    sourceText.value = String(reader.result || '')
    uploadedFilename.value = file.name
    if (!sourceTitle.value.trim()) {
      sourceTitle.value = file.name.replace(/\.txt$/i, '')
    }
  }
  reader.onerror = () => {
    formError.value = 'Could not read that text file.'
  }
  reader.readAsText(file)
  input.value = ''
}

async function onSubmit () {
  formError.value = ''
  const err = validateAdaptSourceText(sourceText.value)
  if (err) {
    formError.value = err
    return
  }
  const token = getAuthToken()
  if (!token) {
    formError.value = 'Sign in to create a film project.'
    return
  }

  submitting.value = true
  try {
    const res = await $fetch<{
      project: CreativeProject
      landingPath?: string
    }>('/api/adapt-to-film/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        projectTitle: projectTitle.value.trim() || undefined,
        sourceTitle: sourceTitle.value.trim() || undefined,
        sourceType: sourceType.value,
        sourceText: sourceText.value,
        sourceAuthor: sourceAuthor.value.trim() || undefined,
        sourceDate: sourceDate.value.trim() || undefined,
        sourceNotes: sourceNotes.value.trim() || undefined,
        originalFilename: uploadedFilename.value || undefined
      }
    })
    registerImportedProject(res.project)
    writeSessionWorkflow(res.project.id, 'adapt')
    toast.showToast('Film project created.', 'success')
    await navigateTo(res.landingPath || `/projects/${res.project.id}/adapt`)
  } catch (e: unknown) {
    const msg = formatApiFetchError(e, 'Could not create film project')
    formError.value = msg
    toast.showToast(msg, 'error')
  } finally {
    submitting.value = false
  }
}
</script>
