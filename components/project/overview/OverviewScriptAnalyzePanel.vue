<script setup lang="ts">
export type ScriptAnalyzeCandidate = {
  modelId: string
  label: string
  synopsis?: string
  treatment?: string
  genre?: string
  tone?: string
  error?: string
}

const props = defineProps<{
  modelOptions: Array<{ id: string; label: string }>
  compareMode: boolean
  selectedModelId: string
  selectedModelIds: string[]
  analyzing: boolean
  previewing: boolean
  error: string
  candidates: ScriptAnalyzeCandidate[]
  disabled: boolean
  /** 'ready' = screenplay saved block; 'default' = generic */
  variant?: 'ready' | 'default'
  intro?: string
  radioName?: string
}>()

const emit = defineEmits<{
  analyze: []
  'toggle-compare': []
  'apply-candidate': [modelId: string]
  'update:selectedModelId': [id: string]
  'update:selectedModelIds': [ids: string[]]
}>()

const introText = computed(() => {
  if (props.intro) return props.intro
  if (props.variant === 'ready') {
    return 'Run analysis for a cold read of your saved screenplay — synopsis, tone, three-act map, and director notes faithful to what you wrote (no invented story beats).'
  }
  return 'Pick the model that will analyze your screenplay and build synopsis, treatment, and director notes.'
})

const radioFieldName = computed(() => props.radioName || 'analyze-model')
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <p v-if="variant === 'ready'" class="text-xs font-bold uppercase tracking-wide text-primary mb-2">
      Screenplay ready
    </p>
    <p class="text-sm text-gray-700 mb-3">{{ introText }}</p>
    <p class="text-sm font-semibold text-gray-900 mb-2">Choose your guide/director model</p>
    <p class="text-xs text-gray-600 mb-3">
      <template v-if="compareMode">
        Pick one or more models, compare outputs, then choose which one should guide this project.
      </template>
      <template v-else>
        Pick the model that will analyze your screenplay and build synopsis, treatment, and director notes.
      </template>
    </p>
    <div v-if="!compareMode" class="flex flex-wrap gap-3 mb-3">
      <label
        v-for="m in modelOptions"
        :key="`analyze-${m.id}`"
        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
      >
        <input
          :checked="selectedModelId === m.id"
          type="radio"
          :name="radioFieldName"
          :value="m.id"
          class="border-gray-300 text-primary focus:ring-primary"
          @change="emit('update:selectedModelId', m.id)"
        >
        <span class="text-sm text-gray-800">{{ m.label }}</span>
      </label>
    </div>
    <div v-else class="flex flex-wrap gap-3 mb-3">
      <label
        v-for="m in modelOptions"
        :key="`analyze-compare-${m.id}`"
        class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
      >
        <input
          :checked="selectedModelIds.includes(m.id)"
          type="checkbox"
          :value="m.id"
          class="rounded border-gray-300 text-primary focus:ring-primary"
          @change="($event) => {
            const checked = ($event.target as HTMLInputElement).checked
            const next = checked
              ? [...selectedModelIds, m.id]
              : selectedModelIds.filter(id => id !== m.id)
            emit('update:selectedModelIds', next)
          }"
        >
        <span class="text-sm text-gray-800">{{ m.label }}</span>
      </label>
    </div>
    <p class="text-xs mb-4">
      <button
        type="button"
        class="text-primary font-medium hover:underline"
        @click="emit('toggle-compare')"
      >
        {{ compareMode ? 'Use single model instead' : 'Compare multiple models…' }}
      </button>
    </p>
    <button
      type="button"
      class="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
      :disabled="disabled || previewing || analyzing || (compareMode ? !selectedModelIds.length : !selectedModelId)"
      @click="emit('analyze')"
    >
      {{ previewing || analyzing ? 'Analyzing script…' : 'Analyze script' }}
    </button>
    <p v-if="error" class="mt-3 text-sm text-red-700">{{ error }}</p>

    <div
      v-if="analyzing"
      class="mt-4 rounded-xl border border-primary/20 bg-white/70 p-5"
    >
      <FilmReelLoader
        size="sm"
        label="Analyzing script"
        sub-label="Reading your screenplay — synopsis, observations, three-act map, director notes…"
      />
    </div>

    <div v-if="candidates.length" class="mt-5 grid gap-4">
      <article
        v-for="c in candidates"
        :key="`candidate-${c.modelId}`"
        class="rounded-xl border border-gray-200 bg-white p-4"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p class="text-sm font-semibold text-gray-900">{{ c.label }}</p>
          <button
            v-if="!c.error"
            type="button"
            class="px-3 py-1.5 bg-primary hover:bg-primary/90 text-gray-950 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            :disabled="analyzing"
            @click="emit('apply-candidate', c.modelId)"
          >
            Use this analysis
          </button>
        </div>
        <p v-if="c.error" class="text-sm text-red-700">{{ c.error }}</p>
        <template v-else>
          <p class="text-xs text-gray-500 mb-2">{{ c.genre || '—' }} · {{ c.tone || '—' }}</p>
          <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ c.synopsis || 'No synopsis returned.' }}</p>
        </template>
      </article>
    </div>
  </div>
</template>
