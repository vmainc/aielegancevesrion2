<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Speech to Text</h1>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl">
        Upload an MP3 or WAV recording and convert the spoken audio into a readable transcript.
      </p>
    </div>

    <div
      v-if="!isAuthenticated"
      class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-6"
    >
      <NuxtLink to="/login?redirect=/tools/speech-to-text" class="font-semibold text-primary hover:underline">
        Sign in
      </NuxtLink>
      to transcribe audio.
    </div>

    <template v-else>
      <!-- Upload + options -->
      <section
        v-if="uiPhase === 'form'"
        class="space-y-6"
        aria-labelledby="stt-upload-heading"
      >
        <div>
          <h2 id="stt-upload-heading" class="sr-only">Upload audio</h2>
          <div
            class="rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
            :class="dragActive
              ? 'border-primary bg-primary/5'
              : fileError
                ? 'border-red-300 bg-red-50/40'
                : 'border-gray-300 bg-gray-50/60'"
            @dragenter.prevent="dragActive = true"
            @dragover.prevent="dragActive = true"
            @dragleave.prevent="dragActive = false"
            @drop.prevent="onDrop"
          >
            <input
              id="stt-file"
              ref="fileInputEl"
              type="file"
              class="sr-only"
              :accept="acceptAttr"
              @change="onFileInput"
            >
            <label
              for="stt-file"
              class="cursor-pointer inline-flex flex-col items-center gap-2"
            >
              <span class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-200 text-primary" aria-hidden="true">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </span>
              <span class="text-sm font-medium text-gray-900">
                Drop an audio file here, or <span class="text-primary">browse</span>
              </span>
              <span class="text-xs text-gray-500">
                MP3, WAV, M4A, WebM · max {{ maxMb }} MB
              </span>
            </label>

            <div
              v-if="selectedFile"
              class="mt-5 mx-auto max-w-md rounded-lg border border-gray-200 bg-white px-4 py-3 text-left"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 truncate">{{ selectedFile.name }}</p>
                  <p class="text-xs text-gray-500 mt-0.5">{{ formatSpeechToTextBytes(selectedFile.size) }}</p>
                </div>
                <button
                  type="button"
                  class="text-xs font-medium text-gray-600 hover:text-red-700 shrink-0"
                  @click="clearFile"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
          <p
            v-if="fileError"
            id="stt-file-error"
            class="mt-2 text-sm text-red-700"
            role="alert"
          >
            {{ fileError }}
          </p>
        </div>

        <fieldset class="rounded-xl border border-gray-200 bg-white p-5 space-y-5">
          <legend class="px-1 text-sm font-semibold text-gray-900">Transcript options</legend>

          <div>
            <p class="text-sm font-medium text-gray-800 mb-2" id="stt-style-label">Transcription style</p>
            <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="stt-style-label">
              <label
                class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer"
                :class="style === 'verbatim' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'"
              >
                <input v-model="style" type="radio" value="verbatim" class="mt-1 text-primary focus:ring-primary">
                <span>
                  <span class="block text-sm font-medium text-gray-900">Verbatim</span>
                  <span class="block text-xs text-gray-500 mt-0.5">Keeps fillers, repetitions, and original wording.</span>
                </span>
              </label>
              <label
                class="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer"
                :class="style === 'cleaned' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:bg-gray-50'"
              >
                <input v-model="style" type="radio" value="cleaned" class="mt-1 text-primary focus:ring-primary">
                <span>
                  <span class="block text-sm font-medium text-gray-900">Cleaned</span>
                  <span class="block text-xs text-gray-500 mt-0.5">Removes obvious fillers and improves punctuation.</span>
                </span>
              </label>
            </div>
          </div>

          <div>
            <label for="stt-language" class="block text-sm font-medium text-gray-800 mb-1.5">Language</label>
            <select
              id="stt-language"
              v-model="language"
              class="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary bg-white"
            >
              <option
                v-for="opt in languageOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
          </div>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input
              v-model="speakerLabels"
              type="checkbox"
              class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
            >
            <span>
              <span class="block text-sm font-medium text-gray-900">
                Speaker labels
                <span class="ml-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Experimental</span>
              </span>
              <span class="block text-xs text-gray-500 mt-0.5">
                Attempt to label different speakers. Accuracy varies with overlap and audio quality.
              </span>
            </span>
          </label>

          <label class="flex items-start gap-2.5 cursor-pointer">
            <input
              v-model="timestamps"
              type="checkbox"
              class="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
            >
            <span>
              <span class="block text-sm font-medium text-gray-900">Timestamps</span>
              <span class="block text-xs text-gray-500 mt-0.5">
                Include segment timestamps in the editable transcript and enable SRT download.
              </span>
            </span>
          </label>
        </fieldset>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="px-5 py-2.5 rounded-lg bg-primary text-gray-950 text-sm font-semibold hover:bg-primary/90 disabled:opacity-45 disabled:cursor-not-allowed"
            :disabled="!canSubmit"
            @click="startTranscription"
          >
            Transcribe Audio
          </button>
          <p v-if="formError" class="text-sm text-red-700" role="alert">{{ formError }}</p>
        </div>
      </section>

      <!-- Processing -->
      <section
        v-else-if="uiPhase === 'processing'"
        class="rounded-xl border border-gray-200 bg-white shadow-sm px-5 py-10"
        aria-live="polite"
        aria-busy="true"
      >
        <FilmReelLoader
          size="md"
          :label="processingLabel"
          :sub-label="processingSub"
        />
        <p class="mt-6 text-center text-sm text-gray-500 max-w-md mx-auto">
          Longer recordings may take a few minutes. Keep this tab open — we’ll update the status as work progresses.
        </p>
      </section>

      <!-- Results -->
      <section
        v-else
        class="space-y-5"
        aria-labelledby="stt-results-heading"
      >
        <div class="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="stt-results-heading" class="text-lg font-semibold text-gray-900">Transcript</h2>
              <p class="text-xs text-gray-500 mt-1">
                {{ resultMetaLine }}
              </p>
            </div>
            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              :class="resultFailed
                ? 'bg-red-50 text-red-800 border border-red-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'"
            >
              {{ resultFailed ? 'Failed' : 'Completed' }}
            </span>
          </div>

          <p
            v-if="resultWarnings.length"
            class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
          >
            {{ resultWarnings.join(' ') }}
          </p>

          <p
            v-if="resultFailed"
            class="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            role="alert"
          >
            {{ resultError || 'Transcription failed.' }}
          </p>

          <template v-else>
            <label for="stt-transcript" class="sr-only">Editable transcript</label>
            <textarea
              id="stt-transcript"
              v-model="editableTranscript"
              rows="16"
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-primary resize-y min-h-[16rem] leading-relaxed"
            />

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                @click="copyTranscript"
              >
                Copy Transcript
              </button>
              <button
                type="button"
                class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                @click="downloadTxt"
              >
                Download TXT
              </button>
              <button
                v-if="resultSrt"
                type="button"
                class="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                @click="downloadSrt"
              >
                Download SRT
              </button>
            </div>
          </template>

          <div class="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button
              v-if="resultFailed"
              type="button"
              class="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-gray-950 hover:bg-primary/90"
              @click="retryTranscription"
            >
              Retry
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
              @click="startOver"
            >
              Start Over
            </button>
          </div>
        </div>
      </section>

      <!-- Recent (local) -->
      <section
        v-if="history.length"
        class="mt-10"
        aria-labelledby="stt-history-heading"
      >
        <h2 id="stt-history-heading" class="text-sm font-semibold text-gray-900 mb-3">Recent Transcriptions</h2>
        <ul class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
          <li
            v-for="item in history"
            :key="item.id"
            class="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ item.filename }}</p>
              <p class="text-xs text-gray-500">
                {{ formatHistoryDate(item.createdAt) }}
                · {{ item.status }}
                <template v-if="item.wordCount"> · {{ item.wordCount }} words</template>
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                v-if="item.status === 'completed' && item.text"
                type="button"
                class="text-xs font-medium text-primary hover:underline"
                @click="openHistoryItem(item)"
              >
                Open
              </button>
              <button
                type="button"
                class="text-xs font-medium text-gray-500 hover:text-red-700"
                @click="deleteHistoryItem(item.id)"
              >
                Delete
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatApiFetchError } from '~/lib/format-api-fetch-error'
import {
  SPEECH_TO_TEXT_ACCEPT_EXTENSIONS,
  SPEECH_TO_TEXT_MAX_BYTES,
  countTranscriptWords,
  formatSpeechToTextBytes,
  formatSpeechToTextDuration,
  formatTranscriptWithTimestamps,
  loadSpeechToTextHistory,
  removeSpeechToTextHistory,
  upsertSpeechToTextHistory,
  validateSpeechToTextFileMeta,
  type SpeechToTextHistoryItem,
  type SpeechToTextLanguage,
  type SpeechToTextStyle
} from '~/lib/speech-to-text'

definePageMeta({ ssr: false })

const { isAuthenticated, getAuthToken, initAuth } = useAuth()
const toast = useToast()

const maxMb = Math.floor(SPEECH_TO_TEXT_MAX_BYTES / (1024 * 1024))
const acceptAttr = SPEECH_TO_TEXT_ACCEPT_EXTENSIONS.join(',')

const languageOptions: Array<{ value: SpeechToTextLanguage; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' }
]

const uiPhase = ref<'form' | 'processing' | 'results'>('form')
const dragActive = ref(false)
const selectedFile = ref<File | null>(null)
const fileError = ref('')
const formError = ref('')
const fileInputEl = ref<HTMLInputElement | null>(null)

const style = ref<SpeechToTextStyle>('cleaned')
const language = ref<SpeechToTextLanguage>('auto')
const speakerLabels = ref(false)
const timestamps = ref(false)

const processingPhase = ref<'uploading' | 'transcribing'>('uploading')
const submitting = ref(false)

const editableTranscript = ref('')
const resultFilename = ref('')
const resultDuration = ref<number | undefined>()
const resultWordCount = ref(0)
const resultSrt = ref('')
const resultWarnings = ref<string[]>([])
const resultFailed = ref(false)
const resultError = ref('')
const lastJobFile = ref<File | null>(null)

const history = ref<SpeechToTextHistoryItem[]>([])

const canSubmit = computed(
  () =>
    isAuthenticated.value &&
    !!selectedFile.value &&
    !fileError.value &&
    !submitting.value
)

const processingLabel = computed(() =>
  processingPhase.value === 'uploading' ? 'Uploading' : 'Transcribing'
)
const processingSub = computed(() =>
  processingPhase.value === 'uploading'
    ? 'Sending your audio securely…'
    : 'Converting speech into text…'
)

const resultMetaLine = computed(() => {
  const parts = [
    resultFilename.value || 'Audio',
    formatSpeechToTextDuration(resultDuration.value),
    resultWordCount.value ? `${resultWordCount.value} words` : ''
  ].filter(Boolean)
  return parts.join(' · ')
})

onMounted(async () => {
  await initAuth()
  history.value = loadSpeechToTextHistory()
})

function setSelectedFile (file: File | null) {
  selectedFile.value = file
  fileError.value = ''
  formError.value = ''
  if (!file) return
  const err = validateSpeechToTextFileMeta({
    filename: file.name,
    mime: file.type,
    size: file.size
  })
  if (err) {
    fileError.value = err
    selectedFile.value = null
  }
}

function clearFile () {
  selectedFile.value = null
  fileError.value = ''
  if (fileInputEl.value) fileInputEl.value.value = ''
}

function onFileInput (e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] || null
  setSelectedFile(file)
}

function onDrop (e: DragEvent) {
  dragActive.value = false
  const file = e.dataTransfer?.files?.[0] || null
  setSelectedFile(file)
}

function authHeaders (): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function pollJob (jobId: string): Promise<void> {
  const started = Date.now()
  const maxMs = 20 * 60 * 1000
  while (Date.now() - started < maxMs) {
    const res = await $fetch<{
      status: string
      phase?: string
      filename?: string
      message?: string
      result?: {
        text: string
        segments?: Array<{ start: number; end: number; text: string; speaker?: string }>
        durationSeconds?: number
        srt?: string
        warnings?: string[]
        wordCount?: number
      }
    }>(`/api/tools/speech-to-text/${encodeURIComponent(jobId)}`, {
      headers: authHeaders()
    })

    if (res.phase === 'uploading' || res.phase === 'transcribing') {
      processingPhase.value = res.phase
    }

    if (res.status === 'completed' && res.result) {
      const display = formatTranscriptWithTimestamps(
        res.result.text,
        (res.result.segments || []).map((s, i) => ({
          id: i,
          start: s.start,
          end: s.end,
          text: s.text,
          speaker: s.speaker
        })),
        timestamps.value
      )
      editableTranscript.value = display
      resultFilename.value = res.filename || selectedFile.value?.name || 'audio'
      resultDuration.value = res.result.durationSeconds
      resultWordCount.value = res.result.wordCount || countTranscriptWords(res.result.text)
      resultSrt.value = res.result.srt || ''
      resultWarnings.value = res.result.warnings || []
      resultFailed.value = false
      resultError.value = ''
      uiPhase.value = 'results'

      history.value = upsertSpeechToTextHistory(history.value, {
        id: jobId,
        filename: resultFilename.value,
        createdAt: new Date().toISOString(),
        status: 'completed',
        text: display,
        wordCount: resultWordCount.value,
        durationSeconds: resultDuration.value
      })
      return
    }

    if (res.status === 'failed') {
      resultFailed.value = true
      resultError.value = res.message || 'Transcription failed.'
      resultFilename.value = res.filename || selectedFile.value?.name || 'audio'
      editableTranscript.value = ''
      resultSrt.value = ''
      uiPhase.value = 'results'
      history.value = upsertSpeechToTextHistory(history.value, {
        id: jobId,
        filename: resultFilename.value,
        createdAt: new Date().toISOString(),
        status: 'failed',
        error: resultError.value
      })
      return
    }

    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Transcription timed out while waiting for the server.')
}

async function startTranscription () {
  if (!canSubmit.value || !selectedFile.value) return
  formError.value = ''
  submitting.value = true
  lastJobFile.value = selectedFile.value
  uiPhase.value = 'processing'
  processingPhase.value = 'uploading'

  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    fd.append(
      'options',
      JSON.stringify({
        style: style.value,
        language: language.value,
        speakerLabels: speakerLabels.value,
        timestamps: timestamps.value
      })
    )

    const start = await $fetch<{ jobId: string; status: string; phase?: string }>(
      '/api/tools/speech-to-text',
      {
        method: 'POST',
        headers: authHeaders(),
        body: fd
      }
    )

    if (start.phase === 'uploading' || start.phase === 'transcribing') {
      processingPhase.value = start.phase
    } else {
      processingPhase.value = 'transcribing'
    }

    await pollJob(start.jobId)
  } catch (e: unknown) {
    formError.value = formatApiFetchError(e, 'Could not transcribe audio')
    toast.showToast(formError.value, 'error')
    uiPhase.value = 'form'
  } finally {
    submitting.value = false
  }
}

async function retryTranscription () {
  if (lastJobFile.value) {
    selectedFile.value = lastJobFile.value
    fileError.value = ''
  }
  uiPhase.value = 'form'
  await nextTick()
  if (selectedFile.value && !fileError.value) {
    await startTranscription()
  }
}

function startOver () {
  uiPhase.value = 'form'
  clearFile()
  editableTranscript.value = ''
  resultSrt.value = ''
  resultWarnings.value = []
  resultFailed.value = false
  resultError.value = ''
  formError.value = ''
  lastJobFile.value = null
}

async function copyTranscript () {
  try {
    await navigator.clipboard.writeText(editableTranscript.value)
    toast.showToast('Transcript copied.', 'success')
  } catch {
    toast.showToast('Could not copy transcript.', 'error')
  }
}

function downloadBlob (content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadTxt () {
  const base = (resultFilename.value || 'transcript').replace(/\.[^.]+$/, '')
  downloadBlob(editableTranscript.value, `${base}.txt`, 'text/plain;charset=utf-8')
}

function downloadSrt () {
  if (!resultSrt.value) return
  const base = (resultFilename.value || 'transcript').replace(/\.[^.]+$/, '')
  downloadBlob(resultSrt.value, `${base}.srt`, 'application/x-subrip;charset=utf-8')
}

function openHistoryItem (item: SpeechToTextHistoryItem) {
  if (!item.text) return
  editableTranscript.value = item.text
  resultFilename.value = item.filename
  resultDuration.value = item.durationSeconds
  resultWordCount.value = item.wordCount || countTranscriptWords(item.text)
  resultSrt.value = ''
  resultFailed.value = false
  resultError.value = ''
  resultWarnings.value = []
  uiPhase.value = 'results'
}

function deleteHistoryItem (id: string) {
  history.value = removeSpeechToTextHistory(history.value, id)
}

function formatHistoryDate (iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

useHead({ title: 'Speech to Text' })
</script>
