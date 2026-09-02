<template>
  <div class="min-h-screen">
    <header class="px-5 sm:px-8 py-6 flex items-center justify-between">
      <p class="font-display text-2xl tracking-tight text-ink">AIElegance</p>
    </header>

    <main class="mx-auto w-full max-w-5xl px-5 sm:px-8 pb-16">
      <section v-if="phase === 'ask'" class="pt-6 sm:pt-10">
        <h1 class="font-display text-4xl sm:text-5xl leading-tight text-ink max-w-3xl">
          Ask once. Compare the smartest AI models.
        </h1>
        <p class="mt-4 text-muted text-base sm:text-lg max-w-2xl">
          Ask one question and see how leading AI models respond.
        </p>

        <form class="mt-10" @submit.prevent="askModels">
          <label for="question" class="sr-only">What would you like to ask?</label>
          <textarea
            id="question"
            v-model="question"
            rows="6"
            maxlength="4000"
            placeholder="What would you like to ask?"
            class="w-full rounded-2xl border border-line bg-card px-5 py-4 text-lg text-ink placeholder:text-muted/70 shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage resize-y min-h-[10rem]"
          />
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-full bg-sage hover:bg-sage-hover text-white font-medium px-6 py-3 text-base transition-colors disabled:opacity-50"
              :disabled="!question.trim() || submitting"
            >
              {{ submitting ? 'Asking…' : 'Ask the Models' }}
            </button>
            <p class="text-sm text-muted">
              Responses may come from OpenAI, Claude, Gemini and other leading models.
            </p>
          </div>
          <p v-if="formError" class="mt-3 text-sm text-red-700">{{ formError }}</p>
        </form>
      </section>

      <section v-else>
        <p class="text-sm text-muted">Your question</p>
        <h2 class="mt-1 font-display text-2xl sm:text-3xl text-ink leading-snug whitespace-pre-wrap">
          {{ asked }}
        </h2>

        <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <article
            v-for="card in cards"
            :key="card.modelId"
            class="rounded-2xl border border-line bg-card p-5 shadow-sm min-h-[14rem] flex flex-col"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {{ card.provider }}
                </p>
                <h3 class="mt-1 text-lg font-medium text-ink">{{ card.modelName }}</h3>
              </div>
              <button
                v-if="card.content && !card.error"
                type="button"
                class="text-xs font-medium text-sage hover:underline"
                @click="copyCard(card)"
              >
                {{ copiedId === card.modelId ? 'Copied' : 'Copy' }}
              </button>
            </div>

            <div class="mt-4 flex-1 text-[15px] text-ink">
              <p v-if="card.status === 'thinking'" class="text-muted italic">Thinking…</p>
              <p v-else-if="card.error" class="text-red-700">{{ card.error }}</p>
              <div v-else class="prose-answer" v-html="renderAnswerMarkdown(card.content)" />
            </div>
          </article>
        </div>

        <div class="mt-8">
          <button
            type="button"
            class="rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium text-ink hover:border-sage/40"
            @click="askAnother"
          >
            Ask another question
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { renderAnswerMarkdown } from '~/lib/markdown'
import type { CompareResult } from '~/lib/compare'

type PublicModel = { id: string; name: string; provider: string }
type Card = {
  modelId: string
  modelName: string
  provider: string
  status: 'thinking' | 'done'
  content: string
  error: string | null
}

const question = ref('')
const asked = ref('')
const phase = ref<'ask' | 'results'>('ask')
const submitting = ref(false)
const formError = ref('')
const cards = ref<Card[]>([])
const copiedId = ref('')

const { data: modelsPayload } = await useFetch<{ models: PublicModel[] }>('/api/models')

function seedCards (models: PublicModel[]): Card[] {
  return models.map(m => ({
    modelId: m.id,
    modelName: m.name,
    provider: m.provider,
    status: 'thinking',
    content: '',
    error: null
  }))
}

async function copyCard (card: Card) {
  try {
    await navigator.clipboard.writeText(card.content)
    copiedId.value = card.modelId
    window.setTimeout(() => {
      if (copiedId.value === card.modelId) copiedId.value = ''
    }, 1500)
  } catch {
    /* ignore */
  }
}

function applyResult (result: CompareResult) {
  const i = cards.value.findIndex(c => c.modelId === result.modelId)
  if (i < 0) return
  cards.value[i] = {
    ...cards.value[i]!,
    status: 'done',
    content: result.content || '',
    error: result.error
  }
}

async function askModels () {
  formError.value = ''
  const prompt = question.value.trim()
  if (!prompt) return
  const models = modelsPayload.value?.models || []
  if (!models.length) {
    formError.value = 'No models are configured.'
    return
  }

  asked.value = prompt
  cards.value = seedCards(models)
  phase.value = 'results'
  submitting.value = true

  try {
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ prompt })
    })
    if (!res.ok) {
      const msg = res.status === 429
        ? 'Too many questions. Please wait a moment.'
        : 'Could not start the comparison.'
      cards.value = cards.value.map(c => ({ ...c, status: 'done', error: msg }))
      return
    }
    const reader = res.body?.getReader()
    if (!reader) {
      cards.value = cards.value.map(c => ({ ...c, status: 'done', error: 'Could not stream responses.' }))
      return
    }
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const chunks = buf.split('\n\n')
      buf = chunks.pop() || ''
      for (const chunk of chunks) {
        const line = chunk.split('\n').find(l => l.startsWith('data:'))
        if (!line) continue
        const raw = line.slice(5).trim()
        if (!raw) continue
        let parsed: { type?: string } & Partial<CompareResult>
        try {
          parsed = JSON.parse(raw) as { type?: string } & Partial<CompareResult>
        } catch {
          continue
        }
        if (parsed.type === 'result' && parsed.modelId) {
          applyResult({
            modelId: parsed.modelId,
            modelName: parsed.modelName || parsed.modelId,
            provider: parsed.provider || 'Model',
            content: parsed.content || '',
            error: parsed.error ?? null,
            duration: parsed.duration || 0
          })
        }
      }
    }
    cards.value = cards.value.map(c =>
      c.status === 'thinking' ? { ...c, status: 'done', error: c.error || 'No response.' } : c
    )
  } catch {
    cards.value = cards.value.map(c =>
      c.status === 'thinking' ? { ...c, status: 'done', error: 'Could not reach the server.' } : c
    )
  } finally {
    submitting.value = false
  }
}

function askAnother () {
  phase.value = 'ask'
  cards.value = []
  copiedId.value = ''
  formError.value = ''
}
</script>
