<template>
  <div class="border border-gray-200 rounded-lg p-6 bg-white flex flex-col h-full hover:border-gray-400 transition-colors shadow-sm">
    <div class="flex items-center gap-3 mb-4 flex-shrink-0">
      <div class="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-gray-100 rounded-lg p-1.5">
        <!-- ClientOnly: icon asset URLs can differ SSR vs client and break hydration -->
        <ClientOnly>
          <img
            v-if="iconSrc"
            :key="`icon-${model}`"
            :src="iconSrc"
            :alt="`${model} icon`"
            class="w-full h-full object-contain"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-gray-500"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <template #fallback>
            <div class="w-full h-full flex items-center justify-center text-gray-500">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </template>
        </ClientOnly>
      </div>
      <h3 class="text-lg font-semibold text-gray-900">{{ model }}</h3>
    </div>
    <div class="text-gray-700 whitespace-pre-wrap flex-1 mb-4 overflow-y-auto min-h-0 max-h-64 pr-2 scrollbar-thin">
      {{ response.answer }}
    </div>
    <div class="border-t border-gray-200 pt-4">
      <!-- Average Rating Display -->
      <div v-if="averageRating > 0" class="mb-3 flex items-center gap-2 text-sm">
        <div class="flex items-center gap-1">
          <span class="text-gray-800 font-semibold">{{ averageRating.toFixed(1) }}</span>
          <svg class="w-4 h-4 text-accent-orange" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
          </svg>
        </div>
        <span class="text-gray-500">({{ ratingCount }} {{ ratingCount === 1 ? 'vote' : 'votes' }})</span>
      </div>

      <!-- Rating Stars -->
      <div class="flex items-center justify-between">
        <div class="flex gap-1">
          <button
            v-for="star in 5"
            :key="star"
            @click="setRating(star)"
            :disabled="!canRate"
            :class="[
              'transition-colors',
              canRate ? 'cursor-pointer hover:text-accent-orange' : 'cursor-not-allowed',
              (userRating && star <= userRating) || (!userRating && averageRating > 0 && star <= Math.round(averageRating))
                ? 'text-accent-orange'
                : 'text-gray-500'
            ]"
          >
            <svg
              v-if="(userRating && star <= userRating) || (!userRating && averageRating > 0 && star <= Math.round(averageRating))"
              class="w-5 h-5 fill-accent-orange"
              viewBox="0 0 20 20"
            >
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
            <svg
              v-else
              class="w-5 h-5 fill-current"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"
                stroke="currentColor"
                stroke-width="1"
                fill="none"
              />
            </svg>
          </button>
        </div>
        <button
          v-if="userRating && canRate"
          @click="clearRating"
          class="text-sm text-accent-purple hover:text-accent-purple/80 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import chatgptIcon from '~/assets/icons/chatgpt.svg'
import claudeIcon from '~/assets/icons/claude.svg'
import geminiIcon from '~/assets/icons/gemini.svg'
import mistralIcon from '~/assets/icons/mistral.svg'
import deepseekIcon from '~/assets/icons/deepseek.svg'
import llamaIcon from '~/assets/icons/llama.svg'
import grokIcon from '~/assets/icons/grok.svg'
import perplexityIcon from '~/assets/icons/perplexity.svg'

const props = defineProps({
  model: {
    type: String,
    required: true
  },
  response: {
    type: Object,
    required: true
  },
  questionId: {
    type: String,
    default: null
  },
  canRate: {
    type: Boolean,
    default: true
  },
  averageRating: {
    type: Number,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  },
  userRating: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:rating'])

const iconSrc = computed(() => {
  const iconMap: Record<string, any> = {
    'ChatGPT': chatgptIcon,
    'Claude': claudeIcon,
    'Gemini': geminiIcon,
    'Mistral': mistralIcon,
    'DeepSeek': deepseekIcon,
    'LLaMA': llamaIcon,
    'Grok': grokIcon,
    'Perplexity': perplexityIcon,
  }
  return iconMap[props.model] || null
})

const setRating = (rating: number) => {
  emit('update:rating', { model: props.model, rating })
}

const clearRating = () => {
  emit('update:rating', { model: props.model, rating: null })
}
</script>

